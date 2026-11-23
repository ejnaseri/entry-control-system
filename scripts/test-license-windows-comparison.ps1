# LIC-6.2-008: command/path/package guard tests, never installs services or keys.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$PackageRoot)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$manager = Join-Path $repo 'licensing/windows-spike/comparison-kit/Manage-Spike.ps1'
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile($manager,[ref]$tokens,[ref]$errors)
if ($errors.Count) { throw 'Manager parse failed' }
# Load only these pure/read-only function definitions, not the manager entrypoint.
foreach ($functionName in @('ConvertTo-NativeArgument','Assert-PlainPath','Check-Package','Assert-FreshTarget','Confirm-Cleanup','Has-Result','Confirm-KeyRound','Confirm-ProtectionRound','Confirm-DiagnosticCollection','Confirm-ProtectionDiagnostic','Confirm-AclSetup','Confirm-AclProbe','Confirm-AclCleanup')) {
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
$exe = Join-Path $PackageRoot 'Ecs.Lic008.ComparisonV1.exe'
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
foreach ($refusedArguments in @('--service guardian','--child app','--service setup')) {
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
foreach ($name in @('Ecs.Lic008.ComparisonV1.exe','Manage-Spike.ps1','Run-Protection-Diagnostic.ps1')) { [IO.File]::WriteAllText((Join-Path $fixture $name), 'TEST_ONLY_INERT_TEXT', $utf8) }
$entries = @(Get-ChildItem -LiteralPath $fixture -File | ForEach-Object { @{name=$_.Name;size=$_.Length;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant()} })
$manifest = @{checklistId='LIC-6.2-008';scope='TEST_ONLY_COMPARISON_V1';version='0.7.0';files=$entries}
$manifestPath = Join-Path $fixture 'package-manifest.json'
function Save-Fixture { $manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestPath -Encoding UTF8 }
Save-Fixture
$null = Check-Package $fixture
$count++
$manifest.scope='PRODUCTION'; Save-Fixture
Must-Reject { Check-Package $fixture }
$manifest.scope='TEST_ONLY_COMPARISON_V1'
$manifest.files=@($entries[0],$entries[0]); Save-Fixture
Must-Reject { Check-Package $fixture }
$manifest.files=$entries
$originalName=$entries[0].name
$entries[0].name='../escape.exe'; Save-Fixture
Must-Reject { Check-Package $fixture }
$entries[0].name='Ecs.Lic008.ComparisonV1.exe:payload'; Save-Fixture
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
$spikeRoot = $fixture
$spikeNames = @('Ecs.Lic008.ComparisonV1.Guardian','Ecs.Lic008.ComparisonV1.App')
Must-Reject { Assert-FreshTarget }
$spikeRoot = Join-Path $fixture 'absent'
function Get-Service { param($Name,$ErrorAction) return @{ Name=$Name } }
Must-Reject { Assert-FreshTarget }
function Get-Service { param($Name,$ErrorAction) return $null }
Assert-FreshTarget
$count++
foreach ($status in @('PASS','ABSENT_FOR_CALLER','INCOMPLETE_OWNERSHIP','DENIED_OR_UNKNOWN','NO_INTENT_RETAINED','FAIL_STILL_OPEN')) {
    if (Confirm-Cleanup @{results=@(@{Id='guardian.software.cleanup';Status=$status})}) { throw 'Unproven cleanup allowed service teardown' }
    $count++
}
if (Confirm-Cleanup @{results=@(@{Id='guardian.tpm.cleanup';Status='DELETED_AND_CONFIRMED'})}) { throw 'Wrong cleanup resource accepted' }
$count++
if (Confirm-Cleanup @{results=@()}) { throw 'Empty cleanup accepted' }
$count++
if (-not (Confirm-Cleanup @{results=@(@{Id='guardian.software.cleanup';Status='DELETED_AND_CONFIRMED'})})) { throw 'Confirmed cleanup rejected' }
$count++

$g=@{results=@(
    @{Id='guardian.software.reopen-sign-policy-acl';Status='PASS'},
    @{Id='guardian.software.private-export-denied';Status='PASS'},
    @{Id='guardian.protected-file-reopen';Status='PASS'}
)}
$a=@{results=@(
    @{Id='app.software.key-denied';Status='PASS_ACCESS_DENIED'},
    @{Id='child.software.key-denied';Status='PASS_ACCESS_DENIED'},
    @{Id='app.protected-read-denied';Status='PASS_ACCESS_DENIED'},
    @{Id='child.protected-read-denied';Status='PASS_ACCESS_DENIED'},
    @{Id='app.protected-write-denied';Status='PASS_ACCESS_DENIED'},
    @{Id='child.protected-write-denied';Status='PASS_ACCESS_DENIED'},
    @{Id='app.child-probe-execution';Status='PASS'},
    @{Id='child.token-identity';Status='PASS'}
)}
if(-not (Confirm-KeyRound $g $a)){throw 'Complete key controls rejected'}; $count++
$appKey=@($a.results|Where-Object{$_.Id -ceq 'app.software.key-denied'})[0]
$childKey=@($a.results|Where-Object{$_.Id -ceq 'child.software.key-denied'})[0]
$appKey.Status='PASS_KEY_NOT_DISCLOSED';$childKey.Status='PASS_KEY_NOT_DISCLOSED'
if(-not(Confirm-KeyRound $g $a)){throw 'Narrow non-disclosure evidence rejected'};$count++
$appKey.Status='OBSERVED_BAD_KEYSET'
if(Confirm-KeyRound $g $a){throw 'Unaccepted BAD_KEYSET passed key round'};$count++
$appKey.Status='PASS_ACCESS_DENIED';$childKey.Status='PASS_ACCESS_DENIED'
foreach($row in @($g.results)+@($a.results)){
    $old=$row.Status;$row.Status='NOT_TESTED_PREREQUISITE'
    if(Confirm-KeyRound $g $a){throw 'Missing key prerequisite accepted'}
    $row.Status=$old;$count++
}
$duplicate=@{results=@($g.results)+@($g.results[0])}
if(Confirm-KeyRound $duplicate $a){throw 'Duplicate key evidence accepted'}; $count++
if(Confirm-ProtectionRound $g $a 'protect'){throw 'Key evidence authorized protection success'}; $count++
$pg=@{results=@(@{Id='guardian.dpapi-ng-create';Status='PASS'})}
$pa=@{results=@(@{Id='app.dpapi-ng-denied';Status='PASS_ACCESS_DENIED'},@{Id='child.dpapi-ng-denied';Status='PASS_ACCESS_DENIED'},@{Id='app.child-probe-execution';Status='PASS'},@{Id='child.token-identity';Status='PASS'})}
if(-not (Confirm-ProtectionRound $pg $pa 'protect')){throw 'Complete protection controls rejected'}; $count++
foreach($row in @($pg.results)+@($pa.results)){
    $old=$row.Status;$row.Status='INCONCLUSIVE'
    if(Confirm-ProtectionRound $pg $pa 'protect'){throw 'Inconclusive protection accepted'}
    $row.Status=$old;$count++
}
$protectionDiagnostic=@{results=@()}
foreach($id in @('current-user','account','authentication-type','impersonation-level','environment-user-profile',
    'special-folder-user-profile','hku-service-sid-loaded','profile-directory','profile-type')){
    $protectionDiagnostic.results+=@{Id=('guardian.dpapi-environment.'+$id);Status='OBSERVED'}
}
$protectionDiagnostic.results+=@{Id='guardian.dpapi-diagnostic.local-user';Status='FAILED_OR_UNAVAILABLE'}
$protectionDiagnostic.results+=@{Id='guardian.dpapi-diagnostic.guardian-sid';Status='PASS_MEMORY_ROUNDTRIP'}
if(-not(Confirm-ProtectionDiagnostic $protectionDiagnostic)){throw 'Complete protection diagnostic rejected'};$count++
$old=$protectionDiagnostic.results[-1].Status;$protectionDiagnostic.results[-1].Status='PASS'
if(Confirm-ProtectionDiagnostic $protectionDiagnostic){throw 'Unexpected protection diagnostic status accepted'}
$protectionDiagnostic.results[-1].Status=$old;$count++
$duplicateProtectionDiagnostic=@{results=@($protectionDiagnostic.results)+@($protectionDiagnostic.results[0])}
if(Confirm-ProtectionDiagnostic $duplicateProtectionDiagnostic){throw 'Duplicate protection diagnostic evidence accepted'};$count++
$dg=@{results=@(
    @{Id='guardian.software.retained-records';Status='PASS'},
    @{Id='guardian.software.reopen-sign-policy-acl';Status='PASS'},
    @{Id='guardian.software.private-export-denied';Status='PASS'},
    @{Id='guardian.software.load-public-record';Status='PASS'},
    @{Id='guardian.software.native-open-provider';Status='PASS'},
    @{Id='guardian.software.native-algorithm-support';Status='PASS'},
    @{Id='guardian.software.native-open-key';Status='PASS'}
)}
$da=@{results=@(
    @{Id='app.software.load-public-record';Status='PASS'},
    @{Id='app.software.native-open-provider';Status='PASS'},
    @{Id='app.software.native-algorithm-support';Status='PASS'},
    @{Id='app.software.native-open-key';Status='INCONCLUSIVE'},
    @{Id='child.software.load-public-record';Status='PASS'},
    @{Id='child.software.native-open-provider';Status='PASS'},
    @{Id='child.software.native-algorithm-support';Status='PASS'},
    @{Id='child.software.native-open-key';Status='INCONCLUSIVE'},
    @{Id='app.child-probe-execution';Status='PASS'},
    @{Id='child.token-identity';Status='PASS'}
)}
if(-not (Confirm-DiagnosticCollection $dg $da)){throw 'Complete diagnostic collection rejected'};$count++
$old=$da.results[3].Status;$da.results[3].Status='PASS_ACCESS_DENIED'
if(Confirm-DiagnosticCollection $dg $da){throw 'Diagnostic collection accepted relabeled denial'}
$da.results[3].Status=$old;$count++
$duplicateDiagnostic=@{results=@($da.results)+@($da.results[0])}
if(Confirm-DiagnosticCollection $dg $duplicateDiagnostic){throw 'Duplicate diagnostic evidence accepted'};$count++
$aclSetup=@{results=@(
    @{Id='setup.acl.restricted.create-p256';Status='PASS'},
    @{Id='setup.acl.app-readable.create-p256';Status='PASS'},
    @{Id='setup.acl.publish-controls';Status='PASS'}
)}
if(-not (Confirm-AclSetup $aclSetup)){throw 'Complete ACL setup rejected'};$count++
$aclGuardian=@{results=@(@{Id='guardian.acl.load-control-record';Status='PASS'})}
foreach($label in @('restricted','app-readable')){foreach($suffix in @('open-provider','algorithm-support','open-key')){
    $aclGuardian.results+=@{Id=('guardian.acl.'+$label+'.'+$suffix);Status='PASS'}
}}
$aclApp=@{results=@()}
foreach($actor in @('app','child')){
    $aclApp.results+=@{Id=($actor+'.acl.load-control-record');Status='PASS'}
    foreach($label in @('restricted','app-readable')){foreach($suffix in @('open-provider','algorithm-support')){
        $aclApp.results+=@{Id=($actor+'.acl.'+$label+'.'+$suffix);Status='PASS'}
    }}
    $aclApp.results+=@{Id=($actor+'.acl.restricted.open-key');Status='OBSERVED_BAD_KEYSET'}
    $aclApp.results+=@{Id=($actor+'.acl.app-readable.open-key');Status='PASS'}
}
$aclApp.results+=@{Id='app.child-probe-execution';Status='PASS'},@{Id='child.token-identity';Status='PASS'}
if(-not (Confirm-AclProbe $aclGuardian $aclApp)){throw 'Complete ACL contrast rejected'};$count++
$old=$aclApp.results[6].Status;$aclApp.results[6].Status='PASS_ACCESS_DENIED'
if(Confirm-AclProbe $aclGuardian $aclApp){throw 'Relabeled ACL contrast accepted'}
$aclApp.results[6].Status=$old;$count++
$duplicateAcl=@{results=@($aclApp.results)+@($aclApp.results[0])}
if(Confirm-AclProbe $aclGuardian $duplicateAcl){throw 'Duplicate ACL evidence accepted'};$count++
$aclCleanup=@{results=@(
    @{Id='guardian.acl.restricted.cleanup';Status='DELETED_AND_CONFIRMED'},
    @{Id='guardian.acl.app-readable.cleanup';Status='DELETED_AND_CONFIRMED'}
)}
if(-not (Confirm-AclCleanup $aclCleanup)){throw 'Complete ACL cleanup rejected'};$count++
$aclCleanup.results[1].Status='RETAINED_OR_UNKNOWN'
if(Confirm-AclCleanup $aclCleanup){throw 'Incomplete ACL cleanup accepted'};$count++
Write-Output ("PASS: $count harness checks; fixture files/junction retained only under out/. No service or key mutation.")

# Execute the installation orchestration with inert filesystem/SCM doubles.
# This catches a missing helper creation before a real partial installation.
$managerText=[IO.File]::ReadAllText($manager)
$start=$managerText.IndexOf('    $manifest = Check-Package $PSScriptRoot')
$finish=[regex]::Match($managerText,'(?m)^Check-Installed\r?$').Index
if($start -lt 0 -or $finish -le $start){throw 'Missing bootstrap boundary'}
$bootstrap=$managerText.Substring($start,$finish-$start)
$bootstrap=$bootstrap.Replace('$PSScriptRoot', "'C:\TEST_ONLY_INERT'")
& {
    $script:createdServices=@()
    $spikeRoot='C:\TEST_ONLY_INERT'
    $spikeExe='C:\TEST_ONLY_INERT\test.exe'
    $spikeNames=@('Ecs.Lic008.ComparisonV1.Guardian','Ecs.Lic008.ComparisonV1.App','Ecs.Lic008.ComparisonV1.Setup')
    function Check-Package {param($Path) return @{files=@()}}
    function Assert-FreshTarget {}
    function New-Item {param($ItemType,$Path)}
    function Set-DirectoryRules {param($Path,$Modify,$Read,$Admin)}
    function Set-Content {param($LiteralPath,$Encoding) process {}}
    function Copy-Item {param($LiteralPath,$Destination)}
    function Identity {param($Name) return 'S-1-5-80-1'}
    function Invoke-SpikeSc {param([string[]]$Words) if($Words[0] -eq 'create'){$script:createdServices+=,@($Words)}}
    . ([scriptblock]::Create($bootstrap))
    if($script:createdServices.Count -ne 3){throw 'Bootstrap did not create all three isolated roles'}
    if($script:createdServices[2][1] -ne $spikeNames[2] -or $script:createdServices[2][-1] -ne 'LocalSystem'){throw 'Helper identity mismatch'}
}
Write-Output 'PASS: inert bootstrap creates Guardian/App plus the exact SYSTEM helper; no real filesystem/SCM operation.'

$diagnosticScript=Join-Path $repo 'licensing/windows-spike/comparison-kit/Diagnose-Retained.ps1'
$diagnosticTokens=$null;$diagnosticErrors=$null
$null=[Management.Automation.Language.Parser]::ParseFile($diagnosticScript,[ref]$diagnosticTokens,[ref]$diagnosticErrors)
if($diagnosticErrors.Count){throw 'Diagnostic continuation parse failed'}
$diagnosticAst=[Management.Automation.Language.Parser]::ParseFile($diagnosticScript,[ref]$diagnosticTokens,[ref]$diagnosticErrors)
$diagnosticCommands=@($diagnosticAst.FindAll({param($n) $n -is [Management.Automation.Language.CommandAst]},$true) | ForEach-Object {$_.GetCommandName()})
foreach($forbiddenCommand in @('Remove-Item','Set-Acl','Remove-Service','New-Service')){
    if($diagnosticCommands -contains $forbiddenCommand){throw ('Destructive command present in diagnostic continuation: '+$forbiddenCommand)}
}
$nativeSource=[IO.File]::ReadAllText((Join-Path $repo 'licensing/windows-spike/comparison/NativeOpenDiagnostics.cs'))
foreach($forbidden in @('NCryptCreatePersistedKey','NCryptSetProperty','NCryptFinalizeKey','NCryptDeleteKey','NCryptExportKey','NCryptEnumKeys')){
    if($nativeSource.Contains($forbidden)){throw ('Write/broad native API present in diagnostic: '+$forbidden)}
}
foreach($required in @('NCryptOpenStorageProvider','NCryptIsAlgSupported','NCryptOpenKey','NCryptFreeObject')){
    if(-not $nativeSource.Contains($required)){throw ('Required read-only native stage missing: '+$required)}
}
$diagnosticText=[IO.File]::ReadAllText($diagnosticScript)
foreach($required in @('bin-0.4.3-diagnostic','diagnose-open','securityAccepted=$false','acceptanceChanged=$false','continuation-4dde8b0572a24b23b55d11567ad2b8fa.json')){
    if(-not $diagnosticText.Contains($required)){throw ('Diagnostic continuation guard missing: '+$required)}
}
foreach($forbiddenText in @("@('delete'","@('create'",'Resume-Retained.ps1','ContinueProtection')){
    if($diagnosticText.Contains($forbiddenText)){throw ('Forbidden retained-state operation present: '+$forbiddenText)}
}
if($diagnosticText.Contains('protected/software')){throw 'Administrator continuation must not inspect Guardian-protected key records'}
Write-Output 'PASS: diagnostic continuation parses; exact retained-state markers and read-only native API allowlist are present.'

$aclScript=Join-Path $repo 'licensing/windows-spike/comparison-kit/Run-Acl-Disambiguation.ps1'
$aclTokens=$null;$aclErrors=$null
$aclAst=[Management.Automation.Language.Parser]::ParseFile($aclScript,[ref]$aclTokens,[ref]$aclErrors)
if($aclErrors.Count){throw 'ACL-disambiguation continuation parse failed'}
$aclCommands=@($aclAst.FindAll({param($n) $n -is [Management.Automation.Language.CommandAst]},$true)|ForEach-Object{$_.GetCommandName()})
foreach($forbiddenCommand in @('Remove-Item','Set-Acl','Remove-Service','New-Service')){
    if($aclCommands -contains $forbiddenCommand){throw ('Unbounded destructive command present in ACL continuation: '+$forbiddenCommand)}
}
$aclText=[IO.File]::ReadAllText($aclScript)
foreach($required in @('bin-0.4.3-diagnostic','bin-0.5.0-acl-control','DBDC3B6CC266A48340BE66A7B99D7815BE03662D80A2E19669C467646CC7C433',
    "Set-Plan 'acl-create'","Set-Plan 'acl-probe'","Set-Plan 'acl-cleanup'",'securityAccepted=$false','decisionChanged=$false')){
    if(-not $aclText.Contains($required)){throw ('ACL continuation guard missing: '+$required)}
}
$aclNative=[IO.File]::ReadAllText((Join-Path $repo 'licensing/windows-spike/comparison/AclControlNative.cs'))
foreach($required in @('NCryptCreatePersistedKey','NCryptSetProperty','NCryptFinalizeKey','NCryptOpenKey','ValidAclControlKeyName')){
    if(-not $aclNative.Contains($required)){throw ('ACL native control missing: '+$required)}
}
foreach($forbidden in @('NCryptDeleteKey','NCryptExportKey','NCryptEnumKeys','NCryptImportKey')){
    if($aclNative.Contains($forbidden)){throw ('Broad native API present in ACL control: '+$forbidden)}
}
$programText=[IO.File]::ReadAllText((Join-Path $repo 'licensing/windows-spike/comparison/Program.cs'))
foreach($required in @('ValidAclControlKeyName','OBSERVED_BAD_KEYSET','DELETED_AND_CONFIRMED','LoadAclControls')){
    if(-not $programText.Contains($required)){throw ('ACL program binding missing: '+$required)}
}
Write-Output 'PASS: ACL-disambiguation continuation parses; retained-state pins, generated-name binding and native API bounds are present.'

$acceptedScript=Join-Path $repo 'licensing/windows-spike/comparison-kit/Run-Accepted-Rounds.ps1'
$acceptedTokens=$null;$acceptedErrors=$null
$acceptedAst=[Management.Automation.Language.Parser]::ParseFile($acceptedScript,[ref]$acceptedTokens,[ref]$acceptedErrors)
if($acceptedErrors.Count){throw 'Accepted-round continuation parse failed'}
$acceptedCommands=@($acceptedAst.FindAll({param($n)$n -is [Management.Automation.Language.CommandAst]},$true)|ForEach-Object{$_.GetCommandName()})
foreach($forbiddenCommand in @('Remove-Item','Set-Acl','Remove-Service','New-Service')){
    if($acceptedCommands -contains $forbiddenCommand){throw ('Destructive command present in accepted-round continuation: '+$forbiddenCommand)}
}
$acceptedText=[IO.File]::ReadAllText($acceptedScript)
foreach($required in @('bin-0.5.0-acl-control','bin-0.6.0-accepted-rounds','166299E96E2036A3740A44D323EC7C4A608C4FAEF72C646EE3BC827902ECC50E',
    'LIC-CHG-0052',"Set-Plan 'verify' `$false '' `$true",'PASS_BOUNDED_PROCESS_RESTART_ONLY','productionAccepted=$false')){
    if(-not $acceptedText.Contains($required)){throw ('Accepted-round guard missing: '+$required)}
}
foreach($forbiddenText in @("@('create'","@('delete'",'Run-Acl-Disambiguation.ps1','ContinueProtection')){
    if($acceptedText.Contains($forbiddenText)){throw ('Forbidden accepted-round operation present: '+$forbiddenText)}
}
if($programText.Contains('is 0x80090010 or 0x80090016')){throw 'NTE_BAD_KEYSET was added to global IsDenied'}
foreach($required in @('PASS_KEY_NOT_DISCLOSED','AclBehaviorAccepted','KeyIsolation(')){
    if(-not $programText.Contains($required)){throw ('Narrow classifier binding missing: '+$required)}
}
Write-Output 'PASS: accepted-round continuation parses; EV0107 pin and narrow non-global classifier binding are present.'

$protectionScript=Join-Path $repo 'licensing/windows-spike/comparison-kit/Run-Protection-Diagnostic.ps1'
$protectionTokens=$null;$protectionErrors=$null
$protectionAst=[Management.Automation.Language.Parser]::ParseFile($protectionScript,[ref]$protectionTokens,[ref]$protectionErrors)
if($protectionErrors.Count){throw 'Protection diagnostic continuation parse failed'}
$protectionCommands=@($protectionAst.FindAll({param($n)$n -is [Management.Automation.Language.CommandAst]},$true)|ForEach-Object{$_.GetCommandName()})
foreach($forbiddenCommand in @('Remove-Item','Set-Acl','Remove-Service','New-Service')){
    if($protectionCommands -contains $forbiddenCommand){throw ('Destructive command present in protection diagnostic: '+$forbiddenCommand)}
}
$protectionText=[IO.File]::ReadAllText($protectionScript)
foreach($required in @('bin-0.6.0-accepted-rounds','bin-0.7.0-protection-diagnostic','E5CD53E948AE094A441C2245056A15E8C5F7889AA3C07653789361D5C007C002',
    "Set-Plan 'diagnose-protection'",'securityAccepted=$false','policyChanged=$false','LOCAL_MACHINE_FALLBACK')){
    if(-not $protectionText.Contains($required)){throw ('Protection diagnostic guard missing: '+$required)}
}
foreach($forbiddenText in @('LOCAL=machine',"Set-Plan 'protect'",'Run-Accepted-Rounds.ps1','protected/dpapi-hash')){
    if($protectionText.Contains($forbiddenText)){throw ('Forbidden protection diagnostic behavior present: '+$forbiddenText)}
}
$protectionNative=[IO.File]::ReadAllText((Join-Path $repo 'licensing/windows-spike/comparison/ProtectionDiagnostics.cs'))
foreach($required in @('LOCAL=user','SID=','GetUserProfileDirectory','GetProfileType','Registry.Users.OpenSubKey','CryptographicOperations.ZeroMemory')){
    if(-not $protectionNative.Contains($required)){throw ('Protection diagnostic stage missing: '+$required)}
}
foreach($forbidden in @('LOCAL=machine','File.Write','CreateNew','NCryptCreatePersistedKey','NCryptDeleteKey')){
    if($protectionNative.Contains($forbidden)){throw ('Persistent or fallback behavior present in protection diagnostic: '+$forbidden)}
}
Write-Output 'PASS: protection diagnostic parses; EV0109 pins, no LOCAL=machine fallback and memory-only probe bounds are present.'
