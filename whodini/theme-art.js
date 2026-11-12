// Recruiters vs. Candidates — Whodini look: office background, Leads, projectiles and fallback art.
// Loaded after js/game.js and before js/main.js. Illustrated sprites come from whodini/assets/sprites/.
'use strict';
(() => {
const A = SS.Art;
const { W, H, COLS, ROWS, TW, TH, BX, BY } = SS.CONST;
const P = { purple: '#5C15E0', violet: '#7B3BF0', lav: '#C9B6FF', lav2: '#E6DCFF', cream: '#F6F4EF', sand: '#EEEBE3', stone: '#DCD7CC',
  ink: '#1B1528', ink2: '#2B2438', mute: '#6B6475', night: '#120C1D', gold: '#F5C542', mint: '#2BB673' };
SS.PALETTE = P;

// Poppins everywhere the engine draws text
try {
  const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'font');
  Object.defineProperty(CanvasRenderingContext2D.prototype, 'font', { configurable: true, get: d.get,
    set(v) { d.set.call(this, String(v).replace(/system-ui/g, 'Poppins, system-ui')); } });
} catch (e) {}

// Whodini four-point sparkle (same shape as the logo's stars)
function sparkle(ctx, x, y, r) {
  ctx.beginPath(); ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x + r * 0.16, y - r * 0.16, x + r, y); ctx.quadraticCurveTo(x + r * 0.16, y + r * 0.16, x, y + r);
  ctx.quadraticCurveTo(x - r * 0.16, y + r * 0.16, x - r, y); ctx.quadraticCurveTo(x - r * 0.16, y - r * 0.16, x, y - r); ctx.closePath();
}
A.sparkle = sparkle;
const logo = new Image(); logo.onload = () => { A.bgDirty = true; }; logo.src = 'icons/whodini-logo.svg';

// ---------- Leads (the currency) ----------
A.drawEnergy = function (ctx, t, scale = 1) {
  ctx.save(); ctx.scale(scale, scale); ctx.rotate(Math.sin(t * 2) * 0.12);
  ctx.shadowColor = P.violet; ctx.shadowBlur = 16;
  ctx.fillStyle = P.purple; ctx.beginPath(); ctx.arc(0, 0, 21, 0, 6.29); ctx.fill();
  ctx.shadowBlur = 0; ctx.lineWidth = 3; ctx.strokeStyle = P.lav2; ctx.stroke();
  ctx.fillStyle = P.gold; sparkle(ctx, 0, 0, 14); ctx.fill();
  ctx.fillStyle = '#fff'; sparkle(ctx, 9, -9, 4.5); ctx.fill();
  ctx.restore();
};

