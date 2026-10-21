use crate::job_object::ProcessTreeGuard;
use crate::path_policy::{resolve_cwd, workspace_root};
use crate::storage::WorkspaceDb;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::{HashMap, VecDeque};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Condvar, Mutex, Weak};
use std::thread;
use std::time::{Duration, Instant};
use uuid::Uuid;

pub(crate) const MIN_COLS: u32 = 1;
pub(crate) const MAX_COLS: u32 = 500;
pub(crate) const MIN_ROWS: u32 = 1;
pub(crate) const MAX_ROWS: u32 = 300;
pub(crate) const MAX_INPUT_BYTES: usize = 16 * 1024;
const MAX_OUTPUT_BYTES: usize = 1024 * 1024;
const MAX_PTY_READ_CHUNK: usize = 4096;
const MAX_QUEUED_INPUT_BYTES: usize = 64 * 1024;
const MAX_READ_BYTES: usize = 64 * 1024;
const MAX_READ_CHUNKS: usize = 64;
const MAX_ACTIVE_SESSIONS: usize = 16;
const MAX_SESSION_RECORDS: usize = 64;
const TERMINATION_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum SessionState {
    Running,
    Exited,
    Closed,
    Failed,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionInfo {
    pub(crate) id: String,
    pub(crate) cwd: String,
    pub(crate) state: SessionState,
    pub(crate) cols: u32,
    pub(crate) rows: u32,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionChunk {
    pub(crate) seq: u64,
    pub(crate) data: Vec<u8>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SessionRead {
    pub(crate) session_id: String,
    pub(crate) chunks: Vec<SessionChunk>,
    pub(crate) state: SessionState,
    pub(crate) truncated: bool,
}

#[derive(Default)]
struct OutputRing {
    chunks: VecDeque<SessionChunk>,
    bytes: usize,
    next_seq: u64,
}

impl OutputRing {
    fn push(&mut self, bytes: &[u8]) {
        if bytes.is_empty() {
            return;
        }
        let seq = self.next_seq.saturating_add(1);
        self.next_seq = seq;
        self.chunks.push_back(SessionChunk {
            seq,
            data: bytes.to_vec(),
        });
        self.bytes = self.bytes.saturating_add(bytes.len());
        while self.bytes > MAX_OUTPUT_BYTES {
            if let Some(chunk) = self.chunks.pop_front() {
                self.bytes = self.bytes.saturating_sub(chunk.data.len());
            } else {
                self.bytes = 0;
                break;
            }
        }
    }

    fn read_after(&self, after_seq: u64) -> (Vec<SessionChunk>, bool) {
        let oldest = self
            .chunks
            .front()
            .map(|chunk| chunk.seq)
            .unwrap_or(self.next_seq.saturating_add(1));
        let truncated = after_seq < oldest.saturating_sub(1);
        let mut total_bytes = 0usize;
        let mut chunks = Vec::new();
        for chunk in self.chunks.iter().filter(|chunk| chunk.seq > after_seq) {
            if chunks.len() >= MAX_READ_CHUNKS
                || total_bytes.saturating_add(chunk.data.len()) > MAX_READ_BYTES
            {
                break;
            }
            total_bytes += chunk.data.len();
            chunks.push(chunk.clone());
        }
        (chunks, truncated)
    }
}

#[derive(Default)]
struct InputState {
    chunks: VecDeque<Vec<u8>>,
    buffered_bytes: usize,
    closed: bool,
}

#[derive(Default)]
struct InputQueue {
    state: Mutex<InputState>,
    ready: Condvar,
}

impl InputQueue {
    fn enqueue(&self, bytes: &[u8]) -> Result<(), String> {
        if bytes.is_empty() {
            return Ok(());
        }
        let mut state = self
            .state
            .lock()
            .map_err(|_| "PTY input queue is unavailable")?;
        if state.closed {
            return Err("session is closed".into());
        }
        if state.buffered_bytes.saturating_add(bytes.len()) > MAX_QUEUED_INPUT_BYTES {
            return Err("PTY input queue is full".into());
        }
        state.buffered_bytes += bytes.len();
        state.chunks.push_back(bytes.to_vec());
        self.ready.notify_one();
        Ok(())
    }

    fn take(&self) -> Option<Vec<u8>> {
        let mut state = self.state.lock().ok()?;
        while state.chunks.is_empty() && !state.closed {
            state = self.ready.wait(state).ok()?;
        }
        if state.closed {
            return None;
        }
        state.chunks.pop_front()
    }

    fn complete(&self, bytes: usize) {
        if let Ok(mut state) = self.state.lock() {
            state.buffered_bytes = state.buffered_bytes.saturating_sub(bytes);
        }
    }

    fn close(&self) {
        if let Ok(mut state) = self.state.lock() {
            state.closed = true;
            state.chunks.clear();
            state.buffered_bytes = 0;
        }
        self.ready.notify_all();
    }
}

fn run_input_worker(
    queue: Arc<InputQueue>,
    mut writer: Box<dyn Write + Send>,
    on_error: impl FnOnce() + Send + 'static,
) {
    let mut on_error = Some(on_error);
    while let Some(bytes) = queue.take() {
        let len = bytes.len();
        if writer
            .write_all(&bytes)
            .and_then(|()| writer.flush())
            .is_err()
        {
            queue.close();
            if let Some(on_error) = on_error.take() {
                on_error();
            }
            return;
        }
        queue.complete(len);
    }
}

struct SessionStatus {
    state: SessionState,
    cols: u32,
    rows: u32,
}

struct PtyProcess {
    child: Box<dyn Child + Send>,
    master: Option<Box<dyn MasterPty + Send>>,
    process_tree: Option<ProcessTreeGuard>,
}

struct Session {
    id: String,
    cwd: PathBuf,
    status: Mutex<SessionStatus>,
    process: Mutex<Option<PtyProcess>>,
    output: Arc<Mutex<OutputRing>>,
    input: Arc<InputQueue>,
}

impl Session {
    fn spawn(root: &Path, cwd: Option<&str>, cols: u32, rows: u32) -> Result<Arc<Self>, String> {
        validate_dimensions(cols, rows)?;
        let cwd = resolve_cwd(root, cwd)?;
        let size = PtySize {
            rows: rows as u16,
            cols: cols as u16,
            pixel_width: 0,
            pixel_height: 0,
        };
        let pty_pair = native_pty_system()
            .openpty(size)
            .map_err(|_| "native PTY could not be opened")?;
        let mut command = initial_shell_command()?;
        command.cwd(&cwd);
        command.env("TERM", "xterm-256color");

        let mut child = pty_pair
            .slave
            .spawn_command(command)
            .map_err(|_| "PowerShell session could not be started")?;
        drop(pty_pair.slave);
        let process_id = match child.process_id() {
            Some(process_id) => process_id,
            None => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("PTY process id is unavailable".into());
            }
        };
        let process_tree = match ProcessTreeGuard::attach(process_id) {
            Ok(guard) => guard,
            Err(error) => {
                let _ = child.kill();
                let _ = child.wait();
                return Err(error);
            }
        };
        let reader = pty_pair
            .master
            .try_clone_reader()
            .map_err(|_| "PTY output reader could not be created")?;
        let writer = pty_pair
            .master
            .take_writer()
            .map_err(|_| "PTY input writer could not be created")?;

        let id = Uuid::new_v4().to_string();
        let session = Arc::new(Self {
            id,
            cwd,
            status: Mutex::new(SessionStatus {
                state: SessionState::Running,
                cols,
                rows,
            }),
            process: Mutex::new(Some(PtyProcess {
                child,
                master: Some(pty_pair.master),
                process_tree: Some(process_tree),
            })),
            output: Arc::new(Mutex::new(OutputRing::default())),
            input: Arc::new(InputQueue::default()),
        });

        if let Err(error) = session.start_reader(reader) {
            let _ = session.close();
            return Err(error);
        }
        if let Err(error) = session.start_input_worker(writer) {
            let _ = session.close();
            return Err(error);
        }
        if let Err(error) = session.start_monitor() {
            let _ = session.close();
            return Err(error);
        }
        Ok(session)
    }

    fn info(&self) -> Result<SessionInfo, String> {
        let status = self
            .status
            .lock()
            .map_err(|_| "session status is unavailable")?;
        Ok(SessionInfo {
            id: self.id.clone(),
            cwd: self.cwd.to_string_lossy().into_owned(),
            state: status.state,
            cols: status.cols,
            rows: status.rows,
        })
    }

    fn write(&self, data: &str) -> Result<(), String> {
        validate_input(data)?;
        let status = self
            .status
            .lock()
            .map_err(|_| "session status is unavailable")?;
        if status.state != SessionState::Running {
            return Err("session is not running".into());
        }
        drop(status);
        self.input.enqueue(data.as_bytes())
    }

    fn resize(&self, cols: u32, rows: u32) -> Result<(), String> {
        validate_dimensions(cols, rows)?;
        let mut process_guard = self
            .process
            .lock()
            .map_err(|_| "session process is unavailable")?;
        let process = process_guard.as_mut().ok_or("session is closed")?;
        let mut status = self
            .status
            .lock()
            .map_err(|_| "session status is unavailable")?;
        if status.state != SessionState::Running {
            return Err("session is not running".into());
        }
        process
            .master
            .as_ref()
            .ok_or("session is closed")?
            .resize(PtySize {
                rows: rows as u16,
                cols: cols as u16,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|_| "PTY could not be resized")?;
        status.cols = cols;
        status.rows = rows;
        Ok(())
    }

    fn read(&self, after_seq: u64) -> Result<SessionRead, String> {
        let (chunks, truncated) = self
            .output
            .lock()
            .map_err(|_| "session output is unavailable")?
            .read_after(after_seq);
        let info = self.info()?;
        Ok(SessionRead {
            session_id: self.id.clone(),
            chunks,
            state: info.state,
            truncated,
        })
    }

    fn close(&self) -> Result<(), String> {
        // Never wait for the writer worker: it may be blocked by an unread PTY.
        self.input.close();
        let mut process_guard = self
            .process
            .lock()
            .map_err(|_| "session process is unavailable")?;
        let Some(process) = process_guard.as_mut() else {
            self.status
                .lock()
                .map_err(|_| "session status is unavailable")?
                .state = SessionState::Closed;
            return Ok(());
        };

        let close_result = (|| {
            let tree = process
                .process_tree
                .as_ref()
                .ok_or("session Job Object is unavailable")?;
            // A failed request is reported if termination cannot later be confirmed.
            let tree_termination = tree.terminate();
            let child_termination = process.child.kill();
            let deadline = Instant::now() + TERMINATION_TIMEOUT;
            wait_for_termination(
                deadline,
                || {
                    process
                        .child
                        .try_wait()
                        .map(|status| status.is_some())
                        .map_err(|_| "PTY process exit could not be queried".to_string())
                },
                || tree.active_process_count(),
            )
            .map_err(|error| {
                let mut details = Vec::new();
                if tree_termination.is_err() {
                    details.push("Job Object termination request failed");
                }
                if child_termination.is_err() {
                    details.push("direct child termination request failed");
                }
                if details.is_empty() {
                    error
                } else {
                    format!("{error}; {}", details.join("; "))
                }
            })?;
            process.child.wait().map_err(|_| {
                "PTY process exit could not be reaped after termination".to_string()
            })?;
            Ok::<(), String>(())
        })();

        match close_result {
            Ok(()) => {
                process.master.take();
                *process_guard = None;
                self.status
                    .lock()
                    .map_err(|_| "session status is unavailable")?
                    .state = SessionState::Closed;
                Ok(())
            }
            Err(error) => {
                self.status
                    .lock()
                    .map_err(|_| "session status is unavailable")?
                    .state = SessionState::Failed;
                Err(error)
            }
        }
    }

    fn refresh_state(&self) {
        let Ok(mut process_guard) = self.process.lock() else {
            return;
        };
        let Some(process) = process_guard.as_mut() else {
            return;
        };
        let Ok(mut status) = self.status.lock() else {
            return;
        };
        if status.state != SessionState::Running {
            return;
        }
        match process.child.try_wait() {
            Ok(Some(_)) => status.state = SessionState::Exited,
            Ok(None) => {}
            Err(_) => status.state = SessionState::Failed,
        }
    }

    fn state(&self) -> SessionState {
        self.status
            .lock()
            .map(|status| status.state)
            .unwrap_or(SessionState::Failed)
    }

    fn has_live_process_or_unknown(&self) -> bool {
        let Ok(mut process_guard) = self.process.lock() else {
            return true;
        };
        let Some(process) = process_guard.as_mut() else {
            return false;
        };
        let child_exited = process
            .child
            .try_wait()
            .ok()
            .map(|exit_status| exit_status.is_some());
        let active_job_processes = process
            .process_tree
            .as_ref()
            .and_then(|tree| tree.active_process_count().ok());
        process_may_be_alive(child_exited, active_job_processes)
    }

    fn set_failed_if_running(&self) {
        if let Ok(mut status) = self.status.lock() {
            if status.state == SessionState::Running {
                status.state = SessionState::Failed;
            }
        }
    }

    fn reconcile_reader_end(&self) {
        // A PTY may report EOF/BrokenPipe just before the process handle becomes signaled.
        // Give try_wait a short window so a normal shell exit wins over a reader error.
        let deadline = Instant::now() + Duration::from_secs(1);
        loop {
            self.refresh_state();
            match self.state() {
                SessionState::Running if Instant::now() < deadline => {
                    thread::sleep(Duration::from_millis(10));
                }
                SessionState::Running => {
                    self.set_failed_if_running();
                    return;
                }
                _ => return,
            }
        }
    }

    fn start_reader(self: &Arc<Self>, mut reader: Box<dyn Read + Send>) -> Result<(), String> {
        let weak = Arc::downgrade(self);
        let output = Arc::clone(&self.output);
        thread::Builder::new()
            .name("ciranda-pty-reader".into())
            .spawn(move || {
                let mut buffer = [0u8; MAX_PTY_READ_CHUNK];
                loop {
                    match reader.read(&mut buffer) {
                        Ok(0) => {
                            if let Some(session) = weak.upgrade() {
                                session.reconcile_reader_end();
                            }
                            break;
                        }
                        Ok(count) => {
                            let Ok(mut ring) = output.lock() else { break };
                            ring.push(&buffer[..count]);
                        }
                        Err(error) if error.kind() == std::io::ErrorKind::Interrupted => continue,
                        Err(error) if error.kind() == std::io::ErrorKind::BrokenPipe => {
                            if let Some(session) = weak.upgrade() {
                                session.reconcile_reader_end();
                            }
                            break;
                        }
                        Err(_) => {
                            if let Some(session) = weak.upgrade() {
                                session.set_failed_if_running();
                            }
                            break;
                        }
                    }
                }
            })
            .map_err(|_| "PTY output worker could not be started")?;
        Ok(())
    }

    fn start_input_worker(self: &Arc<Self>, writer: Box<dyn Write + Send>) -> Result<(), String> {
        let weak = Arc::downgrade(self);
        let queue = Arc::clone(&self.input);
        thread::Builder::new()
            .name("ciranda-pty-input".into())
            .spawn(move || {
                run_input_worker(queue, writer, move || {
                    if let Some(session) = weak.upgrade() {
                        session.set_failed_if_running();
                    }
                });
            })
            .map_err(|_| "PTY input worker could not be started")?;
        Ok(())
    }

    fn start_monitor(self: &Arc<Self>) -> Result<(), String> {
        let weak: Weak<Self> = Arc::downgrade(self);
        thread::Builder::new()
            .name("ciranda-pty-monitor".into())
            .spawn(move || loop {
                let Some(session) = weak.upgrade() else { break };
                if session.state() != SessionState::Running {
                    break;
                }
                session.refresh_state();
                drop(session);
                thread::sleep(Duration::from_millis(100));
            })
            .map_err(|_| "PTY process monitor could not be started")?;
        Ok(())
    }
}

impl Drop for Session {
    fn drop(&mut self) {
        let _ = self.close();
    }
}

pub(crate) struct SessionManager {
    root: PathBuf,
    sessions: HashMap<String, Arc<Session>>,
    shutting_down: bool,
}

impl SessionManager {
    pub(crate) fn new(root: PathBuf) -> Self {
        Self {
            root,
            sessions: HashMap::new(),
            shutting_down: false,
        }
    }

    pub(crate) fn create(
        &mut self,
        cwd: Option<&str>,
        cols: u32,
        rows: u32,
    ) -> Result<SessionInfo, String> {
        if self.shutting_down {
            return Err("application is shutting down".into());
        }
        let active = self
            .sessions
            .values()
            .filter(|session| session.has_live_process_or_unknown())
            .count();
        validate_session_capacity(active, 0)?;
        self.prune_history();
        validate_session_capacity(0, self.sessions.len())?;

        let session = Session::spawn(&self.root, cwd, cols, rows)?;
        let info = session.info()?;
        self.sessions.insert(info.id.clone(), session);
        Ok(info)
    }

    pub(crate) fn list(&self) -> Result<Vec<SessionInfo>, String> {
        let mut sessions = self
            .sessions
            .values()
            .map(|session| session.info())
            .collect::<Result<Vec<_>, _>>()?;
        sessions.sort_by(|left, right| left.id.cmp(&right.id));
        Ok(sessions)
    }

    pub(crate) fn write(&self, session_id: &str, data: &str) -> Result<(), String> {
        self.get(session_id)?.write(data)
    }

    pub(crate) fn resize(&self, session_id: &str, cols: u32, rows: u32) -> Result<(), String> {
        self.get(session_id)?.resize(cols, rows)
    }

    pub(crate) fn read(&self, session_id: &str, after_seq: u64) -> Result<SessionRead, String> {
        self.get(session_id)?.read(after_seq)
    }

    pub(crate) fn close(&mut self, session_id: &str) -> Result<(), String> {
        if let Some(session) = self.sessions.get(session_id) {
            session.close()?;
        }
        Ok(())
    }

    pub(crate) fn shutdown(&mut self) {
        self.shutting_down = true;
        for session in self.sessions.values() {
            let _ = session.close();
        }
    }

    fn get(&self, session_id: &str) -> Result<Arc<Session>, String> {
        self.sessions
            .get(session_id)
            .cloned()
            .ok_or_else(|| "session does not exist".into())
    }

    fn prune_history(&mut self) {
        while self.sessions.len() >= MAX_SESSION_RECORDS {
            let expired = self
                .sessions
                .iter()
                .find(|(_, session)| session.state() != SessionState::Running)
                .map(|(id, _)| id.clone());
            let Some(id) = expired else { break };
            self.sessions.remove(&id);
        }
    }
}

impl Drop for SessionManager {
    fn drop(&mut self) {
        self.shutdown();
    }
}

pub(crate) struct AppState {
    pub(crate) root: PathBuf,
    pub(crate) sessions: Mutex<SessionManager>,
    pub(crate) storage: WorkspaceDb,
}

impl AppState {
    pub(crate) fn new() -> Result<Self, String> {
        let root = workspace_root()?;
        let storage = WorkspaceDb::open(&root)?;
        let sessions = SessionManager::new(root.clone());
        Ok(Self {
            root,
            sessions: Mutex::new(sessions),
            storage,
        })
    }

    pub(crate) fn shutdown(&self) {
        if let Ok(mut sessions) = self.sessions.lock() {
            sessions.shutdown();
        }
    }
}

impl Drop for AppState {
    fn drop(&mut self) {
        self.shutdown();
    }
}

fn validate_dimensions(cols: u32, rows: u32) -> Result<(), String> {
    if !(MIN_COLS..=MAX_COLS).contains(&cols) || !(MIN_ROWS..=MAX_ROWS).contains(&rows) {
        return Err("terminal dimensions are outside allowed bounds".into());
    }
    Ok(())
}

fn validate_input(data: &str) -> Result<(), String> {
    if data.len() > MAX_INPUT_BYTES {
        return Err("terminal input exceeds the per-write size limit".into());
    }
    Ok(())
}

fn validate_session_capacity(active: usize, retained: usize) -> Result<(), String> {
    if active >= MAX_ACTIVE_SESSIONS {
        return Err("maximum number of active sessions reached".into());
    }
    if retained >= MAX_SESSION_RECORDS {
        return Err("session history limit reached".into());
    }
    Ok(())
}

fn initial_shell_command() -> Result<CommandBuilder, String> {
    #[cfg(windows)]
    let shell_path = resolve_windows_powershell_path(std::env::var_os("SystemRoot").as_deref())?;
    #[cfg(windows)]
    let mut command = CommandBuilder::new(shell_path.as_os_str());
    #[cfg(not(windows))]
    let mut command = CommandBuilder::new("pwsh");

    command.arg("-NoLogo");
    command.arg("-NoProfile");
    #[cfg(windows)]
    command.arg("-NoExit");
    #[cfg(not(windows))]
    command.arg("-NoExit");
    Ok(command)
}

#[cfg(windows)]
fn resolve_windows_powershell_path(
    system_root: Option<&std::ffi::OsStr>,
) -> Result<PathBuf, String> {
    let system_root = system_root
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .ok_or("SystemRoot is unavailable")?;
    if !system_root.is_absolute() {
        return Err("SystemRoot must be an absolute path".into());
    }

    let executable = system_root.join("System32/WindowsPowerShell/v1.0/powershell.exe");
    if !executable.is_file() {
        return Err("Windows PowerShell is missing from the SystemRoot location".into());
    }
    Ok(executable)
}

fn process_may_be_alive(child_exited: Option<bool>, active_job_processes: Option<u32>) -> bool {
    match (child_exited, active_job_processes) {
        (Some(child_exited), Some(active_job_processes)) => {
            !child_exited || active_job_processes > 0
        }
        _ => true,
    }
}

fn wait_for_termination(
    deadline: Instant,
    mut child_exited: impl FnMut() -> Result<bool, String>,
    mut active_job_processes: impl FnMut() -> Result<u32, String>,
) -> Result<(), String> {
    loop {
        let child_exited = child_exited()?;
        let active_job_processes = active_job_processes()?;
        if child_exited && active_job_processes == 0 {
            return Ok(());
        }
        let now = Instant::now();
        if now >= deadline {
            return Err("process tree termination was not confirmed within five seconds".into());
        }
        thread::sleep(Duration::from_millis(25).min(deadline.saturating_duration_since(now)));
    }
}

#[cfg(test)]
mod tests {
    use super::{
        process_may_be_alive, run_input_worker, validate_dimensions, validate_input,
        validate_session_capacity, wait_for_termination, InputQueue, OutputRing, SessionManager,
        SessionState, MAX_ACTIVE_SESSIONS, MAX_INPUT_BYTES, MAX_OUTPUT_BYTES,
        MAX_QUEUED_INPUT_BYTES, MAX_SESSION_RECORDS,
    };
    use std::fs;
    use std::io::{self, Write};
    use std::path::PathBuf;
    use std::sync::{mpsc, Arc, Condvar, Mutex};
    use std::thread;
    use std::time::{Duration, Instant};
    use uuid::Uuid;

    struct TestRoot(PathBuf);

    impl TestRoot {
        fn new() -> Self {
            let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("target")
                .join(format!("session-test-{}", Uuid::new_v4()));
            fs::create_dir_all(&path)
                .expect("test root can be created in the local target directory");
            Self(path)
        }
    }

    impl Drop for TestRoot {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    struct BlockingWriter {
        entered: Option<mpsc::SyncSender<()>>,
        released: Arc<(Mutex<bool>, Condvar)>,
    }

    impl Write for BlockingWriter {
        fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
            if let Some(entered) = self.entered.take() {
                let _ = entered.send(());
            }
            let (lock, ready) = &*self.released;
            let mut released = lock.lock().unwrap();
            while !*released {
                released = ready.wait(released).unwrap();
            }
            Ok(bytes.len())
        }

        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    #[cfg(windows)]
    const CURSOR_POSITION_QUERY: &[u8] = b"\x1b[6n";
    #[cfg(windows)]
    const CURSOR_POSITION_RESPONSE: &str = "\x1b[1;1R";

    #[cfg(windows)]
    #[derive(Default)]
    struct RawPtyHarness {
        after_seq: u64,
        bytes: Vec<u8>,
        cursor_queries_answered: usize,
        truncated: bool,
    }

    #[cfg(windows)]
    impl RawPtyHarness {
        fn poll(&mut self, manager: &SessionManager, session_id: &str) -> Result<(), String> {
            let read = manager.read(session_id, self.after_seq)?;
            self.truncated |= read.truncated;
            for chunk in read.chunks {
                self.after_seq = self.after_seq.max(chunk.seq);
                self.bytes.extend_from_slice(&chunk.data);
            }

            let cursor_queries = count_cursor_position_queries(&self.bytes);
            while self.cursor_queries_answered < cursor_queries {
                // The raw harness emulates xterm's cursor response in tests only.
                // Production input still comes from the real UI and IPC path.
                manager.write(session_id, CURSOR_POSITION_RESPONSE)?;
                self.cursor_queries_answered += 1;
            }
            Ok(())
        }

        fn settle_startup(
            &mut self,
            manager: &SessionManager,
            session_id: &str,
        ) -> Result<(), String> {
            let deadline = Instant::now() + Duration::from_secs(1);
            loop {
                self.poll(manager, session_id)?;
                if self.cursor_queries_answered > 0 {
                    return Ok(());
                }
                if Instant::now() >= deadline {
                    return Err(format!(
                        "raw PTY startup did not emit and answer CSI 6 n within one second; {}",
                        self.diagnostics()
                    ));
                }
                thread::sleep(Duration::from_millis(10));
            }
        }

        fn contains_marker(&self, marker: &str) -> bool {
            self.bytes
                .windows(marker.len())
                .any(|window| window == marker.as_bytes())
        }

        fn diagnostics(&self) -> String {
            let query_count = count_cursor_position_queries(&self.bytes);
            let evidence = if self.bytes.len() <= 512 {
                format!(
                    "escaped='{}' hex=[{}]",
                    escaped_bytes(&self.bytes),
                    hex_bytes(&self.bytes)
                )
            } else {
                let head = &self.bytes[..256];
                let tail = &self.bytes[self.bytes.len() - 256..];
                format!(
                    "head escaped='{}' hex=[{}]; tail escaped='{}' hex=[{}]",
                    escaped_bytes(head),
                    hex_bytes(head),
                    escaped_bytes(tail),
                    hex_bytes(tail)
                )
            };
            format!(
                "raw PTY output: {} byte(s), ring_truncated={}, cursor-position queries answered={}/{}; {}",
                self.bytes.len(),
                self.truncated,
                self.cursor_queries_answered,
                query_count,
                evidence
            )
        }
    }

    #[cfg(windows)]
    fn count_cursor_position_queries(bytes: &[u8]) -> usize {
        bytes
            .windows(CURSOR_POSITION_QUERY.len())
            .filter(|window| *window == CURSOR_POSITION_QUERY)
            .count()
    }

    #[cfg(windows)]
    fn escaped_bytes(bytes: &[u8]) -> String {
        let mut escaped = String::new();
        for byte in bytes {
            match *byte {
                b'\r' => escaped.push_str("\\r"),
                b'\n' => escaped.push_str("\\n"),
                b'\t' => escaped.push_str("\\t"),
                0x1b => escaped.push_str("\\x1b"),
                0x20..=0x7e => escaped.push(char::from(*byte)),
                _ => escaped.push_str(&format!("\\x{byte:02x}")),
            }
        }
        escaped
    }

    #[cfg(windows)]
    fn hex_bytes(bytes: &[u8]) -> String {
        bytes
            .iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<Vec<_>>()
            .join(" ")
    }

    #[test]
    fn terminal_limits_accept_boundaries_and_reject_outside_values() {
        assert!(validate_dimensions(1, 1).is_ok());
        assert!(validate_dimensions(500, 300).is_ok());
        assert!(validate_dimensions(0, 24).is_err());
        assert!(validate_dimensions(501, 24).is_err());
        assert!(validate_dimensions(80, 301).is_err());
        assert!(validate_input(&"x".repeat(MAX_INPUT_BYTES)).is_ok());
        assert!(validate_input(&"x".repeat(MAX_INPUT_BYTES + 1)).is_err());
    }

    #[test]
    fn session_count_limits_accept_only_values_below_each_cap() {
        assert!(
            validate_session_capacity(MAX_ACTIVE_SESSIONS - 1, MAX_SESSION_RECORDS - 1).is_ok()
        );
        assert!(validate_session_capacity(MAX_ACTIVE_SESSIONS, 0).is_err());
        assert!(validate_session_capacity(0, MAX_SESSION_RECORDS).is_err());
    }

    #[test]
    fn process_capacity_uses_child_and_job_liveness_not_diagnostic_state() {
        assert!(process_may_be_alive(Some(false), Some(1)));
        assert!(process_may_be_alive(Some(true), Some(1)));
        assert!(process_may_be_alive(Some(true), None));
        assert!(process_may_be_alive(None, Some(0)));
        assert!(!process_may_be_alive(Some(true), Some(0)));
    }

    #[test]
    fn termination_wait_requires_child_exit_and_empty_job_and_has_timeout() {
        assert!(wait_for_termination(
            Instant::now() + Duration::from_secs(1),
            || Ok(true),
            || Ok(0)
        )
        .is_ok());

        let timed_out = wait_for_termination(Instant::now(), || Ok(false), || Ok(1));
        assert!(timed_out.is_err());
    }

    #[cfg(windows)]
    #[test]
    fn powershell_launcher_requires_the_absolute_systemroot_executable() {
        let root = TestRoot::new();
        let missing = super::resolve_windows_powershell_path(Some(root.0.as_os_str()));
        assert!(
            missing.is_err(),
            "missing SystemRoot PowerShell must fail closed"
        );
        assert!(super::resolve_windows_powershell_path(None).is_err());
        assert!(
            super::resolve_windows_powershell_path(Some(std::ffi::OsStr::new("relative"))).is_err()
        );

        let system_root = std::env::var_os("SystemRoot").expect("Windows provides SystemRoot");
        let executable = super::resolve_windows_powershell_path(Some(system_root.as_os_str()))
            .expect("PowerShell should exist at its SystemRoot location");
        assert!(executable.is_absolute());
        assert_eq!(
            executable,
            PathBuf::from(system_root).join("System32/WindowsPowerShell/v1.0/powershell.exe")
        );
    }

    #[test]
    fn output_ring_is_bounded_monotonic_and_reports_lost_replay() {
        let mut ring = OutputRing::default();
        for _ in 0..300 {
            ring.push(&vec![b'x'; 4096]);
        }
        assert!(ring.bytes <= MAX_OUTPUT_BYTES);
        let (chunks, truncated) = ring.read_after(0);
        assert!(truncated);
        assert!(chunks.len() <= 64);
        assert!(chunks.iter().map(|chunk| chunk.data.len()).sum::<usize>() <= 64 * 1024);
        assert!(chunks.windows(2).all(|pair| pair[0].seq < pair[1].seq));
        assert_eq!(ring.read_after(u64::MAX).0.len(), 0);
    }

    #[test]
    fn blocked_input_consumer_cannot_block_enqueue_or_queue_close() {
        let queue = Arc::new(InputQueue::default());
        let released = Arc::new((Mutex::new(false), Condvar::new()));
        let (entered_tx, entered_rx) = mpsc::sync_channel(1);
        let worker_queue = Arc::clone(&queue);
        let worker_released = Arc::clone(&released);
        let worker = thread::spawn(move || {
            run_input_worker(
                worker_queue,
                Box::new(BlockingWriter {
                    entered: Some(entered_tx),
                    released: worker_released,
                }),
                || {},
            );
        });

        let chunk = vec![b'x'; MAX_INPUT_BYTES];
        queue.enqueue(&chunk).unwrap();
        let entered = entered_rx.recv_timeout(Duration::from_secs(2)).is_ok();
        for _ in 1..(MAX_QUEUED_INPUT_BYTES / MAX_INPUT_BYTES) {
            queue.enqueue(&chunk).unwrap();
        }
        let cap_enforced = queue.enqueue(&chunk).is_err();

        let close_started = Instant::now();
        queue.close();
        let close_elapsed = close_started.elapsed();
        let closed_rejects_input = queue.enqueue(&chunk).is_err();

        let (lock, ready) = &*released;
        *lock.lock().unwrap() = true;
        ready.notify_all();
        worker.join().unwrap();

        assert!(entered, "the writer worker should enter its blocking write");
        assert!(cap_enforced, "queue cap must be enforced");
        assert!(
            close_elapsed < Duration::from_secs(1),
            "queue close must not wait for a stalled PTY consumer"
        );
        assert!(closed_rejects_input, "closed queue rejects input");
    }

    #[cfg(windows)]
    #[test]
    fn normal_powershell_exit_is_reported_as_exited_not_failed() {
        let root = TestRoot::new();
        let root_path = fs::canonicalize(&root.0).unwrap();
        let mut manager = SessionManager::new(root_path);
        let info = manager
            .create(None, 80, 24)
            .expect("real Windows ConPTY should start");
        let mut harness = RawPtyHarness::default();
        harness
            .settle_startup(&manager, &info.id)
            .expect("raw PTY harness should answer startup cursor queries");
        manager.write(&info.id, "exit\r\n").unwrap();

        let deadline = Instant::now() + Duration::from_secs(8);
        loop {
            harness
                .poll(&manager, &info.id)
                .expect("raw PTY harness should answer cursor queries");
            let state = manager
                .list()
                .unwrap()
                .into_iter()
                .find(|session| session.id == info.id)
                .expect("session should remain in history")
                .state;
            if state != SessionState::Running {
                assert_eq!(
                    state,
                    SessionState::Exited,
                    "normal PowerShell exit must not be reported as reader failure; {}",
                    harness.diagnostics()
                );
                break;
            }
            assert!(
                Instant::now() < deadline,
                "PowerShell did not exit in time; {}",
                harness.diagnostics()
            );
            thread::sleep(Duration::from_millis(25));
        }
        manager.shutdown();
    }

    #[cfg(windows)]
    #[test]
    fn failed_but_live_session_still_counts_toward_active_capacity() {
        let root = TestRoot::new();
        let root_path = fs::canonicalize(&root.0).unwrap();
        let mut manager = SessionManager::new(root_path);
        let info = manager
            .create(None, 80, 24)
            .expect("real Windows ConPTY should start");
        let mut harness = RawPtyHarness::default();
        harness
            .settle_startup(&manager, &info.id)
            .expect("raw PTY harness should answer startup cursor queries");
        let session = manager.sessions.get(&info.id).unwrap();
        session.status.lock().unwrap().state = SessionState::Failed;

        assert!(session.has_live_process_or_unknown());
        manager.close(&info.id).unwrap();
        assert_eq!(manager.list().unwrap()[0].state, SessionState::Closed);
    }

    #[cfg(windows)]
    #[test]
    fn real_powershell_pty_reads_writes_resizes_and_closes() {
        let root = TestRoot::new();
        let root_path = fs::canonicalize(&root.0).unwrap();
        let mut manager = SessionManager::new(root_path);
        let info = manager
            .create(None, 80, 24)
            .expect("real Windows ConPTY should start");
        let mut harness = RawPtyHarness::default();
        harness
            .settle_startup(&manager, &info.id)
            .expect("raw PTY harness should answer startup cursor queries");
        assert_eq!(info.state, SessionState::Running);
        manager.resize(&info.id, 100, 40).unwrap();
        let command = "[Console]::WriteLine(('CIRANDA_' + 'PTY_TEST_TOKEN'))\r\n";
        assert!(!command.contains("CIRANDA_PTY_TEST_TOKEN"));
        manager.write(&info.id, command).unwrap();
        let deadline = Instant::now() + Duration::from_secs(8);
        let mut observed = false;
        while Instant::now() < deadline {
            harness
                .poll(&manager, &info.id)
                .expect("raw PTY harness should answer cursor queries");
            if harness.contains_marker("CIRANDA_PTY_TEST_TOKEN") {
                observed = true;
                break;
            }
            thread::sleep(Duration::from_millis(50));
        }
        assert!(
            observed,
            "PowerShell output must arrive through the PTY reader; {}",
            harness.diagnostics()
        );
        harness
            .poll(&manager, &info.id)
            .expect("raw PTY harness should drain final output before close");
        manager.close(&info.id).unwrap();
        manager.close(&info.id).unwrap();
        assert_eq!(manager.list().unwrap()[0].state, SessionState::Closed);
    }

    #[cfg(windows)]
    #[test]
    fn two_real_sessions_keep_input_and_output_independent() {
        let root = TestRoot::new();
        let root_path = fs::canonicalize(&root.0).unwrap();
        let mut manager = SessionManager::new(root_path);
        let first = manager
            .create(None, 80, 24)
            .expect("first ConPTY should start");
        let second = manager
            .create(None, 90, 30)
            .expect("second ConPTY should start");
        let mut first_harness = RawPtyHarness::default();
        let mut second_harness = RawPtyHarness::default();
        first_harness
            .settle_startup(&manager, &first.id)
            .expect("raw PTY harness should answer first startup cursor queries");
        second_harness
            .settle_startup(&manager, &second.id)
            .expect("raw PTY harness should answer second startup cursor queries");
        let first_command = "[Console]::WriteLine(('CIRANDA_' + 'FIRST_SESSION'))\r\n";
        let second_command = "[Console]::WriteLine(('CIRANDA_' + 'SECOND_SESSION'))\r\n";
        assert!(!first_command.contains("CIRANDA_FIRST_SESSION"));
        assert!(!second_command.contains("CIRANDA_SECOND_SESSION"));
        manager.write(&first.id, first_command).unwrap();
        manager.write(&second.id, second_command).unwrap();

        let deadline = Instant::now() + Duration::from_secs(8);
        while Instant::now() < deadline {
            first_harness
                .poll(&manager, &first.id)
                .expect("raw PTY harness should answer first cursor queries");
            second_harness
                .poll(&manager, &second.id)
                .expect("raw PTY harness should answer second cursor queries");
            if first_harness.contains_marker("CIRANDA_FIRST_SESSION")
                && second_harness.contains_marker("CIRANDA_SECOND_SESSION")
            {
                break;
            }
            thread::sleep(Duration::from_millis(50));
        }
        assert!(
            first_harness.contains_marker("CIRANDA_FIRST_SESSION"),
            "first session must produce its own marker; {}",
            first_harness.diagnostics()
        );
        assert!(
            !first_harness.contains_marker("CIRANDA_SECOND_SESSION"),
            "first session must not receive the second session's marker; {}",
            first_harness.diagnostics()
        );
        assert!(
            second_harness.contains_marker("CIRANDA_SECOND_SESSION"),
            "second session must produce its own marker; {}",
            second_harness.diagnostics()
        );
        assert!(
            !second_harness.contains_marker("CIRANDA_FIRST_SESSION"),
            "second session must not receive the first session's marker; {}",
            second_harness.diagnostics()
        );
        first_harness
            .poll(&manager, &first.id)
            .expect("raw PTY harness should drain first session before shutdown");
        second_harness
            .poll(&manager, &second.id)
            .expect("raw PTY harness should drain second session before shutdown");
        manager.shutdown();
        assert!(manager
            .list()
            .unwrap()
            .iter()
            .all(|session| session.state == SessionState::Closed));
    }

    #[cfg(windows)]
    #[test]
    fn closing_session_kills_a_descendant_process_in_the_job() {
        use crate::job_object::is_process_running;

        let root = TestRoot::new();
        let root_path = fs::canonicalize(&root.0).unwrap();
        let pid_file = root_path.join("child.pid");
        let pid_file_ps = pid_file.to_string_lossy().replace('\'', "''");
        let command = format!(
            "$child = Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoLogo','-NoProfile','-Command','Start-Sleep -Seconds 60' -PassThru; [IO.File]::WriteAllText('{pid_file_ps}', [string]$child.Id); Start-Sleep -Seconds 60\r\n"
        );
        let mut manager = SessionManager::new(root_path);
        let info = manager
            .create(None, 80, 24)
            .expect("real Windows ConPTY should start");
        let mut harness = RawPtyHarness::default();
        harness
            .settle_startup(&manager, &info.id)
            .expect("raw PTY harness should answer startup cursor queries");
        manager.write(&info.id, &command).unwrap();
        let deadline = Instant::now() + Duration::from_secs(8);
        let child_pid = loop {
            harness
                .poll(&manager, &info.id)
                .expect("raw PTY harness should answer cursor queries");
            if let Ok(pid) = fs::read_to_string(&pid_file) {
                if let Ok(pid) = pid.trim().parse::<u32>() {
                    break pid;
                }
            }
            assert!(
                Instant::now() < deadline,
                "PowerShell descendant did not report its pid; {}",
                harness.diagnostics()
            );
            thread::sleep(Duration::from_millis(50));
        };
        assert!(
            is_process_running(child_pid),
            "descendant should be running before session close"
        );
        harness
            .poll(&manager, &info.id)
            .expect("raw PTY harness should drain output before session close");
        manager.close(&info.id).unwrap();
        let kill_deadline = Instant::now() + Duration::from_secs(8);
        while is_process_running(child_pid) && Instant::now() < kill_deadline {
            thread::sleep(Duration::from_millis(50));
        }
        assert!(
            !is_process_running(child_pid),
            "closing session must terminate its descendant process"
        );
    }
}
