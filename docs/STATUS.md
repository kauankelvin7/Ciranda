# STATUS
- GC-00: scaffold mínimo Tauri v2 + React + TypeScript + Rust criado em `apps/desktop/`.
- O frontend inclui tela inicial e chamada `invoke` para o comando Rust `greet`; o bundle do Tauri está desativado neste bootstrap.
- Plano Mestre v3.0, tarefas e contratos continuam ausentes do checkout. O scaffold deriva do pedido de bootstrap; requisitos de produto e critérios completos de aceite não foram confirmados.
- GC-00 permanece não selado até recuperar o Plano Mestre/contratos e concluir as verificações que dependem de dependências instaladas.

## Evidências locais

- `cargo metadata --no-deps --format-version 1 --manifest-path apps/desktop/src-tauri/Cargo.toml` — passou; manifest e targets Rust reconhecidos.
- Revisão SENTINELA independente — scaffold/configuração revisados; revisão não equivale a build ou teste de runtime.
- `node -e` com `JSON.parse` em `package.json`, `tsconfig.json`, `tauri.conf.json` e `capabilities/default.json` — passou; os quatro arquivos são JSON válido.
- `npm run build` em `apps/desktop/` — não compilou: dependências locais ausentes (`tsc` não encontrado). Não foram instaladas dependências para evitar downloads/cache fora do repositório.
- `cargo fmt --check --manifest-path src-tauri/Cargo.toml` em `apps/desktop/` — bloqueado; componente `rustfmt` não está instalado no toolchain local.
- `cargo test --offline --manifest-path src-tauri/Cargo.toml` em `apps/desktop/` — bloqueado; crate `tauri` não está disponível no cache offline.
- Ambiente observado: Node v24.0.2, npm 11.19.1, Cargo 1.94.1 e rustc 1.94.1; `cargo-tauri` não está instalado.

## Lacunas

- Adicionar ao repositório o Plano Mestre v3.0 e os contratos/tarefas GC-00 para confirmar escopo, critérios de aceite e provas exigidas.
- `package-lock.json` e `Cargo.lock` estão ausentes; gerar e versionar lockfiles quando as dependências estiverem disponíveis, depois repetir build, typecheck e testes; validar execução integrada do app Tauri no Windows.
- Revisão independente pela Sentinela concluída; GC-00 segue aberto pelas lacunas acima.
