import { git, inside, readJson, validateProof } from './lib/governance.mjs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const id = process.argv[2];
  if (!/^GC-\d{2}$/.test(id ?? '')) throw new Error('Usage: node scripts/seal.mjs GC-00');
  const catalog = readJson(new URL('../contracts/catalog.json', import.meta.url));
  const contract = catalog.contracts.find(item => item.id === id);
  if (!contract) throw new Error('Unknown contract');
  const errors = [];
  for (const dependency of contract.depends_on) if (catalog.contracts.find(item => item.id === dependency)?.status !== 'sealed') errors.push(`Dependency not sealed: ${dependency}`);
  for (const proof of contract.proofs) {
    try { errors.push(...validateProof(root, readJson(inside(root, `proofs/${proof.id}.json`)), proof.id).map(error => `${proof.id}: ${error}`)); }
    catch { errors.push(`${proof.id}: missing or invalid evidence`); }
  }
  console.log(`Commit under evaluation: ${git(root, ['rev-parse', 'HEAD'])}`);
  if (errors.length) console.error(errors.join('\n'));
  // Until an authenticated owner-approval channel is implemented, files supplied by
  // an agent must never impersonate a human. This command deliberately never seals.
  console.error('SEAL REFUSED: independent review and authenticated explicit owner approval are required; unattended sealing is unavailable.');
  process.exitCode = 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
