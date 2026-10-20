import { writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { git, inside, prepareProofPaths, sha256, sourceIsClean, sourceSnapshot, validateProof } from './lib/governance.mjs';
import { proofCommands as commands } from './lib/proof-commands.mjs';
const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const command = Object.hasOwn(commands, process.argv[2]) ? commands[process.argv[2]] : null;
  if (!command || process.argv.length !== 3) throw new Error(`Usage: node scripts/prove.mjs ${Object.keys(commands).join('|')}`);
  if (!sourceIsClean(root)) throw new Error('Refusing proof: commit source changes first (proofs/ excluded).');
  const paths = prepareProofPaths(root, command.id);
  const commit = git(root, ['rev-parse', 'HEAD']);
  const source = sourceSnapshot(root);
  const start = new Date().toISOString();
  const result = spawnSync(process.execPath, command.args, { cwd: root, encoding: 'utf8', shell: false, timeout: 60000, maxBuffer: 1024 * 1024 });
  // Commands are deterministic synthetic tests: never capture arbitrary CLI/session output.
  const artifact = JSON.stringify({ stdout: result.stdout ?? '', stderr: result.stderr ?? '', error: result.error?.code ?? null, execution: { exit_code: result.status, signal: result.signal } });
  const unchanged = sourceIsClean(root) && sourceSnapshot(root) === source && git(root, ['rev-parse', 'HEAD']) === commit;
  const status = result.status === 0 && !result.error && unchanged ? 'pass' : 'failed';
  const artifactName = `proofs/${command.id}.output.json`;
  inside(root, artifactName);
  writeFileSync(paths.artifact, artifact);
  const proof = { proof_id: command.id, contract_id: 'GC-00', status, commit, source_sha256: source, environment: { os: os.type(), release: os.release(), arch: os.arch(), node: process.version }, command: `node ${command.args.join(' ')}`, exit_code: result.status, started_at_utc: start, finished_at_utc: new Date().toISOString(), artifact: artifactName, artifact_sha256: sha256(artifact), source_unchanged: unchanged, scope: command.scope, reviewer: null, approval_id: null };
  const validationErrors = validateProof(root, proof, command.id);
  if (validationErrors.length) { proof.status = 'failed'; proof.validation_errors = validationErrors; }
  inside(root, `proofs/${command.id}.json`);
  writeFileSync(paths.record, `${JSON.stringify(proof, null, 2)}\n`);
  console.log(`${command.id}: ${proof.status}; evidence ${artifactName}`);
  process.exitCode = proof.status === 'pass' ? 0 : 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
