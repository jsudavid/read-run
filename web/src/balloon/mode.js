import * as THREE from 'three';
import { SceneView } from '../three/view.js';
import { cloudGeometry, pineGeometry } from '../three/props.js';
import { BalloonFlight } from './flight.js';

const SHOTS = [
  { id: 'side', name: '侧面伴飞', hfov: 66, pos: [0, 4, 23], look: [0, 0, 0] },
  { id: 'front', name: '迎面飞行', hfov: 66, pos: [23, 3, 4], look: [0, 0, 0] },
  { id: 'wide', name: '云海全景', hfov: 74, pos: [-22, 13, 32], look: [4, -2, 0] },
  { id: 'top', name: '俯瞰航线', hfov: 70, pos: [-6, 30, 8], look: [3, -2, 0] },
];

function mesh(geometry, color, roughness = 0.8) {
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness }));
}

function envelopeGeometry() {
  const points = [];
  for (let i = 0; i <= 28; i++) {
    const p = i / 28;
    points.push(new THREE.Vector2(Math.sin(p * Math.PI) * (2.25 + p * 1.2) + (1 - p) * 0.34, 2.9 + p * 5.7));
  }
  const geometry = new THREE.LatheGeometry(points, 72);
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  const palette = ['#f26751', '#ffe9b8', '#229b9b', '#ffe9b8'].map((color) => new THREE.Color(color));
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    palette[Math.floor(Math.floor(i / points.length) / 6) % palette.length].toArray(colors, i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geometry;
}

function starGeometry() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const angle = Math.PI / 2 + i * Math.PI / 5;
    const radius = i % 2 ? 0.45 : 1;
    const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.22, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1, steps: 1 });
  geometry.center();
  return geometry;
}

