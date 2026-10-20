# Ambiente diagnosticado

Data local: 2026-10-20, America/Sao_Paulo. Windows 11 Pro x64, memória visível 8.279.756 KiB; livre no diagnóstico inicial 1.471.864 KiB (instantâneo, não benchmark).

| Ferramenta | Resultado observado |
|---|---|
| Node | v24.0.2, PATH |
| npm | 11.19.1, PATH |
| Git | 2.49.0.windows.1 |
| Codex | 0.163.0-alpha.10.2, PATH |
| Rust | rustc 1.94.1, fora do PATH; localizado em instalação padrão .cargo/bin |
| Cargo | 1.94.1, fora do PATH; executado por caminho absoluto |
| rustfmt | componente ausente no toolchain atual; verificação falhou |
| MSVC | `link.exe` não encontrado pelo build; vswhere ausente no local padrão |
| Maestri | comando não encontrado; MAESTRI_CLI ausente |
| Antigravity | agy/antigravity não encontrados no PATH |

`cargo generate-lockfile` executou e resolveu 407 pacotes. O build com um job falhou ao compilar proc-macro2: `linker link.exe not found`. Instaladores globais de Visual Studio/Build Tools alterariam o Windows e estão fora das permissões desta missão; nenhuma instalação foi iniciada.

Verificação de modelos: esta sessão não acessou credenciais nem catálogo autenticado do Codex CLI ou Antigravity. Modelo de CLI disponível não comprovado; não declarar que um modelo específico foi selecionado nos terminais Maestri.

Frontend: instalação npm local, lint, tipos, build e auditoria executados com exit 0; auditoria reportou zero vulnerabilidades naquele momento. Registros reproduzíveis são gerados por `node tooling/check.mjs <check>` em proofs/runs, com commit, hashes e indicador de árvore limpa. Esses registros são verificações locais, não Selos.

Nenhum aplicativo Tauri foi iniciado e nenhum instalador foi produzido. Nenhuma sessão PTY, persistência SQLite ou fluxo de aprovação do produto foi comprovado. Nenhuma CI remota foi executada.
