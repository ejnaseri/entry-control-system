[CmdletBinding()]param(
    [Parameter(Mandatory = $true)][string]$CandidateDirectory,
    [Parameter(Mandatory = $true)][string]$ExpectedBuildManifestSha256,
    [Parameter(Mandatory = $true)][string]$ExpectedPackageSha256,
    [Parameter(Mandatory = $true)][string]$ExpectedOwnerSid
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Builds a separate input-preparation helper and wrapper. Tests include a bounded
# read-only check of this process's own Windows token, not elevated preflight.
# Never invokes a valid check/prepare/controller command, issues an approval,
# or changes service/key/ACL state.
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputParent = Join-Path $repo 'out'
$dotnet = 'C:\Program Files\dotnet\dotnet.exe'
$powerShell = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
$compiler = 'C:\Program Files\dotnet\sdk\10.0.400\Roslyn\bincore\csc.dll'
$refs = 'C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Ref\10.0.11\ref\net10.0'
$hostModel = 'C:\Program Files\dotnet\sdk\10.0.400\Microsoft.NET.HostModel.dll'
$template = 'C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Host.win-x64\10.0.11\runtimes\win-x64\native\apphost.exe'
$runtimeGroups = @(
    [ordered]@{ name = 'runtime'; path = 'C:\Program Files\dotnet\shared\Microsoft.NETCore.App\10.0.11' },
    [ordered]@{ name = 'fxr'; path = 'C:\Program Files\dotnet\host\fxr\10.0.11' }
)
function Hash([string]$path) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() }
function BytesHash([byte[]]$bytes) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
}
function JsonHash($value) { BytesHash ([Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Depth 20 -Compress))) }
function RequirePlain([string]$path) {
    if ($path -cnotmatch '^[A-Z]:\\' -or $path -match '["\r\n]' -or $path.Substring(2).Contains(':') -or
        [IO.Path]::GetFullPath($path) -cne $path) { throw 'LOCAL_CANONICAL_PATH_REQUIRED' }
    for ($cursor = $path; $cursor; $cursor = [IO.Path]::GetDirectoryName($cursor)) {
        if (([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'REPARSE_PATH_REFUSED' }
    }
}
function RequireFile([string]$path, [string]$expected) {
    RequirePlain $path
    $item = Get-Item -LiteralPath $path -Force
    if ($item.PSIsContainer -or $item.Length -le 0 -or $expected -cnotmatch '^[a-f0-9]{64}$' -or
        (Hash $path) -cne $expected) { throw 'PINNED_FILE_CHANGED' }
}
function WriteNew([string]$path, [byte[]]$bytes) {
    $stream = [IO.File]::Open($path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
}
function JsonNew([string]$path, $value) {
    WriteNew $path ([Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Depth 20 -Compress)))
}
function RunKitTest([string]$arguments, [string]$executable = $dotnet) {
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $executable
    $start.Arguments = $arguments
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    foreach ($name in @($start.EnvironmentVariables.Keys)) {
        if ($name -match '^(DOTNET_|COMPLUS_|CORECLR_|COR_|COREHOST_)' -or
            $name -in @('APPDOMAIN_MANAGER_ASM','APPDOMAIN_MANAGER_TYPE','DEVPATH','__COMPAT_LAYER')) {
            $start.EnvironmentVariables.Remove($name)
        }
    }
    $process = [Diagnostics.Process]::Start($start)
    try {
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(30000)) { throw 'SYNTHETIC_CHILD_TIMEOUT_REVIEW_REQUIRED' }
        [pscustomobject]@{ ExitCode = $process.ExitCode; Stdout = $stdout.Result; Stderr = $stderr.Result }
    } finally { $process.Dispose() }
}
function ReadOwnerKitTestJson([string]$json, [string[]]$names) {
    if ([string]::IsNullOrWhiteSpace($json) -or $json.Length -gt 16384) { throw 'OWNER_KIT_TEST_JSON_REFUSED' }
    $report = $json | ConvertFrom-Json
    # These reports come from our pinned helper. Require its canonical, closed
    # wire format so duplicate fields, extra data and coerced values cannot pass.
    if ($null -eq $report -or ($report.PSObject.Properties.Name -join '|') -cne ($names -join '|') -or
        ($report | ConvertTo-Json -Depth 4 -Compress) -cne $json.Trim()) { throw 'OWNER_KIT_TEST_JSON_REFUSED' }
    return $report
}
function AssertOwnerHelperArgumentRefusal($result) {
    if ($result.ExitCode -isnot [int] -or $result.ExitCode -ne 1 -or
        $result.Stdout -isnot [string] -or $result.Stdout.Length -ne 0 -or
        $result.Stderr -isnot [string]) { throw 'OWNER_HELPER_CLI_REFUSAL_FAILED' }
    $report = ReadOwnerKitTestJson $result.Stderr @('schemaVersion', 'scope', 'stage', 'code', 'category', 'hResult')
    foreach ($name in @('scope', 'stage', 'code', 'category')) {
        if ($report.$name -isnot [string]) { throw 'OWNER_HELPER_CLI_REFUSAL_FAILED' }
    }
    if ($report.schemaVersion -isnot [int] -or $report.schemaVersion -ne 1 -or
        $report.scope -cne 'TEST_ONLY_EXPORT_POLICY_OWNER_FAILURE_V1' -or $report.stage -cne 'arguments' -or
        $report.code -cne 'INPUT_STAGE_FAILED_OR_REFUSED' -or $report.category -cne 'INVALID_DATA' -or
        $report.hResult -isnot [int] -or $report.hResult -eq 0) { throw 'OWNER_HELPER_CLI_REFUSAL_FAILED' }
}
function AssertOwnerTokenTestReport($result) {
    if ($result.ExitCode -isnot [int] -or $result.ExitCode -ne 0 -or
        $result.Stdout -isnot [string] -or $result.Stderr -isnot [string] -or
        $result.Stderr.Length -ne 0) { throw 'OWNER_TOKEN_TEST_FAILED' }
    $report = ReadOwnerKitTestJson $result.Stdout @('schemaVersion', 'scope', 'cases', 'runtime',
        'queryOnlyDuplicateAccessDenied', 'queryOnlyMembershipSecurityException', 'queryOnlyHResult',
        'correctedMembershipSucceeded', 'isAdministrator', 'elevation', 'primaryToken', 'impersonationAbsent',
        'ownerInputIssued', 'physicalStageExecuted', 'securityAccepted', 'productionAccepted')
    if ($report.schemaVersion -isnot [int] -or $report.schemaVersion -ne 1 -or
        $report.scope -isnot [string] -or $report.scope -cne 'TEST_ONLY_EXPORT_POLICY_OWNER_TOKEN_TEST_V1' -or
        $report.cases -isnot [int] -or $report.cases -ne 9 -or
        $report.runtime -isnot [string] -or $report.runtime -cne '10.0.11' -or
        $report.queryOnlyHResult -isnot [int] -or $report.queryOnlyHResult -eq 0 -or
        $report.isAdministrator -isnot [bool] -or $report.elevation -isnot [int] -or
        $report.elevation -notin @(0, 1)) { throw 'OWNER_TOKEN_TEST_REPORT_REFUSED' }
    foreach ($name in @('queryOnlyDuplicateAccessDenied', 'queryOnlyMembershipSecurityException',
        'correctedMembershipSucceeded', 'primaryToken', 'impersonationAbsent')) {
        if ($report.$name -isnot [bool] -or $report.$name -ne $true) { throw 'OWNER_TOKEN_TEST_REPORT_REFUSED' }
    }
    foreach ($name in @('ownerInputIssued', 'physicalStageExecuted', 'securityAccepted', 'productionAccepted')) {
        if ($report.$name -isnot [bool] -or $report.$name -ne $false) { throw 'OWNER_TOKEN_TEST_REPORT_REFUSED' }
    }
    # Membership/elevation are observations, not a request to elevate. An
    # ordinary-token regression pass never establishes elevated owner preflight.
    return $report
}
if ($ExpectedBuildManifestSha256 -cnotmatch '^[a-f0-9]{64}$' -or
    $ExpectedPackageSha256 -cnotmatch '^[a-f0-9]{64}$' -or
    $ExpectedOwnerSid -cnotmatch '^S-1-5-21-(0|[1-9][0-9]{0,9})-(0|[1-9][0-9]{0,9})-(0|[1-9][0-9]{0,9})-(0|[1-9][0-9]{0,9})$') {
    throw 'OWNER_KIT_INPUT_REFUSED'
}
foreach ($part in $ExpectedOwnerSid.Split('-')[4..7]) {
    if ([uint64]$part -gt [uint32]::MaxValue) { throw 'OWNER_SID_RANGE_REFUSED' }
}
RequirePlain $CandidateDirectory
RequirePlain $outputParent
if ([IO.Path]::GetDirectoryName($CandidateDirectory) -cne $outputParent -or
    [IO.Path]::GetFileName($CandidateDirectory) -cnotmatch '^lic008-export-policy-v5-capable-[a-f0-9]{32}$') {
    throw 'CANDIDATE_LOCATION_REFUSED'
}
$manifestPath = Join-Path $CandidateDirectory 'manifest.json'
RequireFile $manifestPath $ExpectedBuildManifestSha256
$candidate = [IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json
if ($candidate.scope -cne 'TEST_ONLY_EXPORT_POLICY_CONTROL_CAPABLE_BUILD_V5' -or
    $candidate.physicalExecutionEnabled -ne $true -or $candidate.physicalTested -ne $false -or
    $candidate.securityAccepted -ne $false -or $candidate.productionAccepted -ne $false -or
    $candidate.runtimeInventoryVerified -ne $true -or
    $candidate.reviewedInertManifestSha256 -cnotmatch '^[a-f0-9]{64}$' -or
    $candidate.packageManifestSha256 -cne $ExpectedPackageSha256) { throw 'CAPABLE_CANDIDATE_REFUSED' }
$programSources = @('Program.cs', 'MatchedExportProbe.cs', 'PureTests.cs', 'ControlContracts.cs',
    'ControlLifecycle.cs', 'ControlLifecycleTests.cs', 'NativeKeys.cs', 'NativeKeysTests.cs',
    'ProtectedControlStore.cs', 'ControlStoreTests.cs', 'NativeControlIdentity.cs',
    'NativeControlService.cs', 'NativeControlAdmission.cs', 'NativeControlRuntime.cs',
    'NativeControlAdmissionTests.cs', 'ControlController.cs', 'ControlControllerTests.cs',
    'ControlOwnerEntry.cs', 'ControlWindowsDeployment.cs', 'ControlCapability.cs',
    'ControlStartupDiagnostics.cs', 'ControlStartupDiagnosticsTests.cs', 'ControlPlacementTests.cs',
    'ControlRunDiagnostics.cs') | ForEach-Object {
    'licensing/adapter-evidence/export-policy-control/' + $_
}
$candidateSources = @($programSources) + @('scripts/build-license-export-policy-control.ps1',
    'licensing/adapter-evidence/export-policy-control/ControlHostBuilder.cs')
if ($candidate.inputs.Count -ne $candidateSources.Count) { throw 'CANDIDATE_SOURCE_SET_REFUSED' }
$sourceInputs = @(for ($i = 0; $i -lt $candidateSources.Count; $i++) {
    $row = $candidate.inputs[$i]
    if ($row.relative -cne $candidateSources[$i]) { throw 'CANDIDATE_SOURCE_NAME_REFUSED' }
    RequireFile (Join-Path $repo $row.relative) $row.sha256
    RequireFile (Join-Path (Join-Path $CandidateDirectory 'snapshot') ([IO.Path]::GetFileName($row.relative))) $row.sha256
    [ordered]@{ relative = $row.relative; sha256 = $row.sha256 }
})
if ((JsonHash $sourceInputs) -cne $candidate.sourceSetSha256) { throw 'CANDIDATE_SOURCE_SET_PIN_REFUSED' }
$hostSourceInput = @($sourceInputs | Where-Object relative -CEQ 'licensing/adapter-evidence/export-policy-control/ControlHostBuilder.cs')
if ($hostSourceInput.Count -ne 1) { throw 'CANDIDATE_HOST_SOURCE_REFUSED' }
$toolPaths = @($dotnet, $compiler, $hostModel, $template)
if ($candidate.toolInputs.Count -ne $toolPaths.Count) { throw 'CANDIDATE_TOOL_SET_REFUSED' }
for ($i = 0; $i -lt $toolPaths.Count; $i++) {
    if ($candidate.toolInputs[$i].path -cne $toolPaths[$i]) { throw 'CANDIDATE_TOOL_PATH_REFUSED' }
    RequireFile $toolPaths[$i] $candidate.toolInputs[$i].sha256
}
if ($candidate.compilerSha256 -cne $candidate.toolInputs[1].sha256) { throw 'CANDIDATE_COMPILER_PIN_REFUSED' }
RequirePlain $refs
$referenceEntries = @(Get-ChildItem -LiteralPath $refs -Filter '*.dll' -Force | Sort-Object Name)
if ($referenceEntries.Count -eq 0 -or $candidate.referenceInputs.Count -ne $referenceEntries.Count) { throw 'REFERENCE_SET_REFUSED' }
$referenceInputs = @(for ($i = 0; $i -lt $referenceEntries.Count; $i++) {
    $row = $candidate.referenceInputs[$i]
    if ($row.path -cne $referenceEntries[$i].FullName) { throw 'REFERENCE_PATH_REFUSED' }
    RequireFile $row.path $row.sha256
    [ordered]@{ path = $row.path; sha256 = $row.sha256 }
})
if ((JsonHash $referenceInputs) -cne $candidate.referenceSetSha256) { throw 'REFERENCE_SET_PIN_REFUSED' }
if ($candidate.variants.Count -ne 3) { throw 'CANDIDATE_VARIANTS_REFUSED' }
for ($i = 0; $i -lt 3; $i++) {
    $variantName = @('default', 'defines-still-inert', 'capable')[$i]
    $variant = $candidate.variants[$i]
    $refusals = if ($i -eq 2) { 13 } else { 14 }
    if ($variant.variant -cne $variantName -or $variant.cases -ne 18480 -or
        $variant.entryRefusals -ne $refusals -or $variant.physicalExecutionEnabled -ne ($i -eq 2)) { throw 'CANDIDATE_VARIANT_FLAGS_REFUSED' }
    RequireFile (Join-Path (Join-Path $CandidateDirectory $variantName) 'ExportPolicyControl.dll') $variant.dllSha256
}
$packageManifestPath = Join-Path $CandidateDirectory 'package-manifest.json'
RequireFile $packageManifestPath $ExpectedPackageSha256
$packageManifest = [IO.File]::ReadAllText($packageManifestPath) | ConvertFrom-Json
$packageRoot = Join-Path $CandidateDirectory 'package'
RequirePlain $packageRoot
$packageNames = @('ExportPolicyControl.exe', 'ExportPolicyControl.dll', 'ExportPolicyControl.runtimeconfig.json', 'runtime-inventory.json')
if ($packageManifest.schemaVersion -ne 1 -or $packageManifest.scope -cne 'TEST_ONLY_EXPORT_POLICY_PACKAGE_V5' -or
    $packageManifest.files.Count -ne 4 -or @(Get-ChildItem -LiteralPath $packageRoot -Force).Count -ne 4) { throw 'CANDIDATE_PACKAGE_SET_REFUSED' }
for ($i = 0; $i -lt $packageNames.Count; $i++) {
    $row = $packageManifest.files[$i]
    if ($row.name -cne $packageNames[$i]) { throw 'CANDIDATE_PACKAGE_NAME_REFUSED' }
    $path = Join-Path $packageRoot $row.name
    RequireFile $path $row.sha256
    if ((Get-Item -LiteralPath $path).Length -ne $row.size -or $row.size -gt 33554432) { throw 'CANDIDATE_PACKAGE_SIZE_REFUSED' }
}
if ($packageManifest.files[1].sha256 -cne $candidate.variants[2].dllSha256 -or
    $packageManifest.files[3].sha256 -cne $candidate.runtimeInventorySha256) { throw 'CANDIDATE_PACKAGE_BINDING_REFUSED' }
$inventory = [IO.File]::ReadAllText((Join-Path $packageRoot 'runtime-inventory.json')) | ConvertFrom-Json
function VerifyRuntimeInventory {
    if ($inventory.schemaVersion -ne 1 -or $inventory.runtime -cne '10.0.11' -or
        $inventory.files.Count -lt 4 -or $inventory.files.Count -gt 512) { throw 'RUNTIME_INVENTORY_REFUSED' }
    foreach ($required in @('runtime/System.Private.CoreLib.dll', 'runtime/coreclr.dll', 'runtime/hostpolicy.dll', 'fxr/hostfxr.dll')) {
        if (@($inventory.files | Where-Object { ($_.group + '/' + $_.name) -ceq $required }).Count -ne 1) { throw 'RUNTIME_REQUIRED_FILE_REFUSED' }
    }
    if (@($inventory.files | Where-Object { $_.group -cnotin @('runtime', 'fxr') }).Count -ne 0) { throw 'RUNTIME_GROUP_REFUSED' }
    foreach ($group in $runtimeGroups) {
        RequirePlain $group.path
        $entries = @(Get-ChildItem -LiteralPath $group.path -Force | Sort-Object Name)
        $rows = @($inventory.files | Where-Object group -CEQ $group.name)
        if ($entries.Count -ne $rows.Count) { throw 'RUNTIME_FILE_SET_CHANGED' }
        for ($i = 0; $i -lt $entries.Count; $i++) {
            $row = $rows[$i]
            if ($row.name -cne $entries[$i].Name -or $row.size -ne $entries[$i].Length -or
                $row.size -le 0 -or $row.size -gt 134217728 -or
                (($group.name -cne 'runtime' -or $row.name -cne '.version') -and
                    $row.name -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$')) { throw 'RUNTIME_FILE_REFUSED' }
            RequireFile $entries[$i].FullName $row.sha256
        }
    }
}
VerifyRuntimeInventory
$packageBuildPath = Join-Path $CandidateDirectory 'package-build.json'
RequirePlain $packageBuildPath
$packageBuildHash = Hash $packageBuildPath
$packageBuild = [IO.File]::ReadAllText($packageBuildPath) | ConvertFrom-Json
if ($packageBuild.scope -cne 'TEST_ONLY_EXPORT_POLICY_CONTROL_CAPABLE_PACKAGE_BUILD_V5' -or
    $packageBuild.reviewedInertManifestSha256 -cne $candidate.reviewedInertManifestSha256 -or
    $packageBuild.sourceSetSha256 -cne $candidate.sourceSetSha256 -or
    $packageBuild.referenceSetSha256 -cne $candidate.referenceSetSha256 -or
    $packageBuild.manifestSha256 -cne $ExpectedPackageSha256 -or
    $packageBuild.compilerSha256 -cne $candidate.compilerSha256 -or
    $packageBuild.hostSourceSha256 -cne $hostSourceInput[0].sha256 -or
    $packageBuild.hostModelSha256 -cne $candidate.toolInputs[2].sha256 -or
    $packageBuild.apphostTemplateSha256 -cne $candidate.toolInputs[3].sha256 -or
    $packageBuild.exeSha256 -cne $packageManifest.files[0].sha256 -or
    $packageBuild.dllSha256 -cne $packageManifest.files[1].sha256 -or
    $packageBuild.runtimeConfigSha256 -cne $packageManifest.files[2].sha256 -or
    $packageBuild.runtimeInventorySha256 -cne $candidate.runtimeInventorySha256 -or
    $packageBuild.runtimeFiles -ne $inventory.files.Count -or
    $packageBuild.canonicalPackageVerified -ne $true -or $packageBuild.canonicalRuntimeInventoryVerified -ne $true -or
    $packageBuild.runtimeInventoryVerified -ne $true -or $packageBuild.pureCases -ne 18480 -or $packageBuild.apphostRefusals -ne 13 -or
    $packageBuild.physicalExecutionEnabled -ne $true -or $packageBuild.physicalTested -ne $false -or
    $packageBuild.securityAccepted -ne $false -or $packageBuild.productionAccepted -ne $false) { throw 'CANDIDATE_PACKAGE_BUILD_REFUSED' }
$helperSources = @('licensing/adapter-evidence/export-policy-control/ControlInputTool.cs',
    'licensing/adapter-evidence/export-policy-control/ControlInputToolTests.cs',
    'scripts/build-license-export-policy-owner-kit.ps1', 'scripts/run-license-export-policy-owner.ps1',
    'scripts/test-license-export-policy-owner.ps1', 'scripts/test-license-export-policy-owner-kit.ps1')
$helperInputs = @(foreach ($relative in $helperSources) {
    $path = Join-Path $repo $relative
    RequirePlain $path
    [ordered]@{ relative = $relative; sha256 = (Hash $path) }
})
RequirePlain $powerShell
$powerShellSha256 = Hash $powerShell
# Everything above is read-only. No output, owner approval, or expiry exists yet.
$destination = Join-Path $outputParent ('lic008-export-policy-v5-owner-kit-' + [guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $destination
$snapshot = Join-Path $destination 'snapshot'
$helperRoot = Join-Path $destination 'helper'
$null = New-Item -ItemType Directory -Path $snapshot
$null = New-Item -ItemType Directory -Path $helperRoot
foreach ($row in $sourceInputs) {
    $source = Join-Path (Join-Path $CandidateDirectory 'snapshot') ([IO.Path]::GetFileName($row.relative))
    $target = Join-Path $snapshot ([IO.Path]::GetFileName($row.relative))
    WriteNew $target ([IO.File]::ReadAllBytes($source))
    RequireFile $target $row.sha256
}
foreach ($row in $helperInputs) {
    $target = Join-Path $snapshot ([IO.Path]::GetFileName($row.relative))
    WriteNew $target ([IO.File]::ReadAllBytes((Join-Path $repo $row.relative)))
    RequireFile $target $row.sha256
}
$dll = Join-Path $helperRoot 'ControlInputTool.dll'
$compileArgs = @('-nologo', '-target:exe', '-platform:x64', '-nullable:enable', '-warnaserror+',
    '-main:EntryControl.TestOnly.ExportPolicyControl.ControlInputTool', ('-out:"' + $dll + '"'))
$compileArgs += @($referenceInputs | ForEach-Object { '-r:"' + $_.path + '"' })
$compileArgs += @(@($programSources) + @($helperSources[0..1]) | ForEach-Object { '"' + (Join-Path $snapshot ([IO.Path]::GetFileName($_))) + '"' })
$response = Join-Path $destination 'compile.rsp'
WriteNew $response ([Text.Encoding]::UTF8.GetBytes(($compileArgs -join [Environment]::NewLine)))
$compiled = RunKitTest ('exec --fx-version 10.0.11 "' + $compiler + '" -noconfig "@' + $response + '"')
if ($compiled.ExitCode -ne 0 -or $compiled.Stderr.Length -ne 0) { throw ('OWNER_HELPER_COMPILE_FAILED: ' + $compiled.Stdout + $compiled.Stderr) }
JsonNew (Join-Path $helperRoot 'ControlInputTool.runtimeconfig.json') ([ordered]@{
    runtimeOptions = [ordered]@{ tfm = 'net10.0'; framework = [ordered]@{ name = 'Microsoft.NETCore.App'; version = '10.0.11' }; rollForward = 'Disable' }
})
$tested = RunKitTest ('exec --fx-version 10.0.11 "' + $dll + '" --self-test')
if ($tested.ExitCode -ne 0 -or $tested.Stderr.Length -ne 0) { throw ('OWNER_HELPER_PURE_TEST_FAILED: ' + $tested.Stdout + $tested.Stderr) }
$testReport = $tested.Stdout | ConvertFrom-Json
# Pin the reviewed helper's pure-test count; never run a well-formed read-only
# check or preparation command from this build script.
if ($testReport.scope -cne 'TEST_ONLY_EXPORT_POLICY_INPUT_TOOL_PURE_V1' -or $testReport.cases -ne 539 -or
    $testReport.physicalExecutionEnabled -ne $false -or $testReport.physicalTested -ne $false -or
    $testReport.securityAccepted -ne $false -or $testReport.productionAccepted -ne $false) { throw 'OWNER_HELPER_REPORT_REFUSED' }
$malformedEntries = @('', '--SELF-TEST', '--self-test unexpected', '--check', '--prepare', '--control-controller', '--control-service', '--run')
foreach ($entry in $malformedEntries) {
    $refused = RunKitTest ('exec --fx-version 10.0.11 "' + $dll + '" ' + $entry)
    AssertOwnerHelperArgumentRefusal $refused
}
$tokenTested = RunKitTest ('exec --fx-version 10.0.11 "' + $dll + '" --token-self-test')
$tokenReport = AssertOwnerTokenTestReport $tokenTested
$wrapperTested = RunKitTest ('-NoProfile -ExecutionPolicy Bypass -File "' +
    (Join-Path $snapshot 'test-license-export-policy-owner.ps1') + '"') $powerShell
if ($wrapperTested.ExitCode -ne 0 -or $wrapperTested.Stderr.Length -ne 0) {
    throw ('OWNER_WRAPPER_PURE_TEST_FAILED: ' + $wrapperTested.Stdout + $wrapperTested.Stderr)
}
$wrapperReport = $wrapperTested.Stdout | ConvertFrom-Json
if ($wrapperReport.scope -cne 'TEST_ONLY_EXPORT_POLICY_OWNER_WRAPPER_TESTS_V1' -or $wrapperReport.cases -ne 318 -or
    $wrapperReport.helperExecuted -ne $false -or $wrapperReport.ownerInputIssued -ne $false -or
    $wrapperReport.physicalStageExecuted -ne $false -or $wrapperReport.securityAccepted -ne $false -or
    $wrapperReport.productionAccepted -ne $false) { throw 'OWNER_WRAPPER_TEST_REPORT_REFUSED' }
$validationTested = RunKitTest ('-NoProfile -ExecutionPolicy Bypass -File "' +
    (Join-Path $snapshot 'test-license-export-policy-owner-kit.ps1') + '"') $powerShell
if ($validationTested.ExitCode -ne 0 -or $validationTested.Stderr.Length -ne 0) { throw 'OWNER_KIT_VALIDATION_TEST_FAILED' }
$validationReport = $validationTested.Stdout | ConvertFrom-Json
if ($validationReport.scope -cne 'TEST_ONLY_EXPORT_POLICY_OWNER_KIT_VALIDATION_V1' -or
    $validationReport.cases -ne 295 -or $validationReport.nativeExecuted -ne $false -or
    $validationReport.ownerInputIssued -ne $false -or $validationReport.physicalStageExecuted -ne $false -or
    $validationReport.securityAccepted -ne $false -or $validationReport.productionAccepted -ne $false) {
    throw 'OWNER_KIT_VALIDATION_REPORT_REFUSED'
}
WriteNew (Join-Path $destination 'Run-Owner.ps1') ([IO.File]::ReadAllBytes((Join-Path $snapshot 'run-license-export-policy-owner.ps1')))
$kitFiles = @(foreach ($relative in @('Run-Owner.ps1', 'helper/ControlInputTool.dll', 'helper/ControlInputTool.runtimeconfig.json')) {
    $path = Join-Path $destination $relative
    [ordered]@{ relative = $relative; size = (Get-Item -LiteralPath $path).Length; sha256 = (Hash $path) }
})
VerifyRuntimeInventory
RequireFile $manifestPath $ExpectedBuildManifestSha256
RequireFile $packageManifestPath $ExpectedPackageSha256
RequireFile $packageBuildPath $packageBuildHash
foreach ($row in $packageManifest.files) { RequireFile (Join-Path $packageRoot $row.name) $row.sha256 }
foreach ($row in $sourceInputs) {
    RequireFile (Join-Path $repo $row.relative) $row.sha256
    RequireFile (Join-Path (Join-Path $CandidateDirectory 'snapshot') ([IO.Path]::GetFileName($row.relative))) $row.sha256
    RequireFile (Join-Path $snapshot ([IO.Path]::GetFileName($row.relative))) $row.sha256
}
foreach ($row in $helperInputs) {
    RequireFile (Join-Path $repo $row.relative) $row.sha256
    RequireFile (Join-Path $snapshot ([IO.Path]::GetFileName($row.relative))) $row.sha256
}
foreach ($row in @($candidate.toolInputs) + @($referenceInputs)) { RequireFile $row.path $row.sha256 }
RequireFile $powerShell $powerShellSha256
RequireFile (Join-Path $destination 'Run-Owner.ps1') $helperInputs[3].sha256
foreach ($row in $kitFiles) { RequireFile (Join-Path $destination $row.relative) $row.sha256 }
JsonNew (Join-Path $destination 'helper-pure-test-report.json') $testReport
JsonNew (Join-Path $destination 'wrapper-pure-test-report.json') $wrapperReport
JsonNew (Join-Path $destination 'owner-token-test-report.json') $tokenReport
JsonNew (Join-Path $destination 'kit-validation-test-report.json') $validationReport
JsonNew (Join-Path $destination 'kit-build.json') ([ordered]@{
    schemaVersion = 1; scope = 'TEST_ONLY_EXPORT_POLICY_OWNER_KIT_BUILD_V5'
    candidateManifestSha256 = $ExpectedBuildManifestSha256; candidatePackageBuildSha256 = $packageBuildHash
    candidateSourceInputs = $sourceInputs; candidateSourceSetSha256 = $candidate.sourceSetSha256
    helperSourceInputs = $helperInputs; helperSourceSetSha256 = (JsonHash $helperInputs)
    ownerToolInputs = @([ordered]@{ path = $powerShell; sha256 = $powerShellSha256 })
    toolInputs = $candidate.toolInputs; referenceInputs = $referenceInputs; referenceSetSha256 = $candidate.referenceSetSha256
    runtimeInventorySha256 = $candidate.runtimeInventorySha256; runtimeFiles = $inventory.files.Count
    helperPureCases = $testReport.cases; malformedEntryRefusals = $malformedEntries.Count
    helperTestReportSha256 = (Hash (Join-Path $destination 'helper-pure-test-report.json'))
    wrapperPureCases = $wrapperReport.cases; wrapperTestReportSha256 = (Hash (Join-Path $destination 'wrapper-pure-test-report.json'))
    ownerTokenCases = $tokenReport.cases; ownerTokenTestReportSha256 = (Hash (Join-Path $destination 'owner-token-test-report.json'))
    kitValidationCases = $validationReport.cases; kitValidationReportSha256 = (Hash (Join-Path $destination 'kit-validation-test-report.json'))
    elevatedOwnerPreflightPassed = $false
    helperPhysicalEnabled = $false; physicalStageExecuted = $false; approvalIssued = $false
    securityAccepted = $false; productionAccepted = $false
})
$kitManifestPath = Join-Path $destination 'kit.json'
JsonNew $kitManifestPath ([ordered]@{
    schemaVersion = 1; scope = 'TEST_ONLY_EXPORT_POLICY_OWNER_KIT_V5'
    candidateDirectory = $CandidateDirectory; candidateManifestSha256 = $ExpectedBuildManifestSha256
    packageSha256 = $ExpectedPackageSha256; expectedOwnerSid = $ExpectedOwnerSid; outputParent = $outputParent
    files = $kitFiles; dotnetPath = $dotnet; dotnetSha256 = $candidate.toolInputs[0].sha256
    helperSourceInputs = $helperInputs; helperPhysicalEnabled = $false; physicalStageExecuted = $false
    securityAccepted = $false; productionAccepted = $false
})
Write-Output ('Owner kit: ' + $destination)
Write-Output ('Kit manifest SHA256: ' + (Hash $kitManifestPath))
Write-Output ('Helper pure cases: ' + $testReport.cases + '; malformed entry refusals: ' + $malformedEntries.Count)
Write-Output ('Wrapper pure cases: ' + $wrapperReport.cases)
Write-Output ('Own-token regression cases: ' + $tokenReport.cases + '; elevated owner preflight: NOT_RUN')
Write-Output ('Kit validation cases: ' + $validationReport.cases)
Write-Output 'No approval issued; no physical test executed. Review the separate kit before owner preparation.'
