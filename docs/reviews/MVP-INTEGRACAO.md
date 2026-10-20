# Revisão de integração do MVP profissional

20/10/2026. Revisão do REGENTE; SENTINELA temporário: JARDINEIRO. Nenhum aceite de contrato ou Selo. O backend `f4a8320` ainda não foi compilado e o frontend está em uma worktree separada. Compatibilidade observada de nomes e formas IPC não comprova compatibilidade do binário Tauri.

## Achados enviados aos autores

| ID | Fonte | Achado concreto | Ação / estado |
|---|---|---|---|
| R-01 | PTY `f4a8320`, `path_policy.rs` | `MetadataExt::number_of_links()` é experimental e retorna `Option<u32>`; função declara `u32` | Rust 1.94.1 reproduziu E0658/E0308; API Win32 estável adotada em `e8e3790`, compilação pendente |
| R-02 | PTY `f4a8320`, `sessions.rs` | `write_all` pode bloquear sob o mutex de processos e o mutex global de sessões; impedir `close` | Fila limitada e worker em `e8e3790`; teste de consumidor parado incluído, não executado |
| R-03 | PTY `f4a8320`, `start_reader` | `BrokenPipe` de saída normal pode marcar `failed` antes do monitor observar o exit | Reconciliação EOF/try_wait em `e8e3790`; teste Windows incluído, não executado |
| R-04 | PTY `f4a8320`, `Cargo.toml` | Falta feature `Win32_Security` usada por APIs de criação de handles; lockfile não inclui novas dependências | Feature incluída em `e8e3790`; lock resolvido em `d7799e0`; metadata sem deps e fmt passam, sem compilar |
| R-05 | Canvas `7bcbdb6`, `NodeTerminal` | Callback `onData` captura sessão inicial e não envia a digitação após criar sessão | Corrigido em `7b3bea3`; observação do componente real com IPC de teste confirmou digitação e troca de sessão. Repetir no commit final limpo |
| R-06 | Canvas `7bcbdb6` | Atalhos globais e Delete do nó interceptam textarea do xterm | Corrigido em `7b3bea3`; observação DOM confirmou `?`/Delete sem abrir diálogo |
| R-07 | Canvas `055d159` | `node.sessionId = ...` altera prop sem atualizar o layout do pai ou indicar mudança pendente | Callback imutável em `1ef96d7`; confirmação com `session_list` em `fea7b60`; teste do componente pendente |
| R-08 | Canvas `055d159` | Criação sem proteção de concorrência; remoção apaga nó mesmo se `session_close` rejeitar | Correção inicial em `1ef96d7`; dois cliques no componente ainda criam duas sessões: trava síncrona solicitada |
| R-09 | Canvas `055d159` | Polling para ao receber estado final embora lotes limitados possam deixar saída pendente | Drenagem em `1ef96d7`, teste do componente pendente |
| R-10 | PTY `e8e3790` | Estado `failed` pode manter processo vivo fora da contagem de sessões ativas; close ignora resultado de kill/terminate/wait | Solicitar contagem conservadora e confirmação de encerramento com timeout/erro; validação Windows pendente |

O teste da entrada inicialmente entregue pelo autor copiava o callback em uma função local. Esse teste sozinho não detecta regressão no componente React. O REGENTE exercitou a montagem real e os eventos reais do xterm via portal; o backend usado nessa etapa é explicitamente um test double, sem criar processos.

## Observações reproduzíveis

- `tooling/qa-canvas-ui.ps1`: interações DOM de criar, arrastar, redimensionar, conectar, pan/zoom, salvar e restaurar após reload. Resultado sem falha em `055d159` limpo; evidência local `proofs/mvp-regente/canvas-ui-20261020T152944529Z.json`. Armazenamento dessa etapa: **localStorage de preview**, não SQLite.
- `tooling/qa-session-ui.ps1`: montagem do React/xterm, digitação encaminhada a duas sessões distintas e isolamento de `?`/Delete. Evidência inicial `proofs/mvp-regente/session-ui-mock-20261020T153029325Z.json`: **árvore modificada**, observação diagnóstica, não prova contratual. O script remove o test double por reload ao terminar.
- `proofs/mvp-regente/hard-link-api-check.rs` e `.json/.log`: compilação isolada `rustc --emit=metadata`, sem linker ou dependências externas; exit 1 esperado reproduz o defeito R-01. Não é compilação do aplicativo.
- O primeiro teste do driver de canvas falhou por procurar `style.left`, enquanto os nós usam `transform`. O driver foi corrigido; a execução falha foi preservada, sem atribuí-la a defeito do produto.
- Outra comparação do driver usava igualdade textual de coordenadas CSS. O navegador arredonda valores de ponto flutuante; o driver agora compara `DOMMatrix` com tolerância de 0,01 px. Isso não alterou código de produto.
- O driver do componente encontrou duplicação de sessão ao executar dois cliques antes da resposta IPC. Diferentemente dos erros do driver acima, essa falha reproduziu um defeito no controle de concorrência do componente; correção devolvida ao autor. Provas com árvore modificada são explicitamente diagnósticas e serão repetidas no HEAD limpo.

GC-02/03 completos continuam fora do resultado validado: replay configurável, desempenho/ANSI/TUI sob carga, crash/recovery, snapshots/backup/import/export, tarefas/notas e busca de segredos em eventos não foram comprovados. A implementação SQLite de layout é apenas uma parte do escopo de persistência.

## Ambiente e limite de entrega

Instalação de C++ Build Tools/SDK autorizada pelo proprietário; bootstrapper Microsoft com assinatura válida. Falhou com `-2147024784` / `0x80070070`, espaço insuficiente. Registro local `proofs/mvp-regente/msvc-install-20261020T1521520687166Z.json`. É necessário liberar espaço e concluir a instalação antes de compilar/testar o runtime Windows.

O EPERM foi isolado por diagnóstico pareado: os mesmos subprocessos de versão Node/Git falham no sandbox e passam em execução pontual aprovada. Nenhuma configuração permanente do sandbox foi desativada. Isso explica bloqueios ambientais anteriores, sem transformar testes não executados em sucesso.

Ainda pendentes: compilação Tauri `--locked`, testes Rust/Windows reais, SQLite real, encerramento da árvore, integração xterm/PTY e smoke E2E de abrir → comando real → saída → fechar → reabrir layout. Adaptadores Codex/Antigravity dentro do CIRANDA não estão demonstrados. Fazenda não foi iniciada.
