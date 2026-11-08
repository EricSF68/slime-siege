# Slime Siege

Robots vs. slime lane defense with a fusion system. Static HTML/JS — no build step, no dependencies, works offline once loaded.

## Play locally
Double-clicking `index.html` works, but some browsers restrict local files. Better:

```bash
cd slime-siege
python3 -m http.server 8000
# open http://localhost:8000
```

## Deploy to GitHub Pages
1. Create a new **public** repository (e.g. `slime-siege`). Private repos need a paid plan for Pages.
2. Upload every file and folder in this directory to the repo root (web UI drag-drop, or `git push`).
3. Repo **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main`, folder `/ (root)` → Save**.
4. After ~1 minute it's live at `https://<username>.github.io/slime-siege/`.
5. iPhone/iPad: open the URL in Safari → Share → **Add to Home Screen** for full-screen, app-like play.

**Updating:** edit files, commit, push. Bump `VERSION` in `sw.js` so installed copies pick up the change.

## Controls
- **Touch/mouse:** tap a robot card, then tap a tile — or drag the card onto the tile. Tap energy cells to collect.
- **Fusion:** place a robot onto another robot. Matching pairs fuse (gold outline shows valid targets). See Almanac → Fusions.
- **Remove:** wrench button, then tap a robot.
- **Keyboard (desktop):** `1–9` select card · `W` remove tool · `F` 1×/2× speed · `Space` pause · `Esc` cancel.

## URL options
- `?unlockall=1` — unlock all levels (testing)
- `?seed=123` — deterministic waves
- `?debug=1` — FPS counter

## Content
- 9 base robots, 20 fusions, 10 slime types + boss
- 12 levels + Endless mode, Easy/Normal/Hard
- Progress saved in the browser (localStorage)

## Upgrading art and sound
Every robot, slime, the background, each sound effect and each music track has a replaceable slot. See [ASSETS.md](ASSETS.md).

## Files
| Path | Purpose |
|---|---|
| `index.html`, `style.css` | Page, menus, layout |
| `js/data.js` | Robots, fusion table, slimes, levels, difficulty |
| `js/game.js` | Battle simulation, rendering, input |
| `js/art.js` | Procedural vector art + sprite overrides |
| `js/audio.js` | Synthesized SFX/music + audio overrides |
| `js/main.js` | Game loop, screens, save data |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline/PWA support |
| `assets/` | Optional replacement art/audio (see ASSETS.md) |
