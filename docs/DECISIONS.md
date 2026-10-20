# Decisões do proprietário

Fonte: seção 20 do plano v3. Nenhum aceite foi inferido de uma execução de teste.

| ID | Tema | Estado nesta missão |
|---|---|---|
| D1 | Nome Ciranda | Nome utilizado pelo pedido; registro de marca não verificado |
| D2 | Arte pixel 16×16 | Pendente; não bloqueia governança |
| D3 | CSS sprites ou PixiJS | Pendente de medição |
| D4 | Interface principal | Decidido pelo proprietário: Profissional padrão; Fazenda opcional sobre o mesmo estado |
| D5 | SQLite em Rust | Confirmado pelo proprietário: manter Tauri v2/Rust/React/TypeScript/SQLite |
| D6 | Concorrência | Operação autorizada: Regente + até dois trabalhadores |
| D7 | Análise de concorrente | Somente fontes públicas/uso autorizado; nenhuma engenharia reversa |
| D8 | Assets e licenças | Pendente; nenhum asset externo adicionado |
| D9 | XP | Pendente; nenhuma regra ativada |
| D10 | Replay terminal | Pendente de spike |
| D11 | Retenção logs | Sem saída bruta de terminal persistente por padrão |
| D12 | Retomada pós-crash | Pendente; nenhum supervisor iniciado |
| D13 | Limiares performance | Pendente de GC-01; não congelados pelo agente |
| D14 | Instalador | Pendente; empacotamento desativado |

O aceite do Selo é uma ação separada do proprietário, após revisão independente e provas válidas. A autorização geral para implementar não será registrada como aprovação de um Selo ainda inexistente.

Diretriz definitiva e ordem atual de implementação em `docs/DECISOES_ARQUITETURAIS.md`. Canvas e PTY podem ser implementados agora em paralelo isolado por ordem explícita posterior; GC-04 e demais contratos não são liberados/selados por essa autorização. Fazenda não integra a tarefa atual nem é dependência do release profissional. Instalação global de MSVC/Windows SDK aguarda autorização específica.
