import * as THREE from 'three';
import { fbm, noise2, smoothstep } from '../three/noise.js';
import { Scatter } from '../three/scatter.js';
import { std } from '../three/materials.js';
import { deadTreeGeometry, glowTexture } from '../three/props.js';
import { LavaFront } from '../actors/lava.js';

// 场景二 · 火山之夜：熔岩前锋从后方翻卷而来，远处火山周期性喷发；逃得越远，烟幕散开、天边泛出黎明的紫。
const PALETTE = [
  { at: 0.0, top: '#0c0406', mid: '#2a0a0c', horizon: '#7a1e0e', sun: '#ff5a1e', fog: '#2e0d0a', sunY: 0.12, sunIntensity: 0.9, disc: 0, stars: 0.15, light: '#ff7a3a', lightIntensity: 1.2, hemiSky: '#5a2018', hemiGround: '#140606', hemiIntensity: 0.7, exposure: 0.95 },
  { at: 0.5, top: '#140a1e', mid: '#3a1426', horizon: '#a8401e', sun: '#ff6a2a', fog: '#3e1612', sunY: 0.12, sunIntensity: 0.75, disc: 0, stars: 0.35, light: '#ff8a50', lightIntensity: 1.4, hemiSky: '#5a2a3a', hemiGround: '#180808', hemiIntensity: 0.85, exposure: 0.98 },
  { at: 1.0, top: '#1c2350', mid: '#4a2e62', horizon: '#d9765a', sun: '#ff8a5a', fog: '#5a3040', sunY: 0.12, sunIntensity: 0.55, disc: 0, stars: 0.5, light: '#ffa070', lightIntensity: 1.8, hemiSky: '#6a5a8e', hemiGround: '#1c1016', hemiIntensity: 1.0, exposure: 1.0 },
];

const C = Object.fromEntries(
  Object.entries({ basalt: '#2b2528', ash: '#4a4344', path: '#3a302c', slag: '#1c1719' }).map(([k, v]) => [k, new THREE.Color(v)])
);
const VOLCANO = { x: -150, z: -260 };

function heightAt(wx, z) {
  const d = Math.abs(z);
  const flat = smoothstep(1.8, 5, d);
  let h = (fbm(wx * 0.1, z * 0.1, 3) - 0.45) * 1.1 * flat;
  if (z < 0) {
    h += Math.pow(fbm(wx * 0.014 + 3, z * 0.014, 4), 1.6) * 18 * smoothstep(8, 70, d);
    h += Math.pow(1 - Math.abs(fbm(wx * 0.007, 9.1, 3) * 2 - 1), 3) * 12 * smoothstep(90, 170, d);
  }
  return h;
}

const _tmp = new THREE.Color();
function colorAt(wx, z, h, slope, out, emissive) {
  const d = Math.abs(z);
  out.copy(C.basalt).lerp(_tmp.copy(C.slag), noise2(wx * 0.2, z * 0.2));
  out.lerp(_tmp.copy(C.ash), smoothstep(0.55, 0.8, noise2(wx * 0.05 + 5, z * 0.05)) * 0.7);
  out.lerp(_tmp.copy(C.path), 1 - smoothstep(1.2, 2.4, d));
  // 发光裂隙：噪声等值线勾出蜿蜒的熔岩细流，只铺在路边近处
  const band = Math.abs(noise2(wx * 0.18, z * 0.18) - 0.5);
  if (d > 2.6 && d < 20 && band < 0.03) {
    const k = (1 - band / 0.03) * (1 - d / 20);
    emissive.setRGB(1.5 * k, 0.32 * k, 0.03 * k);
    out.multiplyScalar(0.5);
  }
  out.multiplyScalar(0.85 + noise2(wx * 0.9, z * 0.9) * 0.3);
}

