[CmdletBinding()]param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$builderPath = Join-Path $PSScriptRoot 'build-license-export-policy-owner-kit.ps1'
$parseTokens = $null; $parseErrors = $null
$builderAst = [Management.Automation.Language.Parser]::ParseFile($builderPath, [ref]$parseTokens, [ref]$parseErrors)
if ($parseErrors.Count -ne 0) { throw 'OWNER_KIT_BUILDER_PARSE_FAILED' }
# Load only the three pure report validators. Never evaluate the builder body,
# its process launcher, compilation, native token test, helper or controller.
foreach ($name in @('ReadOwnerKitTestJson', 'AssertOwnerHelperArgumentRefusal', 'AssertOwnerTokenTestReport')) {
    $function = @($builderAst.FindAll({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] }, $false) |
        Where-Object Name -CEQ $name)
    if ($function.Count -ne 1) { throw 'OWNER_KIT_VALIDATOR_MISSING' }
    . ([scriptblock]::Create($function[0].Extent.Text))
}
$script:ownerKitValidationCases = 0
function Check([bool]$ok, [string]$label) {
    $script:ownerKitValidationCases++
    if (-not $ok) { throw ('OWNER_KIT_VALIDATION_FAILED_' + $script:ownerKitValidationCases + ':' + $label) }
}
function Reject([scriptblock]$action, [string]$label) {
    $rejected = $false
    try { $null = & $action } catch { $rejected = $true }
    Check $rejected $label
}
function TokenFixture([bool]$administrator = $false, [int]$elevation = 0) {
    return [ordered]@{
        schemaVersion = 1; scope = 'TEST_ONLY_EXPORT_POLICY_OWNER_TOKEN_TEST_V1'; cases = 9; runtime = '10.0.11'
        queryOnlyDuplicateAccessDenied = $true; queryOnlyMembershipSecurityException = $true
        queryOnlyHResult = -2146233078; correctedMembershipSucceeded = $true
        isAdministrator = $administrator; elevation = $elevation; primaryToken = $true; impersonationAbsent = $true
        ownerInputIssued = $false; physicalStageExecuted = $false; securityAccepted = $false; productionAccepted = $false
    }
}
function FailureFixture {
    return [ordered]@{
        schemaVersion = 1; scope = 'TEST_ONLY_EXPORT_POLICY_OWNER_FAILURE_V1'; stage = 'arguments'
        code = 'INPUT_STAGE_FAILED_OR_REFUSED'; category = 'INVALID_DATA'; hResult = -2146233087
    }
}
function Json($value) { return ($value | ConvertTo-Json -Depth 4 -Compress) }
function TokenResult([string]$json) { return [pscustomobject]@{ ExitCode = 0; Stdout = $json; Stderr = '' } }
function FailureResult([string]$json) { return [pscustomobject]@{ ExitCode = 1; Stdout = ''; Stderr = $json } }

$ordinary = Json (TokenFixture)
$elevated = Json (TokenFixture $true 1)
$failure = Json (FailureFixture)
$tokenNames = @((TokenFixture).Keys)
$failureNames = @((FailureFixture).Keys)
foreach ($json in @($ordinary, $elevated)) {
    $report = AssertOwnerTokenTestReport (TokenResult $json)
    Check ((Json $report) -ceq $json) 'valid token report preserved'
    Check ($report.ownerInputIssued -eq $false -and $report.physicalStageExecuted -eq $false) 'no authority from token report'
}
$ordinaryReport = AssertOwnerTokenTestReport (TokenResult $ordinary)
Check ($ordinaryReport.isAdministrator -eq $false -and $ordinaryReport.elevation -eq 0) 'ordinary token is accepted as observation'
$elevatedReport = AssertOwnerTokenTestReport (TokenResult $elevated)
Check ($elevatedReport.isAdministrator -eq $true -and $elevatedReport.elevation -eq 1) 'elevated token is accepted as observation'
$null = AssertOwnerHelperArgumentRefusal (FailureResult $failure)
Check $true 'canonical argument refusal'
Check ((Json (ReadOwnerKitTestJson $ordinary $tokenNames)) -ceq $ordinary) 'direct token JSON'
Check ((Json (ReadOwnerKitTestJson $failure $failureNames)) -ceq $failure) 'direct refusal JSON'
Check ((Json (ReadOwnerKitTestJson ("`r`n" + $ordinary + "`r`n") $tokenNames)) -ceq $ordinary) 'outer whitespace permitted'