// ---------- recruiters ----------
const TIER3 = { fusioncore: 'reactor', citadel: 'fortress', blizzard: 'gatling' };
const origRobot = A.drawRobot;
const TONES = ['#F2C9A0', '#C68B59', '#8D5A3B', '#F5D6B8', '#A86F4C'];
const HAIR = ['#2B2438', '#5A3825', '#C9862F', '#1B1528', '#8A8A8A'];
function hash(s) { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0; return Math.abs(h); }
function person(ctx, key, o) {
  // simple chunky office character facing right; mirrored by caller for candidates
  const h = hash(key), skin = TONES[h % 5], hair = HAIR[(h >> 3) % 5];
  const shirt = o.shirt || P.purple, pants = o.pants || P.ink2;
  const bob = o.bob || 0;
  ctx.fillStyle = 'rgba(27,21,40,0.18)'; A.ell(ctx, 0, 42, 30, 7); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = P.ink;
  A.rr(ctx, -12, 18 + bob, 10, 24, 4); ctx.fillStyle = pants; ctx.fill(); ctx.stroke();
  A.rr(ctx, 2, 18 + bob, 10, 24, 4); ctx.fill(); ctx.stroke();
  A.rr(ctx, -20, -14 + bob, 40, 38, 12); ctx.fillStyle = shirt; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -32 + bob, 21, 0, 6.29); ctx.fillStyle = skin; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -36 + bob, 21, Math.PI * 1.05, Math.PI * 1.95); ctx.lineTo(10, -42 + bob); ctx.closePath(); ctx.fillStyle = hair; ctx.fill();
  ctx.fillStyle = P.ink; A.ell(ctx, 8, -32 + bob, 2.6, 3.4); ctx.fill(); A.ell(ctx, -2, -32 + bob, 2.6, 3.4); ctx.fill();
  ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(4, -25 + bob, 5, 0.2, Math.PI - 0.2); ctx.stroke();
}
function featureArt(ctx, id, t) {
  const bob = Math.sin(t * 3) * 3;
  ctx.fillStyle = 'rgba(27,21,40,0.18)'; A.ell(ctx, 0, 40, 24, 6); ctx.fill();
  ctx.save(); ctx.translate(0, -6 + bob);
  ctx.shadowColor = P.violet; ctx.shadowBlur = 18;
  ctx.fillStyle = id === 'hamilton' ? P.purple : P.violet; ctx.beginPath(); ctx.arc(0, 0, 28, 0, 6.29); ctx.fill();
  ctx.shadowBlur = 0; ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.stroke();
  if (id === 'hamilton') {
    A.rr(ctx, -17, -11, 34, 20, 8); ctx.fillStyle = P.ink; ctx.fill();
    ctx.fillStyle = P.lav; A.ell(ctx, -7, -1, 3.5, 4.5); ctx.fill(); A.ell(ctx, 7, -1, 3.5, 4.5); ctx.fill();
    ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(0, -40); ctx.stroke();
    ctx.fillStyle = P.gold; sparkle(ctx, 0, -44, 9); ctx.fill();
  } else {
    ctx.strokeStyle = P.lav2; ctx.lineWidth = 3;
    for (const r of [8, 15, 22]) { ctx.beginPath(); ctx.arc(0, 4, r, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); }
    ctx.strokeStyle = P.gold; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(Math.cos(-1 + Math.sin(t * 2) * 0.5) * 20, 4 + Math.sin(-1 + Math.sin(t * 2) * 0.5) * 20); ctx.stroke();
    ctx.fillStyle = P.gold; sparkle(ctx, 18, -22, 7); ctx.fill();
  }
  ctx.restore();
}
function fallbackRobot(ctx, id, t, o) {
  const d = SS.UNITS[id]; if (!d) return;
  ctx.save();
  if (o.scale) ctx.scale(o.scale, o.scale);
  if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  const body = d.parts.body;
  if (body === 'feature') featureArt(ctx, id, t);
  else if (body === 'wall') {                      // interview desk
    ctx.fillStyle = 'rgba(27,21,40,0.18)'; A.ell(ctx, 0, 42, 40, 8); ctx.fill();
    const tall = d.tall ? 30 : 0;
    for (let i = -1; i <= 1; i++) { ctx.save(); ctx.translate(i * 20, -26 - tall); ctx.scale(0.55, 0.55); person(ctx, id + i, { shirt: P.ink2 }); ctx.restore(); }
    A.rr(ctx, -38, -20 - tall, 76, 62 + tall, 8); ctx.fillStyle = d.parts.color && id !== 'bulwark' ? P.violet : P.purple; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.stroke();
    ctx.fillStyle = P.gold; sparkle(ctx, 0, 10 - tall / 2, 10); ctx.fill();
    if (d.thorns) { ctx.fillStyle = '#E2463C'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(42, -14 + i * 14); ctx.lineTo(54, -8 + i * 14); ctx.lineTo(42, -2 + i * 14); ctx.fill(); } }
  } else if (body === 'mine') {
    ctx.fillStyle = 'rgba(27,21,40,0.2)'; A.ell(ctx, 0, 40, 28, 7); ctx.fill();
    A.ell(ctx, 0, 30, 26, 12); ctx.fillStyle = o.armed === false ? P.mute : P.purple; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.stroke();
    ctx.strokeStyle = P.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(-5, 27, 6, 0, 6.29); ctx.arc(5, 27, 6, 0, 6.29); ctx.stroke();
  } else if (body === 'bomb') {                    // job fair booth
    ctx.fillStyle = 'rgba(27,21,40,0.2)'; A.ell(ctx, 0, 42, 34, 7); ctx.fill();
    A.rr(ctx, -28, -10, 56, 50, 6); ctx.fillStyle = P.cream; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.stroke();
    for (let i = 0; i < 4; i++) { ctx.fillStyle = i % 2 ? P.cream : P.purple; ctx.fillRect(-32 + i * 16, -24, 16, 16); }
    ctx.strokeRect(-32, -24, 64, 16);
    for (const [bx, c] of [[-14, P.violet], [2, P.gold], [16, '#E2463C']]) { ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx, -24); ctx.lineTo(bx, -44); ctx.stroke(); ctx.fillStyle = c; A.ell(ctx, bx, -52, 8, 10); ctx.fill(); }
  } else if (body === 'crate') {
    ctx.fillStyle = 'rgba(27,21,40,0.2)'; A.ell(ctx, 0, 42, 32, 7); ctx.fill();
    A.rr(ctx, -28, -12, 56, 52, 6); ctx.fillStyle = '#C89B63'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.stroke();
    ctx.fillStyle = P.purple; ctx.fillRect(-6, -12, 12, 52); ctx.fillStyle = P.gold; sparkle(ctx, 0, 12, 10); ctx.fill();
  } else {
    const bob = Math.sin(t * 3 + (o.phase || 0)) * 1.5;
    person(ctx, id, { bob, shirt: d.fusion ? P.violet : P.purple });
    if (id === 'spark' || id === 'reactor' || id === 'dynamo' || id === 'fusioncore') {   // wizard hat
      ctx.beginPath(); ctx.moveTo(-24, -46 + bob); ctx.lineTo(4, -98 + bob); ctx.lineTo(24, -46 + bob); ctx.closePath();
      ctx.fillStyle = P.purple; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = P.ink; ctx.stroke();
      ctx.fillStyle = P.gold; sparkle(ctx, 2, -66 + bob, 7); ctx.fill();
      const glow = o.producing ? 1 : 0.5 + 0.3 * Math.sin(t * 4);
      ctx.globalAlpha *= glow; sparkle(ctx, 30, -60 + bob, 10); ctx.fill(); ctx.globalAlpha /= glow;
    } else {
      ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, -34 + bob, 23, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();   // headset
      ctx.fillStyle = P.ink; A.ell(ctx, 20, -32 + bob, 5, 7); ctx.fill();
    }
    if (d.fusion) { ctx.fillStyle = P.gold; sparkle(ctx, -22, -60 + bob, 8); ctx.fill(); }
  }
  ctx.restore();
}
A.drawRobot = function (ctx, id, t, o = {}) {
  if (A.useSprite(id)) return origRobot(ctx, id, t, o);
  const alias = TIER3[id];
  if (alias && A.useSprite(alias)) {           // tier-3: the tier-2 art with a gold aura and a bigger frame
    ctx.save();
    ctx.shadowColor = P.gold; ctx.shadowBlur = 22;
    const img = A.sprites[alias], hh = (SS.SPRITE_H[alias] || 100) * 1.12, ww = img.width / img.height * hh;
    if (o.scale) ctx.scale(o.scale, o.scale);
    ctx.drawImage(img, -ww / 2, 44 - hh, ww, hh);
    ctx.shadowBlur = 0; ctx.fillStyle = P.gold;
    for (const [x, y, r] of [[-ww / 2 + 6, 30 - hh, 10], [ww / 2 - 4, 50 - hh, 7], [ww / 2 - 10, 10, 6]]) { sparkle(ctx, x, y, r); ctx.fill(); }
    ctx.restore();
    return;
  }
  fallbackRobot(ctx, id, t, o);
};

