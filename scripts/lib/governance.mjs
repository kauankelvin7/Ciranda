import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { proofCommands } from './proof-commands.mjs';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const readJson = file => JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
export function inside(root, target) {
  const base = realpathSync(root);
  const resolved = path.resolve(base, target);
  const relative = path.relative(base, resolved);
  if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new Error('Path outside repository');
  let cursor = base;
  for (const part of relative.split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    try {
      if (lstatSync(cursor).isSymbolicLink()) throw new Error('Links are not allowed');
    } catch (error) {
      // existsSync follows links and hides dangling symlinks; inspect the entry
      // itself and ignore only a genuinely absent entry.
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return resolved;
}

// This is a mediated-action policy, not a shell interceptor or OS sandbox.
export function decideAction(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) return { allowed: false, reason: 'invalid-request' };
  if (['push', 'deploy', 'purchase'].includes(request.action)) return { allowed: false, reason: 'forbidden-by-project-policy' };
  if (request.action === 'inspect-status' && Object.keys(request).length === 1) return { allowed: true, reason: 'read-only-metadata' };
  return { allowed: false, reason: 'unknown-action-or-arguments' };
}
export function auditAction(root, request, audit = 'proofs/audit/actions.jsonl') {
  const decision = decideAction(request);
  const file = inside(root, audit);
  mkdirSync(path.dirname(file), { recursive: true });
  // Persist only bounded enums and a digest, never raw command text or credentials.
  const action = ['push', 'deploy', 'purchase', 'inspect-status'].includes(request?.action) ? request.action : 'unknown';
  appendFileSync(file, `${JSON.stringify({ timestamp_utc: new Date().toISOString(), action, ...decision, request_sha256: sha256(JSON.stringify(request) ?? 'null') })}\n`, { encoding: 'utf8', flag: 'a' });
  return decision;
}

const ASSET_ROOTS = ['assets/raw', 'apps/desktop/public/assets'];
export function validateLicenses(root, manifest) {
  const errors = [];
  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.assets)) return ['Invalid asset manifest'];
  const listed = new Set();
  for (const asset of manifest.assets) {
    if (!asset || typeof asset.path !== 'string' || !asset.path || asset.path.includes('\\')) { errors.push('Invalid asset path'); continue; }
    if (listed.has(asset.path)) errors.push(`Duplicate asset: ${asset.path}`);
    listed.add(asset.path);
    try {
      const file = inside(root, asset.path);
      if (!ASSET_ROOTS.some(prefix => asset.path.startsWith(`${prefix}/`))) errors.push(`Asset outside asset roots: ${asset.path}`);
      if (!existsSync(file) || !lstatSync(file).isFile()) errors.push(`Missing asset: ${asset.path}`);
      else if (!/^[a-f0-9]{64}$/.test(asset.sha256 ?? '') || sha256(readFileSync(file)) !== asset.sha256) errors.push(`Asset hash mismatch: ${asset.path}`);
      if (typeof asset.license !== 'string' || !asset.license.trim()) errors.push(`Missing license: ${asset.path}`);
      if (typeof asset.source !== 'string' || !asset.source.trim()) errors.push(`Missing provenance: ${asset.path}`);
      if (typeof asset.license_file !== 'string') errors.push(`Missing license evidence: ${asset.path}`);
      else if (!existsSync(inside(root, asset.license_file)) || !readFileSync(inside(root, asset.license_file), 'utf8').trim()) errors.push(`Missing license evidence: ${asset.path}`);
      // No license is approved implicitly; its acceptance is a separate human decision.
      if (asset.distribution_approved !== true) errors.push(`Distribution not approved: ${asset.path}`);
    } catch { errors.push(`Unsafe asset path or license evidence: ${asset.path}`); }
  }
  function scan(relative) {
    const directory = inside(root, relative);
    if (!existsSync(directory)) return;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const name = `${relative}/${entry.name}`;
      if (entry.isSymbolicLink()) errors.push(`Asset link denied: ${name}`);
      else if (entry.isDirectory()) scan(name);
      else if (!listed.has(name)) errors.push(`Unlisted asset: ${name}`);
    }
  }
  for (const directory of ASSET_ROOTS) { try { scan(directory); } catch { errors.push(`Unsafe asset root: ${directory}`); } }
  return errors;
}

