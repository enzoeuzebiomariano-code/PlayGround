import { clamp } from './config.js';

const KEY_LEFT = new Set(['ArrowLeft', 'KeyA']);
const KEY_RIGHT = new Set(['ArrowRight', 'KeyD']);
const KEY_DOWN = new Set(['ArrowDown', 'KeyS']);
const KEY_JUMP = new Set(['Space', 'ArrowUp', 'KeyW', 'KeyZ', 'KeyK']);
const KEY_RUN = new Set(['ShiftLeft', 'ShiftRight', 'KeyX', 'KeyJ']);
const KEY_PAUSE = new Set(['Escape', 'KeyP']);

export class Input {
  constructor({ onFirstGesture, onPause, onMute, onTiltStatus } = {}) {
    this.keyState = { left: false, right: false, down: false, run: false, jump: false };
    this.touchState = { left: false, right: false, down: false, run: false, jump: false };
    this.padState = { left: false, right: false, down: false, run: false, jump: false };
    this.left = false;
    this.right = false;
    this.down = false;
    this.run = false;
    this.jumpHeld = false;
    this.jumpBuffered = false;
    this.pauseRequested = false;
    this.firstGesture = false;
    this.onFirstGesture = onFirstGesture;
    this.onPause = onPause;
    this.onMute = onMute;
    this.onTiltStatus = onTiltStatus;
    this.tiltEnabled = false;
    this.tiltAxis = 0;
    this.tiltBaseline = null;
    this.tiltPermission = 'unknown';
    this.touchActions = new Map();
    this.touchPointers = new Map();
    this.gamepadJump = false;
    this.gamepadPrevJump = false;
    this.gamepadPrevStart = false;
    this.attach();
  }

  gesture() {
    if (this.firstGesture) return;
    this.firstGesture = true;
    try { this.onFirstGesture?.(); } catch { /* ignore */ }
  }

