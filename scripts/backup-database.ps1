[CmdletBinding()]
param(
  [ValidateSet("manual", "scheduled", "pre-migration")]
  [string]$Type = "manual",

  [ValidateSet("hourly", "daily", "weekly", "monthly", "yearly")]
  [string]$ScheduleFrequency = "daily",

  [string]$BackupRoot = $(if ($env:ATLASGYM_BACKUP_ROOT) { $env:ATLASGYM_BACKUP_ROOT } else { "E:\AtlasGymBackups" }),

  [string]$EnvFile = "server\.env",

  [string]$DatabaseUrl,

  [string]$PgDumpPath,

  [long]$MinFreeBytes = 1073741824,

  [string]$Operator = $env:USERNAME,

  [string]$Notes = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "AtlasGymBackupCommon.ps1")

function Write-BackupLog {
  param(
    [Parameter(Mandatory = $true)][string]$Message
  )

  $line = "$(Get-Date -Format "yyyy-MM-dd HH:mm:ss") $Message"
  Add-Content -LiteralPath $script:LogPath -Value $line -Encoding UTF8
}

function Get-BackupClass {
  param([Parameter(Mandatory = $true)][string]$BackupType)
  if ($BackupType -eq "scheduled") {
    return "scheduled"
  }
  return $BackupType
}

$repoRoot = Get-AtlasGymRepoRoot
$envFilePath = Resolve-AtlasGymPath -Path $EnvFile -BasePath $repoRoot
$backupRootPath = Resolve-AtlasGymPath -Path $BackupRoot -BasePath $repoRoot

if (Test-AtlasGymPathInside -ChildPath $backupRootPath -ParentPath $repoRoot) {
  throw "BackupRoot must be outside the project directory: $repoRoot"
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
$pgDump = Resolve-AtlasGymTool -Name "pg_dump" -Override $PgDumpPath

New-Item -ItemType Directory -Path $backupRootPath -Force | Out-Null

$driveName = ([System.IO.Path]::GetPathRoot($backupRootPath)).TrimEnd('\')
$drive = Get-PSDrive -Name $driveName.TrimEnd(":") -ErrorAction SilentlyContinue
if ($drive -and $drive.Free -lt $MinFreeBytes) {
  throw "BackupRoot drive has less free space than required. Required bytes: $MinFreeBytes; free bytes: $($drive.Free)"
}

$backupClass = Get-BackupClass -BackupType $Type
$classRoot = Join-Path $backupRootPath $backupClass
if ($Type -eq "scheduled") {
  $classRoot = Join-Path $classRoot $ScheduleFrequency
}
New-Item -ItemType Directory -Path $classRoot -Force | Out-Null

$timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$backupLabel = $Type
if ($Type -eq "scheduled") {
  $backupLabel = "scheduled"
}
$folderName = "${timestamp}_${backupLabel}"
$finalDir = Join-Path $classRoot $folderName
$workDir = Join-Path $classRoot "$folderName.inprogress"

if ((Test-Path -LiteralPath $finalDir) -or (Test-Path -LiteralPath $workDir)) {
  $suffix = Get-Random -Minimum 1000 -Maximum 9999
  $folderName = "${timestamp}_${backupLabel}_${suffix}"
  $finalDir = Join-Path $classRoot $folderName
  $workDir = Join-Path $classRoot "$folderName.inprogress"
}

New-Item -ItemType Directory -Path $workDir -Force | Out-Null
$script:LogPath = Join-Path $workDir "backup.log"
$dumpInProgress = Join-Path $workDir "database.dump.inprogress"
$dumpPath = Join-Path $workDir "database.dump"
$manifestPath = Join-Path $workDir "manifest.json"

$oldPgPassword = $env:PGPASSWORD
$env:PGPASSWORD = $db.Password

try {
  Write-BackupLog "Starting $Type backup."
  if ($Type -eq "scheduled") {
    Write-BackupLog "Schedule frequency: $ScheduleFrequency"
  }
  Write-BackupLog "Backup root: $backupRootPath"
  Write-BackupLog "Database: host=$($db.Host) port=$($db.Port) database=$($db.Database) user=$($db.User) schema=$($db.Schema)"
  Write-BackupLog "Using pg_dump: $pgDump"

  $args = @(
    "--format=custom",
    "--no-owner",
    "--no-acl",
    "--host", $db.Host,
    "--port", [string]$db.Port,
    "--username", $db.User,
    "--dbname", $db.Database,
    "--file", $dumpInProgress
  )

  $result = Invoke-AtlasGymExternalCommand -FilePath $pgDump -ArgumentList $args
  foreach ($line in $result.Output) {
    if ($line) {
      Write-BackupLog ($line -replace [regex]::Escape($db.Url), $db.SanitizedUrl)
    }
  }

  if ($result.ExitCode -ne 0) {
    throw "pg_dump failed with exit code $($result.ExitCode). See $script:LogPath"
  }

  if (-not (Test-Path -LiteralPath $dumpInProgress)) {
    throw "pg_dump completed but did not create the expected dump file."
  }

  Rename-Item -LiteralPath $dumpInProgress -NewName "database.dump"
  $sizeBytes = (Get-Item -LiteralPath $dumpPath).Length
  $sha256 = Get-AtlasGymSha256 -Path $dumpPath
  $commit = Get-AtlasGymGitCommit -RepoRoot $repoRoot

  $manifest = [ordered]@{
    appName = "AtlasGym"
    backupType = $Type
    status = "succeeded"
    createdAt = (Get-Date).ToString("o")
    databaseName = $db.Database
    schema = $db.Schema
    appCommit = $commit
    prismaMigrationStatus = "not-run"
    fileName = "database.dump"
    sizeBytes = $sizeBytes
    sha256 = $sha256
    operator = $(if ($Operator) { $Operator } else { "local-admin" })
    notes = $Notes
  }

  if ($Type -eq "scheduled") {
    $manifest["scheduleFrequency"] = $ScheduleFrequency
  }

  $manifestJson = $manifest | ConvertTo-Json -Depth 5
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($manifestPath, $manifestJson, $utf8NoBom)
  Write-BackupLog "Backup succeeded. sizeBytes=$sizeBytes sha256=$sha256"

  Rename-Item -LiteralPath $workDir -NewName $folderName
  $finalManifest = Join-Path $finalDir "manifest.json"

  Write-Host "Backup completed:"
  Write-Host "  Folder: $finalDir"
  Write-Host "  Manifest: $finalManifest"
  Write-Host "  SHA256: $sha256"
} catch {
  Write-BackupLog "Backup failed: $($_.Exception.Message)"
  $failedDir = "$workDir.failed"
  if (Test-Path -LiteralPath $workDir) {
    if (Test-Path -LiteralPath $failedDir) {
      $failedDir = "$workDir.$(Get-Random -Minimum 1000 -Maximum 9999).failed"
    }
    Rename-Item -LiteralPath $workDir -NewName ([System.IO.Path]::GetFileName($failedDir))
  }
  throw
} finally {
  $env:PGPASSWORD = $oldPgPassword
}
