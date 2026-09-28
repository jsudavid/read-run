import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// 道具几何：几个基本体合并成一个几何，配合 InstancedMesh 一次画几百个。零贴图。
function tint(geo, hex) {
  const c = new THREE.Color(hex);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(arr, i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}

// 松树：三层圆锥 + 树干，约 2.9m 高（实例缩放）
export function pineGeometry(foliage = '#3f6b3a', trunk = '#5a4030') {
  const parts = [tint(new THREE.CylinderGeometry(0.12, 0.16, 0.8, 5).translate(0, 0.4, 0), trunk)];
  for (const [r, h, y] of [[1.1, 1.4, 0.75], [0.85, 1.2, 1.45], [0.55, 1.0, 2.1]]) {
    parts.push(tint(new THREE.ConeGeometry(r, h, 7).translate(0, y + h / 2 - 0.2, 0), foliage));
  }
  return mergeGeometries(parts);
}

// 草丛：几片倾斜的细圆锥
export function grassGeometry(color = '#6f9a4e') {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.ConeGeometry(0.05, 0.45 + i * 0.07, 3).translate(0, 0.22, 0);
    g.rotateZ((i - 1.5) * 0.25).rotateY(i * 1.7);
    parts.push(tint(g, color));
  }
  return mergeGeometries(parts);
}

// 云朵：几团压扁的多面体
export function cloudGeometry() {
  const blobs = [[0, 0, 0, 1.6], [1.6, -0.2, 0.3, 1.2], [-1.5, -0.3, -0.2, 1.1], [0.5, 0.6, -0.4, 1.0], [-0.6, 0.4, 0.5, 0.9]];
  return mergeGeometries(blobs.map(([x, y, z, r]) => new THREE.IcosahedronGeometry(r, 1).scale(1, 0.62, 0.8).translate(x, y, z)));
}

// 枯树：树干 + 几根斜枝
export function deadTreeGeometry() {
  const parts = [new THREE.CylinderGeometry(0.08, 0.2, 3, 5).translate(0, 1.5, 0)];
  for (const [rz, y, ry, len] of [[0.9, 1.8, 0.7, 0.9], [-0.8, 2.3, -0.5, 0.7], [0.5, 2.6, 0.9, 0.5]]) {
    parts.push(new THREE.CylinderGeometry(0.03, 0.07, len, 4).translate(0, len / 2, 0).rotateZ(rz).rotateY(ry).translate(0, y, 0));
  }
  return mergeGeometries(parts);
}

// 柔光贴图（火山口辉光等），按尺寸缓存
const glowCache = new Map();
export function glowTexture(size = 128) {
  if (glowCache.has(size)) return glowCache.get(size);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  glowCache.set(size, tex);
  return tex;
}
