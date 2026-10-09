#!/usr/bin/env node
// Agents do Wash — observador local, zero dependências.
// Faz tail dos transcripts JSONL do Claude Code e transmite eventos via SSE.
// Única escrita: POST /send retoma uma sessão com `claude -p --resume` (protegido por token + origem).
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');
const integrations = require('./integrations');
const slackBot = require('./slackbot');

const PORT = Number(process.env.PORT) || 4321;
const ROOT = process.env.CLAUDE_PROJECTS || path.join(os.homedir(), '.claude', 'projects');
const ACTIVE_MS = Number(process.env.ACTIVE_MIN || 30) * 60e3; // só acompanha arquivos tocados recentemente
const SCAN_MS = 1000;
const BACKLOG_BYTES = 24 * 1024; // na partida, reprocessa o fim de cada arquivo ativo
const WORLD_DIR = path.join(__dirname, '..', 'world');

const integ = integrations({ emit: (ev) => emitLive(ev), short: (s, n) => short(s, n) });
const files = new Map();  // caminho -> { offset, rest, agentId }
const agents = new Map(); // id -> { id, kind, type, name, parent, project, tokens, lastTs }
const seenMsgs = new Set();
const seenTools = new Map(); // tool_use_id -> agentId (dedupe hook × JSONL)
const lastPrompt = new Map(); // agentId -> texto (dedupe hook × JSONL)
const hookLog = [];          // últimos payloads de hook, para /debug
let hooksLastTs = 0;
const clients = new Set();
const recent = [];
let firstScan = true;

function markTool(toolId, agentId) {
  if (!toolId) return true;
  if (seenTools.get(toolId) === agentId) return false;
  seenTools.set(toolId, agentId);
  if (seenTools.size > 5000) seenTools.delete(seenTools.keys().next().value);
  return true;
}

// contexto de cada agente (o que pediram, o que está fazendo, se espera você) — usado pelo bot do Slack
function trackContext(a, ev) {
  const ctx = a.ctx || (a.ctx = {});
  const ts = ev.ts || Date.now();
  switch (ev.kind) {
    case 'tool': ctx.action = { tool: ev.tool, target: ev.issue || ev.target || '', ts }; ctx.status = 'working'; break;
    case 'say': ctx.said = { text: ev.text, ts }; ctx.status = 'working'; break;
    case 'prompt': case 'sendStart': ctx.asked = { text: ev.text, ts }; ctx.status = 'working'; break;
    case 'attention': ctx.status = 'waiting'; ctx.waiting = { text: ev.text, ts }; break;
    case 'stop': ctx.status = ev.failed ? 'failed' : 'idle'; break;
    case 'leave': ctx.status = 'gone'; break;
  }
}

function broadcast(ev) {
  if (ev.kind !== 'agent') {
    const a = agents.get(ev.id);
    if (a && !ev.replay) a.lastTs = Date.now();
    if (a) trackContext(a, ev);
  }
  recent.push(ev);
  if (recent.length > 300) recent.shift();
  const data = `data: ${JSON.stringify(ev)}\n\n`;
  for (const res of clients) res.write(data);
}

// eventos que não entram no replay (estado das integrações)
function emitLive(ev) {
  const data = `data: ${JSON.stringify(ev)}\n\n`;
  for (const res of clients) res.write(data);
}

function short(s, n) {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function describeTool(name, input = {}) {
  if (input.file_path) return path.basename(input.file_path);
  if (input.notebook_path) return path.basename(input.notebook_path);
  if (name === 'Bash') return short(input.description || input.command, 60);
  if (name === 'Agent' || name === 'Task') return `${input.subagent_type || 'general-purpose'}: ${short(input.description, 40)}`;
  if (input.pattern) return short(input.pattern, 50);
  if (input.url) { try { return new URL(input.url).host; } catch { return short(input.url, 50); } }
  if (input.query) return short(input.query, 50);
  if (input.skill) return input.skill;
  return '';
}

function readCwd(file) {
  try {
    const fd = fs.openSync(file, 'r');
    const buf = Buffer.alloc(32 * 1024);
    const n = fs.readSync(fd, buf, 0, buf.length, 0);
    fs.closeSync(fd);
    const m = buf.toString('utf8', 0, n).match(/"cwd":"((?:[^"\\]|\\.)*)"/);
    return m ? JSON.parse(`"${m[1]}"`) : null;
  } catch { return null; }
}

