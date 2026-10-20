# Implementação do Canvas Profissional (MVP-CANVAS)

**Autor:** JARDINEIRO
**Branch:** `codex/mvp-professional-canvas`
**Worktree:** `.worktrees/jardineiro-profissional`
**Data:** 20/10/2026
**Status:** Fonte em revisão; unidade/build de frontend executados. Runtime Tauri/PTY e GC-04 não validados.

---

## 1. Visão Geral

Conforme determinado pela diretriz vinculante DA-001 e pela autorização DA-002 do proprietário, a interface do CIRANDA adota o **Modo Profissional Escuro** por padrão. Nenhum elemento cosmético, sprite ou lógica de gamificação rural (Fazenda) foi incorporado nesta entrega.

O frontend entrega um canvas infinito com pan e zoom, nós arrastáveis e redimensionáveis, conexões semânticas direcionais do tipo `context_reference`, agrupamentos lógicos com títulos customizáveis, menus contextuais e integração completa com o terminal xterm segundo o contrato `docs/SESSION_API.md`.

---

## 2. Arquitetura de Componentes

A estrutura foi modularizada em `apps/desktop/src/`:

- **`types/`**:
  - `session.ts`: Tipagem estrita do contrato de sessões (`SessionInfo`, `SessionChunk`, `SessionReadResult`, `WorkspaceInfo`).
  - `canvas.ts`: Tipagem do modelo de dados (`Viewport`, `CanvasNode`, `CanvasEdge`, `CanvasGroup`, `LayoutV1`).
- **`services/`**:
  - `layoutValidator.ts`: Validador formal e sanitizador de schema do Layout v1. Rejeita referências quebradas, IDs duplicados, auto-conexões e dimensões inválidas.
  - `canvasModel.ts`: Funções puras para operações determinísticas de manipulação do canvas (adicionar nós, mover, redimensionar, criar arestas, agrupar, desagrupar e calcular viewport com clamp).
  - `ipc.ts`: Cliente de comunicação desacoplado (`TauriBackendClient` para runtime desktop nativo e `WebPreviewBackendClient` para execução em navegador).
- **`components/`**:
  - `Canvas.tsx`: Orquestrador raiz da renderização, pan, zoom, seleção, captura de atalhos e persistência.
  - `Toolbar.tsx`: Barra superior com indicadores de conectividade, atalhos para criação de nós, agrupamento, zoom e salvamento.
  - `NodeTerminal.tsx`: Card de terminal interativo com `@xterm/xterm`, cabeçalho arrastável, handle de redimensionamento e ciclo de vida desacoplado.
  - `ConnectionLayer.tsx`: Camada SVG de renderização das arestas `context_reference` com curvas cúbicas de Bézier, pontas de seta indicando direção e botão de desconexão.
  - `GroupLayer.tsx`: Camada de agrupamentos com retângulos delimitadores calculados dinamicamente e títulos editáveis.
  - `ContextInspector.tsx`: Painel lateral acessível para inspeção explícita de nós de contexto associados.
  - `ContextMenu.tsx`: Menu de contexto ativado por clique com botão direito.
  - `KeyboardShortcutsModal.tsx`: Diálogo modal acessível com guia de atalhos.

---

## 3. Modelo de Persistência e Validação (Layout v1)

O layout segue rigorosamente o formato v1 especificado em `docs/SESSION_API.md`:

```typescript
interface LayoutV1 {
  version: 1;
  viewport: { x: number; y: number; zoom: number };
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  groups: CanvasGroup[];
}
```

### Regras de Validação:
1. Versão deve ser exatamente `1`.
2. Zoom persistível delimitado entre `0.1` e `4.0`, igual ao backend SQLite; controles do MVP usam `0.2` a `3.0`.
3. Todos os nós devem ter `type: 'terminal'`.
4. Todas as arestas devem ter `type: 'context_reference'`. Auto-conexões (`source === target`) são terminantemente rejeitadas.
5. Referências a nós inexistentes são rejeitadas.
6. Arestas duplicadas entre o mesmo par ordenado de nós são rejeitadas.
7. O salvamento e restauração do layout nunca executa comandos no terminal.
8. Processos de terminais não são restaurados como processos vivos; sessões ausentes são marcadas como `interrupted` e exigem reinicialização explícita.

---

## 4. Integração com Terminal (xterm & SESSION_API)

