[CmdletBinding()]
param(
    [ValidatePattern('^lic008-retained-hashes-[a-f0-9]{32}\.json$')]
    [string]$OutputName = ('lic008-retained-hashes-' + [guid]::NewGuid().ToString('N') + '.json'),
    [switch]$ValidateOnly
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Evidence custody ONLY: fixed report/checkpoint paths, no controller execution,
# no CNG/SCM/ACL calls, no key or protected-file creation/deletion.
$targets = @(
    @{ Id = 'v2.summary'; Path = 'C:\ProgramData\Ecs.Lic008.WrappingV2\wrapping-summary-7da3625af6f14f10b05b5bed5e1cf5be.json'; Expected = $null },
    @{ Id = 'v4.summary'; Path = 'C:\ProgramData\Ecs.Lic008.WrappingV4\wrapping-summary-47513d20e9864dcf84d40b8ace00b916.json'; Expected = $null },
    @{ Id = 'v4.checkpoint'; Path = 'C:\ProgramData\Ecs.Lic008.WrappingV4\reboot-checkpoint.json'; Expected = '7417aae3163e3a35e0103303619844adcda021388c1816f02e8d288f10be62ea' },
    @{ Id = 'v5.summary'; Path = 'C:\ProgramData\Ecs.Lic008.WrappingV5\wrapping-summary-de5efc93255841619c9f86f2570af292.json'; Expected = $null },
    @{ Id = 'v5.checkpoint'; Path = 'C:\ProgramData\Ecs.Lic008.WrappingV5\repair-checkpoint.json'; Expected = 'adb4aa66402c671f50d21bbcdca84dc619341ffc5108ea1c7bdcd7fb20a7b1d8' }
)

function Assert-PlainPath([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw "Reparse path refused: $cursor"
        }
        $parent = [IO.Path]::GetDirectoryName($cursor)
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
}

if ($ValidateOnly) {
    # Inert preparation check. Does not inspect protected paths or write output.
    if ($targets.Count -ne 5 -or @($targets.Id | Select-Object -Unique).Count -ne 5) {
        throw 'Unexpected target inventory'
    }
    $targets | ForEach-Object { [pscustomobject]@{ Id = $_.Id; Path = $_.Path } }
    return
}

$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    throw 'Run this fixed read-only collector in elevated PowerShell; do not change ACLs.'
}

$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ($workspace -ine 'E:\EntryControlSystem') { throw 'Unexpected workspace; no operation performed.' }
$outputRoot = Join-Path $workspace 'out'
Assert-PlainPath $outputRoot
if (-not (Get-Item -LiteralPath $outputRoot -Force).PSIsContainer) { throw 'Output root is not a directory' }
$outputPath = Join-Path $outputRoot $OutputName

$results = @(foreach ($target in $targets) {
    try {
        Assert-PlainPath $target.Path
        $file = Get-Item -LiteralPath $target.Path -Force
        if ($file.PSIsContainer -or $file.Length -gt 67108864) { throw 'Unexpected file type or size' }
        $stream = [IO.File]::Open($target.Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
        try {
            if ($stream.Length -gt 67108864) { throw 'Report exceeds fixed size cap' }
            $size = $stream.Length
            $sha = [Security.Cryptography.SHA256]::Create()
            try { $digest = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
            finally { $sha.Dispose() }
        } finally { $stream.Dispose() }
        $match = $null
        if ($target.Expected) { $match = $digest -ceq $target.Expected }
        [pscustomobject]@{
            id = $target.Id; path = $target.Path; status = 'HASH_READ'; sha256 = $digest; bytes = $size
            historicalReportedCheckpointSha256 = $target.Expected; matchesHistoricalReport = $match
        }
    } catch {
        [pscustomobject]@{
            id = $target.Id; path = $target.Path; status = 'UNAVAILABLE'
            exceptionType = $_.Exception.GetType().FullName; errorId = $_.FullyQualifiedErrorId
        }
    }
})

$report = [ordered]@{
    schemaVersion = 1; scope = 'READ_ONLY_RETAINED_SUMMARY_HASH_CAPTURE'; timeUtc = [DateTime]::UtcNow.ToString('o')
    elevated = $true; collectorSha256 = (Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
    results = $results; allFiveHashesRead = @($results | Where-Object { $_.status -ne 'HASH_READ' }).Count -eq 0
    fullEvidenceReconciled = $false; securityAccepted = $false; productionAccepted = $false
}
$json = $report | ConvertTo-Json -Depth 5
$encoded = [Text.Encoding]::UTF8.GetBytes($json)
# The only write is a new diagnostic report under workspace/out. Never overwrite.
$outputStream = [IO.File]::Open($outputPath, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
try { $outputStream.Write($encoded, 0, $encoded.Length); $outputStream.Flush($true) }
finally { $outputStream.Dispose() }
Write-Output "Report: $outputPath"
