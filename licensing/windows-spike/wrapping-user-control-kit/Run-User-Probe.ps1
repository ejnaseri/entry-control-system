# Read-only CNG probe; run in normal (not Administrator) 64-bit PowerShell.
[CmdletBinding()]param()
Set-StrictMode -Version Latest;$ErrorActionPreference='Stop'
if(-not[Environment]::Is64BitProcess){throw 'Use 64-bit PowerShell'}
$identity=[Security.Principal.WindowsIdentity]::GetCurrent()
try{if(([Security.Principal.WindowsPrincipal]$identity).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)){throw 'Close this elevated window; use normal PowerShell'}}finally{$identity.Dispose()}
$root=Join-Path ([Environment]::GetFolderPath('CommonApplicationData')) 'Ecs.Lic008.WrappingV3'
$bin=Join-Path $root 'bin-0.10.1';$exe=Join-Path $bin 'Ecs.Lic008.WrappingV3.exe'
$prepared=Get-Content -LiteralPath (Join-Path $root 'prepared.json') -Raw|ConvertFrom-Json
if($prepared.version-cne'0.10.1'-or$prepared.scope-cne'TEST_ONLY_SOFTWARE_KSP_WRAPPING_V3'-or$prepared.installedBin-cne$bin){throw 'Wrong prepared continuation'}
$plan=Get-Content -LiteralPath (Join-Path $root 'plan.json') -Raw|ConvertFrom-Json
if($plan.Action-cne'probe-user'-or$plan.RunId-cne$prepared.runId-or$plan.ExperimentId-cne$prepared.experimentId-or$plan.OrdinaryUserSid-cne$prepared.userSid-or$plan.BinaryHash-cne$prepared.binaryHash-or$plan.BinaryHash-cne(Get-FileHash -LiteralPath $exe).Hash.ToLowerInvariant()){throw 'Probe plan/binary mismatch'}
$start=New-Object Diagnostics.ProcessStartInfo;$start.FileName=$exe;$start.Arguments='--interactive';$start.UseShellExecute=$false;$start.CreateNoWindow=$true;$start.RedirectStandardOutput=$true;$start.RedirectStandardError=$true
$p=[Diagnostics.Process]::Start($start)
try{
  $stdout=$p.StandardOutput.ReadToEndAsync();$stderr=$p.StandardError.ReadToEndAsync()
  if(-not$p.WaitForExit(60000)){$p.Kill();throw 'User probe timed out; retain state'}
  $raw=$stdout.GetAwaiter().GetResult();$err=$stderr.GetAwaiter().GetResult()
  if($raw){
    $report=$raw|ConvertFrom-Json
    $report.results|Format-Table Id,Status,Stage,Error -AutoSize|Out-Host
    $path=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) ('lic008-user-probe-'+[guid]::NewGuid().ToString('N')+'.json')
    $bytes=(New-Object Text.UTF8Encoding($false)).GetBytes($raw)
    $stream=[IO.File]::Open($path,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
    try{$stream.Write($bytes,0,$bytes.Length);$stream.Flush($true)}finally{$stream.Dispose()}
    Write-Host ('User report: '+$path)
  }
  if($p.ExitCode-ne0){throw ('User probe failed; retain state. '+$err)}
}finally{$p.Dispose()}