function registerAgent(file) {
  const base = path.basename(file, '.jsonl');
  const isSub = path.basename(path.dirname(file)) === 'subagents';
  let info;
  if (isSub) {
    const sessionId = path.basename(path.dirname(path.dirname(file)));
    let meta = {};
    try { meta = JSON.parse(fs.readFileSync(file.replace(/\.jsonl$/, '.meta.json'), 'utf8')); } catch {}
    const id = base.replace(/^agent-/, '');
    info = {
      id, kind: 'sub', type: meta.agentType || 'subagent',
      name: meta.agentType || 'subagent', task: meta.description || '',
      parent: meta.parentAgentId || sessionId,
    };
  } else {
    info = { id: base, kind: 'main', type: 'main', name: 'Claude', task: '', parent: null };
  }
  const prev = agents.get(info.id);
  if (prev) { // pode ter sido criado antes por um hook; completa com o meta.json
    const vague = prev.type === 'subagent' && info.type !== 'subagent';
    if ((!prev.task && info.task) || vague) {
      prev.task = prev.task || info.task;
      if (vague) prev.type = prev.name = info.type;
      broadcast({ kind: 'agent', agent: prev });
    }
    return prev.id;
  }
  info.tokens = 0;
  info.lastTs = Date.now();
  const cwd = readCwd(file);
  if (cwd) { info.cwd = cwd; info.project = path.basename(cwd); if (info.kind === 'main') info.name = info.project; }
  agents.set(info.id, info);
  broadcast({ kind: 'agent', agent: info });
  return info.id;
}

// ---------- terminal: linhas legíveis da conversa ----------
const agentFiles = new Map(); // agentId -> transcript
const textOf = c => typeof c === 'string' ? c : Array.isArray(c) ? c.map(x => x.type === 'text' ? x.text : x.type === 'image' ? '[imagem]' : '').join('\n') : '';
function clip(s, n) { s = String(s ?? '').trimEnd(); return s.length > n ? s.slice(0, n) + `\n… (+${s.length - n} caracteres)` : s; }

function termEntries(o) {
  const out = [];
  if (o.type === 'assistant' && o.message) {
    for (const c of o.message.content || []) {
      if (c.type === 'text' && c.text.trim()) out.push({ t: 'text', text: clip(c.text, 6000) });
      else if (c.type === 'tool_use') {
        const i = c.input || {};
        const arg = i.command || i.file_path || i.pattern || i.url || i.query || i.prompt?.slice(0, 200) || describeTool(c.name, i);
        out.push({ t: 'tool', text: `${c.name}(${clip(arg, 300)})` });
      }
    }
  } else if (o.type === 'user' && o.message) {
    const content = o.message.content;
    if (typeof content === 'string') {
      if (!content.startsWith('<')) out.push({ t: 'user', text: clip(content, 6000) });
    } else if (Array.isArray(content)) {
      for (const c of content) {
        if (c.type === 'tool_result') out.push({ t: 'result', text: clip(textOf(c.content), 1500), err: !!c.is_error });
        else if (c.type === 'text' && c.text.trim() && !c.text.startsWith('<')) out.push({ t: 'user', text: clip(c.text, 6000) });
      }
    }
  }
  return out;
}

function history(agentId) {
  const file = agentFiles.get(agentId);
  if (!file) return null;
  const st = safeStat(file);
  if (!st) return null;
  const MAX = 4 * 1024 * 1024; // lê no máximo o fim do arquivo
  const start = Math.max(0, st.size - MAX);
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(st.size - start);
  fs.readSync(fd, buf, 0, buf.length, start);
  fs.closeSync(fd);
  const lines = buf.toString('utf8').split('\n');
  if (start > 0) lines.shift();
  const entries = [];
  let lastTs = 0;
  for (const l of lines) {
    if (!l.trim()) continue;
    let o; try { o = JSON.parse(l); } catch { continue; }
    const ts = o.timestamp ? Date.parse(o.timestamp) : 0;
    for (const e of termEntries(o)) entries.push({ ...e, ts });
    lastTs = Math.max(lastTs, ts);
  }
  return { entries: entries.slice(-400), truncated: entries.length > 400 || start > 0, lastTs };
}

