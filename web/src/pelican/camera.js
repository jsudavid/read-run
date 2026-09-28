// 教室版镜头：以原作的"侧面跟拍"为主镜头（鹈鹕侧身 + 身后大海，速度感最直观），
// 每 ~20 秒用 3 秒平滑过渡到另一个机位再回来。没有硬切、不需要老师操作。
import * as THREE from 'three';
import { terrainHeight } from './ref/world.js';
import { damp, smoothstep, lerp } from './ref/util.js';

// [相机偏移, 看向偏移, 水平视场角]：相对骑手车身中部
export const BIKE_SHOTS = [
  { id: 'side', name: '侧面跟拍', pos: [0.35, 0.1, 3.6], look: [0.25, -0.05, 0], hfov: 58 },
  { id: 'front', name: '前侧特写', pos: [2.9, 0.4, 2.9], look: [-0.2, -0.05, 0], hfov: 56 },
  { id: 'wide', name: '海岸全景', pos: [0.6, 1.8, 6.2], look: [0.6, -0.15, 0], hfov: 62 },
  { id: 'chase', name: '后方追随', pos: [-3.3, 0.55, 1.8], look: [1.2, 0.0, 0], hfov: 56 },
  { id: 'aerial', name: '高空俯瞰', pos: [-1.8, 6.5, 4.5], look: [0, -0.1, 0], hfov: 60 },
];
const SHOTS = BIKE_SHOTS;
const HOLD = 9, BLEND = 3;
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Original pelican-bike cinema sequence; vertical FOV values use its 16:9 framing.
const CINEMA_SHOTS = [
  { duration: 6.5, pose: (u) => [[lerp(-2.6, 1.4, u), -0.5, 2], [0.25, -0.1, 0], 38] },
  { duration: 6, pose: (u) => [[7.5 - u * 1.2, -0.05, -1.1 + u * 0.5], [0.05, 0.35, 0], 17] },
  { duration: 5, pose: (u) => [[-0.2 + u * 0.3, -0.5, 0.95], [-0.3, -0.55, 0.05], 34] },
  { duration: 7, pose: (u) => [[-4.5 + u * 2.5, 1.4 + u * 5, 5 - u * 1.8], [0.3, -0.2, 0], 40] },
  { duration: 6, pose: (u) => [[2.2 - u * 3, 0.1, -3.4], [0, 0.25, 0], 30] },
  { duration: 5, pose: () => null },
  { duration: 6.5, pose: (u) => [[Math.cos(u * 1.6 + 0.4) * 3.2, 2.6, Math.sin(u * 1.6 + 0.4) * 3.2], [0.2, 0.1, 0], 36] },
  { duration: 5.5, pose: (u) => [[1.6, 1.6 - u * 0.4, 0.35], [-0.2, 0.35, 0], 55] },
];

export class FollowCam {
  constructor(camera) {
    this.camera = camera;
    this.t = 0;
    this.cur = 0;
    this.next = 1;
    this.focus = new THREE.Vector3();
    this.smooth = null;
    this._a = new THREE.Vector3();
    this._b = new THREE.Vector3();
    this._la = new THREE.Vector3();
    this._lb = new THREE.Vector3();
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this.cinemaTime = 0;
    this.cinemaShot = 0;
    this.cinemaPov = false;
  }

  _pose(i, outPos, outLook) {
    const s = SHOTS[i];
    outPos.set(this.focus.x + s.pos[0], this.focus.y + s.pos[1], this.focus.z + s.pos[2]);
    outLook.set(this.focus.x + s.look[0], this.focus.y + s.look[1], this.focus.z + s.look[2]);
    return s.hfov;
  }

