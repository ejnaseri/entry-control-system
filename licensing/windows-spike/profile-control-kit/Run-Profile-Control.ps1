# One-time profile-backed DPAPI-NG control for LIC-6.2-008. Test data only.
[CmdletBinding()]
param([switch]$ResumeFailedAclBootstrap,[switch]$ResumeFailedCopyBootstrap)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root='C:\ProgramData\Ecs.Lic008.ProfileV1'
$names=@('Ecs.Lic008.ProfileV1.Owner','Ecs.Lic008.ProfileV1.Peer')
$roles=@('owner','peer')
$sc=Join-Path $env:SystemRoot 'System32\sc.exe'
$exe=Join-Path $root 'bin\Ecs.Lic008.ProfileControlV1.exe'

function Assert-PlainPath([string]$Path) {
    for($cursor=[IO.Path]::GetFullPath($Path);$cursor;){
        if(Test-Path -LiteralPath $cursor){
            if(((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)-ne 0){throw 'Linked path refused'}
        }
        $parent=Split-Path -Parent $cursor;if($parent -eq $cursor){break};$cursor=$parent
    }
}
function Invoke-Sc([string[]]$Words) {
    $output=& $sc @Words 2>&1
    if($LASTEXITCODE -ne 0){throw ('sc.exe failed: '+($Words -join ' '))}
    $output
}
function Service-Sid([string]$Name) {
    $account=New-Object Security.Principal.NTAccount('NT SERVICE',$Name)
    return $account.Translate([Security.Principal.SecurityIdentifier]).Value
}
function Set-Rules([string]$Path,[string[]]$Modify,[string[]]$Read=@()) {
    $directory=Get-Item -LiteralPath $Path
    $acl=New-Object Security.AccessControl.DirectorySecurity
    $acl.SetAccessRuleProtection($true,$false)
    foreach($sid in @('S-1-5-18','S-1-5-32-544')){
        $identity=New-Object Security.Principal.SecurityIdentifier($sid)
        $acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($identity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')))
    }
    foreach($sid in $Modify){$identity=New-Object Security.Principal.SecurityIdentifier($sid);$acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($identity,'Modify','ContainerInherit,ObjectInherit','None','Allow')))}
    foreach($sid in $Read){$identity=New-Object Security.Principal.SecurityIdentifier($sid);$acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule($identity,'ReadAndExecute','ContainerInherit,ObjectInherit','None','Allow')))}
    $directory.SetAccessControl($acl)
}
function Check-Package([string]$Path) {
    Assert-PlainPath $Path
    $manifestPath=Join-Path $Path 'package-manifest.json'
    $manifest=Get-Content -LiteralPath $manifestPath -Raw|ConvertFrom-Json
    if($manifest.checklistId -cne 'LIC-6.2-008' -or $manifest.scope -cne 'TEST_ONLY_PROFILE_BACKED_CONTROL_V1' -or $manifest.version -cne '0.8.2'){throw 'Package identity mismatch'}
    $actual=@(Get-ChildItem -LiteralPath $Path -File|Where-Object Name -ne 'package-manifest.json')
    if($actual.Count -ne @($manifest.files).Count){throw 'Package file count mismatch'}
    foreach($entry in $manifest.files){
        if($entry.name -notmatch '^[A-Za-z0-9_.-]+$'){throw 'Unsafe package name'}
        $file=Join-Path $Path $entry.name;Assert-PlainPath $file
        if(-not(Test-Path -LiteralPath $file) -or (Get-Item -LiteralPath $file).Length -ne $entry.size -or (Get-FileHash -LiteralPath $file).Hash.ToLowerInvariant() -cne $entry.sha256){throw 'Package hash mismatch'}
    }
    $manifest
}
function Set-Plan([string]$Action,[string]$RunId,[string]$Hash,[string]$OwnerSid) {
    @{Action=$Action;RunId=$RunId;BinaryHash=$Hash;OwnerSid=$OwnerSid}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'plan.json') -Encoding UTF8
}
function Run-Probe([string]$Role,[string]$RunId) {
    $report=Join-Path $root ($Role+'-reports\'+$RunId+'.json')
    if(Test-Path -LiteralPath $report){throw 'Report collision'}
    $null=Invoke-Sc @('start',$names[[array]::IndexOf($roles,$Role)])
    $service=$names[[array]::IndexOf($roles,$Role)]
    $deadline=[datetime]::UtcNow.AddSeconds(110)
    do{$s=Get-Service -Name $service -ErrorAction Stop;if($s.Status -eq 'Stopped'){break};Start-Sleep -Milliseconds 250}while([datetime]::UtcNow -lt $deadline)
    if($s.Status -ne 'Stopped' -or -not(Test-Path -LiteralPath $report)){throw ($Role+' probe incomplete')}
    Get-Content -LiteralPath $report -Raw|ConvertFrom-Json
}
function One([object]$Report,[string]$Id,[string]$Status) {
    $rows=@($Report.results|Where-Object{$_.Id -ceq $Id -and $_.Status -ceq $Status})
    return $rows.Count -eq 1 -and @($Report.results|Where-Object Id -ceq $Id).Count -eq 1
}
function Profile-Ready([object]$Report,[string]$Role) {
    $environment=@($Report.results|Where-Object Id -ceq ($Role+'.profile.environment'))
    $special=@($Report.results|Where-Object Id -ceq ($Role+'.profile.special-folder'))
    $hive=@($Report.results|Where-Object Id -ceq ($Role+'.profile.hku-local-service'))
    return $environment.Count -eq 1 -and $special.Count -eq 1 -and $hive.Count -eq 1 -and
        $environment[0].Status -ceq 'OBSERVED' -and -not[string]::IsNullOrWhiteSpace($environment[0].Stage) -and
        $special[0].Status -ceq 'OBSERVED' -and $special[0].Stage -ceq $environment[0].Stage -and
        $environment[0].Stage -cne 'C:\Users\Default' -and $hive[0].Status -ceq 'OBSERVED' -and $hive[0].Stage -ceq 'true'
}

if(-not([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Elevated operator required'}
if(-not[Environment]::Is64BitProcess){throw 'Use 64-bit Windows PowerShell'}
$null=Check-Package $PSScriptRoot
Assert-PlainPath $root
$failedReport=Join-Path $root 'profile-control-524936c2734d48b4bc4ea402946842ec.json'
if($ResumeFailedAclBootstrap -and $ResumeFailedCopyBootstrap){throw 'Select only one continuation'}
if($ResumeFailedCopyBootstrap){
    $copyReport=Join-Path $root 'profile-control-e096e3b29f80470d8a473fe7c60b9eba.json'
    if(-not(Test-Path -LiteralPath $root) -or -not(Test-Path -LiteralPath $failedReport) -or -not(Test-Path -LiteralPath $copyReport)){throw 'Exact failed copy-bootstrap state required'}
    if((Get-FileHash -LiteralPath $failedReport).Hash.ToLowerInvariant() -cne 'f2cc9958914a568b59ea391a75a6c94f1c740beb9586aed592ec62e83fb59ff7'){throw 'Original failed report hash mismatch'}
    $failed=Get-Content -LiteralPath $copyReport -Raw|ConvertFrom-Json
    if($failed.scope -cne 'TEST_ONLY_PROFILE_BACKED_CONTROL_V1' -or $failed.version -cne '0.8.1' -or $failed.sourceEvidence -cne 'LIC-EV-0113' -or $failed.continuedFrom -cne 'LIC-EV-0112' -or $failed.controlComplete -or $failed.securityAccepted -or $failed.policyChanged -or $failed.productionAccepted -or @($failed.reports).Count -ne 0){throw 'Failed copy report content mismatch'}
    $expected=@('bin','owner-protected','owner-reports','peer-reports','shared','profile-control-524936c2734d48b4bc4ea402946842ec.json','profile-control-e096e3b29f80470d8a473fe7c60b9eba.json')
    $actual=@(Get-ChildItem -LiteralPath $root -Force|Sort-Object Name|ForEach-Object Name)
    if(($actual -join '|') -cne (($expected|Sort-Object) -join '|')){throw 'Failed copy root contains unexpected state'}
    foreach($name in $expected[0..4]){if(@(Get-ChildItem -LiteralPath (Join-Path $root $name) -Force).Count -ne 0){throw 'Failed copy directory is not empty'}}
    for($i=0;$i -lt 2;$i++){
        $service=Get-CimInstance Win32_Service -Filter ("Name='"+$names[$i]+"'")
        if($null-eq$service -or $service.State -cne 'Stopped' -or $service.StartMode -cne 'Manual' -or $service.StartName -cne 'NT AUTHORITY\LocalService' -or $service.PathName -cne ($exe+' --service '+$roles[$i])){throw 'Failed copy service configuration mismatch'}
    }
} elseif($ResumeFailedAclBootstrap){
    if(-not(Test-Path -LiteralPath $root) -or -not(Test-Path -LiteralPath $failedReport)){throw 'Exact failed ACL bootstrap state required'}
    if((Get-FileHash -LiteralPath $failedReport).Hash.ToLowerInvariant() -cne 'f2cc9958914a568b59ea391a75a6c94f1c740beb9586aed592ec62e83fb59ff7'){throw 'Failed report hash mismatch'}
    $failed=Get-Content -LiteralPath $failedReport -Raw|ConvertFrom-Json
    if($failed.scope -cne 'TEST_ONLY_PROFILE_BACKED_CONTROL_V1' -or $failed.version -cne '0.8.0' -or $failed.controlComplete -or $failed.securityAccepted -or $failed.policyChanged -or $failed.productionAccepted -or @($failed.reports).Count -ne 0 -or @($failed.services|Where-Object state -cne 'ABSENT').Count -ne 0){throw 'Failed report content mismatch'}
    $expected=@('bin','owner-protected','owner-reports','peer-reports','shared','profile-control-524936c2734d48b4bc4ea402946842ec.json')
    $actual=@(Get-ChildItem -LiteralPath $root -Force|Sort-Object Name|ForEach-Object Name)
    if(($actual -join '|') -cne (($expected|Sort-Object) -join '|')){throw 'Failed root contains unexpected state'}
    foreach($name in $expected[0..4]){if(@(Get-ChildItem -LiteralPath (Join-Path $root $name) -Force).Count -ne 0){throw 'Failed bootstrap directory is not empty'}}
} else {
    if(Test-Path -LiteralPath $root){throw 'Fresh profile-control root required'}
    foreach($name in $names){if(Get-Service -Name $name -ErrorAction SilentlyContinue){throw 'Fresh profile-control service names required'}}
}
$ownerSid=$null;$peerSid=$null
$complete=$false;$reports=@()
try {
    if(-not $ResumeFailedAclBootstrap -and -not $ResumeFailedCopyBootstrap){foreach($path in @($root,(Join-Path $root 'bin'),(Join-Path $root 'shared'),(Join-Path $root 'owner-protected'),(Join-Path $root 'owner-reports'),(Join-Path $root 'peer-reports'))){$null=New-Item -ItemType Directory -Path $path}}
    Set-Rules $root @()
    if(-not $ResumeFailedCopyBootstrap){
        for($i=0;$i -lt 2;$i++){
            $null=Invoke-Sc @('create',$names[$i],'binPath=',('"'+$exe+'" --service '+$roles[$i]),'start=','demand','obj=','NT AUTHORITY\LocalService')
            $null=Invoke-Sc @('sidtype',$names[$i],'unrestricted')
        }
    }
    $ownerSid=Service-Sid $names[0];$peerSid=Service-Sid $names[1]
    Set-Rules $root @() @($ownerSid,$peerSid)
    Set-Rules (Join-Path $root 'bin') @() @($ownerSid,$peerSid)
    Set-Rules (Join-Path $root 'shared') @($ownerSid,$peerSid)
    Set-Rules (Join-Path $root 'owner-protected') @($ownerSid)
    Set-Rules (Join-Path $root 'owner-reports') @($ownerSid)
    Set-Rules (Join-Path $root 'peer-reports') @($peerSid)
    foreach($file in Get-ChildItem -LiteralPath $PSScriptRoot -File){Copy-Item -LiteralPath $file.FullName -Destination (Join-Path (Join-Path $root 'bin') $file.Name)}
    $null=Check-Package (Join-Path $root 'bin')
    $binaryHash=(Get-FileHash -LiteralPath $exe).Hash.ToLowerInvariant()
    $run=[guid]::NewGuid().ToString('N');Set-Plan 'protect' $run $binaryHash $ownerSid;$protect=Run-Probe 'owner' $run;$reports+=,$protect
    $run=[guid]::NewGuid().ToString('N');Set-Plan 'probe' $run $binaryHash $ownerSid;$peer=Run-Probe 'peer' $run;$reports+=,$peer
    $run=[guid]::NewGuid().ToString('N');Set-Plan 'verify' $run $binaryHash $ownerSid;$verify=Run-Probe 'owner' $run;$reports+=,$verify
    $complete=(Profile-Ready $protect 'owner') -and (Profile-Ready $peer 'peer') -and (Profile-Ready $verify 'owner') -and
        (One $protect 'owner.protection.local-user' 'PASS_MEMORY_AND_PERSISTED_TEST_BLOB') -and
        (One $protect 'owner.protection.exact-service-sid' 'PASS_MEMORY_AND_PERSISTED_TEST_BLOB') -and
        (One $peer 'peer.protection.local-user' 'PASS_SHARED_ACCOUNT_CONTROL_OPENED') -and
        (One $peer 'peer.protection.exact-service-sid' 'OBSERVED_EXACT_SID_REFUSAL') -and
        (One $verify 'owner.restart.local-user' 'PASS') -and (One $verify 'owner.restart.exact-service-sid' 'PASS')
} finally {
    foreach($name in $names){
        $service=Get-Service -Name $name -ErrorAction SilentlyContinue
        if($service -and $service.Status -ne 'Stopped'){& $sc stop $name|Out-Null}
    }
    $snapshot=@($names|ForEach-Object{$s=Get-CimInstance Win32_Service -Filter ("Name='"+$_+"'") -ErrorAction SilentlyContinue;if($s){@{name=$_.ToString();state=$s.State;startName=$s.StartName;pathName=$s.PathName}}else{@{name=$_.ToString();state='ABSENT'}}})
    $summary=@{scope='TEST_ONLY_PROFILE_BACKED_CONTROL_V1';version='0.8.2';sourceEvidence='LIC-EV-0115';continuedFrom='LIC-EV-0113';controlComplete=$complete;securityAccepted=$false;policyChanged=$false;productionAccepted=$false;reports=$reports;services=$snapshot;timeUtc=[datetime]::UtcNow.ToString('o');notTested=@('PRODUCTION_GUARDIAN_IDENTITY','DEDICATED_LOCAL_ACCOUNT','DOMAIN_GMSA','LOCAL_MACHINE','TPM','REBOOT','REPAIR_REINSTALL','WINDOWS_MATRIX')}
    $report=Join-Path $root ('profile-control-'+[guid]::NewGuid().ToString('N')+'.json')
    $summary|ConvertTo-Json -Depth 14|Set-Content -LiteralPath $report -Encoding UTF8
    Write-Host ('Report: '+$report)
}
if(-not $complete){throw 'Profile-backed control incomplete; retain state and do not rerun'}
