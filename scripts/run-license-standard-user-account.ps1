[CmdletBinding()]param(
    [string]$Mode,
    [string]$ExpectedScriptSha256,
    [string]$InputDirectory,
    [string]$ExpectedPlanSha256
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Separate account-only prerequisite. The default entry is closed. No CNG,
# service, account enable/delete, profile deletion or automatic retry exists.
function GetStandardAccountContract {
    [pscustomobject][ordered]@{
        scope='TEST_ONLY_STANDARD_USER_ACCOUNT_PREPARATION_V1'
        name='EcsLic008W03V1'
        description='LIC008 W03 disabled test account'
        root='C:\ProgramData\Ecs.Lic008.StandardUserAccountV1'
        outputParent='E:\EntryControlSystem\out'
        ownerSid='S-1-5-21-3058020570-171625005-1532683838-1001'
        machineSid='S-1-5-21-3058020570-171625005-1532683838'
        usersSid='S-1-5-32-545'
        administratorSid='S-1-5-32-544'
        powershell='C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
        moduleRoot='C:\Windows\System32\WindowsPowerShell\v1.0\Modules\Microsoft.PowerShell.LocalAccounts\1.0.0.0'
        effects=@(
            'Create the fresh protected StandardUserAccountV1 ownership/evidence root',
            'Create one NEW DISABLED local account EcsLic008W03V1 with a password entered only in this console',
            'Add only that new exact SID to the built-in Users group and verify all local memberships',
            'Retain the disabled account, ownership journal and evidence; do not enable, log on, delete, retry or touch another account',
            'No service, CNG key, TPM, existing Guardian, credential file or standard-user crypto test is invoked'
        )
    }
}
function RequireStandardAccount([bool]$ok,[string]$reason) {
    if (-not $ok) { throw $reason }
}
function TestStandardAccountSid([string]$sid) {
    $contract=GetStandardAccountContract
    if ($sid -cnotmatch ('^'+[regex]::Escape($contract.machineSid)+'-([1-9][0-9]{0,9})\z')) { return $false }
    $rid=[uint32]0
    return [uint32]::TryParse($Matches[1],[ref]$rid) -and $rid -ge 1000 -and $sid -cne $contract.ownerSid
}
function AssertStandardAccountSnapshot($snapshot,[string]$sid,[bool]$allowNoGroups) {
    $contract=GetStandardAccountContract
    RequireStandardAccount ($null -ne $snapshot -and $snapshot.name -is [string] -and
        $snapshot.name -ceq $contract.name -and $snapshot.sid -is [string] -and
        (TestStandardAccountSid $snapshot.sid) -and $snapshot.sid -ceq $sid -and
        $snapshot.enabled -is [bool] -and -not $snapshot.enabled -and
        $snapshot.principalSource -is [string] -and $snapshot.principalSource -ceq 'Local' -and $snapshot.groupsComplete -is [bool] -and
        $snapshot.groupsComplete) 'ACCOUNT_SNAPSHOT_REFUSED'
    $groups=@($snapshot.localGroupSids)
    RequireStandardAccount ($groups.Count -le 1 -and ($groups.Count -eq 1 -or $allowNoGroups) -and
        ($groups.Count -eq 0 -or ($groups[0] -is [string] -and $groups[0] -ceq $contract.usersSid))) 'ACCOUNT_MEMBERSHIP_REFUSED'
}
function InvokeStandardAccountProvisioning([scriptblock]$record,[scriptblock]$create,[scriptblock]$observe,[scriptblock]$addUsers,[scriptblock]$verify) {
    # Durable intent precedes create; acknowledgement precedes membership. All
    # callbacks throw closed. No catch/retry/adoption/cleanup path is present.
    $contract=GetStandardAccountContract
    RequireStandardAccount ($null -ne $record -and $null -ne $create -and $null -ne $observe -and $null -ne $addUsers -and $null -ne $verify) 'ACCOUNT_PROTOCOL_CALLBACK_REQUIRED'
    & $record 'create-intent.json' ([ordered]@{name=$contract.name; disabled=$true; intendedGroupSid=$contract.usersSid})
    & $verify
    $created=& $create
    RequireStandardAccount ($null -ne $created -and $created.name -is [string] -and $created.name -ceq $contract.name -and
        $created.sid -is [string] -and (TestStandardAccountSid $created.sid) -and
        $created.enabled -is [bool] -and -not $created.enabled) 'ACCOUNT_CREATE_ACK_REFUSED'
    & $record 'account-owned.json' ([ordered]@{name=$created.name; sid=$created.sid; createdDisabled=$true})
    $before=& $observe $created.sid
    AssertStandardAccountSnapshot $before $created.sid $true
    & $verify
    if (@($before.localGroupSids).Count -eq 0) { & $addUsers $created.sid }
    $after=& $observe $created.sid
    AssertStandardAccountSnapshot $after $created.sid $false
    & $verify
    & $record 'account-preparation-complete.json' $after
    return $after
}
function AssertStandardAccountInputBinding($plan,[string]$directory) {
    $expected=(GetStandardAccountContract).outputParent+'\lic008-standard-account-v1-input-'+$plan.attemptId
    RequireStandardAccount ($directory -ceq $expected) 'ACCOUNT_INPUT_ATTEMPT_BINDING_REFUSED'
}
function AssertStandardAccountPasswordLength([int]$length) {
    RequireStandardAccount ($length -gt 0 -and $length -le 127) 'ACCOUNT_PASSWORD_LENGTH_REFUSED'
}
function AssertStandardAccountNameAvailable([string[]]$userNames,[string[]]$groupNames) {
    $name=(GetStandardAccountContract).name
    RequireStandardAccount (@($userNames | Where-Object {$_ -ieq $name}).Count -eq 0) 'ACCOUNT_NAME_ALREADY_EXISTS_DO_NOT_ADOPT'
    RequireStandardAccount (@($groupNames | Where-Object {$_ -ieq $name}).Count -eq 0) 'ACCOUNT_NAME_COLLIDES_WITH_LOCAL_GROUP'
}
function AssertStandardAccountPlan($plan,[DateTimeOffset]$now) {
    $contract=GetStandardAccountContract
    $names=@('schemaVersion','scope','attemptId','ownerSid','machineSid','accountName','root','scriptSha256','hostSha256','bootSha256','toolPinsSha256','issuedUtc','expiresUtc','effects')
    RequireStandardAccount ($null -ne $plan -and (@($plan.PSObject.Properties.Name) -join '|') -ceq ($names -join '|')) 'ACCOUNT_PLAN_FIELDS_REFUSED'
    foreach($property in @('scope','ownerSid','machineSid','accountName','root')) {
        RequireStandardAccount ($plan.$property -is [string]) 'ACCOUNT_PLAN_BINDING_REFUSED'
    }
    RequireStandardAccount ($plan.schemaVersion -is [int] -and $plan.schemaVersion -eq 1 -and
        $plan.scope -ceq $contract.scope -and $plan.ownerSid -ceq $contract.ownerSid -and
        $plan.machineSid -ceq $contract.machineSid -and $plan.accountName -ceq $contract.name -and
        $plan.root -ceq $contract.root -and $plan.attemptId -is [string] -and
        $plan.attemptId -cmatch '^[a-f0-9]{32}\z') 'ACCOUNT_PLAN_BINDING_REFUSED'
    foreach($property in @('scriptSha256','hostSha256','bootSha256','toolPinsSha256')) {
        RequireStandardAccount ($plan.$property -is [string] -and $plan.$property -cmatch '^[a-f0-9]{64}\z') 'ACCOUNT_PLAN_HASH_REFUSED'
    }
    RequireStandardAccount ($plan.issuedUtc -is [string] -and $plan.expiresUtc -is [string]) 'ACCOUNT_PLAN_TIME_REFUSED'
    $issued=[DateTimeOffset]::MinValue; $expires=[DateTimeOffset]::MinValue
    RequireStandardAccount ([DateTimeOffset]::TryParseExact($plan.issuedUtc,'O',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$issued) -and
        [DateTimeOffset]::TryParseExact($plan.expiresUtc,'O',[Globalization.CultureInfo]::InvariantCulture,[Globalization.DateTimeStyles]::None,[ref]$expires) -and
        $issued.Offset -eq [TimeSpan]::Zero -and $expires.Offset -eq [TimeSpan]::Zero -and
        $expires -eq $issued.AddHours(2) -and $now -ge $issued -and $now -lt $expires) 'ACCOUNT_PLAN_TIME_REFUSED'
    RequireStandardAccount (@($plan.effects).Count -eq $contract.effects.Count) 'ACCOUNT_PLAN_EFFECTS_REFUSED'
    for($index=0;$index -lt $contract.effects.Count;$index++) {
        RequireStandardAccount ($plan.effects[$index] -is [string] -and $plan.effects[$index] -ceq $contract.effects[$index]) 'ACCOUNT_PLAN_EFFECTS_REFUSED'
    }
}
function AssertStandardAccountMode([string]$mode,[string]$scriptHash,[string]$inputDir,[string]$planHash) {
    RequireStandardAccount ($mode -cin @('CheckOnly','Prepare','Execute')) 'STANDARD_USER_ACCOUNT_ENTRY_CLOSED'
    RequireStandardAccount ($scriptHash -cmatch '^[a-f0-9]{64}\z') 'ACCOUNT_SCRIPT_PIN_REQUIRED'
    if($mode -ceq 'Execute') {
        $prefix=[regex]::Escape((GetStandardAccountContract).outputParent+'\lic008-standard-account-v1-input-')
        RequireStandardAccount ($inputDir -cmatch ('^'+$prefix+'[a-f0-9]{32}\z') -and $planHash -cmatch '^[a-f0-9]{64}\z') 'ACCOUNT_REVIEWED_INPUT_REQUIRED'
    } else {
        RequireStandardAccount ([string]::IsNullOrEmpty($inputDir) -and [string]::IsNullOrEmpty($planHash)) 'ACCOUNT_UNEXPECTED_INPUT_ARGUMENTS'
    }
}
function StandardAccountHashBytes([byte[]]$bytes) {
    $sha=[Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose() }
}
function AssertStandardAccountPlainPath([string]$path) {
    RequireStandardAccount ([IO.Path]::GetFullPath($path) -ceq $path -and $path -cmatch '^[A-Z]:\\' -and -not $path.Substring(2).Contains(':')) 'ACCOUNT_PATH_REFUSED'
    for($cursor=$path;$cursor;$cursor=[IO.Path]::GetDirectoryName($cursor)) {
        RequireStandardAccount (([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) -eq 0) 'ACCOUNT_REPARSE_REFUSED'
    }
}
function StandardAccountHashFile([string]$path) {
    AssertStandardAccountPlainPath $path
    $stream=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    $sha=[Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose();$stream.Dispose() }
}
function GetStandardAccountTools {
    $contract=GetStandardAccountContract
    $paths=@($contract.powershell,(Join-Path $contract.moduleRoot 'Microsoft.PowerShell.LocalAccounts.psd1'),
        (Join-Path $contract.moduleRoot 'Microsoft.Powershell.LocalAccounts.dll'),(Join-Path $contract.moduleRoot 'LocalAccounts.format.ps1xml'))
    $pins=@(foreach($path in $paths){[ordered]@{path=$path;sha256=(StandardAccountHashFile $path)}})
    $bytes=[Text.Encoding]::UTF8.GetBytes(($pins | ConvertTo-Json -Depth 4 -Compress))
    [pscustomobject]@{files=$pins;sha256=(StandardAccountHashBytes $bytes)}
}
function InitializeStandardAccountNative {
    RequireStandardAccount ([IntPtr]::Size -eq 8 -and $PSVersionTable.PSEdition -ceq 'Desktop' -and $PSVersionTable.PSVersion.ToString() -ceq '5.1.22000.2538') 'ACCOUNT_HOST_RUNTIME_REFUSED'
    Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using Microsoft.Win32.SafeHandles;
public static class Lic008AccountPreparationNativeV1 {
    [StructLayout(LayoutKind.Sequential)] struct Attributes { public int Length; public IntPtr Descriptor; [MarshalAs(UnmanagedType.Bool)] public bool Inherit; }
    [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,ExactSpelling=true)]
    [return:MarshalAs(UnmanagedType.Bool)] static extern bool CreateDirectoryW(string path,ref Attributes attributes);
    [DllImport("advapi32.dll",SetLastError=true)]
    [return:MarshalAs(UnmanagedType.Bool)] static extern bool GetTokenInformation(SafeAccessTokenHandle token,int kind,out int value,int capacity,out int written);
    public static void RequireElevatedPrimary(SafeAccessTokenHandle token) {
        foreach(int kind in new[]{8,20}) {int value,written;if(!GetTokenInformation(token,kind,out value,4,out written)||written!=4||value!=1)throw new InvalidOperationException("ACCOUNT_ELEVATED_PRIMARY_REQUIRED");}
    }
    public static void CreateLockedRoot() {
        var descriptor=new RawSecurityDescriptor("O:BAG:BAD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)");
        var bytes=new byte[descriptor.BinaryLength];descriptor.GetBinaryForm(bytes,0);
        var pin=GCHandle.Alloc(bytes,GCHandleType.Pinned);
        try {var attributes=new Attributes{Length=Marshal.SizeOf(typeof(Attributes)),Descriptor=pin.AddrOfPinnedObject(),Inherit=false};
            if(!CreateDirectoryW(@"C:\ProgramData\Ecs.Lic008.StandardUserAccountV1",ref attributes))throw new Win32Exception(Marshal.GetLastWin32Error());}
        finally{pin.Free();}
    }
}
'@
    $modulePath=Join-Path (GetStandardAccountContract).moduleRoot 'Microsoft.PowerShell.LocalAccounts.psd1'
    Import-Module -Name $modulePath -ErrorAction Stop
    foreach($name in @('Get-LocalUser','New-LocalUser','Get-LocalGroup','Get-LocalGroupMember','Add-LocalGroupMember')) {
        $command=Get-Command ('Microsoft.PowerShell.LocalAccounts\'+$name) -CommandType Cmdlet -ErrorAction Stop
        RequireStandardAccount ($command.ImplementingType.Assembly.Location -ieq (Join-Path (GetStandardAccountContract).moduleRoot 'Microsoft.Powershell.LocalAccounts.dll')) 'ACCOUNT_CMDLET_IMPLEMENTATION_REFUSED'
    }
}
function GetStandardAccountHostBinding {
    $contract=GetStandardAccountContract
    $thread=[Security.Principal.WindowsIdentity]::GetCurrent($true)
    try {RequireStandardAccount ($null -eq $thread) 'ACCOUNT_IMPERSONATION_REFUSED'} finally {if($thread){$thread.Dispose()}}
    $identity=[Security.Principal.WindowsIdentity]::GetCurrent()
    try {
        RequireStandardAccount ($identity.User.Value -ceq $contract.ownerSid -and ([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) 'ACCOUNT_OWNER_ELEVATION_REFUSED'
        [Lic008AccountPreparationNativeV1]::RequireElevatedPrimary($identity.AccessToken)
    } finally {$identity.Dispose()}
    $localOwner=@(Microsoft.PowerShell.LocalAccounts\Get-LocalUser | Where-Object {$_.SID.Value -ceq $contract.ownerSid})
    RequireStandardAccount ($localOwner.Count -eq 1) 'ACCOUNT_LOCAL_MACHINE_OWNER_REFUSED'
    $operatingSystems=@(Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction Stop)
    RequireStandardAccount ($operatingSystems.Count -eq 1 -and $operatingSystems[0].LastBootUpTime -is [DateTime]) 'ACCOUNT_BOOT_QUERY_REFUSED'
    $guid=(Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Cryptography' -Name MachineGuid -ErrorAction Stop).MachineGuid
    RequireStandardAccount ($guid -is [string] -and $guid -cmatch '^[a-fA-F0-9-]{36}$') 'ACCOUNT_HOST_QUERY_REFUSED'
    [pscustomobject]@{
        hostSha256=(StandardAccountHashBytes ([Text.Encoding]::UTF8.GetBytes('STANDARD_ACCOUNT_V1|'+$guid+'|'+$contract.machineSid)))
        bootSha256=(StandardAccountHashBytes ([Text.Encoding]::UTF8.GetBytes($operatingSystems[0].LastBootUpTime.ToUniversalTime().ToString('O'))))
    }
}
function AssertStandardAccountFresh {
    $contract=GetStandardAccountContract
    AssertStandardAccountPlainPath ([IO.Path]::GetDirectoryName($contract.root))
    RequireStandardAccount (-not (Test-Path -LiteralPath $contract.root)) 'ACCOUNT_ROOT_ALREADY_EXISTS_RETAIN_DO_NOT_RETRY'
    $accounts=@(Microsoft.PowerShell.LocalAccounts\Get-LocalUser)
    $groups=@(Microsoft.PowerShell.LocalAccounts\Get-LocalGroup)
    AssertStandardAccountNameAvailable @($accounts | ForEach-Object Name) @($groups | ForEach-Object Name)
    $users=Microsoft.PowerShell.LocalAccounts\Get-LocalGroup -SID ([Security.Principal.SecurityIdentifier]$contract.usersSid) -ErrorAction Stop
    RequireStandardAccount ($users.SID.Value -ceq $contract.usersSid) 'ACCOUNT_USERS_GROUP_REFUSED'
    # Discover unreadable/orphaned group enumeration before consuming the root
    # or creating an account. Never print other accounts' membership details.
    foreach($group in $groups) {
        $null=@(Microsoft.PowerShell.LocalAccounts\Get-LocalGroupMember -Group $group -ErrorAction Stop)
    }
}
function AssertStandardAccountRootDescriptor([byte[]]$bytes) {
    $contract=GetStandardAccountContract
    $descriptor=[Security.AccessControl.RawSecurityDescriptor]::new($bytes,0)
    RequireStandardAccount ($descriptor.Owner.Value -ceq $contract.administratorSid -and $descriptor.Group.Value -ceq $contract.administratorSid -and
        ($descriptor.ControlFlags -band [Security.AccessControl.ControlFlags]::DiscretionaryAclProtected) -ne 0 -and $null -ne $descriptor.DiscretionaryAcl -and $descriptor.DiscretionaryAcl.Count -eq 2) 'ACCOUNT_ROOT_DESCRIPTOR_REFUSED'
    $sids=@(foreach($ace in $descriptor.DiscretionaryAcl){
        RequireStandardAccount ($ace -is [Security.AccessControl.CommonAce] -and -not $ace.IsCallback -and
            $ace.AceQualifier -eq [Security.AccessControl.AceQualifier]::AccessAllowed -and $ace.AccessMask -eq 2032127 -and [int]$ace.AceFlags -eq 3) 'ACCOUNT_ROOT_ACE_REFUSED'
        $ace.SecurityIdentifier.Value
    })
    RequireStandardAccount ((($sids | Sort-Object) -join '|') -ceq 'S-1-5-18|S-1-5-32-544') 'ACCOUNT_ROOT_PRINCIPALS_REFUSED'
}
function AssertStandardAccountRoot {
    $contract=GetStandardAccountContract
    AssertStandardAccountPlainPath $contract.root
    $security=[IO.Directory]::GetAccessControl($contract.root,[Security.AccessControl.AccessControlSections]'Owner,Group,Access')
    AssertStandardAccountRootDescriptor $security.GetSecurityDescriptorBinaryForm()
}
function WriteStandardAccountRecord([string]$name,$value) {
    RequireStandardAccount ($name -cin @('plan.json','create-intent.json','account-owned.json','account-preparation-complete.json','result.json')) 'ACCOUNT_RECORD_NAME_REFUSED'
    AssertStandardAccountRoot
    $path=Join-Path (GetStandardAccountContract).root $name
    $bytes=[Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Depth 10 -Compress))
    $stream=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    try {$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)} finally {$stream.Dispose()}
}
function GetStandardAccountSnapshot([string]$sid) {
    RequireStandardAccount (TestStandardAccountSid $sid) 'ACCOUNT_OBSERVE_SID_REFUSED'
    $account=Microsoft.PowerShell.LocalAccounts\Get-LocalUser -SID ([Security.Principal.SecurityIdentifier]$sid) -ErrorAction Stop
    $groupSids=@(foreach($group in @(Microsoft.PowerShell.LocalAccounts\Get-LocalGroup)) {
        $members=@(Microsoft.PowerShell.LocalAccounts\Get-LocalGroupMember -Group $group -ErrorAction Stop)
        if(@($members | Where-Object {$_.SID.Value -ceq $sid}).Count -gt 0){$group.SID.Value}
    })
    [pscustomobject][ordered]@{name=$account.Name;sid=$account.SID.Value;enabled=[bool]$account.Enabled;principalSource=$account.PrincipalSource.ToString();groupsComplete=$true;localGroupSids=@($groupSids | Sort-Object)}
}

# Close before loading modules, inspecting accounts or issuing files.
AssertStandardAccountMode $Mode $ExpectedScriptSha256 $InputDirectory $ExpectedPlanSha256
$contract=GetStandardAccountContract
RequireStandardAccount ((StandardAccountHashFile $PSCommandPath) -ceq $ExpectedScriptSha256) 'ACCOUNT_SCRIPT_PIN_MISMATCH'
$toolPins=GetStandardAccountTools
InitializeStandardAccountNative
$binding=GetStandardAccountHostBinding
AssertStandardAccountFresh
if($Mode -ceq 'CheckOnly') {
    [ordered]@{scope=$contract.scope;status='FRESH_DISABLED_ACCOUNT_PREPARATION_ONLY';hostSha256=$binding.hostSha256;bootSha256=$binding.bootSha256;tools=$toolPins;accountCreated=$false;accountEnabled=$false;standardUserTested=$false;securityAccepted=$false;productionAccepted=$false} | ConvertTo-Json -Depth 6 -Compress
    exit 0
}
if($Mode -ceq 'Prepare') {
    $attempt=[guid]::NewGuid().ToString('N');$issued=[DateTimeOffset]::UtcNow
    $plan=[pscustomobject][ordered]@{schemaVersion=1;scope=$contract.scope;attemptId=$attempt;ownerSid=$contract.ownerSid;machineSid=$contract.machineSid;accountName=$contract.name;root=$contract.root;scriptSha256=$ExpectedScriptSha256;hostSha256=$binding.hostSha256;bootSha256=$binding.bootSha256;toolPinsSha256=$toolPins.sha256;issuedUtc=$issued.ToString('O');expiresUtc=$issued.AddHours(2).ToString('O');effects=$contract.effects}
    AssertStandardAccountPlan $plan ([DateTimeOffset]::UtcNow)
    AssertStandardAccountPlainPath $contract.outputParent
    $destination=Join-Path $contract.outputParent ('lic008-standard-account-v1-input-'+$attempt)
    $null=New-Item -ItemType Directory -Path $destination -ErrorAction Stop
    $bytes=[Text.Encoding]::UTF8.GetBytes(($plan | ConvertTo-Json -Depth 6 -Compress))
    $stream=[IO.File]::Open((Join-Path $destination 'plan.json'),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
    try {$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)} finally {$stream.Dispose()}
    [ordered]@{scope='TEST_ONLY_STANDARD_USER_ACCOUNT_PREPARED_INPUT_V1';inputDirectory=$destination;planSha256=(StandardAccountHashBytes $bytes);plan=$plan;accountCreated=$false;standardUserTested=$false;securityAccepted=$false;productionAccepted=$false} | ConvertTo-Json -Depth 8 -Compress
    exit 0
}
AssertStandardAccountPlainPath $InputDirectory
$planPath=Join-Path $InputDirectory 'plan.json'
RequireStandardAccount ((StandardAccountHashFile $planPath) -ceq $ExpectedPlanSha256) 'ACCOUNT_PLAN_PIN_MISMATCH'
$planBytes=[IO.File]::ReadAllBytes($planPath)
RequireStandardAccount ($planBytes.Length -gt 0 -and $planBytes.Length -le 16384) 'ACCOUNT_PLAN_SIZE_REFUSED'
$plan=[Text.Encoding]::UTF8.GetString($planBytes) | ConvertFrom-Json
AssertStandardAccountPlan $plan ([DateTimeOffset]::UtcNow)
AssertStandardAccountInputBinding $plan $InputDirectory
RequireStandardAccount ((StandardAccountHashBytes ([Text.Encoding]::UTF8.GetBytes(($plan | ConvertTo-Json -Depth 6 -Compress)))) -ceq $ExpectedPlanSha256) 'ACCOUNT_PLAN_NONCANONICAL_REFUSED'
function AssertAccountExecutionBindings {
    AssertStandardAccountPlan $plan ([DateTimeOffset]::UtcNow)
    RequireStandardAccount ((StandardAccountHashFile $PSCommandPath) -ceq $plan.scriptSha256 -and (StandardAccountHashFile $planPath) -ceq $ExpectedPlanSha256 -and
        (GetStandardAccountTools).sha256 -ceq $plan.toolPinsSha256) 'ACCOUNT_EXECUTION_PIN_DRIFT'
    $current=GetStandardAccountHostBinding
    RequireStandardAccount ($current.hostSha256 -ceq $plan.hostSha256 -and $current.bootSha256 -ceq $plan.bootSha256) 'ACCOUNT_HOST_BOOT_DRIFT'
    AssertStandardAccountPlan $plan ([DateTimeOffset]::UtcNow)
}
AssertAccountExecutionBindings
RequireStandardAccount (-not [Console]::IsInputRedirected -and -not [Console]::IsOutputRedirected) 'ACCOUNT_LIVE_CONSOLE_REQUIRED'
[Console]::WriteLine('TEST ONLY: NEW DISABLED STANDARD ACCOUNT. No crypto test or logon. One attempt; retain any partial result.')
foreach($effect in $contract.effects){[Console]::WriteLine($effect)}
$confirmation='CONFIRM LIC008 STANDARD-ACCOUNT V1 '+$plan.attemptId+' '+$ExpectedPlanSha256
[Console]::WriteLine($confirmation)
RequireStandardAccount ([Console]::ReadLine() -ceq $confirmation) 'ACCOUNT_OWNER_CONFIRMATION_REFUSED'
$password=$null
try {
    $password=Read-Host 'Choose a password for the NEW DISABLED test account (local secure entry only)' -AsSecureString
    RequireStandardAccount ($null -ne $password) 'ACCOUNT_PASSWORD_REQUIRED'
    AssertStandardAccountPasswordLength $password.Length
    AssertAccountExecutionBindings
    AssertStandardAccountFresh
    # Atomic CREATE_NEW directory with the final protected SYSTEM/Admin DACL.
    # Any subsequent error retains intent/acknowledgements without retry.
    [Lic008AccountPreparationNativeV1]::CreateLockedRoot()
    $script:accountStage='write-plan';$failure=$null;$completed=$false;$resultAccount=$null
    try {
        WriteStandardAccountRecord 'plan.json' $plan
        $resultAccount=InvokeStandardAccountProvisioning -record {
            param($name,$payload)
            $script:accountStage=$name
            WriteStandardAccountRecord $name ([ordered]@{schemaVersion=1;scope=$contract.scope;attemptId=$plan.attemptId;planSha256=$ExpectedPlanSha256;utc=[DateTimeOffset]::UtcNow.ToString('O');payload=$payload})
        } -create {
            $script:accountStage='native-create-disabled'
            AssertAccountExecutionBindings
            $created=Microsoft.PowerShell.LocalAccounts\New-LocalUser -Name $contract.name -Password $password -Disabled -Description $contract.description -ErrorAction Stop
            [pscustomobject]@{name=$created.Name;sid=$created.SID.Value;enabled=[bool]$created.Enabled}
        } -observe {param($sid) $script:accountStage='observe-disabled-memberships';AssertAccountExecutionBindings;GetStandardAccountSnapshot $sid} -addUsers {
            param($sid)
            $script:accountStage='add-owned-sid-to-users'
            AssertAccountExecutionBindings
            AssertStandardAccountSnapshot (GetStandardAccountSnapshot $sid) $sid $true
            $account=Microsoft.PowerShell.LocalAccounts\Get-LocalUser -SID ([Security.Principal.SecurityIdentifier]$sid) -ErrorAction Stop
            $group=Microsoft.PowerShell.LocalAccounts\Get-LocalGroup -SID ([Security.Principal.SecurityIdentifier]$contract.usersSid) -ErrorAction Stop
            AssertAccountExecutionBindings
            Microsoft.PowerShell.LocalAccounts\Add-LocalGroupMember -Group $group -Member $account -ErrorAction Stop
        } -verify {AssertAccountExecutionBindings}
        $completed=$true
    } catch {
        $failure=[ordered]@{stage=$script:accountStage;category=$_.Exception.GetType().FullName;hResult=$_.Exception.HResult;state='RETAIN_NO_RETRY_OR_ADOPTION'}
    }
    $result=[ordered]@{schemaVersion=1;scope=$contract.scope;attemptId=$plan.attemptId;planSha256=$ExpectedPlanSha256;finishedUtc=[DateTimeOffset]::UtcNow.ToString('O');status=$(if($completed){'DISABLED_ACCOUNT_PREPARATION_COMPLETE'}else{'PARTIAL_OR_UNKNOWN_RETAIN_DO_NOT_RETRY'});account=$resultAccount;failure=$failure;standardUserTested=$false;securityAccepted=$false;productionAccepted=$false}
    WriteStandardAccountRecord 'result.json' $result
    $result | ConvertTo-Json -Depth 8 -Compress
    if(-not $completed){exit 1}
} finally {if($password){$password.Dispose()}}
