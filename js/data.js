// Slime Siege — game data (all original content)
'use strict';
window.SS = window.SS || {};

SS.CONST = { W: 1280, H: 720, COLS: 9, ROWS: 5, TW: 112, TH: 116, BX: 140, BY: 124 };

// Behaviors:
//  shoot {rate, shots, dmg, bolt:'plain'|'ice'|'fire'|'arc', splash, sr}
//  produce {rate, val, first}
//  mine {arm, dmg, r}         bomb {fuse, dmg, r, freeze}
//  lob {rate, dmg, splash, sr, slow, fire}
//  flame {rate, dmg, range, slow}
//  zap {rate, dmg, n, r}
//  wall flags on unit: tall, thorns, chill
SS.UNITS = {
  // ---------- base robots ----------
  spark: { name: 'Sparkplug', cost: 50, cd: 7.5, hp: 300,
    desc: 'Generates 25 energy every 24 seconds. The backbone of any defense.',
    parts: { body: 'round', color: '#f2b632', head: 'bulb', extras: ['coil'] },
    beh: [{ t: 'produce', rate: 24, val: 25, first: 7 }] },
  blaster: { name: 'Blaster', cost: 100, cd: 7.5, hp: 300,
    desc: 'Fires energy bolts down its lane.',
    parts: { body: 'box', color: '#3d8bfd', head: 'visor', weapon: { n: 1, c: '#7fd4ff' } },
    beh: [{ t: 'shoot', rate: 1.4, shots: 1, dmg: 20, bolt: 'plain' }] },
  bulwark: { name: 'Bulwark', cost: 50, cd: 30, hp: 4000,
    desc: 'Heavy armor plating that holds slimes in place.',
    parts: { body: 'wall', color: '#7d8a9c' }, beh: [] },
  mine: { name: 'Shock Mine', cost: 25, cd: 30, hp: 300,
    desc: 'Arms after 14 seconds, then blasts the first slime that touches it.',
    parts: { body: 'mine', color: '#d9472b' },
    beh: [{ t: 'mine', arm: 14, dmg: 1800, r: 0.6 }] },
  cryo: { name: 'Cryo Bot', cost: 175, cd: 7.5, hp: 300,
    desc: 'Fires freezing bolts that slow slimes and their chewing.',
    parts: { body: 'box', color: '#5fd0f0', head: 'dome', weapon: { n: 1, c: '#e0faff' }, extras: ['ice'] },
    beh: [{ t: 'shoot', rate: 1.4, shots: 1, dmg: 20, bolt: 'ice' }] },
  bomb: { name: 'Bomb Bot', cost: 150, cd: 50, hp: 9999,
    desc: 'Detonates after a short fuse, destroying slimes in a 3×3 area.',
    parts: { body: 'bomb', color: '#2b2b35' },
    beh: [{ t: 'bomb', fuse: 1, dmg: 1800, r: 1.5 }] },
  lobber: { name: 'Lobber', cost: 125, cd: 7.5, hp: 300,
    desc: 'Arcs shells over shields and obstacles. Light splash damage.',
    parts: { body: 'box', color: '#6bbf59', head: 'visor', extras: ['mortar'] },
    beh: [{ t: 'lob', rate: 3, dmg: 40, splash: 15, sr: 0.6 }] },
  flamer: { name: 'Flamer', cost: 150, cd: 7.5, hp: 300,
    desc: 'Scorches every slime within 2 tiles ahead.',
    parts: { body: 'box', color: '#e8622c', head: 'visor', extras: ['nozzle'] },
    beh: [{ t: 'flame', rate: 1.5, dmg: 40, range: 2 }] },
  tesla: { name: 'Tesla Coil', cost: 200, cd: 7.5, hp: 300,
    desc: 'Zaps up to 3 nearby slimes in any lane.',
    parts: { body: 'tall', color: '#8e6cf0', extras: ['tcoil'] },
    beh: [{ t: 'zap', rate: 2, dmg: 40, n: 3, r: 2.2 }] },

  // ---------- fusions ----------
  twin: { name: 'Twin Blaster', fusion: true, hp: 300,
    desc: 'Two barrels, two bolts per volley.',
    parts: { body: 'box', color: '#2f6fe0', head: 'visor', weapon: { n: 2, c: '#7fd4ff' } },
    beh: [{ t: 'shoot', rate: 1.4, shots: 2, dmg: 20, bolt: 'plain' }] },
  gatling: { name: 'Gatling Bot', fusion: true, hp: 400,
    desc: 'Four-bolt bursts. Fuse a Blaster onto a Twin Blaster.',
    parts: { body: 'box', color: '#1f4fb8', head: 'visor', weapon: { n: 4, c: '#7fd4ff', gatling: true } },
    beh: [{ t: 'shoot', rate: 1.4, shots: 4, dmg: 20, bolt: 'plain' }] },
  cryorep: { name: 'Cryo Repeater', fusion: true, hp: 300,
    desc: 'Two freezing bolts per volley.',
    parts: { body: 'box', color: '#3fb8e0', head: 'dome', weapon: { n: 2, c: '#e0faff' }, extras: ['ice'] },
    beh: [{ t: 'shoot', rate: 1.4, shots: 2, dmg: 20, bolt: 'ice' }] },
  solar: { name: 'Solar Blaster', fusion: true, hp: 300,
    desc: 'Shoots bolts and generates 25 energy every 24 seconds.',
    parts: { body: 'box', color: '#3d8bfd', head: 'visor', weapon: { n: 1, c: '#ffe27a' }, extras: ['solar'] },
    beh: [{ t: 'shoot', rate: 1.4, shots: 1, dmg: 20, bolt: 'plain' }, { t: 'produce', rate: 24, val: 25, first: 8 }] },
  inferno: { name: 'Inferno Cannon', fusion: true, hp: 300,
    desc: 'Fire bolts with double damage and splash.',
    parts: { body: 'box', color: '#d6452a', head: 'visor', weapon: { n: 1, c: '#ffb03b', big: true }, extras: ['fire'] },
    beh: [{ t: 'shoot', rate: 1.4, shots: 1, dmg: 40, bolt: 'fire', splash: 15, sr: 0.5 }] },
  turretwall: { name: 'Turret Wall', fusion: true, hp: 4000,
    desc: 'A Bulwark with a built-in blaster.',
    parts: { body: 'wall', color: '#5d6b80', weapon: { n: 1, c: '#7fd4ff' } },
    beh: [{ t: 'shoot', rate: 1.4, shots: 1, dmg: 20, bolt: 'plain' }] },
  arcrifle: { name: 'Arc Rifle', fusion: true, hp: 300,
    desc: 'Lightning bolts that pierce through every slime in the lane.',
    parts: { body: 'box', color: '#6d5ae0', head: 'visor', weapon: { n: 1, c: '#c9b8ff', long: true }, extras: ['tcoil'] },
    beh: [{ t: 'shoot', rate: 1.6, shots: 1, dmg: 30, bolt: 'arc' }] },
  barrage: { name: 'Barrage Bot', fusion: true, hp: 300,
    desc: 'Fires bolts and lobs shells at the same time.',
    parts: { body: 'box', color: '#4a9e6a', head: 'visor', weapon: { n: 1, c: '#7fd4ff' }, extras: ['mortar'] },
    beh: [{ t: 'shoot', rate: 1.4, shots: 1, dmg: 20, bolt: 'plain' }, { t: 'lob', rate: 3, dmg: 40, splash: 15, sr: 0.6 }] },
  reactor: { name: 'Reactor', fusion: true, hp: 400,
    desc: 'Generates 50 energy every 24 seconds.',
    parts: { body: 'round', color: '#ffd84a', head: 'bulb', extras: ['coil', 'reactor'] },
    beh: [{ t: 'produce', rate: 24, val: 25, first: 6 }, { t: 'produce', rate: 24, val: 25, first: 6.4 }] },
  dynamo: { name: 'Dynamo', fusion: true, hp: 300,
    desc: 'Generates energy and zaps 2 nearby slimes.',
    parts: { body: 'round', color: '#c9a03a', head: 'bulb', extras: ['coil', 'tcoil'] },
    beh: [{ t: 'produce', rate: 24, val: 25, first: 7 }, { t: 'zap', rate: 2.5, dmg: 40, n: 2, r: 2 }] },
  fortress: { name: 'Fortress', fusion: true, hp: 8000, tall: true,
    desc: 'Double-thick armor. Too tall for Hoppers to jump.',
    parts: { body: 'wall', color: '#55606e', extras: ['battlement'] }, beh: [] },
  glacier: { name: 'Glacier Wall', fusion: true, hp: 4000, chill: true,
    desc: 'Frosted armor. Slimes chewing on it are slowed.',
    parts: { body: 'wall', color: '#9fdcf0', extras: ['ice'] }, beh: [] },
  spikewall: { name: 'Spike Wall', fusion: true, hp: 4000, thorns: 40,
    desc: 'Charged spikes damage slimes that chew on it.',
    parts: { body: 'wall', color: '#7d8a9c', extras: ['spikes'] }, beh: [] },
  furnace: { name: 'Furnace Wall', fusion: true, hp: 4000,
    desc: 'Heavy armor with a short-range flame vent.',
    parts: { body: 'wall', color: '#a8553a', extras: ['nozzle'] },
    beh: [{ t: 'flame', rate: 1.5, dmg: 40, range: 1 }] },
  steam: { name: 'Steam Vent', fusion: true, hp: 300,
    desc: 'Scalding steam 3 tiles ahead. Damages and slows.',
    parts: { body: 'box', color: '#b8c8d4', head: 'dome', extras: ['nozzle', 'ice'] },
    beh: [{ t: 'flame', rate: 1.5, dmg: 40, range: 3, slow: true }] },
  storm: { name: 'Storm Tower', fusion: true, hp: 400,
    desc: 'Chain lightning hits up to 6 slimes over a wide radius.',
    parts: { body: 'tall', color: '#5a3fd0', extras: ['tcoil', 'tcoil2'] },
    beh: [{ t: 'zap', rate: 1.5, dmg: 60, n: 6, r: 3 }] },
  nuke: { name: 'Nova Mine', fusion: true, hp: 300,
    desc: 'Arms in 8 seconds. Massive 5×5 blast.',
    parts: { body: 'mine', color: '#e6d22c', extras: ['hazard'] },
    beh: [{ t: 'mine', arm: 8, dmg: 3000, r: 2.6 }] },
  cryoburst: { name: 'Cryo Burst', fusion: true, hp: 9999,
    desc: 'Blasts a 3×3 area and freezes every slime on the field for 6 seconds.',
    parts: { body: 'bomb', color: '#3a8fb8', extras: ['ice'] },
    beh: [{ t: 'bomb', fuse: 1, dmg: 1800, r: 1.5, freeze: 6 }] },
  snowmortar: { name: 'Snow Mortar', fusion: true, hp: 300,
    desc: 'Lobbed ice shells that slow and splash.',
    parts: { body: 'box', color: '#7fd0c0', head: 'dome', extras: ['mortar', 'ice'] },
    beh: [{ t: 'lob', rate: 3, dmg: 40, splash: 20, sr: 0.8, slow: true }] },
  blazemortar: { name: 'Blaze Mortar', fusion: true, hp: 300,
    desc: 'Lobbed fire shells. Heavy splash.',
    parts: { body: 'box', color: '#d97a2a', head: 'visor', extras: ['mortar', 'fire'] },
    beh: [{ t: 'lob', rate: 3, dmg: 80, splash: 40, sr: 1, fire: true }] },
};

