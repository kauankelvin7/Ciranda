# MVP-WINDOWS-RUNTIME-FIX — revisão preparada

**Estado:** implementação pronta para revisão independente do REGENTE; sem aprovação de contrato, sem Selo.

## Base e escopo

- Branch: `codex/mvp-windows-runtime-fix`
- Base: `423e7bdf12fe145009bf6145e07f56bd08fc035f` (parent `9ff17e2bd1a602e32c6a5bcec5150ff875c4ff54`)
- Finalização estreita assumida temporariamente por JARDINEIRO sob ordem do REGENTE após FERREIRO atingir cota Codex.
- Allowed paths: `path_policy.rs`, `tasks/MVP-WINDOWS-RUNTIME-FIX.json`, `docs/reviews/MVP-WINDOWS-RUNTIME-FIX.md` e `proofs/mvp-pty/windows-validation/runtime-fix/`.
- `sessions.rs`, `job_object.rs`, arquivos IPC, manifesto, dependências ou lockfile não foram tocados neste lote.

## Causas e evidências

### Validação dos Testes Rust na CI (CI 39626023848)

Na execução de CI `39626023848` (job `119311368072`, checkout `647adad9d2f85a5b5fff603d0661278e902013cd`), **todos os 23 testes Rust foram aprovados** (23 passed, 0 failed, 0 ignored em 3.17s):
- 12 testes de `sessions` aprovados (incluindo PTY ConPTY real, encerramento de descendente no Job Object, anti-echo e timeouts com diagnóstico).
- 4 testes de `storage` aprovados.
- 7 testes de `path_policy` aprovados (confirmando a eficácia da resolução de prefixo verbatim `\\?\C:` com `root_seen` e da blindagem *fail-closed*).

### Achado Único de Clippy (CI 39626023848)

A etapa de Clippy falhou exclusivamente no lint `manual_pattern_char_comparison` em `src/path_policy.rs:65:27`:
```
65 |     for part in raw.split(|ch| ch == '/' || ch == '\\') {
   |                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^ help: consider using an array of `char`: `['/', '\\']`
   = note: `-D clippy::manual-pattern-char-comparison` implied by `-D warnings`
```
Devido ao erro no Clippy (`exit code 1`), as etapas subsequentes de build Tauri e smoke nativo foram puladas pelo workflow.

**Correção Implementada:**
- Substituída a closure por array de caracteres equivalente: `raw.split(['/', '\\'])`.
- Sem adicionar `#[allow(...)]`, sem enfraquecer lints do projeto, sem alterar workflows de CI.
- Todos os 23 testes unitários continuam preservados e válidos.

## Mudanças

- `apps/desktop/src-tauri/src/path_policy.rs`:
  - `resolve_cwd`: `raw.split(['/', '\\'])` adotado conforme recomendação idiomática do Clippy.
  - `reject_reparse_components`: preservados o guard `root_seen` e a blindagem *fail-closed* (`!path.is_absolute()` e `!root_seen`).
  - Testes unitários existentes preservados integralmente.
- `tasks/MVP-WINDOWS-RUNTIME-FIX.json`:
  - Metadados atualizados com informações do run `39626023848`, checkout `647adad9d2f85a5b5fff603d0661278e902013cd`, status de 23 testes Rust passados e hash SHA-256 do fonte modificado (`47fd122503fdf567b5f5ad645c7e8ad66d850f161a374be251e3d4f82ada301d`).

## Checks e pendências

- `git diff --check` no arquivo `path_policy.rs`: exit 0, limpo.
- Parse JSON da tarefa `tasks/MVP-WINDOWS-RUNTIME-FIX.json`: exit 0, sem BOM.
- `cargo check`, `cargo test`, build, Clippy e runtime nativo: não executados localmente por instrução explícita de economia de recursos ("sem Cargo pesado"); validação final dependerá da revisão independente do REGENTE e da próxima CI.
- Nova CI e push: não executados; aguardam revisão e autorização do REGENTE.
- Nenhum Selo, liberação de GC-04 ou alegação de runtime nativo validado sem testes completos.
