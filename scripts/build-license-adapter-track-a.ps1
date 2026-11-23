[CmdletBinding()]param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dotnet='C:\Program Files\dotnet\dotnet.exe'
$sdk='C:\Program Files\dotnet\sdk\10.0.400\Roslyn\bincore'
$referenceRoot='C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Ref\10.0.11\ref\net10.0'
$runtimeRoot='C:\Program Files\dotnet\shared\Microsoft.NETCore.App\10.0.11'
$fxrRoot='C:\Program Files\dotnet\host\fxr\10.0.11'
$prefix='licensing/adapter-evidence/track-a/'
$sources=@(($prefix+'CandidateCodec.cs'),($prefix+'FailureModel.cs'),($prefix+'DiagnosticModel.cs'),($prefix+'Program.cs'),($prefix+'build-inputs.json'),($prefix+'README.md'),'scripts/build-license-adapter-track-a.ps1')
function Require([bool]$ok,[string]$why){if(-not $ok){throw $why}}
function Plain([string]$path){
    $cursor=[IO.Path]::GetFullPath($path)
    while($cursor){$item=Get-Item -LiteralPath $cursor -Force;Require (($item.Attributes-band[IO.FileAttributes]::ReparsePoint)-eq0) 'Reparse input refused';$parent=[IO.Path]::GetDirectoryName($cursor);if($parent-eq$cursor){break};$cursor=$parent}
}
function HashFile([string]$path){Plain $path;(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
function HashBytes([byte[]]$bytes){$sha=[Security.Cryptography.SHA256]::Create();try{[BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}
function NewBytes([string]$path,[byte[]]$bytes){$s=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$s.Write($bytes,0,$bytes.Length);$s.Flush($true)}finally{$s.Dispose()}}
function NewJson([string]$path,$value){NewBytes $path ([Text.Encoding]::UTF8.GetBytes(($value|ConvertTo-Json -Depth 15)))}
function CopyFrozen([string]$from,[string]$to){Plain $from;$bytes=[IO.File]::ReadAllBytes($from);NewBytes $to $bytes;[pscustomobject]@{name=[IO.Path]::GetFileName($to);size=$bytes.Length;sha256=(HashBytes $bytes)}}
function Inventory([string]$root){Plain $root;@(Get-ChildItem -LiteralPath $root -File -Force|Sort-Object Name|ForEach-Object{[pscustomobject]@{name=$_.Name;size=$_.Length;sha256=(HashFile $_.FullName)}})}
function ValidateInventory([string]$root,$rows){
    $seen=@{}
    foreach($r in $rows){Require (($r.name-cmatch'^[A-Za-z0-9][A-Za-z0-9._-]*$'-or$r.name-ceq'.version')-and-not$seen.ContainsKey($r.name)) 'Unsafe/duplicate inventory';$seen[$r.name]=$true;Require ($r.sha256-cmatch'^[a-f0-9]{64}$') 'Bad digest';$path=Join-Path $root $r.name;Require ((HashFile $path)-ceq$r.sha256-and(Get-Item -LiteralPath $path).Length-eq$r.size) 'Changed inventory'}
    $actual=@(Get-ChildItem -LiteralPath $root -Force)
    Require ($actual.Count-eq$seen.Count-and@($actual|Where-Object {$_.PSIsContainer-or-not$seen.ContainsKey($_.Name)}).Count-eq0) 'Extra package input'
}
Require ($repo-ieq'E:\EntryControlSystem') 'Unexpected workspace'
Require ([Environment]::Is64BitProcess) 'Use x64 PowerShell'
Require ((& $dotnet --version)-ceq'10.0.400') 'SDK changed'
foreach($path in @($dotnet,$sdk,$referenceRoot,$runtimeRoot,$fxrRoot,(Join-Path $repo 'out'))){Plain $path}
$buildDir=Join-Path $repo ($prefix.TrimEnd('/'));Plain $buildDir
$expected=@('CandidateCodec.cs','FailureModel.cs','DiagnosticModel.cs','Program.cs','build-inputs.json','README.md')
Require (@(Get-ChildItem -LiteralPath $buildDir -Force|Where-Object {$_.PSIsContainer-or$_.Name-cnotin$expected}).Count-eq0) 'Unexpected candidate source'
$config=Get-Content -LiteralPath (Join-Path $buildDir 'build-inputs.json') -Raw|ConvertFrom-Json
Require ($config.sdk-ceq'10.0.400'-and$config.runtime-ceq'10.0.11'-and$config.physicalControllerIncluded-eq$false) 'Build profile changed'
$head=(& git -C $repo rev-parse HEAD|Out-String).Trim();Require ($LASTEXITCODE-eq0) 'Git baseline unavailable'
$dirty=(& git -C $repo status --porcelain -- $sources|Out-String)
$diff=(& git -C $repo diff --no-ext-diff --no-textconv HEAD -- $sources|Out-String)
Require ($LASTEXITCODE-eq0) 'Source diff unavailable'
$out=Join-Path $repo ('out/lic008-adapter-track-a-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $out
$snapshot=Join-Path $out 'snapshot';$compilerDir=Join-Path $out 'compiler';$refs=Join-Path $out 'references';$package=Join-Path $out 'package'
foreach($dir in @($snapshot,$compilerDir,$refs,$package)){$null=New-Item -ItemType Directory -Path $dir}
$sourceRows=@(foreach($relative in $sources){$r=CopyFrozen (Join-Path $repo $relative) (Join-Path $snapshot ([IO.Path]::GetFileName($relative)));[pscustomobject]@{relative=$relative;name=$r.name;sha256=$r.sha256;size=$r.size}})
NewJson (Join-Path $out 'source-manifest.json') @{schemaVersion=1;sourceCommit=$head;dirty=($dirty.Trim().Length-gt0);trackedRelevantDiffSha256=(HashBytes ([Text.Encoding]::UTF8.GetBytes($diff)));untrackedSourceBytesBoundByManifest=$true;files=$sourceRows}
$compilerRows=@(Get-ChildItem -LiteralPath $sdk -File -Force|Sort-Object Name|ForEach-Object {CopyFrozen $_.FullName (Join-Path $compilerDir $_.Name)})
$refRows=@(Get-ChildItem -LiteralPath $referenceRoot -File -Filter '*.dll'|Sort-Object Name|ForEach-Object {CopyFrozen $_.FullName (Join-Path $refs $_.Name)})
$runtimeRows=Inventory $runtimeRoot;$fxrRows=Inventory $fxrRoot;$executorHash=HashFile $dotnet
NewJson (Join-Path $out 'toolchain-manifest.json') @{sdk='10.0.400';runtime='10.0.11';mode='DIRECT_CSC_FRAMEWORK_DEPENDENT_PURE';dotnetExeSha256=$executorHash;compiler=$compilerRows;referenceAssemblies=$refRows;runtimeFiles=$runtimeRows;hostfxr=$fxrRows;networkRestore=$false;msbuildImports=$false}
$assembly=Join-Path $package 'EntryControl.AdapterTrackA.dll'
$rsp=Join-Path $out 'compile.rsp'
$arguments=@('-nologo','-nostdlib+','-target:exe','-deterministic+','-nullable:enable','-warnaserror+','-langversion:14',('-out:"'+$assembly+'"'))
$arguments+=@($refRows|ForEach-Object {'-r:"'+(Join-Path $refs $_.name)+'"'})
$arguments+=@('CandidateCodec.cs','FailureModel.cs','DiagnosticModel.cs','Program.cs'|ForEach-Object {'"'+(Join-Path $snapshot $_)+'"'})
NewBytes $rsp ([Text.Encoding]::UTF8.GetBytes(($arguments-join[Environment]::NewLine)))
& $dotnet exec --fx-version 10.0.11 (Join-Path $compilerDir 'csc.dll') -noconfig ('@'+$rsp)
Require ($LASTEXITCODE-eq0) 'Compilation failed; retain output'
NewJson (Join-Path $package 'EntryControl.AdapterTrackA.runtimeconfig.json') @{runtimeOptions=@{tfm='net10.0';framework=@{name='Microsoft.NETCore.App';version='10.0.11'};rollForward='Disable'}}
NewJson (Join-Path $package 'EntryControl.AdapterTrackA.deps.json') @{runtimeTarget=@{name='.NETCoreApp,Version=v10.0'};targets=@{'.NETCoreApp,Version=v10.0'=@{}};libraries=@{}}
$packageRows=Inventory $package;ValidateInventory $package $packageRows
$rejected=0
foreach($edit in @('hash','extra','duplicate','escape','size','missing','digest-format','absolute','case-duplicate','empty')){
    $bad=@($packageRows|ForEach-Object {[pscustomobject]@{name=$_.name;sha256=$_.sha256;size=$_.size}})
    if($edit-eq'hash'){$bad[0].sha256='0'*64}
    if($edit-eq'extra'){$bad=$bad[0..1]}
    if($edit-eq'duplicate'){$bad+=@($bad[0])}
    if($edit-eq'escape'){$bad[0].name='../ownership.json'}
    if($edit-eq'size'){$bad[0].size++}
    if($edit-eq'missing'){$bad[0].name='MissingInput.dll'}
    if($edit-eq'digest-format'){$bad[0].sha256='not-a-digest'}
    if($edit-eq'absolute'){$bad[0].name='C:\outside.dll'}
    if($edit-eq'case-duplicate'){$copy=[pscustomobject]@{name=$bad[0].name.ToUpperInvariant();sha256=$bad[0].sha256;size=$bad[0].size};$bad+=@($copy)}
    if($edit-eq'empty'){$bad=@()}
    try{ValidateInventory $package $bad}catch{$rejected++;continue};throw 'Invalid package accepted'
}
Require ($rejected-eq10) 'Inventory refusal self-tests failed'
# Freeze package before tests; manifest never includes itself.
NewJson (Join-Path $out 'package-manifest.json') @{schemaVersion=1;scope='TEST_ONLY_ADAPTER_TRACK_A_PURE';files=$packageRows;executorExeSha256=$executorHash;runtimeManifestSha256=(HashFile (Join-Path $out 'toolchain-manifest.json'));selfContained=$false;physicalControllerIncluded=$false}
$testText=(& $dotnet exec --fx-version 10.0.11 $assembly --self-test|Out-String)
Require ($LASTEXITCODE-eq0) 'Pure tests failed; retain output'
$test=$testText|ConvertFrom-Json
Require ($test.scope-ceq'TEST_ONLY_ADAPTER_TRACK_A_PURE'-and$test.artifactVersion-ceq$config.artifactVersion-and$test.loadedAssemblySha256-ceq(HashFile $assembly)-and$test.executorExeSha256-ceq$executorHash-and$test.runtime-ceq'10.0.11') 'Actual emitter binding mismatch'
Require (@($test.results).Count-gt0-and@($test.results|Where-Object status -CNE 'PASS').Count-eq0-and$test.nativeKspTested-eq$false-and$test.physicalTested-eq$false-and$test.runtimeAuthority-ceq'NONE') 'Test result contract refused'
NewBytes (Join-Path $out 'pure-test-report.json') ([Text.Encoding]::UTF8.GetBytes($testText))
ValidateInventory $snapshot $sourceRows;ValidateInventory $compilerDir $compilerRows;ValidateInventory $refs $refRows
ValidateInventory $runtimeRoot $runtimeRows;ValidateInventory $fxrRoot $fxrRows;ValidateInventory $package $packageRows
Require ((HashFile $dotnet)-ceq$executorHash) 'Executor changed'
foreach($r in $sourceRows){Require ((HashFile (Join-Path $repo $r.relative))-ceq$r.sha256) 'Repository source changed during build'}
$bindings=@(foreach($name in @('source-manifest.json','toolchain-manifest.json','package-manifest.json','compile.rsp','pure-test-report.json')){[pscustomobject]@{relative=$name;sha256=(HashFile (Join-Path $out $name))}})
NewJson (Join-Path $out 'build-provenance.json') @{schemaVersion=1;scope='TEST_ONLY_ADAPTER_TRACK_A_PURE';sourceCommit=$head;sourceDirty=($dirty.Trim().Length-gt0);inputsAndOutputs=$bindings;compilerCommand='dotnet exec --fx-version 10.0.11 <frozen-csc> @compile.rsp';testCommand='dotnet exec --fx-version 10.0.11 <frozen-managed-assembly> --self-test';pureCases=@($test.results).Count;inventoryRefusals=$rejected;runtimeAuthority='NONE';durable=$false;sourceBinaryEquivalenceAccepted=$false;securityAccepted=$false;productionAccepted=$false;physicalControllerIncluded=$false}
Write-Output ('PASS: '+@($test.results).Count+' pure cases, '+$rejected+' inventory refusals; actual assembly/executor emitter bindings and pre/post source/toolchain/package checks.')
Write-Output ('Report: '+(Join-Path $out 'build-provenance.json'))
