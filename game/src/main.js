// PRISMSTORM's entry point: builds the world, renderer, input and audio,
// runs the fixed-step loop, and owns the screen state machine — title,
// playing, level-up choice, paused, game over — plus the ?shot= staging
// the screenshots are taken from. Everything else lives in its own file:
// config.js (tuning), world.js (simulation), render.js (drawing),
// input.js (keyboard and mouse), audio.js (synthesized sound),
// shots.js (screenshot scenes).

import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { createRandom } from './random.js';
import {
  createRenderer,
  SCREEN_LEVELUP,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  upgradeCardRects,
} from './render.js';
import { stageShot } from './shots.js';
import { createWorld, STEP } from './world.js';

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const shotSeed = Number(params.get('seed') ?? '1') || 1;

const random = createRandom(shotName ? shotSeed * 7919 + 13 : (Date.now() % 2147483646) + 1);
const world = createWorld(random);
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();

const ui = {
  screen: SCREEN_TITLE,
  choices: [],
  hoverChoice: -1,
  best: loadBest(),
  muted: false,
  time: 0,
  banner: null,
};

function loadBest() {
  try {
    return Number(localStorage.getItem('prismstorm-best')) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    localStorage.setItem('prismstorm-best', String(value));
  } catch {
    // private modes and some file setups have no storage; the game goes on
  }
}

function setStatus(text) {
  statusLine.textContent = text;
}

function fitToWindow() {
  const width = Math.max(320, innerWidth);
  const height = Math.max(320, innerHeight);
  renderer.resize(width, height);
  if (world.state) world.resize(width, height);
}
addEventListener('resize', fitToWindow);
fitToWindow();
world.reset(innerWidth, innerHeight);

// --- sound unlock and extra keys -------------------------------------------
addEventListener('pointerdown', () => audio.unlock());
addEventListener('keydown', (event) => {
  audio.unlock();
  if (event.code === 'KeyM') {
    ui.muted = audio.toggleMute();
  }
  if (event.code === 'KeyR' && ui.screen === SCREEN_OVER) startRun();
});

// --- the run lifecycle -------------------------------------------------------
function startRun() {
  world.reset(world.state.width, world.state.height);
  world.state.started = true;
  ui.screen = SCREEN_PLAY;
  ui.banner = { text: 'WAVE 1', time: 2.2 };
  setStatus('Run started. Wave 1.');
}

function enterLevelUp() {
  ui.choices = world.rollUpgradeChoices();
  ui.hoverChoice = -1;
  ui.screen = SCREEN_LEVELUP;
  audio.levelup();
  setStatus(`Level ${world.player.level}. Choose an upgrade.`);
}

function chooseUpgrade(index) {
  const choice = ui.choices[index];
  if (!choice) return;
  world.applyUpgrade(choice.id);
  audio.choose();
  setStatus(`Upgrade taken: ${choice.name}.`);
  if (world.state.pendingLevels > 0) {
    ui.choices = world.rollUpgradeChoices();
  } else {
    ui.screen = SCREEN_PLAY;
  }
}

function drainEvents() {
  for (const event of world.events) {
    switch (event.type) {
      case 'shoot':
        audio.shoot();
        break;
      case 'hit':
        audio.hit();
        break;
      case 'explode':
        audio.explode(event.big);
        break;
      case 'pickup':
        audio.pickup(event.combo);
        break;
      case 'dash':
        audio.dash();
        break;
      case 'hurt':
        audio.hurt();
        setStatus(`Hull at ${Math.ceil(world.player.hp)}.`);
        break;
      case 'wave':
        ui.banner = { text: `WAVE ${event.wave}`, time: 2.2 };
        audio.waveHorn();
        setStatus(`Wave ${event.wave}.`);
        break;
      case 'levelup':
        if (ui.screen === SCREEN_PLAY) enterLevelUp();
        break;
      case 'gameover':
        ui.screen = SCREEN_OVER;
        audio.gameOver();
        if (Math.floor(event.score) > ui.best) {
          ui.best = Math.floor(event.score);
          saveBest(ui.best);
        }
        setStatus(`Game over. Score ${Math.floor(event.score)}.`);
        break;
      default:
        break;
    }
  }
  world.events.length = 0;
}

// --- per-frame update ---------------------------------------------------------
function currentControl() {
  const axis = input.moveAxis();
  return {
    moveX: axis.x,
    moveY: axis.y,
    aimX: input.mouseX,
    aimY: input.mouseY,
    firing: input.firing || input.keys.has('Space'),
    dash: input.dashPressed,
  };
}

function update(dt) {
  ui.time += dt;
  if (ui.banner) {
    ui.banner.time -= dt;
    if (ui.banner.time <= 0) ui.banner = null;
  }
  switch (ui.screen) {
    case SCREEN_TITLE:
      if (input.confirmPressed) startRun();
      break;
    case SCREEN_PLAY: {
      if (input.pausePressed) {
        ui.screen = SCREEN_PAUSED;
        setStatus('Paused.');
        break;
      }
      let remaining = dt;
      while (remaining > 0) {
        const step = Math.min(STEP, remaining);
        world.step(step, currentControl());
        remaining -= step;
        if (world.state.over || world.state.pendingLevels > 0) break;
      }
      drainEvents();
      if (!world.state.over && world.state.pendingLevels > 0 && ui.screen === SCREEN_PLAY) {
        enterLevelUp();
      }
      break;
    }
    case SCREEN_LEVELUP: {
      // hover tracking for the cards
      const rects = upgradeCardRects(world.state.width, world.state.height);
      ui.hoverChoice = rects.findIndex(
        (r) => input.mouseX >= r.x && input.mouseX <= r.x + r.w
          && input.mouseY >= r.y && input.mouseY <= r.y + r.h,
      );
      if (input.choicePressed) chooseUpgrade(input.choicePressed - 1);
      else if (input.firing && ui.hoverChoice >= 0) chooseUpgrade(ui.hoverChoice);
      break;
    }
    case SCREEN_PAUSED:
      if (input.pausePressed) {
        ui.screen = SCREEN_PLAY;
        setStatus('Resumed.');
      }
      break;
    case SCREEN_OVER:
      world.step(STEP, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, firing: false, dash: false });
      world.events.length = 0;
      if (input.confirmPressed) startRun();
      break;
    default:
      break;
  }
  input.endFrame();
}

// --- screenshot staging, or the live loop --------------------------------------
if (shotName) {
  const staged = stageShot(shotName, world);
  ui.screen = staged.screen;
  ui.choices = staged.choices;
  ui.hoverChoice = staged.screen === SCREEN_LEVELUP ? 0 : -1;
  ui.time = 0.5; // a blink phase where the prompts are lit
  renderer.draw(world, ui);
  document.body.dataset.shotReady = '1';
  setStatus(`Screenshot scene: ${shotName}.`);
} else {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    update(dt);
    renderer.draw(world, ui);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  setStatus('PRISMSTORM title screen. Click or press Enter to launch.');
}
