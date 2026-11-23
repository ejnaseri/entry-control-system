[CmdletBinding()]param(
    [Parameter(Mandatory = $true)][string]$InertCandidate,
    [Parameter(Mandatory = $true)][string]$ExpectedManifestSha256,
    [Parameter(Mandatory = $true)][string]$ExpectedDllSha256
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Separate read-only regression, never a physical application entry. Each run
# creates new local evidence, and only queries its child's own process token.
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$outputParent = Join-Path $repo 'out'
$dotnet = 'C:\Program Files\dotnet\dotnet.exe'
$compiler = 'C:\Program Files\dotnet\sdk\10.0.400\Roslyn\bincore\csc.dll'
$referencesPath = 'C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Ref\10.0.11\ref\net10.0'
$sourcePath = Join-Path $repo 'licensing\adapter-evidence\export-policy-control\ControlScalarRegression.cs'
$baselinePath = Join-Path $outputParent 'lic008-export-policy-v2-capable-27db447d0004467087e3d021e7d4ab84\package\ExportPolicyControl.dll'
$baselinePin = 'add4b35d175e23bf37a420329db435bacce71a532c80fcd3e791bdaa72750b5f'

function Hash([string]$path) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() }
function RequirePlain([string]$path) {
    if ($path -cnotmatch '^[A-Z]:\\' -or $path.Length -gt 240 -or $path.Substring(3) -match '[\x00-\x1f:"/<>|?*]' -or
        [IO.Path]::GetFullPath($path) -cne $path) { throw 'SCALAR_REGRESSION_PATH_REFUSED' }
    foreach ($part in $path.Substring(3).Split('\')) {
        if (-not $part -or $part -in @('.', '..') -or $part.EndsWith('.') -or $part.EndsWith(' ')) { throw 'SCALAR_REGRESSION_PATH_REFUSED' }
    }
    for ($cursor = $path; $cursor; $cursor = [IO.Path]::GetDirectoryName($cursor)) {
        if (([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'SCALAR_REGRESSION_REPARSE_REFUSED' }
    }
}
function RequirePin([string]$path, [string]$expected) {
    RequirePlain $path
    if ($expected -cnotmatch '^[a-f0-9]{64}$' -or (Hash $path) -cne $expected) { throw 'SCALAR_REGRESSION_PIN_REFUSED' }
}
function WriteNew([string]$path, [byte[]]$bytes) {
    $stream = [IO.File]::Open($path, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::Read)
    try { $stream.Write($bytes, 0, $bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
}
function JsonNew([string]$name, $value) {
    WriteNew (Join-Path $destination $name) ([Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Depth 12 -Compress)))
}
function RunChild([string]$arguments) {
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName = $dotnet; $start.Arguments = $arguments
    $start.UseShellExecute = $false; $start.CreateNoWindow = $true
    $start.RedirectStandardOutput = $true; $start.RedirectStandardError = $true
    foreach ($name in @($start.EnvironmentVariables.Keys)) {
        if ($name -match '^(DOTNET_|COMPLUS_|CORECLR_|COR_|COREHOST_)' -or
            $name -in @('APPDOMAIN_MANAGER_ASM', 'APPDOMAIN_MANAGER_TYPE', 'DEVPATH', '__COMPAT_LAYER')) {
            $start.EnvironmentVariables.Remove($name)
        }
    }
    $process = [Diagnostics.Process]::Start($start)
    try {
        $stdout = $process.StandardOutput.ReadToEndAsync(); $stderr = $process.StandardError.ReadToEndAsync()
        if (-not $process.WaitForExit(30000)) { throw 'SCALAR_REGRESSION_CHILD_UNRESOLVED_RETAIN' }
        if ($stdout.Result.Length -gt 65536 -or $stderr.Result.Length -gt 65536) { throw 'SCALAR_REGRESSION_OUTPUT_BOUND_REFUSED' }
        [pscustomobject]@{ exitCode = $process.ExitCode; stdout = $stdout.Result; stderr = $stderr.Result }
    } finally { $process.Dispose() }
}

# Validate the separately built inert target before creating any new output.
RequirePlain $InertCandidate
if ([IO.Path]::GetDirectoryName($InertCandidate) -cne $outputParent -or
    [IO.Path]::GetFileName($InertCandidate) -cnotmatch '^lic008-export-policy-v5-inert-[a-f0-9]{32}$') {
    throw 'SCALAR_REGRESSION_INERT_LOCATION_REFUSED'
}
$manifestPath = Join-Path $InertCandidate 'manifest.json'
RequirePin $manifestPath $ExpectedManifestSha256
$candidate = [IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json
if ($candidate.scope -cne 'TEST_ONLY_EXPORT_POLICY_CONTROL_INERT_BUILD_V5' -or
    $candidate.physicalExecutionEnabled -ne $false -or $candidate.physicalTested -ne $false -or
    $candidate.securityAccepted -ne $false -or $candidate.productionAccepted -ne $false -or
    $candidate.variants.Count -ne 2 -or $candidate.variants[0].variant -cne 'default' -or
    $candidate.variants[0].dllSha256 -cne $ExpectedDllSha256) { throw 'SCALAR_REGRESSION_INERT_MANIFEST_REFUSED' }
$packagePath = Join-Path $InertCandidate 'package-manifest.json'
RequirePin $packagePath $candidate.packageManifestSha256
$package = [IO.File]::ReadAllText($packagePath) | ConvertFrom-Json
if ($package.schemaVersion -ne 1 -or $package.scope -cne 'TEST_ONLY_EXPORT_POLICY_PACKAGE_V5' -or
    $package.files.Count -ne 4 -or $package.files[1].name -cne 'ExportPolicyControl.dll' -or
    $package.files[1].sha256 -cne $ExpectedDllSha256 -or $ExpectedDllSha256 -ceq $baselinePin) {
    throw 'SCALAR_REGRESSION_PACKAGE_REFUSED'
}
$correctedPath = Join-Path $InertCandidate 'package\ExportPolicyControl.dll'
RequirePin $correctedPath $ExpectedDllSha256
RequirePin $baselinePath $baselinePin
foreach ($path in @($sourcePath, $PSCommandPath, $dotnet, $compiler, $referencesPath, $outputParent)) { RequirePlain $path }
$sourcePin = Hash $sourcePath
$runnerPin = Hash $PSCommandPath
$tools = @($dotnet, $compiler) | ForEach-Object { [ordered]@{ path = $_; sha256 = (Hash $_) } }
$references = @(Get-ChildItem -LiteralPath $referencesPath -Filter '*.dll' | Sort-Object Name | ForEach-Object {
    RequirePlain $_.FullName
    [ordered]@{ path = $_.FullName; sha256 = (Hash $_.FullName) }
})
if ($references.Count -eq 0) { throw 'SCALAR_REGRESSION_REFERENCES_MISSING' }
$destination = Join-Path $outputParent ('lic008-export-policy-scalar-regression-' + [guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $destination
WriteNew (Join-Path $destination 'ControlScalarRegression.cs') ([IO.File]::ReadAllBytes($sourcePath))
WriteNew (Join-Path $destination 'test-license-export-policy-scalar.ps1') ([IO.File]::ReadAllBytes($PSCommandPath))
RequirePin (Join-Path $destination 'ControlScalarRegression.cs') $sourcePin
RequirePin (Join-Path $destination 'test-license-export-policy-scalar.ps1') $runnerPin
JsonNew 'input-pins.json' ([ordered]@{
    schemaVersion = 1; scope = 'TEST_ONLY_EXPORT_POLICY_SCALAR_REGRESSION_INPUTS_V1'
    sourceSha256 = $sourcePin; runnerSha256 = $runnerPin; tools = @($tools); references = $references
    baselineAssembly = $baselinePath; baselineAssemblySha256 = $baselinePin
    correctedAssembly = $correctedPath; correctedAssemblySha256 = $ExpectedDllSha256
    inertManifestSha256 = $ExpectedManifestSha256; packageManifestSha256 = $candidate.packageManifestSha256
    runtimeInventorySha256 = $candidate.runtimeInventorySha256
})
$dll = Join-Path $destination 'ControlScalarRegression.dll'
$responsePath = Join-Path $destination 'compile.rsp'
$compileArgs = @('-nologo', '-target:exe', '-platform:x64', '-nullable:enable', '-warnaserror+', ('-out:"' + $dll + '"'))
$compileArgs += @($references | ForEach-Object { '-r:"' + $_.path + '"' })
$compileArgs += '"' + (Join-Path $destination 'ControlScalarRegression.cs') + '"'
WriteNew $responsePath ([Text.Encoding]::UTF8.GetBytes(($compileArgs -join [Environment]::NewLine)))
$compiled = RunChild ('exec --fx-version 10.0.11 "' + $compiler + '" -noconfig "@' + $responsePath + '"')
WriteNew (Join-Path $destination 'compile-stdout.txt') ([Text.Encoding]::UTF8.GetBytes($compiled.stdout))
WriteNew (Join-Path $destination 'compile-stderr.txt') ([Text.Encoding]::UTF8.GetBytes($compiled.stderr))
if ($compiled.exitCode -ne 0 -or $compiled.stderr.Length -ne 0) { throw 'SCALAR_REGRESSION_COMPILE_FAILED' }
JsonNew 'ControlScalarRegression.runtimeconfig.json' ([ordered]@{
    runtimeOptions = [ordered]@{ tfm = 'net10.0'; framework = [ordered]@{ name = 'Microsoft.NETCore.App'; version = '10.0.11' }; rollForward = 'Disable' }
})
foreach ($entry in @($tools) + $references) { RequirePin $entry.path $entry.sha256 }
RequirePin $manifestPath $ExpectedManifestSha256
RequirePin $packagePath $candidate.packageManifestSha256
RequirePin $sourcePath $sourcePin
RequirePin $PSCommandPath $runnerPin
RequirePin $baselinePath $baselinePin
RequirePin $correctedPath $ExpectedDllSha256
$started = [DateTimeOffset]::UtcNow.ToString('O')
$result = RunChild ('exec --fx-version 10.0.11 "' + $dll + '" --own-token "' + $baselinePath + '" ' +
    $baselinePin + ' "' + $correctedPath + '" ' + $ExpectedDllSha256)
$finished = [DateTimeOffset]::UtcNow.ToString('O')
WriteNew (Join-Path $destination 'result.json') ([Text.Encoding]::UTF8.GetBytes($result.stdout))
WriteNew (Join-Path $destination 'stderr.txt') ([Text.Encoding]::UTF8.GetBytes($result.stderr))
RequirePin $baselinePath $baselinePin
RequirePin $correctedPath $ExpectedDllSha256
$outputs = @(Get-ChildItem -LiteralPath $destination -File | Sort-Object Name | ForEach-Object {
    [ordered]@{ name = $_.Name; size = $_.Length; sha256 = (Hash $_.FullName) }
})
JsonNew 'manifest.json' ([ordered]@{
    schemaVersion = 1; scope = 'TEST_ONLY_EXPORT_POLICY_SCALAR_REGRESSION_BUILD_V1'
    startedUtc = $started; finishedUtc = $finished; exitCode = $result.exitCode; stderrEmpty = ($result.stderr.Length -eq 0)
    outputs = $outputs; baselineAssemblySha256 = $baselinePin; correctedAssemblySha256 = $ExpectedDllSha256
    elevationRequested = $false; serviceChanged = $false; keysReadOrChanged = $false; retainedArtifactsChanged = $false
    physicalStageExecuted = $false; securityAccepted = $false; productionAccepted = $false
})
if ($result.exitCode -ne 0 -or $result.stderr.Length -ne 0) { throw 'SCALAR_REGRESSION_NOT_PASSED_RETAIN_OUTPUT' }
$report = $result.stdout | ConvertFrom-Json
if ($report.schemaVersion -ne 1 -or $report.scope -cne 'TEST_ONLY_EXPORT_POLICY_SCALAR_REGRESSION_V1' -or
    $report.runtime -cne '10.0.11' -or $report.requestedTokenAccess -ne 8 -or
    $report.baselineAssemblySha256 -cne $baselinePin -or $report.correctedAssemblySha256 -cne $ExpectedDllSha256 -or
    $report.observations.Count -ne 2) { throw 'SCALAR_REGRESSION_REPORT_REFUSED' }
foreach ($name in @('tokenOpenSucceeded', 'isolatedLoadContexts', 'ordinaryPrimary', 'directReadsAgree',
    'baselineFailureReproduced', 'correctedMatchesDirect', 'baselineTypeUnchanged', 'passed')) {
    if ($report.$name -isnot [bool] -or $report.$name -ne $true) { throw 'SCALAR_REGRESSION_REPORT_REFUSED' }
}
foreach ($name in @('localSystemServiceContextReproduced', 'elevationRequested', 'serviceChanged', 'keysReadOrChanged',
    'retainedArtifactsChanged', 'physicalStageExecuted', 'securityAccepted', 'productionAccepted')) {
    if ($report.$name -isnot [bool] -or $report.$name -ne $false) { throw 'SCALAR_REGRESSION_REPORT_REFUSED' }
}
Write-Output $result.stdout.Trim()
Write-Output ('Regression directory: ' + $destination)
Write-Output ('Manifest SHA256: ' + (Hash (Join-Path $destination 'manifest.json')))