function handleLine(agentId, line, replay) {
  let o;
  try { o = JSON.parse(line); } catch { return; }
  const a = agents.get(agentId);
  if (!a) return;
  if (!replay) { // linhas novas também vão para quem estiver com o terminal aberto
    const entries = termEntries(o);
    if (entries.length) {
      const data = `data: ${JSON.stringify({ kind: 'term', id: agentId, ts: o.timestamp ? Date.parse(o.timestamp) : Date.now(), entries })}\n\n`;
      for (const res of clients) res.write(data);
    }
  }
  const ts = o.timestamp ? Date.parse(o.timestamp) : Date.now();
  a.lastTs = Math.max(a.lastTs, ts);
  if (o.cwd && !a.cwd) a.cwd = o.cwd;
  if (o.cwd && !a.project) {
    a.project = path.basename(o.cwd);
    if (a.kind === 'main') a.name = a.project;
    broadcast({ kind: 'agent', agent: a });
  }
  const base = { id: agentId, ts, replay };

  if (o.type === 'assistant' && o.message) {
    const m = o.message;
    if (m.usage && m.id && !seenMsgs.has(m.id)) {
      seenMsgs.add(m.id);
      const u = m.usage;
      a.tokens += (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) +
        (u.cache_read_input_tokens || 0) + (u.output_tokens || 0);
      broadcast({ ...base, kind: 'tokens', total: a.tokens });
    }
    for (const c of m.content || []) {
      if (c.type === 'tool_use') {
        if (!markTool(c.id, agentId)) continue; // o hook já avisou
        broadcast({ ...base, kind: 'tool', tool: c.name, target: describeTool(c.name, c.input), issue: integ.onTool(agentId, c.name, c.input) });
      } else if (c.type === 'text' && c.text.trim()) {
        broadcast({ ...base, kind: 'say', text: short(c.text, 160) });
      }
    }
  } else if (o.type === 'user' && o.message && typeof o.message.content === 'string') {
    // prompt humano (sessão principal) ou instrução recebida (subagent)
    const text = o.message.content;
    if (text.startsWith('<')) return; // ignora lembretes/comandos do sistema
    if (lastPrompt.get(agentId) === short(text, 160)) return; // o hook já avisou
    lastPrompt.set(agentId, short(text, 160));
    broadcast({ ...base, kind: 'prompt', text: short(text, 160), human: !o.isSidechain });
  }
}

// Começa a acompanhar um arquivo. fromNow: ignora o histórico (usado quando um hook revela o arquivo).
function trackFile(file, st, fromNow = false) {
  let f = files.get(file);
  if (f) return f;
  const start = fromNow ? st.size : firstScan ? Math.max(0, st.size - BACKLOG_BYTES) : 0;
  f = { offset: start, rest: '', agentId: registerAgent(file), skipPartial: start > 0 && !fromNow };
  files.set(file, f);
  agentFiles.set(f.agentId, file);
  return f;
}

function readNew(file, st) {
  let f = files.get(file);
  if (!f) {
    if (Date.now() - st.mtimeMs > ACTIVE_MS) return;
    f = trackFile(file, st);
  }
  if (st.size < f.offset) { f.offset = 0; f.rest = ''; }
  if (st.size === f.offset) return;
  const fd = fs.openSync(file, 'r');
  const buf = Buffer.alloc(st.size - f.offset);
  fs.readSync(fd, buf, 0, buf.length, f.offset);
  fs.closeSync(fd);
  f.offset = st.size;
  const lines = (f.rest + buf.toString('utf8')).split('\n');
  f.rest = lines.pop();
  if (f.skipPartial) { lines.shift(); f.skipPartial = false; }
  const replay = firstScan;
  for (const l of lines) if (l.trim()) handleLine(f.agentId, l, replay);
}

function safeStat(p) { try { return fs.statSync(p); } catch { return null; } }
function safeList(p) { try { return fs.readdirSync(p); } catch { return []; } }

function scan() {
  const now = Date.now();
  for (const proj of safeList(ROOT)) {
    const pdir = path.join(ROOT, proj);
    for (const entry of safeList(pdir)) {
      const full = path.join(pdir, entry);
      if (entry.endsWith('.jsonl')) {
        const st = safeStat(full);
        if (st) readNew(full, st);
        continue;
      }
      const sub = path.join(full, 'subagents');
      const sst = safeStat(sub);
      if (!sst || now - sst.mtimeMs > ACTIVE_MS * 4) continue;
      for (const s of safeList(sub)) {
        if (!s.endsWith('.jsonl')) continue;
        const sp = path.join(sub, s);
        const st = safeStat(sp);
        if (st) readNew(sp, st);
      }
    }
  }
  firstScan = false;
}

