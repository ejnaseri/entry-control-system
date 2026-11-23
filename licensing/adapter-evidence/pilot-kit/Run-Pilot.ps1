[CmdletBinding()]param(
    [ValidateSet('SelfTest','InspectHost','ValidateInput','ValidateOwnerInput','Prepare','VerifyFreshProcess','Finish')][string]$Stage='Prepare',
    [string]$CandidateDirectory,
    [ValidateSet('Candidate','Package')][string]$Mode='Candidate',
    [string]$ExpectedProvenanceSha256,
    [string]$InputPath,
    [string]$ExpectedInputSha256,
    [string]$ExpectedOwnerDecisionSha256,
    [string]$ExpectedOwnerSid,
    [string]$OwnerContextPath
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# This entry point is intentionally gated BEFORE any machine/file inspection.
# Evidence-core integration is not the approved physical bootstrap controller.
$physicalStage=$Stage-ceq'Prepare'-or$Stage-ceq'VerifyFreshProcess'-or$Stage-ceq'Finish'
if($physicalStage-and-not$ExpectedProvenanceSha256){[Console]::Error.WriteLine('PHYSICAL_CONTROLLER_NOT_READY');exit 2}
if($physicalStage-and$Mode-cne'Package'){[Console]::Error.WriteLine('PHYSICAL_REQUIRES_PACKAGE');exit 2}
if($Stage-ceq'InspectHost'-and$Mode-cne'Package'){[Console]::Error.WriteLine('HOST_INSPECTION_REQUIRES_PACKAGE');exit 2}
if($Stage-ceq'ValidateInput'-and$Mode-cne'Package'){[Console]::Error.WriteLine('INPUT_VALIDATION_REQUIRES_PACKAGE');exit 2}
if($Stage-ceq'ValidateOwnerInput'-and$Mode-cne'Package'){[Console]::Error.WriteLine('OWNER_VALIDATION_REQUIRES_PACKAGE');exit 2}
function Need([bool]$ok,[string]$reason){if(-not$ok){throw $reason}}
function Hash([string]$path){(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()}
function Plain([string]$path){$cursor=[IO.Path]::GetFullPath($path);while($cursor){$item=Get-Item -LiteralPath $cursor -Force;Need (($item.Attributes-band[IO.FileAttributes]::ReparsePoint)-eq0) 'REPARSE_INPUT_REFUSED';$cursor=[IO.Path]::GetDirectoryName($cursor)}}
try {
    Need ($ExpectedProvenanceSha256-cmatch'^[a-f0-9]{64}$'-and[IO.Path]::IsPathRooted($CandidateDirectory)) 'CANDIDATE_PIN_REQUIRED'
    Plain $CandidateDirectory;$provenancePath=Join-Path $CandidateDirectory $(if($Mode-ceq'Package'){'self-contained-provenance.json'}else{'build-provenance.json'});Plain $provenancePath
    Need ((Hash $provenancePath)-ceq$ExpectedProvenanceSha256-and(Get-Item -LiteralPath $provenancePath).Length-le2097152) 'PROVENANCE_PIN_REFUSED'
    $provenance=Get-Content -LiteralPath $provenancePath -Raw|ConvertFrom-Json
    Need ($provenance.physicalEntryEnabled-is[bool]-and$provenance.physicalTested-eq$false-and$provenance.runtimeAuthority-ceq'NONE') 'CANDIDATE_SCOPE_REFUSED'
    $physicalEnabled=$provenance.physicalEntryEnabled
    if($physicalStage-and-not$physicalEnabled){[Console]::Error.WriteLine('PHYSICAL_CONTROLLER_NOT_READY');exit 2}
    if($Mode-ceq'Package') {
        Need ($provenance.scope-ceq'GATED_SELF_CONTAINED_PILOT_PACKAGE'-and$provenance.selfContained-eq$true-and$provenance.securityAccepted-eq$false-and$provenance.productionAccepted-eq$false) 'PACKAGE_SCOPE_REFUSED'
        $names=@('source-manifest.json','package-manifest.json','package-pure-test-report.json','package-entry-checks.json')
    } else {Need ($provenance.scope-ceq'CANDIDATE_PRIMITIVES_NOT_KIT') 'CANDIDATE_SCOPE_REFUSED';$names=@('source-manifest.json','candidate.rsp','EntryControl.AdapterPilot.dll','EntryControl.AdapterPilot.runtimeconfig.json','pure-test-report.json','entry-refusals.json')}
    Need (@($provenance.bindings).Count-eq$names.Count-and@($provenance.bindings.name|Sort-Object -Unique).Count-eq$names.Count) 'CANDIDATE_BINDINGS_REFUSED'
    foreach($binding in $provenance.bindings){Need ($binding.name-cin$names-and$binding.sha256-cmatch'^[a-f0-9]{64}$') 'CANDIDATE_NAME_REFUSED';$path=Join-Path $CandidateDirectory $binding.name;Plain $path;Need ((Hash $path)-ceq$binding.sha256) 'CANDIDATE_FILE_CHANGED'}
    if($Mode-ceq'Package') {
        $manifest=Get-Content -LiteralPath (Join-Path $CandidateDirectory 'package-manifest.json') -Raw|ConvertFrom-Json
        $package=Join-Path $CandidateDirectory 'package';Plain $package;$seen=@{}
        Need ($manifest.scope-ceq'GATED_SELF_CONTAINED_PILOT_PACKAGE'-and$manifest.selfContained-eq$true-and$manifest.physicalEntryEnabled-is[bool]-and$manifest.physicalEntryEnabled-eq$physicalEnabled-and@($manifest.files).Count-le512) 'PACKAGE_MANIFEST_REFUSED'
        foreach($file in $manifest.files) {
            Need (($file.name-cmatch'^[A-Za-z0-9][A-Za-z0-9._-]*$'-or$file.name-ceq'.version')-and-not$file.name.Contains('..')-and-not$file.name.EndsWith('.')-and-not$seen.ContainsKey($file.name)-and$file.sha256-cmatch'^[a-f0-9]{64}$') 'PACKAGE_NAME_REFUSED'
            Need ($file.name.Split('.')[0]-notmatch'^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$') 'PACKAGE_DEVICE_NAME_REFUSED';$seen[$file.name]=$true
            $path=Join-Path $package $file.name;Plain $path;Need ((Hash $path)-ceq$file.sha256-and(Get-Item -LiteralPath $path).Length-eq$file.size-and$file.size-gt0) 'PACKAGE_FILE_CHANGED'
        }
        $actual=@(Get-ChildItem -LiteralPath $package -Force);Need ($actual.Count-eq$seen.Count-and@($actual|Where-Object{$_.PSIsContainer-or-not$seen.ContainsKey($_.Name)}).Count-eq0) 'PACKAGE_EXTRA_ENTRY'
        # Read-only compiled capability must agree with pinned metadata before any live dispatch.
        $probe=New-Object Diagnostics.ProcessStartInfo
        $probe.FileName=Join-Path $package 'EntryControl.AdapterPilot.exe';$probe.Arguments='--inspect-capability'
        $probe.UseShellExecute=$false;$probe.CreateNoWindow=$true;$probe.RedirectStandardOutput=$true;$probe.RedirectStandardError=$true
        foreach($key in @($probe.EnvironmentVariables.Keys)){if($key-match'^(DOTNET_|COMPLUS_|CORECLR_|COR_)'){$probe.EnvironmentVariables.Remove($key)}}
        $proc=[Diagnostics.Process]::Start($probe);$capText=$proc.StandardOutput.ReadToEnd();$capError=$proc.StandardError.ReadToEnd();$proc.WaitForExit()
        Need ($proc.ExitCode-eq0-and$capError.Length-eq0) 'CAPABILITY_PROBE_REFUSED';$proc.Dispose();$cap=$capText|ConvertFrom-Json
        Need ($cap.scope-ceq'TEST_ONLY_PILOT_BUILD_CAPABILITY_V1'-and$cap.physicalEntryEnabled-is[bool]-and$cap.physicalEntryEnabled-eq$physicalEnabled-and$cap.executionAuthorized-eq$false-and$cap.physicalTested-eq$false-and$cap.securityAccepted-eq$false-and$cap.productionAccepted-eq$false-and$cap.executorExeSha256-ceq(Hash $probe.FileName)-and$cap.loadedAssemblySha256-ceq(Hash (Join-Path $package 'EntryControl.AdapterPilot.dll'))) 'CAPABILITY_METADATA_MISMATCH'
        if($physicalStage) {
            Need (-not[Console]::IsInputRedirected-and-not[Console]::IsOutputRedirected) 'OWNER_CONSOLE_REQUIRED'
            foreach($externalPath in @($OwnerContextPath,$InputPath)) {
                Need ($externalPath-cmatch'^[A-Za-z]:\\'-and$externalPath-notmatch'["\x00-\x1f]'-and$externalPath.Length-lt260) 'OWNER_LOCAL_INPUT_REQUIRED'
                Plain $externalPath
            }
            # Inherit this interactive console; do not pipe consent or auto-elevate.
            # Expected owner SID/context pin are entered inside the reviewed executable.
            $live=New-Object Diagnostics.ProcessStartInfo
            $live.FileName=Join-Path $package 'EntryControl.AdapterPilot.exe'
            $live.Arguments='--controller '+$Stage+' "'+$OwnerContextPath+'" "'+$InputPath+'"'
            $live.UseShellExecute=$false;$live.CreateNoWindow=$false
            $live.RedirectStandardInput=$false;$live.RedirectStandardOutput=$false;$live.RedirectStandardError=$false
            foreach($key in @($live.EnvironmentVariables.Keys)){if($key-match'^(DOTNET_|COMPLUS_|CORECLR_|COR_)'){$live.EnvironmentVariables.Remove($key)}}
            $running=[Diagnostics.Process]::Start($live);$running.WaitForExit();$resultCode=$running.ExitCode;$running.Dispose();exit $resultCode
        }
        $inputBytes=$null
        if($Stage-ceq'ValidateInput'-or$Stage-ceq'ValidateOwnerInput') {
            Need ($ExpectedInputSha256-cmatch'^[a-f0-9]{64}$'-and[IO.Path]::IsPathRooted($InputPath)) 'INPUT_PIN_REQUIRED'
            Plain $InputPath;Need ((Get-Item -LiteralPath $InputPath).Length-gt0-and(Get-Item -LiteralPath $InputPath).Length-le2097152) 'INPUT_SIZE_REFUSED'
            $stream=[IO.File]::Open($InputPath,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read);$copy=New-Object IO.MemoryStream
            try {
                $buffer=New-Object byte[] 8192
                while(($read=$stream.Read($buffer,0,$buffer.Length))-gt0) {Need ($copy.Length+$read-le2097152) 'INPUT_SIZE_REFUSED';$copy.Write($buffer,0,$read)}
                $inputBytes=$copy.ToArray();Need ($inputBytes.Length-gt0) 'INPUT_SIZE_REFUSED'
            } finally {$stream.Dispose();$copy.Dispose()}
            $sha=[Security.Cryptography.SHA256]::Create();try {$digest=([BitConverter]::ToString($sha.ComputeHash($inputBytes))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
            Need ($digest-ceq$ExpectedInputSha256) 'INPUT_HASH_REFUSED'
        }
        if($Stage-ceq'ValidateOwnerInput') {Need ($ExpectedOwnerDecisionSha256-cmatch'^[a-f0-9]{64}$'-and$ExpectedOwnerSid-cmatch'^S-1-5-21-[0-9]+-[0-9]+-[0-9]+-[0-9]+$') 'OWNER_PIN_REQUIRED'}
        $psi=New-Object Diagnostics.ProcessStartInfo;$psi.FileName=Join-Path $package 'EntryControl.AdapterPilot.exe';$psi.Arguments=$(if($Stage-ceq'InspectHost'){'--inspect-host'}elseif($Stage-ceq'ValidateInput'){'--validate-controller-input '+$ExpectedInputSha256}elseif($Stage-ceq'ValidateOwnerInput'){'--validate-owner-input '+$ExpectedOwnerDecisionSha256+' '+$ExpectedOwnerSid}else{'--self-test'});$psi.UseShellExecute=$false;$psi.CreateNoWindow=$true;$psi.RedirectStandardOutput=$true;$psi.RedirectStandardError=$true;$psi.RedirectStandardInput=($Stage-ceq'ValidateInput'-or$Stage-ceq'ValidateOwnerInput')
        foreach($key in @($psi.EnvironmentVariables.Keys)){if($key-match'^(DOTNET_|COMPLUS_|CORECLR_|COR_)'){$psi.EnvironmentVariables.Remove($key)}}
        $process=[Diagnostics.Process]::Start($psi)
        if($Stage-ceq'ValidateInput'-or$Stage-ceq'ValidateOwnerInput') {$process.StandardInput.BaseStream.Write($inputBytes,0,$inputBytes.Length);$process.StandardInput.Close()}
        $stdout=$process.StandardOutput.ReadToEnd();$stderr=$process.StandardError.ReadToEnd();$process.WaitForExit();Need ($process.ExitCode-eq0-and$stderr.Length-eq0) 'PACKAGE_SELF_TEST_REFUSED';$process.Dispose()
        $report=$stdout|ConvertFrom-Json
        Need ($report.executorExeSha256-ceq(Hash $psi.FileName)-and$report.loadedAssemblySha256-ceq(Hash (Join-Path $package 'EntryControl.AdapterPilot.dll'))-and$report.physicalTested-eq$false) 'PACKAGE_EMITTER_REFUSED'
        if($Stage-ceq'InspectHost') {
            Need ($report.scope-ceq'TEST_ONLY_PILOT_HOST_BINDING_V1'-and$report.readOnly-eq$true-and$report.ownerApproved-eq$false-and$report.securityAccepted-eq$false-and$report.productionAccepted-eq$false-and$report.hostBindingSha256-cmatch'^[a-f0-9]{64}$'-and$report.host.runtime-ceq'10.0.11') 'HOST_REPORT_REFUSED'
        } elseif($Stage-ceq'ValidateInput') {
            Need ($report.scope-ceq'TEST_ONLY_CONTROLLER_INPUT_V1'-and$report.inputSha256-ceq$ExpectedInputSha256-and$report.readOnly-eq$true-and$report.inputValidated-eq$true-and$report.liveContextValidated-eq$false-and$report.executionAuthorized-eq$false-and$report.physicalEntryEnabled-eq$false-and$report.ownerApproved-eq$false-and$report.securityAccepted-eq$false-and$report.productionAccepted-eq$false) 'INPUT_REPORT_REFUSED'
        } elseif($Stage-ceq'ValidateOwnerInput') {
            Need ($report.scope-ceq'TEST_ONLY_OWNER_STAGE_DECISION_V1'-and$report.ownerDecisionSha256-ceq$ExpectedOwnerDecisionSha256-and$report.ownerRecordMatched-eq$true-and$report.ownerIdentityAuthenticated-eq$false-and$report.readOnly-eq$true-and$report.liveContextValidated-eq$false-and$report.executionAuthorized-eq$false-and$report.physicalEntryEnabled-eq$false-and$report.ownerApproved-eq$false-and$report.securityAccepted-eq$false-and$report.productionAccepted-eq$false) 'OWNER_REPORT_REFUSED'
        } else {Need ($report.runtime-ceq'10.0.11'-and$report.coreLibPath-ceq(Join-Path $package 'System.Private.CoreLib.dll')) 'PACKAGE_RUNTIME_REFUSED'}
        Write-Output $stdout;exit 0
    }
    $dotnet='C:\Program Files\dotnet\dotnet.exe';Plain $dotnet;Need ((Hash $dotnet)-ceq$provenance.executorSha256) 'EXECUTOR_CHANGED'
    # Managed self-tests only: Main has no dispatch to native roles/controller.
    & $dotnet exec --fx-version 10.0.11 (Join-Path $CandidateDirectory 'EntryControl.AdapterPilot.dll') --self-test
    if($LASTEXITCODE-ne0){throw 'CANDIDATE_SELF_TEST_FAILED'}
} catch {[Console]::Error.WriteLine('PILOT_CONTROLLER_REFUSED');exit 2}