// ---------- candidates ----------
const origSlime = A.drawSlime;
function fallbackCandidate(ctx, type, t, o) {
  const d = SS.SLIMES[type]; const k = d.size;
  ctx.save(); ctx.scale(-k, k); ctx.translate(0, -44);
  const shirts = { blob: P.cream, capped: '#9FD3E6', iron: '#E9C46A', dasher: '#7ED957', hopper: '#4ECDC4', splitter: '#F4A3C0', mini: '#F4A3C0',
    acid: '#E8E25A', shield: '#B8B2C8', spitter: '#F29E4C', hothead: '#7FA7D9', brute: '#3F3849', king: '#FFFFFF' };
  person(ctx, type + 'c', { shirt: o.enraged ? '#E2583A' : shirts[type] || P.cream, pants: '#4A4458', bob: Math.sin(t * 7) * 2 });
  ctx.restore();
  ctx.save(); ctx.scale(k, k);
  if (o.armor > 0 && type === 'capped') { ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, -78, 24, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); ctx.fillStyle = P.purple; A.ell(ctx, -22, -76, 7, 10); ctx.fill(); A.ell(ctx, 22, -76, 7, 10); ctx.fill(); }
  if (o.armor > 0 && type === 'iron') { ctx.fillStyle = P.gold; ctx.strokeStyle = P.ink; ctx.lineWidth = 3; A.rr(ctx, -16, -128, 32, 30, 4); ctx.fill(); ctx.stroke(); A.rr(ctx, -26, -100, 52, 8, 4); ctx.fill(); ctx.stroke(); }
  if (o.armor > 0 && type === 'hothead') { ctx.fillStyle = '#8A5A3B'; ctx.strokeStyle = P.ink; ctx.lineWidth = 3; A.rr(ctx, -46, -40, 28, 36, 5); ctx.fill(); ctx.stroke(); }
  if (o.front > 0) { ctx.fillStyle = P.purple; ctx.strokeStyle = P.ink; ctx.lineWidth = 3; A.rr(ctx, -50, -90, 22, 70, 6); ctx.fill(); ctx.stroke(); }
  if (type === 'king') { ctx.fillStyle = P.gold; ctx.strokeStyle = P.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, -96); ctx.lineTo(0, -140); ctx.lineTo(6, -96); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
