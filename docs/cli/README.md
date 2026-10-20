# Registro das CLIs

Coleta: 2026-10-20. Codex CLI 0.163.0-alpha.10.2; executável descoberto no PATH. O ambiente Node usado pelo coletor está no JSON de cada execução.

- `codex --help`: [saída bruta sanitizada](../../proofs/runs/codex-help.output.json), [metadados UTC/commit/hash](../../proofs/runs/codex-help.json).
- `codex exec --help`: [saída bruta sanitizada](../../proofs/runs/codex-exec-help.output.json), [metadados](../../proofs/runs/codex-exec-help.json).
- Antigravity: agy/antigravity não encontrados no PATH; versão, modelos e capacidades NÃO COMPROVADOS.
- Maestri: comando e MAESTRI_CLI indisponíveis; sem captura de ajuda.

Reproduzir por `node tooling/check.mjs codex-help` e `node tooling/check.mjs codex-exec-help`. Os artefatos gerados ficam locais e não são commitados. `--help` comprova a presença de flags, não que sessões/modelos/autenticação ou sandbox funcionem. Nada nessa coleta acessa credenciais pessoais.
