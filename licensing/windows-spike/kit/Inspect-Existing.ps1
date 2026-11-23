# LIC008 read-only provider/key lookup under elevated Administrator, not Guardian.
# No creation, key export, signing, deletion, ACL change or service operation.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidatePattern('^[a-f0-9]{32}$')][string]$RunId)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
function Assert-PlainPath([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        $item = Get-Item -LiteralPath $cursor -Force -ErrorAction Stop
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Linked path refused.' }
        $parent = Split-Path -Parent $cursor
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
}
if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Elevated Administrator required.' }
$root = Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'Ecs.Lic008.Spike'
$reportPath = Join-Path $root ('guardian-reports/' + $RunId + '.json')
Assert-PlainPath $reportPath
if ((Get-Item -LiteralPath $reportPath).Length -gt 262144) { throw 'Report too large.' }
$report = Get-Content -LiteralPath $reportPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($report.runId -ne $RunId -or $report.checklistId -ne 'LIC-6.2-008' -or $report.role -ne 'guardian' -or $report.action -ne 'create' -or $report.serviceIdentityMatched -ne $true) { throw 'Expected original Guardian create report.' }
$nativePath = Join-Path $PSScriptRoot 'ReadOnlyProbe.cs'
Assert-PlainPath $nativePath
Add-Type -Path $nativePath
$results = @()
foreach ($provider in @('software','tpm')) {
    $name = 'Ecs.Lic008.TEST_ONLY.' + $provider + '.' + $RunId
    $results += [EcsLic008ReadOnlyProbe]::Inspect($provider,$name)
}
$services = @()
foreach ($name in @('Ecs.Lic008.Spike.Guardian','Ecs.Lic008.Spike.App')) {
    $service = Get-CimInstance Win32_Service -Filter "Name='$name'"
    $services += @{name=$name;present=($null -ne $service);state=if ($service) {$service.State} else {$null};
        manual=if ($service) {$service.StartMode -eq 'Manual'} else {$null};
        expectedVirtualAccount=if ($service) {$service.StartName -ieq ('NT SERVICE\' + $name)} else {$null}}
}
$platform = @{}
try {
    $os = Get-CimInstance Win32_OperatingSystem
    $platform.version=$os.Version; $platform.build=$os.BuildNumber
    $platform.partOfDomain=[bool](Get-CimInstance Win32_ComputerSystem).PartOfDomain
} catch { $platform.query='UNKNOWN' }
try {
    $tpm = Get-CimInstance -Namespace 'root/CIMV2/Security/MicrosoftTpm' -ClassName Win32_Tpm
    if ($null -eq $tpm) { $platform.tpmQuery='NO_INSTANCE' }
    else { $platform.tpmQuery='OBSERVED'; $platform.tpmSpec=$tpm.SpecVersion; $platform.tpmEnabled=$tpm.IsEnabled_InitialValue; $platform.tpmActivated=$tpm.IsActivated_InitialValue }
} catch { $platform.tpmQuery='UNKNOWN' }
$destinationRoot = Split-Path -Parent $PSScriptRoot
Assert-PlainPath $destinationRoot
$destination = Join-Path $destinationRoot ('lic008-inspection-' + [guid]::NewGuid().ToString('N') + '.json')
$data = @{schemaVersion=1;scope='READ_ONLY_ADMINISTRATOR_DIAGNOSTICS';runId=$RunId;timeUtc=[DateTime]::UtcNow.ToString('o');
    caller='ELEVATED_ADMINISTRATOR_NOT_GUARDIAN';services=$services;platform=$platform;results=$results;
    limitation='No global key absence or Guardian access conclusion. No key or service mutation. No private-state access.'} | ConvertTo-Json -Depth 8
$stream = [IO.File]::Open($destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try { $encoded = (New-Object Text.UTF8Encoding($false)).GetBytes($data); $stream.Write($encoded,0,$encoded.Length) } finally { $stream.Dispose() }
Write-Output $destination
