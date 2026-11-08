# Replacing art and sound

The game draws everything procedurally by default. You can replace any piece by dropping a file in `assets/` and listing its name in `assets/manifest.json`. Anything not listed keeps the built-in version, so you can upgrade one item at a time.

```json
{
  "sprites": ["blaster", "blob", "background"],
  "sfx": ["shoot", "explode"],
  "music": ["battle"]
}
```

Only use art and audio you made, generated yourself, or that is licensed for reuse (e.g. CC0).

## Sprites — `assets/sprites/<id>.png`
- Transparent PNG, side view, **facing right for robots, facing left for slimes**.
- Robots: drawn 100 logical px tall, bottom of the image = ground. Recommended source size 256×256 (scaled down with good quality on Retina).
- Slimes: drawn ~3.2× their base radius tall (≈96 px for normal size, more for Megaslime/King). Recommended 256×256; King Gloop 512×512.
- The game still adds bobbing, squash/stretch, hit flash, slow tint and melt-on-death on top of your image.
- `background.png`: 1280×720 (or 2560×1440). The 9×5 grid starts at x=140, y=124 with 112×116 tiles — keep that area readable.

**Robot ids:** `spark`, `blaster`, `bulwark`, `mine`, `cryo`, `bomb`, `lobber`, `flamer`, `tesla`
**Fusion ids:** `twin`, `gatling`, `cryorep`, `solar`, `inferno`, `turretwall`, `arcrifle`, `barrage`, `reactor`, `dynamo`, `fortress`, `glacier`, `spikewall`, `furnace`, `steam`, `storm`, `nuke`, `cryoburst`, `snowmortar`, `blazemortar`
**Slime ids:** `blob`, `capped`, `iron`, `dasher`, `hopper`, `splitter`, `mini`, `acid`, `shield`, `brute`, `king`

Note: armor caps/helmets/shield plates are drawn by the game only with the built-in art. If you supply a sprite for `capped`, `iron` or `shield`, draw the armor into the sprite.

## Sound effects — `assets/sfx/<name>.mp3`
Short (≤1 s, except where noted), normalized, mono is fine.

| name | when |
|---|---|
| `shoot` | robot fires a bolt (plays very often — keep it soft) |
| `hit` / `armorHit` | slime hit / hit on metal armor |
| `collect` | energy collected |
| `place` / `fuse` / `invalid` | robot placed / fusion / not allowed |
| `explode` | mine, bomb |
| `zap` / `flame` / `lob` | tesla, flamer, lobber |
| `chomp` | slime chewing |
| `unitDie` / `slimeDie` | robot destroyed / slime destroyed |
| `shieldBreak` / `hop` / `smash` / `freeze` | special events |
| `surge` / `finalWave` | big wave / final wave warning (1–2 s) |
| `sweeper` | lane sweeper launches (~1 s) |
| `win` / `lose` | level result (1–3 s) |
| `click` / `select` / `start` | UI |

## Music — `assets/music/<track>.mp3`
Loopable tracks: `menu`, `battle`, `boss`. 1–3 minutes, seamless loop point at the end.

## Sources
- **Image generators:** prompt for a consistent style across all units, e.g. *"cute chunky cartoon robot on tank treads, side view facing right, flat vector style, bold outlines, transparent background, game sprite"*. Generate all robots in one session with the same seed/style reference for consistency. Remove backgrounds and trim before export.
- **SFX:** ElevenLabs Sound Effects, or CC0 packs from kenney.nl / freesound.org (filter by CC0).
- **Music:** Suno/Udio (check the plan's commercial/personal-use terms), or CC0 tracks from OpenGameArt.
