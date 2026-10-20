$ErrorActionPreference = 'Stop'
$repositoryRoot = Split-Path -Parent $PSScriptRoot
$bootstrapper = Join-Path $repositoryRoot '.cache/buildtools/vs_BuildTools.exe'
$signature = Get-AuthenticodeSignature -FilePath $bootstrapper
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'CN=Microsoft Corporation,') {
    throw 'Refusing installer: valid Microsoft signature required.'
}
$arguments = @('--quiet', '--wait', '--norestart', '--add', 'Microsoft.VisualStudio.Workload.VCTools', '--add', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '--add', 'Microsoft.VisualStudio.Component.Windows11SDK.26100')
$record = [ordered]@{
    kind = 'authorized-msvc-installation'
    authorization = 'Owner explicitly authorized Visual Studio Build Tools C++ and Windows SDK via request_user_input_async on 2026-10-20.'
    started_at_utc = [DateTime]::UtcNow.ToString('o')
    source = 'https://aka.ms/vs/17/release/vs_BuildTools.exe'
    bootstrapper_sha256 = (Get-FileHash -LiteralPath $bootstrapper -Algorithm SHA256).Hash.ToLowerInvariant()
    signature_status = [string]$signature.Status
    signer = $signature.SignerCertificate.Subject
    command = @($bootstrapper) + $arguments
    exit_code = $null
    error = $null
    free_bytes_before = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($repositoryRoot)).AvailableFreeSpace
}
try {
    # Operational reserve for installer downloads, expanded C++/SDK components
    # and the subsequent Rust build. This is a local guard, not a vendor size claim.
    if ($record.free_bytes_before -lt 10GB) {
        throw 'Installation not retried: less than the 10 GiB operational disk reserve is available.'
    }
    Write-Output 'Launching Microsoft installer for the owner-authorized C++ components and Windows SDK.'
    $installerProcess = Start-Process -FilePath $bootstrapper -ArgumentList $arguments -WorkingDirectory $repositoryRoot -WindowStyle Hidden -Verb RunAs -Wait -PassThru
    $record.exit_code = $installerProcess.ExitCode
} catch {
    $record.error = $_.Exception.Message
} finally {
    $record.finished_at_utc = [DateTime]::UtcNow.ToString('o')
    $record.free_bytes_after = [IO.DriveInfo]::new([IO.Path]::GetPathRoot($repositoryRoot)).AvailableFreeSpace
    $destination = Join-Path $repositoryRoot 'proofs/mvp-regente'
    $null = New-Item -ItemType Directory -Force -Path $destination
    $filename = Join-Path $destination ('msvc-install-' + [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffffffZ') + '.json')
    [IO.File]::WriteAllText($filename, ($record | ConvertTo-Json -Depth 6) + "`n", [Text.UTF8Encoding]::new($false))
    $hash = (Get-FileHash -LiteralPath $filename -Algorithm SHA256).Hash.ToLowerInvariant()
    [IO.File]::WriteAllText("$filename.sha256", "$hash`n", [Text.UTF8Encoding]::new($false))
    Write-Output "$filename; exit=$($record.exit_code); error=$($record.error)"
}
if ($record.error -or $record.exit_code -notin @(0, 3010)) { exit 1 }
