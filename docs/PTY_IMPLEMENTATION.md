# Implementacao PTY do MVP Windows

## Contrato e comandos

O backend registra os nove comandos sem alterar `docs/SESSION_API.md`:

| Comando | Funcao |
|---|---|
| `workspace_info` | Retorna `root` canonico e `platform`. |
| `session_create` | Abre uma sessao ConPTY com PowerShell sem perfil, no root ou em cwd relativo validado. |
| `session_list` | Lista sessoes retidas e seu estado atual. |
| `session_write` | Escreve bytes UTF-8 limitados no PTY. |
| `session_resize` | Valida e aplica as dimensoes ao PTY existente. |
| `session_read` | Faz replay por `afterSeq` em chunks de bytes, com indicador de truncamento. |
| `session_close` | Fecha idempotentemente uma sessao e encerra seus processos. |
| `workspace_load` | Retorna o JSON de layout v1 ou `null`. |
| `workspace_save` | Valida e grava layout v1 em uma transacao SQLite. |

O root vem de `CIRANDA_WORKSPACE_ROOT`; sem essa variavel, usa o cwd do processo. A UI nao escolhe nem altera o root. O PowerShell inicia com `-NoLogo -NoProfile -NoExit`; nenhum comando de usuario e anexado ao spawn. `sessionId` guardado no layout continua sendo apenas um identificador: apos reinicio nao existe processo restaurado, e a UI deve tratar um ID ausente de `session_list` como interrompido e pedir acao explicita para recriar.

## Limites do backend

| Recurso | Limite |
|---|---:|
| Sessoes ativas | 16 |
| Registros retidos por app | 64 |
| Colunas / linhas | 1–500 / 1–300 |
| Bytes por escrita | 16 KiB |
| Fila de entrada por sessao, incluindo escrita em curso | 64 KiB |
| Chunk de leitura do PTY | 4 KiB |
| Ring buffer por sessao | 1 MiB |
| Replay por chamada | 64 KiB e 64 chunks |
| JSON de layout | 1 MiB |
| Nos / conexoes / grupos | 256 / 1024 / 128 |

As sequencias comecam em 1 e crescem por chunk. `afterSeq=0` solicita replay disponivel. `truncated=true` informa que bytes anteriores ja foram removidos do ring buffer. Se a resposta atingir o limite de replay, o consumidor continua usando o ultimo `seq` retornado.

O estado de sessao e `running`, `exited`, `closed` ou `failed`. EOF/BrokenPipe do leitor consulta `try_wait` por ate 1 segundo antes de classificar a sessao como `failed`, dando tempo para uma saida normal aparecer como `exited`. `session_close` nao depende de montagem/desmontagem do terminal na UI. O `RunEvent::Exit` do app fecha todas as sessoes. No Windows, cada shell e associado a um Job Object configurado com `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`; se criar/configurar/associar o job falhar, a criacao da sessao falha fechada. O handle do Job Object e mantido pelo backend durante a vida da sessao.

`session_write` valida e enfileira no maximo 16 KiB por chamada. Um worker por sessao executa `write_all`/`flush` sem manter o mutex global de sessoes. A fila limita a 64 KiB, contando tambem o chunk que o worker esta escrevendo; quando cheia, novas escritas sao rejeitadas. Fechar a fila descarta dados ainda pendentes e nao aguarda o worker. O teste unitario simula um consumidor bloqueado e verifica capacidade, rejeicao e fechamento da fila; ele ainda precisa ser executado no ambiente Windows, e isso nao comprova limite de tempo para a terminacao do processo pelo sistema operacional.

## Paths e armazenamento

O `cwd` da sessao e relativo ao root. O backend rejeita caminho absoluto ou rooted, UNC/dispositivo, `..`, colon/ADS, nomes reservados do Windows, componentes inexistentes, links simbolicos e reparse points (incluindo junctions), e confirma que o caminho canonico continua sob o root. O root tambem e canonizado e inspecionado.

