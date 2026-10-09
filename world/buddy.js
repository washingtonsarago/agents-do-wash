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

export const EMOTES = { Wave: 1.6, Jump: .8, Yes: 1, No: 1, Punch: 1, ThumbsUp: 1.2, Dance: 2.4, Point: 2.2, Drink: 1.8 };

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

// Paletas de cores inspiradas em heróis conhecidos (só as cores: sem nomes, símbolos ou uniformes oficiais).
// Quem chama sorteia o índice (palette); sem sorteio, o principal fica com a primeira e os outros variam.
const CAPE_PALETTES = [
  { top: '#2a5bd7', bottom: '#2a5bd7', cape: '#c8102e', boots: '#c8102e', gloves: '#2a5bd7', accent: '#f5c518', plate: '#f5c518', emblem: '#c8102e', shape: 0, hair: '#1c1c22' }, // azul, vermelho e amarelo (Superman)
  { top: '#6b6f76', bottom: '#2a2b30', cape: '#1b1c20', boots: '#1b1c20', accent: '#e8b923', plate: '#e8b923', emblem: '#1b1c20', shape: 3, cowl: '#1b1c20', mask: '#1b1c20' },       // cinza e preto (Batman)
  { top: '#c8102e', bottom: '#c8102e', cape: null, boots: '#e8b923', gloves: '#c8102e', accent: '#e8b923', plate: '#ffffff', emblem: '#e8b923', shape: 1, cowl: '#c8102e' },               // vermelho e dourado, sem capa (Flash)
  { top: '#1f8a3b', bottom: '#1b1c20', arms: '#1b1c20', cape: null, boots: '#1f8a3b', gloves: '#ffffff', accent: '#1b1c20', plate: '#1b1c20', emblem: '#ffffff', ring: true, mask: '#1f8a3b' }, // verde e preto (Lanterna Verde)
  { top: '#c8102e', bottom: '#1f3fa6', cape: null, boots: '#c8102e', gloves: '#d4a52a', accent: '#d4a52a', plate: '#d4a52a', emblem: '#c8102e', shape: 2, hair: '#1c1c22', arms: '#f1c9a5' }, // vermelho, azul e dourado (Mulher-Maravilha)
  { top: '#e8812a', bottom: '#2f8f4e', cape: null, boots: '#2f8f4e', gloves: '#2f8f4e', accent: '#d4a52a', plate: '#d4a52a', emblem: '#2f8f4e', shape: 0, hair: '#d9a441' },              // laranja e verde (Aquaman)
];
const ARMOR_PALETTES = [
  { metal: '#b3202a', plate: '#d4a52a', helmet: '#b3202a', face: '#d4a52a', lens: '#f4fbff', core: '#bff4ff' },                     // vermelho e dourado (Homem de Ferro)
  { metal: '#1f3fa6', plate: '#c8102e', helmet: '#1f3fa6', face: '#1f3fa6', limbs: '#1f3fa6', lens: '#ffffff', core: '#ffffff', shield: true }, // azul, vermelho e branco (Capitão América)
  { metal: '#c8102e', plate: '#c8102e', limbs: '#1f3fa6', lens: '#ffffff', core: '#1b1c20', bigLens: true },                        // vermelho e azul (Homem-Aranha)
  { metal: '#1b1c20', plate: '#9aa0a8', helmet: '#1b1c20', face: '#1b1c20', lens: '#c9a7ff', core: '#b388ff' },                     // preto e prata (Pantera Negra)
  { metal: '#4f9a3a', plate: '#6a3d9a', helmet: '#4f9a3a', face: '#4f9a3a', limbs: '#4f9a3a', lens: '#e8ffd8', core: '#c6ff9e' },   // verde e roxo (Hulk)
  { metal: '#8d939c', plate: '#3a3f4a', helmet: '#c0c5cc', lens: '#bfe3ff', core: '#7fc8ff', cape: '#b3202a' },                     // prata com capa vermelha (Thor)
];
const pickPalette = (list, main, seed, palette) => Number.isInteger(palette) ? list[palette % list.length]
  : main ? list[0] : list[1 + (seed % (list.length - 1))];
