[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$TestDatabaseName,

  [string]$EnvFile = "server\.env",

  [int]$Port = 4101,

  [string]$NodePath = "node",

  [string]$PsqlPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "AtlasGymBackupCommon.ps1")

function Invoke-RestoreApiJson {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [int]$TimeoutSec = 10,
    [string]$SessionToken
  )

  $headers = @{}
  if ($SessionToken) {
    $webSession = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $cookie = New-Object System.Net.Cookie("ecs_session", $SessionToken, "/", "127.0.0.1")
    $webSession.Cookies.Add((New-Object System.Uri("http://127.0.0.1:$Port")), $cookie)
    return Invoke-RestMethod -Uri "http://127.0.0.1:$Port$Path" -TimeoutSec $TimeoutSec -WebSession $webSession
  }

  return Invoke-RestMethod -Uri "http://127.0.0.1:$Port$Path" -TimeoutSec $TimeoutSec -Headers $headers
}

function ConvertTo-RestoreApiSqlLiteral {
  param([Parameter(Mandatory = $true)][string]$Value)
  return "'" + ($Value -replace "'", "''") + "'"
}

function New-RestoreApiSessionToken {
  $bytes = New-Object byte[] 32
  $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
  try {
    $rng.GetBytes($bytes)
  } finally {
    $rng.Dispose()
  }

  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Get-RestoreApiSha256Hex {
  param([Parameter(Mandatory = $true)][string]$Value)

  $sha = [System.Security.Cryptography.SHA256]::Create()
  try {
    $hashBytes = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($Value))
    return ([BitConverter]::ToString($hashBytes)).Replace("-", "").ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function Invoke-RestoreApiPsql {
  param(
    [Parameter(Mandatory = $true)][string]$Psql,
    [Parameter(Mandatory = $true)]$Database,
    [Parameter(Mandatory = $true)][string]$Sql,
    [switch]$StopOnError
  )

  $sqlPath = Join-Path ([System.IO.Path]::GetTempPath()) ("atlasgym_restore_api_" + [System.Guid]::NewGuid().ToString("N") + ".sql")
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($sqlPath, $Sql, $utf8NoBom)

  try {
    $args = @(
      "--host", $Database.Host,
      "--port", [string]$Database.Port,
      "--username", $Database.User,
      "--dbname", $Database.Database,
      "--tuples-only",
      "--no-align",
      "--file", $sqlPath
    )
    if ($StopOnError) {
      $args = @("--set", "ON_ERROR_STOP=1") + $args
    }

    $oldPgPassword = $env:PGPASSWORD
    $env:PGPASSWORD = $Database.Password
    try {
      $result = Invoke-AtlasGymExternalCommand -FilePath $Psql -ArgumentList $args
    } finally {
      $env:PGPASSWORD = $oldPgPassword
    }
  } finally {
    Remove-Item -LiteralPath $sqlPath -Force -ErrorAction SilentlyContinue
  }

  if ($result.ExitCode -ne 0) {
    throw "psql failed with exit code $($result.ExitCode): $($result.Output -join "`n")"
  }

  return @($result.Output | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim() })
}

function New-RestoreApiSmokeSession {
  param(
    [Parameter(Mandatory = $true)][string]$DatabaseUrl,
    [Parameter(Mandatory = $true)][string]$Psql
  )

  $db = ConvertFrom-AtlasGymDatabaseUrl -DatabaseUrl $DatabaseUrl
  $adminRows = @(Invoke-RestoreApiPsql -Psql $Psql -Database $db -Sql @'
select id
from "AdminUser"
where role = 'GYM_OWNER'
  and "isActive" = true
  and "deactivatedAt" is null
order by "createdAt"
limit 1;
'@)

  if (-not $adminRows -or -not $adminRows[0]) {
    throw "No active GYM_OWNER was found in the restored test database."
  }

  $token = New-RestoreApiSessionToken
  $tokenHash = Get-RestoreApiSha256Hex -Value $token
  $sessionId = "restore_smoke_" + [System.Guid]::NewGuid().ToString("N")

  $insertSql = @"
insert into "AdminSession" (id, "adminUserId", "tokenHash", "ipAddress", "userAgent", "createdAt", "lastSeenAt", "expiresAt")
values ($(ConvertTo-RestoreApiSqlLiteral $sessionId), $(ConvertTo-RestoreApiSqlLiteral $adminRows[0]), $(ConvertTo-RestoreApiSqlLiteral $tokenHash), '127.0.0.1', 'restore-api-smoke', now(), now(), now() + interval '1 hour');
"@

  Invoke-RestoreApiPsql -Psql $Psql -Database $db -Sql $insertSql -StopOnError | Out-Null
  return $token
}

if ($TestDatabaseName -notmatch "^atlasgym_restore_test_[A-Za-z0-9_]+$") {
  throw "TestDatabaseName must start with atlasgym_restore_test_ and contain only letters, numbers, and underscores."
}

$repoRoot = Get-AtlasGymRepoRoot
$envFilePath = Resolve-AtlasGymPath -Path $EnvFile -BasePath $repoRoot
$serverScript = Join-Path $repoRoot "scripts\restore-api-smoke-server.js"

if (-not (Test-Path -LiteralPath $serverScript -PathType Leaf)) {
  throw "Restore API smoke server script was not found: $serverScript"
}

$databaseUrl = Get-AtlasGymDotEnvValue -EnvFile $envFilePath -Name "DATABASE_URL"
if (-not $databaseUrl -and $env:DATABASE_URL) {
  $databaseUrl = $env:DATABASE_URL
}
if (-not $databaseUrl) {
  throw "DATABASE_URL was not provided and was not found in $envFilePath"
}

$db = ConvertFrom-AtlasGymDatabaseUrl -DatabaseUrl $databaseUrl
$restoreUrl = $databaseUrl -replace "/$([regex]::Escape($db.Database))(\?)", "/$TestDatabaseName`$1"
$psql = Resolve-AtlasGymTool -Name "psql" -Override $PsqlPath
$sessionToken = New-RestoreApiSmokeSession -DatabaseUrl $restoreUrl -Psql $psql

$stdoutPath = Join-Path ([System.IO.Path]::GetTempPath()) "atlasgym_restore_api_stdout.log"
$stderrPath = Join-Path ([System.IO.Path]::GetTempPath()) "atlasgym_restore_api_stderr.log"
Remove-Item -LiteralPath $stdoutPath, $stderrPath -Force -ErrorAction SilentlyContinue

$oldDatabaseUrl = $env:DATABASE_URL
$oldNodeEnv = $env:NODE_ENV
$oldPort = $env:PORT
$oldHost = $env:HOST

$env:DATABASE_URL = $restoreUrl
$env:NODE_ENV = "test"
$env:PORT = [string]$Port
$env:HOST = "127.0.0.1"

$process = $null
try {
  $process = Start-Process -FilePath $NodePath `
    -ArgumentList @($serverScript) `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $stdoutPath `
    -RedirectStandardError $stderrPath `
    -PassThru `
    -WindowStyle Hidden

  $health = $null
  for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 500
    if ($process.HasExited) {
      $stderr = Get-Content -LiteralPath $stderrPath -Raw -ErrorAction SilentlyContinue
      throw "Restore API process exited early with code $($process.ExitCode). stderr: $stderr"
    }

    try {
      $health = Invoke-RestoreApiJson -Path "/api/v1/health" -TimeoutSec 2
      if ($health.status -eq "ok") {
        break
      }
    } catch {
      $health = $null
    }
  }

  if (-not $health -or $health.status -ne "ok") {
    throw "Restore API did not become healthy on port $Port."
  }

  $auth = Invoke-RestoreApiJson -Path "/api/v1/auth/me" -SessionToken $sessionToken
  $members = Invoke-RestoreApiJson -Path "/api/v1/members?page=1&pageSize=5" -SessionToken $sessionToken
  $devices = Invoke-RestoreApiJson -Path "/api/v1/devices" -SessionToken $sessionToken
  $attendance = Invoke-RestoreApiJson -Path "/api/v1/attendance?page=1&pageSize=2" -TimeoutSec 20 -SessionToken $sessionToken
  $dashboard = Invoke-RestoreApiJson -Path "/api/v1/dashboard/summary?range=7d" -TimeoutSec 20 -SessionToken $sessionToken
  $inbox = Invoke-RestoreApiJson -Path "/api/v1/inbox?page=1&pageSize=2" -SessionToken $sessionToken

  $insideNowProperty = $dashboard.PSObject.Properties["insideNow"]
  $insideNowValue = if ($insideNowProperty -and $insideNowProperty.Value.PSObject.Properties["value"]) {
    $insideNowProperty.Value.value
  } else {
    $null
  }

  $result = [ordered]@{
    status = "succeeded"
    checkedAt = (Get-Date).ToString("o")
    testDatabaseName = $TestDatabaseName
    port = $Port
    healthStatus = $health.status
    healthDatabase = [bool]$health.database
    authUser = $auth.user.username
    authRole = $auth.user.role
    membersTotal = $members.total
    devicesCount = @($devices).Count
    attendanceTotal = $attendance.total
    dashboardTodaysEntries = $dashboard.todaysEntries.value
    dashboardInsideNow = $insideNowValue
    inboxTotal = $inbox.total
    stdout = (Get-Content -LiteralPath $stdoutPath -Raw -ErrorAction SilentlyContinue).Trim()
  }

  $result | ConvertTo-Json -Depth 5
} finally {
  if ($process -and -not $process.HasExited) {
    Stop-Process -Id $process.Id -Force
    Start-Sleep -Milliseconds 500
  }

  $env:DATABASE_URL = $oldDatabaseUrl
  $env:NODE_ENV = $oldNodeEnv
  $env:PORT = $oldPort
  $env:HOST = $oldHost
}
