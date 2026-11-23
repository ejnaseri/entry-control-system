# Fresh, test-only LIC008 Software-KSP wrapping-key feasibility run.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateSet('ResumeScopeFailure','Finish')][string]$Stage,[string]$UserReport)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'Ecs.Lic008.WrappingV3'
$names=@('Ecs.Lic008.WrappingV3.Guardian','Ecs.Lic008.WrappingV3.App','Ecs.Lic008.WrappingV3.Setup')
$roles=@('guardian','app','setup')
$sc=Join-Path $env:SystemRoot 'System32/sc.exe'
$bin=Join-Path $root 'bin-0.10.1'
$exe=Join-Path $bin 'Ecs.Lic008.WrappingV3.exe'
$legacyHash='5326cbb9a4fdc8608ebb3dc90c0e349206eb5caeaabd8c17cef2ea0be2bba315'
$legacyManifestHash='d8e42f8cade07f25e3e6d7411d67ffc7c2cfd6d0cdfcb8355a7701ac67139370'
$expectedExperiment='c43b7dda51f7419099879fcb64efb8c6'
$expectedCreateRun='5a109d0ad27643c396e8c160902800b4'
$expectedUser='S-1-5-21-3058020570-171625005-1532683838-1001'

function Plain([string]$Path){
  $cursor=[IO.Path]::GetFullPath($Path)
  while($cursor){if(Test-Path -LiteralPath $cursor){if(((Get-Item -LiteralPath $cursor -Force).Attributes-band[IO.FileAttributes]::ReparsePoint)-ne0){throw 'Linked path refused'}};$parent=Split-Path -Parent $cursor;if($parent-eq$cursor){break};$cursor=$parent}
}
function Arg([string]$Value){$x=[regex]::Replace($Value,'(\\*)"','$1$1\"');$x=[regex]::Replace($x,'(\\+)$','$1$1');'"'+$x+'"'}
function Invoke-ServiceControl([string[]]$Words){
  $start=New-Object Diagnostics.ProcessStartInfo;$start.FileName=$sc;$start.Arguments=(($Words|ForEach-Object{Arg $_})-join' ');$start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
  $p=[Diagnostics.Process]::Start($start);try{$o=$p.StandardOutput.ReadToEndAsync();$e=$p.StandardError.ReadToEndAsync();if(-not$p.WaitForExit(30000)){$p.Kill();throw 'SC timeout; retain state'};Write-Host $o.GetAwaiter().GetResult();Write-Host $e.GetAwaiter().GetResult();if($p.ExitCode-ne0){throw 'SC failure; retain state'}}finally{$p.Dispose()}
}
function Sid([string]$Name){(New-Object Security.Principal.NTAccount('NT SERVICE',$Name)).Translate([Security.Principal.SecurityIdentifier]).Value}
function OptionalProperty($Object,[string]$Name){$property=$Object.PSObject.Properties[$Name];if($null-eq$property){return $null};[string]$property.Value}
function Rules([string]$Path,[string[]]$Modify,[string[]]$Read,[bool]$Admin=$true){
  Plain $Path;$acl=New-Object Security.AccessControl.DirectorySecurity;$acl.SetAccessRuleProtection($true,$false);$full=@('S-1-5-18');if($Admin){$full+='S-1-5-32-544'}
  foreach($id in $full){$acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($id)),'FullControl','ContainerInherit,ObjectInherit','None','Allow')))}
  foreach($id in $Modify){$acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($id)),'Modify','ContainerInherit,ObjectInherit','None','Allow')))}
  foreach($id in $Read){$acl.AddAccessRule((New-Object Security.AccessControl.FileSystemAccessRule((New-Object Security.Principal.SecurityIdentifier($id)),'ReadAndExecute','ContainerInherit,ObjectInherit','None','Allow')))};Set-Acl -LiteralPath $Path -AclObject $acl
}
function Package([string]$Dir,[string]$Version='0.10.1'){
  Plain $Dir;$m=Get-Content -LiteralPath (Join-Path $Dir 'package-manifest.json') -Raw|ConvertFrom-Json
  if($m.checklistId-ne'LIC-6.2-008'-or$m.scope-ne'TEST_ONLY_SOFTWARE_KSP_WRAPPING_V3'-or$m.version-cne$Version){throw 'Wrong package identity'}
  $seen=@{};foreach($f in $m.files){if($f.name-notmatch'^[A-Za-z0-9][A-Za-z0-9._-]*\.(dll|exe|json|pdb|txt|ps1)$'-or$seen.ContainsKey($f.name)){throw 'Invalid package entry'};$seen[$f.name]=$true;$path=Join-Path $Dir $f.name;if((Get-Item -LiteralPath $path).Length-ne$f.size-or(Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant()-cne$f.sha256){throw 'Package hash mismatch'}}
  foreach($f in Get-ChildItem -LiteralPath $Dir -File -Force){if($f.Name-ne'package-manifest.json'-and-not$seen.ContainsKey($f.Name)){throw 'Unexpected package content'}}
  foreach($needed in @('Ecs.Lic008.WrappingV3.exe','Run-Wrapping-User-Control.ps1','Run-User-Probe.ps1','README-fa.txt')){if(-not$seen.ContainsKey($needed)){throw 'Incomplete package'}};$m
}
function Plan([string]$Action,[string]$Run,[string]$Experiment){@{Action=$Action;RunId=$Run;ExperimentId=$Experiment;OrdinaryUserSid=$OrdinaryUserSid;BinaryHash=(Get-FileHash -LiteralPath $exe).Hash.ToLowerInvariant()}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'plan.json') -Encoding UTF8}
function Run([string]$Role,[string]$Action,[string]$Experiment){
  $run=[guid]::NewGuid().ToString('N');Plan $Action $run $Experiment;$index=[Array]::IndexOf($roles,$Role);$report=Join-Path $root ($Role+'-reports/'+$run+'.json');Invoke-ServiceControl -Words @('start',$names[$index]);$watch=[Diagnostics.Stopwatch]::StartNew();do{Start-Sleep -Milliseconds 250;$service=Get-Service -Name $names[$index];if($service.Status-eq'Stopped'){break}}while($watch.Elapsed.TotalSeconds-lt120)
  if($service.Status-ne'Stopped'){Invoke-ServiceControl -Words @('stop',$names[$index]);throw 'Probe timeout; retain state'};if(-not(Test-Path -LiteralPath $report)){throw 'Missing report; retain state'};$r=Get-Content -LiteralPath $report -Raw|ConvertFrom-Json
  AssertReportIdentity $r $Role $Action $run $Experiment (Get-FileHash -LiteralPath $exe).Hash.ToLowerInvariant();$r.results|Format-Table Id,Status,Stage,Error -AutoSize|Out-Host;$r
}
function Pass($Report,[string]$Id,[string[]]$Status=@('PASS')){$x=@($Report.results|Where-Object{$_.Id-ceq$Id});$x.Count-eq1-and$x[0].Status-in$Status}
function AssertReportIdentity($Report,[string]$Role,[string]$Action,[string]$Run,[string]$Experiment,[string]$Hash){
  if($Report.schemaVersion-ne1-or$Report.checklistId-cne'LIC-6.2-008'-or$Report.scope-cne'TEST_ONLY_SOFTWARE_KSP_WRAPPING_V3'-or$Report.role-cne$Role-or$Report.action-cne$Action-or$Report.runId-cne$Run-or$Report.experimentId-cne$Experiment-or$Report.binarySha256-cne$Hash-or$Report.serviceIdentityMatched-ne$true-or$Report.productionAccepted-ne$false-or$Report.securityAccepted-ne$false){throw 'Report mismatch'}
}
function AssertLegacyCreation($Report){
  if($Report.schemaVersion-ne1-or$Report.checklistId-cne'LIC-6.2-008'-or$Report.scope-cne'TEST_ONLY_SOFTWARE_KSP_WRAPPING_V2'-or$Report.role-cne'setup'-or$Report.action-cne'create'-or$Report.runId-cne$expectedCreateRun-or$Report.experimentId-cne$expectedExperiment-or$Report.binarySha256-cne$legacyHash-or$Report.serviceIdentityMatched-ne$true-or$Report.productionAccepted-ne$false-or$Report.securityAccepted-ne$false-or$Report.processId-ne1484-or$Report.osVersion-cne'10.0.22000.0'-or$Report.runtime-cne'10.0.11'-or$Report.timeUtc-cne'2026-10-05T11:23:23.1869768Z'){throw 'Legacy creation identity mismatch'}
  $ids=@('setup.publish-control-set')
  foreach($label in @('restricted','app-readable')){
    $id='setup.'+$label+'.create-rsa-wrapping-key';$ids+=$id
    foreach($stageName in @('open-software-ksp','check-rsa-support','create-rsa-machine-key','set-rsa-3072','set-export-policy-zero','set-decryption-only-usage','set-protected-dacl','finalize-key','open-finalized-handle')){$ids+=($id+'.stage.'+$stageName)}
  }
  if(@($Report.results).Count-ne$ids.Count){throw 'Legacy result count mismatch'}
  foreach($id in $ids){if(-not(Pass $Report $id)){throw 'Legacy creation gate failed'}}
}
function AssertStoppedServices([string]$ExpectedExe){
  foreach($name in $names){
    $svc=Get-CimInstance Win32_Service -Filter "Name='$name'";$idx=[Array]::IndexOf($names,$name);$account=if($idx-eq2){'LocalSystem'}else{'NT SERVICE\'+$name}
    if($null-eq$svc-or$svc.State-cne'Stopped'-or$svc.StartMode-cne'Manual'-or$svc.StartName-cne$account-or$svc.PathName-cne('"'+$ExpectedExe+'" --service '+$roles[$idx])-or$svc.ProcessId-ne0){throw 'Service configuration changed'}
    $reg=Get-ItemProperty -LiteralPath ('HKLM:\SYSTEM\CurrentControlSet\Services\'+$name)
    if($reg.ServiceSidType-ne1){throw 'Service SID configuration changed'}
  }
}

if(-not([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Run elevated'}
if(-not[Environment]::Is64BitProcess){throw 'Use 64-bit PowerShell'}
$os=Get-CimInstance Win32_OperatingSystem;$cpu=@(Get-CimInstance Win32_Processor);$build=[int]$os.BuildNumber;$caption=[string]$os.Caption
$currentVersion=Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion';$displayVersion=OptionalProperty $currentVersion 'DisplayVersion';if([string]::IsNullOrWhiteSpace($displayVersion)){$displayVersion=OptionalProperty $currentVersion 'ReleaseId'};if([string]::IsNullOrWhiteSpace($displayVersion)){$displayVersion='UNKNOWN'}
$flight=$false;$flightPath='HKLM:\SOFTWARE\Microsoft\WindowsSelfHost\Applicability';if(Test-Path -LiteralPath $flightPath){$appl=Get-ItemProperty -LiteralPath $flightPath;$flightValues=@((OptionalProperty $appl 'BranchName'),(OptionalProperty $appl 'ContentType'),(OptionalProperty $appl 'Ring'));$flight=@($flightValues|Where-Object{-not[string]::IsNullOrWhiteSpace([string]$_)}).Count -gt 0}
$isX64=@($cpu | Where-Object Architecture -ne 9).Count -eq 0
$isWindows10=$caption -match 'Windows 10' -and $caption -notmatch 'Server' -and $build -ge 14393 -and $build -lt 22000
$isWindows11=$caption -match 'Windows 11' -and $caption -notmatch 'Server' -and $build -ge 22000
$supported=($os.ProductType -eq 1 -and $isX64 -and -not $flight -and ($isWindows10 -or $isWindows11))
if(-not$supported){throw 'Unsupported test OS. Use non-Insider Windows 10 x64 build 14393 or later, or Windows 11 x64 build 22000 or later.'}

if($Stage-eq'ResumeScopeFailure'){
  if($UserReport){throw 'UserReport belongs only to Finish'}
  Plain $root;Plain $bin
  foreach($marker in @('scope-resume-intent.json','prepared.json','finish-intent.json')){if(Test-Path -LiteralPath (Join-Path $root $marker)){throw 'Continuation already attempted; retain state'}}
  if(Test-Path -LiteralPath $bin){throw 'Continuation binary directory must be fresh'}
  $null=Package $PSScriptRoot
  $oldBin=Join-Path $root 'bin';$oldExe=Join-Path $oldBin 'Ecs.Lic008.WrappingV3.exe'
  $null=Package $oldBin '0.10.0'
  if((Get-FileHash -LiteralPath (Join-Path $oldBin 'package-manifest.json')).Hash.ToLowerInvariant()-cne$legacyManifestHash-or(Get-FileHash -LiteralPath $oldExe).Hash.ToLowerInvariant()-cne$legacyHash){throw 'Legacy package hash mismatch'}
  AssertStoppedServices $oldExe
  foreach($relative in @('installation.json','plan.json','shared/control-set.json')){Plain (Join-Path $root $relative)}
  $installation=Get-Content -LiteralPath (Join-Path $root 'installation.json') -Raw|ConvertFrom-Json
  if($installation.scope-cne'TEST_ONLY_SOFTWARE_KSP_WRAPPING_V3'-or$installation.root-cne$root-or$installation.createdUtc-cne'2026-10-05T11:23:18.4996419Z'){throw 'Installation identity mismatch'}
  $plan=Get-Content -LiteralPath (Join-Path $root 'plan.json') -Raw|ConvertFrom-Json
  if($plan.Action-cne'create'-or$plan.RunId-cne$expectedCreateRun-or$plan.ExperimentId-cne$expectedExperiment-or$plan.OrdinaryUserSid-cne$expectedUser-or$plan.BinaryHash-cne$legacyHash){throw 'Original creation plan mismatch'}
  foreach($role in @('guardian','app')){if(@(Get-ChildItem -LiteralPath (Join-Path $root ($role+'-reports')) -Force).Count-ne0){throw 'Unexpected role reports; retain state'}}
  $setupFiles=@(Get-ChildItem -LiteralPath (Join-Path $root 'setup-reports') -Force)
  if($setupFiles.Count-ne1-or$setupFiles[0].Name-cne($expectedCreateRun+'.json')){throw 'Unexpected Setup report inventory'}
  $legacyReportPath=$setupFiles[0].FullName;Plain $legacyReportPath
  if($setupFiles[0].Length-lt1-or$setupFiles[0].Length-gt262144){throw 'Legacy report size invalid'}
  $legacy=Get-Content -LiteralPath $legacyReportPath -Raw|ConvertFrom-Json;AssertLegacyCreation $legacy
  $legacyReportHash=(Get-FileHash -LiteralPath $legacyReportPath).Hash.ToLowerInvariant()
  $set=Get-Content -LiteralPath (Join-Path $root 'shared/control-set.json') -Raw|ConvertFrom-Json
  if($set.ExperimentId-cne$expectedExperiment-or$set.Restricted.Label-cne'restricted'-or$set.Restricted.Name-cne('Ecs.Lic008.WrappingV3.TEST_ONLY.restricted.'+$expectedExperiment)-or$set.Restricted.PublicHash-cne'45a556ae44ddc0ed0b503aaa37d0f7a266e589c7105c57b9c478feb02e42fe7b'-or$set.AppReadable.Label-cne'app-readable'-or$set.AppReadable.Name-cne('Ecs.Lic008.WrappingV3.TEST_ONLY.app-readable.'+$expectedExperiment)-or$set.AppReadable.PublicHash-cne'f076315a25f49bf80a9857f37a44e173e1863a8d0ab517f6271b254cf9a02292'){throw 'Retained public key identity mismatch'}
  # All read-only checks precede this one-shot mutation boundary.
  @{version='0.10.1';experimentId=$expectedExperiment;legacyReportSha256=$legacyReportHash;legacyManifestSha256=$legacyManifestHash}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'scope-resume-intent.json') -Encoding UTF8
  $OrdinaryUserSid=$expectedUser;$experiment=$expectedExperiment
  $manifest=Package $PSScriptRoot;$null=New-Item -ItemType Directory -Path $bin
  foreach($f in $manifest.files){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $f.name) -Destination (Join-Path $bin $f.name)}
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'package-manifest.json') -Destination (Join-Path $bin 'package-manifest.json')
  Rules $bin @() @((Sid $names[0]),(Sid $names[1]),$OrdinaryUserSid);$null=Package $bin
  for($i=0;$i-lt3;$i++){Invoke-ServiceControl -Words @('config',$names[$i],'binPath=',('"'+$exe+'" --service '+$roles[$i]))}
  AssertStoppedServices $exe
  $verify1=Run 'guardian' 'verify' $experiment
  foreach($label in @('restricted','app-readable')){foreach($suffix in @('reopen-policy-decrypt','private-export-denied')){if(-not(Pass $verify1 ('guardian.'+$label+'.'+$suffix))){throw 'Guardian gate failed; retain state'}}}
  if(-not(Pass $verify1 'guardian.envelope-negative-matrix')){throw 'Envelope negative matrix failed; retain state'}
  $probe=Run 'app' 'probe' $experiment
  foreach($actor in @('app','child')){if(-not(Pass $probe ($actor+'.restricted.open') @('OBSERVED_BAD_KEYSET','PASS_ACCESS_DENIED'))-or-not(Pass $probe ($actor+'.app-readable.open-decrypt-control'))){throw 'App contrast failed; retain state'}}
  if(-not(Pass $probe 'app.child-probe-execution')-or-not(Pass $probe 'child.token-identity')){throw 'Child gate failed; retain state'}
  $run=[guid]::NewGuid().ToString('N');Plan 'probe-user' $run $experiment
  @{scope='TEST_ONLY_SOFTWARE_KSP_WRAPPING_V3';version='0.10.1';experimentId=$experiment;runId=$run;userSid=$OrdinaryUserSid;binaryHash=(Get-FileHash -LiteralPath $exe).Hash.ToLowerInvariant();legacyReportSha256=$legacyReportHash;installedBin=$bin}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'prepared.json') -Encoding UTF8
  AssertStoppedServices $exe
  Write-Host 'PREPARED. Run Run-User-Probe.ps1 from THIS package in NON-elevated PowerShell, then Finish elevated. Never rerun ResumeScopeFailure.'
  exit
}
Plain $root
$installed=Package $bin
$local=Package $PSScriptRoot
if((Get-FileHash -LiteralPath (Join-Path $bin 'package-manifest.json')).Hash-cne(Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'package-manifest.json')).Hash){throw 'Installed/package manifest mismatch'}
if(Test-Path -LiteralPath (Join-Path $root 'finish-intent.json')){throw 'Finish already attempted; retain state'}
$prepared=Get-Content -LiteralPath (Join-Path $root 'prepared.json') -Raw|ConvertFrom-Json
$plan=Get-Content -LiteralPath (Join-Path $root 'plan.json') -Raw|ConvertFrom-Json
$OrdinaryUserSid=[string]$prepared.userSid;$experiment=[string]$prepared.experimentId
if($prepared.scope-cne'TEST_ONLY_SOFTWARE_KSP_WRAPPING_V3'-or$prepared.version-cne'0.10.1'-or$prepared.installedBin-cne$bin-or$experiment-cne$expectedExperiment-or$OrdinaryUserSid-cne$expectedUser-or$plan.Action-cne'probe-user'-or$plan.ExperimentId-cne$experiment-or$plan.RunId-cne$prepared.runId-or$plan.OrdinaryUserSid-cne$OrdinaryUserSid-or$plan.BinaryHash-cne$prepared.binaryHash-or$prepared.binaryHash-cne(Get-FileHash -LiteralPath $exe).Hash.ToLowerInvariant()){throw 'Prepared plan mismatch'}
AssertStoppedServices $exe
if(-not$UserReport){throw 'Supply the exact user report path'}
Plain $UserReport;$file=Get-Item -LiteralPath $UserReport;if($file.Length-lt1-or$file.Length-gt262144){throw 'Report size invalid'}
$userBytes=[IO.File]::ReadAllBytes($file.FullName);$sha=[Security.Cryptography.SHA256]::Create();try{$userHash=([BitConverter]::ToString($sha.ComputeHash($userBytes))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
$user=[Text.Encoding]::UTF8.GetString($userBytes)|ConvertFrom-Json
if($user.scope-cne'TEST_ONLY_SOFTWARE_KSP_WRAPPING_V3'-or$user.role-cne'interactive'-or$user.action-cne'probe-user'-or$user.experimentId-cne$experiment-or$user.runId-cne$prepared.runId-or$user.binarySha256-cne$prepared.binaryHash-or$user.userSid-cne$OrdinaryUserSid-or$user.elevated-ne$false-or$user.administrator-ne$false-or$user.integrity-ne8192-or(($user.interactiveGroupAttributes-band4)-eq0)-or(($user.interactiveGroupAttributes-band16)-ne0)-or$user.securityAccepted-ne$false-or$user.productionAccepted-ne$false-or$user.matrixAccepted-ne$false){throw 'User report/token mismatch'}
if(-not(Pass $user 'interactive.restricted.open' @('OBSERVED_BAD_KEYSET','PASS_ACCESS_DENIED'))-or-not(Pass $user 'interactive.app-readable.open-decrypt-control')-or-not(Pass $user 'interactive.token-identity')){throw 'User contrast failed; retain state'}
$tokenResult=@($user.results|Where-Object Id -CEQ 'interactive.token-identity');$expectedClass=if($user.elevationType-eq3){'FILTERED_ADMIN_INTERACTIVE_TOKEN'}else{'NON_ELEVATED_INTERACTIVE_TOKEN'}
if($tokenResult[0].Stage-cne$OrdinaryUserSid-or$user.elevationType-notin@(1,3)-or$user.accountClass-cne$expectedClass){throw 'User token classification mismatch'}
$user.results|Format-Table Id,Status,Stage,Error -AutoSize|Out-Host
@{experimentId=$experiment;userReportSha256=$userHash}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'finish-intent.json') -Encoding UTF8
# Capture the exact parsed bytes, not a second read of a user-writable path.
[IO.File]::WriteAllBytes((Join-Path $root 'interactive-evidence.json'),$userBytes)
$verify2=Run 'guardian' 'verify' $experiment
foreach($label in @('restricted','app-readable')){foreach($suffix in @('reopen-policy-decrypt','private-export-denied')){if(-not(Pass $verify2 ('guardian.'+$label+'.'+$suffix))){throw 'Post-user Guardian gate failed; retain state'}}}
if(-not(Pass $verify2 'guardian.envelope-negative-matrix')){throw 'Post-user tamper gate failed'}
$cleanup=Run 'setup' 'cleanup' $experiment;foreach($label in @('restricted','app-readable')){if(-not(Pass $cleanup ('setup.'+$label+'.delete-owned-key'))){throw 'Cleanup unconfirmed; retain state'}}
$summary=@{schemaVersion=1;version='0.10.1';legacyReportSha256=$prepared.legacyReportSha256;scope='TEST_ONLY_SOFTWARE_KSP_WRAPPING_V3';experimentId=$experiment;platformPolicy='WINDOWS_10_11_X64_BUILD_14393_PLUS_NO_LIFECYCLE_GATE';vendorLifecycleNotRequired=$true;osCaption=$caption;osBuild=$build;displayVersion=$displayVersion;hostFeasibilityPassed=$true;securityAccepted=$false;productionAccepted=$false;matrixAccepted=$false;ordinaryUserNotTested=$false;interactiveAccountClass=$user.accountClass;standardAccountSeparatelyTested=$false;userReportSha256=$userHash;packageManifestSha256=(Get-FileHash -LiteralPath (Join-Path $bin 'package-manifest.json')).Hash.ToLowerInvariant();roleReports=@(Get-ChildItem -LiteralPath $root -Directory | Where-Object Name -Like '*-reports' | ForEach-Object {Get-ChildItem -LiteralPath $_.FullName -File} | ForEach-Object {@{name=$_.FullName;sha256=(Get-FileHash -LiteralPath $_.FullName).Hash.ToLowerInvariant()}});services=@($names|ForEach-Object{Get-CimInstance Win32_Service -Filter "Name='$_'"|Select-Object Name,State,StartMode,StartName,PathName});timeUtc=[DateTime]::UtcNow.ToString('o')};$path=Join-Path $root ('wrapping-summary-'+[guid]::NewGuid().ToString('N')+'.json');$summary|ConvertTo-Json -Depth 5|Set-Content -LiteralPath $path -Encoding UTF8;Write-Host ('Report: '+$path)