// ---------- hooks ----------
// Descobre (ou cria) o agente dono de um evento de hook.
function agentForHook(h) {
  if (h.agent_id) {
    if (agents.has(h.agent_id)) return h.agent_id;
    const guess = h.agent_transcript_path || (h.transcript_path &&
      path.join(h.transcript_path.replace(/\.jsonl$/, ''), 'subagents', `agent-${h.agent_id}.jsonl`));
    const st = guess && safeStat(guess);
    if (st) return trackFile(guess, st, true).agentId;
    return syntheticAgent(h.agent_id, 'sub', h.agent_type || 'subagent', h);
  }
  if (agents.has(h.session_id)) return h.session_id;
  const st = h.transcript_path && safeStat(h.transcript_path);
  if (st) return trackFile(h.transcript_path, st, true).agentId;
  return syntheticAgent(h.session_id, 'main', 'main', h);
}

function syntheticAgent(id, kind, type, h) {
  const project = h.cwd ? path.basename(h.cwd) : undefined;
  const info = { id, kind, type, name: kind === 'main' ? project || 'Claude' : type, task: '',
    parent: kind === 'sub' ? h.session_id : null, project, cwd: h.cwd, tokens: 0, lastTs: Date.now() };
  agents.set(id, info);
  broadcast({ kind: 'agent', agent: info });
  return id;
}

function handleHook(h) {
  if (!h || !h.hook_event_name || !h.session_id) return;
  const first = !hooksLastTs;
  hooksLastTs = Date.now();
  hookLog.push({ at: new Date().toISOString(), ...h });
  if (hookLog.length > 30) hookLog.shift();
  if (first) broadcast({ kind: 'meta', hooks: true });

  const id = agentForHook(h);
  const base = { id, ts: Date.now(), src: 'hook' };
  switch (h.hook_event_name) {
    case 'SessionStart':
      broadcast({ ...base, kind: 'arrive' }); break;
    case 'UserPromptSubmit': {
      const text = short(h.prompt, 160);
      if (!text || text.startsWith('<') || lastPrompt.get(id) === text) break;
      lastPrompt.set(id, text);
      broadcast({ ...base, kind: 'prompt', text, human: true }); break;
    }
    case 'PreToolUse':
      if (markTool(h.tool_use_id, id)) broadcast({ ...base, kind: 'tool', tool: h.tool_name, target: describeTool(h.tool_name, h.tool_input), issue: integ.onTool(id, h.tool_name, h.tool_input) });
      break;
    case 'PostToolUse': {
      const r = h.tool_response;
      const ok = !(r && typeof r === 'object' && (r.is_error || r.interrupted || r.success === false));
      broadcast({ ...base, kind: 'toolDone', tool: h.tool_name, ok }); break;
    }
    case 'Notification':
      broadcast({ ...base, kind: 'attention', text: short(h.message || 'Precisa de você', 120) }); break;
    case 'PermissionRequest':
      broadcast({ ...base, kind: 'attention', text: `Permissão: ${h.tool_name || ''} ${describeTool(h.tool_name, h.tool_input)}` }); break;
    case 'Stop':
      broadcast({ ...base, kind: 'stop' }); break;
    case 'StopFailure':
      broadcast({ ...base, kind: 'stop', failed: true }); break;
    case 'SubagentStop':
    case 'SessionEnd':
      broadcast({ ...base, kind: 'leave' }); break;
  }
}

