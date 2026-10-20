# Backlog operacional

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
