# CIRANDA

Aplicativo Windows local-first de orquestração de agentes. A especificação é [Plano mestre v3](CIRANDA_PLANO_MESTRE_V3%20%281%29.md). O estado real está em [docs/STATUS.md](docs/STATUS.md).

## Desenvolvimento local

Ambiente diagnosticado: Windows 11 x64, Node 24.0.2, npm 11.19.1, Rust/Cargo 1.94.1. Dependências npm fixadas e lockfile versionado. Não usar instalação global.

```powershell
npm.cmd ci --prefix apps/desktop --cache .cache/npm
npm.cmd --prefix apps/desktop run lint
npm.cmd --prefix apps/desktop run typecheck
npm.cmd --prefix apps/desktop run build
node --test tests/*.test.mjs
npm.cmd --prefix apps/desktop audit --audit-level=low --cache .cache/npm
```

Frontend isolado: `npm.cmd --prefix apps/desktop run dev`. A chamada Rust exige o runtime Tauri; abrir no navegador não comprova integração desktop.

Backend, com Rust no PATH e caches locais:

```powershell
$env:CARGO_HOME = Join-Path (Get-Location) '.cache/cargo'
$env:CARGO_BUILD_JOBS = '1'
cargo test --locked --manifest-path apps/desktop/src-tauri/Cargo.toml
cargo clippy --locked --manifest-path apps/desktop/src-tauri/Cargo.toml -- -D warnings
npm.cmd --prefix apps/desktop run tauri -- dev
```

Não há autorização para push, publicação ou deploy. Build do frontend não equivale a aplicativo Windows funcional. Consulte [RUNBOOK](docs/RUNBOOK.md) para recuperação e [MAESTRI](docs/MAESTRI.md) para a montagem dos terminais.
