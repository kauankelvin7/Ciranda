# STATUS — CIRANDA

Atualizado em 2026-10-20. **MVP em implementação/revisão; GC-00 bloqueado, nenhum contrato selado.** Plano `CIRANDA_PLANO_MESTRE_V3.md` v3.1 e decisão arquitetural: Profissional padrão; Fazenda opcional, adiada. Implementação paralela autorizada pelo proprietário não libera contratos.

## Implementação e equipe

| Responsável | Entrega observada | Situação |
|---|---|---|
| REGENTE | Plano, arquitetura, SESSION_API v1, contratos, governança, revisão e drivers UI | Integração serial; origin/main recebeu 40d41ae |
| JARDINEIRO | Canvas React/xterm: pan/zoom, nós, resize, conexões context_reference, grupos e layout v1 | Fonte 7bcbdb6; correções 7b3bea3/1ef96d7 em revisão |
| FERREIRO | Nove comandos SESSION_API, portable-pty/ConPTY, limites, Job Object e SQLite | Fonte inicial f4a8320; correções em revisão, sem compilação/testes do backend |
| SENTINELA | Papel temporário do JARDINEIRO: revisão somente leitura do backend | Confirmou API Rust instável e corrida no estado de saída; nenhum quarto agente |

Codex/Antigravity funcionam como trabalhadores externos no Maestri. **Adaptadores dentro do CIRANDA ainda não demonstrados.** Worktrees antigas e provas preservadas.

## Verificações reais

| Verificação | Resultado | Alcance |
|---|---|---|
| Governança no HEAD limpo 40d41ae | 8/8 passaram; LOCAL-GOVERNANCE aprovou | Sem validar runtime desktop |
| Checker de contratos e gate real de assets | Passaram | 12 contratos/71 provas especificadas; DAG acíclico; não são 71 provas executadas |
| Canvas 7bcbdb6 limpo | 20 testes, lint, tipos, build, audit e governança exit 0; hashes conferidos | Frontend/modelo/IPC, sem processo real |
| Canvas após correções P1 | Autor relata 25 testes, tipos/lint exit 0 | Aguardando reexecução integrada |
| UI navegador, 055d159 limpo | Criar, arrastar, redimensionar, conectar, pan/zoom, salvar e recuperar após reload passaram | tooling/qa-canvas-ui.ps1; localStorage de preview |
| React/xterm com IPC de teste | Digitação chegou à sessão 1 e depois à sessão 2; ?/Delete não abriram diálogo | tooling/qa-session-ui.ps1; observação inicial dirty, não prova contratual |
| API hardlinks isolada, Rust 1.94.1 | E0658/E0308 reproduzidos | Defeito real em f4a8320 enviado ao autor; fixture sem linker |
| cargo test --lib inicial | Exit 101 antes de compilar: portable-pty ausente no cache offline | Nenhum teste Rust/Windows declarado passado |
| Diagnóstico pareado | Quatro spawns Node/Git falham EPERM no sandbox e passam em execução pontual aprovada | Sem alteração permanente do sandbox/ACL |
| Instalação MSVC/SDK autorizada | Falhou 0x80070070 / -2147024784, espaço insuficiente | Bootstrapper Microsoft assinado; instalação não concluída |
| CI remota e smoke Tauri/PTY/SQLite | NÃO EXECUTADOS | Impedem alegar MVP executável ou paridade global |

Provas locais em proofs/mvp-regente/, proofs/LOCAL-GOVERNANCE.* e worktrees dos autores. Registros têm commit, árvore, UTC, saída e SHA-256. Evidência dirty/stale é diagnóstica. Achados em [MVP-INTEGRACAO.md](reviews/MVP-INTEGRACAO.md).

## Próximos passos

- [x] Profissional primeiro registrado no plano, arquitetura, contratos e instruções.
- [x] Dois trabalhadores reutilizados, worktrees e allowed_paths separados.
- [x] Entregas recebidas; revisão encontrou defeitos e devolveu correções.
- [x] Canvas/restore observados em navegador; entrada do componente com IPC de teste.
- [x] Primeiro push autorizado confirmado; arquivos publicados auditados.
- [ ] Finalizar correções, revisão e integração somente da fonte adequada.
- [ ] Concluir MSVC/SDK após liberar espaço; compilar com lock atualizado e testar Windows.
- [ ] Smoke nativo: abrir, criar terminal, comando real, saída, encerrar e reabrir layout.

**Intervenção humana necessária:** liberar espaço no C: para concluir instalação/build. Após a falha restaram cerca de 370 MB; observação posterior mostrou 1,28 GB. Nenhum arquivo pessoal será removido automaticamente.

## Limites e histórico

O MVP reduzido não conclui GC-02/03: replay configurável, TUI sob carga, crash/backup/import/export, tarefas/notas e auditoria de segredos exigem provas próprias. SQLite de layout não equivale ao sistema completo de recuperação.

Revalidação antiga do FERREIRO em 083d7c8: BLOCKED (fallback 5/8 pass, três falhas EPERM), auditada em bdae97e. Governança histórica em 54df078 e build frontend em 69c3ddb não validam commits posteriores.

Referência Maestri: inventário do instalador, documentação pública e uso normal; sem desmontar código ou copiar recursos. Ver [análise](ANALISE_MAESTRI.md) e [matriz](PARIDADE_MAESTRI.md).

Somente fonte revisada e resumos sanitizados seguem para https://github.com/kauankelvin7/Ciranda.git. Caches, executáveis, bancos, worktrees, credenciais e provas brutas ignorados. Sem force-push/deploy. Nenhum supervisor contínuo presumido; recuperação em docs/RUNBOOK.md.
