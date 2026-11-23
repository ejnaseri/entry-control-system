[CmdletBinding()]param(
    [ValidateSet('Inert', 'Capable')][string]$Mode = 'Inert',
    [string]$ReviewedInertCandidate,
    [string]$ExpectedReviewedManifestSha256
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
if ($Mode -cnotin @('Inert', 'Capable')) { throw 'BUILD_MODE_CASE_REFUSED' }
# Both build modes run synthetic tests only. Capable mode requires a separately
# pinned inert source/artifact checkpoint before any output is created. No
# service, CNG key, protected-store or physical entry is invoked by this builder.
if ($Mode -ceq 'Capable') {
    if ([string]::IsNullOrWhiteSpace($ReviewedInertCandidate) -or
        $ExpectedReviewedManifestSha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'REVIEWED_INERT_BASELINE_REQUIRED' }
} elseif ($ReviewedInertCandidate -or $ExpectedReviewedManifestSha256) { throw 'INERT_REVIEW_ARGUMENTS_REFUSED' }
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dotnet = 'C:\Program Files\dotnet\dotnet.exe'
$compiler = 'C:\Program Files\dotnet\sdk\10.0.400\Roslyn\bincore\csc.dll'
$refs = 'C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Ref\10.0.11\ref\net10.0'
$hostModel = 'C:\Program Files\dotnet\sdk\10.0.400\Microsoft.NET.HostModel.dll'
$template = 'C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Host.win-x64\10.0.11\runtimes\win-x64\native\apphost.exe'
$runtimeGroups = @(
    [ordered]@{ name = 'runtime'; path = 'C:\Program Files\dotnet\shared\Microsoft.NETCore.App\10.0.11' },
    [ordered]@{ name = 'fxr'; path = 'C:\Program Files\dotnet\host\fxr\10.0.11' }
)
$expectedCases = 18480
$destination = Join-Path $repo ('out\lic008-export-policy-v5-' + $Mode.ToLowerInvariant() + '-' + [guid]::NewGuid().ToString('N'))
function WriteNew([string]$path, [byte[]]$bytes) {
    $stream = [IO.File]::Open($path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
}
function JsonNew([string]$path, $value) {
    WriteNew $path ([Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Depth 12)))
}
function CanonicalJsonNew([string]$path, $value) {
    WriteNew $path ([Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Depth 12 -Compress)))
}
function Hash([string]$path) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() }
function RequirePlainAncestors([string]$path) {
    for ($cursor = [IO.Path]::GetFullPath($path); $cursor; $cursor = [IO.Path]::GetDirectoryName($cursor)) {
        if (([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'RUNTIME_ANCESTOR_REPARSE_REFUSED' }
    }
}
function RunChild([string]$executable, [string]$arguments) {
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $executable
    $start.Arguments = $arguments
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    # Limit environment normalization to this synthetic build/test child.
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
function RunLocal([string]$arguments) { RunChild $dotnet $arguments }
function ReadPureReport($tested, [bool]$capable = $false) {
    if ($tested.ExitCode -ne 0 -or $tested.Stderr.Length -ne 0) { throw ('PURE_TEST_FAILED: ' + $tested.Stderr) }
    $report = $tested.Stdout | ConvertFrom-Json
    $expectedCapability = if ($capable) { 'TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V5' } else { 'NONE' }
    if ($report.scope -cne 'TEST_ONLY_EXPORT_POLICY_CONTROL_PURE_V1' -or $report.cases -ne $expectedCases -or
        $report.capability -cne $expectedCapability -or
        $report.physicalExecutionEnabled -ne $capable -or $report.physicalTested -ne $false -or
        $report.securityAccepted -ne $false -or $report.productionAccepted -ne $false) { throw ('PURE_REPORT_REFUSED: ' + $tested.Stdout) }
    return $report
}
$sources = @('Program.cs', 'MatchedExportProbe.cs', 'PureTests.cs', 'ControlContracts.cs',
    'ControlLifecycle.cs', 'ControlLifecycleTests.cs', 'NativeKeys.cs', 'NativeKeysTests.cs',
    'ProtectedControlStore.cs', 'ControlStoreTests.cs', 'NativeControlIdentity.cs',
    'NativeControlService.cs', 'NativeControlAdmission.cs', 'NativeControlRuntime.cs',
    'NativeControlAdmissionTests.cs', 'ControlController.cs', 'ControlControllerTests.cs',
    'ControlOwnerEntry.cs', 'ControlWindowsDeployment.cs', 'ControlCapability.cs',
    'ControlStartupDiagnostics.cs', 'ControlStartupDiagnosticsTests.cs', 'ControlPlacementTests.cs',
    'ControlRunDiagnostics.cs') | ForEach-Object {
    'licensing/adapter-evidence/export-policy-control/' + $_
}
$inputs = @(foreach ($relative in $sources) {
    [ordered]@{ relative = $relative; sha256 = (Hash (Join-Path $repo $relative)) }
})
$inputs += [ordered]@{ relative = 'scripts/build-license-export-policy-control.ps1'; sha256 = (Hash $PSCommandPath) }
$hostSource = 'licensing/adapter-evidence/export-policy-control/ControlHostBuilder.cs'
$inputs += [ordered]@{ relative = $hostSource; sha256 = (Hash (Join-Path $repo $hostSource)) }
foreach ($required in @($dotnet, $compiler, $refs, $hostModel, $template) + @($runtimeGroups | ForEach-Object { $_.path })) {
    if (-not (Test-Path -LiteralPath $required)) { throw 'PINNED_BUILD_TOOL_MISSING' }
}
$toolInputs = @(foreach ($path in @($dotnet, $compiler, $hostModel, $template)) {
    [ordered]@{ path = $path; sha256 = (Hash $path) }
})
$referenceInputs = @(Get-ChildItem -LiteralPath $refs -Filter '*.dll' | Sort-Object Name | ForEach-Object {
    [ordered]@{ path = $_.FullName; sha256 = (Hash $_.FullName) }
})
if ($referenceInputs.Count -eq 0) { throw 'REFERENCE_PACK_EMPTY' }
$sourceBytes = [Text.Encoding]::UTF8.GetBytes(($inputs | ConvertTo-Json -Depth 12 -Compress))
$referenceBytes = [Text.Encoding]::UTF8.GetBytes(($referenceInputs | ConvertTo-Json -Depth 12 -Compress))
$sha = [Security.Cryptography.SHA256]::Create()
try {
    $sourceSetHash = ([BitConverter]::ToString($sha.ComputeHash($sourceBytes))).Replace('-', '').ToLowerInvariant()
    $referenceSetHash = ([BitConverter]::ToString($sha.ComputeHash($referenceBytes))).Replace('-', '').ToLowerInvariant()
}
finally { $sha.Dispose() }
# A capability definition is a new artifact, not an edit to a previously built
# package. Bind the exact reviewed inert checkpoint and the complete current
# source/tool/reference sets before creating even the new output directory.
$reviewedManifestHash = $null
if ($Mode -ceq 'Capable') {
    $reviewRoot = [IO.Path]::GetFullPath($ReviewedInertCandidate)
    if (-not [IO.Path]::IsPathRooted($ReviewedInertCandidate) -or $reviewRoot.StartsWith('\\')) { throw 'REVIEW_PATH_REFUSED' }
    if ($reviewRoot -cne $ReviewedInertCandidate -or
        [IO.Path]::GetDirectoryName($reviewRoot) -cne (Join-Path $repo 'out') -or
        [IO.Path]::GetFileName($reviewRoot) -cnotmatch '^lic008-export-policy-v5-inert-[a-f0-9]{32}$') { throw 'REVIEW_LOCATION_REFUSED' }
    RequirePlainAncestors $reviewRoot
    $reviewManifestPath = Join-Path $reviewRoot 'manifest.json'
    RequirePlainAncestors $reviewManifestPath
    $reviewedManifestHash = Hash $reviewManifestPath
    if ($reviewedManifestHash -cne $ExpectedReviewedManifestSha256) { throw 'REVIEW_MANIFEST_PIN_MISMATCH' }
    $review = [IO.File]::ReadAllText($reviewManifestPath) | ConvertFrom-Json
    if ($review.scope -cne 'TEST_ONLY_EXPORT_POLICY_CONTROL_INERT_BUILD_V5' -or
        $review.physicalExecutionEnabled -ne $false -or $review.physicalTested -ne $false -or
        $review.securityAccepted -ne $false -or $review.productionAccepted -ne $false -or
        $review.runtimeInventoryVerified -ne $true -or $review.sourceSetSha256 -cne $sourceSetHash -or
        $review.referenceSetSha256 -cne $referenceSetHash -or $review.compilerSha256 -cne (Hash $compiler) -or
        $review.inputs.Count -ne $inputs.Count -or $review.toolInputs.Count -ne $toolInputs.Count -or
        $review.referenceInputs.Count -ne $referenceInputs.Count -or $review.variants.Count -ne 2) { throw 'REVIEW_BASELINE_REFUSED' }
    for ($i = 0; $i -lt $inputs.Count; $i++) {
        if ($review.inputs[$i].relative -cne $inputs[$i].relative -or $review.inputs[$i].sha256 -cne $inputs[$i].sha256) { throw 'REVIEW_SOURCE_CHANGED' }
        $snapshotPath = Join-Path (Join-Path $reviewRoot 'snapshot') ([IO.Path]::GetFileName($inputs[$i].relative))
        RequirePlainAncestors $snapshotPath
        if ((Hash $snapshotPath) -cne $inputs[$i].sha256) { throw 'REVIEW_SNAPSHOT_CHANGED' }
    }
    foreach ($set in @(@{ Actual = $toolInputs; Expected = $review.toolInputs }, @{ Actual = $referenceInputs; Expected = $review.referenceInputs })) {
        for ($i = 0; $i -lt $set.Actual.Count; $i++) {
            if ($set.Actual[$i].path -cne $set.Expected[$i].path -or $set.Actual[$i].sha256 -cne $set.Expected[$i].sha256) { throw 'REVIEW_TOOLCHAIN_CHANGED' }
        }
    }
    for ($i = 0; $i -lt 2; $i++) {
        $name = @('default', 'defines-still-inert')[$i]
        $variant = $review.variants[$i]
        $variantDll = Join-Path (Join-Path $reviewRoot $name) 'ExportPolicyControl.dll'
        RequirePlainAncestors $variantDll
        if ($variant.variant -cne $name -or $variant.cases -ne $expectedCases -or $variant.entryRefusals -ne 14 -or
            $variant.dllSha256 -cne (Hash $variantDll)) { throw 'REVIEW_VARIANT_REFUSED' }
    }
    $reviewPackageManifest = Join-Path $reviewRoot 'package-manifest.json'
    RequirePlainAncestors $reviewPackageManifest
    if ((Hash $reviewPackageManifest) -cne $review.packageManifestSha256) { throw 'REVIEW_PACKAGE_MANIFEST_CHANGED' }
    $reviewPackage = [IO.File]::ReadAllText($reviewPackageManifest) | ConvertFrom-Json
    $reviewPackageNames = @('ExportPolicyControl.exe', 'ExportPolicyControl.dll', 'ExportPolicyControl.runtimeconfig.json', 'runtime-inventory.json')
    if ($reviewPackage.schemaVersion -ne 1 -or $reviewPackage.scope -cne 'TEST_ONLY_EXPORT_POLICY_PACKAGE_V5' -or
        $reviewPackage.files.Count -ne 4 -or @(Get-ChildItem -LiteralPath (Join-Path $reviewRoot 'package') -Force).Count -ne 4) { throw 'REVIEW_PACKAGE_SET_REFUSED' }
    for ($i = 0; $i -lt 4; $i++) {
        $file = $reviewPackage.files[$i]
        if ($file.name -cne $reviewPackageNames[$i]) { throw 'REVIEW_PACKAGE_NAME_REFUSED' }
        $path = Join-Path (Join-Path $reviewRoot 'package') $file.name
        RequirePlainAncestors $path
        if ((Get-Item -LiteralPath $path).Length -ne $file.size -or (Hash $path) -cne $file.sha256) { throw 'REVIEW_PACKAGE_FILE_CHANGED' }
    }
    if ($reviewPackage.files[1].sha256 -cne $review.variants[0].dllSha256 -or
        $reviewPackage.files[3].sha256 -cne $review.runtimeInventorySha256) { throw 'REVIEW_PACKAGE_BINDING_REFUSED' }
}
$null = New-Item -ItemType Directory -Path $destination
$snapshot = Join-Path $destination 'snapshot'
$null = New-Item -ItemType Directory -Path $snapshot
foreach ($row in $inputs) {
    $target = Join-Path $snapshot ([IO.Path]::GetFileName($row.relative))
    WriteNew $target ([IO.File]::ReadAllBytes((Join-Path $repo $row.relative)))
    if ((Hash $target) -cne $row.sha256) { throw 'SOURCE_SNAPSHOT_CHANGED' }
}
$entryArguments = @(
    '', '--run', '--service', '--controller', '--probe', '--prepare-diagnostic-input',
    '--diagnostic-service --approval-sha256 aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa --package-sha256 bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    '--self-test unexpected', '--SELF-TEST', '--control-service', '--control-controller',
    ('--control-service Setup --plan-sha256 ' + ('a'*64) + ' --approval-sha256 ' + ('b'*64) + ' --package-sha256 ' + ('c'*64)),
    ('--control-service Guardian --plan-sha256 ' + ('a'*64) + ' --approval-sha256 ' + ('b'*64) + ' --package-sha256 ' + ('c'*64)),
    ('--control-controller C:\not-issued\plan.json C:\not-issued\approval.json ' + ('a'*64) + ' ' + ('b'*64) + ' ' + ('c'*64) + ' S-1-5-21-1-2-3-1001')
)
$variants = @('default', 'defines-still-inert')
if ($Mode -ceq 'Capable') { $variants += 'capable' }
# Never test a well-formed capable service/controller route in a builder. These
# malformed shapes fail in the pure parser, before token/file/SCM/native dispatch.
$capableEntryArguments = @($entryArguments[0..10]) + @(
    '--control-service Unknown --plan-sha256 invalid --approval-sha256 invalid --package-sha256 invalid',
    '--control-controller relative-plan relative-approval invalid invalid invalid invalid'
)
function CheckEntryRefusal($refused, [string]$entry, [bool]$capable) {
    $expectedExit = if ($capable) { 1 } else { 2 }
    $expectedError = if ($capable) { 'EXPORT_POLICY_CONTROL_FAILED_OR_REFUSED_RETAIN' } else { 'EXPORT_POLICY_CONTROL_ENTRY_CLOSED' }
    if ($refused.ExitCode -ne $expectedExit -or $refused.Stdout.Length -ne 0 -or $refused.Stderr.Trim() -cne $expectedError) { throw 'ENTRY_REFUSAL_FAILED' }
}
$buildResults = @(foreach ($variant in $variants) {
    $capable = $variant -ceq 'capable'
    $variantRoot = Join-Path $destination $variant
    $null = New-Item -ItemType Directory -Path $variantRoot
    $dll = Join-Path $variantRoot 'ExportPolicyControl.dll'
    $compileArgs = @('-nologo', '-target:exe', '-platform:x64', '-nullable:enable', '-warnaserror+',
        '-main:EntryControl.TestOnly.ExportPolicyControl.Program', ('-out:"' + $dll + '"'))
    if ($variant -eq 'defines-still-inert') {
        $compileArgs += '-define:TEST_CAPABLE_DIAGNOSTIC;TEST_CAPABLE_PILOT;TEST_CAPABLE_EXPORT_POLICY_CONTROL;TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V1;TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V2;TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V3;TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V4'
    }
    if ($capable) { $compileArgs += '-define:TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V5' }
    $compileArgs += @($referenceInputs | ForEach-Object { '-r:"' + $_.path + '"' })
    $compileArgs += @($sources | ForEach-Object { '"' + (Join-Path $snapshot ([IO.Path]::GetFileName($_))) + '"' })
    $response = Join-Path $variantRoot 'compile.rsp'
    WriteNew $response ([Text.Encoding]::UTF8.GetBytes(($compileArgs -join [Environment]::NewLine)))
    $compiled = RunLocal ('exec --fx-version 10.0.11 "' + $compiler + '" -noconfig "@' + $response + '"')
    if ($compiled.ExitCode -ne 0) { throw ('COMPILE_FAILED: ' + $compiled.Stdout + $compiled.Stderr) }
    CanonicalJsonNew (Join-Path $variantRoot 'ExportPolicyControl.runtimeconfig.json') ([ordered]@{
        runtimeOptions = [ordered]@{ tfm = 'net10.0'; framework = [ordered]@{ name = 'Microsoft.NETCore.App'; version = '10.0.11' }; rollForward = 'Disable' }
    })
    $report = ReadPureReport (RunLocal ('exec --fx-version 10.0.11 "' + $dll + '" --self-test')) $capable
    $variantEntries = if ($capable) { $capableEntryArguments } else { $entryArguments }
    foreach ($entry in $variantEntries) {
        $refused = RunLocal ('exec --fx-version 10.0.11 "' + $dll + '" ' + $entry)
        CheckEntryRefusal $refused $entry $capable
    }
    JsonNew (Join-Path $variantRoot 'pure-test-report.json') $report
    [ordered]@{ variant = $variant; cases = $report.cases; entryRefusals = $variantEntries.Count; dllSha256 = (Hash $dll); physicalExecutionEnabled = $capable }
})
# Package only the explicitly selected variant. HostModel creates an x64 apphost
# whose runtime search is global-only; runtimeconfig disables framework roll-forward.
$package = Join-Path $destination 'package'
$hostTool = Join-Path $destination 'host-tool'
$null = New-Item -ItemType Directory -Path $package
$null = New-Item -ItemType Directory -Path $hostTool
WriteNew (Join-Path $hostTool 'Microsoft.NET.HostModel.dll') ([IO.File]::ReadAllBytes($hostModel))
if ((Hash (Join-Path $hostTool 'Microsoft.NET.HostModel.dll')) -cne ($toolInputs | Where-Object path -CEQ $hostModel).sha256) {
    throw 'HOST_MODEL_SNAPSHOT_CHANGED'
}
$hostDll = Join-Path $hostTool 'ControlHostBuilder.dll'
$hostArgs = @('-nologo', '-target:exe', '-platform:x64', '-nullable:enable', '-warnaserror+', ('-out:"' + $hostDll + '"'))
$hostArgs += @($referenceInputs | ForEach-Object { '-r:"' + $_.path + '"' })
$hostArgs += @('-r:"' + (Join-Path $hostTool 'Microsoft.NET.HostModel.dll') + '"', '"' + (Join-Path $snapshot 'ControlHostBuilder.cs') + '"')
$hostResponse = Join-Path $hostTool 'host.rsp'
WriteNew $hostResponse ([Text.Encoding]::UTF8.GetBytes(($hostArgs -join [Environment]::NewLine)))
$hostCompiled = RunLocal ('exec --fx-version 10.0.11 "' + $compiler + '" -noconfig "@' + $hostResponse + '"')
if ($hostCompiled.ExitCode -ne 0) { throw ('HOST_TOOL_COMPILE_FAILED: ' + $hostCompiled.Stdout + $hostCompiled.Stderr) }
WriteNew (Join-Path $hostTool 'ControlHostBuilder.runtimeconfig.json') ([IO.File]::ReadAllBytes((Join-Path $destination 'default\ExportPolicyControl.runtimeconfig.json')))
CanonicalJsonNew (Join-Path $hostTool 'ControlHostBuilder.deps.json') @{
    runtimeTarget = @{ name = '.NETCoreApp,Version=v10.0' }
    targets = @{ '.NETCoreApp,Version=v10.0' = @{ 'ControlHostBuilder/1.0.0' = @{ runtime = @{ 'ControlHostBuilder.dll' = @{}; 'Microsoft.NET.HostModel.dll' = @{} } } } }
    libraries = @{ 'ControlHostBuilder/1.0.0' = @{ type = 'project'; serviceable = $false; sha512 = '' } }
}
$exe = Join-Path $package 'ExportPolicyControl.exe'
$hostBuilt = RunLocal ('exec --fx-version 10.0.11 "' + $hostDll + '" "' + $template + '" "' + $exe + '"')
if ($hostBuilt.ExitCode -ne 0 -or $hostBuilt.Stderr.Length -ne 0) { throw ('HOST_BUILD_FAILED: ' + $hostBuilt.Stdout + $hostBuilt.Stderr) }
foreach ($name in @('ExportPolicyControl.dll', 'ExportPolicyControl.runtimeconfig.json')) {
    $packageVariant = if ($Mode -ceq 'Capable') { 'capable' } else { 'default' }
    WriteNew (Join-Path $package $name) ([IO.File]::ReadAllBytes((Join-Path (Join-Path $destination $packageVariant) $name)))
}
$runtimeRows = @(foreach ($group in $runtimeGroups) {
    RequirePlainAncestors $group.path
    $entries = @(Get-ChildItem -LiteralPath $group.path -Force | Sort-Object Name)
    foreach ($file in $entries) {
        if ($file.PSIsContainer -or ($file.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
            $file.Length -le 0 -or $file.Length -gt 134217728 -or
            (($group.name -cne 'runtime' -or $file.Name -cne '.version') -and
                $file.Name -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$')) {
            throw 'RUNTIME_INVENTORY_ENTRY_REFUSED'
        }
        [ordered]@{ group = $group.name; name = $file.Name; size = $file.Length; sha256 = (Hash $file.FullName) }
    }
})
$inventoryPath = Join-Path $package 'runtime-inventory.json'
# These ASCII-only records have the same compact camelCase property order as
# ControlRules.Serialize(ControlRuntimeInventory / ControlPackage).
CanonicalJsonNew $inventoryPath ([ordered]@{ schemaVersion = 1; runtime = '10.0.11'; files = $runtimeRows })
$packageNames = @('ExportPolicyControl.exe', 'ExportPolicyControl.dll', 'ExportPolicyControl.runtimeconfig.json', 'runtime-inventory.json')
$packageRows = @(foreach ($name in $packageNames) {
    $path = Join-Path $package $name
    if ((Get-Item -LiteralPath $path).Length -le 0 -or (Get-Item -LiteralPath $path).Length -gt 33554432) { throw 'PACKAGE_FILE_SIZE_REFUSED' }
    [ordered]@{ name = $name; size = (Get-Item -LiteralPath $path).Length; sha256 = (Hash $path) }
})
$packageManifest = Join-Path $destination 'package-manifest.json'
CanonicalJsonNew $packageManifest ([ordered]@{ schemaVersion = 1; scope = 'TEST_ONLY_EXPORT_POLICY_PACKAGE_V5'; files = $packageRows })
# The separate build helper invokes only the actual package canonical parsers
# and pure schema validators. The packaged application gains no entry mode.
$canonicalCheck = RunLocal ('exec --fx-version 10.0.11 "' + $hostDll + '" "' +
    (Join-Path $package 'ExportPolicyControl.dll') + '" "' + $packageManifest + '" "' + $inventoryPath + '"')
if ($canonicalCheck.ExitCode -ne 0 -or $canonicalCheck.Stderr.Length -ne 0) {
    throw ('PACKAGE_CANONICAL_CHECK_FAILED: ' + $canonicalCheck.Stdout + $canonicalCheck.Stderr)
}
$canonicalReport = $canonicalCheck.Stdout | ConvertFrom-Json
if ($canonicalReport.scope -cne 'TEST_ONLY_EXPORT_POLICY_CONTROL_PACKAGE_VERIFIED_V5' -or
    $canonicalReport.manifestSha256 -cne (Hash $packageManifest) -or
    $canonicalReport.runtimeInventorySha256 -cne (Hash $inventoryPath) -or
    $canonicalReport.canonicalPackageVerified -ne $true -or $canonicalReport.canonicalRuntimeInventoryVerified -ne $true -or
    $canonicalReport.physicalExecutionEnabled -ne ($Mode -ceq 'Capable') -or $canonicalReport.physicalTested -ne $false -or
    $canonicalReport.securityAccepted -ne $false -or $canonicalReport.productionAccepted -ne $false) {
    throw 'PACKAGE_CANONICAL_REPORT_REFUSED'
}
JsonNew (Join-Path $destination 'package-verification.json') $canonicalReport
$apphostReport = ReadPureReport (RunChild $exe '--self-test') ($Mode -ceq 'Capable')
$packageEntries = if ($Mode -ceq 'Capable') { $capableEntryArguments } else { $entryArguments }
foreach ($entry in $packageEntries) {
    $refused = RunChild $exe $entry
    CheckEntryRefusal $refused $entry ($Mode -ceq 'Capable')
}
JsonNew (Join-Path $destination 'apphost-pure-test-report.json') $apphostReport
# Read-only inventory verification: require the complete installed runtime/fxr
# file sets to match the captured sizes and hashes after all synthetic runs.
$verifiedInventory = [IO.File]::ReadAllText($inventoryPath) | ConvertFrom-Json
if ($verifiedInventory.schemaVersion -ne 1 -or $verifiedInventory.runtime -cne '10.0.11' -or
    $verifiedInventory.files.Count -lt 4 -or $verifiedInventory.files.Count -gt 512) { throw 'RUNTIME_INVENTORY_SCHEMA_REFUSED' }
foreach ($required in @('runtime/System.Private.CoreLib.dll', 'runtime/coreclr.dll', 'runtime/hostpolicy.dll', 'fxr/hostfxr.dll')) {
    if (@($verifiedInventory.files | Where-Object { ($_.group + '/' + $_.name) -ceq $required }).Count -ne 1) { throw 'RUNTIME_REQUIRED_FILE_MISSING' }
}
foreach ($group in $runtimeGroups) {
    RequirePlainAncestors $group.path
    $entries = @(Get-ChildItem -LiteralPath $group.path -Force)
    $rows = @($verifiedInventory.files | Where-Object group -CEQ $group.name)
    if ($entries.Count -ne $rows.Count) { throw 'RUNTIME_INVENTORY_COUNT_CHANGED' }
    foreach ($row in $rows) {
        $matching = @($entries | Where-Object Name -CEQ $row.name)
        if ($matching.Count -ne 1 -or $matching[0].PSIsContainer -or
            ($matching[0].Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
            $matching[0].Length -ne $row.size -or (Hash $matching[0].FullName) -cne $row.sha256) { throw 'RUNTIME_INVENTORY_CHANGED' }
    }
}
$verifiedPackage = [IO.File]::ReadAllText($packageManifest) | ConvertFrom-Json
if ($verifiedPackage.schemaVersion -ne 1 -or $verifiedPackage.scope -cne 'TEST_ONLY_EXPORT_POLICY_PACKAGE_V5' -or
    $verifiedPackage.files.Count -ne 4 -or @(Get-ChildItem -LiteralPath $package -Force).Count -ne 4) { throw 'PACKAGE_INVENTORY_REFUSED' }
for ($i = 0; $i -lt $packageNames.Count; $i++) {
    $row = $verifiedPackage.files[$i]
    $path = Join-Path $package $packageNames[$i]
    if ($row.name -cne $packageNames[$i] -or (Get-Item -LiteralPath $path).Length -ne $row.size -or
        (Hash $path) -cne $row.sha256) { throw 'PACKAGE_FILE_CHANGED' }
}
foreach ($row in $inputs) {
    if ((Hash (Join-Path $repo $row.relative)) -cne $row.sha256) { throw 'CUSTODY_INPUT_CHANGED' }
    if ((Hash (Join-Path $snapshot ([IO.Path]::GetFileName($row.relative)))) -cne $row.sha256) { throw 'FINAL_SNAPSHOT_CHANGED' }
}
foreach ($row in $toolInputs) { if ((Hash $row.path) -cne $row.sha256) { throw 'BUILD_TOOL_CHANGED' } }
foreach ($row in $referenceInputs) { if ((Hash $row.path) -cne $row.sha256) { throw 'REFERENCE_ASSEMBLY_CHANGED' } }
if ((Hash (Join-Path $hostTool 'Microsoft.NET.HostModel.dll')) -cne ($toolInputs | Where-Object path -CEQ $hostModel).sha256) {
    throw 'FINAL_HOST_MODEL_SNAPSHOT_CHANGED'
}
if ($Mode -ceq 'Capable' -and (Hash $reviewManifestPath) -cne $reviewedManifestHash) { throw 'FINAL_REVIEW_MANIFEST_CHANGED' }
$packageBuild = [ordered]@{
    scope = if ($Mode -ceq 'Capable') { 'TEST_ONLY_EXPORT_POLICY_CONTROL_CAPABLE_PACKAGE_BUILD_V5' } else { 'TEST_ONLY_EXPORT_POLICY_CONTROL_INERT_PACKAGE_BUILD_V5' }
    reviewedInertManifestSha256 = $reviewedManifestHash
    sourceSetSha256 = $sourceSetHash
    referenceSetSha256 = $referenceSetHash
    manifestSha256 = (Hash $packageManifest)
    hostSourceSha256 = ($inputs | Where-Object relative -CEQ $hostSource).sha256
    compilerSha256 = ($toolInputs | Where-Object path -CEQ $compiler).sha256
    hostModelSha256 = ($toolInputs | Where-Object path -CEQ $hostModel).sha256
    apphostTemplateSha256 = ($toolInputs | Where-Object path -CEQ $template).sha256
    exeSha256 = (Hash $exe)
    dllSha256 = (Hash (Join-Path $package 'ExportPolicyControl.dll'))
    runtimeConfigSha256 = (Hash (Join-Path $package 'ExportPolicyControl.runtimeconfig.json'))
    runtimeInventorySha256 = (Hash $inventoryPath)
    runtimeFiles = $runtimeRows.Count
    canonicalPackageVerified = $true
    canonicalRuntimeInventoryVerified = $true
    runtimeInventoryVerified = $true
    pureCases = $apphostReport.cases
    apphostRefusals = $packageEntries.Count
    physicalExecutionEnabled = ($Mode -ceq 'Capable')
    physicalTested = $false
    securityAccepted = $false
    productionAccepted = $false
}
JsonNew (Join-Path $destination 'package-build.json') $packageBuild
JsonNew (Join-Path $destination 'manifest.json') ([ordered]@{
    scope = if ($Mode -ceq 'Capable') { 'TEST_ONLY_EXPORT_POLICY_CONTROL_CAPABLE_BUILD_V5' } else { 'TEST_ONLY_EXPORT_POLICY_CONTROL_INERT_BUILD_V5' }
    reviewedInertManifestSha256 = $reviewedManifestHash
    inputs = $inputs
    sourceSetSha256 = $sourceSetHash
    compilerSha256 = ($toolInputs | Where-Object path -CEQ $compiler).sha256
    toolInputs = $toolInputs
    referenceInputs = $referenceInputs
    referenceSetSha256 = $referenceSetHash
    variants = $buildResults
    packageManifestSha256 = $packageBuild.manifestSha256
    runtimeInventorySha256 = $packageBuild.runtimeInventorySha256
    runtimeInventoryVerified = $true
    physicalExecutionEnabled = ($Mode -ceq 'Capable')
    physicalTested = $false
    securityAccepted = $false
    productionAccepted = $false
})
$buildResults | Format-Table -AutoSize
Write-Output ($Mode + ' candidate: ' + $destination)
Write-Output ('Package manifest SHA256: ' + $packageBuild.manifestSha256)
Write-Output ('Runtime inventory SHA256: ' + $packageBuild.runtimeInventorySha256)
