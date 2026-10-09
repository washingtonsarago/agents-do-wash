# 🏢 Agents do Wash (POC)

Um escritório 3D com jardim onde seus agentes do Claude Code (bonequinhos amarelos de macacão; o principal usa coroa 👑, os subagents têm macacão na cor do seu tipo) andam pelo cenário conforme trabalham.

![Visão geral do escritório e do jardim](docs/screenshots/visao-geral.jpg)

| | |
|---|---|
| ![Bonequinhos trabalhando no escritório](docs/screenshots/bonequinhos.jpg) | ![Jardim com riacho, ponte e chafariz](docs/screenshots/jardim.jpg) |
| **Escritório**: cada agente vai até a estação da ferramenta que está usando | **Jardim**: agentes ociosos atravessam a ponte e descansam no chafariz |
| ![Terminal da sessão no site](docs/screenshots/terminal.jpg) | ![Quadro Kanban do Jira](docs/screenshots/jira.jpg) |
| **Terminal**: histórico e ao vivo de cada sessão, com envio de mensagens | **Jira**: suas issues, com destaque para as que os agentes mexeram |

<sub>Prints do modo demo (`/?demo`), com dados fictícios.</sub>

## Arquitetura

![Arquitetura do Agents do Wash](docs/arquitetura.png)

- **Observador**: Node puro, zero dependências, só escuta em `127.0.0.1`. Lê os transcripts e recebe os hooks; a única ação que ele executa é o envio de mensagens (`claude -p --resume`), protegido por token.
- **Duas fontes**: os transcripts JSONL (sempre) e os hooks (opcional, instantâneo). Eventos repetidos são descartados pelo `tool_use_id`.
- **Mundo**: Three.js via CDN, sem build. `world/office.js` monta o cenário; `world/buddy.js`, os bonequinhos com animação procedural (andar, correr, sentar, acenar, pular, dançar…).
- **Cenário**: escritório com 36 mesas em 6 ilhas, biblioteca, sala de servidores, sala de reunião com quadro, copa, relógio com a hora real. Pela porta de vidro sai-se para o jardim: riacho, ponte em arco, chafariz com bancos, árvores e flores.

## Rodar

```sh
./start.sh                         # sobe em http://localhost:4321 e abre o navegador
open http://localhost:4321/?demo   # modo demo, sem precisar de sessão ativa
./install-launchd.sh               # opcional: sempre ligado no login do macOS
```

Variáveis: `PORT` (4321), `ACTIVE_MIN` (30: só mostra sessões tocadas nos últimos N min), `CLAUDE_PROJECTS`.

## Hooks (tempo real)

```sh
node hooks/install.js              # adiciona hooks async em ~/.claude/settings.json (faz backup)
node hooks/install.js --uninstall  # remove só os hooks do Agents do Wash
```

Os hooks são `async` e o `emit.sh` sempre sai com 0. Se o observador estiver desligado, nada trava.
Com hooks ativos, o status mostra **ao vivo ⚡ hooks**. Os últimos payloads ficam em http://localhost:4321/debug.

| Hook | No mundo |
|---|---|
| `PreToolUse` | vai até a estação na hora (sem esperar o JSONL) |
| `PostToolUse` com erro | balança a cabeça (`No`) e mostra ❌ |
| `Notification` / `PermissionRequest` | pula e fica acenando com um balão vermelho ❗ até você responder |
| `Stop` | 👍 e volta a sentar na mesa |
| `SubagentStop` / `SessionEnd` | acena 👋 e sai pela porta |
| `UserPromptSubmit` | balão 🧑 com seu prompt |

## Terminal no site

Clique num bonequinho (ou no nome dele na lista) para abrir o terminal da sessão dele: o histórico
(`GET /history`, até as últimas 400 entradas) e, ao vivo, cada prompt `❯`, resposta `⏺`, ferramenta `⏺ Nome(args)`
e saída `⎿` (saídas longas começam recolhidas; clique para expandir). Esc fecha.

## Falar com um agente pelo site

No terminal de uma sessão principal, escreva no `❯` e aperte Enter. O servidor roda
`claude -p --resume <sessão> "<mensagem>"` no diretório da sessão; a conversa continua na **mesma** sessão,
então a resposta aparece no transcript, no feed e no bonequinho.

- Só sessões principais 👑. Subagents recebem tarefas de quem os criou; a caixa oferece falar com o agente principal.
- Se a sessão teve atividade nos últimos 2 min, ela deve estar aberta num terminal. O site avisa e só envia com **Enviar mesmo assim**, porque abre uma segunda instância em paralelo na mesma conversa.
- Roda sem terminal interativo: ferramentas que pediriam permissão seguem as regras do seu `settings.json` e, se não estiverem liberadas, são negadas.
- Um envio por vez por sessão; tempo máximo de 30 min.
- **Segurança**: o `POST /send` exige um token aleatório gerado a cada subida do servidor (injetado na página), `Origin` e `Host` locais e `Content-Type: application/json`. Outros sites abertos no navegador não conseguem enviar.
- Binário: `CLAUDE_BIN` ou o primeiro `claude` encontrado em `~/.local/bin`, `/opt/homebrew/bin`, `/usr/local/bin` ou `PATH`.

## Jira e Slack ao vivo

Na parede do fundo há um **quadro Kanban do Jira** e uma **TV do Slack**, atualizados a cada 60 s pelo observador.
Clique num deles para a câmera ficar de frente; com ela de frente, clique num card ou mensagem para abrir. 🏠 volta à visão geral.

