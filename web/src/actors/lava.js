import * as THREE from 'three';

// 岩浆前锋：一堵向前翻卷的熔岩墙从后方推进，身后拖着一片发光的熔岩湖。
// 纹理全部程序化：流动的 fbm 噪声分出"暗色结壳"与"炽热裂隙"，炽热处亮度 >1 交给泛光。
const NOISE = /* glsl */ `
  float h2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n2(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(h2(i), h2(i + vec2(1, 0)), f.x), mix(h2(i + vec2(0, 1)), h2(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * n2(p); p *= 2.03; a *= 0.5; } return s; }
  // 以橙色为主，只有最烫的裂隙芯才到黄白；没有泛光的低档直出也不会糊成一片白
  vec3 heat(float k) {
    vec3 c = mix(vec3(0.22, 0.02, 0.0), vec3(1.6, 0.3, 0.02), smoothstep(0.0, 0.5, k));
    c = mix(c, vec3(2.8, 1.0, 0.12), smoothstep(0.5, 0.85, k));
    return mix(c, vec3(4.2, 2.4, 0.7), smoothstep(0.9, 1.0, k));
  }
`;
const OUT = `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
`;

const WAVE_VS = /* glsl */ `
  uniform float uTime; varying vec2 vUv; varying vec3 vPos;
  #include <fog_pars_vertex>
  ${NOISE}
  void main() {
    vUv = uv; vec3 p = position; float t = uv.y;
    p.x += (n2(vec2(p.z * 0.35, t * 3.0 - uTime * 0.8)) - 0.5) * 0.9 * (0.3 + t);
    p.y += (n2(vec2(p.z * 0.25 + 7.0, uTime * 0.5)) - 0.5) * 2.2 * t;
    vPos = p;
    vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const WAVE_FS = /* glsl */ `
  uniform float uTime, uHeat; varying vec2 vUv; varying vec3 vPos;
  #include <fog_pars_fragment>
  ${NOISE}
  void main() {
    vec2 q = vec2(vPos.z * 0.22, vPos.y * 0.3 - uTime * 0.35);
    float f = fbm(q + fbm(q * 1.7 + uTime * 0.1));
    float crust = smoothstep(0.36, 0.47, f);
    float k = (smoothstep(0.36, 0.14, f) * 0.75 + (1.0 - vUv.y) * 0.3) * (0.8 + uHeat * 0.3);
    vec3 col = mix(heat(k), vec3(0.05, 0.025, 0.02), crust);
    col += vec3(0.3, 0.05, 0.0) * crust * (1.0 - vUv.y) * (1.0 - vUv.y); // 结壳底部的余温
    gl_FragColor = vec4(col, 1.0);
    ${OUT}
  }`;
const FLOOR_VS = /* glsl */ `
  varying vec2 vUv; varying vec3 vPos;
  #include <fog_pars_vertex>
  void main() {
    vUv = uv; vPos = position;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }`;
const FLOOR_FS = /* glsl */ `
  uniform float uTime, uHeat, uScroll; varying vec2 vUv; varying vec3 vPos;
  #include <fog_pars_fragment>
  ${NOISE}
  void main() {
    vec2 q = vec2((vPos.x + uScroll) * 0.12, vPos.z * 0.12);
    float f = fbm(q + vec2(uTime * 0.05, 0.0) + fbm(q * 2.0 - uTime * 0.08));
    float crack = 1.0 - smoothstep(0.02, 0.08, abs(f - 0.5));
    float front = smoothstep(-6.0, 0.0, vPos.x);
    float k = clamp(crack * 0.85 + front * 0.5, 0.0, 1.0) * (0.8 + uHeat * 0.3);
    gl_FragColor = vec4(mix(vec3(0.04, 0.02, 0.018), heat(k), max(crack, front * 0.8)), 1.0);
    ${OUT}
  }`;

// 墙面：沿 Z 展开，顶部向 +X（主角方向）翻卷
function waveGeometry() {
  const W = 48, H = 16, z0 = -40, z1 = 10;
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= H; j++) {
    const v = j / H;
    for (let i = 0; i <= W; i++) {
      const z = z0 + (z1 - z0) * (i / W);
      const height = 3 + 2.5 * Math.exp(-((z / 14) ** 2)); // 路上最高 5.5m，往两侧矮下去，不像一座山
      pos.push((2.2 * v * v - 0.3 * Math.sin(v * Math.PI)) * (height / 5.5), v * height, z);
      uv.push(i / W, v);
    }
  }
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const a = j * (W + 1) + i, c = a + W + 1;
      idx.push(a, a + 1, c, a + 1, c + 1, c);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  return g;
}

export class LavaFront {
  constructor() {
    this.uniforms = { uTime: { value: 0 }, uHeat: { value: 0 }, uScroll: { value: 0 } };
    const mat = (vertexShader, fragmentShader) => new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...this.uniforms },
      vertexShader, fragmentShader, fog: true, side: THREE.DoubleSide,
    });
    this.group = new THREE.Group();
    this.wave = new THREE.Mesh(waveGeometry(), mat(WAVE_VS, WAVE_FS));
    this.floor = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90, 1, 1).rotateX(-Math.PI / 2).translate(-45, 0.05, -20),
      mat(FLOOR_VS, FLOOR_FS)
    );
    this.wave.frustumCulled = this.floor.frustumCulled = false;
    this.light = new THREE.PointLight(0xff6a20, 10, 40, 2);
    this.light.position.set(1.8, 1.6, 0);
    this.group.add(this.wave, this.floor, this.light);
  }

  update(dt, t, gap, heat, scroll, glow) {
    this.group.position.x = -gap;
    this.uniforms.uTime.value = t;
    this.uniforms.uHeat.value = heat;
    this.uniforms.uScroll.value = scroll - gap;
    this.light.intensity = (10 + heat * 45) * (0.85 + 0.15 * Math.sin(t * 9) * Math.sin(t * 5.3));
    const n = Math.floor(Math.random() + 0.5 + heat * 1.6);
    for (let i = 0; i < n; i++) {
      glow.emit({
        x: -gap + 0.3 + Math.random() * 1.8, y: Math.random() * 6, z: -6 + Math.random() * 14,
        vx: 1 + Math.random() * 2, vy: 1 + Math.random() * 2.5, vz: (Math.random() - 0.5),
        life: 1.2 + Math.random() * 1.2, size: 0.06 + Math.random() * 0.07,
        color: [4, 1.3, 0.25], grav: 1.5, flicker: 8 + Math.random() * 6,
      });
    }
  }

  // 被追上：主角身后溅起一片火星
  splash(glow) {
    for (let i = 0; i < 60; i++) {
      glow.emit({
        x: -0.4, y: 0.6 + Math.random() * 1.4, z: (Math.random() - 0.5) * 1.5,
        vx: 1 + Math.random() * 4, vy: 2 + Math.random() * 5, vz: (Math.random() - 0.5) * 4,
        life: 0.8 + Math.random() * 0.8, size: 0.06 + Math.random() * 0.08, color: [5, 1.6, 0.3], grav: 6, drag: 1,
      });
    }
  }
}
