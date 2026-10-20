// Shared allowlist for execution and validation; records cannot choose a command.
export const proofCommands = Object.freeze({
  'policy-negative': { id: 'P-00-03', args: ['--test', '--test-reporter=tap', 'tests/policy.test.mjs'], scope: 'Mediated action API only; does not intercept arbitrary shells' },
  'licenses-negative': { id: 'P-00-04', args: ['--test', '--test-reporter=tap', 'tests/licenses.test.mjs'], scope: 'Asset gate only; installer pipeline and dependency inventory remain unproven' },
  'governance-tests': { id: 'LOCAL-GOVERNANCE', args: ['--test', '--test-reporter=tap', 'tests/policy.test.mjs', 'tests/licenses.test.mjs', 'tests/proofs.test.mjs'], scope: 'Local governance tests; not evidence of CI execution' },
});
