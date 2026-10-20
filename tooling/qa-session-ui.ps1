param([string]$Portal='CIRANDA QA MVP', [string]$SourceWorktree='C:/Users/Kauan/Desktop/CIRANDA/.worktrees/jardineiro-profissional')
$ErrorActionPreference='Stop'
$cli=$env:MAESTRI_CLI
if (-not $cli) { throw 'MAESTRI_CLI is required' }
$steps=[Collections.Generic.List[object]]::new()
$sourceHead=(& git -C $SourceWorktree rev-parse HEAD | Out-String).Trim()
$sourceDirty=(& git -C $SourceWorktree status --porcelain | Out-String).Trim()
function Invoke-Step([string]$Label,[string[]]$Arguments) {
    $output=(& $cli portal @Arguments 2>&1 | Out-String).Trim()
    $code=$LASTEXITCODE
    $steps.Add([ordered]@{label=$Label;arguments=$Arguments;exit_code=$code;output=$output})
    if ($code -ne 0) { throw "$Label failed: $output" }
    return $output
}
function Invoke-Script([string]$Label,[string]$Script) {
    $encoded=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($Script))
    return Invoke-Step $Label @('evaluate',$Portal,"(async()=>{return await eval(atob('$encoded'))})()")
}
$failure=$null
try {
    $info=Invoke-Step 'info' @('info',$Portal)
    if ($info -notmatch 'http://127\.0\.0\.1:1420/') { throw 'Refusing different URL' }
    Invoke-Script 'mount-real-react-components-with-mock-ipc' @'
(async()=>{
  const qa={calls:[],writes:[],sessions:[],nextId:0};window.__cirandaQa=qa;
  window.__TAURI_INTERNALS__={invoke:async(command,args={})=>{
    qa.calls.push({command,args});
    switch(command){
      case 'workspace_load':return null;
      case 'workspace_info':return {root:'C:/CIRANDA-UI-TEST-DOUBLE',platform:'windows'};
      case 'session_list':return qa.sessions;
      case 'session_create':{const s={id:'mock-session-'+(++qa.nextId),cwd:'.',state:'running',cols:args.cols,rows:args.rows};qa.sessions.push(s);await new Promise(r=>setTimeout(r,60));return s;}
      case 'session_write':qa.writes.push({...args});return;
      case 'session_resize':return;
      case 'session_read':return {sessionId:args.sessionId,chunks:[],state:qa.sessions.find(s=>s.id===args.sessionId)?.state??'closed',truncated:false};
      case 'session_close':{if(qa.failClose)throw Error('synthetic close rejection');const s=qa.sessions.find(s=>s.id===args.sessionId);if(s)s.state='closed';return;}
      case 'workspace_save':qa.saved=args.layoutJson;return;
      default:throw Error('Unexpected mock command '+command);
    }
  }};
  const old=document.getElementById('root');const replacement=document.createElement('div');replacement.id='root';old.replaceWith(replacement);
  await import('/src/main.tsx?ciranda-ui-qa='+Date.now());
  await new Promise(r=>setTimeout(r,250));
  const banner=document.createElement('aside');banner.textContent='TESTE COM IPC SIMULADO - SEM PROCESSOS REAIS';
  banner.style.cssText='position:fixed;bottom:0;left:0;background:#783900;color:white;padding:8px;z-index:99999;pointer-events:none';document.body.appendChild(banner);
  const start=document.querySelector('button.reconnect');if(!start)throw Error('Native start button missing');
  start.click();start.click();await new Promise(r=>setTimeout(r,150));
  if(qa.sessions.length!==1)throw Error('Concurrent create produced duplicate sessions');
  document.querySelector('[aria-label="Salvar layout"]').click();await new Promise(r=>setTimeout(r,100));
  if(JSON.parse(qa.saved).nodes[0].sessionId!=='mock-session-1')throw Error('Session association not persisted in parent layout');
  document.querySelector('.xterm-helper-textarea').focus();
  return {scope:'React/xterm with IPC TEST DOUBLE; no process or native backend',session:qa.sessions[0]?.id};
})()
'@ | Out-Null
    Invoke-Step 'type-first-session' @('type',$Portal,'CIRANDA-QA-ONE') | Out-Null
    Invoke-Step 'terminal-question' @('type',$Portal,'?') | Out-Null
    Invoke-Step 'terminal-delete' @('key',$Portal,'Delete') | Out-Null
    Invoke-Step 'terminal-enter' @('key',$Portal,'Enter') | Out-Null
    Invoke-Script 'assert-real-listener-and-key-isolation' @'
(async()=>{
  const qa=window.__cirandaQa;
  if(!qa.writes.map(w=>w.data).join('').includes('CIRANDA-QA-ONE?'))throw Error('Actual xterm listener did not forward typed input');
  if(qa.writes.some(w=>w.sessionId!=='mock-session-1'))throw Error('Wrong session destination');
  if(document.querySelector('[role=dialog]'))throw Error('Terminal keys opened a canvas dialog');
  const before=qa.writes.length;qa.firstWriteCount=before;
  document.querySelector('button.close-session').click();await new Promise(r=>setTimeout(r,100));
  document.querySelector('button.reconnect').click();await new Promise(r=>setTimeout(r,100));
  document.querySelector('.xterm-helper-textarea').focus();
  return {first_session_writes:before,key_isolation:true};
})()
'@ | Out-Null
    Invoke-Step 'type-second-session' @('type',$Portal,'CIRANDA-QA-TWO') | Out-Null
    Invoke-Script 'assert-listener-uses-new-session' @'
(async()=>{
  const qa=window.__cirandaQa;const second=qa.writes.slice(qa.firstWriteCount);
  if(!second.length||second.some(w=>w.sessionId!=='mock-session-2'))throw Error('Listener retained previous session');
  if(!second.map(w=>w.data).join('').includes('CIRANDA-QA-TWO'))throw Error('Second input missing');
  qa.failClose=true;const count=document.querySelectorAll('article').length;
  document.querySelector('button.node-action-btn.delete').click();await new Promise(r=>setTimeout(r,100));
  document.querySelector('.dialog-btn.danger').click();await new Promise(r=>setTimeout(r,150));
  if(document.querySelectorAll('article').length!==count)throw Error('Node removed after close rejected');
  if(!document.querySelector('[role=alert]')?.textContent.includes('synthetic close rejection'))throw Error('Close failure not visible');
  return {second_session_writes:second.length,destinations:[...new Set(qa.writes.map(w=>w.sessionId))],close_rejection_preserved_node:true,native_runtime_validated:false};
})()
'@ | Out-Null
} catch { $failure=$_.Exception.Message }
try { Invoke-Step 'remove-ipc-test-double-by-reloading-preview' @('reload',$Portal) | Out-Null }
catch { if (-not $failure) { $failure=$_.Exception.Message } }
$proofDir=Join-Path $PSScriptRoot '../proofs/mvp-regente'
$record=[ordered]@{kind='react-xterm-ipc-mock-observation';source_head=$sourceHead;source_dirty=$sourceDirty;source_end_head=(& git -C $SourceWorktree rev-parse HEAD | Out-String).Trim();source_end_dirty=(& git -C $SourceWorktree status --porcelain | Out-String).Trim();at_utc=[DateTime]::UtcNow.ToString('o');failure=$failure;scope='Actual React/xterm components with mock invoke. No PTY, process, SQLite, Tauri runtime or native E2E validation';steps=$steps}
$artifact=Join-Path $proofDir ('session-ui-mock-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')+'.json')
$record | ConvertTo-Json -Depth 15 | Set-Content -LiteralPath $artifact -Encoding UTF8
(Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash.ToLowerInvariant() | Set-Content -LiteralPath ($artifact+'.sha256')
Write-Output "$artifact; failure=$failure"
if ($failure) { exit 1 }
