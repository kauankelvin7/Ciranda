# Matriz de paridade funcional — CIRANDA profissional

20/10/2026. Situação do CIRANDA é verificada separadamente da referência. `EM IMPLEMENTAÇÃO` significa tarefa ativa e não equivale a recurso funcional. `FUNCIONAL` exige uso real observado; `VALIDADA` exige teste reproduzível e evidência do commit. Nenhuma paridade global é declarada.

Fontes: [canvas oficial](https://www.themaestri.app/pt-br/docs/canvas) (D-C), [terminais oficiais](https://www.themaestri.app/pt-br/docs/terminals) (D-T), [conexões oficiais](https://www.themaestri.app/pt-br/docs/connections) (D-L), observações CLI da instalação ativa em `proofs/maestri-setup/` (O-CLI). D-* indica documentação, não teste executado nesta missão. O instalador em `docs/ANALISE_MAESTRI.md` não foi executado.

| Funcionalidade / comportamento esperado | Evidência Maestri | CIRANDA | Diferença / prioridade | Teste de aceitação original |
|---|---|---|---|---|
| Canvas espacial, pan e zoom | D-C | EM IMPLEMENTAÇÃO — MVP-CANVAS | Scaffold ainda não comprova canvas; P0 | Mover viewport, ampliar/reduzir e manter coordenadas dos nós; teclado equivalente |
| Criar/mover/redimensionar/excluir nós | D-C | EM IMPLEMENTAÇÃO — MVP-CANVAS | Sem teste de interação entregue; P0 | Criar dois nós, arrastar/redimensionar um, excluir outro e conferir modelo persistido |
| Conexões com comportamento | D-L e O-CLI (mensagens entre conectados) | EM IMPLEMENTAÇÃO — MVP-CANVAS | MVP associa referências de contexto; não promete mensageria autônoma; P0 | Associar contexto ao destino, recusar endpoint inválido, desconectar; nenhuma injeção automática de texto |
| Terminal interativo real | D-T e O-CLI | EM IMPLEMENTAÇÃO — MVP-PTY/CANVAS | Maestri hospeda os trabalhadores; CIRANDA ainda não demonstrou PTY; P0 | Criar sessão, enviar comando com marcador único, observar retorno ANSI/UTF-8 no xterm |
| Múltiplas sessões independentes | O-CLI (Codex/Antigravity em duas worktrees) | EM IMPLEMENTAÇÃO — MVP-PTY | Suíte do motor ainda não entregue; P0 | Duas sessões, marcadores distintos, sem mistura de input/output |
| Executar Codex/Antigravity no aplicativo | O-CLI apenas na instalação Maestri | NÃO INICIADA — adaptadores CIRANDA não comprovados | Sem confundir trabalhador externo com integração; P0 após shell real | Detectar executável/versão, iniciar na sessão CIRANDA e executar smoke autorizado de cada CLI; ausência deve ser explícita |
| Persistência de layout/projeto | D-C; reinício não testado aqui | EM IMPLEMENTAÇÃO — MVP-PTY/CANVAS | SQLite e restore devem ser comprovados; P0 | Salvar nós/arestas/grupos/viewport, fechar/reabrir e comparar; processo antigo não aparece vivo |
| Encerramento seguro e limpeza da árvore | Não testado no Maestri | EM IMPLEMENTAÇÃO — MVP-PTY | Exigência própria, não equivalência presumida; P0 | Iniciar processo-filho sintético na sessão, fechar sessão/app e verificar ausência dos PIDs criados |
| Grupos e organização | D-C (agrupamento documentado); não testado aqui | EM IMPLEMENTAÇÃO — MVP-CANVAS | Sem entrega de grupo validada; P1 | Agrupar nós, mover, desfazer agrupamento e persistir sem alterar sessões |
| Atalhos e menus contextuais | D-C | EM IMPLEMENTAÇÃO — MVP-CANVAS | Sem teste de foco entregue; P1 | Criar/selecionar/excluir pelo teclado, abrir menu, voltar ao terminal sem desviar digitação |
| Monitoramento/recuperação de sessões | O-CLI permite consultar saída; crash não testado | EM IMPLEMENTAÇÃO — MVP-PTY | Estado real e interrupted ainda sem smoke; P0 | Detectar exit e mostrar estado; após reinício não fingir recuperar PID encerrado |
| Delegação/revisão entre agentes | O-CLI (asks e revisões concluídas) | NÃO INICIADA no produto | Fluxo desta equipe é externo; Fase 2 | Mensagem aprovada chega ao destinatário correto, deixa auditoria e exige revisão de outro autor |
| Fazenda opcional com estado compartilhado | Requisito próprio CIRANDA, sem paridade exigida | NÃO INICIADA | Fora do MVP e do caminho crítico; Fase 3 | Trocar apresentação preserva sessões/PIDs/dados e não chama spawn/terminate |

Entrega inicial: interface Profissional + canvas + ao menos um terminal real. O fluxo E2E obrigatório abre CIRANDA, cria terminal, executa comando, mostra saída, encerra sessão e reabre layout. Backend sem compilar, testes apenas simulados ou preview de navegador não satisfazem esse critério. Estado da matriz só sobe com referência a evidência real do commit correspondente.
