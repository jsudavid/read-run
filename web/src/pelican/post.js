// 移植自 riba2534/claude-opus-5-5-demo · pelican-bike/src/main.js · 后期（NaN 清理 + 泛光 + 调色）
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// 泛光前清理 NaN/Inf：一个坏像素会被 Bloom 的多级模糊扩散成大块黑色矩形。
// 用位运算判断（不依赖 isnan，避免被驱动的快速数学优化掉），并把 HDR 值限制在安全范围内
const sanitizeShader = {
  uniforms: { tDiffuse: { value: null } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; varying vec2 vUv;
    float fixf(float x) {
      uint b = floatBitsToUint(x);
      if ((b & 0x7f800000u) == 0x7f800000u) return ((b & 0x007fffffu) == 0u && (b & 0x80000000u) == 0u) ? 48.0 : 0.0;
      return clamp(x, 0.0, 48.0);
    }
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; gl_FragColor = vec4(fixf(c.r), fixf(c.g), fixf(c.b), 1.0); }`,
};
const colorGrade = {
  uniforms: {
    tDiffuse: { value: null },
    uVignette: { value: 0.28 },
    uAberration: { value: 0 },
    uGrain: { value: 0.035 },
    uTime: { value: 0 },
    uWarm: { value: 0 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uVignette; uniform float uAberration; uniform float uGrain; uniform float uTime; uniform float uWarm; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
    void main(){
      vec2 c = vUv - 0.5; float r = length(c);
      vec2 off = c * uAberration * r;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      col *= mix(1.0, smoothstep(0.85, 0.2, r), uVignette);
      col *= mix(vec3(1.0), vec3(1.06, 1.0, 0.92), uWarm);
      col *= 1.0 + (h(vUv * 1000.0 + fract(uTime)) - 0.5) * uGrain * 2.0;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

// 低档（无泛光）返回空后期，直接渲染到屏幕，色调映射由渲染器完成
export function buildPost(gl, tier, scene, camera, old) {
  if (old?.composer) {
    old.composer.passes.forEach((p) => p.dispose?.());
    old.composer.dispose();
  }
  if (!tier.bloom) return { composer: null, bloom: null, grade: null };
  const size = gl.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: tier.msaa });
  const composer = new EffectComposer(gl, rt);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new ShaderPass(sanitizeShader));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.4, 0.55, 0.92);
  composer.addPass(bloom);
  const grade = new ShaderPass(colorGrade);
  composer.addPass(grade);
  composer.addPass(new OutputPass());
  return { composer, bloom, grade };
}
