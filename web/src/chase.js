import { Vector2, Vector3 } from 'three';
import { CameraRig, CHASE_SHOTS } from './three/rig.js';
import { SceneView } from './three/view.js';
import { World } from './worlds/world.js';
import { dawnSpec } from './worlds/dawn.js';
import { Signal } from './audio/signal.js';

// 动物追赶模式：破晓荒野 + 狼群。达标朗读让狼群退后、天色变亮；安静下来狼群逼近。
export class ChaseMode {
  constructor(renderer, { attract = false } = {}) {
    this.kind = 'chase';
    this.milestone = 200;
    this.renderer = renderer;
    this.attract = attract;
    this.rig = new CameraRig();
    this.sig = new Signal();
    this.world = new World(dawnSpec, renderer.tier);
    if (attract) {
      this.world.moodBias = 0.55; // 开场待机画面：接近日出，更好看
      this.world.mood = 0.55;
      this.world._applyPalette();
    }
    this.on = { caught: null };
    this.caughtCount = 0;
    this.L = 0;
    this._size = new Vector2();
    renderer.attach(this.world.scene, this.rig.camera);
    this.settings = { autoMood: true, mood: 0.7, fog: 1, exposure: 1, bloomBoost: 1 };
    this.focus = new Vector3(-1.4, 1.45, 0);
    this.cinemaTime = 0;
    this.view = new SceneView(this.rig.camera, renderer.canvas, CHASE_SHOTS, {
      minDistance: 6, maxDistance: 45, maxPan: 6,
      groundHeight: (position) => dawnSpec.heightAt(this.world.scroll + position.x, position.z),
    });
    this.view.interactive = !attract;
    this.view.update(0, this.focus);
  }

  get meters() { return this.sig.meters; }

  applyTier(tier) { this.world.applyTier(tier); }

  update(dt, L, t) {
    const { sig, world, rig } = this;
    this.L = L;
    sig.update(L, dt);
    if (sig.caught) {
      sig.softReset(); // 保留逃离进度，狼群退回安全距离
      if (!this.attract) {
        this.caughtCount++;
        world.caught();
        rig.kick(1.2);
        this.on.caught?.();
      }
    }
    const viewH = this.renderer.gl.getDrawingBufferSize(this._size).y;
    world.update(dt, t, sig, rig.camera, viewH);
    this.updateCamera(dt, t);
    if (!this.settings.autoMood) {
      world.mood = this.settings.mood;
      world._applyPalette();
    }
    world.scene.fog.density = dawnSpec.fogDensity * this.settings.fog;
    this.renderer.setExposure(world.exposure * this.settings.exposure);
    if (this.renderer.bloom) this.renderer.bloom.strength = 0.55 * this.settings.bloomBoost;
  }

  updateCamera(dt, t, paused = false) {
    const { sig, world, rig } = this;
    const motionDt = paused ? 0 : dt;
    if (this.view.id === 'cine') {
      this.cinemaTime += motionDt;
      const angle = Math.sin(this.cinemaTime * 0.18) * 0.75;
      rig.camera.position.set(-3 + Math.sin(angle) * 22, 5 + Math.sin(this.cinemaTime * 0.13) * 2, Math.cos(angle) * 22);
      this.view.hfov = 82;
      const fit = this.view.applyLens();
      rig.camera.position.sub(this.focus).multiplyScalar(fit).add(this.focus);
      rig.camera.lookAt(this.focus);
    } else if (this.view.automatic) rig.update(motionDt, t, { speed: sig.run, danger: world.dangerS });
    this.view.update(paused && this.view.id === 'free' ? 0 : dt, this.focus);
  }

  render(t) { this.renderer.render(t); }

  celebrate() {
    this.world.celebrate();
    this.rig.kick(0.5);
  }

  setPhoto(canvas, color) { this.world.runner.setPhoto(canvas, color); }
  clearPhoto() { this.world.runner.clearPhoto(); }

  get hud() {
    const s = this.sig;
    return { kind: 'chase', level: this.L, meters: s.meters, streak: s.streak, qualified: s.qualified, danger: this.world.dangerS, gap: this.world.gap, goal: s.goal, caughtCount: this.caughtCount };
  }

  dispose() { this.view.dispose(); this.world.dispose(); }
}
