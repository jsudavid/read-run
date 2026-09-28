import * as THREE from 'three';
import { fbm, noise2, smoothstep } from '../three/noise.js';
import { Scatter } from '../three/scatter.js';
import { std } from '../three/materials.js';
import { pineGeometry, grassGeometry, cloudGeometry } from '../three/props.js';
import { Wolf } from '../actors/wolf.js';

// 场景一 · 破晓荒野：狼群从后方追来；读得越久，天从深夜一路亮到日出。
const PALETTE = [
  { at: 0.0, top: '#070b1f', mid: '#141c3d', horizon: '#2b2c55', sun: '#b9c8ff', fog: '#1d2244', sunY: 0.16, sunIntensity: 0.5, disc: 0.5, stars: 1, light: '#8ea4ff', lightIntensity: 0.55, hemiSky: '#3a4a88', hemiGround: '#141626', hemiIntensity: 0.85, exposure: 0.8 },
  { at: 0.35, top: '#131a44', mid: '#3c2f6b', horizon: '#c0607a', sun: '#ff9a6a', fog: '#5a3d66', sunY: -0.04, sunIntensity: 0.7, disc: 0, stars: 0.45, light: '#c89ab8', lightIntensity: 1.1, hemiSky: '#6a5a9e', hemiGround: '#2a1f2c', hemiIntensity: 1.0, exposure: 0.9 },
  { at: 0.7, top: '#2d4a8a', mid: '#b96f8e', horizon: '#ffb07a', sun: '#ffc27a', fog: '#d8927e', sunY: 0.04, sunIntensity: 1.2, disc: 1, stars: 0.05, light: '#ffc08a', lightIntensity: 2.6, hemiSky: '#9aa8e0', hemiGround: '#4a3526', hemiIntensity: 1.25, exposure: 1.0 },
  { at: 1.0, top: '#4e7fc9', mid: '#a9b8e8', horizon: '#ffd6a8', sun: '#ffe2b0', fog: '#e8c7ae', sunY: 0.13, sunIntensity: 1.0, disc: 1, stars: 0, light: '#ffe4c0', lightIntensity: 3.2, hemiSky: '#b8c8f0', hemiGround: '#5a4632', hemiIntensity: 1.4, exposure: 1.02 },
];

const C = Object.fromEntries(
  Object.entries({ path: '#8a6a4e', shoulder: '#9b8a55', grassA: '#5f8a45', grassB: '#7ea356', rock: '#6d6a74', snow: '#e6e8f2' })
    .map(([k, v]) => [k, new THREE.Color(v)])
);

function heightAt(wx, z) {
  const d = Math.abs(z);
  const flat = smoothstep(1.8, 5, d);
  let h = (fbm(wx * 0.08, z * 0.08, 3) - 0.45) * 0.9 * flat;
  if (z < 0) {
    const far = smoothstep(8, 70, d);
    h += fbm(wx * 0.012 + 7, z * 0.012, 4) * 13 * far;
    h += Math.pow(1 - Math.abs(fbm(wx * 0.006, 3.3, 3) * 2 - 1), 2) * 26 * smoothstep(90, 170, d);
  }
  return h;
}

const _tmp = new THREE.Color();
function colorAt(wx, z, h, slope, out) {
  const d = Math.abs(z);
  const n = noise2(wx * 0.15, z * 0.15);
  out.copy(C.grassA).lerp(_tmp.copy(C.grassB), n);
  out.lerp(_tmp.copy(C.shoulder), 1 - smoothstep(2.6, 5.5, d));
  out.lerp(_tmp.copy(C.path), 1 - smoothstep(1.2, 2.4, d));
  out.lerp(_tmp.copy(C.rock), smoothstep(0.35, 0.7, slope) * 0.8 + smoothstep(14, 22, h) * 0.6);
  out.lerp(_tmp.copy(C.snow), smoothstep(24, 30, h));
  out.multiplyScalar(0.88 + noise2(wx * 0.9, z * 0.9) * 0.24);
}