function props() {
  const h = heightAt;
  const flat = (c, o) => std(c, { flatShading: true, roughness: 0.9, ...o });
  const spikes = new Scatter({
    geometry: new THREE.ConeGeometry(0.5, 2.2, 5).translate(0, 1, 0), material: flat('#1a1418', { roughness: 0.35 }),
    count: 90, heightAt: h, seed: 31, castShadow: true, left: -220, span: 290,
    place(it, r) {
      const near = r() < 0.2;
      it.z = near ? 3 + r() * 4 : -4 - Math.pow(r(), 1.3) * 55;
      it.s = near ? 0.25 + r() * 0.35 : 0.45 + r() * 0.8 + (-it.z / 55) * 0.9;
      it.sy = 0.7 + r() * 0.9;
      it.tilt = (r() - 0.5) * 0.5;
      it.rot = r() * 6.28;
    },
  });
  const rocks = new Scatter({
    geometry: new THREE.DodecahedronGeometry(0.6, 0), material: flat('#2a2426'), count: 90, heightAt: h, seed: 37, castShadow: true, left: -200, span: 270,
    place(it, r) {
      const near = r() < 0.4;
      it.z = near ? 2.6 + r() * 6 : -3.2 - r() * 40;
      it.s = near ? 0.3 + r() * 0.5 : 0.5 + r() * 1.8;
      it.sy = 0.5 + r() * 0.4;
      it.y = -0.15 * it.s;
      it.rot = r() * 6.28;
    },
  });
  const trees = new Scatter({
    geometry: deadTreeGeometry(), material: flat('#1e1614'), count: 40, heightAt: h, seed: 41, castShadow: true, left: -200, span: 260,
    place(it, r) {
      it.z = -5 - r() * 45;
      it.s = 0.9 + r() * 0.9;
      it.rot = r() * 6.28;
      it.tilt = (r() - 0.5) * 0.25;
    },
  });
  const pools = new Scatter({
    geometry: new THREE.CylinderGeometry(1, 1, 0.1, 6), material: new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.8, 0.12) }),
    count: 26, heightAt: h, seed: 43, left: -200, span: 260,
    place(it, r) {
      it.z = -4.5 - r() * 38;
      it.s = 1 + r() * 2.2;
      // 坡太陡的地方放不住熔岩池（否则会悬空一截）
      const slope = Math.abs(h(it.wx + it.s, it.z) - h(it.wx - it.s, it.z)) + Math.abs(h(it.wx, it.z + it.s) - h(it.wx, it.z - it.s));
      it.hide = slope > 0.6;
      it.sy = 1;
      it.y = 0.03;
      it.rot = r() * 6.28;
    },
  });
  const posts = new Scatter({
    geometry: new THREE.BoxGeometry(0.14, 1.2, 0.14).translate(0, 0.6, 0), material: flat('#241a16'), count: 36, heightAt: h, seed: 47, castShadow: true, left: -80, span: 115.2, jitter: false,
    place(it, r) {
      it.z = -3.4;
      it.tilt = (r() - 0.5) * 0.3;
      it.sy = 0.6 + r() * 0.6;
    },
  });
  return [spikes, rocks, trees, pools, posts];
}

export const lavaSpec = {
  name: 'lava',
  palette: PALETTE,
  heightAt,
  colorAt,
  props,
  fogDensity: 0.011,
  sunAzimuth: Math.atan2(VOLCANO.x, -VOLCANO.z),
  runnerRim: '#ffb070',
  dustColor: [0.28, 0.24, 0.24],
  sparkColor: [4, 3.4, 1.8],
  gapFar: 16,
  gapNear: 0.9,

  setup(world) {
    world.lava = new LavaFront();
    world.scene.add(world.lava.group);
    // 远景火山：不随世界滚动的静态背景；不受雾影响，作为暗色剪影压在火光上
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(10, 95, 62, 9, 1),
      new THREE.MeshBasicMaterial({ color: '#140808', fog: false })
    );
    body.position.set(VOLCANO.x, 26, VOLCANO.z);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 10.2, 1.2, 9), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.9, 0.15), fog: false }));
    cap.position.set(VOLCANO.x, 57.4, VOLCANO.z);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTexture(), color: new THREE.Color(3, 1, 0.3), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true,
    }));
    halo.position.set(VOLCANO.x, 61, VOLCANO.z);
    halo.scale.set(70, 50, 1);
    world.scene.add(body, cap, halo);
    world.volcano = { cap, halo, timer: 3, pulse: 0 };
  },

  update(world, dt, t, sig) {
    world.lava.update(dt, t, world.gap, world.dangerS, world.scroll, world.glow);
    const v = world.volcano;
    v.timer -= dt;
    if (v.timer <= 0) {
      v.timer = 5 + Math.random() * 4;
      v.pulse = 1;
      for (let i = 0; i < 40; i++) {
        world.glow.emit({
          x: VOLCANO.x + (Math.random() - 0.5) * 8, y: 58, z: VOLCANO.z + (Math.random() - 0.5) * 8,
          vx: sig.worldSpeed + (Math.random() - 0.5) * 14, vy: 18 + Math.random() * 22, vz: (Math.random() - 0.5) * 10,
          life: 2.5 + Math.random() * 1.5, size: 1.4 + Math.random() * 1.4, color: [5, 1.4, 0.2], grav: 14,
        });
      }
    }
    v.pulse = Math.max(0, v.pulse - dt * 0.7);
    v.cap.material.color.setRGB(3 + v.pulse * 5, 0.9 + v.pulse * 1.5, 0.15 + v.pulse * 0.3);
    v.halo.material.opacity = 0.55 + v.pulse * 0.45;
    world.terrain.glow.value = 0.8 + 0.2 * Math.sin(t * 1.3) + v.pulse * 0.3;

    // 地面升起的火星 + 空中飘落的灰烬
    if (Math.random() < 0.5) {
      world.glow.emit({
        x: -12 + Math.random() * 30, y: 0.1, z: -8 + Math.random() * 14,
        vx: (Math.random() - 0.5) * 0.6, vy: 0.8 + Math.random() * 1.4, vz: (Math.random() - 0.5) * 0.6,
        life: 2 + Math.random() * 2, size: 0.04 + Math.random() * 0.05, color: [4, 1.2, 0.2], flicker: 6 + Math.random() * 6, drag: 0.3,
      });
    }
    if (Math.random() < 0.4) {
      world.dust.emit({
        x: -12 + Math.random() * 30, y: 5 + Math.random() * 3, z: -8 + Math.random() * 14,
        vx: -0.3 + Math.random() * 0.6, vy: -0.4 - Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.4,
        life: 5 + Math.random() * 3, size: 0.05 + Math.random() * 0.05, color: [0.35, 0.32, 0.33], drag: 0.2,
      });
    }
  },

  onCaught(world) {
    world.lava.splash(world.glow);
  },
};