A.drawSlime = function (ctx, type, t, o = {}) {
  const d = SS.SLIMES[type];
  if (o.husk || o.melt != null) {              // hired! fade up with a check mark instead of melting
    const e = o.husk ? Math.min(1, 1 - (o.alpha != null ? o.alpha : 1) + 0.3) : o.melt;
    ctx.save();
    ctx.translate(0, -e * 26);
    ctx.globalAlpha *= Math.max(0, 1 - e);
    A.drawSlime(ctx, type, t, Object.assign({}, o, { husk: false, melt: null, alpha: 1, moving: false }));
    const s = Math.min(1, e * 3) * (d.size > 1.5 ? 1.6 : 1);
    ctx.globalAlpha = Math.max(0, 1 - e * 0.9);
    ctx.translate(0, -32 * d.size * 3.2); ctx.scale(s, s);
    ctx.fillStyle = P.mint; ctx.beginPath(); ctx.arc(0, 0, 16, 0, 6.29); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = '#fff'; ctx.stroke();
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-2, 6); ctx.lineTo(8, -6); ctx.stroke();
    ctx.restore();
    return;
  }
  let key = type;
  if ((type === 'capped' || type === 'iron') && !(o.armor > 0)) key = 'blob';
  if (type === 'shield' && !(o.front > 0)) key = 'blob';
  if (A.useSprite(key)) {
    origSlime(ctx, type, t, Object.assign({}, o, { slow: false, frozen: false, flash: false }));
    if (o.slow || o.frozen || o.flash) {        // tint over the figure, not a slime-shaped blob
      const R = 32 * d.size, hh = R * 3 * (SS.SLIME_K[type] || 1);
      ctx.save(); if (o.scale) ctx.scale(o.scale, o.scale);
      ctx.globalAlpha = o.flash ? 0.35 : 0.28; ctx.fillStyle = o.flash ? '#ffffff' : P.lav;
      A.ell(ctx, 0, -hh * 0.48, R * 0.95, hh * 0.5); ctx.fill();
      if (o.slow || o.frozen) { ctx.globalAlpha = 0.9; ctx.fillStyle = P.violet; for (let i = 0; i < 3; i++) { A.rr(ctx, -16 + i * 12, -hh - 10 - (i % 2) * 6, 10, 7, 2); ctx.fill(); } }
      ctx.restore();
    }
    return;
  }
  ctx.save(); if (o.scale) ctx.scale(o.scale, o.scale); if (o.alpha != null) ctx.globalAlpha *= o.alpha;
  fallbackCandidate(ctx, type, t, o);
  ctx.restore();
};