  updateCinema(dt, rider, S, povPose) {
    this.focus.set(rider.position.x + 0.05, rider.position.y + 0.92, rider.position.z);
    this.cinemaTime += dt;
    let shot = CINEMA_SHOTS[this.cinemaShot];
    if (this.cinemaTime > shot.duration) {
      this.cinemaTime -= shot.duration;
      this.cinemaShot = (this.cinemaShot + 1) % CINEMA_SHOTS.length;
      shot = CINEMA_SHOTS[this.cinemaShot];
    }
    const pose = shot.pose(this.cinemaTime / shot.duration);
    this.cinemaPov = pose === null;
    let verticalFov;
    if (this.cinemaPov) {
      povPose(this._a, this._la);
      verticalFov = 68;
    } else {
      const [position, look, fov] = pose;
      this._a.fromArray(position).add(this.focus);
      this._la.fromArray(look).add(this.focus);
      verticalFov = fov;
    }
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(verticalFov) / 2) * (16 / 9));
    const cam = this.camera;
    cam.fov = THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / cam.aspect)), 20, 85);
    if (!this.cinemaPov) {
      const fit = Math.max(1, Math.tan(hfov / 2) / (cam.aspect * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)));
      this._a.sub(this._la).multiplyScalar(fit).add(this._la);
      const ground = Math.abs(this._a.z) < 2.9 ? 0.02 : terrainHeight(this._a.x + S.distance, this._a.z);
      this._a.y = Math.max(this._a.y, ground + 0.2);
    }
    cam.position.lerp(this._a, reduced ? 1 : 1 - Math.exp(-dt * 5));
    this._m.lookAt(cam.position, this._la, cam.up);
    cam.quaternion.slerp(this._q.setFromRotationMatrix(this._m), reduced ? 1 : 1 - Math.exp(-dt * 5));
    cam.updateProjectionMatrix();
  }

  update(dt, rider, S) {
    this.focus.set(rider.position.x + 0.05, rider.position.y + 0.92, rider.position.z);
    this.t += dt;
    // 主镜头停留 HOLD 秒 -> 过渡到下一个机位 -> 停留 -> 回主镜头
    if (!reduced && this.t > HOLD + BLEND) {
      this.t = 0;
      this.cur = this.next;
      this.next = this.cur === 0 ? 1 + Math.floor(Math.random() * (SHOTS.length - 1)) : 0;
    }
    const e = reduced ? 0 : smoothstep(HOLD, HOLD + BLEND, this.t);
    const fa = this._pose(this.cur, this._a, this._la);
    const fb = this._pose(this.next, this._b, this._lb);
    this._a.lerp(this._b, e);
    this._la.lerp(this._lb, e);
    // 越快镜头越往后退一点，速度感更强
    this._a.z += Math.min(S.speed, 12) * 0.04;
    if (!this.smooth) this.smooth = this._a.clone();
    this.smooth.x = damp(this.smooth.x, this._a.x, 6, dt);
    this.smooth.y = damp(this.smooth.y, this._a.y, 4, dt);
    this.smooth.z = damp(this.smooth.z, this._a.z, 3, dt);
    const cam = this.camera;
    cam.position.copy(this.smooth);
    const wx = cam.position.x + S.distance;
    const ground = Math.abs(cam.position.z) < 2.9 ? 0.02 : terrainHeight(wx, cam.position.z);
    cam.position.y = Math.max(cam.position.y, ground + 0.12);
    // 按水平视场角取景：16:9 / 4:3 投影 / 竖屏都能框住鹈鹕和单车
    const hfov = THREE.MathUtils.degToRad(lerp(fa, fb, e));
    const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / Math.max(0.45, cam.aspect)));
    cam.fov = THREE.MathUtils.clamp(vfov, 26, 70);
    const fit = Math.max(1, Math.tan(hfov / 2) / (cam.aspect * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)));
    cam.position.sub(this._la).multiplyScalar(fit).add(this._la);
    this._m.lookAt(cam.position, this._la, cam.up);
    cam.quaternion.setFromRotationMatrix(this._m);
    cam.updateProjectionMatrix();
  }
}
