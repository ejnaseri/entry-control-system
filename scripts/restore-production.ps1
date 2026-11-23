[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$BackupPath,

  [Parameter(Mandatory = $true)][string]$BackupRoot,

  [Parameter(Mandatory = $true)][string]$ExpectedFolderName,

  [Parameter(Mandatory = $true)][string]$ConfirmPhrase,

  [string]$EnvFile = "server\.env",

  [string]$DatabaseUrl,

  [string]$PgRestorePath,

  [string]$PsqlPath,

  [switch]$AllowActiveConnections
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "AtlasGymBackupCommon.ps1")

function Write-ProductionRestoreLine {
  param([Parameter(Mandatory = $true)][string]$Message)
  Write-Host "$(Get-Date -Format "yyyy-MM-dd HH:mm:ss") $Message"
}

function Invoke-ProductionRestoreCommand {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$ArgumentList,
    [Parameter(Mandatory = $true)][string]$Label
  )

  $result = Invoke-AtlasGymExternalCommand -FilePath $FilePath -ArgumentList $ArgumentList
  foreach ($line in $result.Output) {
    if ($line) {
      Write-ProductionRestoreLine "${Label}: $line"
    }
  }
  if ($result.ExitCode -ne 0) {
    throw "$Label failed with exit code $($result.ExitCode)."
  }
  return $result
}

function Read-AtlasGymJsonFile {
  param([Parameter(Mandatory = $true)][string]$Path)

  $bytes = [System.IO.File]::ReadAllBytes($Path)
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xef -and $bytes[1] -eq 0xbb -and $bytes[2] -eq 0xbf) {
    $text = [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
  } elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xff -and $bytes[1] -eq 0xfe) {
    $text = [System.Text.Encoding]::Unicode.GetString($bytes, 2, $bytes.Length - 2)
  } else {
    $text = [System.Text.Encoding]::UTF8.GetString($bytes)
  }
  return $text | ConvertFrom-Json
}

function Get-AtlasGymJsonProperty {
  param(
    [Parameter(Mandatory = $true)]$Object,
    [Parameter(Mandatory = $true)][string]$Name
  )

  $property = $Object.PSObject.Properties[$Name]
  if (-not $property) {
    return $null
  }
  return $property.Value
}

$requiredPhrase = "RESTORE ATLASGYM DATABASE"
if ($ConfirmPhrase -ne $requiredPhrase) {
  throw "ConfirmPhrase must exactly match '$requiredPhrase'."
}

$repoRoot = Get-AtlasGymRepoRoot
$envFilePath = Resolve-AtlasGymPath -Path $EnvFile -BasePath $repoRoot
$backupRootPath = Resolve-AtlasGymPath -Path $BackupRoot -BasePath $repoRoot
$backupFullPath = Resolve-AtlasGymPath -Path $BackupPath -BasePath $repoRoot

if (-not (Test-Path -LiteralPath $backupRootPath -PathType Container)) {
  throw "BackupRoot was not found: $backupRootPath"
}

if (-not (Test-Path -LiteralPath $backupFullPath -PathType Container)) {
  throw "BackupPath must be a backup folder: $backupFullPath"
}

if (-not (Test-AtlasGymPathInside -ChildPath $backupFullPath -ParentPath $backupRootPath)) {
  throw "BackupPath must be inside BackupRoot."
}

$folderName = Split-Path -Leaf $backupFullPath
if ($folderName -ne $ExpectedFolderName) {
  throw "ExpectedFolderName does not match selected backup folder."
}

