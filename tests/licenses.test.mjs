import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, validateLicenses } from '../scripts/lib/governance.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
test('packaging asset gate rejects missing license, provenance, inventory and altered bytes', () => {
  mkdirSync(path.join(root, 'tests/.tmp'), { recursive: true });
  const fixture = mkdtempSync(path.join(root, 'tests/.tmp/license-'));
  try {
    mkdirSync(path.join(fixture, 'assets/raw'), { recursive: true });
    writeFileSync(path.join(fixture, 'assets/raw/synthetic.txt'), 'fixture');
    writeFileSync(path.join(fixture, 'assets/license.txt'), 'Synthetic license fixture; not a distribution grant.');
    const asset = { path: 'assets/raw/synthetic.txt', license: 'TEST-ONLY', source: 'synthetic test fixture', license_file: 'assets/license.txt', sha256: sha256('fixture'), distribution_approved: true };
    const manifest = { version: 1, assets: [asset] };
    assert.deepEqual(validateLicenses(fixture, manifest), []);
    for (const field of ['license', 'source', 'license_file', 'sha256', 'distribution_approved']) {
      const invalid = { ...asset }; delete invalid[field];
      assert.notEqual(validateLicenses(fixture, { version: 1, assets: [invalid] }).length, 0, `${field} must be required`);
    }
    assert.ok(validateLicenses(fixture, { version: 1, assets: [] }).some(error => error.includes('Unlisted')));
    assert.ok(validateLicenses(fixture, { version: 1, assets: [{ ...asset, path: '../escape' }] }).some(error => error.includes('Unsafe')));
    assert.ok(validateLicenses(fixture, { version: 1, assets: [asset, asset] }).some(error => error.includes('Duplicate')));
    writeFileSync(path.join(fixture, 'assets/raw/synthetic.txt'), 'tampered');
    assert.ok(validateLicenses(fixture, manifest).some(error => error.includes('hash mismatch')));
    assert.notEqual(validateLicenses(fixture, {}).length, 0);
  } finally { rmSync(fixture, { recursive: true }); }
});
