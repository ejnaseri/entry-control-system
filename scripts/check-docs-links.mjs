import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function localTarget(file, raw) {
  let target = raw.trim();
  if (target.startsWith('<')) target = target.slice(1, target.indexOf('>'));
  else target = target.replace(/\s+["'][^]*$/u, '');
  if (!target || target.startsWith('#') || /^[a-z][a-z0-9+.-]*:/iu.test(target)) return null;
  target = target.split(/[?#]/u)[0];
  try { target = decodeURIComponent(target); } catch { throw new Error(`Invalid encoded link in ${file}: ${raw}`); }
  return path.resolve(target.startsWith('/') ? root : path.dirname(file), target.replace(/^\//u, ''));
}

if (process.argv.includes('--self-test')) {
  const file = path.join(root, 'docs', 'licensing', 'README.md');
  assert.equal(localTarget(file, '../README.md#start'), path.join(root, 'docs', 'README.md'));
  assert.equal(localTarget(file, '<../a%20b.md>'), path.join(root, 'docs', 'a b.md'));
  assert.equal(localTarget(file, 'design/x.md "title"'), path.join(root, 'docs', 'licensing', 'design', 'x.md'));
  assert.equal(localTarget(file, '/README.md'), path.join(root, 'README.md'));
  for (const link of ['#start', 'https://example.com', 'mailto:a@example.com', 'C:/evidence/report.json']) {
    assert.equal(localTarget(file, link), null);
  }
  assert.throws(() => localTarget(file, '%not-valid'));
  console.log('PASS: documentation link resolver self-tests');
}

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' })
  .split('\0').filter((file) => file.endsWith('.md') && existsSync(path.join(root, file)));
let checked = 0;
const failures = [];
for (const file of new Set(files)) {
  const absolute = path.join(root, file);
  const source = readFileSync(absolute, 'utf8');
  for (const match of source.matchAll(/!?\[[^\]\r\n]*\]\((<[^>]*>|[^)\r\n]*)\)/gu)) {
    const target = localTarget(absolute, match[1]);
    if (!target) continue;
    checked++;
    if (!existsSync(target)) failures.push(`${file}: ${match[1]}`);
  }
}
if (failures.length) {
  console.error(`FAIL: ${failures.length} missing local link targets\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`PASS: ${new Set(files).size} Markdown files, ${checked} local link targets`);
}
// Existence only: does not validate heading anchors, external URLs or evidence integrity.
