# LIC008: export existing non-secret reports only. Never starts a service or opens a key.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
function Assert-Plain([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Linked path refused.' }
        $parent = Split-Path -Parent $cursor
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
}
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run as administrator.' }
$sourceRoot = Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'Ecs.Lic008.Spike'
Assert-Plain $sourceRoot
$reports = @()
foreach ($role in @('guardian','app')) {
    $directory = Join-Path $sourceRoot ($role + '-reports')
    Assert-Plain $directory
    $files = @(Get-ChildItem -LiteralPath $directory -File -Force)
    if ($files.Count -gt 100) { throw 'Too many reports; manual review required.' }
    foreach ($file in $files) {
        if ($file.Name -notmatch '^[a-f0-9]{32}\.json$' -or $file.Length -gt 262144) { throw 'Unexpected report file.' }
        Assert-Plain $file.FullName
        $report = Get-Content -LiteralPath $file.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($report.checklistId -ne 'LIC-6.2-008' -or $report.role -ne $role -or ($report.runId + '.json') -ne $file.Name) { throw 'Report identity mismatch.' }
        # Explicit public field selection; never copy private state or key material.
        $results = @($report.results | Select-Object Id,Status,Error,Stage)
        $reports += @{runId=$report.runId;role=$role;action=$report.action;runtime=$report.runtime;
            serviceIdentityMatched=$report.serviceIdentityMatched;timeUtc=$report.timeUtc;results=$results}
    }
}
$services = @()
foreach ($name in @('Ecs.Lic008.Spike.Guardian','Ecs.Lic008.Spike.App')) {
    $service = Get-Service -Name $name -ErrorAction SilentlyContinue
    $services += @{name=$name;status=if ($service) { [string]$service.Status } else { 'NOT_FOUND' }}
}
# Sibling output, outside the closed package and the protected installation.
$parentDirectory = Split-Path -Parent $PSScriptRoot
Assert-Plain $parentDirectory
$destination = Join-Path $parentDirectory ('lic008-diagnostics-' + [Guid]::NewGuid().ToString('N') + '.json')
$data = @{schemaVersion=1;scope='EXISTING_REPORT_EXPORT_ONLY';timeUtc=[DateTime]::UtcNow.ToString('o');services=$services;reports=$reports} | ConvertTo-Json -Depth 12
$stream = [IO.File]::Open($destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try { $encoded = (New-Object Text.UTF8Encoding($false)).GetBytes($data); $stream.Write($encoded,0,$encoded.Length) } finally { $stream.Dispose() }
Write-Host ('Send this file: ' + $destination)
Write-Host 'Existing reports exported. No key, service or ACL changed.'
