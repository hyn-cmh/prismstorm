# prismstorm

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/hyn-cmh/prismstorm/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/hyn-cmh/prismstorm/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

PRISMSTORM is an original neon twin-stick arena survival shooter that plays offline in a desktop browser from the static files under game/: move with WASD, aim with the mouse, dash with Shift, and survive escalating waves of five enemy kinds. Kills drop XP shards; each level-up pauses the storm and offers a choice of three upgrades (multishot, piercing rounds, orbit blades, thrusters and more), so every run builds a different ship. It has synthesized WebAudio sound and music, particles, screen shake, damage numbers, a full HUD, title, pause, game-over and restart screens, and a persistent best score.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. To hand the entry in the way the grader does: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` copies game/ and screenshots/ to out/ and writes out/dossier.json.

---

<sub>Entered on [make.fun](https://make.fun/?ref=1pk8yq3w&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
