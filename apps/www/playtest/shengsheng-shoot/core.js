// Scene values recovered from the purchased Godot project; units are Godot pixels.
export const RULES = Object.freeze({
  playerSpeed: 100, enemySpeed: 50, bulletSpeed: 300, fireInterval: 0.5,
  bulletLifetime: 3, spread: 20, playerRadius: 7.07107, enemyRadius: 10.770329,
  spawnInitial: 3, spawnMinimum: 1, spawnRamp: 0.2,
});
export const WIN_SCORE = 1000;
export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export function createGame() {
  return { time: 0, score: 0, over: false, victory: false, player: { x: -172, y: 83, moving: false },
    bullets: [], enemies: [], fireLeft: 0.5, spawnLeft: 3, nextId: 0, events: [] };
}
function bulletHits(bullet, enemy) {
  const dx = Math.max(Math.abs(bullet.x + 1 - enemy.x) - 3.5, 0);
  const dy = Math.max(Math.abs(bullet.y - 1 - enemy.y - 10) - 3, 0);
  return dx * dx + dy * dy <= RULES.enemyRadius ** 2;
}
export function step(game, dt, input = { x: 0, y: 0 }, random = Math.random) {
  game.events = [];
  if (game.over) return;
  game.time += dt;
  const player = game.player;
  const length = Math.hypot(input.x, input.y);
  const magnitude = Math.max(1, length);
  player.moving = length > 0.03;
  if (player.moving) {
    player.x = clamp(player.x + input.x / magnitude * RULES.playerSpeed * dt,
      -237 + RULES.playerRadius, 237 - RULES.playerRadius);
    player.y = clamp(player.y + input.y / magnitude * RULES.playerSpeed * dt,
      38 + RULES.playerRadius - 6, 132 - RULES.playerRadius - 6);
  }
  game.fireLeft -= dt;
  if (game.fireLeft <= 0) {
    game.fireLeft += RULES.fireInterval;
    if (!player.moving) {
      for (const degrees of [-RULES.spread, 0, RULES.spread]) {
        const angle = degrees * Math.PI / 180;
        game.bullets.push({ x: player.x + 6, y: player.y + 6,
          vx: Math.cos(angle) * RULES.bulletSpeed, vy: Math.sin(angle) * RULES.bulletSpeed,
          life: RULES.bulletLifetime });
      }
      game.events.push('shot');
    }
  }
  game.spawnLeft -= dt;
  if (game.spawnLeft <= 0) {
    game.enemies.push({ id: game.nextId++, x: 260, y: 40 + random() * 70, age: 0, dead: false, deathAge: 0 });
    game.spawnLeft += Math.max(RULES.spawnMinimum, RULES.spawnInitial - RULES.spawnRamp * game.time);
  }
  for (const bullet of game.bullets) {
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;
  }
  for (const enemy of game.enemies) {
    enemy.age += dt;
    if (enemy.dead) { enemy.deathAge += dt; continue; }
    enemy.x -= RULES.enemySpeed * dt;
    for (const bullet of game.bullets) {
      if (bullet.life > 0 && bulletHits(bullet, enemy)) {
        enemy.dead = true;
        bullet.life = 0;
        game.score++;
        game.events.push('hit');
        if (!game.victory && game.score >= WIN_SCORE) {
          game.victory = true;
          game.events.push('win');
        }
        break; // One enemy grants one point, including during its death animation.
      }
    }
    if (game.events.includes('win')) break;
    if (!enemy.dead && Math.hypot(enemy.x - player.x, enemy.y + 10 - player.y - 6)
      <= RULES.enemyRadius + RULES.playerRadius) {
      game.over = true;
      player.moving = false;
      game.events.push('over');
      break;
    }
  }
  game.bullets = game.bullets.filter(b => b.life > 0);
  game.enemies = game.enemies.filter(e => e.x > -270 && (!e.dead || e.deathAge < 0.6));
}
