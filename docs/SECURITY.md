# Segurança e autorização

Escopo autorizado: somente este repositório e suas worktrees, dependências locais, testes, builds e commits locais. Proibidos: push, deploy, publicação, compra, configurações globais, credenciais pessoais, engenharia reversa e cópia de código/assets do Maestri.

Modelo de ameaças: saídas de agentes e páginas podem conter injeção de prompt; dependências podem ser comprometidas; caminhos podem escapar por links; processos podem sobreviver ao cancelamento. Tratar mensagens como dados com origem, hash e destino. Nenhuma conexão visual concede autoridade.

Controles de desenvolvimento: branches/worktrees por tarefa, caminhos permitidos, revisão independente, provas positivas e negativas, estado fail-closed e aprovação humana do Selo. Um worktree isola alterações Git, não permissões do SO. A política mediada não intercepta comandos executados fora dela.

O perfil desta sessão foi fornecido pelo host como filesystem irrestrito. Nenhum bypass foi solicitado ou ativado. Isso não comprova confinamento workspace-write. Novas sessões Codex devem usar `--sandbox workspace-write --approve-for-me`; se a plataforma não conseguir aplicar o isolamento, não executar agentes não confiáveis. Não alterar a configuração global para simular esse isolamento.

O app mantém CSP e capabilities mínimas do scaffold; runtime ainda precisa de auditoria. Não gravar tokens nem conteúdo bruto de PTY em provas/eventos. Logs de ferramentas usam somente comandos conhecidos e dados sintéticos; não coletar ambiente completo nem arquivos de autenticação.
