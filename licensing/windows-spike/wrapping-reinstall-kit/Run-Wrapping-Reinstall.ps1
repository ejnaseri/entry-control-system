# LIC-6.2-008 TEST ONLY retained-data service-registration Uninstall/Reinstall simulation.
[CmdletBinding()]param([Parameter(Mandatory=$true)][ValidateSet('Prepare','Uninstall','Reinstall')][string]$Stage)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'Ecs.Lic008.WrappingV7'
$names=@('Ecs.Lic008.WrappingV7.Guardian','Ecs.Lic008.WrappingV7.App','Ecs.Lic008.WrappingV7.Setup')
$roles=@('guardian','app','setup')
$scope='TEST_ONLY_SOFTWARE_KSP_WRAPPING_V7'
$sc=Join-Path $env:SystemRoot 'System32/sc.exe'
$activeVersion='0.14.0'
$exe=Join-Path $root 'bin/Ecs.Lic008.WrappingV7.exe'
$kitRoot=$PSScriptRoot
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
function HashFile([string]$Path){ Plain $Path; (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function WriteNewJson([string]$Path,$Value){
  Plain $Path
  $bytes=[Text.Encoding]::UTF8.GetBytes(($Value|ConvertTo-Json -Depth 12))
  $stream=New-Object IO.FileStream($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
  try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
}
function CheckFiles([string]$Dir,$Entries,[bool]$Nested=$false){
  Plain $Dir; $seen=@{}
  foreach($f in $Entries){
    $pattern=if($Nested){'^(?:(?:BIN)/)?[A-Za-z0-9][A-Za-z0-9._-]*\.(dll|exe|json|pdb|txt|ps1)$'}else{'^[A-Za-z0-9][A-Za-z0-9._-]*\.(dll|exe|json|pdb|txt|ps1)$'}
    if($f.name -cnotmatch $pattern -or $seen.ContainsKey($f.name) -or $f.size -le 0 -or $f.sha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'Invalid package entry'}
    $seen[$f.name]=$true;$p=Join-Path $Dir $f.name;Plain $p;$item=Get-Item -LiteralPath $p -Force
    if($item.PSIsContainer -or $item.Length -ne $f.size -or (HashFile $p) -cne $f.sha256){throw 'Package hash mismatch'}
  }
  foreach($item in Get-ChildItem -LiteralPath $Dir -Force -Recurse){
    Plain $item.FullName
    $relative=$item.FullName.Substring($Dir.TrimEnd('\','/').Length+1).Replace('\','/')
    if($item.PSIsContainer){
      if(-not$Nested -or $relative -cnotin @('BIN')){throw 'Unexpected package directory'}
    }elseif($relative -cne $(if($Nested){'reinstall-kit-manifest.json'}else{'package-manifest.json'}) -and -not$seen.ContainsKey($relative)){throw 'Unexpected package content'}
  }
  $seen
}
function Package([string]$Dir,[string]$Version){
  Plain $Dir
  if($Version -cnotin @('0.14.0')){throw 'Unknown artifact version'}
  $m=Get-Content -LiteralPath (Join-Path $Dir 'package-manifest.json') -Raw|ConvertFrom-Json
  if($m.schemaVersion -ne 1 -or $m.checklistId -cne 'LIC-6.2-008' -or $m.scope -cne $scope -or $m.version -cne $Version -or $m.sdk -cne '10.0.400' -or $m.runtime -cne '10.0.11'){throw 'Wrong package identity'}
  $seen=CheckFiles $Dir $m.files
  foreach($needed in @('Ecs.Lic008.WrappingV7.exe','Ecs.Lic008.WrappingV7.dll','Ecs.Lic008.WrappingV7.deps.json','Ecs.Lic008.WrappingV7.runtimeconfig.json')){
    if(-not$seen.ContainsKey($needed)){throw 'Incomplete package'}
  }
  $m
}
function ArtifactEvidence([string]$Dir,[string]$Version){
  $null=Package $Dir $Version
  @{version=$Version;exeSha256=(HashFile (Join-Path $Dir 'Ecs.Lic008.WrappingV7.exe'));assemblySha256=(HashFile (Join-Path $Dir 'Ecs.Lic008.WrappingV7.dll'));manifestSha256=(HashFile (Join-Path $Dir 'package-manifest.json'))}
}
function Plan([string]$Action,[string]$Run,[string]$Experiment){
  $artifact=ArtifactEvidence (Split-Path -Parent $exe) $activeVersion
  @{Action=$Action;RunId=$Run;ExperimentId=$Experiment;BinaryHash=$artifact.exeSha256;ArtifactVersion=$activeVersion;AssemblyHash=$artifact.assemblySha256;PackageHash=$artifact.manifestSha256}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'plan.json') -Encoding UTF8
}
function AssertReportIdentity($Report,[string]$Role,[string]$Action,[string]$Run,[string]$Experiment,$Artifact){
  if($Report.schemaVersion -ne 1 -or $Report.checklistId -cne 'LIC-6.2-008' -or $Report.scope -cne $scope -or $Report.role -cne $Role -or $Report.action -cne $Action -or $Report.runId -cne $Run -or $Report.experimentId -cne $Experiment -or $Report.binarySha256 -cne $Artifact.exeSha256 -or $Report.artifactVersion -cne $Artifact.version -or $Report.managedAssemblySha256 -cne $Artifact.assemblySha256 -or $Report.packageManifestSha256 -cne $Artifact.manifestSha256 -or $Report.serviceIdentityMatched -ne $true -or $Report.productionAccepted -ne $false -or $Report.securityAccepted -ne $false -or $Report.productionUninstallTested -ne $false -or $Report.productionReinstallTested -ne $false){throw 'Report mismatch'}
}
function Pass($Report,[string]$Id,[string[]]$Status=@('PASS')){$x=@($Report.results|Where-Object{$_.Id-ceq$Id});$x.Count-eq1-and$x[0].Status-in$Status}
function ServiceRows {
  @($names|ForEach-Object{
    $svc=Get-CimInstance Win32_Service -Filter "Name='$_'"
    if($null -eq $svc){throw 'Service missing'}
    $reg=Get-ItemProperty -LiteralPath ('HKLM:\SYSTEM\CurrentControlSet\Services\'+$_)
    [pscustomobject]@{Name=$svc.Name;State=$svc.State;StartMode=$svc.StartMode;StartName=$svc.StartName;PathName=$svc.PathName;ProcessId=$svc.ProcessId;ServiceSidType=$reg.ServiceSidType;ServiceSid=(Sid $_)}
  })
}
function AssertVersionSet($Rows,[string]$ExpectedExe){
  if(@($Rows).Count -ne 3){throw 'Incomplete service set'}
  foreach($idx in 0..2){
    $row=@($Rows|Where-Object Name -CEQ $names[$idx])
    $account=if($idx -eq 2){'LocalSystem'}else{'NT SERVICE\'+$names[$idx]}
    if($row.Count -ne 1){throw 'Duplicate/missing service'}
    $svc=$row[0]
    if($svc.State -cne 'Stopped' -or $svc.StartMode -cne 'Manual' -or $svc.StartName -cne $account -or $svc.PathName -cne ('"'+$ExpectedExe+'" --service '+$roles[$idx]) -or $svc.ProcessId -ne 0 -or $svc.ServiceSidType -ne 1){throw 'Mixed version or service identity; retain state'}
  }
}
function AssertStoppedServices { AssertVersionSet @(ServiceRows) $exe }
function Run([string]$Role,[string]$Action,[string]$Experiment){
  # NO plan write/start until the ENTIRE stopped role version set is verified.
  AssertProbeAdmission $Experiment
  $artifact=ArtifactEvidence (Split-Path -Parent $exe) $activeVersion
  $run=[guid]::NewGuid().ToString('N');Plan $Action $run $Experiment
  $index=[Array]::IndexOf($roles,$Role);if($index -lt 0){throw 'Invalid role'}
  $report=Join-Path $root ($Role+'-reports/'+$run+'.json')
  Invoke-ServiceControl -Words @('start',$names[$index])
  $watch=[Diagnostics.Stopwatch]::StartNew()
  do{Start-Sleep -Milliseconds 250;$service=Get-Service -Name $names[$index];if($service.Status -eq 'Stopped'){break}}while($watch.Elapsed.TotalSeconds -lt 120)
  if($service.Status -ne 'Stopped'){Invoke-ServiceControl -Words @('stop',$names[$index]);throw 'Probe timeout; retain state'}
  Plain $report;$r=Get-Content -LiteralPath $report -Raw|ConvertFrom-Json
  AssertReportIdentity $r $Role $Action $run $Experiment $artifact
  $r.results|Format-Table Id,Status,Stage,Error -AutoSize|Out-Host;$r
}
function AssertApp($Report){
  foreach($actor in @('app','child')){
    if(-not(Pass $Report ($actor+'.restricted.open') @('OBSERVED_BAD_KEYSET','PASS_ACCESS_DENIED')) -or -not(Pass $Report ($actor+'.app-readable.open-decrypt-control'))){throw 'App contrast failed; retain state'}
  }
  foreach($id in @('app.child-probe-execution','child.token-identity','child.artifact-identity')){if(-not(Pass $Report $id)){throw 'Child gate failed; retain state'}}
}
function EvidenceInventory{
  $items=@()
  foreach($dir in @('shared','setup-reports','guardian-reports','app-reports')){
    $path=Join-Path $root $dir;Plain $path
    foreach($f in Get-ChildItem -LiteralPath $path -Force){
      if($f.PSIsContainer-or$f.Name-notmatch'^[A-Za-z0-9][A-Za-z0-9._-]*\.json$'){throw 'Unexpected evidence entry'}
      Plain $f.FullName
      $items+=@{relative=($dir+'/'+$f.Name);sha256=(HashFile $f.FullName);daclSha256=(AclHash $f.FullName)}
    }
  }
  @($items|Sort-Object { $_.relative })
}
function AssertInventory($Expected,$Actual){
  if(@($Expected).Count-ne@($Actual).Count){throw 'Retained evidence count changed'}
  for($i=0;$i-lt@($Expected).Count;$i++){if($Expected[$i].relative-cne$Actual[$i].relative-or$Expected[$i].sha256-cne$Actual[$i].sha256-or$Expected[$i].daclSha256-cne$Actual[$i].daclSha256){throw 'Retained evidence hash changed'}}
}
function AssertGuardian($Report){
  $required=@('guardian.restricted.reopen-policy-decrypt','guardian.restricted.private-export-denied','guardian.app-readable.reopen-policy-decrypt','guardian.app-readable.private-export-denied','guardian.envelope-negative-matrix','guardian.protected-inventory')
  if(@($Report.results).Count-ne6){throw 'Retained-key admission refused; RECOVERY_REQUIRED'}
  foreach($id in $required){if(-not(Pass $Report $id)){throw 'Retained-key admission refused; RECOVERY_REQUIRED'}}
}
function SharedInventory { @(EvidenceInventory|Where-Object{$_.relative.StartsWith('shared/',[StringComparison]::Ordinal)}) }

function Kit([string]$Dir){
  Plain $Dir;$path=Join-Path $Dir 'reinstall-kit-manifest.json';Plain $path
  $m=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
  if($m.schemaVersion -ne 1 -or $m.checklistId -cne 'LIC-6.2-008' -or $m.scope -cne $scope -or $m.version -cne '0.14.0'){throw 'Wrong kit'}
  $seen=CheckFiles $Dir $m.files $true
  foreach($needed in @('Run-Wrapping-Reinstall.ps1','README-fa.txt','BIN/package-manifest.json')){if(-not$seen.ContainsKey($needed)){throw 'Incomplete kit'}}
  $null=Package (Join-Path $Dir 'BIN') '0.14.0';$m
}
function AclHash([string]$Path){
  Plain $Path;$sddl=(Get-Acl -LiteralPath $Path).GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::Access)
  $h=[Security.Cryptography.SHA256]::Create()
  try{([BitConverter]::ToString($h.ComputeHash([Text.Encoding]::UTF8.GetBytes($sddl)))).Replace('-','').ToLowerInvariant()}finally{$h.Dispose()}
}
function DirectoryInventory{
  @(@('.','bin','shared','setup-reports','guardian-reports','app-reports')|Sort-Object|ForEach-Object{
    $p=if($_ -ceq '.'){$root}else{Join-Path $root $_};$hash=AclHash $p
    @{relative=$_;sha256=$hash;daclSha256=$hash}
  })
}
function AssertProtected($Report){
  $expected=@('protected/app-readable-intent.json','protected/app-readable-owned.json','protected/restricted-hash.json','protected/restricted-intent.json','protected/restricted-owned.json')
  if(@($Report.protectedFiles).Count -ne 5 -or $Report.protectedDirectoryDaclSha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'Protected evidence missing'}
  foreach($idx in 0..4){$f=$Report.protectedFiles[$idx];if($f.relative -cne $expected[$idx] -or $f.sha256 -cnotmatch '^[a-f0-9]{64}$' -or $f.daclSha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'Protected evidence invalid'}}
}
function AssertProtectedSame($Expected,$Actual){
  AssertProtected $Expected;AssertProtected $Actual;AssertInventory @($Expected.protectedFiles) @($Actual.protectedFiles)
  if($Expected.protectedDirectoryDaclSha256 -cne $Actual.protectedDirectoryDaclSha256){throw 'Protected directory ACL changed'}
}
function RegistrationPresence{
  @($names|Where-Object{
    $svc=Get-CimInstance Win32_Service -Filter "Name='$_'"
    $null -ne $svc -or (Test-Path -LiteralPath ('HKLM:\SYSTEM\CurrentControlSet\Services\'+$_))
  })
}
function AssertAbsent{if(@(RegistrationPresence).Count -ne 0){throw 'Registration collision/partial deletion; retain state'}}
function WaitAbsent{
  $timer=[Diagnostics.Stopwatch]::StartNew()
  while(@(RegistrationPresence).Count -ne 0){if($timer.Elapsed.TotalSeconds -ge 30){throw 'Service deletion pending; never rerun'};Start-Sleep -Milliseconds 250}
}
function AssertRoleSids($Expected,$Actual){
  if(@($Expected).Count -ne 3 -or @($Actual).Count -ne 3){throw 'SID set incomplete'}
  foreach($name in $names){
    $old=@($Expected|Where-Object Name -CEQ $name);$new=@($Actual|Where-Object Name -CEQ $name)
    if($old.Count -ne 1 -or $new.Count -ne 1 -or $old[0].ServiceSid -cnotmatch '^S-1-5-80-(?:[0-9]+-){4}[0-9]+$' -or $old[0].ServiceSid -cne $new[0].ServiceSid){throw 'Service SID changed; no ACL repair'}
  }
  if(@($Actual|Select-Object -ExpandProperty ServiceSid -Unique).Count -ne 3){throw 'Duplicate service SID'}
}
function AssertOriginalServices($Expected){$rows=@(ServiceRows);AssertVersionSet $rows $exe;AssertRoleSids $Expected $rows}
function CreateRegistrations{
  AssertAbsent
  foreach($idx in 0..2){
    $account=if($idx -eq 2){'LocalSystem'}else{'NT SERVICE\'+$names[$idx]}
    Invoke-ServiceControl -Words @('create',$names[$idx],'binPath=',('"'+$exe+'" --service '+$roles[$idx]),'start=','demand','type=','own','obj=',$account)
    Invoke-ServiceControl -Words @('sidtype',$names[$idx],'unrestricted')
  }
}
function AssertProbeAdmission([string]$Experiment){
  AssertStoppedServices
  if(Test-Path -LiteralPath (Join-Path $root 'uninstall-intent.json')){
    $path=Join-Path $root 'reinstall-activation.json';Plain $path;$activation=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json
    $artifact=ArtifactEvidence (Split-Path -Parent $exe) $activeVersion
    if($activation.scope -cne $scope -or $activation.experimentId -cne $Experiment -or $activation.path -cne $exe -or $activation.manifestSha256 -cne $artifact.manifestSha256){throw 'Reinstall activation incomplete'}
    AssertOriginalServices @($activation.services)
  }
}
function AssertArtifactSame($Expected,$Actual){foreach($p in @('version','exeSha256','assemblySha256','manifestSha256')){if($Expected.$p -cne $Actual.$p){throw 'Artifact changed'}}}
function AssertCheckpoint($Checkpoint,$Artifact){
  if($Checkpoint.schemaVersion -ne 1 -or $Checkpoint.scope -cne $scope -or $Checkpoint.kitSha256 -cne $kitHash -or $Checkpoint.machineSha256 -cne $machineHash -or $Checkpoint.osBuild -ne $build -or $Checkpoint.osCaption -cne $caption -or $Checkpoint.securityAccepted -ne $false -or $Checkpoint.productionAccepted -ne $false -or $Checkpoint.matrixAccepted -ne $false){throw 'Checkpoint identity mismatch'}
  $g=[guid]::Empty;if(-not[guid]::TryParseExact([string]$Checkpoint.experimentId,'N',[ref]$g)-or$g-eq[guid]::Empty){throw 'Invalid experiment'}
  AssertArtifactSame $Checkpoint.artifact $Artifact
}
function AssertPausedPlan($Checkpoint,[string]$Action){
  $path=Join-Path $root 'plan.json';Plain $path
  if((HashFile $path) -cne $Checkpoint.planSha256){throw 'Paused plan changed'}
  $p=Get-Content -LiteralPath $path -Raw|ConvertFrom-Json;$a=$Checkpoint.artifact
  if($p.Action -cne $Action -or $p.ExperimentId -cne $Checkpoint.experimentId -or $p.ArtifactVersion -cne $a.version -or $p.BinaryHash -cne $a.exeSha256 -or $p.AssemblyHash -cne $a.assemblySha256 -or $p.PackageHash -cne $a.manifestSha256){throw 'Paused plan identity mismatch'}
}
function RefuseMarkers([string[]]$Markers){foreach($m in $Markers){$p=Join-Path $root $m;Plain $p;if(Test-Path -LiteralPath $p){throw 'Stage already attempted; never rerun'}}}
function UninstallBoundary($Prepared,$CheckpointHash){
  $null=Kit $kitRoot;AssertOriginalServices @($Prepared.services)
  AssertInventory @($Prepared.files) @(EvidenceInventory);AssertInventory @($Prepared.directories) @(DirectoryInventory)
  $script:admissionReport=Run 'guardian' 'verify' $Prepared.experimentId
  AssertGuardian $script:admissionReport;AssertProtectedSame $Prepared.guardian $script:admissionReport
  AssertInventory @($Prepared.directories) @(DirectoryInventory)
  $retained=@(EvidenceInventory);if($retained.Count -ne 8){throw 'Unexpected uninstall evidence'}
  WriteNewJson (Join-Path $root 'uninstall-intent.json') @{scope=$scope;experimentId=$Prepared.experimentId;prepareCheckpointSha256=$CheckpointHash;services=$Prepared.services;files=$retained;recovery='RETAIN_STATE_NO_AUTOMATIC_RESUME'}
  AssertOriginalServices @($Prepared.services)
  # NO key cleanup, retained ACL rewrite or filesystem deletion.
  foreach($name in $names){Invoke-ServiceControl -Words @('delete',$name)}
  WaitAbsent;AssertAbsent;AssertInventory $retained @(EvidenceInventory);AssertInventory @($Prepared.directories) @(DirectoryInventory)
  $artifact=ArtifactEvidence (Split-Path -Parent $exe) $activeVersion;AssertArtifactSame $Prepared.artifact $artifact
  WriteNewJson (Join-Path $root 'uninstall-checkpoint.json') @{
    schemaVersion=1;scope=$scope;experimentId=$Prepared.experimentId;machineSha256=$machineHash;osBuild=$build;osCaption=$caption;kitSha256=$kitHash;artifact=$artifact
    prepareCheckpointSha256=$CheckpointHash;prepareRunIntentSha256=(HashFile (Join-Path $root 'uninstall-run-intent.json'));uninstallIntentSha256=(HashFile (Join-Path $root 'uninstall-intent.json'))
    installationSha256=$Prepared.installationSha256;planSha256=(HashFile (Join-Path $root 'plan.json'));guardian=$script:admissionReport;services=$Prepared.services;files=$retained;directories=$Prepared.directories
    uninstallSimulationPassed=$true;serviceRegistrationsAbsent=$true;keyCleanupInvoked=$false;keyContinuityAfterUninstallNotYetTested=$true
    productionUninstallTested=$false;productionReinstallTested=$false;securityAccepted=$false;productionAccepted=$false;matrixAccepted=$false;timeUtc=[DateTime]::UtcNow.ToString('o')
  }
}
function ReinstallBoundary($Uninstalled,$CheckpointHash){
  $null=Kit $kitRoot;AssertAbsent;AssertInventory @($Uninstalled.files) @(EvidenceInventory);AssertInventory @($Uninstalled.directories) @(DirectoryInventory)
  $artifact=ArtifactEvidence (Split-Path -Parent $exe) $activeVersion;AssertArtifactSame $Uninstalled.artifact $artifact
  WriteNewJson (Join-Path $root 'reinstall-intent.json') @{scope=$scope;experimentId=$Uninstalled.experimentId;uninstallCheckpointSha256=$CheckpointHash;services=$Uninstalled.services;recovery='RETAIN_PARTIAL_SET_NO_AUTOMATIC_RESUME'}
  # Non-atomic registration recreation; no key create or ACL mutation.
  CreateRegistrations;AssertOriginalServices @($Uninstalled.services);AssertInventory @($Uninstalled.directories) @(DirectoryInventory)
  WriteNewJson (Join-Path $root 'reinstall-activation.json') @{scope=$scope;experimentId=$Uninstalled.experimentId;path=$exe;manifestSha256=$artifact.manifestSha256;services=$Uninstalled.services}
  $script:afterReport=Run 'guardian' 'verify' $Uninstalled.experimentId
  AssertGuardian $script:afterReport;AssertProtectedSame $Uninstalled.guardian $script:afterReport
  $script:afterProbe=Run 'app' 'probe' $Uninstalled.experimentId;AssertApp $script:afterProbe
  AssertInventory @($Uninstalled.directories) @(DirectoryInventory);AssertOriginalServices @($Uninstalled.services)
}
# The following platform reads execute only in the physical controller, never in the build/test script.
if(-not([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Run elevated'}
if(-not[Environment]::Is64BitProcess){throw 'Use 64-bit PowerShell'}
$os=Get-CimInstance Win32_OperatingSystem;$cpu=@(Get-CimInstance Win32_Processor);$build=[int]$os.BuildNumber;$caption=[string]$os.Caption
$currentVersion=Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion';$displayVersion=OptionalProperty $currentVersion 'DisplayVersion';if([string]::IsNullOrWhiteSpace($displayVersion)){$displayVersion=OptionalProperty $currentVersion 'ReleaseId'};if([string]::IsNullOrWhiteSpace($displayVersion)){$displayVersion='UNKNOWN'}
$flight=$false;$flightPath='HKLM:\SOFTWARE\Microsoft\WindowsSelfHost\Applicability';if(Test-Path -LiteralPath $flightPath){$appl=Get-ItemProperty -LiteralPath $flightPath;$flightValues=@((OptionalProperty $appl 'BranchName'),(OptionalProperty $appl 'ContentType'),(OptionalProperty $appl 'Ring'));$flight=@($flightValues|Where-Object{-not[string]::IsNullOrWhiteSpace([string]$_)}).Count -gt 0}
$isX64=$cpu.Count -gt 0 -and @($cpu | Where-Object Architecture -ne 9).Count -eq 0
$isWindows10=$caption -match 'Windows 10' -and $caption -notmatch 'Server' -and $build -ge 14393 -and $build -lt 22000
$isWindows11=$caption -match 'Windows 11' -and $caption -notmatch 'Server' -and $build -ge 22000
$supported=($os.ProductType -eq 1 -and $isX64 -and -not $flight -and ($isWindows10 -or $isWindows11))
if(-not$supported){throw 'Unsupported test OS. Use non-Insider Windows 10 x64 build 14393 or later, or Windows 11 x64 build 22000 or later.'}
$bootUtc=([DateTime]$os.LastBootUpTime).ToUniversalTime().ToString('o')
$machineRaw=[string](Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Cryptography').MachineGuid
$machineGuid=[guid]::Empty;if(-not[guid]::TryParse($machineRaw,[ref]$machineGuid)-or$machineGuid-eq[guid]::Empty){throw 'Missing machine identity'}
$hasher=[Security.Cryptography.SHA256]::Create();try{$machineHash=([BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($machineGuid.ToString('D'))))).Replace('-','').ToLowerInvariant()}finally{$hasher.Dispose()}

$null=Kit $kitRoot
$artifact=ArtifactEvidence (Join-Path $kitRoot 'BIN') $activeVersion
$kitHash=HashFile (Join-Path $kitRoot 'reinstall-kit-manifest.json')
if($Stage -ceq 'Prepare'){
  Plain $root
  if(Test-Path -LiteralPath $root){throw 'Fresh test root required; never overwrite'}
  AssertAbsent
  $null=New-Item -ItemType Directory -Path $root;Rules $root @() @()
  WriteNewJson (Join-Path $root 'installation.json') @{scope=$scope;kitSha256=$kitHash;createdUtc=[DateTime]::UtcNow.ToString('o')}
  $bin=Join-Path $root 'bin';$null=New-Item -ItemType Directory -Path $bin
  $manifest=Package (Join-Path $kitRoot 'BIN') $activeVersion
  foreach($entry in $manifest.files){Copy-Item -LiteralPath (Join-Path (Join-Path $kitRoot 'BIN') $entry.name) -Destination (Join-Path $bin $entry.name)}
  Copy-Item -LiteralPath (Join-Path $kitRoot 'BIN/package-manifest.json') -Destination (Join-Path $bin 'package-manifest.json')
  AssertArtifactSame $artifact (ArtifactEvidence $bin $activeVersion)
  CreateRegistrations
  $g=Sid $names[0];$a=Sid $names[1]
  Rules $root @() @($g,$a);Rules $bin @() @($g,$a)
  foreach($dir in @('protected','shared','guardian-reports','app-reports','setup-reports')){$null=New-Item -ItemType Directory -Path (Join-Path $root $dir)}
  Rules (Join-Path $root 'protected') @($g) @() $false
  Rules (Join-Path $root 'shared') @($g) @($a)
  Rules (Join-Path $root 'guardian-reports') @($g) @()
  Rules (Join-Path $root 'app-reports') @($a) @()
  Rules (Join-Path $root 'setup-reports') @() @()
  $experiment=[guid]::NewGuid().ToString('N')
  $create=Run 'setup' 'create' $experiment
  foreach($id in @('setup.restricted.create-rsa-wrapping-key','setup.app-readable.create-rsa-wrapping-key','setup.publish-control-set')){if(-not(Pass $create $id)){throw 'Creation failed; retain state'}}
  $baseline=Run 'guardian' 'verify' $experiment;AssertGuardian $baseline;AssertProtected $baseline
  $probe=Run 'app' 'probe' $experiment;AssertApp $probe
  AssertStoppedServices
  $files=@(EvidenceInventory);if($files.Count -ne 7){throw 'Unexpected prepare evidence'}
  $rows=@(ServiceRows);AssertRoleSids $rows $rows
  WriteNewJson (Join-Path $root 'prepare-checkpoint.json') @{
    schemaVersion=1;scope=$scope;experimentId=$experiment;preparedUtc=[DateTime]::UtcNow.ToString('o');machineSha256=$machineHash;osBuild=$build;osCaption=$caption;kitSha256=$kitHash;artifact=$artifact
    installationSha256=(HashFile (Join-Path $root 'installation.json'));planSha256=(HashFile (Join-Path $root 'plan.json'));services=$rows;files=$files;directories=@(DirectoryInventory);guardian=$baseline
    securityAccepted=$false;productionAccepted=$false;matrixAccepted=$false
  }
  Write-Host 'PREPARED_FOR_UNINSTALL. Keys retained; services Stopped/Manual. Send output; await review. Never rerun Prepare. No reboot.'
  exit
}
# Later stages must NEVER create keys or rewrite retained ACLs.
Plain $root
$preparedPath=Join-Path $root 'prepare-checkpoint.json';Plain $preparedPath
$prepared=Get-Content -LiteralPath $preparedPath -Raw|ConvertFrom-Json;$preparedHash=HashFile $preparedPath
AssertCheckpoint $prepared $artifact;AssertProtected $prepared.guardian
AssertArtifactSame $artifact (ArtifactEvidence (Split-Path -Parent $exe) $activeVersion)
if((HashFile (Join-Path $root 'installation.json')) -cne $prepared.installationSha256){throw 'Installation record changed'}
if($Stage -ceq 'Uninstall'){
  RefuseMarkers @('uninstall-run-intent.json','uninstall-intent.json','uninstall-checkpoint.json','reinstall-run-intent.json','reinstall-intent.json','reinstall-activation.json')
  AssertPausedPlan $prepared 'probe'
  WriteNewJson (Join-Path $root 'uninstall-run-intent.json') @{scope=$scope;experimentId=$prepared.experimentId;prepareCheckpointSha256=$preparedHash}
  UninstallBoundary $prepared $preparedHash
  Write-Host 'UNINSTALLED_RETAINED_DATA. Exactly three test registrations removed; keys/files/ACLs retained. Send output; await review. Never rerun Uninstall.'
  Write-Host ('Checkpoint: '+(Join-Path $root 'uninstall-checkpoint.json'))
  exit
}
RefuseMarkers @('reinstall-run-intent.json','reinstall-intent.json','reinstall-activation.json','reinstall-proof.json')
$uninstalledPath=Join-Path $root 'uninstall-checkpoint.json';Plain $uninstalledPath
$uninstalled=Get-Content -LiteralPath $uninstalledPath -Raw|ConvertFrom-Json;$uninstalledHash=HashFile $uninstalledPath
AssertCheckpoint $uninstalled $artifact;AssertProtectedSame $prepared.guardian $uninstalled.guardian
AssertRoleSids @($prepared.services) @($uninstalled.services)
if($uninstalled.prepareCheckpointSha256 -cne $preparedHash -or $uninstalled.prepareRunIntentSha256 -cne (HashFile (Join-Path $root 'uninstall-run-intent.json')) -or $uninstalled.uninstallIntentSha256 -cne (HashFile (Join-Path $root 'uninstall-intent.json')) -or $uninstalled.installationSha256 -cne $prepared.installationSha256 -or $uninstalled.uninstallSimulationPassed -ne $true -or $uninstalled.serviceRegistrationsAbsent -ne $true -or $uninstalled.keyCleanupInvoked -ne $false -or $uninstalled.productionUninstallTested -ne $false -or $uninstalled.productionReinstallTested -ne $false){throw 'Uninstall checkpoint mismatch'}
AssertPausedPlan $uninstalled 'verify';AssertAbsent
$sharedBefore=@(SharedInventory);if($sharedBefore.Count -ne 4){throw 'Unexpected shared inventory'}
WriteNewJson (Join-Path $root 'reinstall-run-intent.json') @{scope=$scope;experimentId=$uninstalled.experimentId;uninstallCheckpointSha256=$uninstalledHash}
ReinstallBoundary $uninstalled $uninstalledHash
AssertInventory $sharedBefore @(SharedInventory)
WriteNewJson (Join-Path $root 'reinstall-proof.json') @{scope=$scope;experimentId=$uninstalled.experimentId;guardianRunId=$script:afterReport.runId;appRunId=$script:afterProbe.runId;uninstallCheckpointSha256=$uninstalledHash;protectedFiles=$script:afterReport.protectedFiles;directories=@(DirectoryInventory)}
# Owned-test cleanup ONLY after complete reinstall continuity proof; never in Uninstall.
$cleanup=Run 'setup' 'cleanup' $uninstalled.experimentId
foreach($label in @('restricted','app-readable')){if(-not(Pass $cleanup ('setup.'+$label+'.delete-owned-key'))){throw 'Cleanup unconfirmed; retain state'}}
AssertInventory $sharedBefore @(SharedInventory);AssertInventory @($prepared.directories) @(DirectoryInventory);AssertOriginalServices @($prepared.services)
$summary=@{
  schemaVersion=1;scope=$scope;version='0.14.0';experimentId=$uninstalled.experimentId;artifact=$artifact;kitSha256=$kitHash;prepareCheckpointSha256=$preparedHash;uninstallCheckpointSha256=$uninstalledHash
  uninstallSimulationPassed=$true;reinstallSimulationPassed=$true;hostFeasibilityPassed=$true;sameKeyIdentityVerified=$true;sameEnvelopeBytesVerified=$true;sameProtectedFileBytesVerified=$true;sameServiceSidsVerified=$true;retainedDaclsVerified=$true
  keyRecreationAttempted=$false;ownedKeyCleanupPassed=$true;immutableBinariesRetained=$true;productionUninstallTested=$false;productionReinstallTested=$false;securityAccepted=$false;productionAccepted=$false;matrixAccepted=$false
  ordinaryUserNotTested=$true;interruptionPhysicallyTested=$false;invalidStateRefusalPhysicallyTested=$false;negativeCasesRequireInertFixtureEvidence=$true
  osCaption=$caption;osBuild=$build;displayVersion=$displayVersion;vendorLifecycleNotRequired=$true;platformPolicy='WINDOWS_10_11_X64_BUILD_14393_PLUS_NO_LIFECYCLE_GATE'
  evidenceFiles=@(EvidenceInventory);protectedFiles=$script:afterReport.protectedFiles;protectedDirectoryDaclSha256=$script:afterReport.protectedDirectoryDaclSha256;services=@(ServiceRows);timeUtc=[DateTime]::UtcNow.ToString('o')
}
$summaryPath=Join-Path $root ('wrapping-summary-'+[guid]::NewGuid().ToString('N')+'.json');WriteNewJson $summaryPath $summary
Write-Host ('Report: '+$summaryPath)
