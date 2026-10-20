import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { git, sha256, sourceIsClean, sourceSnapshot } from './lib/governance.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
const commands = {
  'policy-negative': { id: 'P-00-03', args: ['--test', 'tests/policy.test.mjs'], scope: 'Mediated action API only; does not intercept arbitrary shells' },
  'licenses-negative': { id: 'P-00-04', args: ['--test', 'tests/licenses.test.mjs'], scope: 'Asset gate only; installer pipeline and dependency inventory remain unproven' },
  'governance-tests': { id: 'LOCAL-GOVERNANCE', args: ['--test', 'tests/policy.test.mjs', 'tests/licenses.test.mjs', 'tests/proofs.test.mjs'], scope: 'Local governance tests; not evidence of CI execution' },
};
try {
  const command = commands[process.argv[2]];
  if (!command || process.argv.length !== 3) throw new Error(`Usage: node scripts/prove.mjs ${Object.keys(commands).join('|')}`);
  if (!sourceIsClean(root)) throw new Error('Refusing proof: commit source changes first (proofs/ excluded).');
  const commit = git(root, ['rev-parse', 'HEAD']);
  const source = sourceSnapshot(root);
  const start = new Date().toISOString();
  const result = spawnSync(process.execPath, command.args, { cwd: root, encoding: 'utf8', shell: false, timeout: 60000, maxBuffer: 1024 * 1024 });
  // Commands are deterministic synthetic tests: never capture arbitrary CLI/session output.
  const artifact = JSON.stringify({ stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error?.code ?? null });
  const unchanged = sourceIsClean(root) && sourceSnapshot(root) === source && git(root, ['rev-parse', 'HEAD']) === commit;
  const status = result.status === 0 && !result.error && unchanged ? 'pass' : 'failed';
  mkdirSync(new URL('../proofs/', import.meta.url), { recursive: true });
  const artifactName = `proofs/${command.id}.output.json`;
  writeFileSync(new URL(`../${artifactName}`, import.meta.url), artifact);
  const proof = { proof_id: command.id, contract_id: 'GC-00', status, commit, source_sha256: source, environment: { os: os.type(), release: os.release(), arch: os.arch(), node: process.version }, command: `node ${command.args.join(' ')}`, exit_code: result.status, started_at_utc: start, finished_at_utc: new Date().toISOString(), artifact: artifactName, artifact_sha256: sha256(artifact), source_unchanged: unchanged, scope: command.scope, reviewer: null, approval_id: null };
  writeFileSync(new URL(`../proofs/${command.id}.json`, import.meta.url), `${JSON.stringify(proof, null, 2)}\n`);
  console.log(`${command.id}: ${status}; evidence ${artifactName}`);
  process.exitCode = status === 'pass' ? 0 : 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
