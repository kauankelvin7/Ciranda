# Montagem Maestri

Diagnóstico de 2026-10-20: `maestri` não localizado no PATH; `MAESTRI_CLI` ausente. Nenhuma interface documentada de canvas foi exposta a esta sessão. Não foram criados workspace, terminais, posições ou conexões no aplicativo. Não foram inspecionados seus arquivos internos.

Montagem manual preparada:

1. No Maestri, abrir/criar workspace CIRANDA apontando para a raiz deste repositório.
2. Criar REGENTE no alto; FERREIRO e JARDINEIRO abaixo, em worktrees exclusivas. Limite de três agentes no total.
3. Conectar REGENTE → FERREIRO e REGENTE → JARDINEIRO. Conexões não encaminham tarefas automaticamente; comunicar por arquivos estruturados em `tasks/` e referências explícitas.
4. REGENTE lê `.agents/REGENTE.md`, FERREIRO lê `.agents/FERREIRO.md`, JARDINEIRO lê `.agents/JARDINEIRO.md`. SENTINELA substitui temporariamente um trabalhador para revisão.

Comandos Codex confirmados pelo `--help` local:

```powershell
codex --sandbox workspace-write --approve-for-me -C C:\Users\Kauan\Desktop\CIRANDA
```

Para FERREIRO, usar `-C` com sua worktree. Selecionar no próprio CLI o melhor modelo disponível para a conta, raciocínio alto para Rust/segurança e alto ou máximo no Regente. O diagnóstico não consultou credenciais nem comprovou catálogo de modelos; não há modelo de CLI registrado como disponível por suposição.

Antigravity (`agy`/`antigravity`) não localizado. JARDINEIRO fica pendente até existir CLI e saída de `--help`/versão verificadas. Não inventar flags, instalar globalmente ou substituir silenciosamente sua ferramenta por outra.

Quando a CLI documentada Maestri estiver acessível, começar com `maestri list`, `maestri preset list`, `maestri role list` e `maestri workspace list`. Reutilizar equipe existente. Criar somente roles locais, e recrutar conforme presets realmente disponíveis. Usar as skills maestri-manager e maestri-workspace; nenhuma flag de layout foi comprovada, portanto posicionar pela interface.

Prompts iniciais: ler AGENTS e plano integral, executar somente tarefa atribuída e allowed_paths, produzir commit/testes/evidências, solicitar revisão e não selar a própria entrega. Não iniciar contratos bloqueados. Nenhum supervisor autônomo contínuo foi configurado.
