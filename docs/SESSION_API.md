# Contrato UI ↔ Rust do MVP profissional (v1)

Especificação de integração; não afirma implementação. REGENTE mantém este contrato. JARDINEIRO possui frontend; FERREIRO possui `src-tauri`. Comandos Tauri usam argumentos camelCase e resultados JSON camelCase. Erros retornam rejeição da promise com mensagem legível e sem segredos.

| Comando | Argumentos | Resposta |
|---|---|---|
| `workspace_info` | nenhum | `{ root: string, platform: string }` |
| `session_create` | `{ cwd?: string, cols: number, rows: number }` | `SessionInfo` |
| `session_list` | nenhum | `SessionInfo[]` |
| `session_write` | `{ sessionId: string, data: string }` | `null` |
| `session_resize` | `{ sessionId: string, cols: number, rows: number }` | `null` |
| `session_read` | `{ sessionId: string, afterSeq: number }` | `{ sessionId, chunks: [{ seq: number, data: number[] }], state, truncated: boolean }` |
| `session_close` | `{ sessionId: string }` | `null` |
| `workspace_load` | nenhum | `string` com JSON do layout v1, ou `null` se ausente |
| `workspace_save` | `{ layoutJson: string }` | `null` |

`SessionInfo = { id: string, cwd: string, state: 'running' | 'exited' | 'closed' | 'failed', cols: number, rows: number }`. `seq` crescente por chunk; `afterSeq=0` inicia replay. Bytes ANSI/UTF-8 via `Uint8Array`, nunca HTML. Leitura limitada e ring buffer limitado; frontend faz polling apenas para terminais visíveis, sem fechar sessão ao desmontar. `session_close` idempotente; resize não inicia shell. Uma sessão encerrada nunca volta automaticamente a running.

O root é escolhido no backend a partir de `CIRANDA_WORKSPACE_ROOT` do launcher ou cwd validado; UI não fornece nem altera root. `cwd` relativo ao root, recusando escape, links/junctions indevidos, caminhos UNC/dispositivo, ADS e nomes reservados. Shell inicial: PowerShell do Windows com perfil desabilitado, sem execução de texto extra ao criar. Limites de input/dimensões/quantidade de sessões são validados no backend. Job Object Windows encerra árvore de processos ao fechar sessão/app. Documentar limitações reais do confinamento de shell.

Layout v1: `{ version: 1, viewport: {x,y,zoom}, nodes: [{id,type:'terminal',x,y,width,height,title,sessionId?:string}], edges: [{id,source,target,type:'context_reference'}], groups: [{id,title,nodeIds:string[]}] }`. Validar tipos/tamanho antes de persistir. IDs de processo e conteúdo bruto de terminal não são restaurados como processos vivos; sessão ausente após reinício aparece interrupted e requer ação explícita para recriar. SQLite fica no workspace, em `.ciranda/state.sqlite`, protegido contra links. Salvar layout não executa comandos.

No runtime nativo persistência usa SQLite via estes comandos; um preview de navegador pode usar armazenamento local com indicação clara de que não há terminal real. Falha de IPC não pode gerar saída simulada ou sucesso falso. O frontend deve adaptar erros de forma visível e manter layout recuperável.
