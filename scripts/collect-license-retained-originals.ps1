# Fixed read-only archival of 19 historical LIC008 metadata reports.
# Writes only a fresh repository out directory. No protected directory enumeration,
# experiment execution, key/shared-envelope access, or service/ACL mutation.
[CmdletBinding()]param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$expectedOwnerSid = 'S-1-5-21-3058020570-171625005-1532683838-1001'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
try {
    if ($identity.User.Value -cne $expectedOwnerSid -or -not ([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { throw 'RETAINED_CAPTURE_EXPECTED_ELEVATED_OWNER_REQUIRED' }
} finally { $identity.Dispose() }
function AssertPlain([string]$path) {
    if ($path -cnotmatch '^[A-Z]:\\' -or [IO.Path]::GetFullPath($path) -cne $path -or $path.Substring(2).Contains(':')) { throw 'RETAINED_CAPTURE_PATH_REFUSED' }
    for ($cursor=$path; $cursor; $cursor=[IO.Path]::GetDirectoryName($cursor)) {
        if (([IO.File]::GetAttributes($cursor) -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'RETAINED_CAPTURE_REPARSE_REFUSED' }
    }
}
function BytesHash([byte[]]$bytes) {
    $sha=[Security.Cryptography.SHA256]::Create()
    try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose() }
}
function WriteNew([string]$path,[byte[]]$bytes) {
    AssertPlain ([IO.Path]::GetDirectoryName($path))
    $file=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite,[IO.FileShare]::Read)
    try {
        $file.Write($bytes,0,$bytes.Length); $file.Flush($true); $file.Position=0
        $sha=[Security.Cryptography.SHA256]::Create()
        try { $written=([BitConverter]::ToString($sha.ComputeHash($file))).Replace('-','').ToLowerInvariant() } finally { $sha.Dispose() }
        if ($file.Length -ne $bytes.Length -or $written -cne (BytesHash $bytes)) { throw 'RETAINED_CAPTURE_COPY_READBACK_FAILED' }
    } finally { $file.Dispose() }
}
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;
public static class RetainedMetadataReadOnlyNative {
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true, ExactSpelling=true)]
    [return:MarshalAs(UnmanagedType.Bool)] public static extern bool CreateDirectoryW(string path, IntPtr attributes);
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true, ExactSpelling=true)]
    public static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle, StringBuilder path, uint size, uint flags);
}
'@
$allowlist = @'
[
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV2\\wrapping-summary-7da3625af6f14f10b05b5bed5e1cf5be.json",
    "size": 1888,
    "sha256": "65f72549d6638f0d30488d5372bd2384f282853ab3daf79b260ddd1d18f164a1"
  },
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV4\\wrapping-summary-47513d20e9864dcf84d40b8ace00b916.json",
    "size": 4925,
    "sha256": "ae8698b7e6459a3aa1c3fbee17f5c424c679aeb9d7f60f64ce5d4c4e11ee9a6a"
  },
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV4\\reboot-checkpoint.json",
    "size": 2404,
    "sha256": "7417aae3163e3a35e0103303619844adcda021388c1816f02e8d288f10be62ea"
  },
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV5\\wrapping-summary-de5efc93255841619c9f86f2570af292.json",
    "size": 5725,
    "sha256": "7a90250b5c520db757b27381b6cf995f90ce1486b03446d6314a8954de1734ef"
  },
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV5\\repair-checkpoint.json",
    "size": 2265,
    "sha256": "adb4aa66402c671f50d21bbcdca84dc619341ffc5108ea1c7bdcd7fb20a7b1d8"
  },
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV4\\app-reports\\4630e211a11542c292370df295447d69.json",
    "size": 1708,
    "sha256": "566c671c7ae725bb909250b3205427a3f1fb01c16a8f8dfaf56e84cb14b12b45"
  },
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV4\\app-reports\\62fc2cb5f0fd4c1ca2f732c100943089.json",
    "size": 1708,
    "sha256": "adcb0a30587bbb9a01b842727669e0a53fddb3b3f735a543e36c5f5602bdc951"
  },
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV4\\guardian-reports\\78eb581814e34b0e990c565727343851.json",
    "size": 1523,
    "sha256": "1dbc6dd514cc6ceb6a2f3adccf0d780d458934a93ac6ae4d56737037249188eb"
  },
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV4\\guardian-reports\\9cffef3f732c48ec845289f7cd972905.json",
    "size": 1524,
    "sha256": "bfcaa992e4042c4e97669bb60aa53da5787cbee426e1e97aca41c6ffaa77f876"
  },
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV4\\setup-reports\\c4f2c4e719cb419b90683dc99de8506a.json",
    "size": 1088,
    "sha256": "c2fc9acdf5969949775a1a818ea80b78c87fc337698e547e7fc16a7efed27427"
  },
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV4\\setup-reports\\f860e5ce878a4266897dadc38a7ef47c.json",
    "size": 4519,
    "sha256": "61b58565969f7921a50bd0759738e45e3d1dcb167f9b352e49e4b56b25918208"
  },
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV5\\app-reports\\b801b6f83e814d50becdb8eb774ab022.json",
    "size": 1723,
    "sha256": "0e5393bd2321d885043c181c77904404b903e6e71f3aa98d58f286a751b41c94"
  },
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV5\\app-reports\\ee50ed945ad245e5bdf9ff673f47d44a.json",
    "size": 1723,
    "sha256": "15a3c0383057f8f051bf6eb459c30e271a0783ae868331c692a7238db023f66e"
  },
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV5\\guardian-reports\\88f7b426bdb44597b4ff534c25e6e61e.json",
    "size": 1779,
    "sha256": "535fb3fe68bc75e1e3d5cf071b67c57859d011ec82169649d4c8e3d201e939c4"
  },
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV5\\guardian-reports\\91b6e923a3d04740a143905eb1bcc13d.json",
    "size": 1538,
    "sha256": "e2072c3b9e091a582d2b1eff008d1c270549099e4f9eb42c44c4808d73b4ed1f"
  },
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV5\\guardian-reports\\de74e8bd89f34a4289828aeb2ab51efa.json",
    "size": 1538,
    "sha256": "b1847249f9912c548c8645b89fac92a47da966d51981d2f38972d5e9fbd1d722"
  },
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV5\\guardian-reports\\f6249fbf23a24ffbb3e56072c7aa3691.json",
    "size": 1538,
    "sha256": "dc8f5e15a915be6daad8e710b4c15cf2bfdff62c0c3f7bfad16ea9cce1cfd8b5"
  },
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV5\\setup-reports\\0976d16a1c3c40d588856f5fc6ed6c93.json",
    "size": 1104,
    "sha256": "4c416275b5309f8be83d5b961944f183cfb67e1f412bc5327afab12b708c0725"
  },
  {
    "path": "C:\\ProgramData\\Ecs.Lic008.WrappingV5\\setup-reports\\ef164161de664ea085ec54bab83c67b9.json",
    "size": 4533,
    "sha256": "1f284545cff3d2dcd1b1fbf506bb61e43e10f9d3665ee3e7301c11e24c2e36e3"
  }
]
'@ | ConvertFrom-Json
if ($allowlist.Count -ne 19) { throw 'RETAINED_CAPTURE_ALLOWLIST_REFUSED' }
$outputParent=Join-Path $repoRoot 'out'
AssertPlain $outputParent
$destination=Join-Path $outputParent ('lic008-retained-original-capture-'+[guid]::NewGuid().ToString('N'))
if (-not [RetainedMetadataReadOnlyNative]::CreateDirectoryW($destination,[IntPtr]::Zero)) { throw 'RETAINED_CAPTURE_NEW_DIRECTORY_REQUIRED' }
AssertPlain $destination
$started=[DateTimeOffset]::UtcNow.ToString('O')
$records=@(); $allMatched=$true
foreach ($row in $allowlist) {
    $stream=$null
    try {
        AssertPlain $row.path
        if (([IO.File]::GetAttributes($row.path) -band [IO.FileAttributes]::Directory) -ne 0) { throw 'RETAINED_CAPTURE_FILE_REQUIRED' }
        $stream=[IO.File]::Open($row.path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
        $final=New-Object Text.StringBuilder 1024
        $length=[RetainedMetadataReadOnlyNative]::GetFinalPathNameByHandleW($stream.SafeFileHandle,$final,1024,0)
        if ($length -eq 0 -or $length -ge 1024 -or $final.ToString() -ine ('\\?\'+$row.path)) { throw 'RETAINED_CAPTURE_FINAL_PATH_REFUSED' }
        if ($row.size -le 0 -or $row.size -gt 1048576 -or $stream.Length -ne $row.size) { throw 'RETAINED_CAPTURE_SIZE_MISMATCH' }
        $bytes=New-Object byte[] ([int]$row.size); $position=0
        while ($position -lt $bytes.Length) {
            $count=$stream.Read($bytes,$position,$bytes.Length-$position)
            if ($count -le 0) { throw 'RETAINED_CAPTURE_TRUNCATED' }
            $position+=$count
        }
        $digest=BytesHash $bytes
        if ($stream.Length -ne $row.size -or $digest -cne $row.sha256) { throw 'RETAINED_CAPTURE_HASH_MISMATCH' }
        AssertPlain $row.path
        $filename=$row.path.Substring('C:\ProgramData\'.Length).Replace('\','__')
        $copy=Join-Path $destination $filename
        WriteNew $copy $bytes
        $records+=@([ordered]@{ sourcePath=$row.path; observation='EXPECTED_BYTES_CAPTURED'; size=$bytes.Length; originalSha256=$digest; copyPath=$copy; copySha256=$digest; expectedBytesMatched=$true })
    } catch {
        $allMatched=$false
        $records+=@([ordered]@{ sourcePath=$row.path; observation='UNAVAILABLE_OR_MISMATCH_STOPPED'; errorType=$_.Exception.GetType().FullName; hResult=$_.Exception.HResult; expectedBytesMatched=$false })
        break
    } finally { if ($null -ne $stream) { $stream.Dispose() } }
}
$report=[ordered]@{
    schemaVersion=1; scope='TEST_ONLY_LIC008_RETAINED_ORIGINAL_CAPTURE_V1'
    collectorSha256=(Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
    startedUtc=$started; finishedUtc=[DateTimeOffset]::UtcNow.ToString('O'); outputDirectory=$destination
    status=$(if ($allMatched -and $records.Count -eq 19) { 'ALL_19_EXPECTED_BYTES_CAPTURED' } else { 'PARTIAL_RETAIN_REQUIRES_REVIEW' })
    expectedFiles=19; files=$records; historicalManagedAssemblyExecutionEstablished=$false
    experimentExecuted=$false; serviceChanged=$false; keysReadOrChanged=$false; aclChanged=$false
    evidenceAuthority='NONE'; securityAccepted=$false; productionAccepted=$false
}
$index=Join-Path $destination 'capture-index.json'
WriteNew $index ([Text.Encoding]::UTF8.GetBytes(($report | ConvertTo-Json -Depth 10 -Compress)))
[ordered]@{ indexPath=$index; indexSha256=(Get-FileHash -LiteralPath $index -Algorithm SHA256).Hash.ToLowerInvariant(); status=$report.status } | ConvertTo-Json -Compress
if (-not $allMatched) { exit 1 }
