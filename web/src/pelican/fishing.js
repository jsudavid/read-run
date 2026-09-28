// 移植自 riba2534/claude-opus-5-5-demo · pelican-bike/src/main.js · 收集鱼 / 跃出海面的鱼 / 鹈鹕看向
// 改动：去掉音效与成就；鱼群靠里程生成，读得越久遇到的鱼越多（纯趣味，不计分排名）。
import * as THREE from 'three';
import { waveHeight } from './ref/ocean.js';
import { TAU } from './ref/util.js';

const LANES = [-1.8, -0.6, 0.6, 1.8];
const mouthW = new THREE.Vector3();
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const gold = new THREE.Color('#ffd257');
const cyan = new THREE.Color('#9fefff');
const white = new THREE.Color('#ffffff');
const lookTarget = new THREE.Vector3();

export function nextFish(S, st, range) {
  let best = null;
  for (const f of st.fishes) {
    if (!f.active || f.caught >= 0) continue;
    const rel = f.x - S.distance;
    if (rel > 0.2 && rel < range && (!best || rel < best.x - S.distance)) best = f;
  }
  return best;
}

function spawnFish(S, st, ahead) {
  const f = st.fishes.find((x) => !x.active);
  if (!f) return;
  const r = S.rnd;
  Object.assign(f, { active: true, caught: -1, x: S.distance + ahead, z: LANES[Math.floor(r() * LANES.length)], y: 1.3 + r() * 0.25, golden: r() < 0.12, phase: r() * TAU });
  f.mesh.material = f.golden ? st.goldMat : st.fishMat;
  f.halo.material.color.set(f.golden ? '#ffd257' : '#7fe3ff');
  f.mesh.visible = true;
  f.mesh.scale.setScalar(1.35);
}

// onCatch(golden, mouthWorldPos)
export function updateFishes(st, S, dt, onCatch) {
  if (S.distance > S.nextFishAt) {
    spawnFish(S, st, S.nextFishAt === 30 ? 32 : 85);
    S.nextFishAt = S.distance + 16 + S.rnd() * 18;
  }
  st.pelican.mouth.getWorldPosition(mouthW);
  for (const f of st.fishes) {
    if (!f.active) continue;
    const rel = f.x - S.distance;
    if (f.caught >= 0) {
      f.caught += dt;
      const u = Math.min(1, f.caught / 0.16);
      f.mesh.position.lerp(mouthW, u);
      f.mesh.scale.setScalar(1.35 * (1 - u * 0.9));
      if (u >= 1) { f.active = false; f.mesh.visible = false; }
      continue;
    }
    f.mesh.position.set(rel, f.y + Math.sin(S.t * 3 + f.phase) * 0.08, f.z);
    f.mesh.rotation.set(Math.sin(S.t * 9 + f.phase) * 0.15, Math.PI + Math.sin(S.t * 1.5 + f.phase) * 0.6, 0);
    f.halo.material.opacity = 0.45 + Math.sin(S.t * 5 + f.phase) * 0.15;
    if (rel < -12) { f.active = false; f.mesh.visible = false; continue; }
    const dx = f.mesh.position.x - mouthW.x, dz = f.mesh.position.z - mouthW.z, dy = f.mesh.position.y - mouthW.y;
    if (Math.abs(dx) < 0.45 + S.speed * dt && Math.abs(dz) < 0.52 && Math.abs(dy) < 0.6) {
      f.caught = 0;
      S.fish += f.golden ? 5 : 1;
      if (f.golden) S.golden++;
      st.pelican.gulp();
      const r = S.rnd;
      for (let i = 0; i < (f.golden ? 70 : 36); i++) {
        tmpV2.set(r() - 0.5, r() * 0.9 - 0.2, r() - 0.5).normalize().multiplyScalar(0.8 + r() * 1.6);
        st.fx.sparkles.emit(mouthW, tmpV2, r() < 0.5 ? (f.golden ? gold : cyan) : white, 0.035 + r() * 0.03, 0.6 + r() * 0.6, { drag: 3 });
      }
      onCatch?.(f.golden, mouthW);
    }
  }
}

function splashAt(st, S, x, z, n) {
  const y = waveHeight(x + S.distance, z, S.t, S.env.waveAmp);
  const r = S.rnd;
  for (let i = 0; i < n; i++) {
    const a = r() * TAU, sp = 0.5 + r() * 1.5;
    tmpV.set(x, y + 0.05, z);
    tmpV2.set(Math.cos(a) * sp, 2 + r() * 2.5, Math.sin(a) * sp);
    st.fx.splash.emit(tmpV, tmpV2, white, 0.06 + r() * 0.06, 0.8 + r() * 0.5, { drag: 0.6, grav: 9.8, ground: 1 });
  }
}

export function launchJumper(st, S, x, z) {
  const j = st.jumpers.find((q) => q.t < 0);
  if (!j) return;
  const r = S.rnd;
  Object.assign(j, { t: 0, x: x + S.distance, z, dur: 1.0 + r() * 0.5, h: 1.2 + r() * 1.3, dir: r() < 0.5 ? 1 : -1 });
  j.mesh.visible = true;
  splashAt(st, S, x, z, 26);
}

export function updateJumpers(st, S, dt) {
  for (const j of st.jumpers) {
    if (j.t < 0) continue;
    j.t += dt;
    const u = j.t / j.dur;
    const x = j.x - S.distance + (u - 0.5) * 1.6 * j.dir;
    const y = waveHeight(j.x, j.z, S.t, S.env.waveAmp) + Math.sin(u * Math.PI) * j.h - 0.2;
    j.mesh.position.set(x, y, j.z);
    j.mesh.rotation.set(0, j.dir > 0 ? 0 : Math.PI, (0.5 - u) * 2.4);
    if (u >= 1) { j.t = -1; j.mesh.visible = false; splashAt(st, S, x, j.z, 18); }
  }
}

// 目光：有鱼看鱼；否则轮流看前方、看镜头（和全班对视一下）、看海
export function computeLook(st, S, camera, dt, firstPerson = false) {
  if (firstPerson) {
    lookTarget.set(st.rider.position.x + 6, 1.15, st.rider.position.z);
    return st.pelican.root.worldToLocal(lookTarget);
  }
  const next = nextFish(S, st, 28);
  if (next) lookTarget.copy(next.mesh.position);
  else {
    S.glanceT -= dt;
    if (S.glanceT <= 0) {
      S.glanceKind = (S.glanceKind + 1) % 4;
      S.glanceT = S.glanceKind === 0 ? 3.5 : 2.2;
    }
    if (S.glanceKind === 1) lookTarget.copy(camera.position);
    else if (S.glanceKind === 3) lookTarget.set(st.rider.position.x + 2, 1.2, -8);
    else lookTarget.set(st.rider.position.x + 6, 1.15, st.rider.position.z);
  }
  return st.pelican.root.worldToLocal(lookTarget);
}
