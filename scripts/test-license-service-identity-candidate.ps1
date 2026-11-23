[CmdletBinding()]param()
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
$source=Join-Path $PSScriptRoot '../licensing/adapter-evidence/guardian-readonly/ServiceIdentityCandidate.cs'
Add-Type -Path $source
$count=[ServiceIdentityCandidate]::SelfTest()
if($count-ne660){throw 'Unexpected test count'}
[pscustomobject]@{Scope='PURE_SERVICE_IDENTITY_CANDIDATE';Cases=$count;Status='PASS';NativeExecuted=$false;RuntimeIntegrated=$false;SecurityAccepted=$false}|ConvertTo-Json
