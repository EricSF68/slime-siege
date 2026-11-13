// Slime Siege — app shell: canvas, loop, menus, save data
'use strict';
(() => {
const { W, H } = SS.CONST;
const KEY = SS.SAVE_KEY || 'slimesiege.v1';
const T = s => (SS.TEXT && SS.TEXT[s] != null) ? SS.TEXT[s] : s;
const $ = s => document.querySelector(s);

// ---------- save ----------
function loadSave() {
  try { return Object.assign({ unlocked: 1, endlessBest: 0, discovered: [], loadout: null, stars: {} }, JSON.parse(localStorage.getItem(KEY + '.save') || '{}')); }
  catch (e) { return { unlocked: 1, endlessBest: 0, discovered: [], loadout: null, stars: {} }; }
}
function loadSettings() {
  try { return Object.assign({ sfx: 0.8, music: 0.45, muted: false, autoCollect: false, reduceMotion: false, difficulty: 'normal', gfx: 'illustrated' }, JSON.parse(localStorage.getItem(KEY + '.settings') || '{}')); }
  catch (e) { return { sfx: 0.8, music: 0.45, muted: false, autoCollect: false, reduceMotion: false, difficulty: 'normal', gfx: 'illustrated' }; }
}
SS.save = loadSave();
SS.settings = loadSettings();
SS.persist = () => { try { localStorage.setItem(KEY + '.save', JSON.stringify(SS.save)); localStorage.setItem(KEY + '.settings', JSON.stringify(SS.settings)); } catch (e) {} };
SS.isTouch = matchMedia('(pointer: coarse)').matches;
SS.showKeys = !SS.isTouch;
SS.speed = 1;

const params = new URLSearchParams(location.search);
if (params.get('unlockall') === '1') { SS.save.unlocked = 13; }

function unlockedUnits() {
  const set = new Set(SS.LEVELS[0].cards);
  for (let i = 0; i < SS.save.unlocked - 1 && i < SS.LEVELS.length; i++) if (SS.LEVELS[i].unlock) set.add(SS.LEVELS[i].unlock);
  return SS.BASE_ORDER.filter(id => set.has(id));
}
SS.unlockedUnits = unlockedUnits;

// ---------- canvas ----------
const canvas = $('#game');
const ctx = canvas.getContext('2d');
let view = { s: 1, ox: 0, oy: 0, dpr: 1, cw: 0, ch: 0 };
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  const cw = window.innerWidth, ch = window.innerHeight;
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
  const s = Math.min(cw / W, ch / H);
  view = { s, ox: (cw - W * s) / 2, oy: (ch - H * s) / 2, dpr, cw, ch };
  const port = ch > cw * 1.05 && SS.isTouch;
  $('#rotate').classList.toggle('show', port && !SS.rotateDismissed);
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();
function toLogical(e) {
  const r = canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left - view.ox) / view.s, y: (e.clientY - r.top - view.oy) / view.s };
}

const bgCache = {};
function getBg(variant = 'day') {
  if (SS.Art.bgDirty) { for (const k in bgCache) delete bgCache[k]; SS.Art.bgDirty = false; }
  return bgCache[variant] || (bgCache[variant] = SS.Art.makeBackground(variant));
}

// ---------- state ----------
let battle = null, paused = false, lastLevelIdx = 0;
SS.getBattle = () => battle;

