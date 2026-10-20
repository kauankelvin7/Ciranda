import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { git, prepareProofPaths, sha256, sourceSnapshot, sourceIsClean, validateProof } from '../scripts/lib/governance.mjs';
import { proofCommands } from '../scripts/lib/proof-commands.mjs';
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
    const artifact = { stdout: '# tests 1\n# pass 1\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n', stderr: '', error: null, execution: { exit_code: 0, signal: null } };
    const artifactFile = path.join(fixture, 'proofs/P-00-03.output.json');
    const artifactBytes = JSON.stringify(artifact);
    writeFileSync(artifactFile, artifactBytes);
    const now = new Date().toISOString();
    const proof = { proof_id: 'P-00-03', contract_id: 'GC-00', status: 'pass', exit_code: 0, commit: git(fixture, ['rev-parse', 'HEAD']), source_sha256: sourceSnapshot(fixture), source_unchanged: true, artifact: 'proofs/P-00-03.output.json', artifact_sha256: sha256(artifactBytes), started_at_utc: now, finished_at_utc: now, environment: { os: os.type(), release: os.release(), arch: os.arch(), node: process.version }, command: `node ${proofCommands['policy-negative'].args.join(' ')}`, scope: proofCommands['policy-negative'].scope };
    assert.equal(sourceIsClean(fixture), true);
    assert.deepEqual(validateProof(fixture, proof, 'P-00-03'), []);
    assert.ok(validateProof(fixture, { ...proof, status: 'not_run' }, 'P-00-03').length);
    assert.ok(validateProof(fixture, { ...proof, commit: 'stale' }, 'P-00-03').some(error => error.includes('stale')));
    for (const mutation of [{ contract_id: 'GC-99' }, { command: 'never executed' }, { started_at_utc: 'fake' }, { finished_at_utc: 'fake' }, { finished_at_utc: '2020-01-01T00:00:00.000Z' }, { source_unchanged: false }, { environment: { ...proof.environment, node: 'fake' } }, { environment: { ...proof.environment, os: 'invented' } }, { artifact: 'source.txt', artifact_sha256: sha256('baseline') }, { scope: 'full product verified' }]) {
      assert.ok(validateProof(fixture, { ...proof, ...mutation }, 'P-00-03').length, `must reject ${JSON.stringify(mutation)}`);
    }
    assert.ok(validateProof(fixture, proof, 'P-99-01').length);
    for (const mutation of [{ stdout: 'not an execution' }, { stderr: 42 }, { error: 'ETIMEDOUT' }, { execution: { exit_code: 1, signal: null } }, { stdout: artifact.stdout.replace('# pass 1', '# pass 0') }, { stdout: artifact.stdout.replace('# skipped 0', '# skipped 1') }]) {
      const bytes = JSON.stringify({ ...artifact, ...mutation });
      writeFileSync(artifactFile, bytes);
      assert.ok(validateProof(fixture, { ...proof, artifact_sha256: sha256(bytes) }, 'P-00-03').length, `must reject artifact ${JSON.stringify(mutation)}`);
    }
    writeFileSync(artifactFile, 'tampered');
    assert.ok(validateProof(fixture, proof, 'P-00-03').some(error => error.includes('hash mismatch')));
    writeFileSync(path.join(fixture, 'source.txt'), 'changed');
    assert.equal(sourceIsClean(fixture), false);
    assert.ok(validateProof(fixture, proof, 'P-00-03').some(error => error.includes('Source changed')));
    assert.ok(validateProof(fixture, { ...proof, artifact: '../escape' }, 'P-00-03').some(error => error.includes('unsafe')));
  } finally { rmSync(fixture, { recursive: true }); }
});
test('proof writer refuses linked directories and linked destination files before creating evidence', () => {
  mkdirSync(path.join(root, 'tests/.tmp'), { recursive: true });
  const fixture = mkdtempSync(path.join(root, 'tests/.tmp/proof-links-'));
  const target = path.join(fixture, 'destination');
  const repository = path.join(fixture, 'repository');
  const link = path.join(repository, 'proofs');
  try {
    mkdirSync(target); mkdirSync(repository);
    symlinkSync(target, link, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => prepareProofPaths(repository, 'P-00-03'), /Links/);
    assert.equal(existsSync(path.join(target, 'P-00-03.output.json')), false);
    assert.equal(existsSync(path.join(target, 'P-00-03.json')), false);
    unlinkSync(link);
    mkdirSync(link);
    // Directory junction placed at a destination filename also must be rejected.
    const fileLink = path.join(link, 'P-00-03.output.json');
    symlinkSync(target, fileLink, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => prepareProofPaths(repository, 'P-00-03'), /Links/);
    unlinkSync(fileLink);
    assert.equal(existsSync(path.join(target, 'P-00-03.output.json')), false);
    const recordLink = path.join(link, 'P-00-03.json');
    symlinkSync(target, recordLink, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => prepareProofPaths(repository, 'P-00-03'), /Links/);
    unlinkSync(recordLink);
  } finally {
    try { if (existsSync(link)) unlinkSync(link); } catch { /* real fixture directory, removed below */ }
    rmSync(fixture, { recursive: true });
  }
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
