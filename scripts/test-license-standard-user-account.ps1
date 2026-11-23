[CmdletBinding()]param([string]$SourcePath=(Join-Path $PSScriptRoot 'run-license-standard-user-account.ps1'))
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$parseErrors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($SourcePath,[ref]$null,[ref]$parseErrors)
if($parseErrors.Count -ne 0){throw 'ACCOUNT_SOURCE_PARSE_FAILED'}
# Load only the pure contract/guard/algorithm definitions. Never evaluate the
# native helpers, module import, script body, account cmdlets or password input.
foreach($name in @('GetStandardAccountContract','RequireStandardAccount','TestStandardAccountSid',
    'AssertStandardAccountSnapshot','InvokeStandardAccountProvisioning','AssertStandardAccountPlan','AssertStandardAccountMode',
    'AssertStandardAccountInputBinding','AssertStandardAccountPasswordLength','AssertStandardAccountRootDescriptor','AssertStandardAccountNameAvailable')) {
    $functions=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst]},$false) | Where-Object Name -CEQ $name)
    if($functions.Count -ne 1){throw 'ACCOUNT_PURE_HELPER_MISSING'}
    . ([scriptblock]::Create($functions[0].Extent.Text))
}
$script:accountPureCases=0
function Check([bool]$ok){$script:accountPureCases++;if(-not $ok){throw ('ACCOUNT_PURE_CHECK_FAILED_'+$script:accountPureCases+'; lines='+((Get-PSCallStack | ForEach-Object ScriptLineNumber) -join ','))}}
function Reject([scriptblock]$work){$refused=$false;try{$null=&$work}catch{$refused=$true};Check $refused}
$contract=GetStandardAccountContract
Check ($contract.description.Length -gt 0 -and $contract.description.Length -le 48)
$newSid=$contract.machineSid+'-1234'
Check (TestStandardAccountSid $newSid)
foreach($sid in @('', 'S-1-5-18','S-1-5-32-545',$contract.ownerSid,($contract.machineSid+'-500'),
    ($contract.machineSid+'-999'),($contract.machineSid+'-01001'),($contract.machineSid+'-4294967296'),
    'S-1-5-21-1-2-3-1234',($newSid+'x'),($newSid+"`n"))){Check (-not (TestStandardAccountSid $sid))}
