// PRISMSTORM tuning: every balance number of the game lives here, so the
// feel of a run can be adjusted in one place. Times are in seconds, speeds
// in pixels per second, sizes in pixels. The arena is the browser window;
// the world clamps every entity to the rectangle the canvas shows.

export const PLAYER = {
  radius: 13,
  speed: 265,
  maxHp: 100,
  fireInterval: 0.16,
  bulletSpeed: 640,
  bulletDamage: 12,
  bulletRadius: 4,
  dashSpeed: 1150,
  dashTime: 0.16,
  dashCooldown: 1.6,
  magnetRadius: 92,
  pickupRadius: 22,
  invulnerableTime: 0.6,
};

export const WAVE = {
  length: 30, // seconds per wave; the next wave starts when the clock runs out
  baseBudget: 14, // spawn points the first wave may spend
  budgetGrowth: 9, // extra spawn points per wave
  spawnInterval: 0.9, // seconds between spawn ticks at wave 1
  spawnIntervalFloor: 0.28,
  maxAlive: 130,
};

// Enemy kinds. cost is what the wave director pays from its budget; score
// and xp are what a kill pays back. Behaviour lives in world.js.
export const ENEMIES = {
  chaser: { radius: 14, hp: 22, speed: 96, damage: 12, cost: 1, score: 50, xp: 1, color: '#ff4d8d' },
  dart: { radius: 9, hp: 10, speed: 178, damage: 8, cost: 1, score: 70, xp: 1, color: '#37e0ff' },
  splitter: { radius: 16, hp: 34, speed: 74, damage: 12, cost: 2, score: 90, xp: 2, color: '#7dff5e' },
  mini: { radius: 8, hp: 6, speed: 168, damage: 6, cost: 0, score: 30, xp: 1, color: '#b6ff9e' },
  orbiter: { radius: 13, hp: 30, speed: 118, damage: 10, cost: 3, score: 140, xp: 2, color: '#c792ff' },
  tank: { radius: 26, hp: 170, speed: 46, damage: 22, cost: 5, score: 300, xp: 4, color: '#ffb347' },
};

// Which kinds the director may pick at each wave (index 0 is wave 1) and
// the weight of each pick. Later waves unlock the heavier kinds.
export const WAVE_TABLE = [
  [['chaser', 10]],
  [['chaser', 10], ['dart', 4]],
  [['chaser', 9], ['dart', 6], ['splitter', 3]],
  [['chaser', 8], ['dart', 7], ['splitter', 4], ['orbiter', 2]],
  [['chaser', 8], ['dart', 8], ['splitter', 5], ['orbiter', 3], ['tank', 1]],
  [['chaser', 7], ['dart', 9], ['splitter', 6], ['orbiter', 4], ['tank', 2]],
];

export const XP_CURVE = { base: 5, growth: 4 }; // xp to next level: base + growth * (level - 1)

export const COLORS = {
  background: '#05060f',
  grid: 'rgba(64, 90, 180, 0.16)',
  player: '#4df3ff',
  playerCore: '#eaffff',
  bullet: '#aefcff',
  gem: '#3dffc8',
  text: '#d9f6ff',
  dimText: '#7f95b8',
  danger: '#ff5470',
  xpBar: '#3dffc8',
  hpBar: '#ff5470',
  hpBarBack: 'rgba(255, 84, 112, 0.25)',
};
