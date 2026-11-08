// Slime Siege — battle simulation, rendering and in-battle input
'use strict';
(() => {
const { W, H, COLS, ROWS, TW, TH, BX, BY } = SS.CONST;
const U = SS.UNITS, SL = SS.SLIMES;
const tileX = c => BX + c * TW + TW / 2;
const tileY = r => BY + r * TH + TH / 2;
const groundY = r => BY + r * TH + TH - 14;
const DT = 1 / 60;

class RNG {
  constructor(seed) { this.s = (seed >>> 0) || 1; }
  next() { let t = this.s += 0x6D2B79F5; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }
  range(a, b) { return a + (b - a) * this.next(); }
  int(n) { return Math.floor(this.next() * n); }
  pick(a) { return a[this.int(a.length)]; }
}
SS.RNG = RNG;

// HUD layout (logical coords)
const HUD = {
  energy: { x: 8, y: 8, w: 112, h: 96 },
  card0: { x: 128, y: 6, w: 80, h: 100, gap: 6 },
  wrench: { x: 0, y: 6, w: 80, h: 100 },   // x computed
  progress: { x: 930, y: 40, w: 170, h: 18 },
  speed: { x: 1110, y: 18, w: 70, h: 70 },
  pause: { x: 1192, y: 18, w: 70, h: 70 },
};

class Battle {
  constructor(level, loadout, opts = {}) {
    this.level = level;
    this.opts = opts;
    this.rng = new RNG(opts.seed || (Date.now() & 0xffffffff));
    this.cards = loadout.map(id => ({ id, cd: U[id].cd >= 30 ? U[id].cd * 0.6 : 0, cdMax: U[id].cd }));
    this.wrenchRect = { ...HUD.wrench, x: HUD.card0.x + loadout.length * (HUD.card0.w + HUD.card0.gap) + 10 };
    this.energy = level.startEnergy != null ? level.startEnergy : 50;
    this.grid = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.units = []; this.slimes = []; this.projs = []; this.pickups = []; this.fx = []; this.texts = [];
    this.sweepers = Array.from({ length: ROWS }, (_, r) => ({ r, state: 'ready', x: BX - 62 }));
    this.time = 0; this.skyTimer = 5;
    this.waveIdx = -1; this.waveTimer = opts.firstWave != null ? opts.firstWave : 20;
    this.totalWaves = level.waves;
    this.spawnQueue = [];
    this.state = 'play';
    this.selected = null;           // card index or 'wrench'
    this.pointer = { x: -1, y: -1, down: false, dragging: false, startX: 0, startY: 0, fromCard: false };
    this.banner = null;
    this.tip = level.tip ? { text: level.tip, t: 10 } : null;
    this.stats = { kills: 0, placed: 0, fused: 0, energyCollected: 0 };
    this.waveHp = 0;
    this.trophy = null;
    this.uid = 1;
    this.kingSpawned = false;
    this.showBanner('READY... DEFEND!', 2.5);
  }

  // ---------- helpers ----------
  showBanner(text, t = 3, color = '#fff') { this.banner = { text, t, max: t, color }; }
  floatText(x, y, text, color = '#fff') { this.texts.push({ x, y, text, color, life: 1 }); }
  isFlag(i) { return !this.level.endless ? ((i + 1) % 5 === 0 || i === this.totalWaves - 1) : ((i + 1) % 5 === 0); }
  slimeRows(s) { return s.def.boss ? [s.row - 1, s.row, s.row + 1] : [s.row]; }
  inRow(s, r) { return s.def.boss ? Math.abs(s.row - r) <= 1 : s.row === r; }
  alive(s) { return !s.dead; }

  // ---------- waves ----------
  composeWave(i) {
    const L = this.level;
    let budget = L.base + L.inc * i;
    if (this.isFlag(i)) budget = budget * (L.flagMul || 1.8) + 2;
    if (L.endless) budget *= 1 + i * 0.02;
    budget *= (this.opts.difficulty != null ? this.opts.difficulty : SS.difficultyMul());
    budget = Math.max(1, Math.floor(budget));
    const out = [];
    if (L.intro && i >= 1 && i <= 2 && SL[L.intro].cost <= budget) { out.push(L.intro); budget -= SL[L.intro].cost; }
    let brutes = 0; const maxBrutes = i < 2 ? 0 : Math.floor(i / 3) + 1;
    let guard = 200;
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
    if (final && this.level.boss) { list = this.composeWave(Math.max(0, i - 3)); }
    const spread = flag ? 7 : 3.5;
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
    this.curWaveSpawned = list.length;
    if (final) { this.showBanner(this.level.boss ? 'KING GLOOP APPROACHES!' : 'FINAL WAVE', 3.5, '#ff6b6b'); SS.Audio.play('finalWave'); }
    else if (flag) { this.showBanner('SLIME SURGE INCOMING!', 3, '#ffd84a'); SS.Audio.play('surge'); }
    else if (i === 0) SS.Audio.play('surge');
    this.waveTimer = flag ? 34 : 26;
  }
  spawnSlime(type, row, x) {
    const d = SL[type];
    const s = {
      id: this.uid++, type, def: d, row, x: x != null ? x : W + 30 + this.rng.range(0, 60),
      hp: d.hp, maxHp: d.hp, armor: d.armor || 0, maxArmor: d.armor || 0, front: d.front || 0,
      slowT: 0, freezeT: 0, eating: false, eatTarget: null, hopped: false, hop: null,
      smashT: d.smash || 0, flash: 0, dead: false, dieT: 0, phase: this.rng.range(0, 6), chompT: 0,
      summonT: 12, gooT: 8,
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
  placeCheck(ci, r, c) {
    const card = this.cards[ci]; if (!card) return { ok: false, why: 'nocard' };
    const d = U[card.id];
    if (card.cd > 0) return { ok: false, why: 'cooldown' };
    if (this.energy < d.cost) return { ok: false, why: 'energy' };
    const cur = this.grid[r][c];
    if (!cur) return { ok: true, mode: 'place' };
    const res = SS.FUSIONS[SS.fkey(cur.id, card.id)];
    if (res) return { ok: true, mode: 'fuse', result: res };
    return { ok: false, why: 'occupied' };
  }
  place(ci, r, c) {
    const chk = this.placeCheck(ci, r, c);
    if (!chk.ok) { SS.Audio.play('invalid'); if (chk.why === 'energy') this.flashEnergy = 0.6; return false; }
    const card = this.cards[ci], d = U[card.id];
    this.energy -= d.cost; card.cd = card.cdMax;
    if (chk.mode === 'fuse') {
      const old = this.grid[r][c];
      this.removeUnit(old, true);
      this.addUnit(chk.result, r, c);
      this.stats.fused++;
      SS.Audio.play('fuse');
      for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; this.fx.push({ k: 'p', x: tileX(c), y: tileY(r), vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, life: 0.6, max: 0.6, color: i % 2 ? '#ffd84a' : '#fff', size: 4 }); }
      this.fx.push({ k: 'ring', x: tileX(c), y: tileY(r), life: 0.5, max: 0.5, color: '#ffd84a', r0: 10, r1: 70 });
      this.floatText(tileX(c), tileY(r) - 50, U[chk.result].name + '!', '#ffd84a');
      if (SS.onDiscover) SS.onDiscover(chk.result);
    } else {
      this.addUnit(card.id, r, c);
      SS.Audio.play('place');
      for (let i = 0; i < 8; i++) this.fx.push({ k: 'p', x: tileX(c) + this.rng.range(-30, 30), y: groundY(r), vx: this.rng.range(-40, 40), vy: this.rng.range(-80, -20), life: 0.4, max: 0.4, color: '#9aa', size: 3 });
    }
    this.stats.placed++;
    this.selected = null;
    return true;
  }
  addUnit(id, r, c) {
    const d = U[id];
    const u = { uid: this.uid++, id, def: d, r, c, x: tileX(c), y: tileY(r), hp: d.hp, maxHp: d.hp, t: 0, flash: 0, fireT: 0, prodGlow: 0, phase: this.rng.range(0, 6),
      beh: d.beh.map(b => ({ ...b, timer: b.t === 'produce' ? (b.first || b.rate) : (b.t === 'shoot' ? 0.4 : b.rate * 0.5), armT: 0, fuseT: b.fuse || 0 })) };
    this.grid[r][c] = u; this.units.push(u);
    return u;
  }
  removeUnit(u, silent) {
    if (!u || u.removed) return;
    u.removed = true;
    if (this.grid[u.r][u.c] === u) this.grid[u.r][u.c] = null;
    this.units = this.units.filter(x => x !== u);
    if (!silent) {
      SS.Audio.play('unitDie');
      for (let i = 0; i < 12; i++) this.fx.push({ k: 'p', x: u.x + this.rng.range(-20, 20), y: u.y + this.rng.range(-20, 20), vx: this.rng.range(-120, 120), vy: this.rng.range(-200, -40), g: 500, life: 0.7, max: 0.7, color: i % 2 ? '#8892a6' : '#444b58', size: 4 });
    }
  }
  wrench(r, c) {
    const u = this.grid[r][c];
    if (!u) { SS.Audio.play('invalid'); return false; }
    this.removeUnit(u); this.selected = null; return true;
  }

  // ---------- damage ----------
  damage(s, dmg, kind) {
    if (s.dead) return;
    s.flash = 0.08;
    if (kind === 'bolt' && s.front > 0) {
      s.front -= dmg; SS.Audio.play('armorHit');
      if (s.front <= 0) { s.front = 0; SS.Audio.play('shieldBreak'); this.fx.push({ k: 'debris', x: s.x - 40, y: groundY(s.row) - 30, vx: 60, vy: -200, rot: 0, vr: 6, life: 1, max: 1, w: 14, h: 40, color: '#9aa6b4' }); }
      return;
    }
    if (s.armor > 0) {
      const a = Math.min(s.armor, dmg); s.armor -= a; dmg -= a;
      SS.Audio.play('armorHit');
      if (s.armor <= 0) { this.fx.push({ k: 'debris', x: s.x, y: groundY(s.row) - 50 * s.def.size, vx: 80, vy: -260, rot: 0, vr: 8, life: 1, max: 1, w: 34, h: 16, color: s.type === 'iron' ? '#8f9aa8' : '#b0a090' }); }
    }
    if (dmg > 0) { s.hp -= dmg; if (kind !== 'flame' && kind !== 'zap') SS.Audio.play('hit'); }
    if (s.hp <= 0) this.kill(s);
  }
  kill(s) {
    if (s.dead) return;
    s.dead = true; s.dieT = 0; this.stats.kills++;
    this.lastKillPos = { x: s.x, y: tileY(s.row) };
    SS.Audio.play('slimeDie');
    for (let i = 0; i < 10; i++) this.fx.push({ k: 'p', x: s.x + this.rng.range(-20, 20), y: groundY(s.row) - 20, vx: this.rng.range(-140, 140), vy: this.rng.range(-220, -60), g: 600, life: 0.6, max: 0.6, color: s.def.color, size: 5 });
    if (s.def.split) for (let k = 0; k < s.def.split; k++) { const m = this.spawnSlime('mini', s.row, s.x + (k ? 26 : -10)); m.hopped = true; }
    if (s.def.boss) { this.slimes.filter(z => !z.dead && z !== s).forEach(z => this.kill(z)); this.spawnQueue = []; this.explode(s.x, tileY(s.row), 0, 0, null, true); }
    if (s.type === 'brute') this.fx.push({ k: 'shake', life: 0.3, max: 0.3, mag: 6 });
  }
  explode(cx, cy, r, dmg, freeze, visualOnly) {
    SS.Audio.play('explode');
    this.fx.push({ k: 'ring', x: cx, y: cy, life: 0.5, max: 0.5, color: '#ffb040', r0: 10, r1: Math.max(80, r * TW) });
    this.fx.push({ k: 'flash', x: cx, y: cy, life: 0.25, max: 0.25, rad: Math.max(90, r * TW * 1.1) });
    this.fx.push({ k: 'shake', life: 0.35, max: 0.35, mag: 8 });
    for (let i = 0; i < 30; i++) { const a = this.rng.range(0, 6.28), sp = this.rng.range(80, 380); this.fx.push({ k: 'p', x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 80, g: 300, life: 0.8, max: 0.8, color: ['#ffe36a', '#ff9a2a', '#ff5a2a', '#555'][i % 4], size: 6 }); }
    if (visualOnly) return;
    const rows = Math.floor(r + 0.001);
    for (const s of this.slimes) {
      if (s.dead) continue;
      const rowHit = s.def.boss ? this.slimeRows(s).some(rr => Math.abs(rr - Math.round((cy - BY - TH / 2) / TH)) <= rows) : Math.abs(tileY(s.row) - cy) <= rows * TH + 5;
      if (rowHit && Math.abs(s.x - cx) <= r * TW + 20 * s.def.size) this.damage(s, dmg, 'explode');
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

  // ---------- update ----------
  update(dt) {
    if (this.state !== 'play' && this.state !== 'clear') { this.updateFx(dt); return; }
    this.time += dt;
    if (this.banner) { this.banner.t -= dt; if (this.banner.t <= 0) this.banner = null; }
    if (this.tip) { this.tip.t -= dt; if (this.tip.t <= 0) this.tip = null; }
    if (this.flashEnergy > 0) this.flashEnergy -= dt;
    for (const c of this.cards) if (c.cd > 0) c.cd = Math.max(0, c.cd - dt);

    // sky energy
    if (this.state === 'play') {
      this.skyTimer -= dt;
      if (this.skyTimer <= 0) {
        this.skyTimer = this.rng.range(8, 11.5);
        const x = this.rng.range(BX + 40, BX + COLS * TW - 40);
        this.pickups.push({ x, y: BY + 4, ty: this.rng.range(BY + 60, BY + ROWS * TH - 40), vy: 70, val: 25, life: 10, sky: true, t: 0 });
      }
    }

    // waves
    if (this.state === 'play') {
      const more = this.level.endless || this.waveIdx < this.totalWaves - 1;
      if (more) {
        this.waveTimer -= dt;
        if (this.waveIdx >= 0 && this.spawnQueue.length === 0) {
          const live = this.slimes.filter(s => !s.dead && !s.def.boss);
          const rem = live.reduce((a, s) => a + s.hp + s.armor + s.front, 0);
          if (live.length === 0 && this.waveTimer > 4) this.waveTimer = 4;
          else if (rem < this.waveHp * 0.35 && this.waveTimer > 7) this.waveTimer = 7;
        }
        if (this.waveTimer <= 0) this.startWave();
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
              for (let i = 0; i < b.shots; i++) this.projs.push({ k: b.bolt, r: u.r, x: u.x + 46, y: u.y - (u.def.parts.body === 'wall' ? 18 : 0) + 2 + (b.shots > 1 ? (i % 2 ? 4 : -4) : 0), vx: 560, dmg: b.dmg, splash: b.splash || 0, sr: b.sr || 0, delay: i * 0.13, hit: new Set() });
              u.fireT = 0.1; SS.Audio.play('shoot');
            }
            break;
          }
          case 'produce': {
            b.timer -= dt;
            if (b.timer <= 0) {
              b.timer = b.rate * this.rng.range(0.95, 1.05);
              this.pickups.push({ x: u.x + this.rng.range(-20, 20), y: u.y - 20, ty: u.y + this.rng.range(0, 30), vy: -160, vx: this.rng.range(-50, 50), val: b.val, life: 10, sky: false, t: 0 });
              u.prodGlow = 0.6;
            }
            break;
          }
          case 'mine': {
            b.armT += dt;
            break;
          }
          case 'bomb': {
            b.fuseT -= dt;
            if (b.fuseT <= 0) { this.removeUnit(u, true); this.explode(u.x, u.y, b.r, b.dmg, b.freeze); }
            break;
          }
          case 'lob': {
            b.timer -= dt;
            if (b.timer <= 0) {
              const tgt = this.firstAhead(u.r, u.x);
              if (tgt) {
                b.timer = b.rate;
                const flight = 1.0;
                const sp = tgt.def.speed * (tgt.slowT > 0 ? 0.5 : 1) * (tgt.freezeT > 0 || tgt.eating ? 0 : 1);
                const tx = Math.max(u.x + 40, tgt.x - sp * flight);
                this.projs.push({ k: 'lob', r: u.r, x0: u.x - 10, y0: u.y - 40, x: u.x - 10, y: u.y - 40, tx, ty: groundY(u.r) - 25, t: 0, flight, dmg: b.dmg, splash: b.splash, sr: b.sr, slow: b.slow, fire: b.fire, target: tgt });
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
                for (const s of this.slimes) if (!s.dead && this.inRow(s, u.r) && s.x > u.x - 20 && s.x < maxX) { this.damage(s, b.dmg, 'flame'); if (b.slow) s.slowT = Math.max(s.slowT, 4); }
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
                  this.damage(s, b.dmg, 'zap');
                }
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
          this.floatText(s.x, tileY(s.row) - 120, 'SUMMON!', '#9f9');
          SS.Audio.play('surge');
        }
        s.gooT -= dt;
        if (s.gooT <= 0) {
          s.gooT = 9;
          const targets = this.units.filter(u => u.x < s.x - 60);
          if (targets.length) {
            const tgt = this.rng.pick(targets);
            this.projs.push({ k: 'goo', x0: s.x - 60, y0: tileY(s.row) - 120, x: s.x - 60, y: tileY(s.row) - 120, tx: tgt.x, ty: tgt.y, t: 0, flight: 1.4, target: tgt });
            SS.Audio.play('lob');
          }
        }
      }
      const u = this.blockingUnit(s);
      if (u) {
        const mineB = u.beh.find(b => b.t === 'mine');
        if (mineB && mineB.armT >= mineB.arm) {
          this.removeUnit(u, true);
          this.explode(u.x, u.y, mineB.r, mineB.dmg);
          continue;
        }
        if (s.def.hop && !s.hopped && !u.def.tall) {
          s.hopped = true; s.hop = { from: s.x, to: BX + u.c * TW - 30, t: 0 };
          SS.Audio.play('hop');
          continue;
        }
        if (u.def.chill) s.slowT = Math.max(s.slowT, 3);
        if (u.def.thorns) this.damage(s, u.def.thorns * dt, 'flame');
        if (s.dead) continue;
        if (s.def.smash) {
          s.eating = true;
          s.smashT -= dt * (mul || 0);
          if (s.smashT <= 0) {
            s.smashT = s.def.smash;
            const victims = s.def.boss ? this.slimeRows(s).map(r => r >= 0 && r < ROWS && this.grid[r].find(x => x && Math.abs(x.x - (s.x - 60)) < TW)).filter(Boolean) : [u];
            for (const v of victims) { v.hp -= 3000; v.flash = 0.2; if (v.hp <= 0) this.removeUnit(v); }
            SS.Audio.play('smash');
            this.fx.push({ k: 'shake', life: 0.3, max: 0.3, mag: 7 });
            this.fx.push({ k: 'ring', x: u.x, y: groundY(u.r), life: 0.4, max: 0.4, color: '#c8a0ff', r0: 10, r1: 70 });
          }
          continue;
        }
        s.eating = true;
        const chew = s.def.dps * dt * (mul === 0 ? 0 : (s.slowT > 0 || u.def.chill ? 0.5 : 1));
        u.hp -= chew; if (chew > 0) u.flash = 0.06;
        s.chompT -= dt;
        if (s.chompT <= 0 && mul > 0) { s.chompT = 0.45; SS.Audio.play('chomp'); }
        if (u.hp <= 0) this.removeUnit(u);
      } else {
        s.x -= s.def.speed * mul * dt;
      }
      // reach base
      if (!s.def.boss && s.x < BX - 10) {
        const sw = this.sweepers[s.row];
        if (sw.state === 'ready') { sw.state = 'go'; SS.Audio.play('sweeper'); }
        else if (sw.state === 'used' && s.x < 24) this.lose(s);
      }
      if (s.def.boss && s.x < BX + 40) this.lose(s);
    }
    // track last kill pos & cleanup
    this.slimes = this.slimes.filter(s => !s.dead || s.dieT < 0.7);
  }

  updateProjs(dt) {
    for (const p of this.projs) {
      if (p.done) continue;
      if (p.k === 'lob' || p.k === 'goo') {
        p.t += dt / p.flight;
        const t = Math.min(1, p.t);
        p.x = p.x0 + (p.tx - p.x0) * t;
        p.y = p.y0 + (p.ty - p.y0) * t - Math.sin(t * Math.PI) * 140;
        if (p.t >= 1) {
          p.done = true;
          if (p.k === 'goo') {
            const tg = p.target; if (tg && !tg.removed) { tg.hp -= 600; tg.flash = 0.3; if (tg.hp <= 0) this.removeUnit(tg); }
            for (let i = 0; i < 12; i++) this.fx.push({ k: 'p', x: p.x, y: p.y, vx: this.rng.range(-150, 150), vy: this.rng.range(-200, -40), g: 500, life: 0.6, max: 0.6, color: '#5bd65b', size: 5 });
            SS.Audio.play('slimeDie');
            continue;
          }
          let primary = null;
          if (p.target && !p.target.dead && Math.abs(p.target.x - p.x) < 70) primary = p.target;
          else primary = this.slimes.filter(s => !s.dead && this.inRow(s, p.r) && Math.abs(s.x - p.x) < 50).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0];
          if (primary) { this.damage(primary, p.dmg, 'lob'); if (p.slow) primary.slowT = Math.max(primary.slowT, 6); }
          for (const s of this.slimes) if (s !== primary && !s.dead && this.inRow(s, p.r) && Math.abs(s.x - p.x) < p.sr * TW + 10) { this.damage(s, p.splash, 'lob'); if (p.slow) s.slowT = Math.max(s.slowT, 6); }
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
          if (p.k === 'arc') { p.hit.add(s); this.damage(s, p.dmg, 'zap'); SS.Audio.play('hit'); this.fx.push({ k: 'spark', x: p.x, y: p.y, life: 0.15, max: 0.15, color: '#c9b8ff' }); continue; }
          p.done = true;
          this.damage(s, p.dmg, 'bolt');
          if (p.k === 'ice' && !(s.front > 0)) s.slowT = Math.max(s.slowT, 10);
          if (p.k === 'fire' && p.splash) {
            s.slowT = 0;
            for (const o of this.slimes) if (o !== s && !o.dead && this.inRow(o, p.r) && Math.abs(o.x - s.x) < p.sr * TW + 10) this.damage(o, p.splash, 'lob');
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
      if (auto && e.t > 0.8) this.collect(e);
      if (e.life <= 0) e.done = true;
    }
    this.pickups = this.pickups.filter(e => !e.done);
  }
  collect(e) {
    if (e.collecting) return;
    e.collecting = true; e.ct = 0; e.cx0 = e.x; e.cy0 = e.y;
    SS.Audio.play('collect');
  }
  collectTrophy() {
    if (this.state !== 'clear') return;
    this.state = 'won';
    SS.Audio.play('win');
    if (SS.onBattleEnd) SS.onBattleEnd(true, this);
  }
  lose(s) {
    if (this.state !== 'play') return;
    this.state = 'lost';
    SS.Audio.play('lose');
    if (SS.onBattleEnd) SS.onBattleEnd(false, this);
  }

  updateSweepers(dt) {
    for (const sw of this.sweepers) {
      if (sw.state !== 'go') continue;
      sw.x += 520 * dt;
      for (const s of this.slimes) if (!s.dead && s.row === sw.r && Math.abs(s.x - (sw.x + 30)) < 40) { if (s.def.boss) this.damage(s, 2000, 'explode'); else this.kill(s); }
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
  hudHit(x, y) {
    const C = HUD.card0;
    for (let i = 0; i < this.cards.length; i++) {
      const cx = C.x + i * (C.w + C.gap);
      if (x >= cx && x <= cx + C.w && y >= C.y && y <= C.y + C.h) return { k: 'card', i };
    }
    const wr = this.wrenchRect;
    if (x >= wr.x && x <= wr.x + wr.w && y >= wr.y && y <= wr.y + wr.h) return { k: 'wrench' };
    for (const k of ['speed', 'pause']) { const b = HUD[k]; if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return { k }; }
    return null;
  }
  selectCard(i) {
    if (i === this.selected) { this.selected = null; return; }
    const c = this.cards[i]; if (!c) return;
    if (c.cd > 0 || this.energy < U[c.id].cost) { SS.Audio.play('invalid'); if (this.energy < U[c.id].cost) this.flashEnergy = 0.6; return; }
    this.selected = i; SS.Audio.play('select');
  }
  pickupAt(x, y) {
    let best = null, bd = 52;
    for (const e of this.pickups) { if (e.collecting) continue; const d = Math.hypot(e.x - x, e.y - y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  onDown(x, y) {
    if (this.tip) { this.tip = null; }
    const P = this.pointer;
    P.down = true; P.x = x; P.y = y; P.startX = x; P.startY = y; P.dragging = false; P.fromCard = false;
    if (this.state === 'clear' && this.trophy && Math.hypot(this.trophy.x - x, this.trophy.y - y) < 80) { this.collectTrophy(); return; }
    if (this.state !== 'play' && this.state !== 'clear') return;
    const h = this.hudHit(x, y);
    const pk = h ? null : this.pickupAt(x, y);
    if (pk) { this.collect(pk); P.down = false; return; }
    if (h) {
      if (h.k === 'card') {
        if (this.selected === h.i) { P.fromCard = true; P.toggleOnUp = true; }   // deselect on up only if no drag
        else { this.selectCard(h.i); P.fromCard = this.selected === h.i; P.toggleOnUp = false; }
      }
      else if (h.k === 'wrench') { this.selected = this.selected === 'wrench' ? null : 'wrench'; SS.Audio.play('select'); P.fromCard = this.selected === 'wrench'; }
      else if (h.k === 'pause') { SS.Audio.play('click'); SS.togglePause && SS.togglePause(); }
      else if (h.k === 'speed') { SS.Audio.play('click'); SS.toggleSpeed && SS.toggleSpeed(); }
      return;
    }
    // tap on board
    const cell = this.cellAt(x, y);
    if (cell && this.selected != null) { this.applyAt(cell); P.down = false; return; }
    if (!cell && y < BY) this.selected = null;
  }
  applyAt(cell) {
    if (this.selected === 'wrench') this.wrench(cell.r, cell.c);
    else if (this.selected != null) this.place(this.selected, cell.r, cell.c);
  }
  onMove(x, y) {
    const P = this.pointer; P.x = x; P.y = y;
    if (P.down && P.fromCard && Math.hypot(x - P.startX, y - P.startY) > 12) P.dragging = true;
  }
  onUp(x, y) {
    const P = this.pointer; P.x = x; P.y = y;
    if (P.down && P.dragging && this.selected != null) {
      const cell = this.cellAt(x, y);
      if (cell) this.applyAt(cell);
      else if (y > BY) { /* dropped off-board: keep selected */ }
    }
    else if (P.down && P.toggleOnUp && !P.dragging) { this.selected = null; }
    P.down = false; P.dragging = false; P.fromCard = false; P.toggleOnUp = false;
  }

  // ---------- render ----------
  render(ctx, bg, rt) {
    let shake = 0;
    for (const f of this.fx) if (f.k === 'shake') shake = Math.max(shake, f.mag * (f.life / f.max));
    ctx.save();
    if (shake && !SS.settings.reduceMotion) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.drawImage(bg, 0, 0);
    const t = this.time;

    // highlight hovered cell
    const P = this.pointer;
    const hov = this.cellAt(P.x, P.y);
    if (this.selected != null && this.selected !== 'wrench') {
      const id = this.cards[this.selected].id;
      for (const u of this.units) if (SS.FUSIONS[SS.fkey(u.id, id)]) {
        const a = 0.35 + 0.25 * Math.sin(rt * 6);
        ctx.strokeStyle = `rgba(255,216,74,${a + 0.3})`; ctx.lineWidth = 4;
        SS.Art.rr(ctx, BX + u.c * TW + 4, BY + u.r * TH + 4, TW - 8, TH - 8, 10); ctx.stroke();
      }
    }
    if (hov && this.selected != null && (P.down || !SS.isTouch)) {
      let col = 'rgba(255,255,255,0.18)';
      if (this.selected === 'wrench') col = this.grid[hov.r][hov.c] ? 'rgba(255,90,90,0.35)' : 'rgba(255,255,255,0.08)';
      else { const chk = this.placeCheck(this.selected, hov.r, hov.c); col = chk.ok ? (chk.mode === 'fuse' ? 'rgba(255,216,74,0.4)' : 'rgba(120,255,140,0.25)') : 'rgba(255,90,90,0.3)'; }
      ctx.fillStyle = col; ctx.fillRect(BX + hov.c * TW, BY + hov.r * TH, TW, TH);
      // row/col guide
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(BX, BY + hov.r * TH, COLS * TW, TH);
    }

    // sweepers
    for (const sw of this.sweepers) if (sw.state !== 'used') this.drawSweeper(ctx, sw, rt);

    // entities by row
    for (let r = 0; r < ROWS; r++) {
      for (const u of this.units) if (u.r === r) this.drawUnit(ctx, u, rt);
      const row = this.slimes.filter(s => s.row === r && !s.def.boss).sort((a, b) => b.x - a.x);
      for (const s of row) this.drawSlimeEnt(ctx, s, rt);
    }
    for (const s of this.slimes) if (s.def.boss) this.drawSlimeEnt(ctx, s, rt);

    // projectiles
    for (const p of this.projs) this.drawProj(ctx, p, rt);
    this.drawFx(ctx, rt);
    // pickups
    for (const e of this.pickups) {
      ctx.save(); ctx.translate(e.x, e.y);
      if (e.life < 2 && !e.collecting) ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(rt * 10));
      SS.Art.drawEnergy(ctx, rt + e.x, e.collecting ? 0.8 : 1.1);
      ctx.restore();
    }
    if (this.trophy && this.state === 'clear') {
      ctx.save(); ctx.translate(this.trophy.x, this.trophy.y + Math.sin(rt * 3) * 6);
      ctx.fillStyle = 'rgba(255,240,150,0.25)'; ctx.beginPath(); ctx.arc(0, 0, 60 + Math.sin(rt * 5) * 6, 0, 6.29); ctx.fill();
      ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 3;
      SS.Art.rr(ctx, -28, -34, 56, 68, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#7a5a00'; ctx.font = 'bold 14px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('CORE', 0, 5);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui,sans-serif'; ctx.fillText('Tap!', 0, 60);
      ctx.restore();
    }
    // texts
    for (const tx of this.texts) {
      ctx.globalAlpha = Math.min(1, tx.life * 2); ctx.font = 'bold 22px system-ui,sans-serif'; ctx.textAlign = 'center';
      ctx.lineWidth = 4; ctx.strokeStyle = '#000'; ctx.strokeText(tx.text, tx.x, tx.y); ctx.fillStyle = tx.color; ctx.fillText(tx.text, tx.x, tx.y);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    this.drawHUD(ctx, rt);

    // drag ghost
    if (this.selected != null && this.selected !== 'wrench' && P.x >= 0 && (P.dragging || (!SS.isTouch && P.y > BY))) {
      ctx.save(); ctx.translate(P.x, P.y + 10); SS.Art.drawRobot(ctx, this.cards[this.selected].id, rt, { alpha: 0.65, scale: 0.85 }); ctx.restore();
    } else if (this.selected === 'wrench' && P.x >= 0 && (P.dragging || !SS.isTouch)) {
      ctx.save(); ctx.translate(P.x, P.y); this.drawWrenchIcon(ctx, 0.9); ctx.restore();
    }

    // banner
    if (this.banner) {
      const b = this.banner, k = Math.min(1, (b.max - b.t) * 4, b.t * 2);
      ctx.save(); ctx.globalAlpha = k;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, H / 2 - 50, W, 100);
      ctx.font = '900 56px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 8; ctx.strokeStyle = '#000'; ctx.strokeText(b.text, W / 2, H / 2);
      ctx.fillStyle = b.color; ctx.fillText(b.text, W / 2, H / 2);
      ctx.restore();
    }
    if (this.tip) {
      ctx.save();
      const tw = 760, th = 76, tx = (W - tw) / 2, ty = H - th - 18;
      ctx.globalAlpha = Math.min(1, this.tip.t);
      ctx.fillStyle = 'rgba(12,18,30,0.9)'; SS.Art.rr(ctx, tx, ty, tw, th, 14); ctx.fill();
      ctx.strokeStyle = '#3ad0ff'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#e8f6ff'; ctx.font = '600 20px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      wrapText(ctx, this.tip.text, W / 2, ty + th / 2, tw - 40, 24);
      ctx.restore();
    }
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
    SS.Art.drawRobot(ctx, u.id, rt, { firing: u.fireT > 0, hpRatio: u.hp / u.maxHp, armed: mine ? mine.armT >= mine.arm : undefined, fuse: bomb ? Math.max(0, bomb.fuseT / bomb.fuse) : null, producing: u.prodGlow > 0, phase: u.phase });
    if (u.flash > 0) { ctx.globalAlpha = 0.35; ctx.fillStyle = '#ff6060'; ctx.beginPath(); ctx.ellipse(0, 0, 40, 44, 0, 0, 6.29); ctx.fill(); ctx.globalAlpha = 1; }
    if (u.hp < u.maxHp && !bomb) {
      const w = 60, f = Math.max(0, u.hp / u.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(-w / 2, -56, w, 6);
      ctx.fillStyle = f > 0.5 ? '#5f5' : f > 0.25 ? '#fd4' : '#f55'; ctx.fillRect(-w / 2, -56, w * f, 6);
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
    ctx.save(); ctx.translate(s.x, y);
    SS.Art.drawSlime(ctx, s.type, this.time + s.phase, {
      moving: !s.eating && s.freezeT <= 0, eating: s.eating, armor: s.armor, armorRatio: s.maxArmor ? s.armor / s.maxArmor : 1, front: s.front,
      slow: s.slowT > 0, frozen: s.freezeT > 0, flash: s.flash > 0, melt: s.dead ? Math.min(1, s.dieT / 0.6) : null, alpha: s.dead ? 1 - s.dieT / 0.7 : 1, phase: s.phase,
    });
    ctx.restore();
    if (s.def.boss && !s.dead) {
      const w = 300, f = Math.max(0, s.hp / s.maxHp);
      const bx = W / 2 - w / 2, by = H - 30;
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 4, by - 4, w + 8, 22);
      ctx.fillStyle = '#5bd65b'; ctx.fillRect(bx, by, w * f, 14);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('KING GLOOP', W / 2, by - 8);
    }
  }
  drawProj(ctx, p, rt) {
    if (p.delay > 0) return;
    ctx.save(); ctx.translate(p.x, p.y);
    if (p.k === 'lob' || p.k === 'goo') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(p.tx - p.x, p.ty - p.y + 22, 10, 4, 0, 0, 6.29); ctx.fill();
      ctx.fillStyle = p.k === 'goo' ? '#5bd65b' : p.fire ? '#ff8a2a' : p.slow ? '#cff6ff' : '#5c6a50';
      ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, p.k === 'goo' ? 16 : 10, 0, 6.29); ctx.fill(); ctx.stroke();
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
        case 'flash': { ctx.globalAlpha = k * 0.8; const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.rad); g.addColorStop(0, '#fff7c0'); g.addColorStop(0.5, '#ffb040'); g.addColorStop(1, 'rgba(255,90,20,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(f.x, f.y, f.rad, 0, 6.29); ctx.fill(); break; }
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
        case 'frost': ctx.globalAlpha = k * 0.35; ctx.fillStyle = '#bff2ff'; ctx.fillRect(0, 0, W, H); break;
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
  drawHUD(ctx, rt) {
    // panel
    ctx.fillStyle = '#121a2a'; ctx.fillRect(0, 0, W, 112);
    ctx.fillStyle = '#2a3a5a'; ctx.fillRect(0, 110, W, 3);
    // energy
    const E = HUD.energy;
    ctx.fillStyle = this.flashEnergy > 0 && Math.sin(rt * 30) > 0 ? '#5a1a1a' : '#1e2a40'; SS.Art.rr(ctx, E.x, E.y, E.w, E.h, 12); ctx.fill();
    ctx.strokeStyle = '#3ad0ff'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.translate(E.x + E.w / 2, E.y + 34); SS.Art.drawEnergy(ctx, 0, 0.9); ctx.restore();
    ctx.fillStyle = '#fff'; ctx.font = '800 28px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(Math.floor(this.energy)), E.x + E.w / 2, E.y + 78);
    // cards
    const C = HUD.card0;
    this.cards.forEach((c, i) => {
      const x = C.x + i * (C.w + C.gap), y = C.y, d = U[c.id];
      const sel = this.selected === i;
      const afford = this.energy >= d.cost;
      ctx.fillStyle = sel ? '#3b5a8a' : '#24324d'; SS.Art.rr(ctx, x, y + (sel ? 4 : 0), C.w, C.h, 10); ctx.fill();
      ctx.strokeStyle = sel ? '#ffd84a' : '#4a5f88'; ctx.lineWidth = sel ? 3 : 2; ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 2, C.w - 4, C.h - 4); ctx.clip();
      ctx.translate(x + C.w / 2, y + 48 + (sel ? 4 : 0)); SS.Art.drawRobot(ctx, c.id, 0, { scale: 0.62, noBadge: true }); ctx.restore();
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x + 2, y + C.h - 24 + (sel ? 4 : 0), C.w - 4, 22);
      ctx.fillStyle = afford ? '#ffe94a' : '#ff7070'; ctx.font = '800 18px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(d.cost), x + C.w / 2, y + C.h - 13 + (sel ? 4 : 0));
      if (c.cd > 0 || !afford) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x, y, C.w, C.h);
        if (c.cd > 0) { const f = c.cd / c.cdMax; ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(x, y, C.w, C.h * f); }
      }
      if (SS.showKeys) { ctx.fillStyle = '#9ab'; ctx.font = '600 12px system-ui'; ctx.textAlign = 'left'; ctx.fillText(String(i + 1), x + 6, y + 12); }
    });
    // wrench
    const wr = this.wrenchRect;
    ctx.fillStyle = this.selected === 'wrench' ? '#5a3b3b' : '#2a2433'; SS.Art.rr(ctx, wr.x, wr.y, wr.w, wr.h, 10); ctx.fill();
    ctx.strokeStyle = this.selected === 'wrench' ? '#ff8080' : '#5a4a6a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.translate(wr.x + wr.w / 2, wr.y + wr.h / 2 - 6); this.drawWrenchIcon(ctx, 1); ctx.restore();
    ctx.fillStyle = '#ccc'; ctx.font = '600 13px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Remove', wr.x + wr.w / 2, wr.y + wr.h - 12);
    // progress
    const PR = HUD.progress;
    ctx.fillStyle = '#ccd'; ctx.font = '700 15px system-ui,sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(this.level.endless ? `Endless — Wave ${Math.max(0, this.waveIdx + 1)}` : `${this.level.label || ''} ${this.level.name}`, PR.x, PR.y - 18);
    if (!this.level.endless) {
      ctx.fillStyle = '#0a0f18'; SS.Art.rr(ctx, PR.x, PR.y, PR.w, PR.h, 9); ctx.fill();
      const f = Math.max(0, (this.waveIdx + 1) / this.totalWaves);
      ctx.fillStyle = '#5bd65b'; SS.Art.rr(ctx, PR.x + PR.w * (1 - f), PR.y, PR.w * f, PR.h, 9); ctx.fill();
      for (let i = 0; i < this.totalWaves; i++) if (this.isFlag(i)) {
        const fx = PR.x + PR.w * (1 - (i + 1) / this.totalWaves) + 2;
        ctx.fillStyle = i <= this.waveIdx ? '#ffd84a' : '#d33'; ctx.fillRect(fx, PR.y - 10, 3, 18);
        ctx.beginPath(); ctx.moveTo(fx + 3, PR.y - 10); ctx.lineTo(fx + 14, PR.y - 6); ctx.lineTo(fx + 3, PR.y - 2); ctx.fill();
      }
      ctx.fillStyle = '#9ab'; ctx.font = '600 13px system-ui,sans-serif';
      ctx.fillText(`Wave ${Math.max(0, this.waveIdx + 1)}/${this.totalWaves}`, PR.x, PR.y + PR.h + 16);
    } else {
      ctx.fillStyle = '#9ab'; ctx.font = '600 13px system-ui,sans-serif'; ctx.fillText(`Best: ${SS.save.endlessBest || 0}`, PR.x, PR.y + 12);
    }
    // speed & pause
    for (const k of ['speed', 'pause']) {
      const b = HUD[k];
      ctx.fillStyle = '#24324d'; SS.Art.rr(ctx, b.x, b.y, b.w, b.h, 12); ctx.fill(); ctx.strokeStyle = '#4a5f88'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff';
      if (k === 'pause') { ctx.fillRect(b.x + 24, b.y + 20, 8, 30); ctx.fillRect(b.x + 38, b.y + 20, 8, 30); }
      else { ctx.font = '800 22px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText((SS.speed || 1) + '×', b.x + b.w / 2, b.y + b.h / 2); }
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
