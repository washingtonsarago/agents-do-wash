// Agents do Wash — integrações ao vivo (Jira e Slack).
// Credenciais ficam só aqui no servidor, lidas de ~/.config/agents-do-wash/{jira,slack}.json (chmod 600)
// ou de variáveis de ambiente. Nada de token vai para o navegador nem para o log.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG_DIR = path.join(os.homedir(), '.config', 'agents-do-wash');
const POLL_MS = 60e3;
const ISSUE_KEY = /^[A-Z][A-Z0-9_]+-\d+$/;
const HOST = /^[a-z0-9.-]+$/i;
const DEFAULT_JQL = 'assignee = currentUser() AND (statusCategory != Done OR updated >= -7d) ORDER BY updated DESC';
const DEFAULT_SLACK_QUERY = 'to:me';

function readConfig(name) {
  try { return JSON.parse(fs.readFileSync(path.join(CONFIG_DIR, name), 'utf8')); } catch { return {}; }
}

function jiraConfig() {
  const c = readConfig('jira.json');
  const site = String(process.env.JIRA_SITE || c.site || '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  const email = process.env.JIRA_EMAIL || c.email;
  const token = process.env.JIRA_API_TOKEN || c.token;
  if (!site || !HOST.test(site) || !email || !token) return null;
  return { site, email, token, jql: process.env.JIRA_JQL || c.jql || DEFAULT_JQL };
}

function slackConfig() {
  const c = readConfig('slack.json');
  const token = process.env.SLACK_TOKEN || c.token;
  if (!token) return null;
  return { token, query: process.env.SLACK_QUERY || c.query || DEFAULT_SLACK_QUERY, workspace: c.workspace || '' };
}

// <@U123> → @alguém, <https://x|rótulo> → rótulo, <#C1|canal> → #canal
function cleanSlack(text) {
  return String(text || '')
    .replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1')
    .replace(/<@[A-Z0-9]+(\|([^>]+))?>/g, (_, __, n) => '@' + (n || 'alguém'))
    .replace(/<(https?:[^|>]+)\|([^>]+)>/g, '$2')
    .replace(/<(https?:[^>]+)>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}

module.exports = function integrations({ emit, short }) {
  const touched = new Map(); // issue -> { agentId, ts } (issues mexidas por agentes)
  let jira = { configured: false };
  let slack = { configured: false };
  const seenSlack = new Set();
  let slackLoaded = false;
  const timers = {};

  const jiraEvent = () => ({ kind: 'jira', ...jira, touched: Object.fromEntries(touched) });
  const slackEvent = () => ({ kind: 'slack', ...slack });
  const soon = (name, fn, ms = 4000) => { clearTimeout(timers[name]); timers[name] = setTimeout(fn, ms); };

  async function pollJira() {
    const cfg = jiraConfig();
    if (!cfg) { jira = { configured: false }; return emit(jiraEvent()); }
    // também traz as issues que os agentes tocaram nas últimas 24 h
    const recentKeys = [...touched].filter(([, t]) => Date.now() - t.ts < 24 * 3600e3).map(([k]) => k).slice(0, 20);
    let jql = cfg.jql;
    if (recentKeys.length) {
      const [where, order] = cfg.jql.split(/\s+ORDER\s+BY\s+/i);
      jql = `(${where}) OR key in (${recentKeys.join(',')})${order ? ' ORDER BY ' + order : ''}`;
    }
    try {
      const u = new URL(`https://${cfg.site}/rest/api/3/search/jql`);
      u.searchParams.set('jql', jql);
      u.searchParams.set('fields', 'summary,status,issuetype,priority,updated');
      u.searchParams.set('maxResults', '40');
      const r = await fetch(u, {
        headers: { Authorization: 'Basic ' + Buffer.from(`${cfg.email}:${cfg.token}`).toString('base64'), Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (!r.ok) {
        const why = r.status === 401 || r.status === 403 ? 'o Jira recusou as credenciais' : `o Jira respondeu ${r.status}`;
        jira = { ...jira, configured: true, site: cfg.site, error: why };
        return emit(jiraEvent());
      }
      const data = await r.json();
      const cards = (data.issues || []).map(i => ({
        key: i.key,
        summary: short(i.fields?.summary, 90),
        type: i.fields?.issuetype?.name || '',
        status: i.fields?.status?.name || '',
        cat: i.fields?.status?.statusCategory?.key || 'new', // new | indeterminate | done
        priority: i.fields?.priority?.name || '',
        updated: i.fields?.updated,
        url: `https://${cfg.site}/browse/${i.key}`,
      }));
      jira = { configured: true, site: cfg.site, cards, updatedAt: Date.now() };
    } catch (e) {
      jira = { ...jira, configured: true, site: cfg.site, error: 'não consegui falar com o Jira (' + e.message + ')' };
    }
    emit(jiraEvent());
  }

  async function pollSlack() {
    const cfg = slackConfig();
    if (!cfg) { slack = { configured: false }; return emit(slackEvent()); }
    try {
      const u = new URL('https://slack.com/api/search.messages');
      u.searchParams.set('query', cfg.query);
      u.searchParams.set('count', '12');
      u.searchParams.set('sort', 'timestamp');
      const r = await fetch(u, { headers: { Authorization: `Bearer ${cfg.token}` }, signal: AbortSignal.timeout(15000) });
      const data = await r.json();
      if (!data.ok) {
        const hints = { invalid_auth: 'token inválido', not_allowed_token_type: 'precisa de um token de usuário (xoxp-)', missing_scope: 'falta o escopo search:read' };
        slack = { ...slack, configured: true, error: hints[data.error] || data.error };
        return emit(slackEvent());
      }
      const msgs = (data.messages?.matches || []).map(m => ({
        id: m.iid || `${m.channel?.id}-${m.ts}`,
        channel: m.channel?.is_im || m.channel?.is_mpim ? 'mensagem direta' : '#' + (m.channel?.name || '?'),
        user: m.username || m.user || '?',
        text: short(cleanSlack(m.text), 220),
        ts: Math.round(Number(m.ts) * 1000),
        url: /^https:\/\/[a-z0-9.-]+\.slack\.com\//i.test(m.permalink || '') ? m.permalink : null,
      }));
      const fresh = slackLoaded ? msgs.filter(m => !seenSlack.has(m.id)) : [];
      msgs.forEach(m => seenSlack.add(m.id));
      slackLoaded = true;
      slack = { configured: true, msgs, fresh: fresh.map(m => m.id), updatedAt: Date.now() };
    } catch (e) {
      slack = { ...slack, configured: true, error: 'não consegui falar com o Slack (' + e.message + ')' };
    }
    emit(slackEvent());
  }

  // chamado para cada ferramenta usada por um agente; devolve a issue envolvida, se houver
  function onTool(agentId, tool, input = {}) {
    if (/Atlassian/.test(tool)) {
      const key = String(input.issueIdOrKey || input.issueKey || '').toUpperCase();
      if (ISSUE_KEY.test(key)) {
        touched.set(key, { agentId, ts: Date.now() });
        emit(jiraEvent());
        if (/edit|transition|create|comment|worklog/i.test(tool)) soon('jira', pollJira); // o status pode ter mudado
        return key;
      }
      if (/create/i.test(tool)) soon('jira', pollJira, 8000);
    }
    if (/Slack/.test(tool) && /send|schedule|reply/i.test(tool)) soon('slack', pollSlack);
    return undefined;
  }

  function start() {
    pollJira(); pollSlack();
    setInterval(pollJira, POLL_MS);
    setInterval(pollSlack, POLL_MS);
  }

  return { start, onTool, state: () => [jiraEvent(), slackEvent()] };
};