function SnapshotFixture {
    [pscustomobject][ordered]@{name=$contract.name;sid=$newSid;enabled=$false;principalSource='Local';groupsComplete=$true;localGroupSids=@($contract.usersSid)}
}
AssertStandardAccountSnapshot (SnapshotFixture) $newSid $false;Check $true
foreach($mutation in @(
    @{property='name';value='Administrator'},@{property='name';value=@($contract.name,'Administrator')},
    @{property='sid';value=$contract.ownerSid},@{property='sid';value=$contract.machineSid+'-1235'},
    @{property='enabled';value=$true},@{property='enabled';value=0},@{property='principalSource';value='ActiveDirectory'},
    @{property='principalSource';value=@('Local')},@{property='groupsComplete';value=$false},
    @{property='groupsComplete';value='true'},@{property='localGroupSids';value=@($contract.administratorSid)},
    @{property='localGroupSids';value=@($contract.usersSid,$contract.administratorSid)},
    @{property='localGroupSids';value=@($contract.usersSid,$contract.usersSid)},@{property='localGroupSids';value=@()},
    @{property='localGroupSids';value=@('S-1-5-32-546')},@{property='localGroupSids';value=$null}
)) {$fixture=SnapshotFixture;$fixture.($mutation.property)=$mutation.value;Reject {AssertStandardAccountSnapshot $fixture $newSid $false}}
$noGroup=SnapshotFixture;$noGroup.localGroupSids=@();AssertStandardAccountSnapshot $noGroup $newSid $true;Check $true
Reject {AssertStandardAccountSnapshot $null $newSid $true}
$pin='a'*64;$inputPath=$contract.outputParent+'\lic008-standard-account-v1-input-'+('b'*32)
foreach($mode in @('CheckOnly','Prepare')) {
    AssertStandardAccountMode $mode $pin '' '';Check $true
    Reject {AssertStandardAccountMode $mode $pin $inputPath $pin}
}
AssertStandardAccountMode 'Execute' $pin $inputPath $pin;Check $true
foreach($mode in @('','execute','Run','Delete','Enable','--self-test')){Reject {AssertStandardAccountMode $mode $pin $inputPath $pin}}
foreach($bad in @('',('A'*64),'bad',($pin+"`n"))){Reject {AssertStandardAccountMode 'Prepare' $bad '' ''};Reject {AssertStandardAccountMode 'Execute' $pin $inputPath $bad}}
foreach($bad in @('C:\other',($inputPath+'\child'),($inputPath+'\..'),$inputPath.Replace('v1-input','v0-input'),$inputPath.Replace('E:','e:'),($inputPath+"`n"))){Reject {AssertStandardAccountMode 'Execute' $pin $bad $pin}}
$now=[DateTimeOffset]::Parse('2026-11-02T11:00:00.0000000+00:00')
function PlanFixture {
    [pscustomobject][ordered]@{schemaVersion=1;scope=$contract.scope;attemptId=('b'*32);ownerSid=$contract.ownerSid;machineSid=$contract.machineSid;accountName=$contract.name;root=$contract.root;scriptSha256=$pin;hostSha256=$pin;bootSha256=$pin;toolPinsSha256=$pin;issuedUtc=$now.ToString('O');expiresUtc=$now.AddHours(2).ToString('O');effects=$contract.effects.Clone()}
}
AssertStandardAccountPlan (PlanFixture) $now;Check $true
foreach($mutation in @(
    @{property='schemaVersion';value='1'},@{property='schemaVersion';value=2},@{property='scope';value='TEST_ONLY_EXPORT_POLICY_CONTROL_V5'},
    @{property='scope';value=@($contract.scope)},@{property='ownerSid';value=$newSid},@{property='machineSid';value='S-1-5-21-1-2-3'},
    @{property='accountName';value='Administrator'},@{property='root';value='C:\ProgramData\Ecs.Lic008.ExportPolicyControlV5'},
    @{property='attemptId';value=('B'*32)},@{property='attemptId';value=''},@{property='scriptSha256';value=('A'*64)},
    @{property='hostSha256';value=''},@{property='bootSha256';value='bad'},@{property='toolPinsSha256';value=@($pin)},@{property='scriptSha256';value=($pin+"`n")},
    @{property='issuedUtc';value='bad'},@{property='expiresUtc';value=$now.AddHours(3).ToString('O')},
    @{property='issuedUtc';value=$now.ToOffset([TimeSpan]::FromHours(1)).ToString('O')},
    @{property='effects';value=@('Create any account')},@{property='effects';value=@($contract.effects -join '|')}
)){$fixture=PlanFixture;$fixture.($mutation.property)=$mutation.value;Reject {AssertStandardAccountPlan $fixture $now}}
$fixture=PlanFixture;$fixture | Add-Member -NotePropertyName extra -NotePropertyValue $true;Reject {AssertStandardAccountPlan $fixture $now}
$fixture=PlanFixture;$fixture.PSObject.Properties.Remove('bootSha256');Reject {AssertStandardAccountPlan $fixture $now}
Reject {AssertStandardAccountPlan (PlanFixture) $now.AddTicks(-1)}
Reject {AssertStandardAccountPlan (PlanFixture) $now.AddHours(2)}
AssertStandardAccountInputBinding (PlanFixture) $inputPath;Check $true
Reject {AssertStandardAccountInputBinding (PlanFixture) ($contract.outputParent+'\lic008-standard-account-v1-input-'+('c'*32))}
foreach($length in @(1,16,127)){AssertStandardAccountPasswordLength $length;Check $true}
foreach($length in @(-1,0,128,[int]::MaxValue)){Reject {AssertStandardAccountPasswordLength $length}}
function DescriptorBytes([string]$sddl){$descriptor=[Security.AccessControl.RawSecurityDescriptor]::new($sddl);$bytes=New-Object byte[] $descriptor.BinaryLength;$descriptor.GetBinaryForm($bytes,0);return ,$bytes}
AssertStandardAccountRootDescriptor (DescriptorBytes 'O:BAG:BAD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)');Check $true
foreach($sddl in @('O:BAG:BAD:(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)',
    'O:SYG:BAD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)',
    'O:BAG:SYD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)',
    'O:BAG:BAD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BU)',
    'O:BAG:BAD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;FA;;;BU)',
    'O:BAG:BAD:P(A;OICI;FR;;;SY)(A;OICI;FA;;;BA)',
    'O:BAG:BAD:P(A;OICI;FA;;;SY)(A;OICI;FR;;;BA)',
    'O:BAG:BAD:P(A;OICIID;FA;;;SY)(A;OICI;FA;;;BA)',
    'O:BAG:BAD:P(A;OI;FA;;;SY)(A;OICI;FA;;;BA)',
    'O:BAG:BAD:P(A;OICI;FA;;;BA)(A;OICI;FA;;;BA)',
    'O:BAG:BAD:P(D;OICI;FA;;;SY)(A;OICI;FA;;;BA)',
    'O:BAG:BAD:P(A;OICIIO;FA;;;SY)(A;OICI;FA;;;BA)')){Reject {AssertStandardAccountRootDescriptor (DescriptorBytes $sddl)}}
