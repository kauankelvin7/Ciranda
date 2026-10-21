# MVP-WINDOWS-RUNTIME-FIX — revisão preparada

**Estado:** implementação pronta para revisão independente; sem aprovação de contrato.

## Base e escopo

- Branch: `codex/mvp-windows-runtime-fix`
- Base: `9ff17e2bd1a602e32c6a5bcec5150ff875c4ff54`
- Worktree começou limpa e sem arquivos staged.
- Allowed paths: `path_policy.rs`, `sessions.rs`, `job_object.rs`, `tasks/MVP-WINDOWS-RUNTIME-FIX.json` e este resumo; evidências locais ficam em `proofs/mvp-pty/windows-validation/runtime-fix/`.
- Nenhum arquivo IPC, manifesto, dependência ou lockfile foi alterado.

## Causas e evidências

### Prefixo de caminho Windows

O log CI `39596358922/job119209525838` registra `workspace path cannot be inspected` nos testes de raiz absoluta configurada e cwd aninhado. Em `reject_reparse_components`, `Component::Prefix` era acrescentado e consultado com `symlink_metadata` antes de `Component::RootDir`; no Windows isso tenta inspecionar um prefixo de drive incompleto, como `C:`. A alteração espera até `current.is_absolute()` e então continua a consulta de cada componente. A regressão adicional inspeciona um caminho canônico, e os testes existentes continuam cobrindo raiz/cwd válidos, traversal, UNC/device, ADS, nomes reservados e symlink.

### Harness PTY sem terminal

O código upstream de `portable-pty` cria ConPTY com `PSEUDOCONSOLE_INHERIT_CURSOR`. A Microsoft documenta que esse modo envia uma consulta de cursor por `hOutput` e espera a resposta por `hInput`, de forma assíncrona. Os quatro testes Windows que dependem de execução PowerShell real falharam por ausência de saída, exit, PID ou marcadores. O log CI preservado não registra os bytes brutos; portanto a relação com a consulta é uma causa sustentada pelo flag e pelo contrato ConPTY, ainda pendente de confirmação por nova execução Windows.

O harness Windows de `sessions.rs` responde `CSI 6 n` (`ESC[6n`) com uma resposta CPR sintética (`ESC[1;1R`) apenas nos testes. Antes de enviar comandos, `settle_startup` exige que uma consulta seja observada e respondida, limitado a um segundo; sem consulta, a falha inclui diagnóstico raw. Os timeouts de saída do PowerShell e de espera pelo arquivo PID também incluem bytes escapados e hex. Os marcadores ainda são montados em segmentos distintos no comando e as asserções continuam verificando a saída real, o isolamento entre as duas sessões, o estado de saída e o PID/encerramento do descendente.

Referências primárias: [fonte upstream portable-pty no Windows](https://github.com/wezterm/wezterm/blob/05343b387085842b434d267f91b6b0ec157e4331/pty/src/win/psuedocon.rs) e [documentação Microsoft de CreatePseudoConsole](https://learn.microsoft.com/en-us/windows/console/createpseudoconsole).

## Mudanças

- Adiada a inspeção de metadados até que o caminho esteja absoluto; caminhos locais e canônicos continuam sujeitos a verificações por componente.
- Adicionada regressão para inspeção de raiz canônica.
- Adicionado harness raw PTY de teste para responder consultas de cursor e registrar saída escapada/hex em falhas.
- Mantidas as asserções de comportamento real e os checks anti-echo existentes.
- `is_process_running` agora só é compilada para Windows em testes, onde a função é usada.
- Nenhuma alteração ao comportamento PTY de produção ou ao IPC.

## Checks e pendências

- `rustup run 1.94.1-x86_64-pc-windows-msvc rustfmt --check ...`: exit 0.
- `git diff --check` nos três fontes alterados: exit 0, sem saída.
- Parse JSON da tarefa e da evidência local: exit 0.
- `cargo check`, `cargo test`, build, Clippy e runtime nativo: não executados por instrução; compilação e regressões Windows permanecem sem validação local.
- Nova CI e push: não executados; aguardam revisão independente JARDINEIRO e decisão REGENTE.
- Nenhum Selo, liberação GC-04 ou alegação de runtime nativo validado.
