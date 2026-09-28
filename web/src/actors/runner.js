import * as THREE from 'three';
import { std, withRim, jerseyColor } from '../three/materials.js';

// 主角：风格化人偶（无五官，保持匿名），原点在脚下、朝 +X 奔跑。
// 跑姿全部程序化：步频、步幅、前倾、摆臂随"奔跑强度"变化。有照片时球衣换成照片主色，头顶浮一枚双色调徽章。
const DEFAULT_JERSEY = '#2fc4b2';

function limb(radius, length, material) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), 4, 10), material);
  m.position.y = -length / 2;
  return m;
}

export class Runner {
  constructor(rimColor = '#ffd2a0') {
    const rim = (m) => withRim(m, rimColor, 0.45);
    this.mats = {
      jersey: rim(std(DEFAULT_JERSEY, { roughness: 0.55 })),
      shorts: rim(std('#1d2840', { roughness: 0.8 })),
      skin: rim(std('#c9a48a', { roughness: 0.6 })),
      hair: rim(std('#1b1714', { roughness: 0.9 })),
      shoe: rim(std('#f1efe9', { roughness: 0.5 })),
      accent: rim(std('#ffffff', { roughness: 0.4 })),
    };
    const M = this.mats;
    this.group = new THREE.Group();
    this.hips = new THREE.Group();
    this.hips.position.y = 0.95;
    this.group.add(this.hips);

    const pelvis = limb(0.15, 0.3, M.shorts);
    pelvis.position.y = 0.02;
    this.hips.add(pelvis);
    this.spine = new THREE.Group();
    this.spine.position.y = 0.1;
    this.hips.add(this.spine);
    const torso = limb(0.17, 0.5, M.jersey);
    torso.position.y = 0.25;
    torso.scale.set(1, 1, 1.2);
    this.spine.add(torso);
    const stripe = new THREE.Mesh(new THREE.CylinderGeometry(0.176, 0.176, 0.05, 16), M.accent);
    stripe.position.y = 0.3;
    stripe.scale.z = 1.2;
    this.spine.add(stripe);

    this.head = new THREE.Group();
    this.head.position.y = 0.52;
    this.spine.add(this.head);
    const neck = limb(0.055, 0.12, M.skin);
    neck.position.y = 0.06;
    this.head.add(neck);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.115, 20, 14), M.skin);
    skull.position.y = 0.17;
    this.head.add(skull);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.122, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), M.hair);
    hair.position.y = 0.175;
    hair.rotation.z = 0.35;
    this.head.add(hair);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.117, 0.018, 8, 24), M.accent);
    band.position.y = 0.2;
    band.rotation.x = Math.PI / 2;
    this.head.add(band);

    this.arms = [1, -1].map((side) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(0, 0.45, side * 0.22);
      this.spine.add(shoulder);
      shoulder.add(limb(0.065, 0.3, M.jersey));
      const elbow = new THREE.Group();
      elbow.position.y = -0.3;
      shoulder.add(elbow);
      elbow.add(limb(0.05, 0.27, M.skin));
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), M.skin);
      hand.position.y = -0.28;
      elbow.add(hand);
      return { shoulder, elbow };
    });

    this.legs = [1, -1].map((side) => {
      const hip = new THREE.Group();
      hip.position.set(0, 0, side * 0.1);
      this.hips.add(hip);
      hip.add(limb(0.085, 0.46, M.shorts));
      const knee = new THREE.Group();
      knee.position.y = -0.44;
      hip.add(knee);
      knee.add(limb(0.07, 0.44, M.skin));
      const ankle = new THREE.Group();
      ankle.position.y = -0.43;
      knee.add(ankle);
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.1, 0.12), M.shoe);
      shoe.position.set(0.06, -0.03, 0);
      ankle.add(shoe);
      return { hip, knee, ankle };
    });

    this.badge = new THREE.Sprite(new THREE.SpriteMaterial({ depthWrite: false, transparent: true }));
    this.badge.scale.setScalar(0.62);
    this.badge.visible = false;
    this.group.add(this.badge);

    this.group.traverse((o) => {
      if (o.isMesh) o.castShadow = o.receiveShadow = true;
    });
    this.phase = 0;
  }

  // headCanvas：photo/process.js 产出的圆形双色调头像；mainColor：照片主色
  setPhoto(headCanvas, mainColor) {
    this.mats.jersey.color.copy(jerseyColor(mainColor));
    const mat = this.badge.material;
    mat.map?.dispose();
    mat.map = new THREE.CanvasTexture(headCanvas);
    mat.map.colorSpace = THREE.SRGBColorSpace;
    mat.needsUpdate = true;
    this.badge.visible = true;
  }

  clearPhoto() {
    this.mats.jersey.color.set(DEFAULT_JERSEY);
    this.badge.visible = false;
  }

  // run: 0..1 奔跑强度
  update(dt, t, run) {
    const cadence = 1.4 + run * 1.5;                 // 每秒步数周期
    this.phase += dt * cadence * Math.PI * 2;
    const p = this.phase;
    const amp = 0.35 + run * 0.55;
    this.hips.position.y = 0.95 - Math.cos(2 * p) * (0.015 + run * 0.035) - run * 0.03;
    this.legs.forEach((leg, i) => {
      const q = p + i * Math.PI;
      const swing = Math.sin(q) * amp;
      const bend = -(0.25 + run * 0.3) - Math.max(0, Math.cos(q)) * (0.5 + run * 0.9);
      leg.hip.rotation.z = swing;
      leg.knee.rotation.z = bend;
      leg.ankle.rotation.z = -(swing + bend) * 0.6;
      const arm = this.arms[i];
      arm.shoulder.rotation.z = -Math.sin(q) * (0.3 + run * 0.6);
      arm.elbow.rotation.z = 1.0 + run * 0.35 + Math.sin(q) * 0.2;
    });
    this.spine.rotation.z = -(0.08 + run * 0.24);
    this.spine.rotation.y = Math.sin(p) * 0.12 * (0.4 + run);
    this.head.rotation.z = 0.05 + run * 0.14;
    this.badge.position.set(0, 2.25 + Math.sin(t * 2.4) * 0.05, 0);
  }

  dispose() {
    this.group.traverse((o) => o.geometry?.dispose());
    Object.values(this.mats).forEach((m) => m.dispose());
    this.badge.material.map?.dispose();
    this.badge.material.dispose();
  }
}
