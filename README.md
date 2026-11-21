# Shadow Vault — a stealth heist game

[![make.fun](https://make.fun/badge/best-stealth-game-20261121-1759.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![rank](https://make.fun/badge/best-stealth-game-20261121-1759/FiluFafayo/shadow-vault-2/rank.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)
[![reward](https://make.fun/badge/best-stealth-game-20261121-1759/FiluFafayo/shadow-vault-2/reward.svg)](https://make.fun/bounty/best-stealth-game-20261121-1759)

An entry for the [best stealth game bounty](https://make.fun/bounty/best-stealth-game-20261121-1759) on make.fun.

**Shadow Vault** is an original top-down stealth game. You are a thief
breaking into a museum at night: steal every gem, then slip out the exit —
unseen.

## How to play

- **Move:** WASD or arrow keys (mouse click also starts the game)
- **Sneak:** hold `Shift` — slower, a much smaller noise ring, and the
  detection meter fills half as fast
- **Pause:** `P` or `Esc` · **Retry a level:** `R` (after being caught) ·
  **Next level:** `Enter` (after clearing one)

Guards patrol the halls with cones of sight. Crates, pillars and plants
break their line of sight — hide behind them. Walking makes noise (the pale
ring around the thief); a guard that hears you comes to investigate. If a
guard sees you, the **SEEN** meter fills; at full it becomes an **ALARM** and
every guard chases your last seen position. Break line of sight for a few
seconds and the alarm cools off. Get caught and the level restarts.

Three wings, three par times: **The Moonlit Gallery** (3 gems),
**The Vault Wing** (4 gems), **The Crown Chamber** (4 gems). Clearing a
level unseen earns a +400 ghost bonus; finishing fast earns a time bonus.

## Play it

No build step — the game is plain static files under `game/`. Serve it and
open it in desktop Chrome:

```sh
node serve.ts
# game/ is on http://localhost:8080
```

Or open `game/index.html` from any static file server. It makes no network
requests: every script is a file under `game/`, and the sounds are
synthesized with WebAudio (no audio files).

## Layout

- `game/index.html` — the page and canvas
- `game/src/config.js` — tuning and the three level maps
- `game/src/world.js` — simulation: player, guards, vision, detection, noise
- `game/src/render.js` — canvas drawing: floor, cones, guards, HUD, screens
- `game/src/input.js` — keyboard and mouse input
- `game/src/audio.js` — synthesized footsteps, chimes, alarm, jingles
- `game/src/main.js` — game loop and screens
- `game/src/shots.js` — staged screenshot scenes and the autopilot
- `main.ts` — the hand-in program: copies `game/` + `screenshots/` to
  `/output` and writes `/output/dossier.json`
- `screenshots/` — 4 real renders of the game's own code (the cover first)

## License

MIT — see `LICENSE`.
