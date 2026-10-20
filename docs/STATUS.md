# STATUS — CIRANDA

Atualizado em 2026-10-20. **GC-00: blocked, implementação parcial; nenhum contrato selado.** O plano correto foi recuperado como `CIRANDA_PLANO_MESTRE_V3 (1).md`. Afirmações históricas sem logs/commit/hash foram substituídas por verificações desta operação.

## Entrega atual

- Baseline recebido preservado no commit `2bf65b2`.
- REGENTE: branch `codex/gc00-foundation`, checkout principal; documentação, tarefas, versões npm fixadas, lockfiles npm/Rust, lint e definição CI Windows.
- FERREIRO: branch `codex/gc00-verification`, `.worktrees/ferreiro`; política mediada, licenças de assets, catálogo de 12 contratos/66 provas, runner e gates fail-closed, sob revisão.
- SENTINELA: papel temporário independente, somente leitura. Identificou validação insuficiente de metadados e escrita por links; correção `083d7c8` aguarda revisão final.
- JARDINEIRO: não iniciado; Antigravity ausente e predecessores bloqueados.

## Verificações reais

| Verificação | Resultado observado | Limite |
|---|---|---|
| npm install local | exit 0; 122 pacotes auditados | Primeira resolução, não instalação limpa do produto completo |
| Lint, tipos, build frontend | exit 0 em cada etapa | Não executa Tauri/PTY |
| npm audit | exit 0; zero vulnerabilidades reportadas | Não comprova licenças legais ou Rust |
| cargo generate-lockfile | exit 0; 407 pacotes resolvidos | Sem compilação |
| cargo build --locked, um job | exit 101 | MSVC `link.exe` não encontrado |
| cargo fmt --check | exit 1 | Componente rustfmt ausente |
| Testes governança FERREIRO corrigidos | 8 passaram em 083d7c8 | Aguardando revisão e reexecução integrada |
| CI remota | NÃO EXECUTADA | Workflow definido; nenhum push autorizado |
| Runtime Windows/instalador | NÃO COMPROVADO | Sem app iniciado ou pacote produzido |

Registros instrumentados locais: `proofs/runs/<check>.json` e `.output.json`, gerados por `node tooling/check.mjs <check>`; contêm UTC, ambiente, exit, commit, hash e indicadores de árvore limpa/inalterada. Execuções com árvore modificada são diagnósticas. Provas contratuais serão reexecutadas no HEAD limpo após integração revisada. Arquivos gerados não são aceites humanos.

## Provas GC-00

| Prova | Estado contratual |
|---|---|
| P-00-01 instalação limpa/build fixado | NÃO COMPROVADA: backend não compila sem MSVC |
| P-00-02 CI lint/tipos/testes/dependências | NÃO COMPROVADA: workflow definido, execução completa ausente |
| P-00-03 ação proibida rejeitada/auditada | Parcial: API mediada em revisão; não intercepta shell livre |
| P-00-04 licença ausente bloqueia pacote | Parcial: gate de assets em revisão; pacote completo permanece proibido |

## Bloqueios e próxima ação

1. Concluir revisão independente; integrar somente commits revisados e executar provas finais no HEAD limpo.
2. MSVC Build Tools e rustfmt não disponíveis no ambiente verificado. Instalação global altera o Windows e está fora do escopo autorizado; não iniciada.
3. Maestri/MAESTRI_CLI e Antigravity indisponíveis nesta sessão. Montagem manual em `docs/MAESTRI.md`; nenhum canvas/terminal/conexão criado.
4. Catálogo de modelos das CLIs não comprovado; nenhum modelo específico apresentado como configurado.
5. Aceite humano do Selo só será solicitado quando houver resultado completo revisável. GC-01..11 continuam sem liberação.

Não há supervisor contínuo ativo. Recuperação em `docs/RUNBOOK.md`. Último commit atual: `git log -1 --oneline`; evidências registram seu próprio commit, evitando autorreferência falsa.
