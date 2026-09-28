// 移植自 riba2534/claude-opus-5-5-demo · pelican-bike/src/main.js · updateRide / 特技 / 尘土
// 改动：速度与加速度来自 BikeDrive（声音驱动）而非键盘；去掉跳跃按键与音效；特技改为里程碑奖励。
import * as THREE from 'three';
import { WHEEL_R, GEARS, BIKE_POINTS } from './ref/bicycle.js';
import { clamp, damp, TAU, mulberry32 } from './ref/util.js';
import { nextFish } from './fishing.js';

export function newRideState(started) {
  return {
    speed: 0, distance: 0, lane: 0.9, laneV: 0, laneTarget: 0.9, prevLaneV: 0, latAcc: 0,
    lean: 0, steer: 0, crank: 0, wheel: 0, gear: 0, y: 0, vy: 0, airborne: false,
    trick: 0, trickT: 0, wheelie: 0, accel: 0, pedaling: false, cadence: 0,
    fish: 0, golden: 0, nextFishAt: 30, started, t: 0, time: 0, confettiAt: -1,
    glanceT: 0, glanceKind: 0, env: { night: 0, waveAmp: 1 }, rnd: mulberry32(2024),
  };
}

export function updateRide(st, S, drive, dt) {
  S.speed = drive.speed;
  S.accel = damp(S.accel, drive.accel, 6, dt);
  S.pedaling = drive.pedaling && S.speed > 0.05;
  S.distance += S.speed * dt;
  S.wheel += (S.speed / WHEEL_R) * dt;

  // 自动变速：让踏频保持在 ~85 rpm
  const wheelRpm = ((S.speed / WHEEL_R) * 60) / TAU;
  let best = S.gear;
  let bestErr = 1e9;
  GEARS.forEach(([r, c], i) => {
    const err = Math.abs(wheelRpm / (r / c) - 86);
    if (err < bestErr) { bestErr = err; best = i; }
  });
  const curCad = wheelRpm / (GEARS[S.gear][0] / GEARS[S.gear][1]);
  if (best !== S.gear && (curCad > 102 || curCad < 68)) S.gear += Math.sign(best - S.gear);
  const ratio = GEARS[S.gear][0] / GEARS[S.gear][1];
  const crankW = S.pedaling ? S.speed / WHEEL_R / ratio : 0;
  S.crank += crankW * dt;
  S.cadence = (crankW * 60) / TAU;

  // 自动驾驶：追鱼；没有鱼就在车道里轻轻摆动。车快停下时不再变道
  if (S.speed > 1) {
    const next = nextFish(S, st, 40);
    const want = next ? next.z : 0.9 + Math.sin(S.time * 0.23) * 0.7;
    S.laneTarget = damp(S.laneTarget, want, next ? 2.2 : 0.8, dt);
  } else S.laneTarget = S.lane;
  const k = 10;
  S.laneV += ((S.laneTarget - S.lane) * k - S.laneV * 2 * Math.sqrt(k)) * dt;
  S.lane += S.laneV * dt;
  S.latAcc = damp(S.latAcc, (S.laneV - S.prevLaneV) / Math.max(dt, 1e-3), 8, dt);
  S.prevLaneV = S.laneV;
  const wobble = Math.sin(S.time * 1.7) * 0.02 * clamp(1.5 - S.speed * 0.2, 0.2, 1.5);
  S.lean = damp(S.lean, clamp(Math.atan(S.latAcc / 9.8) * 1.4, -0.4, 0.4) + wobble * 0.5, 7, dt);
  const steerT = S.trickT > 0 ? 0 : -clamp(S.latAcc * 0.05 + (S.laneV * 0.12) / Math.max(1, S.speed * 0.3), -0.35, 0.35) + wobble;
  S.steer = damp(S.steer, steerT, 10, dt);

  // 特技：放手 + 抬前轮
  if (S.trickT > 0) S.trickT -= dt;
  S.trick = damp(S.trick, S.trickT > 0 ? 1 : 0, 4, dt);
  S.wheelie = damp(S.wheelie, S.trick * 0.3, 6, dt);
  if (S.confettiAt > 0 && S.time >= S.confettiAt) {
    S.confettiAt = -1;
    st.fx.confetti.burst(new THREE.Vector3(0.2, 1.8, S.lane));
  }

  st.rider.position.set(0, S.y, S.lane);
  st.rider.rotation.set(S.lean, -Math.atan2(S.laneV, Math.max(S.speed, 1.5)), 0);
  st.wheelieRoot.rotation.z = S.wheelie;
  st.bike.update({ wheelAngle: S.wheel, crankAngle: S.crank, steerAngle: S.steer, speed: S.speed, night: S.env.night });
  st.rider.updateMatrixWorld(true);
}

// 里程碑奖励：放手展翅 + 抬前轮 + 撒彩带（车在走才做）
export function trick(st, S) {
  if (S.trickT > 0 || S.speed < 3) return false;
  S.trickT = 3.4;
  st.pelican.honk();
  S.confettiAt = S.time + 0.6;
  return true;
}

const dustCol = new THREE.Color('#b9ab92');
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
export function emitDust(st, S, dt) {
  if (S.airborne || S.speed < 3.5) return;
  S.dustAcc = (S.dustAcc || 0) + dt * S.speed * 1.4;
  while (S.dustAcc > 1) {
    S.dustAcc -= 1;
    const r = S.rnd;
    tmpV.set(BIKE_POINTS.rearHub.x - 0.05 - r() * 0.1, 0.02, S.lane + (r() - 0.5) * 0.08);
    tmpV2.set(-0.3 - r() * 0.6, 0.15 + r() * 0.35, (r() - 0.5) * 0.4);
    st.fx.dust.emit(tmpV, tmpV2, dustCol, 0.03 + r() * 0.04, 0.5 + r() * 0.4, { drag: 1.2, grav: -0.05, ground: 1 });
  }
}
