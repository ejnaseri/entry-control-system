[CmdletBinding()]param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dotnet='C:\Program Files\dotnet\dotnet.exe'
$sdk='C:\Program Files\dotnet\sdk\10.0.400'
$runtime='C:\Program Files\dotnet\shared\Microsoft.NETCore.App\10.0.11'
$fxr='C:\Program Files\dotnet\host\fxr\10.0.11'
$refRoot='C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Ref\10.0.11\ref\net10.0'
$hostTemplate='C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Host.win-x64\10.0.11\runtimes\win-x64\native\apphost.exe'
function Need([bool]$ok,[string]$reason){if(-not$ok){throw $reason}}
function Plain([string]$path){$p=[IO.Path]::GetFullPath($path);while($p){$i=Get-Item -LiteralPath $p -Force;Need (($i.Attributes-band[IO.FileAttributes]::ReparsePoint)-eq0) 'Reparse input refused';$next=[IO.Path]::GetDirectoryName($p);if($next-eq$p){break};$p=$next}}
function Hash([string]$path){Plain $path;(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
function WriteNew([string]$path,[byte[]]$bytes){$s=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$s.Write($bytes,0,$bytes.Length);$s.Flush($true)}finally{$s.Dispose()}}
function Json([string]$path,$data){WriteNew $path ([Text.Encoding]::UTF8.GetBytes(($data|ConvertTo-Json -Depth 30)))}
function CopyNew([string]$from,[string]$to){Plain $from;WriteNew $to ([IO.File]::ReadAllBytes($from))}
function Inventory([string]$dir){Plain $dir;@(Get-ChildItem -LiteralPath $dir -File -Force|Sort-Object Name|ForEach-Object{[pscustomobject]@{name=$_.Name;size=$_.Length;sha256=(Hash $_.FullName)}})}
function Validate([string]$dir,$rows){$seen=@{};foreach($r in $rows){Need (($r.name-cmatch'^[A-Za-z0-9][A-Za-z0-9._-]*$'-or$r.name-ceq'.version')-and-not$seen.ContainsKey($r.name)) 'Unsafe inventory';$seen[$r.name]=$true;$p=Join-Path $dir $r.name;Need ((Hash $p)-ceq$r.sha256-and(Get-Item -LiteralPath $p).Length-eq$r.size) 'Inventory changed'};$actual=@(Get-ChildItem -LiteralPath $dir -Force);Need ($actual.Count-eq@($rows).Count-and@($actual|Where-Object{$_.PSIsContainer-or-not$seen.ContainsKey($_.Name)}).Count-eq0) 'Unexpected inventory entry'}
Need ($repo-ieq'E:\EntryControlSystem'-and[Environment]::Is64BitProcess) 'Unexpected workspace/process'
Need ((& $dotnet --version)-ceq'10.0.400') 'SDK mismatch'
$prefix='licensing/adapter-evidence/pilot-foundation/'
$names=@('Policy.cs','Program.cs','MakeHost.cs','README.md')
$sourceDir=Join-Path $repo $prefix;Plain $sourceDir
Need (@(Get-ChildItem -LiteralPath $sourceDir -Force).Count-eq$names.Count-and@(Get-ChildItem -LiteralPath $sourceDir -Force|Where-Object{$_.PSIsContainer-or$_.Name-cnotin$names}).Count-eq0) 'Unexpected source'
$sources=@($names|ForEach-Object{$prefix+$_})+@('scripts/build-license-pilot-foundation.ps1','docs/licensing/plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC.md','docs/licensing/plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_V02.md')
Need ((Hash (Join-Path $repo $sources[-2]))-ceq'8e50ace849f4f542e096532dda6d45314bb1508f93bb8c83e85728efb5155452') 'Original spec changed'
Need ((Hash (Join-Path $repo $sources[-1]))-ceq'f2859ad5a1d3bd5a41f2cec89448ac98ca042585118ecd9b40d08d2bf3916706') 'Ownership spec changed'
$head=(& git -C $repo rev-parse HEAD|Out-String).Trim();Need ($LASTEXITCODE-eq0) 'Git unavailable'
$dirty=(& git -C $repo status --porcelain -- $sources|Out-String).Trim()
$diff=(& git -C $repo diff --no-ext-diff --no-textconv HEAD -- $sources|Out-String)
Need ($LASTEXITCODE-eq0) 'Diff unavailable'
$out=Join-Path $repo ('out/lic008-pilot-foundation-'+[guid]::NewGuid().ToString('N'))
Plain (Join-Path $repo 'out');$null=New-Item -ItemType Directory -Path $out
$snap=Join-Path $out 'snapshot';$compiler=Join-Path $out 'compiler';$refs=Join-Path $out 'references';$tool=Join-Path $out 'host-tool';$package=Join-Path $out 'package'
foreach($d in @($snap,$compiler,$refs,$tool,$package)){$null=New-Item -ItemType Directory -Path $d}
$sourceRows=@(foreach($relative in $sources){$target=Join-Path $snap ([IO.Path]::GetFileName($relative));CopyNew (Join-Path $repo $relative) $target;[pscustomobject]@{relative=$relative;name=[IO.Path]::GetFileName($target);size=(Get-Item -LiteralPath $target).Length;sha256=(Hash $target)}})
Json (Join-Path $out 'source-manifest.json') @{sourceCommit=$head;sourceDirty=($dirty.Length-gt0);trackedDiff=$diff;files=$sourceRows}
foreach($f in Get-ChildItem -LiteralPath (Join-Path $sdk 'Roslyn/bincore') -File -Force){CopyNew $f.FullName (Join-Path $compiler $f.Name)}
foreach($f in Get-ChildItem -LiteralPath $refRoot -File -Filter '*.dll'){CopyNew $f.FullName (Join-Path $refs $f.Name)}
CopyNew (Join-Path $sdk 'Microsoft.NET.HostModel.dll') (Join-Path $tool 'Microsoft.NET.HostModel.dll')
CopyNew $hostTemplate (Join-Path $tool 'apphost-template.exe')
$runtimeRows=Inventory $runtime;$fxrRows=Inventory $fxr;$compilerRows=Inventory $compiler;$refRows=Inventory $refs;$executorHash=Hash $dotnet
$hostInputs=Inventory $tool
Json (Join-Path $out 'toolchain-manifest.json') @{sdk='10.0.400';runtime='10.0.11';dotnetExeSha256=$executorHash;compiler=$compilerRows;references=$refRows;hostInputs=$hostInputs;runtimeFiles=$runtimeRows;hostfxrFiles=$fxrRows;networkRestore=$false;msbuild=$false}
function Compile([string]$name,[string]$dest,[string[]]$files,[bool]$hostModel){$a=@('-nologo','-nostdlib+','-target:exe','-deterministic+','-nullable:enable','-warnaserror+','-langversion:14',('-out:"'+$dest+'"'));$a+=@($refRows|ForEach-Object{'-r:"'+(Join-Path $refs $_.name)+'"'});if($hostModel){$a+=('-r:"'+(Join-Path $tool 'Microsoft.NET.HostModel.dll')+'"')};$a+=@($files|ForEach-Object{'"'+(Join-Path $snap $_)+'"'});$rsp=Join-Path $out ($name+'.rsp');WriteNew $rsp ([Text.Encoding]::UTF8.GetBytes(($a-join[Environment]::NewLine)));& $dotnet exec --fx-version 10.0.11 (Join-Path $compiler 'csc.dll') -noconfig ('@'+$rsp);Need ($LASTEXITCODE-eq0) 'Compile failed; retain output'}
Compile 'host-tool' (Join-Path $tool 'MakeHost.dll') @('MakeHost.cs') $true
Json (Join-Path $tool 'MakeHost.runtimeconfig.json') @{runtimeOptions=@{tfm='net10.0';framework=@{name='Microsoft.NETCore.App';version='10.0.11'};rollForward='Disable'}}
Json (Join-Path $tool 'MakeHost.deps.json') @{runtimeTarget=@{name='.NETCoreApp,Version=v10.0'};targets=@{'.NETCoreApp,Version=v10.0'=@{'MakeHost/1.0.0'=@{runtime=@{'MakeHost.dll'=@{};'Microsoft.NET.HostModel.dll'=@{}}}}};libraries=@{'MakeHost/1.0.0'=@{type='project';serviceable=$false;sha512=''}}}
Compile 'foundation' (Join-Path $package 'EntryControl.PilotFoundation.dll') @('Policy.cs','Program.cs') $false
foreach($f in $runtimeRows){CopyNew (Join-Path $runtime $f.name) (Join-Path $package $f.name)}
foreach($f in $fxrRows){CopyNew (Join-Path $fxr $f.name) (Join-Path $package $f.name)}
Json (Join-Path $package 'EntryControl.PilotFoundation.runtimeconfig.json') @{runtimeOptions=@{tfm='net10.0';includedFrameworks=@(@{name='Microsoft.NETCore.App';version='10.0.11'})}}
$deps=Get-Content -LiteralPath (Join-Path $package 'Microsoft.NETCore.App.deps.json') -Raw|ConvertFrom-Json
$entry=@{runtime=@{'EntryControl.PilotFoundation.dll'=@{}};dependencies=@{'Microsoft.NETCore.App.Runtime.win-x64'='10.0.11'}}
$deps.targets.'.NETCoreApp,Version=v10.0/win-x64'|Add-Member -NotePropertyName 'EntryControl.PilotFoundation/0.1.3' -NotePropertyValue $entry
$deps.libraries|Add-Member -NotePropertyName 'EntryControl.PilotFoundation/0.1.3' -NotePropertyValue @{type='project';serviceable=$false;sha512=''}
Json (Join-Path $package 'EntryControl.PilotFoundation.deps.json') $deps
$exe=Join-Path $package 'EntryControl.PilotFoundation.exe'
& $dotnet exec --fx-version 10.0.11 (Join-Path $tool 'MakeHost.dll') (Join-Path $tool 'apphost-template.exe') $exe
Need ($LASTEXITCODE-eq0) 'Host creation failed'
$toolRows=Inventory $tool;$packageRows=Inventory $package
Json (Join-Path $out 'package-manifest.json') @{scope='TEST_ONLY_PILOT_FOUNDATION_PURE';selfContained=$true;physicalControllerIncluded=$false;files=$packageRows}
$text=(& $exe --self-test|Out-String);Need ($LASTEXITCODE-eq0) 'Pure tests failed'
$report=$text|ConvertFrom-Json
Need ($report.scope-ceq'TEST_ONLY_PILOT_FOUNDATION_PURE'-and$report.loadedAssemblySha256-ceq(Hash (Join-Path $package 'EntryControl.PilotFoundation.dll'))-and$report.executorExeSha256-ceq(Hash $exe)-and$report.runtime-ceq'10.0.11'-and$report.artifactVersion-ceq'0.1.3') 'Emitter mismatch'
Need (@($report.results).Count-gt0-and@($report.results|Where-Object status -CNE 'PASS').Count-eq0-and$report.physicalImplemented-eq$false-and$report.physicalTested-eq$false-and$report.measuredTokenOwner-eq$false-and$report.runtimeAuthority-ceq'NONE') 'Unexpected result authority'
WriteNew (Join-Path $out 'pure-test-report.json') ([Text.Encoding]::UTF8.GetBytes($text))
# Check the actual executable refuses a physical command; never invoke a controller.
$psi=New-Object Diagnostics.ProcessStartInfo;$psi.FileName=$exe;$psi.Arguments='--role Setup';$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
$process=[Diagnostics.Process]::Start($psi);$stdout=$process.StandardOutput.ReadToEnd();$stderr=$process.StandardError.ReadToEnd();$process.WaitForExit();Need ($process.ExitCode-eq2-and$stdout.Length-eq0-and$stderr.Trim()-ceq'PHYSICAL_ACTION_NOT_IMPLEMENTED') 'Physical command did not refuse';$process.Dispose()
Json (Join-Path $out 'entry-refusal.json') @{arguments='--role Setup';exitCode=2;stdoutEmpty=$true;errorCode='PHYSICAL_ACTION_NOT_IMPLEMENTED';physicalExecuted=$false}
Validate $snap $sourceRows;Validate $compiler $compilerRows;Validate $refs $refRows;Validate $runtime $runtimeRows;Validate $fxr $fxrRows;Validate $tool $toolRows;Validate $package $packageRows
Need ((Hash $dotnet)-ceq$executorHash) 'Executor changed'
foreach($s in $sourceRows){Need ((Hash (Join-Path $repo $s.relative))-ceq$s.sha256) 'Repository source changed'}
$bindings=@(foreach($name in @('source-manifest.json','toolchain-manifest.json','package-manifest.json','host-tool.rsp','foundation.rsp','pure-test-report.json','entry-refusal.json')){[pscustomobject]@{relative=$name;sha256=(Hash (Join-Path $out $name))}})
Json (Join-Path $out 'build-provenance.json') @{schemaVersion=1;scope='TEST_ONLY_PILOT_FOUNDATION_PURE';sourceCommit=$head;sourceDirty=($dirty.Length-gt0);inputsAndOutputs=$bindings;hostToolFiles=$toolRows;pureCases=@($report.results).Count;selfContained=$true;physicalControllerIncluded=$false;physicalTested=$false;securityAccepted=$false;productionAccepted=$false;runtimeAuthority='NONE';durable=$false;sourceBinaryEquivalenceAccepted=$false}
Write-Output ('PASS: '+@($report.results).Count+' pure policy cases; actual apphost physical-mode refusal; frozen self-contained assembly/executor/runtime bindings.')
Write-Output ('Report: '+(Join-Path $out 'build-provenance.json'))
