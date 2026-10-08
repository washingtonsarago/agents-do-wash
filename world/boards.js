// Agents do Wash — quadro Kanban do Jira e TV do Slack (canvas → textura, com áreas clicáveis).
import * as THREE from 'three';

const FONT = '-apple-system, "SF Pro Text", system-ui, sans-serif';

function surface(W, H, w, h) {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
  const g = canvas.getContext('2d');
  let regions = [];
  return {
    mesh, g, W, H,
    begin() { regions = []; g.clearRect(0, 0, W, H); },
    region(x, y, w, h, url) { if (url) regions.push({ x, y, w, h, url }); },
    end() { tex.needsUpdate = true; },
    hit(uv) { // uv do raycast → link do card/mensagem
      const x = uv.x * W, y = (1 - uv.y) * H;
      return regions.find(r => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h)?.url || null;
    },
  };
}

function wrap(g, text, maxW, maxLines) {
  const words = String(text).split(/\s+/), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
    if (lines.length === maxLines) break;
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    let last = lines[maxLines - 1];
    while (g.measureText(last + '…').width > maxW && last.length) last = last.slice(0, -1);
    lines[maxLines - 1] = last + '…';
  }
  return lines;
}

function rrect(g, x, y, w, h, r, fill, stroke, lw = 3) {
  g.beginPath(); g.roundRect(x, y, w, h, r);
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}

const ago = ts => {
  const s = Math.max(0, (Date.now() - ts) / 1000);
  return s < 60 ? 'agora' : s < 3600 ? `há ${Math.floor(s / 60)} min` : s < 86400 ? `há ${Math.floor(s / 3600)} h` : `há ${Math.floor(s / 86400)} d`;
};

// ---------- Jira ----------
const TYPE_COLOR = { bug: '#e5493a', erro: '#e5493a', story: '#63ba3c', história: '#63ba3c', task: '#4bade8', tarefa: '#4bade8',
  epic: '#904ee2', épico: '#904ee2', subtask: '#4bade8', 'sub-task': '#4bade8', subtarefa: '#4bade8' };
const TYPE_ICON = { bug: '🐞', erro: '🐞', story: '📗', história: '📗', epic: '⚡', épico: '⚡' };
const COLUMNS = [['new', 'A fazer'], ['indeterminate', 'Em andamento'], ['done', 'Feito']];

export function makeKanban() {
  const s = surface(2048, 1000, 9.6, 4.69);
  function render(state, agentInfo) {
    const { g, W, H } = s;
    s.begin();
    rrect(g, 0, 0, W, H, 0, '#fbfaf7');
    g.fillStyle = '#2b2a33'; g.font = `700 54px ${FONT}`; g.textBaseline = 'top';
    g.fillText('📋 Jira', 40, 28);
    g.font = `400 34px ${FONT}`; g.fillStyle = '#7a7685';
    const sub = state.configured ? `${state.site || ''}${state.updatedAt ? ' · atualizado ' + ago(state.updatedAt) : ''}` : '';
    g.fillText(sub, 250, 42);
    if (!state.configured) {
      g.fillStyle = '#7a7685'; g.font = `500 44px ${FONT}`;
      g.fillText('Jira não configurado.', 40, 200);
      g.font = `400 36px ${FONT}`;
      g.fillText('Crie ~/.config/agents-do-wash/jira.json com site, email e token (veja o README).', 40, 270);
      return s.end();
    }
    const colW = (W - 80 - 2 * 30) / 3, top = 120;
    const cards = state.cards || [];
    COLUMNS.forEach(([cat, title], ci) => {
      const x = 40 + ci * (colW + 30);
      rrect(g, x, top, colW, H - top - 30, 22, '#f0ece4');
      const col = cards.filter(c => (COLUMNS.some(([k]) => k === c.cat) ? c.cat : 'new') === cat);
      g.fillStyle = '#5b5866'; g.font = `700 34px ${FONT}`;
      g.fillText(`${title.toUpperCase()}  ${col.length}`, x + 24, top + 20);
      const cardH = 150, gap = 16, maxCards = Math.floor((H - top - 110) / (cardH + gap));
      col.slice(0, maxCards).forEach((c, i) => {
        const y = top + 76 + i * (cardH + gap), cx = x + 16, cw = colW - 32;
        const touch = state.touched?.[c.key];
        const hot = touch && Date.now() - touch.ts < 120e3;
        rrect(g, cx, y, cw, cardH, 14, '#ffffff', hot ? '#d97757' : 'rgba(0,0,0,.08)', hot ? 6 : 2);
        const tcol = TYPE_COLOR[c.type.toLowerCase()] || '#8d8996';
        g.fillStyle = tcol; g.fillRect(cx, y + 14, 8, cardH - 28);
        g.fillStyle = '#2b2a33'; g.font = `700 30px ${FONT}`;
        g.fillText(`${TYPE_ICON[c.type.toLowerCase()] || '▪️'} ${c.key}`, cx + 24, y + 14);
        g.font = `400 29px ${FONT}`; g.fillStyle = '#3d3b45';
        wrap(g, c.summary, cw - 44, 2).forEach((l, li) => g.fillText(l, cx + 24, y + 54 + li * 34));
        g.font = `500 24px ${FONT}`; g.fillStyle = '#8d8996';
        g.fillText(c.status, cx + 24, y + cardH - 32);
        if (touch) { // quem mexeu
          const a = agentInfo(touch.agentId);
          const label = `${a.name} · ${ago(touch.ts)}`;
          g.font = `600 24px ${FONT}`;
          const tw = g.measureText(label).width;
          g.fillStyle = a.color; g.beginPath(); g.arc(cx + cw - tw - 34, y + cardH - 20, 9, 0, 7); g.fill();
          g.fillStyle = '#5b5866'; g.fillText(label, cx + cw - tw - 18, y + cardH - 32);
        }
        s.region(cx, y, cw, cardH, c.url);
      });
      if (col.length > maxCards) { g.fillStyle = '#8d8996'; g.font = `500 28px ${FONT}`; g.fillText(`+ ${col.length - maxCards} issues`, x + 24, H - 74); }
    });
    if (state.error) {
      rrect(g, 40, H - 90, W - 80, 60, 14, '#fde8e6');
      g.fillStyle = '#c0392b'; g.font = `600 30px ${FONT}`; g.fillText('⚠ ' + state.error, 64, H - 76);
    }
    s.end();
  }
  return { mesh: s.mesh, render, hit: s.hit };
}

