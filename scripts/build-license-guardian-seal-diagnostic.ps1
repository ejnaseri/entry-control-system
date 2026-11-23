[CmdletBinding()]param([switch]$DiagnosticCapable,[string]$ReviewedSourceSha256)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Local compile/self-test only. Never installs, configures or starts a service.
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dotnet = 'C:\Program Files\dotnet\dotnet.exe'
$compiler = 'C:\Program Files\dotnet\sdk\10.0.400\Roslyn\bincore\csc.dll'
$refs = 'C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Ref\10.0.11\ref\net10.0'
$buildKind = if ($DiagnosticCapable) { 'capable' } else { 'inert' }
$destination = Join-Path $repo ('out\lic008-guardian-seal-'+$buildKind+'-' + [guid]::NewGuid().ToString('N'))
function WriteNew([string]$path,[byte[]]$bytes) {
    $s = [IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    try { $s.Write($bytes,0,$bytes.Length); $s.Flush($true) } finally { $s.Dispose() }
}
function JsonNew([string]$path,$value) { WriteNew $path ([Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Depth 12))) }
function Hash([string]$path) { (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() }
$sources = @('Program.cs','PlanAdmission.cs','ServiceHost.cs','NativeTokens.cs','SecureFiles.cs','KeyOperations.cs','NativeWorker.cs','RoleActions.cs','ReportEmitter.cs','ControllerWindows.cs','ProcessObserver.cs','BootstrapAdmission.cs') |
    ForEach-Object { 'licensing/adapter-evidence/pilot-runtime/' + $_ }
$sources += @('licensing/adapter-evidence/track-a/CandidateCodec.cs','licensing/adapter-evidence/guardian-seal-diagnostic/Diagnostic.cs','licensing/adapter-evidence/guardian-seal-diagnostic/Launcher.cs')
$sources += 'licensing/adapter-evidence/guardian-seal-diagnostic/NativeService.cs'
$sources += 'licensing/adapter-evidence/guardian-seal-diagnostic/WindowsLauncher.cs'
$sources += 'licensing/adapter-evidence/guardian-seal-diagnostic/Deployment.cs'
$sources += 'licensing/adapter-evidence/guardian-seal-diagnostic/RuntimeCustody.cs'
$sources += 'licensing/adapter-evidence/guardian-seal-diagnostic/ExportProbe.cs'
$inventory = @(foreach ($relative in $sources) {
    $source = Join-Path $repo $relative
    [pscustomobject]@{ relative=$relative; sha256=(Hash $source) }
})
$custodyInputs = @($inventory) + @(
    [pscustomobject]@{relative='scripts/build-license-guardian-seal-diagnostic.ps1';sha256=(Hash $PSCommandPath)},
    [pscustomobject]@{relative='licensing/adapter-evidence/guardian-seal-diagnostic/HostBuilder.cs';sha256=(Hash (Join-Path $repo 'licensing/adapter-evidence/guardian-seal-diagnostic/HostBuilder.cs'))}
)
$sha = [Security.Cryptography.SHA256]::Create()
try { $sourceSetHash = ([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes(($custodyInputs | ConvertTo-Json -Depth 12 -Compress))))).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose() }
if ($DiagnosticCapable -and $ReviewedSourceSha256 -cne $sourceSetHash) { throw ('REVIEWED_SOURCE_PIN_REQUIRED; actual='+$sourceSetHash) }
if (-not $DiagnosticCapable -and $ReviewedSourceSha256) { throw 'INERT_BUILD_UNEXPECTED_PIN' }
foreach ($row in $custodyInputs) { if ((Hash (Join-Path $repo $row.relative)) -cne $row.sha256) { throw 'CUSTODY_INPUT_CHANGED' } }
# A missing/wrong capability pin is refused before any output directory exists.
$null = New-Item -ItemType Directory -Path $destination
$snapshot = Join-Path $destination 'snapshot'
$null = New-Item -ItemType Directory -Path $snapshot
foreach ($row in $inventory) {
    $source = Join-Path $repo $row.relative
    $target = Join-Path $snapshot ([IO.Path]::GetFileName($source))
    WriteNew $target ([IO.File]::ReadAllBytes($source))
    if ((Hash $target) -cne $row.sha256) { throw 'SOURCE_SNAPSHOT_CHANGED' }
}
$dll = Join-Path $destination 'GuardianSealDiagnostic.dll'
$arguments = @('-nologo','-target:exe','-nullable:enable','-main:EntryControl.TestOnly.Diagnostics.Diagnostic',('-out:"'+$dll+'"'))
if ($DiagnosticCapable) { $arguments += '-define:TEST_CAPABLE_DIAGNOSTIC' }
$arguments += @(Get-ChildItem -LiteralPath $refs -Filter '*.dll' | ForEach-Object { '-r:"'+$_.FullName+'"' })
$arguments += @($sources | ForEach-Object { '"'+(Join-Path $snapshot ([IO.Path]::GetFileName($_)))+'"' })
$response = Join-Path $destination 'compile.rsp'
WriteNew $response ([Text.Encoding]::UTF8.GetBytes(($arguments -join [Environment]::NewLine)))
& $dotnet exec --fx-version 10.0.11 $compiler -noconfig ('@'+$response)
if ($LASTEXITCODE -ne 0) { throw 'COMPILE_FAILED' }
JsonNew (Join-Path $destination 'GuardianSealDiagnostic.runtimeconfig.json') @{ runtimeOptions=@{tfm='net10.0';framework=@{name='Microsoft.NETCore.App';version='10.0.11'};rollForward='Disable'} }
$output = & $dotnet exec --fx-version 10.0.11 $dll --self-test
if ($LASTEXITCODE -ne 0) { throw 'SELF_TEST_FAILED' }
$report = $output | ConvertFrom-Json
if ($report.cases -ne 1211 -or $report.physicalExecutionEnabled -ne [bool]$DiagnosticCapable) { throw 'TEST_REPORT_REFUSED' }
JsonNew (Join-Path $destination 'pure-test-report.json') $report
$entryChecks = @(
    foreach ($entry in @('--service','--probe','--controller','--inspect-capability','--diagnostic-service')) {
        @{Arguments=$entry;Error='DIAGNOSTIC_NATIVE_ENTRY_NOT_IMPLEMENTED'}
    }
    @{Arguments='--prepare-diagnostic-input';Error='DIAGNOSTIC_INPUT_REFUSED'}
    @{Arguments='--prepare-diagnostic-input "C:\not-a-diagnostic-input\package.json" bad-pin';Error='DIAGNOSTIC_INPUT_REFUSED'}
    @{Arguments=('--diagnostic-service --approval-sha256 bad-pin --package-sha256 '+('b'*64));Error='DIAGNOSTIC_NATIVE_ENTRY_NOT_IMPLEMENTED'}
    @{Arguments=('--diagnostic-controller "C:\not-a-diagnostic-input\package.json" "C:\not-a-diagnostic-input\approval.json" bad-pin '+('b'*64));Error='DIAGNOSTIC_NATIVE_ENTRY_NOT_IMPLEMENTED'}
)
# Valid-shaped service pins would reach native dispatch in a capable binary.
# Only inert builds may exercise these full-shaped refusal cases.
if (-not $DiagnosticCapable) {
    $entryChecks += @(
        @{Arguments=('--diagnostic-service --approval-sha256 '+('a'*64)+' --package-sha256 '+('b'*64));Error='DIAGNOSTIC_NATIVE_ENTRY_NOT_IMPLEMENTED'}
        @{Arguments=('--diagnostic-controller "C:\not-a-diagnostic-input\package.json" "C:\not-a-diagnostic-input\approval.json" '+('a'*64)+' '+('b'*64));Error='DIAGNOSTIC_NATIVE_ENTRY_NOT_IMPLEMENTED'}
        @{Arguments=('--prepare-diagnostic-input "C:\not-a-diagnostic-input\package.json" '+('a'*64));Error='DIAGNOSTIC_INPUT_REFUSED'}
    )
}
foreach ($entry in $entryChecks) {
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName=$dotnet; $start.Arguments='exec --fx-version 10.0.11 "'+$dll+'" '+$entry.Arguments
    $start.UseShellExecute=$false; $start.CreateNoWindow=$true
    $start.RedirectStandardOutput=$true; $start.RedirectStandardError=$true
    $process=[Diagnostics.Process]::Start($start)
    $stdout=$process.StandardOutput.ReadToEnd(); $stderr=$process.StandardError.ReadToEnd(); $process.WaitForExit()
    try { if ($process.ExitCode -ne 2 -or $stdout.Length -ne 0 -or $stderr.Trim() -cne $entry.Error) { throw 'ENTRY_REFUSAL_FAILED' } }
    finally { $process.Dispose() }
}
foreach ($row in $inventory) { if ((Hash (Join-Path $repo $row.relative)) -cne $row.sha256) { throw 'SOURCE_CHANGED' } }
JsonNew (Join-Path $destination 'manifest.json') @{scope='TEST_ONLY_DIAGNOSTIC_BUILD';sources=$inventory;custodyInputs=$custodyInputs;sourceSetSha256=$sourceSetHash;dllSha256=(Hash $dll);compilerSha256=(Hash $compiler);cases=$report.cases;entryRefusals=$entryChecks.Count;physicalExecutionEnabled=[bool]$DiagnosticCapable;physicalTested=$false;securityAccepted=$false;productionAccepted=$false}
# Framework-dependent apphost with global-only runtime search. No NuGet/network.
$package = Join-Path $destination 'package'
$hostTool = Join-Path $destination 'host-tool'
$null = New-Item -ItemType Directory -Path $package
$null = New-Item -ItemType Directory -Path $hostTool
$hostSource = Join-Path $repo 'licensing/adapter-evidence/guardian-seal-diagnostic/HostBuilder.cs'
$hostModel = 'C:\Program Files\dotnet\sdk\10.0.400\Microsoft.NET.HostModel.dll'
$template = 'C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Host.win-x64\10.0.11\runtimes\win-x64\native\apphost.exe'
WriteNew (Join-Path $hostTool 'HostBuilder.cs') ([IO.File]::ReadAllBytes($hostSource))
if ((Hash (Join-Path $hostTool 'HostBuilder.cs')) -cne ($custodyInputs | Where-Object relative -CEQ 'licensing/adapter-evidence/guardian-seal-diagnostic/HostBuilder.cs').sha256) { throw 'HOST_SNAPSHOT_PIN_REFUSED' }
WriteNew (Join-Path $hostTool 'Microsoft.NET.HostModel.dll') ([IO.File]::ReadAllBytes($hostModel))
$hostDll = Join-Path $hostTool 'HostBuilder.dll'
$hostArgs = @('-nologo','-target:exe',('-out:"'+$hostDll+'"'))
$hostArgs += @(Get-ChildItem -LiteralPath $refs -Filter '*.dll' | ForEach-Object { '-r:"'+$_.FullName+'"' })
$hostArgs += @('-r:"'+(Join-Path $hostTool 'Microsoft.NET.HostModel.dll')+'"','"'+(Join-Path $hostTool 'HostBuilder.cs')+'"')
$hostResponse = Join-Path $hostTool 'host.rsp'
WriteNew $hostResponse ([Text.Encoding]::UTF8.GetBytes(($hostArgs -join [Environment]::NewLine)))
& $dotnet exec --fx-version 10.0.11 $compiler -noconfig ('@'+$hostResponse)
if ($LASTEXITCODE -ne 0) { throw 'HOST_TOOL_COMPILE_FAILED' }
JsonNew (Join-Path $hostTool 'HostBuilder.runtimeconfig.json') @{runtimeOptions=@{tfm='net10.0';framework=@{name='Microsoft.NETCore.App';version='10.0.11'};rollForward='Disable'}}
JsonNew (Join-Path $hostTool 'HostBuilder.deps.json') @{runtimeTarget=@{name='.NETCoreApp,Version=v10.0'};targets=@{'.NETCoreApp,Version=v10.0'=@{'HostBuilder/1.0.0'=@{runtime=@{'HostBuilder.dll'=@{};'Microsoft.NET.HostModel.dll'=@{}}}}};libraries=@{'HostBuilder/1.0.0'=@{type='project';serviceable=$false;sha512=''}}}
$exe = Join-Path $package 'GuardianSealDiagnostic.exe'
& $dotnet exec --fx-version 10.0.11 $hostDll $template $exe
if ($LASTEXITCODE -ne 0) { throw 'HOST_BUILD_FAILED' }
foreach ($name in @('GuardianSealDiagnostic.dll','GuardianSealDiagnostic.runtimeconfig.json')) { WriteNew (Join-Path $package $name) ([IO.File]::ReadAllBytes((Join-Path $destination $name))) }
$runtimeRows = @(foreach ($group in @(
    @{Name='runtime';Path='C:\Program Files\dotnet\shared\Microsoft.NETCore.App\10.0.11'},
    @{Name='fxr';Path='C:\Program Files\dotnet\host\fxr\10.0.11'}
)) { foreach ($file in (Get-ChildItem -LiteralPath $group.Path -File | Sort-Object Name)) {
    [ordered]@{group=$group.Name;name=$file.Name;size=$file.Length;sha256=(Hash $file.FullName)}
} })
JsonNew (Join-Path $package 'runtime-inventory.json') ([ordered]@{schemaVersion=1;runtime='10.0.11';files=$runtimeRows})
$packageRows = @(foreach ($name in @('GuardianSealDiagnostic.exe','GuardianSealDiagnostic.dll','GuardianSealDiagnostic.runtimeconfig.json','runtime-inventory.json')) {
    $path=Join-Path $package $name
    [ordered]@{name=$name;size=(Get-Item -LiteralPath $path).Length;sha256=(Hash $path)}
})
# Canonical property ordering/compact UTF8 is consumed by the admission parser.
WriteNew (Join-Path $destination 'package-manifest.json') ([Text.Encoding]::UTF8.GetBytes(([ordered]@{schemaVersion=1;scope='TEST_ONLY_GUARDIAN_SEAL_PACKAGE_V2';files=$packageRows} | ConvertTo-Json -Depth 12 -Compress)))
$apphostChecks = @(@{Arguments='--self-test';Error=''},@{Arguments='--verify-local-runtime';Error=''}) + $entryChecks
foreach ($entry in $apphostChecks) {
    $start=New-Object Diagnostics.ProcessStartInfo
    $start.FileName=$exe; $start.Arguments=$entry.Arguments; $start.UseShellExecute=$false; $start.CreateNoWindow=$true
    $start.RedirectStandardOutput=$true; $start.RedirectStandardError=$true
    foreach($key in @($start.EnvironmentVariables.Keys)) { if($key -match '^(DOTNET_|COMPLUS_|CORECLR_|COR_|COREHOST_)' -or $key -in @('APPDOMAIN_MANAGER_ASM','APPDOMAIN_MANAGER_TYPE','DEVPATH','__COMPAT_LAYER')) { $start.EnvironmentVariables.Remove($key) } }
    $process=[Diagnostics.Process]::Start($start)
    $stdout=$process.StandardOutput.ReadToEnd(); $stderr=$process.StandardError.ReadToEnd(); $process.WaitForExit()
    try {
        if ($entry.Arguments -in @('--self-test','--verify-local-runtime')) {
            if ($process.ExitCode -ne 0 -or $stderr.Length -ne 0) { throw 'APPHOST_CHECK_FAILED' }
            $result=$stdout | ConvertFrom-Json
            if ($entry.Arguments -eq '--self-test' -and ($result.cases -ne $report.cases -or $result.physicalExecutionEnabled -ne [bool]$DiagnosticCapable)) { throw 'APPHOST_TEST_COUNT_REFUSED' }
            if ($entry.Arguments -eq '--verify-local-runtime' -and $result.inventorySha256 -cne (Hash (Join-Path $package 'runtime-inventory.json'))) { throw 'RUNTIME_INVENTORY_BINDING_REFUSED' }
        } elseif ($process.ExitCode -ne 2 -or $stdout.Length -ne 0 -or $stderr.Trim() -cne $entry.Error) { throw 'APPHOST_ENTRY_REFUSAL_FAILED' }
    } finally { $process.Dispose() }
}
JsonNew (Join-Path $destination 'package-build.json') @{scope='TEST_ONLY_DIAGNOSTIC_PACKAGE_NOT_EXECUTED';sourceSetSha256=$sourceSetHash;manifestSha256=(Hash (Join-Path $destination 'package-manifest.json'));hostSourceSha256=(Hash $hostSource);hostModelSha256=(Hash $hostModel);apphostTemplateSha256=(Hash $template);runtimeFiles=$runtimeRows.Count;pureCases=$report.cases;apphostRefusals=$entryChecks.Count;runtimeInventoryVerified=$true;physicalExecutionEnabled=[bool]$DiagnosticCapable;securityAccepted=$false;productionAccepted=$false}
foreach ($row in $inventory) { if ((Hash (Join-Path $repo $row.relative)) -cne $row.sha256) { throw 'FINAL_SOURCE_CHANGED' } }
foreach ($row in $custodyInputs) { if ((Hash (Join-Path $repo $row.relative)) -cne $row.sha256) { throw 'FINAL_CUSTODY_INPUT_CHANGED' } }
if ((Hash $hostSource) -cne (Hash (Join-Path $hostTool 'HostBuilder.cs')) -or (Hash $hostModel) -cne (Hash (Join-Path $hostTool 'Microsoft.NET.HostModel.dll'))) { throw 'HOST_INPUT_CHANGED' }
Write-Output $output
Write-Output ('Candidate: '+$destination)
