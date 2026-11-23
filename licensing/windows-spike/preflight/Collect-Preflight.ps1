# LIC-6.2-008 preparation only. No provider/security acceptance claim.
# Compatible with inbox Windows PowerShell 5.1; writes only a new report folder.
[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Read-Probe {
    param([scriptblock]$Query)
    try {
        $value = & $Query
        return [ordered]@{ status = 'OBSERVED'; data = $value }
    } catch {
        # Do not serialize exception messages, paths, machine/user names or CIM objects.
        return [ordered]@{ status = 'UNKNOWN'; errorType = $_.Exception.GetType().Name }
    }
}

$report = [ordered]@{
    schemaVersion = 1
    toolVersion = '0.1.0'
    checklistId = 'LIC-6.2-008'
    scope = 'READ_ONLY_INVENTORY_NOT_ACCEPTANCE'
    collectedAtUtc = [DateTime]::UtcNow.ToString('o')
    scriptSha256 = (Get-FileHash -LiteralPath $PSCommandPath -Algorithm SHA256).Hash.ToLowerInvariant()
    powershellVersion = $PSVersionTable.PSVersion.ToString()
    process64Bit = [Environment]::Is64BitProcess
    elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

$report.os = Read-Probe {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -OperationTimeoutSec 15
    [ordered]@{ caption = $os.Caption; version = $os.Version; build = $os.BuildNumber; architecture = $os.OSArchitecture; productType = [int]$os.ProductType }
}
$report.hardware = Read-Probe {
    $computer = Get-CimInstance -ClassName Win32_ComputerSystem -OperationTimeoutSec 15
    $processors = @(Get-CimInstance -ClassName Win32_Processor -OperationTimeoutSec 15)
    [ordered]@{
        ramGiB = [Math]::Round($computer.TotalPhysicalMemory / 1GB, 2)
        processors = @($processors | ForEach-Object {
            [ordered]@{ name = $_.Name; architectureCode = [int]$_.Architecture; cores = $_.NumberOfCores; logicalProcessors = $_.NumberOfLogicalProcessors }
        })
    }
}
$report.systemVolume = Read-Probe {
    $volume = Get-CimInstance -ClassName Win32_LogicalDisk -Filter "DeviceID='$env:SystemDrive'" -OperationTimeoutSec 15
    if ($null -eq $volume) { throw 'System volume unavailable' }
    [ordered]@{ fileSystem = $volume.FileSystem; sizeGiB = [Math]::Round($volume.Size / 1GB, 2); freeGiB = [Math]::Round($volume.FreeSpace / 1GB, 2) }
}
$report.tpm = Read-Probe {
    $instances = @(Get-CimInstance -Namespace 'root/CIMV2/Security/MicrosoftTpm' -ClassName Win32_Tpm -OperationTimeoutSec 15)
    if ($instances.Count -eq 0) {
        [ordered]@{ observation = 'NO_INSTANCE_REPORTED'; physicalAbsenceProven = $false }
    } else {
        $tpm = $instances[0]
        [ordered]@{ observation = 'INSTANCE_REPORTED'; specVersion = $tpm.SpecVersion; enabledInitial = $tpm.IsEnabled_InitialValue; activatedInitial = $tpm.IsActivated_InitialValue; ownedInitial = $tpm.IsOwned_InitialValue }
    }
}

# This is a platform candidate check, never a security/provider PASS.
$report.platformCandidate = 'UNKNOWN'
if ($report.os.status -eq 'OBSERVED' -and $report.hardware.status -eq 'OBSERVED') {
    $osData = $report.os.data
    $cpuData = @($report.hardware.data.processors)
    $x64 = $cpuData.Count -gt 0 -and @($cpuData | Where-Object { $_.architectureCode -ne 9 }).Count -eq 0
    $version = [version]$osData.version
    if ($osData.productType -eq 1 -and $version.Major -eq 10 -and [int]$osData.build -ge 10240 -and $x64 -and [Environment]::Is64BitOperatingSystem) {
        $report.platformCandidate = 'WINDOWS_10_11_X64_CANDIDATE_ONLY'
    } else {
        $report.platformCandidate = 'OUTSIDE_V1_PLATFORM'
    }
}
$report.notTested = @('CNG_KEY_CREATION_AND_ACL', 'TPM_WRAPPING_AND_ATTESTATION', 'DPAPI_NG_SERVICE_SID', 'APP_CHILD_TOKEN_ISOLATION', 'REPAIR_REINSTALL_REBOOT_CONTINUITY', 'TPM_NV', 'NATIVE_FILE_SAFETY', 'PROTECTED_STORE_DURABILITY')

# Every run has its own directory; never overwrite another run or remove files.
$runName = 'report-' + [DateTime]::UtcNow.ToString('yyyyMMdd-HHmmss') + '-' + [Guid]::NewGuid().ToString('N')
$reportDirectory = Join-Path $PSScriptRoot $runName
$null = New-Item -ItemType Directory -Path $reportDirectory
$jsonPath = Join-Path $reportDirectory 'preflight.json'
$utf8 = New-Object System.Text.UTF8Encoding($false)
[IO.File]::WriteAllText($jsonPath, ($report | ConvertTo-Json -Depth 10), $utf8)
$summary = @(
    'LIC-6.2-008 preflight inventory 0.1.0',
    ('Platform: ' + $report.platformCandidate),
    ('OS query: ' + $report.os.status),
    ('Hardware query: ' + $report.hardware.status),
    ('System volume query: ' + $report.systemVolume.status),
    ('TPM query: ' + $report.tpm.status),
    'UNKNOWN means unreadable/unavailable, not absent or failed security.',
    'This report is NOT a licensing, TPM, CNG, ACL or storage acceptance result.',
    'No services, keys, ACLs, registry settings, TPM settings or application data were changed.',
    'Only this new report directory was written. Send preflight.json for review.'
)
[IO.File]::WriteAllLines((Join-Path $reportDirectory 'summary.txt'), $summary, $utf8)
Write-Host ($summary -join [Environment]::NewLine)
Write-Host ('Report folder: ' + $reportDirectory)
