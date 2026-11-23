[CmdletBinding()]
param(
    [switch]$RunReviewedSelfTests,
    [string]$ReviewedSourceSetSha256 = '',
    [int]$ExpectedProfileCases = 0,
    [int]$ExpectedInputCodecCases = 0,
    [int]$ExpectedStageStoreCases = 0,
    [switch]$PrintSourceSetSha256
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# This builder compiles a closed, generated entry over six pure V2 C# sources.
# Running that entry requires an independently reviewed exact source-set digest
# and three reviewed check counts. It has no operational CLI, native binding,
# account, SCM, persisted key, CLR bootstrap, or licensing authority path.
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$baseline = '58659d85c4beb7c160491c3c8723deae35c3b8a8'
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
$destination = Join-Path $repo ('out\lic008-standard-native-control-v2-' + [Guid]::NewGuid().ToString('N'))
$script:HeldControlRuns = New-Object 'Collections.Generic.List[object]'
$utf8 = New-Object Text.UTF8Encoding($false,$true)

function ControlHash([string]$Path) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function ControlBytesHash([byte[]]$Bytes) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { [BitConverter]::ToString($sha.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant() }
    finally { $sha.Dispose() }
}
function ControlPlain([string]$Path) {
    for ($cursor = [IO.Path]::GetFullPath($Path); $cursor; $cursor = [IO.Path]::GetDirectoryName($cursor)) {
        if (([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'NATIVE_CONTROL_V2_REPARSE_REFUSED'
        }
    }
}
function ControlNew([string]$Path,[byte[]]$Bytes) {
    ControlPlain ([IO.Path]::GetDirectoryName($Path))
    $stream = [IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    try { $stream.Write($Bytes,0,$Bytes.Length); $stream.Flush($true) }
    finally { $stream.Dispose() }
}
function ControlJson([string]$Path,$Value) {
    ControlNew $Path ($utf8.GetBytes(($Value | ConvertTo-Json -Depth 16 -Compress)))
}
function ControlDirectory([string]$Path) {
    ControlPlain ([IO.Path]::GetDirectoryName($Path))
    if (Test-Path -LiteralPath $Path) { throw 'NATIVE_CONTROL_V2_FRESH_DIRECTORY_COLLISION' }
    $null = New-Item -ItemType Directory -Path $Path -ErrorAction Stop
    ControlPlain $Path
}
function ControlArguments([string[]]$Values) {
    if ($null -eq $Values -or $Values.Count -eq 0) { return '' }
    $quoted = foreach ($value in $Values) {
        if ($value -match '[\x00\r\n]' -or $value.Contains('"') -or $value.EndsWith('\')) {
            throw 'NATIVE_CONTROL_V2_FIXED_ARGUMENT_REFUSED'
        }
        '"' + $value + '"'
    }
    [string]::Join(' ',[string[]]$quoted)
}
function ControlExactLine([string]$Actual,[string]$Expected) {
    $Actual -ceq ($Expected + "`n") -or $Actual -ceq ($Expected + "`r`n")
}
function ControlOneLine([string]$Actual) {
    if ($Actual.Length -eq 0) { return $false }
    $normal = $Actual.Replace("`r`n","`n")
    $normal.EndsWith("`n",[StringComparison]::Ordinal) -and
        $normal.IndexOf("`n",[StringComparison]::Ordinal) -eq $normal.Length - 1 -and
        -not $normal.Contains("`r")
}
function ControlPinSetDigest($Pins) {
    $builder = New-Object Text.StringBuilder
    foreach ($pin in $Pins) {
        [void]$builder.Append([string]$pin.path).Append([char]0).Append([long]$pin.length).
            Append([char]0).Append([string]$pin.sha256).Append("`n")
    }
    ControlBytesHash ($utf8.GetBytes($builder.ToString()))
}
function ControlRun([string]$Executable,[string[]]$Arguments,[string]$Folder,[string]$Label,[int]$Milliseconds) {
    ControlPlain $Executable; ControlPlain $Folder
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $Executable
    $start.Arguments = ControlArguments $Arguments
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
    $script:HeldControlRuns.Add($held)
    ControlJson (Join-Path $Folder ($Label + '.intent.json')) ([ordered]@{
        executable=$Executable;executableSha256=(ControlHash $Executable);arguments=$Arguments;
        workingDirectory=$Folder;childOnlyEnvironment=[ordered]@{SystemRoot='C:\Windows';windir='C:\Windows';
            TEMP=$start.EnvironmentVariables['TEMP'];TMP=$start.EnvironmentVariables['TMP']};
        timeoutMilliseconds=$Milliseconds})
    if (-not $process.Start()) { throw 'NATIVE_CONTROL_V2_CHILD_START_FAILED_RETAINED' }
    $held.pid = $process.Id
    $held.stdoutTask = $process.StandardOutput.BaseStream.CopyToAsync($stdout)
    $held.stderrTask = $process.StandardError.BaseStream.CopyToAsync($stderr)
    ControlJson (Join-Path $Folder ($Label + '.started.json')) ([ordered]@{
        pid=$held.pid;startedUtc=[DateTimeOffset]::UtcNow.ToString('O')})
    if (-not $process.WaitForExit($Milliseconds)) {
        ControlJson (Join-Path $Folder ($Label + '.pending.json')) ([ordered]@{
            pid=$held.pid;status='UNRESOLVED_RETAIN_PID_HANDLES_STREAMS_TASKS_AND_PARTIALS';
            noKill=$true;noRetry=$true;heldWhileBuilderHostLives=$true})
        throw ('NATIVE_CONTROL_V2_CHILD_UNRESOLVED_RETAIN_PID_' + $held.pid)
    }
    if (-not [Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($held.stdoutTask,$held.stderrTask),5000)) {
        ControlJson (Join-Path $Folder ($Label + '.pending.json')) ([ordered]@{
            pid=$held.pid;status='OUTPUT_JOIN_UNRESOLVED_RETAIN_HANDLES_STREAMS_TASKS_AND_PARTIALS';
            noKill=$true;noRetry=$true;heldWhileBuilderHostLives=$true})
        throw ('NATIVE_CONTROL_V2_OUTPUT_JOIN_UNRESOLVED_RETAIN_PID_' + $held.pid)
    }
    $null = $held.stdoutTask.GetAwaiter().GetResult()
    $null = $held.stderrTask.GetAwaiter().GetResult()
    $stdout.Flush($true); $stderr.Flush($true); $held.terminal = $true
    $code = $process.ExitCode
    $stdout.Dispose(); $stderr.Dispose(); $process.Dispose()
    $output = [IO.File]::ReadAllText($stdoutPath,$utf8)
    $errorText = [IO.File]::ReadAllText($stderrPath,$utf8)
    $result = [ordered]@{exitCode=$code;stdoutSha256=(ControlHash $stdoutPath);
        stderrSha256=(ControlHash $stderrPath);stdoutLength=([IO.FileInfo]$stdoutPath).Length;
        stderrLength=([IO.FileInfo]$stderrPath).Length;pid=$held.pid;terminalObserved=$true}
    ControlJson (Join-Path $Folder ($Label + '.result.json')) $result
    [pscustomobject]@{exitCode=$code;stdout=$output;stderr=$errorText;
        stdoutSha256=$result.stdoutSha256;stderrSha256=$result.stderrSha256}
}

ControlPlain $repo
if ($PSHOME -cne 'C:\Windows\System32\WindowsPowerShell\v1.0' -or [IntPtr]::Size -ne 8) {
    throw 'NATIVE_CONTROL_V2_BUILDER_POWERSHELL_PROFILE_REFUSED'
}
if ($PrintSourceSetSha256 -and ($RunReviewedSelfTests -or $ReviewedSourceSetSha256.Length -ne 0 -or
    $ExpectedProfileCases -ne 0 -or $ExpectedInputCodecCases -ne 0 -or $ExpectedStageStoreCases -ne 0)) {
    throw 'NATIVE_CONTROL_V2_SOURCE_DIGEST_MODE_ARGUMENTS_REFUSED'
}
if ($RunReviewedSelfTests) {
    if ($ReviewedSourceSetSha256 -cnotmatch '^[0-9a-f]{64}$' -or $ExpectedProfileCases -le 0 -or
        $ExpectedInputCodecCases -le 0 -or $ExpectedStageStoreCases -le 0) {
        throw 'NATIVE_CONTROL_V2_REVIEWED_DIGEST_AND_CASE_COUNTS_REQUIRED'
    }
} elseif ($ReviewedSourceSetSha256.Length -ne 0 -or $ExpectedProfileCases -ne 0 -or
    $ExpectedInputCodecCases -ne 0 -or $ExpectedStageStoreCases -ne 0) {
    throw 'NATIVE_CONTROL_V2_UNUSED_REVIEW_ARGUMENTS_REFUSED'
}

$relativeSources = @(
    'licensing/adapter-evidence/standard-native-control/NativeHostProfile.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostProfileTests.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostInputCodecV2.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostInputCodecV2Tests.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostStageStoreV2.cs',
    'licensing/adapter-evidence/standard-native-control/NativeHostStageStoreV2Tests.cs',
    'scripts/build-license-standard-native-control-v2.ps1'
)
$sourceBytes = @{}
$inputs = @(foreach ($relative in $relativeSources) {
    $path = Join-Path $repo $relative
    ControlPlain $path
    $raw = [IO.File]::ReadAllBytes($path)
    if ($raw.Length -eq 0 -or $raw.Length -gt 2097152) { throw 'NATIVE_CONTROL_V2_SOURCE_SIZE_REFUSED' }
    $sourceBytes[$relative] = $raw
    [ordered]@{relative=$relative;length=$raw.Length;sha256=(ControlBytesHash $raw)}
})
if ($inputs.Count -ne 7 -or @($inputs.relative | Sort-Object -Unique).Count -ne 7) {
    throw 'NATIVE_CONTROL_V2_SOURCE_SET_REFUSED'
}
$sourceSet = [ordered]@{schema='TEST_ONLY_STANDARD_NATIVE_CONTROL_V2_SOURCE_SET_V1';
    sourceBaselineCommitDeclared=$baseline;inputs=$inputs}
$sourceSetBytes = $utf8.GetBytes(($sourceSet | ConvertTo-Json -Depth 8 -Compress))
$sourceSetHash = ControlBytesHash $sourceSetBytes
if ($PrintSourceSetSha256) { Write-Output $sourceSetHash; return }
if ($RunReviewedSelfTests -and $ReviewedSourceSetSha256 -cne $sourceSetHash) {
    throw 'NATIVE_CONTROL_V2_REVIEWED_SOURCE_SET_CHANGED'
}

$entry = @'
using System;
using System.Text.Json;
namespace EntryControl.TestOnly.StandardNativeHost;
internal static class NativeHostControlV2PureProgram
{
    internal static int Main(string[] args)
    {
        if (args.Length != 1 || !string.Equals(args[0], "--self-test", StringComparison.Ordinal)) {
            Console.Error.WriteLine("STANDARD_NATIVE_CONTROL_V2_ENTRY_CLOSED");
            return 2;
        }
        int profile = NativeHostProfileTests.Run();
        int input = NativeHostInputCodecV2Tests.Run();
        int store = NativeHostStageStoreV2Tests.Run();
        Console.Out.WriteLine(JsonSerializer.Serialize(new {
            schema = "TEST_ONLY_STANDARD_NATIVE_CONTROL_V2_PURE_SELF_TEST_V1",
            status = "PASS", profileCases = profile, inputCodecCases = input,
            stageStoreCases = store, nativeEffects = false, clrBootstrapAccepted = false,
            managedEntryInvoked = false, processTokenAssociationEstablished = false,
            loadedModulesAttested = false, persistedCngTested = false,
            securityAccepted = false, productionAccepted = false, lic008Closed = false
        }));
        return 0;
    }
}
'@
$entryBytes = $utf8.GetBytes($entry)
$entrySha256 = ControlBytesHash $entryBytes

foreach ($path in @($dotnet,$compiler,$powershell)) { ControlPlain $path }
foreach ($root in @($references) + $runtimeRoots) { ControlPlain $root }
$toolInputs = @(foreach ($path in @($dotnet,$compiler,$powershell)) {
    [ordered]@{path=$path;length=([IO.FileInfo]$path).Length;sha256=(ControlHash $path)}
})
$referenceInputs = @(Get-ChildItem -LiteralPath $references -File -Filter '*.dll' | Sort-Object Name |
    ForEach-Object { ControlPlain $_.FullName; [ordered]@{path=$_.FullName;length=$_.Length;sha256=(ControlHash $_.FullName)} })
$compilerInputs = @(Get-ChildItem -LiteralPath ([IO.Path]::GetDirectoryName($compiler)) -File | Sort-Object Name |
    ForEach-Object { ControlPlain $_.FullName; [ordered]@{path=$_.FullName;length=$_.Length;sha256=(ControlHash $_.FullName)} })
$runtimeInputs = @(foreach ($root in $runtimeRoots) {
    Get-ChildItem -LiteralPath $root -File | Sort-Object Name | ForEach-Object {
        ControlPlain $_.FullName
        [ordered]@{path=$_.FullName;length=$_.Length;sha256=(ControlHash $_.FullName)}
    }
})
if ($toolInputs.Count -ne 3 -or $referenceInputs.Count -ne 167 -or
    $compilerInputs.Count -ne 15 -or $runtimeInputs.Count -ne 190) {
    throw 'NATIVE_CONTROL_V2_INSTALLED_INPUT_SET_REFUSED'
}
if ($toolInputs[0].sha256 -cne $fixedDotnetSha256 -or
    $toolInputs[1].sha256 -cne $fixedCompilerSha256 -or
    $toolInputs[2].sha256 -cne $fixedPowerShellSha256 -or
    (ControlPinSetDigest $referenceInputs) -cne $fixedReferenceSetSha256 -or
    (ControlPinSetDigest $compilerInputs) -cne $fixedCompilerSetSha256 -or
    (ControlPinSetDigest $runtimeInputs) -cne $fixedRuntimeSetSha256) {
    throw 'NATIVE_CONTROL_V2_FIXED_INSTALLED_INPUT_PINS_REFUSED'
}
$outputRoot = Join-Path $repo 'out'
ControlPlain $outputRoot
ControlDirectory $destination
$snapshot = Join-Path $destination 'snapshot'
ControlDirectory $snapshot
foreach ($input in $inputs) {
    $path = Join-Path $snapshot ([IO.Path]::GetFileName($input.relative))
    ControlNew $path $sourceBytes[$input.relative]
    if ((ControlHash $path) -cne $input.sha256) { throw 'NATIVE_CONTROL_V2_SNAPSHOT_CHANGED' }
}
ControlNew (Join-Path $snapshot 'NativeHostControlV2PureProgram.cs') $entryBytes
ControlNew (Join-Path $destination 'source-set.json') $sourceSetBytes

$closed = @(
    @(),@('--run'),@('--owner'),@('--user'),@('--service'),@('--setup'),@('--guardian'),
    @('--bootstrap'),@('--load-clr'),@('--store'),@('--grant'),@('--self-test','extra'),
    @('--SELF-TEST'),@('--profile'),@('--native-controller')
)
$shapeOptions = @('--attempt',('1'*32),'--plan-sha256',('2'*64),
    '--approval-sha256',('3'*64),'--source-set-sha256',('4'*64))
$closed += ,@(@('--owner') + $shapeOptions)
$closed += ,@(@('--user') + $shapeOptions)
$closed += ,@(@('--service','--role','Setup') + $shapeOptions)
$closed += ,@(@('--service','--role','Guardian') + $shapeOptions)
$closedError = 'STANDARD_NATIVE_CONTROL_V2_ENTRY_CLOSED'
$variants = New-Object 'Collections.Generic.List[object]'
foreach ($variant in @('default','unrelated-defines','native-macro-defines')) {
    $folder = Join-Path $destination $variant
    ControlDirectory $folder
    ControlDirectory (Join-Path $folder 'temp')
    $dll = Join-Path $folder 'StandardNativeControlV2.dll'
    $rsp = Join-Path $folder 'compile.rsp'
    $arguments = @('-nologo','-target:exe','-platform:x64','-nullable:enable','-warnaserror+',
        '-main:EntryControl.TestOnly.StandardNativeHost.NativeHostControlV2PureProgram',
        ('-out:"' + $dll + '"'))
    if ($variant -ceq 'unrelated-defines') {
        $arguments += '-define:TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V5,TEST_CAPABLE_STANDARD_USER_CONTROL_V1'
    }
    if ($variant -ceq 'native-macro-defines') {
        $arguments += '-define:COMPILE_ONLY_STANDARD_HOST_NATIVE_V1,COMPILE_ONLY_STANDARD_LOADER_NATIVE_V1'
    }
    $arguments += @($referenceInputs | ForEach-Object { '-r:"' + $_.path + '"' })
    $arguments += @($inputs | Where-Object { $_.relative.EndsWith('.cs',[StringComparison]::Ordinal) } |
        ForEach-Object { '"' + (Join-Path $snapshot ([IO.Path]::GetFileName($_.relative))) + '"' })
    $arguments += '"' + (Join-Path $snapshot 'NativeHostControlV2PureProgram.cs') + '"'
    ControlNew $rsp ($utf8.GetBytes(($arguments -join [Environment]::NewLine)))
    $compiled = ControlRun $dotnet @($compiler,('@' + $rsp)) $folder 'compile' 300000
    if ($compiled.exitCode -ne 0 -or $compiled.stdout.Length -ne 0 -or $compiled.stderr.Length -ne 0) {
        throw ('NATIVE_CONTROL_V2_COMPILE_FAILED_' + $variant)
    }
    ControlPlain $dll
    $dllInfo = New-Object IO.FileInfo($dll)
    if ($dllInfo.Length -lt 4096 -or $dllInfo.Length -gt 16777216) {
        throw 'NATIVE_CONTROL_V2_COMPILED_LENGTH_REFUSED'
    }
    $runtimeConfig = Join-Path $folder 'StandardNativeControlV2.runtimeconfig.json'
    ControlNew $runtimeConfig ($utf8.GetBytes('{"runtimeOptions":{"tfm":"net10.0","framework":{"name":"Microsoft.NETCore.App","version":"10.0.11"},"rollForward":"Disable"}}'))
    $report = $null
    $reportHash = $null
    $refusals = New-Object 'Collections.Generic.List[object]'
    if ($RunReviewedSelfTests) {
        $invoke = @('exec','--fx-version','10.0.11',$dll)
        $tested = ControlRun $dotnet ($invoke + @('--self-test')) $folder 'self-test' 30000
        if ($tested.exitCode -ne 0 -or $tested.stderr.Length -ne 0 -or
            -not (ControlOneLine $tested.stdout)) {
            throw ('NATIVE_CONTROL_V2_PURE_TEST_FAILED_' + $variant)
        }
        $report = $tested.stdout | ConvertFrom-Json
        $names = @($report.PSObject.Properties.Name)
        if ($names.Count -ne 14 -or $report.schema -cne 'TEST_ONLY_STANDARD_NATIVE_CONTROL_V2_PURE_SELF_TEST_V1' -or
            $report.status -cne 'PASS' -or $report.profileCases -ne $ExpectedProfileCases -or
            $report.inputCodecCases -ne $ExpectedInputCodecCases -or $report.stageStoreCases -ne $ExpectedStageStoreCases -or
            $report.nativeEffects -ne $false -or $report.clrBootstrapAccepted -ne $false -or
            $report.managedEntryInvoked -ne $false -or $report.processTokenAssociationEstablished -ne $false -or
            $report.loadedModulesAttested -ne $false -or $report.persistedCngTested -ne $false -or
            $report.securityAccepted -ne $false -or $report.productionAccepted -ne $false -or
            $report.lic008Closed -ne $false) { throw 'NATIVE_CONTROL_V2_PURE_REPORT_REFUSED' }
        $reportHash = $tested.stdoutSha256
        for ($i = 0; $i -lt $closed.Count; $i++) {
            $refused = ControlRun $dotnet ($invoke + [string[]]$closed[$i]) $folder ('closed-' + $i) 30000
            if ($refused.exitCode -ne 2 -or $refused.stdout.Length -ne 0 -or
                -not (ControlExactLine $refused.stderr $closedError)) {
                throw ('NATIVE_CONTROL_V2_CLOSED_ENTRY_FAILED_' + $variant + '_' + $i)
            }
            $refusals.Add([ordered]@{arguments=$closed[$i];exitCode=2;
                stdoutSha256=$refused.stdoutSha256;stderrSha256=$refused.stderrSha256})
        }
    }
    $variants.Add([ordered]@{name=$variant;dllPath=$dll;dllSha256=(ControlHash $dll);
        dllLength=$dllInfo.Length;runtimeconfigSha256=(ControlHash $runtimeConfig);
        compileRspSha256=(ControlHash $rsp);compileStdoutSha256=$compiled.stdoutSha256;
        compileStderrSha256=$compiled.stderrSha256;pureTestReportSha256=$reportHash;
        pureTest=$report;closedEntryResults=$refusals.ToArray();
        selfTestsExecuted=[bool]$RunReviewedSelfTests;nativeBindingInvoked=$false})
}
foreach ($input in $inputs) {
    if ((ControlHash (Join-Path $repo $input.relative)) -cne $input.sha256 -or
        (ControlHash (Join-Path $snapshot ([IO.Path]::GetFileName($input.relative)))) -cne $input.sha256) {
        throw 'NATIVE_CONTROL_V2_SOURCE_CHANGED'
    }
}
if ((ControlHash (Join-Path $snapshot 'NativeHostControlV2PureProgram.cs')) -cne $entrySha256) {
    throw 'NATIVE_CONTROL_V2_GENERATED_ENTRY_CHANGED'
}
foreach ($set in @($toolInputs,$referenceInputs,$compilerInputs,$runtimeInputs)) {
    foreach ($item in $set) {
        if ((ControlHash $item.path) -cne $item.sha256 -or
            ([IO.FileInfo]$item.path).Length -ne $item.length) {
            throw 'NATIVE_CONTROL_V2_INSTALLED_INPUT_CHANGED'
        }
    }
}
ControlJson (Join-Path $destination 'manifest.json') ([ordered]@{
    schema='TEST_ONLY_STANDARD_NATIVE_CONTROL_V2_COMPONENT_BUILD_V1';
    builtUtc=[DateTimeOffset]::UtcNow.ToString('O');sourceBaselineCommitDeclared=$baseline;
    sourceSetSha256=$sourceSetHash;inputs=$inputs;generatedEntrySha256=$entrySha256;
    generatedEntryStoredOnlyInFreshSnapshot=$true;toolInputs=$toolInputs;
    referenceInputs=$referenceInputs;compilerInputs=$compilerInputs;runtimeInputs=$runtimeInputs;
    installedReferenceSetSha256=$fixedReferenceSetSha256;
    installedCompilerSetSha256=$fixedCompilerSetSha256;
    installedRuntimeSetSha256=$fixedRuntimeSetSha256;
    reviewedSourceSetSha256=$ReviewedSourceSetSha256;reviewedCaseCounts=[ordered]@{
        profile=$ExpectedProfileCases;inputCodec=$ExpectedInputCodecCases;stageStore=$ExpectedStageStoreCases};
    variants=$variants.ToArray();selfTestsExecuted=[bool]$RunReviewedSelfTests;
    nativeEffects=$false;accountChanged=$false;serviceChanged=$false;keyChanged=$false;
    managedEntryInvoked=$false;clrBootstrapAccepted=$false;
    processTokenAssociationEstablished=$false;loadedModulesAttested=$false;
    nativeCompatibilityAccepted=$false;persistedCngTested=$false;
    securityAccepted=$false;productionAccepted=$false;lic008Closed=$false;
    byteReproducibilityEstablished=$false
})
[ordered]@{schema='TEST_ONLY_STANDARD_NATIVE_CONTROL_V2_BUILD_LOCATION_V1';
    directory=$destination;sourceSetSha256=$sourceSetHash;
    manifestSha256=(ControlHash (Join-Path $destination 'manifest.json'));
    variants=$variants.Count;selfTestsExecuted=[bool]$RunReviewedSelfTests;
    nativeEffects=$false;securityAccepted=$false;productionAccepted=$false;
    lic008Closed=$false} | ConvertTo-Json -Compress