// Order-independent fusion table: key = sorted ids joined by '+'
SS.FUSION_LIST = [
  ['blaster', 'blaster', 'twin'],
  ['twin', 'blaster', 'gatling'],
  ['blaster', 'cryo', 'cryorep'],
  ['blaster', 'spark', 'solar'],
  ['blaster', 'flamer', 'inferno'],
  ['blaster', 'bulwark', 'turretwall'],
  ['blaster', 'tesla', 'arcrifle'],
  ['blaster', 'lobber', 'barrage'],
  ['spark', 'spark', 'reactor'],
  ['spark', 'tesla', 'dynamo'],
  ['bulwark', 'bulwark', 'fortress'],
  ['bulwark', 'cryo', 'glacier'],
  ['bulwark', 'mine', 'spikewall'],
  ['bulwark', 'flamer', 'furnace'],
  ['flamer', 'cryo', 'steam'],
  ['tesla', 'tesla', 'storm'],
  ['mine', 'bomb', 'nuke'],
  ['bomb', 'cryo', 'cryoburst'],
  ['lobber', 'cryo', 'snowmortar'],
  ['lobber', 'flamer', 'blazemortar'],
];
SS.fkey = (a, b) => [a, b].sort().join('+');
SS.FUSIONS = {};
for (const [a, b, r] of SS.FUSION_LIST) SS.FUSIONS[SS.fkey(a, b)] = r;
for (const [a, b, r] of SS.FUSION_LIST) SS.UNITS[r].from = [a, b];