// ---------- loop ----------
let last = performance.now(), acc = 0, rt = 0, fpsT = 0, frames = 0, fps = 0;
function frame(now) {
  let dt = Math.min(0.1, (now - last) / 1000); last = now;
  rt += dt;
  if (battle && !paused) {
    acc += dt * SS.speed;
    let steps = 0;
    while (acc >= SS.DT && steps < 12) { battle.update(SS.DT); acc -= SS.DT; steps++; }
    if (steps >= 12) acc = 0;
  }
  draw();
  frames++; fpsT += dt; if (fpsT > 1) { fps = frames; frames = 0; fpsT = 0; }
  requestAnimationFrame(frame);
}
function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#0b0f18'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(view.dpr * view.s, 0, 0, view.dpr * view.s, view.dpr * view.ox, view.dpr * view.oy);
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
  if (battle) battle.render(ctx, getBg(battle.level.night ? 'night' : 'day'), rt);
  else drawMenuBackdrop();
  if (params.get('debug') === '1') { ctx.fillStyle = '#0f0'; ctx.font = '14px monospace'; ctx.textAlign = 'left'; ctx.fillText(fps + ' fps', 8, H - 8); }
  ctx.restore();
}
// animated title backdrop
const deco = [];
function drawMenuBackdrop() {
  ctx.drawImage(getBg(), 0, 0);
  ctx.fillStyle = 'rgba(8,12,22,0.55)'; ctx.fillRect(0, 0, W, H);
  if (deco.length === 0) {
    const bots = ['blaster', 'spark', 'cryo', 'tesla', 'bulwark', 'gatling', 'storm', 'lobber'];
    for (let i = 0; i < 5; i++) deco.push({ kind: 'r', id: bots[i % bots.length], x: 220 + (i % 2) * 110, y: SS.tileY(i) + 4 });
    const sl = ['blob', 'capped', 'hopper', 'iron', 'acid', 'shield', 'dasher'];
    for (let i = 0; i < 6; i++) deco.push({ kind: 's', id: sl[i % sl.length], x: 900 + i * 60, y: SS.CONST.BY + (i % 5) * SS.CONST.TH + SS.CONST.TH - 14, ph: i });
  }
  for (const d of deco) {
    ctx.save(); ctx.translate(d.x, d.y);
    if (d.kind === 'r') SS.Art.drawRobot(ctx, d.id, rt, { phase: d.x });
    else SS.Art.drawSlime(ctx, d.id, rt + d.ph, { phase: d.ph, armor: 1, front: 1 });
    ctx.restore();
  }
}
requestAnimationFrame(frame);

// ---------- input ----------
let activePointer = null;
canvas.addEventListener('pointerdown', e => {
  SS.Audio.init();
  if (activePointer != null && activePointer !== e.pointerId) return;
  activePointer = e.pointerId;
  try { canvas.setPointerCapture(e.pointerId); } catch (x) {}
  if (!battle || paused) return;
  const p = toLogical(e); battle.onDown(p.x, p.y);
  e.preventDefault();
});
canvas.addEventListener('pointermove', e => {
  if (!battle || paused) return;
  if (activePointer != null && activePointer !== e.pointerId) return;
  const p = toLogical(e); battle.onMove(p.x, p.y);
});
const up = e => {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  if (!battle || paused) return;
  const p = toLogical(e); battle.onUp(p.x, p.y);
};
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', e => { if (e.pointerId === activePointer) { activePointer = null; if (battle) { battle.pointer.down = false; battle.pointer.dragging = false; } } });
canvas.addEventListener('pointerleave', e => { if (battle && !battle.pointer.down && e.pointerType === 'mouse') { battle.pointer.x = -1; battle.pointer.y = -1; } });
canvas.addEventListener('contextmenu', e => { e.preventDefault(); if (battle && battle.cancel) battle.cancel(); });
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

window.addEventListener('keydown', e => {
  if (!battle || (battle.state !== 'play' && battle.state !== 'clear')) return;
  if (e.key === ' ' || e.key === 'p' || e.key === 'P' || e.key === 'Escape' && paused) { e.preventDefault(); SS.togglePause(); return; }
  if (paused) return;
  if (e.key >= '0' && e.key <= '9') { battle.selectCard(e.key === '0' ? 9 : +e.key - 1); }
  else if (e.key === 'g' || e.key === 'G') battle.selectTool('grab');
  else if (e.key === 't' || e.key === 'T') battle.selectTool('beam');
  else if (e.key === 'w' || e.key === 'W' || e.key === 'r' || e.key === 'R') battle.selectTool('wrench');
  else if (e.key === 'Escape') battle.cancel();
  else if (e.key === 'f' || e.key === 'F') SS.toggleSpeed();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (battle && !paused && battle.state === 'play') SS.togglePause(true); SS.Audio.suspend(); }
  else SS.Audio.resume();
});

// ---------- screens ----------
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('show', s.id === id));
  $('#overlay').classList.toggle('show', !!id);
}
SS.show = show;

