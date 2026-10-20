import { auditAction } from './lib/governance.mjs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
try {
  const decision = auditAction(root, { action: process.argv[2] });
  console.log(JSON.stringify(decision));
  process.exitCode = decision.allowed ? 0 : 1;
} catch (error) { console.error(error.message); process.exitCode = 1; }
