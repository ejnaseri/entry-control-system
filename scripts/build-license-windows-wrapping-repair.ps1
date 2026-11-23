# Builds the inert LIC008 Software-KSP wrapping harness package; installs no service.
[CmdletBinding()]param()
Set-StrictMode -Version Latest;$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot;$source=Join-Path $repo 'licensing/windows-spike/wrapping-repair-control';$kit=Join-Path $repo 'licensing/windows-spike/wrapping-repair-kit';$output=Join-Path $repo ('out/lic008-wrapping-repair-'+[guid]::NewGuid().ToString('N'));$publish=Join-Path $output 'package';$null=New-Item -ItemType Directory -Path $output
Push-Location $source;try{if((&dotnet --version)-ne'10.0.400'){throw 'Exact SDK 10.0.400 required'};&dotnet publish Ecs.Lic008.WrappingV5.csproj -c Release -r win-x64 --self-contained true --artifacts-path (Join-Path $output 'artifacts') -o $publish -p:NuGetAudit=false --source (Join-Path $env:USERPROFILE '.nuget/packages');if($LASTEXITCODE-ne0){throw 'Publish failed'}}finally{Pop-Location}
& (Join-Path $publish 'Ecs.Lic008.WrappingV5.exe') --self-test;if($LASTEXITCODE-ne0){throw 'Pure guards failed'}
foreach($name in @('Run-Wrapping-Repair.ps1','README-fa.txt')){Copy-Item -LiteralPath (Join-Path $kit $name) -Destination (Join-Path $publish $name)}
$files=@(Get-ChildItem -LiteralPath $publish -File|Sort-Object Name|ForEach-Object{@{name=$_.Name;size=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName).Hash.ToLowerInvariant()}})
@{checklistId='LIC-6.2-008';scope='TEST_ONLY_SOFTWARE_KSP_WRAPPING_V5';version='0.12.0';sdk='10.0.400';runtime='10.0.11';files=$files}|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $publish 'package-manifest.json') -Encoding UTF8
& (Join-Path $PSScriptRoot 'test-license-windows-wrapping-repair.ps1') -PackageRoot $publish
$archive=Join-Path $output 'licensing-windows-wrapping-0.12.0.zip';Compress-Archive -LiteralPath @(Get-ChildItem -LiteralPath $publish -File|ForEach-Object FullName) -DestinationPath $archive -CompressionLevel Optimal;$hash=(Get-FileHash -LiteralPath $archive).Hash.ToLowerInvariant();[IO.File]::WriteAllText(($archive+'.sha256'),$hash+"`n",(New-Object Text.UTF8Encoding($false)));Write-Output ('Artifact: '+$archive);Write-Output ('SHA256: '+$hash)
