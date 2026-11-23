# Static and pure guards only; never installs a service or invokes DPAPI.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$PackageRoot)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$exe=Join-Path $PackageRoot 'Ecs.Lic008.ProfileControlV1.exe'
& $exe --self-test
if($LASTEXITCODE -ne 0){throw 'Executable guards failed'}
$script=Join-Path $repo 'licensing/windows-spike/profile-control-kit/Run-Profile-Control.ps1'
$tokens=$null;$errors=$null
$null=[Management.Automation.Language.Parser]::ParseFile($script,[ref]$tokens,[ref]$errors)
if($errors.Count){throw 'Controller parser failed'}
$text=[IO.File]::ReadAllText($script)
foreach($required in @('NT AUTHORITY\LocalService','sidtype','unrestricted','PASS_SHARED_ACCOUNT_CONTROL_OPENED','OBSERVED_EXACT_SID_REFUSAL','Profile-Ready','C:\Users\Default','ResumeFailedAclBootstrap','ResumeFailedCopyBootstrap','profile-control-e096e3b29f80470d8a473fe7c60b9eba.json','Failed copy service configuration mismatch','f2cc9958914a568b59ea391a75a6c94f1c740beb9586aed592ec62e83fb59ff7','securityAccepted=$false','policyChanged=$false','productionAccepted=$false')){if(-not$text.Contains($required)){throw ('Missing guard: '+$required)}}
foreach($forbidden in @('LOCAL=machine','net user','New-LocalUser','Set-Service -Credential')){if($text.Contains($forbidden)){throw ('Forbidden mutation: '+$forbidden)}}
$createOffset=$text.IndexOf("Invoke-Sc @('create'")
$sidOffset=$text.IndexOf('$ownerSid=Service-Sid')
if($createOffset -lt 0 -or $sidOffset -le $createOffset){throw 'Service SID must resolve only after fresh service creation'}
if($text -match 'Join-Path\s+\$root\s+''bin''\s+\$file\.Name'){throw 'Windows PowerShell 5 incompatible Join-Path call'}
$source=[IO.File]::ReadAllText((Join-Path $repo 'licensing/windows-spike/profile-control/Program.cs'))
foreach($required in @('"LOCAL=user"','"SID=" + ownerSid','CryptographicOperations.ZeroMemory','S-1-5-19','FAILED_BLOB_PREREQUISITE')){if(-not$source.Contains($required)){throw ('Missing source boundary: '+$required)}}
$manifest=Get-Content -LiteralPath (Join-Path $PackageRoot 'package-manifest.json') -Raw|ConvertFrom-Json
if($manifest.scope -cne 'TEST_ONLY_PROFILE_BACKED_CONTROL_V1' -or $manifest.version -cne '0.8.2'){throw 'Manifest identity mismatch'}
foreach($entry in $manifest.files){$path=Join-Path $PackageRoot $entry.name;if((Get-Item -LiteralPath $path).Length-ne$entry.size-or(Get-FileHash -LiteralPath $path).Hash.ToLowerInvariant()-cne$entry.sha256){throw 'Manifest file mismatch'}}
$ast=[Management.Automation.Language.Parser]::ParseFile($script,[ref]$tokens,[ref]$errors)
$setRules=$ast.Find({param($n)$n -is [Management.Automation.Language.FunctionDefinitionAst] -and $n.Name -eq 'Set-Rules'},$true)
if($null-eq$setRules){throw 'Set-Rules missing'}
Invoke-Expression $setRules.Extent.Text
$fixture=Join-Path $repo ('out/lic008-profile-acl-fixture-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $fixture
Set-Rules $fixture @('S-1-5-19')
$rules=@((Get-Acl -LiteralPath $fixture).Access|ForEach-Object{$_.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value})
if('S-1-5-19' -notin $rules -or 'S-1-5-18' -notin $rules -or 'S-1-5-32-544' -notin $rules){throw 'SID ACL fixture failed'}
Write-Output 'PASS: profile-control package/static guards; no service, profile or DPAPI operation.'
