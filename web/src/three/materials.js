import * as THREE from 'three';

// 菲涅尔边缘光：暗色角色在夜景里也有一圈亮边，投影远距离一眼可辨（UX-06）
export function withRim(material, color, strength = 0.35, power = 2.5) {
  const rim = {
    rimColor: { value: new THREE.Color(color) },
    rimStrength: { value: strength },
    rimPower: { value: power },
  };
  material.userData.rim = rim;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, rim);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 rimColor;\nuniform float rimStrength;\nuniform float rimPower;')
      .replace(
        '#include <opaque_fragment>',
        'outgoingLight += rimColor * rimStrength * pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), rimPower);\n#include <opaque_fragment>'
      );
  };
  material.customProgramCacheKey = () => 'rim';
  return material;
}

export const std = (color, opts = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0, ...opts });

// sRGB 主色 -> 适合做球衣的颜色：饱和度、亮度拉到"看得清又不刺眼"的区间
export function jerseyColor(hex) {
  const c = new THREE.Color(hex);
  const hsl = {};
  c.getHSL(hsl, THREE.SRGBColorSpace);
  c.setHSL(hsl.h, THREE.MathUtils.clamp(hsl.s * 1.35, 0.55, 0.9), THREE.MathUtils.clamp(hsl.l, 0.45, 0.6), THREE.SRGBColorSpace);
  return c;
}
