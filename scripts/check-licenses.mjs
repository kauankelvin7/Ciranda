import { readJson, validateLicenses } from './lib/governance.mjs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const errors = validateLicenses(root, readJson(new URL('../assets/manifest.json', import.meta.url)));
  if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
  else console.log('Asset license gate passed (does not authorize packaging or dependency licensing).');
} catch (error) { console.error(error.message); process.exitCode = 1; }
