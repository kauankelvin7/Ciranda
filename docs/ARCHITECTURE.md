# Arquitetura

Fonte: plano v3, seções 8–14. O scaffold atual contém React/TypeScript/Vite e Tauri v2/Rust, com um comando `greet`; demais componentes ainda não foram implementados.

O frontend representa o canvas e os terminais, sem executar shell. Comandos Tauri validados serão a fronteira para PTY/ConPTY, SQLite, adaptadores, scheduler, política e eventos Rust. SQLite será implementado no contrato correspondente; a definição de produto D5 continua registrada para aceite do proprietário.

Eventos tipados append-only alimentarão estado materializado e projeção pura da fazenda. Texto bruto de terminal não entra em eventos. Buffers, quotas e backpressure serão comprovados antes de habilitar sessões reais. Trabalho interrompido não retorna automaticamente como concluído.

O grafo de liberação é GC-00 → GC-01 → {GC-02, GC-03}; ambos → GC-04/05; GC-03/05 → GC-06; GC-03/06 → GC-07; GC-06/07 → GC-08; GC-04/07 → GC-09/10. GC-11 exige os contratos do release. Um bloqueio não libera sucessores.

O código de governança em `scripts/` é ferramenta de desenvolvimento. Não substitui a política Rust do futuro GC-07 nem constitui sandbox para shell arbitrário.
