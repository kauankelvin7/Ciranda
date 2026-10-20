# Backlog operacional

Prioridade vinculante: **Fase 1 profissional → Fase 2 orquestração autônoma → Fase 3 Fazenda opcional**. A ordem posterior do proprietário autoriza implementar canvas/PTY agora em paralelo isolado, sem considerar gates aprovados. Nenhuma Fazenda na missão atual.

| Tarefa atual | Responsável | Branch/worktree | Estado real | Próxima verificação |
|---|---|---|---|---|
| MVP-PROFESSIONAL | REGENTE | codex/professional-first; raiz | executing | Integrar após revisão, preparar toolchain e executar smoke real |
| MVP-CANVAS | JARDINEIRO | codex/mvp-professional-canvas; .worktrees/jardineiro-profissional | review | Conferir 7bcbdb6/ff4ef17, testes e comportamento na UI; não presumir PTY validado |
| MVP-PTY | FERREIRO | codex/mvp-pty-windows; .worktrees/ferreiro-profissional | executing | Implementação/negativos/encerramento seguro; testar após MSVC disponível |
| Revisão backend | JARDINEIRO como SENTINELA temporário | mesma equipe, sem quarto agente | queued | Aguardar commit FERREIRO; leitura/revisão, sem disputar seus arquivos |
| Análise de referência/remote | REGENTE | mesma branch | executing | Inventário/public docs; fonte sanitizada no GitHub autorizado |

Histórico preservado abaixo; estados antigos não liberam contratos e são substituídos pelas tarefas atuais.

| Tarefa | Contrato | Responsável | Branch/worktree | Estado | Próxima ação |
|---|---|---|---|---|---|
| TASK-000 diagnóstico e governança | GC-00 | REGENTE | checkout principal | executing | Registrar provas e bloqueios |
| TASK-001 verificadores | GC-00 | FERREIRO | codex/gc00-verification; .worktrees/ferreiro | executing | Testes negativos e revisão |
| TASK-002 revisão independente | GC-00 | SENTINELA temporária | somente leitura | review | Reavaliar entrega integrada |
| TASK-003 frontend/canvas | GC-04 | JARDINEIRO | não criada | blocked | GC-00/01/02/03 e CLI Antigravity |
| GC00-MAESTRI-SETUP | GC-00 | REGENTE | codex/gc00-foundation | review | Terminais e conexões confirmados; checklist na nota Maestri |
| GC00-FERREIRO-REVALIDATION | GC-00 | FERREIRO | codex/gc00-verification; .worktrees/ferreiro | blocked | Evidências registram spawn EPERM; alternativa 5/8 pass e 3 falhas, sem prova aprovada |
| GC00-JARDINEIRO-REVIEW | GC-00 | JARDINEIRO como SENTINELA temporário | codex/gc00-jardineiro-review; .worktrees/jardineiro | queued | Revisão reenviada após autorização explícita de permissões automáticas no terminal |

GC-01..11 aguardam dependências. Últimos commits e provas efetivas: docs/STATUS.md. Não atribuir `done` sem evidência e revisão.
As novas tarefas têm allowed_paths separados em `tasks/GC00-MAESTRI-SETUP.json`. A worktree de revisão do JARDINEIRO não libera TASK-003/GC-04. Máximo REGENTE + dois trabalhadores, sem subagentes internos.
