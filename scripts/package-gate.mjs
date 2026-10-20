import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
// Check licenses first so missing license evidence is a blocking condition even
// while release authorization is absent. Never invoke an installer from this gate.
const licenses = spawnSync(process.execPath, ['scripts/check-licenses.mjs'], { cwd: root, encoding: 'utf8', shell: false });
process.stdout.write(licenses.stdout ?? '');
process.stderr.write(licenses.stderr ?? '');
if (licenses.status !== 0) {
  console.error('PACKAGING DENIED: asset license gate failed.');
} else {
  console.error('PACKAGING DENIED: required contract seals, independent release review and authenticated owner authorization are unavailable.');
}
process.exitCode = 1;
