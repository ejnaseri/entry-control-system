[CmdletBinding()]param([ValidateSet('SelfTest','Collect')][string]$Mode='SelfTest')
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
# Fixed retained experiment only. stdout JSON; no output file or native mutation.
$testRoot='C:\ProgramData\Ecs.Lic008.EntryEvidenceV2'
$experiment='30173bfda30af041dcc879170579d658'
$reports=@(
    @{role='Setup';action='setup-create';run='968ca8f2ad4347c40b38a9339013fd8f';file='setup-reports/968ca8f2ad4347c40b38a9339013fd8f.json'},
    @{role='Guardian';action='guardian-prepare';run='348e5ea406acc37c1d00f75a54785489';file='guardian-reports/348e5ea406acc37c1d00f75a54785489.json'}
)
$paths=@('','plans/prepare.json','protected','protected/restricted-intent.json','protected/restricted-owned.json',
    'shared','shared/public-control.json','guardian-work','guardian-work/restricted-envelope.bin',
    'guardian-work/restricted-expected-hash.json','setup-reports','guardian-reports')+@($reports|ForEach-Object{$_.file})
function Need([bool]$ok,[string]$why){if(-not$ok){throw $why}}
function FixedPath([string]$relative){
    Need ($relative-cin$paths) 'PATH_NOT_ALLOWLISTED'
    return [IO.Path]::GetFullPath((Join-Path $testRoot $relative))
}
function PlainPath([string]$path){
    # Check ancestors first; do not traverse a redirect to collect evidence elsewhere.
    $chain=[Collections.Generic.List[string]]::new();$cursor=[IO.Path]::GetFullPath($path)
    while($cursor){$chain.Insert(0,$cursor);$cursor=[IO.Path]::GetDirectoryName($cursor)}
    foreach($part in $chain){$item=Get-Item -LiteralPath $part -Force -ErrorAction Stop
        Need (($item.Attributes-band[IO.FileAttributes]::ReparsePoint)-eq0) 'REPARSE_REFUSED'}
}
function ReportBinding($r,$spec){
    Need ($r.schemaVersion-eq2-and$r.scope-ceq'TEST_ONLY_SOFTWARE_KSP_ADAPTER_EVIDENCE_V1'-and
        $r.experimentId-ceq$experiment-and$r.runId-ceq$spec.run-and$r.role-ceq$spec.role-and
        $r.action-ceq$spec.action-and$r.stage-ceq'Prepare'-and
        $r.planSha256-ceq'5f1a449b81d80da5c741f99e0274c2553b177df9795706cc91df71894acdfd4e'-and
        $r.provenanceSha256-ceq'4296ff854c75e6b5a1685a12ee1741ee75139fc9e504d313db137f7b60873b4d'-and
        $r.loadedAssemblySha256-ceq'fe786bb98256bb058d9778b4b1b699596f05a3f07d7cea19b674f33fb91a74e5') 'REPORT_BINDING_REFUSED'
}
function Failure($errorRecord){
    # Missing/denied are observations, not authorization or a key-absence claim.
    [pscustomobject]@{status='UNAVAILABLE_OR_REFUSED';category=[string]$errorRecord.CategoryInfo.Category;
        exceptionType=$errorRecord.Exception.GetType().FullName;hresult=$errorRecord.Exception.HResult}
}
if($Mode-ceq'SelfTest'){
    $count=0
    foreach($p in $paths){Need ((FixedPath $p).StartsWith($testRoot,[StringComparison]::Ordinal)) 'PATH_TEST_FAILED';$count++}
    foreach($p in @('../EntryEvidenceV1','C:/Windows','protected/extra.json','guardian-work\restricted-envelope.bin')){
        $refused=$false;try{FixedPath $p|Out-Null}catch{$refused=$true};Need $refused 'PATH_REFUSAL_MISSING';$count++
    }
    $r=[pscustomobject]@{schemaVersion=2;scope='TEST_ONLY_SOFTWARE_KSP_ADAPTER_EVIDENCE_V1';experimentId=$experiment;
        runId=$reports[0].run;role='Setup';action='setup-create';stage='Prepare';
        planSha256='5f1a449b81d80da5c741f99e0274c2553b177df9795706cc91df71894acdfd4e';
        provenanceSha256='4296ff854c75e6b5a1685a12ee1741ee75139fc9e504d313db137f7b60873b4d';
        loadedAssemblySha256='fe786bb98256bb058d9778b4b1b699596f05a3f07d7cea19b674f33fb91a74e5'}
    ReportBinding $r $reports[0];$count++
    foreach($field in @('schemaVersion','scope','experimentId','runId','role','action','stage','planSha256','provenanceSha256','loadedAssemblySha256')){
        $bad=$r|ConvertTo-Json|ConvertFrom-Json;$bad.$field='wrong';$refused=$false
        try{ReportBinding $bad $reports[0]}catch{$refused=$true};Need $refused 'REPORT_REFUSAL_MISSING';$count++
    }
    [pscustomobject]@{mode='SelfTest';passed=$count;physicalExecuted=$false}|ConvertTo-Json -Compress
    exit 0
}
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
Need (([Security.Principal.WindowsPrincipal]::new($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) 'ADMIN_READ_ONLY_COLLECTION_REQUIRED'
$metadata=@(foreach($relative in $paths){
    try{
        $path=FixedPath $relative;PlainPath $path
        $item=Get-Item -LiteralPath $path -Force;$acl=Get-Acl -LiteralPath $path
        [pscustomobject]@{relative=$relative;status='OBSERVED';directory=$item.PSIsContainer;
            length=$(if($item.PSIsContainer){$null}else{$item.Length});owner=$acl.Owner;sddl=$acl.Sddl}
    }catch{[pscustomobject]@{relative=$relative;observation=(Failure $_)}}
})
$evidence=@(foreach($spec in $reports){
    try{
        $path=FixedPath $spec.file;PlainPath $path
        $stream=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
        try{Need ($stream.Length-gt0-and$stream.Length-le2097152) 'REPORT_SIZE_REFUSED'
            $memory=[IO.MemoryStream]::new();try{$stream.CopyTo($memory);$bytes=$memory.ToArray()}finally{$memory.Dispose()}
        }finally{$stream.Dispose()}
        $r=[Text.UTF8Encoding]::new($false,$true).GetString($bytes)|ConvertFrom-Json;ReportBinding $r $spec
        $sha=[Security.Cryptography.SHA256]::Create();try{$hash=([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
        [pscustomobject]@{relative=$spec.file;status='BOUND_REPORT';sha256=$hash;role=$r.role;runId=$r.runId;
            serviceIdentityMatched=$r.serviceIdentityMatched;artifactIdentityMatched=$r.artifactIdentityMatched;workerEnded=$r.workerEnded;
            serviceSidGroupCount=$r.serviceSidGroupCount;tokenRestricted=$r.tokenRestricted;tokenQueryComplete=$r.tokenQueryComplete}
    }catch{[pscustomobject]@{relative=$spec.file;observation=(Failure $_)}}
})
try{$services=@(Get-CimInstance Win32_Service -Filter "Name='Ecs.Lic008.EntryEvidenceV2.Setup' OR Name='Ecs.Lic008.EntryEvidenceV2.Guardian' OR Name='Ecs.Lic008.EntryEvidenceV2.App'" |
    Select-Object Name,State,StartMode,ProcessId,ExitCode,ServiceSpecificExitCode,PathName)}catch{$services=@(Failure $_)}
[pscustomobject]@{scope='TEST_ONLY_V2_PREPARE_READONLY_METADATA';collectedUtc=[DateTime]::UtcNow.ToString('o');
    experimentId=$experiment;metadata=$metadata;reports=$evidence;services=$services;
    readOnly=$true;physicalStageExecuted=$false;securityAccepted=$false;note='No key APIs or private ownership/envelope contents read. ACL metadata is not a Guardian access test.'}|ConvertTo-Json -Depth 8
