// Recruiters vs. Candidates — Whodini theme: names, recipes, levels and text.
// Loaded after js/data.js. Mechanics come from Slime Siege; this file only re-skins and re-wires them.
'use strict';
(() => {
const U = SS.UNITS;
const set = (id, name, desc, extra) => { Object.assign(U[id], { name, desc }, extra || {}); };

// ---------- recruiters (base cards) ----------
set('spark', 'Sourcerer', 'Conjures 25 Leads every 12 seconds. Every pipeline starts here.');
set('blaster', 'Screener', 'Fires screening questions down the lane.');
set('bulwark', 'Panel Interview', 'A tough panel that holds candidates in place while they get grilled.');
set('mine', 'Referral Link', 'Activates after 14 seconds, then instantly hires the first candidate who steps on it.');
set('cryo', 'Drip Campaigner', 'Sends nurture emails that slow candidates down.');
set('bomb', 'Job Fair', 'Pops after a short countdown and hires everyone in a 3×3 area.');
set('lobber', 'Headhunter', 'Tosses business cards over Ghosters and paperwork. Light splash.');
set('flamer', 'Closer', 'Pitches every candidate within 2 tiles ahead.');
set('tesla', 'Networker', 'Connects with up to 3 nearby candidates in any lane.');
set('crate', 'Talent Pool', 'A surprise box. Opens into a random recruiter, and sometimes an AI-upgraded one.');

// ---------- Whodini AI features (placed on top of a recruiter) ----------
U.hamilton = { name: 'Hamilton', feature: true, cost: 100, cd: 15, hp: 300,
  desc: 'Whodini\'s AI copilot. Drop it on a recruiter to make them stronger: Screeners ask twice as many questions, Sourcerers double their Leads, Panels start asking questions too.',
  parts: { body: 'feature', color: '#5C15E0' }, beh: [] };
U.apoach = { name: 'Apoachability', feature: true, cost: 150, cd: 20, hp: 300,
  desc: 'Whodini\'s approachability score: who is a fit, who is reachable, who is ready to move. Drop it on a recruiter: Screeners pierce the whole lane, Sourcerers start networking, Panels bite back.',
  parts: { body: 'feature', color: '#7B3BF0' }, beh: [] };

// ---------- AI-upgraded recruiters (existing fusion behaviors, renamed) ----------
set('twin', 'Senior Screener', 'Hamilton drafts the follow-up: two questions per volley.');
set('gatling', 'Screening Squad', 'Four-question bursts.');
set('arcrifle', 'Precision Screener', 'Apoachability targeting: every question pierces through the whole lane.');
set('reactor', 'Hamilton Sourcerer', 'Twice the Leads: 50 every 12 seconds.');
set('dynamo', 'Poach Sourcerer', 'Generates Leads and connects with 2 nearby candidates.');
set('turretwall', 'AI Panel', 'A Panel Interview with Hamilton asking the questions.');
set('spikewall', 'Background Check', 'Candidates who stall here take damage.');
set('fortress', 'Hiring Committee', 'Double-tough. Too tall for Job Hoppers to skip.');
set('cryorep', 'Nurture Sequence', 'Two slowing emails per volley.');
set('steam', 'Follow-Up Cannon', 'Floods 3 tiles ahead with follow-ups. Persuades and slows.');
set('barrage', 'Card Cannon', 'Fires questions and tosses cards at the same time.');
set('blazemortar', 'Offer Mortar', 'Lobs offer letters. Heavy splash.');
set('inferno', 'Super Closer', 'Double-strength pitches with splash.');
set('storm', 'Superconnector', 'Connects with up to 6 candidates over a wide radius.');
set('nuke', 'Viral Referral', 'Activates in 8 seconds. A massive 5×5 hiring spree.');
set('cryoburst', 'Career Expo', 'Hires a 3×3 area and puts every candidate on the floor on hold for 6 seconds.');
set('fusioncore', 'Hamilton Prime', 'Tier-3 upgrade. 75 Leads every 12 seconds.');
set('citadel', 'Executive Search Board', 'Tier-3 upgrade. Massive, too tall to skip, and it bites back.');
set('blizzard', 'Pipeline Machine', 'Tier-3 upgrade. Four slowing questions per volley.');
for (const id of ['solar', 'glacier', 'furnace', 'snowmortar']) delete U[id];

// recipes: AI feature + recruiter (order doesn't matter)
SS.FUSION_LIST = [
  ['blaster', 'hamilton', 'twin'],
  ['twin', 'hamilton', 'gatling'],
  ['blaster', 'apoach', 'arcrifle'],
  ['spark', 'hamilton', 'reactor'],
  ['spark', 'apoach', 'dynamo'],
  ['bulwark', 'hamilton', 'turretwall'],
  ['bulwark', 'apoach', 'spikewall'],
  ['bulwark', 'bulwark', 'fortress'],
  ['cryo', 'hamilton', 'cryorep'],
  ['cryo', 'apoach', 'steam'],
  ['lobber', 'hamilton', 'barrage'],
  ['lobber', 'apoach', 'blazemortar'],
  ['flamer', 'hamilton', 'inferno'],
  ['tesla', 'hamilton', 'storm'],
  ['mine', 'hamilton', 'nuke'],
  ['bomb', 'apoach', 'cryoburst'],
  // tier 3 (locked until Level 9 is cleared)
  ['reactor', 'hamilton', 'fusioncore'],
  ['fortress', 'bulwark', 'citadel'],
  ['gatling', 'apoach', 'blizzard'],
];
SS.FUSIONS = {};
for (const id in U) delete U[id].from;
for (const [a, b, r] of SS.FUSION_LIST) { SS.FUSIONS[SS.fkey(a, b)] = r; U[r].from = [a, b]; }

// ---------- candidates ----------
const C = SS.SLIMES;
const cand = (id, name, desc) => Object.assign(C[id], { name, desc });
cand('blob', 'Applicant', 'Eager and everywhere. Hire them before they walk out the door.');
cand('capped', 'Passive Candidate', 'Headphones on, not listening. Soaks up pitches until the headphones come off.');
cand('iron', 'Well-Paid Candidate', 'Golden handcuffs make them very hard to move.');
cand('dasher', 'Fast Mover', 'Already interviewing elsewhere. Arrives before you expect it.');
cand('hopper', 'Job Hopper', 'Skips right past the first recruiter they meet. A Hiring Committee stops them.');
cand('splitter', 'Referral Chain', 'Once hired, refers two friends.');
cand('mini', 'Referral', 'A friend of a friend. Small and quick.');
cand('acid', 'Hard Negotiator', 'Wears recruiters down three times faster.');
cand('shield', 'Ghoster', 'Hides behind a Do Not Disturb sign that blocks straight questions. Headhunters, Closers and Networkers get through.');
cand('spitter', 'Skeptic', 'Stops a few tiles away and lobs objections at the nearest recruiter.');
cand('hothead', 'Flight Risk', 'Carries a packed suitcase. When it drops, they bolt at double speed.');
cand('brute', 'Executive', 'Huge ego. Flattens a recruiter with every power move.');
cand('king', 'The Unicorn', 'The perfect candidate. Spans three lanes, brings referrals, and lobs objections.');

// ---------- levels ----------
const L = SS.LEVELS;
const lv = (i, name, unlock, tip) => Object.assign(L[i], { name, unlock, tip });
lv(0, 'First Req', 'hamilton', 'Tap the falling Leads to collect them. Place Sourcerers to generate Leads, then Screeners to stop candidates in each lane.');
lv(1, 'Meet Hamilton', 'bulwark', 'AI FEATURES: drop Hamilton onto a Screener to make a Senior Screener. Gold squares show where it fits. Dropped headphones can be picked up and given to a recruiter as armor.');
lv(2, 'Hot Market', 'apoach', 'Fast Movers arrive quickly. Put a Panel Interview in front of your Screeners to hold them in place.');
lv(3, 'Golden Handcuffs', 'cryo', 'NEW: Apoachability. Drop it on a Screener and its questions pierce the whole lane. NEW TOOL: the Grabber (G) moves a recruiter, or drops one onto another to combine them.');
lv(4, 'Job Hoppers', 'lobber', 'Job Hoppers skip the first recruiter they meet, unless it is a Hiring Committee (Panel + Panel). Drip Campaigners slow everyone down.');
lv(5, 'Ghost Town', 'bomb', 'NEW TOOL: Reassign (T). Tap a candidate to move them to the next lane. Ghosters block straight questions; Headhunters toss cards over them.');
lv(6, 'After Hours', 'flamer', 'AFTER HOURS: fewer Leads fall and paperwork blocks some squares. Clear it with Remove. Skeptics object from range. Job Fairs hire a whole crowd.');
lv(7, 'Hard Bargains', 'tesla', 'Hard Negotiators wear recruiters down fast. A Background Check (Panel + Apoachability) bites back. Closers pitch two tiles ahead.');
lv(8, 'Executive Search', 'mine', 'Flight Risks bolt when their suitcase drops. Executives flatten a recruiter per power move, so keep a Job Fair ready. Networkers connect across lanes.');
lv(9, 'Hiring Spree', 'crate', 'TIER-3 UNLOCKED: Hamilton on a Hamilton Sourcerer, a Panel on a Hiring Committee, or Apoachability on a Screening Squad. Referral Links hire the first candidate who steps on them.');
lv(10, 'Year-End Push', null, 'The year-end push, after hours. Build your Lead flow fast. Talent Pools open into surprise recruiters.');
lv(11, 'The Unicorn', null, 'The Unicorn spans three lanes. Stack firepower in the middle rows!');
SS.ENDLESS.name = 'Endless Pipeline';
SS.ENDLESS.tip = 'How many rounds can your recruiting machine handle?';
SS.BASE_ORDER = ['spark', 'blaster', 'hamilton', 'apoach', 'bulwark', 'mine', 'cryo', 'bomb', 'lobber', 'flamer', 'tesla', 'crate'];

// ---------- words ----------
SS.IMPACT = { bomb: 'JOB FAIR!', mine: 'REFERRED!', nuke: 'GONE VIRAL!', cryoburst: 'ON HOLD!' };
SS.TEXT = {
  'NIGHT SHIFT': 'AFTER HOURS', 'CORE BREACHED!': 'CANDIDATE LOST!', 'ZZAP!': 'CONNECTED!', 'Too hot to build': 'Still cleaning up',
  'Tap a basic robot': 'Tap a basic recruiter', 'SUMMON!': 'REFERRALS!', 'REPAIRED': 'REFRESHED', 'Pick a basic robot': 'Pick a basic recruiter',
  'No fusion': 'No upgrade for that combo', 'KING GLOOP': 'THE UNICORN', 'KING GLOOP APPROACHES!': 'THE UNICORN APPEARS!', 'FINAL WAVE': 'FINAL ROUND',
  'Clearing scrap costs 25': 'Clearing paperwork costs 25', 'Clear the scrap first': 'Clear the paperwork first',
  'Caps fit basic robots only': 'Headphones fit basic recruiters only', 'CORE': 'OFFER', 'BOIL!': 'BOLTING!',
  'A HUGE SLIME SURGE IS COMING!': 'A FLOOD OF CANDIDATES IS COMING!', '+ARMOR': '+FOCUS', 'Beam': 'Reassign', 'DEFEND!': 'RECRUIT!',
  'slime': 'candidate', 'slimes': 'candidates', 'Place this on a robot': 'AI features go on a recruiter',
  'Overrun!': 'Swamped!', 'The King Has Fallen!': 'You Hired the Unicorn!', 'Level Clear!': 'Req Filled!', 'The Slimes Got In!': 'Candidates Got Away!',
  'A slime reached the core. Try a different build, more fusions, or the Grabber.': 'A candidate walked out to a competitor. Try more AI features, a different mix of recruiters, or the Grabber.',
  'Slimes destroyed': 'Candidates hired', 'Robots built': 'Recruiters placed', 'Robots lost': 'Burnouts', 'Robots removed': 'Recruiters removed',
  'Energy collected': 'Leads collected', 'Energy spent': 'Leads spent', 'Fusions': 'AI upgrades', 'Damage dealt': 'Persuasion', 'Waves cleared': 'Rounds cleared',
  'New robot: ': 'New hire: ', 'Damage by robot': 'Impact by recruiter', 'Tier-3 fusions unlocked!': 'Tier-3 upgrades unlocked!',
  'Place either robot onto the other, or use the Grabber.': 'Drop one onto the other, or combine them with the Grabber.',
  'fusions found': 'AI upgrades found',
  'You survived': 'You survived', 'wave': 'round', 'waves': 'rounds', 'Wave': 'Round', 'Endless': 'Endless',
  'New AI feature: ': 'New AI feature: ', 'Unlock more robots to reveal this entry.': 'Unlock more recruiters to reveal this entry.',
  'Fuses into:': 'Upgrades into:',
};

// ---------- presentation ----------
SS.HUD_COLORS = { tray: 'rgba(27,21,40,0.82)', panel: '#2B2438', accent: '#8B5CF6', card: '#3F3849', cardSel: '#5C15E0', border: '#6B6475',
  tool: '#2B2438', btn: 'rgba(43,36,56,0.9)', tipBg: 'rgba(27,21,40,0.94)', tipText: '#F6F4EF', trayEdge: 'rgba(139,92,246,0.6)', label: '#C9B6FF',
  counter: '#F6F4EF', toolEdge: '#6B6475' };
SS.SPRITE_H = { bulwark: 104, mine: 54, bomb: 96, crate: 84, hamilton: 80, apoach: 78, turretwall: 110, spikewall: 104, fortress: 124,
  nuke: 62, cryoburst: 104, steam: 100, gatling: 108, spark: 104, reactor: 108, dynamo: 108 };
SS.SLIME_K = { dasher: 1.0, hopper: 1.0, shield: 1.0, brute: 0.85, king: 0.85, mini: 1.0, splitter: 0.95 };
})();
