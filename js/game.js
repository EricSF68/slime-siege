// Slime Siege — battle simulation, rendering and in-battle input
'use strict';
(() => {
const { W, H, COLS, ROWS, TW, TH, BX, BY } = SS.CONST;
const U = SS.UNITS, SL = SS.SLIMES;
const tileX = c => BX + c * TW + TW / 2;
const tileY = r => BY + r * TH + TH / 2;
const groundY = r => BY + r * TH + TH - 14;
const DT = 1 / 60;
const WORLD_W = 1730;           // background is wider than the screen so the camera can pan to the containment hall
const PAN_X = WORLD_W - W;      // camera x when looking at the hall
SS.CONST.WORLD_W = WORLD_W;

class RNG {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() { let t = this.s += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  range(a, b) { return a + (b - a) * this.next(); }
  int(n) { return Math.floor(this.next() * n); }
  pick(a) { return a[this.int(a.length)]; }
}
SS.RNG = RNG;

// HUD layout (logical coords). The tray floats over the scenery band above the board.
const SLOT = { x: 120, y: 6, w: 68, h: 100, gap: 5 };
const toolX = SLOT.x + 10 * (SLOT.w + SLOT.gap) + 6;
const HUD = {
  energy: { x: 8, y: 6, w: 104, h: 100 },
  card0: SLOT,
  wrench: { x: toolX, y: 6, w: 62, h: 100 },
  grab: { x: toolX + 66, y: 6, w: 62, h: 100 },
  beam: { x: toolX + 132, y: 6, w: 62, h: 100 },
  speed: { x: 1112, y: 18, w: 72, h: 72 },
  pause: { x: 1194, y: 18, w: 72, h: 72 },
  progress: { x: W - 312, y: H - 46, w: 304, h: 40 },
  counter: { x: 8, y: H - 46, w: 150, h: 40 },
};
const TOOL_CD = { grab: 10, beam: 40 };
const T = s => (SS.TEXT && SS.TEXT[s] != null) ? SS.TEXT[s] : s;
const HC = Object.assign({ tray: 'rgba(10,16,28,0.72)', panel: '#1e2a40', accent: '#3ad0ff', card: '#24324d', cardSel: '#3b5a8a', border: '#4a5f88', tool: '#2a2433', btn: 'rgba(30,42,66,0.85)', tipBg: 'rgba(12,18,30,0.9)', tipText: '#e8f6ff', trayEdge: 'rgba(80,110,160,0.6)', label: '#9fe8ff', counter: '#d6f5d6', toolEdge: '#5a4a6a' }, SS.HUD_COLORS);
const IMPACT = SS.IMPACT || { bomb: 'KA-BLAM!', mine: 'SPLORT!', nuke: 'KA-THOOM!', cryoburst: 'KRSSSH!' };

class Battle {
  constructor(level, loadout, opts = {}) {
    this.level = level;
    this.opts = opts;
    this.rng = new RNG(opts.seed || (Date.now() & 0xffffffff));
    this.energy = level.startEnergy != null ? level.startEnergy : 50;
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.debris = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    this.scorch = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
    this.units = []; this.slimes = []; this.projs = []; this.pickups = []; this.fx = []; this.texts = []; this.preview = [];
    this.sweepers = Array.from({ length: ROWS }, (_, r) => ({ r, state: 'ready', x: BX - 62 }));
    this.time = 0; this.skyTimer = 4;
    this.waveIdx = -1; this.waveTimer = opts.firstWave != null ? opts.firstWave : SS.PACE.firstWave;
    this.trickleT = 9;
    this.totalWaves = level.waves;
    this.spawnQueue = [];
    this.selected = null;           // card index | 'wrench' | 'grab' | 'beam' | 'cap'
    this.held = null;               // robot lifted by the Grabber
    this.heldCap = null;            // scrap cap waiting to be bolted on
    this.toolCd = { grab: 0, beam: 0 };
    this.tools = { grab: !!opts.grabber, beam: !!opts.beam };
    this.pointer = { x: -1, y: -1, down: false, dragging: false, startX: 0, startY: 0, fromCard: false };
    this.banner = null;
    this.tip = null;
    this.stats = { kills: 0, placed: 0, fused: 0, lost: 0, removed: 0, energyCollected: 0, energySpent: 0, damage: 0, byUnit: {} };
    this.waveHp = 0;
    this.trophy = null;
    this.endFx = null;
    this.uid = 1;
    this.kingSpawned = false;
    this.camX = 0;
    this.setCards(loadout);
    if (level.debris) this.placeDebris(level.debris);
    if (opts.intro) this.beginIntro(opts.intro);
    else this.startPlay();
  }

  // ---------- setup / intro ----------
  setCards(loadout) {
    const seen = {};
    this.cards = loadout.map(id => {
      const dup = !!seen[id]; seen[id] = true;
      const base = U[id].cost;
      return { id, dup, cost: dup ? base * 2 : base, cd: U[id].cd >= 30 ? U[id].cd * 0.6 : 0, cdMax: U[id].cd };
    });
  }
  placeDebris(n) {
    let guard = 100;
    while (n > 0 && guard-- > 0) {
      const r = this.rng.int(ROWS), c = 3 + this.rng.int(COLS - 3);
      if (!this.debris[r][c]) { this.debris[r][c] = 1; n--; }
    }
  }
  beginIntro(mode) {
    this.state = 'intro';
    this.camX = PAN_X;
    this.introT = 0;
    this.introMode = mode;                   // 'loadout' waits for go(); 'auto' pans back after a short hold
    const types = [...new Set(this.level.types.concat(this.level.boss ? ['king'] : []))];
    types.forEach((t, i) => {
      const king = t === 'king';
      const slot = [[0, 2], [1, 3], [2, 2], [0, 4], [1, 1], [2, 4], [3, 3], [0, 1], [2, 1], [3, 2], [3, 4], [1, 4]][i % 12];
      this.preview.push({ type: t, def: SL[t], x: king ? WORLD_W - 170 : 1300 + slot[0] * 120 + (slot[1] % 2) * 30, row: king ? 2 : slot[1], phase: i * 1.7,
        armor: SL[t].armor || 0, front: SL[t].front || 0 });
    });
  }
  go() {                                     // called when the player presses Defend!
    if (this.state !== 'intro') return;
    this.state = 'panback'; this.introT = 0;
  }
  startPlay() {
    this.state = 'play';
    this.camX = 0;
    this.preview = [];
    if (this.level.tip) this.tip = { text: this.level.tip, t: 10 };
  }

  // ---------- helpers ----------
  showBanner(text, t = 3, color = '#fff', big = false) { this.banner = { text, t, max: t, color, big }; }
  floatText(x, y, text, color = '#fff', size = 22) { this.texts.push({ x, y, text, color, life: 1, size }); }
  isFlag(i) { return !this.level.endless ? ((i + 1) % 5 === 0 || i === this.totalWaves - 1) : ((i + 1) % 5 === 0); }
  slimeRows(s) { return s.def.boss ? [s.row - 1, s.row, s.row + 1] : [s.row]; }
  inRow(s, r) { return s.def.boss ? Math.abs(s.row - r) <= 1 : s.row === r; }
  liveCount() { return this.slimes.filter(s => !s.dead).length + this.spawnQueue.length; }
  diffMul() { return this.opts.difficulty != null ? this.opts.difficulty : SS.difficultyMul(); }

  // ---------- waves ----------
  composeWave(i) {
    const L = this.level;
    let budget = (L.base + L.inc * i) * SS.PACE.budget;
    if (this.isFlag(i)) budget = budget * (L.flagMul || 1.7) + 3;
    if (L.endless) budget *= 1 + i * 0.03;
    budget *= this.diffMul();
    budget = Math.max(1, Math.floor(budget));
    const out = [];
    if (L.intro && i >= 1 && i <= 3 && SL[L.intro].cost <= budget) { out.push(L.intro); budget -= SL[L.intro].cost; }
    let brutes = 0; const maxBrutes = i < 3 ? 0 : Math.min(4, Math.floor(i / 4) + 1);
    let guard = 400;
    while (budget >= 1 && guard-- > 0) {
      const cands = L.types.filter(t => SL[t].cost <= budget && (t !== 'brute' || brutes < maxBrutes));
      if (!cands.length) break;
      let tot = 0; for (const t of cands) tot += SS.WEIGHTS[t] || 1;
      let r = this.rng.next() * tot, pick = cands[0];
      for (const t of cands) { r -= SS.WEIGHTS[t] || 1; if (r <= 0) { pick = t; break; } }
      if (pick === 'brute') brutes++;
      out.push(pick); budget -= SL[pick].cost;
    }
    return out;
  }
  startWave() {
    this.waveIdx++;
    const i = this.waveIdx;
    const flag = this.isFlag(i);
    const final = !this.level.endless && i === this.totalWaves - 1;
    let list = this.composeWave(i);
    if (final && this.level.boss) list = this.composeWave(Math.max(0, i - 4));
    const spread = flag ? 6 + list.length * 0.12 : 3 + list.length * 0.15;
    let hp = 0;
    list.forEach((type, k) => {
      const row = this.rng.int(ROWS);
      this.spawnQueue.push({ type, row, delay: (k / Math.max(1, list.length)) * spread + this.rng.range(0, 0.6), wave: i });
      hp += SL[type].hp + (SL[type].armor || 0) + (SL[type].front || 0);
    });
    if (final && this.level.boss && !this.kingSpawned) {
      this.spawnQueue.push({ type: 'king', row: 2, delay: 2, wave: i });
      this.kingSpawned = true;
      hp += SL.king.hp;
      SS.Audio.playMusic('boss');
    }
    this.waveHp = hp;
    if (final) { this.showBanner(this.level.boss ? T('KING GLOOP APPROACHES!') : T('FINAL WAVE'), 3.5, '#ff5a5a'); SS.Audio.play('finalWave'); }
    else if (flag) { this.showBanner(T('A HUGE SLIME SURGE IS COMING!'), 3, '#ff5a5a'); SS.Audio.play('surge'); }
    else if (i === 0) SS.Audio.play('surge');
    this.waveTimer = flag ? SS.PACE.flagWave : SS.PACE.wave;
  }
  spawnSlime(type, row, x) {
    const d = SL[type];
    const s = {
      id: this.uid++, type, def: d, row, x: x != null ? x : W + 30 + this.rng.range(0, 60),
      hp: d.hp, maxHp: d.hp, armor: d.armor || 0, maxArmor: d.armor || 0, front: d.front || 0,
      slowT: 0, freezeT: 0, eating: false, hopped: false, hop: null, shift: null,
      smashT: d.smash || 0, flash: 0, dead: false, dieT: 0, phase: this.rng.range(0, 6), chompT: 0,
      summonT: 12, gooT: 8, spitT: 1.5, enraged: false,
    };
    this.slimes.push(s);
    return s;
  }

  // ---------- placement ----------
  cellAt(x, y) {
    const c = Math.floor((x - BX) / TW), r = Math.floor((y - BY) / TH);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
    return { r, c };
  }
  blocked(r, c) { return this.debris[r][c] ? 'debris' : this.scorch[r][c] > 0 ? 'scorch' : null; }
  fusionFor(aId, bId) {
    const res = SS.FUSIONS[SS.fkey(aId, bId)];
    if (!res) return null;
    return { result: res, locked: SS.fusionLocked(res) };
  }
  placeCheck(ci, r, c) {
    const card = this.cards[ci]; if (!card) return { ok: false, why: 'nocard' };
    if (card.cd > 0) return { ok: false, why: 'cooldown' };
    if (this.energy < card.cost) return { ok: false, why: 'energy' };
    const cur = this.grid[r][c];
    const feature = SS.UNITS[card.id] && SS.UNITS[card.id].feature;   // themed upgrade cards only go onto a unit
    if (!cur && feature) return { ok: false, why: 'feature' };
    if (!cur) { const b = this.blocked(r, c); return b ? { ok: false, why: b } : { ok: true, mode: 'place' }; }
    if (card.id === 'crate') return { ok: false, why: 'occupied' };
    const f = this.fusionFor(cur.id, card.id);
    const canRepair = card.id === 'bulwark' && cur.def.parts.body === 'wall' && cur.hp < cur.maxHp;
    if (f && f.locked) return canRepair ? { ok: true, mode: 'repair' } : { ok: false, why: 'locked', result: f.result };
    if (f) return { ok: true, mode: 'fuse', result: f.result };
    if (canRepair) return { ok: true, mode: 'repair' };
    return { ok: false, why: feature ? 'nofuse' : 'occupied' };
  }
  place(ci, r, c) {
    const chk = this.placeCheck(ci, r, c);
    if (!chk.ok) { this.reject(chk, r, c); return false; }
    const card = this.cards[ci];
    this.energy -= card.cost; this.stats.energySpent += card.cost; card.cd = card.cdMax;
    if (chk.mode === 'fuse') this.doFuse(this.grid[r][c], chk.result, r, c);
    else if (chk.mode === 'repair') {
      const u = this.grid[r][c]; u.hp = u.maxHp; u.flash = 0.2;
      SS.Audio.play('place'); this.floatText(u.x, u.y - 50, T('REPAIRED'), '#7dff8a');
    } else {
      this.addUnit(card.id, r, c);
      SS.Audio.play('place');
      for (let i = 0; i < 8; i++) this.fx.push({ k: 'p', x: tileX(c) + this.rng.range(-30, 30), y: groundY(r), vx: this.rng.range(-40, 40), vy: this.rng.range(-80, -20), life: 0.4, max: 0.4, color: '#9aa', size: 3 });
    }
    this.stats.placed++;
    this.selected = null;
    return true;
  }
  reject(chk, r, c) {
    SS.Audio.play('invalid');
    if (chk.why === 'energy') this.flashEnergy = 0.6;
    if (chk.why === 'locked') this.floatText(tileX(c), tileY(r) - 40, T('Locked: clear Level 9'), '#c9d1e0', 18);
    if (chk.why === 'debris') this.floatText(tileX(c), tileY(r) - 40, T('Clear the scrap first'), '#c9d1e0', 18);
    if (chk.why === 'feature') this.floatText(tileX(c), tileY(r) - 40, T('Place this on a robot'), '#c9d1e0', 18);
    if (chk.why === 'nofuse') this.floatText(tileX(c), tileY(r) - 40, T('No fusion'), '#c9d1e0', 18);
    if (chk.why === 'scorch') this.floatText(tileX(c), tileY(r) - 40, T('Too hot to build'), '#ffb070', 18);
  }
  doFuse(old, result, r, c, extra) {
    this.removeUnit(old, true);
    if (extra) this.removeUnit(extra, true);
    const u = this.addUnit(result, r, c);
    if (old.armor) { u.armor = old.armor; u.maxArmor = old.maxArmor; }
    this.stats.fused++;
    SS.Audio.play('fuse');
    for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; this.fx.push({ k: 'p', x: tileX(c), y: tileY(r), vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, life: 0.6, max: 0.6, color: i % 2 ? '#ffd84a' : '#fff', size: 4 }); }
    this.fx.push({ k: 'ring', x: tileX(c), y: tileY(r), life: 0.5, max: 0.5, color: '#ffd84a', r0: 10, r1: 70 });
    this.floatText(tileX(c), tileY(r) - 50, U[result].name + '!', '#ffd84a');
    if (SS.onDiscover) SS.onDiscover(result);
  }
  addUnit(id, r, c) {
    const d = U[id];
    const u = { uid: this.uid++, id, def: d, r, c, x: tileX(c), y: tileY(r), hp: d.hp, maxHp: d.hp, armor: 0, maxArmor: 0, t: 0, flash: 0, fireT: 0, prodGlow: 0, phase: this.rng.range(0, 6),
      beh: d.beh.map(b => ({ ...b, timer: b.t === 'produce' ? (b.first || b.rate) : b.t === 'crate' ? b.open : (b.t === 'shoot' ? 0.4 : b.rate * 0.5), armT: 0, fuseT: b.fuse || 0 })) };
    this.grid[r][c] = u; this.units.push(u);
    return u;
  }
  removeUnit(u, silent, why) {
    if (!u || u.removed) return;
    u.removed = true;
    if (this.held === u) { this.held = null; }
    if (this.grid[u.r][u.c] === u) this.grid[u.r][u.c] = null;
    this.units = this.units.filter(x => x !== u);
    if (!silent) {
      if (why === 'wrench') this.stats.removed++; else this.stats.lost++;
      SS.Audio.play('unitDie');
      for (let i = 0; i < 12; i++) this.fx.push({ k: 'p', x: u.x + this.rng.range(-20, 20), y: u.y + this.rng.range(-20, 20), vx: this.rng.range(-120, 120), vy: this.rng.range(-200, -40), g: 500, life: 0.7, max: 0.7, color: i % 2 ? '#8892a6' : '#444b58', size: 4 });
    }
  }
  hurtUnit(u, dmg) {
    if (u.removed) return;
    if (u.armor > 0) {
      const a = Math.min(u.armor, dmg); u.armor -= a; dmg -= a;
      if (u.armor <= 0) { u.armor = 0; SS.Audio.play('shieldBreak'); this.fx.push({ k: 'debris', x: u.x, y: u.y - 40, vx: -60, vy: -220, rot: 0, vr: -7, life: 1, max: 1, w: 30, h: 14, color: '#9aa4b2' }); }
    }
    u.hp -= dmg; u.flash = Math.max(u.flash, 0.06);
    if (u.hp <= 0) this.removeUnit(u);
  }
  wrench(r, c) {
    const u = this.grid[r][c];
    if (u) { this.removeUnit(u, false, 'wrench'); this.selected = null; return true; }
    if (this.debris[r][c]) {
      if (this.energy < 25) { this.flashEnergy = 0.6; SS.Audio.play('invalid'); this.floatText(tileX(c), tileY(r) - 40, T('Clearing scrap costs 25'), '#ffb070', 18); return false; }
      this.energy -= 25; this.stats.energySpent += 25;
      this.debris[r][c] = 0; SS.Audio.play('unitDie'); this.selected = null;
      for (let i = 0; i < 14; i++) this.fx.push({ k: 'p', x: tileX(c) + this.rng.range(-25, 25), y: tileY(r), vx: this.rng.range(-140, 140), vy: this.rng.range(-240, -60), g: 600, life: 0.7, max: 0.7, color: i % 2 ? '#7a6248' : '#4a3a2a', size: 5 });
      return true;
    }
    SS.Audio.play('invalid'); return false;
  }

  // ---------- grabber / beam / caps ----------
  grabAt(r, c) {
    const u = this.grid[r][c];
    if (!this.held) {
      if (!u || u.beh.some(b => b.t === 'bomb' || b.t === 'crate')) { SS.Audio.play('invalid'); return false; }
      this.held = u; SS.Audio.play('select'); return true;
    }
    const h = this.held;
    if (u === h) { this.held = null; return false; }             // dropped back where it was
    if (!u) {
      const b = this.blocked(r, c); if (b) { this.reject({ why: b }, r, c); return false; }
      this.grid[h.r][h.c] = null; h.r = r; h.c = c; h.x = tileX(c); h.y = tileY(r); this.grid[r][c] = h;
      SS.Audio.play('place');
    } else {
      const f = this.fusionFor(h.id, u.id);
      if (!f) { SS.Audio.play('invalid'); this.floatText(u.x, u.y - 40, T('No fusion'), '#c9d1e0', 18); return false; }
      if (f.locked) { this.reject({ why: 'locked' }, r, c); return false; }
      this.doFuse(u, f.result, r, c, h);
    }
    this.held = null; this.selected = null; this.toolCd.grab = TOOL_CD.grab;
    return true;
  }
  slimeAt(x, y) {
    let best = null, bd = 60;
    for (const s of this.slimes) {
      if (s.dead || s.def.boss) continue;
      const d = Math.hypot(s.x - x, (groundY(s.row) - 30) - y);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }
  beamAt(x, y) {
    const s = this.slimeAt(x, y);
    if (!s) { SS.Audio.play('invalid'); return false; }
    const opts = [s.row - 1, s.row + 1].filter(r => r >= 0 && r < ROWS);
    const load = r => this.slimes.filter(z => !z.dead && z.row === r).length;
    opts.sort((a, b) => load(a) - load(b) || this.rng.next() - 0.5);
    const to = opts[0];
    s.shift = { from: s.row, t: 0 }; s.row = to; s.hop = null;
    SS.Audio.play('zap');
    this.fx.push({ k: 'beam', x: s.x, y1: BY - 10, y2: groundY(to) - 30, life: 0.5, max: 0.5 });
    this.selected = null; this.toolCd.beam = TOOL_CD.beam;
    return true;
  }
  capAt(r, c) {
    const u = this.grid[r][c];
    if (!u || u.def.fusion || u.armor > 0 || u.beh.some(b => b.t === 'bomb' || b.t === 'crate')) {
      SS.Audio.play('invalid');
      this.floatText(tileX(c), tileY(r) - 40, u && u.def.fusion ? T('Caps fit basic robots only') : T('Pick a basic robot'), '#c9d1e0', 18);
      return false;
    }
    u.armor = u.maxArmor = this.heldCap.val; u.capKind = this.heldCap.kind;
    this.heldCap = null; this.selected = null;
    SS.Audio.play('armorHit'); this.floatText(u.x, u.y - 50, T('+ARMOR'), '#c9d1e0');
    return true;
  }

  // ---------- damage ----------
  damage(s, dmg, kind, src) {
    if (s.dead) return;
    s.flash = 0.08;
    let dealt = 0;
    if (kind === 'bolt' && s.front > 0) {
      dealt = Math.min(s.front, dmg); s.front -= dmg; SS.Audio.play('armorHit');
      if (s.front <= 0) { s.front = 0; SS.Audio.play('shieldBreak'); this.fx.push({ k: 'debris', x: s.x - 40, y: groundY(s.row) - 30, vx: 60, vy: -200, rot: 0, vr: 6, life: 1, max: 1, w: 14, h: 40, color: '#9aa6b4' }); }
      this.credit(src, dealt);
      return;
    }
    if (s.armor > 0) {
      const a = Math.min(s.armor, dmg); s.armor -= a; dmg -= a; dealt += a;
      SS.Audio.play('armorHit');
      if (s.armor <= 0) this.armorBroke(s);
    }
    if (dmg > 0) { dealt += Math.min(Math.max(0, s.hp), dmg); s.hp -= dmg; if (kind !== 'flame' && kind !== 'zap') SS.Audio.play('hit'); }
    this.credit(src, dealt);
    if (s.hp <= 0) this.kill(s, kind);
  }
  credit(src, amt) {
    if (!amt) return;
    this.stats.damage += amt;
    if (src) this.stats.byUnit[src] = (this.stats.byUnit[src] || 0) + amt;
  }
  armorBroke(s) {
    const metal = s.type === 'iron' ? '#8f9aa8' : s.type === 'hothead' ? '#7d8796' : '#b0a090';
    this.fx.push({ k: 'debris', x: s.x, y: groundY(s.row) - 50 * s.def.size, vx: 80, vy: -260, rot: 0, vr: 8, life: 1, max: 1, w: 34, h: 16, color: metal });
    if (s.def.enrage) {
      s.enraged = true; this.floatText(s.x, groundY(s.row) - 80, T('BOIL!'), '#ff7a4a');
      SS.Audio.play('flame');
    }
    if (s.type === 'capped' || s.type === 'iron') {
      this.pickups.push({ kind: 'cap', cap: s.type, val: s.type === 'iron' ? 600 : 250, x: s.x, y: groundY(s.row) - 20, ty: groundY(s.row) - 16, vy: -180, vx: -30, life: 14, t: 0 });
    }
  }
  kill(s, kind) {
    if (s.dead) return;
    s.dead = true; s.dieT = 0; this.stats.kills++;
    s.husk = kind === 'explode' && !s.def.boss;
    this.lastKillPos = { x: s.x, y: tileY(s.row) };
    SS.Audio.play('slimeDie');
    if (!s.husk) for (let i = 0; i < 10; i++) this.fx.push({ k: 'p', x: s.x + this.rng.range(-20, 20), y: groundY(s.row) - 20, vx: this.rng.range(-140, 140), vy: this.rng.range(-220, -60), g: 600, life: 0.6, max: 0.6, color: s.def.color, size: 5 });
    if (s.def.split) for (let k = 0; k < s.def.split; k++) { const m = this.spawnSlime('mini', s.row, s.x + (k ? 26 : -10)); m.hopped = true; }
    if (s.def.boss) { this.slimes.filter(z => !z.dead && z !== s).forEach(z => this.kill(z)); this.spawnQueue = []; this.explode(s.x, tileY(s.row), 0, 0, null, true); }
    if (s.type === 'brute') this.fx.push({ k: 'shake', life: 0.3, max: 0.3, mag: 6 });
  }
  explode(cx, cy, r, dmg, freeze, visualOnly, srcId) {
    SS.Audio.play('explode');
    this.fx.push({ k: 'ring', x: cx, y: cy, life: 0.5, max: 0.5, color: freeze ? '#9fe8ff' : '#ffb040', r0: 10, r1: Math.max(80, r * TW) });
    this.fx.push({ k: 'flash', x: cx, y: cy, life: 0.25, max: 0.25, rad: Math.max(90, r * TW * 1.1), cold: !!freeze });
    this.fx.push({ k: 'shake', life: 0.35, max: 0.35, mag: 8 });
    if (!visualOnly && r >= 1.5) this.fx.push({ k: 'cloud', x: cx, y: cy, life: 1.4, max: 1.4, s: r / 1.5, cold: !!freeze });
    if (srcId && IMPACT[srcId]) this.fx.push({ k: 'word', x: cx, y: cy - 40, text: IMPACT[srcId], life: 1.1, max: 1.1, color: freeze ? '#bff4ff' : '#ffe36a' });
    for (let i = 0; i < 30; i++) { const a = this.rng.range(0, 6.28), sp = this.rng.range(80, 380); this.fx.push({ k: 'p', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, g: 300, life: 0.8, max: 0.8, color: freeze ? ['#e0faff', '#9fe8ff', '#5ab8e0', '#fff'][i % 4] : ['#ffe36a', '#ff9a2a', '#ff5a2a', '#555'][i % 4], size: 6 }); }
    if (visualOnly) return;
    // scorch plate under heavy blasts (not freeze bombs)
    if (!freeze && (srcId === 'bomb' || srcId === 'nuke')) {
      const cell = this.cellAt(cx, cy);
      if (cell) this.scorch[cell.r][cell.c] = 20;
    }
    const rows = Math.floor(r + 0.001);
    const crow = Math.round((cy - BY - TH / 2) / TH);
    for (const s of this.slimes) {
      if (s.dead) continue;
      const rowHit = s.def.boss ? this.slimeRows(s).some(rr => Math.abs(rr - crow) <= rows) : Math.abs(s.row - crow) <= rows;
      if (rowHit && Math.abs(s.x - cx) <= r * TW + 20 * s.def.size) this.damage(s, dmg, 'explode', srcId);
    }
    if (freeze) {
      SS.Audio.play('freeze');
      for (const s of this.slimes) if (!s.dead) { s.freezeT = Math.max(s.freezeT, freeze); s.slowT = Math.max(s.slowT, freeze + 6); }
      this.fx.push({ k: 'frost', life: 1, max: 1 });
    }
  }

  // ---------- targeting ----------
  firstAhead(r, x) {
    let best = null;
    for (const s of this.slimes) if (!s.dead && this.inRow(s, r) && s.x > x - 20 && s.x < W + 10 && (!best || s.x < best.x)) best = s;
    return best;
  }
  anyAhead(r, x, maxX) {
    for (const s of this.slimes) if (!s.dead && this.inRow(s, r) && s.x > x - 20 && s.x < Math.min(W + 10, maxX)) return true;
    return false;
  }
  nearestRobotAhead(s, maxDist) {
    let best = null;
    for (let c = COLS - 1; c >= 0; c--) {
      const u = this.grid[s.row][c];
      if (u && u.x < s.x && s.x - u.x <= maxDist) { best = u; break; }
    }
    return best;
  }

  // ---------- update ----------
  update(dt) {
    if (this.state === 'intro' || this.state === 'panback' || this.state === 'countdown') { this.updateIntro(dt); this.updateFx(dt); return; }
    if (this.endFx) { this.updateEnd(dt); this.updateFx(dt); return; }
    if (this.state !== 'play' && this.state !== 'clear') { this.updateFx(dt); return; }
    this.time += dt;
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    if (this.tip) { this.tip.t -= dt; if (this.tip.t <= 0) this.tip = null; }
    if (this.flashEnergy > 0) this.flashEnergy -= dt;
    for (const c of this.cards) if (c.cd > 0) c.cd = Math.max(0, c.cd - dt);
    for (const k in this.toolCd) if (this.toolCd[k] > 0) this.toolCd[k] = Math.max(0, this.toolCd[k] - dt);
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.scorch[r][c] > 0) this.scorch[r][c] = Math.max(0, this.scorch[r][c] - dt);

    if (this.state === 'play') {
      // energy from above
      this.skyTimer -= dt;
      if (this.skyTimer <= 0) {
        const [a, b] = SS.PACE.sky;
        this.skyTimer = this.rng.range(a, b) * (this.level.night ? SS.PACE.nightSky : 1);
        const x = this.rng.range(BX + 40, BX + COLS * TW - 40);
        this.pickups.push({ kind: 'energy', x, y: BY + 4, ty: this.rng.range(BY + 60, BY + ROWS * TH - 40), vy: 80, val: 25, life: 10, sky: true, t: 0 });
      }
      // waves
      const more = this.level.endless || this.waveIdx < this.totalWaves - 1;
      if (more) {
        this.waveTimer -= dt;
        if (this.waveIdx >= 0 && this.spawnQueue.length === 0) {
          const live = this.slimes.filter(s => !s.dead && !s.def.boss);
          const rem = live.reduce((a, s) => a + s.hp + s.armor + s.front, 0);
          if (live.length === 0 && this.waveTimer > 4) this.waveTimer = 4;
          else if (rem < this.waveHp * 0.3 && this.waveTimer > 6) this.waveTimer = 6;
        }
        if (this.waveTimer <= 0) this.startWave();
        // stragglers between waves
        if (this.waveIdx >= 0) {
          this.trickleT -= dt;
          if (this.trickleT <= 0) {
            const [a, b] = SS.PACE.trickle;
            this.trickleT = this.rng.range(a, b) / Math.max(0.6, this.diffMul());
            const cheap = this.level.types.filter(t => SL[t].cost <= 2);
            if (cheap.length) this.spawnQueue.push({ type: this.rng.pick(cheap), row: this.rng.int(ROWS), delay: 0, wave: this.waveIdx });
          }
        }
      }
      for (const q of this.spawnQueue) q.delay -= dt;
      const ready = this.spawnQueue.filter(q => q.delay <= 0);
      if (ready.length) { this.spawnQueue = this.spawnQueue.filter(q => q.delay > 0); for (const q of ready) this.spawnSlime(q.type, q.row); }
      // win check
      if (!this.level.endless && this.waveIdx === this.totalWaves - 1 && this.spawnQueue.length === 0 && this.slimes.every(s => s.dead)) {
        this.state = 'clear';
        const last = this.lastKillPos || { x: W / 2, y: H / 2 };
        this.trophy = { x: Math.min(Math.max(last.x, BX + 60), BX + COLS * TW - 60), y: Math.min(Math.max(last.y, BY + 60), BY + ROWS * TH - 60), t: 0 };
        SS.Audio.play('collect');
      }
    }
    if (this.state === 'clear' && this.trophy) {
      this.trophy.t += dt;
      if (this.trophy.t > (this.opts.autoTrophy ? 0.5 : 6)) this.collectTrophy();
    }

    this.updateUnits(dt);
    this.updateSlimes(dt);
    this.updateProjs(dt);
    this.updatePickups(dt);
    this.updateSweepers(dt);
    this.updateFx(dt);
  }
  updateIntro(dt) {
    this.introT += dt;
    if (this.state === 'intro' && this.introMode === 'auto' && this.introT > 2.2) this.go();
    if (this.state === 'panback') {
      const k = Math.min(1, this.introT / 1.0);
      const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.camX = PAN_X * (1 - e);
      if (k >= 1) { this.state = 'countdown'; this.introT = 0; this.camX = 0; this.preview = []; SS.Audio.play('select'); }
    }
    if (this.state === 'countdown') {
      const beats = [0.55, 1.1, 1.8];
      const prev = this._beat || 0;
      const beat = beats.findIndex(b => this.introT < b);
      const cur = beat < 0 ? 3 : beat;
      if (cur !== prev && cur < 3) SS.Audio.play('select');
      this._beat = cur;
      if (this.introT >= beats[2]) { this._beat = 0; SS.Audio.play('start'); this.startPlay(); }
    }
  }
  skipIntro() {
    if (this.state === 'panback' || this.state === 'countdown') { this._beat = 0; this.startPlay(); }
  }

  updateUnits(dt) {
    for (const u of this.units.slice()) {
      if (u.removed) continue;
      u.t += dt; if (u.flash > 0) u.flash -= dt; if (u.fireT > 0) u.fireT -= dt; if (u.prodGlow > 0) u.prodGlow -= dt;
      for (const b of u.beh) {
        switch (b.t) {
          case 'shoot': {
            b.timer -= dt;
            if (b.timer <= 0 && this.anyAhead(u.r, u.x, W + 10)) {
              b.timer = b.rate;
              for (let i = 0; i < b.shots; i++) this.projs.push({ k: b.bolt, r: u.r, src: u.id, x: u.x + 46, y: u.y - (u.def.parts.body === 'wall' ? 18 : 0) + 2 + (b.shots > 1 ? (i % 2 ? 4 : -4) : 0), vx: 560, dmg: b.dmg, splash: b.splash || 0, sr: b.sr || 0, delay: i * 0.13, hit: new Set() });
              u.fireT = 0.1; SS.Audio.play('shoot');
            }
            break;
          }
          case 'produce': {
            b.timer -= dt;
            if (b.timer <= 0) {
              b.timer = b.rate * this.rng.range(0.95, 1.05);
              this.pickups.push({ kind: 'energy', x: u.x + this.rng.range(-20, 20), y: u.y - 20, ty: u.y + this.rng.range(0, 30), vy: -160, vx: this.rng.range(-50, 50), val: b.val, life: 10, sky: false, t: 0 });
              u.prodGlow = 0.6;
            }
            break;
          }
          case 'mine': b.armT += dt; break;
          case 'bomb': {
            b.fuseT -= dt;
            if (b.fuseT <= 0) { this.removeUnit(u, true); this.explode(u.x, u.y, b.r, b.dmg, b.freeze, false, u.id); }
            break;
          }
          case 'crate': {
            b.timer -= dt;
            if (b.timer <= 0) this.openCrate(u);
            break;
          }
          case 'lob': {
            b.timer -= dt;
            if (b.timer <= 0) {
              const tgt = this.firstAhead(u.r, u.x);
              if (tgt) {
                b.timer = b.rate;
                const flight = 1.0;
                const sp = this.slimeSpeed(tgt);
                const tx = Math.max(u.x + 40, tgt.x - sp * flight);
                this.projs.push({ k: 'lob', r: u.r, src: u.id, x0: u.x - 10, y0: u.y - 40, x: u.x - 10, y: u.y - 40, tx, ty: groundY(u.r) - 25, t: 0, flight, dmg: b.dmg, splash: b.splash, sr: b.sr, slow: b.slow, fire: b.fire, target: tgt });
                SS.Audio.play('lob'); u.fireT = 0.15;
              }
            }
            break;
          }
          case 'flame': {
            b.timer -= dt;
            if (b.timer <= 0) {
              const maxX = u.x + b.range * TW + 50;
              if (this.anyAhead(u.r, u.x, maxX)) {
                b.timer = b.rate;
                for (const s of this.slimes) if (!s.dead && this.inRow(s, u.r) && s.x > u.x - 20 && s.x < maxX) { this.damage(s, b.dmg, 'flame', u.id); if (b.slow) s.slowT = Math.max(s.slowT, 4); }
                this.fx.push({ k: 'flame', x1: u.x + 40, x2: maxX, y: u.y + 2, life: 0.45, max: 0.45, steam: !!b.slow });
                SS.Audio.play('flame'); u.fireT = 0.3;
              }
            }
            break;
          }
          case 'zap': {
            b.timer -= dt;
            if (b.timer <= 0) {
              const cands = [];
              for (const s of this.slimes) {
                if (s.dead || s.x > W + 10) continue;
                let best = Infinity;
                for (const rr of this.slimeRows(s)) { const dd = Math.hypot((s.x - u.x) / TW, (tileY(rr) - u.y) / TH); best = Math.min(best, dd); }
                if (best <= b.r) cands.push([best, s]);
              }
              if (cands.length) {
                b.timer = b.rate;
                cands.sort((a, b2) => a[0] - b2[0]);
                let px = u.x, py = u.y - (u.def.parts.body === 'tall' ? 62 : 44);
                for (const [, s] of cands.slice(0, b.n)) {
                  const sy = s.def.boss ? tileY(s.row) : groundY(s.row) - 30 * s.def.size;
                  this.fx.push({ k: 'bolt', x1: px, y1: py, x2: s.x, y2: sy, life: 0.25, max: 0.25 });
                  px = s.x; py = sy;
                  this.damage(s, b.dmg, 'zap', u.id);
                }
                if (b.n >= 6 && this.rng.next() < 0.25) this.fx.push({ k: 'word', x: px, y: py - 30, text: T('ZZAP!'), life: 0.8, max: 0.8, color: '#e2d6ff' });
                SS.Audio.play('zap'); u.fireT = 0.2;
              }
            }
            break;
          }
        }
      }
      if (u.hp <= 0) this.removeUnit(u);
    }
  }
  openCrate(u) {
    const r = u.r, c = u.c;
    const unlocked = (SS.unlockedUnits ? SS.unlockedUnits() : SS.BASE_ORDER).filter(id => id !== 'crate' && !U[id].feature);
    const fusions = SS.FUSION_LIST.map(f => f[2]);
    let pool;
    const roll = this.rng.next();
    if (roll < 0.7) pool = unlocked;
    else if (roll < 0.95) pool = fusions.filter(id => !U[id].tier3);
    else pool = fusions.filter(id => U[id].tier3);          // rare peek at a locked tier-3 fusion
    const pick = this.rng.pick(pool.length ? pool : unlocked);
    this.removeUnit(u, true);
    const n = this.addUnit(pick, r, c);
    if (U[pick].fusion && !SS.fusionLocked(pick) && SS.onDiscover) SS.onDiscover(pick);
    SS.Audio.play('fuse');
    for (let i = 0; i < 14; i++) this.fx.push({ k: 'p', x: n.x + this.rng.range(-30, 30), y: n.y, vx: this.rng.range(-160, 160), vy: this.rng.range(-260, -80), g: 600, life: 0.7, max: 0.7, color: i % 2 ? '#b07a3a' : '#7a5228', size: 5 });
    this.floatText(n.x, n.y - 54, U[pick].name + '!', U[pick].fusion ? '#ffd84a' : '#fff');
  }

  slimeSpeed(s) {
    const mul = s.freezeT > 0 || s.eating ? 0 : (s.slowT > 0 ? 0.5 : 1);
    return s.def.speed * (s.enraged ? s.def.enrage.speed : 1) * mul;
  }
  blockingUnit(s) {
    const front = s.x - 22 * s.def.size;
    const rows = s.def.boss ? this.slimeRows(s) : [s.row];
    for (const r of rows) {
      if (r < 0 || r >= ROWS) continue;
      for (let c = 0; c < COLS; c++) {
        const u = this.grid[r][c]; if (!u) continue;
        const left = BX + c * TW, right = left + TW;
        if (front < right - 18 && s.x > left + 10) return u;
      }
    }
    return null;
  }

  updateSlimes(dt) {
    for (const s of this.slimes) {
      if (s.dead) { s.dieT += dt; continue; }
      if (s.flash > 0) s.flash -= dt;
      if (s.slowT > 0) s.slowT -= dt;
      if (s.freezeT > 0) s.freezeT -= dt;
      if (s.shift) { s.shift.t += dt / 0.5; if (s.shift.t >= 1) s.shift = null; }
      const mul = s.freezeT > 0 ? 0 : (s.slowT > 0 ? 0.5 : 1);
      s.eating = false;
      if (s.hop) {
        s.hop.t += dt / 0.8;
        s.x = s.hop.from + (s.hop.to - s.hop.from) * Math.min(1, s.hop.t);
        if (s.hop.t >= 1) s.hop = null;
        continue;
      }
      // boss abilities
      if (s.def.boss && s.x < W - 40) {
        s.summonT -= dt;
        if (s.summonT <= 0) {
          s.summonT = 14;
          for (let k = 0; k < 3; k++) this.spawnQueue.push({ type: this.rng.pick(['blob', 'capped', 'dasher', 'hopper', 'iron']), row: this.rng.int(ROWS), delay: k * 0.6, wave: this.waveIdx });
          this.floatText(s.x, tileY(s.row) - 120, T('SUMMON!'), '#9f9');
          SS.Audio.play('surge');
        }
        s.gooT -= dt;
        if (s.gooT <= 0) {
          s.gooT = 9;
          const targets = this.units.filter(u => u.x < s.x - 60);
          if (targets.length) {
            const tgt = this.rng.pick(targets);
            this.projs.push({ k: 'goo', x0: s.x - 60, y0: tileY(s.row) - 120, x: s.x - 60, y: tileY(s.row) - 120, tx: tgt.x, ty: tgt.y, t: 0, flight: 1.4, target: tgt, dmg: 600, big: true });
            SS.Audio.play('lob');
          }
        }
      }
      const u = this.blockingUnit(s);
      if (u) {
        const mineB = u.beh.find(b => b.t === 'mine');
        if (mineB && mineB.armT >= mineB.arm) {
          this.removeUnit(u, true);
          this.explode(u.x, u.y, mineB.r, mineB.dmg, null, false, u.id);
          continue;
        }
        if (s.def.hop && !s.hopped && !u.def.tall) {
          s.hopped = true; s.hop = { from: s.x, to: BX + u.c * TW - 30, t: 0 };
          SS.Audio.play('hop');
          continue;
        }
        if (u.def.chill) s.slowT = Math.max(s.slowT, 3);
        if (u.def.thorns) this.damage(s, u.def.thorns * dt, 'flame', u.id);
        if (s.dead) continue;
        if (s.def.smash) {
          s.eating = true;
          s.smashT -= dt * (mul || 0);
          if (s.smashT <= 0) {
            s.smashT = s.def.smash;
            const victims = s.def.boss ? this.slimeRows(s).map(r => r >= 0 && r < ROWS && this.grid[r].find(x => x && Math.abs(x.x - (s.x - 60)) < TW)).filter(Boolean) : [u];
            for (const v of victims) { this.hurtUnit(v, 3000); v.flash = 0.2; }
            SS.Audio.play('smash');
            this.fx.push({ k: 'shake', life: 0.3, max: 0.3, mag: 7 });
            this.fx.push({ k: 'ring', x: u.x, y: groundY(u.r), life: 0.4, max: 0.4, color: '#c8a0ff', r0: 10, r1: 70 });
          }
          continue;
        }
        s.eating = true;
        const dps = s.def.dps * (s.enraged ? s.def.enrage.dps : 1);
        const chew = dps * dt * (mul === 0 ? 0 : (s.slowT > 0 || u.def.chill ? 0.5 : 1));
        if (chew > 0) this.hurtUnit(u, chew);
        s.chompT -= dt;
        if (s.chompT <= 0 && mul > 0) { s.chompT = 0.45; SS.Audio.play('chomp'); }
      } else if (s.def.ranged && s.x < W - 20 && this.nearestRobotAhead(s, s.def.ranged.range * TW)) {
        // Spitter: hold position and lob goo at the nearest robot ahead
        s.spitT -= dt * (mul || 0);
        if (s.spitT <= 0) {
          s.spitT = s.def.ranged.rate;
          const tgt = this.nearestRobotAhead(s, s.def.ranged.range * TW);
          this.projs.push({ k: 'goo', x0: s.x - 20, y0: groundY(s.row) - 40, x: s.x - 20, y: groundY(s.row) - 40, tx: tgt.x, ty: tgt.y, t: 0, flight: 0.9, target: tgt, dmg: s.def.ranged.dmg });
          SS.Audio.play('lob');
        }
      } else {
        s.x -= s.def.speed * (s.enraged ? s.def.enrage.speed : 1) * mul * dt;
      }
      // reach base
      if (!s.def.boss && s.x < BX - 10) {
        const sw = this.sweepers[s.row];
        if (sw.state === 'ready') { sw.state = 'go'; SS.Audio.play('sweeper'); }
        else if (sw.state === 'used' && s.x < 24) this.lose(s);
      }
      if (s.def.boss && s.x < BX + 40) this.lose(s);
    }
    this.slimes = this.slimes.filter(s => !s.dead || s.dieT < (s.husk ? 1.5 : 0.7));
    for (const s of this.slimes) if (s.dead && s.husk && !s.crumbled && s.dieT > 1.1) {
      s.crumbled = true;
      for (let i = 0; i < 16; i++) this.fx.push({ k: 'p', x: s.x + this.rng.range(-24, 24) * s.def.size, y: groundY(s.row) - this.rng.range(0, 40) * s.def.size, vx: this.rng.range(-50, 50), vy: this.rng.range(-80, 10), g: 300, life: 0.7, max: 0.7, color: i % 3 ? '#2a221c' : '#5a4a3a', size: 4 });
    }
  }

  updateProjs(dt) {
    for (const p of this.projs) {
      if (p.done) continue;
      if (p.k === 'lob' || p.k === 'goo') {
        p.t += dt / p.flight;
        const t = Math.min(1, p.t);
        p.x = p.x0 + (p.tx - p.x0) * t;
        p.y = p.y0 + (p.ty - p.y0) * t - Math.sin(t * Math.PI) * (p.k === 'goo' && !p.big ? 90 : 140);
        if (p.t >= 1) {
          p.done = true;
          if (p.k === 'goo') {
            const tg = p.target; if (tg && !tg.removed) { this.hurtUnit(tg, p.dmg); tg.flash = 0.3; }
            for (let i = 0; i < (p.big ? 12 : 7); i++) this.fx.push({ k: 'p', x: p.x, y: p.y, vx: this.rng.range(-150, 150), vy: this.rng.range(-200, -40), g: 500, life: 0.6, max: 0.6, color: p.big ? '#5bd65b' : '#ec8a2c', size: p.big ? 5 : 4 });
            SS.Audio.play('slimeDie');
            continue;
          }
          let primary = null;
          if (p.target && !p.target.dead && Math.abs(p.target.x - p.x) < 70) primary = p.target;
          else primary = this.slimes.filter(s => !s.dead && this.inRow(s, p.r) && Math.abs(s.x - p.x) < 50).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
          if (primary) { this.damage(primary, p.dmg, 'lob', p.src); if (p.slow) primary.slowT = Math.max(primary.slowT, 6); }
          for (const s of this.slimes) if (s !== primary && !s.dead && this.inRow(s, p.r) && Math.abs(s.x - p.x) < p.sr * TW + 10) { this.damage(s, p.splash, 'lob', p.src); if (p.slow) s.slowT = Math.max(s.slowT, 6); }
          const col = p.fire ? '#ff9a2a' : p.slow ? '#bff' : '#cdb';
          for (let i = 0; i < 10; i++) this.fx.push({ k: 'p', x: p.x, y: p.y, vx: this.rng.range(-120, 120), vy: this.rng.range(-180, -30), g: 500, life: 0.5, max: 0.5, color: col, size: 4 });
          SS.Audio.play('hit');
        }
        continue;
      }
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.x += p.vx * dt;
      if (p.x > W + 40) { p.done = true; continue; }
      for (const s of this.slimes) {
        if (s.dead || !this.inRow(s, p.r) || p.hit.has(s)) continue;
        const shieldX = s.front > 0 ? s.x - 34 * s.def.size - 10 : s.x - 22 * s.def.size;
        if (p.x >= shieldX && p.x <= s.x + 30 * s.def.size) {
          if (p.k === 'arc') { p.hit.add(s); this.damage(s, p.dmg, 'zap', p.src); SS.Audio.play('hit'); this.fx.push({ k: 'spark', x: p.x, y: p.y, life: 0.15, max: 0.15, color: '#c9b8ff' }); continue; }
          p.done = true;
          this.damage(s, p.dmg, 'bolt', p.src);
          if (p.k === 'ice' && !(s.front > 0)) s.slowT = Math.max(s.slowT, 10);
          if (p.k === 'fire' && p.splash) {
            s.slowT = 0;
            for (const o of this.slimes) if (o !== s && !o.dead && this.inRow(o, p.r) && Math.abs(o.x - s.x) < p.sr * TW + 10) this.damage(o, p.splash, 'lob', p.src);
          }
          this.fx.push({ k: 'spark', x: p.x, y: p.y, life: 0.15, max: 0.15, color: p.k === 'ice' ? '#e0faff' : p.k === 'fire' ? '#ffb03b' : '#7fd4ff' });
          break;
        }
      }
    }
    this.projs = this.projs.filter(p => !p.done);
  }

  updatePickups(dt) {
    const auto = this.opts.autoCollect || SS.settings.autoCollect;
    for (const e of this.pickups) {
      e.t += dt;
      if (e.collecting) {
        e.ct += dt / 0.45;
        e.x = e.cx0 + (60 - e.cx0) * e.ct; e.y = e.cy0 + (56 - e.cy0) * e.ct;
        if (e.ct >= 1) { e.done = true; this.energy += e.val; this.stats.energyCollected += e.val; }
        continue;
      }
      if (e.sky) { if (e.y < e.ty) e.y = Math.min(e.ty, e.y + e.vy * dt); }
      else { e.vy += 500 * dt; e.y += e.vy * dt; e.x += (e.vx || 0) * dt; if (e.y >= e.ty && e.vy > 0) { e.y = e.ty; e.vy = 0; e.vx = 0; } }
      e.life -= dt;
      if (auto && e.kind === 'energy' && e.t > 0.8) this.collect(e);
      if (e.life <= 0) e.done = true;
    }
    this.pickups = this.pickups.filter(e => !e.done);
  }
  collect(e) {
    if (e.collecting) return;
    if (e.kind === 'cap') {
      e.done = true; this.held = null; this.heldCap = { kind: e.cap, val: e.val, x: e.x, y: e.y }; this.selected = 'cap';
      SS.Audio.play('select'); this.floatText(e.x, e.y - 30, T('Tap a basic robot'), '#c9d1e0', 18);
      return;
    }
    e.collecting = true; e.ct = 0; e.cx0 = e.x; e.cy0 = e.y;
    SS.Audio.play('collect');
  }
  collectTrophy() {
    if (this.state !== 'clear') return;
    this.state = 'won';
    SS.Audio.play('win');
    this.endFx = { k: 'win', t: 0, x: this.trophy.x, y: this.trophy.y, dur: this.opts.autoTrophy ? 0.05 : 2.0 };
  }
  lose(s) {
    if (this.state !== 'play') return;
    this.state = 'lost';
    SS.Audio.play('lose');
    this.endFx = { k: 'lose', t: 0, row: s.def.boss ? s.row : s.row, dur: this.opts.autoTrophy ? 0.05 : 2.6 };
  }
  updateEnd(dt) {
    const e = this.endFx;
    e.t += dt;
    if (e.t >= e.dur && !e.fired) {
      e.fired = true;
      if (SS.onBattleEnd) SS.onBattleEnd(e.k === 'win', this);
    }
  }

  updateSweepers(dt) {
    for (const sw of this.sweepers) {
      if (sw.state !== 'go') continue;
      sw.x += 520 * dt;
      for (const s of this.slimes) if (!s.dead && s.row === sw.r && Math.abs(s.x - (sw.x + 30)) < 40) { if (s.def.boss) this.damage(s, 2000, 'explode', 'sweeper'); else this.kill(s); }
      if (sw.x > W + 80) sw.state = 'used';
    }
  }
  updateFx(dt) {
    for (const f of this.fx) {
      f.life -= dt;
      if (f.k === 'p' || f.k === 'debris') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.g || (f.k === 'debris' ? 700 : 0)) * dt; if (f.vr) f.rot += f.vr * dt; }
    }
    this.fx = this.fx.filter(f => f.life > 0);
    for (const t of this.texts) { t.life -= dt * 0.8; t.y -= 30 * dt; }
    this.texts = this.texts.filter(t => t.life > 0);
  }

  // ---------- input ----------
  toolRect(k) { return HUD[k]; }
  cardRect(i) {
    const C = HUD.card0, n = Math.max(1, this.cards.length);
    const span = HUD.wrench.x - 6 - C.x;                       // stretch cards when fewer than 10 are carried
    const w = Math.min(110, Math.max(C.w, (span - C.gap * (n - 1)) / n));
    const slots = this.cards.length < SS.MAX_SLOTS && w > C.w ? n : SS.MAX_SLOTS;
    const ww = slots === SS.MAX_SLOTS ? C.w : w;
    return { x: C.x + i * (ww + C.gap), y: C.y, w: ww, h: C.h, slots };
  }
  hudHit(x, y) {
    if (y > 112) return null;
    // generous hit areas: the whole tray height, and gaps count toward the nearest card
    for (let i = 0; i < this.cards.length; i++) {
      const r = this.cardRect(i);
      if (x >= r.x - HUD.card0.gap / 2 && x < r.x + r.w + HUD.card0.gap / 2) return { k: 'card', i };
    }
    for (const k of ['wrench', 'grab', 'beam']) {
      if (k !== 'wrench' && !this.tools[k]) continue;
      const b = HUD[k]; if (x >= b.x - 2 && x <= b.x + b.w + 2) return { k };
    }
    for (const k of ['speed', 'pause']) { const b = HUD[k]; if (x >= b.x - 4 && x <= b.x + b.w + 4) return { k }; }
    return null;
  }
  selectCard(i) {
    if (i === this.selected) { this.selected = null; return; }
    const c = this.cards[i]; if (!c) return;
    if (c.cd > 0 || this.energy < c.cost) { SS.Audio.play('invalid'); if (this.energy < c.cost) this.flashEnergy = 0.6; return; }
    this.held = null; this.dropCap();
    this.selected = i; SS.Audio.play('select');
  }
  selectTool(k) {
    if (k !== 'wrench' && !this.tools[k]) return;
    if (this.selected === k) { this.selected = null; this.held = null; return; }
    if (this.toolCd[k] > 0) { SS.Audio.play('invalid'); return; }
    this.held = null; this.dropCap(); this.selected = k; SS.Audio.play('select');
  }
  cancel() { this.selected = null; this.held = null; this.dropCap(); }
  dropCap() {                       // an unused scrap cap goes back on the floor instead of vanishing
    if (!this.heldCap) return;
    const c = this.heldCap; this.heldCap = null; if (this.selected === 'cap') this.selected = null;
    this.pickups.push({ kind: 'cap', cap: c.kind, val: c.val, x: c.x, y: c.y, ty: c.y, vy: 0, life: 10, t: 1 });
  }
  pickupAt(x, y) {
    let best = null, bd = 52;
    for (const e of this.pickups) { if (e.collecting) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  onDown(x, y) {
    if (this.state === 'panback' || this.state === 'countdown') { this.skipIntro(); return; }
    if (this.tip) { this.tip = null; }
    const P = this.pointer;
    P.down = true; P.x = x; P.y = y; P.startX = x; P.startY = y; P.dragging = false; P.fromCard = false;
    if (this.state === 'clear' && this.trophy && Math.hypot(this.trophy.x - x, this.trophy.y - y) < 80) { this.collectTrophy(); return; }
    if (this.state !== 'play' && this.state !== 'clear') return;
    const h = this.hudHit(x, y);
    const toolCell = (this.selected === 'grab' || this.selected === 'wrench' || this.selected === 'cap') && this.cellAt(x, y);
    const toolHit = toolCell && (this.grid[toolCell.r][toolCell.c] || this.debris[toolCell.r][toolCell.c] || (this.selected === 'grab' && this.held));
    const pk = h || toolHit ? null : this.pickupAt(x, y);
    if (pk && !(this.selected === 'cap')) { this.collect(pk); P.down = false; return; }
    if (h) {
      if (h.k === 'card') {
        if (this.selected === h.i) { P.fromCard = true; P.toggleOnUp = true; }
        else { this.selectCard(h.i); P.fromCard = this.selected === h.i; P.toggleOnUp = false; }
      }
      else if (h.k === 'wrench' || h.k === 'grab' || h.k === 'beam') { this.selectTool(h.k); P.fromCard = this.selected === h.k && h.k !== 'grab'; }
      else if (h.k === 'pause') { SS.Audio.play('click'); SS.togglePause && SS.togglePause(); }
      else if (h.k === 'speed') { SS.Audio.play('click'); SS.toggleSpeed && SS.toggleSpeed(); }
      return;
    }
    if (this.selected === 'beam') { this.beamAt(x, y); P.down = false; return; }
    const cell = this.cellAt(x, y);
    if (this.selected === 'grab' && cell) {
      if (!this.held) { if (this.grabAt(cell.r, cell.c)) { P.fromHeld = true; } }
      else this.grabAt(cell.r, cell.c);
      return;
    }
    if (cell && this.selected != null) { this.applyAt(cell); P.down = false; return; }
    if (!cell && y < BY) this.cancel();
  }
  applyAt(cell) {
    if (this.selected === 'wrench') this.wrench(cell.r, cell.c);
    else if (this.selected === 'cap') this.capAt(cell.r, cell.c);
    else if (typeof this.selected === 'number') this.place(this.selected, cell.r, cell.c);
  }
  onMove(x, y) {
    const P = this.pointer; P.x = x; P.y = y;
    if (P.down && (P.fromCard || P.fromHeld) && Math.hypot(x - P.startX, y - P.startY) > 12) P.dragging = true;
  }
  onUp(x, y) {
    const P = this.pointer; P.x = x; P.y = y;
    if (P.down && P.dragging && P.fromHeld && this.held) {
      const cell = this.cellAt(x, y);
      if (cell && (cell.r !== this.held.r || cell.c !== this.held.c)) this.grabAt(cell.r, cell.c);
    } else if (P.down && P.dragging && this.selected != null) {
      const cell = this.cellAt(x, y);
      if (cell) this.applyAt(cell);
    }
    else if (P.down && P.toggleOnUp && !P.dragging) { this.selected = null; }
    P.down = false; P.dragging = false; P.fromCard = false; P.toggleOnUp = false; P.fromHeld = false;
  }

  // ---------- render ----------
  render(ctx, bg, rt) {
    let shake = 0;
    for (const f of this.fx) if (f.k === 'shake') shake = Math.max(shake, f.mag * (f.life / f.max));
    ctx.save();
    // camera: pan for intro, zoom on the breached bay for a loss
    if (this.endFx && this.endFx.k === 'lose') {
      const k = Math.min(1, this.endFx.t / 0.9), e = 1 - Math.pow(1 - k, 3);
      const z = 1 + 0.8 * e, fx = 70, fy = tileY(this.endFx.row);
      ctx.translate(fx * (1 - z) * 1 + (W * 0.32) * e, fy * (1 - z) + (H / 2 - fy) * e);
      ctx.scale(z, z);
    }
    if (shake && !SS.settings.reduceMotion) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.translate(-this.camX, 0);
    ctx.drawImage(bg, 0, 0);
    const P = this.pointer;
    const playing = this.state === 'play' || this.state === 'clear';

    // blocked tiles
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (this.scorch[r][c] > 0) this.drawScorch(ctx, r, c, this.scorch[r][c]);
      if (this.debris[r][c]) this.drawDebris(ctx, r, c);
    }

    // placement hints
    const hov = playing ? this.cellAt(P.x, P.y) : null;
    if (typeof this.selected === 'number' || (this.selected === 'grab' && this.held)) {
      const id = typeof this.selected === 'number' ? this.cards[this.selected].id : this.held.id;
      for (const u of this.units) {
        if (u === this.held) continue;
        const f = this.fusionFor(u.id, id);
        const repair = id === 'bulwark' && typeof this.selected === 'number' && (!f || f.locked) && u.def.parts.body === 'wall' && u.hp < u.maxHp;
        if (!f && !repair) continue;
        const a = 0.35 + 0.25 * Math.sin(rt * 6);
        ctx.strokeStyle = f && f.locked && !repair ? 'rgba(170,180,200,0.7)' : repair ? `rgba(125,255,138,${a + 0.3})` : `rgba(255,216,74,${a + 0.3})`;
        ctx.lineWidth = 4;
        SS.Art.rr(ctx, BX + u.c * TW + 4, BY + u.r * TH + 4, TW - 8, TH - 8, 10); ctx.stroke();
        if (f && f.locked && !repair) this.drawPadlock(ctx, BX + u.c * TW + TW - 22, BY + u.r * TH + 22);
      }
    }
    if (this.selected === 'cap') {
      for (const u of this.units) if (!u.def.fusion && !u.armor && !u.beh.some(b => b.t === 'bomb' || b.t === 'crate')) {
        ctx.strokeStyle = `rgba(200,210,225,${0.5 + 0.3 * Math.sin(rt * 6)})`; ctx.lineWidth = 4;
        SS.Art.rr(ctx, BX + u.c * TW + 4, BY + u.r * TH + 4, TW - 8, TH - 8, 10); ctx.stroke();
      }
    }
    if (hov && this.selected != null && this.selected !== 'beam' && (P.down || !SS.isTouch)) {
      let col = 'rgba(255,255,255,0.18)';
      if (this.selected === 'wrench') col = (this.grid[hov.r][hov.c] || this.debris[hov.r][hov.c]) ? 'rgba(255,90,90,0.35)' : 'rgba(255,255,255,0.08)';
      else if (typeof this.selected === 'number') { const chk = this.placeCheck(this.selected, hov.r, hov.c); col = chk.ok ? (chk.mode === 'fuse' ? 'rgba(255,216,74,0.4)' : 'rgba(120,255,140,0.25)') : 'rgba(255,90,90,0.3)'; }
      ctx.fillStyle = col; ctx.fillRect(BX + hov.c * TW, BY + hov.r * TH, TW, TH);
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(BX, BY + hov.r * TH, COLS * TW, TH);
    }

    for (const sw of this.sweepers) if (sw.state !== 'used') this.drawSweeper(ctx, sw, rt);

    // entities by row (contact shadows are drawn by the art functions)
    for (let r = 0; r < ROWS; r++) {
      for (const u of this.units) if (u.r === r) this.drawUnit(ctx, u, rt);
      const row = this.slimes.filter(s => s.row === r && !s.def.boss).sort((a, b) => b.x - a.x);
      for (const s of row) this.drawSlimeEnt(ctx, s, rt);
      for (const s of this.preview) if (s.row === r && s.type !== 'king') this.drawPreviewSlime(ctx, s, rt);
    }
    for (const s of this.slimes) if (s.def.boss) this.drawSlimeEnt(ctx, s, rt);
    for (const s of this.preview) if (s.type === 'king') this.drawPreviewSlime(ctx, s, rt);

    for (const p of this.projs) this.drawProj(ctx, p, rt);
    this.drawFx(ctx, rt);
    for (const e of this.pickups) {
      ctx.save(); ctx.translate(e.x, e.y);
      if (e.life < 2 && !e.collecting) ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(rt * 10));
      if (e.kind === 'cap') this.drawCapPickup(ctx, e, rt); else SS.Art.drawEnergy(ctx, rt + e.x, e.collecting ? 0.8 : 1.1);
      ctx.restore();
    }
    if (this.trophy && (this.state === 'clear' || (this.endFx && this.endFx.k === 'win'))) this.drawTrophy(ctx, rt);
    for (const tx of this.texts) {
      ctx.globalAlpha = Math.min(1, tx.life * 2); ctx.font = `bold ${tx.size || 22}px system-ui,sans-serif`; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText(tx.text, tx.x, tx.y); ctx.fillStyle = tx.color; ctx.fillText(tx.text, tx.x, tx.y);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    if (playing || this.endFx) this.drawHUD(ctx, rt);
    this.drawOverlays(ctx, rt);

    // held / dragged ghosts
    if (playing) {
      if (typeof this.selected === 'number' && P.x >= 0 && (P.dragging || (!SS.isTouch && P.y > BY))) {
        ctx.save(); ctx.translate(P.x, P.y + 10); SS.Art.drawRobot(ctx, this.cards[this.selected].id, rt, { alpha: 0.65, scale: 0.85 }); ctx.restore();
      } else if (this.held && P.x >= 0 && (P.dragging || !SS.isTouch)) {
        ctx.save(); ctx.translate(P.x, P.y + 10); SS.Art.drawRobot(ctx, this.held.id, rt, { alpha: 0.7, scale: 0.85 }); ctx.restore();
      } else if (this.selected === 'wrench' && P.x >= 0 && (P.dragging || !SS.isTouch)) {
        ctx.save(); ctx.translate(P.x, P.y); this.drawWrenchIcon(ctx, 0.9); ctx.restore();
      } else if (this.selected === 'cap' && P.x >= 0 && !SS.isTouch) {
        ctx.save(); ctx.translate(P.x, P.y); this.drawCapIcon(ctx, this.heldCap && this.heldCap.kind, 0.9); ctx.restore();
      }
    }
  }
  drawOverlays(ctx, rt) {
    // intro title card + countdown
    if (this.state === 'intro' || this.state === 'panback') {
      const a = this.state === 'intro' ? Math.min(1, this.introT * 2) : Math.max(0, 1 - this.introT * 2);
      ctx.save(); ctx.globalAlpha = a; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const label = this.level.endless ? T('ENDLESS') : `${T('LEVEL')} ${String(this.level.label || '').replace('.', '')}`;
      if (SS.dockRight) { const cx = (SS.dockRight + W) / 2; ctx.translate(cx - W / 2, 0); const room = W - SS.dockRight; if (room < 560) { const k = Math.max(0.55, room / 560); ctx.translate(W / 2, 0); ctx.scale(k, k); ctx.translate(-W / 2, 0); } }
      ctx.font = '800 22px system-ui,sans-serif'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
      ctx.strokeText(label, W / 2, 46); ctx.fillStyle = HC.label; ctx.fillText(label, W / 2, 46);
      ctx.font = '900 46px system-ui,sans-serif'; ctx.lineWidth = 8;
      ctx.strokeText(this.level.name, W / 2, 88); ctx.fillStyle = '#fff'; ctx.fillText(this.level.name, W / 2, 88);
      if (this.level.night) { ctx.font = '800 18px system-ui,sans-serif'; ctx.lineWidth = 5; ctx.strokeText(T('NIGHT SHIFT'), W / 2, 122); ctx.fillStyle = '#ffb347'; ctx.fillText(T('NIGHT SHIFT'), W / 2, 122); }
      ctx.restore();
    }
    if (this.state === 'countdown') {
      const beats = [[T('READY'), 0, 0.55], [T('SET'), 0.55, 1.1], [T('DEFEND!'), 1.1, 1.8]];
      const b = beats.find(x => this.introT >= x[1] && this.introT < x[2]) || beats[2];
      const k = (this.introT - b[1]) / (b[2] - b[1]);
      ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const sc = 1.25 - 0.25 * Math.min(1, k * 4);
      ctx.translate(W / 2, H / 2); ctx.scale(sc, sc); ctx.globalAlpha = k > 0.8 ? (1 - k) * 5 : 1;
      ctx.font = '900 84px system-ui,sans-serif'; ctx.lineWidth = 12; ctx.strokeStyle = '#000'; ctx.strokeText(b[0], 0, 0);
      ctx.fillStyle = b === beats[2] ? '#7dff8a' : '#ffe36a'; ctx.fillText(b[0], 0, 0);
      ctx.restore();
    }
    // wave banners: outlined text over the field, no band
    if (this.banner) {
      const b = this.banner, k = Math.min(1, (b.max - b.t) * 4, b.t * 2);
      ctx.save(); ctx.globalAlpha = k; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '900 44px system-ui,sans-serif'; ctx.lineWidth = 8; ctx.strokeStyle = '#000';
      const y = BY + TH * 2.5;
      ctx.strokeText(b.text, W / 2, y); ctx.fillStyle = b.color; ctx.fillText(b.text, W / 2, y);
      ctx.restore();
    }
    if (this.tip && this.state === 'play') {
      ctx.save();
      const tw = 760, th = 76, tx = (W - tw) / 2, ty = H - th - 56;
      ctx.globalAlpha = Math.min(1, this.tip.t);
      ctx.fillStyle = HC.tipBg; SS.Art.rr(ctx, tx, ty, tw, th, 14); ctx.fill();
      ctx.strokeStyle = HC.accent; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = HC.tipText; ctx.font = '600 19px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      wrapText(ctx, this.tip.text, W / 2, ty + th / 2, tw - 40, 23);
      ctx.restore();
    }
    // end sequences
    if (this.endFx && this.endFx.k === 'win') {
      const e = this.endFx, t = e.t;
      ctx.save(); ctx.translate(e.x, e.y);
      ctx.globalAlpha = Math.min(1, t * 2);
      for (let i = 0; i < 14; i++) {
        const a = i / 14 * Math.PI * 2 + t * 0.8;
        ctx.fillStyle = i % 2 ? 'rgba(255,240,170,0.35)' : 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 200 + t * 900, a, a + 0.18); ctx.closePath(); ctx.fill();
      }
      ctx.restore();
      const wf = Math.max(0, (t - 1.1) / 0.8);
      if (wf > 0) { ctx.fillStyle = `rgba(255,255,255,${Math.min(1, wf)})`; ctx.fillRect(0, 0, W, H); }
    }
    if (this.endFx && this.endFx.k === 'lose') {
      const t = this.endFx.t;
      ctx.fillStyle = `rgba(160,20,20,${Math.min(0.35, t * 0.4) * (0.7 + 0.3 * Math.sin(t * 14))})`; ctx.fillRect(0, 0, W, H);
      if (t > 0.7) {
        ctx.save(); ctx.globalAlpha = Math.min(1, (t - 0.7) * 3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '900 64px system-ui,sans-serif'; ctx.lineWidth = 10; ctx.strokeStyle = '#000';
        ctx.strokeText(T('CORE BREACHED!'), W / 2, H / 2 - 120); ctx.fillStyle = '#ff5a5a'; ctx.fillText(T('CORE BREACHED!'), W / 2, H / 2 - 120);
        ctx.restore();
      }
    }
  }
  drawTrophy(ctx, rt) {
    ctx.save(); ctx.translate(this.trophy.x, this.trophy.y + Math.sin(rt * 3) * 6);
    ctx.fillStyle = 'rgba(255,240,150,0.25)'; ctx.beginPath(); ctx.arc(0, 0, 60 + Math.sin(rt * 5) * 6, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 3;
    SS.Art.rr(ctx, -28, -34, 56, 68, 10); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7a5a00'; ctx.font = 'bold 14px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(T('CORE'), 0, 5);
    if (this.state === 'clear') { ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui,sans-serif'; ctx.fillText(T('Tap!'), 0, 60); }
    ctx.restore();
  }
  drawPadlock(ctx, x, y) {
    ctx.save(); ctx.translate(x, y);
    ctx.strokeStyle = '#c9d1e0'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -6, 6, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = '#c9d1e0'; SS.Art.rr(ctx, -9, -6, 18, 14, 3); ctx.fill();
    ctx.fillStyle = '#2a3348'; ctx.fillRect(-1.5, -2, 3, 6);
    ctx.restore();
  }
  drawDebris(ctx, r, c) {
    const x = tileX(c), y = groundY(r);
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; SS.Art.ell(ctx, 0, 2, 40, 9); ctx.fill();
    const box = (bx, by, w, h, col) => { SS.Art.rr(ctx, bx, by, w, h, 4); ctx.fillStyle = col; ctx.fill(); ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(bx + 4, by + 4); ctx.lineTo(bx + w - 4, by + h - 4); ctx.moveTo(bx + w - 4, by + 4); ctx.lineTo(bx + 4, by + h - 4); ctx.stroke(); };
    box(-36, -34, 40, 34, '#7a6248');
    box(0, -26, 32, 26, '#6a6e78');
    box(-20, -60, 30, 26, '#86684a');
    ctx.fillStyle = '#f0c020'; ctx.fillRect(2, -20, 28, 4);
    ctx.restore();
  }
  drawScorch(ctx, r, c, t) {
    const x = tileX(c), y = tileY(r) + 10;
    ctx.save(); ctx.globalAlpha = Math.min(1, t / 3);
    const g = ctx.createRadialGradient(x, y, 4, x, y, 52);
    g.addColorStop(0, 'rgba(20,14,10,0.85)'); g.addColorStop(0.7, 'rgba(40,24,14,0.6)'); g.addColorStop(1, 'rgba(40,24,14,0)');
    ctx.fillStyle = g; SS.Art.ell(ctx, x, y, 54, 34); ctx.fill();
    if (t > 12) { ctx.fillStyle = `rgba(255,${120 + Math.floor(Math.random() * 60)},40,0.5)`; for (let i = 0; i < 3; i++) { SS.Art.ell(ctx, x - 20 + i * 20, y - 4 + (i % 2) * 8, 3, 2); ctx.fill(); } }
    ctx.restore();
  }
  drawCapIcon(ctx, kind, s = 1) {
    ctx.save(); ctx.scale(s, s);
    const metal = kind === 'iron' ? '#8f9aa8' : '#b0a090';
    ctx.beginPath(); ctx.ellipse(0, 0, 22, 14, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = metal; ctx.fill(); ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 2.5; ctx.stroke();
    SS.Art.rr(ctx, -26, -2, 52, 6, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)'; SS.Art.ell(ctx, -8, -8, 6, 3); ctx.fill();
    ctx.restore();
  }
  drawCapPickup(ctx, e, rt) {
    ctx.translate(0, Math.sin(rt * 4 + e.x) * 3);
    ctx.fillStyle = 'rgba(200,220,255,0.18)'; SS.Art.ell(ctx, 0, -4, 34, 24); ctx.fill();
    this.drawCapIcon(ctx, e.cap, 1);
  }
  drawSweeper(ctx, sw, rt) {
    const y = groundY(sw.r) - 8;
    ctx.save(); ctx.translate(sw.x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 8, 34, 7, 0, 0, 6.29); ctx.fill();
    ctx.fillStyle = '#d8a020'; SS.Art.rr(ctx, -30, -22, 54, 26, 8); ctx.fill(); ctx.strokeStyle = '#6a4a00'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#333'; ctx.fillRect(22, -24, 10, 32);
    ctx.fillStyle = '#222'; for (const x of [-18, 12]) { ctx.beginPath(); ctx.arc(x, 6, 8, 0, 6.29); ctx.fill(); }
    ctx.fillStyle = sw.state === 'go' ? '#ff4040' : (Math.sin(rt * 3) > 0 ? '#4f4' : '#262'); ctx.beginPath(); ctx.arc(-14, -28, 4, 0, 6.29); ctx.fill();
    if (sw.state === 'go') { ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-40 - i * 8, -14 + i * 8); ctx.lineTo(-70 - i * 8, -14 + i * 8); ctx.stroke(); } }
    ctx.restore();
  }
  drawUnit(ctx, u, rt) {
    ctx.save(); ctx.translate(u.x, u.y + 4);
    const mine = u.beh.find(b => b.t === 'mine');
    const bomb = u.beh.find(b => b.t === 'bomb');
    const crate = u.beh.find(b => b.t === 'crate');
    if (u === this.held) { ctx.globalAlpha = 0.35; }
    if (crate) ctx.translate(Math.sin(rt * 40) * 2 * (1 - crate.timer / crate.open), 0);
    SS.Art.drawRobot(ctx, u.id, rt, { firing: u.fireT > 0, hpRatio: u.hp / u.maxHp, armed: mine ? mine.armT >= mine.arm : undefined, fuse: bomb ? Math.max(0, bomb.fuseT / bomb.fuse) : null, producing: u.prodGlow > 0, phase: u.phase });
    if (u.armor > 0) { ctx.save(); ctx.translate(0, u.def.parts.body === 'wall' ? -48 : u.def.parts.body === 'mine' ? 6 : -44); this.drawCapIcon(ctx, u.capKind, 0.75); ctx.restore(); }
    if (u.flash > 0) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#ff6060'; ctx.beginPath(); ctx.ellipse(0, 0, 40, 44, 0, 0, 6.29); ctx.fill(); ctx.globalAlpha = 1; }
    if ((u.hp < u.maxHp || u.armor > 0) && !bomb && !crate) {
      const w = 60, f = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-w / 2, -60, w, 6);
      ctx.fillStyle = f > 0.5 ? '#5f5' : f > 0.25 ? '#fd4' : '#f55'; ctx.fillRect(-w / 2, -60, w * f, 6);
      if (u.armor > 0) { ctx.fillStyle = '#c9d1e0'; ctx.fillRect(-w / 2, -67, w * (u.armor / u.maxArmor), 4); }
    }
    if (mine && mine.armT < mine.arm) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-24, 46, 48, 5);
      ctx.fillStyle = '#ffb040'; ctx.fillRect(-24, 46, 48 * (mine.armT / mine.arm), 5);
    }
    ctx.restore();
  }
  drawSlimeEnt(ctx, s, rt) {
    const gy = s.def.boss ? groundY(s.row + 1) - 20 : groundY(s.row);
    let y = gy;
    if (s.hop) y -= Math.sin(Math.min(1, s.hop.t) * Math.PI) * 70;
    if (s.shift) y += (groundY(s.shift.from) - groundY(s.row)) * (1 - s.shift.t) - Math.sin(s.shift.t * Math.PI) * 30;
    ctx.save(); ctx.translate(s.x, y);
    const opts = {
      moving: !s.eating && s.freezeT <= 0, eating: s.eating, armor: s.armor, armorRatio: s.maxArmor ? s.armor / s.maxArmor : 1, front: s.front,
      slow: s.slowT > 0, frozen: s.freezeT > 0, flash: s.flash > 0, phase: s.phase, enraged: s.enraged,
    };
    if (s.dead && s.husk) {
      opts.moving = false; opts.husk = true; opts.alpha = s.dieT > 1.1 ? Math.max(0, 1 - (s.dieT - 1.1) / 0.3) : 1;
    } else if (s.dead) { opts.melt = Math.min(1, s.dieT / 0.6); opts.alpha = 1 - s.dieT / 0.7; }
    SS.Art.drawSlime(ctx, s.type, this.time + s.phase, opts);
    ctx.restore();
    if (s.def.boss && !s.dead) {
      const w = 300, f = Math.max(0, s.hp / s.maxHp);
      const bx = W / 2 - w / 2, by = BY - 30;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 4, by - 4, w + 8, 22);
      ctx.fillStyle = '#5bd65b'; ctx.fillRect(bx, by, w * f, 14);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(T('KING GLOOP'), W / 2, by - 8);
    }
  }
  drawPreviewSlime(ctx, s, rt) {
    const gy = s.type === 'king' ? groundY(s.row + 1) - 20 : groundY(s.row);
    ctx.save(); ctx.translate(s.x, gy);
    SS.Art.drawSlime(ctx, s.type, rt + s.phase, { moving: false, armor: s.armor, front: s.front, phase: s.phase });
    ctx.restore();
  }
  drawProj(ctx, p, rt) {
    if (p.delay > 0) return;
    if (p.k !== 'lob' && p.k !== 'goo') {   // ground shadow under straight bolts
      ctx.fillStyle = 'rgba(0,0,0,0.22)'; SS.Art.ell(ctx, p.x - 8, groundY(p.r) - 2, 12, 3.5); ctx.fill();
    }
    ctx.save(); ctx.translate(p.x, p.y);
    if (p.k === 'lob' || p.k === 'goo') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.tx - p.x, p.ty - p.y + 22, 10, 4, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = p.k === 'goo' ? (p.big ? '#5bd65b' : '#ec8a2c') : p.fire ? '#ff8a2a' : p.slow ? '#cff6ff' : '#5c6a50';
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, p.k === 'goo' ? (p.big ? 16 : 9) : 10, 0, 6.29); ctx.fill(); ctx.stroke();
      if (p.fire) { ctx.fillStyle = '#ffe36a'; ctx.beginPath(); ctx.arc(-3, -3, 4, 0, 6.29); ctx.fill(); }
    } else {
      const col = { plain: '#7fd4ff', ice: '#e0faff', fire: '#ffb03b', arc: '#c9b8ff' }[p.k] || '#fff';
      ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fillStyle = col;
      const len = p.k === 'arc' ? 34 : p.k === 'fire' ? 22 : 18, th = p.k === 'fire' ? 10 : 7;
      SS.Art.rr(ctx, -len, -th / 2, len, th, th / 2); ctx.fill();
      ctx.fillStyle = '#fff'; SS.Art.rr(ctx, -len * 0.5, -th / 4, len * 0.5, th / 2, th / 4); ctx.fill();
    }
    ctx.restore();
  }
  drawFx(ctx, rt) {
    for (const f of this.fx) {
      const k = f.life / f.max;
      switch (f.k) {
        case 'p': ctx.globalAlpha = k; ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, f.size * (0.5 + k * 0.5), 0, 6.29); ctx.fill(); break;
        case 'ring': ctx.globalAlpha = k; ctx.strokeStyle = f.color; ctx.lineWidth = 6 * k; ctx.beginPath(); ctx.arc(f.x, f.y, f.r0 + (f.r1 - f.r0) * (1 - k), 0, 6.29); ctx.stroke(); break;
        case 'flash': { ctx.globalAlpha = k * 0.8; const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.rad); g.addColorStop(0, f.cold ? '#ffffff' : '#fff7c0'); g.addColorStop(0.5, f.cold ? '#9fe8ff' : '#ffb040'); g.addColorStop(1, 'rgba(255,90,20,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.rad, 0, 6.29); ctx.fill(); break; }
        case 'cloud': {   // rising blast column + cap
          const e = 1 - k, s = f.s;
          ctx.globalAlpha = Math.min(1, k * 2) * 0.85;
          const top = f.y - 40 - e * 120 * s;
          ctx.fillStyle = f.cold ? '#d8f4ff' : '#8a7a6a';
          SS.Art.rr(ctx, f.x - 14 * s, top + 20, 28 * s, f.y - top - 10, 12); ctx.fill();
          ctx.fillStyle = f.cold ? '#f4fcff' : '#b8a48a';
          for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.arc(f.x + (i - 2) * 22 * s, top + Math.sin(i * 2) * 6, (26 + (i % 2) * 10) * s * (0.6 + e * 0.5), 0, 6.29); ctx.fill(); }
          if (!f.cold) { ctx.fillStyle = `rgba(255,160,60,${0.6 * k})`; ctx.beginPath(); ctx.arc(f.x, top + 6, 24 * s, 0, 6.29); ctx.fill(); }
          break;
        }
        case 'word': {
          const e = 1 - k, sc = e < 0.15 ? 0.5 + e / 0.15 * 0.7 : 1.2 - Math.min(0.2, (e - 0.15));
          ctx.save(); ctx.globalAlpha = Math.min(1, k * 3); ctx.translate(f.x, f.y - e * 30); ctx.rotate(-0.12); ctx.scale(sc, sc);
          ctx.font = '900 40px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.lineWidth = 9; ctx.strokeStyle = '#2a0f0f'; ctx.strokeText(f.text, 0, 0); ctx.fillStyle = f.color; ctx.fillText(f.text, 0, 0);
          ctx.restore(); break;
        }
        case 'beam': {
          ctx.globalAlpha = k; const g = ctx.createLinearGradient(f.x - 30, 0, f.x + 30, 0);
          g.addColorStop(0, 'rgba(120,220,255,0)'); g.addColorStop(0.5, 'rgba(180,240,255,0.8)'); g.addColorStop(1, 'rgba(120,220,255,0)');
          ctx.fillStyle = g; ctx.fillRect(f.x - 30, f.y1, 60, f.y2 - f.y1 + 30); break;
        }
        case 'spark': ctx.globalAlpha = k; ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, 10 * (1.3 - k), 0, 6.29); ctx.fill(); break;
        case 'flame': {
          ctx.globalAlpha = Math.min(1, k * 1.5);
          const g = ctx.createLinearGradient(f.x1, 0, f.x2, 0);
          if (f.steam) { g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(180,230,255,0)'); }
          else { g.addColorStop(0, '#fff3a0'); g.addColorStop(0.3, '#ff9a2a'); g.addColorStop(1, 'rgba(255,60,20,0)'); }
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.moveTo(f.x1, f.y);
          const n = 10;
          for (let i = 0; i <= n; i++) { const x = f.x1 + (f.x2 - f.x1) * i / n; ctx.lineTo(x, f.y - 14 - i * 2.4 - Math.sin(rt * 30 + i) * 6); }
          for (let i = n; i >= 0; i--) { const x = f.x1 + (f.x2 - f.x1) * i / n; ctx.lineTo(x, f.y + 14 + i * 2.4 + Math.sin(rt * 27 + i) * 6); }
          ctx.closePath(); ctx.fill(); break;
        }
        case 'bolt': {
          ctx.globalAlpha = k; ctx.strokeStyle = '#e8e0ff'; ctx.shadowColor = '#a890ff'; ctx.shadowBlur = 12; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(f.x1, f.y1);
          const seg = 7; for (let i = 1; i < seg; i++) { const tt = i / seg; ctx.lineTo(f.x1 + (f.x2 - f.x1) * tt + (Math.random() - 0.5) * 18, f.y1 + (f.y2 - f.y1) * tt + (Math.random() - 0.5) * 18); }
          ctx.lineTo(f.x2, f.y2); ctx.stroke(); ctx.shadowBlur = 0; break;
        }
        case 'debris': ctx.globalAlpha = k; ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.fillStyle = f.color; ctx.fillRect(-f.w / 2, -f.h / 2, f.w, f.h); ctx.restore(); break;
        case 'frost': ctx.globalAlpha = k * 0.35; ctx.fillStyle = '#bff2ff'; ctx.fillRect(this.camX, 0, W, H); break;
      }
      ctx.globalAlpha = 1;
    }
  }
  drawWrenchIcon(ctx, s = 1) {
    ctx.save(); ctx.scale(s, s); ctx.rotate(-0.7);
    ctx.fillStyle = '#c8d0dc'; ctx.strokeStyle = '#4a5260'; ctx.lineWidth = 2;
    SS.Art.rr(ctx, -5, -6, 10, 40, 4); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, -14, 14, 0, 6.29); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2a3348'; ctx.fillRect(-5, -30, 10, 18);
    ctx.restore();
  }
  drawGrabIcon(ctx, s = 1) {
    ctx.save(); ctx.scale(s, s);
    ctx.strokeStyle = '#c8d0dc'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, -30); ctx.lineTo(0, -8); ctx.stroke();
    ctx.fillStyle = '#ffb347'; SS.Art.rr(ctx, -12, -12, 24, 10, 4); ctx.fill();
    ctx.strokeStyle = '#c8d0dc'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-10, -2); ctx.quadraticCurveTo(-20, 12, -8, 22); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, -2); ctx.quadraticCurveTo(20, 12, 8, 22); ctx.stroke();
    ctx.restore();
  }
  drawBeamIcon(ctx, s = 1) {
    ctx.save(); ctx.scale(s, s);
    ctx.fillStyle = '#7a8aa8'; SS.Art.rr(ctx, -14, -30, 28, 14, 5); ctx.fill();
    const g = ctx.createLinearGradient(0, -16, 0, 26); g.addColorStop(0, 'rgba(160,235,255,0.95)'); g.addColorStop(1, 'rgba(160,235,255,0.1)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(-8, -16); ctx.lineTo(8, -16); ctx.lineTo(18, 26); ctx.lineTo(-18, 26); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  drawHUD(ctx, rt) {
    const keys = SS.showKeys;
    // floating tray behind energy + cards + tools
    ctx.fillStyle = HC.tray;
    SS.Art.rr(ctx, 2, 2, HUD.beam.x + HUD.beam.w + 6, 108, 14); ctx.fill();
    ctx.strokeStyle = HC.trayEdge; ctx.lineWidth = 2; ctx.stroke();
    // energy
    const E = HUD.energy;
    ctx.fillStyle = this.flashEnergy > 0 && Math.sin(rt * 30) > 0 ? '#5a1a1a' : HC.panel; SS.Art.rr(ctx, E.x, E.y, E.w, E.h, 12); ctx.fill();
    ctx.strokeStyle = HC.accent; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.translate(E.x + E.w / 2, E.y + 36); SS.Art.drawEnergy(ctx, 0, 0.9); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = '800 28px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.floor(this.energy)), E.x + E.w / 2, E.y + 80);
    // card slots (empty frames for unused)
    const C = HUD.card0, slots = this.cardRect(0).slots;
    for (let i = 0; i < slots; i++) {
      const R = this.cardRect(i), x = R.x, y = R.y, c = this.cards[i];
      const Cw = R.w;
      if (!c) { ctx.strokeStyle = 'rgba(90,115,160,0.45)'; ctx.setLineDash([5, 5]); ctx.lineWidth = 2; SS.Art.rr(ctx, x + 1, y + 1, Cw - 2, C.h - 2, 10); ctx.stroke(); ctx.setLineDash([]); continue; }
      const sel = this.selected === i;
      const afford = this.energy >= c.cost;
      ctx.fillStyle = sel ? HC.cardSel : HC.card; SS.Art.rr(ctx, x, y + (sel ? 4 : 0), Cw, C.h, 10); ctx.fill();
      ctx.strokeStyle = sel ? '#ffd84a' : c.dup ? '#b48cff' : HC.border; ctx.lineWidth = sel ? 3 : 2; ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 2, Cw - 4, C.h - 4); ctx.clip();
      ctx.translate(x + Cw / 2, y + 46 + (sel ? 4 : 0)); SS.Art.drawRobot(ctx, c.id, 0, { scale: 0.55, noBadge: true }); ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x + 2, y + C.h - 24 + (sel ? 4 : 0), Cw - 4, 22);
      ctx.fillStyle = afford ? '#ffe94a' : '#ff7070'; ctx.font = '800 17px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(c.cost), x + Cw / 2, y + C.h - 13 + (sel ? 4 : 0));
      if (c.dup) { ctx.fillStyle = '#b48cff'; ctx.font = '800 11px system-ui'; ctx.textAlign = 'right'; ctx.fillText('×2', x + Cw - 5, y + 11); }
      if (c.cd > 0 || !afford) {
        ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, y, Cw, C.h);
        if (c.cd > 0) { const f = c.cd / c.cdMax; ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, y, Cw, C.h * f); }
      }
      if (keys) { ctx.fillStyle = '#9ab'; ctx.font = '600 11px system-ui'; ctx.textAlign = 'left'; ctx.fillText(String((i + 1) % 10), x + 5, y + 11); }
    }
    // tools
    const tool = (k, label, key, icon, color) => {
      const b = HUD[k];
      const on = this.selected === k, cd = this.toolCd[k] || 0, avail = k === 'wrench' || this.tools[k];
      ctx.fillStyle = on ? color : HC.tool; SS.Art.rr(ctx, b.x, b.y, b.w, b.h, 10); ctx.fill();
      ctx.strokeStyle = on ? '#ffd84a' : HC.toolEdge; ctx.lineWidth = 2; ctx.stroke();
      if (!avail) { ctx.strokeStyle = 'rgba(90,115,160,0.45)'; ctx.setLineDash([5, 5]); SS.Art.rr(ctx, b.x + 1, b.y + 1, b.w - 2, b.h - 2, 10); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = 'rgba(10,16,28,0.75)'; SS.Art.rr(ctx, b.x, b.y, b.w, b.h, 10); ctx.fill(); this.drawPadlock(ctx, b.x + b.w / 2, b.y + b.h / 2); return; }
      ctx.save(); ctx.translate(b.x + b.w / 2, b.y + b.h / 2 - 8); icon(0.9); ctx.restore();
      ctx.fillStyle = '#ccc'; ctx.font = '600 12px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, b.x + b.w / 2, b.y + b.h - 12);
      if (cd > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(b.x, b.y, b.w, b.h * (cd / TOOL_CD[k]));
        ctx.fillStyle = '#fff'; ctx.font = '800 16px system-ui'; ctx.fillText(String(Math.ceil(cd)), b.x + b.w / 2, b.y + 18);
      }
      if (keys) { ctx.fillStyle = '#9ab'; ctx.font = '600 11px system-ui'; ctx.textAlign = 'left'; ctx.fillText(key, b.x + 5, b.y + 11); }
    };
    tool('wrench', T('Remove'), 'W', s => this.drawWrenchIcon(ctx, s), '#5a3b3b');
    tool('grab', T('Grab'), 'G', s => this.drawGrabIcon(ctx, s), '#4a4a2a');
    tool('beam', T('Beam'), 'T', s => this.drawBeamIcon(ctx, s), '#2a4a5a');
    // speed & pause
    for (const k of ['speed', 'pause']) {
      const b = HUD[k];
      ctx.fillStyle = HC.btn; SS.Art.rr(ctx, b.x, b.y, b.w, b.h, 12); ctx.fill(); ctx.strokeStyle = HC.border; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff';
      if (k === 'pause') { ctx.fillRect(b.x + 25, b.y + 21, 8, 30); ctx.fillRect(b.x + 39, b.y + 21, 8, 30); }
      else { const sp = SS.speed || 1; ctx.font = '800 22px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(sp === 0.5 ? '½×' : sp + '×', b.x + b.w / 2, b.y + b.h / 2); }
      if (keys) { ctx.fillStyle = '#9ab'; ctx.font = '600 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText(k === 'pause' ? 'Space' : 'F', b.x + b.w / 2, b.y + b.h + 10); }
    }
    // bottom-left: slime counter
    const CT = HUD.counter, n = this.liveCount();
    const ctText = `${n} ${n === 1 ? T('slime') : T('slimes')}`;
    ctx.font = '800 18px system-ui,sans-serif';
    const ctW = Math.max(CT.w, 54 + ctx.measureText(ctText).width + 14);
    ctx.fillStyle = HC.tray; SS.Art.rr(ctx, CT.x, CT.y, ctW, CT.h, 10); ctx.fill();
    ctx.save(); ctx.translate(CT.x + 24, CT.y + CT.h - 6); SS.Art.drawSlime(ctx, 'blob', rt, { scale: 0.42, moving: false }); ctx.restore();
    ctx.fillStyle = HC.counter; ctx.font = '800 18px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(ctText, CT.x + 54, CT.y + CT.h / 2);
    // bottom-right: level name + progress
    const PR = HUD.progress;
    ctx.fillStyle = HC.tray; SS.Art.rr(ctx, PR.x, PR.y, PR.w, PR.h, 10); ctx.fill();
    ctx.fillStyle = '#ccd'; ctx.font = '700 13px system-ui,sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    const diff = (SS.settings && SS.settings.difficulty) || 'normal';
    ctx.fillText(this.level.endless ? `Endless · Wave ${Math.max(0, this.waveIdx + 1)} · Best ${SS.save.endlessBest || 0}` : `${this.level.label || ''} ${this.level.name} · ${diff[0].toUpperCase() + diff.slice(1)}`, PR.x + 10, PR.y + 12);
    if (!this.level.endless) {
      const bx = PR.x + 10, by = PR.y + 22, bw = PR.w - 20, bh = 11;
      ctx.fillStyle = '#0a0f18'; SS.Art.rr(ctx, bx, by, bw, bh, 5); ctx.fill();
      const f = Math.max(0, (this.waveIdx + 1) / this.totalWaves);
      if (f > 0) { ctx.fillStyle = '#5bd65b'; SS.Art.rr(ctx, bx + bw * (1 - f), by, bw * f, bh, 5); ctx.fill(); }
      for (let i = 0; i < this.totalWaves; i++) if (this.isFlag(i)) {
        const fx = bx + bw * (1 - (i + 1) / this.totalWaves) + 1;
        ctx.fillStyle = i <= this.waveIdx ? '#ffd84a' : '#d33'; ctx.fillRect(fx, by - 6, 2, 16);
        ctx.beginPath(); ctx.moveTo(fx + 2, by - 6); ctx.lineTo(fx + 11, by - 3); ctx.lineTo(fx + 2, by); ctx.fill();
      }
    }
  }
}

function wrapText(ctx, text, cx, cy, maxW, lh) {
  const words = text.split(' '); const lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  const y0 = cy - (lines.length - 1) * lh / 2;
  lines.forEach((l, i) => ctx.fillText(l, cx, y0 + i * lh));
}

SS.Battle = Battle;
SS.HUD = HUD;
SS.DT = DT;
SS.tileX = tileX; SS.tileY = tileY;
})();