  attach() {
    window.addEventListener('keydown', (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const code = event.code;
      if (KEY_LEFT.has(code) || KEY_RIGHT.has(code) || KEY_DOWN.has(code) || KEY_JUMP.has(code) || KEY_RUN.has(code) || KEY_PAUSE.has(code)) {
        event.preventDefault();
      }
      this.gesture();
      if (KEY_LEFT.has(code)) this.keyState.left = true;
      if (KEY_RIGHT.has(code)) this.keyState.right = true;
      if (KEY_DOWN.has(code)) this.keyState.down = true;
      if (KEY_RUN.has(code)) this.keyState.run = true;
      if (KEY_JUMP.has(code)) {
        if (!this.jumpHeld) this.jumpBuffered = true;
        this.keyState.jump = true;
      }
      this.refresh();
      if (KEY_PAUSE.has(code) && !event.repeat) this.pauseRequested = true;
      if (code === 'KeyM' && !event.repeat) this.onMute?.();
    });
    window.addEventListener('keyup', (event) => {
      const code = event.code;
      if (KEY_LEFT.has(code)) this.keyState.left = false;
      if (KEY_RIGHT.has(code)) this.keyState.right = false;
      if (KEY_DOWN.has(code)) this.keyState.down = false;
      if (KEY_RUN.has(code)) this.keyState.run = false;
      if (KEY_JUMP.has(code)) this.keyState.jump = false;
      this.refresh();
    });
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll(); });
    window.addEventListener('contextmenu', (event) => {
      if (event.target.closest?.('.touch-btn, #game-canvas')) event.preventDefault();
    });
    this.attachTouch();
  }

  attachTouch() {
    const buttons = document.querySelectorAll('[data-action]');
    buttons.forEach((button) => {
      const action = button.dataset.action;
      if (!['left', 'right', 'down', 'jump', 'run'].includes(action)) return;
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        this.gesture();
        try { button.setPointerCapture?.(event.pointerId); } catch { /* synthetic pointers */ }
        this.setTouchAction(button, action, event.pointerId, true);
      });
      const release = (event) => {
        event.preventDefault();
        this.setTouchAction(button, action, event.pointerId, false);
      };
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      button.addEventListener('contextmenu', (event) => event.preventDefault());
      button.addEventListener('click', (event) => event.preventDefault());
    });
    const canvas = document.getElementById('game-canvas');
    canvas?.addEventListener('pointerdown', () => this.gesture());
  }

  setTouchAction(button, action, pointerId, active) {
    let pointers = this.touchPointers.get(button);
    if (!pointers) {
      pointers = new Set();
      this.touchPointers.set(button, pointers);
    }
    if (active) {
      pointers.add(pointerId);
      if (action === 'jump' && !this.jumpHeld) this.jumpBuffered = true;
    } else {
      pointers.delete(pointerId);
    }
    const held = pointers.size > 0;
    button.classList.toggle('pressed', held);
    this.touchState[action] = held;
    this.refresh();
  }

  refresh() {
    this.left = this.keyState.left || this.touchState.left || this.padState.left;
    this.right = this.keyState.right || this.touchState.right || this.padState.right;
    this.down = this.keyState.down || this.touchState.down || this.padState.down;
    this.run = this.keyState.run || this.touchState.run || this.padState.run;
    this.jumpHeld = this.keyState.jump || this.touchState.jump || this.padState.jump;
  }

  releaseAll() {
    Object.keys(this.keyState).forEach((key) => { this.keyState[key] = false; });
    Object.keys(this.touchState).forEach((key) => { this.touchState[key] = false; });
    Object.keys(this.padState).forEach((key) => { this.padState[key] = false; });
    this.left = false;
    this.right = false;
    this.down = false;
    this.run = false;
    this.jumpHeld = false;
    this.jumpBuffered = false;
    this.touchPointers.forEach((pointers, button) => {
      pointers.clear();
      button.classList.remove('pressed');
    });
  }

  get axis() {
    const buttons = (this.right ? 1 : 0) - (this.left ? 1 : 0);
    if (!this.tiltEnabled) return buttons;
    return clamp(buttons + this.tiltAxis, -1, 1);
  }

  pollGamepad() {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    const pad = Array.from(pads).find((p) => p && p.connected);
    if (!pad) {
      this.gamepadJump = false;
      this.padState = { left: false, right: false, down: false, run: false, jump: false };
      this.refresh();
      return;
    }
    const next = { left: false, right: false, down: false, run: false, jump: false };
    const dead = 0.24;
    const stickX = pad.axes[0] || 0;
    if (stickX < -dead) next.left = true;
    else if (stickX > dead) next.right = true;
    const dpadDown = pad.buttons[13]?.pressed;
    const dpadLeft = pad.buttons[14]?.pressed;
    const dpadRight = pad.buttons[15]?.pressed;
    if (dpadLeft) next.left = true;
    if (dpadRight) next.right = true;
    if (dpadDown) next.down = true;
    const jump = Boolean(pad.buttons[0]?.pressed || pad.buttons[1]?.pressed);
    if (jump && !this.gamepadPrevJump) this.jumpBuffered = true;
    next.jump = jump;
    this.gamepadJump = jump;
    this.gamepadPrevJump = jump;
    next.run = Boolean(pad.buttons[2]?.pressed || pad.buttons[3]?.pressed);
    this.padState = next;
    this.refresh();
    const start = Boolean(pad.buttons[9]?.pressed);
    if (start && !this.gamepadPrevStart) this.pauseRequested = true;
    this.gamepadPrevStart = start;
  }

  consumeJump() {
    const value = this.jumpBuffered;
    this.jumpBuffered = false;
    return value;
  }

  consumePause() {
    const value = this.pauseRequested;
    this.pauseRequested = false;
    return value;
  }

  async enableTilt() {
    if (this.tiltEnabled) {
      this.disableTilt();
      return false;
    }
    if (typeof DeviceOrientationEvent === 'undefined') {
      this.onTiltStatus?.('Este aparelho não tem sensor de inclinação.');
      return false;
    }
    try {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        const permission = await DeviceOrientationEvent.requestPermission();
        this.tiltPermission = permission;
        if (permission !== 'granted') {
          this.onTiltStatus?.('Permissão de movimento negada.');
          return false;
        }
      }
      this.tiltBaseline = null;
      this.tiltAxis = 0;
      this.tiltEnabled = true;
      window.addEventListener('deviceorientation', this.handleOrientation, true);
      this.onTiltStatus?.('Inclinação ativada! Incline o aparelho para andar.');
      return true;
    } catch {
      this.onTiltStatus?.('Não foi possível ativar a inclinação.');
      return false;
    }
  }

  handleOrientation = (event) => {
    let angle = 0;
    try {
      if (screen.orientation && typeof screen.orientation.angle === 'number') angle = screen.orientation.angle;
      else if (typeof window.orientation === 'number') angle = window.orientation;
    } catch { /* ignore */ }
    const portrait = Math.abs(angle) !== 90;
    const raw = portrait ? event.gamma : event.beta;
    if (raw == null) return;
    if (this.tiltBaseline == null) {
      this.tiltBaseline = raw;
      return;
    }
    // Smooth and gently recenter while the device is still, so small drifts do not steer.
    this.tiltBaseline += (raw - this.tiltBaseline) * 0.012;
    let delta = raw - this.tiltBaseline;
    if (!portrait) delta *= angle === -90 ? -1 : 1;
    const dead = 3.5;
    const range = 24;
    const magnitude = Math.abs(delta);
    const value = magnitude < dead ? 0 : Math.sign(delta) * Math.min(1, (magnitude - dead) / range);
    this.tiltAxis += (value - this.tiltAxis) * 0.35;
  };

  disableTilt() {
    this.tiltEnabled = false;
    this.tiltAxis = 0;
    window.removeEventListener('deviceorientation', this.handleOrientation, true);
    this.onTiltStatus?.('Inclinação desativada.');
  }
}
