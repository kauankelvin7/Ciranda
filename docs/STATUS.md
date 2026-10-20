# STATUS — CIRANDA

Atualizado em 2026-10-20. **Fonte do MVP integrada; runtime Windows ainda não validado. GC-00 bloqueado, nenhum Selo.** Modo Profissional padrão; Fazenda adiada.

Checkpoint publicado na branch `codex/checkpoint-20261020`: [continuação e passos exatos](CHECKPOINT_CONTINUACAO.md). A CI do PR #1 foi retomada no run `39484580459`: frontend, governança, contratos, assets, audit e fmt passaram; na última consulta, Rust tests ainda em execução. Não declarar testes Rust, binário ou smoke aprovados.

## Entregas e equipe

| Responsável | Resultado observado | Trabalho atual |
|---|---|---|
| REGENTE | Integração de frontend e backend em `34aaf69`, revisão e coordenação | Consolidar correção de build, harness e evidências |
| FERREIRO | SESSION_API v1, ConPTY, Job Object, limites e SQLite integrados a partir de `824cff3` | Ícone Windows `8f1c213` integrado após revisão estática; execução pendente |
| JARDINEIRO | Canvas/xterm integrado a partir de `6a1afd4` | Harness ajustado em `067c554`; revisão independente do ícone em `44dfb47` concluída como SENTINELA temporário |

REGENTE + dois trabalhadores existentes, em worktrees separadas. Nenhum quarto agente. Notas `REGENTE`, `TAREFA FERREIRO` e `TAREFA JARDINEIRO` conectadas. O root inicial do FERREIRO foi corrigido para a worktree real ao retirar o papel automático que o iniciava em `.maestri/roles/...`; nenhuma proteção de acesso foi contornada.

## Verificação real

| Verificação | Resultado e alcance |
|---|---|
| Frontend em `34aaf69` limpo e inalterado | 24 testes passaram; lint, tipos e build exit 0 |
| Formatação Rust em `34aaf69` | Exit 0; não compila nem executa o backend |
| Governança local em `34aaf69` | 8/8 passaram; sem aceite contratual |
| Canvas no navegador | Criar, arrastar, redimensionar, conectar, pan/zoom, salvar e recuperar passaram; persistência de preview via localStorage |
| React/xterm com IPC de teste em `34aaf69` limpo | Entrada, troca de sessão, proteção contra criação concorrente, erro de fechamento e drenagem final passaram; nenhum processo real |
| Primeira CI Windows em `34aaf69` | Frontend, governança, contratos, licenças, audit e fmt passaram. Etapa Rust tests falhou no build script: `icons/icon.ico not found`, antes de executar testes do produto |
| Correção do ícone em `8f1c213` | Autor executou rustfmt, metadata sem dependências e diff check. REGENTE e JARDINEIRO (`44dfb47`) não encontraram bloqueio estático no alvo Windows; build/testes pendentes |
| Smoke Tauri → xterm → ConPTY → SQLite | Harness em revisão estática; execução nativa **não realizada** |

CI observada: [run 39476973848](https://github.com/kauankelvin7/Ciranda/actions/runs/39476973848). Log local `proofs/mvp-regente/ci-39476973848-job-118815388569.log`, SHA-256 `5bf22b9791a0315b5effa5a7a60716276710edf2fb35a78b19900070865f5225`. Falha de build real, separada do antigo bloqueio ambiental EPERM.

Codex e Antigravity são trabalhadores externos no Maestri. Adaptadores dentro do CIRANDA ainda não demonstrados. Implementação do backend e revisão estática não comprovam execução de terminal.

## Passos

- [x] Registrar Profissional primeiro no plano, decisões, contratos e instruções.
- [x] Delegar em duas worktrees e receber correções revisáveis.
- [x] Integrar fonte do canvas e backend; executar verificações locais possíveis.
- [x] Exercitar canvas e componente real React/xterm em navegador, com limites documentados.
- [x] Executar a primeira CI Windows e preservar o erro exato.
- [x] Concluir revisão independente da correção do ícone e integrar somente a fonte; parecer encaminhado ao FERREIRO por maestri ask.
- [x] Integrar o harness com a espera explícita de xterm revisada pelo JARDINEIRO.
- [ ] Compilar Tauri e executar testes Rust/Windows.
- [ ] Smoke real: abrir, criar terminal, executar comando, visualizar saída, encerrar e reabrir layout.
- [ ] Revalidar o commit integrado limpo e obter revisão das evidências.

## Bloqueio humano e limites

A instalação local MSVC/SDK autorizada falhou com `0x80070070` / `-2147024784`, espaço insuficiente no C:. A retomada exige liberar espaço; o instalador agora exige reserva operacional de 10 GiB. Nenhum arquivo pessoal será removido automaticamente. A CI Windows é uma via independente desse bloqueio local.

EPERM anterior foi isolado por diagnóstico pareado: os mesmos subprocessos de versão falham no sandbox e passam em execução pontual aprovada. Isso não valida o projeto nem autoriza desativar o sandbox.

O escopo completo de GC-02/03 e a paridade com Maestri permanecem não demonstrados: carga/TUI, recuperação após falha, backup/import/export, tarefas/notas e integração de CLIs requerem testes próprios. Não há Selo nem supervisor contínuo presumido.

Último snapshot de main observado: `34aaf69`. A entrega seguinte usa a branch de revisão `codex/professional-first`, sem atualizar main nem acionar seu workflow, respeitando a instrução atual de não iniciar build/teste pesado. Caches, executáveis, bancos, worktrees, credenciais e provas brutas permanecem ignorados. A autorização específica anterior do proprietário permite ao REGENTE enviar fonte revisada a esse remoto; os trabalhadores não fazem push. Nenhum force-push, deploy ou publicação de binários.
