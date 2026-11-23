# LIC-6.2-008 development harness, not the product Installer or Guardian.
[CmdletBinding()]
param([switch]$ContinueProtection)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$spikeRoot = Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'Ecs.Lic008.ComparisonV1'
$spikeNames = @('Ecs.Lic008.ComparisonV1.Guardian','Ecs.Lic008.ComparisonV1.App','Ecs.Lic008.ComparisonV1.Setup')
$spikeSc = Join-Path $env:SystemRoot 'System32/sc.exe'
$spikeExe = Join-Path $spikeRoot 'bin/Ecs.Lic008.ComparisonV1.exe'

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
function Assert-FreshTarget {
    Assert-PlainPath $spikeRoot
    if (Test-Path -LiteralPath $spikeRoot) { throw 'Test directory already exists; never overwrite it.' }
    foreach ($name in $spikeNames) {
        if ($null -ne (Get-Service -Name $name -ErrorAction SilentlyContinue)) { throw 'Test service name collision.' }
    }
}
function Confirm-Cleanup($Report) {
    return @($Report.results).Count -eq 1 -and $Report.results[0].Id -ceq 'guardian.software.cleanup' -and $Report.results[0].Status -ceq 'DELETED_AND_CONFIRMED'
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
    if ($manifest.checklistId -ne 'LIC-6.2-008' -or $manifest.scope -ne 'TEST_ONLY_COMPARISON_V1' -or $manifest.version -ne '0.7.0') { throw 'Wrong package identity.' }
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
    if (-not $seen.ContainsKey('Ecs.Lic008.ComparisonV1.exe') -or -not $seen.ContainsKey('Manage-Spike.ps1') -or -not $seen.ContainsKey('Run-Protection-Diagnostic.ps1')) { throw 'Incomplete package.' }
    return $manifest
}
function Check-Installed {
    Assert-PlainPath $spikeRoot
    $marker = Get-Content -LiteralPath (Join-Path $spikeRoot 'installation.json') -Raw | ConvertFrom-Json
    if ($marker.scope -ne 'TEST_ONLY_COMPARISON_V1' -or $marker.root -ne $spikeRoot) { throw 'Unrecognized installation.' }
    $null = Check-Package (Join-Path $spikeRoot 'bin')
    for ($i = 0; $i -lt 3; $i++) {
        $name = $spikeNames[$i]
        $role = @('guardian','app','setup')[$i]
        $service = Get-CimInstance Win32_Service -Filter "Name='$name'"
        $expected = '"' + $spikeExe + '" --service ' + $role
        if ($null -eq $service -or $service.PathName -cne $expected -or $service.StartName -ine $(if($i -eq 2){'LocalSystem'}else{'NT SERVICE\' + $name}) -or $service.StartMode -ne 'Manual') { throw 'Service configuration differs; refuse to operate.' }
        if ($service.State -ne 'Stopped') { throw 'Service still running; wait or inspect before retry.' }
    }
}
function Run-ServiceProbe([string]$Role, [string]$Run) {
    $name = if ($Role -eq 'guardian') { $spikeNames[0] } elseif($Role -eq 'setup') {$spikeNames[2]} else { $spikeNames[1] }
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
    if ($report.schemaVersion -ne 2 -or $report.scope -ne 'TEST_ONLY_COMPARISON_V1' -or $report.runId -ne $Run -or $report.role -ne $Role -or
        $report.action -ne $planAction -or [bool]$report.aclBehaviorAccepted -ne $planAclBehaviorAccepted -or -not $report.serviceIdentityMatched) { throw 'Mismatched report.' }
    if ($report.binarySha256 -ne (Get-FileHash -LiteralPath $spikeExe).Hash.ToLowerInvariant()) { throw 'Report binary mismatch.' }
    $report.results | Format-Table Id,Status,Stage,Error -AutoSize | Out-Host
    return $report
}

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'Run as administrator on the designated test laptop.' }
if (-not [Environment]::Is64BitProcess) { throw 'Use 64-bit Windows PowerShell.' }
$platform = Get-CimInstance Win32_OperatingSystem
$cpu = @(Get-CimInstance Win32_Processor)
if ($platform.ProductType -ne 1 -or ([version]$platform.Version).Major -ne 10 -or @($cpu | Where-Object Architecture -ne 9).Count -ne 0) { throw 'Windows 10/11 x64 required.' }
Assert-PlainPath $spikeRoot

    $manifest = Check-Package $PSScriptRoot
    Assert-FreshTarget
    $null = New-Item -ItemType Directory -Path $spikeRoot
    Set-DirectoryRules $spikeRoot @() @()
    # This marker survives partial setup; failure does not delete an unproven resource.
    @{ scope='TEST_ONLY_COMPARISON_V1'; root=$spikeRoot; installedUtc=[DateTime]::UtcNow.ToString('o') } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $spikeRoot 'installation.json') -Encoding UTF8
    $bin = Join-Path $spikeRoot 'bin'
    $null = New-Item -ItemType Directory -Path $bin
    foreach ($entry in $manifest.files) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $entry.name) -Destination (Join-Path $bin $entry.name) }
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'package-manifest.json') -Destination (Join-Path $bin 'package-manifest.json')
    $null = Check-Package $bin
    for ($i = 0; $i -lt 3; $i++) {
        $role = @('guardian','app','setup')[$i]
        Invoke-SpikeSc @('create', $spikeNames[$i], 'binPath=', ('"' + $spikeExe + '" --service ' + $role), 'start=', 'demand', 'type=', 'own', 'obj=', $(if($i -eq 2){'LocalSystem'}else{'NT SERVICE\' + $spikeNames[$i]}))
        Invoke-SpikeSc @('sidtype', $spikeNames[$i], 'unrestricted')
    }
    $guardianSid = Identity $spikeNames[0]
    $appSid = Identity $spikeNames[1]
    Set-DirectoryRules $spikeRoot @() @($guardianSid,$appSid)
    Set-DirectoryRules $bin @() @($guardianSid,$appSid)
    foreach ($directory in @('protected','shared','guardian-reports','app-reports','setup-reports')) { $null = New-Item -ItemType Directory -Path (Join-Path $spikeRoot $directory) }
    Set-DirectoryRules (Join-Path $spikeRoot 'protected') @($guardianSid) @() $false
    Set-DirectoryRules (Join-Path $spikeRoot 'shared') @($guardianSid) @($appSid)
    Set-DirectoryRules (Join-Path $spikeRoot 'guardian-reports') @($guardianSid) @()
    Set-DirectoryRules (Join-Path $spikeRoot 'app-reports') @($appSid) @()
    Set-DirectoryRules (Join-Path $spikeRoot 'setup-reports') @() @()
Check-Installed

function Has-Result($Report,[string]$Id,[string]$Status) {
    $matches = @($Report.results | Where-Object { $_.Id -ceq $Id })
    return $matches.Count -eq 1 -and $matches[0].Status -ceq $Status
}
function Confirm-KeyRound($Guardian,$App) {
    foreach($id in @('guardian.software.reopen-sign-policy-acl','guardian.software.private-export-denied','guardian.protected-file-reopen')) {
        if(-not (Has-Result $Guardian $id 'PASS')) {return $false}
    }
    foreach($actor in @('app','child')) {
        $keyMatches=@($App.results|Where-Object{$_.Id -ceq ($actor+'.software.key-denied')})
        if($keyMatches.Count -ne 1 -or $keyMatches[0].Status -notin @('PASS_ACCESS_DENIED','PASS_KEY_NOT_DISCLOSED')) {return $false}
        foreach($suffix in @('protected-read-denied','protected-write-denied')) {
            if(-not (Has-Result $App ($actor+'.'+$suffix) 'PASS_ACCESS_DENIED')) {return $false}
        }
    }
    return (Has-Result $App 'app.child-probe-execution' 'PASS') -and (Has-Result $App 'child.token-identity' 'PASS')
}
function Confirm-ProtectionRound($Guardian,$App,[string]$Action) {
    $id=if($Action -eq 'protect'){'guardian.dpapi-ng-create'}else{'guardian.dpapi-ng-reopen'}
    return (Has-Result $Guardian $id 'PASS') -and
        (Has-Result $App 'app.dpapi-ng-denied' 'PASS_ACCESS_DENIED') -and
        (Has-Result $App 'child.dpapi-ng-denied' 'PASS_ACCESS_DENIED') -and
        (Has-Result $App 'app.child-probe-execution' 'PASS') -and
        (Has-Result $App 'child.token-identity' 'PASS')
}
function Confirm-DiagnosticCollection($Guardian,$App) {
    foreach($id in @('guardian.software.retained-records','guardian.software.reopen-sign-policy-acl','guardian.software.private-export-denied',
        'guardian.software.load-public-record',
        'guardian.software.native-open-provider','guardian.software.native-algorithm-support','guardian.software.native-open-key')) {
        if(-not (Has-Result $Guardian $id 'PASS')) {return $false}
    }
    foreach($actor in @('app','child')) {
        if(-not (Has-Result $App ($actor+'.software.load-public-record') 'PASS')) {return $false}
        foreach($suffix in @('software.native-open-provider','software.native-algorithm-support','software.native-open-key')) {
            $matches=@($App.results | Where-Object {$_.Id -ceq ($actor+'.'+$suffix)})
            if($matches.Count -ne 1 -or $matches[0].Status -notin @('PASS','INCONCLUSIVE','FAIL_ACCESS_GRANTED','NOT_TESTED_PREREQUISITE')) {return $false}
        }
    }
    return (Has-Result $App 'app.child-probe-execution' 'PASS') -and (Has-Result $App 'child.token-identity' 'PASS')
}
function Confirm-ProtectionDiagnostic($Guardian) {
    foreach($id in @('current-user','account','authentication-type','impersonation-level','environment-user-profile',
        'special-folder-user-profile','hku-service-sid-loaded','profile-directory','profile-type')) {
        $matches=@($Guardian.results | Where-Object {$_.Id -ceq ('guardian.dpapi-environment.'+$id)})
        if($matches.Count -ne 1 -or $matches[0].Status -notin @('OBSERVED','ABSENT','UNAVAILABLE')) {return $false}
    }
    foreach($id in @('local-user','guardian-sid')) {
        $matches=@($Guardian.results | Where-Object {$_.Id -ceq ('guardian.dpapi-diagnostic.'+$id)})
        if($matches.Count -ne 1 -or $matches[0].Status -notin @('PASS_MEMORY_ROUNDTRIP','FAILED_OR_UNAVAILABLE')) {return $false}
    }
    return $true
}
function Confirm-AclSetup($Setup) {
    foreach($id in @('setup.acl.restricted.create-p256','setup.acl.app-readable.create-p256','setup.acl.publish-controls')) {
        if(-not (Has-Result $Setup $id 'PASS')) {return $false}
    }
    return $true
}
function Confirm-AclProbe($Guardian,$App) {
    if(-not (Has-Result $Guardian 'guardian.acl.load-control-record' 'PASS')) {return $false}
    foreach($label in @('restricted','app-readable')) {
        foreach($suffix in @('open-provider','algorithm-support','open-key')) {
            if(-not (Has-Result $Guardian ('guardian.acl.'+$label+'.'+$suffix) 'PASS')) {return $false}
        }
    }
    foreach($actor in @('app','child')) {
        if(-not (Has-Result $App ($actor+'.acl.load-control-record') 'PASS')) {return $false}
        foreach($label in @('restricted','app-readable')) {
            foreach($suffix in @('open-provider','algorithm-support')) {
                if(-not (Has-Result $App ($actor+'.acl.'+$label+'.'+$suffix) 'PASS')) {return $false}
            }
        }
        if(-not (Has-Result $App ($actor+'.acl.restricted.open-key') 'OBSERVED_BAD_KEYSET')) {return $false}
        if(-not (Has-Result $App ($actor+'.acl.app-readable.open-key') 'PASS')) {return $false}
    }
    return (Has-Result $App 'app.child-probe-execution' 'PASS') -and (Has-Result $App 'child.token-identity' 'PASS')
}
function Confirm-AclCleanup($Guardian) {
    return (Has-Result $Guardian 'guardian.acl.restricted.cleanup' 'DELETED_AND_CONFIRMED') -and
        (Has-Result $Guardian 'guardian.acl.app-readable.cleanup' 'DELETED_AND_CONFIRMED')
}
function Set-Plan([string]$Phase,[bool]$Accepted=$false,[string]$ExperimentId='',[bool]$AclBehaviorAccepted=$false) {
    $script:planAction=$Phase
    $script:planAclBehaviorAccepted=$AclBehaviorAccepted
    $script:runId=[Guid]::NewGuid().ToString('N')
    @{Action=$Phase;RunId=$script:runId;BinaryHash=(Get-FileHash -LiteralPath $spikeExe).Hash.ToLowerInvariant();KeyExperimentAccepted=$Accepted;ExperimentId=$ExperimentId;AclBehaviorAccepted=$AclBehaviorAccepted} |
        ConvertTo-Json | Set-Content -LiteralPath (Join-Path $spikeRoot 'plan.json') -Encoding UTF8
}
$allReports = @()
$phaseOne = $false
$phaseTwo = 'NOT_RUN'
try {
    Set-Plan 'create'
    try {
        $setup = Run-ServiceProbe 'setup' $runId
        $allReports += $setup
    } finally {
        # Only this new exact helper is removed, and only after it has stopped.
        $helper=Get-CimInstance Win32_Service -Filter "Name='Ecs.Lic008.ComparisonV1.Setup'"
        if($helper.State -ne 'Stopped' -or $helper.StartName -ne 'LocalSystem' -or $helper.PathName -cne ('"'+$spikeExe+'" --service setup')) {
            throw 'Helper outcome/configuration unknown. Keep resources; do not continue.'
        }
        Invoke-SpikeSc @('delete',$spikeNames[2])
        if($null -ne (Get-Service -Name $spikeNames[2] -ErrorAction SilentlyContinue)) {throw 'Helper removal not confirmed'}
    }
    if(-not (Has-Result $setup 'setup.software.create-p256' 'PASS')) {throw 'Setup key creation or policy validation failed; experiment2 remains NOT_RUN'}
    $roundPass=@()
    foreach($round in @(1,2)) {
        Set-Plan 'verify'
        $guardian=Run-ServiceProbe 'guardian' $runId
        $app=Run-ServiceProbe 'app' $runId
        $allReports+=@($guardian,$app)
        $roundPass+= (Confirm-KeyRound $guardian $app)
        if(-not $roundPass[-1]) {throw 'Guardian/App key experiment failed; experiment2 remains NOT_RUN'}
    }
    $phaseOne=($roundPass.Count -eq 2 -and $roundPass[0] -and $roundPass[1])
    if($ContinueProtection -and $phaseOne) {
        $phaseTwo='FAILED_OR_INCOMPLETE'
        foreach($phase in @('protect','verify-protect')) {
            Set-Plan $phase $true
            $guardian=Run-ServiceProbe 'guardian' $runId
            $app=Run-ServiceProbe 'app' $runId
            $allReports+=@($guardian,$app)
            if(-not (Confirm-ProtectionRound $guardian $app $phase)) {throw 'Protection comparison failed; retain evidence'}
        }
        $phaseTwo='PASS_BOUNDED_PROCESS_RESTART_ONLY'
    }
} finally {
    $summary=@{scope='TEST_ONLY_COMPARISON_V1';keyExperimentPassed=$phaseOne;protectionExperiment=$phaseTwo;
        timeUtc=[datetime]::UtcNow.ToString('o');reports=$allReports;
        notTested=@('REBOOT','REPAIR_REINSTALL','ORDINARY_USER','TPM','PRODUCTION_ACCEPTANCE');
        manifestSha256=(Get-FileHash -LiteralPath (Join-Path $spikeRoot 'bin/package-manifest.json')).Hash}
    $reportPath=Join-Path $spikeRoot ('comparison-'+[guid]::NewGuid().ToString('N')+'.json')
    $summary | ConvertTo-Json -Depth 14 | Set-Content -LiteralPath $reportPath -Encoding UTF8
    Write-Host ('Report: '+$reportPath)
}