export const HERO_COUNT = { capa: CAPE_PALETTES.length, armadura: ARMOR_PALETTES.length };

export function makeBuddy({ color, main = false, seed = 1, skin = 'classico', palette }) {
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body); // tudo que balança junto
  const R = .78;
  const eyes = [];
  let cape = null;

  const limb = (x, y, len, m, hand, r = .1) => {
    const pivot = new THREE.Group(); pivot.position.set(x, y, 0); body.add(pivot);
    add(pivot, new THREE.CapsuleGeometry(r, len, 4, 8), m, 0, -len / 2, 0);
    add(pivot, hand.geo, hand.mat, hand.x || 0, -len - .08, hand.z || 0);
    pivot.userData.len = len;
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
  const blinkEye = (ex, y, big, iris = true, z = R - .08) => {
    const eye = new THREE.Group(); eye.position.set(ex, y, z); body.add(eye);
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
    // ---------- herói de capa (cores inspiradas em heróis clássicos) ----------
    const P = pickPalette(CAPE_PALETTES, main, seed, palette);
    const top = mat(P.top), bottom = mat(P.bottom), accent = mat(P.accent, { metalness: .35, roughness: .35 });
    const extremity = mat(P.boots);
    add(body, new THREE.CapsuleGeometry(R, 1.1, 8, 24), mat('#f1c9a5'), 0, 1.85, 0); // rosto/pele
    add(body, new THREE.CylinderGeometry(R + .02, R + .02, .7, 24), top, 0, 1.73, 0);
    add(body, new THREE.CylinderGeometry(R + .02, R + .02, .38, 24), bottom, 0, 1.2, 0);
    add(body, new THREE.SphereGeometry(R + .02, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), bottom, 0, 1.03, 0);
    // capuz (cobre a cabeça até a máscara) ou cabelo
    if (P.cowl) add(body, new THREE.SphereGeometry(R + .035, 24, 12, 0, Math.PI * 2, 0, Math.PI * .44), mat(P.cowl), 0, 2.4, 0);
    else add(body, new THREE.SphereGeometry(R + .03, 24, 10, 0, Math.PI * 2, 0, Math.PI * .3), mat(P.hair || '#2b2320'), 0, 2.4, 0);
    add(body, new THREE.TorusGeometry(R + .03, .06, 8, 32), accent, 0, 1.4, 0).rotation.x = Math.PI / 2; // cinto
    if (P.mask) add(body, new THREE.CylinderGeometry(R + .035, R + .035, .32, 24, 1, true, -1.05, 2.1), mat(P.mask, { side: THREE.DoubleSide }), 0, 2.45, 0);
    for (const ex of [-.27, .27]) blinkEye(ex, 2.45, .72, false);
    smile();
    // emblema: forma geométrica sobre um fundo (nenhum símbolo oficial)
    const plate = add(body, new THREE.CircleGeometry(.3, 24), mat(P.plate), 0, 1.8, R + .025); plate.scale.y = P.ring ? 1 : .8;
    if (P.ring) add(body, new THREE.TorusGeometry(.18, .05, 8, 24), mat(P.emblem), 0, 1.8, R + .035);
    else add(body, emblemShape(P.shape ?? seed % 4), mat(P.emblem), 0, 1.8, R + .035);
    if (P.cape) { // capa (pivô nos ombros, presa nas costas)
      cape = new THREE.Group(); cape.position.set(0, 2.25, -R - .04); body.add(cape);
      const cs = new THREE.Shape(); cs.moveTo(-.55, 0); cs.lineTo(.55, 0); cs.lineTo(.85, -1.95); cs.quadraticCurveTo(0, -2.15, -.85, -1.95); cs.closePath();
      const capeMesh = add(cape, new THREE.ShapeGeometry(cs, 8), mat(P.cape, { side: THREE.DoubleSide }));
      capeMesh.rotation.y = Math.PI; capeMesh.position.z = -.02;
      add(body, new THREE.TorusGeometry(.6, .05, 6, 20, Math.PI), accent, 0, 2.27, -.2).rotation.set(Math.PI / 2, 0, 0); // fecho da capa
    }
    const glove = { geo: new THREE.SphereGeometry(.16, 12, 10), mat: mat(P.gloves || P.boots) };
    armL = limb(-R - .05, 1.9, .55, mat(P.arms || P.top), glove);
    armR = limb(R + .05, 1.9, .55, mat(P.arms || P.top), glove);
    legs(mat(P.legs || P.bottom), new THREE.BoxGeometry(.32, .3, .44), extremity, -.46);
  } else if (skin === 'armadura') {
    // ---------- herói de armadura (cores inspiradas em heróis clássicos) ----------
    const P = pickPalette(ARMOR_PALETTES, main, seed, palette);
    const metal = mat(P.metal, { metalness: .65, roughness: .3 });
    const plateM = mat(P.plate, { metalness: .75, roughness: .28 });
    const limbM = mat(P.limbs || P.metal, { metalness: .6, roughness: .32 });
    const glow = new THREE.MeshBasicMaterial({ color: P.lens });
    add(body, new THREE.CapsuleGeometry(R, 1.1, 8, 24), metal, 0, 1.85, 0);
    add(body, new THREE.SphereGeometry(R + .025, 24, 12, 0, Math.PI * 2, 0, Math.PI * .42), mat(P.helmet || P.plate, { metalness: .75, roughness: .28 }), 0, 2.4, 0); // topo do capacete
    add(body, new THREE.CylinderGeometry(R + .03, R + .03, .62, 24, 1, true, -1.15, 2.3), mat(P.face || P.plate, { metalness: .75, roughness: .28 }), 0, 2.3, 0); // máscara
    const lensW = P.bigLens ? 2.1 : 1.7, lensH = P.bigLens ? .9 : .55;
    for (const sd of [-1, 1]) { // visor: lentes
      const lens = new THREE.Mesh(new THREE.CircleGeometry(.14, 20), glow);
      lens.scale.set(lensW, lensH, 1); lens.position.set(sd * .28, 2.45, R + .045); lens.rotation.z = sd * -.22; body.add(lens);
    }
    for (const y of [1.2, 2.1]) add(body, new THREE.TorusGeometry(R + .02, .035, 6, 32), plateM, 0, y, 0).rotation.x = Math.PI / 2;
    const core = new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .05, 6), new THREE.MeshBasicMaterial({ color: P.core || '#bff4ff' })); // núcleo
    core.rotation.x = Math.PI / 2; core.position.set(0, 1.72, R + .02); body.add(core);
    add(body, new THREE.TorusGeometry(.22, .04, 6, 6), plateM, 0, 1.72, R + .03);
    for (const sd of [-1, 1]) add(body, new THREE.SphereGeometry(.3, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), plateM, sd * (R - .05), 2.05, 0); // ombreiras
    if (P.shield) { // escudo redondo nas costas (anéis, sem símbolo)
      const sh = new THREE.Group(); sh.position.set(0, 1.75, -R - .06); body.add(sh);
      [['#c0392b', .62], ['#ecf0f1', .46], ['#2c5aa0', .3]].forEach(([c, r], i) => {
        const d = add(sh, new THREE.CylinderGeometry(r, r, .06, 32), mat(c, { metalness: .5, roughness: .3 }), 0, 0, -i * .012);
        d.rotation.x = Math.PI / 2;
      });
    }
    if (P.cape) { // capa curta (ex.: o deus do trovão)
      cape = new THREE.Group(); cape.position.set(0, 2.2, -R - .05); body.add(cape);
      const cs = new THREE.Shape(); cs.moveTo(-.6, 0); cs.lineTo(.6, 0); cs.lineTo(.8, -1.8); cs.lineTo(-.8, -1.8); cs.closePath();
      add(cape, new THREE.ShapeGeometry(cs), mat(P.cape, { side: THREE.DoubleSide })).rotation.y = Math.PI;
    }
    const gauntlet = { geo: new THREE.BoxGeometry(.26, .26, .26), mat: plateM };
    armL = limb(-R - .05, 1.9, .55, limbM, gauntlet);
    armR = limb(R + .05, 1.9, .55, limbM, gauntlet);
    legs(limbM, new THREE.BoxGeometry(.34, .22, .46), plateM);
  } else if (skin === 'chefe') {
    // ---------- o chefe: musculoso (tronco em V), cabelo castanho curto, camisa social azul-clara ----------
    const skinM = mat('#efc3a0'), shirt = mat('#bcd4ef', { roughness: .7 }), pants = mat('#2f3440'), hairM = mat('#4b3527');
    // tronco em V: largo nos ombros, fino na cintura, achatado na frente
    const TOP = .98, BOT = .6, Y0 = 1.15, H = 1.2, DEPTH = .72;
    add(body, new THREE.CylinderGeometry(TOP, BOT, H, 28), shirt, 0, Y0 + H / 2, 0).scale.z = DEPTH;
    add(body, new THREE.SphereGeometry(TOP, 28, 12, 0, Math.PI * 2, 0, Math.PI / 2), shirt, 0, Y0 + H - .02, 0).scale.set(1, .28, DEPTH); // topo dos ombros
    for (const sd of [-1, 1]) {
      add(body, new THREE.SphereGeometry(.4, 18, 14), shirt, sd * .36, Y0 + H - .3, .38).scale.set(1, .78, .62); // peitoral
      add(body, new THREE.SphereGeometry(.38, 18, 14), shirt, sd * .9, Y0 + H - .1, 0); // deltoide
    }
    const frontZ = y => (BOT + (y - Y0) / H * (TOP - BOT)) * DEPTH + .01;
    for (let i = 0; i < 4; i++) { const y = Y0 + .2 + i * .22; add(body, new THREE.SphereGeometry(.032, 8, 6), mat('#eef3f9'), 0, y, frontZ(y)); } // botões
    add(body, new THREE.TorusGeometry(BOT + .02, .07, 8, 28), mat('#3b2a1f'), 0, Y0 + .05, 0).scale.set(1, 1, DEPTH); // cinto
    add(body, new THREE.CylinderGeometry(BOT + .01, .5, .45, 20), pants, 0, Y0 - .2, 0).scale.z = .85; // quadril
    // pescoço e cabeça (acima do tronco)
    const HY = Y0 + H + .55;
    add(body, new THREE.CylinderGeometry(.24, .3, .38, 16), skinM, 0, Y0 + H + .12, 0);
    for (const sd of [-1, 1]) { const c = add(body, new THREE.BoxGeometry(.24, .05, .2), mat('#d6e4f6'), sd * .16, Y0 + H + .02, .3); c.rotation.set(-.5, sd * .45, sd * -.3); } // colarinho
    add(body, new THREE.SphereGeometry(.5, 24, 18), skinM, 0, HY, 0).scale.set(.9, 1.08, .95);
    add(body, new THREE.SphereGeometry(.515, 24, 12, 0, Math.PI * 2, 0, Math.PI * .36), hairM, 0, HY + .06, -.03).scale.set(.92, 1.08, .97); // cabelo curto
    const quiff = add(body, new THREE.BoxGeometry(.46, .12, .26), hairM, 0, HY + .5, .17); quiff.rotation.x = -.35; // topete
    for (const sd of [-1, 1]) {
      add(body, new THREE.SphereGeometry(.09, 10, 8), skinM, sd * .46, HY, 0); // orelhas
      const brow = add(body, new THREE.BoxGeometry(.15, .035, .04), hairM, sd * .16, HY + .17, .44); brow.rotation.z = sd * -.12; // sobrancelhas
    }
    for (const ex of [-.16, .16]) blinkEye(ex, HY + .05, .36, true, .4);
    const grin = add(body, new THREE.TorusGeometry(.14, .03, 6, 16, Math.PI), mat('#ffffff'), 0, HY - .17, .43); grin.rotation.z = Math.PI; // sorriso largo
    // braços fortes
    const hand = { geo: new THREE.SphereGeometry(.19, 12, 10), mat: skinM };
    armL = limb(-1.12, Y0 + H - .12, .66, shirt, hand, .21);
    armR = limb(1.12, Y0 + H - .12, .66, shirt, hand, .21);
    legs(pants, new THREE.BoxGeometry(.34, .18, .48), mat('#5a3a24'));
    for (const lg of [legL, legR]) lg.scale.set(1.35, 1, 1.35);
    root.scale.setScalar(1.08);
  } else if (skin === 'seguranca') {
    // ---------- head de segurança: barba cheia, cabelo escuro, jaqueta puffer preta com capuz ----------
    const skinM = mat('#e8b896'), hairM = mat('#1f1814'), jacket = mat('#1d1e22', { roughness: .45 }), tee = mat('#f4f4f2');
    const Y0 = 1.1, H = 1.25;
    add(body, new THREE.CylinderGeometry(.82, .7, H, 26), jacket, 0, Y0 + H / 2, 0).scale.z = .82; // jaqueta
    for (let k = 0; k < 4; k++) { // gomos da puffer, abertos na frente (jaqueta aberta)
      const ring = new THREE.Group(); ring.rotation.x = Math.PI / 2; ring.position.set(0, Y0 + .18 + k * .3, 0); ring.scale.y = .82; body.add(ring);
      add(ring, new THREE.TorusGeometry(.81 - k * .03, .065, 8, 28, Math.PI * 2 - 1.1), jacket).rotation.z = Math.PI / 2 + .55;
    }
    for (const sd of [-1, 1]) add(body, new THREE.BoxGeometry(.1, H - .1, .08), jacket, sd * .26, Y0 + H / 2 + .02, .66); // bordas da jaqueta aberta
    add(body, new THREE.SphereGeometry(.82, 26, 10, 0, Math.PI * 2, 0, Math.PI / 2), jacket, 0, Y0 + H - .02, 0).scale.set(1, .3, .82); // ombros
    add(body, new THREE.BoxGeometry(.4, H - .15, .06), tee, 0, Y0 + H / 2 + .05, .64); // camiseta branca
    add(body, new THREE.BoxGeometry(.03, H - .15, .07), mat('#8a8f99', { metalness: .7, roughness: .3 }), -.2, Y0 + H / 2 + .05, .7); // zíper
    const hood = add(body, new THREE.TorusGeometry(.42, .16, 10, 20, Math.PI * 1.3), jacket, 0, Y0 + H + .08, -.1); hood.rotation.set(Math.PI / 2 + .25, 0, Math.PI * .85); // capuz
    // distintivo de segurança no peito (escudo)
    const sh = new THREE.Shape(); sh.moveTo(0, .13); sh.lineTo(.11, .08); sh.lineTo(.1, -.04); sh.quadraticCurveTo(.05, -.12, 0, -.15); sh.quadraticCurveTo(-.05, -.12, -.1, -.04); sh.lineTo(-.11, .08); sh.closePath();
    add(body, new THREE.ShapeGeometry(sh), mat('#e7b53a', { metalness: .6, roughness: .3 }), .4, Y0 + H - .35, .64).rotation.y = .3;
    add(body, new THREE.CylinderGeometry(.75, .62, .4, 20), mat('#2d3038'), 0, Y0 - .18, 0).scale.z = .85; // calça
    // pescoço e cabeça
    const HY = Y0 + H + .58;
    add(body, new THREE.CylinderGeometry(.22, .26, .32, 14), skinM, 0, Y0 + H + .14, 0);
    add(body, new THREE.SphereGeometry(.5, 24, 18), skinM, 0, HY, 0).scale.set(.92, 1.06, .95);
    // cabelo escuro, bagunçado no topo
    add(body, new THREE.SphereGeometry(.52, 24, 12, 0, Math.PI * 2, 0, Math.PI * .4), hairM, 0, HY + .05, -.03).scale.set(.94, 1.1, .98);
    for (let k = 0; k < 9; k++) { // mechas com volume, bagunçadas
      const a = (k / 9) * Math.PI * 2;
      const tuft = add(body, new THREE.SphereGeometry(.17, 10, 8), hairM, Math.sin(a) * .26, HY + .42 + (k % 3) * .04, Math.cos(a) * .2 + .02);
      tuft.scale.set(1, .7, 1.2); tuft.rotation.set(.4 * Math.cos(a), 0, -.4 * Math.sin(a));
    }
    // barba cheia: cobre o queixo e a mandíbula, mais o bigode
    // barba cheia: do queixo às costeletas, abaixo da boca; bigode por cima; lábios à mostra
    const beard = add(body, new THREE.SphereGeometry(.53, 26, 14, -Math.PI * .08, Math.PI * 1.16, Math.PI * .6, Math.PI * .36), hairM, 0, HY + .03, .02);
    beard.scale.set(.95, 1.2, 1.04);
    for (const sd of [-1, 1]) add(body, new THREE.BoxGeometry(.08, .3, .2), hairM, sd * .43, HY - .04, .14); // costeletas
    add(body, new THREE.BoxGeometry(.28, .06, .07), hairM, 0, HY - .09, .46); // bigode
    add(body, new THREE.BoxGeometry(.13, .04, .05), mat('#a86a55'), 0, HY - .155, .45); // lábios
    for (const sd of [-1, 1]) {
      add(body, new THREE.SphereGeometry(.09, 10, 8), skinM, sd * .47, HY, 0); // orelhas
      const brow = add(body, new THREE.BoxGeometry(.16, .045, .04), hairM, sd * .16, HY + .18, .44); brow.rotation.z = sd * .08; // sobrancelhas grossas
    }
    for (const ex of [-.16, .16]) blinkEye(ex, HY + .06, .34, true, .41);
    const hand = { geo: new THREE.SphereGeometry(.15, 12, 10), mat: skinM };
    armL = limb(-.92, Y0 + H - .12, .62, jacket, hand, .17);
    armR = limb(.92, Y0 + H - .12, .62, jacket, hand, .17);
    legs(mat('#2d3038'), new THREE.BoxGeometry(.32, .2, .46), mat('#e9e9e6')); // tênis brancos
    for (const lg of [legL, legR]) lg.scale.set(1.15, 1, 1.15);
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
        case 'Point': tgt.aRx = -1.45; tgt.aRz = -.1 + Math.sin(t * 12) * .14; tgt.bx = -.06; tgt.bry = .12; break; // bronca: dedo em riste
        case 'Drink': tgt.aRx = -2.05 * env; tgt.aRz = -.25 - .35 * env; tgt.bx = -.05 * env; break; // gole de café
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

  // caneca de café na mão direita
  let mug = null;
  function holdMug(on) {
    if (on && !mug) {
      mug = new THREE.Group();
      const y = -(armR.userData.len || .55) - .16;
      mug.position.set(.02, y, .16);
      add(mug, new THREE.CylinderGeometry(.11, .09, .2, 14), mat('#f4efe6'));
      add(mug, new THREE.CircleGeometry(.095, 14), mat('#5a3a24'), 0, .101, 0).rotation.x = -Math.PI / 2; // café
      add(mug, new THREE.TorusGeometry(.06, .018, 6, 12), mat('#f4efe6'), .12, 0, 0);
      armR.add(mug);
    } else if (!on && mug) { armR.remove(mug); mug = null; }
  }

  return {
    root, update, holdMug,
    play(name) { state = name; },
    emote(name) { if (!EMOTES[name]) return 0; emote = name; emoteT = 0; return EMOTES[name] * 1000; },
    get busy() { return !!emote; },
  };
}
