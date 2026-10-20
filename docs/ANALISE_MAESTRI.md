# Análise da referência Maestri

Inventário de 20/10/2026. Escopo efetivo: metadados do arquivo, documentação oficial e uso normal já observado nesta sessão. **Não houve execução/instalação da cópia, extração de payload, descompilação, desmontagem, busca de segredos ou envio do binário a terceiros.** A implementação do CIRANDA continua independente.

## Arquivo e cadeia de evidência

Referência informada pelo proprietário: `C:/Users/Kauan/Desktop/Maestri-Referencia/Maestri-Setup-latest.exe`; 202.340.345 bytes. É um instalador, não um runtime desempacotado. SHA-256 antes e depois, idênticos:

`9838b2095aebc1ccba607fdd7b943851080776d4651fbfda3609e38ec2eb3127`

Evidência instrumentada: `proofs/mvp-regente/maestri-inventory-20261020T144926681338Z.json` e `.sha256`. Reprodução: `python tooling/inspect-reference.py <caminho-do-exe>`; metadados de assinatura/versão são obtidos separadamente por `Get-AuthenticodeSignature` e `FileVersionInfo` e fornecidos em `CIRANDA_REFERENCE_METADATA` no subprocesso. O original permaneceu inalterado.

| Item | Observado | Limite |
|---|---|---|
| Formato | MZ/PE32, machine 0x14c, x86, subsystem 2 (GUI) | Arquitetura do instalador; não estabelece arquitetura do app instalado |
| Versão | FileVersion/ProductVersion 0.25.2; ProductName Maestri; CompanyName Evercraft Labs | Metadados declarados no recurso de versão, não assinatura autenticada |
| Assinatura | Authenticode `NotSigned`, tipo `None`; diretório de certificado PE com tamanho zero | Não foi executado o instalador nem alterada política do Windows |
| Seções | .text, .rdata, .data, .ndata, .rsrc | Sem disassembly ou conteúdo de código |
| Imports PE | KERNEL32.dll, USER32.dll, GDI32.dll, SHELL32.dll, ADVAPI32.dll, COMCTL32.dll, ole32.dll | Imports do instalador; não inventário completo do payload |
| Recursos | IDs 3, 5, 14, 16, 24 (ícone, diálogo, grupo de ícones, versão, manifesto) | Apenas tipos; nenhum ícone, imagem ou recurso extraído/copied |
| CLR | Diretório RVA/tamanho zero | Instalador sem diretório CLR; não exclui .NET dentro do payload |
| Dados anexos | Overlay de 202.245.113 bytes | Não desempacotado; bibliotecas internas e mecanismo de persistência não estabelecidos |
| Electron/Tauri/Qt/xterm/ConPTY | **Não comprovados para o Maestri** | Um instalador Win32 e imports comuns não identificam o framework do aplicativo |

O timestamp COFF bruto existe no artefato, mas não foi tratado como data confiável de compilação do produto. Ferramentas próprias usadas: PowerShell/WinTrust/.NET para metadados e parser limitado de cabeçalhos PE com Python padrão; nenhuma ferramenta de procedência desconhecida executada.

## Termos e limites

Os [termos oficiais, seção 3](https://www.themaestri.app/pt-br/terms), atualizados em 12/10/2026 e consultados em 20/10/2026, restringem engenharia reversa, descompilação e desmontagem. Por isso a análise não acessou a implementação proprietária. A [política oficial](https://www.themaestri.app/en/privacy) indica uma lista de componentes na tela de reconhecimentos; ela não foi acessada nesta sessão. Nenhuma licença de componentes internos foi presumida a partir disso.

## Funcionalidades e qualidade da evidência

- **Documentado, não testado pela UI nesta missão:** a documentação oficial descreve canvas espacial com movimentação/zoom e manipulação de nós; isso orienta testes próprios, sem copiar visual ou código. [Canvas](https://www.themaestri.app/pt-br/docs/canvas).
- **Observado nesta sessão instalada:** `maestri recruit` criou dois trabalhadores e os conectou; `list` confirmou conexões; Codex e Antigravity iniciaram, receberam mensagens e retornaram por `ask`. Logs instrumentados em `proofs/maestri-setup/`. São observações da instalação existente, não testes do instalador de referência. A documentação descreve shells completos e presets. [Terminais](https://www.themaestri.app/pt-br/docs/terminals).
- **Conexão com função comprovada via CLI:** comunicação bidirecional REGENTE/trabalhadores ocorreu usando nomes conectados; isso não comprova desenho, física de cabos ou atalhos da UI. A documentação explica comunicação entre CLIs ligadas. [Conexões](https://www.themaestri.app/pt-br/docs/connections).
- **Não testado para Maestri:** arraste/redimensionamento pela UI, pan/zoom, grupos, persistência após reinício, recuperação de falhas e eliminação de processos órfãos. Não foram fechados/reiniciados projetos ou sessões ativos do usuário para testar essas propriedades.

## Implementação original do CIRANDA

Tauri v2/Rust possui processos e sessões; ConPTY/portable-pty fornece terminal Windows; SQLite guarda layout/estado; React/TypeScript representa canvas; xterm exibe bytes. A comunicação segue `docs/SESSION_API.md`. Essa é a arquitetura **escolhida para o CIRANDA**, não inferência sobre o Maestri. Caminhos, limites, limpeza Windows e recuperação exigem testes próprios; uma linha desenhada ou saída simulada não comprovam integração.

Prioridades, critérios de aceitação e estado estão em `docs/PARIDADE_MAESTRI.md`. O desenvolvimento do MVP segue em paralelo, sem esperar investigação proprietária ou exigir tema Fazenda.
