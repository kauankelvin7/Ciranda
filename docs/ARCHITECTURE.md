# Arquitetura do MVP profissional

Fonte: plano v3.1, decisões DA-001/002/003 e contrato `SESSION_API.md`. CIRANDA usa Tauri v2, Rust, React, TypeScript e SQLite. Fazenda está adiada e será uma apresentação opcional do mesmo estado.

| Camada | Responsabilidade | Implementação corrente |
|---|---|---|
| Execução de agentes/processos | Sessões, PTY, I/O, limites, estados e encerramento | Rust; portable-pty/ConPTY, fila limitada e Job Object em revisão, sem runtime validado |
| Orquestração/delegação | Tarefas, comunicação, dependências e revisão | Fase 2; conexões atuais são referências de contexto para inspeção, sem executar texto |
| Persistência/recuperação | SQLite versionado, transações e recuperação | Rust possui banco de layout; crash/backup/import/export e tarefas/notas completos pendentes |
| Modelo do canvas | IDs, coordenadas, viewport, nós, arestas, grupos e validação | Funções puras TypeScript e Layout v1, sem ownership de processo |
| Apresentação/temas | Eventos, foco, desenho e xterm | React/CSS/SVG escuro profissional; geometria provisória DA-003 |

A UI chama comandos validados. Montar/desmontar componentes não cria nem encerra processos. A criação e o encerramento exigem ações explícitas; um ID persistido só aparece como ativo após confirmação em session_list. Teclas e wheel do xterm preservam sua interação. O callback de entrada consulta refs atualizadas, e a criação usa trava síncrona para impedir duplicatas antes do rerender.

xterm recebe bytes ANSI/UTF-8 por session_read/afterSeq. Nós podem ser movidos e redimensionados; arestas context_reference têm direção e inspetor próprio. Nenhuma referência injeta prompt ou shell. Mensageria e scheduler não são apresentados como implementados.

No Tauri, workspace_load/save usam SQLite do Rust. No preview, localStorage é identificado como armazenamento do navegador e o PTY aparece indisponível. Test doubles são restritos aos drivers de QA e removidos por reload; não fazem parte do produto.

Modelo e IPC têm testes unitários; interações de navegador e digitação do componente foram observadas com IPC de teste. Isso não valida ConPTY, SQLite nativo, shutdown ou o aplicativo desktop. Ver docs/reviews/MVP-INTEGRACAO.md e docs/STATUS.md para os limites de cada evidência.

O grafo vigente de liberação está em contracts/catalog.json. Bloqueio não libera sucessores; a ordem do proprietário permite implementação paralela revisável, sem conceder Selo. A política em scripts/ é ferramenta de desenvolvimento e não fornece sandbox de SO ao shell arbitrário.
