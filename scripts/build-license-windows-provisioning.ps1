# LIC-6.2-008 test-only self-contained package. No service/key operation.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repo 'licensing/windows-spike/provisioning'
$kit = Join-Path $repo 'licensing/windows-spike/provisioning-kit'
$output = Join-Path $repo ('out/lic008-provisioning-' + [Guid]::NewGuid().ToString('N'))
$publish = Join-Path $output 'package'
$null = New-Item -ItemType Directory -Path $output
Push-Location $source
try {
    if ((& dotnet --version) -ne '10.0.400') { throw 'Exact SDK 10.0.400 required.' }
    & dotnet publish Ecs.Lic008.ProvisioningV1.csproj -c Release -r win-x64 --self-contained true --artifacts-path (Join-Path $output 'artifacts') -o $publish
    if ($LASTEXITCODE -ne 0) { throw 'Publish failed.' }
} finally { Pop-Location }
$runtime = Get-Content -LiteralPath (Join-Path $publish 'Ecs.Lic008.ProvisioningV1.runtimeconfig.json') -Raw | ConvertFrom-Json
if (@($runtime.runtimeOptions.includedFrameworks | Where-Object { $_.name -eq 'Microsoft.NETCore.App' -and $_.version -eq '10.0.11' }).Count -ne 1) { throw 'Unexpected runtime baseline.' }
& (Join-Path $publish 'Ecs.Lic008.ProvisioningV1.exe') --self-test
if ($LASTEXITCODE -ne 0) { throw 'Pure guard tests failed.' }
$kitFiles = @('Manage-Spike.ps1','01-Install-And-Test.cmd','02-Recheck.cmd','03-Cleanup.cmd','04-Status.cmd','README-fa.txt')
foreach ($name in $kitFiles) { Copy-Item -LiteralPath (Join-Path $kit $name) -Destination (Join-Path $publish $name) }
$files = @(Get-ChildItem -LiteralPath $publish -File | Sort-Object Name | ForEach-Object {
    @{ name=$_.Name; size=$_.Length; sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
})
$manifest = @{ checklistId='LIC-6.2-008'; scope='TEST_ONLY_PROVISIONING_V1'; version='0.3.0'; sdk='10.0.400'; runtime='10.0.11'; files=$files }
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $publish 'package-manifest.json') -Encoding UTF8
& (Join-Path $PSScriptRoot 'test-license-windows-provisioning.ps1') -PackageRoot $publish
$archive = Join-Path $output 'licensing-windows-provisioning-0.3.0.zip'
Compress-Archive -LiteralPath @(Get-ChildItem -LiteralPath $publish -File | ForEach-Object FullName) -DestinationPath $archive -CompressionLevel Optimal
$hash = (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText(($archive + '.sha256'), $hash + "`n", (New-Object System.Text.UTF8Encoding($false)))
Write-Output ('Artifact: ' + $archive)
Write-Output ('SHA256: ' + $hash)
