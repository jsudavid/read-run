import * as THREE from 'three';
import { std, withRim } from '../three/materials.js';

// 低多边形狼：朝 +X 奔袭，四腿旋转式疾驰步态，眼睛自发光（泛光下是两点寒光）。
function seg(radius, length, material, segs = 3) {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(radius, Math.max(0.01, length - radius * 2), segs, 6), material);
  m.position.y = -length / 2;
  return m;
}

export class Wolf {
  constructor({ fur = '#262a33', rim = '#9fb6ff', eye = '#ffb347' } = {}) {
    this.fur = withRim(std(fur, { roughness: 0.9, flatShading: true }), rim, 0.55, 2.2);
    this.eye = new THREE.MeshBasicMaterial({ color: new THREE.Color(eye).multiplyScalar(6) });
    const F = this.fur;
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.body.position.y = 0.8;
    this.group.add(this.body);

    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.85, 3, 7), F);
    torso.rotation.z = Math.PI / 2;
    torso.scale.set(1, 1, 0.85);
    this.body.add(torso);
    const chest = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), F);
    chest.position.set(0.38, 0.04, 0);
    chest.scale.set(1, 1.05, 0.85);
    this.body.add(chest);

    this.head = new THREE.Group();
    this.head.position.set(0.62, 0.22, 0);
    this.body.add(this.head);
    const skull = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), F);
    skull.scale.set(1.1, 0.9, 0.9);
    this.head.add(skull);
    const snout = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 6), F);
    snout.rotation.z = -Math.PI / 2;
    snout.position.set(0.26, -0.05, 0);
    this.head.add(snout);
    this.ears = [1, -1].map((s) => {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 4), F);
      ear.position.set(-0.04, 0.2, s * 0.09);
      this.head.add(ear);
      return ear;
    });
    [1, -1].forEach((s) => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), this.eye);
      e.position.set(0.14, 0.05, s * 0.1);
      this.head.add(e);
    });

    this.tail = new THREE.Group();
    this.tail.position.set(-0.62, 0.12, 0);
    this.body.add(this.tail);
    const tailMesh = seg(0.09, 0.62, F);
    this.tail.add(tailMesh);

    this.legs = [
      [0.42, 0.15, true], [0.42, -0.15, true],
      [-0.45, 0.15, false], [-0.45, -0.15, false],
    ].map(([x, z, front]) => {
      const top = new THREE.Group();
      top.position.set(x, -0.05, z);
      this.body.add(top);
      top.add(seg(0.08, 0.42, F));
      const joint = new THREE.Group();
      joint.position.y = -0.4;
      top.add(joint);
      joint.add(seg(0.055, 0.38, F));
      const paw = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), F);
      paw.position.y = -0.38;
      joint.add(paw);
      return { top, joint, front };
    });

    this.group.traverse((o) => {
      if (o.isMesh && o.material !== this.eye) o.castShadow = true;
    });
    this.phase = Math.random() * 6.28;
  }

  // pace: 0..1 奔跑强度；menace: 0..1 逼近程度（耳朵后压、身体更低）
  update(dt, pace, menace = 0) {
    this.phase += dt * (2.2 + pace * 1.6) * Math.PI * 2;
    const p = this.phase;
    this.legs.forEach((leg, i) => {
      const q = p + (leg.front ? 0 : Math.PI) + (i % 2) * 0.35;
      // 后腿自带"之"字形（大腿前倾、小腿后折）；抬腿前摆时关节折得更深
      const [baseTop, baseJoint] = leg.front ? [-0.1, 0] : [0.3, -0.5];
      leg.top.rotation.z = baseTop + Math.sin(q) * (0.55 + pace * 0.3);
      leg.joint.rotation.z = baseJoint - Math.max(0, Math.cos(q)) * 1.0;
    });
    this.body.rotation.z = Math.sin(p) * 0.08;
    this.body.position.y = 0.8 - menace * 0.06 + Math.abs(Math.sin(p)) * 0.07;
    this.head.rotation.z = -Math.sin(p) * 0.06 - menace * 0.12;
    this.tail.rotation.z = -1.75 + Math.sin(p * 0.5) * 0.15; // 尾巴向后平拖、随步伐轻摆
    this.ears.forEach((e) => (e.rotation.z = 0.25 + menace * 0.6));
  }

  dispose() {
    this.group.traverse((o) => o.geometry?.dispose());
    this.fur.dispose();
    this.eye.dispose();
  }
}
