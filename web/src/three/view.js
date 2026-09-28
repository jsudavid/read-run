import { MathUtils, Vector3 } from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Automatic rigs and OrbitControls must never write to the camera in the same frame.
export class SceneView {
  constructor(camera, canvas, shots, { minDistance, maxDistance, maxPan, groundHeight }) {
    this.camera = camera;
    this.canvas = canvas;
    this.shots = shots;
    this.id = 'auto';
    this.hfov = shots[0].hfov;
    this.focus = new Vector3();
    this.previousFocus = new Vector3();
    this.offset = new Vector3();
    this.goal = new Vector3();
    this.look = new Vector3();
    this.lookOffset = new Vector3();
    this.direction = new Vector3();
    this.groundHeight = groundHeight;
    this.onChange = null;
    this.interactive = false;
    this.takeControl = () => {
      if (this.interactive && this.id !== 'free') this.select('free');
    };
    canvas.addEventListener('pointerdown', this.takeControl, true);
    canvas.addEventListener('wheel', this.takeControl, { capture: true, passive: true });
    this.controls = new OrbitControls(camera, canvas);
    Object.assign(this.controls, {
      enabled: false, enableDamping: true, dampingFactor: 0.09,
      minDistance, maxDistance, maxTargetRadius: maxPan,
      minPolarAngle: 0.12, maxPolarAngle: Math.PI - 0.12,
      autoRotateSpeed: 0.6, zoomSpeed: 0.7,
    });
    this.controls.addEventListener('start', () => {
      this.controls.autoRotate = false;
      this.onChange?.();
    });
  }

  get automatic() { return this.id === 'auto' || this.id === 'cine'; }
  get distance() { return this.camera.position.distanceTo(this.controls.target); }

  select(id) {
    if (!['auto', 'cine', 'free', ...this.shots.map((shot) => shot.id)].includes(id)) return;
    if (this.id !== 'free') {
      // Preserve the visible line of sight when a fixed rig hands over to dragging.
      this.camera.getWorldDirection(this.direction);
      const distance = MathUtils.clamp(this.distance, this.controls.minDistance, this.controls.maxDistance);
      this.controls.target.copy(this.camera.position).addScaledVector(this.direction, distance);
    }
    // Flush remaining drag inertia before handing control to another rig.
    this.controls.enableDamping = false;
    this.controls.update();
    this.controls.enableDamping = true;
    this.controls.autoRotate = false;
    this.id = id;
    this.controls.enabled = this.interactive && id === 'free';
    this.previousFocus.copy(this.focus);
    const shot = this.shots.find((item) => item.id === id);
    if (shot) this.hfov = shot.hfov;
    this.onChange?.();
  }

  setDistance(distance) {
    if (this.id !== 'free') this.select('free');
    this.offset.subVectors(this.camera.position, this.controls.target);
    if (this.offset.lengthSq() === 0) this.offset.set(0, 1, 3);
    this.offset.setLength(MathUtils.clamp(distance, this.controls.minDistance, this.controls.maxDistance));
    this.camera.position.copy(this.controls.target).add(this.offset);
    this.controls.update();
  }

  setFov(value) {
    if (this.id !== 'free') this.select('free');
    this.hfov = MathUtils.clamp(value, 35, 90);
    this.applyLens();
  }

  setOrbit(enabled) {
    if (enabled && this.id !== 'free') this.select('free');
    this.controls.autoRotate = enabled;
    this.onChange?.();
  }

  applyLens() {
    const h = MathUtils.degToRad(this.hfov);
    this.camera.fov = MathUtils.clamp(MathUtils.radToDeg(2 * Math.atan(Math.tan(h / 2) / this.camera.aspect)), 20, 85);
    this.camera.updateProjectionMatrix();
    return Math.max(1, Math.tan(h / 2) / (this.camera.aspect * Math.tan(MathUtils.degToRad(this.camera.fov) / 2)));
  }

  update(dt, focus) {
    this.focus.copy(focus);
    this.controls.cursor.copy(focus);
    if (this.automatic) {
      this.controls.target.copy(focus);
      this.hfov = MathUtils.radToDeg(2 * Math.atan(Math.tan(MathUtils.degToRad(this.camera.fov) / 2) * this.camera.aspect));
    } else if (this.id === 'free') {
      this.offset.subVectors(focus, this.previousFocus);
      this.camera.position.add(this.offset);
      this.controls.target.add(this.offset);
      this.applyLens();
      this.controls.update(dt);
    } else {
      const shot = this.shots.find((item) => item.id === this.id);
      const fit = this.applyLens();
      if (shot.pose) shot.pose(this.goal, this.look);
      else {
        this.look.copy(focus).add(this.lookOffset.fromArray(shot.look));
        this.goal.copy(this.look).add(this.offset.fromArray(shot.pos).sub(this.lookOffset).multiplyScalar(fit));
      }
      const blend = 1 - Math.exp(-dt * 5);
      this.camera.position.lerp(this.goal, blend);
      this.controls.target.lerp(this.look, blend);
      this.camera.lookAt(this.controls.target);
    }
    if (!this.automatic && this.id !== 'pov' && this.groundHeight) {
      this.camera.position.y = Math.max(this.camera.position.y, this.groundHeight(this.camera.position) + 0.25);
      this.camera.lookAt(this.controls.target);
    }
    this.previousFocus.copy(focus);
  }

  save() {
    return {
      id: this.id, hfov: this.hfov, orbit: this.controls.autoRotate,
      position: this.camera.position.clone().sub(this.focus).toArray(),
      target: this.controls.target.clone().sub(this.focus).toArray(),
    };
  }

  restore(state) {
    if (!state) return;
    this.select(state.id);
    this.hfov = state.hfov;
    if (state.id === 'free') {
      this.camera.position.fromArray(state.position).add(this.focus);
      this.controls.target.fromArray(state.target).add(this.focus);
      this.applyLens();
      this.controls.update();
      this.controls.autoRotate = state.orbit;
    }
  }

  dispose() {
    this.canvas.removeEventListener('pointerdown', this.takeControl, true);
    this.canvas.removeEventListener('wheel', this.takeControl, true);
    this.controls.dispose();
  }
}