- Utiliza `@xterm/xterm` (v6.0.0) e `@xterm/addon-fit` (v0.11.0).
- **Ciclo de vida isolado e sem stale closures**: A montagem ou desmontagem do componente React `NodeTerminal` **nunca** fecha a sessão no Rust. Apenas o botão explícito "Parar" ou "Remover e encerrar PTY" chama `session_close`. O listener `term.onData` utiliza referências dinâmicas (`activeSessionIdRef`, `sessionStateRef`), garantindo que o início ou troca de sessão PTY transmita a digitação imediatamente sem necessidade de remontar o terminal.
- **Isolamento de atalhos e teclado**: O dispatcher global de atalhos e os eventos de exclusão ignoram elementos interativos (`.xterm`, `textarea`, `select`, `input`, `contenteditable`). Pressionar `Delete` ou `?` dentro do terminal interativo envia a tecla ao shell em vez de acionar diálogos de exclusão ou ajuda.
- **Fluxo de dados PTY**:
  - Digitação do usuário dispara `terminal.onData` → `session_write(sessionId, data)`.
  - Polling assíncrono para nós com sessão `running` via `session_read(sessionId, afterSeq)`.
  - Bytes recebidos (`number[]`) são injetados diretamente no xterm como `Uint8Array`.
  - Redimensionamento do card ajusta o xterm com `FitAddon` e notifica o backend via `session_resize(sessionId, cols, rows)`.
- **Diferenciação de Ambientes (Nativo vs Navegador)**:
  - No Tauri desktop: conecta-se aos comandos IPC Rust com persistência SQLite (validação de runtime pendente do smoke test desktop).
  - No navegador (Web Preview): exibe aviso claro de que o runtime PTY não está disponível. Não simula saída falsa de comandos ou shell sintetizado. A persistência utiliza `localStorage`.

---

## 5. Política de Conexões `context_reference`

Em conformidade com a decisão DA-001:
- Arestas do tipo `context_reference` são direcionadas (de nó origem para nó destino).
- Servem exclusivamente para associar nós como referência de contexto legível pelo operador.
- **NÃO** disparam execução de texto, pipelines de shell ou injeção automática de prompts.
- O operador pode inspecionar os contextos referenciados a qualquer momento pelo painel `ContextInspector`.

---

## 6. Acessibilidade e Teclado (WCAG 2.1 AA)

- Foco visível com anel de alto contraste em todos os botões e nós.
- Atalhos de teclado documentados e acessíveis via `?`.
- Região `aria-live="polite"` invisível para leitura de eventos por leitores de tela.
- Diálogos de confirmação explícitos para exclusão de nós e encerramento de processos.

---

## 7. Parecer de Revisão Crítica do Backend (SENTINELA - Commit f4a8320)

Em atendimento às diretrizes do plano e à ordem do proprietário, foi realizada auditoria estritamente read-only do commit `f4a832064986263bdb0e157b28d2326274ecae69` entregue pelo FERREIRO na branch `codex/mvp-pty-windows`.