export function git(root, args) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', shell: false, timeout: 15000 });
  if (result.status !== 0) throw new Error('Git metadata unavailable');
  return result.stdout.trim();
}
export function sourceSnapshot(root) {
  const files = git(root, ['ls-files', '-z']).split('\0').filter(Boolean).filter(name => !name.startsWith('proofs/'));
  return sha256(files.sort().map(name => `${name}\0${sha256(readFileSync(inside(root, name)))}\n`).join(''));
}
export function sourceIsClean(root) {
  return git(root, ['status', '--porcelain', '--untracked-files=all', '--', '.', ':(exclude)proofs']).length === 0;
}
export function validateProof(root, proof, expectedId) {
  const errors = [];
  if (!proof || typeof proof !== 'object' || Array.isArray(proof)) return ['Invalid proof record'];
  const expected = Object.values(proofCommands).find(item => item.id === expectedId);
  if (!expected) return ['Proof ID has no supported executor'];
  if (proof.proof_id !== expectedId || proof.status !== 'pass' || proof.exit_code !== 0) errors.push('Proof did not pass');
  if (proof.contract_id !== 'GC-00') errors.push('Unexpected contract ID');
  if (proof.command !== `node ${expected.args.join(' ')}`) errors.push('Command does not match allowlisted executor');
  if (proof.scope !== expected.scope) errors.push('Proof scope differs from executor');
  if (proof.source_unchanged !== true) errors.push('Source changed during execution');
  const isoDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
  if (!isoDate(proof.started_at_utc) || !isoDate(proof.finished_at_utc) || Date.parse(proof.finished_at_utc) < Date.parse(proof.started_at_utc) || Date.parse(proof.finished_at_utc) > Date.now() + 60000) errors.push('Invalid execution timestamps');
  const environment = proof.environment;
  if (!environment || !['Windows_NT', 'Linux', 'Darwin'].includes(environment.os) || !['x64', 'arm64', 'ia32', 'arm', 'ppc64', 's390x', 'riscv64'].includes(environment.arch) || !/^v\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(environment.node ?? '') || typeof environment.release !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._+() -]{0,127}$/.test(environment.release)) errors.push('Invalid execution environment');
  if (proof.commit !== git(root, ['rev-parse', 'HEAD'])) errors.push('Proof commit is stale');
  if (!sourceIsClean(root) || proof.source_sha256 !== sourceSnapshot(root)) errors.push('Source changed since proof');
  try {
    if (proof.artifact !== `proofs/${expectedId}.output.json`) throw new Error('Unexpected artifact');
    const artifactPath = inside(root, proof.artifact);
    if (lstatSync(artifactPath).size > 2 * 1024 * 1024) throw new Error('Evidence too large');
    const bytes = readFileSync(artifactPath);
    if (sha256(bytes) !== proof.artifact_sha256) errors.push('Evidence hash mismatch');
    const artifact = JSON.parse(bytes.toString('utf8'));
    if (!artifact || typeof artifact.stdout !== 'string' || typeof artifact.stderr !== 'string' || artifact.error !== null || artifact.execution?.exit_code !== 0 || artifact.execution?.signal !== null) errors.push('Invalid execution artifact');
    else {
      const count = name => { const hits = [...artifact.stdout.matchAll(new RegExp(`^# ${name} (\\d+)\\r?$`, 'gm'))]; return hits.length === 1 ? Number(hits[0][1]) : NaN; };
      if (!(count('tests') > 0) || count('pass') !== count('tests') || ['fail', 'cancelled', 'skipped', 'todo'].some(name => count(name) !== 0)) errors.push('Artifact does not report a complete passing TAP run');
    }
  } catch { errors.push('Evidence missing or unsafe'); }
  // Structural consistency and integrity are not authenticated anti-forgery.
  // A repository writer can manufacture matching metadata; sealing stays disabled.
  return errors;
}
export function prepareProofPaths(root, id) {
  if (!Object.values(proofCommands).some(command => command.id === id)) throw new Error('Unknown proof ID');
  const directory = inside(root, 'proofs');
  const artifact = inside(root, `proofs/${id}.output.json`);
  const record = inside(root, `proofs/${id}.json`);
  mkdirSync(directory, { recursive: true });
  // Recheck after creation; never intentionally follow existing links/junctions.
  inside(root, 'proofs'); inside(root, `proofs/${id}.output.json`); inside(root, `proofs/${id}.json`);
  return { artifact, record };
}
