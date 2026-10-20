# Decisões arquiteturais vinculantes

## DA-001 — Orquestrador profissional primeiro

Decidido explicitamente pelo proprietário em 20/10/2026. **CIRANDA = orquestrador profissional primeiro. Fazenda = tema opcional.** Esta decisão substitui a prioridade rural do plano v3.0. Plano corrente: `CIRANDA_PLANO_MESTRE_V3.md` (v3.1); versão anterior preservada no Git.

- Padrão: interface moderna escura com canvas infinito, pan/zoom, terminais interativos, nós arrastáveis/redimensionáveis, criação/exclusão de agentes, conexões funcionais, grupos, atalhos, menus, sessões, monitoramento e persistência/recuperação.
- Fases: (1) núcleo profissional, (2) orquestração autônoma e revisão, (3) Fazenda opcional. Segurança básica não é adiada para a Fase 2. Nenhum asset, sprite ou gamificação integra a tarefa atual.
- Camadas separadas: execução/processos; orquestração/delegação; persistência/recuperação; modelo do canvas; apresentação/temas. Tauri v2/Rust/React/TypeScript/SQLite mantidos. UI chama comandos validados; montagem/desmontagem/tema não possuem processos.
- Um único estado de domínio e IDs estáveis para ambas as apresentações. Alternar tema não reinicia terminais, interrompe agentes ou perde dados. Preferência visual não duplica banco, eventos ou sessões.
- Conexões têm tipo, direção e política: `context_reference` associa referências de contexto ao destinatário para inspeção/seleção explícita; não executa texto nem injeta prompt automaticamente. Referências inexistentes ou fora do workspace são recusadas. Dependências de tarefas e entrega de mensagens são tipos futuros, implementados e testados na Fase 2; a UI não os apresenta como ativos antes disso. Linha sem semântica não conta como funcionalidade.
- Preservar política, gates, logs, scaffold e provas compatíveis. Não copiar código, assets, marca ou identidade visual do Maestri; referência apenas funcional e sem alegação de paridade sem testes correspondentes.

## DA-002 — Implementação paralela do primeiro MVP verificável

Ordem posterior explícita do proprietário: JARDINEIRO implementa canvas profissional React em worktree isolada, com testes; FERREIRO implementa sessões/PTY Windows com caminhos confinados, limpeza de processos e testes. REGENTE investiga MSVC/PATH e EPERM, fixa a interface de integração e revisa entregas. Máximo REGENTE + dois trabalhadores; sem subagentes internos.

Esta ordem autoriza implementação revisável de partes de GC-02/03/04 apesar dos bloqueios ambientais. **Não libera contratos, não concede Selo e não altera provas para pass.** Distinguir implementação, validação local, smoke test e aprovação contratual. Escopo de hoje: abrir app profissional, criar ao menos um terminal real, executar comando, observar saída, encerrar sessão e restaurar layout. Não prometer entrega executável enquanto esses passos não ocorrerem.

Autorizações posteriores específicas: proprietário aprovou instalação do C++ Build Tools/Windows SDK e publicação de fonte revisada em `https://github.com/kauankelvin7/Ciranda.git`. Não autorizou outras alterações globais, gastos, force-push ou deploy. Diagnosticar EPERM comparando comandos diretos com subprocessos; não desativar sandbox nem expandir permissões indiscriminadamente. Autoaprovação no terminal Antigravity é específica daquele terminal e não muda a política do produto.

Confinamento do backend valida diretório e operações mediadas no workspace; uma worktree e um cwd não são sandbox de SO para tudo que um shell interativo pode fazer. Documentar essa limitação. Capturar UTC, ambiente, commit, fonte limpa/inalterada, exits, saídas e hashes. Provas antigas continuam históricas e são reexecutadas quando necessário. Somente o proprietário pode aprovar Selo depois de provas válidas e revisão independente.

## DA-003 — Geometria do canvas no primeiro MVP

Escolha de implementação provisória do REGENTE, no escopo de autonomia autorizado: o primeiro canvas usa React/TypeScript com transformações CSS e arestas SVG; não introduz `@xyflow/react` nesta entrega. O modelo de layout fica em funções puras independentes do renderizador. Isso preserva o código já entregue e observado em navegador e reduz a mudança de dependências durante a integração do primeiro PTY.

React Flow era a biblioteca prevista no v3. Sua adoção será reavaliada com as provas de GC-04 (30 nós, foco/teclado, acessibilidade e zoom semântico). Essas provas ainda estão pendentes; a opção provisória não elimina requisitos nem comprova desempenho. O layout v1 e o ciclo de vida do Rust não dependem da biblioteca de geometria. Tauri v2, Rust, React, TypeScript e SQLite permanecem obrigatórios.
