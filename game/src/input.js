// Shadow Vault — keyboard and mouse input: WASD/arrows to move,
// Shift to sneak, P pause, Enter confirm, R retry, click to start.

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.clicked = false;
    this.onKeyDown = (event) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
        event.preventDefault();
      }
      if (!event.repeat) this.pressed.add(event.key.toLowerCase());
      this.keys.add(event.key.toLowerCase());
    };
    this.onKeyUp = (event) => {
      this.keys.delete(event.key.toLowerCase());
    };
    this.onMouseDown = () => { this.clicked = true; };
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousedown', this.onMouseDown);
  }

  /** Movement vector from the held keys, each component in [-1, 1]. */
  moveVector() {
    let x = 0;
    let y = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) x -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) x += 1;
    if (this.keys.has('w') || this.keys.has('arrowup')) y -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) y += 1;
    return { x, y };
  }

  get sneak() {
    return this.keys.has('shift');
  }

  wasPressed(key) {
    return this.pressed.has(key.toLowerCase());
  }

  endFrame() {
    this.pressed.clear();
    this.clicked = false;
  }
}
