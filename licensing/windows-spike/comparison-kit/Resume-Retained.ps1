# One-time correction of the exact EV0100 retained comparison; no key creation.
[CmdletBinding()]
param([switch]$ContinueProtection)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$spikeRoot='C:\ProgramData\Ecs.Lic008.ComparisonV1'
$spikeNames=@('Ecs.Lic008.ComparisonV1.Guardian','Ecs.Lic008.ComparisonV1.App')
$spikeSc=Join-Path $env:SystemRoot 'System32/sc.exe'
$oldExe=Join-Path $spikeRoot 'bin/Ecs.Lic008.ComparisonV1.exe'
$newBin=Join-Path $spikeRoot 'bin-0.4.1'
$spikeExe=Join-Path $newBin 'Ecs.Lic008.ComparisonV1.exe'
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'Manage-Spike.ps1'),[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Controller parse failed'}
foreach($name in @('Assert-PlainPath','ConvertTo-NativeArgument','Invoke-SpikeSc','Identity','Set-DirectoryRules','Check-Package','Run-ServiceProbe','Has-Result','Confirm-KeyRound','Confirm-ProtectionRound','Set-Plan')){
    $f=$ast.Find({param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq $name},$true)
    Invoke-Expression $f.Extent.Text
}
if(-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Elevated operator required'}
Assert-PlainPath $spikeRoot
$null=Check-Package $PSScriptRoot
foreach($pair in @(
    @('bin/package-manifest.json','EBB18E871246382117008B40437BF8B6B16E5211B2558D6FDC6C3156B0D58524'),
    @('comparison-ef7a585c2de64b23a7641ccbd4e42170.json','A48147A085F0B872F99BEFE60A600725943C9DAAFB9603245CBFE9EA45A548DB'),
    @('setup-reports/metadata-1b5e11d96fff4309af4bf018c1b5c8ad.json','EAE096799E2F70A4329497BE3D9A3DAFDBF12D7C4135AE570025631B7B7E057C')
)){
    $path=Join-Path $spikeRoot $pair[0]; Assert-PlainPath $path
    if((Get-FileHash -LiteralPath $path).Hash -ne $pair[1]){throw 'Retained evidence mismatch'}
}
$old=Get-Content -Raw -LiteralPath (Join-Path $spikeRoot 'bin/package-manifest.json')|ConvertFrom-Json
foreach($entry in $old.files){
    $path=Join-Path $spikeRoot ('bin/'+$entry.name); Assert-PlainPath $path
    if((Get-FileHash -LiteralPath $path).Hash -ne $entry.sha256){throw 'Old installed binary changed'}
}
$plan=Get-Content -Raw -LiteralPath (Join-Path $spikeRoot 'plan.json')|ConvertFrom-Json
if($plan.Action -ne 'create' -or $plan.RunId -ne '0d26c5c6d100431b88f6bbf5ecb31956'){throw 'Unexpected retained plan'}
foreach($path in @($newBin,(Join-Path $spikeRoot 'shared/software-key.json'),(Join-Path $spikeRoot 'shared/dpapi.bin'))){
    Assert-PlainPath $path
    if(Test-Path -LiteralPath $path){throw 'Continuation already started or unexpected handoff'}
}
foreach($name in @('Ecs.Lic008.ComparisonV1.Setup','Ecs.Lic008.ComparisonV1.Metadata')){
    if(Get-Service -Name $name -ErrorAction SilentlyContinue){throw 'Temporary helper still present'}
}
for($i=0;$i -lt 2;$i++){
    $s=Get-CimInstance Win32_Service -Filter ("Name='"+$spikeNames[$i]+"'")
    $role=@('guardian','app')[$i]
    if($s.State -ne 'Stopped' -or $s.StartMode -ne 'Manual' -or $s.StartName -ne ('NT SERVICE\'+$spikeNames[$i]) -or $s.PathName -cne ('"'+$oldExe+'" --service '+$role)){throw 'Retained service configuration mismatch'}
}
# A fresh versioned binary directory also prevents automatic replay after interruption.
$null=New-Item -ItemType Directory -Path $newBin
Set-DirectoryRules $newBin @() @((Identity $spikeNames[0]),(Identity $spikeNames[1]))
foreach($file in Get-ChildItem -LiteralPath $PSScriptRoot -File){Copy-Item -LiteralPath $file.FullName -Destination (Join-Path $newBin $file.Name)}
$null=Check-Package $newBin
$allReports=@();$phaseOne=$false;$phaseTwo='NOT_RUN'
try {
    for($i=0;$i -lt 2;$i++){
        $role=@('guardian','app')[$i]
        Invoke-SpikeSc @('config',$spikeNames[$i],'binPath=',('"'+$spikeExe+'" --service '+$role))
        $s=Get-CimInstance Win32_Service -Filter ("Name='"+$spikeNames[$i]+"'")
        if($s.PathName -cne ('"'+$spikeExe+'" --service '+$role) -or $s.State -ne 'Stopped' -or $s.StartName -ne ('NT SERVICE\'+$spikeNames[$i])){throw 'Updated configuration mismatch'}
    }
    Set-Plan 'handoff'
    $handoff=Run-ServiceProbe 'guardian' $runId;$allReports+=,$handoff
    if(-not (Has-Result $handoff 'guardian.software.retained-handoff' 'PASS')){throw 'Retained key handoff failed'}
    foreach($round in @(1,2)){
        Set-Plan 'verify'
        $guardian=Run-ServiceProbe 'guardian' $runId;$allReports+=,$guardian
        $app=Run-ServiceProbe 'app' $runId;$allReports+=,$app
        if(-not (Confirm-KeyRound $guardian $app)){throw 'Key isolation round failed'}
    }
    $phaseOne=$true
    if($ContinueProtection){
        $phaseTwo='FAILED_OR_INCOMPLETE'
        foreach($phase in @('protect','verify-protect')){
            Set-Plan $phase $true
            $guardian=Run-ServiceProbe 'guardian' $runId;$allReports+=,$guardian
            $app=Run-ServiceProbe 'app' $runId;$allReports+=,$app
            if(-not (Confirm-ProtectionRound $guardian $app $phase)){throw 'Protection comparison failed'}
        }
        $phaseTwo='PASS_BOUNDED_PROCESS_RESTART_ONLY'
    }
} finally {
    $summary=@{scope='TEST_ONLY_COMPARISON_V1';version='0.4.1';retainedKeyRun='0d26c5c6d100431b88f6bbf5ecb31956';
        keyExperimentPassed=$phaseOne;protectionExperiment=$phaseTwo;reports=$allReports;timeUtc=[datetime]::UtcNow.ToString('o');
        manifestSha256=(Get-FileHash -LiteralPath (Join-Path $newBin 'package-manifest.json')).Hash;
        notTested=@('REBOOT','ORDINARY_USER','TPM','REPAIR_REINSTALL','PRODUCTION_ACCEPTANCE')}
    $reportPath=Join-Path $spikeRoot ('continuation-'+[guid]::NewGuid().ToString('N')+'.json')
    $summary|ConvertTo-Json -Depth 14|Set-Content -LiteralPath $reportPath -Encoding UTF8
    Write-Host ('Report: '+$reportPath)
}
