// Slime Siege — synthesized audio (Web Audio). Optional file overrides in assets/sfx/<name>.mp3 and assets/music/<track>.mp3
'use strict';
SS.Audio = (() => {
  let ctx = null, master, sfxBus, musicBus, noiseBuf, comp;
  const st = { sfx: 0.8, music: 0.45, muted: false };
  const last = {};
  const overrides = {};     // name -> AudioBuffer
  const musicOverrides = {}; // track -> AudioBuffer
  let musicSrc = null;
  let loopLens = {};

  const SFX_NAMES = ['shoot', 'hit', 'armorHit', 'collect', 'place', 'fuse', 'invalid', 'explode', 'zap', 'flame', 'lob',
    'chomp', 'unitDie', 'slimeDie', 'surge', 'finalWave', 'sweeper', 'win', 'lose', 'click', 'select', 'shieldBreak', 'hop', 'smash', 'freeze', 'start'];

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    master = ctx.createGain(); comp.connect(master); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); musicBus = ctx.createGain();
    sfxBus.connect(comp); musicBus.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // iOS unlock: play a silent buffer
    const s = ctx.createBufferSource(); s.buffer = ctx.createBuffer(1, 1, 22050); s.connect(ctx.destination); s.start(0);
    apply();
    loadOverrides();
  }
  function apply() {
    if (!ctx) return;
    master.gain.value = st.muted ? 0 : 1;
    sfxBus.gain.value = st.sfx;
    musicBus.gain.value = st.music * 0.6;
  }
  function set(k, v) { st[k] = v; apply(); }

  async function tryLoad(url) {
    try {
      const r = await fetch(url);
      if (!r.ok) return null;
      const ab = await r.arrayBuffer();
      return await new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej));
    } catch (e) { return null; }
  }
  function loadOverrides() {
    if (location.protocol === 'file:') return;
    SS.assetManifest().then(m => {
      (m.sfx || []).forEach(async n => { const b = await tryLoad(`${SS.BASE || ''}assets/sfx/${n}.mp3`); if (b) overrides[n] = b; });
      loopLens = m.loops || {};
      (m.music || []).forEach(async n => {
        const b = await tryLoad(`${SS.BASE || ''}assets/music/${n}.mp3`);
        if (!b) return;
        musicOverrides[n] = b;
        // swap a synth track that's already playing for the loaded file
        if (seq && seq.name === n && !seq.file) { const keep = n; stopMusic(); playMusic(keep); }
      });
    });
  }

  function env(g, t, a, peak, dur) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  function tone(o) {
    const { type = 'square', f = 440, f2 = null, dur = 0.12, vol = 0.15, a = 0.004, delay = 0, bus = sfxBus, detune = 0 } = o;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t); osc.detune.value = detune;
    if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    env(g, t, a, vol, dur);
    osc.connect(g); g.connect(bus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(o) {
    const { dur = 0.2, vol = 0.2, type = 'lowpass', freq = 1200, freq2 = null, q = 1, delay = 0, bus = sfxBus } = o;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const flt = ctx.createBiquadFilter(); flt.type = type; flt.frequency.setValueAtTime(freq, t); flt.Q.value = q;
    if (freq2) flt.frequency.exponentialRampToValueAtTime(freq2, t + dur);
    const g = ctx.createGain(); env(g, t, 0.003, vol, dur);
    src.connect(flt); flt.connect(g); g.connect(bus);
    src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
  }

  const S = {
    shoot() { tone({ type: 'square', f: 880, f2: 330, dur: 0.08, vol: 0.06 }); },
    hit() { noise({ dur: 0.08, vol: 0.12, freq: 900, freq2: 300 }); tone({ type: 'sine', f: 180, f2: 90, dur: 0.08, vol: 0.08 }); },
    armorHit() { tone({ type: 'triangle', f: 1400, f2: 1200, dur: 0.07, vol: 0.06 }); noise({ dur: 0.05, vol: 0.06, type: 'highpass', freq: 3000 }); },
    collect() { tone({ type: 'sine', f: 988, dur: 0.08, vol: 0.12 }); tone({ type: 'sine', f: 1319, dur: 0.14, vol: 0.12, delay: 0.06 }); },
    place() { tone({ type: 'triangle', f: 220, f2: 110, dur: 0.12, vol: 0.2 }); noise({ dur: 0.1, vol: 0.1, freq: 600 }); },
    fuse() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone({ type: 'square', f, dur: 0.12, vol: 0.06, delay: i * 0.05 })); noise({ dur: 0.4, vol: 0.06, type: 'highpass', freq: 4000 }); },
    invalid() { tone({ type: 'square', f: 140, dur: 0.15, vol: 0.08 }); tone({ type: 'square', f: 110, dur: 0.15, vol: 0.08, delay: 0.1 }); },
    explode() { noise({ dur: 0.9, vol: 0.5, freq: 1800, freq2: 60 }); tone({ type: 'sine', f: 120, f2: 30, dur: 0.6, vol: 0.4 }); },
    zap() { for (let i = 0; i < 4; i++) tone({ type: 'sawtooth', f: 600 + Math.random() * 900, f2: 200, dur: 0.05, vol: 0.05, delay: i * 0.03 }); noise({ dur: 0.15, vol: 0.08, type: 'bandpass', freq: 3000, q: 4 }); },
    flame() { noise({ dur: 0.45, vol: 0.18, type: 'bandpass', freq: 500, freq2: 1500, q: 0.7 }); },
    lob() { tone({ type: 'sine', f: 300, f2: 600, dur: 0.15, vol: 0.12 }); noise({ dur: 0.1, vol: 0.08, freq: 800 }); },
    chomp() { noise({ dur: 0.07, vol: 0.12, type: 'bandpass', freq: 700, q: 3 }); tone({ type: 'sine', f: 140, f2: 80, dur: 0.06, vol: 0.08 }); },
    unitDie() { noise({ dur: 0.35, vol: 0.2, freq: 2500, freq2: 200 }); tone({ type: 'square', f: 400, f2: 60, dur: 0.35, vol: 0.08 }); },
    slimeDie() { tone({ type: 'sine', f: 420, f2: 70, dur: 0.35, vol: 0.18 }); noise({ dur: 0.25, vol: 0.1, type: 'lowpass', freq: 500, freq2: 100 }); },
    shieldBreak() { noise({ dur: 0.3, vol: 0.2, type: 'highpass', freq: 2000 }); tone({ type: 'triangle', f: 900, f2: 300, dur: 0.3, vol: 0.1 }); },
    hop() { tone({ type: 'sine', f: 200, f2: 700, dur: 0.25, vol: 0.12 }); },
    smash() { noise({ dur: 0.5, vol: 0.35, freq: 700, freq2: 60 }); tone({ type: 'sine', f: 90, f2: 35, dur: 0.4, vol: 0.35 }); },
    freeze() { for (let i = 0; i < 6; i++) tone({ type: 'sine', f: 2000 + i * 300, dur: 0.15, vol: 0.04, delay: i * 0.04 }); noise({ dur: 0.6, vol: 0.12, type: 'highpass', freq: 5000 }); },
    surge() { for (let i = 0; i < 3; i++) { tone({ type: 'sawtooth', f: 330, f2: 660, dur: 0.4, vol: 0.09, delay: i * 0.5 }); tone({ type: 'sawtooth', f: 660, f2: 330, dur: 0.1, vol: 0.06, delay: i * 0.5 + 0.38 }); } },
    finalWave() { [196, 233, 262, 311].forEach((f, i) => tone({ type: 'sawtooth', f, dur: 0.5, vol: 0.1, delay: i * 0.18 })); },
    sweeper() { tone({ type: 'sawtooth', f: 90, f2: 160, dur: 1.2, vol: 0.12 }); noise({ dur: 1.2, vol: 0.1, type: 'bandpass', freq: 400, q: 2 }); },
    win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone({ type: 'square', f, dur: i === 6 ? 0.6 : 0.14, vol: 0.09, delay: i * 0.13, bus: sfxBus })); },
    lose() { [392, 370, 349, 262].forEach((f, i) => tone({ type: 'sawtooth', f, f2: i === 3 ? 130 : null, dur: i === 3 ? 1.0 : 0.3, vol: 0.1, delay: i * 0.32 })); },
    click() { tone({ type: 'square', f: 1200, dur: 0.03, vol: 0.05 }); },
    select() { tone({ type: 'triangle', f: 660, f2: 880, dur: 0.06, vol: 0.08 }); },
    start() { [392, 523, 659].forEach((f, i) => tone({ type: 'square', f, dur: 0.18, vol: 0.08, delay: i * 0.35 })); },
  };

  function play(name) {
    if (!ctx || st.muted) return;
    const now = performance.now();
    const gap = name === 'shoot' || name === 'hit' ? 45 : 25;
    if (last[name] && now - last[name] < gap) return;
    last[name] = now;
    if (overrides[name]) {
      const s = ctx.createBufferSource(); s.buffer = overrides[name]; s.connect(sfxBus); s.start(); return;
    }
    try { S[name] && S[name](); } catch (e) { /* ignore */ }
  }

  // ---------------- Music: tiny step sequencer ----------------
  // Notes as MIDI numbers; 0 = rest. 16 steps per bar.
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const TRACKS = {
    menu: {
      bpm: 96,
      bass: [45,0,0,0, 45,0,52,0, 41,0,0,0, 41,0,48,0, 43,0,0,0, 43,0,50,0, 40,0,0,0, 40,0,47,0],
      lead: [69,72,76,72, 69,72,76,79, 65,69,72,69, 65,69,72,77, 67,71,74,71, 67,71,74,79, 64,68,71,68, 64,68,71,76],
      leadType: 'triangle', leadVol: 0.05, drums: 'soft',
    },
    battle: {
      bpm: 132,
      bass: [45,45,57,45, 45,57,45,55, 41,41,53,41, 41,53,41,52, 43,43,55,43, 43,55,43,50, 40,40,52,40, 44,44,56,47],
      lead: [76,0,74,76, 0,72,0,69, 72,0,69,67, 69,0,0,0, 74,0,72,74, 0,71,0,67, 68,0,71,74, 76,0,0,0,
             81,0,79,76, 0,77,0,72, 74,0,72,69, 72,0,0,0, 71,0,72,74, 76,0,74,71, 68,71,74,76, 80,0,81,0],
      leadType: 'square', leadVol: 0.035, drums: 'drive',
    },
    boss: {
      bpm: 150,
      bass: [38,38,50,38, 38,50,41,38, 37,37,49,37, 37,49,40,37, 36,36,48,36, 36,48,39,36, 37,37,49,37, 41,40,39,38],
      lead: [62,0,65,0, 69,0,68,0, 65,0,62,0, 61,0,0,0, 62,0,65,0, 70,0,69,0, 68,0,65,0, 64,65,64,61],
      leadType: 'sawtooth', leadVol: 0.03, drums: 'drive',
    },
  };
  let seq = null;
  function playMusic(name) {
    if (!ctx) return;
    if (seq && seq.name === name) return;
    stopMusic();
    if (musicOverrides[name]) {
      const buf = musicOverrides[name];
      musicSrc = ctx.createBufferSource(); musicSrc.buffer = buf; musicSrc.loop = true;
      // gapless: skip any decoder padding and loop exactly the musical length
      const L = loopLens[name];
      if (L && buf.duration > L) {
        const d = buf.getChannelData(0); let i = 0; const lim = Math.min(d.length, Math.floor(buf.sampleRate * 0.1));
        while (i < lim && Math.abs(d[i]) < 0.0005) i++;
        const start = Math.min(i / buf.sampleRate, buf.duration - L);
        musicSrc.loopStart = start; musicSrc.loopEnd = start + L;
      }
      musicSrc.connect(musicBus); musicSrc.start(0, musicSrc.loopStart || 0);
      seq = { name, file: true }; return;
    }
    const tr = TRACKS[name]; if (!tr) return;
    const stepDur = 60 / tr.bpm / 4;
    seq = { name, tr, step: 0, next: ctx.currentTime + 0.1, stepDur };
    seq.timer = setInterval(() => schedule(seq), 25);
  }
  function schedule(s) {
    if (!ctx) return;
    while (s.next < ctx.currentTime + 0.12) {
      const tr = s.tr, i = s.step;
      const b = tr.bass[i % tr.bass.length];
      if (b) mtone(mtof(b), s.next, s.stepDur * 1.6, 'triangle', 0.11);
      const l = tr.lead[i % tr.lead.length];
      if (l) mtone(mtof(l), s.next, s.stepDur * 1.8, tr.leadType, tr.leadVol);
      const p = i % 16;
      if (tr.drums === 'drive') {
        if (p % 4 === 0) kick(s.next);
        if (p === 4 || p === 12) snare(s.next);
        if (p % 2 === 1) hat(s.next, 0.025);
      } else {
        if (p === 0 || p === 10) kick(s.next, 0.15);
        if (p % 4 === 2) hat(s.next, 0.015);
      }
      s.next += s.stepDur; s.step++;
    }
  }
  function mtone(f, t, dur, type, vol) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.02);
  }
  function kick(t, vol = 0.3) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.2);
  }
  function snare(t) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    src.connect(f); f.connect(g); g.connect(musicBus); src.start(t, Math.random() * 0.5); src.stop(t + 0.15);
  }
  function hat(t, vol) {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(f); f.connect(g); g.connect(musicBus); src.start(t, Math.random() * 0.5); src.stop(t + 0.05);
  }
  function stopMusic() {
    if (seq && seq.timer) clearInterval(seq.timer);
    if (musicSrc) { try { musicSrc.stop(); } catch (e) {} musicSrc = null; }
    seq = null;
  }
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  return { init, play, playMusic, stopMusic, set, st, suspend, resume, get ready() { return !!ctx; }, get current() { return seq && seq.name; } };
})();
