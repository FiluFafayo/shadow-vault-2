// Shadow Vault — staged screenshot scenes. Each one plays the real rules
// forward from a fresh world for a fixed time, steered by a simple
// autopilot (grid path to the nearest gem, wait when the next step is
// inside a guard's cone, flee when spotted), so the frame is what a real
// game looks like and the same scene always gives the same frame.

import { World, STEP, EVENT_LEVEL_CLEAR, EVENT_CAUGHT, findPath } from './world.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_CAUGHT, SCREEN_CLEAR } from './render.js';
import { TILE, COLS, ROWS, CONE_RANGE, CONE_HALF_ANGLE } from './config.js';
import { segmentBlocked } from './world.js';

const START_SECONDS = 6;
const PLAY_SECONDS = 34;
const ALARM_SECONDS = 14;
const END_LIMIT_SECONDS = 300;

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

/** Would guard g see a player standing at pixel (x, y)? */
function guardSeesPoint(world, g, x, y) {
  const d = Math.hypot(g.x - x, g.y - y);
  if (d > CONE_RANGE) return false;
  const toPoint = Math.atan2(y - g.y, x - g.x);
  let diff = toPoint - g.facing;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > CONE_HALF_ANGLE) return false;
  return !segmentBlocked(g.x, g.y, x, y, world.solids);
}

/** Is any guard's cone covering tile (col, row) right now? */
function tileInCone(world, col, row) {
  const x = col * TILE + TILE / 2;
  const y = row * TILE + TILE / 2;
  for (const g of world.guards) {
    if (guardSeesPoint(world, g, x, y)) return true;
  }
  return false;
}

/**
 * Autopilot state: a path to the current goal, a wait timer for cones,
 * and a set of tiles to avoid after waiting too long.
 */
export function makePilot() {
  return { path: null, pathIndex: 0, goalKind: null, goalId: null, wait: 0, avoid: new Map(), stuck: 0, lastDist: Infinity, nextReplan: 0, fleeDir: null, fleeUntil: 0, fleePos: { x: 0, y: 0, at: 0 } };
}

/** Best escape direction: of 8 ways to run, the one that ends up farthest
 * from every guard, on a walkable tile outside every vision cone. The probe
 * looks 150 px ahead so a direction that dead-ends at a wall is rejected. */
function escapeDirection(world) {
  const p = world.player;
  let best = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 8; i += 1) {
    const angle = (i / 8) * Math.PI * 2;
    const x = p.x + Math.cos(angle) * 90;
    const y = p.y + Math.sin(angle) * 90;
    const farX = p.x + Math.cos(angle) * 150;
    const farY = p.y + Math.sin(angle) * 150;
    const col = Math.floor(x / TILE);
    const row = Math.floor(y / TILE);
    const farCol = Math.floor(farX / TILE);
    const farRow = Math.floor(farY / TILE);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) continue;
    if (farCol < 0 || farCol >= COLS || farRow < 0 || farRow >= ROWS) continue;
    if (world.blockedGrid[row][col] || world.blockedGrid[farRow][farCol]) continue;
    if (tileInCone(world, col, row) || tileInCone(world, farCol, farRow)) continue;
    let score = Infinity;
    for (const g of world.guards) {
      score = Math.min(score, Math.hypot(g.x - x, g.y - y));
    }
    if (score > bestScore) {
      bestScore = score;
      best = { x: Math.cos(angle), y: Math.sin(angle) };
    }
  }
  return best;
}

/** Escape move with hysteresis: once we pick a way to run, we keep it for a
 * second instead of flip-flopping as the cones sweep — unless it stops
 * making progress (ran into a wall), in which case we pick again at once. */
function fleeMove(world, pilot) {
  if (pilot.fleeDir && world.time < pilot.fleeUntil) {
    const since = world.time - pilot.fleePos.at;
    if (since < 0.15) return { x: pilot.fleeDir.x, y: pilot.fleeDir.y, sneak: false };
    const moved = Math.hypot(world.player.x - pilot.fleePos.x, world.player.y - pilot.fleePos.y);
    if (moved >= 3) {
      // Making progress: slide the checkpoint forward and keep running.
      pilot.fleePos = { x: world.player.x, y: world.player.y, at: world.time };
      return { x: pilot.fleeDir.x, y: pilot.fleeDir.y, sneak: false };
    }
    // Ran into a wall: pick a new way out at once.
  }
  const dir = escapeDirection(world);
  if (dir) {
    pilot.fleeDir = dir;
    pilot.fleeUntil = world.time + 1.0;
    pilot.fleePos = { x: world.player.x, y: world.player.y, at: world.time };
    return { x: dir.x, y: dir.y, sneak: false };
  }
  pilot.fleeDir = null;
  return null;
}

