// Invalid build selections must refuse before compilation/output creation.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const script=fileURLToPath(new URL('./build-license-adapter-pilot.ps1',import.meta.url));
const pin='8d6b30a67a7060b1e343b1fa485c11f460698d20017bc48da597fcd67757ea30';
let cases=0;
for(const [args,reason] of [
 [['-TestCapable'],'ISOLATED_V2_BUILD_REVIEW_PIN_REQUIRED'],
 [['-TestCapable','-ReviewedSuccessorSha256','c25920687086f0ade2d90486aa02556212a5172e12b423df02ee0650ca69bd7b'],'ISOLATED_V2_BUILD_REVIEW_PIN_REQUIRED'],
 [['-ReviewedSuccessorSha256',pin],'UNEXPECTED_CAPABLE_BUILD_PIN']]) {
 const r=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',script,...args],{encoding:'utf8',windowsHide:true,timeout:15000});
 assert.equal(r.error,undefined);assert.notEqual(r.status,0);assert.match(r.stderr,new RegExp(reason));cases++;
}
console.log(`PASS: ${cases} build-selection refusals; no build or native stage executed.`);
