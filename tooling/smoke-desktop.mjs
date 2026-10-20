// Real Windows app + WebView2 + Rust IPC + ConPTY + SQLite. No IPC mocks.
// WebView2 debug env is scoped to the spawned test app, never registry/global.
// https://learn.microsoft.com/microsoft-edge/webview2/how-to/debug-visual-studio-code
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const root = realpathSync(fileURLToPath(new URL('../', import.meta.url)));
function ownedPath(relative) {
  let current = root;
  for (const part of relative.split('/')) {
    assert(part && part !== '.' && part !== '..', 'Invalid test path');
    current = path.join(current, part);
    if (existsSync(current)) assert(!lstatSync(current).isSymbolicLink(), 'Test paths cannot be links');
  }
  return current;
}
const git = (...args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(result.status, 0, `Git observation failed: ${result.error?.code ?? result.stderr}`);
  return result.stdout.trim();
};
async function waitFor(description, probe, timeout = 20000) {
  const deadline = performance.now() + timeout;
  let lastError;
  do {
    try { const value = await probe(); if (value) return value; } catch (error) { lastError = error; }
    await delay(200);
  } while (performance.now() < deadline);
  throw new Error(`Timeout: ${description}${lastError ? `: ${lastError.message}` : ''}`);
}
async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}
class Cdp {
  constructor(socket) {
    this.socket = socket; this.nextId = 0; this.pending = new Map();
    socket.addEventListener('message', event => {
      const data = JSON.parse(event.data); const waiter = this.pending.get(data.id);
      if (!waiter) return;
      this.pending.delete(data.id); clearTimeout(waiter.timer);
      if (data.error) waiter.reject(new Error(JSON.stringify(data.error))); else waiter.resolve(data.result);
    });
    socket.addEventListener('close', () => {
      for (const waiter of this.pending.values()) { clearTimeout(waiter.timer); waiter.reject(new Error('CDP disconnected')); }
      this.pending.clear();
    });
  }
  static async connect(url) {
    const parsed = new URL(url);
    assert(['127.0.0.1', 'localhost'].includes(parsed.hostname), 'Only loopback debugging allowed');
    const socket = new WebSocket(url);
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('CDP connection timeout')), 10000);
      socket.addEventListener('open', () => { clearTimeout(timer); resolve(); }, { once: true });
      socket.addEventListener('error', () => { clearTimeout(timer); reject(new Error('CDP connection failed')); }, { once: true });
    });
    return new Cdp(socket);
  }
  call(method, params = {}) {
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
    return result.result.value;
  }
  close() { this.socket.close(); }
}
const steps = [];
const record = { kind: 'native-desktop-smoke', started_at_utc: new Date().toISOString(), steps, status: 'failed' };
let application; let cdp; let appError = ''; let appOutput = '';
async function check(name, action) {
  const started = new Date().toISOString(); const result = await action();
  steps.push({ name, status: 'pass', started_at_utc: started, result });
  console.log(`NATIVE_SMOKE_STEP ${JSON.stringify(steps.at(-1))}`);
  return result;
}
const temporaryRelative = `.cache/native-smoke-${randomUUID()}`;
const workspace = ownedPath(`${temporaryRelative}/workspace`);
const executable = ownedPath('apps/desktop/src-tauri/target/debug/ciranda-desktop.exe');
let launchCount = 0;
async function launch() {
  const port = await freePort();
  // A fresh browser profile on each launch proves layout recovery is SQLite,
  // not localStorage, and avoids racing the old WebView2 profile shutdown.
  const profile = ownedPath(`${temporaryRelative}/webview-profile-${++launchCount}`);
  mkdirSync(profile, { recursive: true });
  application = spawn(executable, [], {
    cwd: workspace, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CIRANDA_WORKSPACE_ROOT: workspace, WEBVIEW2_USER_DATA_FOLDER: profile,
      WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port} --remote-debugging-address=127.0.0.1` },
  });
  application.on('error', error => { appError += error.message; });
  application.stdout.on('data', bytes => { appOutput = (appOutput + bytes).slice(-16000); });
  application.stderr.on('data', bytes => { appError = (appError + bytes).slice(-16000); });
  const target = await waitFor('owned CIRANDA WebView2 target', async () => {
    if (application.exitCode !== null) throw new Error(`App exited ${application.exitCode}: ${appError}`);
    const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(1500) });
    return (await response.json()).find(item => item.type === 'page' && item.title === 'CIRANDA');
  }, 30000);
  assert(/^https?:\/\/(tauri\.localhost|127\.0\.0\.1)([:/]|$)|^tauri:/i.test(target.url), `Unexpected app URL: ${target.url}`);
  cdp = await Cdp.connect(target.webSocketDebuggerUrl);
  await waitFor('professional canvas mounted', () => cdp.evaluate("Boolean(document.querySelector('.ciranda-canvas-node'))"));
  return { pid: application.pid, webview_url: target.url };
}
async function closeApplication() {
  const ps = path.join(process.env.SystemRoot, 'System32/WindowsPowerShell/v1.0/powershell.exe');
  const command = `Add-Type -Namespace CirandaSmoke -Name Native -MemberDefinition '[DllImport("user32.dll", SetLastError=true)] public static extern bool PostMessage(IntPtr hWnd,uint msg,IntPtr wParam,IntPtr lParam);'; $p=Get-Process -Id ${application.pid}; $p.Refresh(); if ($p.MainWindowHandle -eq [IntPtr]::Zero) { throw 'No owned app window' }; if (-not [CirandaSmoke.Native]::PostMessage($p.MainWindowHandle,16,[IntPtr]::Zero,[IntPtr]::Zero)) { throw 'WM_CLOSE failed' }`;
  const result = spawnSync(ps, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
  assert.equal(result.status, 0, `Owned-window close failed: ${result.stderr}`);
  await waitFor('application graceful exit', () => application.exitCode !== null, 15000);
  cdp?.close(); cdp = null;
  const exitCode = application.exitCode; application = null;
  assert.equal(exitCode, 0, 'Application must exit successfully');
  return { exit_code: exitCode };
}
const invoke = (command, args = {}) => cdp.evaluate(`window.__TAURI_INTERNALS__.invoke(${JSON.stringify(command)},${JSON.stringify(args)})`);
const lastNode = "[...document.querySelectorAll('article.ciranda-canvas-node')].at(-1)";
let shellPid;
try {
  assert.equal(process.platform, 'win32', 'Native smoke requires Windows');
  record.commit = git('rev-parse', 'HEAD'); record.source_clean_at_start = git('status', '--porcelain') === '';
  assert(record.source_clean_at_start, 'Native proof requires a clean source tree');
  assert(existsSync(executable), 'Build the real desktop executable before the native smoke');
  record.executable_sha256 = createHash('sha256').update(readFileSync(executable)).digest('hex');
  mkdirSync(workspace, { recursive: true });
  await check('open-real-app', launch);
  await check('create-terminal-through-ui', async () => {
    assert.equal((await invoke('session_list')).length, 0);
    await cdp.evaluate("document.querySelector('[aria-label=\"Criar novo terminal\"]').click()");
    await waitFor('new node', () => cdp.evaluate("document.querySelectorAll('article').length === 2"));
    await cdp.evaluate(`${lastNode}.querySelector('button.reconnect').click()`);
    const session = await waitFor('real running session', async () => (await invoke('session_list')).find(s => s.state === 'running'));
    await waitFor('running UI', () => cdp.evaluate(`${lastNode}.querySelector('.node-status-badge.running') !== null`));
    return { session_id: session.id, state: session.state };
  });
  await check('type-command-and-observe-real-output', async () => {
    const token = randomUUID().replaceAll('-', ''); const expected = `CIRANDA_SMOKE_${token}`;
    const command = `[IO.File]::WriteAllText('ciranda-smoke.pid',[string]$PID);[Console]::WriteLine(('CIRANDA_'+'SMOKE_'+'${token}'))`;
    assert(!command.includes(expected), 'Command echo must not satisfy output assertion');
    await waitFor('xterm helper textarea ready', () => cdp.evaluate(`Boolean(${lastNode}.querySelector('.xterm-helper-textarea'))`));
    await cdp.evaluate(`${lastNode}.querySelector('.xterm-helper-textarea').focus()`);
    await cdp.call('Input.insertText', { text: command });
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' });
    await cdp.call('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await waitFor('marker rendered by xterm after PowerShell execution', () => cdp.evaluate(`${lastNode}.querySelector('.xterm-rows').textContent.includes(${JSON.stringify(expected)})`));
    const pidFile = path.join(workspace, 'ciranda-smoke.pid');
    await waitFor('PID file from real shell', () => existsSync(pidFile)); shellPid = Number(readFileSync(pidFile, 'utf8'));
    assert(Number.isSafeInteger(shellPid) && shellPid > 0, 'Real shell PID required');
    return { marker: expected, shell_pid: shellPid, marker_rendered: true, command_echo_cannot_match: true };
  });
  await check('stop-session-through-ui', async () => {
    await cdp.evaluate(`${lastNode}.querySelector('button.close-session').click()`);
    await waitFor('backend reports closed', async () => (await invoke('session_list')).every(s => s.state === 'closed'));
    await waitFor('real shell PID terminated', () => {
      try { process.kill(shellPid, 0); return false; } catch (error) { if (error.code === 'ESRCH') return true; throw error; }
    });
    return { shell_pid: shellPid, terminated: true };
  });
  const saved = await check('save-layout-to-real-sqlite', async () => {
    await cdp.evaluate("document.querySelector('[aria-label=\"Salvar layout\"]').click()");
    const layout = await waitFor('SQLite layout', async () => { const json = await invoke('workspace_load'); return json && JSON.parse(json).nodes.length === 2 ? json : null; });
    assert(existsSync(path.join(workspace, '.ciranda/state.sqlite')), 'Real SQLite file required');
    return { json: layout, sha256: createHash('sha256').update(layout).digest('hex') };
  });
  await check('close-app', closeApplication);
  await check('reopen-app', launch);
  await check('restore-layout-without-resurrecting-process', async () => {
    assert.equal(await invoke('workspace_load'), saved.json, 'Layout must survive an actual app restart');
    assert.equal((await invoke('session_list')).length, 0, 'Restart must not fabricate a live process');
    await waitFor('two nodes restored', () => cdp.evaluate("document.querySelectorAll('article').length === 2"));
    assert.equal(await cdp.evaluate("document.querySelectorAll('.node-status-badge.running').length"), 0);
    return { nodes: 2, sessions: 0, layout_sha256: saved.sha256 };
  });
  await check('final-graceful-exit', closeApplication);
  assert.equal(git('rev-parse', 'HEAD'), record.commit); assert.equal(git('status', '--porcelain'), '');
  record.status = 'pass';
} catch (error) {
  record.failure = error.stack;
} finally {
  cdp?.close();
  if (application && application.exitCode === null) {
    record.forced_cleanup = true;
    const killer = path.join(process.env.SystemRoot, 'System32/taskkill.exe');
    const result = spawnSync(killer, ['/PID', String(application.pid), '/T', '/F'], { encoding: 'utf8', windowsHide: true, timeout: 15000 });
    record.cleanup_exit_code = result.status;
  }
  record.finished_at_utc = new Date().toISOString(); record.app_stderr_tail = appError; record.app_stdout_tail = appOutput;
  record.scope = 'Real dedicated app/PTY/SQLite; no Codex/Antigravity adapter, crash recovery, full contract or human seal claim';
  const directory = ownedPath('proofs/native-smoke'); mkdirSync(directory, { recursive: true });
  const output = JSON.stringify(record, null, 2) + '\n';
  writeFileSync(path.join(directory, 'result.json'), output); writeFileSync(path.join(directory, 'result.sha256'), createHash('sha256').update(output).digest('hex') + '\n');
  console.log(`NATIVE_SMOKE_RESULT ${JSON.stringify(record)}`);
}
process.exitCode = record.status === 'pass' ? 0 : 1;
