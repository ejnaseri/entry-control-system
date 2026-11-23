[CmdletBinding()]param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$wrapperPath = Join-Path $PSScriptRoot 'run-license-export-policy-owner.ps1'
$parseTokens = $null; $parseErrors = $null
$wrapperAst = [Management.Automation.Language.Parser]::ParseFile($wrapperPath, [ref]$parseTokens, [ref]$parseErrors)
if ($parseErrors.Count -ne 0) { throw 'WRAPPER_PARSE_FAILED' }
# Load only pure environment/path/hash/result helpers, never the script body,
# native helper invocation, Prepare or Execute branches.
foreach ($name in @('AssertOwnerModeArguments', 'InvokeOwnerCleanEnvironment', 'AssertOwnerPathSyntax',
    'AssertOwnerArtifactLocation', 'AssertOwnerInputBinding', 'AssertOwnerPath', 'ReadOwnerFile', 'ReadOwnerJson', 'AssertOwnerRuntime',
    'GetOwnerHelperFailure', 'ResolveOwnerHelperResult')) {
    $function = @($wrapperAst.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] }, $false) |
        Where-Object Name -CEQ $name)
    if ($function.Count -ne 1) { throw 'WRAPPER_HELPER_MISSING' }
    . ([scriptblock]::Create($function[0].Extent.Text))
}
$script:ownerWrapperCases = 0
function Check([bool]$ok) { $script:ownerWrapperCases++; if (-not $ok) { throw "WRAPPER_CHECK_FAILED_$script:ownerWrapperCases" } }
function Reject([scriptblock]$action, [string]$reason) {
    $failed = $false
    try { $null = & $action } catch { $failed = $_.Exception.Message -ceq $reason }
    Check $failed
}
function FailureFixture([string]$stage = 'owner-token-membership', [string]$category = 'ACCESS_DENIED', [int]$nativeResult = -2147024891) {
    return ([ordered]@{
        schemaVersion = 1
        scope = 'TEST_ONLY_EXPORT_POLICY_OWNER_FAILURE_V1'
        stage = $stage
        code = 'INPUT_STAGE_FAILED_OR_REFUSED'
        category = $category
        hResult = $nativeResult
    } | ConvertTo-Json -Compress)
}

