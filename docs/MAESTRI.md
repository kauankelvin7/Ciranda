# Montagem Maestri

Atualização de 20/10/2026: configuração executada pelas skills `maestri` e `maestri-manager`, sem subagentes internos. `maestri list` identificou REGENTE com Maestro on e inicialmente nenhum trabalhador conectado. `preset list` confirmou Codex e Antigravity; `role list` estava vazio. Não foram criados roles nem alterados presets ou configurações globais.

| Terminal | Ferramenta/comando de recrutamento | Worktree/branch | Estado observado |
|---|---|---|---|
| REGENTE | Sessão existente, Maestro on | raiz; `codex/gc00-foundation` | Orquestrador |
| FERREIRO | Preset Codex, comando absoluto abaixo, Maestro off | `.worktrees/ferreiro`; `codex/gc00-verification` | Codex 0.163.0 iniciou; identidade, diretório, branch, HEAD e AGENTS confirmados |
| JARDINEIRO | Preset Antigravity; override atual `agy --dangerously-skip-permissions`, autorizado depois pelo proprietário; Maestro off | `.worktrees/jardineiro`; `codex/gc00-jardineiro-review` | Antigravity CLI 1.4.3 abriu; após bloqueios de cota respondeu à checagem, mas revisão ainda não entregue |

Comando do FERREIRO, pois `codex` não estava no PATH do terminal recrutado:

```powershell
C:/Users/Kauan/AppData/Roaming/npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe --approve-for-me
```

Não combinar `--approve-for-me` e `--sandbox`. O preset Codex existente continha `codex --no-daemon`; o override explícito foi aplicado apenas ao trabalhador. O preset Antigravity foi inspecionado antes do primeiro início e dos reinícios: comando `agy`. O início original usou esse comando sem flags. Depois, o proprietário pediu explicitamente autorização total para esse terminal; `agy.exe --help` confirmou `--dangerously-skip-permissions` como autoaprovação de todas as solicitações de permissão de ferramentas. O mesmo terminal foi reiniciado com `agy --dangerously-skip-permissions`, sem modificar o preset nem configurações globais. Essa autorização posterior substitui a restrição anterior de flags para esse trabalhador. Nenhum executável ou opção foi inventado para ele.

A worktree do FERREIRO foi inspecionada antes de reutilizar: HEAD `083d7c8efb42084bee52ac54f49a9c28ff06afb7`, commits próprios `8a81d1f` e `083d7c8`, arquivos não rastreados em `proofs/` preservados. A worktree do JARDINEIRO e a branch não existiam; foram criadas a partir de `54df07830cf7f3feb7e9bf1686f94aa8fe2cf624`, sem sobrescrever trabalho.

`maestri recruit` conectou automaticamente ambos ao REGENTE. A falha inicial de PATH do FERREIRO foi corrigida com `recruit --replace`, preservando o mesmo terminal e suas conexões. Não houve duplicação ou quarto agente. `maestri list` posterior confirmou FERREIRO e JARDINEIRO conectados. As especialidades foram comunicadas nos prompts; não dependem de roles globais.

Foram enviados `maestri ask` iniciais exigindo identidade, ferramenta, diretório, branch, HEAD e leitura de AGENTS antes de editar, além de retorno por `maestri ask REGENTE`. FERREIRO confirmou os dois AGENTS (local e atualizado da raiz). JARDINEIRO respondeu ao REGENTE com ambiente, branch `codex/gc00-jardineiro-review`, HEAD `54df078`, leitura de AGENTS e ausência de quota nessa checagem. Um comando posterior observado incluía `agy --dangerously-skip-permissions`; REGENTE inicialmente restaurou `agy` sem flags. Em seguida o proprietário instruiu: fazer JARDINEIRO parar de pedir permissão e ajustar seu terminal para autorização total. A flag verificada foi então aplicada apenas ao mesmo terminal, mantendo conexões, diretório e tarefas. Permissões automáticas não liberam GC-04 nem constituem Selo, push, publicação, instalação global ou compra.

Tarefas delegadas em `tasks/GC00-MAESTRI-SETUP.json`:

