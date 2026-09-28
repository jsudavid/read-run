import * as THREE from 'three';

// 无限滚动的低多边形地形：6 块 40m 地形块循环复用。高度取自世界坐标噪声，块重建后与邻块无缝。
// 每个三角形一个颜色（flat 风格）；可选逐面自发光（岩浆裂缝），注入到标准材质里，照样吃光照和雾。
const CHUNK = 40;
const N = 9;                                        // 覆盖场景 X∈[-340, 60]：镜头偏左看，远处左侧要铺得很远
const LEFT = -300;
const COL = 32;                                     // 每块沿 X 的格子数（1.25m）
const ZS = (() => {                                 // Z 方向行坐标：路附近密、远处疏，最远几行藏进雾里
  const z = [];
  for (let v = 14; v > -10; v -= 1) z.push(v);
  for (let v = -10; v > -40; v -= 2.5) z.push(v);
  for (let v = -40; v >= -170; v -= 10) z.push(v);
  z.push(-220, -300, -420);
  return z;
})();

function makeMaterial(glow) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.glowScale = glow;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 emissiveColor;\nvarying vec3 vEmissive;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvEmissive = emissiveColor;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vEmissive;\nuniform float glowScale;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vEmissive * glowScale;');
  };
  mat.customProgramCacheKey = () => 'terrain-emissive';
  return mat;
}

export class Terrain {
  // heightAt(wx, z) -> 米；colorAt(wx, z, h, slope, outColor, outEmissive) 写入颜色
  constructor({ heightAt, colorAt }) {
    this.heightAt = heightAt;
    this.colorAt = colorAt;
    this.glow = { value: 1 };
    this.material = makeMaterial(this.glow);
    this.group = new THREE.Group();
    this.chunks = [];
    for (let i = 0; i < N; i++) {
      const mesh = new THREE.Mesh(new THREE.BufferGeometry(), this.material);
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      const chunk = { mesh, wx: LEFT + i * CHUNK };
      this._build(chunk);
      this.chunks.push(chunk);
      this.group.add(mesh);
    }
  }

  _build(chunk) {
    const tris = COL * (ZS.length - 1) * 2;
    const pos = new Float32Array(tris * 9);
    const col = new Float32Array(tris * 9);
    const emi = new Float32Array(tris * 9);
    const c = new THREE.Color(), e = new THREE.Color();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
    const step = CHUNK / COL;
    let o = 0;
    const tri = (x1, z1, x2, z2, x3, z3) => {
      const w = chunk.wx;
      a.set(x1, this.heightAt(w + x1, z1), z1);
      b.set(x2, this.heightAt(w + x2, z2), z2);
      d.set(x3, this.heightAt(w + x3, z3), z3);
      const cx = (a.x + b.x + d.x) / 3, cz = (a.z + b.z + d.z) / 3, cy = (a.y + b.y + d.y) / 3;
      const n = b.clone().sub(a).cross(d.clone().sub(a)).normalize();
      e.setRGB(0, 0, 0);
      this.colorAt(w + cx, cz, cy, 1 - Math.abs(n.y), c, e);
      for (const v of [a, b, d]) {
        pos[o] = v.x; pos[o + 1] = v.y; pos[o + 2] = v.z;
        col[o] = c.r; col[o + 1] = c.g; col[o + 2] = c.b;
        emi[o] = e.r; emi[o + 1] = e.g; emi[o + 2] = e.b;
        o += 3;
      }
    };
    for (let j = 0; j < ZS.length - 1; j++) {
      const z0 = ZS[j], z1 = ZS[j + 1];
      for (let i = 0; i < COL; i++) {
        const x0 = i * step, x1 = x0 + step;
        tri(x0, z0, x1, z0, x0, z1);
        tri(x1, z0, x1, z1, x0, z1);
      }
    }
    const g = chunk.mesh.geometry;
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('emissiveColor', new THREE.BufferAttribute(emi, 3));
    g.computeVertexNormals();
  }

  // scroll = 已滚动的总距离（米）
  update(scroll) {
    for (const chunk of this.chunks) {
      while (chunk.wx - scroll < LEFT - CHUNK) {
        chunk.wx += CHUNK * N;
        this._build(chunk);
      }
      chunk.mesh.position.x = chunk.wx - scroll;
    }
  }

  dispose() {
    for (const chunk of this.chunks) chunk.mesh.geometry.dispose();
    this.material.dispose();
  }
}