function buildLevelSelect() {
  const g = $('#levels'); g.innerHTML = '';
  SS.LEVELS.forEach((L, i) => {
    const b = document.createElement('button');
    const locked = i + 1 > SS.save.unlocked;
    b.className = 'lvl' + (locked ? ' locked' : '') + (SS.save.stars[i] ? ' done' : '');
    b.innerHTML = `<span class="n">${i + 1}</span><span class="t">${locked ? T('Locked') : L.name}</span>${L.boss ? '<span class="boss">BOSS</span>' : ''}`;
    b.disabled = locked;
    b.onclick = () => { SS.Audio.play('click'); prepLevel(i); };
    g.appendChild(b);
  });
  const e = document.createElement('button');
  const eLocked = SS.save.unlocked <= SS.LEVELS.length;
  e.className = 'lvl endless' + (eLocked ? ' locked' : '');
  e.innerHTML = `<span class="n">∞</span><span class="t">${eLocked ? T('Beat level 12') : SS.ENDLESS.name}</span>${!eLocked ? `<span class="boss">Best ${SS.save.endlessBest}</span>` : ''}`;
  e.disabled = eLocked;
  e.onclick = () => { SS.Audio.play('click'); prepLevel('endless'); };
  g.appendChild(e);
}

let pendingLevel = null, chosen = [];
function levelObj(i) {
  if (i === 'endless') return Object.assign({ label: '' }, SS.ENDLESS);
  return Object.assign({ label: `${i + 1}.` }, SS.LEVELS[i]);
}
function battleOpts(i, intro) {
  return { seed: params.get('seed') ? +params.get('seed') : undefined, intro,
    grabber: SS.toolUnlocked('grabber', i), beam: SS.toolUnlocked('beam', i) };
}
function prepLevel(i) {
  pendingLevel = i;
  const L = levelObj(i);
  const avail = i === 0 ? SS.LEVELS[0].cards : unlockedUnits();
  // staging: the camera looks at the containment hall while you choose
  lastLevelIdx = i;
  battle = new SS.Battle(L, [], battleOpts(i, avail.length < SS.MAX_SLOTS ? 'auto' : 'loadout'));
  SS.battle = battle; paused = false; SS.speed = 1; acc = 0;
  SS.Audio.init(); SS.Audio.playMusic('menu');
  if (avail.length < SS.MAX_SLOTS) { beginBattle(i, avail, true); return; }
  // loadout picker (docked so the waiting slimes stay visible)
  const prev = (SS.save.loadout || []).filter(id => avail.includes(id));
  chosen = prev.length ? prev.slice(0, SS.MAX_SLOTS) : avail.slice(0, SS.MAX_SLOTS);
  $('#lo-title').textContent = (L.label ? L.label + ' ' : '') + L.name;
  const en = $('#lo-enemies'); en.innerHTML = '';
  L.types.concat(L.boss ? ['king'] : []).forEach(t => en.appendChild(iconCanvas('s', t, 56)));
  renderLoadout(avail);
  show('loadout');
  $('#overlay').classList.add('docked');
  requestAnimationFrame(updateDock);
}
function updateDock() {                         // logical x of the docked panel's right edge, for the title card
  const el = document.querySelector('#loadout');
  if (!el || !$('#overlay').classList.contains('docked')) { SS.dockRight = 0; return; }
  const r = el.getBoundingClientRect(), cr = canvas.getBoundingClientRect();
  SS.dockRight = Math.max(0, (r.right - cr.left - view.ox) / view.s);
}
window.addEventListener('resize', () => requestAnimationFrame(updateDock));
function renderLoadout(avail) {
  const pool = $('#lo-pool'); pool.innerHTML = '';
  avail.forEach(id => {
    const b = document.createElement('button');
    const n = chosen.filter(x => x === id).length;
    b.className = 'pcard' + (n ? ' on' : '') + (n > 1 ? ' dup' : '');
    b.appendChild(iconCanvas('r', id, 64));
    b.insertAdjacentHTML('beforeend', `<span class="nm">${SS.UNITS[id].name}</span><span class="cs">${SS.UNITS[id].cost}${n > 1 ? ` + ${SS.UNITS[id].cost * 2}` : ''}</span>${n > 1 ? '<span class="x2">×2</span>' : ''}`);
    b.title = 'Tap: add · tap again: add a second copy (costs 2×) · tap again: remove';
    b.onclick = () => {
      SS.Audio.play('click');
      if (n === 0) { if (chosen.length < SS.MAX_SLOTS) chosen.push(id); else { SS.Audio.play('invalid'); return; } }
      else if (n === 1 && chosen.length < SS.MAX_SLOTS) chosen.push(id);
      else chosen = chosen.filter(x => x !== id);
      renderLoadout(avail);
    };
    pool.appendChild(b);
  });
  $('#lo-count').textContent = `${chosen.length}/${SS.MAX_SLOTS}`;
  $('#lo-go').disabled = chosen.length === 0;
}
$('#lo-go').onclick = () => { SS.Audio.play('click'); SS.save.loadout = chosen.slice(); SS.persist(); beginBattle(pendingLevel, chosen.slice()); };
$('#lo-back').onclick = () => { SS.Audio.play('click'); battle = null; SS.battle = null; SS.dockRight = 0; $('#overlay').classList.remove('docked'); buildLevelSelect(); show('levelselect'); SS.Audio.playMusic('menu'); };

