# ADR 0001 — Fundação verificável antes da execução

Data: 2026-10-20. Estado: decisão de engenharia adotada dentro do escopo autorizado.

Preservar o plano com seu nome original e o scaffold recebido em um commit inicial. Criar verificadores pequenos em Node, sem dependências adicionais, para poder testar governança antes do runtime Rust. Fixar dependências npm e registrar lockfiles. Não habilitar empacotamento ou contratos sucessores sem as provas do GC-00.

O Maestri não está exposto por CLI nesta sessão; entregar montagem manual documentada sem tocar seus arquivos internos. Workers nativos do Codex servem de auxílio nesta sessão e não serão apresentados como terminais Maestri ou como Antigravity.

O build atualiza Vite e seu plugin a versões compatíveis confirmadas pelo registry npm, evitando manter o scaffold sem lockfile. TypeScript 5.9.3 permanece dentro do intervalo de compatibilidade informado pelo linter. Atualizações futuras invalidam provas relevantes.

Este ADR não decide os itens de produto D1–D14 nem muda limiares de desempenho. Aceite humano do Selo continua obrigatório.
