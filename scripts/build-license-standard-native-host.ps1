[CmdletBinding()]
param(
    [switch]$RunReviewedSelfTests,
    [string]$ReviewedSourceSetSha256 = '',
    [switch]$PrintSourceSetSha256
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Builds only by default. The optional runtime branch requires the exact source
# digest independently reviewed and explicitly authorized by the caller. Native
# environment/SCM/CLR/bootstrap entry points remain closed in every variant.
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$baseline = '81d9f6412aebc2e2fdba2c373b1aad2e775d8ab7'
$ownedTool = Join-Path $repo 'out\toolchains\zig-0.17.1-2c4798af54294f80a9641ff9784877b3'
$toolRoot = Join-Path $ownedTool 'extracted\zig-x86_64-windows-0.17.1'
$compiler = Join-Path $toolRoot 'zig.exe'
$powershell = 'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
$expectedCompiler = '8d6f248cdb0fc2ecd5e17c5282ef3f8a4b614beac12e6d27d12462cde59fe56b'
$expectedPowerShell = 'c7d4e119149a7150b7101a4bd9fffbf659fba76d058f7bf6cc73c99fb36e8221'
$expectedArchive = 'b03f477a1943673e02aca0f570e8030dffd536ce1f45cbc4d3326ec31159562e'
$expectedTree = '19b7f260bc09cba6c36aa1705ab1ca997f6362ccc27b50abc67a7f3b47d04c14'
$expectedEntries = 'c702f696201aff6f3fc154f7eaa6498c9bebda84ecfad7f2d39ec5ee534e5f21'
$expectedChecks = 2564 # Reviewed fixed-shape parser, environment, positive, negative and lifetime assertions.
$closedError = 'STANDARD_NATIVE_HOST_ENTRY_CLOSED'
$schema = 'TEST_ONLY_STANDARD_NATIVE_HOST_FOUNDATION_SELF_TEST_V1'
$destination = Join-Path $repo ('out\lic008-standard-native-host-v1-' + [Guid]::NewGuid().ToString('N'))
$sharedGlobalCache = Join-Path $destination 'global-cache'
$script:NativeHostHeldRuns = New-Object 'Collections.Generic.List[object]'

function HostHash([string]$Path) { (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant() }
function HostBytesHash([byte[]]$Bytes) {
    $sha = [Security.Cryptography.SHA256]::Create()
    try { [BitConverter]::ToString($sha.ComputeHash($Bytes)).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose() }
}
function HostPlain([string]$Path) {
    for ($cursor = [IO.Path]::GetFullPath($Path); $cursor; $cursor = [IO.Path]::GetDirectoryName($cursor)) {
        if (([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'NATIVE_HOST_REPARSE_REFUSED' }
    }
}
function HostNew([string]$Path, [byte[]]$Bytes) {
    HostPlain ([IO.Path]::GetDirectoryName($Path))
    $stream = [IO.File]::Open($Path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    try { $stream.Write($Bytes,0,$Bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
}
function HostJson([string]$Path, $Value) { HostNew $Path ((New-Object Text.UTF8Encoding($false)).GetBytes(($Value | ConvertTo-Json -Depth 14 -Compress))) }
function HostDirectory([string]$Path) {
    HostPlain ([IO.Path]::GetDirectoryName($Path))
    if (Test-Path -LiteralPath $Path) { throw 'NATIVE_HOST_FRESH_DIRECTORY_COLLISION' }
    $null = New-Item -ItemType Directory -Path $Path -ErrorAction Stop
    HostPlain $Path
}
function HostTreeVerify {
    $archive = Join-Path $ownedTool 'zig-x86_64-windows-0.17.1.zip'
    $treePath = Join-Path $ownedTool 'tooltree-pins.json'
    $entryPath = Join-Path $ownedTool 'zip-entry-validation.json'
    foreach ($path in @($archive,$treePath,$entryPath,$powershell,$compiler)) { HostPlain $path }
    if ((HostHash $archive) -cne $expectedArchive -or (Get-Item -LiteralPath $archive).Length -ne 100343666 -or
        (HostHash $treePath) -cne $expectedTree -or (HostHash $entryPath) -cne $expectedEntries -or
        (HostHash $compiler) -cne $expectedCompiler -or (HostHash $powershell) -cne $expectedPowerShell) { throw 'NATIVE_HOST_FIXED_TOOL_PIN_REFUSED' }
    $tree = [IO.File]::ReadAllText($treePath) | ConvertFrom-Json
    $entryInfo = [IO.File]::ReadAllText($entryPath) | ConvertFrom-Json
    if ($tree.Schema -cne 'TEST_ONLY_PORTABLE_TOOLTREE_PINS_V1' -or $tree.ArchiveSha256 -cne $expectedArchive -or
        $tree.FileCount -ne 19520 -or $tree.Files.Count -ne 19520 -or $tree.UncompressedBytes -ne 378964486 -or
        $entryInfo.EntryCount -ne 20792 -or $entryInfo.UncompressedBytes -ne 378964486 -or -not $entryInfo.EveryEntryValidatedBeforeExtraction) { throw 'NATIVE_HOST_TOOL_MANIFEST_SHAPE_REFUSED' }
    $files = New-Object 'Collections.Generic.Dictionary[string,object]' ([StringComparer]::OrdinalIgnoreCase)
    $directories = New-Object 'Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
    foreach ($pin in $tree.Files) {
        $relative = [string]$pin.RelativePath
        if (-not $relative.StartsWith('zig-x86_64-windows-0.17.1/',[StringComparison]::Ordinal) -or $relative -match '[\\:\x00-\x1f]' -or
            $relative.Split('/') -contains '..' -or $relative.Split('/') -contains '.' -or $pin.Sha256 -cnotmatch '^[0-9a-f]{64}$' -or $pin.Length -lt 0) { throw 'NATIVE_HOST_TOOL_RELATIVE_REFUSED' }
        $path = [IO.Path]::GetFullPath((Join-Path (Join-Path $ownedTool 'extracted') $relative.Replace('/','\')))
        if (-not $path.StartsWith($toolRoot + '\',[StringComparison]::OrdinalIgnoreCase) -or $files.ContainsKey($path)) { throw 'NATIVE_HOST_TOOL_PATH_REFUSED' }
        $files.Add($path,$pin)
        for ($parent = [IO.Path]::GetDirectoryName($path); $parent.Length -gt $toolRoot.Length; $parent = [IO.Path]::GetDirectoryName($parent)) { $null = $directories.Add($parent) }
    }
    foreach ($entry in $entryInfo.Entries) {
        if ($entry.Directory) {
            $path = [IO.Path]::GetFullPath((Join-Path (Join-Path $ownedTool 'extracted') ([string]$entry.Name).TrimEnd('/').Replace('/','\')))
            if ($path -ne $toolRoot) {
                if (-not $path.StartsWith($toolRoot + '\',[StringComparison]::OrdinalIgnoreCase)) { throw 'NATIVE_HOST_TOOL_DIRECTORY_REFUSED' }
                $null = $directories.Add($path)
            }
        }
    }
    $queue = New-Object 'Collections.Generic.Stack[string]'; $queue.Push($toolRoot)
    $actualFiles = 0; $actualDirectories = 0; $actualBytes = 0L
    while ($queue.Count -gt 0) {
        $folder = $queue.Pop(); HostPlain $folder
        foreach ($path in [IO.Directory]::GetFileSystemEntries($folder)) {
            $attributes = [IO.File]::GetAttributes($path)
            if (($attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'NATIVE_HOST_TOOL_LINK_REFUSED' }
            if (($attributes -band [IO.FileAttributes]::Directory) -ne 0) {
                if (-not $directories.Contains($path)) { throw 'NATIVE_HOST_TOOL_EXTRA_DIRECTORY' }; $actualDirectories++; $queue.Push($path)
            } else {
                if (-not $files.ContainsKey($path)) { throw 'NATIVE_HOST_TOOL_EXTRA_FILE' }; $pin = $files[$path]
                $length = (New-Object IO.FileInfo($path)).Length
                if ($length -ne $pin.Length -or (HostHash $path) -cne $pin.Sha256) { throw 'NATIVE_HOST_TOOL_FILE_CHANGED' }
                $actualFiles++; $actualBytes += $length
            }
        }
    }
    if ($actualFiles -ne $files.Count -or $actualDirectories -ne $directories.Count -or $actualBytes -ne 378964486) { throw 'NATIVE_HOST_TOOL_MISSING_OR_LENGTH_CHANGED' }
    [ordered]@{archiveSha256=$expectedArchive;archiveLength=100343666;treeManifestSha256=$expectedTree;entryManifestSha256=$expectedEntries;
        compilerSha256=$expectedCompiler;fileCount=$actualFiles;directoryCount=$actualDirectories;bytes=$actualBytes;allFileHashesChecked=$true;noLinksOrExtras=$true}
}
function HostArguments([string[]]$Values) {
    if ($null -eq $Values -or $Values.Count -eq 0) { return '' }
    $quoted = foreach ($value in $Values) {
        if ($value -match '[\x00\r\n]' -or $value.Contains('"') -or $value.EndsWith('\')) { throw 'NATIVE_HOST_FIXED_ARGUMENT_REFUSED' }
        '"' + $value + '"'
    }
    [string]::Join(' ',[string[]]$quoted)
}
function HostExactLine([string]$Actual,[string]$Expected) { $Actual -ceq ($Expected+"`n") -or $Actual -ceq ($Expected+"`r`n") }
function HostRun([string]$Executable,[string[]]$Arguments,[string]$Folder,[string]$Label,[int]$Milliseconds) {
    HostPlain $Executable; HostPlain $Folder
    $start = New-Object Diagnostics.ProcessStartInfo
    $start.FileName=$Executable; $start.Arguments=HostArguments $Arguments; $start.WorkingDirectory=$Folder
    $start.UseShellExecute=$false; $start.CreateNoWindow=$true; $start.RedirectStandardOutput=$true; $start.RedirectStandardError=$true
    $start.EnvironmentVariables.Clear()
    $start.EnvironmentVariables['SystemRoot']='C:\Windows'; $start.EnvironmentVariables['windir']='C:\Windows'
    $start.EnvironmentVariables['TEMP']=Join-Path $Folder 'temp'; $start.EnvironmentVariables['TMP']=Join-Path $Folder 'temp'
    $start.EnvironmentVariables['ZIG_GLOBAL_CACHE_DIR']=$sharedGlobalCache
    $start.EnvironmentVariables['ZIG_LOCAL_CACHE_DIR']=Join-Path $Folder 'local-cache'; $start.EnvironmentVariables['ZIG_LIB_DIR']=Join-Path $toolRoot 'lib'
    $stdoutPath=Join-Path $Folder ($Label+'.stdout.txt'); $stderrPath=Join-Path $Folder ($Label+'.stderr.txt')
    $stdout=[IO.File]::Open($stdoutPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    $stderr=[IO.File]::Open($stderrPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    $process=New-Object Diagnostics.Process; $process.StartInfo=$start
    $held=[pscustomobject]@{process=$process;stdout=$stdout;stderr=$stderr;stdoutTask=$null;stderrTask=$null;terminal=$false;pid=$null}
    $script:NativeHostHeldRuns.Add($held)
    HostJson (Join-Path $Folder ($Label+'.intent.json')) ([ordered]@{executable=$Executable;executableSha256=(HostHash $Executable);arguments=$Arguments;
        workingDirectory=$Folder;childOnlyEnvironment=[ordered]@{SystemRoot='C:\Windows';windir='C:\Windows';TEMP=$start.EnvironmentVariables['TEMP'];TMP=$start.EnvironmentVariables['TMP'];
        ZIG_GLOBAL_CACHE_DIR=$start.EnvironmentVariables['ZIG_GLOBAL_CACHE_DIR'];ZIG_LOCAL_CACHE_DIR=$start.EnvironmentVariables['ZIG_LOCAL_CACHE_DIR'];ZIG_LIB_DIR=$start.EnvironmentVariables['ZIG_LIB_DIR']};timeoutMilliseconds=$Milliseconds})
    if (-not $process.Start()) { throw 'NATIVE_HOST_CHILD_START_FAILED_RETAINED' }; $held.pid=$process.Id
    $held.stdoutTask=$process.StandardOutput.BaseStream.CopyToAsync($stdout); $held.stderrTask=$process.StandardError.BaseStream.CopyToAsync($stderr)
    HostJson (Join-Path $Folder ($Label+'.started.json')) ([ordered]@{pid=$held.pid;startedUtc=[DateTimeOffset]::UtcNow.ToString('O');executable=$Executable;arguments=$Arguments})
    if (-not $process.WaitForExit($Milliseconds)) {
        HostJson (Join-Path $Folder ($Label+'.pending.json')) ([ordered]@{pid=$held.pid;status='UNRESOLVED_RETAIN_PID_HANDLES_STREAMS_TASKS_AND_PARTIALS';noKill=$true;noRetry=$true;heldWhileBuilderHostLives=$true})
        throw ('NATIVE_HOST_CHILD_UNRESOLVED_RETAIN_PID_'+$held.pid)
    }
    if (-not [Threading.Tasks.Task]::WaitAll([Threading.Tasks.Task[]]@($held.stdoutTask,$held.stderrTask),5000)) { throw ('NATIVE_HOST_OUTPUT_JOIN_UNRESOLVED_RETAIN_PID_'+$held.pid) }
    # CopyToAsync can expose Task<VoidTaskResult> through PowerShell's dynamic
    # binder. Discard both await results so this function returns ONE record.
    $null = $held.stdoutTask.GetAwaiter().GetResult()
    $null = $held.stderrTask.GetAwaiter().GetResult()
    $stdout.Flush($true); $stderr.Flush($true); $held.terminal=$true
    $code=$process.ExitCode; $stdout.Dispose(); $stderr.Dispose(); $process.Dispose()
    $output=[IO.File]::ReadAllText($stdoutPath,(New-Object Text.UTF8Encoding($false,$true)))
    $errorText=[IO.File]::ReadAllText($stderrPath,(New-Object Text.UTF8Encoding($false,$true)))
    $result=[ordered]@{exitCode=$code;stdout=$output;stderr=$errorText;pid=$held.pid;terminalObserved=$true;stdoutSha256=(HostHash $stdoutPath);stderrSha256=(HostHash $stderrPath)}
    HostJson (Join-Path $Folder ($Label+'.result.json')) $result
    [pscustomobject]$result
}
function HostPe([string]$Path) {
    $b=[IO.File]::ReadAllBytes($Path)
    if($b.Length -lt 256 -or $b.Length -gt 16777216 -or [BitConverter]::ToUInt16($b,0) -ne 0x5a4d){throw 'NATIVE_HOST_PE_DOS_REFUSED'}
    $pe=[int][BitConverter]::ToUInt32($b,60)
    if($pe -lt 64 -or $pe+24 -gt $b.Length -or [BitConverter]::ToUInt32($b,$pe) -ne 0x4550){throw 'NATIVE_HOST_PE_SIGNATURE_REFUSED'}
    $machine=[BitConverter]::ToUInt16($b,$pe+4);$count=[BitConverter]::ToUInt16($b,$pe+6);$size=[BitConverter]::ToUInt16($b,$pe+20);$opt=$pe+24
    if($machine -ne 0x8664 -or $count -lt 1 -or $count -gt 96 -or $size -lt 240 -or $opt+$size+$count*40 -gt $b.Length -or [BitConverter]::ToUInt16($b,$opt) -ne 0x20b){throw 'NATIVE_HOST_PE_X64_REFUSED'}
    $coffCharacteristics=[BitConverter]::ToUInt16($b,$pe+22)
    if(($coffCharacteristics -band 0x2000) -ne 0 -or ($coffCharacteristics -band 2) -eq 0 -or
        [BitConverter]::ToUInt32($b,$opt+108) -lt 16 -or [BitConverter]::ToUInt32($b,$opt+112+14*8) -ne 0 -or
        [BitConverter]::ToUInt32($b,$opt+112+14*8+4) -ne 0){throw 'NATIVE_HOST_PE_NATIVE_EXECUTABLE_REQUIRED'}
    $headers=[BitConverter]::ToUInt32($b,$opt+60);$sections=@()
    for($i=0;$i -lt $count;$i++){$s=$opt+$size+$i*40;$sections+=,[pscustomobject]@{rva=[BitConverter]::ToUInt32($b,$s+12);raw=[BitConverter]::ToUInt32($b,$s+16);offset=[BitConverter]::ToUInt32($b,$s+20)}}
    function HostOffset([uint32]$Rva){if($Rva -lt $headers -and $Rva -lt $b.Length){return [int]$Rva};foreach($s in $sections){$delta=[long]$Rva-[long]$s.rva;if($delta -ge 0 -and $delta -lt $s.raw -and [long]$s.offset+$delta -lt $b.Length){return [int]([long]$s.offset+$delta)}};throw 'NATIVE_HOST_PE_RVA_REFUSED'}
    function HostAscii([int]$Offset){$text=New-Object Text.StringBuilder;for($j=0;$j -lt 512 -and $Offset+$j -lt $b.Length;$j++){$v=$b[$Offset+$j];if($v -eq 0){return $text.ToString()};if($v -lt 32 -or $v -gt 126){throw 'NATIVE_HOST_PE_NAME_REFUSED'};$null=$text.Append([char]$v)};throw 'NATIVE_HOST_PE_NAME_BOUND'}
    $rva=[BitConverter]::ToUInt32($b,$opt+120);$length=[BitConverter]::ToUInt32($b,$opt+124);$imports=New-Object 'Collections.Generic.List[object]'
    if($rva -eq 0 -or $length -lt 20 -or $length -gt 1048576){throw 'NATIVE_HOST_PE_IMPORT_DIRECTORY_REFUSED'}
    $offset=HostOffset $rva;$ended=$false
    for($i=0;$i -lt 128 -and ($i+1)*20 -le $length;$i++){
        $at=$offset+$i*20;if($at+20 -gt $b.Length){throw 'NATIVE_HOST_PE_DESCRIPTOR_BOUND'};$values=@();for($j=0;$j -lt 5;$j++){$values+=,[BitConverter]::ToUInt32($b,$at+$j*4)}
        if(@($values|Where-Object{$_ -ne 0}).Count -eq 0){$ended=$true;break}
        $name=HostAscii (HostOffset $values[3]);$thunk=$values[0];if($thunk -eq 0){$thunk=$values[4]};$functions=New-Object 'Collections.Generic.List[string]';$thunkEnd=$false
        for($j=0;$j -lt 16384;$j++){$item=HostOffset ([uint32]([long]$thunk+$j*8));if($item+8 -gt $b.Length){throw 'NATIVE_HOST_PE_THUNK_BOUND'};$value=[BitConverter]::ToUInt64($b,$item);if($value -eq 0){$thunkEnd=$true;break};if($value -ge [UInt64]::Parse('9223372036854775808')){$functions.Add('#'+($value -band 65535))}else{if($value -gt [UInt32]::MaxValue){throw 'NATIVE_HOST_PE_THUNK_RVA_REFUSED'};$functions.Add((HostAscii ((HostOffset ([uint32]$value))+2)))}}
        if(-not $thunkEnd){throw 'NATIVE_HOST_PE_THUNK_TERMINATOR_REFUSED'};$imports.Add([ordered]@{dll=$name;functions=$functions.ToArray()})
    }
    if(-not $ended -or [BitConverter]::ToUInt32($b,$opt+112+13*8) -ne 0 -or [BitConverter]::ToUInt32($b,$opt+112+13*8+4) -ne 0 -or
        [BitConverter]::ToUInt16($b,$opt+68) -ne 3){throw 'NATIVE_HOST_PE_DIRECTORY_OR_SUBSYSTEM_REFUSED'}
    $allowed=@('KERNEL32.dll','ADVAPI32.dll','api-ms-win-crt-runtime-l1-1-0.dll','api-ms-win-crt-heap-l1-1-0.dll','api-ms-win-crt-time-l1-1-0.dll',
        'api-ms-win-crt-stdio-l1-1-0.dll','api-ms-win-crt-locale-l1-1-0.dll','api-ms-win-crt-string-l1-1-0.dll','api-ms-win-crt-convert-l1-1-0.dll',
        'api-ms-win-crt-math-l1-1-0.dll','api-ms-win-crt-environment-l1-1-0.dll','api-ms-win-crt-filesystem-l1-1-0.dll')
    foreach($import in $imports){if($import.dll -notin $allowed){throw ('NATIVE_HOST_PE_DLL_OUTSIDE_PROFILE_'+$import.dll)}}
    $characteristics=[BitConverter]::ToUInt16($b,$opt+70)
    if(($characteristics -band 0x160) -ne 0x160){throw 'NATIVE_HOST_PE_ASLR_NX_PROFILE_REFUSED'}
    [ordered]@{sha256=(HostHash $Path);length=$b.Length;machine='0x8664';optionalMagic='0x020b';subsystem=3;dllCharacteristics=('0x'+$characteristics.ToString('x4'));
        coffTimestampRaw=[BitConverter]::ToUInt32($b,$pe+8);coffDllImage=$false;clrDirectoryRva=0;clrDirectorySize=0;delayImportDirectoryRva=0;
        imports=$imports.ToArray();staticFileObservationOnly=$true;loadedModuleProof=$false;byteReproducibilityEstablished=$false}
}

HostPlain $repo
if($PSHOME -cne 'C:\Windows\System32\WindowsPowerShell\v1.0' -or [IntPtr]::Size -ne 8){throw 'NATIVE_HOST_BUILDER_POWERSHELL_PROFILE_REFUSED'}
if($PrintSourceSetSha256 -and ($RunReviewedSelfTests -or $ReviewedSourceSetSha256.Length -ne 0)){throw 'NATIVE_HOST_SOURCE_DIGEST_MODE_ARGUMENTS_REFUSED'}
if($RunReviewedSelfTests -and ($expectedChecks -le 0 -or $ReviewedSourceSetSha256 -cnotmatch '^[0-9a-f]{64}$')){throw 'NATIVE_HOST_REVIEWED_SELF_TEST_DIGEST_REQUIRED'}
if(-not $RunReviewedSelfTests -and $ReviewedSourceSetSha256.Length -ne 0){throw 'NATIVE_HOST_UNUSED_REVIEW_DIGEST_REFUSED'}
$relativeSources=@('licensing/adapter-evidence/standard-native-host/standard_host.h','licensing/adapter-evidence/standard-native-host/standard_host_core.c',
    'licensing/adapter-evidence/standard-native-host/standard_host_windows.c','licensing/adapter-evidence/standard-native-host/standard_host_tests.c',
    'licensing/adapter-evidence/standard-native-host/main.c','scripts/build-license-standard-native-host.ps1')
$sourceBytes=@{};$inputs=@(foreach($relative in $relativeSources){$path=Join-Path $repo $relative;HostPlain $path;$raw=[IO.File]::ReadAllBytes($path);
    if($raw.Length -eq 0 -or $raw.Length -gt 1048576){throw 'NATIVE_HOST_SOURCE_SIZE_REFUSED'};$sourceBytes[$relative]=$raw;[ordered]@{relative=$relative;length=$raw.Length;sha256=(HostBytesHash $raw)}})
if($inputs.Count -ne 6){throw 'NATIVE_HOST_SOURCE_COUNT_REFUSED'}
$sourceSet=[ordered]@{schema='TEST_ONLY_STANDARD_NATIVE_HOST_SOURCE_SET_V1';sourceBaselineCommitDeclared=$baseline;inputs=$inputs}
$sourceSetBytes=(New-Object Text.UTF8Encoding($false)).GetBytes(($sourceSet|ConvertTo-Json -Depth 8 -Compress))
$sourceSetHash=HostBytesHash $sourceSetBytes
if($PrintSourceSetSha256){Write-Output $sourceSetHash;return}
if($RunReviewedSelfTests -and $ReviewedSourceSetSha256 -cne $sourceSetHash){throw 'NATIVE_HOST_REVIEWED_SOURCE_SET_CHANGED'}
$before=HostTreeVerify
HostDirectory $destination
HostDirectory $sharedGlobalCache
$snapshot=Join-Path $destination 'snapshot';HostDirectory $snapshot
foreach($sourceInput in $inputs){$path=Join-Path $snapshot ([IO.Path]::GetFileName($sourceInput.relative));HostNew $path $sourceBytes[$sourceInput.relative];if((HostHash $path) -cne $sourceInput.sha256){throw 'NATIVE_HOST_SNAPSHOT_CHANGED'}}
HostNew (Join-Path $destination 'source-set.json') $sourceSetBytes
HostJson (Join-Path $destination 'tool-verification-before.json') $before
$variants=New-Object 'Collections.Generic.List[object]'
$closed=@(@(),@('--run'),@('--owner'),@('--user'),@('--service'),@('--setup'),@('--guardian'),@('--self-test','extra'),@('--SELF-TEST'),@('--bootstrap'),@('--load-clr'))
$shapeOptions=@('--attempt',('1'*32),'--plan-sha256',('2'*64),'--approval-sha256',('3'*64),'--source-set-sha256',('4'*64))
$closed+=,@(@('--owner')+$shapeOptions)
$closed+=,@(@('--user')+$shapeOptions)
$closed+=,@(@('--user')+$shapeOptions+@('--run-id',('5'*32),'--nonce',('6'*64)))
$closed+=,@(@('--service','--role','Setup')+$shapeOptions)
$closed+=,@(@('--service','--role','Guardian')+$shapeOptions)
foreach($variant in @('default','unrelated-defines','compile-only-native')){
    $folder=Join-Path $destination $variant;HostDirectory $folder
    foreach($name in @('temp','local-cache')){HostDirectory (Join-Path $folder $name)}
    $output=Join-Path $folder 'StandardNativeHost.exe'
    $arguments=@('cc','-target','x86_64-windows-gnu','-std=c11','-O2','-Wall','-Wextra','-Werror','-fno-ident','-I',$snapshot)
    if($variant -ceq 'unrelated-defines'){$arguments+='-DEVIDENCE_UNRELATED_DEFINE=1'}
    if($variant -ceq 'compile-only-native'){$arguments+='-DCOMPILE_ONLY_STANDARD_HOST_NATIVE_V1'}
    $arguments+=@('standard_host_core.c','standard_host_windows.c','standard_host_tests.c','main.c'|ForEach-Object{Join-Path $snapshot $_})
    $arguments+=@('-lkernel32','-ladvapi32','-o',$output)
    # A fresh destination has an empty Zig cache. Retain unresolved children
    # and partials on the bounded 30-minute cold-cache deadline.
    $compiled=HostRun $compiler $arguments $folder 'compile' 1800000
    if($compiled.exitCode -ne 0){throw ('NATIVE_HOST_COMPILE_FAILED_'+$variant)}
    $peInfo=HostPe $output;HostJson (Join-Path $folder 'pe-imports.json') $peInfo
    $selfTest=$null;$selfTestReportHash=$null;$refusals=New-Object 'Collections.Generic.List[object]'
    if($RunReviewedSelfTests){
        $tested=HostRun $output @('--self-test') $folder 'self-test' 30000
        $expected='{"schema":"'+$schema+'","status":"PASS","checks":'+$expectedChecks+',"nativeEffects":false,"clrImplemented":false,"scmPhysicalProven":false,"bootstrapAccepted":false,"loadedModulesAttested":false,"securityAccepted":false,"productionAccepted":false,"lic008Closed":false}'
        if($tested.exitCode -ne 0 -or $tested.stderr.Length -ne 0 -or -not (HostExactLine $tested.stdout $expected)){throw ('NATIVE_HOST_PURE_SELF_TEST_FAILED_'+$variant)}
        $selfTest=$tested.stdout|ConvertFrom-Json
        $selfTestReportHash=$tested.stdoutSha256
        for($i=0;$i -lt $closed.Count;$i++){
            $refused=HostRun $output ([string[]]$closed[$i]) $folder ('closed-'+$i) 30000
            if($refused.exitCode -ne 2 -or $refused.stdout.Length -ne 0 -or -not (HostExactLine $refused.stderr $closedError)){throw ('NATIVE_HOST_CLOSED_ENTRY_FAILED_'+$variant+'_'+$i)}
            $refusals.Add([ordered]@{arguments=$closed[$i];exitCode=2;stdoutSha256=$refused.stdoutSha256;stderrSha256=$refused.stderrSha256})
        }
    }
    $variants.Add([ordered]@{name=$variant;path=$output;sha256=$peInfo.sha256;length=$peInfo.length;peImports=$peInfo.imports;selfTestsExecuted=[bool]$RunReviewedSelfTests;
        peReportSha256=(HostHash (Join-Path $folder 'pe-imports.json'));compileIntentSha256=(HostHash (Join-Path $folder 'compile.intent.json'));
        compileStdoutSha256=$compiled.stdoutSha256;compileStderrSha256=$compiled.stderrSha256;selfTestReportSha256=$selfTestReportHash;
        selfTest=$selfTest;closedEntryResults=$refusals.ToArray();environmentBindingCompiled=($variant -ceq 'compile-only-native');
        win32ScmBindingImplemented=$false;actualNativeBindingInvoked=$false;byteReproducibilityEstablished=$false})
}
foreach($sourceInput in $inputs){if((HostHash (Join-Path $repo $sourceInput.relative)) -cne $sourceInput.sha256 -or (HostHash (Join-Path $snapshot ([IO.Path]::GetFileName($sourceInput.relative)))) -cne $sourceInput.sha256){throw 'NATIVE_HOST_BUILD_INPUT_CHANGED'}}
$after=HostTreeVerify;HostJson (Join-Path $destination 'tool-verification-after.json') $after
HostJson (Join-Path $destination 'manifest.json') ([ordered]@{schema='TEST_ONLY_STANDARD_NATIVE_HOST_FOUNDATION_BUILD_V1';sourceBaselineCommitDeclared=$baseline;
    destination=$destination;sourceSetSha256=$sourceSetHash;inputCount=6;inputs=$inputs;compilerPath=$compiler;compilerSha256=$expectedCompiler;compilerVersion='0.17.1';
    powershellPath=$powershell;powershellSha256=$expectedPowerShell;archivePath=(Join-Path $ownedTool 'zig-x86_64-windows-0.17.1.zip');archiveSha256=$expectedArchive;
    tooltreeManifestPath=(Join-Path $ownedTool 'tooltree-pins.json');tooltreeManifestSha256=$expectedTree;tooltreeFileCount=19520;tooltreeVerifiedBeforeAndAfter=$true;
    sharedGlobalCachePath=$sharedGlobalCache;sharedGlobalCachePolicy='FRESH_BUILD_OUTPUT_ONLY_NOT_ADOPTED';
    variants=$variants.ToArray();selfTestsExecuted=[bool]$RunReviewedSelfTests;reviewedSourceSetSha256=$ReviewedSourceSetSha256;nativeEffects=$false;clrImplemented=$false;
    scmPhysicalProven=$false;bootstrapAccepted=$false;loadedModulesAttested=$false;securityAccepted=$false;productionAccepted=$false;lic008Closed=$false;
    win32ScmBindingImplemented=$false;actualNativeBindingInvoked=$false;
    byteReproducibilityEstablished=$false;createdUtc=[DateTimeOffset]::UtcNow.ToString('O')})
Write-Output ('NATIVE_HOST_BUILD='+$destination)
Write-Output ('SOURCE_SET_SHA256='+$sourceSetHash)
