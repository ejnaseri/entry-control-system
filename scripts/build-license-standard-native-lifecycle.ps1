[CmdletBinding()]param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Builds/tests only. All native bindings, including account/SCM/object reads, are compile-only. No native
# account/logon/SCM/persisted-CNG/token route is invoked or reachable. Public
# synthetic in-memory RSA/AES fixtures and injected handles are exercised.
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$destination=Join-Path $repo ('out\lic008-standard-native-lifecycle-v1-'+[guid]::NewGuid().ToString('N'))
$dotnet='C:\Program Files\dotnet\dotnet.exe'
$compiler='C:\Program Files\dotnet\sdk\10.0.400\Roslyn\bincore\csc.dll'
$references='C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Ref\10.0.11\ref\net10.0'
$runtimeRoots=@('C:\Program Files\dotnet\shared\Microsoft.NETCore.App\10.0.11','C:\Program Files\dotnet\host\fxr\10.0.11')
function LaunchHash([string]$path){(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
function LaunchHashBytes([byte[]]$bytes){$sha=[Security.Cryptography.SHA256]::Create();try{([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}
function LaunchPlainPath([string]$path){
    for($cursor=[IO.Path]::GetFullPath($path);$cursor;$cursor=[IO.Path]::GetDirectoryName($cursor)){
        if(([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'STANDARD_NATIVE_LIFECYCLE_BUILD_REPARSE_REFUSED'}
    }
}
function LaunchWriteNew([string]$path,[byte[]]$bytes){
    $stream=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
}
function LaunchJsonNew([string]$path,$value){LaunchWriteNew $path ([Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Depth 10 -Compress)))}
function LaunchRun([string]$arguments){
    $start=New-Object Diagnostics.ProcessStartInfo
    $start.FileName=$dotnet;$start.Arguments=$arguments;$start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    foreach($name in @($start.EnvironmentVariables.Keys)){
        if($name -match '^(DOTNET_|COMPLUS_|CORECLR_|COR_|COREHOST_)' -or $name -in @('APPDOMAIN_MANAGER_ASM','APPDOMAIN_MANAGER_TYPE','DEVPATH','__COMPAT_LAYER')){$start.EnvironmentVariables.Remove($name)}
    }
    $process=[Diagnostics.Process]::Start($start)
    try{
        $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
        if(-not $process.WaitForExit(30000)){throw ('STANDARD_NATIVE_LIFECYCLE_CHILD_UNRESOLVED_RETAIN_PID_'+$process.Id)}
        [pscustomobject]@{exitCode=$process.ExitCode;stdout=$stdout.Result;stderr=$stderr.Result}
    }finally{$process.Dispose()}
}
LaunchPlainPath $repo
$relativeSources=@('licensing/adapter-evidence/standard-user-control/StandardIdentity.cs',
    'licensing/adapter-evidence/standard-user-control/StandardTokenReader.cs',
    'licensing/adapter-evidence/standard-user-control/StandardIdentityTests.cs',
    'licensing/adapter-evidence/standard-user-control/StandardLaunch.cs',
    'licensing/adapter-evidence/standard-user-control/StandardCredential.cs',
    'licensing/adapter-evidence/standard-user-control/StandardCredentialTests.cs',
    'licensing/adapter-evidence/standard-user-control/StandardNativeLaunch.cs',
    'licensing/adapter-evidence/standard-user-control/StandardLaunchTests.cs',
    'licensing/adapter-evidence/standard-user-control/StandardNativeLifecycleProgram.cs',
    'licensing/adapter-evidence/standard-user-control/StandardCryptoComparison.cs',
    'licensing/adapter-evidence/standard-user-control/StandardCryptoComparisonTests.cs',
    'licensing/adapter-evidence/standard-user-control/StandardNativeCrypto.cs',
    'licensing/adapter-evidence/standard-user-control/StandardNativeCryptoTests.cs',
    'licensing/adapter-evidence/standard-user-control/StandardInputCodec.cs',
    'licensing/adapter-evidence/standard-user-control/StandardInputCodecTests.cs',
    'licensing/adapter-evidence/standard-user-control/StandardProtectedStore.cs',
    'licensing/adapter-evidence/standard-user-control/StandardProtectedStoreTests.cs',
    'licensing/adapter-evidence/standard-user-control/StandardKeyCreation.cs',
    'licensing/adapter-evidence/standard-user-control/StandardKeyCreationTests.cs',
    'licensing/adapter-evidence/standard-user-control/StandardWorkerChannel.cs',
    'licensing/adapter-evidence/standard-user-control/StandardWorkerChannelTests.cs',
    'licensing/adapter-evidence/standard-user-control/StandardNativeWorkerChannel.cs',
    'licensing/adapter-evidence/standard-user-control/StandardNativeWorkerChannelTests.cs',
    'licensing/adapter-evidence/standard-user-control/StandardFileCustody.cs',
    'licensing/adapter-evidence/standard-user-control/StandardFileCustodyTests.cs',
    'licensing/adapter-evidence/standard-user-control/StandardAccountLifecycle.cs',
    'licensing/adapter-evidence/standard-user-control/StandardAccountLifecycleTests.cs',
    'licensing/adapter-evidence/standard-user-control/StandardAccountFlagCodec.cs',
    'licensing/adapter-evidence/standard-user-control/StandardAccountFlagCodecTests.cs',
    'licensing/adapter-evidence/standard-user-control/StandardNativeAccountBackend.cs',
    'licensing/adapter-evidence/standard-user-control/StandardNativeAccountBackendTests.cs',
    'licensing/adapter-evidence/standard-user-control/StandardServiceLifecycle.cs',
    'licensing/adapter-evidence/standard-user-control/StandardServiceLifecycleTests.cs',
    'licensing/adapter-evidence/standard-user-control/StandardPeerObjectReader.cs',
    'licensing/adapter-evidence/standard-user-control/StandardPeerObjectReaderTests.cs',
    'scripts/build-license-standard-native-lifecycle.ps1')
$inputs=@(foreach($relative in $relativeSources){$path=Join-Path $repo $relative;LaunchPlainPath $path;[ordered]@{relative=$relative;sha256=(LaunchHash $path)}})
$toolInputs=@(foreach($path in @($dotnet,$compiler,'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe')){LaunchPlainPath $path;[ordered]@{path=$path;sha256=(LaunchHash $path)}})
$referenceInputs=@(Get-ChildItem -LiteralPath $references -File -Filter '*.dll' | Sort-Object Name | ForEach-Object {LaunchPlainPath $_.FullName;[ordered]@{path=$_.FullName;size=$_.Length;sha256=(LaunchHash $_.FullName)}})
$compilerInputs=@(Get-ChildItem -LiteralPath ([IO.Path]::GetDirectoryName($compiler)) -File | Sort-Object Name | ForEach-Object {LaunchPlainPath $_.FullName;[ordered]@{path=$_.FullName;size=$_.Length;sha256=(LaunchHash $_.FullName)}})
$runtimeInputs=@(foreach($root in $runtimeRoots){LaunchPlainPath $root;Get-ChildItem -LiteralPath $root -File | Sort-Object Name | ForEach-Object {LaunchPlainPath $_.FullName;[ordered]@{path=$_.FullName;size=$_.Length;sha256=(LaunchHash $_.FullName)}}})
if($inputs.Count -ne 36 -or @($inputs.relative | Sort-Object -Unique).Count -ne 36 -or $toolInputs.Count -ne 3 -or
    $referenceInputs.Count -ne 167 -or $compilerInputs.Count -ne 15 -or $runtimeInputs.Count -ne 190){throw 'STANDARD_NATIVE_LIFECYCLE_INSTALLED_INPUT_SET_REFUSED'}
$outputRoot=Join-Path $repo 'out'
if(-not [IO.Directory]::Exists($outputRoot)){$null=New-Item -ItemType Directory -Path $outputRoot -ErrorAction Stop}
LaunchPlainPath $outputRoot
$null=New-Item -ItemType Directory -Path $destination -ErrorAction Stop
LaunchPlainPath $destination
$snapshot=Join-Path $destination 'snapshot';$null=New-Item -ItemType Directory -Path $snapshot
LaunchPlainPath $snapshot
foreach($sourceInput in $inputs){LaunchWriteNew (Join-Path $snapshot ([IO.Path]::GetFileName($sourceInput.relative))) ([IO.File]::ReadAllBytes((Join-Path $repo $sourceInput.relative)))}
$closed=@('','--run','--controller','--service','--self-test extra','--SELF-TEST','--inspect-own-token extra','--token','--control-controller')
$variants=@()
foreach($variant in @('default','unrelated-defines','compile-only-native')){
    $folder=Join-Path $destination $variant;$null=New-Item -ItemType Directory -Path $folder
    LaunchPlainPath $folder
    $dll=Join-Path $folder 'StandardNativeLifecycle.dll'
    $arguments=@('-nologo','-target:exe','-platform:x64','-nullable:enable','-warnaserror+','-main:EntryControl.TestOnly.StandardUserControl.StandardNativeLifecycleProgram',('-out:"'+$dll+'"'))
    if($variant -ceq 'unrelated-defines'){$arguments+='-define:TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V1,TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V2,TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V3,TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V4,TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V5,TEST_CAPABLE_STANDARD_USER_CONTROL_V1'}
    if($variant -ceq 'compile-only-native'){$arguments+='-define:COMPILE_ONLY_STANDARD_LAUNCH_NATIVE_V1,COMPILE_ONLY_STANDARD_CRYPTO_NATIVE_V1,COMPILE_ONLY_STANDARD_STORE_NATIVE_V1,COMPILE_ONLY_STANDARD_KEY_CREATION_NATIVE_V1,COMPILE_ONLY_STANDARD_WORKER_CHANNEL_NATIVE_V1,COMPILE_ONLY_STANDARD_FILE_CUSTODY_NATIVE_V1,COMPILE_ONLY_STANDARD_ACCOUNT_NATIVE_V1,COMPILE_ONLY_STANDARD_SERVICE_NATIVE_V1,COMPILE_ONLY_STANDARD_PEER_OBJECT_NATIVE_V1'}
    $arguments+=@($referenceInputs | ForEach-Object {'-r:"'+$_.path+'"'})
    $arguments+=@($inputs | Where-Object {$_.relative.EndsWith('.cs')} | ForEach-Object {'"'+(Join-Path $snapshot ([IO.Path]::GetFileName($_.relative)))+'"'})
    LaunchWriteNew (Join-Path $folder 'compile.rsp') ([Text.Encoding]::UTF8.GetBytes(($arguments -join [Environment]::NewLine)))
    $compiled=LaunchRun ('"'+$compiler+'" "@'+(Join-Path $folder 'compile.rsp')+'"')
    if($compiled.exitCode -ne 0 -or $compiled.stderr.Length -ne 0){throw ('STANDARD_NATIVE_LIFECYCLE_COMPILE_FAILED_'+$variant+': '+$compiled.stdout+$compiled.stderr)}
    $runtimeBytes=[Text.Encoding]::UTF8.GetBytes('{"runtimeOptions":{"tfm":"net10.0","framework":{"name":"Microsoft.NETCore.App","version":"10.0.11"},"rollForward":"Disable"}}')
    LaunchWriteNew (Join-Path $folder 'StandardNativeLifecycle.runtimeconfig.json') $runtimeBytes
    $invoke='exec --fx-version 10.0.11 "'+$dll+'"'
    $tested=LaunchRun ($invoke+' --self-test')
    if($tested.exitCode -ne 0 -or $tested.stderr.Length -ne 0){throw ('STANDARD_NATIVE_LIFECYCLE_PURE_FAILED_'+$variant)}
    $report=$tested.stdout | ConvertFrom-Json
    if($report.scope -cne 'TEST_ONLY_STANDARD_NATIVE_LIFECYCLE_PURE_V1' -or $report.identityCases -ne 305 -or $report.launchCases -ne 270 -or $report.credentialCases -ne 40 -or $report.cryptoComparisonCases -ne 1976 -or $report.cryptoPrimitiveCases -ne 447 -or
        $report.inputCodecCases -ne 259 -or $report.protectedStoreCases -ne 5452 -or $report.keyCreationCases -ne 729 -or $report.nativeStorePerformed -ne $false -or $report.nativePipePerformed -ne $false -or $report.nativeFileCustodyPerformed -ne $false -or
        $report.workerChannelCases -ne 1734 -or $report.nativePipeCases -ne 70 -or $report.fileCustodyCases -ne 622 -or $report.accountLifecycleCases -ne 951 -or $report.accountNativeBackendImplemented -ne $true -or
        $report.persistedCngProbePerformed -ne $false -or $report.syntheticCryptoFixturePerformed -ne $true -or $report.nativeLogonPerformed -ne $false -or
        $report.accountFlagCodecCases -ne 2982 -or $report.nativeAccountCases -ne 2027 -or $report.peerObjectCases -ne 188 -or $report.serviceLifecycleCases -ne 1330 -or
        $report.nativeAccountPerformed -ne $false -or $report.nativeServicePerformed -ne $false -or $report.nativePeerObservationPerformed -ne $false -or
        $report.serviceLifecycleImplemented -ne $true -or $report.peerObjectReaderImplemented -ne $true -or
        $report.processTokenAssociationEstablished -ne $false -or $report.loadedCodeEstablished -ne $false -or $report.bootstrapImplemented -ne $false -or $report.nativeCompatibilityAccepted -ne $false -or
        $report.accountChanged -ne $false -or $report.standardUserLogonTested -ne $false -or $report.cryptoRunnerImplemented -ne $false -or
        $report.securityAccepted -ne $false -or $report.productionAccepted -ne $false){throw 'STANDARD_NATIVE_LIFECYCLE_PURE_REPORT_REFUSED'}
    LaunchWriteNew (Join-Path $folder 'pure-test-report.json') ([Text.Encoding]::UTF8.GetBytes($tested.stdout.Trim()))
    $entryArguments=@($closed)+@('--inspect-own-token','--standard-user-worker','--launch','--standard-user-worker --attempt 0123456789abcdef0123456789abcdef','--create','--store','--setup-worker','--guardian-before','--guardian-after','--connect','--listen','--worker-grant','--admit-worker','--activate-account','--disable-account','--return-disabled','--account','--sam-account','--service-start','--service-worker','--observe-peer','--bootstrap','--loan-owner-handles','--collect','--native-controller','--standard-service','--standard-service Setup','--standard-service Guardian')
    foreach($entry in $entryArguments){$result=LaunchRun ($invoke+' '+$entry);if($result.exitCode -ne 2 -or $result.stdout.Length -ne 0 -or $result.stderr.Trim() -cne 'STANDARD_NATIVE_LIFECYCLE_ENTRY_CLOSED'){throw 'STANDARD_NATIVE_LIFECYCLE_CLOSED_ENTRY_FAILED'}}
    $variants+=[ordered]@{name=$variant;dllSha256=(LaunchHash $dll);runtimeconfigSha256=(LaunchHash (Join-Path $folder 'StandardNativeLifecycle.runtimeconfig.json'));reportSha256=(LaunchHash (Join-Path $folder 'pure-test-report.json'));identityCases=$report.identityCases;launchCases=$report.launchCases;credentialCases=$report.credentialCases;cryptoComparisonCases=$report.cryptoComparisonCases;cryptoPrimitiveCases=$report.cryptoPrimitiveCases;inputCodecCases=$report.inputCodecCases;protectedStoreCases=$report.protectedStoreCases;keyCreationCases=$report.keyCreationCases;workerChannelCases=$report.workerChannelCases;nativePipeCases=$report.nativePipeCases;fileCustodyCases=$report.fileCustodyCases;accountLifecycleCases=$report.accountLifecycleCases;accountFlagCodecCases=$report.accountFlagCodecCases;nativeAccountCases=$report.nativeAccountCases;serviceLifecycleCases=$report.serviceLifecycleCases;peerObjectCases=$report.peerObjectCases;entryRefusals=$entryArguments.Count;nativeBindingCompiled=($variant -ceq 'compile-only-native');nativeLogonPerformed=$false}
}
foreach($sourceInput in $inputs){if((LaunchHash (Join-Path $repo $sourceInput.relative)) -cne $sourceInput.sha256 -or (LaunchHash (Join-Path $snapshot ([IO.Path]::GetFileName($sourceInput.relative)))) -cne $sourceInput.sha256){throw 'STANDARD_NATIVE_LIFECYCLE_SOURCE_CHANGED'}}
foreach($set in @($toolInputs,$referenceInputs,$compilerInputs,$runtimeInputs)){foreach($item in $set){if((LaunchHash $item.path) -cne $item.sha256){throw 'STANDARD_NATIVE_LIFECYCLE_INSTALLED_INPUT_CHANGED'}}}
$manifest=[ordered]@{schemaVersion=1;scope='TEST_ONLY_STANDARD_NATIVE_LIFECYCLE_COMPONENT_BUILD_V1';builtUtc=[DateTimeOffset]::UtcNow.ToString('O');codeBaseline='7e11850';inputs=$inputs;sourceSetSha256=(LaunchHashBytes ([Text.Encoding]::UTF8.GetBytes(($inputs | ConvertTo-Json -Depth 4 -Compress))));toolInputs=$toolInputs;referenceInputs=$referenceInputs;compilerInputs=$compilerInputs;runtimeInputs=$runtimeInputs;variants=$variants;nativeLogonPerformed=$false;accountChanged=$false;standardUserLogonTested=$false;persistedCngProbePerformed=$false;syntheticCryptoFixturePerformed=$true;accountNativeBackendImplemented=$true;nativeStorePerformed=$false;nativePipePerformed=$false;nativeFileCustodyPerformed=$false;nativeAccountPerformed=$false;nativeServicePerformed=$false;nativePeerObservationPerformed=$false;serviceLifecycleImplemented=$true;peerObjectReaderImplemented=$true;processTokenAssociationEstablished=$false;loadedCodeEstablished=$false;bootstrapImplemented=$false;nativeCompatibilityAccepted=$false;cryptoRunnerImplemented=$false;securityAccepted=$false;productionAccepted=$false}
LaunchJsonNew (Join-Path $destination 'manifest.json') $manifest
[ordered]@{scope='TEST_ONLY_STANDARD_NATIVE_LIFECYCLE_COMPONENT_BUILD_LOCATION_V1';directory=$destination;manifestSha256=(LaunchHash (Join-Path $destination 'manifest.json'));identityCasesPerVariant=305;launchCasesPerVariant=$report.launchCases;credentialCasesPerVariant=$report.credentialCases;cryptoComparisonCasesPerVariant=$report.cryptoComparisonCases;cryptoPrimitiveCasesPerVariant=$report.cryptoPrimitiveCases;inputCodecCasesPerVariant=$report.inputCodecCases;protectedStoreCasesPerVariant=$report.protectedStoreCases;keyCreationCasesPerVariant=$report.keyCreationCases;workerChannelCasesPerVariant=$report.workerChannelCases;nativePipeCasesPerVariant=$report.nativePipeCases;fileCustodyCasesPerVariant=$report.fileCustodyCases;accountLifecycleCasesPerVariant=$report.accountLifecycleCases;accountFlagCodecCasesPerVariant=$report.accountFlagCodecCases;nativeAccountCasesPerVariant=$report.nativeAccountCases;serviceLifecycleCasesPerVariant=$report.serviceLifecycleCases;peerObjectCasesPerVariant=$report.peerObjectCases;variants=$variants.Count;nativeLogonPerformed=$false;accountChanged=$false;standardUserLogonTested=$false} | ConvertTo-Json -Compress
