// Agents do Wash — construção do cenário: escritório (x < 30) e jardim com riacho, ponte e chafariz (x > 30).
import * as THREE from 'three';
import { makeKanban, makeSlackTV } from './boards.js';

// gerador pseudoaleatório com semente: o cenário é sempre o mesmo
function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

const BRIDGE = { x0: 36.5, x1: 43.5, halfW: 1.6, h: 1.1 };
const STREAM_X = 40;
const FOUNTAIN = new THREE.Vector3(56, 0, 0);

export function buildWorld(scene, label) {
  const rand = rng(7);
  const mats = new Map();
  const mat = (c, extra = {}) => {
    const key = c + JSON.stringify(extra);
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color: c, roughness: .85, ...extra }));
    return mats.get(key);
  };
  const mesh = (geo, m, x = 0, y = 0, z = 0, parent = scene) => {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z);
    o.castShadow = o.receiveShadow = true; parent.add(o); return o;
  };
  const box = (w, h, d, c, x, y, z, parent) => mesh(new THREE.BoxGeometry(w, h, d), mat(c), x, y, z, parent);
  const canvasTex = (w, h, draw, rx = 1, ry = 1) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry);
    t.anisotropy = 4;
    return t;
  };
  const updaters = [];

  // ---------- pisos ----------
  const wood = canvasTex(512, 512, (g, w, h) => {
    for (let r = 0; r < 8; r++) for (let c = 0; c < 4; c++) {
      const l = 82 + rand() * 8;
      g.fillStyle = `hsl(32, 38%, ${l}%)`;
      const off = r % 2 ? 64 : 0;
      g.fillRect((c * 128 + off) % w, r * 64, 128, 64);
      g.fillRect((c * 128 + off) % w - w, r * 64, 128, 64);
      g.strokeStyle = 'rgba(120,80,40,.18)'; g.strokeRect((c * 128 + off) % w, r * 64, 128, 64);
    }
  }, 6, 5);
  const officeFloor = mesh(new THREE.PlaneGeometry(60, 48), new THREE.MeshStandardMaterial({ map: wood, roughness: .9 }), 0, 0, 0);
  officeFloor.rotation.x = -Math.PI / 2; officeFloor.castShadow = false;

  const grassTex = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#8cc56f'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `hsl(${95 + rand() * 25}, ${40 + rand() * 20}%, ${44 + rand() * 18}%)`;
      g.fillRect(rand() * w, rand() * h, 2, 3 + rand() * 4);
    }
  }, 10, 10);
  // grama em duas faixas, deixando o leito do riacho aberto
  const grassMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 });
  for (const [x0, x1] of [[30, STREAM_X - 2.25], [STREAM_X + 2.25, 90]]) {
    const gp = mesh(new THREE.PlaneGeometry(x1 - x0, 64), grassMat, (x0 + x1) / 2, .02, 0);
    gp.rotation.x = -Math.PI / 2; gp.castShadow = false;
  }

  const rug = (w, d, c, x, z) => { const r = mesh(new THREE.PlaneGeometry(w, d), mat(c), x, .02, z); r.rotation.x = -Math.PI / 2; r.castShadow = false; return r; };

  // ---------- paredes, janelas, letreiro, relógio ----------
  const WALL = '#e6d8c3';
  box(60.5, 5.5, .5, WALL, 0, 2.75, -24.25);
  box(.5, 5.5, 48.5, WALL, -30.25, 2.75, 0);
  box(60.5, .3, .6, '#b9a68b', 0, .15, -23.95); // rodapé
  box(.6, .3, 48, '#b9a68b', -29.95, .15, 0);
  const glassMat = new THREE.MeshStandardMaterial({ color: '#bfe3ff', emissive: '#9fd4ff', emissiveIntensity: .35, roughness: .2 });
  const frame = '#8a7a66';
  for (const x of [-24, 12]) { // janelas na parede do fundo (o resto da parede tem letreiro, quadro do Jira e TV do Slack)
    box(5.2, 3, .2, frame, x, 3, -23.95);
    mesh(new THREE.BoxGeometry(4.8, 2.6, .1), glassMat, x, 3, -23.85);
    box(.12, 2.6, .15, frame, x, 3, -23.8);
  }
  for (const z of [-12, 4]) { // janelas na parede da esquerda
    box(.2, 3, 5.2, frame, -29.95, 3, z);
    mesh(new THREE.BoxGeometry(.1, 2.6, 4.8), glassMat, -29.85, 3, z);
  }
  // fachada de vidro voltada para o jardim, com a porta no meio (z de -3 a 3)
  const glass = new THREE.MeshStandardMaterial({ color: '#cfeaff', transparent: true, opacity: .22, roughness: .1 });
  for (const [z0, z1] of [[-24, -3], [3, 24]]) {
    const len = z1 - z0;
    const pane = new THREE.Mesh(new THREE.BoxGeometry(.15, 4, len), glass);
    pane.position.set(30, 2, (z0 + z1) / 2); scene.add(pane);
    for (let z = z0; z <= z1; z += 3.5) box(.25, 4.2, .25, '#5b5f6b', 30, 2.1, Math.min(z, z1));
    box(.3, .25, len, '#5b5f6b', 30, 4.1, (z0 + z1) / 2);
  }
  // letreiro
  const signTex = canvasTex(1024, 192, (g, w, h) => {
    g.fillStyle = '#2b2a33'; g.beginPath(); g.roundRect(0, 0, w, h, 40); g.fill();
    g.fillStyle = '#d97757'; g.font = '700 92px -apple-system, system-ui, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('AGENTS DO WASH', w / 2, h / 2 + 6);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(10, 1.9), new THREE.MeshBasicMaterial({ map: signTex, transparent: true }));
  sign.position.set(-8.5, 3.6, -23.95); scene.add(sign);
  // relógio de parede com a hora real
  const clockCanvas = document.createElement('canvas'); clockCanvas.width = clockCanvas.height = 256;
  const clockTex = new THREE.CanvasTexture(clockCanvas); clockTex.colorSpace = THREE.SRGBColorSpace;
  const clock = new THREE.Mesh(new THREE.CircleGeometry(1.1, 40), new THREE.MeshBasicMaterial({ map: clockTex }));
  clock.position.set(-29.95, 3.8, 9.5); clock.rotation.y = Math.PI / 2; scene.add(clock); // parede da esquerda
  let lastMinute = -1;
  const drawClock = () => {
    const d = new Date(); if (d.getMinutes() === lastMinute) return; lastMinute = d.getMinutes();
    const g = clockCanvas.getContext('2d'), c = 128;
    g.fillStyle = '#fffaf2'; g.beginPath(); g.arc(c, c, 124, 0, 7); g.fill();
    g.lineWidth = 10; g.strokeStyle = '#2b2a33'; g.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.fillStyle = '#2b2a33'; g.fillRect(c + Math.sin(a) * 100 - 4, c - Math.cos(a) * 100 - 4, 8, 8); }
    const hand = (a, len, wd, col) => { g.strokeStyle = col; g.lineWidth = wd; g.lineCap = 'round'; g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.sin(a) * len, c - Math.cos(a) * len); g.stroke(); };
    hand((d.getHours() % 12 + d.getMinutes() / 60) / 12 * Math.PI * 2, 60, 12, '#2b2a33');
    hand(d.getMinutes() / 60 * Math.PI * 2, 92, 8, '#d97757');
    clockTex.needsUpdate = true;
  };
  updaters.push(drawClock);

  // ---------- plantas ----------
  function plant(x, z, s = 1, parent = scene) {
    mesh(new THREE.CylinderGeometry(.45 * s, .35 * s, .8 * s, 12), mat('#c97b5a'), x, .4 * s, z, parent);
    for (let i = 0; i < 4; i++) {
      mesh(new THREE.IcosahedronGeometry((.45 + rand() * .3) * s, 0), mat(['#5f9e57', '#6fb35f', '#4d8a4a'][i % 3], { flatShading: true }),
        x + (rand() - .5) * .6 * s, (1.1 + rand() * .9) * s, z + (rand() - .5) * .6 * s, parent);
    }
  }
  for (const [x, z] of [[-28.5, -22.5], [-28.5, 22], [-28.5, -6], [28.5, -22.5], [28.5, 22], [-6, 22.5], [6, 22.5]]) plant(x, z, 1.1);

  // ---------- estações ----------
  const stations = {};
  const SPIN = [];
  // stand: ângulo para onde os agentes ficam (a partir do centro); ring: ficam em volta
  function station(key, title, x, z, { stand = 0, ring = 0, labelY = 5.6 } = {}, build) {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    build(g);
    const l = label(title, { size: 24, bg: 'rgba(43,42,51,.75)', color: '#fff' });
    l.position.set(0, labelY, 0); g.add(l);
    scene.add(g);
    const light = new THREE.PointLight('#ffb36b', 0, 12); light.position.set(0, 3, 0); g.add(light);
    stations[key] = { pos: new THREE.Vector3(x, 0, z), stand, ring, light, heat: 0 };
  }

  const BOOKS = ['#d97757', '#6a9bd8', '#e7c35a', '#7bb37b', '#b07cc6', '#4fb3b3'];
  station('library', '📚 Biblioteca', -21, -20, { stand: 0 }, g => {
    for (const sx of [-5, 0, 5]) {
      for (let i = 0; i < 4; i++) {
        box(4.4, .18, 1.3, '#8b5e3c', sx, .5 + i * 1.15, -3.2, g);
        for (let k = 0; k < 8; k++) if (rand() > .12) {
          const h = .7 + rand() * .3;
          box(.4, h, .9, BOOKS[Math.floor(rand() * BOOKS.length)], sx - 1.85 + k * .52, .6 + i * 1.15 + h / 2, -3.2, g);
        }
      }
      box(.2, 4.8, 1.3, '#7a5233', sx - 2.25, 2.4, -3.2, g);
      box(.2, 4.8, 1.3, '#7a5233', sx + 2.25, 2.4, -3.2, g);
    }
    box(1.8, .8, 1.6, '#d9a066', -4.5, .4, 2, g); box(1.8, 1, .4, '#d9a066', -4.5, 1, 2.7, g); // poltrona
    plant(5.5, 2.5, .9, g);
  });
  rug(9, 5.5, '#c66a5a', -21, -18.5);

  const leds = [];
  station('terminal', '🖥️ Sala de servidores', -26, 1, { stand: Math.PI / 2, labelY: 6 }, g => {
    for (const rz of [-4, 0, 4]) {
      box(2.2, 4.6, 2.6, '#2f323d', -1, 2.3, rz, g);
      for (let i = 0; i < 8; i++) {
        const led = mesh(new THREE.BoxGeometry(.05, .1, 1.8), new THREE.MeshBasicMaterial({ color: '#5fd38d' }), .13, .7 + i * .5, rz, g);
        leds.push(led);
      }
    }
  });
  updaters.push((t) => {
    if (Math.floor(t * 8) % 2) return;
    for (const l of leds) if (rand() < .08) l.material.color.set(rand() < .7 ? '#5fd38d' : rand() < .5 ? '#4fa3ff' : '#ffb84d');
  });
  // cada LED tem material próprio (pisca individualmente)
  leds.forEach(l => { l.material = l.material.clone(); });

  station('mail', '📮 Integrações', 14, -21, { stand: 0 }, g => {
    box(6, 3.6, 1, '#b5835a', 0, 1.8, -1.6, g);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) box(.95, .9, .2, ['#f1e3cc', '#e7c35a', '#f1e3cc'][(r + c) % 3], -2.2 + c * 1.1, .7 + r * 1.05, -1.05, g);
    box(1.6, 2.2, 1.2, '#d97757', 3.8, 1.1, -1, g); // caixa de correio
  });

  // quadro Kanban do Jira e TV do Slack, na parede do fundo
  const jiraBoard = makeKanban();
  station('jira', '📋 Jira', 4.3, -21, { stand: 0, labelY: 7.4 }, g => {
    box(10.1, 5.2, .25, '#8a7a66', 0, 2.95, -2.85, g);
    jiraBoard.mesh.position.set(0, 2.95, -2.7); g.add(jiraBoard.mesh);
    box(10.1, .15, .5, '#b9a68b', 0, .3, -2.6, g); // calha de canetas
  });
  const slackTV = makeSlackTV();
  station('slack', '💬 Slack', 24, -21, { stand: 0, labelY: 6.6 }, g => {
    box(6.5, 4, .3, '#111317', 0, 3, -2.85, g);
    slackTV.mesh.position.set(0, 3, -2.68); g.add(slackTV.mesh);
    box(.3, 1.2, .3, '#2b2a33', 0, .6, -2.8, g);
  });

  station('web', '🌐 Internet', 22, -14, { stand: -Math.PI * .7 }, g => {
    mesh(new THREE.CylinderGeometry(1.2, 1.4, .4, 24), mat('#8b5e3c'), 0, .2, 0, g);
    box(.3, 2, .3, '#8b5e3c', 0, 1.2, 0, g);
    const globe = mesh(new THREE.SphereGeometry(1.4, 24, 16), mat('#6a9bd8'), 0, 3.4, 0, g);
    const land = mesh(new THREE.IcosahedronGeometry(1.43, 1), mat('#7bb37b', { flatShading: true, transparent: true, opacity: .85 }), 0, 3.4, 0, g);
    SPIN.push(globe, land);
  });

  station('meeting', '🤝 Sala de reunião', -20, 15, { ring: 3.6 }, g => {
    mesh(new THREE.CylinderGeometry(2.6, 2.6, .25, 32), mat('#c69a6d'), 0, 1.4, 0, g);
    box(.5, 1.4, .5, '#8b5e3c', 0, .7, 0, g);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * Math.PI * 2;
      box(.9, .6, .9, '#6a9bd8', Math.sin(a) * 3.1, .3, Math.cos(a) * 3.1, g);
    }
    // quadro branco na parede da esquerda
    box(.2, 2.6, 6, '#f7f7f2', -9.7, 2.8, 0, g);
    box(.25, .15, 6.2, '#9aa0a8', -9.65, 1.45, 0, g);
    for (let i = 0; i < 5; i++) box(.05, .12, 1 + rand() * 2.5, ['#d9534f', '#6a9bd8', '#2b2a33'][i % 3], -9.58, 3.7 - i * .4, -1.5 + rand(), g);
  });
  rug(12, 11, '#9fb4c7', -20, 15);

  // copa (decoração)
  box(7, 1.8, 1.6, '#f1e3cc', 22, .9, 21.6);
  box(7.2, .15, 1.8, '#8b5e3c', 22, 1.85, 21.6);
  box(1, 1.2, .9, '#2b2a33', 20, 2.5, 21.7); // máquina de café
  mesh(new THREE.CylinderGeometry(.18, .15, .35, 12), mat('#ffffff'), 20.9, 2.1, 21.3);
  box(1.8, 4, 1.6, '#cfd6dc', 26.6, 2, 21.6); // geladeira
  for (const x of [19.5, 22, 24.5]) { mesh(new THREE.CylinderGeometry(.45, .45, .15, 16), mat('#d97757'), x, 1.3, 19.8); box(.12, 1.3, .12, '#5b5f6b', x, .65, 19.8); }
  // vapor saindo da máquina de café
  const steam = [];
  for (let k = 0; k < 6; k++) {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .5, depthWrite: false }));
    scene.add(puff); steam.push(puff);
  }
  updaters.push(t => steam.forEach((puff, k) => {
    const ph = (t * .5 + k / steam.length) % 1;
    puff.position.set(20 + Math.sin(ph * 6 + k) * .08, 3.1 + ph * 1.3, 21.6);
    puff.scale.setScalar(.6 + ph * 1.4);
    puff.material.opacity = .45 * (1 - ph);
  }));
  // lugares para tomar café, em pé, encostado no balcão (de frente para ele)
  const coffeeSpots = [[18.2, 19.6], [20.75, 19.55], [23.25, 19.55], [25.8, 19.6], [21.5, 18.1], [24, 18.1], [19.3, 18.2]]
    .map(([x, z]) => ({ pos: new THREE.Vector3(x, 0, z), face: 0, owner: null, kind: 'coffee' }));
  const coffeeSign = label('☕ Copa', { size: 24, bg: 'rgba(43,42,51,.75)', color: '#fff' });
  coffeeSign.position.set(22, 5.2, 21.6); scene.add(coffeeSign);

  // ---------- mesas: 6 ilhas de 6 (36 lugares) ----------
  const desks = [];
  const deskGeo = { top: new THREE.BoxGeometry(3, .18, 1.6) };
  function buildDesk(d) {
    const g = new THREE.Group(); g.position.set(d.x, 0, d.z); g.rotation.y = d.rot;
    mesh(deskGeo.top, mat('#d8b48a'), 0, 1.3, -.6, g);
    for (const [x, z] of [[-1.35, -1.25], [1.35, -1.25], [-1.35, 0], [1.35, 0]]) box(.12, 1.3, .12, '#6b6875', x, .65, z, g);
    box(1.5, 1, .1, '#2b2a33', 0, 2.15, -1.1, g);
    box(.15, .5, .15, '#2b2a33', 0, 1.6, -1.1, g);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.35, .85), new THREE.MeshBasicMaterial({ color: '#3a3d4a' }));
    screen.position.set(0, 2.15, -1.04); g.add(screen);
    box(1.1, .06, .4, '#e9e6e0', 0, 1.42, -.3, g); // teclado
    if (rand() < .5) mesh(new THREE.CylinderGeometry(.13, .11, .28, 10), mat(BOOKS[Math.floor(rand() * 6)]), 1.05, 1.53, -.4, g); // caneca
    if (rand() < .3) plant(-1.1, -1, .35, g);
    // cadeira com encosto
    box(1, .15, 1, '#4b4f5c', 0, .75, .9, g);
    box(1, 1.1, .15, '#4b4f5c', 0, 1.35, 1.4, g);
    box(.12, .7, .12, '#2b2a33', 0, .35, .9, g);
    scene.add(g);
    d.screen = screen;
  }
  for (const pz of [-10, 1, 12]) for (const px of [-8, 8]) {
    rug(11.5, 7.5, '#cfd8de', px, pz);
    box(10.2, .8, .1, '#9fb4c7', px, 1.75, pz); // divisória
    for (const row of [0, 1]) for (let k = 0; k < 3; k++) {
      const rot = row ? Math.PI : 0;
      const d = { x: px + (k - 1) * 3.3, z: pz + (row ? -1.4 : 1.4), rot, owner: null };
      d.home = new THREE.Vector3(d.x + Math.sin(rot) * .9, 0, d.z + Math.cos(rot) * .9);
      d.face = rot + Math.PI;
      buildDesk(d); desks.push(d);
    }
  }
  desks.sort((a, b) => a.home.length() - b.home.length()); // ocupa do centro para fora

  // ---------- jardim ----------
  // riacho com ondinhas
  const waterGeo = new THREE.PlaneGeometry(4.5, 64, 8, 64);
  const water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({ color: '#5aa9d6', roughness: .15, metalness: .1, transparent: true, opacity: .9 }));
  water.rotation.x = -Math.PI / 2; water.position.set(STREAM_X, -.05, 0); water.receiveShadow = true; scene.add(water);
  const bed = mesh(new THREE.BoxGeometry(5, .3, 64), mat('#7a6a55'), STREAM_X, -.3, 0); bed.castShadow = false;
  const wpos = waterGeo.attributes.position;
  updaters.push((t) => {
    for (let i = 0; i < wpos.count; i++) wpos.setZ(i, Math.sin(wpos.getY(i) * .8 + t * 2.2) * .06 + Math.cos(wpos.getX(i) * 2 + t * 1.3) * .03);
    wpos.needsUpdate = true;
  });
  for (let z = -31; z < 31; z += 1.4) for (const side of [-1, 1]) {
    if (Math.abs(z) < 2.4) continue;
    const r = .35 + rand() * .45;
    const rock = mesh(new THREE.DodecahedronGeometry(r, 0), mat(rand() < .5 ? '#9a9a94' : '#b3b0a6', { flatShading: true }), STREAM_X + side * (2.5 + rand() * .4), r * .4, z + rand() * .6);
    rock.rotation.set(rand() * 3, rand() * 3, 0);
  }

  // ponte em arco
  const arcY = x => BRIDGE.h * Math.sin((x - BRIDGE.x0) / (BRIDGE.x1 - BRIDGE.x0) * Math.PI) + .15;
  const SLATS = 16, span = BRIDGE.x1 - BRIDGE.x0;
  for (let i = 0; i < SLATS; i++) {
    const x = BRIDGE.x0 + (i + .5) / SLATS * span;
    const slope = Math.atan2(arcY(x + .01) - arcY(x - .01), .02);
    const s = box(span / SLATS + .05, .18, BRIDGE.halfW * 2, i % 2 ? '#a0703f' : '#b07c48', x, arcY(x) - .09, 0);
    s.rotation.z = slope;
  }
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 12; i++) { const x = BRIDGE.x0 + i / 12 * span; pts.push(new THREE.Vector3(x, arcY(x) + .95, side * (BRIDGE.halfW - .1))); }
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, .08, 6), mat('#7a5233'));
    for (let i = 0; i <= 6; i++) { const x = BRIDGE.x0 + i / 6 * span; box(.14, .95, .14, '#7a5233', x, arcY(x) + .45, side * (BRIDGE.halfW - .1)); }
  }

  // caminho de pedras: porta → ponte → praça
  for (let x = 30.5; x < 36.5; x += 1.3) mesh(new THREE.CylinderGeometry(.6, .6, .08, 10), mat('#cfc6b6'), x, .02, (rand() - .5) * .5).castShadow = false;
  for (let x = 44; x < 47.5; x += 1.3) mesh(new THREE.CylinderGeometry(.6, .6, .08, 10), mat('#cfc6b6'), x, .02, (rand() - .5) * .5).castShadow = false;

  // praça e chafariz
  const plaza = mesh(new THREE.CircleGeometry(9.5, 48), mat('#ddd3c2'), FOUNTAIN.x, .01, FOUNTAIN.z);
  plaza.rotation.x = -Math.PI / 2; plaza.castShadow = false;
  const ring = mesh(new THREE.RingGeometry(9.2, 9.6, 48), mat('#b8ab95'), FOUNTAIN.x, .02, FOUNTAIN.z);
  ring.rotation.x = -Math.PI / 2; ring.castShadow = false;
  const basin = mesh(new THREE.LatheGeometry([[3.2, 0], [3.7, 0], [3.7, .9], [3.4, .9], [3.4, .15]].map(([x, y]) => new THREE.Vector2(x, y)), 40),
    mat('#d8d2c6'), FOUNTAIN.x, 0, FOUNTAIN.z);
  const pool = mesh(new THREE.CircleGeometry(3.4, 40), new THREE.MeshStandardMaterial({ color: '#6bb8e0', roughness: .1, transparent: true, opacity: .85 }), FOUNTAIN.x, .65, FOUNTAIN.z);
  pool.rotation.x = -Math.PI / 2;
  mesh(new THREE.CylinderGeometry(.45, .6, 2.4, 16), mat('#d8d2c6'), FOUNTAIN.x, 1.2, FOUNTAIN.z);
  mesh(new THREE.LatheGeometry([[0, 0], [1.6, .2], [1.7, .6], [1.5, .6], [.3, .25]].map(([x, y]) => new THREE.Vector2(x, y)), 32),
    mat('#d8d2c6'), FOUNTAIN.x, 2.3, FOUNTAIN.z);
  const bowl = mesh(new THREE.CircleGeometry(1.5, 32), pool.material, FOUNTAIN.x, 2.82, FOUNTAIN.z); bowl.rotation.x = -Math.PI / 2;
  mesh(new THREE.CylinderGeometry(.15, .2, .9, 10), mat('#d8d2c6'), FOUNTAIN.x, 3.2, FOUNTAIN.z);
  // jato d'água (partículas)
  const DROPS = 420;
  const dropPos = new Float32Array(DROPS * 3), dropVel = new Float32Array(DROPS * 3);
  const resetDrop = (i, spread = true) => {
    const a = rand() * Math.PI * 2, r = .5 + rand() * .7;
    dropPos.set([FOUNTAIN.x, 3.7, FOUNTAIN.z], i * 3);
    dropVel.set([Math.cos(a) * r, 3.6 + rand() * 1.4, Math.sin(a) * r], i * 3);
    if (spread) for (let k = 0; k < rand() * 60; k++) stepDrop(i, 1 / 60);
  };
  const stepDrop = (i, dt) => {
    dropVel[i * 3 + 1] -= 9.8 * dt;
    for (let k = 0; k < 3; k++) dropPos[i * 3 + k] += dropVel[i * 3 + k] * dt;
    const dx = dropPos[i * 3] - FOUNTAIN.x, dz = dropPos[i * 3 + 2] - FOUNTAIN.z;
    const floorY = dx * dx + dz * dz < 1.5 * 1.5 ? 2.85 : .65;
    if (dropPos[i * 3 + 1] < floorY && dropVel[i * 3 + 1] < 0) return false;
    return true;
  };
  for (let i = 0; i < DROPS; i++) resetDrop(i);
  const dropGeo = new THREE.BufferGeometry();
  dropGeo.setAttribute('position', new THREE.BufferAttribute(dropPos, 3));
  const drops = new THREE.Points(dropGeo, new THREE.PointsMaterial({ color: '#d4f0ff', size: .16, transparent: true, opacity: .85 }));
  drops.frustumCulled = false; scene.add(drops);
  updaters.push((t, dt) => {
    const h = Math.min(dt, 1 / 20);
    for (let i = 0; i < DROPS; i++) if (!stepDrop(i, h)) resetDrop(i, false);
    dropGeo.attributes.position.needsUpdate = true;
    pool.position.y = .65 + Math.sin(t * 3) * .02;
  });

  // bancos em volta do chafariz: cada um tem dois lugares de descanso
  const seats = [];
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8;
    const bx = FOUNTAIN.x + Math.sin(a) * 7.2, bz = FOUNTAIN.z + Math.cos(a) * 7.2;
    const g = new THREE.Group(); g.position.set(bx, 0, bz); g.rotation.y = a + Math.PI; scene.add(g);
    box(2.8, .15, .8, '#b07c48', 0, .75, 0, g);
    box(2.8, .7, .12, '#b07c48', 0, 1.2, .42, g);
    for (const x of [-1.2, 1.2]) box(.15, .75, .7, '#3b3f4a', x, .37, 0, g);
    for (const off of [-.65, .65]) {
      const p = new THREE.Vector3(off, 0, -.15).applyAxisAngle(new THREE.Vector3(0, 1, 0), a + Math.PI).add(g.position);
      seats.push({ pos: p, face: a + Math.PI, owner: null });
    }
  }
  // postes de luz
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * Math.PI * 2;
    const x = FOUNTAIN.x + Math.sin(a) * 9.4, z = FOUNTAIN.z + Math.cos(a) * 9.4;
    box(.18, 4, .18, '#3b3f4a', x, 2, z);
    mesh(new THREE.SphereGeometry(.35, 12, 10), new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 1 }), x, 4.2, z);
  }

  // árvores e flores (fora do riacho, da ponte, do caminho e da praça)
  const freeSpot = (x, z) => Math.abs(x - STREAM_X) > 4 && Math.abs(z) > 3.2 &&
    Math.hypot(x - FOUNTAIN.x, z - FOUNTAIN.z) > 11 && x > 32;
  const trunks = []; // troncos viram obstáculos na navegação
  function tree(x, z) {
    const s = .8 + rand() * .6;
    trunks.push([x, z, .35 * s]);
    mesh(new THREE.CylinderGeometry(.22 * s, .32 * s, 2.2 * s, 8), mat('#7a5233'), x, 1.1 * s, z);
    if (rand() < .4) { // pinheiro
      for (let k = 0; k < 3; k++) mesh(new THREE.ConeGeometry((1.7 - k * .4) * s, 1.8 * s, 8), mat(['#3f7d4e', '#4b8f58', '#3a7347'][k], { flatShading: true }), x, (2.2 + k * 1.05) * s, z);
    } else { // copa redonda
      const greens = ['#6fb35f', '#5f9e57', '#7cc26a', '#58a35a'];
      for (let k = 0; k < 3; k++) mesh(new THREE.IcosahedronGeometry((1 + rand() * .6) * s, 0), mat(greens[Math.floor(rand() * 4)], { flatShading: true }),
        x + (rand() - .5) * 1.2 * s, (3 + rand() * 1.1) * s, z + (rand() - .5) * 1.2 * s);
    }
  }
  let planted = 0;
  for (let tries = 0; planted < 34 && tries < 600; tries++) {
    const x = 32 + rand() * 56, z = -30 + rand() * 60;
    if (freeSpot(x, z)) { tree(x, z); planted++; }
  }
  const FLOWERS = ['#e46a8f', '#e7c35a', '#ffffff', '#b07cc6', '#ff8a5c'];
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2, r = 9.9 + rand() * 1.6;
    mesh(new THREE.SphereGeometry(.16, 6, 5), mat(FLOWERS[Math.floor(rand() * FLOWERS.length)]), FOUNTAIN.x + Math.sin(a) * r, .2, FOUNTAIN.z + Math.cos(a) * r).castShadow = false;
  }

  // ---------- navegação ----------
  const DOOR = new THREE.Vector3(0, 0, 23);
  // altura do chão (sobe na ponte)
  const groundY = (x, z) => x >= BRIDGE.x0 && x <= BRIDGE.x1 && Math.abs(z) < BRIDGE.halfW + .3 ? arcY(x) : 0;
  // ----- mapa de obstáculos (grade de 0,5) + A*: ninguém atravessa mesa, estante, riacho… -----
  const CELL = .5, GX0 = -31, GZ0 = -33, GW = 244, GH = 132, BODY = .6; // BODY: folga do tamanho do corpo
  const blocked = new Uint8Array(GW * GH);
  const cellOf = (x, z) => [Math.floor((x - GX0) / CELL), Math.floor((z - GZ0) / CELL)];
  const centerOf = (i, j) => [GX0 + (i + .5) * CELL, GZ0 + (j + .5) * CELL];
  const solidRect = (x0, x1, z0, z1, pad = BODY) => {
    const [i0, j0] = cellOf(x0 - pad, z0 - pad), [i1, j1] = cellOf(x1 + pad, z1 + pad);
    for (let j = Math.max(0, j0); j <= Math.min(GH - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(GW - 1, i1); i++) blocked[j * GW + i] = 1;
  };
  const solidCircle = (x, z, r, pad = BODY) => {
    const R = r + pad, [i0, j0] = cellOf(x - R, z - R), [i1, j1] = cellOf(x + R, z + R);
    for (let j = Math.max(0, j0); j <= Math.min(GH - 1, j1); j++) for (let i = Math.max(0, i0); i <= Math.min(GW - 1, i1); i++) {
      const [cx, cz] = centerOf(i, j);
      if ((cx - x) ** 2 + (cz - z) ** 2 <= R * R) blocked[j * GW + i] = 1;
    }
  };
  // fora do chão (escritório: x -30..30, z -24..24; jardim: x 30..90, z -32..32)
  for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
    const [x, z] = centerOf(i, j);
    const inOffice = x > -30 && x < 30 && z > -24 && z < 24.5, inGarden = x >= 30 && x < 89 && z > -32 && z < 32;
    if (!inOffice && !inGarden) blocked[j * GW + i] = 1;
  }
  solidRect(-31, 31, -26, -23.6, 0); solidRect(-31, -29.7, -26, 26, 0); // paredes
  solidRect(29.8, 30.2, -24, -3, .35); solidRect(29.8, 30.2, 3, 24.5, .35); // fachada de vidro (porta no meio)
  for (const pz of [-10, 1, 12]) for (const px of [-8, 8]) solidRect(px - 4.9, px + 4.9, pz - 1.65, pz + 1.65); // ilhas de mesas
  solidRect(-26.5, -15.5, -24, -22.5); solidRect(-26.4, -24.6, -18.8, -17.2); // biblioteca: estantes e poltrona
  solidRect(-28.1, -25.9, -5.3, 5.3); // sala de servidores
  solidRect(11, 17, -23.2, -22.1); solidRect(17, 18.6, -22.6, -21.4); // integrações
  solidCircle(22, -14, 1.4); // globo
  solidCircle(-20, 15, 3.0); // mesa de reunião + cadeiras
  solidRect(18.5, 27.5, 20.8, 22.5); for (const x of [19.5, 22, 24.5]) solidCircle(x, 19.8, .45); // copa
  for (const [x, z] of [[-28.5, -22.5], [-28.5, 22], [-28.5, -6], [28.5, -22.5], [28.5, 22], [-6, 22.5], [6, 22.5]]) solidCircle(x, z, .6); // vasos
  solidRect(STREAM_X - 2.9, STREAM_X + 2.9, -33, -BRIDGE.halfW); solidRect(STREAM_X - 2.9, STREAM_X + 2.9, BRIDGE.halfW, 33); // riacho (a ponte fica livre)
  solidCircle(FOUNTAIN.x, FOUNTAIN.z, 3.8); // chafariz
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; solidCircle(FOUNTAIN.x + Math.sin(a) * 7.2, FOUNTAIN.z + Math.cos(a) * 7.2, .9, .3); } // bancos
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2; solidCircle(FOUNTAIN.x + Math.sin(a) * 9.4, FOUNTAIN.z + Math.cos(a) * 9.4, .2, .4); } // postes
  for (const [x, z, r] of trunks) solidCircle(x, z, r, .4); // árvores
  const isFree = (i, j) => i >= 0 && j >= 0 && i < GW && j < GH && !blocked[j * GW + i];

  // célula livre mais próxima (para destinos colados em obstáculos: cadeira, banco)
  function nearestFree(i, j) {
    if (isFree(i, j)) return [i, j];
    for (let r = 1; r < 14; r++) {
      let best = null, bd = Infinity;
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r || !isFree(i + di, j + dj)) continue;
        const d = di * di + dj * dj; if (d < bd) { bd = d; best = [i + di, j + dj]; }
      }
      if (best) return best;
    }
    return [i, j];
  }
  // linha reta livre entre dois pontos (amostrada a cada ¼ de célula)
  function clearLine(x0, z0, x1, z1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / (CELL / 4));
    for (let k = 1; k < steps; k++) {
      const [i, j] = cellOf(x0 + (x1 - x0) * k / steps, z0 + (z1 - z0) * k / steps);
      if (!isFree(i, j)) return false;
    }
    return true;
  }
  const gScore = new Float32Array(GW * GH), came = new Int32Array(GW * GH), stamp = new Uint32Array(GW * GH), closed = new Uint32Array(GW * GH);
  let runId = 0;
  function astar(si, sj, ti, tj) {
    runId++;
    const start = sj * GW + si, goal = tj * GW + ti;
    const heap = [], push = (f, n) => { heap.push([f, n]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    const h = n => { const dx = Math.abs(n % GW - ti), dz = Math.abs(((n / GW) | 0) - tj); return Math.max(dx, dz) + .414 * Math.min(dx, dz); };
    stamp[start] = runId; gScore[start] = 0; came[start] = -1; push(h(start), start);
    while (heap.length) {
      const [, n] = pop();
      if (closed[n] === runId) continue; // já resolvida (entrada velha da fila)
      closed[n] = runId;
      if (n === goal) break;
      const ni = n % GW, nj = (n / GW) | 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const i = ni + di, j = nj + dj;
        if (!isFree(i, j) || (di && dj && (!isFree(ni + di, nj) || !isFree(ni, nj + dj)))) continue; // sem cortar quina
        const m = j * GW + i, g = gScore[n] + (di && dj ? 1.414 : 1);
        if (closed[m] === runId || (stamp[m] === runId && g >= gScore[m])) continue;
        stamp[m] = runId; gScore[m] = g; came[m] = n; push(g + h(m), m);
      }
    }
    if (stamp[goal] !== runId) return null;
    const cells = [];
    for (let n = goal; n !== -1; n = came[n]) cells.push(n);
    return cells.reverse();
  }
  // caminho até o destino desviando dos obstáculos; devolve pontos de passagem já suavizados
  function route(from, to) {
    const [fi, fj] = nearestFree(...cellOf(from.x, from.z)), [ti, tj] = nearestFree(...cellOf(to.x, to.z));
    const cells = (fi === ti && fj === tj) ? [] : astar(fi, fj, ti, tj);
    if (!cells) return [to.clone()]; // sem caminho (não deveria acontecer): vai direto
    const pts = [new THREE.Vector3(from.x, 0, from.z)];
    if (!isFree(...cellOf(from.x, from.z))) { const [cx, cz] = centerOf(fi, fj); pts.push(new THREE.Vector3(cx, 0, cz)); } // sai do obstáculo (cadeira/banco)
    for (const n of cells) { const [x, z] = centerOf(n % GW, (n / GW) | 0); pts.push(new THREE.Vector3(x, 0, z)); }
    // suavização: pula pontos enquanto a linha reta continuar livre
    const out = [];
    let cur = pts[0];
    for (let k = 1; k < pts.length;) {
      let far = k;
      while (far + 1 < pts.length && clearLine(cur.x, cur.z, pts[far + 1].x, pts[far + 1].z)) far++;
      out.push(pts[far]); cur = pts[far]; k = far + 1;
    }
    out.push(to.clone()); // último passinho até o ponto exato (assento, cadeira)
    return out;
  }
  // posição de um agente numa estação (n = índice do agente, para não empilhar)
  function standAt(key, n) {
    const s = stations[key];
    if (s.ring) { const a = n * 2.4; return new THREE.Vector3(s.pos.x + Math.sin(a) * s.ring, 0, s.pos.z + Math.cos(a) * s.ring); }
    const dir = new THREE.Vector3(Math.sin(s.stand), 0, Math.cos(s.stand));
    const side = new THREE.Vector3(dir.z, 0, -dir.x);
    return s.pos.clone().addScaledVector(dir, 2.6).addScaledVector(side, ((n % 5) - 2) * 1.3);
  }

  function update(t, dt) {
    for (const f of updaters) f(t, dt);
    for (const m of SPIN) m.rotation.y += dt * .4;
  }

  return { stations, desks, seats, coffeeSpots, DOOR, groundY, route, standAt, update, jiraBoard, slackTV, clearLine };
}
