$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$observations = @()
foreach ($name in @('node', 'git', 'cargo', 'rustc', 'cl', 'link', 'vswhere')) {
    $resolved = Get-Command $name -ErrorAction SilentlyContinue
    $observations += [ordered]@{ command = $name; source = $resolved.Source; found = [bool]$resolved }
}
$locations = @(
    'C:/Program Files/Microsoft Visual Studio',
    'C:/Program Files (x86)/Microsoft Visual Studio/2019',
    'C:/Program Files (x86)/Microsoft Visual Studio/Shared',
    'C:/Program Files (x86)/Microsoft Visual Studio/Installer/vswhere.exe',
    'C:/Program Files (x86)/Windows Kits/10/Include',
    'C:/Program Files (x86)/Windows Kits/10/Lib',
    'C:/Program Files (x86)/Windows Kits/10/bin'
)
$paths = @()
foreach ($location in $locations) {
    $present = Test-Path -LiteralPath $location
    $children = @()
    if ($present -and (Get-Item -LiteralPath $location).PSIsContainer) {
        $children = @(Get-ChildItem -LiteralPath $location | Select-Object -ExpandProperty Name)
    }
    $paths += [ordered]@{ path = $location; present = $present; entries = $children }
}
$record = [ordered]@{
    kind = 'windows-toolchain-inventory'
    status = 'observed'
    recorded_at_utc = [DateTime]::UtcNow.ToString('o')
    commit = (& git -C $repositoryRoot rev-parse HEAD | Out-String).Trim()
    os = [Environment]::OSVersion.VersionString
    commands = $observations
    standard_locations = $paths
    scope = 'Read-only discovery in PATH and standard locations, not a complete scan of every drive. No global installation, PATH persistence or security changes. The Git link.exe is not evidence of Microsoft C++ tools.'
}
$destination = Join-Path $repositoryRoot 'proofs/mvp-regente'
$null = New-Item -ItemType Directory -Path $destination -Force
$filename = Join-Path $destination ('windows-toolchain-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffffffZ') + '.json')
$bytes = [Text.Encoding]::UTF8.GetBytes(($record | ConvertTo-Json -Depth 8) + "`n")
$stream = [IO.File]::Open($filename, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
$hash = (Get-FileHash -LiteralPath $filename -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText("$filename.sha256", "$hash`n", [Text.UTF8Encoding]::new($false))
Write-Output "$filename; SHA-256 $hash"
