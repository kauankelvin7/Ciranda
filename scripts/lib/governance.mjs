import { appendFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

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
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) throw new Error('Links are not allowed');
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
  if (proof.proof_id !== expectedId || proof.status !== 'pass' || proof.exit_code !== 0) errors.push('Proof did not pass');
  if (proof.commit !== git(root, ['rev-parse', 'HEAD'])) errors.push('Proof commit is stale');
  if (!sourceIsClean(root) || proof.source_sha256 !== sourceSnapshot(root)) errors.push('Source changed since proof');
  try {
    if (sha256(readFileSync(inside(root, proof.artifact))) !== proof.artifact_sha256) errors.push('Evidence hash mismatch');
  } catch { errors.push('Evidence missing or unsafe'); }
  if (!proof.started_at_utc || !proof.environment?.node || !proof.command) errors.push('Incomplete execution metadata');
  return errors;
}