$normalizedBackupRoot = $backupRootPath.TrimEnd('\', '/')
$normalizedBackupPath = $backupFullPath.TrimEnd('\', '/')
$relativeBackupPath = $normalizedBackupPath.Substring($normalizedBackupRoot.Length).TrimStart('\', '/')
$relativeParts = $relativeBackupPath -split '[\\/]'
if ($relativeParts.Count -lt 2 -or -not @("manual", "scheduled", "daily", "pre-migration").Contains($relativeParts[0])) {
  throw "BackupPath must be inside a known backup type folder under BackupRoot."
}

$manifestPath = Join-Path $backupFullPath "manifest.json"
$logPath = Join-Path $backupFullPath "backup.log"
$dumpPath = Join-Path $backupFullPath "database.dump"

if (-not (Test-Path -LiteralPath $manifestPath -PathType Leaf)) {
  throw "manifest.json is required before production restore."
}
if (-not (Test-Path -LiteralPath $logPath -PathType Leaf)) {
  throw "backup.log is required before production restore."
}
if (-not (Test-Path -LiteralPath $dumpPath -PathType Leaf)) {
  throw "database.dump is required before production restore."
}

$manifest = Read-AtlasGymJsonFile -Path $manifestPath
$manifestFileName = Get-AtlasGymJsonProperty -Object $manifest -Name "fileName"
if ($manifestFileName -and $manifestFileName -ne "database.dump") {
  throw "manifest.json references an unsupported dump file name."
}

$actualSha256 = Get-AtlasGymSha256 -Path $dumpPath
$manifestSha256 = Get-AtlasGymJsonProperty -Object $manifest -Name "sha256"
if (-not $manifestSha256 -or $actualSha256 -ne ([string]$manifestSha256).ToLowerInvariant()) {
  throw "Backup SHA-256 does not match manifest."
}

$dumpInfo = Get-Item -LiteralPath $dumpPath
$manifestSizeBytes = Get-AtlasGymJsonProperty -Object $manifest -Name "sizeBytes"
if ($manifestSizeBytes -and ([int64]$manifestSizeBytes) -ne $dumpInfo.Length) {
  throw "Backup size does not match manifest."
}

if (-not $DatabaseUrl) {
  $DatabaseUrl = Get-AtlasGymDotEnvValue -EnvFile $envFilePath -Name "DATABASE_URL"
}
if (-not $DatabaseUrl -and $env:DATABASE_URL) {
  $DatabaseUrl = $env:DATABASE_URL
}
if (-not $DatabaseUrl) {
  throw "DATABASE_URL was not provided and was not found in $envFilePath"
}

$db = ConvertFrom-AtlasGymDatabaseUrl -DatabaseUrl $DatabaseUrl
if ($db.Database -match "^atlasgym_restore_test_") {
  throw "Production restore refuses to target restore-test databases."
}

$pgRestore = Resolve-AtlasGymTool -Name "pg_restore" -Override $PgRestorePath
$psql = Resolve-AtlasGymTool -Name "psql" -Override $PsqlPath

$oldPgPassword = $env:PGPASSWORD
$env:PGPASSWORD = $db.Password
$reportPath = Join-Path $backupFullPath ("production-restore-report_" + (Get-Date -Format "yyyy-MM-dd_HHmmss") + ".json")

try {
  if (-not $AllowActiveConnections) {
    $connectionSql = "select count(*) from pg_stat_activity where datname = current_database() and pid <> pg_backend_pid();"
    $connectionResult = Invoke-ProductionRestoreCommand -FilePath $psql -ArgumentList @(
      "--host", $db.Host,
      "--port", [string]$db.Port,
      "--username", $db.User,
      "--dbname", $db.Database,
      "--tuples-only",
      "--no-align",
      "--command", $connectionSql
    ) -Label "psql"
    $activeConnectionCount = [int]($connectionResult.Output | Select-Object -Last 1)
    if ($activeConnectionCount -gt 0) {
      throw "Production restore refused because active database connections were detected. Stop the application server first or pass -AllowActiveConnections only during a controlled maintenance window."
    }
  }

  Write-ProductionRestoreLine "Starting production restore."
  Write-ProductionRestoreLine "Source backup: $dumpPath"
  Write-ProductionRestoreLine "Target database: $($db.Host):$($db.Port)/$($db.Database)"

  Invoke-ProductionRestoreCommand -FilePath $pgRestore -ArgumentList @(
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-acl",
    "--host", $db.Host,
    "--port", [string]$db.Port,
    "--username", $db.User,
    "--dbname", $db.Database,
    $dumpPath
  ) -Label "pg_restore" | Out-Null

  $report = [ordered]@{
    status = "succeeded"
    completedAt = (Get-Date).ToString("o")
    sourceBackup = $dumpPath
    sourceSha256 = $actualSha256
    databaseHost = $db.Host
    databasePort = $db.Port
    databaseName = $db.Database
    migrationReminder = "Run `npx prisma migrate deploy` from the server folder before starting the app if this backup was created before the current app version."
  }
  $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportPath -Encoding UTF8
  Write-ProductionRestoreLine "Production restore completed."
  Write-ProductionRestoreLine "Report: $reportPath"
} finally {
  $env:PGPASSWORD = $oldPgPassword
}
