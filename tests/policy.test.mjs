import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditAction, decideAction, inside } from '../scripts/lib/governance.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
test('mediated policy denies sensitive and unknown requests without invoking any executor', () => {
  mkdirSync(path.join(root, 'tests/.tmp'), { recursive: true });
  const fixture = mkdtempSync(path.join(root, 'tests/.tmp/policy-'));
  try {
    for (const action of ['push', 'deploy', 'purchase', 'shell', 'PUSH', 'push; whoami']) assert.equal(auditAction(fixture, { action, token: 'synthetic-do-not-log' }).allowed, false);
    const audit = readFileSync(path.join(fixture, 'proofs/audit/actions.jsonl'), 'utf8');
    assert.equal(audit.includes('synthetic-do-not-log'), false);
    const records = audit.trim().split('\n').map(JSON.parse);
    assert.equal(records.length, 6);
    assert.ok(records.every(row => row.allowed === false && /^[a-f0-9]{64}$/.test(row.request_sha256) && !Number.isNaN(Date.parse(row.timestamp_utc))));
    assert.equal(decideAction({ action: 'inspect-status' }).allowed, true);
    assert.equal(decideAction({ action: 'inspect-status', command: 'deploy' }).allowed, false);
    assert.equal(decideAction(null).allowed, false);
  } finally { rmSync(fixture, { recursive: true }); }
});
test('audit path traversal is rejected before write', () => {
  assert.throws(() => inside(root, '../escape.jsonl'), /outside/);
  assert.throws(() => auditAction(root, { action: 'push' }, '../escape.jsonl'), /outside/);
});
test('audit refuses a junction/symlink component instead of following it', () => {
  mkdirSync(path.join(root, 'tests/.tmp'), { recursive: true });
  const fixture = mkdtempSync(path.join(root, 'tests/.tmp/link-'));
  const link = path.join(fixture, 'alias');
  try {
    mkdirSync(path.join(fixture, 'destination'));
    symlinkSync(path.join(fixture, 'destination'), link, process.platform === 'win32' ? 'junction' : 'dir');
    assert.throws(() => auditAction(fixture, { action: 'push' }, 'alias/escape.jsonl'), /Links/);
  } finally {
    try { unlinkSync(link); } catch { /* link creation may itself have failed */ }
    rmSync(fixture, { recursive: true });
  }
});
