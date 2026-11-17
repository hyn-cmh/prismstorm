// The screenshot scenes behind ?shot=title|play|upgrade|over&seed=N.
// Each scene runs the real game forward from a fresh world at a fixed
// step, steered by a simple autopilot, so the frame is what honest play
// looks like and the same seed always stages the same scene. The maker
// opens these URLs in a browser (shots.json lists them) and saves the
// renders into screenshots/.

import { STEP } from './world.js';
import { SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function nearestEnemy(world) {
  const p = world.player;
  let best = null;
  let bestD = Infinity;
  for (const enemy of world.enemies) {
    const d = (enemy.x - p.x) ** 2 + (enemy.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = enemy;
    }
  }
  return { enemy: best, distance: Math.sqrt(bestD) };
}

// A competent pilot: aim at the nearest enemy, keep a comfort distance
// from everything hostile, bend every path over the nearest XP gem (and
// commit to it when the way is clear or it is close), keep softly off
// the walls, and dash when something gets uncomfortably close.
function pilotControl(world) {
  const p = world.player;
  const { enemy, distance } = nearestEnemy(world);
  let moveX = 0;
  let moveY = 0;
  for (const e of world.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 200) {
      const weight = (200 - d) / 200;
      moveX += (dx / d) * weight * 1.7;
      moveY += (dy / d) * weight * 1.7;
    }
  }
  let gem = null;
  let gemDistance = Infinity;
  for (const g of world.gems) {
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < gemDistance) {
      gemDistance = d;
      gem = g;
    }
  }
  if (gem) {
    const commit = distance > 200 || gemDistance < 130 ? 1 : 0.35;
    moveX += ((gem.x - p.x) / (gemDistance || 1)) * commit;
    moveY += ((gem.y - p.y) / (gemDistance || 1)) * commit;
  }
  // soft wall avoidance, weaker than the pull of a nearby gem
  const margin = 56;
  if (p.x < margin) moveX += 0.45;
  if (p.x > world.state.width - margin) moveX -= 0.45;
  if (p.y < margin) moveY += 0.45;
  if (p.y > world.state.height - margin) moveY -= 0.45;
  const len = Math.hypot(moveX, moveY);
  if (len > 1) {
    moveX /= len;
    moveY /= len;
  }
  return {
    moveX,
    moveY,
    aimX: enemy ? enemy.x : gem ? gem.x : p.x + 100,
    aimY: enemy ? enemy.y : gem ? gem.y : p.y,
    firing: enemy !== null && distance < 560,
    dash: distance < 74,
  };
}

// A hopeless pilot for the game-over scene: it charges the nearest enemy
// and never fires, so the swarm wins quickly, as it does for a beginner
// who panics.
function doomedControl(world) {
  const p = world.player;
  const { enemy } = nearestEnemy(world);
  if (!enemy) return { moveX: 0, moveY: 0, aimX: p.x + 1, aimY: p.y, firing: false, dash: false };
  const d = Math.hypot(enemy.x - p.x, enemy.y - p.y) || 1;
  return {
    moveX: (enemy.x - p.x) / d,
    moveY: (enemy.y - p.y) / d,
    aimX: enemy.x,
    aimY: enemy.y,
    firing: false,
    dash: false,
  };
}

function runSeconds(world, seconds, controlFn, onLevel) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, controlFn(world));
    world.events.length = 0;
    if (world.state.pendingLevels > 0 && onLevel && onLevel(world)) break;
    if (world.state.over) break;
  }
}

/**
 * Stage the named scene in `world` (already reset at the canvas size) and
 * return what the renderer should show: the screen, plus the upgrade
 * choices when the scene is the level-up screen.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    const applyFirstChoice = (w) => {
      const choice = w.rollUpgradeChoices()[0];
      if (choice) w.applyUpgrade(choice.id);
    };
    // Play in half-second chunks; once past 18 s, keep the first busy
    // frame — a real fight in progress — instead of a late-wave lull.
    // The early waves are gentle by design, so the busy frame usually
    // waits for the wave-3 swarm.
    let t = 0;
    while (t < 95 && !world.state.over) {
      runSeconds(world, 0.5, pilotControl, applyFirstChoice);
      t += 0.5;
      if (t >= 18 && world.enemies.length >= 8) break;
    }
    if (world.state.over) {
      world.reset(world.state.width, world.state.height);
      runSeconds(world, 13, pilotControl, applyFirstChoice);
    }
    return { screen: SCREEN_PLAY, choices: [] };
  }
  if (name === 'upgrade') {
    let choices = [];
    runSeconds(world, 75, pilotControl, (w) => {
      choices = w.rollUpgradeChoices();
      return true; // freeze with the level-up still open for the frame
    });
    if (choices.length === 0) choices = world.rollUpgradeChoices();
    return { screen: SCREEN_LEVELUP, choices };
  }
  if (name === 'over') {
    runSeconds(world, 150, doomedControl, null);
    return { screen: SCREEN_OVER, choices: [] };
  }
  // title: a few seconds of ambient drifting with no pilot at all
  runSeconds(world, 4, () => ({ moveX: 0, moveY: 0, aimX: 0, aimY: 0, firing: false, dash: false }), null);
  return { screen: SCREEN_TITLE, choices: [] };
}
