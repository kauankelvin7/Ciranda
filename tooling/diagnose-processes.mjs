import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const started = new Date().toISOString();
const commands = [];
for (const cwd of [root, path.join(root, '.worktrees/ferreiro-profissional')]) {
  for (const executable of [process.execPath, process.env.CIRANDA_GIT_EXE]) {
    if (!executable) throw new Error('CIRANDA_GIT_EXE must name the observed Git executable.');
    const result = spawnSync(executable, ['--version'], { cwd, encoding: 'utf8', shell: false, timeout: 5000 });
    commands.push({ command: [executable, '--version'], cwd, exit_code: result.status,
      error_code: result.error?.code ?? null, error_message: result.error?.message ?? null,
      stdout: result.stdout ?? '', stderr: result.stderr ?? '' });
  }
}
const record = {
  kind: 'process-creation-diagnostic', status: 'observed', commit: process.env.CIRANDA_EVIDENCE_COMMIT ?? null,
  started_at_utc: started, finished_at_utc: new Date().toISOString(),
  environment: { platform: process.platform, arch: process.arch, node: process.version },
  script_sha256: createHash('sha256').update(readFileSync(fileURLToPath(import.meta.url))).digest('hex'),
  commands,
  scope: 'Known executable --version only; no project test code, permission changes, elevation or sandbox bypass. Compare with direct shell invocations. Does not establish the exact OS security rule responsible.',
};
const output = path.join(root, 'proofs/mvp-regente');
mkdirSync(output, { recursive: true });
const filename = path.join(output, `processes-${record.finished_at_utc.replace(/[:.]/g, '-')}.json`);
const bytes = JSON.stringify(record, null, 2) + '\n';
writeFileSync(filename, bytes, { flag: 'wx' });
writeFileSync(filename + '.sha256', createHash('sha256').update(bytes).digest('hex') + '\n', { flag: 'wx' });
console.log(filename);
for (const item of commands) console.log(`${path.basename(item.command[0])}: exit=${item.exit_code}; error=${item.error_code}; cwd=${item.cwd}`);
