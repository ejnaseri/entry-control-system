Set-StrictMode -Version Latest

function Get-AtlasGymRepoRoot {
  return [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
}

function Resolve-AtlasGymPath {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$BasePath
  )

  if ([System.IO.Path]::IsPathRooted($Path)) {
    return [System.IO.Path]::GetFullPath($Path)
  }

  return [System.IO.Path]::GetFullPath((Join-Path $BasePath $Path))
}

function Test-AtlasGymPathInside {
  param(
    [Parameter(Mandatory = $true)][string]$ChildPath,
    [Parameter(Mandatory = $true)][string]$ParentPath
  )

  $child = [System.IO.Path]::GetFullPath($ChildPath).TrimEnd('\', '/')
  $parent = [System.IO.Path]::GetFullPath($ParentPath).TrimEnd('\', '/')

  if ([string]::Equals($child, $parent, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $true
  }

  return $child.StartsWith($parent + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-AtlasGymDotEnvValue {
  param(
    [Parameter(Mandatory = $true)][string]$EnvFile,
    [Parameter(Mandatory = $true)][string]$Name
  )

  if (-not (Test-Path -LiteralPath $EnvFile)) {
    return $null
  }

  $pattern = "^\s*$([regex]::Escape($Name))\s*=\s*(.*)\s*$"
  foreach ($line in Get-Content -LiteralPath $EnvFile) {
    if ($line -match "^\s*#") {
      continue
    }

    if ($line -match $pattern) {
      $value = $Matches[1].Trim()
      if (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
      ) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      return $value
    }
  }

  return $null
}

function ConvertFrom-AtlasGymDatabaseUrl {
  param(
    [Parameter(Mandatory = $true)][string]$DatabaseUrl
  )

  try {
    $uri = [System.Uri]$DatabaseUrl
  } catch {
    throw "DATABASE_URL is not a valid URI."
  }

  if ($uri.Scheme -ne "postgresql" -and $uri.Scheme -ne "postgres") {
    throw "DATABASE_URL must use the postgresql:// or postgres:// scheme."
  }

  $user = ""
  $password = ""
  if ($uri.UserInfo) {
    $parts = $uri.UserInfo.Split(":", 2)
    $user = [System.Uri]::UnescapeDataString($parts[0])
    if ($parts.Count -gt 1) {
      $password = [System.Uri]::UnescapeDataString($parts[1])
    }
  }

  $database = [System.Uri]::UnescapeDataString($uri.AbsolutePath.TrimStart("/"))
  if (-not $database) {
    throw "DATABASE_URL must include a database name."
  }

  $schema = "public"
  $query = $uri.Query.TrimStart("?")
  if ($query) {
    foreach ($item in $query.Split("&")) {
      $pair = $item.Split("=", 2)
      if ($pair.Count -eq 2 -and $pair[0] -eq "schema") {
        $schema = [System.Uri]::UnescapeDataString($pair[1])
      }
    }
  }

  $port = if ($uri.Port -gt 0) { $uri.Port } else { 5432 }
  $sanitizedUrl = $DatabaseUrl -replace "(postgres(?:ql)?://[^:/@\s]+):([^@\s]*)@", '$1:****@'

  return [pscustomobject]@{
    Url = $DatabaseUrl
    SanitizedUrl = $sanitizedUrl
    Host = $uri.Host
    Port = $port
    User = $user
    Password = $password
    Database = $database
    Schema = $schema
  }
}

function Resolve-AtlasGymTool {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [string]$Override
  )

  if ($Override) {
    if (Test-Path -LiteralPath $Override) {
      return (Resolve-Path -LiteralPath $Override).Path
    }

    $overrideCommand = Get-Command $Override -ErrorAction SilentlyContinue
    if ($overrideCommand) {
      return $overrideCommand.Source
    }

    throw "Tool override for $Name was not found: $Override"
  }

  $command = Get-Command $Name -ErrorAction SilentlyContinue
  if (-not $command) {
    throw "$Name was not found on PATH. Install PostgreSQL client tools or pass -$($Name)Path."
  }

  return $command.Source
}

function Get-AtlasGymGitCommit {
  param(
    [Parameter(Mandatory = $true)][string]$RepoRoot
  )

  $git = Get-Command git -ErrorAction SilentlyContinue
  if (-not $git) {
    return "unknown"
  }

  Push-Location $RepoRoot
  try {
    $commit = (& git rev-parse --short HEAD 2>$null)
    if ($LASTEXITCODE -eq 0 -and $commit) {
      return [string]$commit
    }
  } finally {
    Pop-Location
  }

  return "unknown"
}

function Get-AtlasGymSha256 {
  param(
    [Parameter(Mandatory = $true)][string]$Path
  )

  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Invoke-AtlasGymExternalCommand {
  param(
    [Parameter(Mandatory = $true)][string]$FilePath,
    [Parameter(Mandatory = $true)][string[]]$ArgumentList
  )

  $previousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  try {
    $output = & $FilePath @ArgumentList 2>&1
  } finally {
    $ErrorActionPreference = $previousErrorActionPreference
  }
  return [pscustomobject]@{
    ExitCode = $LASTEXITCODE
    Output = @($output | ForEach-Object { [string]$_ })
  }
}
