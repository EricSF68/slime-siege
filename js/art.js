// Slime Siege — procedural vector art. Optional PNG overrides in assets/sprites/<id>.png (see ASSETS.md)
'use strict';
SS.Art = (() => {
  const sprites = {};
  function loadSprites() {
    if (location.protocol === 'file:') return;
    SS.assetManifest().then(m => (m.sprites || []).forEach(id => {
      const img = new Image();
      img.onload = () => { sprites[id] = img; if (id === 'background') SS.Art.bgDirty = true; };
      img.src = `assets/sprites/${id}.png`;
    }));
  }

  function shade(hex, amt) {
    let c = hex.replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    let r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
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

  function treads(ctx, w = 30) {
    rr(ctx, -w, 26, w * 2, 16, 8); fillStroke(ctx, '#2a2f3a', '#14171d', 2);
    ctx.fillStyle = '#58606e';
    for (let i = -1; i <= 1; i++) { ell(ctx, i * (w * 0.62), 34, 5, 5); ctx.fill(); }
  }
  function eye(ctx, x, y, t, color = '#5ff') {
    const blink = (Math.sin(t * 1.3) > 0.97) ? 0.2 : 1;
    ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8;
    rr(ctx, x - 4, y - 4 * blink, 8, 8 * blink, 3); ctx.fill(); ctx.shadowBlur = 0;
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
      rr(ctx, 20 + recoil, yy - th / 2, len, th, 4); fillStroke(ctx, '#3a4250', '#1b1f27', 2);
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
    if (sprites[id]) {
      const img = sprites[id];
      const h = 100, w = img.width / img.height * h;
      ctx.drawImage(img, -w / 2, 44 - h, w, h);
    } else {
      const bob = (p.body === 'wall' || p.body === 'mine' || p.body === 'bomb') ? 0 : Math.sin(t * 3 + (o.phase || 0)) * 1.5;
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ell(ctx, 0, 42, 36, 8); ctx.fill();
      const c = p.color, dark = shade(c, -0.45);
      switch (p.body) {
        case 'box': {
          if (p.extras && p.extras.includes('mortar')) extras(ctx, ['mortar'], p, bob, t, o);
          treads(ctx);
          rr(ctx, -26, -14 + bob, 52, 42, 10); fillStroke(ctx, c, dark);
          ctx.fillStyle = shade(c, 0.3); rr(ctx, -20, -10 + bob, 40, 8, 4); ctx.fill();
          ctx.fillStyle = shade(c, -0.2); ell(ctx, 0, 12 + bob, 7, 7); ctx.fill();
          if (p.head === 'visor') {
            rr(ctx, -19, -40 + bob, 38, 28, 9); fillStroke(ctx, shade(c, -0.12), dark);
            rr(ctx, -13, -32 + bob, 28, 11, 5); ctx.fillStyle = '#0d1b2a'; ctx.fill();
            eye(ctx, 6, -26.5 + bob, t);
          } else if (p.head === 'dome') {
            ctx.beginPath(); ctx.arc(0, -14 + bob, 19, Math.PI, 0); ctx.closePath();
            fillStroke(ctx, 'rgba(200,245,255,0.75)', dark, 2);
            eye(ctx, 5, -22 + bob, t, '#fff');
          }
          if (p.weapon) weapon(ctx, p.weapon, bob, o, t);
          extras(ctx, (p.extras || []).filter(x => x !== 'mortar'), p, bob, t, o);
          break;
        }
        case 'round': {
          treads(ctx, 26);
          if (p.extras && p.extras.includes('reactor')) extras(ctx, ['reactor'], p, bob, t, o);
          ell(ctx, 0, 2 + bob, 28, 28); fillStroke(ctx, c, dark);
          ctx.fillStyle = shade(c, 0.35); ell(ctx, -8, -8 + bob, 10, 7); ctx.fill();
          rr(ctx, -14, -2 + bob, 28, 12, 6); ctx.fillStyle = '#2a1e05'; ctx.fill();
          eye(ctx, -5, 4 + bob, t, '#ffe9a0'); eye(ctx, 7, 4 + bob, t + 0.1, '#ffe9a0');
          const glow = o.producing ? 1 : 0.5 + 0.3 * Math.sin(t * 4);
          ctx.fillStyle = `rgba(255,240,140,${glow})`; ctx.shadowColor = '#ffd84a'; ctx.shadowBlur = 16 * glow;
          ell(ctx, 0, -32 + bob - 22, 9, 9); ctx.fill(); ctx.shadowBlur = 0;
          extras(ctx, (p.extras || []).filter(x => x !== 'reactor'), p, bob, t, o);
          break;
        }
        case 'tall': {
          treads(ctx, 24);
          rr(ctx, -18, -30 + bob, 36, 58, 8); fillStroke(ctx, c, dark);
          ctx.fillStyle = shade(c, 0.25); rr(ctx, -12, -24 + bob, 8, 46, 4); ctx.fill();
          rr(ctx, -10, -12 + bob, 22, 9, 4); ctx.fillStyle = '#120d2a'; ctx.fill();
          eye(ctx, 5, -7.5 + bob, t, '#d8c8ff');
          extras(ctx, p.extras, p, bob, t, o);
          break;
        }
        case 'wall': {
          const w = (p.extras && p.extras.includes('battlement')) ? 40 : 34;
          rr(ctx, -w, -48, w * 2, 92, 8); fillStroke(ctx, c, dark);
          ctx.fillStyle = shade(c, 0.18); rr(ctx, -w + 6, -42, w * 2 - 12, 38, 5); ctx.fill();
          ctx.fillStyle = shade(c, -0.12); rr(ctx, -w + 6, 2, w * 2 - 12, 36, 5); ctx.fill();
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
  function drawSlime(ctx, type, t, o = {}) {
    const d = SS.SLIMES[type];
    const R = 30 * d.size;
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
    if (sprites[type]) {
      const img = sprites[type]; const hh = R * 3.2, ww = img.width / img.height * hh;
      ctx.save(); ctx.scale(1 + sq, (1 - sq) * (1 - melt * 0.85)); ctx.drawImage(img, -ww / 2, -hh, ww, hh); ctx.restore();
    } else {
      let col = d.color;
      if (type === 'splitter') col = '#b85bd6';
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
      const g = ctx.createLinearGradient(0, -h, 0, 0);
      g.addColorStop(0, shade(col, 0.25)); g.addColorStop(1, shade(col, -0.25));
      ctx.fillStyle = g; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = shade(col, -0.5); ctx.stroke();
      if (type === 'splitter') {
        ctx.save(); ctx.clip(); ctx.fillStyle = 'rgba(255,120,200,0.45)'; ctx.fillRect(0, -h, w, h + 5); ctx.restore();
        ctx.setLineDash([4, 4]); ctx.strokeStyle = shade(col, -0.5); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(0, -h + 2); ctx.lineTo(0, 0); ctx.stroke(); ctx.setLineDash([]);
      }
      // highlight
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; ell(ctx, -w * 0.35, -h * 0.7, w * 0.2, h * 0.1); ctx.fill();
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

  // static background
  function makeBackground() {
    const { W, H, COLS, ROWS, TW, TH, BX, BY } = SS.CONST;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    if (sprites.background) { ctx.drawImage(sprites.background, 0, 0, W, H); return c; }
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b2333'); g.addColorStop(1, '#0f141e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let r = 0; r < ROWS; r++) for (let col = 0; col < COLS; col++) {
      const x = BX + col * TW, y = BY + r * TH;
      const alt = (r + col) % 2;
      ctx.fillStyle = alt ? '#5b6678' : '#66728a';
      ctx.fillRect(x, y, TW, TH);
      ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x, y, TW, 3); ctx.fillRect(x, y, 3, TH);
      ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(x, y + TH - 3, TW, 3); ctx.fillRect(x + TW - 3, y, 3, TH);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (const [px, py] of [[8, 8], [TW - 8, 8], [8, TH - 8], [TW - 8, TH - 8]]) { ctx.beginPath(); ctx.arc(x + px, y + py, 2.5, 0, Math.PI * 2); ctx.fill(); }
      // tread plate texture
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + 20 + i * 22, y + 30 + (i % 2) * 40); ctx.lineTo(x + 32 + i * 22, y + 42 + (i % 2) * 40); ctx.stroke(); }
    }
    // lane dividers
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    for (let r = 1; r < ROWS; r++) ctx.fillRect(BX, BY + r * TH - 1, COLS * TW, 2);
    // base (left)
    ctx.fillStyle = '#28324a'; ctx.fillRect(0, BY - 6, BX, ROWS * TH + 12);
    for (let r = 0; r < ROWS; r++) {
      const y = BY + r * TH;
      ctx.fillStyle = '#1b2236'; ctx.fillRect(10, y + 12, 50, TH - 24);
      ctx.fillStyle = '#3ad0ff'; ctx.globalAlpha = 0.5; ctx.fillRect(14, y + 18, 42, 4); ctx.globalAlpha = 1;
    }
    ctx.save(); ctx.beginPath(); ctx.rect(BX - 18, BY - 6, 18, ROWS * TH + 12); ctx.clip();
    for (let y = BY - 30; y < BY + ROWS * TH + 20; y += 24) { ctx.fillStyle = '#f0c020'; ctx.beginPath(); ctx.moveTo(BX - 18, y); ctx.lineTo(BX, y - 12); ctx.lineTo(BX, y); ctx.lineTo(BX - 18, y + 12); ctx.fill(); }
    ctx.restore();
    // goo zone (right)
    const gx = BX + COLS * TW;
    const gg = ctx.createLinearGradient(gx, 0, W, 0); gg.addColorStop(0, '#2a3a2a'); gg.addColorStop(1, '#173d1c');
    ctx.fillStyle = gg; ctx.fillRect(gx, BY - 6, W - gx, ROWS * TH + 12);
    ctx.fillStyle = 'rgba(80,220,90,0.35)';
    for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.ellipse(gx + 20 + (i * 53) % (W - gx - 20), BY + 30 + (i * 97) % (ROWS * TH - 40), 18 + (i % 3) * 8, 7 + (i % 2) * 4, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0, BY + ROWS * TH + 6, W, H);
    return c;
  }

  return { drawRobot, drawSlime, drawEnergy, makeBackground, loadSprites, shade, rr, ell, star, sprites, bgDirty: false };
})();
