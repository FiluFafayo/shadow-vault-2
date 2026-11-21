// Shadow Vault — canvas rendering: the museum floor, cover, vision cones,
// guards, the thief, artifacts, the exit, the HUD and every screen.

import { TILE, COLS, ROWS, VIEW_WIDTH, VIEW_HEIGHT, CONE_RANGE, CONE_HALF_ANGLE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_CLEAR = 'clear';
export const SCREEN_WIN = 'win';

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.canvas.width = VIEW_WIDTH;
    this.canvas.height = VIEW_HEIGHT;
    this.ctx = canvas.getContext('2d');
  }

  draw(world, screen, ui) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    this.drawFloor(ctx, world);
    this.drawExit(ctx, world);
    this.drawArtifacts(ctx, world);
    this.drawCover(ctx, world);
    this.drawWalls(ctx, world);
    this.drawVisionCones(ctx, world);
    this.drawGuards(ctx, world);
    this.drawPlayer(ctx, world);
    this.drawDarkness(ctx, world);
    this.drawHud(ctx, world, ui);
    if (screen === SCREEN_TITLE) this.drawTitle(ctx, world, ui);
    if (screen === SCREEN_PAUSED) this.drawPaused(ctx, ui);
    if (screen === SCREEN_CAUGHT) this.drawCaught(ctx, world, ui);
    if (screen === SCREEN_CLEAR) this.drawLevelClear(ctx, world, ui);
    if (screen === SCREEN_WIN) this.drawGameWin(ctx, world, ui);
  }

  drawFloor(ctx, world) {
    ctx.fillStyle = '#1b1e2a';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    for (let r = 0; r < ROWS; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if ((r + c) % 2 === 0) {
          ctx.fillStyle = '#20242f';
          ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
        }
      }
    }
    // Worn rugs down the main halls.
    ctx.fillStyle = '#3a2430';
    ctx.fillRect(2 * TILE, 9 * TILE, 28 * TILE, TILE);
    ctx.fillStyle = '#2c3040';
    ctx.fillRect(2 * TILE, 15 * TILE, 28 * TILE, TILE);
    ctx.strokeStyle = 'rgba(216, 178, 106, 0.25)';
    ctx.lineWidth = 2;
    ctx.strokeRect(2 * TILE + 4, 9 * TILE + 4, 28 * TILE - 8, TILE - 8);
    ctx.strokeRect(2 * TILE + 4, 15 * TILE + 4, 28 * TILE - 8, TILE - 8);
    void world;
  }

  drawWalls(ctx, world) {
    for (const w of world.walls) {
      ctx.fillStyle = '#3d4356';
      ctx.fillRect(w.x, w.y, w.w, w.h);
      ctx.fillStyle = '#565e75';
      ctx.fillRect(w.x, w.y, w.w, 5);
      ctx.fillStyle = '#2c3140';
      ctx.fillRect(w.x, w.y + w.h - 4, w.w, 4);
    }
  }

  drawCover(ctx, world) {
    for (const c of world.cover) {
      if (c.kind === 'crate') {
        ctx.fillStyle = '#7a5a33';
        ctx.fillRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6);
        ctx.strokeStyle = '#5d4325';
        ctx.lineWidth = 3;
        ctx.strokeRect(c.x + 3, c.y + 3, c.w - 6, c.h - 6);
        ctx.beginPath();
        ctx.moveTo(c.x + 3, c.y + 3);
        ctx.lineTo(c.x + c.w - 3, c.y + c.h - 3);
        ctx.moveTo(c.x + c.w - 3, c.y + 3);
        ctx.lineTo(c.x + 3, c.y + c.h - 3);
        ctx.stroke();
      } else if (c.kind === 'pillar') {
        ctx.fillStyle = '#4a5064';
        ctx.beginPath();
        ctx.arc(c.x + TILE / 2, c.y + TILE / 2, 17, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6b7388';
        ctx.beginPath();
        ctx.arc(c.x + TILE / 2 - 4, c.y + TILE / 2 - 4, 9, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#8a5a2e';
        ctx.beginPath();
        ctx.arc(c.x + TILE / 2, c.y + TILE / 2 + 8, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#2e7d46';
        ctx.beginPath();
        ctx.arc(c.x + TILE / 2 - 7, c.y + TILE / 2 - 6, 10, 0, Math.PI * 2);
        ctx.arc(c.x + TILE / 2 + 7, c.y + TILE / 2 - 8, 11, 0, Math.PI * 2);
        ctx.arc(c.x + TILE / 2, c.y + TILE / 2 - 13, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  drawExit(ctx, world) {
    const e = world.exit;
    const open = world.artifactsLeft === 0;
    const pulse = 0.5 + 0.5 * Math.sin(world.time * 3);
    ctx.save();
    ctx.globalAlpha = open ? 0.5 + 0.4 * pulse : 0.25;
    ctx.fillStyle = open ? '#2fd47a' : '#5a6b52';
    ctx.beginPath();
    ctx.arc(e.x, e.y, 30 + (open ? 6 * pulse : 0), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = open ? '#12351f' : '#2a332a';
    ctx.fillRect(e.x - 16, e.y - 20, 32, 40);
    ctx.fillStyle = open ? '#7dffb0' : '#8a9a86';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('EXIT', e.x, e.y);
    if (!open) {
      ctx.fillStyle = '#c8b06a';
      ctx.font = '11px system-ui, sans-serif';
      ctx.fillText('LOCKED', e.x, e.y + 30);
    }
  }

  drawArtifacts(ctx, world) {
    const gemColors = ['#4de3ff', '#ffd24d', '#ff6ad5', '#9dff6a'];
    world.artifacts.forEach((a, i) => {
      if (a.taken) return;
      const pulse = 0.5 + 0.5 * Math.sin(world.time * 4 + i * 1.7);
      ctx.save();
      ctx.globalAlpha = 0.35 + 0.35 * pulse;
      ctx.fillStyle = gemColors[i % gemColors.length];
      ctx.beginPath();
      ctx.arc(a.x, a.y, 22 + 5 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = gemColors[i % gemColors.length];
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 12);
      ctx.lineTo(a.x + 9, a.y);
      ctx.lineTo(a.x, a.y + 12);
      ctx.lineTo(a.x - 9, a.y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y - 6);
      ctx.lineTo(a.x + 4, a.y);
      ctx.lineTo(a.x, a.y + 6);
      ctx.lineTo(a.x - 4, a.y);
      ctx.closePath();
      ctx.fill();
    });
  }

  drawVisionCones(ctx, world) {
    for (const g of world.guards) {
      const color = g.state === 'chase' ? '255, 70, 70' : g.state === 'suspicious' ? '255, 150, 60' : '255, 214, 90';
      const alpha = g.state === 'patrol' ? 0.26 : 0.32;
      ctx.save();
      ctx.fillStyle = `rgba(${color}, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(g.x, g.y);
      ctx.arc(g.x, g.y, CONE_RANGE, g.facing - CONE_HALF_ANGLE, g.facing + CONE_HALF_ANGLE);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = `rgba(${color}, 0.45)`;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
  }

  drawGuards(ctx, world) {
    for (const g of world.guards) {
      // Body: dark uniform with a cap, facing the patrol direction.
      ctx.fillStyle = '#20242e';
      ctx.beginPath();
      ctx.arc(g.x, g.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = g.state === 'chase' ? '#ff4d4d' : g.state === 'suspicious' ? '#ff9a3c' : '#d8b26a';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = '#d8b26a';
      ctx.beginPath();
      ctx.arc(g.x + Math.cos(g.facing) * 6, g.y + Math.sin(g.facing) * 6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8e8e8';
      ctx.beginPath();
      ctx.arc(g.x + Math.cos(g.facing) * 9, g.y + Math.sin(g.facing) * 9, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // Alert mark: ! when chasing, ? when investigating.
      if (g.state !== 'patrol') {
        ctx.fillStyle = g.state === 'chase' ? '#ff4d4d' : '#ffb347';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(g.state === 'chase' ? '!' : '?', g.x, g.y - 26);
      }
    }
  }

  drawPlayer(ctx, world) {
    const p = world.player;
    // Noise ring while moving.
    if (p.noiseRadius > 0) {
      ctx.save();
      ctx.globalAlpha = 0.14 + 0.10 * world.noisePulse;
      ctx.strokeStyle = '#9fd8ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.noiseRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    // Hooded thief: teal cloak, dark hood, pale face slit.
    ctx.fillStyle = '#0f8f7a';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5ff2d6';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#0b3d34';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.facing) * 4, p.y + Math.sin(p.facing) * 4, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe9b0';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.facing) * 7, p.y + Math.sin(p.facing) * 7, 2.5, 0, Math.PI * 2);
    ctx.fill();
    if (p.sneaking) {
      ctx.fillStyle = '#5ff2d6';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SNEAK', p.x, p.y - 22);
    }
  }

  drawDarkness(ctx, world) {
    // Night: dim everything except a pool of light around the thief.
    const p = world.player;
    const grad = ctx.createRadialGradient(p.x, p.y, 90, p.x, p.y, 420);
    grad.addColorStop(0, 'rgba(4, 6, 14, 0)');
    grad.addColorStop(1, 'rgba(4, 6, 14, 0.30)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 24;
    ctx.strokeRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  }

  drawHud(ctx, world, ui) {
    ctx.fillStyle = 'rgba(10, 12, 22, 0.88)';
    ctx.fillRect(0, 0, VIEW_WIDTH, 52);
    ctx.fillStyle = '#d8b26a';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`SHADOW VAULT — ${world.level.name}`, 16, 18);
    ctx.fillStyle = '#9aa3b5';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`Level ${world.levelIndex + 1}/3 · WASD / arrows to move · SHIFT to sneak · P pause`, 16, 38);
    // Gems.
    const got = world.artifacts.length - world.artifactsLeft;
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`◆ ${got}/${world.artifacts.length}`, 640, 26);
    // Detection meter.
    const mx = 700;
    const mw = 220;
    ctx.fillStyle = '#2a2f3f';
    ctx.fillRect(mx, 16, mw, 18);
    const det = world.detection / 100;
    ctx.fillStyle = world.alarm ? '#ff4d4d' : det > 0.6 ? '#ff9a3c' : '#ffd65a';
    ctx.fillRect(mx, 16, mw * det, 18);
    ctx.strokeStyle = '#565e75';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(mx, 16, mw, 18);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(world.alarm ? 'ALARM!' : 'SEEN', mx + mw + 10, 26);
    // Timer and score.
    const mm = Math.floor(world.time / 60);
    const ss = Math.floor(world.time % 60).toString().padStart(2, '0');
    ctx.fillStyle = '#e8e8e8';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${mm}:${ss}`, 1180, 18);
    ctx.fillText(`SCORE ${world.score + (ui ? ui.bonus : 0)}`, 1180, 38);
  }

  panel(ctx, title, lines, accent) {
    ctx.save();
    ctx.fillStyle = 'rgba(8, 10, 20, 0.78)';
    ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
    const w = 620;
    const h = 120 + lines.length * 30;
    const x = (VIEW_WIDTH - w) / 2;
    const y = (VIEW_HEIGHT - h) / 2;
    ctx.fillStyle = '#141828';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = accent;
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, VIEW_WIDTH / 2, y + 52);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '17px system-ui, sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, VIEW_WIDTH / 2, y + 108 + i * 30);
    });
    ctx.restore();
  }

  drawTitle(ctx, world, ui) {
    void world;
    this.panel(ctx, 'SHADOW VAULT', [
      'Steal every gem, then slip out the exit — unseen.',
      'Guards patrol with cones of sight. Crates, pillars and',
      'plants break their line of sight. Walk makes noise;',
      'hold SHIFT to sneak, slow and quiet.',
      '',
      'Press ENTER or click to begin the heist.',
      `Best score: ${ui && ui.best ? ui.best : 0}`,
    ], '#d8b26a');
  }

  drawPaused(ctx, ui) {
    void ui;
    this.panel(ctx, 'PAUSED', ['Press P to keep sneaking.'], '#9aa3b5');
  }

  drawCaught(ctx, world, ui) {
    void ui;
    this.panel(ctx, 'CAUGHT!', [
      `The guards caught you on ${world.level.name}.`,
      `Score so far: ${world.score}`,
      'Press R to try the level again.',
    ], '#ff4d4d');
  }

  drawLevelClear(ctx, world, ui) {
    void ui;
    const ghost = world.ghost ? 'Ghost bonus +400 — never spotted!' : 'Spotted along the way — no ghost bonus.';
    this.panel(ctx, 'LEVEL CLEAR', [
      `${world.level.name} — all gems stolen.`,
      `Level score: ${world.score}   ${ghost}`,
      world.levelIndex < 2 ? 'Press ENTER for the next museum wing.' : 'Press ENTER for the final tally.',
    ], '#2fd47a');
  }

  drawGameWin(ctx, world, ui) {
    const total = world.score + (ui ? ui.bonus : 0);
    this.panel(ctx, 'THE VAULT IS EMPTY', [
      'Every gem in all three wings is yours. A perfect heist.',
      `Final score: ${total}`,
      'Press R to run it back.',
    ], '#ffd24d');
  }
}
