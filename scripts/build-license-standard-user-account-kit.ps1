[CmdletBinding()]param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$destination=Join-Path $repo ('out\lic008-standard-account-v1-kit-'+[guid]::NewGuid().ToString('N'))
$source=Join-Path $PSScriptRoot 'run-license-standard-user-account.ps1'
$tests=Join-Path $PSScriptRoot 'test-license-standard-user-account.ps1'
$parseErrors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($source,[ref]$null,[ref]$parseErrors)
if($parseErrors.Count -ne 0){throw 'ACCOUNT_KIT_SOURCE_PARSE_FAILED'}
# Import only contract and file-hash helpers. No source body, owner/token query,
# module import, password prompt, account operation or protected-root creation.
foreach($name in @('GetStandardAccountContract','RequireStandardAccount','StandardAccountHashBytes',
    'AssertStandardAccountPlainPath','StandardAccountHashFile','GetStandardAccountTools')) {
    $functions=@($ast.FindAll({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst]},$false) | Where-Object Name -CEQ $name)
    if($functions.Count -ne 1){throw 'ACCOUNT_KIT_HELPER_MISSING'}
    . ([scriptblock]::Create($functions[0].Extent.Text))
}
$contract=GetStandardAccountContract
RequireStandardAccount ($repo -ceq 'E:\EntryControlSystem' -and $PSVersionTable.PSVersion.ToString() -ceq '5.1.22000.2538' -and [IntPtr]::Size -eq 8) 'ACCOUNT_KIT_BUILD_HOST_REFUSED'
$tools=GetStandardAccountTools
$inputs=@(foreach($relative in @('scripts/run-license-standard-user-account.ps1','scripts/test-license-standard-user-account.ps1','scripts/build-license-standard-user-account-kit.ps1')) {
    [ordered]@{relative=$relative;sha256=(StandardAccountHashFile (Join-Path $repo $relative))}
})
$null=New-Item -ItemType Directory -Path $destination -ErrorAction Stop
function WriteAccountKitNew([string]$path,[byte[]]$bytes) {
    $stream=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
}
function AccountKitJsonNew([string]$path,$value){WriteAccountKitNew $path ([Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Depth 10 -Compress)))}
foreach($pair in @(@{source=$source;name='Run-Account.ps1'},@{source=$tests;name='Test-Account.ps1'})) {
    WriteAccountKitNew (Join-Path $destination $pair.name) ([IO.File]::ReadAllBytes($pair.source))
}
$snapshot=Join-Path $destination 'snapshot';$null=New-Item -ItemType Directory -Path $snapshot -ErrorAction Stop
foreach($item in $inputs){WriteAccountKitNew (Join-Path $snapshot ([IO.Path]::GetFileName($item.relative))) ([IO.File]::ReadAllBytes((Join-Path $repo $item.relative)))}
function InvokeAccountKitChild([string]$arguments) {
    $start=New-Object Diagnostics.ProcessStartInfo
    $start.FileName=$contract.powershell;$start.Arguments='-NoProfile -ExecutionPolicy Bypass '+$arguments
    $start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    $process=[Diagnostics.Process]::Start($start)
    try {
        $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
        if(-not $process.WaitForExit(30000)){throw ('ACCOUNT_KIT_CHILD_UNRESOLVED_RETAIN_PID_'+$process.Id)}
        [pscustomobject]@{exitCode=$process.ExitCode;stdout=$stdout.Result;stderr=$stderr.Result}
    } finally {$process.Dispose()}
}
$runner=Join-Path $destination 'Run-Account.ps1';$tester=Join-Path $destination 'Test-Account.ps1'
$tested=InvokeAccountKitChild ('-File "'+$tester+'" -SourcePath "'+$runner+'"')
RequireStandardAccount ($tested.exitCode -eq 0 -and $tested.stderr.Length -eq 0) 'ACCOUNT_KIT_PURE_TEST_FAILED'
$report=$tested.stdout | ConvertFrom-Json
RequireStandardAccount ($report.scope -ceq 'TEST_ONLY_STANDARD_USER_ACCOUNT_PURE_V1' -and $report.cases -eq 160 -and
    $report.accountCreated -eq $false -and $report.accountEnabled -eq $false -and $report.standardUserTested -eq $false -and
    $report.securityAccepted -eq $false -and $report.productionAccepted -eq $false) 'ACCOUNT_KIT_PURE_REPORT_REFUSED'