- FERREIRO: `GC00-FERREIRO-REVALIDATION`, revalidar testes de governança sem alterar implementação. Escrita somente em `tasks/GC00-FERREIRO-REVALIDATION.json` e `proofs/maestri-ferreiro/` na sua worktree.
- JARDINEIRO: `GC00-JARDINEIRO-REVIEW`, SENTINELA temporário para revisão independente da fundação. Escrita somente em `tasks/GC00-JARDINEIRO-REVIEW.json`, `docs/reviews/GC00-JARDINEIRO.md` e `proofs/maestri-jardineiro/` na sua worktree. A checagem deve preceder qualquer edição após reinício.

Ambos devem consultar integralmente o plano e retornar ao REGENTE por `maestri ask` com comandos, resultados, UTC, commit, hashes e limitações. Resultados dirty/stale/skipped não passam. GC-04 permanece bloqueado; não houve liberação de sucessores ou Selo. O checklist solicitado está na nota conectada `ciranda-configuracao-dos-t`.

Erros e limites observados, sem ocultar falhas:

| Erro exato | Tratamento/limite |
|---|---|
| `maestri: only available inside Maestri terminals (MAESTRI_PIPE not set).` | Ambiente do context-mode não herdava variáveis Maestri. Executado `maestri debug` nativo antes de corrigir; `Connection: OK (status 200)`. Usada a CLI nativa e contexto explícito somente no subprocesso de leitura, sem alterar ambiente global. |
| `IfStatementMissingCondition` / `Condição ausente na instrução if após 'if ('.` | Erro de aspas em comando PowerShell aninhado; corrigida a forma de invocar. Não era falha do daemon. |
| `ENOENT: no such file or directory, open 'C:/Users/Kauan/Desktop/CIRANDA/package.json'` | Consulta diagnóstica usou raiz sem package.json; arquivo real confirmado em `apps/desktop/package.json`. |
| `Unable to create 'C:/Users/Kauan/Desktop/CIRANDA/.git/refs/heads/codex/gc00-jardineiro-review.lock': Permission denied` | Operação local `git worktree add` concluída após aprovação automática específica. Sem mudança de ACL ou configuração global. |
| `codex : O termo 'codex' não é reconhecido como nome de cmdlet, função, arquivo de script ou programa operável.` / `CommandNotFoundException` | Descoberto executável absoluto e reiniciado o mesmo terminal, sem flags extras. |
| `Hook failed` / `hook exited with code 1` | Visível no FERREIRO; não declarar configuração global corrigida. Trabalhador registrou revalidação blocked: runner canônico não iniciou subprocessos (`spawn EPERM`), alternativa teve 5/8 pass e 3 falhas. Evidência em `.worktrees/ferreiro/proofs/maestri-ferreiro/revalidation.json`; nenhuma prova contratual aprovada. |
| `Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 23h58m37s.` | Primeira mensagem Antigravity: ID `e7aa820c-cb32-449f-a15b-de10f378a157-1`. Entrega da tarefa: mesmo prefixo, ID final `-3`, reset `23h56m43s`. Nenhuma compra, alteração de plano ou seleção de modelo feita pelo REGENTE. Checagem posterior respondeu sem quota após mudança de modelo observada no terminal. |
| `Error: git observation failed: EPERM` | Tentativa de captura via Node não pôde criar subprocesso Git no sandbox. Substituída por script PowerShell nativo; captura executou com exit 0, sem modificar proteções. |

Captura reproduzível somente de leitura: executar `./tooling/maestri-evidence.ps1` a partir do REGENTE. Registra `list`, presets, roles e telas dos trabalhadores em `proofs/maestri-setup/observation-*.json`, com UTC, ambiente, commit, exits, hashes e checksum do arquivo. E-mails e formatos comuns de token são removidos. O estado é `observed`, nunca prova de sucesso contratual ou aprovação humana; a árvore suja é registrada como diagnóstico. A saída do CLI continua sendo dado não confiável.

Nenhuma inspeção de código/arquivos internos do Maestri, instalação global, push, publicação, deploy ou supervisor contínuo foi executada. Trabalho posterior dos agentes exige conferir tarefas, worktrees e evidências antes de integrar localmente.