# Exercise the actual mode/location/input guards with synthetic strings and
# objects. These fixtures never invoke a helper, issue inputs or open a service.
$fixtureParent = 'E:\EntryControlSystem\out'
$fixtureAttempt = 'b' * 32
$fixtureInput = $fixtureParent + '\lic008-export-policy-v5-input-' + $fixtureAttempt
$fixturePin = 'a' * 64
foreach ($mode in @('CheckOnly', 'Prepare')) {
    AssertOwnerModeArguments $mode $fixturePin '' '' ''
    Check $true
    foreach ($extra in @(
        @($fixtureInput, '', ''), @('', $fixturePin, ''), @('', '', $fixturePin),
        @($fixtureInput, $fixturePin, $fixturePin))) {
        Reject { AssertOwnerModeArguments $mode $fixturePin $extra[0] $extra[1] $extra[2] } 'OWNER_INPUT_ARGUMENTS_REFUSED'
    }
}
AssertOwnerModeArguments 'Execute' $fixturePin $fixtureInput $fixturePin $fixturePin
Check $true
foreach ($mode in @('checkonly', 'prepare', 'execute', 'Unknown', '')) {
    Reject { AssertOwnerModeArguments $mode $fixturePin '' '' '' } 'OWNER_MODE_CASE_REFUSED'
}
foreach ($mode in @('CheckOnly', 'Prepare', 'Execute')) {
    foreach ($badPin in @('', ('A' * 64), ('g' * 64), ('a' * 63))) {
        Reject { AssertOwnerModeArguments $mode $badPin '' '' '' } 'REVIEWED_KIT_PIN_REQUIRED'
    }
}
foreach ($missing in @(
    @('', $fixturePin, $fixturePin), @(' ', $fixturePin, $fixturePin),
    @($fixtureInput, '', $fixturePin), @($fixtureInput, $fixturePin, ''),
    @($fixtureInput, ('A' * 64), $fixturePin), @($fixtureInput, $fixturePin, ('g' * 64)))) {
    Reject { AssertOwnerModeArguments 'Execute' $fixturePin $missing[0] $missing[1] $missing[2] } 'SEPARATELY_REVIEWED_OWNER_INPUT_REQUIRED'
}
foreach ($kind in @('owner-kit', 'capable', 'input')) {
    $location = $fixtureParent + '\lic008-export-policy-v5-' + $kind + '-' + $fixtureAttempt
    AssertOwnerArtifactLocation $location $kind
    Check $true
    AssertOwnerArtifactLocation $location $kind $fixtureParent
    Check $true
    foreach ($priorOrWrong in @(
        $location.Replace('export-policy-v5-', 'export-policy-'),
        $location.Replace('export-policy-v5-', 'export-policy-v1-'),
        $location.Replace('export-policy-v5-', 'export-policy-v2-'),
        $location.Replace('export-policy-v5-', 'export-policy-v3-'),
        $location.Replace('export-policy-v5-', 'export-policy-v4-'),
        $location.Replace('export-policy-v5-', 'export-policy-V5-'),
        $location.Replace($fixtureAttempt, ('B' * 32)),
        $location.Substring(0, $location.Length - 1), ($location + '0'),
        $location.Replace('\out\', '\other\'),
        $location.Replace('\out\', '\out\nested\'))) {
        Reject { AssertOwnerArtifactLocation $priorOrWrong $kind $fixtureParent } 'OWNER_ARTIFACT_LOCATION_REFUSED'
    }
    Reject { AssertOwnerArtifactLocation $location $kind '' } 'OWNER_PATH_REFUSED'
}
Reject { AssertOwnerArtifactLocation $fixtureInput 'owner-kit' $fixtureParent } 'OWNER_ARTIFACT_LOCATION_REFUSED'
Reject { AssertOwnerArtifactLocation $fixtureInput 'capable' $fixtureParent } 'OWNER_ARTIFACT_LOCATION_REFUSED'
Reject { AssertOwnerArtifactLocation $fixtureInput 'INPUT' $fixtureParent } 'OWNER_ARTIFACT_LOCATION_REFUSED'
foreach ($path in @(('e:\out\lic008-export-policy-v5-input-' + $fixtureAttempt),
    ('\\server\out\lic008-export-policy-v5-input-' + $fixtureAttempt), ($fixtureInput + ':data'))) {
    Reject { AssertOwnerArtifactLocation $path 'input' $fixtureParent } 'OWNER_PATH_REFUSED'
}
function InputBindingFixture {
    $kit = [pscustomobject]@{ outputParent = $fixtureParent; expectedOwnerSid = 'S-1-5-21-1-2-3-1001'; packageSha256 = 'c' * 64 }
    $plan = [pscustomobject][ordered]@{ schemaVersion = 1; scope = 'TEST_ONLY_EXPORT_POLICY_CONTROL_V5';
        attemptId = $fixtureAttempt; ownerSid = $kit.expectedOwnerSid; packageSha256 = $kit.packageSha256 }
    $approval = [pscustomobject][ordered]@{ schemaVersion = 1; scope = 'TEST_ONLY_EXPORT_POLICY_OWNER_APPROVAL_V5';
        attemptId = $fixtureAttempt; ownerSid = $kit.expectedOwnerSid; packageSha256 = $kit.packageSha256; planSha256 = '' }
    return [pscustomobject]@{ Plan = $plan; Approval = $approval; Kit = $kit }
}
function BindFixturePlan($fixture) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { $hash = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(
        ($fixture.Plan | ConvertTo-Json -Compress))))).Replace('-', '').ToLowerInvariant() }
    finally { $sha.Dispose() }
    $fixture.Approval.planSha256 = $hash
    return $hash
}
$binding = InputBindingFixture
$planPin = BindFixturePlan $binding
AssertOwnerInputBinding $binding.Plan $binding.Approval $binding.Kit $planPin $fixtureInput
Check $true
# Rehash each plan and update its approval, so prior-version rejection proves the purpose
# boundary rather than an accidentally stale plan pin. Cover both mixed ways.
foreach ($planVersion in 1..5) {
foreach ($approvalVersion in 1..5) {
    if ($planVersion -eq 5 -and $approvalVersion -eq 5) { continue }
    $binding = InputBindingFixture
    $binding.Plan.scope = 'TEST_ONLY_EXPORT_POLICY_CONTROL_V' + $planVersion
    $binding.Approval.scope = 'TEST_ONLY_EXPORT_POLICY_OWNER_APPROVAL_V' + $approvalVersion
    $planPin = BindFixturePlan $binding
    Reject { AssertOwnerInputBinding $binding.Plan $binding.Approval $binding.Kit $planPin $fixtureInput } 'OWNER_INPUT_BINDING_REFUSED'
}
}
foreach ($mutation in @(
    @('Plan', 'schemaVersion', 2), @('Approval', 'schemaVersion', 2),
    @('Plan', 'ownerSid', 'S-1-5-21-4-5-6-1001'), @('Approval', 'ownerSid', 'S-1-5-21-4-5-6-1001'),
    @('Plan', 'packageSha256', ('d' * 64)), @('Approval', 'packageSha256', ('d' * 64)),
    @('Plan', 'attemptId', ('d' * 32)), @('Approval', 'attemptId', ('d' * 32)))) {
    $binding = InputBindingFixture
    $binding.($mutation[0]).($mutation[1]) = $mutation[2]
    $planPin = BindFixturePlan $binding
    Reject { AssertOwnerInputBinding $binding.Plan $binding.Approval $binding.Kit $planPin $fixtureInput } 'OWNER_INPUT_BINDING_REFUSED'
}
$binding = InputBindingFixture
$planPin = BindFixturePlan $binding
Reject { AssertOwnerInputBinding $binding.Plan $binding.Approval $binding.Kit ('e' * 64) $fixtureInput } 'OWNER_INPUT_BINDING_REFUSED'
foreach ($wrongInput in @($fixtureInput.Replace('export-policy-v5-', 'export-policy-'),
    $fixtureInput.Replace('export-policy-v5-', 'export-policy-v1-'),
    $fixtureInput.Replace('export-policy-v5-', 'export-policy-v2-'),
    $fixtureInput.Replace('export-policy-v5-', 'export-policy-v3-'),
    $fixtureInput.Replace('export-policy-v5-', 'export-policy-v4-'),
    $fixtureInput.Replace('\out\', '\other\'))) {
    Reject { AssertOwnerInputBinding $binding.Plan $binding.Approval $binding.Kit $planPin $wrongInput } 'OWNER_ARTIFACT_LOCATION_REFUSED'
}
$wrongAttemptInput = $fixtureInput.Replace($fixtureAttempt, ('d' * 32))
Reject { AssertOwnerInputBinding $binding.Plan $binding.Approval $binding.Kit $planPin $wrongAttemptInput } 'OWNER_INPUT_BINDING_REFUSED'

$savedNames = @{}
foreach ($name in [Environment]::GetEnvironmentVariables().Keys) {
    if ($name -match '^(DOTNET_|COMPLUS_|CORECLR_|COR_|COREHOST_)' -or
        $name -in @('APPDOMAIN_MANAGER_ASM', 'APPDOMAIN_MANAGER_TYPE', 'DEVPATH', '__COMPAT_LAYER')) {
        $savedNames[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
    }
}
$persistentUser = [Environment]::GetEnvironmentVariable('DOTNET_ROOT', 'User')
$persistentMachine = [Environment]::GetEnvironmentVariable('DOTNET_ROOT', 'Machine')
$ownerKitHandles = New-Object 'System.Collections.Generic.List[System.IDisposable]'
try {
    # Synthetic environment fixtures change this test process only; restore all
    # saved values even if an assertion fails. Never change User/Machine targets.
    foreach ($name in $savedNames.Keys) { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
    [Environment]::SetEnvironmentVariable('DOTNET_ROOT', 'synthetic-owner-test', 'Process')
    $script:ownerActionCalls = 0
    $null = InvokeOwnerCleanEnvironment {
        Check (-not (Test-Path -LiteralPath Env:\DOTNET_ROOT))
        $script:ownerActionCalls++
    }
    Check ($script:ownerActionCalls -eq 1)
    Check ($env:DOTNET_ROOT -ceq 'synthetic-owner-test')
    Reject { InvokeOwnerCleanEnvironment { throw 'SYNTHETIC_ACTION_FAILURE' } } 'SYNTHETIC_ACTION_FAILURE'
    Check ($env:DOTNET_ROOT -ceq 'synthetic-owner-test')
    foreach ($name in @('DOTNET_STARTUP_HOOKS', 'DOTNET_ROOT_X64', 'COMPLUS_ReadyToRun', 'CORECLR_ENABLE_PROFILING',
        'COR_ENABLE_PROFILING', 'COREHOST_TRACE', 'APPDOMAIN_MANAGER_ASM', 'APPDOMAIN_MANAGER_TYPE', 'DEVPATH', '__COMPAT_LAYER')) {
        try {
            [Environment]::SetEnvironmentVariable($name, 'synthetic', 'Process')
            Reject { InvokeOwnerCleanEnvironment { $script:ownerActionCalls++ } } 'OWNER_RUNTIME_OVERRIDE_REFUSED'
            Check ($script:ownerActionCalls -eq 1 -and $env:DOTNET_ROOT -ceq 'synthetic-owner-test')
            Check ([Environment]::GetEnvironmentVariable($name, 'Process') -ceq 'synthetic')
        } finally { [Environment]::SetEnvironmentVariable($name, $null, 'Process') }
    }
    [Environment]::SetEnvironmentVariable('DOTNET_ROOT', $null, 'Process')
    $null = InvokeOwnerCleanEnvironment { Check (-not (Test-Path -LiteralPath Env:\DOTNET_ROOT)) }
    Check (-not (Test-Path -LiteralPath Env:\DOTNET_ROOT))
    foreach ($path in @('', '\\server\share\input.json', 'C:relative.json', 'C:\test\..\input.json',
        'C:\test\input.json:stream', 'C:\test\bad"name.json', 'C:\test\trailing.\input.json')) {
        $failed = $false
        try { AssertOwnerPath $path } catch { $failed = $true }
        Check $failed
    }
    $wrapperBytes = [IO.File]::ReadAllBytes($wrapperPath)
    $wrapperHash = (Get-FileHash -LiteralPath $wrapperPath -Algorithm SHA256).Hash.ToLowerInvariant()
    $readBytes = ReadOwnerFile $wrapperPath $wrapperHash
    Check ([Convert]::ToBase64String($readBytes) -ceq [Convert]::ToBase64String($wrapperBytes))
    Reject { ReadOwnerFile $wrapperPath ('a' * 64) } 'OWNER_FILE_PIN_MISMATCH'
    Reject { ReadOwnerFile $wrapperPath $wrapperHash 1 } 'OWNER_FILE_SIZE_REFUSED'
    Reject { ReadOwnerFile $wrapperPath 'bad' } 'OWNER_FILE_PIN_REFUSED'
    foreach ($inventory in @(
        [pscustomobject]@{ schemaVersion = 0; runtime = '10.0.11'; files = @() },
        [pscustomobject]@{ schemaVersion = 1; runtime = '10.0.1'; files = @() },
        [pscustomobject]@{ schemaVersion = 1; runtime = '10.0.11'; files = @() }
    )) { Reject { AssertOwnerRuntime $inventory } 'OWNER_RUNTIME_SCHEMA_REFUSED' }
    Check ([Environment]::GetEnvironmentVariable('DOTNET_ROOT', 'User') -ceq $persistentUser)
    Check ([Environment]::GetEnvironmentVariable('DOTNET_ROOT', 'Machine') -ceq $persistentMachine)

    $diagnostic = FailureFixture
    $safeMessage = 'OWNER_HELPER_FAILED_OR_REFUSED_RETAIN; ExitCode=1; Stage=owner-token-membership; Category=ACCESS_DENIED; Code=INPUT_STAGE_FAILED_OR_REFUSED; HResult=-2147024891'
    $fallback = 'OWNER_HELPER_FAILED_OR_REFUSED_RETAIN; ExitCode=1; Diagnostic=UNAVAILABLE_OR_REFUSED'
    Check ((GetOwnerHelperFailure 1 $diagnostic) -ceq $safeMessage)
    Check ((GetOwnerHelperFailure 1 ("`r`n" + $diagnostic + "`r`n")) -ceq $safeMessage)
    foreach ($stage in @('arguments', 'pure-self-test', 'token-self-test-runtime', 'token-self-test-query-only',
        'token-self-test-corrected', 'capability', 'runtime', 'owner-token-open', 'owner-token-membership',
        'owner-token-shape', 'environment', 'candidate', 'runtime-inventory', 'host-binding', 'guardian',
        'fresh-setup', 'test-root', 'preparation', 'preparation-write', 'preparation-readback', 'output')) {
        Check ((GetOwnerHelperFailure 1 (FailureFixture $stage)) -ceq $safeMessage.Replace('Stage=owner-token-membership;', ('Stage=' + $stage + ';')))
    }
    foreach ($category in @('SECURITY', 'ACCESS_DENIED', 'INVALID_DATA', 'IO', 'ARGUMENT', 'JSON',
        'NATIVE', 'STATE', 'UNSUPPORTED', 'EXCEPTION')) {
        Check ((GetOwnerHelperFailure 1 (FailureFixture 'owner-token-membership' $category)) -ceq $safeMessage.Replace('Category=ACCESS_DENIED;', ('Category=' + $category + ';')))
    }
    foreach ($nativeResult in @([int]::MinValue, [int]::MaxValue, 0, -1)) {
        Check ((GetOwnerHelperFailure 1 (FailureFixture 'owner-token-membership' 'NATIVE' $nativeResult)) -ceq
            ($safeMessage.Replace('Category=ACCESS_DENIED;', 'Category=NATIVE;').Replace('HResult=-2147024891', ('HResult=' + $nativeResult.ToString([Globalization.CultureInfo]::InvariantCulture)))))
    }
    foreach ($exitCode in @([int]::MinValue, [int]::MaxValue, -1, 2)) {
        Check ((GetOwnerHelperFailure $exitCode $diagnostic) -ceq $safeMessage.Replace('ExitCode=1;', ('ExitCode=' + $exitCode.ToString([Globalization.CultureInfo]::InvariantCulture) + ';')))
    }
    $privateText = 'UNTRUSTED_PRIVATE_BLOB_C:\\Secret\\private-key.json'
    $malformed = @(
        '', ' ', 'not json', 'null', '[]', ('[' + $diagnostic + ']'), ('"' + $privateText + '"'),
        ($diagnostic + $privateText), ($diagnostic + $diagnostic), ($diagnostic + (' ' * 1025)),
        $diagnostic.Replace('"schemaVersion":1', '"schemaVersion":2'),
        $diagnostic.Replace('"schemaVersion":1', '"schemaVersion":"1"'),
        $diagnostic.Replace('"schemaVersion":1', '"schemaVersion":true'),
        $diagnostic.Replace('TEST_ONLY_EXPORT_POLICY_OWNER_FAILURE_V1', 'UNKNOWN_SCOPE'),
        $diagnostic.Replace('owner-token-membership', 'unknown-stage'),
        $diagnostic.Replace('owner-token-membership', 'OWNER-TOKEN-MEMBERSHIP'),
        $diagnostic.Replace('owner-token-membership', $privateText),
        $diagnostic.Replace('ACCESS_DENIED', 'UNKNOWN_CATEGORY'),
        $diagnostic.Replace('ACCESS_DENIED', 'access_denied'),
        $diagnostic.Replace('ACCESS_DENIED', $privateText),
        $diagnostic.Replace('INPUT_STAGE_FAILED_OR_REFUSED', 'UNKNOWN_CODE'),
        $diagnostic.Replace('INPUT_STAGE_FAILED_OR_REFUSED', $privateText),
        $diagnostic.Replace('"hResult":-2147024891', '"hResult":2147483648'),
        $diagnostic.Replace('"hResult":-2147024891', '"hResult":-2147483649'),
        $diagnostic.Replace('"hResult":-2147024891', '"hResult":+1'),
        $diagnostic.Replace('"hResult":-2147024891', '"hResult":01'),
        $diagnostic.Replace('"hResult":-2147024891', '"hResult":1.0'),
        $diagnostic.Replace('"hResult":-2147024891', '"hResult":1e1'),
        $diagnostic.Replace('"hResult":-2147024891', '"hResult":"-2147024891"'),
        $diagnostic.Replace('"hResult":-2147024891', '"hResult":null'),
        $diagnostic.Replace('"hResult":-2147024891', '"hResult":false'),
        $diagnostic.Replace('"hResult":-2147024891', '"hResult":{}'),
        $diagnostic.Replace('"hResult":-2147024891', '"hResult":[]'),
        $diagnostic.Replace('"hResult":-2147024891', ('"hResult":-2147024891,"message":"' + $privateText + '"')),
        $diagnostic.Replace('"hResult":-2147024891', '"hResult":-2147024891,"hResult":0'),
        $diagnostic.Replace('"hResult":-2147024891', '"status":"PASS","hResult":-2147024891'),
        $diagnostic.Replace('"hResult":-2147024891', '"hResult":-2147024891,'),
        $diagnostic.Replace(',"hResult":-2147024891', ''),
        $diagnostic.Replace('"hResult":-2147024891', '"hResult":99999999999999999999'),
        $diagnostic.Replace('"stage":', '"Stage":'),
        $diagnostic.Replace('"stage":', '"st\u0061ge":'),
        $diagnostic.Replace('owner-token-membership', 'owner-token-member\u0073hip'),
        $diagnostic.Replace('"schemaVersion":1,', ''),
        $diagnostic.Replace('"schemaVersion":1,', '"schemaVersion":1,"schemaVersion":1,'),
        $diagnostic.Replace('"schemaVersion":1,', '/* untrusted */"schemaVersion":1,'),
        $diagnostic.Replace('"schemaVersion":1,"scope":"TEST_ONLY_EXPORT_POLICY_OWNER_FAILURE_V1",',
            '"scope":"TEST_ONLY_EXPORT_POLICY_OWNER_FAILURE_V1","schemaVersion":1,'),
        $diagnostic.Replace('"stage":"owner-token-membership"', ('"stage":"owner' + "`n" + '-token-membership"'))
    )
    foreach ($fixture in $malformed) {
        Check ((GetOwnerHelperFailure 1 $fixture) -ceq $fallback)
        Reject { Write-Output (ResolveOwnerHelperResult 1 $privateText $fixture) } $fallback
    }
    # Exercise the original nested capture pattern with the actual result
    # resolver. No process is started. Only the sanitized terminating message
    # survives; arbitrary stdout and exception details are never emitted.
    function InvokeOwnerNestedFailureFixture {
        Write-Output (ResolveOwnerHelperResult 1 $privateText $diagnostic)
        throw 'NESTED_FIXTURE_SHOULD_NOT_CONTINUE'
    }
    $nestedMessage = ''
    $nestedOutput = @()
    try { $nestedOutput = @(Write-Output (InvokeOwnerNestedFailureFixture)) }
    catch { $nestedMessage = $_.Exception.Message }
    Check ($nestedMessage -ceq $safeMessage)
    Check ($nestedOutput.Count -eq 0)
    Check (-not $nestedMessage.Contains($privateText))
    Reject { Write-Output (ResolveOwnerHelperResult 2 $privateText 'native host error with secret path C:\Secret\private-key.json') } 'OWNER_HELPER_FAILED_OR_REFUSED_RETAIN; ExitCode=2; Diagnostic=UNAVAILABLE_OR_REFUSED'
    Reject { ResolveOwnerHelperResult 0 $privateText $diagnostic } 'OWNER_HELPER_UNEXPECTED_STDERR'
    Reject { ResolveOwnerHelperResult 0 $privateText $privateText } 'OWNER_HELPER_UNEXPECTED_STDERR'
    Check ((ResolveOwnerHelperResult 0 "  CHECK_ONLY_OK`r`n" '') -ceq 'CHECK_ONLY_OK')
} finally {
    foreach ($handle in $ownerKitHandles) { $handle.Dispose() }
    [Environment]::SetEnvironmentVariable('DOTNET_ROOT', $null, 'Process')
    foreach ($name in $savedNames.Keys) { [Environment]::SetEnvironmentVariable($name, $savedNames[$name], 'Process') }
}
[ordered]@{
    scope = 'TEST_ONLY_EXPORT_POLICY_OWNER_WRAPPER_TESTS_V1'
    cases = $script:ownerWrapperCases
    helperExecuted = $false
    ownerInputIssued = $false
    physicalStageExecuted = $false
    securityAccepted = $false
    productionAccepted = $false
} | ConvertTo-Json
