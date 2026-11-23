[CmdletBinding()]
param(
    [string]$AttemptDirectory = '',
    [string]$ReviewedManifestSha256 = '',
    [string]$ReviewedSourceSha256 = ''
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Exact, one-use launch of the separately prepared ignored-out diagnostic.
# This script never builds, retries, deletes, changes an account or touches W03.
function ProbePlain([string]$Path) {
    for ($cursor = [IO.Path]::GetFullPath($Path); $cursor; $cursor = [IO.Path]::GetDirectoryName($cursor)) {
        if (([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'OWNER_GROUP_PROBE_V1_REPARSE_REFUSED'
        }
    }
}
function ProbeHash([string]$Path) {
    (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}
function ProbeBytesHash([byte[]]$Bytes) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant() }
    finally { $sha.Dispose() }
}
function ProbeNew([string]$Path,[byte[]]$Bytes) {
    ProbePlain ([IO.Path]::GetDirectoryName($Path))
    $stream = [IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    try { $stream.Write($Bytes,0,$Bytes.Length); $stream.Flush($true) }
    finally { $stream.Dispose() }
}
function ProbeValidateTerminal([string]$Directory,[string]$SourceSha256) {
    $ownerSid = 'S-1-5-21-3058020570-171625005-1532683838-1001'
    $expectedSddl = 'O:' + $ownerSid + 'G:' + $ownerSid +
        'D:P(A;;FA;;;SY)(A;;FA;;;' + $ownerSid + ')'
    $expectedContentSha = ProbeBytesHash ([Text.Encoding]::ASCII.GetBytes("LIC008_OWNER_GROUP_PROBE_V1`n"))
    $probeIntentPath = Join-Path $Directory 'probe-intent.json'
    $probeResultPath = Join-Path $Directory 'probe-result.json'
    ProbePlain $probeIntentPath
    ProbePlain $probeResultPath
    $probeIntent = Get-Content -LiteralPath $probeIntentPath -Raw | ConvertFrom-Json
    $probeReport = Get-Content -LiteralPath $probeResultPath -Raw | ConvertFrom-Json
    if ($probeIntent.schema -cne 'TEST_ONLY_LIC008_OWNER_GROUP_FEASIBILITY_V1' -or
        $probeIntent.status -cne 'CONSUMED_BEFORE_NATIVE_CALL' -or
        $probeIntent.sourceSha256 -cne $SourceSha256 -or
        $probeIntent.attemptDirectory -cne $Directory -or
        $probeIntent.exactChild -cne 'owner-group-exact.bin' -or
        $probeIntent.fixedContentSha256 -cne $expectedContentSha -or
        $probeIntent.requestedSddl -cne $expectedSddl -or
        $probeIntent.noRetry -ne $true -or $probeIntent.noDelete -ne $true -or
        $probeIntent.w03Admission -ne $false) {
        throw 'OWNER_GROUP_PROBE_V1_PROBE_INTENT_UNRESOLVED'
    }
    if ($probeReport.Schema -cne 'TEST_ONLY_LIC008_OWNER_GROUP_FEASIBILITY_V1' -or
        $probeReport.Status -cne 'FEASIBILITY_OBSERVED' -or
        $probeReport.SourceSha256 -cne $SourceSha256 -or
        $probeReport.AttemptDirectory -cne $Directory -or
        $probeReport.ProbeFile -cne (Join-Path $Directory 'owner-group-exact.bin') -or
        $probeReport.TokenUserSid -cne $ownerSid -or
        $probeReport.TokenOwnerSid -cnotmatch '^S-1-[0-9-]+$' -or
        $probeReport.TokenPrimaryGroupSid -cnotmatch '^S-1-[0-9-]+$' -or
        $probeReport.RequestedSddl -cne $expectedSddl -or
        $probeReport.RequestedDescriptorSha256 -cnotmatch '^[0-9a-f]{64}$' -or
        $probeReport.NtStatus -cne '0x00000000' -or
        $probeReport.IoInformation -ne 2 -or
        $probeReport.ParentFileId128 -cnotmatch '^[0-9a-f]{32}$' -or
        $probeReport.ChildFileId128 -cnotmatch '^[0-9a-f]{32}$' -or
        $probeReport.ParentFileId128 -ceq $probeReport.ChildFileId128 -or
        $probeReport.VolumeSerial64 -cnotmatch '^[0-9a-f]{16}$' -or
        $probeReport.ObservedOwnerSid -cne $ownerSid -or
        $probeReport.ObservedGroupSid -cne $ownerSid -or
        $probeReport.ContentSha256 -cne $expectedContentSha -or
        $null -ne $probeReport.ErrorCode -or
        $probeReport.AccountChanged -ne $false -or
        $probeReport.ServiceChanged -ne $false -or
        $probeReport.KeyChanged -ne $false -or
        $probeReport.W03Admitted -ne $false -or
        $probeReport.Lic008Closed -ne $false) {
        throw 'OWNER_GROUP_PROBE_V1_PROBE_REPORT_UNRESOLVED'
    }
    $descriptor = [Convert]::FromBase64String([string]$probeReport.ObservedDescriptorBase64)
    if ($descriptor.Length -lt 20 -or $descriptor.Length -gt 65536 -or
        (ProbeBytesHash $descriptor) -cne $probeReport.ObservedDescriptorSha256) {
        throw 'OWNER_GROUP_PROBE_V1_OBSERVED_DESCRIPTOR_UNRESOLVED'
    }
}

if ($PSHOME -cne 'C:\Windows\System32\WindowsPowerShell\v1.0' -or [IntPtr]::Size -ne 8) {
    throw 'OWNER_GROUP_PROBE_V1_POWERSHELL_PROFILE_REFUSED'
}
if ($ReviewedManifestSha256 -cnotmatch '^[0-9a-f]{64}$' -or
    $ReviewedSourceSha256 -cnotmatch '^[0-9a-f]{64}$') {
    throw 'OWNER_GROUP_PROBE_V1_REVIEWED_DIGESTS_REQUIRED'
}
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ($repo -cne 'E:\EntryControlSystem') {
    throw 'OWNER_GROUP_PROBE_V1_FIXED_WORKSPACE_REFUSED'
}
$outRoot = Join-Path $repo 'out'
$attempt = [IO.Path]::GetFullPath($AttemptDirectory.TrimEnd([IO.Path]::DirectorySeparatorChar))
if ($attempt -cnotmatch '^E:\\EntryControlSystem\\out\\lic008-owner-group-probe-v1-[0-9a-f]{32}$' -or
    [IO.Path]::GetDirectoryName($attempt) -cne $outRoot) {
    throw 'OWNER_GROUP_PROBE_V1_ATTEMPT_LOCATION_REFUSED'
}
ProbePlain $attempt
$source = Join-Path $repo 'licensing\adapter-evidence\standard-native-control\NativeHostOwnerGroupProbeV1.cs'
$prepareScript = Join-Path $repo 'scripts\prepare-license-native-owner-group-probe-v1.ps1'
$snapshot = Join-Path $attempt 'NativeHostOwnerGroupProbeV1.cs'
$project = Join-Path $attempt 'OwnerGroupProbeV1.csproj'
$globalJson = Join-Path $attempt 'global.json'
$nugetConfig = Join-Path $attempt 'NuGet.Config'
$dll = Join-Path $attempt 'bin\Release\net10.0\OwnerGroupProbeV1.dll'
$runtimeconfig = Join-Path $attempt 'bin\Release\net10.0\OwnerGroupProbeV1.runtimeconfig.json'
$deps = Join-Path $attempt 'bin\Release\net10.0\OwnerGroupProbeV1.deps.json'
$dotnet = 'C:\Program Files\dotnet\dotnet.exe'
$manifestPath = Join-Path $attempt 'prepare-manifest.json'
$compileIntentPath = Join-Path $attempt 'compile.intent.json'
$compileStartedPath = Join-Path $attempt 'compile.started.json'
$compileResultPath = Join-Path $attempt 'compile.result.json'
foreach ($path in @($source,$prepareScript,$snapshot,$project,$globalJson,
    $nugetConfig,$dll,$runtimeconfig,
    $deps,$dotnet,$manifestPath,$compileIntentPath,$compileStartedPath,
    $compileResultPath)) { ProbePlain $path }
if ((ProbeHash $manifestPath) -cne $ReviewedManifestSha256) {
    throw 'OWNER_GROUP_PROBE_V1_MANIFEST_HASH_REFUSED'
}
$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
if ($manifest.schema -cne 'TEST_ONLY_LIC008_OWNER_GROUP_PROBE_PREPARATION_V1' -or
    $manifest.outputDirectory -cne $attempt -or
    $manifest.sourceSha256 -cne $ReviewedSourceSha256 -or
    $manifest.buildDeadlineMilliseconds -ne 300000 -or
    $manifest.probeWaitDeadlineMilliseconds -ne 120000 -or
    $manifest.probeExecuted -ne $false -or
    $manifest.accountChanged -ne $false -or
    $manifest.serviceChanged -ne $false -or
    $manifest.keyChanged -ne $false -or
    $manifest.w03Admitted -ne $false -or
    $manifest.lic008Closed -ne $false) {
    throw 'OWNER_GROUP_PROBE_V1_MANIFEST_SCOPE_REFUSED'
}
$bindings = @(
    @($source,'sourceSha256'),
    @($prepareScript,'preparationScriptSha256'),
    @($snapshot,'snapshotSha256'),
    @($project,'projectSha256'),
    @($globalJson,'globalJsonSha256'),
    @($nugetConfig,'nugetConfigSha256'),
    @($dll,'executableSha256'),
    @($runtimeconfig,'runtimeconfigSha256'),
    @($deps,'depsSha256'),
    @($dotnet,'dotnetSha256'),
    @($compileIntentPath,'compileIntentSha256'),
    @($compileStartedPath,'compileStartedSha256'),
    @($compileResultPath,'compileResultSha256')
)
foreach ($binding in $bindings) {
    $expected = [string]$manifest.($binding[1])
    if ($expected -cnotmatch '^[0-9a-f]{64}$' -or
        (ProbeHash ([string]$binding[0])) -cne $expected) {
        throw 'OWNER_GROUP_PROBE_V1_ARTIFACT_HASH_REFUSED'
    }
}
$expectedCommand = @($dotnet,'exec','--fx-version','10.0.11',$dll,
    '--probe','--reviewed-source-sha256',$ReviewedSourceSha256)
if ($manifest.probeCommand.Count -ne $expectedCommand.Count) {
    throw 'OWNER_GROUP_PROBE_V1_COMMAND_REFUSED'
}
for ($i = 0; $i -lt $expectedCommand.Count; $i++) {
    if ([string]$manifest.probeCommand[$i] -cne $expectedCommand[$i]) {
        throw 'OWNER_GROUP_PROBE_V1_COMMAND_REFUSED'
    }
}
$compileResult = Get-Content -LiteralPath $compileResultPath -Raw | ConvertFrom-Json
if ($compileResult.exitCode -ne 0 -or
    (Test-Path -LiteralPath (Join-Path $attempt 'compile.pending.json')) -or
    (Test-Path -LiteralPath (Join-Path $attempt 'probe-intent.json')) -or
    (Test-Path -LiteralPath (Join-Path $attempt 'probe-result.json')) -or
    (Test-Path -LiteralPath (Join-Path $attempt 'owner-group-exact.bin'))) {
    throw 'OWNER_GROUP_PROBE_V1_ALREADY_CONSUMED_OR_UNRESOLVED'
}

$invokeTemp = Join-Path $attempt 'invoke-temp'
if (Test-Path -LiteralPath $invokeTemp) {
    throw 'OWNER_GROUP_PROBE_V1_INVOKE_TEMP_NOT_FRESH'
}
$null = New-Item -ItemType Directory -Path $invokeTemp -ErrorAction Stop
ProbePlain $invokeTemp
$childEnvironment = [ordered]@{
    SystemRoot='C:\Windows';windir='C:\Windows';TEMP=$invokeTemp;TMP=$invokeTemp
}
$utf8 = New-Object Text.UTF8Encoding($false,$true)
$intent = [ordered]@{
    schema='TEST_ONLY_LIC008_OWNER_GROUP_PROBE_LAUNCH_V1'
    utc=[DateTimeOffset]::UtcNow.ToString('O')
    status='ONE_USE_CONSUMED_BEFORE_PROCESS_START'
    attemptDirectory=$attempt
    manifestSha256=$ReviewedManifestSha256
    sourceSha256=$ReviewedSourceSha256
    command=$expectedCommand
    childEnvironment=$childEnvironment
    waitDeadlineMilliseconds=120000
    noRetry=$true;noDelete=$true;w03Admitted=$false;lic008Closed=$false
}
ProbeNew (Join-Path $attempt 'invoke.intent.json') ($utf8.GetBytes(($intent | ConvertTo-Json -Depth 5 -Compress)))
$start = New-Object Diagnostics.ProcessStartInfo
$start.FileName = $dotnet
$start.Arguments = 'exec --fx-version 10.0.11 "' + $dll + '" --probe --reviewed-source-sha256 ' + $ReviewedSourceSha256
$start.WorkingDirectory = $attempt
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.EnvironmentVariables.Clear()
foreach ($entry in $childEnvironment.GetEnumerator()) {
    $start.EnvironmentVariables[$entry.Key] = [string]$entry.Value
}
$process = New-Object Diagnostics.Process
$process.StartInfo = $start
if (-not $process.Start()) { throw 'OWNER_GROUP_PROBE_V1_PROCESS_START_FAILED_NO_RETRY' }
$launchJournalError = $null
try {
    ProbeNew (Join-Path $attempt 'invoke.started.json') ($utf8.GetBytes((([ordered]@{
        pid=$process.Id;startedUtc=[DateTimeOffset]::UtcNow.ToString('O')
    }) | ConvertTo-Json -Compress)))
} catch { $launchJournalError = $_.Exception.GetType().Name }
$waitError = $null
$completed = $false
try { $completed = $process.WaitForExit(120000) }
catch { $waitError = $_.Exception.GetType().Name }
if (-not $completed) {
    try {
        ProbeNew (Join-Path $attempt 'invoke.pending.json') ($utf8.GetBytes((([ordered]@{
            pid=$process.Id;status='UNRESOLVED_NO_KILL_NO_RETRY'
            startedJournalError=$launchJournalError;waitError=$waitError
        }) | ConvertTo-Json -Compress)))
    } catch { }
    throw ('OWNER_GROUP_PROBE_V1_PROCESS_PENDING_PID_' + $process.Id)
}
$terminalError = $null
if ($process.ExitCode -eq 0) {
    try { ProbeValidateTerminal $attempt $ReviewedSourceSha256 }
    catch { $terminalError = $_.Exception.GetType().Name + ':' + $_.Exception.Message }
} else { $terminalError = 'PROCESS_NONZERO_EXIT' }
$terminalStatus = if ($process.ExitCode -eq 0 -and
    $null -eq $launchJournalError -and $null -eq $terminalError) {
    'FEASIBILITY_OBSERVED'
} else { 'UNRESOLVED_NO_RETRY' }
$result = [ordered]@{
    pid=$process.Id
    exitCode=$process.ExitCode
    endedUtc=[DateTimeOffset]::UtcNow.ToString('O')
    status=$terminalStatus
    startedJournalError=$launchJournalError
    terminalValidationError=$terminalError
    probeIntentSha256=$null
    probeResultSha256=$null
    noRetry=$true;noDelete=$true;w03Admitted=$false;lic008Closed=$false
}
foreach ($item in @(@('probe-intent.json','probeIntentSha256'),
    @('probe-result.json','probeResultSha256'))) {
    $path = Join-Path $attempt $item[0]
    if (Test-Path -LiteralPath $path) {
        ProbePlain $path
        $result[$item[1]] = ProbeHash $path
    }
}
ProbeNew (Join-Path $attempt 'invoke.result.json') ($utf8.GetBytes(($result | ConvertTo-Json -Compress)))
$process.Dispose()
$result | ConvertTo-Json -Compress
if ($terminalStatus -cne 'FEASIBILITY_OBSERVED' -or
    $null -eq $result.probeIntentSha256 -or
    $null -eq $result.probeResultSha256) {
    throw 'OWNER_GROUP_PROBE_V1_RESULT_UNRESOLVED_NO_RETRY'
}
