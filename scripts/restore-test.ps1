[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$BackupPath,

  [string]$TestDatabaseName = $("atlasgym_restore_test_" + (Get-Date -Format "yyyyMMdd_HHmmss")),

  [string]$EnvFile = "server\.env",

  [string]$DatabaseUrl,

  [string]$CreatedbPath,

  [string]$DropdbPath,

  [string]$PgRestorePath,

  [string]$PsqlPath,

  [switch]$DropExisting,

  [switch]$Cleanup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "AtlasGymBackupCommon.ps1")

function Write-RestoreLine {
  param([Parameter(Mandatory = $true)][string]$Message)
  Write-Host "$(Get-Date -Format "yyyy-MM-dd HH:mm:ss") $Message"
}

function Invoke-RestoreCommand {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$ArgumentList,
    [Parameter(Mandatory = $true)][string]$Label
  )

  $result = Invoke-AtlasGymExternalCommand -FilePath $FilePath -ArgumentList $ArgumentList
  foreach ($line in $result.Output) {
    if ($line) {
      Write-RestoreLine "${Label}: $line"
    }
  }
  if ($result.ExitCode -ne 0) {
    throw "$Label failed with exit code $($result.ExitCode)."
  }
  return $result
}

if ($TestDatabaseName -notmatch "^atlasgym_restore_test_[A-Za-z0-9_]+$") {
  throw "TestDatabaseName must start with atlasgym_restore_test_ and contain only letters, numbers, and underscores."
}

$repoRoot = Get-AtlasGymRepoRoot
$envFilePath = Resolve-AtlasGymPath -Path $EnvFile -BasePath $repoRoot
$backupFullPath = Resolve-AtlasGymPath -Path $BackupPath -BasePath $repoRoot

if (Test-Path -LiteralPath $backupFullPath -PathType Container) {
  $dumpPath = Join-Path $backupFullPath "database.dump"
  $reportRoot = $backupFullPath
} else {
  $dumpPath = $backupFullPath
  $reportRoot = Split-Path -Parent $backupFullPath
}

if (-not (Test-Path -LiteralPath $dumpPath -PathType Leaf)) {
  throw "Backup dump file was not found: $dumpPath"
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
$createdb = Resolve-AtlasGymTool -Name "createdb" -Override $CreatedbPath
$pgRestore = Resolve-AtlasGymTool -Name "pg_restore" -Override $PgRestorePath
$psql = Resolve-AtlasGymTool -Name "psql" -Override $PsqlPath
$dropdb = $null
if ($DropExisting -or $Cleanup) {
  $dropdb = Resolve-AtlasGymTool -Name "dropdb" -Override $DropdbPath
}

$oldPgPassword = $env:PGPASSWORD
$env:PGPASSWORD = $db.Password
$counts = [ordered]@{}
$reportPath = Join-Path $reportRoot ("restore-test-report_" + (Get-Date -Format "yyyy-MM-dd_HHmmss") + ".json")
$created = $false

try {
  Write-RestoreLine "Starting restore test into database $TestDatabaseName."
  Write-RestoreLine "Source backup: $dumpPath"

  if ($DropExisting) {
    Invoke-RestoreCommand -FilePath $dropdb -ArgumentList @(
      "--if-exists",
      "--host", $db.Host,
      "--port", [string]$db.Port,
      "--username", $db.User,
      $TestDatabaseName
    ) -Label "dropdb" | Out-Null
  }

  Invoke-RestoreCommand -FilePath $createdb -ArgumentList @(
    "--host", $db.Host,
    "--port", [string]$db.Port,
    "--username", $db.User,
    $TestDatabaseName
  ) -Label "createdb" | Out-Null
  $created = $true

  Invoke-RestoreCommand -FilePath $pgRestore -ArgumentList @(
    "--clean",
    "--if-exists",
    "--no-owner",
    "--no-acl",
    "--host", $db.Host,
    "--port", [string]$db.Port,
    "--username", $db.User,
    "--dbname", $TestDatabaseName,
    $dumpPath
  ) -Label "pg_restore" | Out-Null

  $tables = @("Member", "Membership", "Payment", "AttendanceLog", "Device", "DeviceUser", "InboxItem")
  $verificationSqlPath = Join-Path ([System.IO.Path]::GetTempPath()) ("atlasgym_restore_counts_" + [System.Guid]::NewGuid().ToString("N") + ".sql")
  $selects = foreach ($table in $tables) {
    "select '$table' as table_name, count(*)::bigint as row_count from ""$table"""
  }
  ($selects -join " union all`r`n") + ";" | Set-Content -LiteralPath $verificationSqlPath -Encoding UTF8

  try {
    $countResult = Invoke-RestoreCommand -FilePath $psql -ArgumentList @(
      "--host", $db.Host,
      "--port", [string]$db.Port,
      "--username", $db.User,
      "--dbname", $TestDatabaseName,
      "--tuples-only",
      "--no-align",
      "--field-separator=|",
      "--file", $verificationSqlPath
    ) -Label "psql" | Select-Object -Last 1

    foreach ($line in $countResult.Output) {
      if ($line -match "^([^|]+)\|(\d+)$") {
        $counts[$Matches[1]] = [int64]$Matches[2]
      }
    }

    foreach ($table in $tables) {
      if (-not $counts.Contains($table)) {
        $counts[$table] = $null
      }
    }
  } finally {
    Remove-Item -LiteralPath $verificationSqlPath -Force -ErrorAction SilentlyContinue
  }

  $report = [ordered]@{
    status = "succeeded"
    createdAt = (Get-Date).ToString("o")
    sourceBackup = $dumpPath
    sourceSha256 = Get-AtlasGymSha256 -Path $dumpPath
    testDatabaseName = $TestDatabaseName
    databaseHost = $db.Host
    databasePort = $db.Port
    counts = $counts
    cleanupRequested = [bool]$Cleanup
  }
  $report | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $reportPath -Encoding UTF8

  Write-RestoreLine "Restore test succeeded."
  Write-RestoreLine "Report: $reportPath"
  foreach ($name in $counts.Keys) {
    Write-RestoreLine "Count $name = $($counts[$name])"
  }
} finally {
  if ($Cleanup -and $created -and $dropdb) {
    Write-RestoreLine "Cleaning up test database $TestDatabaseName."
    Invoke-RestoreCommand -FilePath $dropdb -ArgumentList @(
      "--if-exists",
      "--host", $db.Host,
      "--port", [string]$db.Port,
      "--username", $db.User,
      $TestDatabaseName
    ) -Label "dropdb" | Out-Null
  }
  $env:PGPASSWORD = $oldPgPassword
}
