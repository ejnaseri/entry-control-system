[CmdletBinding()]
param([ValidateSet('SelfTest','Execute')][string]$Mode = 'SelfTest')
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Token-only successor diagnostic; V1 directory/runner/evidence are never reused.
# One retained experiment only. No Prepare, cleanup, key writes or forced stop.
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$candidate = Join-Path $repo 'out\lic008-guardian-readonly-11a2b2233af348a7a250ef9c8844de4e'
$original = Join-Path $repo 'out\lic008-pilot-runtime-candidate-d272e7da21914985b7ed4c58ef0bbf90'
$destination = 'C:\ProgramData\Ecs.Lic008.GuardianTokenDetailV1'
$retained = 'C:\ProgramData\Ecs.Lic008.EntryEvidenceV1'
$service = 'Ecs.Lic008.EntryEvidenceV1.Guardian'
$guardianSid = 'S-1-5-80-352077755-3436833279-1920633778-1136893238-1139765240'
$dotnet = 'C:\Program Files\dotnet\dotnet.exe'
$oldPath = '"C:\ProgramData\Ecs.Lic008.EntryEvidenceV1\bin\EntryControl.AdapterPilot.exe" --service Guardian'
$newPath = '"C:\Program Files\dotnet\dotnet.exe" exec --fx-version 10.0.11 "C:\ProgramData\Ecs.Lic008.GuardianTokenDetailV1\GuardianReadOnly.dll" --service'
function Need([bool]$ok,[string]$reason) { if (-not $ok) { throw $reason } }
function NoReparse([string]$path) {
    $cursor = [IO.Path]::GetFullPath($path)
    while ($cursor) {
        $item = Get-Item -LiteralPath $cursor -Force
        Need (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) 'REPARSE_REFUSED'
        $cursor = [IO.Path]::GetDirectoryName($cursor)
    }
}
function Hash([string]$path) { NoReparse $path; (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() }
function Pin([string]$path,[string]$expected) { Need ((Hash $path) -ceq $expected) 'HASH_REFUSED' }
function Snapshot {
    $s = Get-CimInstance Win32_Service -Filter "Name='$service'"
    Need ($null -ne $s) 'SERVICE_MISSING'
    [ordered]@{ Name=$s.Name; PathName=$s.PathName; StartName=$s.StartName; StartMode=$s.StartMode;
        ServiceType=$s.ServiceType; ErrorControl=$s.ErrorControl; DesktopInteract=$s.DesktopInteract;
        State=$s.State; ProcessId=$s.ProcessId; ExitCode=$s.ExitCode; ServiceSpecificExitCode=$s.ServiceSpecificExitCode }
}
function ConfigIdentity($s) {
    @($s.Name,$s.StartName,$s.StartMode,$s.ServiceType,$s.ErrorControl,[string]$s.DesktopInteract) -join '|'
}
function Stopped($s) { $s.State -ceq 'Stopped' -and $s.ProcessId -eq 0 }
function Journal([string]$name,$value) {
    $bytes = [Text.Encoding]::UTF8.GetBytes(($value | ConvertTo-Json -Depth 12))
    $stream = [IO.File]::Open((Join-Path $destination $name),[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try { $stream.Write($bytes,0,$bytes.Length); $stream.Flush($true) } finally { $stream.Dispose() }
}
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
public static class GuardianDiagnosticControl {
 [StructLayout(LayoutKind.Sequential)] struct SA {public int Length; public IntPtr Descriptor; public int Inherit;}
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string text,uint revision,out IntPtr descriptor,out uint size);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateDirectory(string path,ref SA security);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr p);
 public static void CreateProtectedDirectory(string path,string sddl) {
  IntPtr descriptor; uint size;
  if(!ConvertStringSecurityDescriptorToSecurityDescriptor(sddl,1,out descriptor,out size)) throw new Win32Exception(Marshal.GetLastWin32Error());
  try {var sa=new SA {Length=Marshal.SizeOf(typeof(SA)),Descriptor=descriptor,Inherit=0};
   if(!CreateDirectory(path,ref sa)) throw new Win32Exception(Marshal.GetLastWin32Error());
  } finally {LocalFree(descriptor);}
 }
 [DllImport("ntdll.dll")] static extern int NtQuerySystemInformation(int c,IntPtr p,int n,out int len);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr OpenSCManager(string m,string d,uint a);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern IntPtr OpenService(IntPtr m,string n,uint a);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool ChangeServiceConfig(IntPtr s,uint t,uint start,uint error,string path,string group,IntPtr tag,string dependencies,string account,string password,string display);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool StartService(IntPtr s,uint count,IntPtr args);
 [DllImport("advapi32.dll")] static extern bool CloseServiceHandle(IntPtr h);
 public static string Boot() {
  IntPtr p=Marshal.AllocHGlobal(48);
  try {int len; if(NtQuerySystemInformation(3,p,48,out len)!=0 || len<8 || len>48 || Marshal.ReadInt64(p)<=0) throw new Exception("BOOT_QUERY_REFUSED");
   using(var sha=SHA256.Create()) return BitConverter.ToString(sha.ComputeHash(BitConverter.GetBytes(Marshal.ReadInt64(p)))).Replace("-","").ToLowerInvariant();
  } finally {Marshal.FreeHGlobal(p);}
 }
 static void Action(string path,bool start) {
  IntPtr m=OpenSCManager(null,null,1); if(m==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
  try {IntPtr s=OpenService(m,"Ecs.Lic008.EntryEvidenceV1.Guardian",start?16u:2u);
   if(s==IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
   try {bool ok=start?StartService(s,0,IntPtr.Zero):ChangeServiceConfig(s,0xffffffff,0xffffffff,0xffffffff,path,null,IntPtr.Zero,null,null,null,null);
    if(!ok) throw new Win32Exception(Marshal.GetLastWin32Error());
   } finally {CloseServiceHandle(s);}
  } finally {CloseServiceHandle(m);}
 }
 public static void Path(string path) { Action(path,false); }
 public static void StartOnce() { Action(null,true); }
}
'@

# Read-only validation runs in either mode. Manifest bytes bind the inventories.
Pin (Join-Path $candidate 'manifest.json') '9827997c2072d5b09953190e4a71a9d91a6d30de64b555b98bf4155f467d14c7'
$manifest = Get-Content -LiteralPath (Join-Path $candidate 'manifest.json') -Raw | ConvertFrom-Json
Need ($manifest.files.Count -eq 5) 'MANIFEST_COUNT_REFUSED'
foreach ($f in $manifest.files) {
    Need ($f.name -cmatch '^[A-Za-z0-9.-]+$') 'FILE_NAME_REFUSED'
    Pin (Join-Path $candidate $f.name) $f.sha256
}
Pin $dotnet $manifest.dotnetSha256
Pin (Join-Path $original 'self-contained-provenance.json') '0c793e2dbb0775d5bd95e6337aa63ae4333cb1ad962d8af93b706c6527e6322a'
$provenance = Get-Content -LiteralPath (Join-Path $original 'self-contained-provenance.json') -Raw | ConvertFrom-Json
foreach ($group in @(
    @{ Root='C:\Program Files\dotnet\shared\Microsoft.NETCore.App\10.0.11'; Files=$provenance.runtimeInputs },
    @{ Root='C:\Program Files\dotnet\host\fxr\10.0.11'; Files=$provenance.fxrInputs }
)) {
    foreach ($f in $group.Files) {
        Need ($f.name -cmatch '^[A-Za-z0-9._-]+$') 'RUNTIME_NAME_REFUSED'
        Pin (Join-Path $group.Root $f.name) $f.sha256
    }
}
$before = Snapshot
Need ((Stopped $before) -and $before.PathName -ceq $oldPath) 'ORIGINAL_STOPPED_CONFIG_REFUSED'
Need ($before.StartName -ceq ('NT SERVICE\'+$service) -and $before.StartMode -ceq 'Manual' -and $before.ServiceType -ceq 'Own Process') 'SERVICE_IDENTITY_REFUSED'
Need ([GuardianDiagnosticControl]::Boot() -ceq 'b8086f476aeb3be728d83e4921f2011f43b5e87451bb7cf73b03a40184443504') 'DIAGNOSTIC_BOOT_CHANGED'
if ($Mode -eq 'SelfTest') {
    # Pure predicate negatives; no native configuration/start methods called.
    Need (-not (Stopped @{State='Running';ProcessId=1})) 'TEST_RUNNING'
    Need (-not (Stopped @{State='Stopped';ProcessId=1})) 'TEST_PID'
    $negative = [ordered]@{}
    foreach ($key in $before.Keys) { $negative[$key] = $before[$key] }
    $negative.Name = 'other'
    Need ((ConfigIdentity $before) -cne (ConfigIdentity $negative)) 'TEST_IDENTITY'
    Write-Output 'READ_ONLY_PREFLIGHT_PASS; manifest/runtime pins and stopped configuration checked. Physical execution: false.'
    return
}
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
Need ((New-Object Security.Principal.WindowsPrincipal($identity)).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) 'ADMIN_REQUIRED'
Need ($identity.User.Value -ceq 'S-1-5-21-3058020570-171625005-1532683838-1001') 'OWNER_REFUSED'
Need (-not (Test-Path -LiteralPath $destination)) 'ONE_TIME_DIRECTORY_EXISTS_DO_NOT_REPEAT'
Pin (Join-Path $retained 'plans\prepare.json') '3f90f918746db64978a2cfcc1d030cb5dbad6cff225991f4a8b830c8e4fdbc1e'
Pin (Join-Path $retained 'bin\EntryControl.AdapterPilot.dll') '586aaeab6ac9b836658a2bc1a60f94a6435debcdb33ee92775cbe4c6f124f088'
$plan = Get-Content -LiteralPath (Join-Path $retained 'plans\prepare.json') -Raw | ConvertFrom-Json
Need (@(Get-ChildItem -LiteralPath (Join-Path $retained 'bin') -Force).Count -eq $plan.packageFiles.Count) 'PACKAGE_COUNT_REFUSED'
foreach ($file in $plan.packageFiles) {
    Need ($file.name -cmatch '^[A-Za-z0-9._-]+$') 'PACKAGE_NAME_REFUSED'
    $path = Join-Path (Join-Path $retained 'bin') $file.name
    Pin $path $file.sha256
    Need ((Get-Item -LiteralPath $path).Length -eq $file.size) 'PACKAGE_LENGTH_REFUSED'
}
NoReparse 'C:\ProgramData'
# Refuse any configured automatic recovery that could repeat the diagnostic.
$serviceRegistry = Get-Item -LiteralPath ('HKLM:\SYSTEM\CurrentControlSet\Services\'+$service)
Need ($null -eq $serviceRegistry.GetValue('FailureActions',$null)) 'AUTOMATIC_RECOVERY_REFUSED'
# Protected DACL applied at creation, never inherited from the workspace.
$acl = New-Object Security.AccessControl.DirectorySecurity
$acl.SetSecurityDescriptorSddlForm("O:BAG:BAD:P(A;OICI;FA;;;SY)(A;OICI;FA;;;BA)(A;OICI;0x1200a9;;;$guardianSid)")
$sddl = $acl.GetSecurityDescriptorSddlForm([Security.AccessControl.AccessControlSections]::All)
[GuardianDiagnosticControl]::CreateProtectedDirectory($destination,$sddl)
Need ((Get-Acl -LiteralPath $destination).Sddl -ceq $sddl) 'DEPLOYMENT_ACL_REFUSED'
Journal 'attempt.json' @{scope='TEST_ONLY_GUARDIAN_READONLY_DEPLOYMENT'; owner=$identity.User.Value; utc=[DateTime]::UtcNow.ToString('o'); before=$before; originalPath=$oldPath; diagnosticPath=$newPath; productionAccepted=$false; securityAccepted=$false}
try {
    foreach ($name in @('GuardianReadOnly.dll','GuardianReadOnly.runtimeconfig.json')) {
        $f = @($manifest.files | Where-Object name -CEQ $name)
        Need ($f.Count -eq 1) 'COPY_PIN_MISSING'
        $target = Join-Path $destination $name
        [IO.File]::Copy((Join-Path $candidate $name),$target,$false)
        Pin $target $f[0].sha256
    }
    $now = Snapshot
    Need ((Stopped $now) -and $now.PathName -ceq $oldPath -and (ConfigIdentity $now) -ceq (ConfigIdentity $before)) 'PRE_CHANGE_CONFIG_CHANGED'
    [GuardianDiagnosticControl]::Path($newPath)
    $changed = Snapshot
    Need ((Stopped $changed) -and $changed.PathName -ceq $newPath -and (ConfigIdentity $changed) -ceq (ConfigIdentity $before)) 'CONFIG_CHANGE_NOT_VERIFIED'
    Journal 'configured.json' $changed
    [GuardianDiagnosticControl]::StartOnce()
    $timer = [Diagnostics.Stopwatch]::StartNew()
    do {
        Start-Sleep -Milliseconds 250
        $result = Snapshot
        if (Stopped $result) { break }
    } while ($timer.Elapsed.TotalSeconds -lt 45)
    Need (Stopped $result) 'DIAGNOSTIC_STILL_LIVE_NO_RESTORE_NO_RETRY'
    Need ($result.PathName -ceq $newPath -and (ConfigIdentity $result) -ceq (ConfigIdentity $before)) 'POST_RUN_CONFIG_CHANGED'
    Journal 'stopped-result.json' $result
    # A failed probe is a result, not authority to modify keys or retry.
    [GuardianDiagnosticControl]::Path($oldPath)
    $restored = Snapshot
    Need ((Stopped $restored) -and $restored.PathName -ceq $oldPath -and (ConfigIdentity $restored) -ceq (ConfigIdentity $before)) 'RESTORATION_NOT_VERIFIED'
    Journal 'restored.json' $restored
    Write-Output ('DIAGNOSTIC_STOPPED; Win32Exit={0}; ServiceSpecificExit={1}; original path restored.' -f $result.ExitCode,$result.ServiceSpecificExitCode)
    Write-Output ('Evidence: '+$destination+' . Do not rerun; send this output for review.')
} catch {
    # No automatic restore after ambiguous infrastructure failure; no stop/delete.
    Write-Output ('DIAGNOSTIC_RUNNER_STOPPED: '+$_.Exception.Message)
    Write-Output ('Retain '+$destination+' and current service configuration. Do not rerun, Prepare or clean up.')
    throw
}
