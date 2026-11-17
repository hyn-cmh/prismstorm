// PRISMSTORM's simulation: the player, five enemy kinds plus the splitter's
// minis, bullets, XP gems, particles and floating damage numbers, the wave
// director that spends an escalating budget on spawns, collisions, and the
// level-up upgrade pool. The world knows nothing about drawing or sound:
// it queues events (world.events) that main.js turns into sound and status
// text, and render.js draws whatever state the world holds.

import { ENEMIES, PLAYER, WAVE, WAVE_TABLE, XP_CURVE } from './config.js';

export const STEP = 1 / 60;

export const UPGRADES = [
  { id: 'rapid', name: 'Rapid Cycler', desc: 'Fire 15% faster', max: 5 },
  { id: 'heavy', name: 'Heavy Rounds', desc: '+35% bullet damage', max: 5 },
  { id: 'split', name: 'Split Cannon', desc: '+1 projectile per shot', max: 3 },
  { id: 'pierce', name: 'Piercing Rounds', desc: 'Bullets pierce +1 enemy', max: 3 },
  { id: 'thrust', name: 'Ion Thrusters', desc: '+12% move speed', max: 4 },
  { id: 'magnet', name: 'Magnet Coil', desc: '+45% XP magnet radius', max: 3 },
  { id: 'plating', name: 'Vital Plating', desc: '+25 max hull and repair 25', max: 4 },
  { id: 'dashcells', name: 'Dash Cells', desc: 'Dash recharges 25% faster', max: 3 },
  { id: 'blade', name: 'Orbit Blade', desc: '+1 blade circling your ship', max: 3 },
  { id: 'repair', name: 'Nano Repair', desc: 'Regenerate +0.8 hull / s', max: 3 },
];

