# Fresh, test-only LIC008 Software-KSP wrapping-key feasibility run.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateSet('Prepare','Repair')][string]$Stage)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'Ecs.Lic008.WrappingV5'
$names=@('Ecs.Lic008.WrappingV5.Guardian','Ecs.Lic008.WrappingV5.App','Ecs.Lic008.WrappingV5.Setup')
$roles=@('guardian','app','setup')
$sc=Join-Path $env:SystemRoot 'System32/sc.exe'
$exe=Join-Path $root 'bin/Ecs.Lic008.WrappingV5.exe'

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
function Package([string]$Dir){
  Plain $Dir;$m=Get-Content -LiteralPath (Join-Path $Dir 'package-manifest.json') -Raw|ConvertFrom-Json
  if($m.checklistId-ne'LIC-6.2-008'-or$m.scope-ne'TEST_ONLY_SOFTWARE_KSP_WRAPPING_V5'-or$m.version-ne'0.12.0'){throw 'Wrong package identity'}
  $seen=@{};foreach($f in $m.files){if($f.name-notmatch'^[A-Za-z0-9][A-Za-z0-9._-]*\.(dll|exe|json|pdb|txt|ps1)$'-or$seen.ContainsKey($f.name)){throw 'Invalid package entry'};$seen[$f.name]=$true;$path=Join-Path $Dir $f.name;if((Get-Item -LiteralPath $path).Length-ne$f.size-or(Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant()-cne$f.sha256){throw 'Package hash mismatch'}}
  foreach($f in Get-ChildItem -LiteralPath $Dir -File -Force){if($f.Name-ne'package-manifest.json'-and-not$seen.ContainsKey($f.Name)){throw 'Unexpected package content'}}
  foreach($needed in @('Ecs.Lic008.WrappingV5.exe','Run-Wrapping-Repair.ps1','README-fa.txt')){if(-not$seen.ContainsKey($needed)){throw 'Incomplete package'}};$m
}
function Plan([string]$Action,[string]$Run,[string]$Experiment){@{Action=$Action;RunId=$Run;ExperimentId=$Experiment;BinaryHash=(Get-FileHash -LiteralPath $exe).Hash.ToLowerInvariant()}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'plan.json') -Encoding UTF8}
function Run([string]$Role,[string]$Action,[string]$Experiment){
  $run=[guid]::NewGuid().ToString('N');Plan $Action $run $Experiment;$index=[Array]::IndexOf($roles,$Role);$report=Join-Path $root ($Role+'-reports/'+$run+'.json');Invoke-ServiceControl -Words @('start',$names[$index]);$watch=[Diagnostics.Stopwatch]::StartNew();do{Start-Sleep -Milliseconds 250;$service=Get-Service -Name $names[$index];if($service.Status-eq'Stopped'){break}}while($watch.Elapsed.TotalSeconds-lt120)
  if($service.Status-ne'Stopped'){Invoke-ServiceControl -Words @('stop',$names[$index]);throw 'Probe timeout; retain state'};if(-not(Test-Path -LiteralPath $report)){throw 'Missing report; retain state'};$r=Get-Content -LiteralPath $report -Raw|ConvertFrom-Json
  AssertReportIdentity $r $Role $Action $run $Experiment (Get-FileHash -LiteralPath $exe).Hash.ToLowerInvariant();$r.results|Format-Table Id,Status,Stage,Error -AutoSize|Out-Host;$r
}
function Pass($Report,[string]$Id,[string[]]$Status=@('PASS')){$x=@($Report.results|Where-Object{$_.Id-ceq$Id});$x.Count-eq1-and$x[0].Status-in$Status}