### A. Compatibilidade `windows-sys` vs `std::os::windows::fs::MetadataExt::number_of_links` (Bloqueio P0)
- **Achado Crítico:** Em `apps/desktop/src-tauri/src/path_policy.rs` (linhas 139–142), o código invoca `metadata.number_of_links()`. Esse método da biblioteca padrão do Rust é uma funcionalidade instável (`windows_by_handle`, issue #63010) e resulta em `error[E0658]: use of unstable library feature` no compilador estável (`1.94.1`).
- **Recomendação para o FERREIRO:** Utilizar a API Win32 estável já declarada em `windows-sys` (`Win32_Storage_FileSystem`), chamando `GetFileInformationByHandle` sobre o handle do arquivo (`std::os::windows::io::AsRawHandle`), lendo `nNumberOfLinks` da estrutura `BY_HANDLE_FILE_INFORMATION`.

### B. Sincronismo e Concorrência (`write_all` / `close` / `read`)
- **Mutex e Escrita:** No código inicial, `write_all`/`flush` sob lock podem bloquear indefinidamente; limitar um input a 16 KiB não limita a duração da escrita. A revisão exigiu fila/worker desacoplados.
- **Transição de Estado no Encerramento do Pipe:** Na thread `start_reader`, quando o shell é finalizado pelo operador digitando `exit`, o pipe do ConPTY encerra gerando `ErrorKind::BrokenPipe`. Se o monitor ainda não tiver processado `try_wait()`, a reader thread invoca `session.set_failed_if_running()`, marcando erroneamente a sessão como `Failed` em vez de `Exited`. Recomenda-se tratar `ErrorKind::BrokenPipe` como finalização esperada e chamar `refresh_state()` antes de setar falha.

### C. Aderência ao Schema IPC
- Nomes, tipos e casing dos nove comandos foram comparados estaticamente com SESSION_API. Isso não comprova execução Tauri ou integração do binário. O REGENTE alinhou posteriormente o limite de zoom persistível a `4.0` no validador frontend.

### D. Estado e Persistência do Layout
- Em `storage.rs`, a validação do `Layout` v1 rejeita estritamente versões != 1, nós órfãos, auto-conexões (`source == target`), campos desconhecidos (`deny_unknown_fields`) e dados fora dos limites. O banco SQLite utiliza tabela singleton, integridade via quick check e transações imediatas protegidas contra symlinks e hard links. Nenhum processo é ressuscitado como vivo pós-reinício.

---

## 8. Parecer de Revisão Crítica do Backend (SENTINELA - Commits 39da10a / 9a086fe / 824cff3)

Em conformidade com a designação do REGENTE e as diretrizes do plano mestre, foi realizada a auditoria técnica independente (somente leitura) sobre as revisões entregues pelo FERREIRO na branch `codex/mvp-pty-windows`.

### A. Capacity Accounting e Contabilidade de Processos Vivos
- **Implementação Auditada:** Funções `has_live_process_or_unknown()` e `process_may_be_alive(child_exited, active_job_processes)` em `sessions.rs`.
- **Avaliação:** A contabilidade contra o limite global `MAX_ACTIVE_SESSIONS = 16` deixou de depender do estado puramente declarativo `SessionState`. Uma sessão com estado `Failed` cujo processo filho (`child.try_wait()`) ou processos descendentes no Job Object (`tree.active_process_count() > 0`) ainda estejam vivos continua consumindo a cota de capacidade até sua finalização efetiva.
- **Teste incluído:** `failed_but_live_session_still_counts_toward_active_capacity` cobre a política de capacidade; ainda não executado nesta auditoria estática.

### B. Encerramento com Timeout Delimitado e Job Object
- **Implementação Auditada:** Métodos `close()` em `sessions.rs`, `wait_for_termination()` e `job_object.rs`.
- **Mecanismo de Encerramento:**
  1. `close()` dispara `tree.terminate()` (`TerminateJobObject(handle, 1)`) e `process.child.kill()`.
  2. A função `wait_for_termination()` monitora a saída com polling de 25 ms até o limite de `TERMINATION_TIMEOUT = Duration::from_secs(5)`, exigindo tanto `child_exited == true` quanto `active_job_processes == 0`.
  3. `process.child.wait()` é invocado em seguida para recolher o processo e evitar zumbis no sistema operacional.
  4. Caso ocorra timeout, `*process_guard` é retido (não descartado para `None`), o estado torna-se `Failed` e o erro é retornado, mantendo o processo sob controle do gerenciador de capacidade.
  5. No frontend, o componente retém o nó com erro visual se `closeSession` falhar. Esse comportamento foi observado com IPC de teste; não comprova ausência de órfãos no Windows.

### C. Resolução Segura de Shell Absoluto (`resolve_windows_powershell_path`)
- **Implementação Auditada:** `resolve_windows_powershell_path` em `sessions.rs`.
- **Avaliação de Segurança:**
  - Inspeciona `%SystemRoot%` e exige que seja não-vazio e caminho absoluto (`is_absolute()`). Rejeita caminhos relativos ou variáveis ausentes (*fail-closed*).
  - Constrói o caminho canônico do PowerShell: `%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe`.
  - Verifica explicitamente a existência de arquivo regular via `executable.is_file()`.
  - Passa o caminho absoluto para `CommandBuilder::new`, evitando a resolução do executável pelo PATH/cwd. Isso não avalia a busca de DLLs, a integridade do arquivo ou a confiança no ambiente SystemRoot herdado.

### D. Resolução Definitiva dos Achados Anteriores
1. **Remoção de Feature Instável:** `path_policy.rs` agora utiliza `CreateFileW` com `FILE_FLAG_OPEN_REPARSE_POINT` e `GetFileInformationByHandle` (`nNumberOfLinks`), encapsulado na estrutura RAII `OwnedHandle`. A dependência instável `MetadataExt::number_of_links` foi totalmente erradicada.
2. **Reconciliação de BrokenPipe:** `reconcile_reader_end()` concede janela de até 1 segundo para o `try_wait()` do monitor detectar a terminação natural do shell antes de classificar `BrokenPipe` como falha.
3. **Isolamento de Mutex na Escrita:** Fila de entrada `InputQueue` em thread dedicada garante que consumidores PTY lentos ou bloqueados não travem o loop de eventos ou a chamada de encerramento da fila.

### E. Limites e Status da Auditoria
- **Tipo de Auditoria:** Análise estática profunda de código-fonte (read-only).
- **Restrição Ambiental:** Devido ao espaço em disco no ambiente do host (~370 MB livres em C: após falha do instalador MSVC com 0x80070070), a compilação e execução dos testes Rust não foram realizadas localmente.
- **Classificação:** Os achados revisados tiveram alterações correspondentes no código. O backend está apto para tentativa de compilação/testes na CI; GC-02/03 completos e SESSION_API em runtime permanecem não comprovados. Esta revisão não concede Selo nem aprovação contratual.
