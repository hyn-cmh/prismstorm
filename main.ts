// PRISMSTORM's hand-in program for make.fun's best-game-01 bounty (Node 22,
// standard library only). The game itself is the static site under game/ —
// plain files a desktop browser opens offline — and screenshots/ holds the
// maker's own browser screenshots of it. This program copies both folders
// into the output directory and writes dossier.json there with the kit's
// vendored buildDossier library, byte for byte as the gate rebuilds it.
// It writes nothing else and reads no clock, so two runs agree exactly.
//
// In the grader MAKEFUN_OUTPUT_DIR names /output; locally:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The gate's caps, mirrored from the kit's reference/gate.json: buildDossier
// refuses to write a dossier for an entry the scorer would refuse (too many
// screenshots or game files, an oversized file, a path that is too long).
const DOSSIER_LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoDir, 'game'), join(outputDir, 'game'), { recursive: true });

const shotsDir = join(outputDir, 'screenshots');
mkdirSync(shotsDir, { recursive: true });
const localShots = join(repoDir, 'screenshots');
if (existsSync(localShots)) {
  cpSync(localShots, shotsDir, { recursive: true });
}

const dossier = buildDossier(outputDir, DOSSIER_LIMITS);
writeFileSync(join(outputDir, 'dossier.json'), dossier);
console.log(`PRISMSTORM handed in: game/ and screenshots/ copied to ${outputDir}, dossier.json ${dossier.length} bytes.`);
