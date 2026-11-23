# Inert guards only: no real SCM changes, persisted keys, accounts or ACL writes.
[CmdletBinding()]param([Parameter(Mandatory=$true)][string]$PackageRoot)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$controller=Join-Path $repo 'licensing/windows-spike/wrapping-reinstall-kit/Run-Wrapping-Reinstall.ps1'
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($controller,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Controller parser failed'}
$text=[IO.File]::ReadAllText($controller)
$source=[IO.File]::ReadAllText((Join-Path $repo 'licensing/windows-spike/wrapping-reinstall-control/Program.cs'))
$native=[IO.File]::ReadAllText((Join-Path $repo 'licensing/windows-spike/wrapping-control/WrappingNative.cs'))
function ImportHelper([string]$Name){
  $definitions=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -ceq $Name},$true))
  if($definitions.Count -ne 1){throw ('Missing helper '+$Name)}
  # Dot-source at script scope via the returned definition, never the physical body.
  $definitions[0].Extent.Text
}
foreach($name in @('Plain','Arg','Invoke-ServiceControl','OptionalProperty','HashFile','WriteNewJson','CheckFiles','Package','Kit','ArtifactEvidence','Pass','AssertReportIdentity','AssertVersionSet','AssertStoppedServices','Run','AssertApp','EvidenceInventory','AssertInventory','AssertGuardian','SharedInventory','AclHash','DirectoryInventory','AssertProtected','AssertProtectedSame','AssertAbsent','WaitAbsent','AssertRoleSids','AssertOriginalServices','CreateRegistrations','AssertProbeAdmission','AssertArtifactSame','AssertCheckpoint','AssertPausedPlan','RefuseMarkers','UninstallBoundary','ReinstallBoundary')){
  Invoke-Expression (ImportHelper $name)
}
function Reject([scriptblock]$Action,[string]$Label){
  $failed=$false;try{&$Action}catch{$failed=$true;$script:lastRejectedError=$_.Exception.Message}
  if(-not$failed){throw ('Unsafe acceptance: '+$Label)}
}
function Clone($Object){$Object|ConvertTo-Json -Depth 14|ConvertFrom-Json}
$scope='TEST_ONLY_SOFTWARE_KSP_WRAPPING_V7'
$names=@('Ecs.Lic008.WrappingV7.Guardian','Ecs.Lic008.WrappingV7.App','Ecs.Lic008.WrappingV7.Setup')
$roles=@('guardian','app','setup');$activeVersion='0.14.0';$kitRoot=$PackageRoot
$null=Kit $PackageRoot
$dir=Join-Path $PackageRoot 'BIN';$exe=Join-Path $dir 'Ecs.Lic008.WrappingV7.exe'
&$exe --self-test;if($LASTEXITCODE -ne 0){throw 'Pure guards failed'}
$contract=(&$exe --report-contract|Out-String)|ConvertFrom-Json
if($LASTEXITCODE -ne 0){throw 'Actual shared emitter failed'}
$artifact=ArtifactEvidence $dir $activeVersion
AssertReportIdentity $contract 'guardian' 'verify' '11111111111111111111111111111111' '22222222222222222222222222222222' $artifact
foreach($property in @('scope','role','action','RunId','ExperimentId','artifactVersion','managedAssemblySha256','packageManifestSha256','binarySha256','checklistId','schemaVersion','serviceIdentityMatched','productionAccepted','securityAccepted','productionUninstallTested','productionReinstallTested')){
  $wrong=Clone $contract;$wrong.$property='wrong'
  Reject {AssertReportIdentity $wrong 'guardian' 'verify' '11111111111111111111111111111111' '22222222222222222222222222222222' $artifact} ('report '+$property)
}
Reject {Package $dir 'unknown'} 'unknown version'
foreach($name in @('Run-Wrapping-Reinstall.ps1','README-fa.txt')){
  if((HashFile (Join-Path $PackageRoot $name)) -cne (HashFile (Join-Path $repo ('licensing/windows-spike/wrapping-reinstall-kit/'+$name)))){throw 'Kit source differs'}
}
foreach($name in @('BranchName','ContentType','Ring','DisplayVersion','ReleaseId')){if($null -ne (OptionalProperty ([pscustomobject]@{}) $name)){throw 'Optional property failed'}}
if((Get-Alias sc).Definition -cne 'Set-Content'){throw 'Expected Windows PowerShell alias missing'}
$sc=Join-Path $PSHOME 'powershell.exe'
Invoke-ServiceControl -Words @('-NoProfile','-NonInteractive','-Command','if ("a b".Length -ne 3) { exit 7 }; exit 0')
Reject {Invoke-ServiceControl -Words @('-NoProfile','-NonInteractive','-Command','exit 7')} 'native failure propagation'
foreach($required in @('NCRYPT_SILENT_FLAG','NCRYPT_PAD_OAEP_FLAG','NCryptEncrypt','NCryptDecrypt','Algorithm = "SHA256"','CryptographicOperations.ZeroMemory','RSAEncryptionPadding.OaepSHA256','new AesGcm(dataKey, 16)','CreationAllowed','prepare-checkpoint.json','uninstall-intent.json','reinstall-intent.json','protectedDirectoryDaclSha256','child.artifact-identity')){
  if(-not($source+$native).Contains($required)){throw ('Missing source guard '+$required)}
}
foreach($forbidden in @('OaepSHA1','RSAEncryptionPadding.Pkcs1','NCryptProtectSecret','ECDSA_P256','Ecs.Lic008.WrappingV6','Restart-Computer','shutdown.exe','New-LocalUser','LOCAL=machine','$appl.BranchName','$currentVersion.DisplayVersion')){
  if(($source+$text).Contains($forbidden)){throw ('Unsafe source/controller '+$forbidden)}
}
$later=$text.Substring($text.IndexOf('# Later stages must NEVER'))
if($later.Contains("Run 'setup' 'create'") -or $later.Contains('Rules ')){throw 'Recreation/ACL mutation after Prepare'}
foreach($name in @('UninstallBoundary','ReinstallBoundary')){
  $boundary=ImportHelper $name
  foreach($forbidden in @('Remove-Item','Set-Acl','Rules ',"'cleanup'","'setup' 'create'")){if($boundary.Contains($forbidden)){throw ('Unsafe boundary '+$name)}}
}
$commands=@($ast.FindAll({param($n)$n -is [Management.Automation.Language.CommandAst]},$true))
if(@($commands|Where-Object{$_.GetCommandName() -ieq 'sc'}).Count){throw 'Bare sc forbidden'}
foreach($required in @('uninstall-run-intent.json','reinstall-run-intent.json','reinstall-activation.json','reinstall-proof.json','productionUninstallTested=$false','productionReinstallTested=$false','keyRecreationAttempted=$false','interruptionPhysicallyTested=$false','build -ge 14393','build -lt 22000','build -ge 22000')){
  if(-not$text.Contains($required)){throw ('Missing boundary guard '+$required)}
}
Write-Output 'PASS: pure/emitter/artifact/package/source/crypto/platform/alias guards.'