// ---------- Slack ----------
export function makeSlackTV() {
  const s = surface(1280, 760, 6, 3.56);
  function render(state) {
    const { g, W, H } = s;
    s.begin();
    rrect(g, 0, 0, W, H, 0, '#1a1d21');
    g.fillStyle = '#4a154b'; g.fillRect(0, 0, W, 86);
    g.fillStyle = '#ffffff'; g.font = `700 42px ${FONT}`; g.textBaseline = 'top';
    g.fillText('💬 Slack', 32, 20);
    g.font = `400 26px ${FONT}`; g.fillStyle = 'rgba(255,255,255,.7)';
    if (state.updatedAt) g.fillText('atualizado ' + ago(state.updatedAt), 230, 34);
    if (!state.configured) {
      g.fillStyle = '#d1d2d3'; g.font = `500 34px ${FONT}`;
      g.fillText('Slack não configurado.', 32, 140);
      g.font = `400 28px ${FONT}`;
      wrap(g, 'Crie ~/.config/agents-do-wash/slack.json com um token de usuário (xoxp-) com search:read. Veja o README.', W - 64, 3)
        .forEach((l, i) => g.fillText(l, 32, 200 + i * 38));
      return s.end();
    }
    const msgs = state.msgs || [];
    if (!msgs.length && !state.error) { g.fillStyle = '#9ea0a3'; g.font = `400 30px ${FONT}`; g.fillText(state.loading ? 'carregando…' : 'Nenhuma mensagem para você. 🎉', 32, 130); }
    const fresh = new Set(state.fresh || []);
    let y = 104;
    for (const m of msgs) {
      const h = 118;
      if (y + h > H - (state.error ? 70 : 10)) break;
      if (fresh.has(m.id)) rrect(g, 12, y - 6, W - 24, h - 8, 12, 'rgba(236,178,46,.16)');
      g.fillStyle = '#ffffff'; g.font = `700 28px ${FONT}`;
      g.fillText(m.user, 32, y);
      const uw = g.measureText(m.user).width;
      g.fillStyle = '#9ea0a3'; g.font = `400 24px ${FONT}`;
      g.fillText(`${m.channel} · ${ago(m.ts)}`, 44 + uw, y + 4);
      g.fillStyle = '#d1d2d3'; g.font = `400 27px ${FONT}`;
      wrap(g, m.text, W - 64, 2).forEach((l, i) => g.fillText(l, 32, y + 38 + i * 32));
      s.region(12, y - 6, W - 24, h - 8, m.url);
      y += h;
    }
    if (state.error) {
      rrect(g, 20, H - 62, W - 40, 48, 10, 'rgba(224,30,90,.2)');
      g.fillStyle = '#ff8fa3'; g.font = `600 26px ${FONT}`; g.fillText('⚠ ' + state.error, 36, H - 52);
    }
    s.end();
  }
  return { mesh: s.mesh, render, hit: s.hit };
}
