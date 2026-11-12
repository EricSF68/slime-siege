// Slime Siege — procedural vector art. Optional PNG overrides in assets/sprites/<id>.png (see ASSETS.md)
'use strict';
SS.Art = (() => {
  const sprites = {};
  function loadSprites() {
    if (location.protocol === 'file:') return;
    // a themed build can point at its own sprite folder and list (SS.SPRITE_DIR + sprites.json)
    const list = SS.SPRITE_DIR ? fetch(SS.SPRITE_DIR + 'sprites.json').then(r => r.ok ? r.json() : []).catch(() => []).then(a => ({ sprites: a })) : SS.assetManifest();
    list.then(m => (m.sprites || []).forEach(id => {
      const img = new Image();
      img.onload = () => { sprites[id] = img; if (id === 'background') SS.Art.bgDirty = true; };
      img.src = `${SS.SPRITE_DIR || 'assets/sprites/'}${id}.png`;
    }));
  }

  const SPRITE_H = SS.SPRITE_H || { bulwark: 100, mine: 50, bomb: 84, spark: 96, tesla: 112, cryo: 100 };
  const SLIME_K = SS.SLIME_K || { dasher: 0.62, hopper: 1.15, shield: 1.0, brute: 1.0, king: 1.0, acid: 0.95 };
  const useSprite = id => !!sprites[id] && (!SS.settings || SS.settings.gfx !== 'classic');
  function shade(hex, amt) {
    let r, g, b;
    const m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(hex);
    if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }
    else {
      let c = hex.replace('#', '');
      if (c.length === 3) c = c.split('').map(x => x + x).join('');
      r = parseInt(c.slice(0, 2), 16); g = parseInt(c.slice(2, 4), 16); b = parseInt(c.slice(4, 6), 16);
    }
    const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
    r = Math.round((t - r) * p + r); g = Math.round((t - g) * p + g); b = Math.round((t - b) * p + b);
    return `rgb(${r},${g},${b})`;
  }
  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function ell(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }
  function fillStroke(ctx, fill, stroke, lw = 3) { ctx.fillStyle = fill; ctx.fill(); if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); } }

  // metallic vertical gradient for a box at (x,y,w,h)
  function metal(ctx, c, x, y, w, h) {
    const g = ctx.createLinearGradient(x, y, x + w * 0.35, y + h);
    g.addColorStop(0, shade(c, 0.35)); g.addColorStop(0.45, c); g.addColorStop(1, shade(c, -0.35));
    return g;
  }
  function rim(ctx, x, y, w, h, r) {
    ctx.save(); rr(ctx, x + 2, y + 2, w - 4, h - 4, Math.max(1, r - 2)); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x + r, y + 3); ctx.lineTo(x + w - r, y + 3); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x + 3, y + h - 3); ctx.lineTo(x + w - 3, y + h - 3); ctx.stroke();
    ctx.restore();
  }
  function treads(ctx, w = 30, t = 0, moving = true) {
    const g = ctx.createLinearGradient(0, 26, 0, 42); g.addColorStop(0, '#3a414f'); g.addColorStop(1, '#171a21');
    rr(ctx, -w, 26, w * 2, 16, 8); fillStroke(ctx, g, '#0e1014', 2);
    // tread links
    ctx.save(); rr(ctx, -w + 1, 27, w * 2 - 2, 14, 7); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 2;
    const off = moving ? (t * 14) % 7 : 0;
    for (let x = -w - 7 + off; x < w + 7; x += 7) { ctx.beginPath(); ctx.moveTo(x, 27); ctx.lineTo(x, 41); ctx.stroke(); }
    ctx.restore();
    for (let i = -1; i <= 1; i++) {
      const wg = ctx.createRadialGradient(i * w * 0.62 - 1.5, 32.5, 0.5, i * w * 0.62, 34, 6);
      wg.addColorStop(0, '#9aa3b2'); wg.addColorStop(1, '#3e4552');
      ctx.fillStyle = wg; ell(ctx, i * (w * 0.62), 34, 5.5, 5.5); ctx.fill();
      ctx.fillStyle = '#20242c'; ell(ctx, i * (w * 0.62), 34, 1.6, 1.6); ctx.fill();
    }
  }
  function eye(ctx, x, y, t, color = '#5ff') {
    const blink = (Math.sin(t * 1.3) > 0.97) ? 0.2 : 1;
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 10;
    rr(ctx, x - 4, y - 4 * blink, 8, 8 * blink, 3); ctx.fill(); ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; ell(ctx, x - 1.5, y - 1.5 * blink, 1.4, 1.4 * blink); ctx.fill();
  }
  function weapon(ctx, w, bob, o, t) {
    const recoil = o.firing ? -5 : 0;
    const n = w.n, gap = 8, len = w.long ? 34 : 26;
    if (w.gatling) {
      ctx.save(); ctx.translate(22 + recoil, 2 + bob);
      rr(ctx, 0, -11, 30, 22, 5); fillStroke(ctx, '#3a4250', '#1b1f27', 2);
      ctx.strokeStyle = w.c; ctx.lineWidth = 3;
      const spin = (t * (o.firing ? 30 : 4)) % 1;
      for (let i = 0; i < 4; i++) { const yy = -8 + ((i * 5.5 + spin * 5.5) % 22); ctx.beginPath(); ctx.moveTo(26, yy); ctx.lineTo(46, yy); ctx.stroke(); }
      ctx.restore(); return;
    }
    for (let i = 0; i < n; i++) {
      const yy = 2 + bob + (i - (n - 1) / 2) * gap * (n > 1 ? 1.4 : 1);
      const th = w.big ? 14 : 10;
      rr(ctx, 20 + recoil, yy - th / 2, len, th, 4);
      { const bg = ctx.createLinearGradient(0, yy - th / 2, 0, yy + th / 2); bg.addColorStop(0, '#7a8494'); bg.addColorStop(0.4, '#454d5c'); bg.addColorStop(1, '#232831'); fillStroke(ctx, bg, '#14171d', 2); }
      ctx.fillStyle = w.c; ctx.shadowColor = w.c; ctx.shadowBlur = o.firing ? 14 : 6;
      rr(ctx, 20 + len - 6 + recoil, yy - th / 2 + 2, 6, th - 4, 2); ctx.fill(); ctx.shadowBlur = 0;
    }
  }

  function extras(ctx, list, p, bob, t, o) {
    for (const x of list || []) {
      switch (x) {
        case 'coil': {
          ctx.strokeStyle = '#c47d10'; ctx.lineWidth = 3; ctx.beginPath();
          for (let i = 0; i < 6; i++) ctx.lineTo((i % 2 ? 6 : -6), -44 + bob - i * 4);
          ctx.stroke(); break;
        }
        case 'reactor': {
          const g = 0.5 + 0.5 * Math.sin(t * 5);
          ctx.fillStyle = `rgba(255,240,120,${0.25 + g * 0.35})`; ell(ctx, 0, 0 + bob, 34, 34); ctx.fill();
          ctx.strokeStyle = '#fff6b0'; ctx.lineWidth = 2; ell(ctx, 0, 0 + bob, 30, 12); ctx.stroke();
          break;
        }
        case 'ice': {
          ctx.fillStyle = 'rgba(220,250,255,0.95)'; ctx.strokeStyle = '#7fc8e8'; ctx.lineWidth = 1.5;
          for (const [x0, y0, s] of [[-24, -14, 1], [18, -20, 0.8], [-6, 22, 0.7]]) {
            ctx.beginPath(); ctx.moveTo(x0, y0 + bob - 10 * s); ctx.lineTo(x0 + 6 * s, y0 + bob); ctx.lineTo(x0, y0 + bob + 6 * s); ctx.lineTo(x0 - 6 * s, y0 + bob); ctx.closePath(); ctx.fill(); ctx.stroke();
          }
          break;
        }
        case 'mortar': {
          ctx.save(); ctx.translate(-8, -22 + bob); ctx.rotate(-0.6);
          rr(ctx, -7, -30, 16, 32, 4); fillStroke(ctx, '#3c4a3a', '#1c241b', 2);
          ctx.fillStyle = '#111'; ell(ctx, 1, -30, 7, 3); ctx.fill();
          ctx.restore(); break;
        }
        case 'nozzle': {
          rr(ctx, 18, -2 + bob, 26, 14, 4); fillStroke(ctx, '#5a3a2a', '#2a1a10', 2);
          rr(ctx, 40, -6 + bob, 10, 22, 3); fillStroke(ctx, '#7a4a30', '#2a1a10', 2);
          const f = 4 + Math.sin(t * 20) * 2;
          ctx.fillStyle = '#ffcf40'; ctx.shadowColor = '#ff8a20'; ctx.shadowBlur = 10;
          ell(ctx, 54, 5 + bob, f, f * 0.7); ctx.fill(); ctx.shadowBlur = 0; break;
        }
        case 'fire': {
          for (const xx of [-22, 22]) {
            const h = 10 + Math.sin(t * 15 + xx) * 3;
            ctx.fillStyle = '#ff9a2a'; ctx.beginPath(); ctx.moveTo(xx - 6, -14 + bob); ctx.quadraticCurveTo(xx, -14 - h * 2 + bob, xx + 6, -14 + bob); ctx.fill();
            ctx.fillStyle = '#ffe36a'; ctx.beginPath(); ctx.moveTo(xx - 3, -14 + bob); ctx.quadraticCurveTo(xx, -14 - h + bob, xx + 3, -14 + bob); ctx.fill();
          }
          break;
        }
        case 'solar': {
          ctx.save(); ctx.translate(0, -44 + bob); ctx.rotate(-0.15);
          rr(ctx, -26, -6, 52, 12, 2); fillStroke(ctx, '#1d3c7a', '#a9c7ff', 2);
          ctx.strokeStyle = '#6f9bff'; ctx.lineWidth = 1;
          for (let i = -18; i <= 18; i += 9) { ctx.beginPath(); ctx.moveTo(i, -6); ctx.lineTo(i, 6); ctx.stroke(); }
          ctx.restore(); break;
        }
        case 'tcoil': case 'tcoil2': {
          const xx = x === 'tcoil2' ? 14 : (p.body === 'tall' ? 0 : -14);
          const top = p.body === 'tall' ? -62 : -44;
          ctx.strokeStyle = '#c0b0ff'; ctx.lineWidth = 3;
          for (let i = 0; i < 3; i++) { ell(ctx, xx, top + 14 + bob + i * 6, 9 - i, 3); ctx.stroke(); }
          ctx.fillStyle = '#e8e0ff'; ctx.shadowColor = '#b49cff'; ctx.shadowBlur = 14;
          ell(ctx, xx, top + bob, 8, 8); ctx.fill(); ctx.shadowBlur = 0;
          if (Math.sin(t * 13 + xx) > 0.3) {
            ctx.strokeStyle = '#e8e0ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(xx, top + bob);
            for (let i = 1; i < 5; i++) ctx.lineTo(xx + (Math.random() - 0.5) * 20, top + bob - i * 5);
            ctx.stroke();
          }
          break;
        }
        case 'spikes': {
          ctx.fillStyle = '#d8e0ea'; ctx.strokeStyle = '#4a5260'; ctx.lineWidth = 1.5;
          for (let y = -36; y <= 30; y += 16) { ctx.beginPath(); ctx.moveTo(34, y); ctx.lineTo(48, y + 6); ctx.lineTo(34, y + 12); ctx.closePath(); ctx.fill(); ctx.stroke(); }
          if (Math.sin(t * 9) > 0.6) { ctx.strokeStyle = '#9ff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(48, -30); ctx.lineTo(42, -10); ctx.lineTo(48, 10); ctx.stroke(); }
          break;
        }
        case 'battlement': {
          ctx.fillStyle = shade(p.color, -0.1);
          for (let i = -36; i < 36; i += 18) { rr(ctx, i, -60, 12, 14, 2); fillStroke(ctx, shade(p.color, -0.1), '#2a3038', 2); }
          break;
        }
        case 'hazard': {
          ctx.save(); ell(ctx, 0, 30, 30, 9); ctx.clip();
          for (let i = -40; i < 40; i += 10) { ctx.fillStyle = (i / 10) % 2 ? '#111' : '#f0d020'; ctx.beginPath(); ctx.moveTo(i, 20); ctx.lineTo(i + 10, 20); ctx.lineTo(i + 4, 40); ctx.lineTo(i - 6, 40); ctx.fill(); }
          ctx.restore(); break;
        }
      }
    }
  }

  function drawRobot(ctx, id, t, o = {}) {
    const d = SS.UNITS[id]; if (!d) return;
    const p = d.parts;
    ctx.save();
    if (o.scale) ctx.scale(o.scale, o.scale);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    if (useSprite(id)) {
      const img = sprites[id];
      const h = SPRITE_H[id] || 100, w = img.width / img.height * h;
      if (o.armed === false) ctx.globalAlpha *= 0.55;   // unarmed mine reads as dimmed
      ctx.drawImage(img, -w / 2, 44 - h, w, h);
    } else {
      const bob = (p.body === 'wall' || p.body === 'mine' || p.body === 'bomb') ? 0 : Math.sin(t * 3 + (o.phase || 0)) * 1.5;
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ell(ctx, 0, 42, 36, 8); ctx.fill();
      const c = p.color, dark = shade(c, -0.45);
      switch (p.body) {
        case 'box': {
          if (p.extras && p.extras.includes('mortar')) extras(ctx, ['mortar'], p, bob, t, o);
          treads(ctx, 30, t + (o.phase || 0));
          rr(ctx, -26, -14 + bob, 52, 42, 10); fillStroke(ctx, metal(ctx, c, -26, -14 + bob, 52, 42), dark);
          rim(ctx, -26, -14 + bob, 52, 42, 10);
          ctx.strokeStyle = shade(c, -0.3); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-22, 2 + bob); ctx.lineTo(22, 2 + bob); ctx.stroke();
          { const cg = ctx.createRadialGradient(-2, 10 + bob, 1, 0, 12 + bob, 8); cg.addColorStop(0, shade(c, 0.5)); cg.addColorStop(1, shade(c, -0.3)); ctx.fillStyle = cg; ell(ctx, 0, 12 + bob, 7, 7); ctx.fill(); }
          ctx.fillStyle = shade(c, -0.5); for (const [rx, ry] of [[-21, -9], [21, -9], [-21, 23], [21, 23]]) { ell(ctx, rx, ry + bob, 1.8, 1.8); ctx.fill(); }
          if (p.head === 'visor') {
            rr(ctx, -19, -40 + bob, 38, 28, 9); fillStroke(ctx, metal(ctx, shade(c, -0.08), -19, -40 + bob, 38, 28), dark);
            rim(ctx, -19, -40 + bob, 38, 28, 9);
            rr(ctx, -13, -32 + bob, 28, 11, 5); { const vg = ctx.createLinearGradient(0, -32 + bob, 0, -21 + bob); vg.addColorStop(0, '#1d3550'); vg.addColorStop(1, '#060d16'); ctx.fillStyle = vg; ctx.fill(); }
            ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, -11, -31 + bob, 14, 3, 1.5); ctx.fill();
            eye(ctx, 6, -26.5 + bob, t);
          } else if (p.head === 'dome') {
            ctx.beginPath(); ctx.arc(0, -14 + bob, 19, Math.PI, 0); ctx.closePath();
            { const dg = ctx.createRadialGradient(-6, -26 + bob, 2, 0, -16 + bob, 22); dg.addColorStop(0, 'rgba(255,255,255,0.95)'); dg.addColorStop(0.35, 'rgba(200,245,255,0.75)'); dg.addColorStop(1, 'rgba(120,200,230,0.6)'); fillStroke(ctx, dg, dark, 2); }
            ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, -14 + bob, 14, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke();
            eye(ctx, 5, -22 + bob, t, '#fff');
          }
          if (p.weapon) weapon(ctx, p.weapon, bob, o, t);
          extras(ctx, (p.extras || []).filter(x => x !== 'mortar'), p, bob, t, o);
          break;
        }
        case 'round': {
          treads(ctx, 26, t + (o.phase || 0));
          if (p.extras && p.extras.includes('reactor')) extras(ctx, ['reactor'], p, bob, t, o);
          ell(ctx, 0, 2 + bob, 28, 28);
          { const rg = ctx.createRadialGradient(-9, -9 + bob, 3, 0, 2 + bob, 30); rg.addColorStop(0, shade(c, 0.5)); rg.addColorStop(0.55, c); rg.addColorStop(1, shade(c, -0.4)); fillStroke(ctx, rg, dark); }
          ctx.fillStyle = 'rgba(255,255,255,0.55)'; ell(ctx, -10, -11 + bob, 7, 4); ctx.fill();
          ctx.strokeStyle = shade(c, -0.3); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 2 + bob, 22, 0.2, Math.PI - 0.2); ctx.stroke();
          rr(ctx, -14, -2 + bob, 28, 12, 6); ctx.fillStyle = '#2a1e05'; ctx.fill();
          eye(ctx, -5, 4 + bob, t, '#ffe9a0'); eye(ctx, 7, 4 + bob, t + 0.1, '#ffe9a0');
          const glow = o.producing ? 1 : 0.5 + 0.3 * Math.sin(t * 4);
          ctx.fillStyle = `rgba(255,240,140,${glow})`; ctx.shadowColor = '#ffd84a'; ctx.shadowBlur = 16 * glow;
          ell(ctx, 0, -32 + bob - 22, 9, 9); ctx.fill(); ctx.shadowBlur = 0;
          extras(ctx, (p.extras || []).filter(x => x !== 'reactor'), p, bob, t, o);
          break;
        }
        case 'tall': {
          treads(ctx, 24, t + (o.phase || 0));
          rr(ctx, -18, -30 + bob, 36, 58, 8); fillStroke(ctx, metal(ctx, c, -18, -30 + bob, 36, 58), dark);
          rim(ctx, -18, -30 + bob, 36, 58, 8);
          ctx.fillStyle = shade(c, 0.25); rr(ctx, -12, -24 + bob, 8, 46, 4); ctx.fill();
          rr(ctx, -10, -12 + bob, 22, 9, 4); ctx.fillStyle = '#120d2a'; ctx.fill();
          eye(ctx, 5, -7.5 + bob, t, '#d8c8ff');
          extras(ctx, p.extras, p, bob, t, o);
          break;
        }
        case 'wall': {
          const w = (p.extras && p.extras.includes('battlement')) ? 40 : 34;
          rr(ctx, -w, -48, w * 2, 92, 8); fillStroke(ctx, metal(ctx, c, -w, -48, w * 2, 92), dark);
          rr(ctx, -w + 6, -42, w * 2 - 12, 38, 5); fillStroke(ctx, metal(ctx, shade(c, 0.12), -w + 6, -42, w * 2 - 12, 38), shade(c, -0.35), 1.5);
          rr(ctx, -w + 6, 2, w * 2 - 12, 36, 5); fillStroke(ctx, metal(ctx, shade(c, -0.08), -w + 6, 2, w * 2 - 12, 36), shade(c, -0.35), 1.5);
          rim(ctx, -w, -48, w * 2, 92, 8);
          ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1;
          for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(-w + 12 + k * 9, 30); ctx.lineTo(-w + 20 + k * 9, 8); ctx.stroke(); }
          ctx.fillStyle = shade(c, -0.5);
          for (const [x, y] of [[-w + 12, -36], [w - 12, -36], [-w + 12, 32], [w - 12, 32]]) { ell(ctx, x, y, 3, 3); ctx.fill(); }
          eye(ctx, -8, -24, t, '#ffcf5a'); eye(ctx, 10, -24, t + 0.2, '#ffcf5a');
          const hr = o.hpRatio == null ? 1 : o.hpRatio;
          if (hr < 0.67) { ctx.strokeStyle = shade(c, -0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-w + 8, -10); ctx.lineTo(-6, 4); ctx.lineTo(-14, 20); ctx.stroke(); }
          if (hr < 0.34) { ctx.beginPath(); ctx.moveTo(w - 6, -40); ctx.lineTo(8, -20); ctx.lineTo(16, 0); ctx.lineTo(4, 14); ctx.stroke(); }
          if (p.weapon) weapon(ctx, p.weapon, -18, o, t);
          extras(ctx, p.extras, p, 0, t, o);
          break;
        }
        case 'mine': {
          const armed = o.armed !== false;
          const rise = armed ? 0 : 10;
          ell(ctx, 0, 32 + rise * 0.3, 32, 11); fillStroke(ctx, '#3a2a1a', '#1a120a', 2);
          ctx.beginPath(); ctx.ellipse(0, 30 + rise, 26, 16, 0, Math.PI, 0); ctx.closePath(); fillStroke(ctx, p.color, shade(p.color, -0.45));
          extras(ctx, p.extras, p, 0, t, o);
          const on = armed ? (Math.sin(t * 8) > 0) : false;
          ctx.fillStyle = on ? '#ff3030' : (armed ? '#801010' : '#555');
          if (on) { ctx.shadowColor = '#f33'; ctx.shadowBlur = 14; }
          ell(ctx, 0, 14 + rise, 6, 6); ctx.fill(); ctx.shadowBlur = 0;
          if (!armed) { ctx.fillStyle = '#ccc'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('…', 0, 6 + rise); }
          break;
        }
        case 'crate': {
          const c0 = p.color;
          rr(ctx, -32, -30, 64, 66, 6); fillStroke(ctx, metal(ctx, c0, -32, -30, 64, 66), shade(c0, -0.55), 3);
          ctx.strokeStyle = shade(c0, -0.35); ctx.lineWidth = 3;
          for (const yy of [-12, 8]) { ctx.beginPath(); ctx.moveTo(-30, yy); ctx.lineTo(30, yy); ctx.stroke(); }
          rr(ctx, -34, -34, 68, 10, 3); fillStroke(ctx, '#5a6474', '#2a3038', 2);
          for (const [x, y] of [[-26, 28], [26, 28], [-26, -16], [26, -16]]) { ctx.fillStyle = '#3a3a3a'; ell(ctx, x, y, 2.5, 2.5); ctx.fill(); }
          ctx.fillStyle = '#ffe36a'; ctx.strokeStyle = '#4a2a10'; ctx.lineWidth = 4; ctx.font = '900 34px system-ui,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.strokeText('?', 0, 6); ctx.fillText('?', 0, 6);
          break;
        }
        case 'bomb': {
          const swell = o.fuse != null ? 1 + (1 - o.fuse) * 0.25 + Math.sin(t * 40) * 0.03 * (1 - o.fuse) : 1;
          ctx.save(); ctx.translate(0, 10); ctx.scale(swell, swell);
          ell(ctx, 0, 0, 28, 28); fillStroke(ctx, p.color, '#000');
          ctx.fillStyle = 'rgba(255,255,255,0.25)'; ell(ctx, -9, -10, 8, 5); ctx.fill();
          rr(ctx, -6, -34, 12, 8, 2); fillStroke(ctx, '#666', '#222', 2);
          ctx.strokeStyle = '#a07a40'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -34); ctx.quadraticCurveTo(10, -46, 4, -52); ctx.stroke();
          ctx.fillStyle = Math.sin(t * 30) > 0 ? '#ffe36a' : '#ff7a20'; ell(ctx, 4, -53, 4, 4); ctx.fill();
          ctx.fillStyle = '#ff4040'; ctx.beginPath(); ctx.moveTo(-14, -4); ctx.lineTo(-3, 0); ctx.lineTo(-14, 4); ctx.fill();
          ctx.beginPath(); ctx.moveTo(14, -4); ctx.lineTo(3, 0); ctx.lineTo(14, 4); ctx.fill();
          extras(ctx, p.extras, p, 0, t, o);
          ctx.restore();
          break;
        }
      }
    }
    if (d.fusion && !o.noBadge) {
      ctx.fillStyle = '#ffd84a'; ctx.strokeStyle = '#7a5a00'; ctx.lineWidth = 1.5;
      star(ctx, -34, -46, 7); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }
  function star(ctx, x, y, r) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); }
    ctx.closePath();
  }

  // ---------------- Slimes ----------------
  // Origin at slime's ground point (center bottom).
  let huskCanvas = null;
  function drawSlime(ctx, type, t, o = {}) {
    if (o.husk) {                       // charred silhouette after a blast
      const S = 360;
      if (!huskCanvas) { huskCanvas = document.createElement('canvas'); huskCanvas.width = huskCanvas.height = S; }
      const hc = huskCanvas.getContext('2d');
      hc.setTransform(1, 0, 0, 1, 0, 0); hc.globalCompositeOperation = 'source-over'; hc.clearRect(0, 0, S, S);
      hc.translate(S / 2, S - 20);
      SS.Art.drawSlime(hc, type, t, Object.assign({}, o, { husk: false, alpha: 1, flash: false, slow: false, frozen: false, scale: 1 }));
      hc.setTransform(1, 0, 0, 1, 0, 0); hc.globalCompositeOperation = 'source-atop';
      hc.fillStyle = '#241c16'; hc.fillRect(0, 0, S, S);
      hc.fillStyle = 'rgba(255,140,60,0.25)'; for (let i = 0; i < 6; i++) { hc.beginPath(); hc.arc(S / 2 - 40 + i * 16, S - 50 - (i % 3) * 18, 3, 0, 6.3); hc.fill(); }
      ctx.save(); if (o.scale) ctx.scale(o.scale, o.scale); if (o.alpha != null) ctx.globalAlpha *= o.alpha;
      ctx.drawImage(huskCanvas, -S / 2, -(S - 20)); ctx.restore();
      return;
    }
    const d = SS.SLIMES[type];
    const R = 32 * d.size;
    ctx.save();
    if (o.scale) ctx.scale(o.scale, o.scale);
    if (o.alpha != null) ctx.globalAlpha *= o.alpha;
    const ph = o.phase || 0;
    let sq = o.moving === false ? Math.sin(t * 3 + ph) * 0.03 : Math.sin(t * 7 + ph) * 0.08;
    if (o.eating) sq = Math.sin(t * 14 + ph) * 0.1;
    if (o.melt != null) sq = 0;
    const melt = o.melt != null ? o.melt : 0; // 0..1
    const w = R * 1.15 * (1 + sq) * (1 + melt * 0.6), h = R * 1.55 * (1 - sq) * (1 - melt * 0.85);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ell(ctx, 0, 2, w * 1.05, 7 * d.size); ctx.fill();
    // armored slimes fall back to the plain Blob art once their armor is gone
    let spriteKey = type;
    if ((type === 'capped' || type === 'iron') && !(o.armor > 0)) spriteKey = 'blob';
    if (type === 'shield' && !(o.front > 0)) spriteKey = 'blob';
    if (useSprite(spriteKey)) {
      const img = sprites[spriteKey]; const hh = R * 3.0 * (SLIME_K[type] || 1), ww = img.width / img.height * hh;
      ctx.save(); ctx.scale(1 + sq, (1 - sq) * (1 - melt * 0.85)); ctx.drawImage(img, -ww / 2, -hh, ww, hh); ctx.restore();
    } else {
      let col = d.color;
      if (type === 'splitter') col = '#b85bd6';
      if (o.enraged) col = '#e2583a';
      // hopper legs
      let lift = 0;
      if (type === 'hopper' && melt === 0) {
        lift = 10 + Math.sin(t * 7 + ph) * 3;
        ctx.strokeStyle = '#6a7484'; ctx.lineWidth = 3;
        for (const xx of [-R * 0.45, R * 0.45]) {
          ctx.beginPath(); ctx.moveTo(xx, 0);
          for (let i = 1; i <= 5; i++) ctx.lineTo(xx + (i % 2 ? 6 : -6), -i * lift / 5);
          ctx.stroke();
        }
      }
      ctx.save(); ctx.translate(0, -lift);
      // body
      ctx.beginPath();
      ctx.moveTo(-w, 0);
      ctx.bezierCurveTo(-w, -h * 0.85, -w * 0.5, -h, 0, -h);
      ctx.bezierCurveTo(w * 0.5, -h, w, -h * 0.85, w, 0);
      ctx.quadraticCurveTo(0, 5, -w, 0);
      ctx.closePath();
      const g = ctx.createRadialGradient(-w * 0.3, -h * 0.75, R * 0.1, 0, -h * 0.4, Math.max(w, h) * 1.1);
      g.addColorStop(0, shade(col, 0.45)); g.addColorStop(0.45, col); g.addColorStop(1, shade(col, -0.45));
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = shade(col, -0.55); ctx.stroke();
      // inner glow & floating bubbles (translucent goo)
      ctx.save(); ctx.clip();
      const ig = ctx.createRadialGradient(0, -h * 0.25, 0, 0, -h * 0.25, w);
      ig.addColorStop(0, 'rgba(255,255,255,0.12)'); ig.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = ig; ctx.fillRect(-w, -h, w * 2, h);
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      for (let i = 0; i < 3; i++) { const bt = ((t * 0.25 + i * 0.37 + (o.phase || 0)) % 1); ell(ctx, w * (0.45 - i * 0.35), -h * (0.15 + bt * 0.6), 2 + i * 0.8, 2 + i * 0.8); ctx.fill(); }
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(-w, -h * 0.18, w * 2, h * 0.2);
      ctx.restore();
      if (type === 'splitter') {
        ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(255,120,200,0.45)'; ctx.fillRect(0, -h, w, h + 5); ctx.restore();
        ctx.setLineDash([4, 4]); ctx.strokeStyle = shade(col, -0.5); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -h + 2); ctx.lineTo(0, 0); ctx.stroke(); ctx.setLineDash([]);
      }
      // highlight
      ctx.fillStyle = 'rgba(255,255,255,0.55)'; ctx.save(); ctx.translate(-w * 0.42, -h * 0.72); ctx.rotate(-0.5); ell(ctx, 0, 0, w * 0.2, h * 0.08); ctx.fill(); ctx.restore();
      ctx.fillStyle = 'rgba(255,255,255,0.8)'; ell(ctx, -w * 0.18, -h * 0.86, R * 0.06, R * 0.06); ctx.fill();
      if (type === 'acid') {
        ctx.fillStyle = 'rgba(255,255,200,0.6)';
        for (let i = 0; i < 3; i++) { const bt = (t * 0.8 + i * 0.33) % 1; ell(ctx, -w * 0.4 + i * w * 0.4, -h * bt, 3 + i, 3 + i); ctx.fill(); }
        ctx.fillStyle = shade(col, -0.1);
        for (const xx of [-w * 0.6, w * 0.2]) { const dl = (t * 1.5 + xx) % 1; ell(ctx, xx, dl * 8, 3, 4 + dl * 4); ctx.fill(); }
      }
      if (type === 'dasher' && o.moving !== false && melt === 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(w + 6, -h * (0.3 + i * 0.2)); ctx.lineTo(w + 20 + i * 4, -h * (0.3 + i * 0.2)); ctx.stroke(); }
      }
      if (melt < 0.6) {
        // eyes (facing left)
        const ey = -h * 0.58, er = Math.max(5, R * 0.2);
        for (const ex of [-w * 0.42, w * 0.05]) {
          ctx.fillStyle = '#fff'; ell(ctx, ex, ey, er, er * 1.15); ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = '#111'; ell(ctx, ex - er * 0.35, ey + er * 0.1, er * 0.5, er * 0.6); ctx.fill();
          ctx.fillStyle = '#fff'; ell(ctx, ex - er * 0.5, ey - er * 0.15, er * 0.18, er * 0.18); ctx.fill();
        }
        if (type !== 'brute' && type !== 'king' && type !== 'acid') {
          ctx.fillStyle = 'rgba(255,120,150,0.28)';
          ell(ctx, -w * 0.62, -h * 0.38, R * 0.14, R * 0.08); ctx.fill();
          ell(ctx, w * 0.28, -h * 0.38, R * 0.14, R * 0.08); ctx.fill();
        }
        if (type === 'brute' || type === 'king' || type === 'acid') {
          ctx.strokeStyle = '#222'; ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(-w * 0.42 - er, ey - er * 1.5); ctx.lineTo(-w * 0.42 + er, ey - er * 0.9); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(w * 0.05 + er, ey - er * 1.5); ctx.lineTo(w * 0.05 - er, ey - er * 0.9); ctx.stroke();
        }
        if (type === 'dasher') { ctx.strokeStyle = '#333'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-w * 0.75, ey); ctx.lineTo(w * 0.3, ey - 2); ctx.stroke(); }
        // mouth
        ctx.fillStyle = '#2a0f1a';
        if (o.eating) { const m = 0.5 + 0.5 * Math.abs(Math.sin(t * 14 + ph)); ell(ctx, -w * 0.3, -h * 0.28, R * 0.25, R * 0.2 * m + 1); ctx.fill(); }
        else { ctx.beginPath(); ctx.arc(-w * 0.25, -h * 0.32, R * 0.16, 0.1, Math.PI - 0.1); ctx.strokeStyle = '#2a0f1a'; ctx.lineWidth = 2.5; ctx.stroke(); }
      }
      // accessories
      if ((type === 'capped' || type === 'iron') && o.armor > 0) {
        const metal = type === 'iron' ? '#8f9aa8' : '#b0a090';
        ctx.beginPath(); ctx.ellipse(0, -h * 0.88, w * (type === 'iron' ? 0.85 : 0.7), h * (type === 'iron' ? 0.36 : 0.26), 0, Math.PI, 0); ctx.closePath();
        fillStroke(ctx, metal, shade(metal, -0.5), 2.5);
        rr(ctx, -w * (type === 'iron' ? 0.95 : 0.8), -h * 0.92, w * (type === 'iron' ? 1.9 : 1.6), 6, 3); fillStroke(ctx, shade(metal, -0.15), shade(metal, -0.5), 2);
        ctx.fillStyle = shade(metal, -0.5);
        if (type === 'iron') for (const xx of [-w * 0.5, 0, w * 0.5]) { ell(ctx, xx, -h * 1.05, 2.5, 2.5); ctx.fill(); }
        if (o.armorRatio != null && o.armorRatio < 0.5) { ctx.strokeStyle = '#333'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-w * 0.3, -h * 1.15); ctx.lineTo(-w * 0.1, -h * 0.95); ctx.lineTo(-w * 0.2, -h * 0.9); ctx.stroke(); }
      }
      if (type === 'spitter' && melt < 0.6) {
        ctx.save(); ctx.translate(-w * 0.62, -h * 0.42); ctx.rotate(-0.5);
        rr(ctx, -16, -6, 20, 12, 5); fillStroke(ctx, shade(col, -0.15), shade(col, -0.55), 2.5);
        ctx.fillStyle = '#3a1a08'; ell(ctx, -16, 0, 3, 5); ctx.fill();
        const drip = (t * 1.2 + ph) % 1; ctx.fillStyle = shade(col, 0.2); ell(ctx, -18, 6 + drip * 10, 2.5, 3 + drip * 2); ctx.fill();
        ctx.restore();
      }
      if (type === 'hothead') {
        if (o.armor > 0) {
          const metal = '#7d8796';
          rr(ctx, -w * 0.62, -h * 1.18, w * 1.24, h * 0.36, 6); fillStroke(ctx, metal, shade(metal, -0.5), 2.5);
          rr(ctx, -w * 0.8, -h * 0.86, w * 1.6, 7, 3); fillStroke(ctx, shade(metal, -0.15), shade(metal, -0.5), 2);
          for (const sx of [-1, 1]) { rr(ctx, sx * w * 0.62 - (sx > 0 ? 0 : 10), -h * 1.08, 10, 6, 3); fillStroke(ctx, '#333a44', '#1a1e24', 1.5); }
          ctx.fillStyle = 'rgba(255,255,255,0.3)'; rr(ctx, -w * 0.5, -h * 1.12, w * 0.4, 5, 2); ctx.fill();
          if (o.armorRatio != null && o.armorRatio < 0.5) { ctx.strokeStyle = '#222'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-w * 0.2, -h * 1.18); ctx.lineTo(0, -h * 1.0); ctx.lineTo(-w * 0.1, -h * 0.9); ctx.stroke(); }
        } else if (o.enraged) {
          ctx.fillStyle = 'rgba(255,255,255,0.55)';
          for (let i = 0; i < 3; i++) { const st = (t * 1.6 + i * 0.33) % 1; ell(ctx, -w * 0.3 + i * w * 0.3, -h - st * 30, 5 + st * 7, 4 + st * 5); ctx.fill(); }
        }
      }
      if (type === 'brute' || type === 'king') {
        ctx.fillStyle = '#e8dcc0'; ctx.strokeStyle = '#6a5a40'; ctx.lineWidth = 2;
        if (type === 'brute') for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * w * 0.4, -h * 0.9); ctx.lineTo(s * w * 0.55, -h * 1.25); ctx.lineTo(s * w * 0.2, -h * 0.97); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        if (type === 'king') {
          ctx.fillStyle = '#ffd34a'; ctx.strokeStyle = '#8a6a10'; ctx.lineWidth = 3;
          const cw = w * 0.6, cy = -h * 0.95;
          ctx.beginPath(); ctx.moveTo(-cw, cy); ctx.lineTo(-cw, cy - 40); ctx.lineTo(-cw * 0.5, cy - 20); ctx.lineTo(0, cy - 50); ctx.lineTo(cw * 0.5, cy - 20); ctx.lineTo(cw, cy - 40); ctx.lineTo(cw, cy); ctx.closePath(); ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#e8304a'; ell(ctx, 0, cy - 14, 7, 7); ctx.fill();
        }
      }
      ctx.restore();
      if (type === 'shield' && o.front > 0) {
        ctx.save(); ctx.translate(-w - 4, 0);
        rr(ctx, -10, -h * 1.1, 14, h * 1.1, 3); fillStroke(ctx, '#9aa6b4', '#3a4250', 2.5);
        ctx.strokeStyle = '#5a6574'; ctx.lineWidth = 1.5;
        for (let y = -h * 0.95; y < 0; y += 14) { ctx.beginPath(); ctx.moveTo(-8, y); ctx.lineTo(2, y); ctx.stroke(); }
        ctx.restore();
      }
    }
    // status overlays
    if (o.slow || o.frozen) {
      ctx.globalCompositeOperation = 'source-atop';
    }
    ctx.restore();
    if (o.slow || o.frozen || o.flash) {
      // tint pass: draw translucent ellipse over body
      ctx.save();
      if (o.scale) ctx.scale(o.scale, o.scale);
      ctx.globalAlpha = o.flash ? 0.45 : (o.frozen ? 0.45 : 0.3);
      ctx.fillStyle = o.flash ? '#ffffff' : '#7fd8ff';
      ctx.beginPath(); ctx.ellipse(0, -h * 0.5, w * 0.95, h * 0.5, 0, 0, Math.PI * 2); ctx.fill();
      if (o.frozen) { ctx.globalAlpha = 0.8; ctx.strokeStyle = '#e0faff'; ctx.lineWidth = 2; ctx.stroke(); }
      ctx.restore();
    }
  }

  // energy cell pickup
  function drawEnergy(ctx, t, scale = 1) {
    ctx.save(); ctx.scale(scale, scale); ctx.rotate(Math.sin(t * 2) * 0.15);
    ctx.shadowColor = '#7ff7ff'; ctx.shadowBlur = 18;
    ctx.fillStyle = '#1b6fa0';
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + i * Math.PI / 3; ctx.lineTo(Math.cos(a) * 22, Math.sin(a) * 22); }
    ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.lineWidth = 3; ctx.strokeStyle = '#bff8ff'; ctx.stroke();
    ctx.fillStyle = '#ffe94a';
    ctx.beginPath(); ctx.moveTo(4, -15); ctx.lineTo(-9, 2); ctx.lineTo(-1, 2); ctx.lineTo(-4, 15); ctx.lineTo(9, -3); ctx.lineTo(1, -3); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  // static background: a robot lab, wider than the screen so the camera can pan to the containment hall
  function makeBackground(variant) {
    const { W, H, COLS, ROWS, TW, TH, BX, BY } = SS.CONST;
    const WW = SS.CONST.WORLD_W || W;
    const night = variant === 'night';
    const c = document.createElement('canvas'); c.width = WW; c.height = H;
    const ctx = c.getContext('2d');
    const BR = BX + COLS * TW;            // right edge of the board
    const BB = BY + ROWS * TH;            // bottom edge of the board
    // seeded noise so the scene is stable
    let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    // --- back wall / ceiling band ---
    let g = ctx.createLinearGradient(0, 0, 0, BY + 10);
    g.addColorStop(0, night ? '#0c1018' : '#3a4a62'); g.addColorStop(1, night ? '#161c28' : '#55667f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, WW, BY + 10);
    // wall panels
    for (let x = 0; x < WW; x += 96) {
      ctx.fillStyle = night ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)'; ctx.fillRect(x + 4, 6, 88, BY - 30);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, 0, 3, BY);
    }
    // pipes & cable trays
    const pipe = (y, h, col) => { const pg = ctx.createLinearGradient(0, y, 0, y + h); pg.addColorStop(0, shade(col, 0.3)); pg.addColorStop(0.5, col); pg.addColorStop(1, shade(col, -0.4)); ctx.fillStyle = pg; ctx.fillRect(0, y, WW, h);
      for (let x = 60; x < WW; x += 180) { ctx.fillStyle = shade(col, -0.35); ctx.fillRect(x, y - 2, 10, h + 4); } };
    pipe(14, 12, night ? '#4a3a2a' : '#b07a3a');
    pipe(34, 8, night ? '#2a3a4a' : '#5a7a9a');
    ctx.fillStyle = night ? '#1a2028' : '#2c3644'; ctx.fillRect(0, 52, WW, 6);
    for (let x = 0; x < WW; x += 14) { ctx.fillStyle = night ? '#242c38' : '#3c4858'; ctx.fillRect(x, 58, 8, 4); }
    // catwalk with railing
    ctx.fillStyle = night ? '#1c222c' : '#3a4452'; ctx.fillRect(0, BY - 26, WW, 14);
    ctx.fillStyle = night ? '#2a323e' : '#5a6676'; ctx.fillRect(0, BY - 26, WW, 3);
    ctx.strokeStyle = night ? '#3a4452' : '#7a8696'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, BY - 56); ctx.lineTo(WW, BY - 56); ctx.stroke();
    for (let x = 20; x < WW; x += 64) { ctx.beginPath(); ctx.moveTo(x, BY - 56); ctx.lineTo(x, BY - 26); ctx.stroke(); }
    ctx.fillStyle = night ? 'rgba(240,192,32,0.35)' : '#f0c020';
    for (let x = 0; x < WW; x += 30) { ctx.beginPath(); ctx.moveTo(x, BY - 12); ctx.lineTo(x + 15, BY - 12); ctx.lineTo(x + 9, BY - 4); ctx.lineTo(x - 6, BY - 4); ctx.fill(); }
    ctx.fillStyle = '#111'; ctx.fillRect(0, BY - 4, WW, 4);
    // crane arm (top right of the board)
    ctx.save(); ctx.translate(BR - 80, 0);
    ctx.fillStyle = night ? '#3a3020' : '#d8a020'; ctx.fillRect(-6, 0, 22, 70);
    ctx.fillRect(-140, 60, 180, 16);
    ctx.strokeStyle = night ? '#2a2216' : '#8a6410'; ctx.lineWidth = 2;
    for (let x = -136; x < 36; x += 16) { ctx.beginPath(); ctx.moveTo(x, 62); ctx.lineTo(x + 12, 74); ctx.stroke(); }
    ctx.strokeStyle = '#222'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-120, 76); ctx.lineTo(-120, 104); ctx.stroke();
    ctx.fillStyle = night ? '#3a3a3a' : '#6a6e78'; rr(ctx, -134, 100, 28, 12, 3); ctx.fill();
    ctx.restore();
    // overhead lamps (light pools are added after the floor)
    const lamps = [];
    for (let i = 0; i < 5; i++) {
      const lx = BX + 100 + i * 210; lamps.push(lx);
      ctx.fillStyle = '#20262e'; rr(ctx, lx - 26, 64, 52, 12, 4); ctx.fill();
      ctx.fillStyle = night ? (i % 2 ? '#ff9a3a' : '#ff4a3a') : '#fff6d0'; rr(ctx, lx - 20, 74, 40, 5, 2); ctx.fill();
    }

    // --- floor (board) ---
    for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
      const x = BX + col * TW, y = BY + r * TH;
      const alt = (r + col) % 2;
      const base = night ? (alt ? '#3a4352' : '#434d5e') : (alt ? '#7e8ca2' : '#8c9ab0');
      const tg = ctx.createLinearGradient(x, y, x + TW, y + TH);
      tg.addColorStop(0, shade(base, 0.08)); tg.addColorStop(1, shade(base, -0.08));
      ctx.fillStyle = tg; ctx.fillRect(x, y, TW, TH);
      ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fillRect(x + 1, y + 1, TW - 2, 2);
      ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(x + TW - 2, y, 2, TH);
      // tread-plate texture
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 2;
      for (let k = 0; k < 5; k++) { const px = x + 14 + k * 20, py = y + 18 + (k % 2) * 46; ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 10, py + 10); ctx.stroke(); }
      // scuffs, drips
      if (rnd() < 0.35) { ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1.5; const sx = x + 15 + rnd() * 60, sy = y + 20 + rnd() * 70; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 20 + rnd() * 20, sy - 6 + rnd() * 12); ctx.stroke(); }
      if (rnd() < 0.18) { ctx.fillStyle = 'rgba(80,200,90,0.16)'; ctx.beginPath(); ctx.ellipse(x + 20 + rnd() * 70, y + 30 + rnd() * 60, 10 + rnd() * 10, 4 + rnd() * 4, rnd(), 0, 6.3); ctx.fill(); }
    }
    // thin lane lines with a hazard edge
    for (let r = 1; r < ROWS; r++) {
      const y = BY + r * TH;
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(BX, y - 1, COLS * TW, 3);
      ctx.fillStyle = night ? 'rgba(240,192,32,0.18)' : 'rgba(240,192,32,0.35)';
      for (let x = BX; x < BR; x += 22) ctx.fillRect(x, y + 2, 11, 2);
    }

    // --- left: core bay sliver + sweeper docks ---
    g = ctx.createLinearGradient(0, 0, 70, 0); g.addColorStop(0, night ? '#0a0e16' : '#1e2a3e'); g.addColorStop(1, night ? '#141a26' : '#2e3c54');
    ctx.fillStyle = g; ctx.fillRect(0, BY - 4, 70, BB - BY + 10);
    for (let r = 0; r < ROWS; r++) {           // reactor window + status lights per lane
      const y = BY + r * TH;
      const wg = ctx.createLinearGradient(0, y + 20, 0, y + TH - 20); wg.addColorStop(0, night ? '#ff6a3a' : '#7ff0ff'); wg.addColorStop(1, night ? '#7a1a0a' : '#1a7aa0');
      ctx.fillStyle = wg; rr(ctx, 14, y + 18, 34, TH - 40, 8); ctx.fill();
      ctx.strokeStyle = '#0a0e14'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; rr(ctx, 18, y + 22, 8, TH - 50, 3); ctx.fill();
      for (let k = 0; k < 3; k++) { ctx.fillStyle = [night ? '#ff4040' : '#4f4', '#ffb030', '#3ad0ff'][k]; ell(ctx, 58, y + 26 + k * 14, 3, 3); ctx.fill(); }
    }
    ctx.strokeStyle = '#0a0e14'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(70, BY - 4); ctx.lineTo(70, BB + 6); ctx.stroke();
    // cables hanging into the bay
    ctx.strokeStyle = night ? '#2a2a2a' : '#30343a'; ctx.lineWidth = 4;
    for (const [x0, x1] of [[10, 40], [30, 62]]) { ctx.beginPath(); ctx.moveTo(x0, BY - 26); ctx.quadraticCurveTo((x0 + x1) / 2, BY + 30, x1, BY - 26); ctx.stroke(); }
    // dock column with cradles
    ctx.fillStyle = night ? '#121822' : '#2a3446'; ctx.fillRect(70, BY - 4, BX - 70, BB - BY + 10);
    for (let r = 0; r < ROWS; r++) {
      const y = BY + r * TH + TH - 22;
      ctx.fillStyle = night ? '#232a36' : '#46526a'; rr(ctx, 76, y - 4, 58, 16, 4); ctx.fill();
      ctx.fillStyle = '#f0c020'; ctx.fillRect(80, y + 8, 50, 3);
      ctx.fillStyle = night ? '#ff4a3a' : '#3ad0ff'; ell(ctx, 128, y - 30, 3, 3); ctx.fill();
    }
    ctx.save(); ctx.beginPath(); ctx.rect(BX - 10, BY - 4, 10, BB - BY + 10); ctx.clip();
    for (let y = BY - 30; y < BB + 20; y += 20) { ctx.fillStyle = '#f0c020'; ctx.beginPath(); ctx.moveTo(BX - 10, y); ctx.lineTo(BX, y - 10); ctx.lineTo(BX, y); ctx.lineTo(BX - 10, y + 10); ctx.fill(); }
    ctx.restore();

    // --- right: breach wall + containment hall (seen during the intro pan) ---
    g = ctx.createLinearGradient(BR, 0, WW, 0); g.addColorStop(0, night ? '#14201a' : '#2a3a34'); g.addColorStop(1, night ? '#0c140f' : '#1a2a22');
    ctx.fillStyle = g; ctx.fillRect(BR, BY - 4, WW - BR, BB - BY + 10);
    // hall floor grating
    ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2;
    for (let x = BR + 60; x < WW; x += 26) { ctx.beginPath(); ctx.moveTo(x, BY); ctx.lineTo(x, BB); ctx.stroke(); }
    // goo channel along the hall
    ctx.fillStyle = 'rgba(80,220,90,0.35)'; ctx.fillRect(BR + 60, BB - 18, WW - BR - 60, 10);
    // vats in the hall
    for (let i = 0; i < 4; i++) {
      const vx = BR + 170 + i * 120, vy = BY + 8;
      ctx.fillStyle = '#2a323c'; rr(ctx, vx - 34, vy, 68, 92, 10); ctx.fill();
      const vg = ctx.createLinearGradient(0, vy + 10, 0, vy + 84); vg.addColorStop(0, 'rgba(120,255,140,0.75)'); vg.addColorStop(1, 'rgba(30,140,60,0.85)');
      ctx.fillStyle = vg; rr(ctx, vx - 26, vy + 12, 52, 72, 8); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)'; rr(ctx, vx - 22, vy + 16, 8, 60, 3); ctx.fill();
      ctx.fillStyle = 'rgba(200,255,210,0.5)'; for (let k = 0; k < 4; k++) { ell(ctx, vx - 10 + (k * 13) % 30, vy + 70 - k * 14, 3, 3); ctx.fill(); }
      ctx.fillStyle = '#4a5462'; rr(ctx, vx - 38, vy - 6, 76, 10, 4); ctx.fill();
    }
    // breach wall: broken containment panels between lanes, with ooze pouring through
    for (let r = 0; r <= ROWS; r++) {
      const y = BY + r * TH;
      ctx.fillStyle = night ? '#2a323c' : '#5a6676';
      ctx.beginPath(); ctx.moveTo(BR + 6, y - 26); ctx.lineTo(BR + 34, y - 18); ctx.lineTo(BR + 30, y + 22); ctx.lineTo(BR + 4, y + 26); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#151a20'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(BR + 12, y - 10); ctx.lineTo(BR + 22, y + 2); ctx.lineTo(BR + 14, y + 12); ctx.stroke();
    }
    for (let r = 0; r < ROWS; r++) {
      const y = BY + r * TH + TH / 2;
      ctx.fillStyle = 'rgba(90,230,100,0.45)';
      ctx.beginPath(); ctx.ellipse(BR + 6, y + 40, 40, 10, 0, 0, 6.3); ctx.fill();
      ctx.fillStyle = 'rgba(90,230,100,0.25)';
      ctx.beginPath(); ctx.ellipse(BR - 14, y + 44, 26, 6, 0, 0, 6.3); ctx.fill();
    }
    // warning sign above the breach
    ctx.save(); ctx.translate(BR + 22, BY - 40);
    ctx.fillStyle = '#f0c020'; ctx.beginPath(); ctx.moveTo(0, -16); ctx.lineTo(16, 12); ctx.lineTo(-16, 12); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#111'; ctx.font = '900 16px system-ui'; ctx.textAlign = 'center'; ctx.fillText('!', 0, 9);
    ctx.restore();

    // --- lighting ---
    for (const lx of lamps) {
      const lg = ctx.createRadialGradient(lx, BY + 40, 10, lx, BY + 220, 300);
      lg.addColorStop(0, night ? 'rgba(255,120,60,0.16)' : 'rgba(255,248,220,0.22)'); lg.addColorStop(1, 'rgba(255,248,220,0)');
      ctx.fillStyle = lg;
      ctx.beginPath(); ctx.moveTo(lx - 22, 80); ctx.lineTo(lx + 22, 80); ctx.lineTo(lx + 150, BB); ctx.lineTo(lx - 150, BB); ctx.closePath(); ctx.fill();
    }
    if (night) {
      ctx.fillStyle = 'rgba(8,12,30,0.38)'; ctx.fillRect(0, 0, WW, H);
      for (const lx of lamps) {   // emergency pools
        const lg = ctx.createRadialGradient(lx, BY + 160, 10, lx, BY + 160, 170);
        lg.addColorStop(0, 'rgba(255,140,60,0.18)'); lg.addColorStop(1, 'rgba(255,140,60,0)');
        ctx.fillStyle = lg; ctx.fillRect(lx - 180, BY, 360, BB - BY);
      }
    }
    const vg2 = ctx.createRadialGradient(W / 2, H / 2 + 40, H * 0.45, W / 2, H / 2 + 40, W * 0.85);
    vg2.addColorStop(0, 'rgba(0,0,0,0)'); vg2.addColorStop(1, night ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vg2; ctx.fillRect(0, 0, WW, H);
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, BB + 6, WW, H - BB);
    return c;
  }


  return { spriteCount: () => Object.keys(sprites).length, useSprite, drawRobot, drawSlime, drawEnergy, makeBackground, loadSprites, shade, rr, ell, star, sprites, bgDirty: false };
})();
