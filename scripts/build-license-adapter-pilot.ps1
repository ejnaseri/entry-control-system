[CmdletBinding()]param([switch]$TestCapable,[string]$ReviewedSuccessorSha256)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Explicit build selection only: never owner permission or execution authority.
$isolatedSuccessor='8d6b30a67a7060b1e343b1fa485c11f460698d20017bc48da597fcd67757ea30'
if($TestCapable-and$ReviewedSuccessorSha256-cne$isolatedSuccessor){throw 'ISOLATED_V2_BUILD_REVIEW_PIN_REQUIRED'}
if(-not$TestCapable-and$ReviewedSuccessorSha256){throw 'UNEXPECTED_CAPABLE_BUILD_PIN'}
$capable=[bool]$TestCapable
$entryReason=if($capable){'PILOT_FAILED_OR_REFUSED'}else{'PHYSICAL_CONTROLLER_NOT_READY'}
# Candidate primitives only. This builder never invokes any physical role.
$repo=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$dotnet='C:\Program Files\dotnet\dotnet.exe'
$sdk='C:\Program Files\dotnet\sdk\10.0.400'
$refs='C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Ref\10.0.11\ref\net10.0'
function Need([bool]$ok,[string]$reason){if(-not $ok){throw $reason}}
function Hash([string]$path){(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
function Plain([string]$path){$cursor=[IO.Path]::GetFullPath($path);while($cursor){$item=Get-Item -LiteralPath $cursor -Force;Need (($item.Attributes-band[IO.FileAttributes]::ReparsePoint)-eq0) 'Reparse input refused';$cursor=[IO.Path]::GetDirectoryName($cursor)}}
function WriteNew([string]$path,[byte[]]$bytes){$stream=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read);try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}}
function JsonNew([string]$path,$value){WriteNew $path ([Text.Encoding]::UTF8.GetBytes(($value|ConvertTo-Json -Depth 20)))}
Need ([Environment]::Is64BitProcess) '64-bit builder required'
Need ((& $dotnet --version)-ceq'10.0.400') 'SDK mismatch'
$names=@('Program.cs','PlanAdmission.cs','ServiceHost.cs','NativeTokens.cs','SecureFiles.cs','KeyOperations.cs','NativeWorker.cs','RoleActions.cs','ReportEmitter.cs','ControllerWindows.cs','ProcessObserver.cs','BootstrapAdmission.cs')
$sourceDir=Join-Path $repo 'licensing/adapter-evidence/pilot-runtime';Plain $sourceDir
if($capable){
    $programSource=[IO.File]::ReadAllText((Join-Path $sourceDir 'Program.cs'))
    Need ($programSource.Contains('Root="C:/ProgramData/Ecs.Lic008.EntryEvidenceV2"')-and$programSource.Contains('Prefix="Ecs.Lic008.EntryEvidenceV2"')-and$programSource.Contains('SuccessorPacketSha256="'+$isolatedSuccessor+'"')) 'CAPABLE_NAMESPACE_BINDING_REFUSED'
}
Need (@(Get-ChildItem -LiteralPath $sourceDir -File -Filter '*.cs').Count-eq$names.Count) 'Unexpected source file count'
$protocolPins=@(
    @{relative='licensing/adapter-evidence/pilot-implementation/implementation-packet-v05.json';sha256='8d6b30a67a7060b1e343b1fa485c11f460698d20017bc48da597fcd67757ea30'},
    @{relative='docs/licensing/plans/LICENSING_PILOT_ISOLATED_PLACEMENT_PLAN.md';sha256='cfa351fc5e153e61c2d7837fa1a43d565368213a4ba99d4c1f923c62e4c1d123'},
    @{relative='licensing/adapter-evidence/pilot-implementation/implementation-packet-v04.json';sha256='c25920687086f0ade2d90486aa02556212a5172e12b423df02ee0650ca69bd7b'},
    @{relative='licensing/adapter-evidence/pilot-implementation/report-identity-contract-v02.json';sha256='83a90e0eaed1a1a60bd727a0f7dc7931875b10d6b959231b53757b6d4c3deaf7'},
    @{relative='docs/licensing/plans/LICENSING_REPORT_IDENTITY_V02_ADOPTION_PLAN.md';sha256='51655e6c48ba1c306d6b8c1dd441856122ac296894a3c251b461d7a676621ece'},
    @{relative='licensing/adapter-evidence/guardian-readonly/RESTRICTION_LENGTH_REVIEW.md';sha256='7eb18d3b62bde00889025ca21354ab71b6884ae0f5412abd28eba51f277790f9'},
    @{relative='licensing/adapter-evidence/pilot-implementation/implementation-packet-v04-draft.json';sha256='949eb0806a38a71567c78b2ac0def9419e02435885d98d1d7dd4aa692b99d3b9'},
    @{relative='docs/licensing/reviews/LICENSING_REPORT_IDENTITY_V02_REVIEW.md';sha256='d68bed83bba7d432fc287c32cf594d713a3eccd294c845af24d52cf796b3415f'},
    @{relative='docs/licensing/plans/LICENSING_REPORT_IDENTITY_V02_ADOPTION.md';sha256='a4b6e8a8cc93f0af688434e32dfa2e1197642b32f2b8e5e801cc1f0703cddf6a'},
    @{relative='licensing/adapter-evidence/pilot-implementation/implementation-packet-v03.json';sha256='44ede8aa237a80667ccc3c3da4580aa8231041d443d7b9904be32481b6233d8a'},
    @{relative='licensing/adapter-evidence/pilot-implementation/owner-authority-contract-v01.json';sha256='a4537539bdeda1fcf60e2c52799cf91b75c8f1906dc97fece11ddbeaf99d8983'},
    @{relative='docs/licensing/plans/LICENSING_PILOT_OWNER_AUTHORITY_PLAN.md';sha256='36cd7081505f0b5ddc616939f2ecc110ed6629e7845f87c3f2d23578410c77b1'},
    @{relative='docs/licensing/reviews/LICENSING_PILOT_OWNER_CONNECTION_REVIEW.md';sha256='6c99cc75806f28a4947adf9d8fff5a4a2359f2a0b572db1c2da70ae5392ad28a'},
    @{relative='docs/licensing/reviews/LICENSING_PILOT_OWNER_AUTHORITY_REVIEW.md';sha256='9dab34bceae8a2c81647813f8f01407f1362801e18e1787882abc79b7c2c1e04'},
    @{relative='docs/licensing/plans/LICENSING_PILOT_OWNER_AUTHORITY_ADOPTION.md';sha256='caa9d9a28598d277c3372ae60cf133a802bdebff7fc7f8f3606fd0b111a9ad9e'},
    @{relative='licensing/adapter-evidence/pilot-implementation/implementation-packet.json';sha256='8d182ccd61ed911b1d9019a3426c6d3725cbf268e3b57cdc064544cb21aa822e'},
    @{relative='licensing/adapter-evidence/pilot-implementation/implementation-packet-v02.json';sha256='73235a629ff81da4ac611b97d9c2e1c8999d4f8312c24e4f4b93cc823a564a14'},
    @{relative='docs/licensing/plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC.md';sha256='8e50ace849f4f542e096532dda6d45314bb1508f93bb8c83e85728efb5155452'},
    @{relative='docs/licensing/plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_V02.md';sha256='f2859ad5a1d3bd5a41f2cec89448ac98ca042585118ecd9b40d08d2bf3916706'},
    @{relative='docs/licensing/plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_V03.md';sha256='dfce64538c6fd13aa0891996f9ee94b7807c9e210be3060b508b66f2e75848d6'},
    @{relative='docs/licensing/reviews/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_V03_REVIEW.md';sha256='c9e521847cfe097767f71111685baa4d5216e5702c13d616870dfa23ee521bd4'},
    @{relative='docs/licensing/plans/LICENSING_ADAPTER_PHYSICAL_PILOT_SPEC_V03_ADOPTION.md';sha256='2ce23e0bc92bd00d1acc6751a787b18b966ac15802a95082a311a16ec7709e15'},
    @{relative='licensing/adapter-evidence/pilot-foundation/Policy.cs';sha256='543ac48ccd7254f2e477975e6f79c9147874a239f633437849d7b611b919a579'}
)
$sources=@($names|ForEach-Object{'licensing/adapter-evidence/pilot-runtime/'+$_})+@('licensing/adapter-evidence/track-a/CandidateCodec.cs','scripts/build-license-adapter-pilot.ps1','licensing/adapter-evidence/pilot-kit/Run-Pilot.ps1','licensing/adapter-evidence/pilot-kit/README-fa.txt')+@($protocolPins|ForEach-Object{$_.relative})
foreach($relative in $sources){Plain (Join-Path $repo $relative)}
foreach($pin in $protocolPins){Need ((Hash (Join-Path $repo $pin.relative))-ceq$pin.sha256) 'Protocol/adoption input changed'}
Need ((Hash (Join-Path $repo 'licensing/adapter-evidence/track-a/CandidateCodec.cs'))-ceq'62723ac52f4f3ded49d32e128f3ad3a0cabb25a2491381858f9ec4b9ce433893') 'Historical codec changed'
$outParent=Join-Path $repo 'out';Plain $outParent
$out=Join-Path $outParent ('lic008-pilot-runtime-candidate-'+[guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $out
$snapshot=Join-Path $out 'snapshot';$compiler=Join-Path $out 'compiler';$referenceCopy=Join-Path $out 'references'
foreach($directory in @($snapshot,$compiler,$referenceCopy)){$null=New-Item -ItemType Directory -Path $directory}
$rows=@(foreach($relative in $sources){$origin=Join-Path $repo $relative;$target=Join-Path $snapshot ([IO.Path]::GetFileName($relative));WriteNew $target ([IO.File]::ReadAllBytes($origin));[pscustomobject]@{relative=$relative;name=[IO.Path]::GetFileName($target);sha256=(Hash $target)}})
$head=(& git -C $repo rev-parse HEAD|Out-String).Trim();Need ($LASTEXITCODE-eq0) 'Git unavailable'
JsonNew (Join-Path $out 'source-manifest.json') @{sourceCommit=$head;sourceDirty=$true;scope='CANDIDATE_PRIMITIVES_NOT_KIT';files=$rows}
foreach($f in Get-ChildItem -LiteralPath (Join-Path $sdk 'Roslyn/bincore') -File){Plain $f.FullName;WriteNew (Join-Path $compiler $f.Name) ([IO.File]::ReadAllBytes($f.FullName))}
foreach($f in Get-ChildItem -LiteralPath $refs -File -Filter '*.dll'){Plain $f.FullName;WriteNew (Join-Path $referenceCopy $f.Name) ([IO.File]::ReadAllBytes($f.FullName))}
$toolRows=@(foreach($d in @($compiler,$referenceCopy)){Get-ChildItem -LiteralPath $d -File|Sort-Object Name|ForEach-Object{[pscustomobject]@{path=$_.FullName;sha256=(Hash $_.FullName)}}})
$executorHash=Hash $dotnet
$dll=Join-Path $out 'EntryControl.AdapterPilot.dll'
$arguments=@('-nologo','-nostdlib+','-target:exe','-deterministic+','-nullable:enable','-warnaserror+','-langversion:14',('-out:"'+$dll+'"'))
if($capable){$arguments+='-define:TEST_CAPABLE_PILOT'}
$arguments+=@(Get-ChildItem -LiteralPath $referenceCopy -File|ForEach-Object{'-r:"'+$_.FullName+'"'})
$arguments+=@(($names+@('CandidateCodec.cs'))|ForEach-Object{'"'+(Join-Path $snapshot $_)+'"'})
$response=Join-Path $out 'candidate.rsp';WriteNew $response ([Text.Encoding]::UTF8.GetBytes(($arguments-join[Environment]::NewLine)))
& $dotnet exec --fx-version 10.0.11 (Join-Path $compiler 'csc.dll') -noconfig ('@'+$response)
Need ($LASTEXITCODE-eq0) 'Candidate compile failed; retain output'
JsonNew (Join-Path $out 'EntryControl.AdapterPilot.runtimeconfig.json') @{runtimeOptions=@{tfm='net10.0';framework=@{name='Microsoft.NETCore.App';version='10.0.11'};rollForward='Disable'}}
$testText=(& $dotnet exec --fx-version 10.0.11 $dll --self-test|Out-String);Need ($LASTEXITCODE-eq0) 'Pure candidate tests failed'
$report=$testText|ConvertFrom-Json
Need ($report.scope-ceq'TEST_ONLY_PILOT_RUNTIME_PURE'-and$report.loadedAssemblySha256-ceq(Hash $dll)-and$report.executorExeSha256-ceq$executorHash-and$report.physicalTested-eq$false) 'Pure report binding failed'
Need ($report.successorPacketSha256-ceq'8d6b30a67a7060b1e343b1fa485c11f460698d20017bc48da597fcd67757ea30') 'Compiled successor packet pin mismatch'
WriteNew (Join-Path $out 'pure-test-report.json') ([Text.Encoding]::UTF8.GetBytes($testText))
$refusals=@(foreach($entry in @('--service Invalid setup-create','--child Invalid child-prepare','--controller Prepare')){
    $psi=New-Object Diagnostics.ProcessStartInfo;$psi.FileName=$dotnet;$psi.Arguments='exec --fx-version 10.0.11 "'+$dll+'" '+$entry+' '+('a'*64)
    $psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
    $process=[Diagnostics.Process]::Start($psi);$stdout=$process.StandardOutput.ReadToEnd();$stderr=$process.StandardError.ReadToEnd();$process.WaitForExit()
    Need ($process.ExitCode-eq2-and$stdout.Length-eq0-and$stderr.Trim()-ceq$entryReason) 'Physical entry did not refuse'
    $process.Dispose();[pscustomobject]@{entry=$entry;exitCode=2;reasonCode=$entryReason;nativeExecuted=$false}
})
JsonNew (Join-Path $out 'entry-refusals.json') $refusals
$parseTokens=$null;$parseErrors=$null
$null=[Management.Automation.Language.Parser]::ParseFile((Join-Path $snapshot 'Run-Pilot.ps1'),[ref]$parseTokens,[ref]$parseErrors)
Need (@($parseErrors).Count-eq0) 'Controller syntax failed'
# Actual guarded controller processes: all three physical stages refuse before
# inspecting CandidateDirectory, tokens, services, CNG or ProgramData.
foreach($stage in @('Prepare','VerifyFreshProcess','Finish')) {
    $psi=New-Object Diagnostics.ProcessStartInfo;$psi.FileName=Join-Path $PSHOME 'powershell.exe'
    $psi.Arguments='-NoProfile -ExecutionPolicy Bypass -File "'+(Join-Path $snapshot 'Run-Pilot.ps1')+'" -Stage '+$stage
    $psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
    $process=[Diagnostics.Process]::Start($psi);$stdout=$process.StandardOutput.ReadToEnd();$stderr=$process.StandardError.ReadToEnd();$process.WaitForExit()
    Need ($process.ExitCode-eq2-and$stdout.Length-eq0-and$stderr.Trim()-ceq'PHYSICAL_CONTROLLER_NOT_READY') 'Controller physical stage did not refuse';$process.Dispose()
}
foreach($r in $rows){Need ((Hash (Join-Path $snapshot $r.name))-ceq$r.sha256-and(Hash (Join-Path $repo $r.relative))-ceq$r.sha256) 'Source changed'}
foreach($r in $toolRows){Need ((Hash $r.path)-ceq$r.sha256) 'Toolchain changed'}
Need ((Hash $dotnet)-ceq$executorHash) 'Executor changed'
$bindings=@(foreach($name in @('source-manifest.json','candidate.rsp','EntryControl.AdapterPilot.dll','EntryControl.AdapterPilot.runtimeconfig.json','pure-test-report.json','entry-refusals.json')){[pscustomobject]@{name=$name;sha256=(Hash (Join-Path $out $name))}})
JsonNew (Join-Path $out 'build-provenance.json') @{schemaVersion=1;scope='CANDIDATE_PRIMITIVES_NOT_KIT';sourceCommit=$head;toolchain=$toolRows;executorSha256=$executorHash;bindings=$bindings;protocolInputs=$protocolPins;successorPacketSha256=$report.successorPacketSha256;pureCases=$report.cases;controllerSyntaxPassed=$true;controllerPhysicalStageRefusals=3;physicalControllerIncluded=$capable;physicalEntryEnabled=$capable;physicalTested=$false;securityAccepted=$false;productionAccepted=$false;networkRestore=$false;runtimeAuthority='NONE';durable=$false}
$psi=New-Object Diagnostics.ProcessStartInfo;$psi.FileName=Join-Path $PSHOME 'powershell.exe'
$psi.Arguments='-NoProfile -ExecutionPolicy Bypass -File "'+(Join-Path $snapshot 'Run-Pilot.ps1')+'" -Stage SelfTest -CandidateDirectory "'+$out+'" -ExpectedProvenanceSha256 '+(Hash (Join-Path $out 'build-provenance.json'))
$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
$process=[Diagnostics.Process]::Start($psi);$stdout=$process.StandardOutput.ReadToEnd();$stderr=$process.StandardError.ReadToEnd();$process.WaitForExit()
Need ($process.ExitCode-eq0-and$stderr.Length-eq0) 'Bound controller self-test failed'
$controllerReport=$stdout|ConvertFrom-Json
Need ($controllerReport.cases-eq$report.cases-and$controllerReport.loadedAssemblySha256-ceq$report.loadedAssemblySha256-and$controllerReport.physicalTested-eq$false) 'Controller emitter binding failed';$process.Dispose()
JsonNew (Join-Path $out 'controller-entry-checks.json') @{provenanceSha256=(Hash (Join-Path $out 'build-provenance.json'));selfTestPassed=$true;pureCases=$controllerReport.cases;physicalStageRefusals=3;physicalExecuted=$false}
Write-Output ('PASS: '+$report.cases+' pure candidate cases; three native-entry and three controller-stage refusals; bound controller SelfTest; no physical operations.')
Write-Output ('Report: '+(Join-Path $out 'build-provenance.json'))

# Separate self-contained, still-gated artifact. No publish/MSBuild/network restore.
$package=Join-Path $out 'package';$hostTool=Join-Path $out 'host-tool'
foreach($directory in @($package,$hostTool)){$null=New-Item -ItemType Directory -Path $directory}
function Inventory([string]$directory){@(Get-ChildItem -LiteralPath $directory -File -Force|Sort-Object Name|ForEach-Object{Plain $_.FullName;[pscustomobject]@{name=$_.Name;size=$_.Length;sha256=(Hash $_.FullName)}})}
function VerifyInventory([string]$directory,$inventory){$actual=@(Get-ChildItem -LiteralPath $directory -Force);Need ($actual.Count-eq@($inventory).Count) 'Package extra/missing entry';foreach($file in $inventory){Need ($file.name-cmatch'^[A-Za-z0-9][A-Za-z0-9._-]*$'-or$file.name-ceq'.version') 'Package name refused';$path=Join-Path $directory $file.name;Plain $path;Need ((Hash $path)-ceq$file.sha256-and(Get-Item -LiteralPath $path).Length-eq$file.size) 'Package changed'}}
$runtimeRoot='C:\Program Files\dotnet\shared\Microsoft.NETCore.App\10.0.11';$fxrRoot='C:\Program Files\dotnet\host\fxr\10.0.11'
$runtimeInventory=Inventory $runtimeRoot;$fxrInventory=Inventory $fxrRoot
foreach($file in $runtimeInventory){WriteNew (Join-Path $package $file.name) ([IO.File]::ReadAllBytes((Join-Path $runtimeRoot $file.name)))}
foreach($file in $fxrInventory){WriteNew (Join-Path $package $file.name) ([IO.File]::ReadAllBytes((Join-Path $fxrRoot $file.name)))}
WriteNew (Join-Path $package 'EntryControl.AdapterPilot.dll') ([IO.File]::ReadAllBytes($dll))
JsonNew (Join-Path $package 'EntryControl.AdapterPilot.runtimeconfig.json') @{runtimeOptions=@{tfm='net10.0';includedFrameworks=@(@{name='Microsoft.NETCore.App';version='10.0.11'})}}
$deps=Get-Content -LiteralPath (Join-Path $package 'Microsoft.NETCore.App.deps.json') -Raw|ConvertFrom-Json
$deps.targets.'.NETCoreApp,Version=v10.0/win-x64'|Add-Member -NotePropertyName 'EntryControl.AdapterPilot/0.2.0' -NotePropertyValue @{runtime=@{'EntryControl.AdapterPilot.dll'=@{}};dependencies=@{'Microsoft.NETCore.App.Runtime.win-x64'='10.0.11'}}
$deps.libraries|Add-Member -NotePropertyName 'EntryControl.AdapterPilot/0.2.0' -NotePropertyValue @{type='project';serviceable=$false;sha512=''}
JsonNew (Join-Path $package 'EntryControl.AdapterPilot.deps.json') $deps
$template='C:\Program Files\dotnet\packs\Microsoft.NETCore.App.Host.win-x64\10.0.11\runtimes\win-x64\native\apphost.exe'
Plain $template;Plain (Join-Path $sdk 'Microsoft.NET.HostModel.dll')
WriteNew (Join-Path $hostTool 'template.exe') ([IO.File]::ReadAllBytes($template))
WriteNew (Join-Path $hostTool 'Microsoft.NET.HostModel.dll') ([IO.File]::ReadAllBytes((Join-Path $sdk 'Microsoft.NET.HostModel.dll')))
$helper='using System; using System.IO; using Microsoft.NET.HostModel.AppHost; class MakePilotHost { static void Main(string[] a) { if(a.Length!=2 || File.Exists(a[1])) throw new Exception("NEW_HOST_ONLY"); HostWriter.CreateAppHost(a[0],a[1],"EntryControl.AdapterPilot.dll",dotNetSearchOptions:new HostWriter.DotNetSearchOptions {Location=HostWriter.DotNetSearchOptions.SearchLocation.AppLocal}); } }'
WriteNew (Join-Path $hostTool 'MakePilotHost.cs') ([Text.Encoding]::UTF8.GetBytes($helper))
$hostArguments=@('-nologo','-nostdlib+','-target:exe','-deterministic+','-warnaserror+',('-out:"'+(Join-Path $hostTool 'MakePilotHost.dll')+'"'))
$hostArguments+=@(Get-ChildItem -LiteralPath $referenceCopy -File|ForEach-Object{'-r:"'+$_.FullName+'"'})
$hostArguments+=@('-r:"'+(Join-Path $hostTool 'Microsoft.NET.HostModel.dll')+'"','"'+(Join-Path $hostTool 'MakePilotHost.cs')+'"')
WriteNew (Join-Path $hostTool 'host.rsp') ([Text.Encoding]::UTF8.GetBytes(($hostArguments-join[Environment]::NewLine)))
& $dotnet exec --fx-version 10.0.11 (Join-Path $compiler 'csc.dll') -noconfig ('@'+(Join-Path $hostTool 'host.rsp'));Need ($LASTEXITCODE-eq0) 'Host tool compile failed'
JsonNew (Join-Path $hostTool 'MakePilotHost.runtimeconfig.json') @{runtimeOptions=@{tfm='net10.0';framework=@{name='Microsoft.NETCore.App';version='10.0.11'};rollForward='Disable'}}
JsonNew (Join-Path $hostTool 'MakePilotHost.deps.json') @{runtimeTarget=@{name='.NETCoreApp,Version=v10.0'};targets=@{'.NETCoreApp,Version=v10.0'=@{'MakePilotHost/1.0.0'=@{runtime=@{'MakePilotHost.dll'=@{};'Microsoft.NET.HostModel.dll'=@{}}}}};libraries=@{'MakePilotHost/1.0.0'=@{type='project';serviceable=$false;sha512=''}}}
$exe=Join-Path $package 'EntryControl.AdapterPilot.exe'
& $dotnet exec --fx-version 10.0.11 (Join-Path $hostTool 'MakePilotHost.dll') (Join-Path $hostTool 'template.exe') $exe
Need ($LASTEXITCODE-eq0) 'App-local host creation failed'
$packageInventory=Inventory $package
JsonNew (Join-Path $out 'package-manifest.json') @{scope='GATED_SELF_CONTAINED_PILOT_PACKAGE';selfContained=$true;runtime='10.0.11';physicalEntryEnabled=$capable;files=$packageInventory}
function PackageProcess([string]$arguments){$psi=New-Object Diagnostics.ProcessStartInfo;$psi.FileName=$exe;$psi.Arguments=$arguments;$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
    foreach($key in @($psi.EnvironmentVariables.Keys)){if($key-match'^(DOTNET_|COMPLUS_|CORECLR_|COR_)'){$psi.EnvironmentVariables.Remove($key)}}
    $process=[Diagnostics.Process]::Start($psi);$stdout=$process.StandardOutput.ReadToEnd();$stderr=$process.StandardError.ReadToEnd();$process.WaitForExit();$result=@{exit=$process.ExitCode;stdout=$stdout;stderr=$stderr};$process.Dispose();return $result}
$result=PackageProcess '--self-test';Need ($result.exit-eq0-and$result.stderr.Length-eq0) 'Self-contained tests failed'
$packageReport=$result.stdout|ConvertFrom-Json
Need ($packageReport.cases-eq$report.cases-and$packageReport.executorExeSha256-ceq(Hash $exe)-and$packageReport.loadedAssemblySha256-ceq(Hash (Join-Path $package 'EntryControl.AdapterPilot.dll'))-and$packageReport.runtime-ceq'10.0.11'-and$packageReport.coreLibPath-ceq(Join-Path $package 'System.Private.CoreLib.dll')) 'Self-contained emitter/runtime mismatch'
WriteNew (Join-Path $out 'package-pure-test-report.json') ([Text.Encoding]::UTF8.GetBytes($result.stdout))
foreach($entry in @('--service Invalid setup-create','--child Invalid child-prepare','--controller Prepare')){$result=PackageProcess ($entry+' '+('a'*64));Need ($result.exit-eq2-and$result.stdout.Length-eq0-and$result.stderr.Trim()-ceq$entryReason) 'Self-contained physical refusal failed'}
JsonNew (Join-Path $out 'package-entry-checks.json') @{pureCases=$packageReport.cases;physicalRefusals=3;physicalExecuted=$false}
VerifyInventory $package $packageInventory;VerifyInventory $runtimeRoot $runtimeInventory;VerifyInventory $fxrRoot $fxrInventory
foreach($r in $rows){Need ((Hash (Join-Path $snapshot $r.name))-ceq$r.sha256-and(Hash (Join-Path $repo $r.relative))-ceq$r.sha256) 'Final source changed'}
JsonNew (Join-Path $out 'self-contained-provenance.json') @{schemaVersion=1;scope='GATED_SELF_CONTAINED_PILOT_PACKAGE';selfContained=$true;physicalEntryEnabled=$capable;physicalTested=$false;securityAccepted=$false;productionAccepted=$false;runtimeAuthority='NONE';sourceCommit=$head;candidateProvenanceSha256=(Hash (Join-Path $out 'build-provenance.json'));hostTool=(Inventory $hostTool);runtimeInputs=$runtimeInventory;fxrInputs=$fxrInventory;bindings=@(foreach($name in @('source-manifest.json','package-manifest.json','package-pure-test-report.json','package-entry-checks.json')){[pscustomobject]@{name=$name;sha256=(Hash (Join-Path $out $name))}})}
Write-Output ('PASS: app-local self-contained package; same '+$packageReport.cases+' cases; three apphost refusals; no native roles.')
Write-Output ('Package provenance: '+(Join-Path $out 'self-contained-provenance.json'))

# Valid controller command shapes with redirected console must fail before file/native access.
foreach($stage in @('Prepare','VerifyFreshProcess','Finish')) {
    $result=PackageProcess ('--controller '+$stage+' "E:\missing-context.json" "E:\missing-input.json"')
    Need ($result.exit-eq2-and$result.stdout.Length-eq0-and$result.stderr.Trim()-ceq$entryReason) 'Noninteractive controller did not refuse'
}
# Deliberately repinned negative fixtures: reject both inconsistent metadata and
# metadata that consistently lies about the compiled capability. Never a live stage.
foreach($kind in @('manifest-mismatch','compiled-mismatch')) {
    $negative=Join-Path $out $kind;$null=New-Item -ItemType Directory -Path $negative
    Copy-Item -LiteralPath $package -Destination (Join-Path $negative 'package') -Recurse
    foreach($name in @('source-manifest.json','package-pure-test-report.json','package-entry-checks.json')){Copy-Item -LiteralPath (Join-Path $out $name) -Destination (Join-Path $negative $name)}
    $fakeManifest=Get-Content -LiteralPath (Join-Path $out 'package-manifest.json') -Raw|ConvertFrom-Json
    $fakeManifest.physicalEntryEnabled=-not$capable;JsonNew (Join-Path $negative 'package-manifest.json') $fakeManifest
    $fakeProvenance=Get-Content -LiteralPath (Join-Path $out 'self-contained-provenance.json') -Raw|ConvertFrom-Json
    if($kind-ceq'compiled-mismatch'){$fakeProvenance.physicalEntryEnabled=-not$capable}
    foreach($binding in $fakeProvenance.bindings){if($binding.name-ceq'package-manifest.json'){$binding.sha256=Hash (Join-Path $negative 'package-manifest.json')}}
    JsonNew (Join-Path $negative 'self-contained-provenance.json') $fakeProvenance
    $psi=New-Object Diagnostics.ProcessStartInfo;$psi.FileName=Join-Path $PSHOME 'powershell.exe'
    $psi.Arguments='-NoProfile -ExecutionPolicy Bypass -File "'+(Join-Path $snapshot 'Run-Pilot.ps1')+'" -Stage SelfTest -Mode Package -CandidateDirectory "'+$negative+'" -ExpectedProvenanceSha256 '+(Hash (Join-Path $negative 'self-contained-provenance.json'))
    $psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
    $process=[Diagnostics.Process]::Start($psi);$stdout=$process.StandardOutput.ReadToEnd();$stderr=$process.StandardError.ReadToEnd();$process.WaitForExit()
    Need ($process.ExitCode-eq2-and$stdout.Length-eq0-and$stderr.Trim()-ceq'PILOT_CONTROLLER_REFUSED') 'Capability mismatch accepted';$process.Dispose()
}
JsonNew (Join-Path $out 'activation-negative-checks.json') @{physicalEntryEnabled=$capable;metadataMismatchRefusals=2;noninteractiveStageRefusals=3;physicalExecuted=$false}

# Delivery graph has no self-hash cycle: kit manifest lists payload; archive
# contains manifest+payload; external delivery provenance binds both digests.
$kit=Join-Path $out 'kit';$null=New-Item -ItemType Directory -Path $kit
foreach($sub in @('package','snapshot','host-tool')){$null=New-Item -ItemType Directory -Path (Join-Path $kit $sub)}
foreach($sub in @('package','snapshot','host-tool')){foreach($file in Get-ChildItem -LiteralPath (Join-Path $out $sub) -File -Force){Plain $file.FullName;WriteNew (Join-Path (Join-Path $kit $sub) $file.Name) ([IO.File]::ReadAllBytes($file.FullName))}}
foreach($name in @('activation-negative-checks.json','source-manifest.json','build-provenance.json','package-manifest.json','package-pure-test-report.json','package-entry-checks.json','self-contained-provenance.json')){WriteNew (Join-Path $kit $name) ([IO.File]::ReadAllBytes((Join-Path $out $name)))}
foreach($name in @('Run-Pilot.ps1','README-fa.txt')){WriteNew (Join-Path $kit $name) ([IO.File]::ReadAllBytes((Join-Path $snapshot $name)))}
$kitRows=@(Get-ChildItem -LiteralPath $kit -Recurse -File -Force|Sort-Object FullName|ForEach-Object{Plain $_.FullName;[pscustomobject]@{relative=$_.FullName.Substring($kit.Length+1).Replace('\','/');size=$_.Length;sha256=(Hash $_.FullName)}})
JsonNew (Join-Path $kit 'kit-manifest.json') @{schemaVersion=1;scope='GATED_SELF_CONTAINED_PILOT_KIT';physicalEntryEnabled=$capable;files=$kitRows}
function BoundPackageTest([string]$directory) {
    $psi=New-Object Diagnostics.ProcessStartInfo;$psi.FileName=Join-Path $PSHOME 'powershell.exe'
    $psi.Arguments='-NoProfile -ExecutionPolicy Bypass -File "'+(Join-Path $directory 'Run-Pilot.ps1')+'" -Stage SelfTest -Mode Package -CandidateDirectory "'+$directory+'" -ExpectedProvenanceSha256 '+(Hash (Join-Path $directory 'self-contained-provenance.json'))
    $psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true
    $process=[Diagnostics.Process]::Start($psi);$stdout=$process.StandardOutput.ReadToEnd();$stderr=$process.StandardError.ReadToEnd();$process.WaitForExit()
    Need ($process.ExitCode-eq0-and$stderr.Length-eq0) 'Kit controller SelfTest failed';$process.Dispose();$observed=$stdout|ConvertFrom-Json
    Need ($observed.cases-eq$packageReport.cases-and$observed.executorExeSha256-ceq(Hash (Join-Path $directory 'package/EntryControl.AdapterPilot.exe'))) 'Kit executor/report mismatch'
}
BoundPackageTest $kit
Add-Type -AssemblyName System.IO.Compression
$archive=Join-Path $out 'pilot-kit.zip';$stream=[IO.File]::Open($archive,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
$zip=New-Object IO.Compression.ZipArchive($stream,[IO.Compression.ZipArchiveMode]::Create,$true)
$archiveRows=@($kitRows)+@([pscustomobject]@{relative='kit-manifest.json';size=(Get-Item -LiteralPath (Join-Path $kit 'kit-manifest.json')).Length;sha256=(Hash (Join-Path $kit 'kit-manifest.json'))})
try{foreach($file in $archiveRows){$entry=$zip.CreateEntry($file.relative,[IO.Compression.CompressionLevel]::Optimal);$entryStream=$entry.Open();try{$content=[IO.File]::ReadAllBytes((Join-Path $kit $file.relative));$entryStream.Write($content,0,$content.Length)}finally{$entryStream.Dispose()}}}finally{$zip.Dispose();$stream.Dispose()}
$archiveHash=Hash $archive;$extracted=Join-Path $out 'extracted-kit';$null=New-Item -ItemType Directory -Path $extracted
$stream=[IO.File]::OpenRead($archive);$zip=New-Object IO.Compression.ZipArchive($stream,[IO.Compression.ZipArchiveMode]::Read,$true)
try {
    Need ($zip.Entries.Count-eq$archiveRows.Count-and@($zip.Entries.FullName|Sort-Object -Unique).Count-eq$archiveRows.Count) 'Archive count/duplicate refused'
    foreach($entry in $zip.Entries) {
        $expected=@($archiveRows|Where-Object{$_.relative-ceq$entry.FullName});Need ($expected.Count-eq1-and$entry.Length-eq$expected[0].size-and$entry.Length-le536870912) 'Unexpected archive entry'
        $target=[IO.Path]::GetFullPath((Join-Path $extracted $entry.FullName));Need ($target.StartsWith($extracted+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)) 'Archive escape refused'
        $parent=[IO.Path]::GetDirectoryName($target);if(-not[IO.Directory]::Exists($parent)){$null=New-Item -ItemType Directory -Path $parent}
        Plain $parent;$entryStream=$entry.Open();$memory=New-Object IO.MemoryStream
        try{$entryStream.CopyTo($memory);Need ($memory.Length-eq$expected[0].size) 'Archive expanded size mismatch';WriteNew $target $memory.ToArray()}finally{$entryStream.Dispose();$memory.Dispose()}
        Need ((Hash $target)-ceq$expected[0].sha256) 'Archive content changed'
    }
}finally{$zip.Dispose();$stream.Dispose()}
Need ((Hash $archive)-ceq$archiveHash) 'Archive changed';BoundPackageTest $extracted
VerifyInventory $package $packageInventory
JsonNew (Join-Path $out 'delivery-provenance.json') @{schemaVersion=1;scope='GATED_SELF_CONTAINED_PILOT_DELIVERY';kitManifestSha256=(Hash (Join-Path $kit 'kit-manifest.json'));packageProvenanceSha256=(Hash (Join-Path $out 'self-contained-provenance.json'));archiveSha256=$archiveHash;archiveEntries=$archiveRows.Count;extractedVerified=$true;kitControllerSelfTestPassed=$true;pureCases=$packageReport.cases;physicalExecuted=$false;physicalEntryEnabled=$capable;securityAccepted=$false;productionAccepted=$false}
Write-Output ('PASS: closed kit/archive extraction and bound app-local wrapper; same '+$packageReport.cases+' cases, not additional unique tests.')
Write-Output ('Delivery provenance: '+(Join-Path $out 'delivery-provenance.json'))
