param(
  [switch]$SkipBackend,
  [switch]$SkipFrontend
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot

function Invoke-NpmScript {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$WorkingDirectory,
    [Parameter(Mandatory = $true)]
    [string]$ScriptName
  )

  Write-Host ""
  Write-Host "==> $Name"
  Push-Location $WorkingDirectory
  try {
    & npm.cmd run $ScriptName
    $exitCode = $LASTEXITCODE
  } finally {
    Pop-Location
  }

  if ($exitCode -ne 0) {
    Write-Error "$Name failed with exit code $exitCode."
    exit $exitCode
  }
}

if ($SkipBackend -and $SkipFrontend) {
  Write-Error "Nothing to run. Remove one of the skip flags."
  exit 1
}

if (-not $SkipBackend) {
  Invoke-NpmScript `
    -Name "Backend report export health" `
    -WorkingDirectory (Join-Path $repoRoot "server") `
    -ScriptName "test:reports-exports"
}

if (-not $SkipFrontend) {
  Invoke-NpmScript `
    -Name "Frontend browser report downloads" `
    -WorkingDirectory (Join-Path $repoRoot "client") `
    -ScriptName "test:report-downloads"
}

Write-Host ""
Write-Host "Report export checks completed."
