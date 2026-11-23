# LIC008 inert build only. Never execute the physical controller here.
[CmdletBinding()]param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$source=Join-Path $repo 'licensing/windows-spike/wrapping-reinstall-control'
$kitSource=Join-Path $repo 'licensing/windows-spike/wrapping-reinstall-kit'
$output=Join-Path $repo ('out/lic008-wrapping-reinstall-'+[guid]::NewGuid().ToString('N'))
$package=Join-Path $output 'package'
$publish=Join-Path $package 'BIN'
$null=New-Item -ItemType Directory -Path $publish
Push-Location $source
try{
  if((&dotnet --version) -cne '10.0.400'){throw 'Exact SDK 10.0.400 required'}
  &dotnet publish Ecs.Lic008.WrappingV7.csproj -c Release -r win-x64 --self-contained true --artifacts-path (Join-Path $output 'artifacts') -o $publish -p:NuGetAudit=false --source (Join-Path $env:USERPROFILE '.nuget/packages')
  if($LASTEXITCODE -ne 0){throw 'Publish failed'}
  $files=@(Get-ChildItem -LiteralPath $publish -File|Sort-Object Name|ForEach-Object{@{name=$_.Name;size=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName).Hash.ToLowerInvariant()}})
  @{schemaVersion=1;checklistId='LIC-6.2-008';scope='TEST_ONLY_SOFTWARE_KSP_WRAPPING_V7';version='0.14.0';sdk='10.0.400';runtime='10.0.11';files=$files}|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $publish 'package-manifest.json') -Encoding UTF8
}finally{Pop-Location}
foreach($name in @('Run-Wrapping-Reinstall.ps1','README-fa.txt')){Copy-Item -LiteralPath (Join-Path $kitSource $name) -Destination (Join-Path $package $name)}
$files=@(Get-ChildItem -LiteralPath $package -File -Recurse|Sort-Object FullName|ForEach-Object{@{name=$_.FullName.Substring($package.Length+1).Replace('\','/');size=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName).Hash.ToLowerInvariant()}})
@{schemaVersion=1;checklistId='LIC-6.2-008';scope='TEST_ONLY_SOFTWARE_KSP_WRAPPING_V7';version='0.14.0';files=$files}|ConvertTo-Json -Depth 6|Set-Content -LiteralPath (Join-Path $package 'reinstall-kit-manifest.json') -Encoding UTF8
& (Join-Path $PSScriptRoot 'test-license-windows-wrapping-reinstall.ps1') -PackageRoot $package
if(-not $?){throw 'Inert reinstall guards failed'}
$archive=Join-Path $output 'licensing-windows-wrapping-reinstall-0.14.0.zip'
Compress-Archive -LiteralPath @(Get-ChildItem -LiteralPath $package|ForEach-Object FullName) -DestinationPath $archive -CompressionLevel Optimal
$hash=(Get-FileHash -LiteralPath $archive).Hash.ToLowerInvariant()
[IO.File]::WriteAllText(($archive+'.sha256'),$hash+[Environment]::NewLine,(New-Object Text.UTF8Encoding($false)))
Write-Output ('Artifact: '+$archive)
Write-Output ('SHA256: '+$hash)
