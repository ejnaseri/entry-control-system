# One-time A/B ACL control for the exact EV0105 retained state.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$spikeRoot='C:\ProgramData\Ecs.Lic008.ComparisonV1'
$spikeNames=@('Ecs.Lic008.ComparisonV1.Guardian','Ecs.Lic008.ComparisonV1.App','Ecs.Lic008.ComparisonV1.Setup')
$spikeSc=Join-Path $env:SystemRoot 'System32/sc.exe'
$oldBin=Join-Path $spikeRoot 'bin-0.4.3-diagnostic'
$oldExe=Join-Path $oldBin 'Ecs.Lic008.ComparisonV1.exe'
$newBin=Join-Path $spikeRoot 'bin-0.5.0-acl-control'
$spikeExe=Join-Path $newBin 'Ecs.Lic008.ComparisonV1.exe'
$retainedKey='Ecs.Lic008.ComparisonV1.TEST_ONLY.software.0d26c5c6d100431b88f6bbf5ecb31956'
$ev0105Report=Join-Path $spikeRoot 'key-open-diagnostic-b2d7ddfbd7a24fa384cfa16093cb9dac.json'
$expectedOldManifest='19D264521D0A6AE01F5DF07F6CCFB05B488F5B44606B374BCE17707D17A61FCC'
$expectedOldBinary='5290ED64577CC3C93E7F0B5E14F410384E876D647A4DFF7A8638A3743467B53C'
$expectedEv0105='DBDC3B6CC266A48340BE66A7B99D7815BE03662D80A2E19669C467646CC7C433'
$tokens=$null;$errors=$null
$manager=Join-Path $PSScriptRoot 'Manage-Spike.ps1'
$ast=[Management.Automation.Language.Parser]::ParseFile($manager,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Controller parse failed'}
foreach($name in @('Assert-PlainPath','ConvertTo-NativeArgument','Invoke-SpikeSc','Identity','Set-DirectoryRules','Check-Package','Run-ServiceProbe','Has-Result','Confirm-AclSetup','Confirm-AclProbe','Confirm-AclCleanup','Set-Plan')){
    $f=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true)
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

foreach($name in @($spikeNames[2],'Ecs.Lic008.ComparisonV1.Metadata')){
    if(Get-Service -Name $name -ErrorAction SilentlyContinue){throw 'Temporary helper still present'}
}
if(Test-Path -LiteralPath $newBin){throw 'ACL-control continuation already started or destination collision'}
foreach($path in @($oldBin,$oldExe,(Join-Path $spikeRoot 'plan.json'),(Join-Path $spikeRoot 'shared/software-key.json'),$ev0105Report)){
    Assert-PlainPath $path
    if(-not (Test-Path -LiteralPath $path)){throw 'Required EV0105 state is absent'}
}
if((Get-FileHash -LiteralPath (Join-Path $oldBin 'package-manifest.json')).Hash -ne $expectedOldManifest){throw 'Retained0.4.3 manifest mismatch'}
if((Get-FileHash -LiteralPath $oldExe).Hash -ne $expectedOldBinary){throw 'Retained0.4.3 executable mismatch'}
if((Get-FileHash -LiteralPath $ev0105Report).Hash -ne $expectedEv0105){throw 'EV0105 report mismatch'}
$oldManifest=Get-Content -LiteralPath (Join-Path $oldBin 'package-manifest.json') -Raw|ConvertFrom-Json
foreach($entry in $oldManifest.files){
    $path=Join-Path $oldBin $entry.name;Assert-PlainPath $path
    if((Get-Item -LiteralPath $path).Length -ne $entry.size -or (Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'Retained0.4.3 package changed'}
}
$public=Get-Content -LiteralPath (Join-Path $spikeRoot 'shared/software-key.json') -Raw|ConvertFrom-Json
if($public.Provider -cne 'software' -or $public.Name -cne $retainedKey -or $public.PublicHash -cnotmatch '^[0-9a-f]{64}$'){throw 'Retained key record mismatch'}
$prior=Get-Content -LiteralPath $ev0105Report -Raw|ConvertFrom-Json
if($prior.scope -cne 'TEST_ONLY_RETAINED_KEY_OPEN_DIAGNOSTIC' -or $prior.version -cne '0.4.3' -or
   -not $prior.diagnosticCollected -or $prior.securityAccepted -or $prior.acceptanceChanged){throw 'EV0105 outcome mismatch'}
$plan=Get-Content -LiteralPath (Join-Path $spikeRoot 'plan.json') -Raw|ConvertFrom-Json
if($plan.Action -cne 'diagnose-open' -or $plan.RunId -cne 'c2ed6691980c4792b5e743991ab8a172' -or
   $plan.BinaryHash -cne $expectedOldBinary.ToLowerInvariant() -or $plan.KeyExperimentAccepted){throw 'Unexpected retained plan'}
for($i=0;$i -lt 2;$i++){
    $s=Get-CimInstance Win32_Service -Filter ("Name='"+$spikeNames[$i]+"'")
    $role=@('guardian','app')[$i]
    if($null -eq $s -or $s.State -ne 'Stopped' -or $s.StartMode -ne 'Manual' -or
       $s.StartName -cne ('NT SERVICE\'+$spikeNames[$i]) -or $s.PathName -cne ('"'+$oldExe+'" --service '+$role)){throw 'EV0105 service configuration mismatch'}
}

$experimentId=[Guid]::NewGuid().ToString('N')
$reports=@();$setupComplete=$false;$contrastObserved=$false;$cleanupConfirmed=$false;$helperRemoved=$false
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
           $s.StartMode -ne 'Manual' -or $s.StartName -cne ('NT SERVICE\'+$spikeNames[$i])){throw 'ACL-control service configuration mismatch'}
    }
    Invoke-SpikeSc @('create',$spikeNames[2],'binPath=',('"'+$spikeExe+'" --service setup'),'start=','demand','type=','own','obj=','LocalSystem')
    try {
        Invoke-SpikeSc @('sidtype',$spikeNames[2],'unrestricted')
        Set-Plan 'acl-create' $false $experimentId
        $setup=Run-ServiceProbe 'setup' $runId;$reports+=,$setup
        $setupComplete=Confirm-AclSetup $setup
    } finally {
        $helper=Get-CimInstance Win32_Service -Filter ("Name='"+$spikeNames[2]+"'")
        if($null -eq $helper -or $helper.State -ne 'Stopped' -or $helper.StartName -ne 'LocalSystem' -or
           $helper.PathName -cne ('"'+$spikeExe+'" --service setup')){throw 'Helper outcome/configuration unknown; retain state'}
        Invoke-SpikeSc @('delete',$spikeNames[2])
        if($null -ne (Get-Service -Name $spikeNames[2] -ErrorAction SilentlyContinue)){throw 'Helper removal not confirmed'}
        $helperRemoved=$true
    }
    if(-not $setupComplete){throw 'ACL-control key creation incomplete; retain for reconciliation'}
    Set-Plan 'acl-probe' $false $experimentId
    $guardian=Run-ServiceProbe 'guardian' $runId;$reports+=,$guardian
    $app=Run-ServiceProbe 'app' $runId;$reports+=,$app
    $contrastObserved=Confirm-AclProbe $guardian $app
    if(-not $contrastObserved){throw 'ACL contrast incomplete; retain fresh keys for reconciliation'}
    Set-Plan 'acl-cleanup' $false $experimentId
    $cleanup=Run-ServiceProbe 'guardian' $runId;$reports+=,$cleanup
    $cleanupConfirmed=Confirm-AclCleanup $cleanup
    if(-not $cleanupConfirmed){throw 'Fresh-key cleanup incomplete; retain evidence for reconciliation'}
} finally {
    $serviceSnapshot=@($spikeNames|ForEach-Object{
        $s=Get-CimInstance Win32_Service -Filter ("Name='"+$_+"'")
        if($null -eq $s){[ordered]@{name=$_;state='ABSENT'}}else{[ordered]@{name=$s.Name;state=$s.State;startMode=$s.StartMode;startName=$s.StartName;pathName=$s.PathName}}
    })
    $manifestPath=Join-Path $newBin 'package-manifest.json'
    $manifestHash=if(Test-Path -LiteralPath $manifestPath){(Get-FileHash -LiteralPath $manifestPath).Hash}else{$null}
    $summary=@{scope='TEST_ONLY_ACL_DISAMBIGUATION';version='0.5.0';experimentId=$experimentId;retainedKey=$retainedKey;
        setupComplete=$setupComplete;contrastObserved=$contrastObserved;cleanupConfirmed=$cleanupConfirmed;helperRemoved=$helperRemoved;
        securityAccepted=$false;decisionChanged=$false;reports=$reports;services=$serviceSnapshot;
        timeUtc=[datetime]::UtcNow.ToString('o');manifestSha256=$manifestHash;
        notTested=@('SECOND_ACCEPTANCE_ROUND','LOCAL_USER_PROTECTION','REBOOT','ORDINARY_USER','TPM','REPAIR_REINSTALL','PRODUCTION_ACCEPTANCE')}
    $reportPath=Join-Path $spikeRoot ('acl-disambiguation-'+[guid]::NewGuid().ToString('N')+'.json')
    $summary|ConvertTo-Json -Depth 14|Set-Content -LiteralPath $reportPath -Encoding UTF8
    Write-Host ('Report: '+$reportPath)
}
