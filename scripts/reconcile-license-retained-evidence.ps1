[CmdletBinding()]
param(
    [ValidatePattern('^lic008-retained-reconciliation-[a-f0-9]{32}\.json$')]
    [string]$OutputName = ('lic008-retained-reconciliation-' + [guid]::NewGuid().ToString('N') + '.json'),
    [switch]$ValidateOnly
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Fixed EV0152 inputs only. No controllers, CNG, SCM, ACL or protected-state writes.
$targets = @(
    @{ Id='v2'; Root='C:\ProgramData\Ecs.Lic008.WrappingV2'; Summary='wrapping-summary-7da3625af6f14f10b05b5bed5e1cf5be.json'; Hash='65f72549d6638f0d30488d5372bd2384f282853ab3daf79b260ddd1d18f164a1'; Size=1888; Checkpoint=$null; CheckpointHash=$null; CheckpointSize=0; Version=$null },
    @{ Id='v4'; Root='C:\ProgramData\Ecs.Lic008.WrappingV4'; Summary='wrapping-summary-47513d20e9864dcf84d40b8ace00b916.json'; Hash='ae8698b7e6459a3aa1c3fbee17f5c424c679aeb9d7f60f64ce5d4c4e11ee9a6a'; Size=4925; Checkpoint='reboot-checkpoint.json'; CheckpointHash='7417aae3163e3a35e0103303619844adcda021388c1816f02e8d288f10be62ea'; CheckpointSize=2404; Version='0.11.0' },
    @{ Id='v5'; Root='C:\ProgramData\Ecs.Lic008.WrappingV5'; Summary='wrapping-summary-de5efc93255841619c9f86f2570af292.json'; Hash='7a90250b5c520db757b27381b6cf995f90ce1486b03446d6314a8954de1734ef'; Size=5725; Checkpoint='repair-checkpoint.json'; CheckpointHash='adb4aa66402c671f50d21bbcdca84dc619341ffc5108ea1c7bdcd7fb20a7b1d8'; CheckpointSize=2265; Version='0.12.0' }
)
function Require([bool]$Condition, [string]$Reason) { if (-not $Condition) { throw $Reason } }
function Plain([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        $item = Get-Item -LiteralPath $cursor -Force
        Require (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) 'Reparse path refused'
        $parent = [IO.Path]::GetDirectoryName($cursor)
        if ($parent -eq $cursor) { break }; $cursor = $parent
    }
}
function Snapshot([string]$Path) {
    Plain $Path
    Require (-not (Get-Item -LiteralPath $Path -Force).PSIsContainer) 'Not a regular evidence file'
    $stream = [IO.File]::Open($Path, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::Read)
    try {
        Require ($stream.Length -gt 0 -and $stream.Length -le 1048576) 'Evidence size cap exceeded'
        $buffer = New-Object byte[] ([int]$stream.Length)
        $offset = 0
        while ($offset -lt $buffer.Length) {
            $read = $stream.Read($buffer, $offset, $buffer.Length - $offset)
            Require ($read -gt 0) 'Incomplete snapshot'; $offset += $read
        }
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $hash = [BitConverter]::ToString($sha.ComputeHash($buffer)).Replace('-', '').ToLowerInvariant() }
        finally { $sha.Dispose() }
        return @{ Bytes=$buffer; Hash=$hash; Size=$buffer.Length }
    } finally { $stream.Dispose() }
}
function Json($Snapshot) {
    # Parse the same bytes whose hash was checked, not a second file read.
    $utf8 = New-Object Text.UTF8Encoding($false, $true)
    return ($utf8.GetString($Snapshot.Bytes).TrimStart([char]0xfeff) | ConvertFrom-Json)
}
function Inventory($Rows) {
    Require (@($Rows).Count -gt 0 -and @($Rows).Count -le 32) 'Invalid reference count'
    $seen = @{}
    foreach ($row in @($Rows)) {
        $relative = $row.relative
        Require ($relative -is [string]) 'Reference is not a string'
        # Shared artifacts are hash-only; never parse keys/envelopes/state/ownership.
        Require ($relative -cmatch '^(?:(?:app-reports|guardian-reports|setup-reports)/[a-f0-9]{32}\.json|shared/(?:control-set|restricted-envelope|app-readable-envelope|app-readable-hash)\.json)$') 'Unauthorized evidence reference'
        Require ($row.sha256 -is [string] -and $row.sha256 -cmatch '^[a-f0-9]{64}$') 'Invalid reference digest'
        Require (-not $seen.ContainsKey($relative)) 'Duplicate evidence reference'
        $seen[$relative] = $true
    }
}
function Identity($Record, [string]$Scope) {
    Require ($Record.schemaVersion -eq 1 -and $Record.scope -ceq $Scope) 'Wrong report schema/scope'
    Require ($Record.experimentId -is [string] -and $Record.experimentId -cmatch '^[a-f0-9]{32}$') 'Invalid experiment ID'
    foreach ($flag in @('securityAccepted','productionAccepted','matrixAccepted')) {
        Require ($Record.$flag -is [bool] -and $Record.$flag -eq $false) 'Unexpected acceptance flag'
    }
}
if ($ValidateOnly) {
    Require ($targets.Count -eq 3) 'Wrong fixed target count'
    foreach ($target in $targets) { Require ($target.Hash -cmatch '^[a-f0-9]{64}$') 'Invalid fixed pin' }
    $digest = 'a' * 64
    Inventory @([pscustomobject]@{relative=('app-reports/' + ('b' * 32) + '.json');sha256=$digest}, [pscustomobject]@{relative='shared/control-set.json';sha256=$digest})
    $rejected = 0
    foreach ($bad in @('../plan.json','C:/plan.json','\\host\file.json','shared/private-key.json','shared/ownership.json','shared/../control-set.json','shared\control-set.json','Shared/control-set.json','app-reports/unknown.json')) {
        try { Inventory @([pscustomobject]@{relative=$bad;sha256=$digest}) } catch { $rejected++; continue }
        throw 'Unsafe reference accepted'
    }
    try { Inventory @([pscustomobject]@{relative='shared/control-set.json';sha256=$digest},[pscustomobject]@{relative='shared/control-set.json';sha256=$digest}) } catch { $rejected++ }
    Require ($rejected -eq 10) 'Reference refusal self-test failed'
    Write-Output 'PASS: three fixed summaries, two checkpoint pins, ten unsafe/duplicate reference refusals; no protected reads or writes.'
    return
}
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
Require ($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) 'Use elevated PowerShell; do not change ACLs'
$workspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Require ($workspace -ieq 'E:\EntryControlSystem') 'Unexpected workspace'
$outputRoot = Join-Path $workspace 'out'; Plain $outputRoot
Require ((Get-Item -LiteralPath $outputRoot).PSIsContainer) 'Output root not a directory'
$results = @(foreach ($target in $targets) {
    try {
        $scope = 'TEST_ONLY_SOFTWARE_KSP_WRAPPING_' + $target.Id.ToUpperInvariant()
        $snapshot = Snapshot (Join-Path $target.Root $target.Summary)
        Require ($snapshot.Hash -ceq $target.Hash -and $snapshot.Size -eq $target.Size) 'Original summary differs from EV0152 pin'
        $summary = Json $snapshot; Identity $summary $scope
        $hasRefs = $null -ne $summary.PSObject.Properties['evidenceFiles']
        if ($target.Id -eq 'v2') {
            Require (-not $hasRefs) 'Unexpected legacy schema; stop for review'
            [pscustomobject]@{ id=$target.Id; status='METADATA_BOUND_NO_REFERENCE_INVENTORY'; summarySha256=$snapshot.Hash; experimentId=$summary.experimentId; scope=$scope; referencedFiles=@(); fullReferenceReconciliation=$false }
            continue
        }
        Require ($summary.version -ceq $target.Version -and $hasRefs) 'Wrong summary version or missing inventory'
        $checkpointSnapshot = Snapshot (Join-Path $target.Root $target.Checkpoint)
        Require ($checkpointSnapshot.Hash -ceq $target.CheckpointHash -and $checkpointSnapshot.Size -eq $target.CheckpointSize) 'Checkpoint differs from EV0152 pin'
        Require ($summary.checkpointSha256 -ceq $checkpointSnapshot.Hash) 'Summary checkpoint binding mismatch'
        $checkpoint = Json $checkpointSnapshot; Identity $checkpoint $scope
        Require ($checkpoint.version -ceq $target.Version -and $checkpoint.experimentId -ceq $summary.experimentId) 'Checkpoint identity mismatch'
        # Validate both complete lists before opening any referenced file.
        Inventory $summary.evidenceFiles; Inventory $checkpoint.files
        $listed = @{}; foreach ($row in $summary.evidenceFiles) { $listed[$row.relative]=$row.sha256 }
        foreach ($row in $checkpoint.files) { Require ($listed.ContainsKey($row.relative) -and $listed[$row.relative] -ceq $row.sha256) 'Checkpoint evidence missing or changed in summary' }
        $observations = @{}
        if ($target.Id -eq 'v4') {
            Require ($summary.normalRebootPassed -eq $true -and $summary.machineIdentityMatched -eq $true) 'Unexpected reboot observation'
            Require ($summary.bootBeforeUtc -ceq $checkpoint.bootUtc -and $summary.preparedUtc -ceq $checkpoint.preparedUtc) 'Reboot timestamp binding mismatch'
            $before = [DateTimeOffset]::Parse($summary.bootBeforeUtc)
            $prepared = [DateTimeOffset]::Parse($summary.preparedUtc)
            $after = [DateTimeOffset]::Parse($summary.bootAfterUtc)
            Require ($before -lt $prepared -and $prepared -lt $after) 'Reboot chronology mismatch'
            $observations = @{normalRebootPassed=$true;machineIdentityMatched=$true;chronologyMatched=$true}
        } else {
            foreach ($flag in @('repairSimulationPassed','sameKeyIdentityVerified','sameEnvelopeBytesVerified','missingKeyRepairRefused')) {
                Require ($summary.$flag -is [bool] -and $summary.$flag -eq $true) 'Unexpected repair observation'
                $observations[$flag] = $true
            }
            Require ($summary.keyRecreationAttempted -is [bool] -and $summary.keyRecreationAttempted -eq $false -and $summary.productionRepairTested -is [bool] -and $summary.productionRepairTested -eq $false) 'Unexpected repair scope'
            Require ($summary.missingKeyProbeRunId -cmatch '^[a-f0-9]{32}$' -and $listed.ContainsKey('guardian-reports/' + $summary.missingKeyProbeRunId + '.json')) 'Missing-key report reference mismatch'
            $observations['missingKeyProbeRunId'] = $summary.missingKeyProbeRunId
            $observations['keyRecreationAttempted'] = $false
            $observations['productionRepairTested'] = $false
        }
        $files = @(foreach ($row in $summary.evidenceFiles) {
            $path = [IO.Path]::GetFullPath((Join-Path $target.Root $row.relative))
            Require ($path.StartsWith($target.Root + '\', [StringComparison]::OrdinalIgnoreCase)) 'Reference escaped fixed root'
            $evidence = Snapshot $path
            Require ($evidence.Hash -ceq $row.sha256) 'Referenced evidence hash mismatch'
            $role = $null; $statuses = @()
            if (-not $row.relative.StartsWith('shared/', [StringComparison]::Ordinal)) {
                $record = Json $evidence; $role = $row.relative.Split('/')[0].Replace('-reports','')
                $run = [IO.Path]::GetFileNameWithoutExtension($path)
                Require ($record.schemaVersion -eq 1 -and $record.scope -ceq $scope -and $record.checklistId -ceq 'LIC-6.2-008' -and $record.role -ceq $role -and $record.runId -ceq $run -and $record.experimentId -ceq $summary.experimentId) 'Role report identity mismatch'
                Require ($record.securityAccepted -is [bool] -and $record.securityAccepted -eq $false -and $record.productionAccepted -is [bool] -and $record.productionAccepted -eq $false -and $record.serviceIdentityMatched -eq $true -and $record.binarySha256 -cmatch '^[a-f0-9]{64}$') 'Unexpected role report acceptance/identity'
                Require (@($record.results).Count -le 128) 'Role result count cap'
                $statuses = @($record.results | ForEach-Object {
                    Require ($_.Id -cmatch '^[a-z0-9.-]{1,128}$' -and $_.Status -cmatch '^[A-Z_]{1,64}$') 'Invalid result metadata'
                    [pscustomobject]@{ id=$_.Id; status=$_.Status }
                })
            }
            [pscustomobject]@{relative=$row.relative;sha256=$evidence.Hash;bytes=$evidence.Size;role=$role;results=$statuses;hashMatched=$true}
        })
        [pscustomobject]@{ id=$target.Id; status='LISTED_REFERENCES_HASH_AND_ROLE_IDENTITY_MATCH'; scope=$scope; experimentId=$summary.experimentId; summarySha256=$snapshot.Hash; checkpointSha256=$checkpointSnapshot.Hash; checkpointReferenceCount=@($checkpoint.files).Count; observations=$observations; referencedFiles=$files; fullReferenceReconciliation=$true }
    } catch {
        # Stop this namespace; never repair/rerun or broaden its reference list.
        [pscustomobject]@{id=$target.Id;status='STOPPED_FOR_REVIEW';exceptionType=$_.Exception.GetType().FullName;reason=$_.Exception.Message}
    }
})
$report = [ordered]@{
    schemaVersion=1;scope='READ_ONLY_RETAINED_EVIDENCE_RECONCILIATION';timeUtc=[DateTime]::UtcNow.ToString('o')
    collectorSha256=(Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
    results=$results;fullEvidenceReconciled=$false;securityAccepted=$false;productionAccepted=$false
    limitations=@('V2_HAS_NO_REFERENCE_INVENTORY','NO_INDEPENDENT_SECURITY_ATTESTATION','SHARED_CONTENT_HASH_ONLY','NO_CURRENT_KEY_ACL_OR_BINARY_REMEASUREMENT','NO_HARNESS_RERUN')
}
$encoded = [Text.Encoding]::UTF8.GetBytes(($report | ConvertTo-Json -Depth 10))
$outputPath = Join-Path $outputRoot $OutputName
$output = [IO.File]::Open($outputPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::Read)
try { $output.Write($encoded,0,$encoded.Length);$output.Flush($true) } finally { $output.Dispose() }
Write-Output "Report: $outputPath"