O banco fica em `.ciranda/state.sqlite`. O diretorio e o arquivo sao verificados contra symlink/reparse point; no Windows, o arquivo e aberto com `CreateFileW` e `FILE_FLAG_OPEN_REPARSE_POINT`, e `GetFileInformationByHandle` fornece atributos e contagem de links. Erros de abertura/consulta falham fechados; arquivos com mais de um hard link tambem sao recusados. Layout v1 e validado antes de entrar em transacao SQLite. Tipos de no e conexao sao restritos ao contrato, referencias de conexao/grupo precisam existir, numeros devem ser finitos e dentro de limites, e chaves desconhecidas sao rejeitadas. Banco corrompido ou schema futuro interrompe a inicializacao em vez de sobrescrever dados.

## Limite de seguranca

Validar o cwd limita onde a sessao comeca e protege as operacoes de persistencia mediadas pelo backend. Isso nao limita o que o PowerShell interativo pode ler, escrever, iniciar ou acessar na rede com as permissoes do usuario. Worktree, cwd, PTY e Job Object nao sao sandbox de sistema operacional. O Job Object encerra processos associados ao fechar o handle, mas nao aplica politica de arquivos ou rede. A validacao de caminhos e a abertura por nome estao sujeitas a corrida se outra parte com permissao puder substituir os componentes entre as verificacoes e o uso; o codigo nao afirma confinamento contra esse adversario.

## Dependencias e referencias de API

As APIs foram consultadas nas referencias oficiais antes da implementacao:

- [`portable-pty` 0.9.0](https://docs.rs/portable-pty/0.9.0/portable_pty/) para `native_pty_system`, spawn, reader/writer e resize.
- [Microsoft Job Objects](https://learn.microsoft.com/windows/win32/procthread/job-objects) para associacao do processo e `KILL_ON_JOB_CLOSE`.
- [Microsoft Reparse Points and File Operations](https://learn.microsoft.com/windows/win32/fileio/reparse-points-and-file-operations) para verificacao de reparse points.
- [Microsoft `CreateFileW`](https://learn.microsoft.com/windows/win32/api/fileapi/nf-fileapi-createfilew), [`FILE_FLAG_OPEN_REPARSE_POINT`](https://learn.microsoft.com/windows/win32/api/fileapi/nf-fileapi-createfilew), [`GetFileInformationByHandle`](https://learn.microsoft.com/windows/win32/api/fileapi/nf-fileapi-getfileinformationbyhandle) e [`BY_HANDLE_FILE_INFORMATION`](https://learn.microsoft.com/windows/win32/api/fileapi/ns-fileapi-by_handle_file_information) para consulta sem seguir o reparse point final e obter `nNumberOfLinks`; bindings conferidos em [`windows-sys` 0.59.0](https://docs.rs/windows-sys/0.59.0/windows_sys/Win32/Storage/FileSystem/index.html).
- [`CreateJobObjectW` no `windows-sys` 0.59.0](https://docs.rs/windows-sys/0.59.0/windows_sys/Win32/System/JobObjects/fn.CreateJobObjectW.html) declara `SECURITY_ATTRIBUTES`, exigindo o feature `Win32_Security` junto de `Win32_System_JobObjects`.
- [`rusqlite` 0.32.1](https://docs.rs/rusqlite/0.32.1/rusqlite/) para transacoes SQLite.

## Validacao

O codigo inclui testes automatizados para limites numericos, rejeicoes de caminhos, reparse points, hard links, ring buffer, replay truncado, fila de entrada com consumidor bloqueado, validacao de layout e persistencia SQLite. Testes Windows adicionais iniciam PowerShell via ConPTY, verificam I/O/resize, saida normal do shell e encerramento de descendente pelo Job Object. Os testes de consumidor bloqueado, hard link e saida normal ainda nao foram executados nesta revisao; resultados, ambiente, comandos, exits, commit e hashes ficam em `proofs/mvp-pty/`, e nenhum resultado ambiental bloqueado conta como validacao aprovada.
