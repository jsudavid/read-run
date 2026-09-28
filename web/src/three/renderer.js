import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

// 画质分档。教室电脑多为核显：先降分辨率，实在不行再降档（NFR-04 整节课不卡）。
const TIERS = {
  low: { dpr: 1.0, shadow: 0, bloom: false, msaa: 0 },
  mid: { dpr: 1.25, shadow: 1024, bloom: true, msaa: 2 },
  high: { dpr: 2.0, shadow: 2048, bloom: true, msaa: 4 },
};
const ORDER = ['low', 'mid', 'high'];

function guessTier(gl) {
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
  if (/swiftshader|llvmpipe|software|basic render/i.test(name)) return 'low';
  if (/nvidia|geforce|radeon rx|apple m\d|arc/i.test(name)) return 'high';
  return 'mid';
}

// 收尾：ACES 色调映射 + sRGB + 抖动（投影上的渐变不起色带）。与直出路径的 ACES 公式一致。
const FinishShader = {
  uniforms: { tDiffuse: { value: null }, exposure: { value: 1 }, time: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float exposure; uniform float time; varying vec2 vUv;
    // 函数名加 fin 前缀：three 会往 ShaderMaterial 前缀里注入自己的 RRTAndODTFit 等同名函数
    vec3 finRrt(vec3 v){ vec3 a = v*(v+0.0245786)-0.000090537; vec3 b = v*(0.983729*v+0.4329510)+0.238081; return a/b; }
    vec3 finAces(vec3 c){
      const mat3 IN = mat3(0.59719,0.07600,0.02840, 0.35458,0.90834,0.13383, 0.04823,0.01566,0.83777);
      const mat3 OUT = mat3(1.60475,-0.10208,-0.00327, -0.53108,1.10813,-0.07276, -0.07367,-0.00605,1.07602);
      c *= exposure / 0.6; c = IN * c; c = finRrt(c); c = OUT * c; return clamp(c, 0.0, 1.0);
    }
    vec3 finSrgb(vec3 c){ return mix(c*12.92, 1.055*pow(c, vec3(1.0/2.4))-0.055, step(vec3(0.0031308), c)); }
    float finHash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)) + time) * 43758.5453); }
    void main(){
      vec3 c = finSrgb(finAces(texture2D(tDiffuse, vUv).rgb));
      c += (finHash(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = vec4(c, 1.0);
    }`,
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.gl.outputColorSpace = THREE.SRGBColorSpace;
    this.gl.toneMapping = THREE.ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 1;
    this.gl.shadowMap.type = THREE.PCFShadowMap; // r186 已移除 PCFSoftShadowMap
    // ?quality=low|mid|high 锁定画质（调试/截图用），锁定后不做自适应
    const forced = new URLSearchParams(location.search).get('quality');
    this.locked = !!TIERS[forced];
    this.tierName = this.locked ? forced : guessTier(this.gl.getContext());
    this._grace = 2;
    this.scale = 1;
    this.fps = 60;
    this._slow = 0;
    this._fast = 0;
    this.onTierChange = null; // (tier) => void，世界据此调整阴影
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
  }

  get tier() { return TIERS[this.tierName]; }

  setQuality(name) {
    if (name !== 'auto' && !TIERS[name]) return;
    this.locked = name !== 'auto';
    this.tierName = this.locked ? name : guessTier(this.gl.getContext());
    this.scale = 1;
    this._slow = this._fast = 0;
    this._probe = null;
    this._build();
  }

  setExposure(v) {
    this.gl.toneMappingExposure = v;
    if (this.finish) this.finish.uniforms.exposure.value = v;
  }

  // 场景/相机就绪后调用；换档时重建后处理
  attach(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this._build();
  }

  // 自带后期的模式（鹈鹕骑行）接管渲染：释放这里的后处理，只保留 WebGLRenderer 与画质档位
  detach() {
    this.composer?.dispose();
    this.composer = this.finish = this.bloom = null;
    this.scene = this.camera = null;
  }

  _build() {
    this._grace = 2;
    this.composer?.dispose();
    this.composer = null;
    this.gl.shadowMap.enabled = this.tier.shadow > 0;
    if (this.tier.bloom && this.scene) {
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.tier.msaa });
      this.composer = new EffectComposer(this.gl, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.55, 0.6, 0.82);
      this.composer.addPass(this.bloom);
      this.finish = new ShaderPass(FinishShader);
      this.finish.uniforms.exposure.value = this.gl.toneMappingExposure;
      this.composer.addPass(this.finish);
    }
    this.resize();
    this.onTierChange?.(this.tier);
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, this.tier.dpr) * this.scale;
    this.gl.setPixelRatio(dpr);
    this.gl.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(dpr);
      this.composer.setSize(w, h);
    }
    if (this.camera) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
    this.onResize?.();
  }

  // 帧率自适应：持续低于 42fps 先降分辨率（最低 0.6），再降档；持续满帧再逐步升回分辨率。
  // 每次降级后复查：帧率没涨说明瓶颈是屏幕刷新率（30Hz 投影/节能模式），撤销降级并停止自适应。
  adapt(frameMs) {
    if (frameMs > 250) return;
    this.fps += (1000 / frameMs - this.fps) * 0.05;
    if (this.locked) return;
    // 刚换场景/重建时着色器编译会卡几帧，别误判成机器慢
    if (this._grace > 0) { this._grace -= frameMs / 1000; return; }
    const dt = frameMs / 1000;
    if (this._probe) {
      this._probe.t -= dt;
      if (this._probe.t > 0) return;
      const { fps, tierName, scale } = this._probe;
      this._probe = null;
      if (this.fps < fps + 3) {
        this.locked = true;
        this.scale = scale;
        if (tierName !== this.tierName) { this.tierName = tierName; this._build(); } else this.resize();
      }
      return;
    }
    this._slow = this.fps < 42 ? this._slow + dt : 0;
    this._fast = this.fps > 57 ? this._fast + dt : 0;
    if (this._slow > 2.5) {
      this._slow = 0;
      this._probe = { t: 4, fps: this.fps, tierName: this.tierName, scale: this.scale };
      if (this.scale > 0.61) { this.scale -= 0.1; this.resize(); }
      else if (this.tierName !== 'low') {
        this.tierName = ORDER[ORDER.indexOf(this.tierName) - 1];
        this.scale = 1;
        this._build();
      } else this._probe = null;
    } else if (this._fast > 6 && this.scale < 1) {
      this._fast = 0;
      this.scale = Math.min(1, this.scale + 0.1);
      this.resize();
    }
  }

  render(time) {
    if (this.composer) {
      this.finish.uniforms.time.value = time % 100;
      this.composer.render();
    } else {
      this.gl.render(this.scene, this.camera);
    }
  }
}