WriteAccountKitNew (Join-Path $destination 'pure-test-report.json') ([Text.Encoding]::UTF8.GetBytes($tested.stdout.Trim()))
$refused=0
foreach($arguments in @('','-Mode Enable','-Mode execute','-Mode Execute',
    '-Mode Prepare -ExpectedScriptSha256 invalid',('-Mode CheckOnly -ExpectedScriptSha256 '+('a'*64)),
    ('-Mode Prepare -ExpectedScriptSha256 '+('a'*64)+' -InputDirectory C:\not-issued'),
    ('-Mode Execute -ExpectedScriptSha256 '+('a'*64)+' -InputDirectory C:\not-issued -ExpectedPlanSha256 '+('b'*64)))) {
    $result=InvokeAccountKitChild ('-File "'+$runner+'" '+$arguments)
    RequireStandardAccount ($result.exitCode -ne 0 -and $result.stdout.Length -eq 0 -and
        $result.stderr -cmatch 'STANDARD_USER_ACCOUNT_ENTRY_CLOSED|ACCOUNT_SCRIPT_PIN_REQUIRED|ACCOUNT_SCRIPT_PIN_MISMATCH|ACCOUNT_REVIEWED_INPUT_REQUIRED|ACCOUNT_UNEXPECTED_INPUT_ARGUMENTS') 'ACCOUNT_KIT_CLOSED_ENTRY_FAILED'
    $refused++
}
# Compile only the exact embedded native helper; never invoke its methods.
$embedded=@($ast.FindAll({param($node)$node -is [Management.Automation.Language.StringConstantExpressionAst] -and $node.Value.Contains('public static class Lic008AccountPreparationNativeV1')},$true))
RequireStandardAccount ($embedded.Count -eq 1) 'ACCOUNT_KIT_NATIVE_HELPER_MISSING'
Add-Type -TypeDefinition $embedded[0].Value -ErrorAction Stop
foreach($item in $inputs) {
    RequireStandardAccount ((StandardAccountHashFile (Join-Path $repo $item.relative)) -ceq $item.sha256 -and
        (StandardAccountHashFile (Join-Path $snapshot ([IO.Path]::GetFileName($item.relative)))) -ceq $item.sha256) 'ACCOUNT_KIT_SOURCE_CHANGED'
}
RequireStandardAccount ((GetStandardAccountTools).sha256 -ceq $tools.sha256) 'ACCOUNT_KIT_TOOL_CHANGED'
$files=@(foreach($name in @('Run-Account.ps1','Test-Account.ps1')) {
    $path=Join-Path $destination $name
    [ordered]@{name=$name;size=([IO.FileInfo]$path).Length;sha256=(StandardAccountHashFile $path)}
})
$manifest=[ordered]@{schemaVersion=1;scope='TEST_ONLY_STANDARD_USER_ACCOUNT_KIT_V1';builtUtc=[DateTimeOffset]::UtcNow.ToString('O');codeBaseline='a64a71d';inputs=$inputs;files=$files;toolPins=$tools;pureCases=$report.cases;entryRefusals=$refused;nativeHelperCompiled=$true;nativeHelperInvoked=$false;accountCreationRoutePresent=$true;defaultEntryClosed=$true;createsDisabledOnly=$true;cryptoRunnerImplemented=$false;accountCreated=$false;standardUserTested=$false;securityAccepted=$false;productionAccepted=$false}
AccountKitJsonNew (Join-Path $destination 'kit.json') $manifest
[ordered]@{scope='TEST_ONLY_STANDARD_USER_ACCOUNT_KIT_LOCATION_V1';directory=$destination;kitSha256=(StandardAccountHashFile (Join-Path $destination 'kit.json'));runnerSha256=$files[0].sha256;pureCases=$report.cases;entryRefusals=$refused;accountCreated=$false;standardUserTested=$false} | ConvertTo-Json -Compress
