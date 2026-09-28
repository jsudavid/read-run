import * as THREE from 'three';
import { SkyDome, samplePalette } from '../three/sky.js';
import { Terrain } from '../three/terrain.js';
import { Particles } from '../three/particles.js';
import { Runner } from '../actors/runner.js';

// 世界基类：天空、光照、地形、道具、主角、粒子的组装与每帧推进；追赶者由各世界的 spec 提供。
// 心情 mood(0..1) = 逃离进度（读得越久天越亮）× 当下危险（一安静整个画面就暗下来），紧张感不只来自追赶者。
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export class World {
  constructor(spec, tier) {
    this.spec = spec;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, spec.fogDensity ?? 0.0075);
    this.sky = new SkyDome();
    this.scene.add(this.sky.mesh);

    this.hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1);
    this.sun = new THREE.DirectionalLight(0xffffff, 2);
    const sc = this.sun.shadow.camera;
    Object.assign(sc, { left: -16, right: 16, top: 12, bottom: -8, near: 1, far: 90 });
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    this.fill = new THREE.DirectionalLight(0xffffff, 0.3); // 相机一侧补光：逆光时主角正面不死黑
    this.fill.position.set(6, 5, 14);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.fill);

    this.terrain = new Terrain({ heightAt: spec.heightAt, colorAt: spec.colorAt });
    this.runner = new Runner(spec.runnerRim);
    this.glow = new Particles({ max: 520, additive: true });
    this.dust = new Particles({ max: 260, additive: false });
    this.scene.add(this.terrain.group, this.runner.group, this.glow.points, this.dust.points);

    this.scroll = 0;
    this.gap = this.gapFor(0.35);
    this.gapVel = 0;
    this.dangerS = 0.35;
    this.mood = spec.startMood ?? 0;
    this.moodBias = 0; // 开场待机画面把天色抬到接近日出，更好看
    this.exposure = 1;
    this.pal = {};
    this.sunDir = new THREE.Vector3();
    this._step = 0;

    this.props = spec.props(this);
    for (const p of this.props) this.scene.add(p.mesh);
    spec.setup(this);
    this.applyTier(tier);
    this._applyPalette();
  }

  applyTier(tier) {
    this.sun.castShadow = tier.shadow > 0;
    if (tier.shadow > 0 && this.sun.shadow.mapSize.x !== tier.shadow) {
      this.sun.shadow.mapSize.set(tier.shadow, tier.shadow);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  // 危险度 -> 追赶者与主角的距离（米）
  gapFor(danger) {
    const far = this.spec.gapFar ?? 14, near = this.spec.gapNear ?? 0.6;
    return far + (near - far) * danger;
  }

  update(dt, t, sig, camera, viewH) {
    this.dangerS = damp(this.dangerS, sig.danger, 3, dt);
    const g = damp(this.gap, this.gapFor(sig.danger), 2.2, dt);
    this.gapVel = (g - this.gap) / Math.max(dt, 1e-4);
    this.gap = g;

    const dx = sig.worldSpeed * dt;
    this.scroll += dx;
    this.terrain.update(this.scroll);
    for (const p of this.props) p.update(this.scroll * (p.parallax ?? 1));
    this.runner.update(dt, t, sig.run);
    this._footDust(sig);
    this.spec.update(this, dt, t, sig);

    const journey = Math.min(1, sig.meters / (this.spec.dawnMeters ?? 2400));
    const target = Math.max(0, journey * (1 - this.dangerS * 0.55) - this.dangerS * 0.12 + this.moodBias);
    this.mood = damp(this.mood, target, 0.8, dt);
    this._applyPalette();

    this.glow.update(dt, dx, t, viewH, camera.fov);
    this.dust.update(dt, dx, t, viewH, camera.fov);
    this.sky.update(t);
  }

  _applyPalette() {
    const p = samplePalette(this.spec.palette, this.mood, this.pal);
    const az = this.spec.sunAzimuth ?? 0.21;
    this.sunDir.set(Math.sin(az), p.sunY, -Math.cos(az)).normalize();
    p.sunDir = this.sunDir;
    this.sky.apply(p);
    this.scene.fog.color.copy(p.fog);
    this.hemi.color.copy(p.hemiSky);
    this.hemi.groundColor.copy(p.hemiGround);
    this.hemi.intensity = p.hemiIntensity;
    this.sun.color.copy(p.light);
    this.sun.intensity = p.lightIntensity;
    this.fill.color.copy(p.hemiSky);
    this.fill.intensity = 0.2 + p.lightIntensity * 0.1;
    // 光源跟随太阳方位，但抬到至少 20°：地平线下的太阳不能从地底打光
    this.sun.position.set(this.sunDir.x * 40, Math.max(this.sunDir.y, 0.35) * 40, this.sunDir.z * 40);
    this.exposure = p.exposure;
  }

  // 每一步落地扬起一点尘土
  _footDust(sig) {
    const step = Math.floor(this.runner.phase / Math.PI);
    if (step === this._step) return;
    this._step = step;
    if (sig.run < 0.3) return;
    const z = step % 2 ? 0.1 : -0.1;
    for (let i = 0; i < 3; i++) {
      this.dust.emit({
        x: 0.1 + Math.random() * 0.2, y: 0.05, z: z + (Math.random() - 0.5) * 0.2,
        vx: -1 - Math.random() * 1.5, vy: 0.4 + Math.random() * 0.6, vz: (Math.random() - 0.5) * 0.8,
        life: 0.6 + Math.random() * 0.5, size: 0.18 + Math.random() * 0.14,
        color: this.spec.dustColor ?? [0.5, 0.42, 0.33], drag: 2.5, grav: 0.4,
      });
    }
  }

  // 里程碑：主角身边迸出一圈金色光点
  celebrate() {
    const c = this.spec.sparkColor ?? [4, 3, 1.4];
    for (let i = 0; i < 70; i++) {
      const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 3;
      this.glow.emit({
        x: 0, y: 1.2, z: 0, vx: Math.cos(a) * s * 0.6 + 2.5, vy: Math.sin(a) * s + 2, vz: (Math.random() - 0.5) * 3,
        life: 1 + Math.random() * 0.8, size: 0.07 + Math.random() * 0.08, color: c, drag: 1.5, grav: 3,
      });
    }
  }

  caught() {
    this.spec.onCaught?.(this);
  }

  dispose() {
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      for (const m of [o.material].flat()) {
        if (!m) continue;
        m.map?.dispose();
        m.dispose();
      }
      if (o.isInstancedMesh) o.dispose();
    });
    this.sun.shadow.map?.dispose();
  }
}