function props(world) {
  const h = heightAt;
  const pineMat = std('#ffffff', { vertexColors: true, flatShading: true, roughness: 0.9 });
  const flatMat = (c) => std(c, { flatShading: true, roughness: 0.95 });
  const pines = new Scatter({
    geometry: pineGeometry(), material: pineMat, count: 120, heightAt: h, seed: 11, castShadow: true, left: -260, span: 330,
    place(it, r) {
      it.z = -13 - Math.pow(r(), 1.2) * 75;
      it.hide = fbm(it.wx * 0.02, it.z * 0.02, 2) < 0.5; // 成片的林子，中间留出能看见天的空隙
      it.s = 0.8 + (-it.z / 88) * 1.1 + r() * 0.4;
      it.sy = 0.9 + r() * 0.35;
      it.rot = r() * 6.28;
      it.color = _tmp.setHSL(0.26 + r() * 0.08, 0.35, 0.55 + r() * 0.25).getHex();
    },
  });
  const rocks = new Scatter({
    geometry: new THREE.DodecahedronGeometry(0.6, 0), material: flatMat('#8a8590'), count: 90, heightAt: h, seed: 23, castShadow: true, left: -200, span: 270,
    place(it, r) {
      const near = r() < 0.4;
      it.z = near ? 2.6 + r() * 6 : -3.2 - r() * 40;
      it.s = near ? 0.3 + r() * 0.5 : 0.5 + r() * 1.8;
      it.sy = 0.55 + r() * 0.4;
      it.y = -0.15 * it.s;
      it.rot = r() * 6.28;
      it.tilt = (r() - 0.5) * 0.4;
    },
  });
  const grass = new Scatter({
    geometry: grassGeometry(), material: pineMat, count: 320, heightAt: h, seed: 5, left: -140, span: 190,
    place(it, r) {
      it.z = r() < 0.3 ? 2.3 + r() * 3.2 : -2.3 - r() * 26;
      it.s = 0.8 + r() * 0.8;
      it.rot = r() * 6.28;
      it.color = _tmp.setHSL(0.2 + r() * 0.1, 0.4, 0.5 + r() * 0.3).getHex();
    },
  });
  const posts = new Scatter({
    geometry: new THREE.BoxGeometry(0.12, 1.1, 0.12).translate(0, 0.55, 0), material: flatMat('#5b4634'), count: 36, heightAt: h, seed: 3, castShadow: true, left: -80, span: 115.2, jitter: false,
    place(it, r) {
      it.z = -3.4;
      it.tilt = (r() - 0.5) * 0.12;
      it.sy = 0.85 + r() * 0.3;
    },
  });
  // 云：逆光面会发黑，所以加一层随天色变化的自发光（在 update 里跟着地平线色走）
  world.cloudMat = std('#ffffff', { flatShading: true, roughness: 1, fog: false, emissive: '#000000' });
  const clouds = new Scatter({
    geometry: cloudGeometry(), material: world.cloudMat, count: 10, heightAt: () => 0, seed: 9, left: -420, span: 560,
    place(it, r) {
      it.z = -190 - r() * 80;
      it.y = 62 + r() * 30;
      it.s = 3.5 + r() * 3.5;
      it.rot = r() * 0.6;
    },
  });
  clouds.parallax = 0.35;
  return [pines, rocks, grass, posts, clouds];
}

export const dawnSpec = {
  name: 'dawn',
  palette: PALETTE,
  heightAt,
  colorAt,
  props,
  fogDensity: 0.0075,
  sunAzimuth: 0.21,
  runnerRim: '#ffd6a8',
  dustColor: [0.55, 0.45, 0.34],
  gapFar: 14,
  gapNear: 0.7,

  setup(world) {
    world.pack = [
      { wolf: new Wolf({ rim: '#9fb6ff' }), off: 0, z: 0.35, s: 1.08 },
      { wolf: new Wolf({ rim: '#9fb6ff' }), off: 2.6, z: -1.3, s: 0.95 },
      { wolf: new Wolf({ rim: '#9fb6ff' }), off: 4.4, z: 1.2, s: 0.88 },
    ];
    for (const m of world.pack) {
      m.wolf.group.scale.setScalar(m.s);
      world.scene.add(m.wolf.group);
    }
  },

  update(world, dt, t, sig) {
    world.cloudMat.emissive.copy(world.pal.horizon).lerp(world.pal.mid, 0.4).multiplyScalar(0.55);
    const closing = THREE.MathUtils.clamp(-world.gapVel / 6, -0.4, 0.6);
    for (const [i, m] of world.pack.entries()) {
      m.wolf.update(dt, THREE.MathUtils.clamp(sig.run * 0.7 + closing + 0.3, 0.2, 1), world.dangerS);
      const x = -world.gap - m.off - 0.95 * m.s;
      m.wolf.group.position.set(x, heightAt(world.scroll + x, m.z), m.z + Math.sin(t * 0.8 + i * 2) * 0.25);
    }
    // 夜里是萤火，天亮后是飘浮的花粉
    if (Math.random() < 0.35) {
      const night = world.mood < 0.45;
      world.glow.emit({
        x: -10 + Math.random() * 26, y: 0.4 + Math.random() * 2.2, z: -6 + Math.random() * 12,
        vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.3) * 0.25, vz: (Math.random() - 0.5) * 0.4,
        life: 3 + Math.random() * 3, size: night ? 0.07 : 0.05, flicker: night ? 4 + Math.random() * 4 : 0,
        color: night ? [3.2, 2.4, 0.9] : [1.6, 1.5, 1.2], drag: 0.5,
      });
    }
  },
};
