[CmdletBinding()]
param([switch]$ValidateOnly)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Fixed, hash-pinned metadata only. Never execute packaged binaries/controllers.
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$indexHash = 'b3fb32ac723c72f5d45f82fa858fe1d5224fa1586b1a83a78a0720bdcaf21ea6'
$targets = @{
    v4 = @{ Root='C:\ProgramData\Ecs.Lic008.WrappingV4'; Package='out/lic008-wrapping-reboot-bffb66e7921f44f2a27bcc15c9daf699/package'; Version='0.11.0'; Manifest='046c3352f6937578b2ecaac65fd1afeac522131012d619398a01b0a102f18cd8'; Exe='1dded83a70b8ea956b984adf0c3f0c67916e1a11d31aa3c6a3368f91a146aef0'; Dll='b4b2ebff556cb25bb1622e1abb9f1172642991d1d5464a4a18a87af2ded7e007' }
    v5 = @{ Root='C:\ProgramData\Ecs.Lic008.WrappingV5'; Package='out/lic008-wrapping-repair-262288ab49c14745a0f4f05c5f653a06/package'; Version='0.12.0'; Manifest='aa4b776de01e5008db2a025e79390bb99f14b314605d64ac6b1a700205aa712c'; Exe='ff9cc0ad421238f2e0a94e9632c8450d7c14a5d5d4c44a755c6af33f3e2e2663'; Dll='f70d65086129046597169ff3645860aef11acad6ae32fbc0d09a8fee76261b44' }
}
function Require([bool]$Condition, [string]$Reason) { if (-not $Condition) { throw $Reason } }
function Plain([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        $item = Get-Item -LiteralPath $cursor -Force
        Require (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) 'Linked path refused'
        $parent = [IO.Path]::GetDirectoryName($cursor)
        if ($parent -eq $cursor) { break }; $cursor = $parent
    }
}
function Snapshot([string]$Path) {
    Plain $Path
    Require (-not (Get-Item -LiteralPath $Path -Force).PSIsContainer) 'Regular file required'
    $stream = [IO.File]::Open($Path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
    try {
        Require ($stream.Length -gt 0 -and $stream.Length -le 1048576) 'Size cap exceeded'
        $bytes = New-Object byte[] ([int]$stream.Length)
        $offset = 0
        while ($offset -lt $bytes.Length) {
            $count = $stream.Read($bytes,$offset,$bytes.Length-$offset)
            Require ($count -gt 0) 'Incomplete snapshot'; $offset += $count
        }
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $hash = [BitConverter]::ToString($sha.ComputeHash($bytes)).Replace('-','').ToLowerInvariant() }
        finally { $sha.Dispose() }
        return @{ Bytes=$bytes; Hash=$hash }
    } finally { $stream.Dispose() }
}
function Parse($Snapshot) {
    $utf8 = New-Object Text.UTF8Encoding($false,$true)
    $utf8.GetString($Snapshot.Bytes).TrimStart([char]0xfeff) | ConvertFrom-Json
}
function Reference($Row) {
    Require ($Row.namespace -cin @('v4','v5')) 'Namespace refused'
    Require ($Row.relative -cmatch '^(app|guardian|setup)-reports/[a-f0-9]{32}\.json$') 'Reference refused'
    Require ($Row.sha256 -cmatch '^[a-f0-9]{64}$' -and $Row.experimentId -cmatch '^[a-f0-9]{32}$') 'Invalid pin'
}
function CheckRecord($Record,$Row) {
    Reference $Row
    $role = $Row.relative.Split('/')[0].Replace('-reports','')
    $run = [IO.Path]::GetFileNameWithoutExtension($Row.relative)
    Require ($Record.schemaVersion -eq 1 -and $Record.checklistId -ceq 'LIC-6.2-008' -and $Record.scope -ceq ('TEST_ONLY_SOFTWARE_KSP_WRAPPING_' + $Row.namespace.ToUpperInvariant())) 'Report identity refused'
    Require ($Record.role -ceq $role -and $Record.runId -ceq $run -and $Record.experimentId -ceq $Row.experimentId) 'Report reference mismatch'
    Require ($Record.securityAccepted -is [bool] -and $Record.securityAccepted -eq $false -and $Record.productionAccepted -is [bool] -and $Record.productionAccepted -eq $false -and $Record.serviceIdentityMatched -eq $true) 'Acceptance/identity refused'
    Require ($Record.binarySha256 -cmatch '^[a-f0-9]{64}$' -and $Record.runtime -cmatch '^\d+\.\d+\.\d+(?:\.\d+)?$' -and $Record.osVersion -cmatch '^\d+\.\d+\.\d+\.\d+$') 'Metadata format refused'
    $allowedActions = switch ($role) { 'setup' { @('create','cleanup') }; 'guardian' { @('verify') }; 'app' { @('probe') } }
    Require ($Record.action -cin $allowedActions) 'Action refused'
}
Require ($workspace -ieq 'E:\EntryControlSystem') 'Unexpected workspace'
$indexSnapshot = Snapshot (Join-Path $workspace 'docs/licensing/evidence/adapter-entry-claim-bindings-v2.json')
Require ($indexSnapshot.Hash -ceq $indexHash) 'Index pin mismatch'
$index = Parse $indexSnapshot
Require ($index.revision -ceq '0.2' -and @($index.reports).Count -eq 14) 'Index identity mismatch'
$seen = @{}
foreach ($row in $index.reports) {
    Reference $row
    $key = $row.namespace + '/' + $row.relative
    Require (-not $seen.ContainsKey($key)) 'Duplicate reference'; $seen[$key] = $true
}
if ($ValidateOnly) {
    $row = $index.reports[0]
    $fixture = [pscustomobject]@{schemaVersion=1;checklistId='LIC-6.2-008';scope='TEST_ONLY_SOFTWARE_KSP_WRAPPING_V4';role='app';runId=[IO.Path]::GetFileNameWithoutExtension($row.relative);experimentId=$row.experimentId;securityAccepted=$false;productionAccepted=$false;serviceIdentityMatched=$true;binarySha256=$targets.v4.Exe;runtime='10.0.11';osVersion='10.0.22000.0';action='probe'}
    CheckRecord $fixture $row
    $refused = 0
    foreach ($name in @('../plan.json','shared/ownership.json','app-reports/unknown.json','app-reports\aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.json')) {
        try { Reference ([pscustomobject]@{namespace='v4';relative=$name;sha256=$row.sha256;experimentId=$row.experimentId}) } catch { $refused++; continue }
        throw 'Unsafe reference accepted'
    }
    foreach ($change in @(@{Name='role';Value='setup'},@{Name='securityAccepted';Value=$true},@{Name='binarySha256';Value='bad'},@{Name='action';Value='repair'},@{Name='runtime';Value='exception-text'},@{Name='experimentId';Value=('0'*32)},@{Name='action';Value='create'})) {
        $copy = $fixture | ConvertTo-Json | ConvertFrom-Json
        $copy.($change.Name) = $change.Value
        try { CheckRecord $copy $row } catch { $refused++; continue }
        throw 'Corrupt metadata accepted'
    }
    $guardianRow = $index.reports | Where-Object { $_.namespace -ceq 'v4' -and $_.relative.StartsWith('guardian-reports/') } | Select-Object -First 1
    $guardianFixture = $fixture | ConvertTo-Json | ConvertFrom-Json
    $guardianFixture.role = 'guardian'; $guardianFixture.action = 'verify'
    $guardianFixture.runId = [IO.Path]::GetFileNameWithoutExtension($guardianRow.relative)
    CheckRecord $guardianFixture $guardianRow
    Require ($refused -eq 11) 'Refusal test mismatch'
    Write-Output 'PASS: 14 pinned role references, valid App/Guardian metadata fixtures, eleven invalid reference/metadata refusals. No protected reads or output writes.'
    return
}
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
Require ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) 'Use elevated PowerShell only after reviewing the fixed read-only plan'
$outputRoot = Join-Path $workspace 'out'; Plain $outputRoot
$packages = @{}
foreach ($id in @('v4','v5')) {
    $target = $targets[$id]; $dir = Join-Path $workspace $target.Package
    $manifest = Snapshot (Join-Path $dir 'package-manifest.json')
    Require ($manifest.Hash -ceq $target.Manifest) 'Package manifest pin mismatch'
    $parsed = Parse $manifest
    Require ($parsed.version -ceq $target.Version -and $parsed.scope -ceq ('TEST_ONLY_SOFTWARE_KSP_WRAPPING_' + $id.ToUpperInvariant())) 'Package scope mismatch'
    $stem = 'Ecs.Lic008.Wrapping' + $id.ToUpperInvariant()
    $exe = Snapshot (Join-Path $dir ($stem + '.exe')); $dll = Snapshot (Join-Path $dir ($stem + '.dll'))
    Require ($exe.Hash -ceq $target.Exe -and $dll.Hash -ceq $target.Dll) 'Local artifact pin mismatch'
    $packages[$id] = [pscustomobject]@{manifestSha256=$manifest.Hash;exeSha256=$exe.Hash;localManagedAssemblySha256=$dll.Hash;version=$target.Version}
}
$results = @(foreach ($row in $index.reports) {
    try {
        $target = $targets[$row.namespace]
        $path = [IO.Path]::GetFullPath((Join-Path $target.Root $row.relative))
        Require ($path.StartsWith($target.Root+'\',[StringComparison]::OrdinalIgnoreCase)) 'Root escape refused'
        $snapshot = Snapshot $path
        Require ($snapshot.Hash -ceq $row.sha256) 'Original role report hash mismatch'
        $record = Parse $snapshot; CheckRecord $record $row
        [pscustomobject]@{id=$row.id;status='HASH_BOUND_METADATA_READ';reportSha256=$snapshot.Hash;binarySha256=$record.binarySha256;matchesLocalExe=($record.binarySha256 -ceq $targets[$row.namespace].Exe);runtime=$record.runtime;osVersion=$record.osVersion;role=$record.role;action=$record.action;experimentId=$record.experimentId;managedAssemblyBinding='NOT_RECORDED_IN_V4_V5_REPORT';sourceBinaryEquivalence='NOT_ESTABLISHED'}
    } catch {
        # Do not expose provider strings, file contents, ownership or private errors.
        [pscustomobject]@{id=$row.id;status='STOPPED_FOR_REVIEW'}
    }
})
$allMatched = @($results | Where-Object {$_.status -ne 'HASH_BOUND_METADATA_READ' -or -not $_.matchesLocalExe}).Count -eq 0
$report = [ordered]@{schemaVersion=1;scope='READ_ONLY_ROLE_REPORT_ARTIFACT_METADATA';timeUtc=[DateTime]::UtcNow.ToString('o');collectorSha256=(Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant();indexSha256=$indexHash;localPackages=$packages;results=$results;allReportExeHashesMatch=$allMatched;managedAssemblyExecutionBound=$false;sourceBinaryEquivalence='NOT_ESTABLISHED';securityAccepted=$false;productionAccepted=$false}
$encoded = [Text.Encoding]::UTF8.GetBytes(($report | ConvertTo-Json -Depth 8))
$outputPath = Join-Path $outputRoot ('lic008-report-artifact-bindings-' + [guid]::NewGuid().ToString('N') + '.json')
$stream = [IO.File]::Open($outputPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try {$stream.Write($encoded,0,$encoded.Length);$stream.Flush($true)} finally {$stream.Dispose()}
Write-Output "Report: $outputPath"
