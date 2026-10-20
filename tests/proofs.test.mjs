import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { git, sha256, sourceSnapshot, sourceIsClean, validateProof } from '../scripts/lib/governance.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
test('proof validation invalidates tampered evidence, dirty source and stale commits', () => {
  mkdirSync(path.join(root, 'tests/.tmp'), { recursive: true });
  const fixture = mkdtempSync(path.join(root, 'tests/.tmp/proof-'));
  try {
    git(fixture, ['init']);
    writeFileSync(path.join(fixture, 'source.txt'), 'baseline');
    git(fixture, ['add', 'source.txt']);
    git(fixture, ['-c', 'user.name=CIRANDA Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-m', 'fixture']);
    mkdirSync(path.join(fixture, 'proofs'));
    writeFileSync(path.join(fixture, 'proofs/evidence.txt'), 'passed');
    const proof = { proof_id: 'P-00-03', status: 'pass', exit_code: 0, commit: git(fixture, ['rev-parse', 'HEAD']), source_sha256: sourceSnapshot(fixture), artifact: 'proofs/evidence.txt', artifact_sha256: sha256('passed'), started_at_utc: new Date().toISOString(), environment: { node: process.version }, command: 'node --test tests/policy.test.mjs' };
    assert.equal(sourceIsClean(fixture), true);
    assert.deepEqual(validateProof(fixture, proof, 'P-00-03'), []);
    assert.ok(validateProof(fixture, { ...proof, status: 'not_run' }, 'P-00-03').length);
    assert.ok(validateProof(fixture, { ...proof, commit: 'stale' }, 'P-00-03').some(error => error.includes('stale')));
    writeFileSync(path.join(fixture, 'proofs/evidence.txt'), 'tampered');
    assert.ok(validateProof(fixture, proof, 'P-00-03').some(error => error.includes('hash mismatch')));
    writeFileSync(path.join(fixture, 'source.txt'), 'changed');
    assert.equal(sourceIsClean(fixture), false);
    assert.ok(validateProof(fixture, proof, 'P-00-03').some(error => error.includes('Source changed')));
    assert.ok(validateProof(fixture, { ...proof, artifact: '../escape' }, 'P-00-03').some(error => error.includes('unsafe')));
  } finally { rmSync(fixture, { recursive: true }); }
});
test('seal fails closed without owner authorization and never edits contract status', () => {
  const result = spawnSync(process.execPath, ['scripts/seal.mjs', 'GC-00'], { cwd: root, encoding: 'utf8', shell: false });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /SEAL REFUSED/);
});
test('proof executor rejects unknown commands and package gate never creates a bundle', () => {
  const unknown = spawnSync(process.execPath, ['scripts/prove.mjs', 'deploy'], { cwd: root, encoding: 'utf8', shell: false });
  assert.equal(unknown.status, 1);
  assert.match(unknown.stderr, /Usage:/);
  const packaging = spawnSync(process.execPath, ['scripts/package-gate.mjs'], { cwd: root, encoding: 'utf8', shell: false });
  assert.equal(packaging.status, 1);
  assert.match(packaging.stderr, /PACKAGING DENIED/);
});