# Every required true/false flag must retain both its meaning and boolean type.
foreach ($name in @('queryOnlyDuplicateAccessDenied', 'queryOnlyMembershipSecurityException',
    'correctedMembershipSucceeded', 'primaryToken', 'impersonationAbsent',
    'ownerInputIssued', 'physicalStageExecuted', 'securityAccepted', 'productionAccepted')) {
    $original = (TokenFixture)[$name]
    foreach ($value in @((!$original), 0, 1, 'false', 'true', $null, @($original))) {
        $bad = TokenFixture; $bad[$name] = $value; $json = Json $bad
        Reject { AssertOwnerTokenTestReport (TokenResult $json) } ('token flag ' + $name)
    }
}
foreach ($value in @(0, 1, 'false', 'true', $null, @($false))) {
    $bad = TokenFixture; $bad.isAdministrator = $value; $json = Json $bad
    Reject { AssertOwnerTokenTestReport (TokenResult $json) } 'administrator requires boolean'
}
foreach ($name in @('schemaVersion', 'cases', 'elevation', 'queryOnlyHResult')) {
    $valid = (TokenFixture)[$name]
    foreach ($value in @([string]$valid, $true, $null, @($valid), [ordered]@{ value = $valid })) {
        $bad = TokenFixture; $bad[$name] = $value; $json = Json $bad
        Reject { AssertOwnerTokenTestReport (TokenResult $json) } ('token integer type ' + $name)
    }
}
foreach ($change in @(
    @('schemaVersion', 0), @('schemaVersion', 2), @('cases', 0), @('cases', 8), @('cases', 10),
    @('elevation', -1), @('elevation', 2), @('queryOnlyHResult', 0),
    @('scope', 'UNKNOWN_SCOPE'), @('runtime', '10.0.10'), @('runtime', '10.0.12'))) {
    $bad = TokenFixture; $bad[$change[0]] = $change[1]; $json = Json $bad
    Reject { AssertOwnerTokenTestReport (TokenResult $json) } ('token value ' + $change[0])
}
foreach ($name in @('scope', 'runtime')) {
    $valid = (TokenFixture)[$name]
    foreach ($value in @($null, 1, $true, @($valid), @(), [ordered]@{ value = $valid })) {
        $bad = TokenFixture; $bad[$name] = $value; $json = Json $bad
        Reject { AssertOwnerTokenTestReport (TokenResult $json) } ('token string type ' + $name)
    }
}

foreach ($name in $failureNames) {
    $valid = (FailureFixture)[$name]
    foreach ($value in @($null, $true, @($valid), @(), [ordered]@{ value = $valid })) {
        $bad = FailureFixture; $bad[$name] = $value; $json = Json $bad
        Reject { AssertOwnerHelperArgumentRefusal (FailureResult $json) } ('failure field type ' + $name)
    }
}
foreach ($change in @(
    @('schemaVersion', 0), @('schemaVersion', 2), @('schemaVersion', '1'),
    @('scope', 'UNKNOWN_SCOPE'), @('stage', 'owner-token-membership'), @('stage', 'Arguments'),
    @('code', 'UNKNOWN_CODE'), @('category', 'SECURITY'), @('category', 'invalid_data'),
    @('hResult', 0), @('hResult', '-2146233087'))) {
    $bad = FailureFixture; $bad[$change[0]] = $change[1]; $json = Json $bad
    Reject { AssertOwnerHelperArgumentRefusal (FailureResult $json) } ('failure value ' + $change[0])
}

