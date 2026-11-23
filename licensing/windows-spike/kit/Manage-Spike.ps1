# LIC-6.2-008 development harness, not the product Installer or Guardian.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateSet('InstallAndRun','Recheck','Cleanup','Status')][string]$Action)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$spikeRoot = Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'Ecs.Lic008.Spike'
$spikeNames = @('Ecs.Lic008.Spike.Guardian','Ecs.Lic008.Spike.App')
$spikeSc = Join-Path $env:SystemRoot 'System32/sc.exe'
$spikeExe = Join-Path $spikeRoot 'bin/Ecs.Lic008.Spike.exe'

function Assert-PlainPath([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            if (((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Linked path refused.' }
        }
        $parent = Split-Path -Parent $cursor
        if ($parent -eq $cursor) { break }
        $cursor = $parent
    }
}
function ConvertTo-NativeArgument([string]$Value) {
    $escaped = [regex]::Replace($Value, '(\\*)"', '$1$1\"')
    $escaped = [regex]::Replace($escaped, '(\\+)$', '$1$1')
    return '"' + $escaped + '"'
}
function Invoke-SpikeSc([string[]]$Words) {
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $spikeSc
    $start.Arguments = (($Words | ForEach-Object { ConvertTo-NativeArgument $_ }) -join ' ')
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $process = [Diagnostics.Process]::Start($start)
    try {
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(30000)) { $process.Kill(); throw 'Service command timeout; inspect retained resources.' }
        Write-Host $stdout.GetAwaiter().GetResult()
        Write-Host $stderr.GetAwaiter().GetResult()
        if ($process.ExitCode -ne 0) { throw 'Service operation failed; keep resources and report for reconciliation.' }
    } finally { $process.Dispose() }
}
function Identity([string]$Name) {
    (New-Object Security.Principal.NTAccount('NT SERVICE', $Name)).Translate([Security.Principal.SecurityIdentifier]).Value
}
function Set-DirectoryRules([string]$Path, [string[]]$Modify, [string[]]$Read, [bool]$Admin = $true) {
    Assert-PlainPath $Path
    $acl = New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true, $false)
    $full = @('S-1-5-18')
    if ($Admin) { $full += 'S-1-5-32-544' }
    foreach ($sid in $full) {
        $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($sid)), 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
    }
    foreach ($sid in $Modify) {
        $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($sid)), 'Modify', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
    }
    foreach ($sid in $Read) {
        $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($sid)), 'ReadAndExecute', 'ContainerInherit,ObjectInherit', 'None', 'Allow')))
    }
    Set-Acl -LiteralPath $Path -AclObject $acl
}
function Check-Package([string]$Directory) {
    Assert-PlainPath $Directory
    $manifestPath = Join-Path $Directory 'package-manifest.json'
    Assert-PlainPath $manifestPath
    $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
    if ($manifest.checklistId -ne 'LIC-6.2-008' -or $manifest.scope -ne 'TEST_ONLY_SERVICE_HARNESS') { throw 'Wrong package identity.' }
    $seen = @{}
    foreach ($entry in $manifest.files) {
        # Published package is flat. No paths, ADS, aliases or traversal from a manifest.
        if ($entry.name -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*\.(dll|exe|json|pdb|txt|ps1|cmd)$' -or $seen.ContainsKey($entry.name)) { throw 'Invalid package entry.' }
        $seen[$entry.name] = $true
        $file = Join-Path $Directory $entry.name
        Assert-PlainPath $file
        if ((Get-Item -LiteralPath $file).Length -ne $entry.size -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.sha256) { throw 'Package hash mismatch.' }
    }
    foreach ($file in Get-ChildItem -LiteralPath $Directory -Force) {
        if ($file.Name -ne 'package-manifest.json' -and -not $seen.ContainsKey($file.Name)) { throw 'Unexpected package content. Extract into a fresh folder.' }
    }
    if (-not $seen.ContainsKey('Ecs.Lic008.Spike.exe') -or -not $seen.ContainsKey('Manage-Spike.ps1')) { throw 'Incomplete package.' }
    return $manifest
}
function Check-Installed {
    Assert-PlainPath $spikeRoot
    $marker = Get-Content -LiteralPath (Join-Path $spikeRoot 'installation.json') -Raw | ConvertFrom-Json
    if ($marker.scope -ne 'TEST_ONLY_SERVICE_HARNESS' -or $marker.root -ne $spikeRoot) { throw 'Unrecognized installation.' }
    $null = Check-Package (Join-Path $spikeRoot 'bin')
    for ($i = 0; $i -lt 2; $i++) {
        $name = $spikeNames[$i]
        $role = @('guardian','app')[$i]
        $service = Get-CimInstance Win32_Service -Filter "Name='$name'"
        $expected = '"' + $spikeExe + '" --service ' + $role
        if ($null -eq $service -or $service.PathName -cne $expected -or $service.StartName -ine ('NT SERVICE\' + $name) -or $service.StartMode -ne 'Manual') { throw 'Service configuration differs; refuse to operate.' }
        if ($service.State -ne 'Stopped') { throw 'Service still running; wait or inspect before retry.' }
    }
}
function Run-ServiceProbe([string]$Role, [string]$Run) {
    $name = if ($Role -eq 'guardian') { $spikeNames[0] } else { $spikeNames[1] }
    $file = Join-Path $spikeRoot ($Role + '-reports/' + $Run + '.json')
    if (Test-Path -LiteralPath $file) { throw 'Report collision.' }
    Invoke-SpikeSc @('start', $name)
    $watch = [Diagnostics.Stopwatch]::StartNew()
    do {
        Start-Sleep -Milliseconds 250
        $service = Get-Service -Name $name
        if ($service.Status -eq 'Stopped') { break }
    } while ($watch.Elapsed.TotalSeconds -lt 120)
    if ($service.Status -ne 'Stopped') {
        Invoke-SpikeSc @('stop', $name)
        throw 'Probe timed out; outcome unknown. Keep the test state for review.'
    }
    if (-not (Test-Path -LiteralPath $file)) { throw 'Service stopped without its report. No success is assumed.' }
    $report = Get-Content -LiteralPath $file -Raw | ConvertFrom-Json
    if ($report.runId -ne $Run -or $report.role -ne $Role -or $report.action -ne $planAction -or -not $report.serviceIdentityMatched) { throw 'Mismatched report.' }
    $report.results | Format-Table Id,Status,Error -AutoSize | Out-Host
    return $report
}

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run as administrator on the designated test laptop.' }
if (-not [Environment]::Is64BitProcess) { throw 'Use 64-bit Windows PowerShell.' }
$platform = Get-CimInstance Win32_OperatingSystem
$cpu = @(Get-CimInstance Win32_Processor)
if ($platform.ProductType -ne 1 -or ([version]$platform.Version).Major -ne 10 -or @($cpu | Where-Object Architecture -ne 9).Count -ne 0) { throw 'Windows 10/11 x64 required.' }
Assert-PlainPath $spikeRoot

if ($Action -eq 'Status') {
    Get-Service -Name $spikeNames -ErrorAction SilentlyContinue | Format-Table Name,Status
    Write-Output ('Test files and retained reports: ' + $spikeRoot)
    exit 0
}
if ($Action -eq 'InstallAndRun') {
    $manifest = Check-Package $PSScriptRoot
    if (Test-Path -LiteralPath $spikeRoot) { throw 'Test directory already exists. Use Recheck or Cleanup; never overwrite it.' }
    foreach ($name in $spikeNames) {
        if ($null -ne (Get-Service -Name $name -ErrorAction SilentlyContinue)) { throw 'Test service name collision.' }
    }
    $null = New-Item -ItemType Directory -Path $spikeRoot
    Set-DirectoryRules $spikeRoot @() @()
    # This marker survives partial setup; failure does not delete an unproven resource.
    @{ scope='TEST_ONLY_SERVICE_HARNESS'; root=$spikeRoot; installedUtc=[DateTime]::UtcNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $spikeRoot 'installation.json') -Encoding UTF8
    $bin = Join-Path $spikeRoot 'bin'
    $null = New-Item -ItemType Directory -Path $bin
    foreach ($entry in $manifest.files) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $entry.name) -Destination (Join-Path $bin $entry.name) }
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'package-manifest.json') -Destination (Join-Path $bin 'package-manifest.json')
    $null = Check-Package $bin
    for ($i = 0; $i -lt 2; $i++) {
        $role = @('guardian','app')[$i]
        Invoke-SpikeSc @('create', $spikeNames[$i], 'binPath=', ('"' + $spikeExe + '" --service ' + $role), 'start=', 'demand', 'type=', 'own', 'obj=', ('NT SERVICE\' + $spikeNames[$i]))
        Invoke-SpikeSc @('sidtype', $spikeNames[$i], 'unrestricted')
    }
    $guardianSid = Identity $spikeNames[0]
    $appSid = Identity $spikeNames[1]
    Set-DirectoryRules $spikeRoot @() @($guardianSid,$appSid)
    Set-DirectoryRules $bin @() @($guardianSid,$appSid)
    foreach ($directory in @('protected','shared','guardian-reports','app-reports')) { $null = New-Item -ItemType Directory -Path (Join-Path $spikeRoot $directory) }
    Set-DirectoryRules (Join-Path $spikeRoot 'protected') @($guardianSid) @() $false
    Set-DirectoryRules (Join-Path $spikeRoot 'shared') @($guardianSid) @($appSid)
    Set-DirectoryRules (Join-Path $spikeRoot 'guardian-reports') @($guardianSid) @()
    Set-DirectoryRules (Join-Path $spikeRoot 'app-reports') @($appSid) @()
}
Check-Installed
$runId = [Guid]::NewGuid().ToString('N')
$planAction = switch ($Action) { 'InstallAndRun' { 'create' } 'Recheck' { 'verify' } 'Cleanup' { 'cleanup' } }
@{ Action=$planAction; RunId=$runId } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $spikeRoot 'plan.json') -Encoding UTF8
$guardianReport = Run-ServiceProbe 'guardian' $runId
if ($Action -ne 'Cleanup') {
    $appReport = Run-ServiceProbe 'app' $runId
    $summary = @{ scope='PARTIAL_TEST_HARNESS_NOT_LIC008_CLOSURE'; runId=$runId; guardian=$guardianReport; app=$appReport }
} else {
    if (@($guardianReport.results).Count -ne 2 -or @($guardianReport.results | Where-Object Status -ne 'PASS').Count -gt 0) {
        Write-Host ('Cleanup report: ' + (Join-Path $spikeRoot ('guardian-reports/' + $runId + '.json')))
        throw 'Cleanup incomplete. Services and key ownership records retained for review.'
    }
    # Exact services only; no filesystem deletion, key enumeration or TPM reset.
    foreach ($name in $spikeNames) { Invoke-SpikeSc @('delete', $name) }
    $summary = @{ scope='TEST_KEY_AND_SERVICE_CLEANUP'; runId=$runId; guardian=$guardianReport; filesRetained=$true }
}
$reportPath = Join-Path $spikeRoot ('run-' + $runId + '.json')
$summary | ConvertTo-Json -Depth 12 | Set-Content -LiteralPath $reportPath -Encoding UTF8
Write-Host ('Send this report: ' + $reportPath)
Write-Host 'Individual PASS results do not close LIC008. Files are retained; no restart or TPM reset was performed.'