const sortCards = cards => cards.slice().sort((a, b) => SS.BASE_ORDER.indexOf(a) - SS.BASE_ORDER.indexOf(b));
function beginBattle(i, cards, auto) {         // leave the staging view: pan back, count down, play
  lastLevelIdx = i; SS.lastCards = cards;
  $('#overlay').classList.remove('docked'); SS.dockRight = 0;
  show(null);
  if (!battle || battle.state !== 'intro') battle = new SS.Battle(levelObj(i), [], battleOpts(i, auto ? 'auto' : 'loadout'));
  battle.setCards(sortCards(cards));
  if (!auto) battle.go();                      // 'auto' intros hold on the hall, then pan back on their own
  SS.battle = battle;
  const L = levelObj(i);
  SS.Audio.playMusic(L.boss ? 'boss' : 'battle');
  if (L.boss) setTimeout(() => SS.Audio.playMusic('battle'), 10);
}

function startLevel(i, cards) {
  lastLevelIdx = i; SS.lastCards = cards;
  const L = levelObj(i);
  battle = new SS.Battle(L, sortCards(cards), Object.assign(battleOpts(i, SS.skipIntros ? null : 'auto')));
  SS.battle = battle;
  paused = false; SS.speed = 1; acc = 0;
  show(null);
  SS.Audio.init(); SS.Audio.play('start');
  SS.Audio.playMusic(L.boss ? 'menu' : 'battle');
  if (L.boss) setTimeout(() => SS.Audio.playMusic('battle'), 10);
}
SS.startLevel = startLevel;

SS.togglePause = (force) => {
  if (!battle || (battle.state !== 'play' && battle.state !== 'clear')) return;
  paused = force === true ? true : !paused;
  if (paused) { syncSettingsUI(); show('pause'); } else show(null);
};
SS.toggleSpeed = () => { SS.speed = SS.speed === 1 ? 2 : SS.speed === 2 ? 0.5 : 1; };
SS.isPaused = () => paused;

