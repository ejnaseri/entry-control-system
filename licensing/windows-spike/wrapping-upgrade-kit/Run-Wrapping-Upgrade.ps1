# LIC-6.2-008 fresh test-only OLD/NEW binary Upgrade simulation. Never run during build.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][ValidateSet('Prepare','Upgrade')][string]$Stage)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'Ecs.Lic008.WrappingV6'
$names=@('Ecs.Lic008.WrappingV6.Guardian','Ecs.Lic008.WrappingV6.App','Ecs.Lic008.WrappingV6.Setup')
$roles=@('guardian','app','setup')
$scope='TEST_ONLY_SOFTWARE_KSP_WRAPPING_V6'
$sc=Join-Path $env:SystemRoot 'System32/sc.exe'
$activeVersion='0.13.0'
$exe=Join-Path $root 'bin-old/Ecs.Lic008.WrappingV6.exe'
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
    $pattern=if($Nested){'^(?:(?:OLD|NEW)/)?[A-Za-z0-9][A-Za-z0-9._-]*\.(dll|exe|json|pdb|txt|ps1)$'}else{'^[A-Za-z0-9][A-Za-z0-9._-]*\.(dll|exe|json|pdb|txt|ps1)$'}
    if($f.name -cnotmatch $pattern -or $seen.ContainsKey($f.name) -or $f.size -le 0 -or $f.sha256 -cnotmatch '^[a-f0-9]{64}$'){throw 'Invalid package entry'}
    $seen[$f.name]=$true;$p=Join-Path $Dir $f.name;Plain $p;$item=Get-Item -LiteralPath $p -Force
    if($item.PSIsContainer -or $item.Length -ne $f.size -or (HashFile $p) -cne $f.sha256){throw 'Package hash mismatch'}
  }
  foreach($item in Get-ChildItem -LiteralPath $Dir -Force -Recurse){
    Plain $item.FullName
    $relative=$item.FullName.Substring($Dir.TrimEnd('\','/').Length+1).Replace('\','/')
    if($item.PSIsContainer){
      if(-not$Nested -or $relative -cnotin @('OLD','NEW')){throw 'Unexpected package directory'}
    }elseif($relative -cne $(if($Nested){'upgrade-kit-manifest.json'}else{'package-manifest.json'}) -and -not$seen.ContainsKey($relative)){throw 'Unexpected package content'}
  }
  $seen
}
function Package([string]$Dir,[string]$Version){
  Plain $Dir
  if($Version -cnotin @('0.13.0','0.13.1')){throw 'Unknown artifact version'}
  $m=Get-Content -LiteralPath (Join-Path $Dir 'package-manifest.json') -Raw|ConvertFrom-Json
  if($m.schemaVersion -ne 1 -or $m.checklistId -cne 'LIC-6.2-008' -or $m.scope -cne $scope -or $m.version -cne $Version -or $m.sdk -cne '10.0.400' -or $m.runtime -cne '10.0.11'){throw 'Wrong package identity'}
  $seen=CheckFiles $Dir $m.files
  foreach($needed in @('Ecs.Lic008.WrappingV6.exe','Ecs.Lic008.WrappingV6.dll','Ecs.Lic008.WrappingV6.deps.json','Ecs.Lic008.WrappingV6.runtimeconfig.json')){
    if(-not$seen.ContainsKey($needed)){throw 'Incomplete package'}
  }
  $m
}
function AssertDistinct($Old,$New){
  if($Old.version -cne '0.13.0' -or $New.version -cne '0.13.1' -or $Old.scope -cne $scope -or $New.scope -cne $scope){throw 'Unsupported upgrade pair'}
  $oldAssembly=@($Old.files|Where-Object name -CEQ 'Ecs.Lic008.WrappingV6.dll')
  $newAssembly=@($New.files|Where-Object name -CEQ 'Ecs.Lic008.WrappingV6.dll')
  if($oldAssembly.Count -ne 1 -or $newAssembly.Count -ne 1 -or $oldAssembly[0].sha256 -ceq $newAssembly[0].sha256){throw 'Distinct managed artifacts required'}
}
function Kit([string]$Dir){
  Plain $Dir;$m=Get-Content -LiteralPath (Join-Path $Dir 'upgrade-kit-manifest.json') -Raw|ConvertFrom-Json
  if($m.schemaVersion -ne 1 -or $m.checklistId -cne 'LIC-6.2-008' -or $m.scope -cne $scope -or $m.version -cne '0.13.0'){throw 'Wrong kit'}
  $seen=CheckFiles $Dir $m.files $true
  foreach($needed in @('Run-Wrapping-Upgrade.ps1','README-fa.txt','OLD/package-manifest.json','NEW/package-manifest.json')){if(-not$seen.ContainsKey($needed)){throw 'Incomplete kit'}}
  $old=Package (Join-Path $Dir 'OLD') '0.13.0';$new=Package (Join-Path $Dir 'NEW') '0.13.1'
  AssertDistinct $old $new
  if((HashFile (Join-Path $Dir 'OLD/package-manifest.json')) -ceq (HashFile (Join-Path $Dir 'NEW/package-manifest.json'))){throw 'Distinct manifests required'}
  $m
}
function ArtifactEvidence([string]$Dir,[string]$Version){
  $null=Package $Dir $Version
  @{version=$Version;exeSha256=(HashFile (Join-Path $Dir 'Ecs.Lic008.WrappingV6.exe'));assemblySha256=(HashFile (Join-Path $Dir 'Ecs.Lic008.WrappingV6.dll'));manifestSha256=(HashFile (Join-Path $Dir 'package-manifest.json'))}
}
function Plan([string]$Action,[string]$Run,[string]$Experiment){
  $artifact=ArtifactEvidence (Split-Path -Parent $exe) $activeVersion
  @{Action=$Action;RunId=$Run;ExperimentId=$Experiment;BinaryHash=$artifact.exeSha256;ArtifactVersion=$activeVersion;AssemblyHash=$artifact.assemblySha256;PackageHash=$artifact.manifestSha256}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'plan.json') -Encoding UTF8
}
function AssertReportIdentity($Report,[string]$Role,[string]$Action,[string]$Run,[string]$Experiment,$Artifact){
  if($Report.schemaVersion -ne 1 -or $Report.checklistId -cne 'LIC-6.2-008' -or $Report.scope -cne $scope -or $Report.role -cne $Role -or $Report.action -cne $Action -or $Report.runId -cne $Run -or $Report.experimentId -cne $Experiment -or $Report.binarySha256 -cne $Artifact.exeSha256 -or $Report.artifactVersion -cne $Artifact.version -or $Report.managedAssemblySha256 -cne $Artifact.assemblySha256 -or $Report.packageManifestSha256 -cne $Artifact.manifestSha256 -or $Report.serviceIdentityMatched -ne $true -or $Report.productionAccepted -ne $false -or $Report.securityAccepted -ne $false -or $Report.productionUpgradeTested -ne $false){throw 'Report mismatch'}
}
function Pass($Report,[string]$Id,[string[]]$Status=@('PASS')){$x=@($Report.results|Where-Object{$_.Id-ceq$Id});$x.Count-eq1-and$x[0].Status-in$Status}
function ServiceRows {
  @($names|ForEach-Object{
    $svc=Get-CimInstance Win32_Service -Filter "Name='$_'"
    if($null -eq $svc){throw 'Service missing'}
    $reg=Get-ItemProperty -LiteralPath ('HKLM:\SYSTEM\CurrentControlSet\Services\'+$_)
    [pscustomobject]@{Name=$svc.Name;State=$svc.State;StartMode=$svc.StartMode;StartName=$svc.StartName;PathName=$svc.PathName;ProcessId=$svc.ProcessId;ServiceSidType=$reg.ServiceSidType}
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
function AssertActivation {
  AssertStoppedServices
  if($activeVersion -ceq '0.13.1'){
    $activation=Get-Content -LiteralPath (Join-Path $root 'upgrade-activation.json') -Raw|ConvertFrom-Json
    $artifact=ArtifactEvidence (Split-Path -Parent $exe) $activeVersion
    if($activation.scope -cne $scope -or $activation.version -cne $activeVersion -or $activation.path -cne $exe -or $activation.manifestSha256 -cne $artifact.manifestSha256){throw 'Incomplete activation; retain state'}
  }
}
function Run([string]$Role,[string]$Action,[string]$Experiment){
  # NO plan write/start until the ENTIRE stopped role version set is verified.
  AssertActivation
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
      $items+=@{relative=($dir+'/'+$f.Name);sha256=(Get-FileHash -LiteralPath $f.FullName).Hash.ToLowerInvariant()}
    }
  }
  @($items|Sort-Object { $_.relative })
}
function AssertInventory($Expected,$Actual){
  if(@($Expected).Count-ne@($Actual).Count){throw 'Retained evidence count changed'}
  for($i=0;$i-lt@($Expected).Count;$i++){if($Expected[$i].relative-cne$Actual[$i].relative-or$Expected[$i].sha256-cne$Actual[$i].sha256){throw 'Retained evidence hash changed'}}
}

function AssertGuardian($Report){
  $required=@('guardian.restricted.reopen-policy-decrypt','guardian.restricted.private-export-denied','guardian.app-readable.reopen-policy-decrypt','guardian.app-readable.private-export-denied','guardian.envelope-negative-matrix')
  if(@($Report.results).Count-ne5){throw 'Upgrade admission refused; RECOVERY_REQUIRED'}
  foreach($id in $required){if(-not(Pass $Report $id)){throw 'Upgrade admission refused; RECOVERY_REQUIRED'}}
}

function SharedInventory { @(EvidenceInventory|Where-Object{$_.relative.StartsWith('shared/',[StringComparison]::Ordinal)}) }
function Invoke-UpgradeBoundary([string]$Experiment,$SharedHashes,[string]$Destination){
  $null=Kit $kitRoot
  if($activeVersion -cne '0.13.0'){throw 'Unsupported active version; never downgrade'}
  $old=Package (Split-Path -Parent $exe) '0.13.0'
  $new=Package (Join-Path $kitRoot 'NEW') '0.13.1'
  AssertDistinct $old $new
  AssertStoppedServices;AssertInventory $SharedHashes @(SharedInventory)
  $script:admissionReport=Run 'guardian' 'verify' $Experiment
  AssertGuardian $script:admissionReport
  # NO staging, candidate ACL or SCM config before existing-key admission.
  if($Destination -cne (Join-Path $root 'bin-new')){throw 'Unexpected upgrade destination'}
  Plain $Destination
  if((Test-Path -LiteralPath $Destination) -or (Test-Path -LiteralPath (Join-Path $root 'upgrade-intent.json')) -or (Test-Path -LiteralPath (Join-Path $root 'upgrade-activation.json'))){throw 'Upgrade already attempted; retain state'}
  $oldArtifact=ArtifactEvidence (Split-Path -Parent $exe) '0.13.0'
  $newArtifact=ArtifactEvidence (Join-Path $kitRoot 'NEW') '0.13.1'
  WriteNewJson (Join-Path $root 'upgrade-intent.json') @{scope=$scope;experimentId=$Experiment;old=$oldArtifact;new=$newArtifact;oldPath=$exe;newPath=(Join-Path $Destination 'Ecs.Lic008.WrappingV6.exe');admissionRunId=$script:admissionReport.runId;recovery='RETAIN_STOPPED_STATE_NO_BLIND_RETRY'}
  $null=New-Item -ItemType Directory -Path $Destination
  foreach($entry in $new.files){Copy-Item -LiteralPath (Join-Path (Join-Path $kitRoot 'NEW') $entry.name) -Destination (Join-Path $Destination $entry.name)}
  Copy-Item -LiteralPath (Join-Path $kitRoot 'NEW/package-manifest.json') -Destination (Join-Path $Destination 'package-manifest.json')
  Rules $Destination @() @((Sid $names[0]),(Sid $names[1]))
  $null=Package $Destination '0.13.1'
  if((HashFile (Join-Path $Destination 'package-manifest.json')) -cne $newArtifact.manifestSha256){throw 'Staged manifest mismatch; retain state'}
  AssertStoppedServices
  $candidateExe=Join-Path $Destination 'Ecs.Lic008.WrappingV6.exe'
  # Non-atomic SCM writes; any failure retains intent and stops before role startup.
  foreach($idx in 0..2){Invoke-ServiceControl -Words @('config',$names[$idx],'binPath=',('"'+$candidateExe+'" --service '+$roles[$idx]))}
  AssertVersionSet @(ServiceRows) $candidateExe
  WriteNewJson (Join-Path $root 'upgrade-activation.json') @{scope=$scope;experimentId=$Experiment;version='0.13.1';path=$candidateExe;manifestSha256=$newArtifact.manifestSha256}
  $script:exe=$candidateExe;$script:activeVersion='0.13.1'
  AssertActivation
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
$oldSource=Join-Path $kitRoot 'OLD';$newSource=Join-Path $kitRoot 'NEW'
$oldArtifact=ArtifactEvidence $oldSource '0.13.0';$newArtifact=ArtifactEvidence $newSource '0.13.1'
$kitHash=HashFile (Join-Path $kitRoot 'upgrade-kit-manifest.json')
if($Stage -ceq 'Prepare'){
  Plain $root
  if(Test-Path -LiteralPath $root){throw 'Fresh test root required; never overwrite'}
  foreach($name in $names){if(Get-Service -Name $name -ErrorAction SilentlyContinue){throw 'Fresh service names required'}}
  $null=New-Item -ItemType Directory -Path $root;Rules $root @() @()
  WriteNewJson (Join-Path $root 'installation.json') @{scope=$scope;kitSha256=$kitHash;createdUtc=[DateTime]::UtcNow.ToString('o')}
  $bin=Join-Path $root 'bin-old';$null=New-Item -ItemType Directory -Path $bin
  $manifest=Package $oldSource '0.13.0'
  foreach($entry in $manifest.files){Copy-Item -LiteralPath (Join-Path $oldSource $entry.name) -Destination (Join-Path $bin $entry.name)}
  Copy-Item -LiteralPath (Join-Path $oldSource 'package-manifest.json') -Destination (Join-Path $bin 'package-manifest.json')
  $null=Package $bin '0.13.0'
  foreach($idx in 0..2){
    $account=if($idx -eq 2){'LocalSystem'}else{'NT SERVICE\'+$names[$idx]}
    Invoke-ServiceControl -Words @('create',$names[$idx],'binPath=',('"'+$exe+'" --service '+$roles[$idx]),'start=','demand','type=','own','obj=',$account)
    Invoke-ServiceControl -Words @('sidtype',$names[$idx],'unrestricted')
  }
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
  $baseline=Run 'guardian' 'verify' $experiment;AssertGuardian $baseline
  $probe=Run 'app' 'probe' $experiment;AssertApp $probe
  AssertStoppedServices
  $files=@(EvidenceInventory);if($files.Count -ne 7){throw 'Unexpected prepare evidence'}
  WriteNewJson (Join-Path $root 'upgrade-checkpoint.json') @{schemaVersion=1;scope=$scope;experimentId=$experiment;preparedUtc=[DateTime]::UtcNow.ToString('o');machineSha256=$machineHash;osBuild=$build;osCaption=$caption;kitSha256=$kitHash;old=$oldArtifact;new=$newArtifact;planSha256=(HashFile (Join-Path $root 'plan.json'));files=$files;securityAccepted=$false;productionAccepted=$false;matrixAccepted=$false}
  Write-Host 'PREPARED_FOR_UPGRADE. OLD 0.13.0 verified; keys retained; services Stopped/Manual. Send output before Upgrade ONCE from THIS kit. No reboot.'
  exit
}

# Upgrade must NEVER create keys, services, or replace preserved OLD files.
Plain $root
foreach($marker in @('upgrade-run-intent.json','upgrade-intent.json','upgrade-activation.json')){if(Test-Path -LiteralPath (Join-Path $root $marker)){throw 'Upgrade already attempted; retain state; never rerun'}}
$checkpointPath=Join-Path $root 'upgrade-checkpoint.json';Plain $checkpointPath
$checkpoint=Get-Content -LiteralPath $checkpointPath -Raw|ConvertFrom-Json
$checkpointHash=HashFile $checkpointPath
if($checkpoint.schemaVersion -ne 1 -or $checkpoint.scope -cne $scope -or $checkpoint.kitSha256 -cne $kitHash -or $checkpoint.machineSha256 -cne $machineHash -or $checkpoint.osBuild -ne $build -or $checkpoint.osCaption -cne $caption -or $checkpoint.securityAccepted -ne $false -or $checkpoint.productionAccepted -ne $false -or $checkpoint.matrixAccepted -ne $false){throw 'Checkpoint identity mismatch'}
$experiment=[string]$checkpoint.experimentId
$experimentGuid=[guid]::Empty;if(-not[guid]::TryParseExact($experiment,'N',[ref]$experimentGuid) -or $experimentGuid -eq [guid]::Empty){throw 'Invalid experiment'}
foreach($variant in @('old','new')){
  $expected=if($variant -ceq 'old'){$oldArtifact}else{$newArtifact}
  foreach($property in @('version','exeSha256','assemblySha256','manifestSha256')){if($checkpoint.$variant.$property -cne $expected.$property){throw 'Checkpoint artifact mismatch'}}
}
$installedOld=ArtifactEvidence (Split-Path -Parent $exe) '0.13.0'
foreach($property in @('version','exeSha256','assemblySha256','manifestSha256')){if($installedOld.$property -cne $oldArtifact.$property){throw 'Installed OLD mismatch'}}
if($checkpoint.planSha256 -cne (HashFile (Join-Path $root 'plan.json'))){throw 'Paused plan changed'}
$paused=Get-Content -LiteralPath (Join-Path $root 'plan.json') -Raw|ConvertFrom-Json
if($paused.Action -cne 'probe' -or $paused.ExperimentId -cne $experiment -or $paused.ArtifactVersion -cne '0.13.0' -or $paused.BinaryHash -cne $oldArtifact.exeSha256 -or $paused.AssemblyHash -cne $oldArtifact.assemblySha256 -or $paused.PackageHash -cne $oldArtifact.manifestSha256){throw 'Paused plan mismatch'}
AssertInventory @($checkpoint.files) @(EvidenceInventory);AssertStoppedServices
$sharedBefore=@(SharedInventory);if($sharedBefore.Count -ne 4){throw 'Unexpected shared baseline'}
WriteNewJson (Join-Path $root 'upgrade-run-intent.json') @{scope=$scope;checkpointSha256=$checkpointHash;experimentId=$experiment;old=$oldArtifact;new=$newArtifact}
Invoke-UpgradeBoundary $experiment $sharedBefore (Join-Path $root 'bin-new')
$after=Run 'guardian' 'verify' $experiment;AssertGuardian $after
$probe2=Run 'app' 'probe' $experiment;AssertApp $probe2
AssertInventory $sharedBefore @(SharedInventory);AssertStoppedServices
# Confirm OLD was retained and NEW bytes are the intended candidate before cleanup.
$null=Package (Join-Path $root 'bin-old') '0.13.0'
if((HashFile (Join-Path $root 'bin-old/package-manifest.json')) -cne $oldArtifact.manifestSha256){throw 'OLD changed'}
WriteNewJson (Join-Path $root 'upgrade-proof.json') @{scope=$scope;experimentId=$experiment;oldAdmissionRunId=$script:admissionReport.runId;newGuardianRunId=$after.runId;newAppRunId=$probe2.runId;sharedHashes=$sharedBefore}
$cleanup=Run 'setup' 'cleanup' $experiment
foreach($label in @('restricted','app-readable')){if(-not(Pass $cleanup ('setup.'+$label+'.delete-owned-key'))){throw 'Cleanup unconfirmed; retain state'}}
AssertInventory $sharedBefore @(SharedInventory);AssertStoppedServices
$summary=@{schemaVersion=1;scope=$scope;version='0.13.0';oldVersion='0.13.0';newVersion='0.13.1';experimentId=$experiment;checkpointSha256=$checkpointHash;kitSha256=$kitHash;old=$oldArtifact;new=$newArtifact;upgradeSimulationPassed=$true;distinctManagedArtifactsVerified=$true;sameKeyIdentityVerified=$true;sameEnvelopeBytesVerified=$true;keyRecreationAttempted=$false;oldFilesPreserved=$true;hostFeasibilityPassed=$true;productionUpgradeTested=$false;securityAccepted=$false;productionAccepted=$false;matrixAccepted=$false;ordinaryUserNotTested=$true;interruptionPhysicallyTested=$false;invalidStateRefusalPhysicallyTested=$false;negativeCasesRequireInertFixtureEvidence=$true;osCaption=$caption;osBuild=$build;displayVersion=$displayVersion;platformPolicy='WINDOWS_10_11_X64_BUILD_14393_PLUS_NO_LIFECYCLE_GATE';vendorLifecycleNotRequired=$true;evidenceFiles=@(EvidenceInventory);services=@(ServiceRows);timeUtc=[DateTime]::UtcNow.ToString('o')}
$summaryPath=Join-Path $root ('wrapping-summary-'+[guid]::NewGuid().ToString('N')+'.json');WriteNewJson $summaryPath $summary
Write-Host ('Report: '+$summaryPath)

