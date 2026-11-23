# Static and pure guards only; never installs a service or creates a persisted key.
[CmdletBinding()]param([Parameter(Mandatory=$true)][string]$PackageRoot)
Set-StrictMode -Version Latest;$ErrorActionPreference='Stop';$repo=Split-Path -Parent $PSScriptRoot;$exe=Join-Path $PackageRoot 'Ecs.Lic008.WrappingV5.exe';&$exe --self-test;if($LASTEXITCODE-ne0){throw 'Executable guards failed'}
$script=Join-Path $repo 'licensing/windows-spike/wrapping-repair-kit/Run-Wrapping-Repair.ps1';$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($script,[ref]$tokens,[ref]$errors);if($errors.Count){throw 'Controller parser failed'};$text=[IO.File]::ReadAllText($script)
foreach($required in @('TEST_ONLY_SOFTWARE_KSP_WRAPPING_V5','Ecs.Lic008.WrappingV5','Unsupported test OS','OBSERVED_BAD_KEYSET','ordinaryUserNotTested=$true','securityAccepted=$false','productionAccepted=$false','matrixAccepted=$false','DisplayVersion','WindowsSelfHost','build -ge 14393','build -lt 22000','build -ge 22000','vendorLifecycleNotRequired=$true','WINDOWS_10_11_X64_BUILD_14393_PLUS_NO_LIFECYCLE_GATE')){if(-not$text.Contains($required)){throw('Missing controller guard: '+$required)}}
foreach($forbidden in @('Ecs.Lic008.ComparisonV1','Ecs.Lic008.ProfileV1','LOCAL=user','LOCAL=machine','net user','New-LocalUser')){if($text.Contains($forbidden)){throw('Forbidden controller content: '+$forbidden)}}
foreach($forbidden in @('$appl.BranchName','$appl.ContentType','$appl.Ring')){if($text.Contains($forbidden)){throw('Strict-mode optional property access forbidden: '+$forbidden)}}
$optional=@($ast.FindAll({param($node)$node-is[Management.Automation.Language.FunctionDefinitionAst]-and$node.Name-ceq'OptionalProperty'},$true));if($optional.Count-ne1){throw 'OptionalProperty function mismatch'};Invoke-Expression $optional[0].Extent.Text;$missing=[pscustomobject]@{WNSUriRegName='fixture';UseSettingsExperience=0};if($null-ne(OptionalProperty $missing 'BranchName')){throw 'Missing optional property fixture failed'};$present=[pscustomobject]@{BranchName='Release'};if((OptionalProperty $present 'BranchName')-cne'Release'){throw 'Present optional property fixture failed'}
# Exercise the production wrapper against an inert child process while the real sc alias exists.
if((Get-Alias sc).Definition -ne 'Set-Content'){throw 'Expected Windows PowerShell alias missing'}
foreach($name in @('Arg','Invoke-ServiceControl')){
  $definition=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true))
  if($definition.Count -ne 1){throw ('Missing wrapper function: '+$name)}
  Invoke-Expression $definition[0].Extent.Text
}
if((Get-Command Invoke-ServiceControl).CommandType -ne 'Function'){throw 'Wrapper name collision'}
$sc=Join-Path $PSHOME 'powershell.exe'
Invoke-ServiceControl -Words @('-NoProfile','-NonInteractive','-Command','if ("a b".Length -ne 3) { exit 7 }; exit 0')
$failed=$false
try { Invoke-ServiceControl -Words @('-NoProfile','-NonInteractive','-Command','exit 7') } catch { $failed=$true }
if(-not $failed){throw 'Native failure was not propagated'}
$commands=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.CommandAst]},$true))
if(@($commands|Where-Object{$_.GetCommandName() -ieq 'sc'}).Count){throw 'Bare sc command forbidden'}
if(@($ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ieq 'sc'},$true)).Count){throw 'Sc function forbidden'}
if($text.Contains('Ecs.Lic008.WrappingV1')){throw 'Retained namespace referenced'}
Write-Output 'PASS: service wrapper with sc alias; child quoting and nonzero exit propagation.'
$source=[IO.File]::ReadAllText((Join-Path $repo 'licensing/windows-spike/wrapping-repair-control/Program.cs'));$native=[IO.File]::ReadAllText((Join-Path $repo 'licensing/windows-spike/wrapping-control/WrappingNative.cs'))
if($source.Contains('Ecs.Lic008.WrappingV1')){throw 'Retained key/service namespace referenced'}
foreach($required in @('RSAEncryptionPadding.OaepSHA256','new AesGcm(dataKey, 16)','CryptographicOperations.ZeroMemory','CngKeyBlobFormat.Pkcs8PrivateBlob','CngKeyUsages.Decryption','NCRYPT_SILENT_FLAG','NCRYPT_PAD_OAEP_FLAG','NCryptEncrypt','NCryptDecrypt','Algorithm = "SHA256"','guardian.envelope-negative-matrix','WrappedKey = Corrupt','Nonce = Corrupt','Aad = Corrupt','Ciphertext = Corrupt','Tag = Corrupt')){if(-not($source+$native).Contains($required)){throw('Missing source boundary: '+$required)}}
foreach($forbidden in @('RSAEncryptionPadding.Pkcs1','OaepSHA1','ECDSA_P256','NCryptProtectSecret')){if(($source+$native).Contains($forbidden)){throw('Forbidden crypto path: '+$forbidden)}}
$manifest=Get-Content -LiteralPath (Join-Path $PackageRoot 'package-manifest.json') -Raw|ConvertFrom-Json;if($manifest.scope-cne'TEST_ONLY_SOFTWARE_KSP_WRAPPING_V5'-or$manifest.version-cne'0.12.0'){throw 'Manifest mismatch'};foreach($entry in $manifest.files){$path=Join-Path $PackageRoot $entry.name;if((Get-Item -LiteralPath $path).Length-ne$entry.size-or(Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant()-cne$entry.sha256){throw 'Manifest file mismatch'}}
Write-Output 'PASS: wrapping package/static guards; no service or persisted-key operation.'
# Real service emitter / actual controller validator, without SCM operations.
foreach($helperName in @('Plain','AssertReportIdentity','AssertInventory','Pass','AssertRepairAdmission','Invoke-RepairBoundary')){
  $definition=@($ast.FindAll({param($node)$node-is[Management.Automation.Language.FunctionDefinitionAst]-and$node.Name-ceq$helperName},$true))
  if($definition.Count-ne1){throw ('Missing helper: '+$helperName)};Invoke-Expression $definition[0].Extent.Text
}
$contract=(& $exe --report-contract | Out-String)|ConvertFrom-Json;if($LASTEXITCODE-ne0){throw 'Contract executable failed'}
$hash=(Get-FileHash -LiteralPath $exe).Hash.ToLowerInvariant()
AssertReportIdentity $contract 'guardian' 'verify' '11111111111111111111111111111111' '22222222222222222222222222222222' $hash
foreach($property in @('scope','role','action','RunId','ExperimentId','binarySha256','checklistId')){
  $wrong=$contract|ConvertTo-Json -Depth 10|ConvertFrom-Json;$wrong.$property='wrong'
  $rejected=$false;try{AssertReportIdentity $wrong 'guardian' 'verify' '11111111111111111111111111111111' '22222222222222222222222222222222' $hash}catch{$rejected=$true};if(-not$rejected){throw ('Bad contract accepted: '+$property)}
}
$original=@([pscustomobject]@{relative='shared/control-set.json';sha256=('a'*64)})
AssertInventory $original $original
$rejected=$false;try{AssertInventory $original @()}catch{$rejected=$true};if(-not$rejected){throw 'Missing evidence count accepted'}
foreach($changed in @(@([pscustomobject]@{relative='shared/other.json';sha256=('a'*64)}),@([pscustomobject]@{relative='shared/control-set.json';sha256=('b'*64)}),@())){
  $rejected=$false;try{AssertInventory $original $changed}catch{$rejected=$true};if(-not$rejected){throw 'Changed evidence accepted'}
}
foreach($required in @('repair-checkpoint.json','repair-run-intent.json','repair-intent.json','Invoke-RepairBoundary','AssertRepairAdmission','missingKeyRepairRefused=$true','keyRecreationAttempted=$false','productionRepairTested=$false','AssertInventory','EvidenceInventory','SharedInventory','AssertStoppedServices')){
  if(-not$text.Contains($required)){throw ('Missing repair guard: '+$required)}
}
if($text.Contains('$currentVersion.DisplayVersion')){throw 'Direct optional DisplayVersion access forbidden'}
foreach($property in @('DisplayVersion','ReleaseId')){if($null-ne(OptionalProperty ([pscustomobject]@{BuildNumber='14393'}) $property)){throw 'Missing optional version fixture failed'}}
$evidenceHelper=@($ast.FindAll({param($node)$node-is[Management.Automation.Language.FunctionDefinitionAst]-and$node.Name-ceq'EvidenceInventory'},$true))
if($evidenceHelper.Count-ne1){throw 'Inventory helper missing'}
Invoke-Expression $evidenceHelper[0].Extent.Text
# An inert filesystem fixture exercises real enumeration/relative names/hashing.
$fixtureRoot=Join-Path ([IO.Path]::GetTempPath()) ('lic008-repair-inventory-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $fixtureRoot
$root=$fixtureRoot
foreach($fixtureDir in @('shared','setup-reports','guardian-reports','app-reports')){$null=New-Item -ItemType Directory -Path (Join-Path $root $fixtureDir)}
foreach($relative in @('shared/control-set.json','shared/restricted-envelope.json','shared/app-readable-envelope.json','shared/app-readable-hash.json','setup-reports/create.json','guardian-reports/verify.json','app-reports/probe.json')){
  Set-Content -LiteralPath (Join-Path $root $relative) -Value '{}' -Encoding UTF8
}
$inventory=@(EvidenceInventory)
if($inventory.Count-ne7-or$inventory[0].relative-cne'app-reports/probe.json'){throw 'Real initial inventory fixture failed'}
AssertInventory $inventory @(EvidenceInventory)
Set-Content -LiteralPath (Join-Path $root 'shared/control-set.json') -Value '{"changed":true}' -Encoding UTF8
$rejected=$false;try{AssertInventory $inventory @(EvidenceInventory)}catch{$rejected=$true};if(-not$rejected){throw 'Real modified file was accepted'}
Write-Output ('PASS: inert inventory/hash fixture retained at '+$fixtureRoot)
foreach($forbidden in @('Restart-Computer','shutdown.exe',"'auto'",'Set-Content -LiteralPath $checkpointPath')){
  if($text.Contains($forbidden)){throw ('Unsafe repair content: '+$forbidden)}
}

# Repair branch must never invoke Setup create, even when the key is missing.
$normalized=$text.Replace([string][char]13,'')
$verifyIndex=$normalized.IndexOf('Plain $root'+[char]10+'foreach($marker')
if($verifyIndex-lt0){throw 'Repair branch not found'}
$verifyText=$normalized.Substring($verifyIndex)
if($verifyText.Contains("Run 'setup' 'create'")-or$verifyText.Contains('@(''create'',$names')){throw 'Repair must never create keys/services'}
if($source.Contains('TEST_ONLY_SOFTWARE_KSP_WRAPPING_V2')-or$source.Contains('TEST_ONLY_SOFTWARE_KSP_WRAPPING_V3')){throw 'Old report scope in emitter'}
foreach($name in @('Run-Wrapping-Repair.ps1','README-fa.txt')){
  if((Get-FileHash -LiteralPath (Join-Path $repo ('licensing/windows-spike/wrapping-repair-kit/'+$name))).Hash-cne(Get-FileHash -LiteralPath (Join-Path $PackageRoot $name)).Hash){throw 'Packaged kit differs from tested source'}
}
$guardianIds=@('guardian.restricted.reopen-policy-decrypt','guardian.restricted.private-export-denied','guardian.app-readable.reopen-policy-decrypt','guardian.app-readable.private-export-denied','guardian.envelope-negative-matrix')
$good=[pscustomobject]@{results=@($guardianIds|ForEach-Object{[pscustomobject]@{Id=$_;Status='PASS'}})}
AssertRepairAdmission $good
foreach($id in $guardianIds){
  $wrong=$good|ConvertTo-Json -Depth 10|ConvertFrom-Json
  ($wrong.results|Where-Object Id -CEQ $id).Status='FAILED_OR_UNAVAILABLE'
  $rejected=$false;try{AssertRepairAdmission $wrong}catch{if($_.Exception.Message-cne'Repair admission refused; RECOVERY_REQUIRED'){throw};$rejected=$true}
  if(-not$rejected){throw ('Invalid repair admission accepted: '+$id)}
}
$wrong=$good|ConvertTo-Json -Depth 10|ConvertFrom-Json;$wrong.results[0].Id=$wrong.results[1].Id
$rejected=$false;try{AssertRepairAdmission $wrong}catch{$rejected=$true};if(-not$rejected){throw 'Duplicate repair result accepted'}
$script:missingFixture=$good|ConvertTo-Json -Depth 10|ConvertFrom-Json
foreach($row in $script:missingFixture.results){$row.Status='FAILED_OR_UNAVAILABLE'}
# Execute the actual repair boundary with read-only probe mocks; no SCM or CNG calls.
function Package([string]$Dir){return @{version='fixture'}}
function AssertStoppedServices{}
$sharedFixture=@([pscustomobject]@{relative='shared/control-set.json';sha256=('a'*64)})
function SharedInventory{return $sharedFixture}
function Run([string]$Role,[string]$Action,[string]$Experiment){if($Role-cne'guardian'-or$Action-cne'verify'){throw 'Unexpected mocked probe'};return $script:missingFixture}
$exe=Join-Path $root 'fake.exe'
$candidate=Join-Path $root 'bin-repaired';$rejected=$false
try{Invoke-RepairBoundary '22222222222222222222222222222222' $sharedFixture $candidate}catch{if($_.Exception.Message-cne'Repair admission refused; RECOVERY_REQUIRED'){throw};$rejected=$true}
if(-not$rejected-or(Test-Path -LiteralPath $candidate)-or(Test-Path -LiteralPath (Join-Path $root 'repair-intent.json'))){throw 'Missing-key boundary mutated candidate/intent'}
Write-Output 'PASS: actual repair admission boundary refuses missing-key fixture before candidate/intent mutations; report/evidence/no-create guards.'