Reject {AssertStandardAccountRootDescriptor ([byte[]]@(0,1,2,3))}
AssertStandardAccountNameAvailable @('Administrator') @('Users','Administrators');Check $true
Reject {AssertStandardAccountNameAvailable @($contract.name) @('Users')}
Reject {AssertStandardAccountNameAvailable @($contract.name.ToLowerInvariant()) @('Users')}
Reject {AssertStandardAccountNameAvailable @('Administrator') @($contract.name)}
Reject {AssertStandardAccountNameAvailable @('Administrator') @($contract.name.ToLowerInvariant())}
# Exercise the real sequence using only fakes. Every failed acknowledgement,
# observation or journal stops later mutations; no partial object is adopted.
foreach($initiallyInUsers in @($false,$true)) {
    $state=@{events=[Collections.Generic.List[string]]::new();observations=0;added=$false}
    $record={param($name,$payload) $state.events.Add('record:'+ $name)}
    $create={$state.events.Add('create-disabled');[pscustomobject]@{name=$contract.name;sid=$newSid;enabled=$false}}
    $observe={param($sid) $state.observations++;$state.events.Add('observe');$snapshot=SnapshotFixture;if(-not $initiallyInUsers -and -not $state.added){$snapshot.localGroupSids=@()};$snapshot}
    $add={param($sid) Check ($sid -ceq $newSid);$state.events.Add('add-users');$state.added=$true}
    $result=InvokeStandardAccountProvisioning $record $create $observe $add {$state.events.Add('guard')}
    Check ($result.sid -ceq $newSid -and -not $result.enabled -and $state.observations -eq 2)
    $expected=if($initiallyInUsers){'record:create-intent.json|guard|create-disabled|record:account-owned.json|observe|guard|observe|guard|record:account-preparation-complete.json'}else{'record:create-intent.json|guard|create-disabled|record:account-owned.json|observe|guard|add-users|observe|guard|record:account-preparation-complete.json'}
    Check (($state.events -join '|') -ceq $expected)
}
foreach($stopAt in @('record:create-intent.json','verify1','create-disabled','record:account-owned.json','observe1','verify2','add-users','observe2','verify3','record:account-preparation-complete.json')) {
    $state=@{events=[Collections.Generic.List[string]]::new();n=0;guards=0}
    function Hit([string]$step){$state.events.Add($step);if($step -ceq $stopAt){throw 'INJECTED_FAILURE'}}
    Reject {InvokeStandardAccountProvisioning {param($name,$payload) Hit ('record:'+$name)} {Hit 'create-disabled';[pscustomobject]@{name=$contract.name;sid=$newSid;enabled=$false}} {param($sid) $state.n++;Hit ('observe'+$state.n);$snapshot=SnapshotFixture;if($state.n -eq 1){$snapshot.localGroupSids=@()};$snapshot} {param($sid) Hit 'add-users'} {$state.guards++;Hit ('verify'+$state.guards)}}
    Check ($state.events[$state.events.Count-1] -ceq $stopAt)
}
foreach($badAck in @(
    [pscustomobject]@{name='Administrator';sid=$newSid;enabled=$false},
    [pscustomobject]@{name=$contract.name;sid=$contract.ownerSid;enabled=$false},
    [pscustomobject]@{name=$contract.name;sid=$newSid;enabled=$true},
    [pscustomobject]@{name=$contract.name;sid=$newSid;enabled=0}
)) {
    $state=@{events=[Collections.Generic.List[string]]::new()}
    Reject {InvokeStandardAccountProvisioning {param($name,$payload) $state.events.Add($name)} {$badAck} {$state.events.Add('MUST_NOT_OBSERVE');throw 'MUST_NOT_OBSERVE'} {$state.events.Add('MUST_NOT_ADD');throw 'MUST_NOT_ADD'} {}}
    Check (($state.events -join '|') -ceq 'create-intent.json')
}
foreach($badFirst in @('enabled','administrator','wrong-sid','incomplete')) {
    $state=@{events=[Collections.Generic.List[string]]::new()}
    Reject {InvokeStandardAccountProvisioning {param($name,$payload) $state.events.Add($name)} {[pscustomobject]@{name=$contract.name;sid=$newSid;enabled=$false}} {
        param($sid) $fixture=SnapshotFixture
        switch($badFirst){'enabled'{$fixture.enabled=$true};'administrator'{$fixture.localGroupSids=@($contract.administratorSid)};'wrong-sid'{$fixture.sid=$contract.machineSid+'-1235'};'incomplete'{$fixture.groupsComplete=$false}}
        $fixture
    } {$state.events.Add('MUST_NOT_ADD')} {}}
    Check (($state.events -join '|') -ceq 'create-intent.json|account-owned.json')
}
# Static mutation inventory is supplementary; the fake protocol checks above
# validate behavior. There must be no enable/delete/SCM/CNG command in this kit.
$commands=@($ast.FindAll({param($node) $node -is [Management.Automation.Language.CommandAst]},$true) | ForEach-Object {$_.GetCommandName()})
foreach($forbidden in @('Enable-LocalUser','Remove-LocalUser','Set-LocalUser','Remove-LocalGroupMember','Remove-Item','Start-Service','Stop-Service','sc.exe','Set-Acl')) {
    Check (@($commands | Where-Object {$_ -and (($_ -split '\\')[-1] -ieq $forbidden)}).Count -eq 0)
}
[ordered]@{schemaVersion=1;scope='TEST_ONLY_STANDARD_USER_ACCOUNT_PURE_V1';cases=$script:accountPureCases;accountCreated=$false;accountEnabled=$false;standardUserTested=$false;securityAccepted=$false;productionAccepted=$false} | ConvertTo-Json -Compress