- **Jira**: suas issues (`assignee = currentUser()`, abertas ou mexidas nos últimos 7 dias) e as que algum agente tocou nas últimas 24 h.
  O card que um agente acabou de mexer fica destacado, com o nome dele. Agentes usando ferramentas do Jira vão até o quadro.
- **Slack**: as mensagens mais recentes da busca `to:me` (configurável). Mensagens novas acendem a TV e entram no feed.

As credenciais ficam **só no servidor**, em arquivos com permissão 600 (não vão para o navegador nem para o log).
Crie-os num terminal (o `read -s` não mostra o que você digita):

```sh
mkdir -p ~/.config/agents-do-wash && cd ~/.config/agents-do-wash

# Jira: token em https://id.atlassian.com/manage-profile/security/api-tokens
read -s "T?Jira API token: " && printf '{"site":"SEU-SITE.atlassian.net","email":"SEU-EMAIL","token":"%s"}\n' "$T" > jira.json && chmod 600 jira.json; unset T

# Slack: token de USUÁRIO (xoxp-) de um app seu com o escopo search:read
read -s "T?Slack user token: " && printf '{"token":"%s","query":"to:me"}\n' "$T" > slack.json && chmod 600 slack.json; unset T
```

Opcionais: `"jql"` no `jira.json` e `"query"` no `slack.json` (sintaxe de busca do Slack). Variáveis de ambiente
`JIRA_SITE`, `JIRA_EMAIL`, `JIRA_API_TOKEN`, `JIRA_JQL`, `SLACK_TOKEN` e `SLACK_QUERY` têm prioridade.
Não precisa reiniciar: o observador relê os arquivos a cada consulta. Erros (token recusado, escopo faltando) aparecem no próprio quadro/TV.

## Falar com os agentes pelo Slack

Mande DM para o bot **Agents do Wash** no Slack:

| Você escreve | O que acontece |
|---|---|
| `lista` | agentes rodando, numerados: status (🟢 trabalhando, 🟠 aguardando você, ⏳ respondendo, ⚪ parado), pasta, o que foi pedido, a última ação, a última fala e os subagents |
| `contexto 2` (ou `contexto nome`) | as últimas ações daquela sessão, no estilo do terminal |
| `ems: roda os testes` (ou `@ems …`, ou `2: …`) | envia para essa sessão (`claude -p --resume`) |
| texto sem nome | vai para a última sessão com que você falou pelo Slack (ou a mais recente) |
| `sim` na thread | confirma o envio para uma sessão que está aberta num terminal |
| `ajuda` | mostra os comandos |

A resposta do agente chega na mesma thread, e o bonequinho reage no escritório.

**Segurança:** o bot só aceita **DMs de um único usuário** (`allowedUser`, você), do mesmo workspace do bot.
Canais, outras pessoas, outros bots, edições e eventos repetidos são ignorados. A conexão é por Socket Mode (sai do
seu Mac; não há URL pública). Vale tudo das regras do envio pelo site (só sessões principais, uma por vez, confirmação).

**Instalação** (uma vez):
1. Em https://api.slack.com/apps → *Create New App* → *From a manifest* → escolha o workspace e cole `slack-app-manifest.yml`.
2. *Install to Workspace*. Em *OAuth & Permissions*, copie o **Bot User OAuth Token** (`xoxb-`) e o **User OAuth Token** (`xoxp-`).
3. Em *Basic Information → App-Level Tokens*, gere um token com o escopo `connections:write` (`xapp-`).
4. No seu terminal:

```sh
cd ~/.config/agents-do-wash
read -s "B?Bot token (xoxb-): " && echo && read -s "A?App token (xapp-): " && echo && \
  printf '{"botToken":"%s","appToken":"%s"}\n' "$B" "$A" > slackbot.json && chmod 600 slackbot.json; unset B A
# o token de usuário (xoxp-) deste app também serve para a TV do Slack:
read -s "T?User token (xoxp-): " && printf '{"token":"%s","query":"to:me"}\n' "$T" > slack.json && chmod 600 slack.json; unset T
```

O bot descobre o seu ID pelo token de usuário (`slack.json`, mesmo workspace). Para fixar manualmente, adicione
`"allowedUser": "U…"` ao `slackbot.json` (Slack → seu perfil → ⋮ → *Copiar ID de membro*). O observador tenta conectar
a cada minuto; quando conectar, aparece **🤖 Slack bot ligado** no topo do site.

## O que cada ferramenta faz no mundo

| Ferramenta | Lugar | Gesto ao chegar |
|---|---|---|
| Read, Grep, Glob | 📚 Biblioteca | Yes |
| Bash, Monitor | 🖥️ Terminal | Punch |
| WebFetch, WebSearch, Chrome | 🌐 Internet | ThumbsUp |
| Agent, SendMessage, Workflow | 🤝 Sala de reunião | Wave |
| Ferramentas do Jira (`mcp__…Atlassian__*`) | 📋 Quadro do Jira | Yes |
| Ferramentas do Slack (`mcp__…Slack__*`) | 💬 TV do Slack | Wave |
| Outros `mcp__*` (Gmail, Drive…) | 📮 Integrações | Yes |
| Edit, Write e o resto | ✍️ A própria mesa | senta e digita |

Longe do destino, o bonequinho corre; perto, anda. Sem atividade por 45 s, ele atravessa a ponte e senta num banco do chafariz. Ao terminar o turno (`Stop`), dança na mesa. Depois de 30 min, sai do escritório.
Na lista de moradores, cada subagent aparece abaixo de quem o criou.
