# Checkpoint de continuação — CIRANDA

Observado em 2026-10-20T19:40:37.952Z. **MVP nativo ainda não validado; nenhum Selo.**

## Fonte publicada

- Fonte integrada: `3b542f856f6386303289f865b5ccda6b496612ec`, branch `codex/professional-first`.
- Este checkpoint: branch `codex/checkpoint-20261020`, criada sobre essa fonte para preservar a CI em andamento.
- [PR de rascunho #1](https://github.com/kauankelvin7/Ciranda/pull/1), sem merge. Main permanece em `34aaf69ae702f80ae455618307d2b155291c8198`.
- Canvas `6a1afd4` e backend `824cff3` integrados; correção do ícone Windows `8f1c213` preservada e integrada.
- Revisão independente do ícone: `44dfb47`, JARDINEIRO como SENTINELA, sem achados bloqueantes estáticos. Harness com espera do xterm: `067c554`.

## Validação no ponto de parada

[CI Windows 39484580459](https://github.com/kauankelvin7/Ciranda/actions/runs/39484580459), job `118841558473`, head `3b542f8`: **in_progress**, etapa ativa: **Rust tests**.

- [x] Frontend: lint, tipos, testes e build.
- [x] Governança, estrutura dos contratos, gate de assets, audit e Rust fmt.
- [ ] Resultado de testes Rust e clippy.
- [ ] Binário Windows e smoke real xterm/ConPTY/SQLite/reabertura.
- [ ] Auditoria independente do log completo e dos hashes.

A etapa Rust inclui compilação; estar em execução não significa testes passados. O inventário estático tem 20 testes: sessões 12 (6 exclusivos de Windows), caminhos 4 e SQLite 4. Nenhum deles é declarado aprovado neste checkpoint. O log final ainda não foi baixado.

A CI anterior `39476973848` falhou antes dos testes por ícone ausente; log local e SHA-256 preservados em `proofs/mvp-regente/`. Verificação local em `3b542f8`: rustfmt, sintaxe do harness, estrutura de contratos e gate de assets passaram. Não equivalem a runtime.

## Retomada, sem duplicar trabalho

1. Ler AGENTS.md, plano v3.1, decisões arquiteturais e este checkpoint; conferir Git/status e `maestri list`.
2. Consultar primeiro a CI acima. Não iniciar outro run nem atualizar a branch do PR enquanto ela estiver ativa: isso pode cancelar a execução pela regra de concorrência.
3. Quando terminar, baixar o log do job e salvá-lo em `proofs/mvp-regente/`; entregar cópias idênticas dentro de `.worktrees/ferreiro-profissional/proofs/mvp-pty/` e `.worktrees/jardineiro-profissional/proofs/mvp-canvas/`. Calcular/conferir SHA-256 das três cópias. Não publicar logs brutos.
4. FERREIRO diagnostica falhas reais de Rust/PTY/Windows/SQLite na própria worktree; JARDINEIRO audita os resultados como SENTINELA temporário e revisa correções independentemente. Ambos retornam por `maestri ask REGENTE` e atualizam suas notas.
5. Conferir o SHA efetivo do checkout de PR: pode ser um merge sintético. Relacionar árvore e head do run antes de atribuir evidência.
6. Integrar somente fonte revisada, executar os testes apropriados e preservar falhas. O smoke precisa abrir app real, criar sessão, digitar comando, observar saída sem aceitar echo, fechar sessão e restaurar layout após reinício.
7. Atualizar STATUS, tarefas e notas com resultados reais. Paridade, adaptadores Codex/Antigravity, contratos completos e Selo continuam sem comprovação automática.

## Trabalhadores e limites

- REGENTE: coordenação, integração e evidências; notas `REGENTE` e conexões existentes preservadas.
- FERREIRO: `.worktrees/ferreiro-profissional`, `codex/mvp-pty-windows`, HEAD `8f1c213`; alterações anteriores preservadas. Allowed paths: src-tauri, docs/PTY_IMPLEMENTATION.md, tasks/MVP-PTY.json e proofs/mvp-pty.
- JARDINEIRO: `.worktrees/jardineiro-profissional`, `codex/mvp-professional-canvas`, revisão `44dfb47`. Allowed paths: docs/CANVAS_IMPLEMENTATION.md, tasks/MVP-CANVAS.json e proofs/mvp-canvas; frontend/harness somente por falha real atribuída a eles.
- Três agentes no máximo; SENTINELA é papel temporário. Sem subagentes internos, novos terminais, Fazenda ou bypass de sandbox.
- Instalação local MSVC/SDK autorizada, mas incompleta por espaço. Nova medição: 1.342.197.760 bytes livres (~1,25 GiB). Instalador exige reserva operacional de 10 GiB; não repetir nem apagar dados pessoais. A CI é independente desse bloqueio.
- Promoção direta a main foi rejeitada pela revisão automática; a alternativa aceita foi PR de rascunho sem merge. Não tentar contornar a rejeição. Fonte revisada pode ser enviada à branch autorizada; sem force-push, deploy, binários, segredos ou provas brutas.

Não há supervisor contínuo presumido. A CI remota já iniciada pode concluir após este checkpoint; sua conclusão ainda precisa ser consultada e auditada.
