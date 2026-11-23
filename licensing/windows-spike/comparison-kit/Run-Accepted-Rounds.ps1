# One-time narrow-decision continuation for the exact EV0107 retained state.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$spikeRoot='C:\ProgramData\Ecs.Lic008.ComparisonV1'
$spikeNames=@('Ecs.Lic008.ComparisonV1.Guardian','Ecs.Lic008.ComparisonV1.App')
$spikeSc=Join-Path $env:SystemRoot 'System32/sc.exe'
$oldBin=Join-Path $spikeRoot 'bin-0.5.0-acl-control'
$oldExe=Join-Path $oldBin 'Ecs.Lic008.ComparisonV1.exe'
$newBin=Join-Path $spikeRoot 'bin-0.6.0-accepted-rounds'
$spikeExe=Join-Path $newBin 'Ecs.Lic008.ComparisonV1.exe'
$retainedKey='Ecs.Lic008.ComparisonV1.TEST_ONLY.software.0d26c5c6d100431b88f6bbf5ecb31956'
$ev0107Report=Join-Path $spikeRoot 'acl-disambiguation-610290f45bcf46d4957638f7dc9dd9a0.json'
$expectedOldManifest='52C7B6E846C54C1AE2498997EC0016ED174FAE02033EBF55F5F97122F59D9DA3'
$expectedOldBinary='4052DF511DCF9C7FB3A914912BB44976E260BA3B41F0AEA867B5DCC30DAAB80E'
$expectedEv0107='166299E96E2036A3740A44D323EC7C4A608C4FAEF72C646EE3BC827902ECC50E'
$tokens=$null;$errors=$null
$manager=Join-Path $PSScriptRoot 'Manage-Spike.ps1'
$ast=[Management.Automation.Language.Parser]::ParseFile($manager,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Controller parse failed'}
foreach($name in @('Assert-PlainPath','ConvertTo-NativeArgument','Invoke-SpikeSc','Identity','Set-DirectoryRules','Check-Package','Run-ServiceProbe','Has-Result','Confirm-KeyRound','Confirm-ProtectionRound','Set-Plan')){
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
if(Test-Path -LiteralPath $newBin){throw 'Accepted-round continuation already started or destination collision'}
foreach($path in @($oldBin,$oldExe,(Join-Path $spikeRoot 'plan.json'),(Join-Path $spikeRoot 'shared/software-key.json'),$ev0107Report)){
    Assert-PlainPath $path
    if(-not(Test-Path -LiteralPath $path)){throw 'Required EV0107 state is absent'}
}
if(Test-Path -LiteralPath (Join-Path $spikeRoot 'shared/dpapi.bin')){throw 'Unexpected prior LOCAL=user artifact'}
if((Get-FileHash -LiteralPath (Join-Path $oldBin 'package-manifest.json')).Hash -ne $expectedOldManifest){throw 'Retained0.5.0 manifest mismatch'}
if((Get-FileHash -LiteralPath $oldExe).Hash -ne $expectedOldBinary){throw 'Retained0.5.0 executable mismatch'}
if((Get-FileHash -LiteralPath $ev0107Report).Hash -ne $expectedEv0107){throw 'EV0107 report mismatch'}
$oldManifest=Get-Content -LiteralPath (Join-Path $oldBin 'package-manifest.json') -Raw|ConvertFrom-Json
foreach($entry in $oldManifest.files){
    $path=Join-Path $oldBin $entry.name;Assert-PlainPath $path
    if((Get-Item -LiteralPath $path).Length -ne $entry.size -or (Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'Retained0.5.0 package changed'}
}
$public=Get-Content -LiteralPath (Join-Path $spikeRoot 'shared/software-key.json') -Raw|ConvertFrom-Json
if($public.Provider -cne 'software' -or $public.Name -cne $retainedKey -or $public.PublicHash -cnotmatch '^[0-9a-f]{64}$'){throw 'Retained key record mismatch'}
$prior=Get-Content -LiteralPath $ev0107Report -Raw|ConvertFrom-Json
if($prior.scope -cne 'TEST_ONLY_ACL_DISAMBIGUATION' -or $prior.version -cne '0.5.0' -or
   -not $prior.setupComplete -or -not $prior.contrastObserved -or -not $prior.cleanupConfirmed -or -not $prior.helperRemoved -or
   $prior.securityAccepted -or $prior.decisionChanged){throw 'EV0107 outcome mismatch'}
$plan=Get-Content -LiteralPath (Join-Path $spikeRoot 'plan.json') -Raw|ConvertFrom-Json
if($plan.Action -cne 'acl-cleanup' -or $plan.RunId -cne 'b62d428a92a44243ae44810e8b88682b' -or
   $plan.ExperimentId -cne 'c448747f67ec435fb27433d2a9608551' -or
   $plan.BinaryHash -cne $expectedOldBinary.ToLowerInvariant() -or $plan.KeyExperimentAccepted){throw 'Unexpected retained plan'}
for($i=0;$i -lt 2;$i++){
    $s=Get-CimInstance Win32_Service -Filter ("Name='"+$spikeNames[$i]+"'")
    $role=@('guardian','app')[$i]
    if($null -eq $s -or $s.State -ne 'Stopped' -or $s.StartMode -ne 'Manual' -or
       $s.StartName -cne ('NT SERVICE\'+$spikeNames[$i]) -or $s.PathName -cne ('"'+$oldExe+'" --service '+$role)){throw 'EV0107 service configuration mismatch'}
}

$reports=@();$rounds=@();$keyIsolationAccepted=$false;$protection='NOT_RUN'
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
           $s.StartMode -ne 'Manual' -or $s.StartName -cne ('NT SERVICE\'+$spikeNames[$i])){throw 'Accepted-round service configuration mismatch'}
    }
    foreach($round in @(1,2)){
        Set-Plan 'verify' $false '' $true
        $guardian=Run-ServiceProbe 'guardian' $runId;$reports+=,$guardian
        $app=Run-ServiceProbe 'app' $runId;$reports+=,$app
        $passed=Confirm-KeyRound $guardian $app;$rounds+=,$passed
        if(-not $passed){throw ('Narrow key-isolation round '+$round+' failed; LOCAL=user remains NOT_RUN')}
    }
    $keyIsolationAccepted=$rounds.Count -eq 2 -and $rounds[0] -and $rounds[1]
    if(-not $keyIsolationAccepted){throw 'Two accepted rounds required'}
    $protection='FAILED_OR_INCOMPLETE'
    foreach($phase in @('protect','verify-protect')){
        Set-Plan $phase $true '' $true
        $guardian=Run-ServiceProbe 'guardian' $runId;$reports+=,$guardian
        $app=Run-ServiceProbe 'app' $runId;$reports+=,$app
        if(-not(Confirm-ProtectionRound $guardian $app $phase)){throw 'LOCAL=user comparison failed; retain evidence'}
    }
    $protection='PASS_BOUNDED_PROCESS_RESTART_ONLY'
} finally {
    $serviceSnapshot=@($spikeNames|ForEach-Object{
        $s=Get-CimInstance Win32_Service -Filter ("Name='"+$_+"'")
        if($null -eq $s){[ordered]@{name=$_;state='ABSENT'}}else{[ordered]@{name=$s.Name;state=$s.State;startMode=$s.StartMode;startName=$s.StartName;pathName=$s.PathName}}
    })
    $manifestPath=Join-Path $newBin 'package-manifest.json'
    $manifestHash=if(Test-Path -LiteralPath $manifestPath){(Get-FileHash -LiteralPath $manifestPath).Hash}else{$null}
    $summary=@{scope='TEST_ONLY_NARROW_ACCEPTED_ROUNDS';version='0.6.0';decision='LIC-CHG-0052';
        keyIsolationAccepted=$keyIsolationAccepted;rounds=$rounds;protectionExperiment=$protection;
        productionAccepted=$false;reports=$reports;services=$serviceSnapshot;
        timeUtc=[datetime]::UtcNow.ToString('o');manifestSha256=$manifestHash;
        notTested=@('REBOOT','ORDINARY_USER','SECOND_LAPTOP','TPM','REPAIR_REINSTALL','POWER_LOSS','PRODUCTION_ACCEPTANCE')}
    $reportPath=Join-Path $spikeRoot ('accepted-rounds-'+[guid]::NewGuid().ToString('N')+'.json')
    $summary|ConvertTo-Json -Depth 14|Set-Content -LiteralPath $reportPath -Encoding UTF8
    Write-Host ('Report: '+$reportPath)
}
