[CmdletBinding()]param(
    [ValidateSet('CheckOnly', 'Prepare', 'Execute')][string]$Mode = 'CheckOnly',
    [Parameter(Mandatory = $true)][string]$ExpectedKitSha256,
    [string]$InputDirectory,
    [string]$ExpectedPlanSha256,
    [string]$ExpectedApprovalSha256
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Copied byte-for-byte into a separately reviewed owner kit as Run-Owner.ps1.
# Prepare never falls through to Execute. This script never auto-confirms,
# elevates, retries, cleans up or edits a previously issued input.
function AssertOwnerModeArguments([string]$mode, [string]$kitPin, [string]$inputPath,
    [string]$planPin, [string]$approvalPin) {
    if ($mode -cnotin @('CheckOnly', 'Prepare', 'Execute')) { throw 'OWNER_MODE_CASE_REFUSED' }
    if ($kitPin -cnotmatch '^[a-f0-9]{64}$') { throw 'REVIEWED_KIT_PIN_REQUIRED' }
    if ($mode -ceq 'Execute') {
        if ([string]::IsNullOrWhiteSpace($inputPath) -or $planPin -cnotmatch '^[a-f0-9]{64}$' -or
            $approvalPin -cnotmatch '^[a-f0-9]{64}$') { throw 'SEPARATELY_REVIEWED_OWNER_INPUT_REQUIRED' }
    } elseif ($inputPath -or $planPin -or $approvalPin) { throw 'OWNER_INPUT_ARGUMENTS_REFUSED' }
}
AssertOwnerModeArguments $Mode $ExpectedKitSha256 $InputDirectory $ExpectedPlanSha256 $ExpectedApprovalSha256

$ownerKitHandles = New-Object 'System.Collections.Generic.List[System.IDisposable]'

function InvokeOwnerCleanEnvironment([scriptblock]$action) {
    # This narrow boundary is also exercised with pure callbacks in tests.
    foreach ($name in [Environment]::GetEnvironmentVariables().Keys) {
        if ($name -ieq 'DOTNET_ROOT') { continue }
        if ($name -match '^(DOTNET_|COMPLUS_|CORECLR_|COR_|COREHOST_)' -or
            $name -in @('APPDOMAIN_MANAGER_ASM', 'APPDOMAIN_MANAGER_TYPE', 'DEVPATH', '__COMPAT_LAYER')) { throw 'OWNER_RUNTIME_OVERRIDE_REFUSED' }
    }
    $rootPresent = Test-Path -LiteralPath Env:\DOTNET_ROOT
    $savedRoot = [Environment]::GetEnvironmentVariable('DOTNET_ROOT', 'Process')
    $rootChanged = $false
    try {
        if ($rootPresent) {
            [Environment]::SetEnvironmentVariable('DOTNET_ROOT', $null, 'Process')
            $rootChanged = $true
            Write-Output 'DOTNET_ROOT temporarily excluded in this process only; persistent settings unchanged.'
        }
        & $action
    } finally {
        if ($rootChanged) { [Environment]::SetEnvironmentVariable('DOTNET_ROOT', $savedRoot, 'Process') }
    }
}

function AssertOwnerPathSyntax([string]$path) {
    if ([string]::IsNullOrWhiteSpace($path) -or $path.Length -gt 240 -or $path -cnotmatch '^[A-Z]:\\' -or
        $path.Substring(3) -match '[\x00-\x1f:"/<>|?*]' -or [IO.Path]::GetFullPath($path) -cne $path) { throw 'OWNER_PATH_REFUSED' }
    foreach ($part in $path.Substring(3).Split('\')) {
        if (-not $part -or $part -in @('.', '..') -or $part.EndsWith('.') -or $part.EndsWith(' ')) { throw 'OWNER_PATH_COMPONENT_REFUSED' }
    }
}
function AssertOwnerArtifactLocation([string]$path, [string]$kind, [string]$outputParent = '') {
    # Purpose-specific paths are a custody boundary. This check is pure; the
    # existing handle/ancestor checks still establish filesystem custody.
    AssertOwnerPathSyntax $path
    if ($kind -cnotin @('owner-kit', 'capable', 'input') -or
        [IO.Path]::GetFileName($path) -cnotmatch ('^lic008-export-policy-v5-' + $kind + '-[a-f0-9]{32}$')) {
        throw 'OWNER_ARTIFACT_LOCATION_REFUSED'
    }
    if ($PSBoundParameters.ContainsKey('outputParent')) {
        AssertOwnerPathSyntax $outputParent
        if ([IO.Path]::GetDirectoryName($path) -cne $outputParent) { throw 'OWNER_ARTIFACT_LOCATION_REFUSED' }
    }
}
function AssertOwnerInputBinding($plan, $approval, $kit, [string]$planPin, [string]$inputPath) {
    AssertOwnerArtifactLocation $inputPath 'input' $kit.outputParent
    if ($plan.schemaVersion -ne 1 -or $plan.scope -cne 'TEST_ONLY_EXPORT_POLICY_CONTROL_V5' -or
        $plan.ownerSid -cne $kit.expectedOwnerSid -or $plan.packageSha256 -cne $kit.packageSha256 -or
        $plan.attemptId -cnotmatch '^[a-f0-9]{32}$' -or
        [IO.Path]::GetFileName($inputPath) -cne ('lic008-export-policy-v5-input-' + $plan.attemptId) -or
        $approval.schemaVersion -ne 1 -or $approval.scope -cne 'TEST_ONLY_EXPORT_POLICY_OWNER_APPROVAL_V5' -or
        $approval.planSha256 -cne $planPin -or $approval.ownerSid -cne $kit.expectedOwnerSid -or
        $approval.packageSha256 -cne $kit.packageSha256 -or $approval.attemptId -cne $plan.attemptId) {
        throw 'OWNER_INPUT_BINDING_REFUSED'
    }
}
function AssertOwnerPath([string]$path) {
    AssertOwnerPathSyntax $path
    for ($cursor = $path; $cursor; $cursor = [IO.Path]::GetDirectoryName($cursor)) {
        if (([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'OWNER_REPARSE_REFUSED' }
    }
}
function ReadOwnerFile([string]$path, [string]$expected, [int]$maximum = 33554432) {
    AssertOwnerPath $path
    if ($expected -cnotmatch '^[a-f0-9]{64}$') { throw 'OWNER_FILE_PIN_REFUSED' }
    $stream = [IO.File]::Open($path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    $ownerKitHandles.Add($stream)
    if ($stream.Length -le 0 -or $stream.Length -gt $maximum) { throw 'OWNER_FILE_SIZE_REFUSED' }
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $actual = ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
    if ($actual -cne $expected) { throw 'OWNER_FILE_PIN_MISMATCH' }
    $stream.Position = 0
    $bytes = New-Object byte[] ([int]$stream.Length)
    $position = 0
    while ($position -lt $bytes.Length) {
        $read = $stream.Read($bytes, $position, $bytes.Length - $position)
        if ($read -le 0) { throw 'OWNER_FILE_TRUNCATED' }
        $position += $read
    }
    return ,$bytes
}
function ReadOwnerJson([string]$path, [string]$expected) {
    return ([Text.Encoding]::UTF8.GetString((ReadOwnerFile $path $expected 2097152)) | ConvertFrom-Json)
}
function AssertOwnerRuntime($inventory) {
    # Verify and hold the pinned runtime BEFORE starting any managed helper,
    # not only from inside the process after runtime code has already loaded.
    if ($inventory.schemaVersion -ne 1 -or $inventory.runtime -cne '10.0.11' -or
        $inventory.files.Count -lt 4 -or $inventory.files.Count -gt 512) { throw 'OWNER_RUNTIME_SCHEMA_REFUSED' }
    $groups = @{
        runtime = 'C:\Program Files\dotnet\shared\Microsoft.NETCore.App\10.0.11'
        fxr = 'C:\Program Files\dotnet\host\fxr\10.0.11'
    }
    $seen = [Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
    foreach ($row in $inventory.files) {
        if ($row.group -cnotin @('runtime', 'fxr') -or $row.name.Length -gt 128 -or
            (($row.group -cne 'runtime' -or $row.name -cne '.version') -and $row.name -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$') -or
            $row.size -le 0 -or $row.size -gt 134217728 -or -not $seen.Add($row.group + '/' + $row.name)) { throw 'OWNER_RUNTIME_FILE_REFUSED' }
        $bytes = ReadOwnerFile (Join-Path $groups[$row.group] $row.name) $row.sha256 134217728
        if ($bytes.Length -ne $row.size) { throw 'OWNER_RUNTIME_LENGTH_REFUSED' }
    }
    foreach ($required in @('runtime/System.Private.CoreLib.dll', 'runtime/coreclr.dll', 'runtime/hostpolicy.dll', 'fxr/hostfxr.dll')) {
        if (-not $seen.Contains($required)) { throw 'OWNER_RUNTIME_REQUIRED_FILE_MISSING' }
    }
    foreach ($group in @('runtime', 'fxr')) {
        $entries = @(Get-ChildItem -LiteralPath $groups[$group] -Force)
        $rows = @($inventory.files | Where-Object group -CEQ $group)
        if ($entries.Count -ne $rows.Count) { throw 'OWNER_RUNTIME_SET_CHANGED' }
        foreach ($entry in $entries) {
            if ($entry.PSIsContainer -or -not $seen.Contains($group + '/' + $entry.Name)) { throw 'OWNER_RUNTIME_EXTRA_FILE_REFUSED' }
        }
    }
    # The dotnet muxer/apphost selects hostfxr before managed admission. Refuse
    # an unreviewed alternate installed host rather than loading it to inspect it.
    $fxrVersions = @(Get-ChildItem -LiteralPath 'C:\Program Files\dotnet\host\fxr' -Force)
    if ($fxrVersions.Count -lt 1) { throw 'OWNER_HOSTFXR_SELECTION_UNREVIEWED' }
    foreach ($version in $fxrVersions) {
        if (-not $version.PSIsContainer -or $version.Name -cnotmatch '^[0-9]+\.[0-9]+\.[0-9]+$' -or
            [version]$version.Name -gt [version]'10.0.11' -or
            ($version.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'OWNER_HOSTFXR_SELECTION_UNREVIEWED' }
    }
}
function GetOwnerHelperFailure([int]$exitCode, [string]$diagnostic) {
    $prefix = 'OWNER_HELPER_FAILED_OR_REFUSED_RETAIN; ExitCode=' + $exitCode.ToString([Globalization.CultureInfo]::InvariantCulture)
    $fallback = $prefix + '; Diagnostic=UNAVAILABLE_OR_REFUSED'
    if ([string]::IsNullOrWhiteSpace($diagnostic) -or $diagnostic.Length -gt 1024) { return $fallback }
    # Accept only the helper's six-field wire format, including its fixed field
    # order. This deliberately rejects duplicate/extra fields, escaped strings,
    # arbitrary exception text, native-host stderr and appended output. Never
    # interpolate raw stdout/stderr into a terminating exception.
    $pattern = @'
(?x)\A[ \t\r\n]*\{[ \t\r\n]*
"schemaVersion"[ \t\r\n]*:[ \t\r\n]*1[ \t\r\n]*,[ \t\r\n]*
"scope"[ \t\r\n]*:[ \t\r\n]*"TEST_ONLY_EXPORT_POLICY_OWNER_FAILURE_V1"[ \t\r\n]*,[ \t\r\n]*
"stage"[ \t\r\n]*:[ \t\r\n]*"(?<stage>[a-z][a-z-]{0,39})"[ \t\r\n]*,[ \t\r\n]*
"code"[ \t\r\n]*:[ \t\r\n]*"INPUT_STAGE_FAILED_OR_REFUSED"[ \t\r\n]*,[ \t\r\n]*
"category"[ \t\r\n]*:[ \t\r\n]*"(?<category>[A-Z][A-Z_]{0,23})"[ \t\r\n]*,[ \t\r\n]*
"hResult"[ \t\r\n]*:[ \t\r\n]*(?<hResult>-?(?:0|[1-9][0-9]{0,9}))[ \t\r\n]*
\}[ \t\r\n]*\z
'@
    $match = [regex]::Match($diagnostic, $pattern, [Text.RegularExpressions.RegexOptions]::CultureInvariant)
    if (-not $match.Success) { return $fallback }
    $stage = $match.Groups['stage'].Value
    $category = $match.Groups['category'].Value
    if ($stage -cnotin @('arguments', 'pure-self-test', 'token-self-test-runtime', 'token-self-test-query-only',
        'token-self-test-corrected', 'capability', 'runtime', 'owner-token-open', 'owner-token-membership',
        'owner-token-shape', 'environment', 'candidate', 'runtime-inventory', 'host-binding', 'guardian',
        'fresh-setup', 'test-root', 'preparation', 'preparation-write', 'preparation-readback', 'output') -or
        $category -cnotin @('SECURITY', 'ACCESS_DENIED', 'INVALID_DATA', 'IO', 'ARGUMENT', 'JSON',
        'NATIVE', 'STATE', 'UNSUPPORTED', 'EXCEPTION')) { return $fallback }
    $nativeResult = 0
    if (-not [int]::TryParse($match.Groups['hResult'].Value, [Globalization.NumberStyles]::AllowLeadingSign,
        [Globalization.CultureInfo]::InvariantCulture, [ref]$nativeResult)) { return $fallback }
    return $prefix + '; Stage=' + $stage + '; Category=' + $category +
        '; Code=INPUT_STAGE_FAILED_OR_REFUSED; HResult=' + $nativeResult.ToString([Globalization.CultureInfo]::InvariantCulture)
}
function ResolveOwnerHelperResult([int]$exitCode, [string]$stdout, [string]$stderr) {
    if ($exitCode -ne 0) {
        # Put the sanitized diagnosis IN the terminating error. A separate
        # Write-Output disappears when the caller captures this function inside
        # Write-Output (...), because evaluation stops before the outer call.
        throw (GetOwnerHelperFailure $exitCode $stderr)
    }
    if ($stderr.Length -ne 0) { throw 'OWNER_HELPER_UNEXPECTED_STDERR' }
    return $stdout.Trim()
}
function InvokeOwnerHelper([string[]]$helperArgs) {
    # All arguments have already passed the local-path or fixed hash/SID grammar.
    # No shell interpolation: quote each native-process argument independently.
    $arguments = @('exec', '--fx-version', '10.0.11', '--runtimeconfig',
        (Join-Path $PSScriptRoot 'helper\ControlInputTool.runtimeconfig.json'),
        (Join-Path $PSScriptRoot 'helper\ControlInputTool.dll')) + $helperArgs
    foreach ($argument in $arguments) {
        if ($argument.Contains('"') -or $argument.Contains("`r") -or $argument.Contains("`n") -or $argument.EndsWith('\')) { throw 'OWNER_HELPER_ARGUMENT_REFUSED' }
    }
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $ownerKit.dotnetPath
    $start.Arguments = (($arguments | ForEach-Object { '"' + $_ + '"' }) -join ' ')
    $start.UseShellExecute = $false
    $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true
    $start.RedirectStandardError = $true
    $process = [Diagnostics.Process]::Start($start)
    try {
        $stdout = $process.StandardOutput.ReadToEndAsync()
        $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(45000)) { throw 'OWNER_HELPER_UNRESOLVED_RETAIN_DO_NOT_RETRY' }
        return (ResolveOwnerHelperResult $process.ExitCode $stdout.Result $stderr.Result)
    } finally { $process.Dispose() }
}

try {
    AssertOwnerArtifactLocation $PSScriptRoot 'owner-kit'
    AssertOwnerPath $PSScriptRoot
    $ownerKit = ReadOwnerJson (Join-Path $PSScriptRoot 'kit.json') $ExpectedKitSha256
    if ($ownerKit.schemaVersion -ne 1 -or $ownerKit.scope -cne 'TEST_ONLY_EXPORT_POLICY_OWNER_KIT_V5' -or
        $ownerKit.physicalStageExecuted -ne $false -or $ownerKit.helperPhysicalEnabled -ne $false -or
        $ownerKit.securityAccepted -ne $false -or $ownerKit.productionAccepted -ne $false -or
        $ownerKit.expectedOwnerSid -cnotmatch '^S-1-5-21-[0-9]+-[0-9]+-[0-9]+-[0-9]+$' -or
        $ownerKit.dotnetPath -cne 'C:\Program Files\dotnet\dotnet.exe' -or
        $ownerKit.candidateManifestSha256 -cnotmatch '^[a-f0-9]{64}$' -or $ownerKit.packageSha256 -cnotmatch '^[a-f0-9]{64}$') { throw 'OWNER_KIT_SCHEMA_REFUSED' }
    AssertOwnerArtifactLocation $PSScriptRoot 'owner-kit' $ownerKit.outputParent
    AssertOwnerArtifactLocation $ownerKit.candidateDirectory 'capable' $ownerKit.outputParent
    $kitNames = @('Run-Owner.ps1', 'helper/ControlInputTool.dll', 'helper/ControlInputTool.runtimeconfig.json')
    if ($ownerKit.files.Count -ne 3) { throw 'OWNER_KIT_FILE_SET_REFUSED' }
    for ($i = 0; $i -lt $kitNames.Count; $i++) {
        $row = $ownerKit.files[$i]
        if ($row.relative -cne $kitNames[$i]) { throw 'OWNER_KIT_FILE_NAME_REFUSED' }
        $bytes = ReadOwnerFile (Join-Path $PSScriptRoot $row.relative) $row.sha256
        if ($bytes.Length -ne $row.size) { throw 'OWNER_KIT_FILE_LENGTH_REFUSED' }
    }
    $helperNames = @(Get-ChildItem -LiteralPath (Join-Path $PSScriptRoot 'helper') -Force | Select-Object -ExpandProperty Name | Sort-Object)
    if (($helperNames -join '|') -cne 'ControlInputTool.dll|ControlInputTool.runtimeconfig.json') { throw 'OWNER_HELPER_EXTRA_FILE_REFUSED' }
    $null = ReadOwnerFile $ownerKit.dotnetPath $ownerKit.dotnetSha256
    AssertOwnerPath $ownerKit.candidateDirectory
    AssertOwnerPath $ownerKit.outputParent
    $candidate = ReadOwnerJson (Join-Path $ownerKit.candidateDirectory 'manifest.json') $ownerKit.candidateManifestSha256
    if ($candidate.scope -cne 'TEST_ONLY_EXPORT_POLICY_CONTROL_CAPABLE_BUILD_V5' -or
        $candidate.packageManifestSha256 -cne $ownerKit.packageSha256 -or $candidate.physicalExecutionEnabled -ne $true -or
        $candidate.physicalTested -ne $false -or $candidate.securityAccepted -ne $false -or $candidate.productionAccepted -ne $false) { throw 'OWNER_CANDIDATE_REFUSED' }
    $package = ReadOwnerJson (Join-Path $ownerKit.candidateDirectory 'package-manifest.json') $ownerKit.packageSha256
    $packageNames = @('ExportPolicyControl.exe', 'ExportPolicyControl.dll', 'ExportPolicyControl.runtimeconfig.json', 'runtime-inventory.json')
    if ($package.schemaVersion -ne 1 -or $package.scope -cne 'TEST_ONLY_EXPORT_POLICY_PACKAGE_V5' -or $package.files.Count -ne 4) { throw 'OWNER_PACKAGE_SCHEMA_REFUSED' }
    $packageRoot = Join-Path $ownerKit.candidateDirectory 'package'
    if (@(Get-ChildItem -LiteralPath $packageRoot -Force).Count -ne 4) { throw 'OWNER_PACKAGE_EXTRA_FILE_REFUSED' }
    for ($i = 0; $i -lt 4; $i++) {
        $row = $package.files[$i]
        if ($row.name -cne $packageNames[$i]) { throw 'OWNER_PACKAGE_NAME_REFUSED' }
        $bytes = ReadOwnerFile (Join-Path $packageRoot $row.name) $row.sha256
        if ($bytes.Length -ne $row.size) { throw 'OWNER_PACKAGE_LENGTH_REFUSED' }
    }
    $runtimeInventory = ReadOwnerJson (Join-Path $packageRoot 'runtime-inventory.json') $package.files[3].sha256
    AssertOwnerRuntime $runtimeInventory
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    if ($identity.User.Value -cne $ownerKit.expectedOwnerSid -or
        -not ([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'EXPECTED_OWNER_ELEVATED_CONSOLE_REQUIRED' }
    InvokeOwnerCleanEnvironment {
    $helperBase = @($ownerKit.candidateDirectory, $ownerKit.candidateManifestSha256, $ownerKit.packageSha256, $ownerKit.expectedOwnerSid)
    if ($Mode -ceq 'CheckOnly') {
        Write-Output (InvokeOwnerHelper (@('--check-only') + $helperBase))
        Write-Output 'CHECK_ONLY. No owner input issued and no physical stage executed.'
    } elseif ($Mode -ceq 'Prepare') {
        Write-Output (InvokeOwnerHelper (@('--prepare') + $helperBase + @($ownerKit.outputParent)))
        Write-Output 'INPUT_PREPARED_ONLY. Send the full output for review. Do not execute until its hashes are separately reviewed.'
    } else {
        AssertOwnerArtifactLocation $InputDirectory 'input' $ownerKit.outputParent
        AssertOwnerPath $InputDirectory
        $planPath = Join-Path $InputDirectory 'plan.json'
        $approvalPath = Join-Path $InputDirectory 'approval.json'
        $plan = ReadOwnerJson $planPath $ExpectedPlanSha256
        $approval = ReadOwnerJson $approvalPath $ExpectedApprovalSha256
        AssertOwnerInputBinding $plan $approval $ownerKit $ExpectedPlanSha256 $InputDirectory
        if ([DateTimeOffset]::UtcNow -ge [DateTimeOffset]::Parse($plan.expiresUtc) -or
            [DateTimeOffset]::UtcNow -lt [DateTimeOffset]::Parse($plan.issuedUtc)) { throw 'OWNER_INPUT_EXPIRED_OR_FUTURE_DO_NOT_EDIT' }
        # Fresh read-only preflight cannot create an approval or auto-confirm.
        Write-Output (InvokeOwnerHelper (@('--check-only') + $helperBase))
        Write-Output 'ONE ATTEMPT ONLY. Type the full CONFIRM line in the reviewed controller. After any failure retain state and do not retry.'
        & (Join-Path $packageRoot 'ExportPolicyControl.exe') '--control-controller' $planPath $approvalPath $ExpectedPlanSha256 $ExpectedApprovalSha256 $ownerKit.packageSha256 $ownerKit.expectedOwnerSid
        if ($LASTEXITCODE -ne 0) { throw 'OWNER_EXECUTION_FAILED_OR_REFUSED_RETAIN_DO_NOT_RETRY' }
    }
    }
} finally {
    foreach ($handle in $ownerKitHandles) { $handle.Dispose() }
}
