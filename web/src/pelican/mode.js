// 鹈鹕骑单车 · 声音驱动版。可视化模块移植自 riba2534/claude-opus-5-5-demo（pelican-bike），
// 主循环保留声音驱动，镜头和环境设置由教室控制区接入。
import * as THREE from 'three';
import { buildStage, PRESET } from './stage.js';
import { buildPost } from './post.js';
import { BikeDrive } from './drive.js';
import { newRideState, updateRide, trick, emitDust } from './ride.js';
import { updateLighting } from './lighting.js';
import { updateFishes, updateJumpers, launchJumper, computeLook } from './fishing.js';
import { FollowCam, BIKE_SHOTS } from './camera.js';
import { SceneView } from '../three/view.js';
import { terrainHeight } from './ref/world.js';
import { clamp } from './ref/util.js';

export class PelicanMode {
  constructor(renderer, { attract = false } = {}) {
    this.kind = 'bike';
    this.milestone = 250;
    this.renderer = renderer;
    this.st = buildStage(renderer.tierName);
    this.drive = new BikeDrive();
    this.S = newRideState(!attract);
    this.settings = { hour: 17.35, dayRate: 0.025, timeFlow: true, cloud: 0.42, fog: 1, waveAmp: 1, exposure: 1, bloomBoost: 1, helmet: true, glasses: 'auto', scarf: true };
    this.cam = new FollowCam(this.st.camera);
    this.pmrem = new THREE.PMREMGenerator(renderer.gl);
    this.envRT = null;
    this.envHour = -99;
    this.L = 0;
    this.on = { fish: null };
    this._buf = new THREE.Vector2();
    this._grips = { L: new THREE.Vector3(), R: new THREE.Vector3() };
    this._scarfA = new THREE.Vector3();
    this._scarfB = new THREE.Vector3();
    this._bodyW = new THREE.Vector3();
    this._wind = new THREE.Vector3();
    this._collider = { center: this._bodyW, radius: 0.25 };

    renderer.detach();
    renderer.onResize = () => this._resize();
    this.post = buildPost(renderer.gl, renderer.tier, this.st.scene, this.st.camera);
    this._resize();
    // 首帧前预热一次，避免开场卡顿
    this.st.world.update(0, 0, 0, this.S.env);
    updateLighting(this.st, this.S, this.settings, 0, renderer.gl, this.post);
    this._refreshEnv();
    this.cam.update(1, this.st.rider, this.S);
    this.povPose = (position, look) => {
      this.st.pelican.head.updateWorldMatrix(true, false);
      position.set(0.07, 0.05, 0).applyMatrix4(this.st.pelican.head.matrixWorld);
      look.set(1.2, -0.12, 0).applyMatrix4(this.st.pelican.head.matrixWorld);
    };
    const shots = [...BIKE_SHOTS, { id: 'pov', name: '鹈鹕视角', hfov: 90, pose: this.povPose }];
    this.view = new SceneView(this.st.camera, renderer.canvas, shots, {
      minDistance: 2.2, maxDistance: 24, maxPan: 3,
      groundHeight: (position) => Math.abs(position.z) < 2.9 ? 0.02 : terrainHeight(position.x + this.S.distance, position.z),
    });
    this.view.interactive = !attract;
    this.view.update(0, this.cam.focus);
    this.envHour = this.settings.hour;
  }

  get meters() { return this.drive.meters; }

  _refreshEnv() {
    const rt = this.pmrem.fromScene(this.st.envScene, 0, 0.1, 100);
    this.envRT?.dispose();
    this.envRT = rt;
    this.st.scene.environment = rt.texture;
  }

  _resize() {
    const gl = this.renderer.gl;
    const c = this.renderer.canvas;
    const w = c.clientWidth || innerWidth, h = c.clientHeight || innerHeight;
    this.st.camera.aspect = w / h;
    this.st.camera.updateProjectionMatrix();
    if (this.post.composer) {
      this.post.composer.setPixelRatio(gl.getPixelRatio());
      this.post.composer.setSize(w, h);
    }
  }

  // 渲染器自适应换档：重建后期与阴影
  applyTier() {
    const sun = this.st.sun, size = (PRESET[this.renderer.tierName] || PRESET.mid).shadow;
    if (sun.shadow.mapSize.x !== size) {
      sun.shadow.mapSize.set(size, size);
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
    }
    this.post = buildPost(this.renderer.gl, this.renderer.tier, this.st.scene, this.st.camera, this.post);
    this._resize();
  }

