[CmdletBinding()]param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Builds/tests only. The optional read-only token route is compiled but is NOT
# invoked by this builder. There is no account, logon, SCM, process-launch or CNG
# implementation in this foundation, regardless of compilation definitions.
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$destination=Join-Path $repo ('out\lic008-standard-identity-v1-'+[guid]::NewGuid().ToString('N'))
$dotnet='C:\Program Files\dotnet\dotnet.exe'
$compiler='C:\Program Files\dotnet\sdk\10.0.400\Roslyn\bincore\csc.dll'
$references='C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Ref\10.0.11\ref\net10.0'
$runtimeRoots=@('C:\Program Files\dotnet\shared\Microsoft.NETCore.App\10.0.11','C:\Program Files\dotnet\host\fxr\10.0.11')
function IdentityHash([string]$path){(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
function IdentityHashBytes([byte[]]$bytes){$sha=[Security.Cryptography.SHA256]::Create();try{([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}
function IdentityPlainPath([string]$path){
    for($cursor=[IO.Path]::GetFullPath($path);$cursor;$cursor=[IO.Path]::GetDirectoryName($cursor)){
        if(([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'STANDARD_IDENTITY_BUILD_REPARSE_REFUSED'}
    }
}
function IdentityWriteNew([string]$path,[byte[]]$bytes){
    $stream=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
}
function IdentityJsonNew([string]$path,$value){IdentityWriteNew $path ([Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Depth 10 -Compress)))}
function IdentityRun([string]$arguments){
    $start=New-Object Diagnostics.ProcessStartInfo
    $start.FileName=$dotnet;$start.Arguments=$arguments;$start.UseShellExecute=$false;$start.CreateNoWindow=$true
    $start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
    foreach($name in @($start.EnvironmentVariables.Keys)){
        if($name -match '^(DOTNET_|COMPLUS_|CORECLR_|COR_|COREHOST_)' -or $name -in @('APPDOMAIN_MANAGER_ASM','APPDOMAIN_MANAGER_TYPE','DEVPATH','__COMPAT_LAYER')){$start.EnvironmentVariables.Remove($name)}
    }
    $process=[Diagnostics.Process]::Start($start)
    try{
        $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
        if(-not $process.WaitForExit(30000)){throw ('STANDARD_IDENTITY_CHILD_UNRESOLVED_RETAIN_PID_'+$process.Id)}
        [pscustomobject]@{exitCode=$process.ExitCode;stdout=$stdout.Result;stderr=$stderr.Result}
    }finally{$process.Dispose()}
}
IdentityPlainPath $repo
$relativeSources=@('licensing/adapter-evidence/standard-user-control/StandardIdentity.cs',
    'licensing/adapter-evidence/standard-user-control/StandardTokenReader.cs',
    'licensing/adapter-evidence/standard-user-control/StandardIdentityTests.cs',
    'licensing/adapter-evidence/standard-user-control/Program.cs','scripts/build-license-standard-identity.ps1')
$inputs=@(foreach($relative in $relativeSources){$path=Join-Path $repo $relative;IdentityPlainPath $path;[ordered]@{relative=$relative;sha256=(IdentityHash $path)}})
$toolInputs=@(foreach($path in @($dotnet,$compiler,'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe')){IdentityPlainPath $path;[ordered]@{path=$path;sha256=(IdentityHash $path)}})
$referenceInputs=@(Get-ChildItem -LiteralPath $references -File -Filter '*.dll' | Sort-Object Name | ForEach-Object {IdentityPlainPath $_.FullName;[ordered]@{path=$_.FullName;size=$_.Length;sha256=(IdentityHash $_.FullName)}})
$compilerInputs=@(Get-ChildItem -LiteralPath ([IO.Path]::GetDirectoryName($compiler)) -File | Sort-Object Name | ForEach-Object {IdentityPlainPath $_.FullName;[ordered]@{path=$_.FullName;size=$_.Length;sha256=(IdentityHash $_.FullName)}})
$runtimeInputs=@(foreach($root in $runtimeRoots){IdentityPlainPath $root;Get-ChildItem -LiteralPath $root -File | Sort-Object Name | ForEach-Object {IdentityPlainPath $_.FullName;[ordered]@{path=$_.FullName;size=$_.Length;sha256=(IdentityHash $_.FullName)}}})
if($referenceInputs.Count -ne 167 -or $runtimeInputs.Count -ne 190){throw 'STANDARD_IDENTITY_INSTALLED_INPUT_SET_REFUSED'}
$null=New-Item -ItemType Directory -Path $destination -ErrorAction Stop
$snapshot=Join-Path $destination 'snapshot';$null=New-Item -ItemType Directory -Path $snapshot
foreach($sourceInput in $inputs){IdentityWriteNew (Join-Path $snapshot ([IO.Path]::GetFileName($sourceInput.relative))) ([IO.File]::ReadAllBytes((Join-Path $repo $sourceInput.relative)))}
$closed=@('','--run','--controller','--service','--self-test extra','--SELF-TEST','--inspect-own-token extra','--token','--control-controller')
$variants=@()
foreach($variant in @('default','unrelated-defines','readonly-diagnostic')){
    $folder=Join-Path $destination $variant;$null=New-Item -ItemType Directory -Path $folder
    $dll=Join-Path $folder 'StandardIdentity.dll'
    $arguments=@('-nologo','-target:exe','-platform:x64','-nullable:enable','-warnaserror+',('-out:"'+$dll+'"'))
    if($variant -ceq 'unrelated-defines'){$arguments+='-define:TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V1,TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V2,TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V3,TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V4,TEST_CAPABLE_EXPORT_POLICY_CONTROLLER_V5,TEST_CAPABLE_STANDARD_USER_CONTROL_V1'}
    if($variant -ceq 'readonly-diagnostic'){$arguments+='-define:READ_ONLY_STANDARD_TOKEN_DIAGNOSTIC_V1'}
    $arguments+=@($referenceInputs | ForEach-Object {'-r:"'+$_.path+'"'})
    $arguments+=@($inputs | Where-Object {$_.relative.EndsWith('.cs')} | ForEach-Object {'"'+(Join-Path $snapshot ([IO.Path]::GetFileName($_.relative)))+'"'})
    IdentityWriteNew (Join-Path $folder 'compile.rsp') ([Text.Encoding]::UTF8.GetBytes(($arguments -join [Environment]::NewLine)))
    $compiled=IdentityRun ('"'+$compiler+'" "@'+(Join-Path $folder 'compile.rsp')+'"')
    if($compiled.exitCode -ne 0 -or $compiled.stderr.Length -ne 0){throw ('STANDARD_IDENTITY_COMPILE_FAILED_'+$variant+': '+$compiled.stdout+$compiled.stderr)}
    $runtimeBytes=[Text.Encoding]::UTF8.GetBytes('{"runtimeOptions":{"tfm":"net10.0","framework":{"name":"Microsoft.NETCore.App","version":"10.0.11"},"rollForward":"Disable"}}')
    IdentityWriteNew (Join-Path $folder 'StandardIdentity.runtimeconfig.json') $runtimeBytes
    $invoke='exec --fx-version 10.0.11 "'+$dll+'"'
    $tested=IdentityRun ($invoke+' --self-test')
    if($tested.exitCode -ne 0 -or $tested.stderr.Length -ne 0){throw ('STANDARD_IDENTITY_PURE_FAILED_'+$variant)}
    $report=$tested.stdout | ConvertFrom-Json
    if($report.scope -cne 'TEST_ONLY_STANDARD_IDENTITY_PURE_V1' -or $report.cases -ne 305 -or
        $report.accountChanged -ne $false -or $report.standardUserLogonTested -ne $false -or $report.cryptoRunnerImplemented -ne $false -or
        $report.securityAccepted -ne $false -or $report.productionAccepted -ne $false){throw 'STANDARD_IDENTITY_PURE_REPORT_REFUSED'}
    IdentityWriteNew (Join-Path $folder 'pure-test-report.json') ([Text.Encoding]::UTF8.GetBytes($tested.stdout.Trim()))
    $entryArguments=@($closed);if($variant -cne 'readonly-diagnostic'){$entryArguments+='--inspect-own-token'}
    foreach($entry in $entryArguments){$result=IdentityRun ($invoke+' '+$entry);if($result.exitCode -ne 2 -or $result.stdout.Length -ne 0 -or $result.stderr.Trim() -cne 'STANDARD_USER_CONTROL_ENTRY_CLOSED'){throw 'STANDARD_IDENTITY_CLOSED_ENTRY_FAILED'}}
    $variants+=[ordered]@{name=$variant;dllSha256=(IdentityHash $dll);runtimeconfigSha256=(IdentityHash (Join-Path $folder 'StandardIdentity.runtimeconfig.json'));reportSha256=(IdentityHash (Join-Path $folder 'pure-test-report.json'));cases=$report.cases;entryRefusals=$entryArguments.Count;ownTokenReadRoutePresent=($variant -ceq 'readonly-diagnostic');nativeTokenReadPerformed=$false}
}
foreach($sourceInput in $inputs){if((IdentityHash (Join-Path $repo $sourceInput.relative)) -cne $sourceInput.sha256 -or (IdentityHash (Join-Path $snapshot ([IO.Path]::GetFileName($sourceInput.relative)))) -cne $sourceInput.sha256){throw 'STANDARD_IDENTITY_SOURCE_CHANGED'}}
foreach($set in @($toolInputs,$referenceInputs,$compilerInputs,$runtimeInputs)){foreach($item in $set){if((IdentityHash $item.path) -cne $item.sha256){throw 'STANDARD_IDENTITY_INSTALLED_INPUT_CHANGED'}}}
$manifest=[ordered]@{schemaVersion=1;scope='TEST_ONLY_STANDARD_IDENTITY_FOUNDATION_BUILD_V1';builtUtc=[DateTimeOffset]::UtcNow.ToString('O');codeBaseline='d6f9e6a';inputs=$inputs;sourceSetSha256=(IdentityHashBytes ([Text.Encoding]::UTF8.GetBytes(($inputs | ConvertTo-Json -Depth 4 -Compress))));toolInputs=$toolInputs;referenceInputs=$referenceInputs;compilerInputs=$compilerInputs;runtimeInputs=$runtimeInputs;variants=$variants;nativeTokenReadPerformed=$false;accountChanged=$false;standardUserLogonTested=$false;cryptoRunnerImplemented=$false;securityAccepted=$false;productionAccepted=$false}
IdentityJsonNew (Join-Path $destination 'manifest.json') $manifest
[ordered]@{scope='TEST_ONLY_STANDARD_IDENTITY_FOUNDATION_BUILD_LOCATION_V1';directory=$destination;manifestSha256=(IdentityHash (Join-Path $destination 'manifest.json'));casesPerVariant=305;variants=$variants.Count;nativeTokenReadPerformed=$false;accountChanged=$false;standardUserLogonTested=$false} | ConvertTo-Json -Compress
