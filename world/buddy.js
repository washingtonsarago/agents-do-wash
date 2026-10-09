// Agents do Wash — bonequinho procedural (cápsula amarela, óculos de proteção, macacão na cor do agente).
// Mesma interface de antes: play(nome) para estados contínuos e emote(nome) para gestos curtos.
import * as THREE from 'three';

const SKIN = '#f6d33c';
const DARK = '#2b2a33';
const mats = new Map();
const mat = (c, extra = {}) => {
  const key = c + JSON.stringify(extra);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color: c, roughness: .6, ...extra }));
  return mats.get(key);
};
function add(parent, geo, m, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o;
}

export const EMOTES = { Wave: 1.6, Jump: .8, Yes: 1, No: 1, Punch: 1, ThumbsUp: 1.2, Dance: 2.4 };

export const SKINS = {
  classico: '🟡 Clássico',
  capa: '🦸 Capas (estilo DC)',
  armadura: '🤖 Armaduras (estilo Marvel)',
};

const darker = (c, k = .6) => new THREE.Color(c).multiplyScalar(k).getStyle();

// emblemas geométricos (originais) para o peito dos heróis de capa
function emblemShape(kind) {
  const s = new THREE.Shape();
  if (kind === 0) { s.moveTo(0, .2); s.lineTo(.15, 0); s.lineTo(0, -.2); s.lineTo(-.15, 0); } // losango
  else if (kind === 1) { s.moveTo(.05, .2); s.lineTo(-.1, -.01); s.lineTo(.02, -.01); s.lineTo(-.05, -.2); s.lineTo(.12, .04); s.lineTo(0, .04); } // raio
  else if (kind === 2) { s.moveTo(0, .19); s.lineTo(.18, -.14); s.lineTo(-.18, -.14); } // triângulo
  else { s.moveTo(-.18, .12); s.lineTo(0, -.04); s.lineTo(.18, .12); s.lineTo(.18, -.02); s.lineTo(0, -.18); s.lineTo(-.18, -.02); } // divisa
  s.closePath();
  return new THREE.ShapeGeometry(s);
}

