// 移植自 riba2534/claude-opus-5-5-demo · pelican-bike/src/main.js（场景、光照、骑手、特效的搭建）
// ref/ 目录下为原作者代码原样复制；本文件只做了拆分与画质档位对接。
import * as THREE from 'three';
import { createSky } from './ref/sky.js';
import { createOcean } from './ref/ocean.js';
import { createWorld } from './ref/world.js';
import { createBicycle, BIKE_POINTS } from './ref/bicycle.js';
import { createPelican } from './ref/pelican.js';
import { fishGeometry } from './ref/fish.js';
import { Particles, Confetti, SpeedLines, Scarf } from './ref/effects.js';
import { makeSpriteTexture } from './ref/textures.js';

// 与本项目 Renderer 的 low/mid/high 档位对应
export const PRESET = {
  low: { shadow: 1024, bloom: false, msaa: 0, density: 0.5 },
  mid: { shadow: 2048, bloom: true, msaa: 2, density: 0.8 },
  high: { shadow: 2048, bloom: true, msaa: 4, density: 1 },
};

export function buildStage(tierName) {
  const q = PRESET[tierName] || PRESET.mid;
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0xffffff, 0.0052);
  const camera = new THREE.PerspectiveCamera(42, 16 / 9, 0.05, 900);
  scene.add(camera);

  const sky = createSky();
  scene.add(sky.mesh);
  const envScene = new THREE.Scene();
  envScene.add(sky.envMesh);

  const hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
  const sun = new THREE.DirectionalLight(0xffffff, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(q.shadow, q.shadow);
  const s = 7.5;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 1, far: 80 });
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.025;
  sun.shadow.radius = 2.5;
  scene.add(hemi, sun, sun.target);
  const lampLights = [new THREE.PointLight('#ffc27a', 0, 14, 1.6), new THREE.PointLight('#ffc27a', 0, 14, 1.6)];
  lampLights.forEach((l) => scene.add(l));
  // 夜间跟随相机的柔和补光，保证主角可读
  const fillLight = new THREE.PointLight('#b9c8ff', 0, 10, 1.2);
  fillLight.position.set(0.6, 0.8, 0.5);
  camera.add(fillLight);

  const ocean = createOcean();
  scene.add(ocean.mesh);
  const world = createWorld(scene, { density: q.density });

  const rider = new THREE.Group();
  rider.rotation.order = 'YXZ';
  const wheelieRoot = new THREE.Group();
  wheelieRoot.position.set(BIKE_POINTS.rearHub.x, 0, 0);
  rider.add(wheelieRoot);
  const content = new THREE.Group();
  content.position.set(-BIKE_POINTS.rearHub.x, 0, 0);
  wheelieRoot.add(content);
  const bike = createBicycle();
  const pelican = createPelican();
  content.add(bike.group, pelican.root);
  scene.add(rider);

  const sprite = makeSpriteTexture();
  const fx = {
    dust: new Particles(scene, 420, { additive: false, opacity: 0.35 }),
    sparkles: new Particles(scene, 360, { additive: true }),
    splash: new Particles(scene, 360, { additive: false }),
    confetti: new Confetti(scene),
    speedLines: new SpeedLines(camera),
    scarf: new Scarf(scene),
  };

  // 可收集的鱼 + 跃出海面的鱼
  const fishGeo = fishGeometry();
  const fishMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.25, emissive: new THREE.Color('#1f6b8f'), emissiveIntensity: 0.45, side: THREE.DoubleSide });
  const goldMat = new THREE.MeshStandardMaterial({ color: '#ffcf3f', metalness: 1, roughness: 0.18, emissive: new THREE.Color('#ff9500'), emissiveIntensity: 0.9, side: THREE.DoubleSide });
  const fishes = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.Mesh(fishGeo, fishMat);
    m.scale.setScalar(1.35);
    m.castShadow = true;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: '#7fe3ff', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(0.9);
    m.add(halo);
    m.visible = false;
    scene.add(m);
    fishes.push({ mesh: m, halo, active: false, x: 0, y: 0, z: 0, golden: false, phase: 0, caught: -1 });
  }
  const jumpers = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(fishGeo, fishMat);
    m.scale.setScalar(1.8);
    m.visible = false;
    scene.add(m);
    jumpers.push({ mesh: m, t: -1, x: 0, z: 0, dur: 1.2, h: 1.5, dir: 1 });
  }

  // 今日主角：车尾插一根安全旗杆，旗面是照片徽章（没照片时隐藏）
  const flag = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 1.05, 6), new THREE.MeshStandardMaterial({ color: '#e8e2d6', roughness: 0.4, metalness: 0.3 }));
  pole.position.y = 0.525;
  const badge = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
  badge.scale.setScalar(0.34);
  badge.position.y = 1.18;
  flag.add(pole, badge);
  flag.position.set(BIKE_POINTS.rearHub.x - 0.08, 0.62, 0.1);
  flag.visible = false;
  content.add(flag);

  return {
    q, scene, camera, sky, envScene, hemi, sun, lampLights, fillLight, ocean, world,
    rider, wheelieRoot, bike, pelican, sprite, fx, fishes, jumpers, fishMat, goldMat,
    flag, badge, lampPos: [new THREE.Vector3(), new THREE.Vector3()],
  };
}
