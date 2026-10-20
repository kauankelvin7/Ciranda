import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, existsSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
function safeFile(relative) {
  let cursor = root;
  for (const part of relative.split('/')) {
    if (!part || part === '..' || part === '.') throw new Error('Invalid evidence path');
    cursor = path.join(cursor, part);
    try {
      if (lstatSync(cursor).isSymbolicLink()) throw new Error('Evidence links are forbidden');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return cursor;
}
const selection = process.argv[2];
const npmCli = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
const cargo = process.platform === 'win32' ? path.join(process.env.USERPROFILE, '.cargo/bin/cargo.exe') : 'cargo';
const env = { ...process.env, CARGO_HOME: path.join(root, '.cache/cargo'), CARGO_BUILD_JOBS: '1', npm_config_cache: path.join(root, '.cache/npm') };
if (process.platform === 'win32') env.PATH = `${path.dirname(cargo)};${env.PATH}`;
const npm = (...args) => [process.execPath, [npmCli, '--prefix', 'apps/desktop', ...args]];
const rust = (...args) => [cargo, [...args, '--manifest-path', 'apps/desktop/src-tauri/Cargo.toml']];
const checks = {
  'clean-frontend': npm('ci'),
  lint: npm('run', 'lint'),
  types: npm('run', 'typecheck'),
  'frontend-tests': npm('test'),
  frontend: npm('run', 'build'),
  audit: npm('audit', '--audit-level=low'),
  'rust-build': rust('build', '--locked'),
  'rust-tests': rust('test', '--locked'),
  'rust-lint': [cargo, ['clippy', '--locked', '--manifest-path', 'apps/desktop/src-tauri/Cargo.toml', '--', '-D', 'warnings']],
  'rust-fmt': [cargo, ['fmt', '--manifest-path', 'apps/desktop/src-tauri/Cargo.toml', '--', '--check']],
  'rust-tree': rust('tree', '--locked'),
  'codex-help': ['codex', ['--help']],
  'codex-exec-help': ['codex', ['exec', '--help']],
};
if (!Object.hasOwn(checks, selection) || process.argv.length !== 3) {
  console.error(`Choose one: ${Object.keys(checks).join(', ')}`);
  process.exit(2);
}
const git = (...args) => spawnSync('git', args, { cwd: root, encoding: 'utf8', shell: false }).stdout?.trim() ?? '';
const snapshot = () => {
  const files = [...new Set(git('ls-files', '-z', '--cached', '--others', '--exclude-standard').split('\0').filter(Boolean))]
    .filter(file => !file.startsWith('proofs/')).sort();
  const hash = createHash('sha256');
  for (const file of files) {
    hash.update(`${file}\0`);
    const target = safeFile(file);
    hash.update(existsSync(target) ? readFileSync(target) : '<missing>');
    hash.update('\0');
  }
  return hash.digest('hex');
};
const commit = git('rev-parse', 'HEAD');
const dirty = git('status', '--porcelain', '--untracked-files=all');
const sourceHash = snapshot();
const started = new Date().toISOString();
const [exe, args] = checks[selection];
safeFile('proofs/runs');
safeFile(`proofs/runs/${selection}.output.json`);
safeFile(`proofs/runs/${selection}.json`);
const result = spawnSync(exe, args, { cwd: root, env, shell: false, encoding: 'utf8', timeout: 300000, maxBuffer: 4 * 1024 * 1024, windowsHide: true });
const sanitize = text => (text ?? '').replace(/(Bearer\s+)[^\s]+/gi, '$1[REDACTED]').replace(/\b(sk-[A-Za-z0-9_-]{12,})\b/g, '[REDACTED]');
const artifact = JSON.stringify({ stdout: sanitize(result.stdout), stderr: sanitize(result.stderr), error: result.error?.code ?? null }, null, 2);
const artifactName = `proofs/runs/${selection}.output.json`;
mkdirSync(safeFile('proofs/runs'), { recursive: true });
writeFileSync(safeFile(artifactName), artifact);
const hashes = {};
for (const file of ['apps/desktop/package-lock.json', 'apps/desktop/src-tauri/Cargo.lock']) {
  if (existsSync(path.join(root, file))) hashes[file] = createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex');
}
const record = {
  check: selection, status: result.status === 0 && !result.error ? 'pass' : 'failed', exit_code: result.status,
  started_at_utc: started, finished_at_utc: new Date().toISOString(), commit,
  source_clean_at_start: dirty === '', source_sha256: sourceHash,
  source_unchanged: git('rev-parse', 'HEAD') === commit && snapshot() === sourceHash,
  environment: { os: os.type(), release: os.release(), arch: os.arch(), node: process.version },
  command: [exe, ...args], artifact: artifactName,
  artifact_sha256: createHash('sha256').update(artifact).digest('hex'), lockfiles: hashes,
  scope: 'Local check only; not a contract proof, CI run, human approval or runtime validation. Source hash covers tracked and unignored files excluding proofs; dependency caches and build outputs are excluded.',
};
writeFileSync(safeFile(`proofs/runs/${selection}.json`), JSON.stringify(record, null, 2) + '\n');
console.log(`${selection}: ${record.status}; exit=${record.exit_code}; source_clean=${record.source_clean_at_start}; ${artifactName}`);
if (record.status !== 'pass') console.log(sanitize(result.stderr).slice(-5000));
process.exitCode = record.status === 'pass' ? 0 : 1;