SS.onDiscover = id => {
  if (!SS.save.discovered.includes(id)) { SS.save.discovered.push(id); SS.persist(); }
};
SS.onBattleEnd = (won, b) => {
  setTimeout(() => {
    if (battle !== b) return;
    SS.Audio.stopMusic();
    const L = b.level;
    if (L.endless) {
      const waves = Math.max(0, b.waveIdx);
      const best = waves > (SS.save.endlessBest || 0);
      if (best) SS.save.endlessBest = waves;
      SS.persist();
      $('#end-title').textContent = T('Overrun!');
      $('#end-msg').textContent = `${T('You survived')} ${waves} ${waves === 1 ? T('wave') : T('waves')}.${best ? ' New best!' : ` Best: ${SS.save.endlessBest}.`}`;
      $('#end-next').style.display = 'none';
      $('#end-unlock').innerHTML = '';
      renderStats(b, false);
      show('end'); return;
    }
    const idx = lastLevelIdx;
    $('#end-unlock').innerHTML = '';
    if (won) {
      SS.save.stars[idx] = 1;
      const newly = idx + 2 > SS.save.unlocked;
      if (newly) SS.save.unlocked = idx + 2;
      SS.persist();
      $('#end-title').textContent = idx === SS.LEVELS.length - 1 ? T('The King Has Fallen!') : T('Level Clear!');
      let msg = '';
      if (newly && L.unlock) {
        $('#end-unlock').appendChild(iconCanvas('r', L.unlock, 96));
        $('#end-unlock').insertAdjacentHTML('beforeend', `<div><b>${SS.UNITS[L.unlock].feature ? T('New AI feature: ') : T('New robot: ')}${SS.UNITS[L.unlock].name}</b><br>${SS.UNITS[L.unlock].desc}</div>`);
      }
      if (idx === SS.LEVELS.length - 1) msg = T('Endless mode unlocked!');
      if (idx === 8 && newly) msg = T('Tier-3 fusions unlocked!');
      $('#end-msg').textContent = msg;
      $('#end-next').style.display = idx < SS.LEVELS.length - 1 ? '' : 'none';
    } else {
      $('#end-title').textContent = T('The Slimes Got In!');
      $('#end-msg').textContent = T('A slime reached the core. Try a different build, more fusions, or the Grabber.');
      $('#end-next').style.display = 'none';
    }
    renderStats(b, won);
    show('end');
  }, 50);
};
function renderStats(b, won) {
  const st = b.stats, mins = Math.floor(b.time / 60), secs = Math.floor(b.time % 60);
  const waves = b.level.endless ? `${Math.max(0, b.waveIdx)}` : `${won ? b.totalWaves : Math.max(0, b.waveIdx)}/${b.totalWaves}`;
  const cells = [['Time', `${mins}:${String(secs).padStart(2, '0')}`], [T('Waves cleared'), waves], [T('Slimes destroyed'), st.kills], [T('Damage dealt'), Math.round(st.damage).toLocaleString()],
    [T('Energy collected'), st.energyCollected.toLocaleString()], [T('Energy spent'), st.energySpent.toLocaleString()], [T('Robots built'), st.placed], [T('Fusions'), st.fused], [T('Robots lost'), st.lost], [T('Robots removed'), st.removed]];
  const top = Object.entries(st.byUnit).filter(([k]) => SS.UNITS[k]).sort((a, c) => c[1] - a[1]).slice(0, 5);
  const max = top.length ? top[0][1] : 1;
  $('#end-stats').innerHTML = `<div class="stat-grid">${cells.map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('')}</div>` +
    (top.length ? `<details class="dmg"><summary>${T('Damage by robot')}</summary>${top.map(([k, v]) => `<div class="bar"><span>${SS.UNITS[k].name}</span><i style="width:${Math.max(4, v / max * 100)}%"></i><b>${Math.round(v).toLocaleString()}</b></div>`).join('')}</details>` : '');
}
$('#end-retry').onclick = () => { SS.Audio.play('click'); startLevel(lastLevelIdx, SS.lastCards); };
$('#end-next').onclick = () => { SS.Audio.play('click'); battle = null; SS.Audio.playMusic('menu'); prepLevel(lastLevelIdx + 1); };
$('#end-map').onclick = () => { SS.Audio.play('click'); quitToMap(); };

function quitToMap() { $('#overlay').classList.remove('docked'); SS.dockRight = 0; battle = null; SS.battle = null; paused = false; buildLevelSelect(); show('levelselect'); SS.Audio.playMusic('menu'); }
$('#p-resume').onclick = () => { SS.Audio.play('click'); SS.togglePause(false); };
$('#p-restart').onclick = () => { SS.Audio.play('click'); startLevel(lastLevelIdx, SS.lastCards); };
$('#p-quit').onclick = () => { SS.Audio.play('click'); quitToMap(); };

// settings controls (shared in pause + settings screens)
function updateGfxNote() {
  const n = SS.Art.spriteCount();
  const el = $('#gfx-note'); if (!el) return;
  el.textContent = n ? (SS.settings.gfx === 'illustrated' ? `Illustrated art is on for ${n} characters; the rest use Classic.` : 'Classic vector art for everything.')
                     : 'Illustrated art isn\'t installed yet, so Classic is shown either way.';
}
function syncSettingsUI() {
  updateGfxNote();
  document.querySelectorAll('[data-set]').forEach(el => {
    const k = el.dataset.set;
    if (el.type === 'checkbox') el.checked = !!SS.settings[k]; else el.value = SS.settings[k];
  });
}
document.querySelectorAll('[data-set]').forEach(el => {
  el.addEventListener('input', () => {
    const k = el.dataset.set;
    SS.settings[k] = el.type === 'checkbox' ? el.checked : (el.tagName === 'SELECT' ? el.value : parseFloat(el.value));
    SS.Audio.set(k, SS.settings[k]);
    if (k === 'gfx') { SS.Art.bgDirty = true; updateGfxNote(); }
    SS.persist(); syncSettingsUI();
  });
});
SS.Audio.set('sfx', SS.settings.sfx); SS.Audio.set('music', SS.settings.music); SS.Audio.set('muted', SS.settings.muted);

