[CmdletBinding()]
param(
    [switch]$PrintSourceSha256,
    [switch]$Prepare,
    [string]$ReviewedSourceSha256 = ''
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Preparation compiles the diagnostic but never invokes it. The single probe
# entry is exact --probe --reviewed-source-sha256 <digest> in the fresh output.
# No existing W03 path, account, service or key is changed by this script.
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if ($repo -cne 'E:\EntryControlSystem') {
    throw 'PROGRAMDATA_PLACEMENT_PROBE_V1_FIXED_WORKSPACE_REFUSED'
}
$source = Join-Path $repo 'licensing\adapter-evidence\standard-native-control\NativeHostProgramDataPlacementProbeV1.cs'
$invokeScript = Join-Path $repo 'scripts\invoke-license-native-programdata-placement-probe-v1.ps1'
$dotnet = 'C:\Program Files\dotnet\dotnet.exe'
$outputRoot = Join-Path $repo 'out'
$utf8 = New-Object Text.UTF8Encoding($false,$true)

function ProbePlain([string]$Path) {
    for ($cursor = [IO.Path]::GetFullPath($Path); $cursor; $cursor = [IO.Path]::GetDirectoryName($cursor)) {
        if (([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'PROGRAMDATA_PLACEMENT_PROBE_V1_REPARSE_REFUSED'
        }
    }
}
function ProbeHash([string]$Path) {
    (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}
function ProbeNew([string]$Path,[byte[]]$Bytes) {
    ProbePlain ([IO.Path]::GetDirectoryName($Path))
    $stream = [IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    try { $stream.Write($Bytes,0,$Bytes.Length); $stream.Flush($true) }
    finally { $stream.Dispose() }
}

if ($PrintSourceSha256 -eq $Prepare) {
    throw 'PROGRAMDATA_PLACEMENT_PROBE_V1_EXACT_MODE_REQUIRED'
}
if ($PSHOME -cne 'C:\Windows\System32\WindowsPowerShell\v1.0' -or [IntPtr]::Size -ne 8) {
    throw 'PROGRAMDATA_PLACEMENT_PROBE_V1_POWERSHELL_PROFILE_REFUSED'
}
foreach ($path in @($repo,$source,$invokeScript,$dotnet,$outputRoot)) { ProbePlain $path }
$sourceSha = ProbeHash $source
if ($PrintSourceSha256) {
    if ($ReviewedSourceSha256.Length -ne 0) { throw 'PROGRAMDATA_PLACEMENT_PROBE_V1_PRINT_ARGUMENT_REFUSED' }
    Write-Output $sourceSha
    return
}
if ($ReviewedSourceSha256 -cne $sourceSha -or
    $ReviewedSourceSha256 -cnotmatch '^[0-9a-f]{64}$') {
    throw 'PROGRAMDATA_PLACEMENT_PROBE_V1_REVIEWED_SOURCE_REQUIRED'
}
$invokeSha = ProbeHash $invokeScript
$destination = [IO.Path]::GetFullPath((Join-Path $outputRoot ('lic008-programdata-placement-probe-v1-' + [Guid]::NewGuid().ToString('N'))))
if (-not $destination.StartsWith($outputRoot + [IO.Path]::DirectorySeparatorChar,
    [StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $destination)) {
    throw 'PROGRAMDATA_PLACEMENT_PROBE_V1_FRESH_DESTINATION_REFUSED'
}
$null = New-Item -ItemType Directory -Path $destination -ErrorAction Stop
ProbePlain $destination
$guid = [IO.Path]::GetFileName($destination).Substring('lic008-programdata-placement-probe-v1-'.Length)
$probeRoot = Join-Path 'C:\ProgramData' ('Ecs.Lic008.StandardNativeHostPlacementProbeV1.' + $guid)
$snapshot = Join-Path $destination 'NativeHostProgramDataPlacementProbeV1.cs'
ProbeNew $snapshot ([IO.File]::ReadAllBytes($source))
if ((ProbeHash $snapshot) -cne $sourceSha) {
    throw 'PROGRAMDATA_PLACEMENT_PROBE_V1_SOURCE_COPY_CHANGED'
}
$project = Join-Path $destination 'ProgramDataPlacementProbeV1.csproj'
$projectText = @'
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <OutputType>Exe</OutputType>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>
  </PropertyGroup>
  <ItemGroup>
    <Compile Include="NativeHostProgramDataPlacementProbeV1.cs" />
  </ItemGroup>
</Project>
'@
ProbeNew $project ($utf8.GetBytes($projectText))
$globalJson = Join-Path $destination 'global.json'
ProbeNew $globalJson ($utf8.GetBytes('{"sdk":{"version":"10.0.400","rollForward":"disable"}}'))
$nugetConfig = Join-Path $destination 'NuGet.Config'
ProbeNew $nugetConfig ($utf8.GetBytes('<?xml version="1.0" encoding="utf-8"?><configuration><packageSources><clear /></packageSources></configuration>'))
$buildTemp = Join-Path $destination 'build-temp'
if (Test-Path -LiteralPath $buildTemp) {
    throw 'PROGRAMDATA_PLACEMENT_PROBE_V1_BUILD_TEMP_NOT_FRESH'
}
$null = New-Item -ItemType Directory -Path $buildTemp -ErrorAction Stop
ProbePlain $buildTemp
$buildEnvironment = [ordered]@{
    SystemRoot='C:\Windows';windir='C:\Windows';SystemDrive='C:'
    ProgramFiles='C:\Program Files';'ProgramFiles(x86)'='C:\Program Files (x86)'
    ProgramData='C:\ProgramData';ALLUSERSPROFILE='C:\ProgramData'
    TEMP=$buildTemp;TMP=$buildTemp;USERPROFILE=$buildTemp
    APPDATA=$buildTemp;LOCALAPPDATA=$buildTemp
    HOMEDRIVE='E:';HOMEPATH=$destination.Substring(2)
    DOTNET_CLI_HOME=$buildTemp;NUGET_PACKAGES=$buildTemp
    NUGET_COMMON_APPLICATION_DATA=$buildTemp
    DOTNET_CLI_TELEMETRY_OPTOUT='1';DOTNET_SKIP_FIRST_TIME_EXPERIENCE='1'
}
$compileArguments = 'build "' + $project + '" --configuration Release --nologo --verbosity quiet -p:RestoreConfigFile="' + $nugetConfig + '"'
ProbeNew (Join-Path $destination 'compile.intent.json') ($utf8.GetBytes((([ordered]@{
    executable=$dotnet;executableSha256=(ProbeHash $dotnet)
    arguments=$compileArguments;workingDirectory=$destination
    globalJsonSha256=(ProbeHash $globalJson)
    nugetConfigSha256=(ProbeHash $nugetConfig)
    childEnvironment=$buildEnvironment
    deadlineMilliseconds=300000;probeExecuted=$false
}) | ConvertTo-Json -Compress)))
$start = New-Object Diagnostics.ProcessStartInfo
$start.FileName = $dotnet
$start.Arguments = $compileArguments
$start.WorkingDirectory = $destination
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.EnvironmentVariables.Clear()
foreach ($entry in $buildEnvironment.GetEnumerator()) {
    $start.EnvironmentVariables[$entry.Key] = [string]$entry.Value
}
$process = New-Object Diagnostics.Process
$process.StartInfo = $start
if (-not $process.Start()) { throw 'PROGRAMDATA_PLACEMENT_PROBE_V1_BUILD_START_FAILED_RETAIN_OUTPUT' }
$buildJournalError = $null
try {
    ProbeNew (Join-Path $destination 'compile.started.json') ($utf8.GetBytes((([ordered]@{
        pid=$process.Id;startedUtc=[DateTimeOffset]::UtcNow.ToString('O')
    }) | ConvertTo-Json -Compress)))
} catch { $buildJournalError = $_.Exception.GetType().Name }
$buildWaitError = $null
$buildCompleted = $false
try { $buildCompleted = $process.WaitForExit(300000) }
catch { $buildWaitError = $_.Exception.GetType().Name }
if (-not $buildCompleted) {
    try {
        ProbeNew (Join-Path $destination 'compile.pending.json') ($utf8.GetBytes((([ordered]@{
            pid=$process.Id;status='UNRESOLVED_NO_KILL_NO_RETRY'
            startedJournalError=$buildJournalError;waitError=$buildWaitError
            probeExecuted=$false
        }) | ConvertTo-Json -Compress)))
    } catch { }
    throw ('PROGRAMDATA_PLACEMENT_PROBE_V1_BUILD_PENDING_PID_' + $process.Id)
}
ProbeNew (Join-Path $destination 'compile.result.json') ($utf8.GetBytes((([ordered]@{
    pid=$process.Id;exitCode=$process.ExitCode;endedUtc=[DateTimeOffset]::UtcNow.ToString('O')
    startedJournalError=$buildJournalError
}) | ConvertTo-Json -Compress)))
if ($process.ExitCode -ne 0) { throw 'PROGRAMDATA_PLACEMENT_PROBE_V1_BUILD_FAILED_RETAIN_OUTPUT' }
if ($null -ne $buildJournalError) { throw 'PROGRAMDATA_PLACEMENT_PROBE_V1_BUILD_JOURNAL_UNRESOLVED' }
$process.Dispose()
if ((ProbeHash $source) -cne $sourceSha -or
    (ProbeHash $snapshot) -cne $sourceSha -or
    (ProbeHash $invokeScript) -cne $invokeSha) {
    throw 'PROGRAMDATA_PLACEMENT_PROBE_V1_SOURCE_CHANGED_DURING_BUILD'
}
$dll = Join-Path $destination 'bin\Release\net10.0\ProgramDataPlacementProbeV1.dll'
$runtimeconfig = Join-Path $destination 'bin\Release\net10.0\ProgramDataPlacementProbeV1.runtimeconfig.json'
$deps = Join-Path $destination 'bin\Release\net10.0\ProgramDataPlacementProbeV1.deps.json'
foreach ($path in @($dll,$runtimeconfig,$deps)) { ProbePlain $path }
$manifest = [ordered]@{
    schema='TEST_ONLY_LIC008_PROGRAMDATA_PLACEMENT_PROBE_PREPARATION_V1'
    preparedUtc=[DateTimeOffset]::UtcNow.ToString('O')
    sourceSha256=$sourceSha
    preparationScriptSha256=(ProbeHash $PSCommandPath)
    invocationScriptSha256=$invokeSha
    snapshotSha256=(ProbeHash $snapshot)
    projectSha256=(ProbeHash $project)
    globalJsonSha256=(ProbeHash $globalJson)
    nugetConfigSha256=(ProbeHash $nugetConfig)
    executableSha256=(ProbeHash $dll)
    runtimeconfigSha256=(ProbeHash $runtimeconfig)
    depsSha256=(ProbeHash $deps)
    dotnetSha256=(ProbeHash $dotnet)
    compileIntentSha256=(ProbeHash (Join-Path $destination 'compile.intent.json'))
    compileStartedSha256=(ProbeHash (Join-Path $destination 'compile.started.json'))
    compileResultSha256=(ProbeHash (Join-Path $destination 'compile.result.json'))
    buildDeadlineMilliseconds=300000
    probeWaitDeadlineMilliseconds=120000
    outputDirectory=$destination
    probeRoot=$probeRoot
    probeCommand=@($dotnet,'exec','--fx-version','10.0.11',$dll,
        '--probe','--reviewed-source-sha256',$sourceSha)
    probeExecuted=$false
    accountChanged=$false
    serviceChanged=$false
    keyChanged=$false
    w03Admitted=$false
    lic008Closed=$false
}
ProbeNew (Join-Path $destination 'prepare-manifest.json') ($utf8.GetBytes(($manifest | ConvertTo-Json -Depth 6 -Compress)))
$manifest | ConvertTo-Json -Depth 6 -Compress