/** Next move for the autopilot: {x, y, sneak} in [-1, 1], or {0, 0} to wait. */
export function autopilot(world, pilot) {
  const p = world.player;
  if (world.alarm) {
    // Flee: run the way that puts the most distance between us and every guard.
    const flee = fleeMove(world, pilot);
    if (flee) return flee;
    let nearest = null;
    let nearestD = Infinity;
    for (const g of world.guards) {
      const d = Math.hypot(g.x - p.x, g.y - p.y);
      if (d < nearestD) { nearestD = d; nearest = g; }
    }
    if (nearest) {
      const dx = p.x - nearest.x;
      const dy = p.y - nearest.y;
      const len = Math.hypot(dx, dy) || 1;
      return { x: dx / len, y: dy / len, sneak: false };
    }
    return { x: 0, y: 0, sneak: false };
  }
  // Spotted and the meter is climbing: break away at full speed, away from
  // the guard that sees us. Sneaking away is slower than a chasing guard.
  if (world.detection > 25) {
    const flee = fleeMove(world, pilot);
    if (flee) return flee;
    for (const g of world.guards) {
      if (world.guardSees(g)) {
        const dx = p.x - g.x;
        const dy = p.y - g.y;
        const len = Math.hypot(dx, dy) || 1;
        return { x: dx / len, y: dy / len, sneak: false };
      }
    }
  }
  // Pick a goal: nearest gem, or the exit once all are stolen.
  pilot.fleeDir = null;
  let goal = null;
  let goalKind = 'exit';
  let goalId = null;
  if (world.artifactsLeft > 0) {
    let bestD = Infinity;
    for (const a of world.artifacts) {
      if (a.taken) continue;
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d < bestD) { bestD = d; goal = a; goalKind = 'gem'; goalId = a.id; }
    }
  } else {
    goal = world.exit;
  }
  if (!goal) return { x: 0, y: 0, sneak: false };
  // Drop avoid-marks older than a few seconds: cones move, so must the plan.
  for (const [key, at] of pilot.avoid) {
    if (world.time - at > 4) pilot.avoid.delete(key);
  }
  const blockedNow = (c, r) => pilot.avoid.has(r * COLS + c) || tileInCone(world, c, r);
  if (pilot.goalKind !== goalKind || pilot.goalId !== goalId || !pilot.path) {
    pilot.goalKind = goalKind;
    pilot.goalId = goalId;
    pilot.path = findPath(world, p.x, p.y, goal.x, goal.y, blockedNow);
    pilot.pathIndex = 0;
    pilot.wait = 0;
    pilot.stuck = 0;
    pilot.lastDist = Infinity;
  }
  if (!pilot.path) {
    // No safe route right now: wait where we are and try again next step.
    pilot.path = null;
    return { x: 0, y: 0, sneak: true };
  }
  if (pilot.pathIndex >= pilot.path.length) {
    if (Math.hypot(goal.x - p.x, goal.y - p.y) > 30) {
      pilot.path = null; // path ran out short of the goal: plan again
      return autopilot(world, pilot);
    }
    return { x: 0, y: 0, sneak: false };
  }
  const next = pilot.path[pilot.pathIndex];
  const dx = next.x - p.x;
  const dy = next.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 8) {
    pilot.pathIndex += 1;
    pilot.wait = 0;
    pilot.stuck = 0;
    pilot.lastDist = Infinity;
    return autopilot(world, pilot);
  }
  // Do not step into a cone: wait for the patrol to move on. If the wait
  // drags on, try routing around the watched tile — but only when another
  // route exists; a doorway with no alternative is worth waiting for.
  // (Checked before the stuck test: waiting is not being stuck.)
  const col = clamp(Math.floor(next.x / TILE), 0, COLS - 1);
  const row = clamp(Math.floor(next.y / TILE), 0, ROWS - 1);
  if (tileInCone(world, col, row)) {
    pilot.wait += STEP;
    pilot.stuck = 0;
    pilot.lastDist = Infinity;
    if (pilot.wait > 2.5) {
      pilot.avoid.set(row * COLS + col, world.time);
      const retry = findPath(world, p.x, p.y, goal.x, goal.y, blockedNow);
      if (retry) {
        pilot.path = retry;
        pilot.pathIndex = 0;
        pilot.stuck = 0;
        pilot.lastDist = Infinity;
      } else {
        pilot.avoid.delete(row * COLS + col);
      }
      pilot.wait = 0;
    }
    return { x: 0, y: 0, sneak: true };
  }
  pilot.wait = 0;
  // Stuck against a corner: skip this waypoint and carry on.
  if (d > pilot.lastDist - 0.5) {
    pilot.stuck += STEP;
    if (pilot.stuck > 0.9) {
      pilot.pathIndex += 1;
      pilot.stuck = 0;
      pilot.lastDist = Infinity;
      return autopilot(world, pilot);
    }
  } else {
    pilot.stuck = 0;
  }
  pilot.lastDist = d;
  // Close to a guard, move quietly: sneaking shrinks the noise ring and
  // halves how fast the detection meter fills.
  let nearestD = Infinity;
  for (const g of world.guards) {
    nearestD = Math.min(nearestD, Math.hypot(g.x - p.x, g.y - p.y));
  }
  return { x: dx / d, y: dy / d, sneak: nearestD < 260 };
}

