# Static and pure guards only; never installs a service or creates a persisted key.
[CmdletBinding()]param([Parameter(Mandatory=$true)][string]$PackageRoot)
Set-StrictMode -Version Latest;$ErrorActionPreference='Stop';$repo=Split-Path -Parent $PSScriptRoot;$exe=Join-Path $PackageRoot 'Ecs.Lic008.WrappingV2.exe';&$exe --self-test;if($LASTEXITCODE-ne0){throw 'Executable guards failed'}
$script=Join-Path $repo 'licensing/windows-spike/wrapping-control-kit/Run-Wrapping-Harness.ps1';$tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($script,[ref]$tokens,[ref]$errors);if($errors.Count){throw 'Controller parser failed'};$text=[IO.File]::ReadAllText($script)
foreach($required in @('TEST_ONLY_SOFTWARE_KSP_WRAPPING_V2','Ecs.Lic008.WrappingV2','Unsupported test OS','OBSERVED_BAD_KEYSET','ordinaryUserNotTested=$true','securityAccepted=$false','productionAccepted=$false','matrixAccepted=$false','DisplayVersion','WindowsSelfHost','build -ge 14393','build -lt 22000','build -ge 22000','vendorLifecycleNotRequired=$true','WINDOWS_10_11_X64_BUILD_14393_PLUS_NO_LIFECYCLE_GATE')){if(-not$text.Contains($required)){throw('Missing controller guard: '+$required)}}
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
$source=[IO.File]::ReadAllText((Join-Path $repo 'licensing/windows-spike/wrapping-control/Program.cs'));$native=[IO.File]::ReadAllText((Join-Path $repo 'licensing/windows-spike/wrapping-control/WrappingNative.cs'))
if($source.Contains('Ecs.Lic008.WrappingV1')){throw 'Retained key/service namespace referenced'}
foreach($required in @('RSAEncryptionPadding.OaepSHA256','new AesGcm(dataKey, 16)','CryptographicOperations.ZeroMemory','CngKeyBlobFormat.Pkcs8PrivateBlob','CngKeyUsages.Decryption','NCRYPT_SILENT_FLAG','NCRYPT_PAD_OAEP_FLAG','NCryptEncrypt','NCryptDecrypt','Algorithm = "SHA256"','guardian.envelope-negative-matrix','WrappedKey = Corrupt','Nonce = Corrupt','Aad = Corrupt','Ciphertext = Corrupt','Tag = Corrupt')){if(-not($source+$native).Contains($required)){throw('Missing source boundary: '+$required)}}
foreach($forbidden in @('RSAEncryptionPadding.Pkcs1','OaepSHA1','ECDSA_P256','NCryptProtectSecret')){if(($source+$native).Contains($forbidden)){throw('Forbidden crypto path: '+$forbidden)}}
$manifest=Get-Content -LiteralPath (Join-Path $PackageRoot 'package-manifest.json') -Raw|ConvertFrom-Json;if($manifest.scope-cne'TEST_ONLY_SOFTWARE_KSP_WRAPPING_V2'-or$manifest.version-cne'0.9.3'){throw 'Manifest mismatch'};foreach($entry in $manifest.files){$path=Join-Path $PackageRoot $entry.name;if((Get-Item -LiteralPath $path).Length-ne$entry.size-or(Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant()-cne$entry.sha256){throw 'Manifest file mismatch'}}
Write-Output 'PASS: wrapping package/static guards; no service or persisted-key operation.'
