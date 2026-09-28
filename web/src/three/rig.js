import * as THREE from 'three';

// 追逐镜头：主角固定在原点朝 +X 奔跑，世界向 -X 滚动；相机在侧前方 3/4 视角，
// 主角偏右、追赶者在左，逃离方向一目了然。按水平视场角取景：16:9 / 4:3 投影 / 竖屏都不会切掉追赶者。
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const CHASE_SHOTS = [
  { id: 'side', name: '侧面跟拍', pos: [2, 2, 17], look: [-3, 0, 0], hfov: 70 },
  { id: 'front', name: '迎面追赶', pos: [13, 3, 10], look: [-3, 0, 0], hfov: 70 },
  { id: 'chase', name: '后方追随', pos: [-16, 4, 10], look: [1, 0, 0], hfov: 70 },
  { id: 'wide', name: '荒野全景', pos: [4, 6, 23], look: [-4, 0, 0], hfov: 72 },
  { id: 'aerial', name: '高空俯瞰', pos: [-3, 20, 12], look: [-4, 0, 0], hfov: 70 },
];

export class CameraRig {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 1200);
    this.base = new THREE.Vector3(4.2, 2.5, 11.6);
    this.look = new THREE.Vector3(-1.4, 1.45, 0);
    this.kickAmt = 0;
    this.camera.position.copy(this.base);
    this.camera.lookAt(this.look);
    this._goal = new THREE.Vector3();
    this._lookGoal = new THREE.Vector3();
  }

  // 里程碑 / 被追上时给镜头一个短促冲击
  kick(amount = 1) {
    this.kickAmt = Math.min(1.5, this.kickAmt + amount);
  }

  update(dt, t, { speed = 0, danger = 0 }) {
    const cam = this.camera;
    // 危险越高镜头越往后拉，保证追赶者始终入画
    this._goal.set(4.2 + danger * 0.6, 2.5 + danger * 0.8, 11.6 + danger * 2.6);
    if (!reduced) {
      this._goal.x += Math.sin(t * 0.37) * 0.35;
      this._goal.y += Math.sin(t * 0.53 + 1.2) * 0.18;
    }
    this._lookGoal.set(-1.4 - danger * 1.2, 1.45 + danger * 0.15, 0);

    this.base.x = damp(this.base.x, this._goal.x, 1.6, dt);
    this.base.y = damp(this.base.y, this._goal.y, 1.6, dt);
    this.base.z = damp(this.base.z, this._goal.z, 1.6, dt);
    this.look.x = damp(this.look.x, this._lookGoal.x, 2.4, dt);
    this.look.y = damp(this.look.y, this._lookGoal.y, 2.4, dt);
    this.look.z = damp(this.look.z, this._lookGoal.z, 2.4, dt);

    // 水平视场角恒定（速度越快略微拉宽，增强速度感），换算成 three.js 需要的垂直视场角
    const hfov = THREE.MathUtils.degToRad(66 + speed * 7);
    const vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / Math.max(0.4, cam.aspect)));
    const fov = damp(cam.fov, THREE.MathUtils.clamp(vfov, 36, 72), 3, dt);
    if (Math.abs(fov - cam.fov) > 0.01) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }

    // 近身抖动：危险越高越明显；尊重"减少动态效果"系统设置
    this.kickAmt = damp(this.kickAmt, 0, 4, dt);
    const shake = reduced ? 0 : Math.max(0, danger - 0.6) * 0.1 + this.kickAmt * 0.12;
    cam.position.set(
      this.base.x + Math.sin(t * 31.7) * Math.sin(t * 7.3) * shake,
      this.base.y + Math.sin(t * 27.1 + 2) * Math.sin(t * 5.9) * shake,
      this.base.z
    );
    const fit = Math.max(1, Math.tan(hfov / 2) / (cam.aspect * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)));
    cam.position.sub(this.look).multiplyScalar(fit).add(this.look);
    cam.lookAt(this.look);
  }
}
