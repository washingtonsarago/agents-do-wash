// Agents do Wash — bot do Slack (Socket Mode): DMs suas viram mensagens para os agentes locais.
// Segurança: só aceita mensagens diretas (DM) de UM usuário do Slack (allowedUser) do mesmo workspace do bot.
// Tudo o mais (canais, outras pessoas, outros bots, edições) é ignorado. Tokens só no arquivo de config.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = process.env.AW_CONFIG_DIR || path.join(os.homedir(), '.config', 'agents-do-wash');
const readJson = name => { try { return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, name), 'utf8')); } catch { return null; } };
const FORCE_TTL = 10 * 60e3;

function botConfig() {
  const c = readJson('slackbot.json');
  if (!c || !/^xoxb-/.test(c.botToken || '') || !/^xapp-/.test(c.appToken || '')) return null;
  return { botToken: c.botToken, appToken: c.appToken, allowedUser: c.allowedUser || null };
}

const unescape = s => String(s || '').replace(/<@[A-Z0-9]+>/g, '').replace(/<(https?:[^|>]+)\|[^>]+>/g, '$1').replace(/<(https?:[^>]+)>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const escape = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (s, n) => (s = String(s || '')).length > n ? s.slice(0, n) + '\n… (resposta cortada)' : s;
const ago = ts => { const s = (Date.now() - ts) / 1000; return s < 60 ? 'agora' : s < 3600 ? `há ${Math.floor(s / 60)} min` : `há ${Math.floor(s / 3600)} h`; };

const STATUS = {
  working: '🟢 trabalhando', waiting: '🟠 aguardando você', replying: '⏳ respondendo sua mensagem',
  idle: '⚪ parado', failed: '🔴 parou com erro',
};
const prettyTool = t => String(t || '').startsWith('mcp__') ? String(t).split('__').pop() : t;
const one = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

// uma sessão com o contexto do que está acontecendo nela
function describe(s, i) {
  const lines = [`${i + 1}. 👑 *${escape(s.name)}* \`${s.id.slice(0, 8)}\` · ${STATUS[s.status] || s.status} · ativa ${ago(s.lastTs)}`];
  if (s.cwd) lines.push(`      📁 \`${escape(s.cwd)}\``);
  if (s.status === 'waiting' && s.waiting) lines.push(`      ❗ ${escape(one(s.waiting.text, 120))}`);
  if (s.asked) lines.push(`      📋 pedido ${ago(s.asked.ts)}: _${escape(one(s.asked.text, 140))}_`);
  if (s.action) lines.push(`      🔧 última ação ${ago(s.action.ts)}: *${escape(prettyTool(s.action.tool))}*${s.action.target ? ' · ' + escape(one(s.action.target, 80)) : ''}`);
  if (s.said) lines.push(`      💬 ${escape(one(s.said.text, 160))}`);
  if (s.subs?.length) {
    lines.push(`      👥 subagents (${s.subs.length}):`);
    for (const sub of s.subs.slice(0, 6)) {
      const doing = sub.action ? ` · ${escape(prettyTool(sub.action.tool))}${sub.action.target ? ' ' + escape(one(sub.action.target, 50)) : ''}` : '';
      lines.push(`            • ${escape(sub.name)}${sub.task ? ' — ' + escape(one(sub.task, 60)) : ''} · ${(STATUS[sub.status] || sub.status).split(' ')[0]}${doing}`);
    }
    if (s.subs.length > 6) lines.push(`            … e mais ${s.subs.length - 6}`);
  }
  return lines.join('\n');
}

const HELP = [
  '*Agents do Wash* — fale com os agentes do seu Mac por aqui.',
  '• `lista` mostra os agentes rodando: status, pasta, o que pediram, o que estão fazendo e os subagents',
  '• `contexto 2` (ou `contexto nome`) mostra as últimas ações daquela sessão',
  '• `nome: mensagem` (ou `@nome mensagem`, ou `2: mensagem` pelo número da lista) envia para uma sessão',
  '• texto sem nome vai para a última sessão com que você falou por aqui (ou a mais recente)',
  '• se a sessão estiver aberta num terminal, eu pergunto antes; responda `sim` na thread para confirmar',
].join('\n');

module.exports = function slackBot({ listSessions, sendToAgent, emit, historyOf }) {
  let ws = null, retryTimer = null;
  let state = { kind: 'slackbot', state: 'off' };
  let botUserId = null, teamId = null, allowed = null;
  const seen = new Set();
  const pendingForce = new Map(); // thread ts -> { agentId, text, until }
  let sticky = null;              // última sessão falada pelo Slack
  let lastList = [];              // para "2: mensagem"
  const ignored = new Set();

  const setState = s => { state = { kind: 'slackbot', ...s }; emit(state); };

  async function api(method, token, body) {
    const r = await fetch('https://slack.com/api/' + method, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body || {}),
      signal: AbortSignal.timeout(15000),
    });
    return r.json();
  }

  function retry(ms) { clearTimeout(retryTimer); retryTimer = setTimeout(connect, ms); }

  async function connect() {
    const cfg = botConfig();
    if (!cfg) { setState({ state: 'off' }); return retry(60e3); } // sem config: tenta de novo depois
    try {
      const auth = await api('auth.test', cfg.botToken);
      if (!auth.ok) { setState({ state: 'error', error: `bot token recusado (${auth.error})` }); return retry(120e3); }
      botUserId = auth.user_id; teamId = auth.team_id;
      allowed = cfg.allowedUser;
      if (!allowed) { // descobre o seu ID pelo token de usuário do slack.json, se ele for do mesmo workspace
        const userToken = readJson('slack.json')?.token;
        const me = userToken ? await api('auth.test', userToken) : null;
        if (me?.ok && me.team_id === teamId) allowed = me.user_id;
      }
      if (!allowed) { setState({ state: 'error', error: 'defina allowedUser (seu ID de membro do Slack) no slackbot.json' }); return retry(120e3); }
      const open = await api('apps.connections.open', cfg.appToken);
      if (!open.ok) { setState({ state: 'error', error: `app token recusado (${open.error})` }); return retry(120e3); }
      ws = new WebSocket(open.url);
      ws.onopen = () => { setState({ state: 'on' }); console.log(`🤖 bot do Slack conectado (aceita DMs só de ${allowed})`); };
      ws.onmessage = ev => { try { onFrame(JSON.parse(ev.data), cfg); } catch (e) { console.error('slackbot:', e.message); } };
      ws.onclose = () => { ws = null; if (state.state === 'on') setState({ state: 'reconnecting' }); retry(3000); };
      ws.onerror = () => {};
    } catch (e) {
      setState({ state: 'error', error: 'não consegui falar com o Slack (' + e.message + ')' });
      retry(30e3);
    }
  }

  function reply(cfg, channel, thread_ts, text) {
    return api('chat.postMessage', cfg.botToken, { channel, thread_ts, text, unfurl_links: false, unfurl_media: false })
      .then(r => { if (!r.ok) console.error('slackbot: chat.postMessage', r.error); })
      .catch(e => console.error('slackbot:', e.message));
  }

  function onFrame(f, cfg) {
    if (f.envelope_id) ws?.send(JSON.stringify({ envelope_id: f.envelope_id })); // ack
    if (f.type === 'disconnect') return ws?.close();
    if (f.type !== 'events_api') return;
    const p = f.payload || {}, e = p.event || {};
    if (p.team_id && p.team_id !== teamId) return;
    if (p.event_id) { if (seen.has(p.event_id)) return; seen.add(p.event_id); if (seen.size > 2000) seen.delete(seen.values().next().value); }
    if (e.type !== 'message' || e.channel_type !== 'im' || e.subtype || e.bot_id || e.user === botUserId) return;
    if (e.user !== allowed) {
      if (!ignored.has(e.user)) { ignored.add(e.user); console.log(`🤖 ignorando DM de ${e.user} (não autorizado)`); }
      return;
    }
    handle(cfg, e);
  }

  function resolveTarget(word, sessions) {
    if (!word) return null;
    const w = word.toLowerCase();
    if (/^\d+$/.test(w)) { // número da última lista enviada (ou da ordem atual, se ainda não pediu a lista)
      const id = (lastList.length ? lastList : sessions.map(s => s.id))[Number(w) - 1];
      return sessions.find(s => s.id === id) || null;
    }
    return sessions.find(s => s.name.toLowerCase() === w) || (w.length >= 6 ? sessions.find(s => s.id.startsWith(w)) : null) || null;
  }

  function handle(cfg, e) {
    const text = unescape(e.text).trim();
    const thread = e.thread_ts || e.ts;
    const say = msg => reply(cfg, e.channel, thread, msg);
    const sessions = listSessions(); // principais ativas, mais recente primeiro

    if (/^(ajuda|help|\?)$/i.test(text)) return say(HELP);
    if (/^(lista|list|sess(ões|oes))$/i.test(text)) {
      if (!sessions.length) return say('Nenhuma sessão ativa nos últimos 30 min.');
      lastList = sessions.map(s => s.id);
      const body = sessions.map((s, i) => describe(s, i) + (s.id === sticky ? '\n      ⭐ _é para cá que vai o texto sem nome_' : '')).join('\n\n');
      return say(`*Agentes rodando* (${sessions.length})\n\n${body}\n\n_Para falar com um: \`2: sua mensagem\` · detalhes: \`contexto 2\`_`);
    }

    // últimas ações de uma sessão, no estilo do terminal
    const cx = text.match(/^(contexto|detalhe|detalhes|context)\s+(\S+)$/i);
    if (cx) {
      const t = resolveTarget(cx[2], sessions);
      if (!t) return say('Não achei essa sessão. Mande `lista` para ver os números.');
      const h = historyOf?.(t.id);
      if (!h || !h.entries.length) return say(`Sem histórico para *${escape(t.name)}* ainda.`);
      const icon = { user: '❯', text: '⏺', tool: '⏺', result: '  ⎿' };
      const tail = h.entries.slice(-14).map(e => escape(`${icon[e.t] || '·'} ${e.t === 'result' ? one(e.text, 120) : one(e.text, 300)}`));
      return say(`${describe(t, sessions.indexOf(t))}\n\n*Últimas ações:*\n\`\`\`${tail.join('\n').replace(/\`\`\`/g, "'''")}\`\`\``);
    }

    // confirmação de envio para sessão aberta num terminal
    if (/^(sim|s|yes|y)$/i.test(text) && e.thread_ts && pendingForce.has(e.thread_ts)) {
      const pend = pendingForce.get(e.thread_ts); pendingForce.delete(e.thread_ts);
      if (Date.now() > pend.until) return say('A confirmação expirou. Mande a mensagem de novo.');
      return send(pend.agentId, pend.text, true);
    }

    // "nome: msg", "@nome msg" ou "2: msg"
    let target = null, msg = text;
    const m = text.match(/^@?([\w.-]+)(?::\s*|\s+)([\s\S]+)$/);
    if (m) { const t = resolveTarget(m[1], sessions); if (t) { target = t; msg = m[2].trim(); } }
    if (!target) target = sessions.find(s => s.id === sticky) || sessions[0];
    if (!target) return say('Nenhuma sessão ativa nos últimos 30 min. Abra o Claude Code ou mande `ajuda`.');
    if (!msg) return say(HELP);
    return send(target.id, msg, false);

    function send(agentId, body, force) {
      const s = listSessions().find(x => x.id === agentId) || { name: agentId, id: agentId };
      const [status, res] = sendToAgent({ agentId, text: body, force }, {
        via: 'slack',
        onDone: (ok, out) => say(ok
          ? `✅ *${escape(s.name)}* respondeu:\n${escape(clip(out || '(sem texto)', 3500))}`
          : `❌ *${escape(s.name)}* falhou: ${escape(clip(out, 1000))}`),
      });
      if (status === 202) { sticky = agentId; return say(`📨 Enviado para *${escape(s.name)}* \`${agentId.slice(0, 8)}\`. A resposta chega aqui na thread.`); }
      if (res.live) {
        pendingForce.set(thread, { agentId, text: body, until: Date.now() + FORCE_TTL });
        return say(`⚠️ ${escape(res.error)}\nResponda *sim* nesta thread para enviar mesmo assim.`);
      }
      return say('❌ ' + escape(res.error || `erro ${status}`));
    }
  }

  return { start: connect, state: () => state };
};