// ---------- office background ----------
A.makeBackground = function (variant) {
  const WW = SS.CONST.WORLD_W || W, night = variant === 'night';
  const c = document.createElement('canvas'); c.width = WW; c.height = H;
  const ctx = c.getContext('2d');
  const BR = BX + COLS * TW, BB = BY + ROWS * TH;
  // back wall
  let g = ctx.createLinearGradient(0, 0, 0, BY);
  g.addColorStop(0, night ? '#1A1228' : '#EEEBE3'); g.addColorStop(1, night ? '#241838' : '#DCD7CC');
  ctx.fillStyle = g; ctx.fillRect(0, 0, WW, BY);
  // windows with skyline
  for (let x = 40; x < WW - 100; x += 260) {
    A.rr(ctx, x, 14, 200, BY - 48, 8); ctx.fillStyle = night ? '#0B0714' : '#CFE3F2'; ctx.fill();
    ctx.save(); ctx.clip();
    for (let i = 0; i < 7; i++) { const bw = 22 + (i * 13) % 18, bh = 24 + (i * 29) % 46; ctx.fillStyle = night ? '#22163A' : '#B7CCE0'; ctx.fillRect(x + i * 30, BY - 34 - bh, bw, bh);
      if (night) { ctx.fillStyle = 'rgba(245,197,66,0.55)'; for (let j = 0; j < 4; j++) ctx.fillRect(x + i * 30 + 4 + (j % 2) * 9, BY - 30 - bh + 6 + j * 9, 4, 4); } }
    ctx.restore();
    ctx.lineWidth = 6; ctx.strokeStyle = night ? '#3F3849' : '#FFFFFF'; A.rr(ctx, x, 14, 200, BY - 48, 8); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 100, 14); ctx.lineTo(x + 100, BY - 34); ctx.stroke();
  }
  // Whodini logo on the wall (white plaque so it reads day and night)
  { const x = BX + COLS * TW / 2 + 140, y = 14;
    A.rr(ctx, x - 92, y, 184, 78, 12); ctx.fillStyle = night ? 'rgba(246,244,239,0.92)' : '#FFFFFF'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = P.stone; ctx.stroke();
    if (logo.complete && logo.naturalWidth) ctx.drawImage(logo, x - 76, y + 8, 152, 60);
    else { ctx.font = '700 30px Poppins, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = P.purple; ctx.fillText('whodini', x, y + 44); } }
  // baseboard
  ctx.fillStyle = night ? '#2B2438' : '#FFFFFF'; ctx.fillRect(0, BY - 30, WW, 10);
  ctx.fillStyle = night ? '#120C1D' : '#B4ACC2'; ctx.fillRect(0, BY - 20, WW, 20);
  // carpet floor
  g = ctx.createLinearGradient(0, BY, 0, H);
  g.addColorStop(0, night ? '#2A1F40' : '#E6DFF3'); g.addColorStop(1, night ? '#1E1630' : '#D7CCEB');
  ctx.fillStyle = g; ctx.fillRect(0, BY, WW, H - BY);
  // the board: alternating carpet tiles per lane
  for (let r = 0; r < ROWS; r++) for (let cc = 0; cc < COLS; cc++) {
    const odd = (r + cc) % 2;
    ctx.fillStyle = night ? (odd ? '#3A2D57' : '#33274E') : (odd ? '#F6F4EF' : '#EDE6F8');
    ctx.fillRect(BX + cc * TW, BY + r * TH, TW, TH);
  }
  ctx.strokeStyle = night ? 'rgba(201,182,255,0.12)' : 'rgba(92,21,224,0.10)'; ctx.lineWidth = 2;
  for (let r = 0; r <= ROWS; r++) { ctx.beginPath(); ctx.moveTo(BX, BY + r * TH); ctx.lineTo(BR, BY + r * TH); ctx.stroke(); }
  for (let cc = 0; cc <= COLS; cc++) { ctx.beginPath(); ctx.moveTo(BX + cc * TW, BY); ctx.lineTo(BX + cc * TW, BB); ctx.stroke(); }
  // left: Whodini HQ entrance (what candidates must not leave through... they leave to the competitor)
  g = ctx.createLinearGradient(0, 0, BX, 0); g.addColorStop(0, night ? '#0B0714' : '#5C15E0'); g.addColorStop(1, night ? '#2A1F40' : '#7B3BF0');
  ctx.fillStyle = g; ctx.fillRect(0, BY, BX - 12, BB - BY);
  ctx.fillStyle = 'rgba(255,255,255,0.10)'; for (let y = BY + 10; y < BB; y += 36) ctx.fillRect(40, y, BX - 62, 18);
  ctx.save(); ctx.translate(20, BY + (BB - BY) / 2); ctx.rotate(-Math.PI / 2);
  ctx.font = '700 18px Poppins, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('COMPETITOR EXIT  →', 0, 0); ctx.restore();
  // right: lobby where candidates gather
  ctx.fillStyle = night ? '#1E1630' : '#EEEBE3'; ctx.fillRect(BR + 8, BY, WW - BR - 8, BB - BY);
  ctx.fillStyle = night ? 'rgba(201,182,255,0.06)' : 'rgba(27,21,40,0.05)';
  for (let x = BR + 8; x < WW; x += 64) for (let y = BY; y < BB; y += 64) if (((x + y) / 64) % 2 < 1) ctx.fillRect(x, y, 64, 64);
  // lobby plants & sofa
  const plant = (x, y) => { ctx.fillStyle = '#8A5A3B'; A.rr(ctx, x - 14, y - 26, 28, 26, 4); ctx.fill(); ctx.fillStyle = night ? '#2E6B4E' : '#3FA06B';
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(x + (i - 2) * 8, y - 40 - (i % 2) * 10, 8, 18, (i - 2) * 0.4, 0, 6.29); ctx.fill(); } };
  plant(BR + 40, BY + 40); plant(WW - 40, BY + 40); plant(WW - 40, BB - 6);
  ctx.fillStyle = night ? '#3F3849' : P.purple; A.rr(ctx, WW - 200, BY + 6, 120, 36, 10); ctx.fill(); A.rr(ctx, WW - 210, BY - 6, 140, 18, 8); ctx.fill();
  // board edge
  ctx.fillStyle = night ? 'rgba(201,182,255,0.25)' : 'rgba(92,21,224,0.25)'; ctx.fillRect(BR, BY, 8, BB - BY);
  ctx.fillStyle = 'rgba(27,21,40,0.15)'; ctx.fillRect(BX - 12, BY, 12, BB - BY);
  if (night) { ctx.fillStyle = 'rgba(18,12,29,0.25)'; ctx.fillRect(0, 0, WW, H);
    for (let i = 0; i < 5; i++) { const x = BX + 100 + i * 220; const lg = ctx.createRadialGradient(x, BY + 280, 10, x, BY + 280, 260); lg.addColorStop(0, 'rgba(201,182,255,0.10)'); lg.addColorStop(1, 'rgba(201,182,255,0)'); ctx.fillStyle = lg; ctx.fillRect(x - 260, BY, 520, H - BY); } }
  return c;
};

