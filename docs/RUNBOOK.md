# Recuperação da operação

1. Abrir este repositório; ler AGENTS.md, plano v3, docs/STATUS.md, docs/DECISIONS.md e os contratos.
2. Conferir `git status --short --branch`, `git log -5 --oneline` e `git worktree list`. Nunca sobrescrever trabalho em andamento.
3. Ler `tasks/backlog.md` e tarefas estruturadas. Identificar dono, caminhos permitidos, branch e último commit antes de retomar.
4. Conferir executáveis e versões. Rust pode estar em `%USERPROFILE%\.cargo\bin` fora do PATH; ajustar somente o ambiente do processo. Caches npm/Cargo ficam em `.cache/` no projeto.
5. Instalar por `npm ci` e executar lint, tipos, testes, auditoria e builds conforme README. Uma prova de outro commit ou árvore modificada não é válida automaticamente.
6. Revisão independente inspeciona código, logs e hashes. O proprietário aceita ou recusa o Selo. Nunca preencher essa aprovação por conveniência.
7. Só liberar contratos sucessores após satisfazer os gates do plano. Atualizar STATUS e tarefas após cada mudança real.

Não há daemon, rotina agendada ou supervisor contínuo ativo. Esta sessão não continuará indefinidamente depois de encerrada. Para retomar, iniciar o Regente com as instruções versionadas. Qualquer tarefa ativa após reinício fica `interrupted` até revisão do estado; não reenviar comandos cegamente.

Manter no máximo Regente + dois trabalhadores. SENTINELA é papel temporário: reutilizar um slot e reduzir concorrência antes de compilar Rust. Worktrees em `.worktrees/` são ignoradas pelo Git principal; manter até preservar/revisar os commits. Não remover worktrees com alterações sem inspeção.
