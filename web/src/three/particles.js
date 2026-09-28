import * as THREE from 'three';

// 点精灵粒子池：柔光圆点，按世界尺寸缩放，加色混合（亮色会被泛光放大）。
// CPU 更新（几百个，开销很小）；死亡粒子与末尾交换，绘制范围始终连续。
const F = ['pos', 'vel', 'col'];
const S = ['life', 'maxLife', 'size', 'alpha', 'drag', 'grav', 'flicker'];

export class Particles {
  constructor({ max = 400, additive = true } = {}) {
    this.max = max;
    this.count = 0;
    for (const k of F) this[k] = new Float32Array(max * 3);
    for (const k of S) this[k] = new Float32Array(max);
    this.geometry = new THREE.BufferGeometry();
    const dyn = (arr, n) => new THREE.BufferAttribute(arr, n).setUsage(THREE.DynamicDrawUsage);
    this.aPos = dyn(this.pos, 3);
    this.aCol = dyn(this.col, 3);
    this.aSize = dyn(this.size, 1);
    this.aAlpha = dyn(this.alpha, 1);
    this.geometry.setAttribute('position', this.aPos);
    this.geometry.setAttribute('aColor', this.aCol);
    this.geometry.setAttribute('aSize', this.aSize);
    this.geometry.setAttribute('aAlpha', this.aAlpha);
    this.geometry.setDrawRange(0, 0);
    this.material = new THREE.ShaderMaterial({
      uniforms: { scale: { value: 800 } },
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aColor; attribute float aSize; attribute float aAlpha;
        uniform float scale; varying vec3 vColor; varying float vAlpha;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * scale / max(0.1, -mv.z);
          vColor = aColor; vAlpha = aAlpha;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vColor; varying float vAlpha;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d); a *= a * vAlpha;
          gl_FragColor = vec4(vColor, a); // 混合模式负责乘 alpha（加色/普通混合都正确）
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.points = new THREE.Points(this.geometry, this.material);
    this.points.frustumCulled = false;
  }

  // o: { x,y,z, vx,vy,vz, life, size, color:Color|[r,g,b], drag, grav, flicker }
  emit(o) {
    if (this.count >= this.max) return;
    const i = this.count++, k = i * 3;
    this.pos[k] = o.x; this.pos[k + 1] = o.y; this.pos[k + 2] = o.z;
    this.vel[k] = o.vx || 0; this.vel[k + 1] = o.vy || 0; this.vel[k + 2] = o.vz || 0;
    const c = o.color;
    this.col[k] = c.r ?? c[0]; this.col[k + 1] = c.g ?? c[1]; this.col[k + 2] = c.b ?? c[2];
    this.life[i] = this.maxLife[i] = o.life || 1;
    this.size[i] = o.size || 0.1;
    this.drag[i] = o.drag || 0;
    this.grav[i] = o.grav || 0;
    this.flicker[i] = o.flicker || 0;
    this.alpha[i] = 0;
  }

  _swap(i, j) {
    for (const k of F) for (let n = 0; n < 3; n++) this[k][i * 3 + n] = this[k][j * 3 + n];
    for (const k of S) this[k][i] = this[k][j];
  }

  // dx：本帧世界滚动量（粒子留在原地、随世界后退）；viewH/fov 用于把世界尺寸换算成像素
  update(dt, dx, t, viewH, fovDeg) {
    let n = this.count;
    for (let i = 0; i < n; ) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) { this._swap(i, --n); continue; }
      const k = i * 3, drag = Math.exp(-this.drag[i] * dt);
      this.vel[k] *= drag;
      this.vel[k + 1] = this.vel[k + 1] * drag - this.grav[i] * dt;
      this.vel[k + 2] *= drag;
      this.pos[k] += this.vel[k] * dt - dx;
      this.pos[k + 1] += this.vel[k + 1] * dt;
      this.pos[k + 2] += this.vel[k + 2] * dt;
      const lt = this.life[i] / this.maxLife[i];
      let a = Math.min(1, (1 - lt) / 0.15) * Math.min(1, lt / 0.4);
      if (this.flicker[i] > 0) a *= 0.55 + 0.45 * Math.sin(t * this.flicker[i] + i * 1.7);
      this.alpha[i] = a;
      i++;
    }
    this.count = n;
    this.geometry.setDrawRange(0, n);
    this.material.uniforms.scale.value = viewH / (2 * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2));
    this.aPos.needsUpdate = this.aCol.needsUpdate = this.aSize.needsUpdate = this.aAlpha.needsUpdate = true;
  }

  clear() {
    this.count = 0;
    this.geometry.setDrawRange(0, 0);
  }

  dispose() {
    this.geometry.dispose();
    this.material.dispose();
  }
}
