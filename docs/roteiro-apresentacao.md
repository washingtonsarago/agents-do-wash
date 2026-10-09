# 🎬 Roteiro da apresentação

O modo apresentação é um tour automático, com câmera, legendas e cenas encenadas, feito para gravar a tela narrando.
Ele usa o modo demo, com dados de exemplo, então nada das suas sessões reais aparece.

## Como gravar

1. Com o observador rodando, abra **http://localhost:4321/?demo&tour** (ou clique em 🎬 no topo do site).
2. Deixe o navegador em tela cheia (`Ctrl + Cmd + F`) e silencie as notificações (Foco → Não perturbe).
3. Comece a gravar: `Cmd + Shift + 5` → *Gravar a tela inteira* (ou *Gravar parte selecionada*).
4. O tour começa sozinho e cada cena avança no tempo dela. **Duração total: ~3 min 40 s.**

| Tecla | O que faz |
|---|---|
| `→` / `←` | próxima / cena anterior |
| `espaço` | pausa e retoma (para você falar com calma) |
| `H` | esconde ou mostra a legenda (se preferir só a sua voz) |
| `Esc` | sai do tour |

> Dica: faça uma passada de ensaio antes. Se uma cena terminar antes da sua fala, aperte `espaço`; se quiser pular, `→`.

## Cenas e sugestão de narração

| # | Cena | Tempo | Sugestão de fala |
|---|---|---:|---|
| 1 | **Abertura** | 12 s | "Eu cansei de ficar olhando terminal o dia inteiro. Então eu criei o Agents do Wash: um escritório 3D onde os meus agentes do Claude Code aparecem trabalhando, ao vivo." |
| 2 | **Os agentes** | 16 s | "Cada agente que chega escolhe o próprio nome e o estilo de roupa, e guarda isso. Do lado, eu vejo quem está trabalhando agora, em árvore, com quanto cada um já gastou de tokens." |
| 3 | **Ferramentas** | 16 s | "O que eles fazem vira movimento. Quem roda comando vai para o terminal, quem lê código vai para a biblioteca, quem pesquisa vai para o globo da internet, quem mexe no Jira vai para o quadro. Escrever código é na própria mesa." |
| 4 | **Subagentes** | 14 s | "Quando o agente principal delega uma tarefa, ele chama um subagente para a sala de reunião, e a lista mostra quem é filho de quem." |
| 5 | **Heróis** | 18 s | "E dá para trocar o visual de todo mundo: heróis de capa, heróis de armadura, cada um com as cores de um herói conhecido… ou deixar cada um no seu estilo." |
| 6 | **👔 O chefe** | 14 s | "O escritório também tem personagens. O chefe patrulha e dá bronca, principalmente em quem está descansando no chafariz ou tomando café." |
| 7 | **🛡️ Head de segurança** | 17 s | "O head de segurança dá dicas de acordo com o que cada um está fazendo. E às vezes ele exagera no jargão… ninguém entende nada, e ele tem que traduzir." |
| 8 | **💪 O CTO** | 18 s | "E tem o CTO: grisalho, bombado e de regata. Ele dá bronca em todo mundo, inclusive no chefe e no head de segurança." |
| 9 | **🤖 Limpinho** | 12 s | "O Limpinho, o robô de limpeza, passa pano no escritório inteiro e ainda pede licença." |
| 10 | **☕ Copa** | 13 s | "Quando um agente fica à toa, ele não fica parado: vai tomar café, ler na biblioteca, bater papo na sala de reunião ou descansar no chafariz." |
| 11 | **🌳 Jardim** | 12 s | "Lá fora tem jardim, riacho e chafariz. Todo mundo desvia dos obstáculos e só atravessa o riacho pela ponte." |
| 12 | **📋 Jira e 💬 Slack** | 14 s | "Na parede, um quadro com as minhas issues do Jira e uma TV com as mensagens do Slack, que se atualizam sozinhos. Quando um agente mexe numa issue, o card mostra quem foi." |
| 13 | **🖥️ Terminal** | 18 s | "Clicando num agente, eu abro o terminal da sessão dele e posso mandar mensagem. Se ele estiver ocupado, a mensagem entra na fila e é entregue quando ele terminar." |
| 14 | **Slack** | 16 s | "E eu falo com eles de qualquer lugar, pelo Slack: peço a lista com o que cada um está fazendo e mando tarefas por mensagem direta." |
| 15 | **Encerramento** | 12 s | "É tudo código aberto: está no meu GitHub, washingtonsarago/agents-do-wash. Quem quiser, é só clonar e rodar." |

## Para lembrar enquanto narra

- **Ver e acompanhar não gasta token.** O observador só lê os registros do Claude Code. Só as mensagens que você envia geram uso.
- **Tudo roda localmente**, no seu Mac. O envio de mensagens é protegido por token, e o bot do Slack só aceita mensagens diretas suas.
- **Os personagens do escritório** (chefe, segurança, CTO e Limpinho) são só visuais: não são sessões do Claude.
