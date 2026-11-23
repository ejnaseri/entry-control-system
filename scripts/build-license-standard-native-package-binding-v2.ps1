[CmdletBinding()]
param(
    [switch]$RunReviewedSelfTests,
    [string]$ReviewedSourceSetSha256 = '',
    [int]$ExpectedProfileCases = 0,
    [int]$ExpectedInputCodecCases = 0,
    [int]$ExpectedStageStoreCases = 0,
    [int]$ExpectedPackageCases = 0,
    [int]$ExpectedUserIntentCases = 0,
    [int]$ExpectedOriginLeaseCases = 0,
    [int]$ExpectedStageReservationCases = 0,
    [int]$ExpectedReservationOriginalCases = 0,
    [int]$ExpectedPreactivationCases = 0,
    [int]$ExpectedTranscriptPrefixCases = 0,
    [int]$ExpectedUserIntentV3Cases = 0,
    [switch]$PrintSourceSetSha256
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# This builder compiles a closed generated entry over V2/V3 test-only sources.
# Running that entry requires an independently reviewed exact source-set digest
# and eleven reviewed check counts. Approval binding here remains inert and unsigned.
# It has no operational CLI, native API invocation, account, SCM, persisted key, CLR
# bootstrap, physical admission, or licensing authority path.
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$baseline = '6e81a5e8e19878e15903eb5c3fcb3df03a6fe04e'
$dotnet = 'C:\Program Files\dotnet\dotnet.exe'
$compiler = 'C:\Program Files\dotnet\sdk\10.0.400\Roslyn\bincore\csc.dll'
$references = 'C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Ref\10.0.11\ref\net10.0'
$runtimeRoots = @('C:\Program Files\dotnet\shared\Microsoft.NETCore.App\10.0.11',
    'C:\Program Files\dotnet\host\fxr\10.0.11')
$powershell = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
$fixedDotnetSha256 = 'ab1b71fd3dd71062e074c9fab8312081a81b7f2b3e0327c48c4d249c8d1a3135'
$fixedCompilerSha256 = '2c196b47e0ade88940af111beaad6a6ee5fa0df6152a847e7d3c81059ec15848'
$fixedPowerShellSha256 = 'c7d4e119149a7150b7101a4bd9fffbf659fba76d058f7bf6cc73c99fb36e8221'
$fixedReferenceSetSha256 = 'c7a125747d419f3d466ee7aa2e70ed8186c1a048c6772609cdda6d5a7c6be5db'
$fixedCompilerSetSha256 = '79721843b153abf82f479f5fd268b11103b1154bf3b1b4b924db5c9b7d417ab6'
$fixedRuntimeSetSha256 = '29189ca461477aa0e23750acfeda64ae1bd16f127ae3779155adb22a87180740'
$destination = Join-Path $repo ('out\lic008-standard-native-package-binding-v2-' + [Guid]::NewGuid().ToString('N'))
$script:HeldPackageBindingRuns = New-Object 'Collections.Generic.List[object]'
$utf8 = New-Object Text.UTF8Encoding($false,$true)

function PackageBindingHash([string]$Path) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function PackageBindingBytesHash([byte[]]$Bytes) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { [BitConverter]::ToString($sha.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant() }
    finally { $sha.Dispose() }
}
function PackageBindingPlain([string]$Path) {
    for ($cursor = [IO.Path]::GetFullPath($Path); $cursor; $cursor = [IO.Path]::GetDirectoryName($cursor)) {
        if (([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'NATIVE_PACKAGE_BINDING_V2_REPARSE_REFUSED'
        }
    }
}
function PackageBindingNew([string]$Path,[byte[]]$Bytes) {
    PackageBindingPlain ([IO.Path]::GetDirectoryName($Path))
    $stream = [IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    try { $stream.Write($Bytes,0,$Bytes.Length); $stream.Flush($true) }
    finally { $stream.Dispose() }
}
function PackageBindingJson([string]$Path,$Value) {
    PackageBindingNew $Path ($utf8.GetBytes(($Value | ConvertTo-Json -Depth 16 -Compress)))
}
function PackageBindingDirectory([string]$Path) {
    PackageBindingPlain ([IO.Path]::GetDirectoryName($Path))
    if (Test-Path -LiteralPath $Path) { throw 'NATIVE_PACKAGE_BINDING_V2_FRESH_DIRECTORY_COLLISION' }
    $null = New-Item -ItemType Directory -Path $Path -ErrorAction Stop
    PackageBindingPlain $Path
}
function PackageBindingArguments([string[]]$Values) {
    if ($null -eq $Values -or $Values.Count -eq 0) { return '' }
    $quoted = foreach ($value in $Values) {
        if ($value -match '[\x00\r\n]' -or $value.Contains('"') -or $value.EndsWith('\')) {
            throw 'NATIVE_PACKAGE_BINDING_V2_FIXED_ARGUMENT_REFUSED'
        }
        '"' + $value + '"'
    }
    [string]::Join(' ',[string[]]$quoted)
}
function PackageBindingExactLine([string]$Actual,[string]$Expected) {
    $Actual -ceq ($Expected + "`n") -or $Actual -ceq ($Expected + "`r`n")
}
function PackageBindingOneLine([string]$Actual) {
    if ($Actual.Length -eq 0) { return $false }
    $normal = $Actual.Replace("`r`n","`n")
    $normal.EndsWith("`n",[StringComparison]::Ordinal) -and
        $normal.IndexOf("`n",[StringComparison]::Ordinal) -eq $normal.Length - 1 -and
        -not $normal.Contains("`r")
}
function PackageBindingPinSetDigest($Pins) {
    $builder = New-Object Text.StringBuilder
    foreach ($pin in $Pins) {
        [void]$builder.Append([string]$pin.path).Append([char]0).Append([long]$pin.length).
            Append([char]0).Append([string]$pin.sha256).Append("`n")
    }
    PackageBindingBytesHash ($utf8.GetBytes($builder.ToString()))
}
function PackageBindingRun([string]$Executable,[string[]]$Arguments,[string]$Folder,[string]$Label,[int]$Milliseconds) {
    PackageBindingPlain $Executable; PackageBindingPlain $Folder
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $Executable
    $start.Arguments = PackageBindingArguments $Arguments
    $start.WorkingDirectory = $Folder
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $start.EnvironmentVariables.Clear()
    $start.EnvironmentVariables['SystemRoot'] = 'C:\Windows'
    $start.EnvironmentVariables['windir'] = 'C:\Windows'
    $start.EnvironmentVariables['TEMP'] = Join-Path $Folder 'temp'
    $start.EnvironmentVariables['TMP'] = Join-Path $Folder 'temp'
    $stdoutPath = Join-Path $Folder ($Label + '.stdout.txt')
    $stderrPath = Join-Path $Folder ($Label + '.stderr.txt')
    $stdout = [IO.File]::Open($stdoutPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    $stderr = [IO.File]::Open($stderrPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    $process = New-Object Diagnostics.Process
    $process.StartInfo = $start
    $held = [pscustomobject]@{process=$process;stdout=$stdout;stderr=$stderr;
        stdoutTask=$null;stderrTask=$null;terminal=$false;pid=$null}
    $script:HeldPackageBindingRuns.Add($held)
    PackageBindingJson (Join-Path $Folder ($Label + '.intent.json')) ([ordered]@{
        executable=$Executable;executableSha256=(PackageBindingHash $Executable);arguments=$Arguments;
        workingDirectory=$Folder;childOnlyEnvironment=[ordered]@{SystemRoot='C:\Windows';windir='C:\Windows';
            TEMP=$start.EnvironmentVariables['TEMP'];TMP=$start.EnvironmentVariables['TMP']};
        timeoutMilliseconds=$Milliseconds})
    if (-not $process.Start()) { throw 'NATIVE_PACKAGE_BINDING_V2_CHILD_START_FAILED_RETAINED' }
    $held.pid = $process.Id
    $held.stdoutTask = $process.StandardOutput.BaseStream.CopyToAsync($stdout)
    $held.stderrTask = $process.StandardError.BaseStream.CopyToAsync($stderr)
    PackageBindingJson (Join-Path $Folder ($Label + '.started.json')) ([ordered]@{
        pid=$held.pid;startedUtc=[DateTimeOffset]::UtcNow.ToString('O')})
    if (-not $process.WaitForExit($Milliseconds)) {
        PackageBindingJson (Join-Path $Folder ($Label + '.pending.json')) ([ordered]@{
            pid=$held.pid;status='UNRESOLVED_RETAIN_PID_HANDLES_STREAMS_TASKS_AND_PARTIALS';
            noKill=$true;noRetry=$true;heldWhileBuilderHostLives=$true})
        throw ('NATIVE_PACKAGE_BINDING_V2_CHILD_UNRESOLVED_RETAIN_PID_' + $held.pid)
    }
    if (-not [Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($held.stdoutTask,$held.stderrTask),5000)) {
        PackageBindingJson (Join-Path $Folder ($Label + '.pending.json')) ([ordered]@{
            pid=$held.pid;status='OUTPUT_JOIN_UNRESOLVED_RETAIN_HANDLES_STREAMS_TASKS_AND_PARTIALS';
            noKill=$true;noRetry=$true;heldWhileBuilderHostLives=$true})
        throw ('NATIVE_PACKAGE_BINDING_V2_OUTPUT_JOIN_UNRESOLVED_RETAIN_PID_' + $held.pid)
    }
    $null = $held.stdoutTask.GetAwaiter().GetResult()
    $null = $held.stderrTask.GetAwaiter().GetResult()
    $stdout.Flush($true); $stderr.Flush($true); $held.terminal = $true
    $code = $process.ExitCode
    $stdout.Dispose(); $stderr.Dispose(); $process.Dispose()
    $output = [IO.File]::ReadAllText($stdoutPath,$utf8)
    $errorText = [IO.File]::ReadAllText($stderrPath,$utf8)
    $result = [ordered]@{exitCode=$code;stdoutSha256=(PackageBindingHash $stdoutPath);
        stderrSha256=(PackageBindingHash $stderrPath);stdoutLength=([IO.FileInfo]$stdoutPath).Length;
        stderrLength=([IO.FileInfo]$stderrPath).Length;pid=$held.pid;terminalObserved=$true}
    PackageBindingJson (Join-Path $Folder ($Label + '.result.json')) $result
    [pscustomobject]@{exitCode=$code;stdout=$output;stderr=$errorText;
        stdoutSha256=$result.stdoutSha256;stderrSha256=$result.stderrSha256}
}

PackageBindingPlain $repo
if ($PSHOME -cne 'C:\Windows\System32\WindowsPowerShell\v1.0' -or [IntPtr]::Size -ne 8) {
    throw 'NATIVE_PACKAGE_BINDING_V2_BUILDER_POWERSHELL_PROFILE_REFUSED'
}
if ($PrintSourceSetSha256 -and ($RunReviewedSelfTests -or $ReviewedSourceSetSha256.Length -ne 0 -or
    $ExpectedProfileCases -ne 0 -or $ExpectedInputCodecCases -ne 0 -or
    $ExpectedStageStoreCases -ne 0 -or $ExpectedPackageCases -ne 0 -or
    $ExpectedUserIntentCases -ne 0 -or $ExpectedOriginLeaseCases -ne 0 -or
    $ExpectedStageReservationCases -ne 0 -or $ExpectedReservationOriginalCases -ne 0 -or
    $ExpectedPreactivationCases -ne 0 -or $ExpectedTranscriptPrefixCases -ne 0 -or
    $ExpectedUserIntentV3Cases -ne 0)) {
    throw 'NATIVE_PACKAGE_BINDING_V2_SOURCE_DIGEST_MODE_ARGUMENTS_REFUSED'
}
if ($RunReviewedSelfTests) {
    if ($ReviewedSourceSetSha256 -cnotmatch '^[0-9a-f]{64}$' -or $ExpectedProfileCases -ne 144 -or
        $ExpectedInputCodecCases -ne 134 -or $ExpectedStageStoreCases -ne 1020 -or
        $ExpectedPackageCases -le 0 -or $ExpectedUserIntentCases -ne 187 -or
        $ExpectedOriginLeaseCases -ne 82 -or $ExpectedStageReservationCases -ne 157 -or
        $ExpectedReservationOriginalCases -ne 44 -or $ExpectedPreactivationCases -ne 331 -or
        $ExpectedTranscriptPrefixCases -ne 106 -or $ExpectedUserIntentV3Cases -ne 76) {
        throw 'NATIVE_PACKAGE_BINDING_V2_REVIEWED_DIGEST_AND_CASE_COUNTS_REQUIRED'
    }
} elseif ($ReviewedSourceSetSha256.Length -ne 0 -or $ExpectedProfileCases -ne 0 -or
    $ExpectedInputCodecCases -ne 0 -or $ExpectedStageStoreCases -ne 0 -or
    $ExpectedPackageCases -ne 0 -or $ExpectedUserIntentCases -ne 0 -or
    $ExpectedOriginLeaseCases -ne 0 -or $ExpectedStageReservationCases -ne 0 -or
    $ExpectedReservationOriginalCases -ne 0 -or $ExpectedPreactivationCases -ne 0 -or
    $ExpectedTranscriptPrefixCases -ne 0 -or $ExpectedUserIntentV3Cases -ne 0) {
    throw 'NATIVE_PACKAGE_BINDING_V2_UNUSED_REVIEW_ARGUMENTS_REFUSED'
}

$relativeSources = @(
    'licensing/adapter-evidence/standard-native-control/NativeHostProfile.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostProfileTests.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostInputCodecV2.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostInputCodecV2Tests.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostStageStoreV2.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostStageStoreV2Tests.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostPackageBindingV2.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostPackageBindingV2Tests.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostUserIntentV2.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostUserIntentV2Tests.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostOriginLeaseV2.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostOriginLeaseV2Tests.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostStageReservationV3.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostStageReservationV3Tests.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostOriginWindowsV2.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostReservationOriginalV3.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostReservationOriginalV3Tests.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostReservationWindowsV3.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostPreactivationV3.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostPreactivationV3Tests.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostTranscriptPrefixV3.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostTranscriptPrefixV3Tests.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostUserIntentV3.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostUserIntentV3Tests.cs',
    'scripts/build-license-standard-native-package-binding-v2.ps1'
)
$sourceBytes = @{}
$inputs = @(foreach ($relative in $relativeSources) {
    $path = Join-Path $repo $relative
    PackageBindingPlain $path
    $raw = [IO.File]::ReadAllBytes($path)
    if ($raw.Length -eq 0 -or $raw.Length -gt 2097152) { throw 'NATIVE_PACKAGE_BINDING_V2_SOURCE_SIZE_REFUSED' }
    $sourceBytes[$relative] = $raw
    [ordered]@{relative=$relative;length=$raw.Length;sha256=(PackageBindingBytesHash $raw)}
})
if ($inputs.Count -ne 25 -or @($inputs.relative | Sort-Object -Unique).Count -ne 25) {
    throw 'NATIVE_PACKAGE_BINDING_V2_SOURCE_SET_REFUSED'
}
$sourceSet = [ordered]@{schema='TEST_ONLY_STANDARD_NATIVE_PACKAGE_BINDING_V2_SOURCE_SET_V1';
    sourceBaselineCommitDeclared=$baseline;inputs=$inputs}
$sourceSetBytes = $utf8.GetBytes(($sourceSet | ConvertTo-Json -Depth 8 -Compress))
$sourceSetHash = PackageBindingBytesHash $sourceSetBytes
if ($PrintSourceSetSha256) { Write-Output $sourceSetHash; return }
if ($RunReviewedSelfTests -and $ReviewedSourceSetSha256 -cne $sourceSetHash) {
    throw 'NATIVE_PACKAGE_BINDING_V2_REVIEWED_SOURCE_SET_CHANGED'
}

$entry = @'
using System;
using System.Text.Json;
namespace EntryControl.TestOnly.StandardNativeHost;
internal static class NativeHostPackageBindingV2PureProgram
{
    internal static int Main(string[] args)
    {
        if (args.Length != 1 || !string.Equals(args[0], "--self-test", StringComparison.Ordinal)) {
            Console.Error.WriteLine("STANDARD_NATIVE_PACKAGE_BINDING_V2_ENTRY_CLOSED");
            return 2;
        }
        int profile = NativeHostProfileTests.Run();
        int input = NativeHostInputCodecV2Tests.Run();
        int store = NativeHostStageStoreV2Tests.Run();
        int package = NativeHostPackageBindingV2Tests.Run();
        int userIntent = NativeHostUserIntentV2Tests.RunTests();
        int originLease = NativeHostOriginLeaseV2Tests.Run();
        int stageReservation = NativeHostStageReservationV3Tests.Run();
        int reservationOriginal = NativeHostReservationOriginalV3Tests.Run();
        int preactivation = NativeHostPreactivationV3Tests.Run();
        int transcriptPrefix = NativeHostTranscriptPrefixV3Tests.Run();
        int userIntentV3 = NativeHostUserIntentV3Tests.Run();
#if COMPILE_ONLY_NATIVE_HOST_ORIGIN_WINDOWS_V2
        const bool windowsOriginAdapterCompiled = true;
#else
        const bool windowsOriginAdapterCompiled = false;
#endif
#if COMPILE_ONLY_NATIVE_HOST_RESERVATION_WINDOWS_V3
        const bool windowsReservationAdapterCompiled = true;
#else
        const bool windowsReservationAdapterCompiled = false;
#endif
        Console.Out.WriteLine(JsonSerializer.Serialize(new {
            schema = "TEST_ONLY_STANDARD_NATIVE_PACKAGE_BINDING_V2_PURE_SELF_TEST_V8",
            status = "PASS", profileCases = profile, inputCodecCases = input,
            stageStoreCases = store, packageBindingCases = package,
            userIntentCases = userIntent, originLeaseCases = originLease,
            stageReservationCases = stageReservation,
            reservationOriginalCases = reservationOriginal,
            preactivationCases = preactivation,
            transcriptPrefixCases = transcriptPrefix,
            userIntentV3Cases = userIntentV3,
            windowsOriginAdapterCompiled,
            windowsReservationAdapterCompiled,
            nativeEffects = false, physicalKitAdmitted = false,
            approvalAuthorityAccepted = false, clrBootstrapAccepted = false,
            managedEntryInvoked = false, processTokenAssociationEstablished = false,
            loadedModulesAttested = false, persistedCngTested = false,
            securityAccepted = false, productionAccepted = false, lic008Closed = false
        }));
        return 0;
    }
}
'@
$entryBytes = $utf8.GetBytes($entry)
$entrySha256 = PackageBindingBytesHash $entryBytes

foreach ($path in @($dotnet,$compiler,$powershell)) { PackageBindingPlain $path }
foreach ($root in @($references) + $runtimeRoots) { PackageBindingPlain $root }
$toolInputs = @(foreach ($path in @($dotnet,$compiler,$powershell)) {
    [ordered]@{path=$path;length=([IO.FileInfo]$path).Length;sha256=(PackageBindingHash $path)}
})
$referenceInputs = @(Get-ChildItem -LiteralPath $references -File -Filter '*.dll' | Sort-Object Name |
    ForEach-Object { PackageBindingPlain $_.FullName; [ordered]@{path=$_.FullName;length=$_.Length;sha256=(PackageBindingHash $_.FullName)} })
$compilerInputs = @(Get-ChildItem -LiteralPath ([IO.Path]::GetDirectoryName($compiler)) -File | Sort-Object Name |
    ForEach-Object { PackageBindingPlain $_.FullName; [ordered]@{path=$_.FullName;length=$_.Length;sha256=(PackageBindingHash $_.FullName)} })
$runtimeInputs = @(foreach ($root in $runtimeRoots) {
    Get-ChildItem -LiteralPath $root -File | Sort-Object Name | ForEach-Object {
        PackageBindingPlain $_.FullName
        [ordered]@{path=$_.FullName;length=$_.Length;sha256=(PackageBindingHash $_.FullName)}
    }
})
if ($toolInputs.Count -ne 3 -or $referenceInputs.Count -ne 167 -or
    $compilerInputs.Count -ne 15 -or $runtimeInputs.Count -ne 190) {
    throw 'NATIVE_PACKAGE_BINDING_V2_INSTALLED_INPUT_SET_REFUSED'
}
if ($toolInputs[0].sha256 -cne $fixedDotnetSha256 -or
    $toolInputs[1].sha256 -cne $fixedCompilerSha256 -or
    $toolInputs[2].sha256 -cne $fixedPowerShellSha256 -or
    (PackageBindingPinSetDigest $referenceInputs) -cne $fixedReferenceSetSha256 -or
    (PackageBindingPinSetDigest $compilerInputs) -cne $fixedCompilerSetSha256 -or
    (PackageBindingPinSetDigest $runtimeInputs) -cne $fixedRuntimeSetSha256) {
    throw 'NATIVE_PACKAGE_BINDING_V2_FIXED_INSTALLED_INPUT_PINS_REFUSED'
}
$outputRoot = Join-Path $repo 'out'
PackageBindingPlain $outputRoot
PackageBindingDirectory $destination
$snapshot = Join-Path $destination 'snapshot'
PackageBindingDirectory $snapshot
foreach ($input in $inputs) {
    $path = Join-Path $snapshot ([IO.Path]::GetFileName($input.relative))
    PackageBindingNew $path $sourceBytes[$input.relative]
    if ((PackageBindingHash $path) -cne $input.sha256) { throw 'NATIVE_PACKAGE_BINDING_V2_SNAPSHOT_CHANGED' }
}
PackageBindingNew (Join-Path $snapshot 'NativeHostPackageBindingV2PureProgram.cs') $entryBytes
PackageBindingNew (Join-Path $destination 'source-set.json') $sourceSetBytes

$closed = @(
    @(),@('--run'),@('--owner'),@('--user'),@('--service'),@('--setup'),@('--guardian'),
    @('--bootstrap'),@('--load-clr'),@('--package'),@('--bind'),@('--self-test','extra'),
    @('--SELF-TEST'),@('--profile'),@('--native-controller')
)
$shapeOptions = @('--attempt',('1'*32),'--plan-sha256',('2'*64),
    '--approval-sha256',('3'*64),'--source-set-sha256',('4'*64))
$closed += ,@(@('--owner') + $shapeOptions)
$closed += ,@(@('--user') + $shapeOptions)
$closed += ,@(@('--service','--role','Setup') + $shapeOptions)
$closed += ,@(@('--service','--role','Guardian') + $shapeOptions)
$closed += ,@(@('--user') + $shapeOptions + @('--run-id',('5'*32),'--nonce',('6'*64)))
if ($closed.Count -ne 20) { throw 'NATIVE_PACKAGE_BINDING_V2_CLOSED_SET_REFUSED' }
$closedError = 'STANDARD_NATIVE_PACKAGE_BINDING_V2_ENTRY_CLOSED'
$variants = New-Object 'Collections.Generic.List[object]'
foreach ($variant in @('default','unrelated-defines','native-macro-defines')) {
    $folder = Join-Path $destination $variant
    PackageBindingDirectory $folder
    PackageBindingDirectory (Join-Path $folder 'temp')
    $dll = Join-Path $folder 'StandardNativePackageBindingV2.dll'
    $rsp = Join-Path $folder 'compile.rsp'
    $arguments = @('-nologo','-target:exe','-platform:x64','-nullable:enable','-warnaserror+',
        '-main:EntryControl.TestOnly.StandardNativeHost.NativeHostPackageBindingV2PureProgram',
        ('-out:"' + $dll + '"'))
    if ($variant -ceq 'unrelated-defines') {
        $arguments += '-define:TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V5,TEST_CAPABLE_STANDARD_USER_CONTROL_V1'
    }
    if ($variant -ceq 'native-macro-defines') {
        $arguments += '-define:COMPILE_ONLY_STANDARD_HOST_NATIVE_V1,COMPILE_ONLY_STANDARD_LOADER_NATIVE_V1,COMPILE_ONLY_NATIVE_HOST_ORIGIN_WINDOWS_V2,COMPILE_ONLY_NATIVE_HOST_RESERVATION_WINDOWS_V3'
    }
    $arguments += @($referenceInputs | ForEach-Object { '-r:"' + $_.path + '"' })
    $arguments += @($inputs | Where-Object { $_.relative.EndsWith('.cs',[StringComparison]::Ordinal) } |
        ForEach-Object { '"' + (Join-Path $snapshot ([IO.Path]::GetFileName($_.relative))) + '"' })
    $arguments += '"' + (Join-Path $snapshot 'NativeHostPackageBindingV2PureProgram.cs') + '"'
    PackageBindingNew $rsp ($utf8.GetBytes(($arguments -join [Environment]::NewLine)))
    $compiled = PackageBindingRun $dotnet @($compiler,('@' + $rsp)) $folder 'compile' 300000
    if ($compiled.exitCode -ne 0 -or $compiled.stdout.Length -ne 0 -or $compiled.stderr.Length -ne 0) {
        throw ('NATIVE_PACKAGE_BINDING_V2_COMPILE_FAILED_' + $variant)
    }
    PackageBindingPlain $dll
    $dllInfo = New-Object IO.FileInfo($dll)
    if ($dllInfo.Length -lt 4096 -or $dllInfo.Length -gt 16777216) {
        throw 'NATIVE_PACKAGE_BINDING_V2_COMPILED_LENGTH_REFUSED'
    }
    $runtimeConfig = Join-Path $folder 'StandardNativePackageBindingV2.runtimeconfig.json'
    PackageBindingNew $runtimeConfig ($utf8.GetBytes('{"runtimeOptions":{"tfm":"net10.0","framework":{"name":"Microsoft.NETCore.App","version":"10.0.11"},"rollForward":"Disable"}}'))
    $report = $null
    $reportHash = $null
    $refusals = New-Object 'Collections.Generic.List[object]'
    if ($RunReviewedSelfTests) {
        $invoke = @('exec','--fx-version','10.0.11',$dll)
        $tested = PackageBindingRun $dotnet ($invoke + @('--self-test')) $folder 'self-test' 30000
        if ($tested.exitCode -ne 0 -or $tested.stderr.Length -ne 0 -or
            -not (PackageBindingOneLine $tested.stdout)) {
            throw ('NATIVE_PACKAGE_BINDING_V2_PURE_TEST_FAILED_' + $variant)
        }
        $report = $tested.stdout | ConvertFrom-Json
        $names = @($report.PSObject.Properties.Name)
        if ($names.Count -ne 26 -or $report.schema -cne 'TEST_ONLY_STANDARD_NATIVE_PACKAGE_BINDING_V2_PURE_SELF_TEST_V8' -or
            $report.status -cne 'PASS' -or $report.profileCases -ne $ExpectedProfileCases -or
            $report.inputCodecCases -ne $ExpectedInputCodecCases -or $report.stageStoreCases -ne $ExpectedStageStoreCases -or
            $report.packageBindingCases -ne $ExpectedPackageCases -or
            $report.userIntentCases -ne $ExpectedUserIntentCases -or
            $report.originLeaseCases -ne $ExpectedOriginLeaseCases -or
            $report.stageReservationCases -ne $ExpectedStageReservationCases -or
            $report.reservationOriginalCases -ne $ExpectedReservationOriginalCases -or
            $report.preactivationCases -ne $ExpectedPreactivationCases -or
            $report.transcriptPrefixCases -ne $ExpectedTranscriptPrefixCases -or
            $report.userIntentV3Cases -ne $ExpectedUserIntentV3Cases -or
            $report.windowsOriginAdapterCompiled -ne ($variant -ceq 'native-macro-defines') -or
            $report.windowsReservationAdapterCompiled -ne ($variant -ceq 'native-macro-defines') -or
            $report.physicalKitAdmitted -ne $false -or $report.approvalAuthorityAccepted -ne $false -or
            $report.nativeEffects -ne $false -or $report.clrBootstrapAccepted -ne $false -or
            $report.managedEntryInvoked -ne $false -or $report.processTokenAssociationEstablished -ne $false -or
            $report.loadedModulesAttested -ne $false -or $report.persistedCngTested -ne $false -or
            $report.securityAccepted -ne $false -or $report.productionAccepted -ne $false -or
            $report.lic008Closed -ne $false) { throw 'NATIVE_PACKAGE_BINDING_V2_PURE_REPORT_REFUSED' }
        $reportHash = $tested.stdoutSha256
        for ($i = 0; $i -lt $closed.Count; $i++) {
            $refused = PackageBindingRun $dotnet ($invoke + [string[]]$closed[$i]) $folder ('closed-' + $i) 30000
            if ($refused.exitCode -ne 2 -or $refused.stdout.Length -ne 0 -or
                -not (PackageBindingExactLine $refused.stderr $closedError)) {
                throw ('NATIVE_PACKAGE_BINDING_V2_CLOSED_ENTRY_FAILED_' + $variant + '_' + $i)
            }
            $refusals.Add([ordered]@{arguments=$closed[$i];exitCode=2;
                stdoutSha256=$refused.stdoutSha256;stderrSha256=$refused.stderrSha256})
        }
    }
    $variants.Add([ordered]@{name=$variant;dllPath=$dll;dllSha256=(PackageBindingHash $dll);
        dllLength=$dllInfo.Length;runtimeconfigSha256=(PackageBindingHash $runtimeConfig);
        compileRspSha256=(PackageBindingHash $rsp);compileStdoutSha256=$compiled.stdoutSha256;
        compileStderrSha256=$compiled.stderrSha256;pureTestReportSha256=$reportHash;
        pureTest=$report;closedEntryResults=$refusals.ToArray();
        selfTestsExecuted=[bool]$RunReviewedSelfTests;nativeBindingInvoked=$false})
}
foreach ($input in $inputs) {
    if ((PackageBindingHash (Join-Path $repo $input.relative)) -cne $input.sha256 -or
        (PackageBindingHash (Join-Path $snapshot ([IO.Path]::GetFileName($input.relative)))) -cne $input.sha256) {
        throw 'NATIVE_PACKAGE_BINDING_V2_SOURCE_CHANGED'
    }
}
if ((PackageBindingHash (Join-Path $snapshot 'NativeHostPackageBindingV2PureProgram.cs')) -cne $entrySha256) {
    throw 'NATIVE_PACKAGE_BINDING_V2_GENERATED_ENTRY_CHANGED'
}
foreach ($set in @($toolInputs,$referenceInputs,$compilerInputs,$runtimeInputs)) {
    foreach ($item in $set) {
        if ((PackageBindingHash $item.path) -cne $item.sha256 -or
            ([IO.FileInfo]$item.path).Length -ne $item.length) {
            throw 'NATIVE_PACKAGE_BINDING_V2_INSTALLED_INPUT_CHANGED'
        }
    }
}
PackageBindingJson (Join-Path $destination 'manifest.json') ([ordered]@{
    schema='TEST_ONLY_STANDARD_NATIVE_PACKAGE_BINDING_V2_COMPONENT_BUILD_V8';
    builtUtc=[DateTimeOffset]::UtcNow.ToString('O');sourceBaselineCommitDeclared=$baseline;
    sourceSetSha256=$sourceSetHash;inputs=$inputs;generatedEntrySha256=$entrySha256;
    generatedEntryStoredOnlyInFreshSnapshot=$true;toolInputs=$toolInputs;
    referenceInputs=$referenceInputs;compilerInputs=$compilerInputs;runtimeInputs=$runtimeInputs;
    installedReferenceSetSha256=$fixedReferenceSetSha256;
    installedCompilerSetSha256=$fixedCompilerSetSha256;
    installedRuntimeSetSha256=$fixedRuntimeSetSha256;
    reviewedSourceSetSha256=$ReviewedSourceSetSha256;reviewedCaseCounts=[ordered]@{
        profile=$ExpectedProfileCases;inputCodec=$ExpectedInputCodecCases;stageStore=$ExpectedStageStoreCases;
        packageBinding=$ExpectedPackageCases;userIntent=$ExpectedUserIntentCases;
        originLease=$ExpectedOriginLeaseCases;stageReservation=$ExpectedStageReservationCases;
        reservationOriginal=$ExpectedReservationOriginalCases;
        preactivation=$ExpectedPreactivationCases;
        transcriptPrefix=$ExpectedTranscriptPrefixCases;
        userIntentV3=$ExpectedUserIntentV3Cases};
    variants=$variants.ToArray();selfTestsExecuted=[bool]$RunReviewedSelfTests;
    nativeEffects=$false;accountChanged=$false;serviceChanged=$false;keyChanged=$false;
    physicalKitAdmitted=$false;approvalAuthorityAccepted=$false;
    managedEntryInvoked=$false;clrBootstrapAccepted=$false;
    processTokenAssociationEstablished=$false;loadedModulesAttested=$false;
    nativeCompatibilityAccepted=$false;persistedCngTested=$false;
    securityAccepted=$false;productionAccepted=$false;lic008Closed=$false;
    byteReproducibilityEstablished=$false
})
[ordered]@{schema='TEST_ONLY_STANDARD_NATIVE_PACKAGE_BINDING_V2_BUILD_LOCATION_V1';
    directory=$destination;sourceSetSha256=$sourceSetHash;
    manifestSha256=(PackageBindingHash (Join-Path $destination 'manifest.json'));
    variants=$variants.Count;selfTestsExecuted=[bool]$RunReviewedSelfTests;
    nativeEffects=$false;physicalKitAdmitted=$false;approvalAuthorityAccepted=$false;
    securityAccepted=$false;productionAccepted=$false;
    lic008Closed=$false} | ConvertTo-Json -Compress
