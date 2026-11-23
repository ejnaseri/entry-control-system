# LIC-6.2-008: explicit inventory-only package; never includes reports or app code.
[CmdletBinding()]
param()
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repository = Split-Path -Parent $PSScriptRoot
$source = Join-Path $repository 'licensing/windows-spike/preflight'
$files = @('Collect-Preflight.ps1', 'Run-Preflight.cmd', 'README-fa.txt')
$inputs = @($files | ForEach-Object { Join-Path $source $_ })
foreach ($inputFile in $inputs) {
    if (-not (Test-Path -LiteralPath $inputFile -PathType Leaf)) { throw 'Missing preflight source file' }
}
$outputDirectory = Join-Path $repository 'out'
if (-not (Test-Path -LiteralPath $outputDirectory)) { $null = New-Item -ItemType Directory -Path $outputDirectory }
$artifact = Join-Path $outputDirectory ('licensing-windows-preflight-0.1.0-' + [Guid]::NewGuid().ToString('N') + '.zip')
Compress-Archive -LiteralPath $inputs -DestinationPath $artifact -CompressionLevel Optimal
$manifest = [ordered]@{
    checklistId = 'LIC-6.2-008'
    scope = 'READ_ONLY_INVENTORY_NOT_ACCEPTANCE'
    archiveSha256 = (Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash.ToLowerInvariant()
    files = @($inputs | ForEach-Object {
        [ordered]@{ name = [IO.Path]::GetFileName($_); sha256 = (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant() }
    })
}
[IO.File]::WriteAllText(($artifact + '.manifest.json'), ($manifest | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding($false)))
Write-Output $artifact
