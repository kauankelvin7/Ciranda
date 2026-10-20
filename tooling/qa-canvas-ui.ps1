param(
    [string]$Portal = 'CIRANDA QA MVP',
    [string]$SourceWorktree = 'C:/Users/Kauan/Desktop/CIRANDA/.worktrees/jardineiro-profissional'
)
$ErrorActionPreference = 'Stop'
$cli = $env:MAESTRI_CLI
if (-not $cli) { throw 'MAESTRI_CLI is required' }
$proofDir = Join-Path $PSScriptRoot '../proofs/mvp-regente'
New-Item -ItemType Directory -Force -Path $proofDir | Out-Null
$steps = [Collections.Generic.List[object]]::new()
$sourceHead = (& git -C $SourceWorktree rev-parse HEAD | Out-String).Trim()
$sourceDirty = (& git -C $SourceWorktree status --porcelain | Out-String).Trim()

function Invoke-PortalStep([string]$Label, [string[]]$Arguments) {
    $output = (& $cli portal @Arguments 2>&1 | Out-String).Trim()
    $code = $LASTEXITCODE
    $steps.Add([ordered]@{ label=$Label; arguments=$Arguments; exit_code=$code; output=$output })
    if ($code -ne 0) { throw "$Label failed: $output" }
    return $output
}
function Invoke-BrowserScript([string]$Label, [string]$JavaScript) {
    $encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($JavaScript))
    $wrapper = "(async()=>{return await eval(atob('$encoded'))})()"
    return Invoke-PortalStep $Label @('evaluate', $Portal, $wrapper)
}

$failure = $null
try {
    $info = Invoke-PortalStep 'portal-info' @('info', $Portal)
    if ($info -notmatch 'http://127\.0\.0\.1:1420/') { throw 'Refusing to operate on a different URL' }
    Invoke-PortalStep 'start-fresh-preview-document' @('reload', $Portal) | Out-Null
    Invoke-BrowserScript 'preview-interactions' @'
(async()=>{
  await new Promise(r=>setTimeout(r,300));
  const tick=()=>new Promise(r=>setTimeout(r,120));
  const assert=(ok,msg)=>{if(!ok)throw Error(msg)};
  const click=(selector)=>{const e=document.querySelector(selector);assert(e,selector);e.click()};
  assert(document.body.textContent.includes('Preview Web'),'Expected explicit preview mode');
  click('[aria-label="Criar novo terminal"]');await tick();
  const nodes=[...document.querySelectorAll('article.ciranda-canvas-node')];
  assert(nodes.length>=2,'Create terminal node');
  const node=nodes[0],header=node.querySelector('.node-header');
  const before={transform:node.style.transform,width:parseFloat(node.style.width)};
  header.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,clientX:200,clientY:120}));
  window.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:280,clientY:170}));
  window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));await tick();
  assert(node.style.transform!==before.transform,'Drag node position');
  const resize=node.querySelector('.node-resize-handle');assert(resize,'Resize handle');
  resize.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,clientX:600,clientY:400}));
  window.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:660,clientY:440}));
  window.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));await tick();
  assert(parseFloat(node.style.width)>before.width,'Resize node width');
  nodes[0].querySelector('.port-source').click();await tick();
  nodes[1].querySelector('.port-target').click();await tick();
  click('[aria-label="Aumentar zoom"]');await tick();
  const viewport=document.querySelector('.canvas-viewport');
  const beforePan=viewport.style.transform;
  const canvas=document.querySelector('.ciranda-canvas');
  canvas.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0,clientX:1000,clientY:700}));
  canvas.dispatchEvent(new MouseEvent('mousemove',{bubbles:true,clientX:1080,clientY:730}));
  canvas.dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));await tick();
  assert(viewport.style.transform!==beforePan,'Pan viewport');
  click('[aria-label="Salvar layout"]');await tick();
  const layout=JSON.parse(localStorage.getItem('ciranda_layout_v1_preview'));
  assert(layout.nodes.length>=2&&layout.edges.length>=1,'Persist nodes and connection');
  assert(layout.viewport.zoom>1&&layout.viewport.x!==0,'Persist pan and zoom');
  window.__cirandaPreviewExpected=JSON.stringify(layout);
  return {kind:'browser-preview',nodes:layout.nodes.length,edges:layout.edges.length,viewport:layout.viewport,terminal_runtime_tested:false};
})()
'@ | Out-Null
    Invoke-PortalStep 'reload-preview' @('reload', $Portal) | Out-Null
    Invoke-BrowserScript 'restore-preview' @'
(async()=>{
  await new Promise(r=>setTimeout(r,350));
  const saved=JSON.parse(localStorage.getItem('ciranda_layout_v1_preview'));
  const nodes=[...document.querySelectorAll('article.ciranda-canvas-node')];
  if(nodes.length!==saved.nodes.length)throw Error('Node count not restored');
  const actual=document.querySelector('.canvas-viewport').style.transform;
  if(Math.abs(new DOMMatrix(actual).a-saved.viewport.zoom)>0.001)throw Error('Zoom not restored');
  for(let i=0;i<nodes.length;i++){
    const matrix=new DOMMatrix(nodes[i].style.transform);
    if(Math.abs(matrix.m41-saved.nodes[i].x)>0.01||Math.abs(matrix.m42-saved.nodes[i].y)>0.01)throw Error('Position not restored');
  }
  return {restored_nodes:nodes.length,transform:actual,storage:'localStorage preview only'};
})()
'@ | Out-Null
    Invoke-PortalStep 'preview-snapshot' @('snapshot', $Portal) | Out-Null
} catch { $failure = $_.Exception.Message }

$endHead = (& git -C $SourceWorktree rev-parse HEAD | Out-String).Trim()
$endDirty = (& git -C $SourceWorktree status --porcelain | Out-String).Trim()
$record = [ordered]@{
    kind='browser-canvas-observation'; source_head=$sourceHead; source_dirty=$sourceDirty
    source_end_head=$endHead; source_end_dirty=$endDirty
    at_utc=[DateTime]::UtcNow.ToString('o'); failure=$failure
    scope='Browser DOM interactions; no real PTY, Tauri runtime, SQLite, OS process or native recovery validation'
    steps=$steps
}
$artifact = Join-Path $proofDir ('canvas-ui-'+[DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')+'.json')
$record | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $artifact -Encoding UTF8
(Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash.ToLowerInvariant() | Set-Content -LiteralPath ($artifact+'.sha256')
Write-Output "$artifact; failure=$failure"
if ($failure) { exit 1 }