SS.SLIMES = {
  blob:    { name: 'Blob', hp: 200, speed: 20, dps: 100, cost: 1, size: 1, color: '#5bd65b',
             desc: 'The common slime. Slow, squishy, and hungry for metal.' },
  capped:  { name: 'Capped Blob', hp: 200, armor: 370, speed: 20, dps: 100, cost: 2, size: 1, color: '#4fc44f',
             desc: 'Wears a scrap-metal cap that soaks up damage.' },
  iron:    { name: 'Ironclad', hp: 200, armor: 1100, speed: 20, dps: 100, cost: 4, size: 1.05, color: '#3fae5a',
             desc: 'A riveted steel helmet makes it very tough.' },
  dasher:  { name: 'Dasher', hp: 180, speed: 44, dps: 100, cost: 2, size: 0.9, color: '#a4e84a',
             desc: 'Slick and fast. Arrives before you expect it.' },
  hopper:  { name: 'Hopper', hp: 340, speed: 30, dps: 100, cost: 3, size: 1, hop: true, color: '#2fc9a0',
             desc: 'Springs over the first robot it meets. Fortress walls stop it.' },
  splitter:{ name: 'Splitter', hp: 300, speed: 20, dps: 100, cost: 3, size: 1.1, split: 2, color: '#b85bd6',
             desc: 'Bursts into two Minis when destroyed.' },
  mini:    { name: 'Mini', hp: 90, speed: 32, dps: 60, cost: 0, size: 0.6, color: '#d07ad9',
             desc: 'Small, fast leftovers of a Splitter.' },
  acid:    { name: 'Acid Slime', hp: 280, speed: 20, dps: 300, cost: 3, size: 1, color: '#d7e83a',
             desc: 'Dissolves robots three times faster than a Blob.' },
  shield:  { name: 'Shield Slime', hp: 200, front: 1100, speed: 18, dps: 100, cost: 4, size: 1, color: '#4fbf7a',
             desc: 'Pushes a steel plate that blocks straight bolts. Lobbed, flame and lightning attacks bypass it.' },
  brute:   { name: 'Megaslime', hp: 3000, speed: 12, dps: 0, smash: 2.5, cost: 10, size: 1.6, color: '#7b3fb0',
             desc: 'Enormous. Crushes a robot with every slam.' },
  king:    { name: 'King Gloop', hp: 20000, speed: 4.5, dps: 0, smash: 3, cost: 0, size: 2.6, boss: true, color: '#2e9e3e',
             desc: 'Ruler of the ooze. Spans three lanes, summons minions and hurls goo.' },
};