  update(dt, L) {
    const { S, st } = this;
    this.L = L;
    S.t += dt;
    S.time += dt;
    this.drive.update(L, dt);
    updateRide(st, S, this.drive, dt);
    this.info = updateLighting(st, S, this.settings, dt, this.renderer.gl, this.post);
    st.world.update(S.distance, dt, S.t, S.env);
    if (Math.abs(this.settings.hour - this.envHour) > 0.18) {
      this.envHour = this.settings.hour;
      this._refreshEnv();
    }

    // 骑手 IK：手握车把、脚踩踏板
    st.bike.group.updateMatrixWorld(true);
    const steerM = st.bike.steerMatrix();
    this._grips.L.copy(st.bike.anchors.gripL.position).applyMatrix4(steerM);
    this._grips.R.copy(st.bike.anchors.gripR.position).applyMatrix4(steerM);
    st.pelican.update(dt, {
      t: S.t, crankAngle: S.crank, pedal: S.pedaling ? 1 : 0.3, airborne: 0, trick: S.trick, accel: S.accel,
      look: computeLook(st, S, st.camera, dt, this.view.id === 'pov' || (this.view.id === 'cine' && this.cam.cinemaPov)), grips: this._grips,
      pedals: { L: st.bike.anchors.pedalL.position, R: st.bike.anchors.pedalR.position },
      helmet: this.settings.helmet, glasses: this.settings.glasses === 'on' || (this.settings.glasses === 'auto' && this.info.night < 0.3),
    });
    st.pelican.root.updateMatrixWorld(true);
    st.fx.scarf.mesh.visible = this.settings.scarf;
    st.pelican.knot.visible = this.settings.scarf;

    // 围巾：根部取脖子结的后侧，风速随车速
    const kp = st.pelican.knot.position;
    this._scarfA.set(kp.x - 0.07, kp.y + 0.025, 0.01);
    this._scarfB.set(kp.x - 0.07, kp.y - 0.04, -0.01);
    st.pelican.root.localToWorld(this._scarfA);
    st.pelican.root.localToWorld(this._scarfB);
    st.pelican.body.getWorldPosition(this._bodyW);
    this._wind.set(-S.speed + Math.sin(S.t * 0.7) * 0.8, 0.3, -S.laneV * 0.8 + Math.sin(S.t * 0.4) * 0.6);
    if (dt > 0) st.fx.scarf.update(dt, this._scarfA, this._scarfB, this._wind, S.t, this._collider);

    updateFishes(st, S, dt, (golden) => this.on.fish?.(golden));
    updateJumpers(st, S, dt);
    emitDust(st, S, dt);
    if (S.rnd() < dt * 0.12) launchJumper(st, S, 8 + S.rnd() * 30, -20 - S.rnd() * 25);
    const scroll = S.speed * dt;
    st.fx.dust.update(dt, scroll);
    st.fx.sparkles.update(dt, 0);
    st.fx.splash.update(dt, scroll);
    st.fx.confetti.update(dt, scroll);
    st.fx.speedLines.update(dt, S.speed, 0.6);

    this.updateCamera(dt);
  }

  updateCamera(dt, t, paused = false) {
    const { S, st } = this;
    const motionDt = paused ? 0 : dt;
    if (this.view.id === 'cine') this.cam.updateCinema(motionDt, st.rider, S, this.povPose);
    else if (this.view.automatic) this.cam.update(motionDt, st.rider, S);
    this.cam.focus.set(st.rider.position.x + 0.05, st.rider.position.y + 0.92, st.rider.position.z);
    this.view.update(paused && this.view.id === 'free' ? 0 : dt, this.cam.focus);
    st.pelican.head.visible = this.view.id !== 'pov' && !(this.view.id === 'cine' && this.cam.cinemaPov);
    st.sky.mesh.position.copy(st.camera.position);
    this.renderer.gl.getDrawingBufferSize(this._buf);
    const scale = this._buf.y / (2 * Math.tan((st.camera.fov * Math.PI) / 360));
    for (const p of [st.fx.dust, st.fx.sparkles, st.fx.splash]) p.uniforms.uScale.value = scale;
    st.world.ffMat.uniforms.uScale.value = scale;
    if (this.post.grade) {
      this.post.grade.uniforms.uTime.value = S.t;
      this.post.grade.uniforms.uAberration.value = clamp((S.speed - 9) / 6, 0, 1) * 0.012;
    }
  }

  render() {
    if (this.post.composer) this.post.composer.render();
    else this.renderer.gl.render(this.st.scene, this.st.camera);
  }

  celebrate() { trick(this.st, this.S); }

  // 今日主角：车尾旗杆上的照片徽章
  setPhoto(canvas) {
    const m = this.st.badge.material;
    m.map?.dispose();
    m.map = new THREE.CanvasTexture(canvas);
    m.map.colorSpace = THREE.SRGBColorSpace;
    m.needsUpdate = true;
    this.st.flag.visible = true;
  }

  clearPhoto() { this.st.flag.visible = false; }

  get hud() {
    const d = this.drive;
    return { kind: 'bike', level: this.L, kmh: d.kmh, meters: d.meters, fish: this.S.fish, pedaling: d.pedaling, sustain: d.sustain, streak: d.streak };
  }

  dispose() {
    this.view.dispose();
    this.post.composer?.passes.forEach((p) => p.dispose?.());
    this.post.composer?.dispose();
    this.envRT?.dispose();
    this.pmrem.dispose();
    this.renderer.onResize = null;
    for (const root of [this.st.scene, this.st.envScene]) {
      root.traverse((o) => {
        o.geometry?.dispose();
        for (const m of [o.material].flat()) {
          if (!m) continue;
          for (const k of ['map', 'normalMap', 'roughnessMap', 'alphaMap', 'emissiveMap']) m[k]?.dispose?.();
          m.dispose();
        }
      });
    }
    this.st.sun.shadow.map?.dispose();
  }
}
