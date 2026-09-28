// 移植自 riba2534/claude-opus-5-5-demo · pelican-bike/src/main.js · updateLighting（昼夜循环与光照）
import * as THREE from 'three';
import { SKY, samplePalette, sunDirection, moonDirection, nightFactor } from './ref/sky.js';
import { wavePhases } from './ref/ocean.js';
import { clamp, lerp, smoothstep } from './ref/util.js';

const pal = {};
const sunDir = new THREE.Vector3();
const moonDir = new THREE.Vector3();

export function updateLighting(st, S, settings, dt, gl, post) {
  if (settings.timeFlow && S.started) settings.hour = (settings.hour + dt * settings.dayRate) % 24;
  const hour = settings.hour;
  sunDirection(hour, sunDir);
  moonDirection(hour, moonDir);
  const elev = (Math.asin(clamp(sunDir.y, -1, 1)) * 180) / Math.PI;
  samplePalette(elev, pal);
  const night = nightFactor(elev);
  S.env.night = night;
  S.env.waveAmp = settings.waveAmp;
  SKY.uSunDir.value.copy(sunDir);
  SKY.uMoonDir.value.copy(moonDir);
  SKY.uZenith.value.copy(pal.zen);
  SKY.uHorizon.value.copy(pal.hor);
  SKY.uGround.value.copy(pal.gnd);
  SKY.uSunColor.value.copy(pal.sun);
  SKY.uSunGlow.value = 1 - night * 0.9;
  SKY.uNight.value = night;
  SKY.uTime.value = S.t;
  SKY.uCloudCover.value = settings.cloud;
  SKY.uCloudTint.value.copy(pal.ct);
  SKY.uCloudShade.value.copy(pal.cs);
  SKY.uCloudOffset.value.set(S.distance * 0.0009 + S.t * 0.004, S.t * 0.0015);

  // 太阳 / 月光二选一
  const { sun, hemi, scene, ocean, fillLight, world, lampLights, lampPos, rider } = st;
  const useMoon = elev < -4;
  const lightDir = useMoon ? moonDir : sunDir;
  sun.position.copy(rider.position).addScaledVector(lightDir, 40);
  sun.target.position.copy(rider.position);
  if (useMoon) {
    sun.color.set('#9fb6ff');
    sun.intensity = 0.8 * smoothstep(-4, -12, elev) * clamp(moonDir.y * 3, 0, 1);
  } else {
    sun.color.copy(pal.sun);
    sun.intensity = pal.li;
  }
  hemi.color.copy(pal.hs);
  hemi.groundColor.copy(pal.hg);
  hemi.intensity = pal.hi;
  scene.fog.color.copy(pal.fog);
  scene.fog.density = 0.0052 * settings.fog;
  ocean.uniforms.uFogDensity.value = 0.0036 * settings.fog;
  ocean.uniforms.uDayLight.value = clamp(pal.li / 3 + pal.hi * 0.25, 0.08, 1);
  ocean.uniforms.uOffset.value = S.distance % 36000;
  wavePhases(S.distance, S.t, ocean.uniforms.uPhase.value);
  ocean.uniforms.uAmp.value = settings.waveAmp;
  gl.toneMappingExposure = pal.exp * settings.exposure;
  scene.environmentIntensity = lerp(1.0, 0.22, night);
  if (post.bloom) {
    post.bloom.strength = pal.bloom * settings.bloomBoost * lerp(1, 0.7, night);
    post.bloom.threshold = lerp(1.05, 0.88, night);
  }
  fillLight.intensity = night * 2.2;
  if (post.grade) post.grade.uniforms.uWarm.value = smoothstep(25, 3, elev) * (1 - night) * 0.8;
  // 路灯点光源
  world.lampPositions(S.distance, lampPos);
  lampLights.forEach((l, i) => {
    l.position.copy(lampPos[i]);
    l.intensity = smoothstep(0.25, 0.75, night) * 18;
  });
  return { elev, night };
}
