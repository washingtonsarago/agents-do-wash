#!/usr/bin/env node
// Instala (ou remove com --uninstall) os hooks do Agents do Wash em ~/.claude/settings.json.
// Faz backup antes, é idempotente e não mexe nos hooks que já existem.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const EMIT = path.join(__dirname, 'emit.sh');
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PreToolUse', 'PostToolUse', 'Notification',
  'PermissionRequest', 'Stop', 'StopFailure', 'SubagentStop', 'SessionEnd'];
const uninstall = process.argv.includes('--uninstall');

fs.chmodSync(EMIT, 0o755);
const raw = fs.existsSync(SETTINGS) ? fs.readFileSync(SETTINGS, 'utf8') : '{}';
const settings = JSON.parse(raw);
const backup = `${SETTINGS}.bak-agentworld-${Date.now()}`;
fs.writeFileSync(backup, raw);

settings.hooks ||= {};
const ours = g => (g.hooks || []).some(h => h.command === EMIT);
for (const ev of EVENTS) {
  const groups = (settings.hooks[ev] || []).filter(g => !ours(g));
  if (!uninstall) groups.push({ hooks: [{ type: 'command', command: EMIT, async: true }] });
  if (groups.length) settings.hooks[ev] = groups; else delete settings.hooks[ev];
}
fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
console.log(`${uninstall ? '🧹 Hooks removidos' : '⚡ Hooks instalados'} em ${SETTINGS}`);
console.log(`   backup: ${backup}`);
