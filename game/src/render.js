// PRISMSTORM's drawing: everything the player sees, in canvas 2D with a
// neon glow palette. A starfield and grid behind the arena, the ship and
// five enemy shapes, bullets, gems, particles and damage numbers, then
// the HUD and the screens (title, level-up cards, pause, game over).
// Nothing here changes the world; it only reads it.

import { COLORS, PLAYER } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const FONT = '"Segoe UI", system-ui, -apple-system, sans-serif';

export function upgradeCardRects(width, height) {
  const cardW = Math.min(250, (width - 120) / 3);
  const cardH = 168;
  const gap = 24;
  const total = cardW * 3 + gap * 2;
  const x0 = (width - total) / 2;
  const y = height / 2 - cardH / 2 + 26;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (cardW + gap), y, w: cardW, h: cardH }));
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let stars = [];

  function resize(width, height) {
    canvas.width = width;
    canvas.height = height;
    stars = [];
    let seed = 1234567;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let i = 0; i < 130; i += 1) {
      stars.push({ x: rand() * width, y: rand() * height, r: rand() * 1.5 + 0.3, layer: rand() });
    }
  }

  function drawBackground(width, height, time) {
    const grad = ctx.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, Math.max(width, height) * 0.75);
    grad.addColorStop(0, '#0a0d24');
    grad.addColorStop(0.6, '#060818');
    grad.addColorStop(1, COLORS.background);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    for (const star of stars) {
      const twinkle = 0.35 + 0.3 * Math.sin(time * (0.6 + star.layer) + star.x);
      ctx.fillStyle = `rgba(190, 220, 255, ${(twinkle * (0.4 + star.layer * 0.6)).toFixed(3)})`;
      ctx.fillRect(star.x, star.y, star.r, star.r);
    }
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    const gridSize = 64;
    const offset = (time * 6) % gridSize;
    ctx.beginPath();
    for (let x = -offset; x < width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  function drawPlayer(world) {
    const p = world.player;
    const st = world.stats();
    // dash ghosts
    for (const ghost of p.ghosts) {
      ctx.save();
      ctx.globalAlpha = ghost.life * 2.4;
      ctx.translate(ghost.x, ghost.y);
      ctx.rotate(ghost.angle);
      shipPath();
      ctx.strokeStyle = COLORS.player;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    // orbit blades
    if (st.blades > 0) {
      ctx.save();
      ctx.strokeStyle = 'rgba(77, 243, 255, 0.18)';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 56, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < st.blades; i += 1) {
        const a = p.bladeAngle + (i * Math.PI * 2) / st.blades;
        const bx = p.x + Math.cos(a) * 56;
        const by = p.y + Math.sin(a) * 56;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(a + Math.PI / 4);
        ctx.shadowColor = '#4df3ff';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#bffbff';
        ctx.fillRect(-6, -6, 12, 12);
        ctx.restore();
      }
      ctx.restore();
    }
    const blink = p.invulnTimer > 0 && Math.floor(world.state.time * 18) % 2 === 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    // engine flame
    const moving = Math.abs(p.vx) + Math.abs(p.vy) > 20;
    if (moving && !world.state.over) {
      const flame = 10 + Math.sin(world.state.time * 42) * 3.4;
      ctx.beginPath();
      ctx.moveTo(-PLAYER.radius + 2, -5);
      ctx.lineTo(-PLAYER.radius - flame, 0);
      ctx.lineTo(-PLAYER.radius + 2, 5);
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 170, 60, 0.85)';
      ctx.fill();
    }
    shipPath();
    ctx.shadowColor = COLORS.player;
    ctx.shadowBlur = blink ? 4 : 18;
    ctx.fillStyle = blink ? 'rgba(77, 243, 255, 0.35)' : '#0e3d4a';
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = COLORS.player;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(2, 0, 4.4, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.playerCore;
    ctx.fill();
    ctx.restore();
  }

  function shipPath() {
    ctx.beginPath();
    ctx.moveTo(PLAYER.radius + 5, 0);
    ctx.lineTo(-PLAYER.radius + 3, -PLAYER.radius);
    ctx.lineTo(-PLAYER.radius + 7, 0);
    ctx.lineTo(-PLAYER.radius + 3, PLAYER.radius);
    ctx.closePath();
  }

  function drawEnemy(enemy, time) {
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    const scale = enemy.spawnAnim > 0 ? 1 - enemy.spawnAnim / 0.35 * 0.6 : 1;
    ctx.scale(scale, scale);
    const flash = enemy.flash > 0;
    const fill = flash ? '#ffffff' : enemy.color;
    ctx.shadowColor = enemy.color;
    ctx.shadowBlur = flash ? 22 : 12;
    ctx.fillStyle = fill;
    ctx.strokeStyle = fill;
    const r = enemy.radius;
    const angleToPlayer = Math.atan2(enemy.vy, enemy.vx);
    switch (enemy.kind) {
      case 'chaser':
        ctx.rotate(angleToPlayer);
        poly([[-r, -r * 0.8], [r, 0], [-r, r * 0.8], [-r * 0.45, 0]]);
        break;
      case 'dart':
        ctx.rotate(angleToPlayer);
        poly([[-r, -r * 0.5], [r * 1.25, 0], [-r, r * 0.5]]);
        break;
      case 'splitter':
        ctx.rotate(time * 0.9 + enemy.wobble);
        ctx.fillRect(-r * 0.82, -r * 0.82, r * 1.64, r * 1.64);
        break;
      case 'mini':
        ctx.rotate(-time * 1.7 + enemy.wobble);
        ctx.fillRect(-r * 0.8, -r * 0.8, r * 1.6, r * 1.6);
        break;
      case 'orbiter':
        ctx.rotate(time * 1.4);
        poly([[0, -r], [r * 0.72, 0], [0, r], [-r * 0.72, 0]]);
        ctx.rotate(-time * 1.4);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2);
        ctx.fillStyle = flash ? '#fff' : '#f3e8ff';
        ctx.fill();
        break;
      case 'tank':
        ctx.rotate(time * 0.35);
        poly(hexPoints(r));
        ctx.rotate(-time * 0.35);
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.stroke();
        break;
      default:
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.fill();
    }
    if (enemy.kind === 'splitter' || enemy.kind === 'chaser') ctx.fill();
    ctx.restore();
    // health bar on the tougher kinds once hurt
    if ((enemy.kind === 'tank' || enemy.kind === 'splitter' || enemy.kind === 'orbiter')
      && enemy.hp < enemy.maxHp) {
      const w = enemy.radius * 2;
      const ratio = Math.max(0, enemy.hp / enemy.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 10, w, 4);
      ctx.fillStyle = enemy.color;
      ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 10, w * ratio, 4);
    }
    if (enemy.spawnAnim > 0) {
      ctx.save();
      ctx.globalAlpha = enemy.spawnAnim / 0.35 * 0.7;
      ctx.strokeStyle = enemy.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius + (0.35 - enemy.spawnAnim) * 60, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function poly(points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    ctx.fill();
  }

  function hexPoints(r) {
    const pts = [];
    for (let i = 0; i < 6; i += 1) {
      const a = (i * Math.PI) / 3;
      pts.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    return pts;
  }

  function drawWorld(world, time) {
    const { width, height } = world.state;
    ctx.save();
    if (world.shake > 0.2) {
      ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
    }
    drawBackground(width, height, time);
    // gems
    for (const gem of world.gems) {
      const s = 5 + Math.sin(gem.pulse) * 1.1 + gem.value; // bigger shards for bigger value
      ctx.save();
      ctx.translate(gem.x, gem.y);
      ctx.rotate(gem.pulse * 0.4);
      ctx.shadowColor = COLORS.gem;
      ctx.shadowBlur = 10;
      ctx.fillStyle = COLORS.gem;
      poly([[0, -s], [s * 0.66, 0], [0, s], [-s * 0.66, 0]]);
      ctx.restore();
    }
    // bullets
    ctx.save();
    ctx.lineCap = 'round';
    for (const bullet of world.bullets) {
      ctx.strokeStyle = COLORS.bullet;
      ctx.shadowColor = '#4df3ff';
      ctx.shadowBlur = 9;
      ctx.lineWidth = bullet.radius * 1.5;
      ctx.beginPath();
      ctx.moveTo(bullet.x - bullet.vx * 0.016, bullet.y - bullet.vy * 0.016);
      ctx.lineTo(bullet.x, bullet.y);
      ctx.stroke();
    }
    for (const bolt of world.enemyBullets) {
      ctx.beginPath();
      ctx.arc(bolt.x, bolt.y, bolt.radius, 0, Math.PI * 2);
      ctx.fillStyle = '#ff5df2';
      ctx.shadowColor = '#ff5df2';
      ctx.shadowBlur = 13;
      ctx.fill();
    }
    ctx.restore();
    for (const enemy of world.enemies) drawEnemy(enemy, time);
    if (!world.state.over) drawPlayer(world);
    // particles, additive
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const pt of world.particles) {
      const alpha = Math.max(0, pt.life / pt.maxLife);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size * alpha + 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // damage numbers
    ctx.save();
    ctx.textAlign = 'center';
    for (const f of world.floaters) {
      ctx.globalAlpha = Math.max(0, f.life / f.maxLife);
      ctx.font = `bold ${f.size}px ${FONT}`;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
    ctx.restore();
  }

  function bar(x, y, w, h, ratio, fill, back) {
    ctx.fillStyle = back;
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fill();
    if (ratio > 0) {
      ctx.fillStyle = fill;
      roundRect(ctx, x, y, Math.max(h, w * Math.min(1, ratio)), h, h / 2);
      ctx.fill();
    }
  }

  function drawHud(world, ui) {
    const { width } = world.state;
    const p = world.player;
    const s = world.state;
    // XP bar across the very top
    bar(0, 0, width, 7, p.xp / p.xpNext, COLORS.xpBar, 'rgba(61, 255, 200, 0.14)');
    // hull, top-left
    ctx.save();
    ctx.font = `bold 13px ${FONT}`;
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'left';
    ctx.fillText(`LV ${p.level}`, 16, 34);
    bar(16, 42, 190, 13, p.hp / p.maxHp, p.hp / p.maxHp < 0.3 ? '#ff2e4d' : COLORS.hpBar, COLORS.hpBarBack);
    ctx.font = `bold 11px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, 24, 52.5);
    // dash cooldown, under the hull bar
    const st = world.stats();
    const dashRatio = 1 - Math.max(0, p.dashCooldownTimer) / st.dashCooldown;
    bar(16, 61, 110, 6, dashRatio, '#4df3ff', 'rgba(77, 243, 255, 0.15)');
    ctx.fillStyle = COLORS.dimText;
    ctx.font = `11px ${FONT}`;
    ctx.fillText('DASH', 132, 68);
    // score, top-right
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold 24px ${FONT}`;
    ctx.fillText(String(Math.floor(s.score)).padStart(6, '0'), width - 16, 38);
    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = COLORS.dimText;
    ctx.fillText(`BEST ${Math.max(ui.best, Math.floor(s.score))}`, width - 16, 58);
    ctx.fillText(ui.muted ? 'SOUND OFF (M)' : 'SOUND ON (M)', width - 16, 76);
    // wave, top-center
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = `bold 17px ${FONT}`;
    ctx.fillText(`WAVE ${s.wave}`, width / 2, 34);
    ctx.font = `12px ${FONT}`;
    ctx.fillStyle = COLORS.dimText;
    const alive = world.enemies.length;
    ctx.fillText(`${alive} hostiles · ${Math.ceil(30 - s.waveTime)}s`, width / 2, 53);
    // wave banner
    if (ui.banner && ui.banner.time > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, ui.banner.time / 0.8);
      ctx.font = `bold 44px ${FONT}`;
      ctx.fillStyle = '#fff';
      ctx.shadowColor = '#ff4d8d';
      ctx.shadowBlur = 26;
      ctx.fillText(ui.banner.text, width / 2, world.state.height * 0.3);
      ctx.restore();
    }
    // low-hull warning vignette
    if (p.hp / p.maxHp < 0.3 && !s.over) {
      const pulse = 0.16 + 0.1 * Math.sin(s.time * 6);
      const grad = ctx.createRadialGradient(width / 2, world.state.height / 2, world.state.height * 0.36,
        width / 2, world.state.height / 2, world.state.height * 0.78);
      grad.addColorStop(0, 'rgba(255, 30, 60, 0)');
      grad.addColorStop(1, `rgba(255, 30, 60, ${pulse})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, world.state.height);
    }
    ctx.restore();
  }

  function centreText(text, y, font, color, glow = 0) {
    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    if (glow) {
      ctx.shadowColor = color;
      ctx.shadowBlur = glow;
    }
    ctx.fillText(text, canvas.width / 2, y);
    ctx.restore();
  }

  function drawTitle(world, ui) {
    drawBackground(world.state.width, world.state.height, ui.time);
    // drifting silhouettes for life behind the logo
    ctx.save();
    ctx.globalAlpha = 0.5;
    const t = ui.time;
    const shapes = [
      { x: (t * 23) % (world.state.width + 120) - 60, y: 120 + Math.sin(t * 0.7) * 16, r: 17, c: '#ff4d8d' },
      { x: world.state.width - ((t * 31) % (world.state.width + 120)) + 60, y: world.state.height - 170 + Math.cos(t * 0.9) * 14, r: 24, c: '#ffb347' },
      { x: (t * 17) % (world.state.width + 120) - 60, y: world.state.height - 90, r: 12, c: '#7dff5e' },
    ];
    for (const s of shapes) {
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(t * 0.8);
      ctx.fillStyle = s.c;
      ctx.fillRect(-s.r * 0.7, -s.r * 0.7, s.r * 1.4, s.r * 1.4);
      ctx.restore();
    }
    ctx.restore();
    const cx = world.state.width / 2;
    const cy = world.state.height / 2;
    ctx.save();
    ctx.textAlign = 'center';
    const grad = ctx.createLinearGradient(cx - 260, 0, cx + 260, 0);
    grad.addColorStop(0, '#4df3ff');
    grad.addColorStop(0.5, '#b18cff');
    grad.addColorStop(1, '#ff4d8d');
    ctx.font = `900 84px ${FONT}`;
    ctx.shadowColor = '#4df3ff';
    ctx.shadowBlur = 34;
    ctx.fillStyle = grad;
    ctx.fillText('PRISMSTORM', cx, cy - 88);
    ctx.shadowBlur = 0;
    ctx.font = `600 19px ${FONT}`;
    ctx.fillStyle = COLORS.text;
    ctx.fillText('a neon arena survival', cx, cy - 48);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = COLORS.dimText;
    ctx.fillText('WASD / arrows — move      mouse — aim      hold click or Space — fire', cx, cy + 28);
    ctx.fillText('Shift — dash (briefly untouchable)      P — pause      M — sound', cx, cy + 54);
    ctx.fillText('Survive the waves. Gather XP shards. Choose your upgrades. Beat your best.', cx, cy + 80);
    if (Math.floor(ui.time * 1.6) % 2 === 0) {
      ctx.font = `bold 22px ${FONT}`;
      ctx.fillStyle = '#3dffc8';
      ctx.shadowColor = '#3dffc8';
      ctx.shadowBlur = 14;
      ctx.fillText('CLICK OR PRESS ENTER TO LAUNCH', cx, cy + 132);
      ctx.shadowBlur = 0;
    }
    if (ui.best > 0) {
      ctx.font = `bold 15px ${FONT}`;
      ctx.fillStyle = '#ffd76a';
      ctx.fillText(`BEST SCORE ${ui.best}`, cx, cy + 168);
    }
    ctx.restore();
  }

  function drawLevelUp(world, ui) {
    drawWorld(world, world.state.time);
    const { width, height } = world.state;
    ctx.fillStyle = 'rgba(3, 4, 14, 0.72)';
    ctx.fillRect(0, 0, width, height);
    centreText(`LEVEL ${world.player.level}`, height / 2 - 128, `900 40px ${FONT}`, '#3dffc8', 20);
    centreText('choose an upgrade — click a card or press 1, 2, 3', height / 2 - 92, `15px ${FONT}`, COLORS.text);
    const rects = upgradeCardRects(width, height);
    ui.choices.forEach((choice, i) => {
      const r = rects[i];
      const hover = i === ui.hoverChoice;
      ctx.save();
      roundRect(ctx, r.x, r.y, r.w, r.h, 14);
      ctx.fillStyle = hover ? 'rgba(28, 52, 84, 0.97)' : 'rgba(13, 20, 44, 0.97)';
      ctx.fill();
      ctx.lineWidth = hover ? 3 : 2;
      ctx.strokeStyle = hover ? '#3dffc8' : 'rgba(99, 179, 255, 0.55)';
      ctx.shadowColor = hover ? '#3dffc8' : 'transparent';
      ctx.shadowBlur = hover ? 18 : 0;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.textAlign = 'center';
      ctx.fillStyle = '#4df3ff';
      ctx.font = `bold 21px ${FONT}`;
      ctx.fillText(choice.name, r.x + r.w / 2, r.y + 52);
      ctx.fillStyle = COLORS.text;
      ctx.font = `14.5px ${FONT}`;
      wrapText(choice.desc, r.x + r.w / 2, r.y + 84, r.w - 28, 19);
      const taken = world.player.counts[choice.id] ?? 0;
      ctx.fillStyle = '#ffd76a';
      ctx.font = `bold 13px ${FONT}`;
      ctx.fillText('●'.repeat(taken) + '○'.repeat(choice.max - taken), r.x + r.w / 2, r.y + 122);
      ctx.fillStyle = COLORS.dimText;
      ctx.font = `bold 12px ${FONT}`;
      ctx.fillText(`[ ${i + 1} ]`, r.x + r.w / 2, r.y + r.h - 14);
      ctx.restore();
    });
  }

  function wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineHeight;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }

  function drawPaused(world) {
    drawWorld(world, world.state.time);
    const { width, height } = world.state;
    ctx.fillStyle = 'rgba(3, 4, 14, 0.62)';
    ctx.fillRect(0, 0, width, height);
    centreText('PAUSED', height / 2 - 6, `900 52px ${FONT}`, '#d9f6ff', 18);
    centreText('P or Esc to resume', height / 2 + 32, `15px ${FONT}`, COLORS.dimText);
  }

  function drawOver(world, ui) {
    drawWorld(world, world.state.time);
    const { width, height } = world.state;
    ctx.fillStyle = 'rgba(10, 2, 8, 0.66)';
    ctx.fillRect(0, 0, width, height);
    const cx = width / 2;
    const cy = height / 2;
    centreText('SHIP DOWN', cy - 118, `900 58px ${FONT}`, '#ff5470', 26);
    const s = world.state;
    const isBest = Math.floor(s.score) >= ui.best && s.score > 0;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = `bold 34px ${FONT}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(`SCORE ${Math.floor(s.score)}`, cx, cy - 58);
    if (isBest) {
      ctx.font = `bold 16px ${FONT}`;
      ctx.fillStyle = '#ffd76a';
      ctx.fillText('★ NEW BEST ★', cx, cy - 30);
    }
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = COLORS.text;
    const minutes = Math.floor(s.time / 60);
    const seconds = String(Math.floor(s.time % 60)).padStart(2, '0');
    ctx.fillText(`wave ${s.wave}   ·   kills ${s.kills}   ·   level ${world.player.level}   ·   survived ${minutes}:${seconds}`, cx, cy + 6);
    ctx.fillText(`best ${Math.max(ui.best, Math.floor(s.score))}`, cx, cy + 34);
    if (Math.floor(ui.time * 1.6) % 2 === 0) {
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillStyle = '#3dffc8';
      ctx.shadowColor = '#3dffc8';
      ctx.shadowBlur = 12;
      ctx.fillText('PRESS R OR CLICK TO FLY AGAIN', cx, cy + 88);
      ctx.shadowBlur = 0;
    }
    ctx.restore();
  }

  function draw(world, ui) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    switch (ui.screen) {
      case SCREEN_TITLE:
        drawTitle(world, ui);
        break;
      case SCREEN_LEVELUP:
        drawLevelUp(world, ui);
        break;
      case SCREEN_PAUSED:
        drawPaused(world);
        drawHud(world, ui);
        break;
      case SCREEN_OVER:
        drawOver(world, ui);
        drawHud(world, ui);
        break;
      default:
        drawWorld(world, world.state.time);
        drawHud(world, ui);
    }
  }

  resize(1280, 800);
  return { draw, resize };
}
