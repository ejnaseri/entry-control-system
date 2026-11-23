# Read-only follow-up for the fixed LIC008 baseline run. No key/service/ACL mutation.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$baseline = Join-Path $repo 'out/lic008-physical-418bd43cb580427085c1535057456332/run-27ef5ffb1caf4a42a8d8ef431d91d579.json'
function Assert-Plain([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        if (Test-Path -LiteralPath $cursor) {
            if (((Get-Item -LiteralPath $cursor -Force).Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw 'Linked path refused' }
        }
        $cursor = Split-Path -Parent $cursor
    }
}
Assert-Plain $baseline
if ((Get-FileHash -LiteralPath $baseline).Hash -ne '4DD789DE10BB76DDA733A52D43A728C0AE48B1A5C02F85A5C144CED867B97E93') { throw 'Baseline digest mismatch' }
$report = Get-Content -LiteralPath $baseline -Raw | ConvertFrom-Json
if ($report.runId -ne '27ef5ffb1caf4a42a8d8ef431d91d579') { throw 'Wrong baseline run' }
$directoryRows = @(foreach ($path in @('C:\ProgramData\Microsoft\Crypto\Keys','C:\ProgramData\Microsoft\Crypto\SystemKeys','C:\ProgramData\Microsoft\Crypto\RSA\MachineKeys')) {
    try {
        Assert-Plain $path
        $acl = Get-Acl -LiteralPath $path
        @{path=$path;status='OBSERVED';sddl=$acl.Sddl;protected=$acl.AreAccessRulesProtected}
    } catch { @{path=$path;status='UNKNOWN';error=$_.Exception.GetType().Name} }
})
$start = ([datetime]::Parse($report.guardian.timeUtc)).ToUniversalTime().AddMinutes(-2)
$end = ([datetime]::Parse($report.app.timeUtc)).ToUniversalTime().AddMinutes(2)
$logRows = @(foreach ($name in @('Microsoft-Windows-CAPI2/Operational','Microsoft-Windows-Crypto-DPAPI/Operational')) {
    try {
        $log = Get-WinEvent -ListLog $name -ErrorAction Stop
        $events = @(); $query = 'NOT_QUERIED_DISABLED'
        if ($log.IsEnabled) {
            try {
                $events = @(Get-WinEvent -FilterHashtable @{LogName=$name;StartTime=$start;EndTime=$end} -MaxEvents 64 -ErrorAction Stop | ForEach-Object {
                    # No message/XML/payload, key name, host name or user fields.
                    @{id=$_.Id;recordId=$_.RecordId;utc=$_.TimeCreated.ToUniversalTime().ToString('o');processId=$_.ProcessId;level=$_.Level}
                })
                $query = 'BOUNDED_METADATA_ONLY'
            } catch { $query = if ($_.FullyQualifiedErrorId -like 'NoMatchingEventsFound*') {'NO_MATCHING_EVENTS'} else {'UNAVAILABLE'} }
        }
        @{name=$name;enabled=$log.IsEnabled;query=$query;events=$events;mayBeTruncated=($events.Count -eq 64)}
    } catch { @{name=$name;query='UNAVAILABLE';error=$_.Exception.GetType().Name} }
})
$services = @(foreach ($name in @('KeyIso','Ecs.Lic008.Spike.Guardian','Ecs.Lic008.Spike.App','Ecs.Lic008.ProvisioningV1.Guardian','Ecs.Lic008.ProvisioningV1.App')) {
    try {
        $s = Get-Service -Name $name
        @{name=$name;status=[string]$s.Status;startType=[string]$s.StartType}
    } catch { @{name=$name;status='UNKNOWN';error=$_.Exception.GetType().Name} }
})
$result = @{schemaVersion=1;scope='LIC008_READ_ONLY_ENVIRONMENT';baselineRunId=$report.runId;timeUtc=[datetime]::UtcNow.ToString('o');
    guardianSid=$report.guardian.token.UserSid;domainJoined=$report.domainJoined;osVersion=$report.osVersion;
    directories=$directoryRows;logs=$logRows;services=$services;
    limitations=@('NO_ACCESSCHECK_WITH_GUARDIAN_TOKEN','NO_FILE_OR_KEY_CONTENT_READ','NO_GLOBAL_KEY_ABSENCE_CLAIM','NO_LOGGING_ENABLEMENT','NO_ROOT_CAUSE_PROOF_FROM_MISSING_EVENTS')}
$destination = Join-Path $repo ('out/lic008-environment-'+[guid]::NewGuid().ToString('N')+'.json')
Assert-Plain (Split-Path -Parent $destination)
$bytes = [Text.Encoding]::UTF8.GetBytes(($result | ConvertTo-Json -Depth 8))
$stream = [IO.File]::Open($destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try {$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)} finally {$stream.Dispose()}
Write-Output $destination
