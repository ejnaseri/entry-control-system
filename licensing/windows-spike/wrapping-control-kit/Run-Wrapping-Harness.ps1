# Fresh, test-only LIC008 Software-KSP wrapping-key feasibility run.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$root=Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'Ecs.Lic008.WrappingV2'
$names=@('Ecs.Lic008.WrappingV2.Guardian','Ecs.Lic008.WrappingV2.App','Ecs.Lic008.WrappingV2.Setup')
$roles=@('guardian','app','setup')
$sc=Join-Path $env:SystemRoot 'System32/sc.exe'
$exe=Join-Path $root 'bin/Ecs.Lic008.WrappingV2.exe'

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
  if($m.checklistId-ne'LIC-6.2-008'-or$m.scope-ne'TEST_ONLY_SOFTWARE_KSP_WRAPPING_V2'-or$m.version-ne'0.9.3'){throw 'Wrong package identity'}
  $seen=@{};foreach($f in $m.files){if($f.name-notmatch'^[A-Za-z0-9][A-Za-z0-9._-]*\.(dll|exe|json|pdb|txt|ps1)$'-or$seen.ContainsKey($f.name)){throw 'Invalid package entry'};$seen[$f.name]=$true;$path=Join-Path $Dir $f.name;if((Get-Item -LiteralPath $path).Length-ne$f.size-or(Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant()-cne$f.sha256){throw 'Package hash mismatch'}}
  foreach($f in Get-ChildItem -LiteralPath $Dir -File -Force){if($f.Name-ne'package-manifest.json'-and-not$seen.ContainsKey($f.Name)){throw 'Unexpected package content'}}
  foreach($needed in @('Ecs.Lic008.WrappingV2.exe','Run-Wrapping-Harness.ps1','README-fa.txt')){if(-not$seen.ContainsKey($needed)){throw 'Incomplete package'}};$m
}
function Plan([string]$Action,[string]$Run,[string]$Experiment){@{Action=$Action;RunId=$Run;ExperimentId=$Experiment;BinaryHash=(Get-FileHash -LiteralPath $exe).Hash.ToLowerInvariant()}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'plan.json') -Encoding UTF8}
function Run([string]$Role,[string]$Action,[string]$Experiment){
  $run=[guid]::NewGuid().ToString('N');Plan $Action $run $Experiment;$index=[Array]::IndexOf($roles,$Role);$report=Join-Path $root ($Role+'-reports/'+$run+'.json');Invoke-ServiceControl -Words @('start',$names[$index]);$watch=[Diagnostics.Stopwatch]::StartNew();do{Start-Sleep -Milliseconds 250;$service=Get-Service -Name $names[$index];if($service.Status-eq'Stopped'){break}}while($watch.Elapsed.TotalSeconds-lt120)
  if($service.Status-ne'Stopped'){Invoke-ServiceControl -Words @('stop',$names[$index]);throw 'Probe timeout; retain state'};if(-not(Test-Path -LiteralPath $report)){throw 'Missing report; retain state'};$r=Get-Content -LiteralPath $report -Raw|ConvertFrom-Json
  if($r.scope-ne'TEST_ONLY_SOFTWARE_KSP_WRAPPING_V2'-or$r.role-ne$Role-or$r.action-ne$Action-or$r.runId-ne$run-or$r.experimentId-ne$Experiment-or$r.binarySha256-cne(Get-FileHash -LiteralPath $exe).Hash.ToLowerInvariant()){throw 'Report mismatch'};$r.results|Format-Table Id,Status,Stage,Error -AutoSize|Out-Host;$r
}
function Pass($Report,[string]$Id,[string[]]$Status=@('PASS')){$x=@($Report.results|Where-Object{$_.Id-ceq$Id});$x.Count-eq1-and$x[0].Status-in$Status}