/** Run the world forward with the autopilot for up to `seconds`. */
function simulate(world, seconds, stopWhen) {
  const pilot = makePilot();
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const move = autopilot(world, pilot);
    world.step(STEP, move.x, move.y, move.sneak);
    if (stopWhen && stopWhen(world)) break;
  }
}

/** Walk to a pixel point along the tile grid, routing around walls. */
function makeWalker(world, toX, toY) {
  const path = findPath(world, world.player.x, world.player.y, toX, toY, null);
  return { path, index: 0 };
}

function walkStep(world, walker) {
  if (!walker.path || walker.index >= walker.path.length) return { x: 0, y: 0, sneak: false };
  const p = world.player;
  const next = walker.path[walker.index];
  const dx = next.x - p.x;
  const dy = next.y - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 8) {
    walker.index += 1;
    return walkStep(world, walker);
  }
  return { x: dx / d, y: dy / d, sneak: false };
}

/**
 * Set `world` to the named scene and return the screen to draw over it
 * and the bonus score to show. Scenes: start, play, alarm, end.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'alarm' && name !== 'end') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, 0, 0, false);
    return { screen: SCREEN_TITLE, bonus: 0 };
  }
  if (name === 'alarm') {
    // Ambush: walk onto the top guard's patrol lane and stand still in
    // their cone until the alarm trips, then flee for a couple of seconds
    // so the frame shows red cones converging.
    const pilot = makePilot();
    const ambushX = 13 * TILE + TILE / 2;
    const ambushY = 3 * TILE + TILE / 2;
    const walker = makeWalker(world, ambushX, ambushY);
    let alarmedAt = -1;
    for (let i = 0; i < ALARM_SECONDS / STEP; i += 1) {
      let move;
      if (!world.alarm) {
        const dx = ambushX - world.player.x;
        const dy = ambushY - world.player.y;
        move = Math.hypot(dx, dy) < 10 ? { x: 0, y: 0, sneak: false } : walkStep(world, walker);
      } else {
        if (alarmedAt < 0) alarmedAt = i;
        move = autopilot(world, pilot);
      }
      world.step(STEP, move.x, move.y, move.sneak);
      if (alarmedAt >= 0 && i - alarmedAt > 1.2 / STEP) break;
    }
    return { screen: SCREEN_PLAY, bonus: 0 };
  }
  if (name === 'end') {
    simulate(world, END_LIMIT_SECONDS, (w) => w.levelClear || w.caught);
    if (world.levelClear) return { screen: SCREEN_CLEAR, bonus: 0 };
    return { screen: world.caught ? SCREEN_CAUGHT : SCREEN_PLAY, bonus: 0 };
  }
  simulate(world, PLAY_SECONDS, (w) => w.artifactsLeft <= 1 || w.levelClear || w.caught);
  return { screen: SCREEN_PLAY, bonus: 0 };
}

export { World };
