# One-time read-only key-open diagnosis for the exact EV0102 retained state.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$spikeRoot='C:\ProgramData\Ecs.Lic008.ComparisonV1'
$spikeNames=@('Ecs.Lic008.ComparisonV1.Guardian','Ecs.Lic008.ComparisonV1.App')
$spikeSc=Join-Path $env:SystemRoot 'System32/sc.exe'
$oldBin=Join-Path $spikeRoot 'bin-0.4.1'
$oldExe=Join-Path $oldBin 'Ecs.Lic008.ComparisonV1.exe'
$newBin=Join-Path $spikeRoot 'bin-0.4.3-diagnostic'
$spikeExe=Join-Path $newBin 'Ecs.Lic008.ComparisonV1.exe'
$retainedKey='Ecs.Lic008.ComparisonV1.TEST_ONLY.software.0d26c5c6d100431b88f6bbf5ecb31956'
$expectedOldManifest='E11A40282B7EE884676DAD910979373EDE318D98BF12BF42E405DEB75BE88840'
$expectedOldBinary='3DA09FD848D52F539C9419406E01B7163D2EEED96F4956D46E264D38481567FD'
$expectedContinuation='81BA564119EE7C64EAF75CB5530076FDDA9436DC3FFA8F97460BB7AEB25F6E69'
$tokens=$null;$errors=$null
$manager=Join-Path $PSScriptRoot 'Manage-Spike.ps1'
$ast=[Management.Automation.Language.Parser]::ParseFile($manager,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Controller parse failed'}
foreach($name in @('Assert-PlainPath','ConvertTo-NativeArgument','Invoke-SpikeSc','Identity','Set-DirectoryRules','Check-Package','Run-ServiceProbe','Has-Result','Confirm-DiagnosticCollection','Set-Plan')){
    $f=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true)
    if($null -eq $f){throw ('Missing controller function: '+$name)}
    Invoke-Expression $f.Extent.Text
}
if(-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Elevated operator required'}
if(-not [Environment]::Is64BitProcess){throw 'Use 64-bit Windows PowerShell'}
Assert-PlainPath $spikeRoot
$null=Check-Package $PSScriptRoot

foreach($name in @('Ecs.Lic008.ComparisonV1.Setup','Ecs.Lic008.ComparisonV1.Metadata')){
    if(Get-Service -Name $name -ErrorAction SilentlyContinue){throw 'Temporary helper still present'}
}
if(Test-Path -LiteralPath $newBin){throw 'Diagnostic continuation already started or destination collision'}
foreach($path in @($oldBin,$oldExe,(Join-Path $spikeRoot 'plan.json'),
    (Join-Path $spikeRoot 'shared/software-key.json'),
    (Join-Path $spikeRoot 'continuation-4dde8b0572a24b23b55d11567ad2b8fa.json'))){
    Assert-PlainPath $path
    if(-not (Test-Path -LiteralPath $path)){throw 'Required retained state is absent'}
}
if((Get-FileHash -LiteralPath (Join-Path $oldBin 'package-manifest.json')).Hash -ne $expectedOldManifest){throw 'Retained 0.4.1 manifest mismatch'}
if((Get-FileHash -LiteralPath $oldExe).Hash -ne $expectedOldBinary){throw 'Retained 0.4.1 executable mismatch'}
if((Get-FileHash -LiteralPath (Join-Path $spikeRoot 'continuation-4dde8b0572a24b23b55d11567ad2b8fa.json')).Hash -ne $expectedContinuation){throw 'EV0102 continuation mismatch'}
$oldManifest=Get-Content -LiteralPath (Join-Path $oldBin 'package-manifest.json') -Raw|ConvertFrom-Json
foreach($entry in $oldManifest.files){
    $path=Join-Path $oldBin $entry.name;Assert-PlainPath $path
    if((Get-Item -LiteralPath $path).Length -ne $entry.size -or (Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant() -ne $entry.sha256){throw 'Retained 0.4.1 package changed'}
}
$public=Get-Content -LiteralPath (Join-Path $spikeRoot 'shared/software-key.json') -Raw|ConvertFrom-Json
if($public.Provider -cne 'software' -or $public.Name -cne $retainedKey -or
   $public.PublicHash -cnotmatch '^[0-9a-f]{64}$'){throw 'Published retained key record mismatch'}
$plan=Get-Content -LiteralPath (Join-Path $spikeRoot 'plan.json') -Raw|ConvertFrom-Json
if($plan.Action -cne 'verify' -or $plan.RunId -cne '9b7ff54568d249318589f43e28c8e95f' -or
   $plan.BinaryHash -cne $expectedOldBinary.ToLowerInvariant() -or $plan.KeyExperimentAccepted){throw 'Unexpected current retained plan'}
for($i=0;$i -lt 2;$i++){
    $s=Get-CimInstance Win32_Service -Filter ("Name='"+$spikeNames[$i]+"'")
    $role=@('guardian','app')[$i]
    if($null -eq $s -or $s.State -ne 'Stopped' -or $s.StartMode -ne 'Manual' -or
       $s.StartName -cne ('NT SERVICE\'+$spikeNames[$i]) -or $s.PathName -cne ('"'+$oldExe+'" --service '+$role)){throw 'Retained service configuration mismatch'}
}

$null=New-Item -ItemType Directory -Path $newBin
Set-DirectoryRules $newBin @() @((Identity $spikeNames[0]),(Identity $spikeNames[1]))
foreach($file in Get-ChildItem -LiteralPath $PSScriptRoot -File){Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $newBin $file.Name)}
$null=Check-Package $newBin
$reports=@();$collected=$false
try {
    for($i=0;$i -lt 2;$i++){
        $role=@('guardian','app')[$i]
        Invoke-SpikeSc @('config',$spikeNames[$i],'binPath=',('"'+$spikeExe+'" --service '+$role))
        $s=Get-CimInstance Win32_Service -Filter ("Name='"+$spikeNames[$i]+"'")
        if($s.PathName -cne ('"'+$spikeExe+'" --service '+$role) -or $s.State -ne 'Stopped' -or
           $s.StartMode -ne 'Manual' -or $s.StartName -cne ('NT SERVICE\'+$spikeNames[$i])){throw 'Diagnostic service configuration mismatch'}
    }
    Set-Plan 'diagnose-open'
    $guardian=Run-ServiceProbe 'guardian' $runId;$reports+=,$guardian
    $app=Run-ServiceProbe 'app' $runId;$reports+=,$app
    $collected=Confirm-DiagnosticCollection $guardian $app
    if(-not $collected){throw 'Diagnostic report is incomplete; no acceptance inferred'}
} finally {
    $serviceSnapshot=@($spikeNames | ForEach-Object {
        $s=Get-CimInstance Win32_Service -Filter ("Name='"+$_+"'")
        if($null -eq $s){[ordered]@{name=$_;state='ABSENT'}}else{[ordered]@{name=$s.Name;state=$s.State;startMode=$s.StartMode;startName=$s.StartName;pathName=$s.PathName}}
    })
    $summary=@{scope='TEST_ONLY_RETAINED_KEY_OPEN_DIAGNOSTIC';version='0.4.3';retainedKey=$retainedKey;
        diagnosticCollected=$collected;securityAccepted=$false;acceptanceChanged=$false;reports=$reports;
        services=$serviceSnapshot;
        timeUtc=[datetime]::UtcNow.ToString('o');manifestSha256=(Get-FileHash -LiteralPath (Join-Path $newBin 'package-manifest.json')).Hash;
        notTested=@('SECOND_KEY_ROUND','LOCAL_USER_PROTECTION','REBOOT','ORDINARY_USER','TPM','REPAIR_REINSTALL','PRODUCTION_ACCEPTANCE')}
    $reportPath=Join-Path $spikeRoot ('key-open-diagnostic-'+[guid]::NewGuid().ToString('N')+'.json')
    $summary|ConvertTo-Json -Depth 14|Set-Content -LiteralPath $reportPath -Encoding UTF8
    Write-Host ('Report: '+$reportPath)
}