# Closed schemas reject every missing or duplicated property, extra fields,
# noncanonical field order and arbitrary host/error text, even when valid JSON.
$canary = 'UNTRUSTED_PRIVATE_BLOB_C:\\Secret\\private-key.json'
foreach ($kind in @('token', 'failure')) {
    $canonical = if ($kind -ceq 'token') { $ordinary } else { $failure }
    $names = if ($kind -ceq 'token') { $tokenNames } else { $failureNames }
    foreach ($name in $names) {
        $bad = if ($kind -ceq 'token') { TokenFixture } else { FailureFixture }
        $bad.Remove($name); $json = Json $bad
        Reject { ReadOwnerKitTestJson $json $names } ('omitted ' + $kind + '/' + $name)
        $source = if ($kind -ceq 'token') { TokenFixture } else { FailureFixture }
        $fragment = '"' + $name + '":' + (Json $source[$name]) + ','
        $json = $canonical.Insert(1, $fragment)
        Reject { ReadOwnerKitTestJson $json $names } ('duplicate ' + $kind + '/' + $name)
    }
    $reordered = [ordered]@{}
    $source = if ($kind -ceq 'token') { TokenFixture } else { FailureFixture }
    for ($i = $names.Count - 1; $i -ge 0; $i--) { $reordered[$names[$i]] = $source[$names[$i]] }
    $invalid = @('', ' ', 'null', '[]', '{}', 'true', '1', 'not-json',
        ('[' + $canonical + ']'), ($canonical + $canonical), ($canonical + $canary),
        ('"' + $canary + '"'), (' ' * 16385), ($canonical + (' ' * 16385)),
        $canonical.Replace('"schemaVersion":1', '"schemaVersion":1.0'),
        $canonical.Replace('"schemaVersion":1', '"schemaVersion":1e0'),
        $canonical.Replace('"schemaVersion":1', '"schemaVersion":01'),
        $canonical.Replace('"schemaVersion":1', '"schemaVersion":2147483648'),
        $canonical.Replace('"schemaVersion":', '"SchemaVersion":'),
        $canonical.Replace('"schemaVersion":', '"schema\u0056ersion":'),
        $canonical.Replace('{', '{/* canary */'),
        $canonical.Replace('}', ',"message":"' + $canary + '"}'),
        $canonical.Replace('}', ',}'), (Json $reordered))
    foreach ($json in $invalid) {
        if ($kind -ceq 'token') { Reject { AssertOwnerTokenTestReport (TokenResult $json) } 'malformed token wire' }
        else { Reject { AssertOwnerHelperArgumentRefusal (FailureResult $json) } 'malformed failure wire' }
    }
}

foreach ($exitCode in @(-1, 1, 2, [int]::MinValue, [int]::MaxValue)) {
    $result = TokenResult $ordinary; $result.ExitCode = $exitCode
    Reject { AssertOwnerTokenTestReport $result } 'token exit code'
}
foreach ($exitCode in @(-1, 0, 2, [int]::MinValue, [int]::MaxValue)) {
    $result = FailureResult $failure; $result.ExitCode = $exitCode
    Reject { AssertOwnerHelperArgumentRefusal $result } 'failure exit code'
}
foreach ($stderr in @(' ', $failure, $canary)) {
    $result = TokenResult $ordinary; $result.Stderr = $stderr
    Reject { AssertOwnerTokenTestReport $result } 'token stderr must be empty'
}
foreach ($stdout in @(' ', $ordinary, $canary)) {
    $result = FailureResult $failure; $result.Stdout = $stdout
    Reject { AssertOwnerHelperArgumentRefusal $result } 'failure stdout must be empty'
}
foreach ($kind in @('token', 'failure')) {
    foreach ($name in @('ExitCode', 'Stdout', 'Stderr')) {
        $valid = if ($name -ceq 'ExitCode') { if ($kind -ceq 'token') { 0 } else { 1 } } else { '' }
        $wrongTypes = if ($name -ceq 'ExitCode') { @([string]$valid, $false, $null, @($valid)) }
            else { @(0, $false, $null, @('')) }
        foreach ($value in $wrongTypes) {
            $result = if ($kind -ceq 'token') { TokenResult $ordinary } else { FailureResult $failure }
            $result.$name = $value
            if ($kind -ceq 'token') { Reject { AssertOwnerTokenTestReport $result } ('token result type ' + $name) }
            else { Reject { AssertOwnerHelperArgumentRefusal $result } ('failure result type ' + $name) }
        }
    }
}

[ordered]@{
    scope = 'TEST_ONLY_EXPORT_POLICY_OWNER_KIT_VALIDATION_V1'
    cases = $script:ownerKitValidationCases
    nativeExecuted = $false
    ownerInputIssued = $false
    physicalStageExecuted = $false
    securityAccepted = $false
    productionAccepted = $false
} | ConvertTo-Json -Compress
