// Shadow Vault — world simulation: player, guards, vision, detection, noise.
// Pure logic, no drawing and no DOM: render.js draws a World, shots.js drives one.

import {
  TILE, COLS, ROWS, LEVELS, parseLevel,
  PLAYER_WALK_SPEED, PLAYER_SNEAK_SPEED,
  GUARD_PATROL_SPEED, GUARD_SUSPICIOUS_SPEED, GUARD_CHASE_SPEED,
  CONE_RANGE, CONE_HALF_ANGLE,
  DETECT_RATE_CLOSE, DETECT_RATE_FAR, DETECT_DECAY, SNEAK_DETECT_FACTOR,
  ALARM_COOLDOWN_SECONDS, NOISE_WALK_RADIUS, NOISE_SNEAK_RADIUS,
} from './config.js';

export const STEP = 1 / 60;
export const EVENT_CAUGHT = 1;
export const EVENT_ARTIFACT = 2;
export const EVENT_LEVEL_CLEAR = 4;
export const EVENT_ALARM = 8;
export const EVENT_NOISE = 16;

const PLAYER_RADIUS = 13;
const GUARD_RADIUS = 13;
const ARTIFACT_RADIUS = 15;
const EXIT_RADIUS = 26;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** True when the segment (x1,y1)-(x2,y2) touches any blocking rectangle. */
export function segmentBlocked(x1, y1, x2, y2, solids) {
  for (let i = 0; i < solids.length; i += 1) {
    if (segmentHitsRect(x1, y1, x2, y2, solids[i])) return true;
  }
  return false;
}

function segmentHitsRect(x1, y1, x2, y2, r) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  if (maxX < r.x || minX > r.x + r.w || maxY < r.y || minY > r.y + r.h) return false;
  if (pointInRect(x1, y1, r) || pointInRect(x2, y2, r)) return true;
  const dx = x2 - x1;
  const dy = y2 - y1;
  // Slab test: find where the segment crosses the rect's x and y spans.
  let tmin = 0;
  let tmax = 1;
  if (dx === 0) {
    if (x1 < r.x || x1 > r.x + r.w) return false;
  } else {
    let t1 = (r.x - x1) / dx;
    let t2 = (r.x + r.w - x1) / dx;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  if (dy === 0) {
    if (y1 < r.y || y1 > r.y + r.h) return false;
  } else {
    let t1 = (r.y - y1) / dy;
    let t2 = (r.y + r.h - y1) / dy;
    if (t1 > t2) { const t = t1; t1 = t2; t2 = t; }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return false;
  }
  return true;
}

function pointInRect(x, y, r) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

/** Circle-vs-solids slide: move x then y, stopping at blocking rects. */
function moveCircle(body, dx, dy, solids) {
  const nx = body.x + dx;
  let blockedX = false;
  for (let i = 0; i < solids.length; i += 1) {
    if (circleHitsRect(nx, body.y, PLAYER_RADIUS, solids[i])) { blockedX = true; break; }
  }
  if (!blockedX) body.x = nx;
  const ny = body.y + dy;
  let blockedY = false;
  for (let i = 0; i < solids.length; i += 1) {
    if (circleHitsRect(body.x, ny, PLAYER_RADIUS, solids[i])) { blockedY = true; break; }
  }
  if (!blockedY) body.y = ny;
}

function circleHitsRect(cx, cy, radius, r) {
  const qx = clamp(cx, r.x, r.x + r.w);
  const qy = clamp(cy, r.y, r.y + r.h);
  const dx = cx - qx;
  const dy = cy - qy;
  return dx * dx + dy * dy < radius * radius;
}

/** Breadth-first path on the tile grid between two pixel points; null when none. */
export function findPath(world, fromX, fromY, toX, toY, extraBlocked) {
  const startCol = clamp(Math.floor(fromX / TILE), 0, COLS - 1);
  const startRow = clamp(Math.floor(fromY / TILE), 0, ROWS - 1);
  const goalCol = clamp(Math.floor(toX / TILE), 0, COLS - 1);
  const goalRow = clamp(Math.floor(toY / TILE), 0, ROWS - 1);
  const blocked = world.blockedGrid;
  const key = (c, r) => r * COLS + c;
  const prev = new Map();
  const queue = [[startCol, startRow]];
  prev.set(key(startCol, startRow), null);
  while (queue.length > 0) {
    const [c, r] = queue.shift();
    if (c === goalCol && r === goalRow) break;
    const neighbours = [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]];
    for (let i = 0; i < neighbours.length; i += 1) {
      const [nc, nr] = neighbours[i];
      if (nc < 0 || nc >= COLS || nr < 0 || nr >= ROWS) continue;
      if (blocked[nr][nc]) continue;
      if (extraBlocked && extraBlocked(nc, nr)) continue;
      const k = key(nc, nr);
      if (prev.has(k)) continue;
      prev.set(k, [c, r]);
      queue.push([nc, nr]);
    }
  }
  if (!prev.has(key(goalCol, goalRow))) return null;
  const cells = [];
  let cur = [goalCol, goalRow];
  while (cur !== null) {
    cells.unshift(cur);
    cur = prev.get(key(cur[0], cur[1]));
  }
  return cells.map(([c, r]) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 }));
}