export class BalloonMode {
  constructor(renderer, { attract = false } = {}) {
    this.kind = 'balloon';
    this.renderer = renderer;
    this.attract = attract;
    this.flight = new BalloonFlight();
    this.milestone = this.flight.segmentLength;
    this.settings = { cloud: 0.7, fog: 1, exposure: 0.9, bloomBoost: 1 };
    this.on = { star: null };
    this.L = 0;
    this.time = 0;
    this.cinemaTime = 0;
    this.burst = 0;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#75bbde');
    this.scene.fog = new THREE.FogExp2('#8ac6dc', 0.003);
    this.scene.add(new THREE.HemisphereLight('#fff9e5', '#438c91', 1.15));
    this.sun = new THREE.DirectionalLight('#fff0cc', 1.8);
    this.sun.position.set(-18, 50, 25);
    this.sun.castShadow = true;
    Object.assign(this.sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 100 });
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun, this.sun.target);
    this.rig = { camera: new THREE.PerspectiveCamera(50, 1, 0.1, 600) };
    this.focus = new THREE.Vector3(0, 4.2, 0);
    this.offset = new THREE.Vector3();
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this._buildBalloon();
    this._buildWorld();
    renderer.attach(this.scene, this.rig.camera);
    this.view = new SceneView(this.rig.camera, renderer.canvas, SHOTS, {
      minDistance: 9, maxDistance: 75, maxPan: 12, groundHeight: () => -15,
    });
    this.view.interactive = !attract;
    this.applyTier(renderer.tier);
    this.update(0, 0, 0);
  }

  _buildBalloon() {
    const shell = new THREE.Mesh(envelopeGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }));
    this.group.add(shell);
    const collar = mesh(new THREE.TorusGeometry(0.39, 0.09, 8, 24), '#eff2da');
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 2.95;
    this.group.add(collar);
    const basket = mesh(new THREE.BoxGeometry(2, 0.95, 1.55), '#d7a762');
    basket.position.y = 0.65;
    this.group.add(basket);
    const rim = mesh(new THREE.BoxGeometry(2.14, 0.14, 1.69), '#fff0ce');
    rim.position.y = 1.17;
    this.group.add(rim);
    const weaveMaterial = new THREE.MeshStandardMaterial({ color: '#93602e' });
    const stripGeometry = new THREE.BoxGeometry(2.02, 0.025, 1.57);
    for (let i = 0; i < 7; i++) {
      const strip = new THREE.Mesh(stripGeometry, weaveMaterial);
      strip.position.y = 0.27 + i * 0.12;
      this.group.add(strip);
    }
    const ropeGeometry = new THREE.CylinderGeometry(0.025, 0.025, 2.3, 6);
    const ropeMaterial = new THREE.MeshStandardMaterial({ color: '#f8edd8' });
    for (const x of [-0.85, 0.85]) for (const z of [-0.63, 0.63]) {
      const rope = new THREE.Mesh(ropeGeometry, ropeMaterial);
      rope.position.set(x, 2.1, z);
      rope.rotation.z = -x * 0.22;
      this.group.add(rope);
    }
    const torso = mesh(new THREE.CapsuleGeometry(0.26, 0.45, 4, 12), '#228f98');
    torso.position.set(0.15, 1.4, 0);
    this.group.add(torso);
    const head = mesh(new THREE.SphereGeometry(0.29, 16, 12), '#f1c4a0');
    head.position.set(0.15, 1.95, 0);
    this.group.add(head);
    const hat = mesh(new THREE.CylinderGeometry(0.32, 0.35, 0.16, 16), '#fff2d6');
    hat.position.set(0.15, 2.2, 0);
    this.group.add(hat);
    const brim = mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.045, 16), '#ef7054');
    brim.position.set(0.15, 2.14, 0);
    this.group.add(brim);
    this.flame = mesh(new THREE.ConeGeometry(0.16, 0.6, 8), '#ffba47');
    this.flame.material.emissive.set('#ff8434');
    this.flame.material.emissiveIntensity = 2;
    this.flame.position.y = 2.65;
    this.group.add(this.flame);
    this.badge = new THREE.Sprite(new THREE.SpriteMaterial({ depthWrite: false, transparent: true }));
    this.badge.scale.set(1.25, 1.25, 1.25);
    this.badge.position.set(0, 1, 1.02);
    this.badge.visible = false;
    this.group.add(this.badge);
    this.group.traverse((object) => {
      if (object.isMesh) object.castShadow = object.receiveShadow = true;
    });
  }

  _buildWorld() {
    const sea = mesh(new THREE.PlaneGeometry(1100, 1100), '#298fab', 0.35);
    sea.rotation.x = -Math.PI / 2;
    sea.position.y = -17;
    this.scene.add(sea);
    const cloudGeo = cloudGeometry();
    const cloudMat = new THREE.MeshStandardMaterial({ color: '#fffaf1', roughness: 1 });
    this.clouds = Array.from({ length: 34 }, (_, i) => {
      const cloud = new THREE.Mesh(cloudGeo, cloudMat);
      const x = (i * 47) % 260 - 90, z = (i % 2 ? 1 : -1) * (12 + (i * 13) % 52);
      const y = 3 + (i * 17) % 32;
      cloud.scale.setScalar(2 + (i % 4) * 0.8);
      cloud.position.set(x, y, z);
      this.scene.add(cloud);
      return { mesh: cloud, x, y, z };
    });
    this.landingCloud = new THREE.Mesh(cloudGeo, cloudMat.clone());
    this.landingCloud.scale.set(2.1, 0.75, 2.3);
    this.landingCloud.position.set(0, -0.65, 0);
    this.landingCloud.material.transparent = true;
    this.landingCloud.receiveShadow = true;
    this.scene.add(this.landingCloud);
    const rockGeo = new THREE.IcosahedronGeometry(1, 1);
    const rockMat = new THREE.MeshStandardMaterial({ color: '#6caa91', flatShading: true });
    const treeGeo = pineGeometry('#418d6d', '#ad8660');
    const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true });
    this.islands = Array.from({ length: 12 }, (_, i) => {
      const island = new THREE.Group();
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.scale.set(8 + i % 4, 4, 7 + i % 3);
      island.add(rock);
      for (let j = 0; j < 5; j++) {
        const tree = new THREE.Mesh(treeGeo, treeMat);
        tree.position.set(Math.sin(j * 2.4) * 4, 2.8, Math.cos(j * 2.4) * 3);
        tree.scale.setScalar(1.2);
        island.add(tree);
      }
      const x = i * 37 - 100, z = (i % 2 ? 1 : -1) * (24 + i % 4 * 13);
      island.position.set(x, -10, z);
      this.scene.add(island);
      return { mesh: island, x };
    });
    this.stars = Array.from({ length: 6 }, (_, i) => {
      const star = mesh(starGeometry(), '#ffd45c', 0.3);
      star.material.emissive.set('#ffd04b');
      star.material.emissiveIntensity = 0.35;
      this.scene.add(star);
      return star;
    });
    this.beacon = new THREE.Group();
    const ring = mesh(new THREE.TorusGeometry(6, 0.16, 8, 64), '#fff2ad');
    ring.rotation.y = Math.PI / 2;
    ring.material.emissive.set('#efc45a');
    ring.material.emissiveIntensity = 0.5;
    this.beacon.add(ring);
    const beaconCloud = new THREE.Mesh(cloudGeo, cloudMat);
    beaconCloud.position.y = -7;
    beaconCloud.scale.setScalar(2.6);
    this.beacon.add(beaconCloud);
    this.scene.add(this.beacon);
    this.sparkles = Array.from({ length: 18 }, () => {
      const sparkle = mesh(new THREE.OctahedronGeometry(0.12), '#ffdc73');
      sparkle.material.emissive.set('#ffdc73');
      sparkle.material.emissiveIntensity = 1;
      sparkle.visible = false;
      this.scene.add(sparkle);
      return sparkle;
    });
  }

  get meters() { return this.flight.meters; }

  applyTier(tier) {
    this.sun.castShadow = tier.shadow > 0;
    if (tier.shadow && this.sun.shadow.mapSize.x !== tier.shadow) {
      this.sun.shadow.mapSize.set(tier.shadow, tier.shadow);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  update(dt, level, t) {
    const flight = this.flight;
    const previousStars = flight.stars;
    this.L = level;
    flight.update(level, dt);
    if (flight.stars > previousStars) {
      this.burst = 1;
      if (!this.attract) this.on.star?.(flight.stars);
    }
    this.time += dt;
    this.burst = Math.max(0, this.burst - dt);
    this.group.position.y = flight.altitude;
    this.group.rotation.z = Math.sin(this.time * 0.8) * 0.025 * Math.min(1, flight.altitude);
    this.group.rotation.x = Math.sin(this.time * 0.5) * 0.018 * Math.min(1, flight.altitude);
    this.flame.visible = flight.qualified;
    this.flame.scale.y = 0.8 + Math.sin(this.time * 19) * 0.2;
    this.landingCloud.visible = flight.altitude < 6;
    this.landingCloud.material.opacity = Math.max(0, 1 - flight.altitude / 6);
    for (let i = 0; i < this.clouds.length; i++) {
      const cloud = this.clouds[i];
      cloud.mesh.position.x = ((cloud.x - flight.meters * 0.65 + 10000) % 260) - 90;
      cloud.mesh.position.y = cloud.y + Math.sin(this.time * 0.1 + i) * 0.8;
    }
    for (const island of this.islands) island.mesh.position.x = ((island.x - flight.meters + 10000) % 440) - 100;
    for (let i = 0; i < this.stars.length; i++) {
      const index = flight.nextStarIndex + i;
      const distance = index * flight.starEvery - flight.meters;
      const pull = flight.qualified && flight.altitude >= 8 ? Math.max(0, 1 - distance / 14) : 0;
      const height = 12 + Math.sin(index * 1.8) * 3;
      this.stars[i].position.set(distance, THREE.MathUtils.lerp(height, flight.altitude + 3, pull), 0);
      this.stars[i].rotation.y = this.time * 1.2 + i;
      this.stars[i].rotation.z = Math.sin(this.time * 2 + i) * 0.15;
    }
    this.beacon.position.set((flight.segments + 1) * flight.segmentLength - flight.meters, 36, 0);
    this.beacon.rotation.x = Math.sin(this.time * 0.4) * 0.05;
    for (let i = 0; i < this.sparkles.length; i++) {
      const angle = i * Math.PI * 2 / this.sparkles.length;
      const spread = (1 - this.burst) * 6;
      this.sparkles[i].visible = this.burst > 0;
      this.sparkles[i].position.set(Math.cos(angle) * spread, flight.altitude + 4 + Math.sin(angle) * spread, Math.sin(i * 2.4) * spread);
      this.sparkles[i].scale.setScalar(this.burst);
    }
    this.sun.position.y = flight.altitude + 50;
    this.sun.target.position.y = flight.altitude + 3;
    this.updateCamera(dt, t);
  }

  updateCamera(dt, t, paused = false) {
    this.scene.fog.density = 0.003 * this.settings.fog;
    this.renderer.setExposure(this.settings.exposure);
    if (this.renderer.bloom) this.renderer.bloom.strength = 0.25 * this.settings.bloomBoost;
    this.clouds.forEach((cloud, i) => { cloud.mesh.visible = i < Math.round(this.settings.cloud * this.clouds.length); });
    this.focus.set(0, this.flight.altitude + 4.2, 0);
    const camera = this.rig.camera;
    if (this.view.automatic) {
      if (this.view.id === 'cine') this.cinemaTime += paused ? 0 : dt;
      const angle = this.view.id === 'cine' ? Math.sin(this.cinemaTime * 0.16) * 1.4 : -0.4;
      this.view.hfov = 66;
      const fit = this.view.applyLens();
      this.offset.set(Math.sin(angle) * 27, this.view.id === 'cine' ? 4 + Math.sin(this.cinemaTime * 0.2) * 4 : 5, Math.cos(angle) * 27);
      camera.position.copy(this.focus).addScaledVector(this.offset, fit);
      camera.lookAt(this.focus);
    }
    this.view.update(paused && this.view.id === 'free' ? 0 : dt, this.focus);
  }

  render(t) { this.renderer.render(t); }
  celebrate() { this.burst = 1; }

  setPhoto(canvas) {
    const material = this.badge.material;
    material.map?.dispose();
    material.map = new THREE.CanvasTexture(canvas);
    material.map.colorSpace = THREE.SRGBColorSpace;
    material.needsUpdate = true;
    this.badge.visible = true;
  }

  clearPhoto() { this.badge.visible = false; }

  get hud() {
    const f = this.flight;
    return { kind: this.kind, level: this.L, altitude: f.altitude, meters: f.meters, stars: f.stars, segments: f.segments, streak: f.streak, qualified: f.qualified, grounded: f.grounded, rising: f.velocity > 0.1, segmentProgress: (f.meters % f.segmentLength) / f.segmentLength };
  }

  dispose() {
    this.view.dispose();
    const resources = new Set();
    this.scene.traverse((object) => {
      if (object.geometry) resources.add(object.geometry);
      for (const material of [object.material].flat()) {
        if (!material) continue;
        if (material.map) resources.add(material.map);
        resources.add(material);
      }
    });
    for (const resource of resources) resource.dispose();
    this.sun.shadow.map?.dispose();
  }
}