# Real inert file IO and READ-ONLY ACL hashes.
$root=Join-Path ([IO.Path]::GetTempPath()) ('lic008-reinstall-files-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $root
foreach($name in @('bin','shared','setup-reports','guardian-reports','app-reports')){$null=New-Item -ItemType Directory -Path (Join-Path $root $name)}
foreach($relative in @('shared/control-set.json','shared/restricted-envelope.json','shared/app-readable-envelope.json','shared/app-readable-hash.json','setup-reports/create.json','guardian-reports/verify.json','app-reports/probe.json')){WriteNewJson (Join-Path $root $relative) @{fixture=$true}}
$inventory=@(EvidenceInventory);if($inventory.Count -ne 7){throw 'Inventory failed'};AssertInventory $inventory @(EvidenceInventory)
$directories=@(DirectoryInventory);if($directories.Count -ne 6){throw 'Directory inventory failed'}
AssertInventory $directories @(DirectoryInventory)
Reject {WriteNewJson (Join-Path $root 'shared/control-set.json') @{overwrite=$true}} 'no overwrite'
Reject {AssertInventory $inventory @()} 'missing evidence'
foreach($property in @('sha256','daclSha256','relative')){
  $wrong=Clone $inventory;$wrong[0].$property='wrong';Reject {AssertInventory $inventory $wrong} ('inventory '+$property)
}
$fixture=Join-Path $root 'package-fixture';$null=New-Item -ItemType Directory -Path $fixture
foreach($name in @('Ecs.Lic008.WrappingV7.exe','Ecs.Lic008.WrappingV7.dll','Ecs.Lic008.WrappingV7.deps.json','Ecs.Lic008.WrappingV7.runtimeconfig.json')){Set-Content -LiteralPath (Join-Path $fixture $name) -Value 'fixture' -Encoding UTF8}
$entries=@(Get-ChildItem -LiteralPath $fixture -File|ForEach-Object{@{name=$_.Name;size=$_.Length;sha256=(HashFile $_.FullName)}})
WriteNewJson (Join-Path $fixture 'package-manifest.json') @{schemaVersion=1;checklistId='LIC-6.2-008';scope=$scope;version='0.14.0';sdk='10.0.400';runtime='10.0.11';files=$entries}
$null=Package $fixture '0.14.0'
$wrong=Clone $entries;$wrong[0].name='../outside.dll';Reject {CheckFiles $fixture $wrong} 'traversal'
$wrong=Clone $entries;$wrong[0].name='missing.dll';Reject {CheckFiles $fixture $wrong} 'missing file'
$wrong=Clone $entries;$wrong[0]=$wrong[1];Reject {CheckFiles $fixture $wrong} 'duplicate file'
Set-Content -LiteralPath (Join-Path $fixture 'Ecs.Lic008.WrappingV7.dll') -Value 'tampered' -Encoding UTF8
Reject {Package $fixture '0.14.0'} 'tampered binary'
$ids=@('guardian.restricted.reopen-policy-decrypt','guardian.restricted.private-export-denied','guardian.app-readable.reopen-policy-decrypt','guardian.app-readable.private-export-denied','guardian.envelope-negative-matrix','guardian.protected-inventory')
$good=[pscustomobject]@{runId='11111111111111111111111111111111';results=@($ids|ForEach-Object{[pscustomobject]@{Id=$_;Status='PASS'}});protectedFiles=@(@('app-readable-intent.json','app-readable-owned.json','restricted-hash.json','restricted-intent.json','restricted-owned.json')|ForEach-Object{[pscustomobject]@{relative=('protected/'+$_);sha256=('a'*64);daclSha256=('b'*64)}});protectedDirectoryDaclSha256=('c'*64)}
AssertGuardian $good;AssertProtected $good;AssertProtectedSame $good $good
foreach($id in $ids){$wrong=Clone $good;($wrong.results|Where-Object Id -CEQ $id).Status='FAILED_OR_UNAVAILABLE';Reject {AssertGuardian $wrong} ('admission '+$id)}
foreach($property in @('relative','sha256','daclSha256')){$wrong=Clone $good;$wrong.protectedFiles[0].$property='wrong';Reject {AssertProtectedSame $good $wrong} ('protected '+$property)}
$wrong=Clone $good;$wrong.protectedDirectoryDaclSha256='d'*64;Reject {AssertProtectedSame $good $wrong} 'protected directory DACL'
$wrong=Clone $good;$wrong.results[0].Id=$wrong.results[1].Id;Reject {AssertGuardian $wrong} 'duplicate result'
function FixtureRows{
  @((0..2)|ForEach-Object{$i=$_;[pscustomobject]@{Name=$names[$i];State='Stopped';StartMode='Manual';StartName=$(if($i -eq 2){'LocalSystem'}else{'NT SERVICE\'+$names[$i]});PathName=('"'+$exe+'" --service '+$roles[$i]);ProcessId=0;ServiceSidType=1;ServiceSid=('S-1-5-80-1-2-3-4-'+($i+5))}})
}
$rows=FixtureRows;AssertVersionSet $rows $exe;AssertRoleSids $rows $rows
foreach($property in @('PathName','State','StartMode','StartName','ProcessId','ServiceSidType','Name','ServiceSid')){
  $wrong=Clone $rows;$wrong[1].$property='wrong'
  Reject {AssertVersionSet $wrong $exe;AssertRoleSids $rows $wrong} ('role '+$property)
}
Reject {AssertRoleSids $rows @($rows[0],$rows[1])} 'missing SID'
function RegistrationPresence{return @($script:rows|ForEach-Object Name)}
$script:rows=$rows;Reject {AssertAbsent} 'registration collision';$script:rows=@();AssertAbsent
WriteNewJson (Join-Path $root 'reinstall-intent.json') @{fixture=$true}
Reject {RefuseMarkers @('reinstall-intent.json')} 'one-shot intent'
$kitHash='d'*64;$machineHash='e'*64;$build=22000;$caption='Windows 11 fixture'
$checkpoint=[pscustomobject]@{schemaVersion=1;scope=$scope;kitSha256=$kitHash;machineSha256=$machineHash;osBuild=$build;osCaption=$caption;securityAccepted=$false;productionAccepted=$false;matrixAccepted=$false;experimentId='22222222222222222222222222222222';artifact=$artifact}
AssertCheckpoint $checkpoint $artifact
foreach($property in @('schemaVersion','scope','kitSha256','machineSha256','osBuild','osCaption','securityAccepted','productionAccepted','matrixAccepted','experimentId')){
  $wrong=Clone $checkpoint;$wrong.$property='wrong';Reject {AssertCheckpoint $wrong $artifact} ('checkpoint '+$property)
}
foreach($property in @('version','exeSha256','assemblySha256','manifestSha256')){$wrong=Clone $artifact;$wrong.$property='wrong';Reject {AssertArtifactSame $artifact $wrong} ('artifact '+$property)}
Write-Output 'PASS: actual IO/package/DACL/inventory/protected-evidence/SID/checkpoint negatives.'

# Real controller boundary functions; fixture SCM/crypto/package dependencies.
$realRun=ImportHelper 'Run'
function Kit{return @{fixture=$true}}
function ArtifactEvidence{return $script:fixtureArtifact}
function ServiceRows{return $script:rows}
function Run([string]$Role,[string]$Action,[string]$Experiment){
  $script:probeCount++
  if($Action -cne 'verify' -and $Action -cne 'probe'){throw 'Key creation/cleanup forbidden in fixture'}
  if($Role -ceq 'guardian'){
    $r=Clone $good
    if($script:fault -cin @('missing-key','post-missing-key')){$r.results[0].Status='FAILED_OR_UNAVAILABLE'}
    if($script:fault -cin @('protected-drift','post-protected-drift')){$r.protectedFiles[0].sha256='f'*64}
  }else{
    $r=[pscustomobject]@{runId='33333333333333333333333333333333';results=@(
      [pscustomobject]@{Id='app.restricted.open';Status='OBSERVED_BAD_KEYSET'},
      [pscustomobject]@{Id='child.restricted.open';Status='OBSERVED_BAD_KEYSET'},
      [pscustomobject]@{Id='app.app-readable.open-decrypt-control';Status='PASS'},
      [pscustomobject]@{Id='child.app-readable.open-decrypt-control';Status='PASS'},
      [pscustomobject]@{Id='child.token-identity';Status='PASS'},
      [pscustomobject]@{Id='child.artifact-identity';Status='PASS'},
      [pscustomobject]@{Id='app.child-probe-execution';Status='PASS'})}
  }
  WriteNewJson (Join-Path $root ($Role+'-reports/'+[guid]::NewGuid().ToString('N')+'.json')) $r
  $r
}
function Invoke-ServiceControl([string[]]$Words){
  $script:scCount++
  if($Words[0] -ceq 'delete'){
    if($script:fault -ceq 'second-delete' -and $script:scCount -eq 2){throw 'controlled deletion failure'}
    $script:rows=@($script:rows|Where-Object Name -CNE $Words[1]);return
  }
  if($Words[0] -ceq 'create'){
    $script:createCount++
    if($script:fault -ceq 'second-create' -and $script:createCount -eq 2){throw 'controlled recreation failure'}
    $entry=@(FixtureRows|Where-Object Name -CEQ $Words[1])[0]
    if($script:fault -ceq 'sid-drift'){$entry.ServiceSid='S-1-5-80-9-9-9-9-9'}
    $script:rows+=@($entry);return
  }
  if($Words[0] -ceq 'sidtype'){return}
  throw 'Unexpected SCM call (start/config forbidden)'
}
$fixtureRun='function Run {'+(Get-Item function:Run).Definition+'}'
foreach($scenario in @('missing-key','protected-drift','second-delete','uninstall-success','collision','second-create','sid-drift','post-missing-key','post-protected-drift','reinstall-success')){
  $root=Join-Path ([IO.Path]::GetTempPath()) ('lic008-reinstall-boundary-'+$scenario+'-'+[guid]::NewGuid().ToString('N'))
  $null=New-Item -ItemType Directory -Path $root
  foreach($name in @('bin','shared','setup-reports','guardian-reports','app-reports')){$null=New-Item -ItemType Directory -Path (Join-Path $root $name)}
  foreach($relative in @('shared/control-set.json','shared/restricted-envelope.json','shared/app-readable-envelope.json','shared/app-readable-hash.json','setup-reports/create.json','guardian-reports/verify.json','app-reports/probe.json')){WriteNewJson (Join-Path $root $relative) @{fixture=$true}}
  WriteNewJson (Join-Path $root 'plan.json') @{fixture=$true}
  WriteNewJson (Join-Path $root 'uninstall-run-intent.json') @{fixture=$true}
  $exe=Join-Path $root 'bin/Ecs.Lic008.WrappingV7.exe'
  $script:fixtureArtifact=$artifact;$script:rows=FixtureRows;$expectedRows=Clone $script:rows
  $script:fault=$scenario;$script:probeCount=0;$script:scCount=0;$script:createCount=0
  $state=[pscustomobject]@{experimentId='22222222222222222222222222222222';services=$expectedRows;files=@(EvidenceInventory);directories=@(DirectoryInventory);guardian=(Clone $good);artifact=$artifact;installationSha256=('f'*64)}
  if($scenario -cin @('missing-key','protected-drift','second-delete','uninstall-success')){
    if($scenario -ceq 'uninstall-success'){
      UninstallBoundary $state ('a'*64)
      if($script:scCount -ne 3 -or $script:rows.Count -ne 0 -or -not(Test-Path -LiteralPath (Join-Path $root 'uninstall-checkpoint.json'))){throw 'Uninstall fixture failed'}
    }else{
      Reject {UninstallBoundary $state ('a'*64)} ('uninstall '+$scenario)
      if(Test-Path -LiteralPath (Join-Path $root 'uninstall-checkpoint.json')){throw 'Failed uninstall checkpoint admitted'}
      if($scenario -ceq 'second-delete'){
        if($script:rows.Count -ne 2 -or -not(Test-Path -LiteralPath (Join-Path $root 'uninstall-intent.json'))){throw ('Partial delete intent lost: '+$script:lastRejectedError+'; SCM calls='+$script:scCount+'; roles='+$script:rows.Count)}
      }elseif($script:scCount -ne 0 -or $script:probeCount -ne 1 -or (Test-Path -LiteralPath (Join-Path $root 'uninstall-intent.json'))){throw ('Invalid key/protected admission fixture failed: '+$script:lastRejectedError)}
    }
  }else{
    WriteNewJson (Join-Path $root 'uninstall-intent.json') @{fixture=$true}
    $script:rows=if($scenario -ceq 'collision'){@($expectedRows[0])}else{@()}
    if($scenario -ceq 'reinstall-success'){
      ReinstallBoundary $state ('a'*64)
      if($script:createCount -ne 3 -or $script:probeCount -ne 2 -or -not(Test-Path -LiteralPath (Join-Path $root 'reinstall-activation.json'))){throw 'Reinstall fixture failed'}
    }else{
      Reject {ReinstallBoundary $state ('a'*64)} ('reinstall '+$scenario)
      if($scenario -ceq 'collision'){if($script:scCount -ne 0 -or (Test-Path -LiteralPath (Join-Path $root 'reinstall-intent.json'))){throw 'Collision mutated state'}}
      elseif(-not(Test-Path -LiteralPath (Join-Path $root 'reinstall-intent.json'))){throw 'Failed reinstall intent lost'}
      if($scenario -cin @('post-missing-key','post-protected-drift')){if($script:createCount -ne 3 -or $script:probeCount -ne 1 -or -not(Test-Path -LiteralPath (Join-Path $root 'reinstall-activation.json'))){throw ('Post-admission fixture failed: '+$script:lastRejectedError)}}
      if($scenario -cin @('second-create','sid-drift')){
        if($script:probeCount -ne 0 -or (Test-Path -LiteralPath (Join-Path $root 'reinstall-activation.json'))){throw 'Partial/mismatched set started'}
        $pausedHash=HashFile (Join-Path $root 'plan.json')
        Invoke-Expression $realRun
        Reject {Run 'guardian' 'verify' $state.experimentId} 'real Run with partial/mismatched set'
        if((HashFile (Join-Path $root 'plan.json')) -cne $pausedHash){throw 'Bad role set changed paused plan'}
        # Restore fixture implementation for subsequent scenarios.
        Invoke-Expression $fixtureRun
      }
    }
  }
}
Write-Output 'PASS: actual Uninstall/Reinstall boundaries with inert missing-key/protected-drift/collision/partial-SCM/SID/success fixtures.'
Write-Output 'PASS: inert guards only; physical Prepare/Uninstall/Reinstall NOT_RUN.'