SS.WEIGHTS = { blob: 5, capped: 3, iron: 2, dasher: 2, hopper: 2, splitter: 2, acid: 2, shield: 2, brute: 1 };

const ALL = ['blob', 'capped', 'iron', 'dasher', 'hopper', 'splitter', 'acid', 'shield', 'brute'];
SS.LEVELS = [
  { name: 'Boot Sequence', cards: ['spark', 'blaster'], unlock: 'bulwark', waves: 4, types: ['blob'], base: 1, inc: 0.8, flagMul: 1.6,
    tip: 'Tap falling energy cells to collect them. Build Sparkplugs for income, then Blasters to defend each lane.' },
  { name: 'First Contact', unlock: 'mine', waves: 6, types: ['blob', 'capped'], intro: 'capped', base: 2, inc: 1.1,
    tip: 'FUSION: place a robot on top of another robot to fuse them. Try a Blaster on a Blaster!' },
  { name: 'Goo Rush', unlock: 'cryo', waves: 7, types: ['blob', 'capped', 'dasher'], intro: 'dasher', base: 2, inc: 1.3,
    tip: 'Dashers are fast. Shock Mines arm after 14 seconds — plant them early in their path.' },
  { name: 'Cold Front', unlock: 'bomb', waves: 8, types: ['blob', 'capped', 'dasher', 'iron'], intro: 'iron', base: 2, inc: 1.5,
    tip: 'Cryo bolts slow slimes. Fuse a Blaster with a Cryo Bot for a Cryo Repeater.' },
  { name: 'Bounce House', unlock: 'lobber', waves: 9, types: ['blob', 'capped', 'dasher', 'iron', 'hopper'], intro: 'hopper', base: 3, inc: 1.5,
    tip: 'Hoppers leap over the first robot they meet — unless it is a Fortress (Bulwark + Bulwark).' },
  { name: 'Shield Wall', unlock: 'flamer', waves: 10, types: ['blob', 'capped', 'iron', 'hopper', 'shield'], intro: 'shield', base: 3, inc: 1.6,
    tip: 'Shield Slimes block straight bolts. Lobbers arc right over the plate.' },
  { name: 'Split Decision', unlock: 'tesla', waves: 10, types: ['blob', 'capped', 'dasher', 'shield', 'splitter'], intro: 'splitter', base: 3, inc: 1.7,
    tip: 'Splitters burst into two Minis. Flamers hit everything in range.' },
  { name: 'Acid Rain', unlock: null, waves: 11, types: ['blob', 'capped', 'iron', 'hopper', 'splitter', 'acid'], intro: 'acid', base: 3, inc: 1.8,
    tip: 'Acid Slimes dissolve robots fast. Spike Walls (Bulwark + Shock Mine) bite back.' },
  { name: 'Heavy Metal', unlock: null, waves: 12, types: ['blob', 'capped', 'iron', 'dasher', 'shield', 'brute'], intro: 'brute', base: 3, inc: 1.8,
    tip: 'Megaslimes crush robots in one slam. Keep them at range — and save a Bomb Bot.' },
  { name: 'Overflow', unlock: null, waves: 14, types: ALL, base: 4, inc: 1.9,
    tip: 'Everything at once. Fusions are your friend.' },
  { name: 'Last Line', unlock: null, waves: 15, types: ALL, base: 4, inc: 1.9, startEnergy: 150,
    tip: 'The final stand before the King. Build an economy fast.' },
  { name: 'King Gloop', unlock: null, waves: 8, types: ALL, base: 4, inc: 1.8, boss: true, startEnergy: 200,
    tip: 'King Gloop spans three lanes. Stack firepower in the middle rows!' },
];
SS.ENDLESS = { name: 'Endless Ooze', endless: true, waves: Infinity, types: ALL, base: 4, inc: 2.0, startEnergy: 100,
  tip: 'How many waves can you survive?' };
SS.MAX_SLOTS = 7;
SS.BASE_ORDER = ['spark', 'blaster', 'bulwark', 'mine', 'cryo', 'bomb', 'lobber', 'flamer', 'tesla'];

// Optional asset overrides: list file names (without extension) in assets/manifest.json
SS._manifest = null;
SS.assetManifest = () => SS._manifest || (SS._manifest = (location.protocol === 'file:' ? Promise.resolve({}) :
  fetch('assets/manifest.json').then(r => r.ok ? r.json() : {}).catch(() => ({}))));

SS.DIFFICULTY = { easy: 0.45, normal: 0.6, hard: 0.85 };
SS.difficultyMul = () => SS.DIFFICULTY[(SS.settings && SS.settings.difficulty) || 'normal'] || 0.6;
