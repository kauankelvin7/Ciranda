# Rastreabilidade individual

Fonte: seção 6 do plano v3. Associação de provas abaixo é planejamento, não cobertura executada. Estado de todas as linhas: **NÃO COMPROVADA**; commit de implementação: nenhum. Critérios completos e IDs literais estão em `contracts/catalog.json`. GC-00 tem suas quatro provas próprias e não implementa estes recursos de produto.

| ID | Recurso | Contrato | Prova planejada |
|---|---|---|---|
| F01 | Workspaces | GC-03/04 | P-03-01, P-04-01 |
| F02 | Canvas | GC-04 | P-04-01, P-04-04 |
| F03 | Terminais | GC-02 | P-02-01..06 |
| F04 | Agentes CLI | GC-05 | P-05-01..04 |
| F05 | Notas | GC-03/10 | P-03-01, P-10-01 |
| F06 | Conexões | GC-03/04 | P-03-01, P-04-01 |
| F07 | Papéis | GC-06 | Critério individual a detalhar antes de ready |
| F08 | Delegação | GC-06/08 | P-08-05; scheduler a detalhar |
| F09 | Arquivos confinados | GC-07/10 | P-10-05; política a detalhar |
| F10 | Prompt composer | GC-10 | P-10-05 |
| F11 | Portal web | GC-10 | P-10-04 |
| F12 | Desenhos | GC-10 | Critério individual a detalhar antes de ready |
| F13 | Templates | GC-10 | P-10-03 |
| F14 | Chat por agente | GC-10 | Critério individual a detalhar antes de ready |
| F15 | Worktree por tarefa | GC-06 | Critério de isolamento a detalhar |
| F16 | Monitoramento | GC-06/08 | Auditoria e retomada a detalhar |
| N01 | Snapshots | GC-03 | P-03-02, P-03-05 |
| N02 | Foco | GC-04 | P-04-02 |
| N03 | LOD | GC-04 | P-04-03, P-04-04 |
| N04 | Replay buffer | GC-02 | P-02-05 |
| N05 | Estado estimado agente | GC-05 | Adaptadores; falsos positivos a detalhar |
| N06 | Sino | GC-07 | Notificações e aprovações a detalhar |
| N07 | Paleta teclado | GC-04 | P-04-05 |
| N08 | Cartas | GC-08 | P-08-01..05 |
| N09 | Diário/timelapse | GC-09 | P-09-01 |
| N10 | Relatório Caramelo | GC-09 | P-09-05 |
| N11 | Busca | GC-10 | P-10-02 |
| G01 | Mapa | GC-09 | P-09-01 |
| G02 | Peões animados | GC-09 | P-09-01, P-09-04 |
| G03 | Plantações/tarefas | GC-09 | P-09-01 |
| G04 | Porteira/sino | GC-09/07 | Política e projeção a detalhar |
| G05 | Clima | GC-09 | P-09-01 |
| G06 | Dia/noite | GC-09 | P-09-01 |
| G07 | Caramelo | GC-09 | P-09-05 |
| G08 | Celeiro | GC-09 | P-09-01 |
| G09 | Sons opt-in | GC-09 | P-09-04 |
| G10 | XP | GC-09 | P-09-03 |
| G11 | Loja cosmética | Futuro P3 | Sem prova/implementação no MVP |
| G12 | Escritório/performance | GC-09 | P-09-02, P-09-04, P-09-07 |
| G13 | Carroça | GC-09 | P-09-01, P-09-04 |

Lacunas de associação não são preenchidas por alegação: cada contrato deve detalhá-las antes de executar. O MVP inclui GC-00..07, núcleo GC-09 e jornada GC-11; adiamento de GC-08/10 não equivale a selo desses contratos.

## Rastreabilidade de Acessibilidade e Interface (Fase 1 - MVP Canvas)

Em conformidade com a autorização DA-002 do proprietário e as diretrizes de acessibilidade WCAG 2.1 AA:

| Requisito / Recurso | Implementação no Frontend | Evidência / Verificação |
|---|---|---|
| **Foco Visível (N02)** | `:focus-visible` com anel de alto contraste (`#58a6ff`, 2px, offset 2px) em todos os botões, nós de terminal, campos de edição e controles. | `apps/desktop/src/styles.css` |
| **Atalhos de Teclado (N07)** | Atalhos globais para criação de nós (`Alt+N`), salvar layout (`Ctrl+S`), zoom (`Ctrl++`, `Ctrl+-`, `Ctrl+0`), exclusão com confirmação (`Delete`) e ajuda (`?`). | `apps/desktop/src/components/Canvas.tsx`, `KeyboardShortcutsModal.tsx` |
| **Região de Anúncios ARIA** | Elemento `aria-live="polite"` invisível (`sr-only`) anunciando criação de nós, conexões, atualizações de status e salvamento de layout para leitores de tela. | `apps/desktop/src/components/Canvas.tsx` |
| **Papeis e Rótulos Semânticos** | Atributos `role="application"`, `role="toolbar"`, `role="region"`, `role="dialog"`, `role="menu"` e `aria-label` descritivos em todos os componentes interativos. | Todos os componentes em `apps/desktop/src/components/` |
| **Conexões Semânticas (F06)** | Conexões `context_reference` associativas para inspeção visual sem execução arbitrária, com inspetor acessível `ContextInspector`. | `apps/desktop/src/components/ContextInspector.tsx` |
| **Modo Profissional Escuro** | Paleta com contraste superior a 4.5:1 para texto normal e 3:1 para controles e bordas, sem componentes rurais/Fazenda. | `apps/desktop/src/styles.css` |

