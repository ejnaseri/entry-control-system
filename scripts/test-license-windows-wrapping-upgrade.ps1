# LIC-6.2-008 inert tests: filesystem fixtures only, no real SCM/key/account/ACL operations.
[CmdletBinding()]param([Parameter(Mandatory=$true)][string]$PackageRoot)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$controller=Join-Path $repo 'licensing/windows-spike/wrapping-upgrade-kit/Run-Wrapping-Upgrade.ps1'
$tokens=$null;$errors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($controller,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Controller parser failed'}
$text=[IO.File]::ReadAllText($controller)
$source=[IO.File]::ReadAllText((Join-Path $repo 'licensing/windows-spike/wrapping-upgrade-control/Program.cs'))
$native=[IO.File]::ReadAllText((Join-Path $repo 'licensing/windows-spike/wrapping-control/WrappingNative.cs'))
foreach($helper in @('Plain','Arg','Invoke-ServiceControl','OptionalProperty','HashFile','WriteNewJson','CheckFiles','Package','AssertDistinct','Kit','ArtifactEvidence','Pass','AssertReportIdentity','AssertVersionSet','AssertStoppedServices','AssertActivation','Run','AssertInventory','EvidenceInventory','AssertGuardian','Invoke-UpgradeBoundary')){
  $definition=@($ast.FindAll({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $helper},$true))
  if($definition.Count -ne 1){throw ('Missing helper: '+$helper)}
  Invoke-Expression $definition[0].Extent.Text
}
function Reject([scriptblock]$Action,[string]$Label){$failed=$false;try{&$Action}catch{$failed=$true};if(-not$failed){throw ('Unsafe acceptance: '+$Label)}}
$scope='TEST_ONLY_SOFTWARE_KSP_WRAPPING_V6'
$names=@('Ecs.Lic008.WrappingV6.Guardian','Ecs.Lic008.WrappingV6.App','Ecs.Lic008.WrappingV6.Setup')
$roles=@('guardian','app','setup')
$null=Kit $PackageRoot
$old=Package (Join-Path $PackageRoot 'OLD') '0.13.0';$new=Package (Join-Path $PackageRoot 'NEW') '0.13.1'
AssertDistinct $old $new
Reject {AssertDistinct $new $old} 'downgrade'
$duplicate=$new|ConvertTo-Json -Depth 8|ConvertFrom-Json
($duplicate.files|Where-Object name -CEQ 'Ecs.Lic008.WrappingV6.dll').sha256=($old.files|Where-Object name -CEQ 'Ecs.Lic008.WrappingV6.dll').sha256
Reject {AssertDistinct $old $duplicate} 'identical managed code'
foreach($variant in @('OLD','NEW')){
  $version=if($variant -ceq 'OLD'){'0.13.0'}else{'0.13.1'}
  $dir=Join-Path $PackageRoot $variant;$exe=Join-Path $dir 'Ecs.Lic008.WrappingV6.exe'
  &$exe --self-test;if($LASTEXITCODE -ne 0){throw 'Pure guards failed'}
  $contract=(&$exe --report-contract|Out-String)|ConvertFrom-Json
  if($LASTEXITCODE -ne 0){throw 'Real emitter contract failed'}
  $artifact=ArtifactEvidence $dir $version
  AssertReportIdentity $contract 'guardian' 'verify' '11111111111111111111111111111111' '22222222222222222222222222222222' $artifact
  foreach($property in @('scope','role','action','RunId','ExperimentId','artifactVersion','managedAssemblySha256','packageManifestSha256','binarySha256','checklistId','schemaVersion','serviceIdentityMatched','productionAccepted','securityAccepted','productionUpgradeTested')){
    $wrong=$contract|ConvertTo-Json -Depth 8|ConvertFrom-Json;$wrong.$property='wrong'
    Reject {AssertReportIdentity $wrong 'guardian' 'verify' '11111111111111111111111111111111' '22222222222222222222222222222222' $artifact} ('report '+$variant+'/'+$property)
  }
  Reject {Package $dir 'unknown'} 'unknown version'
}
foreach($name in @('Run-Wrapping-Upgrade.ps1','README-fa.txt')){if((HashFile (Join-Path $PackageRoot $name)) -cne (HashFile (Join-Path $repo ('licensing/windows-spike/wrapping-upgrade-kit/'+$name)))){throw 'Kit source differs'}}
foreach($property in @('BranchName','ContentType','Ring','DisplayVersion','ReleaseId')){if($null -ne (OptionalProperty ([pscustomobject]@{}) $property)){throw 'Missing optional property failed'}}
if((OptionalProperty ([pscustomobject]@{DisplayVersion='21H2'}) 'DisplayVersion') -cne '21H2'){throw 'Present optional property failed'}
if((Get-Alias sc).Definition -cne 'Set-Content'){throw 'Expected sc alias missing'}
$sc=Join-Path $PSHOME 'powershell.exe'
Invoke-ServiceControl -Words @('-NoProfile','-NonInteractive','-Command','if ("a b".Length -ne 3) { exit 7 }; exit 0')
Reject {Invoke-ServiceControl -Words @('-NoProfile','-NonInteractive','-Command','exit 7')} 'child failure propagation'
$commands=@($ast.FindAll({param($node)$node -is [Management.Automation.Language.CommandAst]},$true))
if(@($commands|Where-Object{$_.GetCommandName() -ieq 'sc'}).Count){throw 'Bare sc forbidden'}
foreach($required in @('NCRYPT_SILENT_FLAG','NCRYPT_PAD_OAEP_FLAG','NCryptEncrypt','NCryptDecrypt','Algorithm = "SHA256"','CryptographicOperations.ZeroMemory','RSAEncryptionPadding.OaepSHA256','new AesGcm(dataKey, 16)','PlanMatchesArtifact','ChildReport','child.artifact-identity')){if(-not($source+$native).Contains($required)){throw ('Missing guard '+$required)}}
foreach($forbidden in @('OaepSHA1','RSAEncryptionPadding.Pkcs1','NCryptProtectSecret','ECDSA_P256','Ecs.Lic008.WrappingV5')){if(($text+$source).Contains($forbidden)){throw ('Unsafe path '+$forbidden)}}
foreach($forbidden in @('Restart-Computer','shutdown.exe','New-LocalUser','LOCAL=machine','$appl.BranchName','$currentVersion.DisplayVersion')){if($text.Contains($forbidden)){throw ('Unsafe controller '+$forbidden)}}
$upgradeText=$text.Substring($text.IndexOf('# Upgrade must NEVER'))
if($upgradeText.Contains("Run 'setup' 'create'") -or $upgradeText.Contains("@('create'")){throw 'Upgrade recreation forbidden'}
foreach($required in @('upgrade-run-intent.json','upgrade-intent.json','upgrade-activation.json','AssertVersionSet','productionUpgradeTested=$false','securityAccepted=$false','matrixAccepted=$false','keyRecreationAttempted=$false','interruptionPhysicallyTested=$false','build -ge 14393','build -lt 22000','build -ge 22000')){if(-not$text.Contains($required)){throw ('Missing boundary '+$required)}}
Write-Output 'PASS: OLD/NEW real emitters, managed/package identity negatives, distinct artifacts, source/crypto/platform/alias guards.'

# Real package/inventory IO and no-overwrite negatives, not persisted keys.
$root=Join-Path ([IO.Path]::GetTempPath()) ('lic008-upgrade-fixtures-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $root
foreach($dir in @('shared','setup-reports','guardian-reports','app-reports')){$null=New-Item -ItemType Directory -Path (Join-Path $root $dir)}
foreach($relative in @('shared/control-set.json','shared/restricted-envelope.json','shared/app-readable-envelope.json','shared/app-readable-hash.json','setup-reports/create.json','guardian-reports/verify.json','app-reports/probe.json')){WriteNewJson (Join-Path $root $relative) @{fixture=$true}}
$inventory=@(EvidenceInventory);if($inventory.Count -ne 7){throw 'Initial inventory failed'}
AssertInventory $inventory @(EvidenceInventory)
Reject {WriteNewJson (Join-Path $root 'shared/control-set.json') @{overwrite=$true}} 'checkpoint overwrite'
Reject {AssertInventory $inventory @()} 'missing evidence'
Set-Content -LiteralPath (Join-Path $root 'shared/control-set.json') -Value '{"changed":true}' -Encoding UTF8
Reject {AssertInventory $inventory @(EvidenceInventory)} 'altered envelope/checkpoint'
$packageFixture=Join-Path $root 'package-test';$null=New-Item -ItemType Directory -Path $packageFixture
foreach($name in @('Ecs.Lic008.WrappingV6.exe','Ecs.Lic008.WrappingV6.dll','Ecs.Lic008.WrappingV6.deps.json','Ecs.Lic008.WrappingV6.runtimeconfig.json')){Set-Content -LiteralPath (Join-Path $packageFixture $name) -Value 'fixture' -Encoding UTF8}
$entries=@(Get-ChildItem -LiteralPath $packageFixture -File|ForEach-Object{@{name=$_.Name;size=$_.Length;sha256=(HashFile $_.FullName)}})
$fixtureManifest=@{schemaVersion=1;checklistId='LIC-6.2-008';scope=$scope;version='0.13.0';sdk='10.0.400';runtime='10.0.11';files=$entries}
WriteNewJson (Join-Path $packageFixture 'package-manifest.json') $fixtureManifest
$null=Package $packageFixture '0.13.0'
Reject {Package $packageFixture '0.13.1'} 'wrong version'
Set-Content -LiteralPath (Join-Path $packageFixture 'Ecs.Lic008.WrappingV6.dll') -Value 'tampered' -Encoding UTF8
Reject {Package $packageFixture '0.13.0'} 'tampered package'
Set-Content -LiteralPath (Join-Path $packageFixture 'Ecs.Lic008.WrappingV6.dll') -Value 'fixture' -Encoding UTF8
$null=Package $packageFixture '0.13.0'
$invalid=$fixtureManifest|ConvertTo-Json -Depth 8|ConvertFrom-Json;$invalid.files[0].name='../outside.dll'
Reject {CheckFiles $packageFixture $invalid.files} 'traversal'
$invalid.files[0].name='missing.dll';Reject {CheckFiles $packageFixture $invalid.files} 'missing file'
$invalid=$fixtureManifest|ConvertTo-Json -Depth 8|ConvertFrom-Json;$invalid.files[0]=$invalid.files[1]
Reject {CheckFiles $packageFixture $invalid.files} 'duplicate path'
$ids=@('guardian.restricted.reopen-policy-decrypt','guardian.restricted.private-export-denied','guardian.app-readable.reopen-policy-decrypt','guardian.app-readable.private-export-denied','guardian.envelope-negative-matrix')
$good=[pscustomobject]@{runId='11111111111111111111111111111111';results=@($ids|ForEach-Object{[pscustomobject]@{Id=$_;Status='PASS'}})}
AssertGuardian $good
foreach($id in $ids){$wrong=$good|ConvertTo-Json -Depth 8|ConvertFrom-Json;($wrong.results|Where-Object Id -CEQ $id).Status='FAILED_OR_UNAVAILABLE';Reject {AssertGuardian $wrong} ('admission '+$id)}
$wrong=$good|ConvertTo-Json -Depth 8|ConvertFrom-Json;$wrong.results[0].Id=$wrong.results[1].Id;Reject {AssertGuardian $wrong} 'duplicate Guardian row'
function FixtureRows([string]$Path){
  @((0..2)|ForEach-Object{$idx=$_;[pscustomobject]@{Name=$names[$idx];State='Stopped';StartMode='Manual';StartName=$(if($idx -eq 2){'LocalSystem'}else{'NT SERVICE\'+$names[$idx]});PathName=('"'+$Path+'" --service '+$roles[$idx]);ProcessId=0;ServiceSidType=1}})
}
$fixtureExe=Join-Path $root 'old.exe';$rows=FixtureRows $fixtureExe;AssertVersionSet $rows $fixtureExe
foreach($property in @('PathName','State','StartMode','StartName','ProcessId','ServiceSidType','Name')){$wrong=$rows|ConvertTo-Json -Depth 8|ConvertFrom-Json;$wrong[1].$property='wrong';Reject {AssertVersionSet $wrong $fixtureExe} ('mixed role '+$property)}
Reject {AssertVersionSet @($rows[0],$rows[1]) $fixtureExe} 'missing role'
Write-Output 'PASS: actual package/inventory/no-overwrite, admission negatives and complete role-version guard.'

# Actual boundary with inert copied data and mocked SCM/ACL/crypto. Actual helpers tested above.
$realRun=@($ast.FindAll({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq 'Run'},$true))[0].Extent.Text
function Kit([string]$Dir){return @{fixture=$true}}
function Package([string]$Dir,[string]$Version){
  if($Version -cnotin @('0.13.0','0.13.1')){throw 'unknown fixture version'}
  if($script:fault -ceq 'after-stage' -and $Dir -ceq (Join-Path $root 'bin-new')){throw 'controlled staging failure'}
  @{version=$Version;scope=$scope;files=@(@{name='Ecs.Lic008.WrappingV6.dll';sha256=$(if($Version -ceq '0.13.0'){'a'*64}else{'b'*64})})}
}
function ArtifactEvidence([string]$Dir,[string]$Version){@{version=$Version;exeSha256=('c'*64);assemblySha256=$(if($Version -ceq '0.13.0'){'a'*64}else{'b'*64});manifestSha256=$(if($Version -ceq '0.13.0'){'d'*64}else{$script:candidateManifestHash})}}
function Sid([string]$Name){return 'S-1-5-80-1'}
function Rules{}
function ServiceRows{return $script:rows}
function SharedInventory{return $script:shared}
function Run([string]$Role,[string]$Action,[string]$Experiment){if($Role -cne 'guardian' -or $Action -cne 'verify'){throw 'Unexpected probe'};$script:probeCount++;return $script:guardianResult}
function Invoke-ServiceControl([string[]]$Words){
  if($Words[0] -cne 'config'){throw 'Startup forbidden in boundary fixture'}
  $script:configCount++
  if($script:fault -ceq 'second-path' -and $script:configCount -eq 2){throw 'controlled path-switch failure'}
  $idx=[Array]::IndexOf($names,$Words[1]);$script:rows[$idx].PathName=$Words[3]
}
foreach($scenario in @('missing-key','wrong-identity','after-stage','second-path','success')){
  $root=Join-Path ([IO.Path]::GetTempPath()) ('lic008-upgrade-boundary-'+$scenario+'-'+[guid]::NewGuid().ToString('N'))
  $null=New-Item -ItemType Directory -Path $root
  $kitRoot=Join-Path $root 'fixture-kit';$null=New-Item -ItemType Directory -Path (Join-Path $kitRoot 'NEW')
  Set-Content -LiteralPath (Join-Path $kitRoot 'NEW/Ecs.Lic008.WrappingV6.dll') -Value 'inert-new-code' -Encoding UTF8
  Set-Content -LiteralPath (Join-Path $kitRoot 'NEW/package-manifest.json') -Value '{"fixture":true}' -Encoding UTF8
  $script:candidateManifestHash=HashFile (Join-Path $kitRoot 'NEW/package-manifest.json')
  $script:exe=Join-Path $root 'old.exe';$script:activeVersion='0.13.0';$script:rows=FixtureRows $exe
  $script:shared=@([pscustomobject]@{relative='shared/control-set.json';sha256=('e'*64)})
  $script:guardianResult=$good|ConvertTo-Json -Depth 8|ConvertFrom-Json
  if($scenario -cin @('missing-key','wrong-identity')){$script:guardianResult.results[0].Status='FAILED_OR_UNAVAILABLE'}
  $script:fault=$scenario;$script:configCount=0;$script:probeCount=0;$destination=Join-Path $root 'bin-new'
  if($scenario -ceq 'success'){
    Invoke-UpgradeBoundary '22222222222222222222222222222222' $script:shared $destination
    if($script:activeVersion -cne '0.13.1' -or $script:configCount -ne 3 -or -not(Test-Path -LiteralPath (Join-Path $root 'upgrade-activation.json'))){throw 'Successful fixture failed'}
  }else{
    Reject {Invoke-UpgradeBoundary '22222222222222222222222222222222' $script:shared $destination} ('fault '+$scenario)
    if(Test-Path -LiteralPath (Join-Path $root 'upgrade-activation.json')){throw 'Incomplete activation admitted'}
    if($scenario -cin @('missing-key','wrong-identity')){
      if((Test-Path -LiteralPath $destination) -or (Test-Path -LiteralPath (Join-Path $root 'upgrade-intent.json')) -or $script:configCount -ne 0 -or $script:probeCount -ne 1){throw 'Invalid admission mutated candidate/SCM'}
    }else{
      if(-not(Test-Path -LiteralPath (Join-Path $root 'upgrade-intent.json'))){throw 'Incomplete intent lost'}
      if($scenario -ceq 'after-stage' -and $script:configCount -ne 0){throw 'Path switched before verification'}
      if($scenario -ceq 'second-path'){
        Invoke-Expression $realRun
        Reject {Run 'guardian' 'verify' '22222222222222222222222222222222'} 'mixed-set real startup'
        if(Test-Path -LiteralPath (Join-Path $root 'plan.json')){throw 'Mixed version wrote plan'}
        function Run([string]$Role,[string]$Action,[string]$Experiment){$script:probeCount++;return $script:guardianResult}
      }
    }
  }
}
Write-Output 'PASS: actual Upgrade boundary inert missing-key/identity/staging/partial-SCM/success fixtures; no mixed-set plan/start; retained intent.'
Write-Output 'PASS: LIC008 Upgrade inert guards only; physical Prepare/Upgrade NOT_RUN.'
