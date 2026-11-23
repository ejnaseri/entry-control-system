# Executes an isolated copy with synthetic report/service fixtures; no real installation access.
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$fixture = Join-Path $repo ('out/diagnostics-test-' + [Guid]::NewGuid().ToString('N'))
$kit = Join-Path $fixture 'kit'
$sourceRoot = Join-Path $fixture 'source'
$null = New-Item -ItemType Directory -Path $kit,(Join-Path $sourceRoot 'guardian-reports'),(Join-Path $sourceRoot 'app-reports')
$script = Get-Content -LiteralPath (Join-Path $repo 'licensing/windows-spike/kit/Export-Diagnostics.ps1') -Raw
$tokens=$null; $errors=$null
$null = [Management.Automation.Language.Parser]::ParseInput($script,[ref]$tokens,[ref]$errors)
if ($errors.Count) { throw 'Parser failure' }
# Substitute only environment boundaries. Export parsing, allowlisting and path checks remain production code.
$lines = $script -split '\r?\n'
$lines = @($lines | Where-Object { -not $_.StartsWith('if (-not ([Security.Principal.WindowsPrincipal]') })
$lines = @($lines | ForEach-Object {
    if ($_.StartsWith('$sourceRoot =')) { '$sourceRoot = ''' + $sourceRoot.Replace("'","''") + "'" } else { $_ }
})
$script = ($lines -join "`r`n") -replace '\$services = @\(\)', 'function Get-Service { param($Name,$ErrorAction) [pscustomobject]@{Status="Stopped"} }; $services = @()'
$copy = Join-Path $kit 'Export-Diagnostics.ps1'
[IO.File]::WriteAllText($copy,$script)
$id = 'c5b05c410d644d188579fa35b119d586'
$reportPath = Join-Path $sourceRoot ('guardian-reports/' + $id + '.json')
$report = @{checklistId='LIC-6.2-008';role='guardian';runId=$id;action='cleanup';runtime='10.0.11';serviceIdentityMatched=$true;timeUtc='2026-09-19T11:30:23Z';privateCanary='MUST_NOT_EXPORT';results=@(@{Id='guardian.tpm.cleanup';Status='FAILED_OR_UNAVAILABLE';Error='CryptographicException:0x80090010'})}
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $reportPath -Encoding UTF8
& $copy
$output = @(Get-ChildItem -LiteralPath $fixture -Filter 'lic008-diagnostics-*.json')
if ($output.Count -ne 1) { throw 'Expected one export' }
$text = Get-Content -LiteralPath $output[0].FullName -Raw
$result = $text | ConvertFrom-Json
if ($text.Contains('MUST_NOT_EXPORT') -or $result.reports.Count -ne 1 -or $result.services.Count -ne 2 -or $result.reports[0].results[0].Error -ne 'CryptographicException:0x80090010') { throw 'Export mismatch' }
$report.role='app'
$report | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $reportPath -Encoding UTF8
$rejected=$false
try { & $copy } catch { $rejected=$true }
if (-not $rejected) { throw 'Mismatched identity accepted' }
if (@(Get-ChildItem -LiteralPath $fixture -Filter 'lic008-diagnostics-*.json').Count -ne 1) { throw 'Failed export created output' }
Write-Output 'PASS: legacy report export, field selection, exact errors, service fixture, identity rejection and no output on failure.'