function dist2(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const world = {
    events: [],
    enemies: [],
    bullets: [],
    enemyBullets: [],
    gems: [],
    particles: [],
    floaters: [],
    shake: 0,
    state: null,
    player: null,
  };

  function freshPlayer(width, height) {
    return {
      x: width / 2,
      y: height / 2,
      vx: 0,
      vy: 0,
      hp: PLAYER.maxHp,
      maxHp: PLAYER.maxHp,
      level: 1,
      xp: 0,
      xpNext: XP_CURVE.base,
      fireTimer: 0,
      dashTimer: 0,
      dashCooldownTimer: 0,
      invulnTimer: 0,
      angle: -Math.PI / 2,
      bladeAngle: 0,
      regen: 0,
      counts: {}, // upgrade id -> times taken
      ghosts: [],
    };
  }

  world.reset = function reset(width, height) {
    world.enemies.length = 0;
    world.bullets.length = 0;
    world.enemyBullets.length = 0;
    world.gems.length = 0;
    world.particles.length = 0;
    world.floaters.length = 0;
    world.events.length = 0;
    world.shake = 0;
    world.player = freshPlayer(width, height);
    world.state = {
      width,
      height,
      time: 0,
      wave: 1,
      waveTime: 0,
      budget: WAVE.baseBudget,
      spawnTimer: 1.2,
      score: 0,
      kills: 0,
      pendingLevels: 0,
      over: false,
      started: false,
    };
  };

  world.resize = function resize(width, height) {
    world.state.width = width;
    world.state.height = height;
    const p = world.player;
    p.x = Math.min(Math.max(p.x, 20), width - 20);
    p.y = Math.min(Math.max(p.y, 20), height - 20);
  };

  // --- derived stats: base config bent by the upgrades taken --------------
  function count(id) {
    return world.player.counts[id] ?? 0;
  }
  world.stats = function stats() {
    return {
      damage: PLAYER.bulletDamage * Math.pow(1.35, count('heavy')),
      fireInterval: PLAYER.fireInterval * Math.pow(0.85, count('rapid')),
      projectiles: 1 + count('split'),
      pierce: count('pierce'),
      speed: PLAYER.speed * Math.pow(1.12, count('thrust')),
      magnet: PLAYER.magnetRadius * Math.pow(1.45, count('magnet')),
      dashCooldown: PLAYER.dashCooldown * Math.pow(0.75, count('dashcells')),
      blades: count('blade'),
      regen: 0.8 * count('repair'),
    };
  };

  world.rollUpgradeChoices = function rollUpgradeChoices() {
    const available = UPGRADES.filter((u) => count(u.id) < u.max);
    const choices = [];
    const pool = [...available];
    while (choices.length < 3 && pool.length > 0) {
      const index = Math.floor(random.next() * pool.length);
      choices.push(pool.splice(index, 1)[0]);
    }
    return choices;
  };

  world.applyUpgrade = function applyUpgrade(id) {
    const p = world.player;
    p.counts[id] = count(id) + 1;
    if (id === 'plating') {
      p.maxHp += 25;
      p.hp = Math.min(p.maxHp, p.hp + 25);
    }
    if (world.state.pendingLevels > 0) world.state.pendingLevels -= 1;
  };

  // --- spawning ------------------------------------------------------------
  function spawnPoint() {
    const { width, height } = world.state;
    const p = world.player;
    for (let tries = 0; tries < 12; tries += 1) {
      const side = random.int(0, 3);
      const x = side === 0 ? -30 : side === 1 ? width + 30 : random.range(0, width);
      const y = side === 2 ? -30 : side === 3 ? height + 30 : random.range(0, height);
      if (dist2(x, y, p.x, p.y) > 240 * 240) return { x, y };
    }
    return { x: -30, y: -30 };
  }

  function spawnEnemy(kind, x, y) {
    const def = ENEMIES[kind];
    const waveScale = 1 + (world.state.wave - 1) * 0.16;
    world.enemies.push({
      kind,
      x,
      y,
      vx: 0,
      vy: 0,
      hp: def.hp * waveScale,
      maxHp: def.hp * waveScale,
      radius: def.radius,
      speed: def.speed * random.range(0.9, 1.1),
      damage: def.damage,
      score: def.score,
      xpValue: def.xp,
      color: def.color,
      flash: 0,
      bladeTimer: 0,
      shootTimer: random.range(1.4, 2.8),
      lungeTimer: random.range(1, 2.4),
      lungeTime: 0,
      wobble: random.range(0, Math.PI * 2),
      spawnAnim: 0.35,
    });
  }

  function directorTick(dt) {
    const s = world.state;
    s.waveTime += dt;
    if (s.waveTime >= WAVE.length) {
      s.waveTime = 0;
      s.wave += 1;
      s.budget += WAVE.baseBudget + WAVE.budgetGrowth * (s.wave - 1);
      s.score += 100 * s.wave;
      world.events.push({ type: 'wave', wave: s.wave });
    }
    s.spawnTimer -= dt;
    if (s.spawnTimer > 0 || s.budget <= 0 || world.enemies.length >= WAVE.maxAlive) return;
    const interval = Math.max(
      WAVE.spawnIntervalFloor,
      WAVE.spawnInterval - (s.wave - 1) * 0.07,
    );
    s.spawnTimer = interval * random.range(0.7, 1.2);
    const table = WAVE_TABLE[Math.min(s.wave, WAVE_TABLE.length) - 1];
    let totalWeight = 0;
    for (const [, weight] of table) totalWeight += weight;
    let roll = random.next() * totalWeight;
    let kind = table[0][0];
    for (const [name, weight] of table) {
      roll -= weight;
      if (roll <= 0) {
        kind = name;
        break;
      }
    }
    const cost = ENEMIES[kind].cost;
    if (cost > s.budget) return;
    s.budget -= cost;
    const point = spawnPoint();
    spawnEnemy(kind, point.x, point.y);
  }

  // --- particles and floaters ----------------------------------------------
  function burst(x, y, color, amount, speed, size = 3, life = 0.5) {
    for (let i = 0; i < amount; i += 1) {
      if (world.particles.length > 650) return;
      const angle = random.range(0, Math.PI * 2);
      const v = random.range(speed * 0.25, speed);
      world.particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        life: random.range(life * 0.4, life),
        maxLife: life,
        size: random.range(size * 0.5, size * 1.4),
        color,
        drag: 3.2,
      });
    }
  }

  function floater(x, y, text, color, size = 13) {
    if (world.floaters.length > 60) return;
    world.floaters.push({ x, y, vy: -46, life: 0.7, maxLife: 0.7, text, color, size });
  }

  // --- combat ----------------------------------------------------------------
  function damageEnemy(enemy, amount, knockX, knockY) {
    enemy.hp -= amount;
    enemy.flash = 0.09;
    const resist = enemy.kind === 'tank' ? 0.25 : 1;
    enemy.vx += knockX * resist;
    enemy.vy += knockY * resist;
    floater(enemy.x + random.range(-8, 8), enemy.y - enemy.radius, String(Math.round(amount)), '#dff8ff', 12);
    if (enemy.hp <= 0) killEnemy(enemy);
  }

  function killEnemy(enemy) {
    enemy.dead = true;
    const s = world.state;
    s.kills += 1;
    s.score += enemy.score;
    burst(enemy.x, enemy.y, enemy.color, enemy.kind === 'tank' ? 42 : 16, enemy.kind === 'tank' ? 320 : 240, 3.4, 0.55);
    burst(enemy.x, enemy.y, '#ffffff', 5, 140, 2.2, 0.3);
    world.events.push({ type: 'explode', big: enemy.kind === 'tank', x: enemy.x, y: enemy.y });
    if (enemy.kind === 'tank') world.shake = Math.min(world.shake + 7, 12);
    if (enemy.kind === 'splitter') {
      for (let i = 0; i < 2; i += 1) {
        spawnEnemy('mini', enemy.x + random.range(-14, 14), enemy.y + random.range(-14, 14));
      }
    }
    if (world.gems.length < 300) {
      world.gems.push({
        x: enemy.x + random.range(-6, 6),
        y: enemy.y + random.range(-6, 6),
        vx: random.range(-30, 30),
        vy: random.range(-30, 30),
        value: enemy.xpValue,
        pulse: random.range(0, Math.PI * 2),
      });
    }
  }

  function hurtPlayer(amount) {
    const p = world.player;
    if (p.invulnTimer > 0 || p.dashTimer > 0 || world.state.over) return;
    p.hp -= amount;
    p.invulnTimer = PLAYER.invulnerableTime;
    world.shake = Math.min(world.shake + 6, 11);
    burst(p.x, p.y, '#ff5470', 18, 260, 3, 0.45);
    world.events.push({ type: 'hurt' });
    if (p.hp <= 0) {
      p.hp = 0;
      world.state.over = true;
      burst(p.x, p.y, '#4df3ff', 70, 380, 4, 0.9);
      burst(p.x, p.y, '#ffffff', 26, 220, 3, 0.6);
      world.shake = 14;
      world.events.push({ type: 'gameover', score: world.state.score });
    }
  }

  function gainXp(value) {
    const p = world.player;
    p.xp += value;
    while (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level += 1;
      p.xpNext = XP_CURVE.base + XP_CURVE.growth * (p.level - 1);
      world.state.pendingLevels += 1;
      world.events.push({ type: 'levelup', level: p.level });
    }
  }

  // --- per-kind movement -------------------------------------------------------
  function steer(enemy, dt, tx, ty, speed) {
    const dx = tx - enemy.x;
    const dy = ty - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    const accel = 5.5;
    enemy.vx += ((dx / d) * speed - enemy.vx) * Math.min(1, accel * dt);
    enemy.vy += ((dy / d) * speed - enemy.vy) * Math.min(1, accel * dt);
  }

  function moveEnemy(enemy, dt) {
    const p = world.player;
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const distance = Math.hypot(dx, dy) || 1;
    switch (enemy.kind) {
      case 'dart': {
        enemy.lungeTimer -= dt;
        if (enemy.lungeTimer <= 0 && distance < 340 && enemy.lungeTime <= 0) {
          enemy.lungeTime = 0.42;
          enemy.lungeTimer = random.range(1.6, 2.8);
        }
        if (enemy.lungeTime > 0) {
          enemy.lungeTime -= dt;
          const boost = 2.6;
          enemy.vx = (dx / distance) * enemy.speed * boost;
          enemy.vy = (dy / distance) * enemy.speed * boost;
        } else {
          steer(enemy, dt, p.x + Math.sin(enemy.wobble + world.state.time * 3) * 30, p.y, enemy.speed);
        }
        break;
      }
      case 'orbiter': {
        const want = 235;
        const radial = distance > want + 24 ? 1 : distance < want - 24 ? -1 : 0;
        const tx = enemy.x + (dx / distance) * radial * 60 - (dy / distance) * 74;
        const ty = enemy.y + (dy / distance) * radial * 60 + (dx / distance) * 74;
        steer(enemy, dt, tx, ty, enemy.speed);
        enemy.shootTimer -= dt;
        if (enemy.shootTimer <= 0 && distance < 460) {
          enemy.shootTimer = random.range(2.2, 3.1);
          world.enemyBullets.push({
            x: enemy.x, y: enemy.y,
            vx: (dx / distance) * 245, vy: (dy / distance) * 245,
            radius: 5, damage: ENEMIES.orbiter.damage, life: 3.4,
          });
          world.events.push({ type: 'enemyShoot', x: enemy.x, y: enemy.y });
        }
        break;
      }
      default:
        steer(enemy, dt, p.x, p.y, enemy.speed);
    }
    enemy.x += enemy.vx * dt;
    enemy.y += enemy.vy * dt;
  }

  // --- the step ------------------------------------------------------------------
  world.step = function step(dt, control) {
    const s = world.state;
    const p = world.player;
    if (s.over) {
      updateParticles(dt);
      return;
    }
    s.time += dt;
    s.score += dt * 6;
    const st = world.stats();

    // player movement and dash
    if (p.dashCooldownTimer > 0) p.dashCooldownTimer -= dt;
    if (p.invulnTimer > 0) p.invulnTimer -= dt;
    if (control.dash && p.dashCooldownTimer <= 0 && p.dashTimer <= 0) {
      p.dashTimer = PLAYER.dashTime;
      p.dashCooldownTimer = st.dashCooldown;
      world.events.push({ type: 'dash' });
    }
    const dashing = p.dashTimer > 0;
    if (dashing) {
      p.dashTimer -= dt;
      const dashAngle = Math.atan2(control.moveY || Math.sin(p.angle), control.moveX || Math.cos(p.angle));
      p.vx = Math.cos(dashAngle) * PLAYER.dashSpeed;
      p.vy = Math.sin(dashAngle) * PLAYER.dashSpeed;
      p.ghosts.push({ x: p.x, y: p.y, angle: p.angle, life: 0.22 });
    } else {
      p.vx = control.moveX * st.speed;
      p.vy = control.moveY * st.speed;
    }
    p.x = Math.min(Math.max(p.x + p.vx * dt, PLAYER.radius), s.width - PLAYER.radius);
    p.y = Math.min(Math.max(p.y + p.vy * dt, PLAYER.radius), s.height - PLAYER.radius);
    p.angle = Math.atan2(control.aimY - p.y, control.aimX - p.x);
    if (st.regen > 0) p.hp = Math.min(p.maxHp, p.hp + st.regen * dt);

    // firing
    p.fireTimer -= dt;
    if (control.firing && p.fireTimer <= 0) {
      p.fireTimer = st.fireInterval;
      const spreadStep = 0.09;
      for (let i = 0; i < st.projectiles; i += 1) {
        const offset = (i - (st.projectiles - 1) / 2) * spreadStep;
        const angle = p.angle + offset + random.range(-0.012, 0.012);
        world.bullets.push({
          x: p.x + Math.cos(p.angle) * (PLAYER.radius + 6),
          y: p.y + Math.sin(p.angle) * (PLAYER.radius + 6),
          vx: Math.cos(angle) * PLAYER.bulletSpeed,
          vy: Math.sin(angle) * PLAYER.bulletSpeed,
          radius: PLAYER.bulletRadius,
          damage: st.damage,
          pierce: st.pierce,
          life: 0.95,
        });
      }
      world.events.push({ type: 'shoot' });
      burst(p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22, '#aefcff', 2, 90, 1.8, 0.14);
    }

    // orbit blades
    p.bladeAngle += dt * 3.4;
    if (st.blades > 0) {
      for (let i = 0; i < st.blades; i += 1) {
        const a = p.bladeAngle + (i * Math.PI * 2) / st.blades;
        const bx = p.x + Math.cos(a) * 56;
        const by = p.y + Math.sin(a) * 56;
        for (const enemy of world.enemies) {
          if (enemy.bladeTimer <= 0 && dist2(bx, by, enemy.x, enemy.y) < (enemy.radius + 13) ** 2) {
            enemy.bladeTimer = 0.38;
            damageEnemy(enemy, 16, (enemy.x - p.x) * 4, (enemy.y - p.y) * 4);
            world.events.push({ type: 'hit' });
          }
        }
      }
    }

    directorTick(dt);

    // enemies
    for (const enemy of world.enemies) {
      if (enemy.flash > 0) enemy.flash -= dt;
      if (enemy.bladeTimer > 0) enemy.bladeTimer -= dt;
      if (enemy.spawnAnim > 0) enemy.spawnAnim -= dt;
      moveEnemy(enemy, dt);
    }
    // gentle separation so enemies do not stack into one blob
    const list = world.enemies;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        const min = a.radius + b.radius;
        const d2 = dist2(a.x, a.y, b.x, b.y);
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = ((min - d) / d) * 0.5 * 26 * dt;
          const ux = (b.x - a.x) * push;
          const uy = (b.y - a.y) * push;
          a.x -= ux;
          a.y -= uy;
          b.x += ux;
          b.y += uy;
        }
      }
    }

    // player bullets
    for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = world.bullets[i];
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.life -= dt;
      let spent = bullet.life <= 0 || bullet.x < -20 || bullet.y < -20
        || bullet.x > s.width + 20 || bullet.y > s.height + 20;
      if (!spent) {
        for (const enemy of world.enemies) {
          if (enemy.dead || enemy.spawnAnim > 0.2) continue;
          if (dist2(bullet.x, bullet.y, enemy.x, enemy.y) < (enemy.radius + bullet.radius) ** 2) {
            damageEnemy(enemy, bullet.damage, bullet.vx * 0.14, bullet.vy * 0.14);
            world.events.push({ type: 'hit' });
            burst(bullet.x, bullet.y, enemy.color, 3, 130, 2, 0.22);
            if (bullet.pierce > 0) {
              bullet.pierce -= 1;
            } else {
              spent = true;
            }
            break;
          }
        }
      }
      if (spent) {
        world.bullets[i] = world.bullets[world.bullets.length - 1];
        world.bullets.pop();
      }
    }

    // enemy bullets
    for (let i = world.enemyBullets.length - 1; i >= 0; i -= 1) {
      const bolt = world.enemyBullets[i];
      bolt.x += bolt.vx * dt;
      bolt.y += bolt.vy * dt;
      bolt.life -= dt;
      let gone = bolt.life <= 0;
      if (!gone && dist2(bolt.x, bolt.y, p.x, p.y) < (bolt.radius + PLAYER.radius) ** 2) {
        hurtPlayer(bolt.damage);
        gone = true;
      }
      if (gone) {
        world.enemyBullets[i] = world.enemyBullets[world.enemyBullets.length - 1];
        world.enemyBullets.pop();
      }
    }

    // enemy contact with the player
    for (const enemy of world.enemies) {
      if (enemy.dead || enemy.spawnAnim > 0.15) continue;
      if (dist2(enemy.x, enemy.y, p.x, p.y) < (enemy.radius + PLAYER.radius - 2) ** 2) {
        hurtPlayer(enemy.damage);
        enemy.vx = (enemy.x - p.x) * 6;
        enemy.vy = (enemy.y - p.y) * 6;
      }
    }

    // gems: drift, magnet, pickup
    let combo = 0;
    for (let i = world.gems.length - 1; i >= 0; i -= 1) {
      const gem = world.gems[i];
      gem.pulse += dt * 5;
      const d2 = dist2(gem.x, gem.y, p.x, p.y);
      if (d2 < st.magnet * st.magnet) {
        const d = Math.sqrt(d2) || 1;
        const pull = 560 * (1 - d / (st.magnet * 1.6));
        gem.vx += ((p.x - gem.x) / d) * pull * dt * 6;
        gem.vy += ((p.y - gem.y) / d) * pull * dt * 6;
      }
      gem.vx *= 0.9;
      gem.vy *= 0.9;
      gem.x += gem.vx * dt;
      gem.y += gem.vy * dt;
      if (d2 < PLAYER.pickupRadius * PLAYER.pickupRadius) {
        gainXp(gem.value);
        combo += 1;
        world.events.push({ type: 'pickup', combo });
        burst(gem.x, gem.y, '#3dffc8', 3, 90, 1.8, 0.25);
        world.gems[i] = world.gems[world.gems.length - 1];
        world.gems.pop();
      }
    }

    world.enemies = world.enemies.filter((enemy) => !enemy.dead);
    updateParticles(dt);

    for (let i = p.ghosts.length - 1; i >= 0; i -= 1) {
      p.ghosts[i].life -= dt;
      if (p.ghosts[i].life <= 0) p.ghosts.splice(i, 1);
    }
    if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 26);
  };

  function updateParticles(dt) {
    for (let i = world.particles.length - 1; i >= 0; i -= 1) {
      const pt = world.particles[i];
      pt.life -= dt;
      if (pt.life <= 0) {
        world.particles[i] = world.particles[world.particles.length - 1];
        world.particles.pop();
        continue;
      }
      const dragK = Math.max(0, 1 - pt.drag * dt);
      pt.vx *= dragK;
      pt.vy *= dragK;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
    for (let i = world.floaters.length - 1; i >= 0; i -= 1) {
      const f = world.floaters[i];
      f.life -= dt;
      f.y += f.vy * dt;
      if (f.life <= 0) world.floaters.splice(i, 1);
    }
  }

  world.reset(1280, 800);
  return world;
}
