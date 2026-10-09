# 🎬 Roteiro da apresentação

O modo apresentação é um tour automático, com câmera, legendas e cenas encenadas, feito para gravar a tela narrando.
Ele usa o modo demo, com dados de exemplo, então nada das suas sessões reais aparece.

## Como gravar

1. Com o observador rodando, abra **http://localhost:4321/?demo&tour** (ou clique em 🎬 no topo do site).
2. Aperte **`P`**: abre a **tela do apresentador**, uma janela pequena no canto direito com a **sugestão de fala**, o cronômetro
   da cena, a próxima cena e os botões ⏮ ⏯ ⏭. Enquanto ela está aberta, a legenda **some da tela gravada**.
   - Com dois monitores: arraste a janelinha para o outro monitor (ou estique para ver também a lista de cenas).
   - Com um monitor só: deixe a janelinha no canto e grave **só a janela do escritório** (`Cmd + Shift + 5` → *Gravar parte selecionada*).
3. Silencie as notificações (Foco → Não perturbe) e comece a gravar (`Cmd + Shift + 5`).
4. O tour começa sozinho e cada cena avança no tempo dela. **A versão padrão tem 1 minuto** (10 cenas). A versão completa,
   com 18 cenas e ~4 min 20 s, fica em **http://localhost:4321/?demo&tour=completo**.

| Tecla | O que faz |
|---|---|
| `→` / `←` | próxima / cena anterior |
| `espaço` | pausa e retoma (para você falar com calma) |
| `H` | esconde ou mostra a legenda (se preferir só a sua voz) |
| `P` | abre a tela do apresentador (fala sugerida, cronômetro e controles) |
| `Esc` | sai do tour |

> Dica: faça uma passada de ensaio antes. Se uma cena terminar antes da sua fala, aperte `espaço`; se quiser pular, `→`.

## Versão de 1 minuto (padrão)

| # | Cena | Tempo | Sugestão de fala |
|---|---|---:|---|
| 1 | Abertura | 5 s | "Esses são os meus agentes do Claude Code trabalhando ao vivo, num escritório 3D." |
| 2 | Ferramentas | 7 s | "Cada ferramenta tem um lugar: terminal, biblioteca, internet, quadro do Jira." |
| 3 | Heróis | 7 s | "Dá para trocar o visual: heróis de capa ou de armadura." |
| 4 | 👔 Chefe | 6 s | "O chefe dá bronca em quem está à toa." |
| 5 | 🛡️ Segurança | 7 s | "O head de segurança dá dicas… às vezes em jargão demais." |
| 6 | 💪 CTO | 6 s | "E o CTO dá bronca em todo mundo, até no chefe." |
| 7 | 🤖 Limpinho | 4 s | "O Limpinho mantém tudo limpo." |
| 8 | Jira e Slack | 5 s | "Jira e Slack aparecem na parede, ao vivo." |
| 9 | 🖥️ Terminal | 9 s | "Clico num agente, vejo o terminal dele e mando mensagens, com fila." |
| 10 | Encerramento | 4 s | "Código aberto no meu GitHub: washingtonsarago/agents-do-wash." |
| | **Total** | **60 s** | |

## Versão completa (`?demo&tour=completo`): cenas e sugestão de narração

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
| 13 | **🖥️ Terminal** | 18 s | "Clicando num agente, eu abro o terminal da sessão dele: o que pedi, cada ferramenta que ele usou e o que respondeu. Daqui eu mando mensagem, e se ele estiver ocupado, ela entra na fila e é entregue quando ele terminar." |
| 14 | **✏️ Nomes** | 13 s | "Para organizar, eu dou o nome que eu quiser para um agente. O nome muda em cima dele, na lista, no terminal e no Slack, e fica salvo." |
| 15 | **❗ Permissão** | 12 s | "Quando um agente precisa de aprovação, ele pula e acena com um balão vermelho. Dá para ver de longe quem está esperando por mim." |
| 16 | **🎥 Câmera** | 13 s | "Eu posso aproximar onde quiser, voar até um lugar pelo menu, ou deixar a câmera seguindo um agente: aqui ela vai atrás dele até o jardim." |
| 17 | **Slack** | 16 s | "E eu falo com eles de qualquer lugar, pelo Slack: peço a lista com o que cada um está fazendo e mando tarefas por mensagem direta." |
| 18 | **Encerramento** | 12 s | "É tudo código aberto: está no meu GitHub, washingtonsarago/agents-do-wash. Quem quiser, é só clonar e rodar." |

## Para lembrar enquanto narra

- **Ver e acompanhar não gasta token.** O observador só lê os registros do Claude Code. Só as mensagens que você envia geram uso.
- **Tudo roda localmente**, no seu Mac. O envio de mensagens é protegido por token, e o bot do Slack só aceita mensagens diretas suas.
- **Os personagens do escritório** (chefe, segurança, CTO e Limpinho) são só visuais: não são sessões do Claude.
