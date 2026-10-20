import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const catalog = JSON.parse(readFileSync(path.join(root, 'contracts/catalog.json'), 'utf8'));
assert.ok(existsSync(path.join(root, catalog.source)), 'Canonical plan must exist');
assert.equal(catalog.presentation.default, 'professional');
assert.equal(catalog.presentation.farm, 'optional');
assert.equal(catalog.presentation.shared_runtime, true);
assert.equal(catalog.presentation.theme_switch_restarts_sessions, false);
const byId = new Map(catalog.contracts.map(contract => [contract.id, contract]));
assert.equal(byId.size, catalog.contracts.length, 'Duplicate contract ID');
assert.equal(byId.size, 12, 'All twelve contracts must be preserved');
const proofs = new Set();
for (const contract of byId.values()) {
  assert.ok([1, 2, 3].includes(contract.phase), `${contract.id}: missing phase`);
  for (const proof of contract.proofs) {
    assert.ok(!proofs.has(proof.id), `Duplicate proof ${proof.id}`);
    assert.ok(proof.id.startsWith(`P-${contract.id.slice(3)}-`), `Unexpected proof ID ${proof.id}`);
    proofs.add(proof.id);
  }
}
const visited = new Set();
function visit(id, active = new Set()) {
  assert.ok(byId.has(id), `Missing dependency ${id}`);
  assert.ok(!active.has(id), `Dependency cycle at ${id}`);
  if (visited.has(id)) return;
  for (const dependency of byId.get(id).depends_on) visit(dependency, new Set([...active, id]));
  visited.add(id);
}
for (const id of byId.keys()) visit(id);
const release = new Set();
function releaseDependencies(id) {
  if (release.has(id)) return;
  release.add(id);
  for (const dependency of byId.get(id).depends_on) releaseDependencies(dependency);
}
releaseDependencies('GC-11');
assert.ok(!release.has('GC-09'), 'Optional Farm must not block professional release, even transitively');
assert.ok(!release.has('GC-06') && !release.has('GC-08'), 'Full autonomous orchestration belongs to phase 2');
assert.equal(byId.get('GC-09').phase, 3);
for (const proof of ['P-04-06', 'P-04-07', 'P-04-08', 'P-04-09', 'P-09-08', 'P-11-04']) assert.ok(proofs.has(proof), `Missing acceptance ${proof}`);
console.log(`${byId.size} contracts, ${proofs.size} unique proofs; acyclic dependencies; professional release excludes Farm and phase-2 automation. Structure only, no runtime or seal claimed.`);
