import * as THREE from 'three';

// 天空穹顶：三段渐变 + 太阳光晕/日轮 + 程序化星空（整颗星按格子哈希生成，远看不闪烁）。
// 颜色都在线性空间里，渲染到后处理目标时由收尾 pass 统一色调映射；直出时由 three 的色调映射 chunk 处理。
export class SkyDome {
  constructor() {
    this.uniforms = {
      topColor: { value: new THREE.Color() },
      midColor: { value: new THREE.Color() },
      horizonColor: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0.4, 0.1, -1).normalize() },
      sunColor: { value: new THREE.Color(1, 0.8, 0.55) },
      sunIntensity: { value: 1 },
      discIntensity: { value: 1 },
      starIntensity: { value: 1 },
      time: { value: 0 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 topColor, midColor, horizonColor, sunColor, sunDir;
        uniform float sunIntensity, discIntensity, starIntensity, time;
        varying vec3 vDir;
        float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        void main() {
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 col = mix(horizonColor, midColor, smoothstep(-0.02, 0.22, h));
          col = mix(col, topColor, smoothstep(0.18, 0.75, h));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          col += sunColor * (pow(s, 7.0) * 0.45 + pow(s, 48.0) * 0.8) * sunIntensity;
          col += sunColor * smoothstep(0.9993, 0.9997, s) * 4.0 * sunIntensity * discIntensity;
          // 星空：每个格子最多一颗星，按到星心的距离画圆点
          vec3 g = d * 70.0;
          vec3 cell = floor(g);
          float r = hash3(cell);
          if (r > 0.92) {
            vec3 c = cell + 0.25 + 0.5 * vec3(hash3(cell + 1.7), hash3(cell + 3.1), hash3(cell + 5.3));
            float star = smoothstep(0.1, 0.0, length(g - c));
            float tw = 0.65 + 0.35 * sin(time * (1.5 + r * 3.0) + r * 60.0);
            col += vec3(0.95, 0.97, 1.0) * star * tw * smoothstep(0.05, 0.35, h) * starIntensity * 1.6;
          }
          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), mat);
    this.mesh.renderOrder = -10;
    this.mesh.frustumCulled = false;
  }

  // p: { top, mid, horizon, sun, sunIntensity, stars, sunDir }
  apply(p) {
    const u = this.uniforms;
    u.topColor.value.copy(p.top);
    u.midColor.value.copy(p.mid);
    u.horizonColor.value.copy(p.horizon);
    u.sunColor.value.copy(p.sun);
    u.sunIntensity.value = p.sunIntensity;
    u.discIntensity.value = p.disc ?? 1;
    u.starIntensity.value = p.stars;
    if (p.sunDir) u.sunDir.value.copy(p.sunDir).normalize();
  }

  update(t) {
    this.uniforms.time.value = t;
  }
}

// 调色板插值：stops = [{ at, top, mid, horizon, sun, fog, sunIntensity, stars, sunY }...]（颜色为 hex）
export function samplePalette(stops, x, out) {
  let i = 0;
  while (i < stops.length - 2 && x > stops[i + 1].at) i++;
  const a = stops[i], b = stops[i + 1];
  const t = THREE.MathUtils.clamp((x - a.at) / (b.at - a.at), 0, 1);
  // 每帧都会调用：hex 解析结果缓存在 stop 上，避免整节课持续分配对象
  const col = (s, k) => ((s._c ||= {})[k] ||= new THREE.Color(s[k]));
  for (const k of ['top', 'mid', 'horizon', 'sun', 'fog', 'light', 'hemiSky', 'hemiGround']) {
    if (a[k] === undefined) continue;
    out[k] = (out[k] || new THREE.Color()).lerpColors(col(a, k), col(b, k), t);
  }
  for (const k of ['sunIntensity', 'disc', 'stars', 'sunY', 'lightIntensity', 'hemiIntensity', 'exposure']) {
    if (a[k] === undefined) continue;
    out[k] = a[k] + (b[k] - a[k]) * t;
  }
  return out;
}
