[CmdletBinding()]param([switch]$TokenDetail)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$source=Join-Path $repo 'licensing/adapter-evidence/guardian-readonly/GuardianReadOnly.cs'
if($TokenDetail){$source=Join-Path $repo 'licensing/adapter-evidence/guardian-readonly/GuardianTokenDetail.cs'}
$dotnet='C:\Program Files\dotnet\dotnet.exe'
$compiler='C:\Program Files\dotnet\sdk\10.0.400\Roslyn\bincore\csc.dll'
$refs='C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Ref\10.0.11\ref\net10.0'
function Hash([string]$p){(Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant()}
function NewBytes([string]$p,[byte[]]$b){$s=[IO.File]::Open($p,[IO.FileMode]::CreateNew);try{$s.Write($b,0,$b.Length)}finally{$s.Dispose()}}
function Json([string]$p,$value){NewBytes $p ([Text.Encoding]::UTF8.GetBytes(($value|ConvertTo-Json -Depth 12)))}
$out=Join-Path $repo ('out\lic008-guardian-readonly-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $out
$copy=Join-Path $out 'GuardianReadOnly.cs';NewBytes $copy ([IO.File]::ReadAllBytes($source))
$dll=Join-Path $out 'GuardianReadOnly.dll'
$arguments=@('-nologo','-nostdlib+','-target:exe','-nullable:enable','-warnaserror+','-deterministic+',('-out:"'+$dll+'"'))
$arguments+=@(Get-ChildItem -LiteralPath $refs -Filter '*.dll'|ForEach-Object{'-r:"'+$_.FullName+'"'})
$arguments+='"'+$copy+'"'
$rsp=Join-Path $out 'compile.rsp';NewBytes $rsp ([Text.Encoding]::UTF8.GetBytes(($arguments-join[Environment]::NewLine)))
& $dotnet exec --fx-version 10.0.11 $compiler -noconfig ('@'+$rsp)
if($LASTEXITCODE-ne0){throw 'Diagnostic compilation failed'}
Json (Join-Path $out 'GuardianReadOnly.runtimeconfig.json') @{runtimeOptions=@{tfm='net10.0';framework=@{name='Microsoft.NETCore.App';version='10.0.11'};rollForward='Disable'}}
$result=(& $dotnet exec --fx-version 10.0.11 $dll --self-test|Out-String)
if($LASTEXITCODE-ne0){throw 'Diagnostic pure tests failed'}
$report=$result|ConvertFrom-Json
$expectedCases=if($TokenDetail){150}else{22}
if($report.cases-ne$expectedCases-or$report.physicalExecuted-ne$false){throw 'Diagnostic report mismatch'}
NewBytes (Join-Path $out 'pure-tests.json') ([Text.Encoding]::UTF8.GetBytes($result))
if((Hash $source)-cne(Hash $copy)){throw 'Source changed during build'}
Json (Join-Path $out 'manifest.json') @{scope='TEST_ONLY_GUARDIAN_READONLY_DIAGNOSTIC';physicalExecuted=$false;deploymentAuthorized=$false;frameworkDependent=$true;runtime='10.0.11';sourceSha256=(Hash $copy);compilerSha256=(Hash $compiler);dotnetSha256=(Hash $dotnet);files=@(Get-ChildItem -LiteralPath $out -File|ForEach-Object{@{name=$_.Name;sha256=(Hash $_.FullName)}})}
Write-Output ('PASS: '+$expectedCases+' pure diagnostic cases; no service launch or protected mutation. Package: '+$out)
