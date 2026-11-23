# LIC-6.2-008: command/path/package guard tests, never installs services or keys.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$PackageRoot)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$manager = Join-Path $repo 'licensing/windows-spike/kit/Manage-Spike.ps1'
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($manager,[ref]$tokens,[ref]$errors)
if ($errors.Count) { throw 'Manager parse failed' }
# Load only these pure/read-only function definitions, not the manager entrypoint.
foreach ($functionName in @('ConvertTo-NativeArgument','Assert-PlainPath','Check-Package')) {
    $definition = $ast.Find({ param($node) $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $functionName }, $true)
    Invoke-Expression $definition.Extent.Text
}
$count = 0
function Must-Reject([scriptblock]$Check) {
    $rejected = $false
    try { & $Check | Out-Null } catch { $rejected = $true }
    if (-not $rejected) { throw 'Expected rejection was not observed' }
    $script:count++
}
$null = Check-Package $PackageRoot
$count++
$exe = Join-Path $PackageRoot 'Ecs.Lic008.Spike.exe'
& $exe --self-test
if ($LASTEXITCODE) { throw 'Pure executable guard tests failed' }
$count++
& $exe --service arbitrary
if ($LASTEXITCODE -ne 2) { throw 'Unknown role accepted' }
$count++
& $exe --child guardian
if ($LASTEXITCODE -ne 2) { throw 'Guardian child accepted' }
$count++
& $exe --unrecognized
if ($LASTEXITCODE -ne 2) { throw 'Unknown command accepted' }
$count++
foreach ($refusedArguments in @('--service guardian','--child app')) {
    $refusedStart = New-Object Diagnostics.ProcessStartInfo
    $refusedStart.FileName = $exe
    $refusedStart.Arguments = $refusedArguments
    $refusedStart.UseShellExecute = $false
    $refusedStart.CreateNoWindow = $true
    $refusedStart.RedirectStandardError = $true
    $refusedProcess = [Diagnostics.Process]::Start($refusedStart)
    $null = $refusedProcess.StandardError.ReadToEnd()
    $refusedProcess.WaitForExit()
    if ($refusedProcess.ExitCode -notin @(1,3)) { throw 'Interactive identity was not refused before key access' }
    $refusedProcess.Dispose()
    $count++
}
$arguments = @('--test-arguments', '', 'a b', 'فارسی', '"C:\Program Files\Test\app.exe" --service guardian', 'trailing\', 'x\"y', 'a&b', '$()')
$start = New-Object Diagnostics.ProcessStartInfo
$start.FileName = $exe
$start.Arguments = (($arguments | ForEach-Object { ConvertTo-NativeArgument $_ }) -join ' ')
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.RedirectStandardOutput = $true
$start.StandardOutputEncoding = New-Object System.Text.UTF8Encoding($false)
$process = [Diagnostics.Process]::Start($start)
$stdout = $process.StandardOutput.ReadToEnd()
$process.WaitForExit()
if ($process.ExitCode -ne 0) { throw 'Argument child failed' }
$process.Dispose()
$received = $stdout | ConvertFrom-Json
if ($received.Count -ne $arguments.Count-1) { throw 'Argument count mismatch' }
for ($i=0;$i -lt $received.Count;$i++) { if ($received[$i] -cne $arguments[$i+1]) { throw 'Native argument quoting mismatch' } }
$count++
$fixture = Join-Path $repo ('out/lic008-guard-fixture-' + [Guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Directory -Path $fixture
$utf8 = New-Object System.Text.UTF8Encoding($false)
foreach ($name in @('Ecs.Lic008.Spike.exe','Manage-Spike.ps1')) { [IO.File]::WriteAllText((Join-Path $fixture $name), 'TEST_ONLY_INERT_TEXT', $utf8) }
$entries = @(Get-ChildItem -LiteralPath $fixture -File | ForEach-Object { @{name=$_.Name;size=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()} })
$manifest = @{checklistId='LIC-6.2-008';scope='TEST_ONLY_SERVICE_HARNESS';files=$entries}
$manifestPath = Join-Path $fixture 'package-manifest.json'
function Save-Fixture { $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8 }
Save-Fixture
$null = Check-Package $fixture
$count++
$manifest.scope='PRODUCTION'; Save-Fixture
Must-Reject { Check-Package $fixture }
$manifest.scope='TEST_ONLY_SERVICE_HARNESS'
$manifest.files=@($entries[0],$entries[0]); Save-Fixture
Must-Reject { Check-Package $fixture }
$manifest.files=$entries
$originalName=$entries[0].name
$entries[0].name='../escape.exe'; Save-Fixture
Must-Reject { Check-Package $fixture }
$entries[0].name='Ecs.Lic008.Spike.exe:payload'; Save-Fixture
Must-Reject { Check-Package $fixture }
$entries[0].name=$originalName
$originalHash=$entries[0].sha256
$entries[0].sha256=('0'*64); Save-Fixture
Must-Reject { Check-Package $fixture }
$entries[0].sha256=$originalHash; Save-Fixture
[IO.File]::WriteAllText((Join-Path $fixture 'extra.txt'), 'unexpected', $utf8)
Must-Reject { Check-Package $fixture }
$junction = Join-Path (Split-Path -Parent $fixture) ('lic008-guard-link-' + [Guid]::NewGuid().ToString('N'))
$null = New-Item -ItemType Junction -Path $junction -Target $fixture
Must-Reject { Assert-PlainPath $junction }
Write-Output ("PASS: $count harness checks; fixture files/junction retained only under out/. No service or key mutation.")