// ---------- battle visuals ----------
const B = SS.Battle.prototype;
const groundY = r => BY + r * TH + TH - 14;
const tileX = c => BX + c * TW + TW / 2;
B.drawProj = function (ctx, p, rt) {
  if (p.delay > 0) return;
  ctx.save(); ctx.translate(p.x, p.y);
  if (p.k === 'lob') {                         // business card / offer letter, spinning
    ctx.rotate(rt * 10);
    ctx.fillStyle = p.fire ? P.gold : p.slow ? P.lav2 : '#FFFFFF'; ctx.strokeStyle = P.ink; ctx.lineWidth = 2;
    A.rr(ctx, -13, -8, 26, 16, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.purple; ctx.fillRect(-9, -3, 12, 2.5); ctx.fillRect(-9, 2, 7, 2);
  } else if (p.k === 'goo') {                  // objection bubble
    const r = p.big ? 16 : 11;
    ctx.fillStyle = p.big ? P.lav : '#FFE0D6'; ctx.strokeStyle = P.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, 6.29); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#C0392B'; ctx.font = `800 ${r * 1.3}px Poppins, system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', 0, 1);
  } else if (p.k === 'ice') {                  // nurture email
    ctx.fillStyle = P.lav2; ctx.strokeStyle = P.violet; ctx.lineWidth = 2;
    A.rr(ctx, -16, -9, 22, 16, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-16, -9); ctx.lineTo(-5, 1); ctx.lineTo(6, -9); ctx.stroke();
  } else if (p.k === 'arc') {                  // Apoachability ray
    ctx.shadowColor = P.violet; ctx.shadowBlur = 12;
    const g = ctx.createLinearGradient(-40, 0, 0, 0); g.addColorStop(0, 'rgba(123,59,240,0)'); g.addColorStop(1, P.violet);
    ctx.fillStyle = g; A.rr(ctx, -40, -4, 40, 8, 4); ctx.fill();
    ctx.shadowBlur = 0; ctx.fillStyle = P.gold; sparkle(ctx, 0, 0, 8); ctx.fill();
  } else if (p.k === 'fire') {                 // super pitch
    ctx.shadowColor = P.gold; ctx.shadowBlur = 14; ctx.fillStyle = P.gold; sparkle(ctx, 0, 0, 13); ctx.fill();
  } else {                                     // screening question
    ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = P.purple; ctx.lineWidth = 2.5;
    A.rr(ctx, -20, -10, 22, 16, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-14, 6); ctx.lineTo(-18, 12); ctx.lineTo(-8, 6); ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.purple; ctx.font = '800 12px Poppins, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('?', -9, -2);
  }
  ctx.restore();
};
B.drawSweeper = function (ctx, sw, rt) {        // Exploding Offer cart
  const y = groundY(sw.r) - 8;
  ctx.save(); ctx.translate(sw.x, y);
  ctx.fillStyle = 'rgba(27,21,40,0.25)'; A.ell(ctx, 0, 8, 34, 7); ctx.fill();
  A.rr(ctx, -28, -20, 52, 24, 6); ctx.fillStyle = P.cream; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-28, -20); ctx.lineTo(-2, -6); ctx.lineTo(24, -20); ctx.stroke();
  ctx.fillStyle = '#C0392B'; ctx.beginPath(); ctx.arc(-2, -8, 5, 0, 6.29); ctx.fill();
  ctx.fillStyle = P.ink; for (const x of [-16, 12]) { ctx.beginPath(); ctx.arc(x, 6, 7, 0, 6.29); ctx.fill(); }
  ctx.fillStyle = sw.state === 'go' ? '#ff4040' : (Math.sin(rt * 3) > 0 ? P.gold : '#8A6A10'); sparkle(ctx, 22, -28, 6); ctx.fill();
  if (sw.state === 'go') { ctx.strokeStyle = 'rgba(92,21,224,0.5)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(-40 - i * 8, -14 + i * 8); ctx.lineTo(-70 - i * 8, -14 + i * 8); ctx.stroke(); } }
  ctx.restore();
};
B.drawDebris = function (ctx, r, c) {          // paperwork boxes
  const x = tileX(c), y = groundY(r);
  ctx.save(); ctx.translate(x, y);
  ctx.fillStyle = 'rgba(27,21,40,0.25)'; A.ell(ctx, 0, 2, 40, 9); ctx.fill();
  const box = (bx, by, w, h) => { A.rr(ctx, bx, by, w, h, 3); ctx.fillStyle = '#E8DCC4'; ctx.fill(); ctx.strokeStyle = P.ink; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#FFFFFF'; for (let i = 0; i < 3; i++) ctx.fillRect(bx + 4, by - 3 - i * 3, w - 8, 3); ctx.fillStyle = P.purple; ctx.fillRect(bx + w / 2 - 8, by + h / 2 - 4, 16, 8); };
  box(-36, -32, 40, 32); box(2, -24, 32, 24); box(-20, -62, 32, 28);
  ctx.restore();
};
B.drawScorch = function (ctx, r, c, t) {       // spilled coffee
  const x = tileX(c), y = BY + r * TH + TH / 2 + 10;
  ctx.save(); ctx.globalAlpha = Math.min(1, t / 3) * 0.85;
  ctx.fillStyle = '#6B4226'; ctx.beginPath(); ctx.ellipse(x, y, 46, 26, 0.1, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#8A5A3B'; ctx.beginPath(); ctx.ellipse(x - 10, y - 4, 24, 12, 0.1, 0, 6.29); ctx.fill();
  ctx.globalAlpha = 1; ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = P.ink; ctx.lineWidth = 2;
  A.rr(ctx, x + 22, y - 20, 18, 20, 3); ctx.fill(); ctx.stroke();
  ctx.restore();
};
B.drawCapIcon = function (ctx, kind, s = 1) {   // headphones / golden top hat
  ctx.save(); ctx.scale(s, s);
  if (kind === 'iron') {
    ctx.fillStyle = P.gold; ctx.strokeStyle = P.ink; ctx.lineWidth = 2.5;
    A.rr(ctx, -14, -26, 28, 24, 3); ctx.fill(); ctx.stroke(); A.rr(ctx, -24, -4, 48, 7, 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = P.ink; ctx.font = '800 14px Poppins, system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, -14);
  } else {
    ctx.strokeStyle = P.ink; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(0, 2, 18, Math.PI, 0); ctx.stroke();
    ctx.fillStyle = P.purple; ctx.strokeStyle = P.ink; ctx.lineWidth = 2.5;
    for (const sx of [-1, 1]) { A.rr(ctx, sx * 18 - 7, -2, 14, 18, 5); ctx.fill(); ctx.stroke(); }
  }
  ctx.restore();
};
B.drawTrophy = function (ctx, rt) {            // the signed offer letter
  ctx.save(); ctx.translate(this.trophy.x, this.trophy.y + Math.sin(rt * 3) * 6);
  ctx.fillStyle = 'rgba(201,182,255,0.35)'; ctx.beginPath(); ctx.arc(0, 0, 60 + Math.sin(rt * 5) * 6, 0, 6.29); ctx.fill();
  ctx.fillStyle = '#FFFFFF'; ctx.strokeStyle = P.ink; ctx.lineWidth = 3;
  A.rr(ctx, -30, -38, 60, 76, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = P.lav; for (let i = 0; i < 4; i++) ctx.fillRect(-20, -24 + i * 10, 40 - (i % 2) * 12, 4);
  ctx.fillStyle = P.purple; ctx.beginPath(); ctx.arc(12, 22, 11, 0, 6.29); ctx.fill();
  ctx.fillStyle = P.gold; sparkle(ctx, 12, 22, 7); ctx.fill();
  ctx.fillStyle = P.purple; ctx.font = '800 13px Poppins, system-ui'; ctx.textAlign = 'center'; ctx.fillText(SS.TEXT.CORE || 'OFFER', -8, 24);
  if (this.state === 'clear') { ctx.fillStyle = '#fff'; ctx.font = '800 16px Poppins, system-ui'; ctx.strokeStyle = P.ink; ctx.lineWidth = 4; ctx.strokeText('Tap!', 0, 62); ctx.fillText('Tap!', 0, 62); }
  ctx.restore();
};
const origFx = B.drawFx;
const CONF = [P.purple, P.violet, P.gold, P.lav, '#FFFFFF', P.mint];
B.drawFx = function (ctx, rt) {                // blast clouds become confetti bursts
  const all = this.fx, clouds = all.filter(f => f.k === 'cloud');
  if (!clouds.length) return origFx.call(this, ctx, rt);
  this.fx = all.filter(f => f.k !== 'cloud');
  origFx.call(this, ctx, rt);
  this.fx = all;
  for (const f of clouds) {
    const k = f.life / f.max, e = 1 - k, s = f.s;
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 2);
    for (let i = 0; i < 26; i++) {
      const a = i * 2.39, sp = (60 + (i * 37) % 90) * s;
      const x = f.x + Math.cos(a) * sp * e * 1.6, y = f.y - 30 + Math.sin(a) * sp * e - 60 * e * s + 140 * e * e;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + rt * 8);
      ctx.fillStyle = f.cold ? (i % 2 ? P.lav2 : '#FFFFFF') : CONF[i % CONF.length];
      if (i % 4 === 0) { sparkle(ctx, 0, 0, 7 * s); ctx.fill(); } else ctx.fillRect(-5 * s, -3 * s, 10 * s, 6 * s);
      ctx.restore();
    }
    ctx.restore();
  }
};
})();
