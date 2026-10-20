$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
if (-not $env:MAESTRI_CLI -or -not $env:MAESTRI_PIPE) {
    throw 'Run from the REGENTE Maestri terminal.'
}
Push-Location -LiteralPath $repositoryRoot
try {
    $initialCommit = (& git rev-parse HEAD | Out-String).Trim()
    if ($LASTEXITCODE -ne 0) { throw 'Cannot observe Git HEAD.' }
    $initialStatus = (& git status --porcelain --untracked-files=all | Out-String).Trim()
    $started = [DateTime]::UtcNow.ToString('o')
    $observations = @()
    $commands = @(
        @{ Arguments = @('list') },
        @{ Arguments = @('preset', 'list') },
        @{ Arguments = @('role', 'list') },
        @{ Arguments = @('preset', 'show', 'Codex') },
        @{ Arguments = @('preset', 'show', 'Antigravity') },
        @{ Arguments = @('check', 'FERREIRO') },
        @{ Arguments = @('check', 'JARDINEIRO') }
    )
    foreach ($command in $commands) {
        $arguments = $command.Arguments
        $commandStart = [DateTime]::UtcNow.ToString('o')
        $output = (& $env:MAESTRI_CLI @arguments 2>&1 | Out-String)
        $commandExit = $LASTEXITCODE
        $output = $output -replace '(?i)[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}', '[EMAIL REDACTED]'
        $output = $output -replace '(?i)(Bearer\s+)[^\s]+', '$1[REDACTED]'
        $output = $output -replace '\bsk-[A-Za-z0-9_-]{12,}\b', '[REDACTED]'
        $digest = [Security.Cryptography.SHA256]::Create()
        try {
            $outputHash = -join ($digest.ComputeHash([Text.Encoding]::UTF8.GetBytes($output)) | ForEach-Object { $_.ToString('x2') })
        } finally { $digest.Dispose() }
        $observations += [ordered]@{
            command = @($env:MAESTRI_CLI) + $arguments
            started_at_utc = $commandStart
            finished_at_utc = [DateTime]::UtcNow.ToString('o')
            exit_code = $commandExit
            output = $output
            output_sha256 = $outputHash
        }
        if ($commandExit -ne 0) {
            # Diagnose before any attempt at a communication fix.
            & $env:MAESTRI_CLI debug
            throw "Observation failed: maestri $($arguments -join ' ')"
        }
    }
    $destination = Join-Path $repositoryRoot 'proofs/maestri-setup'
    foreach ($directory in @($repositoryRoot, (Join-Path $repositoryRoot 'proofs'), $destination)) {
        if ((Test-Path -LiteralPath $directory) -and ((Get-Item -LiteralPath $directory).Attributes -band [IO.FileAttributes]::ReparsePoint)) {
            throw 'Evidence links are forbidden.'
        }
    }
    $null = New-Item -ItemType Directory -Force -Path $destination
    $finished = [DateTime]::UtcNow.ToString('o')
    $finalCommit = (& git rev-parse HEAD | Out-String).Trim()
    $finalStatus = (& git status --porcelain --untracked-files=all | Out-String).Trim()
    $record = [ordered]@{
        kind = 'maestri-configuration-observation'
        status = 'observed'
        started_at_utc = $started
        finished_at_utc = $finished
        commit = $initialCommit
        branch = (& git branch --show-current | Out-String).Trim()
        environment = @{ os = [Environment]::OSVersion.VersionString; powershell = $PSVersionTable.PSVersion.ToString() }
        source_clean_at_start = ($initialStatus -eq '')
        source_unchanged = ($initialCommit -eq $finalCommit -and $initialStatus -eq $finalStatus)
        worktrees = (& git worktree list --porcelain | Out-String)
        observations = $observations
        scope = 'CLI observations only. Connected does not mean operational. Dirty records are diagnostic, never contract proofs, independent reviews or human approvals.'
        reviewer = $null
        approval_id = $null
    }
    $filename = Join-Path $destination ("observation-{0}.json" -f ($finished -replace '[:.]', '-'))
    $content = ($record | ConvertTo-Json -Depth 10) + "`n"
    $bytes = [Text.Encoding]::UTF8.GetBytes($content)
    $stream = [IO.File]::Open($filename, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
    try { $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() }
    $recordHash = (Get-FileHash -LiteralPath $filename -Algorithm SHA256).Hash.ToLowerInvariant()
    $hashBytes = [Text.Encoding]::UTF8.GetBytes("$recordHash  $([IO.Path]::GetFileName($filename))`n")
    $hashStream = [IO.File]::Open("$filename.sha256", [IO.FileMode]::CreateNew, [IO.FileAccess]::Write)
    try { $hashStream.Write($hashBytes, 0, $hashBytes.Length) } finally { $hashStream.Dispose() }
    Write-Output "$($observations.Count) CLI observations: $filename; SHA-256 $recordHash; source_clean=$($record.source_clean_at_start)"
} finally { Pop-Location }