function readBody(req, limit = 2 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', c => { size += c.length; if (size > limit) { reject(new Error('too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

// ---------- falar com um agente: claude -p --resume <sessão> ----------
const TOKEN = crypto.randomBytes(24).toString('hex'); // muda a cada vez que o servidor sobe
const ALLOWED_HOSTS = new Set([`localhost:${PORT}`, `127.0.0.1:${PORT}`]); // barra DNS rebinding
const ALLOWED_ORIGINS = new Set([...ALLOWED_HOSTS].map(h => `http://${h}`));
const LIVE_MS = 2 * 60e3; // sessão com atividade mais recente que isso provavelmente está aberta num terminal
const running = new Map(); // sessionId -> processo filho

function findClaude() {
  const dirs = [path.join(os.homedir(), '.local', 'bin'), '/opt/homebrew/bin', '/usr/local/bin',
    path.join(os.homedir(), '.claude', 'local'), ...(process.env.PATH || '').split(':')];
  for (const d of dirs) {
    const p = path.join(d, 'claude');
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch {}
  }
  return 'claude';
}
const CLAUDE_BIN = process.env.CLAUDE_BIN || findClaude();

function authorized(req) {
  const got = Buffer.from(String(req.headers['x-aw-token'] || ''));
  const want = Buffer.from(TOKEN);
  return ALLOWED_ORIGINS.has(req.headers.origin) && got.length === want.length && crypto.timingSafeEqual(got, want);
}

function rootOf(a) {
  for (let i = 0; a && a.kind !== 'main' && i < 10; i++) a = agents.get(a.parent);
  return a && a.kind === 'main' ? a : null;
}

// via: 'site' ou 'slack'; onDone(ok, textoCompleto) é chamado quando o claude termina
function sendToAgent({ agentId, text, force }, { via = 'site', onDone } = {}) {
  const a = agents.get(agentId);
  if (!a) return [404, { error: 'Agente não encontrado.' }];
  if (a.kind !== 'main') {
    const root = rootOf(a);
    return [400, { error: 'Subagents recebem tarefas do agente que os criou. Fale com o agente principal.', rootId: root?.id }];
  }
  text = String(text || '').trim();
  if (!text) return [400, { error: 'Mensagem vazia.' }];
  if (text.length > 20000) return [400, { error: 'Mensagem longa demais.' }];
  if (running.has(a.id)) return [409, { error: 'Este agente ainda está respondendo à mensagem anterior.' }];
  if (!a.cwd || !fs.existsSync(a.cwd)) return [400, { error: 'Não encontrei o diretório desta sessão.' }];
  const since = Date.now() - a.lastTs;
  if (!force && since < LIVE_MS) {
    return [409, { live: true, error: `Esta sessão teve atividade há ${Math.round(since / 1000)} s e deve estar aberta num terminal. Enviar abre uma segunda instância na mesma conversa, rodando em paralelo.` }];
  }

  const env = { ...process.env };
  delete env.CLAUDECODE; delete env.CLAUDE_CODE_ENTRYPOINT; // não herdar o contexto de uma sessão que tenha iniciado o servidor
  const child = spawn(CLAUDE_BIN, ['-p', '--resume', a.id, text], { cwd: a.cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
  running.set(a.id, child);
  lastPrompt.set(a.id, short(text, 160)); // o balão vem do sendStart; não repetir pelo hook/JSONL
  let out = '', err = '', finished = false;
  child.stdout.on('data', d => { out = (out + d).slice(-200e3); });
  child.stderr.on('data', d => { err = (err + d).slice(-20e3); });
  const killer = setTimeout(() => child.kill('SIGTERM'), 30 * 60e3);
  const done = (code, spawnErr) => {
    if (finished) return; finished = true;
    clearTimeout(killer); running.delete(a.id);
    const ok = code === 0;
    const text = ok ? out : spawnErr?.message || err || `saiu com código ${code}`;
    broadcast({ id: a.id, ts: Date.now(), kind: 'sendDone', ok, text: short(text, 300) });
    console.log(`📨 ${a.name}: ${ok ? 'respondeu' : 'falhou'} (${short(text, 120)})`);
    try { onDone?.(ok, String(text).trim()); } catch (e) { console.error('onDone:', e.message); }
  };
  child.on('error', e => done(-1, e));
  child.on('close', code => done(code));
  broadcast({ id: a.id, ts: Date.now(), kind: 'sendStart', text: short(text, 160), via });
  console.log(`📨 mensagem para ${a.name} (${a.id}) via ${via}`);
  return [202, { ok: true }];
}

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (!ALLOWED_HOSTS.has(req.headers.host)) { res.writeHead(403); return res.end(); }
  if (url.pathname === '/send' && req.method === 'POST') {
    if (!authorized(req) || !String(req.headers['content-type']).startsWith('application/json')) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Não autorizado. Recarregue a página.' }));
    }
    readBody(req, 64 * 1024).then(body => {
      let status, payload;
      try { [status, payload] = sendToAgent(JSON.parse(body)); } catch (e) { [status, payload] = [400, { error: e.message }]; }
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(payload));
    }, () => { res.writeHead(413); res.end(); });
    return;
  }
  if (url.pathname === '/hook' && req.method === 'POST') {
    readBody(req).then(body => {
      try { handleHook(JSON.parse(body)); } catch (e) { console.error('hook inválido:', e.message); }
      res.writeHead(204); res.end();
    }, () => { res.writeHead(413); res.end(); });
    return;
  }
  if (url.pathname === '/history') {
    const h = history(url.searchParams.get('id'));
    res.writeHead(h ? 200 : 404, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(h || { error: 'Sem transcript para este agente.' }));
  }
  if (url.pathname === '/debug') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ hooksLastTs, sessions: sessionsInfo(), agents: [...agents.values()], hookLog }, null, 2));
  }
  if (url.pathname === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive',
    });
    // estado atual: agentes ativos + eventos recentes
    if (hooksLastTs) res.write(`data: ${JSON.stringify({ kind: 'meta', hooks: true })}\n\n`);
    for (const ev of [...integ.state(), bot.state()]) res.write(`data: ${JSON.stringify(ev)}\n\n`);
    const cutoff = Date.now() - ACTIVE_MS;
    for (const a of agents.values()) if (a.lastTs > cutoff) res.write(`data: ${JSON.stringify({ kind: 'agent', agent: a })}\n\n`);
    for (const ev of recent.slice(-80)) res.write(`data: ${JSON.stringify({ ...ev, replay: true })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  const rel = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const file = path.join(WORLD_DIR, path.normalize(rel));
  if (!file.startsWith(WORLD_DIR)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    if (rel === 'index.html') { // injeta o token de envio na página
      data = data.toString('utf8').replace('%%AW_TOKEN%%', TOKEN);
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      return res.end(data);
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

setInterval(() => { for (const res of clients) res.write(': ping\n\n'); }, 15000);
scan();
setInterval(scan, SCAN_MS);
integ.start();
// na partida só relemos o fim de cada transcript; completa o contexto com o histórico (uma vez por agente)
function seedContext(a) {
  if (a.ctxSeeded) return;
  a.ctxSeeded = true;
  const h = history(a.id);
  if (!h) return;
  const ctx = a.ctx || (a.ctx = {});
  const last = t => [...h.entries].reverse().find(e => e.t === t);
  const u = last('user'), tool = last('tool'), said = last('text');
  if (!ctx.asked && u) ctx.asked = { text: u.text, ts: u.ts };
  if (!ctx.action && tool) { const m = tool.text.match(/^([^(]+)\((.*)\)$/s); ctx.action = { tool: m ? m[1] : tool.text, target: m ? m[2] : '', ts: tool.ts }; }
  if (!ctx.said && said) ctx.said = { text: said.text, ts: said.ts };
}

// sessões principais ativas (mais recente primeiro), com contexto e subagents
function sessionsInfo() {
  const now = Date.now();
  const home = os.homedir();
  const statusOf = a => {
    const c = a.ctx || {};
    if (running.has(a.id)) return 'replying';
    if (c.status === 'gone') return 'gone';
    if (c.status === 'waiting') return 'waiting';
    if (c.status === 'failed') return 'failed';
    if (c.status === 'working' && now - a.lastTs < 90e3) return 'working';
    return 'idle';
  };
  const view = a => ({ id: a.id, name: a.name, type: a.type, task: a.task || '', lastTs: a.lastTs, running: running.has(a.id),
    status: statusOf(a), cwd: a.cwd ? a.cwd.replace(home, '~') : '', tokens: a.tokens || 0, ...(a.ctx || {}) });
  const active = [...agents.values()].filter(a => now - a.lastTs < ACTIVE_MS);
  for (const a of active) seedContext(a);
  return active
    .filter(a => a.kind === 'main' && statusOf(a) !== 'gone')
    .sort((x, y) => y.lastTs - x.lastTs)
    .map(a => ({ ...view(a), subs: active.filter(s => s.kind === 'sub' && rootOf(s)?.id === a.id && statusOf(s) !== 'gone').map(view) }));
}

const bot = slackBot({
  emit: ev => emitLive(ev),
  sendToAgent,
  // sessões principais ativas, mais recente primeiro
  listSessions: () => sessionsInfo(),
  historyOf: id => history(id),
});
bot.start();
server.listen(PORT, '127.0.0.1', () => {
  console.log(`🌍 Agents do Wash em http://localhost:${PORT}  (observando ${ROOT})`);
  console.log(`   ${agents.size} agente(s) ativo(s) nos últimos ${ACTIVE_MS / 60e3} min · claude: ${CLAUDE_BIN}`);
});
