// Shadow Vault — tiny synthesized sounds (WebAudio, no audio files):
// soft footsteps, a gem chime, a two-tone alarm and a win jingle.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.stepTimer = 0;
  }

  /** Create the audio context on the first user gesture; silent until then. */
  unlock() {
    if (this.ctx) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
    } catch (err) {
      this.ctx = null;
    }
  }

  blip(freq, seconds, type, gainValue) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    gain.gain.setValueAtTime(gainValue, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + seconds + 0.02);
  }

  footstep(sneaking) {
    if (!this.ctx) return;
    this.blip(sneaking ? 140 : 190, 0.05, 'sine', sneaking ? 0.02 : 0.045);
  }

  gem() {
    this.blip(880, 0.12, 'sine', 0.08);
    setTimeout(() => this.blip(1318, 0.18, 'sine', 0.08), 70);
  }

  alarm() {
    this.blip(620, 0.16, 'square', 0.05);
    setTimeout(() => this.blip(440, 0.16, 'square', 0.05), 160);
  }

  caught() {
    this.blip(220, 0.3, 'sawtooth', 0.06);
    setTimeout(() => this.blip(110, 0.5, 'sawtooth', 0.06), 180);
  }

  win() {
    [523, 659, 784, 1046].forEach((freq, i) => {
      setTimeout(() => this.blip(freq, 0.22, 'sine', 0.08), i * 110);
    });
  }
}