// menu buttons
$('#btn-play').onclick = () => { SS.Audio.init(); SS.Audio.play('click'); SS.Audio.playMusic('menu'); buildLevelSelect(); show('levelselect'); };
$('#btn-almanac').onclick = () => { SS.Audio.init(); SS.Audio.play('click'); buildAlmanac('robots'); show('almanac'); };
$('#btn-settings').onclick = () => { SS.Audio.init(); SS.Audio.play('click'); syncSettingsUI(); show('settings'); };
$('#ls-back').onclick = () => { SS.Audio.play('click'); show('title'); };
$('#al-back').onclick = () => { SS.Audio.play('click'); show(battle ? 'pause' : 'title'); };
$('#st-back').onclick = () => { SS.Audio.play('click'); show('title'); };
$('#st-reset').onclick = () => {
  if (!confirm(T('Erase all progress?'))) return;
  SS.save = { unlocked: 1, endlessBest: 0, discovered: [], loadout: null, stars: {} }; SS.persist(); SS.Audio.play('click');
};
function buildHowTo() {
  document.querySelectorAll('#howto .ht-icons').forEach(el => {
    if (el.dataset.built) return; el.dataset.built = '1';
    el.dataset.icons.split(',').forEach(tok => {
      if (tok === 'energy') { const c = document.createElement('canvas'); const d = Math.min(2, devicePixelRatio || 1); c.width = c.height = 56 * d; c.style.width = c.style.height = '56px'; const g = c.getContext('2d'); g.scale(d, d); g.translate(28, 28); SS.Art.drawEnergy(g, 0, 1); el.appendChild(c); }
      else if (tok.includes(':')) { const [k, id] = tok.split(':'); el.appendChild(iconCanvas(k, id, 56)); }
      else el.insertAdjacentHTML('beforeend', `<span>${tok}</span>`);
    });
  });
}
let howtoFrom = 'title';
$('#btn-howto').onclick = () => { SS.Audio.init(); SS.Audio.play('click'); howtoFrom = 'title'; buildHowTo(); show('howto'); };
$('#p-howto').onclick = () => { SS.Audio.play('click'); howtoFrom = 'pause'; buildHowTo(); show('howto'); };
$('#ht-back').onclick = () => { SS.Audio.play('click'); show(battle ? howtoFrom : 'title'); };
$('#p-almanac').onclick = () => { SS.Audio.play('click'); buildAlmanac('robots'); show('almanac'); };
document.querySelectorAll('#almanac .tab').forEach(t => t.onclick = () => { SS.Audio.play('click'); buildAlmanac(t.dataset.tab); });
$('#btn-fullscreen').onclick = () => {
  const el = document.documentElement;
  if (document.fullscreenElement || document.webkitFullscreenElement) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
  else if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
  else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
};
if (!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen)) $('#btn-fullscreen').style.display = 'none';
$('#rotate-ok').onclick = () => { SS.rotateDismissed = true; resize(); };