export class World {
  constructor(levelIndex) {
    this.levelIndex = levelIndex;
    this.level = LEVELS[levelIndex];
    const parsed = parseLevel(this.level);
    this.walls = parsed.walls;
    this.cover = parsed.cover;
    this.solids = this.walls.concat(this.cover);
    this.artifacts = parsed.artifacts.map((a) => ({ ...a }));
    this.start = parsed.start;
    this.exit = parsed.exit;
    this.blockedGrid = [];
    for (let r = 0; r < ROWS; r += 1) {
      this.blockedGrid.push([]);
      for (let c = 0; c < COLS; c += 1) {
        const ch = this.level.map[r][c];
        this.blockedGrid[r].push(ch === '#' || ch === 'C' || ch === 'O' || ch === 'P');
      }
    }
    this.reset();
  }

  reset() {
    this.player = {
      x: this.start.x, y: this.start.y, facing: -Math.PI / 2,
      moving: false, sneaking: false, noiseRadius: 0,
    };
    this.guards = this.level.guards.map((g, index) => {
      const [c, r] = g.patrol[0];
      return {
        index,
        x: c * TILE + TILE / 2, y: r * TILE + TILE / 2,
        facing: 0, state: 'patrol', waypoint: 1, pauseLeft: 0,
        patrol: g.patrol, pause: g.pause,
        targetX: c * TILE + TILE / 2, targetY: r * TILE + TILE / 2,
        seenX: null, seenY: null, seenTime: -99,
        stuck: 0, lastDist: Infinity,
      };
    });
    this.artifacts.forEach((a) => { a.taken = false; });
    this.detection = 0;
    this.alarm = false;
    this.alarmUnseen = 0;
    this.time = 0;
    this.score = 0;
    this.ghost = true; // never spotted so far
    this.caught = false;
    this.levelClear = false;
    this.noiseTimer = 0;
    this.noisePulse = 0;
    this.events = 0;
  }

  get artifactsLeft() {
    let n = 0;
    for (const a of this.artifacts) if (!a.taken) n += 1;
    return n;
  }

  /** Does guard g currently see the player (cone + range + line of sight)? */
  guardSees(g) {
    const d = dist(g.x, g.y, this.player.x, this.player.y);
    if (d > CONE_RANGE) return false;
    const toPlayer = angleTo(g.x, g.y, this.player.x, this.player.y);
    if (Math.abs(angleDiff(toPlayer, g.facing)) > CONE_HALF_ANGLE) return false;
    if (segmentBlocked(g.x, g.y, this.player.x, this.player.y, this.solids)) return false;
    return true;
  }

  /** Detection rate for a guard that sees the player right now. */
  detectRate(g) {
    const d = dist(g.x, g.y, this.player.x, this.player.y);
    const near = 1 - d / CONE_RANGE; // 1 point blank, 0 at the edge
    let rate = DETECT_RATE_FAR + (DETECT_RATE_CLOSE - DETECT_RATE_FAR) * near;
    if (this.player.sneaking) rate *= SNEAK_DETECT_FACTOR;
    if (this.player.moving) rate *= 1.25;
    return rate;
  }

