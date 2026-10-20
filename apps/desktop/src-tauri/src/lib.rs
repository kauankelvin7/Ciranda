mod job_object;
mod path_policy;
mod sessions;
mod storage;

use serde::Serialize;
use sessions::{AppState, SessionInfo, SessionRead};
use tauri::{Manager, State};

#[derive(Serialize)]
struct WorkspaceInfo {
    root: String,
    platform: String,
}

#[tauri::command]
fn workspace_info(state: State<'_, AppState>) -> WorkspaceInfo {
    WorkspaceInfo {
        root: state.root.to_string_lossy().into_owned(),
        platform: std::env::consts::OS.to_owned(),
    }
}

#[tauri::command]
fn session_create(
    state: State<'_, AppState>,
    cwd: Option<String>,
    cols: u32,
    rows: u32,
) -> Result<SessionInfo, String> {
    state
        .sessions
        .lock()
        .map_err(|_| "session manager is unavailable")?
        .create(cwd.as_deref(), cols, rows)
}

#[tauri::command]
fn session_list(state: State<'_, AppState>) -> Result<Vec<SessionInfo>, String> {
    state
        .sessions
        .lock()
        .map_err(|_| "session manager is unavailable")?
        .list()
}

#[tauri::command]
fn session_write(
    state: State<'_, AppState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    state
        .sessions
        .lock()
        .map_err(|_| "session manager is unavailable")?
        .write(&session_id, &data)
}

#[tauri::command]
fn session_resize(
    state: State<'_, AppState>,
    session_id: String,
    cols: u32,
    rows: u32,
) -> Result<(), String> {
    state
        .sessions
        .lock()
        .map_err(|_| "session manager is unavailable")?
        .resize(&session_id, cols, rows)
}

#[tauri::command]
fn session_read(
    state: State<'_, AppState>,
    session_id: String,
    after_seq: u64,
) -> Result<SessionRead, String> {
    state
        .sessions
        .lock()
        .map_err(|_| "session manager is unavailable")?
        .read(&session_id, after_seq)
}

#[tauri::command]
fn session_close(state: State<'_, AppState>, session_id: String) -> Result<(), String> {
    state
        .sessions
        .lock()
        .map_err(|_| "session manager is unavailable")?
        .close(&session_id)
}

#[tauri::command]
fn workspace_load(state: State<'_, AppState>) -> Result<Option<String>, String> {
    state.storage.load()
}

#[tauri::command]
fn workspace_save(state: State<'_, AppState>, layout_json: String) -> Result<(), String> {
    state.storage.save(&layout_json)
}

pub fn run() {
    let state = AppState::new().expect("CIRANDA workspace state could not be initialized");
    let app = tauri::Builder::default()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            workspace_info,
            session_create,
            session_list,
            session_write,
            session_resize,
            session_read,
            session_close,
            workspace_load,
            workspace_save
        ])
        .build(tauri::generate_context!())
        .expect("CIRANDA application could not be built");

    app.run(|app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            app_handle.state::<AppState>().shutdown();
        }
    });
}
