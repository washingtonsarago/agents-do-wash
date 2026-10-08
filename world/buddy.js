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

export function makeBuddy({ color, main = false, seed = 1 }) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body); // tudo que balança junto
  const overall = mat(color);
  const R = .78;

  // corpo + macacão
  add(body, new THREE.CapsuleGeometry(R, 1.1, 8, 24), mat(SKIN), 0, 1.85, 0);
  add(body, new THREE.CylinderGeometry(R + .02, R + .02, .55, 24), overall, 0, 1.3, 0);
  const seatHalf = add(body, new THREE.SphereGeometry(R + .02, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), overall, 0, 1.03, 0);
  seatHalf.castShadow = true;
  add(body, new THREE.BoxGeometry(.75, .5, .1), overall, 0, 1.75, R - .04); // peitilho
  add(body, new THREE.CircleGeometry(.12, 16), mat(main ? '#e7c35a' : '#ffffff', { roughness: .3 }), 0, 1.75, R + .015); // botão/emblema
  for (const s of [-1, 1]) {
    const strap = add(body, new THREE.BoxGeometry(.12, .7, .08), overall, s * .38, 2.15, R - .12);
    strap.rotation.z = s * .25;
  }
  add(body, new THREE.BoxGeometry(.3, .22, .05), mat(new THREE.Color(color).multiplyScalar(.75).getStyle()), 0, 1.25, R + .03); // bolso

  // óculos: faixa + 1 ou 2 olhos
  add(body, new THREE.CylinderGeometry(R + .03, R + .03, .2, 28, 1, true), mat(DARK), 0, 2.45, 0);
  const eyes = [];
  const twoEyes = seed % 3 !== 0;
  for (const ex of twoEyes ? [-.26, .26] : [0]) {
    const big = twoEyes ? 1 : 1.35;
    const rim = add(body, new THREE.TorusGeometry(.24 * big, .07, 10, 24), mat('#b9bec7', { metalness: .8, roughness: .25 }), ex, 2.45, R - .02);
    rim.castShadow = false;
    const eye = new THREE.Group(); eye.position.set(ex, 2.45, R - .08); body.add(eye);
    add(eye, new THREE.SphereGeometry(.22 * big, 16, 12), mat('#ffffff', { roughness: .2 })).scale.z = .55;
    add(eye, new THREE.CircleGeometry(.1 * big, 16), mat('#7a4b2a'), 0, 0, .125 * big);
    add(eye, new THREE.CircleGeometry(.05 * big, 12), mat('#111'), 0, 0, .13 * big);
    eyes.push(eye);
  }
  // boca
  const mouth = add(body, new THREE.TorusGeometry(.16, .03, 6, 14, Math.PI), mat('#5a2a1a'), 0, 2.03, R - .02);
  mouth.rotation.z = Math.PI;
  // cabelinho
  for (let i = 0; i < 2 + seed % 4; i++) {
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

  // braços (pivô no ombro) e pernas (pivô no quadril)
  const limb = (x, y, len, m, hand) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0); body.add(pivot);
    add(pivot, new THREE.CapsuleGeometry(.1, len, 4, 8), m, 0, -len / 2, 0);
    add(pivot, hand.geo, hand.mat, hand.x || 0, -len - .08, hand.z || 0);
    return pivot;
  };
  const glove = { geo: new THREE.SphereGeometry(.15, 12, 10), mat: mat(DARK) };
  const armL = limb(-R - .05, 1.9, .55, mat(SKIN), glove);
  const armR = limb(R + .05, 1.9, .55, mat(SKIN), glove);
  armL.rotation.z = .25; armR.rotation.z = -.25;
  const shoe = { geo: new THREE.BoxGeometry(.3, .16, .42), mat: mat(DARK), z: .08 };
  const legL = new THREE.Group(); legL.position.set(-.3, .62, 0); root.add(legL);
  const legR = new THREE.Group(); legR.position.set(.3, .62, 0); root.add(legR);
  for (const leg of [legL, legR]) {
    add(leg, new THREE.CylinderGeometry(.13, .13, .45, 10), overall, 0, -.22, 0);
    add(leg, shoe.geo, shoe.mat, 0, -.52, shoe.z);
  }

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
