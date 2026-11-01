param(
  [Parameter(Mandatory)][string]$SshTarget,
  [Parameter(Mandatory)][string]$IdentityFile,
  [Parameter(Mandatory)][string]$DeviceId,
  [Parameter(Mandatory)][string]$MacAddress
)

$ErrorActionPreference = 'Stop'
if ($SshTarget -notmatch '^[a-zA-Z0-9_.-]+@[a-zA-Z0-9_.-]+$' -or
    $DeviceId -notmatch '^[a-zA-Z0-9-]+$' -or
    $MacAddress -notmatch '^[a-zA-Z0-9_.-]+$') {
  throw 'Invalid SSH destination, device identifier, or Mac address'
}
$repoRoot = Split-Path $PSScriptRoot
Push-Location $repoRoot
$sshOptions = @('-i', $IdentityFile, '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes')
function Assert-Command([string]$Description) {
  if ($LASTEXITCODE -ne 0) { throw "$Description failed (exit $LASTEXITCODE)" }
}
try {
  # Caller must select the Node major from .nvmrc before invoking this script.
  $requiredMajor = (Get-Content .nvmrc).Trim()
  $actualNode = (& node --version)
  if ($actualNode -notmatch "^v$requiredMajor\.") { throw "Use Node $requiredMajor (found $actualNode)" }
  npm run build:device-audio
  Assert-Command 'Diagnostic build'
  $remoteDir = (& ssh @sshOptions $SshTarget 'mktemp -d /tmp/turbobard-device-audio.XXXXXXXX').Trim()
  Assert-Command 'Remote directory creation'
  if ($remoteDir -notmatch '^/tmp/turbobard-device-audio\.[a-zA-Z0-9]+$') { throw 'Unexpected remote directory' }
  & ssh @sshOptions $SshTarget "mkdir -p $remoteDir/build"
  Assert-Command 'Remote build directory creation'
  & scp @sshOptions docs/evidence/device-audio/build/index.html docs/evidence/device-audio/build/comparison.js docs/evidence/device-audio/build/build.json "${SshTarget}:$remoteDir/build/"
  Assert-Command 'Diagnostic transfer'
  & scp @sshOptions scripts/run-device-audio.py "${SshTarget}:$remoteDir/"
  Assert-Command 'Runner transfer'
  $localDir = Join-Path $repoRoot ('docs/evidence/device-audio/' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  New-Item -ItemType Directory -Path $localDir -Force | Out-Null
  & ssh @sshOptions $SshTarget "/usr/bin/python3 $remoteDir/run-device-audio.py --device-id $DeviceId --host $MacAddress --directory $remoteDir/build --output $remoteDir/results"
  $deviceExit = $LASTEXITCODE
  & scp @sshOptions -r "${SshTarget}:$remoteDir/results" $localDir
  Assert-Command 'Result retrieval'
  Write-Output "Evidence: $localDir/results"
  Write-Output "Remote diagnostic files retained: $remoteDir"
  if ($deviceExit -ne 0) { throw "Production device verification failed (exit $deviceExit); inspect saved results." }
} finally {
  Pop-Location
}