export function makeBuddy({ color, main = false, seed = 1, skin = 'classico' }) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body); // tudo que balança junto
  const R = .78;
  const eyes = [];
  let cape = null;

  const limb = (x, y, len, m, hand) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0); body.add(pivot);
    add(pivot, new THREE.CapsuleGeometry(.1, len, 4, 8), m, 0, -len / 2, 0);
    add(pivot, hand.geo, hand.mat, hand.x || 0, -len - .08, hand.z || 0);
    return pivot;
  };
  const legL = new THREE.Group(); legL.position.set(-.3, .62, 0); root.add(legL);
  const legR = new THREE.Group(); legR.position.set(.3, .62, 0); root.add(legR);
  const legs = (legMat, footGeo, footMat, footY = -.52) => {
    for (const leg of [legL, legR]) {
      add(leg, new THREE.CylinderGeometry(.13, .13, .45, 10), legMat, 0, -.22, 0);
      add(leg, footGeo, footMat, 0, footY, .08);
    }
  };
  // olhos que piscam (clássico e capa)
  const blinkEye = (ex, y, big, iris = true) => {
    const eye = new THREE.Group(); eye.position.set(ex, y, R - .08); body.add(eye);
    add(eye, new THREE.SphereGeometry(.22 * big, 16, 12), mat('#ffffff', { roughness: .2 })).scale.z = .55;
    if (iris) {
      add(eye, new THREE.CircleGeometry(.1 * big, 16), mat('#7a4b2a'), 0, 0, .125 * big);
      add(eye, new THREE.CircleGeometry(.05 * big, 12), mat('#111'), 0, 0, .13 * big);
    }
    eyes.push(eye);
  };
  const smile = () => { const m = add(body, new THREE.TorusGeometry(.16, .03, 6, 14, Math.PI), mat('#5a2a1a'), 0, 2.03, R - .02); m.rotation.z = Math.PI; };

  let armL, armR;
  if (skin === 'capa') {
    // ---------- herói de capa ----------
    const suit = mat(color), accent = mat(main ? '#e7b53a' : '#f2f2f2', { metalness: main ? .6 : 0, roughness: .35 });
    const trim = mat(darker(color, .45));
    add(body, new THREE.CapsuleGeometry(R, 1.1, 8, 24), mat('#f1c9a5'), 0, 1.85, 0); // rosto/pele
    add(body, new THREE.CylinderGeometry(R + .02, R + .02, 1.05, 24), suit, 0, 1.55, 0);
    add(body, new THREE.SphereGeometry(R + .02, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), suit, 0, 1.03, 0);
    add(body, new THREE.SphereGeometry(R + .03, 24, 10, 0, Math.PI * 2, 0, Math.PI * .3), mat('#2b2320'), 0, 2.4, 0); // cabelo
    add(body, new THREE.TorusGeometry(R + .03, .06, 8, 32), accent, 0, 1.12, 0).rotation.x = Math.PI / 2; // cinto
    // máscara + olhos brancos
    add(body, new THREE.CylinderGeometry(R + .035, R + .035, .32, 24, 1, true, -1.05, 2.1), mat('#1c1b22', { side: THREE.DoubleSide }), 0, 2.45, 0);
    for (const ex of [-.27, .27]) blinkEye(ex, 2.45, .72, false);
    smile();
    // emblema no peito
    const plate = add(body, new THREE.CircleGeometry(.3, 24), accent, 0, 1.78, R + .025); plate.scale.y = .8;
    add(body, emblemShape(seed % 4), main ? mat('#c0392b') : trim, 0, 1.78, R + .035);
    // capa (pivô nos ombros, presa nas costas)
    cape = new THREE.Group(); cape.position.set(0, 2.25, -R - .04); body.add(cape);
    const cs = new THREE.Shape(); cs.moveTo(-.55, 0); cs.lineTo(.55, 0); cs.lineTo(.85, -1.95); cs.quadraticCurveTo(0, -2.15, -.85, -1.95); cs.closePath();
    const capeMesh = add(cape, new THREE.ShapeGeometry(cs, 8), mat(main ? '#c0392b' : darker(color, .55), { side: THREE.DoubleSide }));
    capeMesh.rotation.y = Math.PI; capeMesh.position.z = -.02;
    add(body, new THREE.TorusGeometry(.6, .05, 6, 20, Math.PI), accent, 0, 2.27, -.2).rotation.set(Math.PI / 2, 0, 0); // fecho da capa
    const glove = { geo: new THREE.SphereGeometry(.16, 12, 10), mat: trim };
    armL = limb(-R - .05, 1.9, .55, suit, glove);
    armR = limb(R + .05, 1.9, .55, suit, glove);
    legs(suit, new THREE.BoxGeometry(.32, .3, .44), trim, -.46);
  } else if (skin === 'armadura') {
    // ---------- herói de armadura ----------
    const metal = mat(color, { metalness: .65, roughness: .3 });
    const plateM = mat(main ? '#d4a52a' : darker(color, .55), { metalness: .75, roughness: .28 });
    const glow = new THREE.MeshBasicMaterial({ color: '#bff4ff' });
    add(body, new THREE.CapsuleGeometry(R, 1.1, 8, 24), metal, 0, 1.85, 0);
    add(body, new THREE.SphereGeometry(R + .025, 24, 12, 0, Math.PI * 2, 0, Math.PI * .42), plateM, 0, 2.4, 0); // topo do capacete
    add(body, new THREE.CylinderGeometry(R + .03, R + .03, .62, 24, 1, true, -1.15, 2.3), plateM, 0, 2.3, 0); // máscara
    for (const s of [-1, 1]) { // visor: lentes alongadas
      const lens = new THREE.Mesh(new THREE.CircleGeometry(.14, 20), glow);
      lens.scale.set(1.7, .55, 1); lens.position.set(s * .27, 2.45, R + .045); lens.rotation.z = s * -.22; body.add(lens);
    }
    for (const y of [1.2, 2.1]) add(body, new THREE.TorusGeometry(R + .02, .035, 6, 32), plateM, 0, y, 0).rotation.x = Math.PI / 2;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .05, 6), glow); // núcleo de energia
    core.rotation.x = Math.PI / 2; core.position.set(0, 1.72, R + .02); body.add(core);
    add(body, new THREE.TorusGeometry(.22, .04, 6, 6), plateM, 0, 1.72, R + .03);
    for (const s of [-1, 1]) add(body, new THREE.SphereGeometry(.3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), plateM, s * (R - .05), 2.05, 0); // ombreiras
    if (main) { // escudo redondo nas costas
      const sh = new THREE.Group(); sh.position.set(0, 1.75, -R - .06); body.add(sh);
      [['#c0392b', .62], ['#ecf0f1', .46], ['#2c5aa0', .3]].forEach(([c, r], i) => {
        const d = add(sh, new THREE.CylinderGeometry(r, r, .06, 32), mat(c, { metalness: .5, roughness: .3 }), 0, 0, -i * .012);
        d.rotation.x = Math.PI / 2;
      });
    }
    const gauntlet = { geo: new THREE.BoxGeometry(.26, .26, .26), mat: plateM };
    armL = limb(-R - .05, 1.9, .55, metal, gauntlet);
    armR = limb(R + .05, 1.9, .55, metal, gauntlet);
    legs(metal, new THREE.BoxGeometry(.34, .22, .46), plateM);
  } else {
    // ---------- clássico: cápsula amarela de macacão ----------
    const overall = mat(color);
    add(body, new THREE.CapsuleGeometry(R, 1.1, 8, 24), mat(SKIN), 0, 1.85, 0);
    add(body, new THREE.CylinderGeometry(R + .02, R + .02, .55, 24), overall, 0, 1.3, 0);
    add(body, new THREE.SphereGeometry(R + .02, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), overall, 0, 1.03, 0);
    add(body, new THREE.BoxGeometry(.75, .5, .1), overall, 0, 1.75, R - .04); // peitilho
    add(body, new THREE.CircleGeometry(.12, 16), mat(main ? '#e7c35a' : '#ffffff', { roughness: .3 }), 0, 1.75, R + .015); // botão
    for (const s of [-1, 1]) {
      const strap = add(body, new THREE.BoxGeometry(.12, .7, .08), overall, s * .38, 2.15, R - .12);
      strap.rotation.z = s * .25;
    }
    add(body, new THREE.BoxGeometry(.3, .22, .05), mat(darker(color, .75)), 0, 1.25, R + .03); // bolso
    // óculos: faixa + 1 ou 2 olhos
    add(body, new THREE.CylinderGeometry(R + .03, R + .03, .2, 28, 1, true), mat(DARK), 0, 2.45, 0);
    const twoEyes = seed % 3 !== 0;
    for (const ex of twoEyes ? [-.26, .26] : [0]) {
      const big = twoEyes ? 1 : 1.35;
      add(body, new THREE.TorusGeometry(.24 * big, .07, 10, 24), mat('#b9bec7', { metalness: .8, roughness: .25 }), ex, 2.45, R - .02).castShadow = false;
      blinkEye(ex, 2.45, big);
    }
    smile();
    for (let i = 0; i < 2 + seed % 4; i++) { // cabelinho
      const h = add(body, new THREE.CylinderGeometry(.015, .015, .35, 4), mat(DARK), (i - 1.5) * .12, 3.15, (i % 2) * .08);
      h.rotation.z = (i - 1.5) * .25;
    }
    if (main) { // coroa do agente principal
      const crown = new THREE.Group(); crown.position.y = 3.15; body.add(crown);
      add(crown, new THREE.CylinderGeometry(.42, .45, .25, 16, 1, true), mat('#e7b53a', { metalness: .7, roughness: .3, side: THREE.DoubleSide }));
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2;
        add(crown, new THREE.ConeGeometry(.1, .3, 6), mat('#e7b53a', { metalness: .7, roughness: .3 }), Math.sin(a) * .42, .25, Math.cos(a) * .42);
      }
    }
    const glove = { geo: new THREE.SphereGeometry(.15, 12, 10), mat: mat(DARK) };
    armL = limb(-R - .05, 1.9, .55, mat(SKIN), glove);
    armR = limb(R + .05, 1.9, .55, mat(SKIN), glove);
    legs(overall, new THREE.BoxGeometry(.3, .16, .42), mat(DARK));
  }
  armL.rotation.z = .25; armR.rotation.z = -.25;

  // ---------- animação procedural ----------
  let state = 'Idle', emote = null, emoteT = 0, blinkAt = 2 + Math.random() * 3;
  const phase = Math.random() * 6;
  const cur = { by: 0, bx: 0, bry: 0, brz: 0, aLx: 0, aLz: .25, aRx: 0, aRz: -.25, lL: 0, lR: 0 };
  const sit = { y: 0 };

  function update(dt, t, typing = false) {
    const w = t * (state === 'Running' ? 15 : 10) + phase;
    const tgt = { by: 0, bx: 0, bry: 0, brz: 0, aLx: 0, aLz: .25, aRx: 0, aRz: -.25, lL: 0, lR: 0 };
    let sitY = 0;
    if (state === 'Walking' || state === 'Running') {
      const amp = state === 'Running' ? .9 : .6;
      tgt.lL = Math.sin(w) * amp; tgt.lR = -Math.sin(w) * amp;
      tgt.aLx = -Math.sin(w) * amp * .8; tgt.aRx = Math.sin(w) * amp * .8;
      tgt.by = Math.abs(Math.sin(w)) * .14;
      tgt.bx = state === 'Running' ? .18 : .05;
    } else if (state === 'Sitting') {
      sitY = -.42; tgt.lL = tgt.lR = -1.45;
      tgt.aLx = tgt.aRx = -.9; tgt.aLz = .1; tgt.aRz = -.1;
      if (typing) { tgt.aLx += Math.sin(t * 18) * .12; tgt.aRx += Math.cos(t * 18) * .12; }
    } else { // Idle: respira e balança de leve
      tgt.by = Math.sin(t * 2 + phase) * .03;
      tgt.brz = Math.sin(t * .9 + phase) * .04;
    }
    if (emote) {
      emoteT += dt;
      const k = Math.min(emoteT / EMOTES[emote], 1);
      const env = Math.sin(k * Math.PI); // entra e sai suave
      switch (emote) {
        case 'Wave': tgt.aRz = -2.7; tgt.aRx = Math.sin(t * 14) * .45; break;
        case 'Jump': tgt.by += env * 1.3; tgt.aLz = 2.4; tgt.aRz = -2.4; tgt.lL = tgt.lR = -.4 * env; break;
        case 'Yes': tgt.bx = Math.sin(k * Math.PI * 4) * .22; break;
        case 'No': tgt.bry = Math.sin(k * Math.PI * 6) * .45 * env; tgt.aLz = .5; tgt.aRz = -.5; break;
        case 'Punch': tgt.aRx = Math.sin(k * Math.PI * 4) > 0 ? -1.6 : -.3; tgt.aLx = Math.sin(k * Math.PI * 4) > 0 ? -.3 : -1.6; tgt.bry = Math.sin(k * Math.PI * 4) * .2; break;
        case 'ThumbsUp': tgt.aRz = -1.9; tgt.aRx = -.6; tgt.by += env * .3; break;
        case 'Dance': tgt.brz = Math.sin(t * 9) * .25; tgt.by += Math.abs(Math.sin(t * 9)) * .35; tgt.aLz = 2 + Math.sin(t * 9) * .5; tgt.aRz = -2 - Math.cos(t * 9) * .5; break;
      }
      if (k >= 1) emote = null;
    }
    const f = 1 - Math.exp(-dt * 14);
    for (const k in cur) cur[k] += (tgt[k] - cur[k]) * f;
    sit.y += (sitY - sit.y) * f;
    body.position.y = cur.by + sit.y;
    legL.position.y = legR.position.y = .62 + sit.y;
    body.rotation.set(cur.bx, cur.bry, cur.brz);
    armL.rotation.set(cur.aLx, 0, cur.aLz); armR.rotation.set(cur.aRx, 0, cur.aRz);
    legL.rotation.x = cur.lL; legR.rotation.x = cur.lR;
    if (cape) { // a capa levanta com a velocidade e balança um pouco
      const lift = state === 'Running' ? 1.05 : state === 'Walking' ? .5 : state === 'Sitting' ? .05 : .12;
      const wob = Math.sin(t * (state === 'Running' ? 14 : 3) + phase) * (state === 'Running' ? .12 : .05);
      cape.rotation.x += (lift + wob - cape.rotation.x) * (1 - Math.exp(-dt * 6));
    }
    // piscar
    blinkAt -= dt;
    const blink = blinkAt < 0 && blinkAt > -.12;
    if (blinkAt < -.12) blinkAt = 2 + Math.random() * 4;
    for (const e of eyes) e.scale.y = blink ? .1 : 1;
  }

  return {
    root, update,
    play(name) { state = name; },
    emote(name) { if (!EMOTES[name]) return 0; emote = name; emoteT = 0; return EMOTES[name] * 1000; },
    get busy() { return !!emote; },
  };
}
