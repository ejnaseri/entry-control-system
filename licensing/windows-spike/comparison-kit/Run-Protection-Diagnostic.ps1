# One-time DPAPI-NG virtual-service diagnostic for the exact EV0109 retained state.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$spikeRoot='C:\ProgramData\Ecs.Lic008.ComparisonV1'
$spikeNames=@('Ecs.Lic008.ComparisonV1.Guardian','Ecs.Lic008.ComparisonV1.App')
$spikeSc=Join-Path $env:SystemRoot 'System32/sc.exe'
$oldBin=Join-Path $spikeRoot 'bin-0.6.0-accepted-rounds'
$oldExe=Join-Path $oldBin 'Ecs.Lic008.ComparisonV1.exe'
$newBin=Join-Path $spikeRoot 'bin-0.7.0-protection-diagnostic'
$spikeExe=Join-Path $newBin 'Ecs.Lic008.ComparisonV1.exe'
$ev0109Report=Join-Path $spikeRoot 'accepted-rounds-4ad8c06e51c74405b726ede8c305844c.json'
$expectedOldManifest='80458C612FAA2F9DD2C9A4827B84FA95B6AEE2AF231D7C1C12760FC813E2E86D'
$expectedOldBinary='4052DF511DCF9C7FB3A914912BB44976E260BA3B41F0AEA867B5DCC30DAAB80E'
$expectedEv0109='E5CD53E948AE094A441C2245056A15E8C5F7889AA3C07653789361D5C007C002'
$tokens=$null;$errors=$null
$manager=Join-Path $PSScriptRoot 'Manage-Spike.ps1'
$ast=[Management.Automation.Language.Parser]::ParseFile($manager,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Controller parse failed'}
foreach($name in @('Assert-PlainPath','ConvertTo-NativeArgument','Invoke-SpikeSc','Identity','Set-DirectoryRules','Check-Package','Run-ServiceProbe','Confirm-ProtectionDiagnostic','Set-Plan')){
    $f=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true)
    if($null -eq $f){throw ('Missing controller function: '+$name)}
    Invoke-Expression $f.Extent.Text
}
if(-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Elevated operator required'}
if(-not [Environment]::Is64BitProcess){throw 'Use 64-bit Windows PowerShell'}
$platform=Get-CimInstance Win32_OperatingSystem
$cpu=@(Get-CimInstance Win32_Processor)
if($platform.ProductType -ne 1 -or ([version]$platform.Version).Major -ne 10 -or @($cpu|Where-Object Architecture -ne 9).Count -ne 0){throw 'Windows 10/11 x64 required'}
Assert-PlainPath $spikeRoot
$null=Check-Package $PSScriptRoot
foreach($name in @('Ecs.Lic008.ComparisonV1.Setup','Ecs.Lic008.ComparisonV1.Metadata')){
    if(Get-Service -Name $name -ErrorAction SilentlyContinue){throw 'Temporary helper still present'}
}
if(Test-Path -LiteralPath $newBin){throw 'Protection diagnostic already started or destination collision'}
foreach($path in @($oldBin,$oldExe,(Join-Path $spikeRoot 'plan.json'),$ev0109Report)){
    Assert-PlainPath $path
    if(-not(Test-Path -LiteralPath $path)){throw 'Required EV0109 state is absent'}
}
if(Test-Path -LiteralPath (Join-Path $spikeRoot 'shared/dpapi.bin')){throw 'Unexpected persisted protection artifact'}
if((Get-FileHash -LiteralPath (Join-Path $oldBin 'package-manifest.json')).Hash -ne $expectedOldManifest){throw 'Retained0.6.0 manifest mismatch'}
if((Get-FileHash -LiteralPath $oldExe).Hash -ne $expectedOldBinary){throw 'Retained0.6.0 executable mismatch'}
if((Get-FileHash -LiteralPath $ev0109Report).Hash -ne $expectedEv0109){throw 'EV0109 report mismatch'}
$oldManifest=Get-Content -LiteralPath (Join-Path $oldBin 'package-manifest.json') -Raw|ConvertFrom-Json
foreach($entry in $oldManifest.files){
    $path=Join-Path $oldBin $entry.name;Assert-PlainPath $path
    if((Get-Item -LiteralPath $path).Length -ne $entry.size -or (Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'Retained0.6.0 package changed'}
}
$prior=Get-Content -LiteralPath $ev0109Report -Raw|ConvertFrom-Json
if($prior.scope -cne 'TEST_ONLY_NARROW_ACCEPTED_ROUNDS' -or $prior.version -cne '0.6.0' -or
   -not $prior.keyIsolationAccepted -or @($prior.rounds).Count -ne 2 -or -not $prior.rounds[0] -or -not $prior.rounds[1] -or
   $prior.protectionExperiment -cne 'FAILED_OR_INCOMPLETE' -or $prior.productionAccepted){throw 'EV0109 outcome mismatch'}
$plan=Get-Content -LiteralPath (Join-Path $spikeRoot 'plan.json') -Raw|ConvertFrom-Json
if($plan.Action -cne 'protect' -or $plan.RunId -cne 'c6bd4350422e40c1b237efd5e138eb97' -or
   $plan.BinaryHash -cne $expectedOldBinary.ToLowerInvariant() -or -not $plan.KeyExperimentAccepted -or -not $plan.AclBehaviorAccepted){throw 'Unexpected retained plan'}
for($i=0;$i -lt 2;$i++){
    $s=Get-CimInstance Win32_Service -Filter ("Name='"+$spikeNames[$i]+"'")
    $role=@('guardian','app')[$i]
    if($null -eq $s -or $s.State -ne 'Stopped' -or $s.StartMode -ne 'Manual' -or
       $s.StartName -cne ('NT SERVICE\'+$spikeNames[$i]) -or $s.PathName -cne ('"'+$oldExe+'" --service '+$role)){throw 'EV0109 service configuration mismatch'}
}

$reports=@();$collected=$false
try {
    $null=New-Item -ItemType Directory -Path $newBin
    Set-DirectoryRules $newBin @() @((Identity $spikeNames[0]),(Identity $spikeNames[1]))
    foreach($file in Get-ChildItem -LiteralPath $PSScriptRoot -File){Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $newBin $file.Name)}
    $null=Check-Package $newBin
    for($i=0;$i -lt 2;$i++){
        $role=@('guardian','app')[$i]
        Invoke-SpikeSc @('config',$spikeNames[$i],'binPath=',('"'+$spikeExe+'" --service '+$role))
        $s=Get-CimInstance Win32_Service -Filter ("Name='"+$spikeNames[$i]+"'")
        if($s.PathName -cne ('"'+$spikeExe+'" --service '+$role) -or $s.State -ne 'Stopped' -or
           $s.StartMode -ne 'Manual' -or $s.StartName -cne ('NT SERVICE\'+$spikeNames[$i])){throw 'Protection-diagnostic service configuration mismatch'}
    }
    Set-Plan 'diagnose-protection'
    $guardian=Run-ServiceProbe 'guardian' $runId;$reports+=,$guardian
    $collected=Confirm-ProtectionDiagnostic $guardian
    if(-not $collected){throw 'Protection diagnostic report incomplete; no conclusion inferred'}
} finally {
    $serviceSnapshot=@($spikeNames|ForEach-Object{
        $s=Get-CimInstance Win32_Service -Filter ("Name='"+$_+"'")
        if($null -eq $s){[ordered]@{name=$_;state='ABSENT'}}else{[ordered]@{name=$s.Name;state=$s.State;startMode=$s.StartMode;startName=$s.StartName;pathName=$s.PathName}}
    })
    $manifestPath=Join-Path $newBin 'package-manifest.json'
    $manifestHash=if(Test-Path -LiteralPath $manifestPath){(Get-FileHash -LiteralPath $manifestPath).Hash}else{$null}
    $summary=@{scope='TEST_ONLY_DPAPI_NG_VIRTUAL_SERVICE_DIAGNOSTIC';version='0.7.0';sourceEvidence='LIC-EV-0109';
        diagnosticCollected=$collected;securityAccepted=$false;policyChanged=$false;productionAccepted=$false;
        reports=$reports;services=$serviceSnapshot;timeUtc=[datetime]::UtcNow.ToString('o');manifestSha256=$manifestHash;
        notTested=@('LOCAL_MACHINE_FALLBACK','SERVICE_IDENTITY_CHANGE','PROFILE_CHANGE','REBOOT','ORDINARY_USER','TPM','REPAIR_REINSTALL','PRODUCTION_ACCEPTANCE')}
    $reportPath=Join-Path $spikeRoot ('protection-diagnostic-'+[guid]::NewGuid().ToString('N')+'.json')
    $summary|ConvertTo-Json -Depth 14|Set-Content -LiteralPath $reportPath -Encoding UTF8
    Write-Host ('Report: '+$reportPath)
}