function AssertReportIdentity($Report,[string]$Role,[string]$Action,[string]$Run,[string]$Experiment,[string]$Hash){
  if($Report.schemaVersion-ne1-or$Report.checklistId-cne'LIC-6.2-008'-or$Report.scope-cne'TEST_ONLY_SOFTWARE_KSP_WRAPPING_V5'-or$Report.role-cne$Role-or$Report.action-cne$Action-or$Report.runId-cne$Run-or$Report.experimentId-cne$Experiment-or$Report.binarySha256-cne$Hash-or$Report.serviceIdentityMatched-ne$true-or$Report.productionAccepted-ne$false-or$Report.securityAccepted-ne$false){throw 'Report mismatch'}
}
function AssertStoppedServices{
  foreach($name in $names){
    $svc=Get-CimInstance Win32_Service -Filter "Name='$name'";$idx=[Array]::IndexOf($names,$name);$account=if($idx-eq2){'LocalSystem'}else{'NT SERVICE\'+$name}
    if($null-eq$svc-or$svc.State-cne'Stopped'-or$svc.StartMode-cne'Manual'-or$svc.StartName-cne$account-or$svc.PathName-cne('"'+$exe+'" --service '+$roles[$idx])-or$svc.ProcessId-ne0){throw 'Service configuration changed'}
    $reg=Get-ItemProperty -LiteralPath ('HKLM:\SYSTEM\CurrentControlSet\Services\'+$name)
    if($reg.ServiceSidType-ne1){throw 'Service SID configuration changed'}
  }
}
function AssertApp($Report){
  foreach($actor in @('app','child')){if(-not(Pass $Report ($actor+'.restricted.open') @('OBSERVED_BAD_KEYSET','PASS_ACCESS_DENIED'))-or-not(Pass $Report ($actor+'.app-readable.open-decrypt-control'))){throw 'App contrast failed; retain state'}}
  if(-not(Pass $Report 'app.child-probe-execution')-or-not(Pass $Report 'child.token-identity')){throw 'Child gate failed; retain state'}
}
function EvidenceInventory{
  $items=@()
  foreach($dir in @('shared','setup-reports','guardian-reports','app-reports')){
    $path=Join-Path $root $dir;Plain $path
    foreach($f in Get-ChildItem -LiteralPath $path -Force){
      if($f.PSIsContainer-or$f.Name-notmatch'^[A-Za-z0-9][A-Za-z0-9._-]*\.json$'){throw 'Unexpected evidence entry'}
      Plain $f.FullName
      $items+=@{relative=($dir+'/'+$f.Name);sha256=(Get-FileHash -LiteralPath $f.FullName).Hash.ToLowerInvariant()}
    }
  }
  @($items|Sort-Object { $_.relative })
}
function AssertInventory($Expected,$Actual){
  if(@($Expected).Count-ne@($Actual).Count){throw 'Retained evidence count changed'}
  for($i=0;$i-lt@($Expected).Count;$i++){if($Expected[$i].relative-cne$Actual[$i].relative-or$Expected[$i].sha256-cne$Actual[$i].sha256){throw 'Retained evidence hash changed'}}
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
$bootUtc=([DateTime]$os.LastBootUpTime).ToUniversalTime().ToString('o')
$machineRaw=[string](Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Cryptography').MachineGuid
$machineGuid=[guid]::Empty;if(-not[guid]::TryParse($machineRaw,[ref]$machineGuid)-or$machineGuid-eq[guid]::Empty){throw 'Missing machine identity'}
$hasher=[Security.Cryptography.SHA256]::Create();try{$machineHash=([BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($machineGuid.ToString('D'))))).Replace('-','').ToLowerInvariant()}finally{$hasher.Dispose()}


function SharedInventory{
  @(EvidenceInventory | Where-Object { $_.relative.StartsWith('shared/',[StringComparison]::Ordinal) })
}
function AssertRepairAdmission($Report){
  $required=@('guardian.restricted.reopen-policy-decrypt','guardian.restricted.private-export-denied','guardian.app-readable.reopen-policy-decrypt','guardian.app-readable.private-export-denied','guardian.envelope-negative-matrix')
  if(@($Report.results).Count-ne5){throw 'Repair admission refused; RECOVERY_REQUIRED'}
  foreach($id in $required){if(-not(Pass $Report $id)){throw 'Repair admission refused; RECOVERY_REQUIRED'}}
}
function Invoke-RepairBoundary([string]$Experiment,$SharedHashes,[string]$Destination){
  $null=Package $PSScriptRoot;$null=Package (Split-Path -Parent $exe)
  AssertStoppedServices
  AssertInventory $SharedHashes @(SharedInventory)
  # The same physical key/policy gate runs for valid and missing-key cases.
  $script:admissionReport=Run 'guardian' 'verify' $Experiment
  AssertRepairAdmission $script:admissionReport
  # NO candidate-directory, ACL or service-path mutation before admission.
  $expectedDestination=Join-Path $root 'bin-repaired'
  if($Destination-cne$expectedDestination){throw 'Unexpected repair destination'}
  Plain $Destination
  if(Test-Path -LiteralPath (Join-Path $root 'repair-intent.json')){throw 'Binary repair already attempted'}
  if(Test-Path -LiteralPath $Destination){throw 'Fresh candidate directory required'}
  @{experimentId=$Experiment;admissionRunId=$script:admissionReport.runId;target=$Destination}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'repair-intent.json') -Encoding UTF8
  $manifest=Package $PSScriptRoot;$null=New-Item -ItemType Directory -Path $Destination
  foreach($entry in $manifest.files){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $entry.name) -Destination (Join-Path $Destination $entry.name)}
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'package-manifest.json') -Destination (Join-Path $Destination 'package-manifest.json')
  Rules $Destination @() @((Sid $names[0]),(Sid $names[1]))
  $null=Package $Destination
  if((Get-FileHash -LiteralPath (Join-Path $Destination 'package-manifest.json')).Hash-cne(Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'package-manifest.json')).Hash){throw 'Candidate package mismatch'}
  $script:exe=Join-Path $Destination 'Ecs.Lic008.WrappingV5.exe'
  for($i=0;$i-lt3;$i++){Invoke-ServiceControl -Words @('config',$names[$i],'binPath=',('"'+$exe+'" --service '+$roles[$i]))}
  AssertStoppedServices
}
if($Stage-eq'Prepare'){
Plain $root;if(Test-Path -LiteralPath $root){throw 'Fresh test root required; never overwrite'};foreach($n in $names){if(Get-Service -Name $n -ErrorAction SilentlyContinue){throw 'Fresh service names required'}}
$manifest=Package $PSScriptRoot;$null=New-Item -ItemType Directory -Path $root;Rules $root @() @();@{scope='TEST_ONLY_SOFTWARE_KSP_WRAPPING_V5';root=$root;createdUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'installation.json') -Encoding UTF8
$bin=Join-Path $root 'bin';$null=New-Item -ItemType Directory -Path $bin;foreach($f in $manifest.files){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $f.name) -Destination (Join-Path $bin $f.name)};Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'package-manifest.json') -Destination (Join-Path $bin 'package-manifest.json');$null=Package $bin
for($i=0;$i-lt3;$i++){Invoke-ServiceControl -Words @('create',$names[$i],'binPath=',('"'+$exe+'" --service '+$roles[$i]),'start=','demand','type=','own','obj=',$(if($roles[$i]-eq'setup'){'LocalSystem'}else{'NT SERVICE\'+$names[$i]}));Invoke-ServiceControl -Words @('sidtype',$names[$i],'unrestricted')}
$g=Sid $names[0];$a=Sid $names[1];Rules $root @() @($g,$a);Rules $bin @() @($g,$a);foreach($d in @('protected','shared','guardian-reports','app-reports','setup-reports')){$null=New-Item -ItemType Directory -Path (Join-Path $root $d)};Rules (Join-Path $root 'protected') @($g) @() $false;Rules (Join-Path $root 'shared') @($g) @($a);Rules (Join-Path $root 'guardian-reports') @($g) @();Rules (Join-Path $root 'app-reports') @($a) @();Rules (Join-Path $root 'setup-reports') @() @()
$experiment=[guid]::NewGuid().ToString('N');$create=Run 'setup' 'create' $experiment
foreach($id in @('setup.restricted.create-rsa-wrapping-key','setup.app-readable.create-rsa-wrapping-key','setup.publish-control-set')){if(-not(Pass $create $id)){throw 'Creation gate failed; retain state'}}
$verify1=Run 'guardian' 'verify' $experiment;foreach($label in @('restricted','app-readable')){foreach($suffix in @('reopen-policy-decrypt','private-export-denied')){if(-not(Pass $verify1 ('guardian.'+$label+'.'+$suffix))){throw 'Guardian gate failed; retain state'}}};if(-not(Pass $verify1 'guardian.envelope-negative-matrix')){throw 'Envelope negative matrix failed; retain state'}
$probe=Run 'app' 'probe' $experiment;foreach($actor in @('app','child')){if(-not(Pass $probe ($actor+'.restricted.open') @('OBSERVED_BAD_KEYSET','PASS_ACCESS_DENIED'))-or-not(Pass $probe ($actor+'.app-readable.open-decrypt-control'))){throw 'App contrast failed; retain state'}};if(-not(Pass $probe 'app.child-probe-execution')-or-not(Pass $probe 'child.token-identity')){throw 'Child gate failed; retain state'}


  AssertStoppedServices
  $files=EvidenceInventory
  if($files.Count-ne7){throw 'Unexpected prepare evidence count'}
  @{schemaVersion=1;scope='TEST_ONLY_SOFTWARE_KSP_WRAPPING_V5';version='0.12.0';experimentId=$experiment;preparedUtc=[DateTime]::UtcNow.ToString('o');machineSha256=$machineHash;osCaption=$caption;osBuild=$build;packageManifestSha256=(Get-FileHash -LiteralPath (Join-Path $root 'bin/package-manifest.json')).Hash.ToLowerInvariant();planSha256=(Get-FileHash -LiteralPath (Join-Path $root 'plan.json')).Hash.ToLowerInvariant();files=$files;securityAccepted=$false;productionAccepted=$false;matrixAccepted=$false}|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $root 'repair-checkpoint.json') -Encoding UTF8
  Write-Host 'PREPARED_FOR_REPAIR. Keys retained; services Stopped/Manual. Send output before running Repair once from THIS package. No reboot required.'
  exit
}

Plain $root
foreach($marker in @('repair-run-intent.json','repair-intent.json')){if(Test-Path -LiteralPath (Join-Path $root $marker)){throw 'Repair already attempted; retain state'}}
$null=Package $PSScriptRoot;$null=Package (Join-Path $root 'bin')
$checkpointPath=Join-Path $root 'repair-checkpoint.json';Plain $checkpointPath
$checkpoint=Get-Content -LiteralPath $checkpointPath -Raw|ConvertFrom-Json
$checkpointHash=(Get-FileHash -LiteralPath $checkpointPath).Hash.ToLowerInvariant()
if($checkpoint.schemaVersion-ne1-or$checkpoint.scope-cne'TEST_ONLY_SOFTWARE_KSP_WRAPPING_V5'-or$checkpoint.version-cne'0.12.0'-or$checkpoint.machineSha256-cne$machineHash-or$checkpoint.osBuild-ne$build-or$checkpoint.osCaption-cne$caption-or$checkpoint.securityAccepted-ne$false-or$checkpoint.productionAccepted-ne$false-or$checkpoint.matrixAccepted-ne$false){throw 'Repair checkpoint identity mismatch'}
$experiment=[string]$checkpoint.experimentId
$experimentGuid=[guid]::Empty;if(-not[guid]::TryParseExact($experiment,'N',[ref]$experimentGuid)){throw 'Invalid experiment'}
if($checkpoint.packageManifestSha256-cne(Get-FileHash -LiteralPath (Join-Path $root 'bin/package-manifest.json')).Hash.ToLowerInvariant()-or$checkpoint.packageManifestSha256-cne(Get-FileHash -LiteralPath (Join-Path $PSScriptRoot 'package-manifest.json')).Hash.ToLowerInvariant()){throw 'Installed/package manifest mismatch'}
Plain (Join-Path $root 'plan.json')
if($checkpoint.planSha256-cne(Get-FileHash -LiteralPath (Join-Path $root 'plan.json')).Hash.ToLowerInvariant()){throw 'Paused plan changed'}
$pausedPlan=Get-Content -LiteralPath (Join-Path $root 'plan.json') -Raw|ConvertFrom-Json
if($pausedPlan.Action-cne'probe'-or$pausedPlan.ExperimentId-cne$experiment-or$pausedPlan.BinaryHash-cne(Get-FileHash -LiteralPath $exe).Hash.ToLowerInvariant()){throw 'Paused plan identity mismatch'}
AssertInventory @($checkpoint.files) @(EvidenceInventory)
AssertStoppedServices
$sharedBefore=@(SharedInventory)
if($sharedBefore.Count-ne4){throw 'Unexpected shared baseline'}
@{checkpointSha256=$checkpointHash;experimentId=$experiment}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'repair-run-intent.json') -Encoding UTF8
Invoke-RepairBoundary $experiment $sharedBefore (Join-Path $root 'bin-repaired')
# New executable path, same persisted protected identity and byte-identical envelopes.
$after=Run 'guardian' 'verify' $experiment;AssertRepairAdmission $after
$probe2=Run 'app' 'probe' $experiment;AssertApp $probe2
AssertInventory $sharedBefore @(SharedInventory)
AssertStoppedServices
$cleanup=Run 'setup' 'cleanup' $experiment
foreach($label in @('restricted','app-readable')){if(-not(Pass $cleanup ('setup.'+$label+'.delete-owned-key'))){throw 'Cleanup unconfirmed; retain state'}}
AssertStoppedServices
# Owned deletion above independently checked native key absence. Retain all envelopes.
$script:admissionReport=$null;$refused=$false
try{Invoke-RepairBoundary $experiment $sharedBefore (Join-Path $root 'bin-repaired')}catch{if($_.Exception.Message-cne'Repair admission refused; RECOVERY_REQUIRED'){throw};$refused=$true}
if(-not$refused-or$null-eq$script:admissionReport){throw 'Missing-key repair was not refused'}
foreach($label in @('restricted','app-readable')){
  $row=@($script:admissionReport.results|Where-Object Id -CEQ ('guardian.'+$label+'.reopen-policy-decrypt'))
  if($row.Count-ne1-or$row[0].Status-cne'FAILED_OR_UNAVAILABLE'){throw 'Missing-key diagnostic mismatch'}
}
Write-Host 'PASS: controlled missing-key repair refused with retained envelopes; no candidate/service/key recreation.'
AssertInventory $sharedBefore @(SharedInventory)
AssertStoppedServices
$summary=@{schemaVersion=1;version='0.12.0';scope='TEST_ONLY_SOFTWARE_KSP_WRAPPING_V5';experimentId=$experiment;checkpointSha256=$checkpointHash;repairSimulationPassed=$true;sameKeyIdentityVerified=$true;sameEnvelopeBytesVerified=$true;missingKeyRepairRefused=$true;keyRecreationAttempted=$false;productionRepairTested=$false;hostFeasibilityPassed=$true;securityAccepted=$false;productionAccepted=$false;matrixAccepted=$false;ordinaryUserNotTested=$true;osCaption=$caption;osBuild=$build;displayVersion=$displayVersion;platformPolicy='WINDOWS_10_11_X64_BUILD_14393_PLUS_NO_LIFECYCLE_GATE';vendorLifecycleNotRequired=$true;originalPackageManifestSha256=$checkpoint.packageManifestSha256;repairedPackageManifestSha256=(Get-FileHash -LiteralPath (Join-Path (Split-Path -Parent $exe) 'package-manifest.json')).Hash.ToLowerInvariant();missingKeyProbeRunId=$script:admissionReport.runId;evidenceFiles=(EvidenceInventory);services=@($names|ForEach-Object{Get-CimInstance Win32_Service -Filter "Name='$_'"|Select-Object Name,State,StartMode,StartName,PathName});timeUtc=[DateTime]::UtcNow.ToString('o')}
$path=Join-Path $root ('wrapping-summary-'+[guid]::NewGuid().ToString('N')+'.json');$summary|ConvertTo-Json -Depth 6|Set-Content -LiteralPath $path -Encoding UTF8;Write-Host ('Report: '+$path)
