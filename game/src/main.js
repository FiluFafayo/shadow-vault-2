// Shadow Vault — game loop and screens: title, play, pause, caught,
// level clear and the final win. ?shot=start|play|alarm|end stages one
// fixed scene for screenshots instead of running the live game.

import { World, STEP, EVENT_ARTIFACT, EVENT_ALARM, EVENT_CAUGHT, EVENT_LEVEL_CLEAR } from './world.js';
import { Renderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_CAUGHT, SCREEN_CLEAR, SCREEN_WIN } from './render.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { stageShot } from './shots.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = new Renderer(canvas);
const input = new Input();
const sounds = new SoundBank();

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

let world = new World(0);
let screen = SCREEN_TITLE;
let totalBonus = 0;
let best = 0;
try {
  best = Number(window.localStorage.getItem('shadow-vault-best') || 0);
} catch (err) {
  best = 0;
}

function ui() {
  return { bonus: totalBonus, best };
}

function announce(text) {
  if (status) status.textContent = text;
}

function startLevel(index) {
  world = new World(index);
  screen = SCREEN_PLAY;
  announce(`${world.level.name}. Steal ${world.artifacts.length} gems, then reach the exit unseen.`);
}

function startGame() {
  totalBonus = 0;
  startLevel(0);
}

function nextLevel() {
  totalBonus += world.score;
  if (world.levelIndex + 1 >= 3) {
    screen = SCREEN_WIN;
    const total = totalBonus;
    if (total > best) {
      best = total;
      try { window.localStorage.setItem('shadow-vault-best', String(best)); } catch (err) { /* private mode */ }
    }
    sounds.win();
    announce(`Heist complete. Final score ${total}.`);
  } else {
    startLevel(world.levelIndex + 1);
  }
}

function frame() {
  const move = input.moveVector();
  if (screen === SCREEN_TITLE) {
    if (input.wasPressed('enter') || input.clicked) {
      sounds.unlock();
      startGame();
    }
  } else if (screen === SCREEN_PLAY) {
    if (input.wasPressed('p') || input.wasPressed('escape')) {
      screen = SCREEN_PAUSED;
    } else {
      const events = world.step(STEP, move.x, move.y, input.sneak);
      if (world.player.moving) {
        sounds.stepTimer -= STEP;
        if (sounds.stepTimer <= 0) {
          sounds.stepTimer = world.player.sneaking ? 0.55 : 0.34;
          sounds.footstep(world.player.sneaking);
        }
      }
      if (events & EVENT_ARTIFACT) {
        sounds.gem();
        announce(`Gem stolen. ${world.artifactsLeft} left.`);
      }
      if (events & EVENT_ALARM) {
        sounds.alarm();
        announce('Alarm! The guards are coming for you. Break line of sight!');
      }
      if (events & EVENT_CAUGHT) {
        sounds.caught();
        screen = SCREEN_CAUGHT;
        announce('Caught! Press R to try the level again.');
      } else if (events & EVENT_LEVEL_CLEAR) {
        sounds.win();
        screen = SCREEN_CLEAR;
        announce(`${world.level.name} clear. Press Enter for the next wing.`);
      }
    }
  } else if (screen === SCREEN_PAUSED) {
    if (input.wasPressed('p') || input.wasPressed('escape')) screen = SCREEN_PLAY;
  } else if (screen === SCREEN_CAUGHT) {
    if (input.wasPressed('r')) startLevel(world.levelIndex);
  } else if (screen === SCREEN_CLEAR) {
    if (input.wasPressed('enter')) nextLevel();
  } else if (screen === SCREEN_WIN) {
    if (input.wasPressed('r')) startGame();
  }
  renderer.draw(world, screen, ui());
  input.endFrame();
  requestAnimationFrame(frame);
}

if (shotName) {
  // Screenshot mode: stage one fixed scene and draw it once.
  const staged = stageShot(shotName, world);
  screen = staged.screen;
  totalBonus = staged.bonus || 0;
  renderer.draw(world, screen, ui());
  document.title = `Shadow Vault — shot ${shotName}`;
} else {
  renderer.draw(world, screen, ui());
  requestAnimationFrame(frame);
}