  step(dt, moveX, moveY, sneak) {
    if (this.caught || this.levelClear) return 0;
    this.time += dt;
    this.events = 0;
    const p = this.player;
    p.sneaking = sneak;
    const speed = sneak ? PLAYER_SNEAK_SPEED : PLAYER_WALK_SPEED;
    const len = Math.hypot(moveX, moveY);
    p.moving = len > 0;
    if (len > 0) {
      const nx = (moveX / len) * speed * dt;
      const ny = (moveY / len) * speed * dt;
      moveCircle(p, nx, ny, this.solids);
      p.facing = Math.atan2(moveY, moveX);
    }
    p.noiseRadius = p.moving ? (sneak ? NOISE_SNEAK_RADIUS : NOISE_WALK_RADIUS) : 0;

    // Noise pulses: a moving player regularly pings nearby guards.
    this.noiseTimer -= dt;
    this.noisePulse = Math.max(0, this.noisePulse - dt * 2.2);
    if (p.moving && this.noiseTimer <= 0) {
      this.noiseTimer = 0.45;
      this.noisePulse = 1;
      for (const g of this.guards) {
        if (g.state === 'patrol' && dist(g.x, g.y, p.x, p.y) < p.noiseRadius) {
          g.state = 'suspicious';
          g.targetX = p.x;
          g.targetY = p.y;
          this.events |= EVENT_NOISE;
        }
      }
    }

    // Vision: any guard seeing the player raises the shared detection meter.
    let seen = false;
    for (const g of this.guards) {
      if (this.guardSees(g)) {
        seen = true;
        g.seenX = p.x;
        g.seenY = p.y;
        g.seenTime = this.time;
        this.detection += this.detectRate(g) * dt;
        if (this.detection >= 100) {
          this.detection = 100;
          if (!this.alarm) {
            this.alarm = true;
            this.alarmUnseen = 0;
            this.ghost = false;
            this.events |= EVENT_ALARM;
          }
        }
      }
    }
    if (!seen) this.detection = Math.max(0, this.detection - DETECT_DECAY * dt);
    if (this.alarm) {
      if (seen) this.alarmUnseen = 0;
      else {
        this.alarmUnseen += dt;
        if (this.alarmUnseen > ALARM_COOLDOWN_SECONDS) {
          this.alarm = false;
          this.detection = 55;
        }
      }
    }

    // Guards move: patrol, investigate, or chase the last seen spot.
    for (const g of this.guards) this.stepGuard(g, dt, seen);

    // Caught: a chasing guard reaches the player.
    for (const g of this.guards) {
      if (g.state === 'chase' && dist(g.x, g.y, p.x, p.y) < GUARD_RADIUS + PLAYER_RADIUS - 2) {
        this.caught = true;
        this.events |= EVENT_CAUGHT;
        return this.events;
      }
    }

    // Artifacts: pick up by walking over them.
    for (const a of this.artifacts) {
      if (!a.taken && dist(p.x, p.y, a.x, a.y) < ARTIFACT_RADIUS + PLAYER_RADIUS) {
        a.taken = true;
        this.score += 500;
        this.events |= EVENT_ARTIFACT;
      }
    }

    // Exit: open once every artifact is stolen.
    if (this.artifactsLeft === 0 && dist(p.x, p.y, this.exit.x, this.exit.y) < EXIT_RADIUS) {
      this.levelClear = true;
      const timeBonus = Math.max(0, Math.round((this.level.parSeconds - this.time) * 10));
      this.score += timeBonus + (this.ghost ? 400 : 0);
      this.events |= EVENT_LEVEL_CLEAR;
    }
    return this.events;
  }

  stepGuard(g, dt, playerSeen) {
    if (this.alarm) g.state = 'chase';
    else if (g.state === 'chase') g.state = 'suspicious';
    let speed = GUARD_PATROL_SPEED;
    let tx;
    let ty;
    if (g.state === 'chase') {
      speed = GUARD_CHASE_SPEED;
      tx = g.seenX !== null ? g.seenX : this.player.x;
      ty = g.seenY !== null ? g.seenY : this.player.y;
    } else if (g.state === 'suspicious') {
      speed = GUARD_SUSPICIOUS_SPEED;
      tx = g.targetX;
      ty = g.targetY;
    } else {
      const [c, r] = g.patrol[g.waypoint];
      tx = c * TILE + TILE / 2;
      ty = r * TILE + TILE / 2;
    }
    const dx = tx - g.x;
    const dy = ty - g.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) {
      if (g.state === 'patrol') {
        if (g.pauseLeft <= 0) g.pauseLeft = g.pause;
        g.pauseLeft -= dt;
        if (g.pauseLeft <= 0) {
          g.waypoint = (g.waypoint + 1) % g.patrol.length;
          g.pauseLeft = 0;
        }
      } else if (g.state === 'suspicious') {
        g.state = 'patrol';
        // Resume from the nearest waypoint.
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i < g.patrol.length; i += 1) {
          const [c, r] = g.patrol[i];
          const dd = dist(g.x, g.y, c * TILE + TILE / 2, r * TILE + TILE / 2);
          if (dd < bestD) { bestD = dd; best = i; }
        }
        g.waypoint = best;
      } else {
        g.seenX = null;
        g.seenY = null;
      }
      return;
    }
    if (g.state === 'patrol' && g.pauseLeft > 0) {
      g.pauseLeft -= dt;
      return;
    }
    const step = Math.min(d, speed * dt);
    // Stuck against something the patrol did not expect: skip ahead.
    if (d > g.lastDist - 0.5) {
      g.stuck += dt;
      if (g.stuck > 1.2) {
        g.stuck = 0;
        g.lastDist = Infinity;
        if (g.state === 'patrol') g.waypoint = (g.waypoint + 1) % g.patrol.length;
        else if (g.state === 'suspicious') g.state = 'patrol';
        else { g.seenX = null; g.seenY = null; }
        return;
      }
    } else {
      g.stuck = 0;
    }
    g.lastDist = d;
    const mx = (dx / d) * step;
    const my = (dy / d) * step;
    moveCircle(g, mx, my, this.solids);
    g.facing = Math.atan2(dy, dx);
  }
}