// ---------- icons & almanac ----------
function iconCanvas(kind, id, size) {
  const c = document.createElement('canvas');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = size * dpr; c.height = size * dpr; c.style.width = size + 'px'; c.style.height = size + 'px';
  const g = c.getContext('2d'); g.scale(dpr, dpr);
  if (kind === 'r') { g.translate(size / 2, size * 0.52); SS.Art.drawRobot(g, id, 0.3, { scale: size / 120 }); }
  else { const sc = size / (110 * Math.max(1, SS.SLIMES[id].size * 0.8)); g.translate(size / 2, size * 0.9); SS.Art.drawSlime(g, id, 0.3, { scale: sc, armor: 1, front: 1, moving: false }); }
  return c;
}
function buildAlmanac(tab) {
  document.querySelectorAll('#almanac .tab').forEach(t => t.classList.toggle('on', t.dataset.tab === tab));
  const list = $('#al-list'); list.innerHTML = '';
  const detail = $('#al-detail');
  const fc = $('#al-count');
  if (fc) fc.textContent = tab === 'fusions' ? `${SS.FUSION_LIST.filter(f => SS.save.discovered.includes(f[2])).length}/${SS.FUSION_LIST.length} ${T('fusions found')}` : '';
  const unlocked = unlockedUnits();
  let entries = [];
  if (tab === 'robots') entries = SS.BASE_ORDER.map(id => ({ id, kind: 'r', known: unlocked.includes(id) }));
  else if (tab === 'fusions') {
    const can = id => unlocked.includes(id) || (SS.UNITS[id].from && SS.UNITS[id].from.every(can));
    entries = SS.FUSION_LIST.map(([a, b, r]) => ({ id: r, kind: 'r', known: can(a) && can(b), found: SS.save.discovered.includes(r) }));
  }
  else entries = Object.keys(SS.SLIMES).map(id => ({ id, kind: 's', known: true }));
  const showDetail = (e) => {
    detail.innerHTML = '';
    if (!e.known) { detail.innerHTML = `<p class="muted">${T('Unlock more robots to reveal this entry.')}</p>`; return; }
    detail.appendChild(iconCanvas(e.kind, e.id, 140));
    const d = e.kind === 'r' ? SS.UNITS[e.id] : SS.SLIMES[e.id];
    let html = `<h3>${d.name}</h3><p>${d.desc}</p>`;
    if (e.kind === 'r') {
      if (d.from) html += `<p class="recipe">Recipe: <b>${SS.UNITS[d.from[0]].name}</b> + <b>${SS.UNITS[d.from[1]].name}</b><br><span class="muted">${T('Place either robot onto the other, or use the Grabber.')}</span>${SS.fusionLocked(e.id) ? '<br><span class="lock">Locked until you clear Level 9</span>' : ''}${SS.save.discovered.includes(e.id) ? '<br><span class="found">✓ Found</span>' : ''}</p>`;
      else html += `<p>Cost: <b>${d.cost}</b> · Recharge: <b>${d.cd >= 30 ? 'Slow' : 'Fast'}</b></p>`;
      html += `<p class="muted">Toughness: ${d.hp >= 9999 ? '—' : d.hp}</p>`;
      if (!d.from) {
        const fs = SS.FUSION_LIST.filter(f => f[0] === e.id || f[1] === e.id);
        if (fs.length) html += `<p class="muted">${T('Fuses into:')} ${fs.map(f => SS.UNITS[f[2]].name).join(', ')}</p>`;
      }
    } else {
      html += `<p class="muted">Toughness: ${d.hp + (d.armor || 0) + (d.front || 0)} · Speed: ${d.speed >= 40 ? 'Fast' : d.speed >= 25 ? 'Medium' : 'Slow'}</p>`;
    }
    detail.insertAdjacentHTML('beforeend', html);
  };
  entries.forEach((e, k) => {
    const b = document.createElement('button');
    b.className = 'acard' + (e.known ? '' : ' unknown');
    if (e.known) b.appendChild(iconCanvas(e.kind, e.id, 72)); else b.insertAdjacentHTML('beforeend', '<div class="q">?</div>');
    b.insertAdjacentHTML('beforeend', `<span>${e.known ? (e.kind === 'r' ? SS.UNITS[e.id].name : SS.SLIMES[e.id].name) : '???'}</span>`);
    b.onclick = () => { SS.Audio.play('click'); list.querySelectorAll('.acard').forEach(x => x.classList.remove('on')); b.classList.add('on'); showDetail(e); };
    list.appendChild(b);
    if (k === 0) { b.classList.add('on'); showDetail(e); }
  });
}

// ---------- boot ----------
show('title');
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
SS.Art.loadSprites();
// test hooks
SS.test = {
  get battle() { return battle; },
  start: (i, cards) => { SS.skipIntros = true; startLevel(i, cards || (i === 0 ? SS.LEVELS[0].cards : unlockedUnits().slice(0, SS.MAX_SLOTS))); SS.skipIntros = false; },
  prep: i => prepLevel(i),
  step: (sec) => { if (!battle) return; const n = Math.round(sec / SS.DT); for (let k = 0; k < n && (battle.state === 'play' || battle.state === 'clear'); k++) battle.update(SS.DT); },
  quit: quitToMap,
  view: () => view,
};
})();

