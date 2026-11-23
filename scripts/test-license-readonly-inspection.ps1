# Pure guards only: never calls native code with a valid key name.
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$repo=Split-Path -Parent $PSScriptRoot
$tokens=$null; $errors=$null
$null=[Management.Automation.Language.Parser]::ParseFile((Join-Path $repo 'licensing/windows-spike/kit/Inspect-Existing.ps1'),[ref]$tokens,[ref]$errors)
if ($errors.Count) { throw 'Inspector parse failed' }
Add-Type -Path (Join-Path $repo 'licensing/windows-spike/kit/ReadOnlyProbe.cs')
$id='1e84b1df521a4ac486b7a47ba553a530'
foreach ($provider in @('software','tpm')) {
    if (-not [EcsLic008ReadOnlyProbe]::ValidName($provider,('Ecs.Lic008.TEST_ONLY.'+$provider+'.'+$id))) { throw 'Valid name rejected' }
}
$invalid=@(
    @('tpm','EntryControlSystem.License'),
    @('tpm',('Ecs.Lic008.TEST_ONLY.software.'+$id)),
    @('software',('Ecs.Lic008.TEST_ONLY.tpm.'+$id)),
    @('tpm','Ecs.Lic008.TEST_ONLY.tpm.../x'),
    @('tpm',('Ecs.Lic008.TEST_ONLY.tpm.'+$id+'.extra')),
    @('other',('Ecs.Lic008.TEST_ONLY.other.'+$id))
)
foreach ($pair in $invalid) {
    if ([EcsLic008ReadOnlyProbe]::ValidName($pair[0],$pair[1])) { throw 'Invalid name accepted' }
    $rejected=$false
    try { $null=[EcsLic008ReadOnlyProbe]::Inspect($pair[0],$pair[1]) } catch { $rejected=$true }
    if (-not $rejected) { throw 'Invalid native lookup permitted' }
}
Write-Output 'PASS: inspector parse/compile, two exact names, six pre-native rejection cases; no provider or key opened.'
