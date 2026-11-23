# Static and pure guards only; never installs a service or creates a persisted key.
[CmdletBinding()]param([Parameter(Mandatory=$true)][string]$PackageRoot)
Set-StrictMode -Version Latest;$ErrorActionPreference='Stop';$repo=Split-Path -Parent $PSScriptRoot;$exe=Join-Path $PackageRoot 'Ecs.Lic008.WrappingV3.exe';&$exe --self-test;if($LASTEXITCODE-ne0){throw 'Executable guards failed'}
$script=Join-Path $repo 'licensing/windows-spike/wrapping-user-control-kit/Run-Wrapping-User-Control.ps1';$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($script,[ref]$tokens,[ref]$errors);if($errors.Count){throw 'Controller parser failed'};$text=[IO.File]::ReadAllText($script)
foreach($required in @('TEST_ONLY_SOFTWARE_KSP_WRAPPING_V3','Ecs.Lic008.WrappingV3','Unsupported test OS','OBSERVED_BAD_KEYSET','ordinaryUserNotTested=$false','securityAccepted=$false','productionAccepted=$false','matrixAccepted=$false','DisplayVersion','WindowsSelfHost','build -ge 14393','build -lt 22000','build -ge 22000','vendorLifecycleNotRequired=$true','WINDOWS_10_11_X64_BUILD_14393_PLUS_NO_LIFECYCLE_GATE')){if(-not$text.Contains($required)){throw('Missing controller guard: '+$required)}}
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
$source=[IO.File]::ReadAllText((Join-Path $repo 'licensing/windows-spike/wrapping-user-control/Program.cs'));$native=[IO.File]::ReadAllText((Join-Path $repo 'licensing/windows-spike/wrapping-user-control/WrappingNative.cs'))
if($source.Contains('Ecs.Lic008.WrappingV1')){throw 'Retained key/service namespace referenced'}
foreach($required in @('RSAEncryptionPadding.OaepSHA256','new AesGcm(dataKey, 16)','CryptographicOperations.ZeroMemory','CngKeyBlobFormat.Pkcs8PrivateBlob','CngKeyUsages.Decryption','NCRYPT_SILENT_FLAG','NCRYPT_PAD_OAEP_FLAG','NCryptEncrypt','NCryptDecrypt','Algorithm = "SHA256"','guardian.envelope-negative-matrix','WrappedKey = Corrupt','Nonce = Corrupt','Aad = Corrupt','Ciphertext = Corrupt','Tag = Corrupt')){if(-not($source+$native).Contains($required)){throw('Missing source boundary: '+$required)}}
foreach($forbidden in @('RSAEncryptionPadding.Pkcs1','OaepSHA1','ECDSA_P256','NCryptProtectSecret')){if(($source+$native).Contains($forbidden)){throw('Forbidden crypto path: '+$forbidden)}}
$manifest=Get-Content -LiteralPath (Join-Path $PackageRoot 'package-manifest.json') -Raw|ConvertFrom-Json;if($manifest.scope-cne'TEST_ONLY_SOFTWARE_KSP_WRAPPING_V3'-or$manifest.version-cne'0.10.1'){throw 'Manifest mismatch'};foreach($entry in $manifest.files){$path=Join-Path $PackageRoot $entry.name;if((Get-Item -LiteralPath $path).Length-ne$entry.size-or(Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant()-cne$entry.sha256){throw 'Manifest file mismatch'}}
Write-Output 'PASS: wrapping package/static guards; no service or persisted-key operation.'
$userSource=[IO.File]::ReadAllText((Join-Path $repo 'licensing/windows-spike/wrapping-user-control/Interactive.cs'))
foreach($required in @('integrity == 8192','!elevated && !administrator','FILTERED_ADMIN_INTERACTIVE_TOKEN','TokenEvidence.Capture("S-1-5-4")','ProbeApp("interactive")','actor + ".restricted.open"','actor + ".app-readable.open-decrypt-control"')){
  if(-not($userSource+$source).Contains($required)){throw ('Missing interactive boundary: '+$required)}
}
foreach($required in @('finish-intent.json','prepared.json','Post-user Guardian gate failed','User report/token mismatch','standardAccountSeparatelyTested=$false','userReportSha256=$userHash')){
  if(-not$text.Contains($required)){throw ('Missing continuation guard: '+$required)}
}
$kit=Join-Path $repo 'licensing/windows-spike/wrapping-user-control-kit'
foreach($file in Get-ChildItem -LiteralPath $kit -Filter '*.ps1'){$tokens=$null;$errors=$null;$null=[Management.Automation.Language.Parser]::ParseFile($file.FullName,[ref]$tokens,[ref]$errors);if($errors.Count){throw ($file.Name+': parser failed')}}
Write-Output 'PASS: interactive token and continuation static boundaries.'
if($text.Contains('$currentVersion.DisplayVersion')){throw 'Optional display version must not use direct StrictMode access'}
foreach($name in @('DisplayVersion','ReleaseId')){if($null-ne(OptionalProperty ([pscustomobject]@{BuildNumber='14393'}) $name)){throw 'Missing optional OS version fixture failed'}}
Write-Output 'PASS: early Windows10 optional version metadata fixture.'
foreach($name in @('Run-Wrapping-User-Control.ps1','Run-User-Probe.ps1','README-fa.txt')){
  if((Get-FileHash -LiteralPath (Join-Path $kit $name)).Hash-cne(Get-FileHash -LiteralPath (Join-Path $PackageRoot $name)).Hash){throw ('Packaged kit differs from tested source: '+$name)}
}
Write-Output 'PASS: packaged kit bytes match tested source.'
# Execute the SAME report factory used by actual service workers, without SCM/CNG writes.
$contract=(& $exe --report-contract | Out-String)|ConvertFrom-Json
if($LASTEXITCODE-ne0){throw 'Report contract executable failed'}
foreach($name in @('AssertReportIdentity','AssertLegacyCreation','Pass')){
  $definition=@($ast.FindAll({param($node)$node-is[Management.Automation.Language.FunctionDefinitionAst]-and$node.Name-ceq$name},$true))
  if($definition.Count-ne1){throw ('Missing report validator: '+$name)}
  Invoke-Expression $definition[0].Extent.Text
}
$binaryHash=(Get-FileHash -LiteralPath $exe).Hash.ToLowerInvariant()
AssertReportIdentity $contract 'guardian' 'verify' '11111111111111111111111111111111' '22222222222222222222222222222222' $binaryHash
foreach($property in @('scope','role','action','RunId','ExperimentId','binarySha256','checklistId')){
  $wrong=$contract|ConvertTo-Json -Depth 10|ConvertFrom-Json;$wrong.$property='wrong'
  $rejected=$false;try{AssertReportIdentity $wrong 'guardian' 'verify' '11111111111111111111111111111111' '22222222222222222222222222222222' $binaryHash}catch{$rejected=$true}
  if(-not$rejected){throw ('Report mismatch accepted: '+$property)}
}
$legacyHash='5326cbb9a4fdc8608ebb3dc90c0e349206eb5caeaabd8c17cef2ea0be2bba315'
$expectedCreateRun='5a109d0ad27643c396e8c160902800b4';$expectedExperiment='c43b7dda51f7419099879fcb64efb8c6'
$results=@([pscustomobject]@{Id='setup.publish-control-set';Status='PASS'})
foreach($label in @('restricted','app-readable')){
  $id='setup.'+$label+'.create-rsa-wrapping-key';$results+=[pscustomobject]@{Id=$id;Status='PASS'}
  foreach($stageName in @('open-software-ksp','check-rsa-support','create-rsa-machine-key','set-rsa-3072','set-export-policy-zero','set-decryption-only-usage','set-protected-dacl','finalize-key','open-finalized-handle')){$results+=[pscustomobject]@{Id=($id+'.stage.'+$stageName);Status='PASS'}}
}
$legacy=[pscustomobject]@{schemaVersion=1;checklistId='LIC-6.2-008';scope='TEST_ONLY_SOFTWARE_KSP_WRAPPING_V2';role='setup';action='create';runId=$expectedCreateRun;experimentId=$expectedExperiment;binarySha256=$legacyHash;serviceIdentityMatched=$true;productionAccepted=$false;securityAccepted=$false;processId=1484;osVersion='10.0.22000.0';runtime='10.0.11';timeUtc='2026-10-05T11:23:23.1869768Z';results=$results}
AssertLegacyCreation $legacy
foreach($property in @('scope','runId','experimentId','binarySha256','role','action')){
  $wrong=$legacy|ConvertTo-Json -Depth 10|ConvertFrom-Json;$wrong.$property='wrong'
  $rejected=$false;try{AssertLegacyCreation $wrong}catch{$rejected=$true};if(-not$rejected){throw ('Legacy mismatch accepted: '+$property)}
}
foreach($mutation in @('failure','duplicate','missing')){
  $wrong=$legacy|ConvertTo-Json -Depth 10|ConvertFrom-Json
  if($mutation-eq'failure'){$wrong.results[0].Status='FAILED'}
  elseif($mutation-eq'duplicate'){$wrong.results[0].Id=$wrong.results[1].Id}
  else{$wrong.results=@($wrong.results|Select-Object -Skip 1)}
  $rejected=$false;try{AssertLegacyCreation $wrong}catch{$rejected=$true};if(-not$rejected){throw ('Legacy result mutation accepted: '+$mutation)}
}
if($source.Contains('TEST_ONLY_SOFTWARE_KSP_WRAPPING_V2')){throw 'Legacy scope in current service emitter'}
if($text.Contains("Run 'setup' 'create'")-or$text.Contains('@(''create'',$names')){throw 'Continuation must never create services/keys'}
Write-Output 'PASS: executable service report/controller contract and negative fixtures; exact legacy report/result guards.'
