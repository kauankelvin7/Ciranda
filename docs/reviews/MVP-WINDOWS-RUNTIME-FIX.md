# MVP-WINDOWS-RUNTIME-FIX — revisão preparada

**Estado:** implementação pronta para revisão independente do REGENTE; sem aprovação de contrato, sem Selo.

## Base e escopo

- Branch: `codex/mvp-windows-runtime-fix`
- Base: `423e7bdf12fe145009bf6145e07f56bd08fc035f` (parent `9ff17e2bd1a602e32c6a5bcec5150ff875c4ff54`)
- Finalização estreita assumida temporariamente por JARDINEIRO sob ordem do REGENTE após FERREIRO atingir cota Codex.
- Allowed paths: `path_policy.rs`, `tasks/MVP-WINDOWS-RUNTIME-FIX.json`, `docs/reviews/MVP-WINDOWS-RUNTIME-FIX.md` e `proofs/mvp-pty/windows-validation/runtime-fix/`.
- `sessions.rs`, `job_object.rs`, arquivos IPC, manifesto, dependências ou lockfile não foram tocados neste lote.

## Causas e evidências

### Prefixo de caminho Windows (CI 39604837626)

Na execução de CI `39604837626` (job `119238256266`), 18 de 21 testes passaram (12 de sessions e 4 de storage passaram com êxito). As 3 únicas falhas ocorreram em `path_policy`:
- `canonical_workspace_root_components_can_be_inspected`
- `cwd_accepts_workspace_and_nested_directories`
- `workspace_root_uses_configured_absolute_directory`

Todas as três falharam com a mensagem `"workspace path cannot be inspected"`.

**Causa raiz isolada:**
No Windows (confirmado experimentalmente em Rust 1.94.1), um prefixo de disco verbatim como `\\?\C:` tem `is_absolute() == true` antes que o separador de raiz `Component::RootDir` seja iterado. No commit `423e7bd`, a condição de guarda verificava apenas `if !current.is_absolute() { continue; }`. Consequentemente, para caminhos canônicos (`\\?\C:\...`), o prefixo incompleto `\\?\C:` não era pulado e `fs::symlink_metadata(r"\\?\C:")` era invocado. Na API Win32, consultar atributos de `\\?\C:` sem a barra final retorna o erro de sistema operacional 1 (`ERROR_INVALID_FUNCTION` / `Função incorreta`), que `path_policy` mapeava para `"workspace path cannot be inspected"`.

**Solução refinada e Fail-Closed:**
1. Introduzida a flag `root_seen`, marcada como verdadeira apenas quando `Component::RootDir` é anexado ao caminho acumulado `current`:
```rust
if !root_seen || !current.is_absolute() {
    continue;
}
```
Isso garante que tanto prefixos de drive padrão (`C:`) quanto prefixos verbatim (`\\?\C:`, `\\?\UNC\server\share`) sejam ignorados até que a raiz completa (`C:\`, `\\?\C:\`) esteja montada. A partir do momento em que a raiz é montada, cada componente subsequente continua sendo inspecionado estritamente.

2. **Blindagem Fail-Closed contra caminhos sem RootDir:**
Para garantir que nenhum caminho sem raiz explícita pule todas as consultas e retorne `Ok(())` (por exemplo, `\\?\C:`, caminhos relativos ou drive-relative `C:foo`), adicionou-se:
- Validação inicial `if !path.is_absolute() { return Err("workspace path must be an absolute path with a root directory".into()); }`.
- Verificação pós-loop `if !root_seen { return Err("workspace path must be an absolute path with a root directory".into()); }`.
Desta forma, todo caminho aceito inspeciona obrigatoriamente a raiz completa e todos os componentes, e qualquer caminho sem raiz explícita falha fechado imediatamente.

### Harness PTY e sessões Windows (confirmados no CI)

O harness de PTY Windows com resposta a consultas `CSI 6 n` e diagnóstico delimitado comprovou seu funcionamento no CI `39604837626`: todos os 12 testes de sessões (incluindo PTY real do PowerShell, timeouts com diagnóstico, encerramento de descendente no Job Object e isolamento entre sessões) passaram sem falhas.

## Mudanças

- `apps/desktop/src-tauri/src/path_policy.rs`:
  - `reject_reparse_components` aguarda `root_seen` e `current.is_absolute()` antes de inspecionar metadados, evitando consulta inválida sobre `\\?\C:`.
  - Inspeciona cada componente individual após a raiz completa.
  - Implementa verificação fail-closed exigindo `path.is_absolute()` e `root_seen` explícito.
  - Mantidas asserções e rejeições estritas contra travessia (`..`), junctions/symlinks, ADS, nomes reservados e caminhos de dispositivo/UNC.
  - Adicionado teste unitário `reject_reparse_components_rejects_parent_traversal` e validação dupla (caminho padrão e canônico verbatim) em `canonical_workspace_root_components_can_be_inspected`.
  - Adicionado teste unitário `reject_reparse_components_rejects_paths_without_root_directory` testando 5 variações sem raiz (`relative`, `""`, `\\?\C:`, `C:foo\bar`, `\foo\bar`).
- `tasks/MVP-WINDOWS-RUNTIME-FIX.json`:
  - Metadados atualizados com hash SHA-256 do arquivo modificado (`2f2d65f2d8849a589451408035908368398bfd048e73b271268a129a077e177d`), evidências do CI 39604837626 e checks leves instrumentados com 9 experimentos.

## Checks e pendências

- `git diff --check` no arquivo `path_policy.rs`: exit 0, limpo.
- Experimento e suíte de verificação de 9 casos com `rustc 1.94.1`: aprovado (verificados caminhos padrão, canônico verbatim, diretório aninhado, rejeição de travessia e 5 casos de fail-closed sem RootDir).
- Parse JSON da tarefa `tasks/MVP-WINDOWS-RUNTIME-FIX.json`: exit 0, sem BOM.
- `cargo check`, `cargo test`, build, Clippy e runtime nativo: não executados localmente por instrução explícita de economia de recursos ("sem Cargo pesado"); validação final dependerá da revisão independente do REGENTE e da próxima CI.
- Nova CI e push: não executados; aguardam revisão e autorização do REGENTE.
- Nenhum Selo, liberação de GC-04 ou alegação de runtime nativo validado sem testes completos.
