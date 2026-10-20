# Evidências

Os runners gravam saídas e metadados reais localmente em `proofs/`. Logs brutos, caminhos pessoais, buffers, configurações de sessão e bancos não são publicados automaticamente. `.gitignore` exclui esses arquivos; `proofs/public/` é reservado a resumos sanitizados deliberadamente revisados, nunca provas fabricadas.

Reproduza verificações pelos comandos em `README.md`, `docs/RUNBOOK.md`, `tooling/` e `scripts/prove.mjs`. Registre UTC, ambiente, commit, fonte limpa/inalterada, comando, exit e SHA-256. Saída positiva de outro commit é histórica; não valida o HEAD atual. `blocked`, `dirty`, `skipped` e `not_run` não são sucesso. Sem provas atuais, revisão independente e aceite humano, nenhum Selo.

O instalador Maestri e o bootstrapper Microsoft nunca integram o repositório. O inventário da referência contém apenas metadados; nenhum código ou asset proprietário foi extraído.