// ---------- "Add to Home Screen" coach (iPhone/iPad in Safari, not yet installed) ----------
(() => {
  const ua = navigator.userAgent;
  const iOS = /iPhone|iPod/.test(ua) || /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  const force = /[?&]a2hs=(\d+|1)/.exec(location.search);
  if (!force && (!iOS || installed)) return;
  const iPad = /iPad/.test(ua) || navigator.platform === 'MacIntel';
  const other = /CriOS|FxiOS|EdgiOS|OPiOS|GSA\/|FBAN|FBAV|Instagram|LinkedInApp/.test(ua);   // not Safari
  const sv = +((/Version\/(\d+)/.exec(ua) || [])[1] || 0);
  const modern = force ? force[1] !== '18' : sv >= 26;   // Safari 26: Share lives under the ••• menu
  const name = (document.querySelector('meta[name="apple-mobile-web-app-title"]') || {}).content || document.title;
  const icon = (document.querySelector('link[rel="apple-touch-icon"]') || {}).href || 'icons/icon-192.png';
  const I = {
    dots: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" class="a-btn"/><circle cx="14" cy="24" r="3.4"/><circle cx="24" cy="24" r="3.4"/><circle cx="34" cy="24" r="3.4"/></svg>',
    share: '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="21" class="a-btn"/><path d="M17 21h-2.5v15h19V21H31" class="a-ln"/><path d="M24 29V9M18 15l6-6 6 6" class="a-ln"/></svg>',
    add: '<svg viewBox="0 0 48 48"><rect x="9" y="9" width="30" height="30" rx="8" class="a-ln"/><path d="M24 17v14M17 24h14" class="a-ln"/></svg>',
    hand: '<svg viewBox="0 0 40 40" class="a-hand"><path d="M16 36c-3-4-8-8-8-11 0-2 2-3 4-2l4 3V8a2.5 2.5 0 0 1 5 0v10l9 1.5c2 .4 3 2 2.7 4L31 36z"/></svg>',
  };
  const bar = hl => `<div class="a-mock a-bar">
      ${modern ? `<span class="a-pill">◂</span><span class="a-url">🔒 ${location.host}</span><span class="a-ico ${hl === 'dots' ? 'hl' : ''}">${I.dots}${hl === 'dots' ? I.hand : ''}</span>`
               : `<span class="a-pill">‹</span><span class="a-pill">›</span><span class="a-ico ${hl === 'share' ? 'hl' : ''}">${I.share}${hl === 'share' ? I.hand : ''}</span><span class="a-pill">▢</span><span class="a-pill">⧉</span>`}
    </div>`;
  const menu = (rows, hl) => `<div class="a-mock a-menu">${rows.map(([ic, t]) => `<div class="a-row ${t === hl ? 'hl' : ''}"><span>${t}</span>${ic}${t === hl ? I.hand : ''}</div>`).join('')}</div>`;
  const steps = [];
  if (other) steps.push(['🧭', 'Open this page in <b>Safari</b>', '<div class="a-mock a-note">Home Screen web apps work best from Safari. Copy the link, then paste it into Safari.</div>']);
  if (modern && !iPad) {
    steps.push([1, 'Tap the <b>•••</b> button next to the address bar', bar('dots')]);
    steps.push([2, 'Tap <b>Share</b>', menu([[I.share, 'Share'], ['<svg viewBox="0 0 48 48"><path d="M12 10h24v30l-12-8-12 8z" class="a-ln"/></svg>', 'Add Bookmark']], 'Share')]);
  } else {
    steps.push([1, `Tap the <b>Share</b> button${iPad ? ' at the top of Safari' : ' at the bottom of Safari'}`, bar('share')]);
  }
  steps.push([steps.length + (other ? 0 : 1), 'Scroll down and tap <b>Add to Home Screen</b>', menu([['<svg viewBox="0 0 48 48"><rect x="10" y="12" width="28" height="24" rx="4" class="a-ln"/></svg>', 'Copy'], [I.add, 'Add to Home Screen']], 'Add to Home Screen')]);
  steps.push([steps.length + (other ? 0 : 1), `${modern ? 'Leave <b>Open as Web App</b> on, then tap' : 'Tap'} <b>Add</b>`,
    `<div class="a-mock a-sheet"><img src="${icon}" alt=""><div><b>${name}</b><small>${location.host}</small>${modern ? '<span class="a-tog">Open as Web App <i></i></span>' : ''}</div><span class="a-addbtn">Add</span></div>`]);
  steps.push(['✓', `Open <b>${name}</b> from your Home Screen`, `<div class="a-mock a-home"><span></span><img src="${icon}" alt=""><span></span><em>${name}</em></div>`]);

  const el = document.createElement('div');
  el.id = 'a2hs'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-labelledby', 'a2hs-t');
  el.innerHTML = `<div class="a-box">
      <div class="a-head"><img src="${icon}" alt=""><div><h2 id="a2hs-t">Add ${name} to your Home Screen</h2>
      <p>It plays full screen with no Safari bars in the way, keeps your progress, and opens like an app. Takes 10 seconds.</p></div></div>
      <ol class="a-steps">${steps.map(([n, t, g]) => `<li><span class="a-n">${n}</span><p>${t}</p>${g}</li>`).join('')}</ol>
      <button id="a2hs-skip" class="back">Play in Safari anyway <small>(not recommended)</small></button>
    </div>`;
  document.body.appendChild(el);
  el.querySelector('#a2hs-skip').onclick = () => { el.remove(); };
})();