if(-not([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Run elevated'}
if(-not[Environment]::Is64BitProcess){throw 'Use 64-bit PowerShell'}
$os=Get-CimInstance Win32_OperatingSystem;$cpu=@(Get-CimInstance Win32_Processor);$build=[int]$os.BuildNumber;$caption=[string]$os.Caption
$currentVersion=Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion';$displayVersion=[string]$currentVersion.DisplayVersion
$flight=$false;$flightPath='HKLM:\SOFTWARE\Microsoft\WindowsSelfHost\Applicability';if(Test-Path -LiteralPath $flightPath){$appl=Get-ItemProperty -LiteralPath $flightPath;$flightValues=@((OptionalProperty $appl 'BranchName'),(OptionalProperty $appl 'ContentType'),(OptionalProperty $appl 'Ring'));$flight=@($flightValues|Where-Object{-not[string]::IsNullOrWhiteSpace([string]$_)}).Count -gt 0}
$isX64=@($cpu | Where-Object Architecture -ne 9).Count -eq 0
$isWindows10=$caption -match 'Windows 10' -and $caption -notmatch 'Server' -and $build -ge 14393 -and $build -lt 22000
$isWindows11=$caption -match 'Windows 11' -and $caption -notmatch 'Server' -and $build -ge 22000
$supported=($os.ProductType -eq 1 -and $isX64 -and -not $flight -and ($isWindows10 -or $isWindows11))
if(-not$supported){throw 'Unsupported test OS. Use non-Insider Windows 10 x64 build 14393 or later, or Windows 11 x64 build 22000 or later.'}
Plain $root;if(Test-Path -LiteralPath $root){throw 'Fresh test root required; never overwrite'};foreach($n in $names){if(Get-Service -Name $n -ErrorAction SilentlyContinue){throw 'Fresh service names required'}}
$manifest=Package $PSScriptRoot;$null=New-Item -ItemType Directory -Path $root;Rules $root @() @();@{scope='TEST_ONLY_SOFTWARE_KSP_WRAPPING_V2';root=$root;createdUtc=[DateTime]::UtcNow.ToString('o')}|ConvertTo-Json|Set-Content -LiteralPath (Join-Path $root 'installation.json') -Encoding UTF8
$bin=Join-Path $root 'bin';$null=New-Item -ItemType Directory -Path $bin;foreach($f in $manifest.files){Copy-Item -LiteralPath (Join-Path $PSScriptRoot $f.name) -Destination (Join-Path $bin $f.name)};Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'package-manifest.json') -Destination (Join-Path $bin 'package-manifest.json');$null=Package $bin
for($i=0;$i-lt3;$i++){Invoke-ServiceControl -Words @('create',$names[$i],'binPath=',('"'+$exe+'" --service '+$roles[$i]),'start=','demand','type=','own','obj=',$(if($roles[$i]-eq'setup'){'LocalSystem'}else{'NT SERVICE\'+$names[$i]}));Invoke-ServiceControl -Words @('sidtype',$names[$i],'unrestricted')}
$g=Sid $names[0];$a=Sid $names[1];Rules $root @() @($g,$a);Rules $bin @() @($g,$a);foreach($d in @('protected','shared','guardian-reports','app-reports','setup-reports')){$null=New-Item -ItemType Directory -Path (Join-Path $root $d)};Rules (Join-Path $root 'protected') @($g) @() $false;Rules (Join-Path $root 'shared') @($g) @($a);Rules (Join-Path $root 'guardian-reports') @($g) @();Rules (Join-Path $root 'app-reports') @($a) @();Rules (Join-Path $root 'setup-reports') @() @()
$experiment=[guid]::NewGuid().ToString('N');$create=Run 'setup' 'create' $experiment
foreach($id in @('setup.restricted.create-rsa-wrapping-key','setup.app-readable.create-rsa-wrapping-key','setup.publish-control-set')){if(-not(Pass $create $id)){throw 'Creation gate failed; retain state'}}
$verify1=Run 'guardian' 'verify' $experiment;foreach($label in @('restricted','app-readable')){foreach($suffix in @('reopen-policy-decrypt','private-export-denied')){if(-not(Pass $verify1 ('guardian.'+$label+'.'+$suffix))){throw 'Guardian gate failed; retain state'}}};if(-not(Pass $verify1 'guardian.envelope-negative-matrix')){throw 'Envelope negative matrix failed; retain state'}
$probe=Run 'app' 'probe' $experiment;foreach($actor in @('app','child')){if(-not(Pass $probe ($actor+'.restricted.open') @('OBSERVED_BAD_KEYSET','PASS_ACCESS_DENIED'))-or-not(Pass $probe ($actor+'.app-readable.open-decrypt-control'))){throw 'App contrast failed; retain state'}};if(-not(Pass $probe 'app.child-probe-execution')-or-not(Pass $probe 'child.token-identity')){throw 'Child gate failed; retain state'}
$verify2=Run 'guardian' 'verify' $experiment;foreach($label in @('restricted','app-readable')){foreach($suffix in @('reopen-policy-decrypt','private-export-denied')){if(-not(Pass $verify2 ('guardian.'+$label+'.'+$suffix))){throw 'Fresh Guardian gate failed; retain state'}}};if(-not(Pass $verify2 'guardian.envelope-negative-matrix')){throw 'Fresh envelope negative matrix failed; retain state'}
$cleanup=Run 'setup' 'cleanup' $experiment;foreach($label in @('restricted','app-readable')){if(-not(Pass $cleanup ('setup.'+$label+'.delete-owned-key'))){throw 'Cleanup unconfirmed; retain state'}}
$summary=@{schemaVersion=1;scope='TEST_ONLY_SOFTWARE_KSP_WRAPPING_V2';experimentId=$experiment;platformPolicy='WINDOWS_10_11_X64_BUILD_14393_PLUS_NO_LIFECYCLE_GATE';vendorLifecycleNotRequired=$true;osCaption=$caption;osBuild=$build;displayVersion=$displayVersion;hostFeasibilityPassed=$true;securityAccepted=$false;productionAccepted=$false;matrixAccepted=$false;ordinaryUserNotTested=$true;services=@($names|ForEach-Object{Get-CimInstance Win32_Service -Filter "Name='$_'"|Select-Object Name,State,StartMode,StartName,PathName});timeUtc=[DateTime]::UtcNow.ToString('o')};$path=Join-Path $root ('wrapping-summary-'+[guid]::NewGuid().ToString('N')+'.json');$summary|ConvertTo-Json -Depth 5|Set-Content -LiteralPath $path -Encoding UTF8;Write-Host ('Report: '+$path)
