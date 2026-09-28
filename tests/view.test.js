import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SceneView } from '../web/src/three/view.js';

class FakeRoot {
  constructor() {
    this.listeners = new Map();
  }

  addEventListener(type, listener, options) {
    const entries = this.listeners.get(type) ?? [];
    entries.push({ listener, options });
    this.listeners.set(type, entries);
  }

  removeEventListener(type, listener) {
    const entries = this.listeners.get(type) ?? [];
    this.listeners.set(type, entries.filter((entry) => entry.listener !== listener));
  }

  count(type) {
    return (this.listeners.get(type) ?? []).length;
  }
}

class FakeCanvas {
  constructor() {
    this.style = {};
    this.listeners = new Map();
    this.root = new FakeRoot();
    this.ownerDocument = this.root;
    this.clientWidth = 800;
    this.clientHeight = 450;
  }

  addEventListener(type, listener, options) {
    const entries = this.listeners.get(type) ?? [];
    entries.push({ listener, options });
    this.listeners.set(type, entries);
  }

  removeEventListener(type, listener) {
    const entries = this.listeners.get(type) ?? [];
    this.listeners.set(type, entries.filter((entry) => entry.listener !== listener));
  }

  getRootNode() {
    return this.root;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight };
  }

  setPointerCapture() {}
  releasePointerCapture() {}

  count(type) {
    return (this.listeners.get(type) ?? []).length;
  }
}

const SHOTS = [
  { id: 'follow', hfov: 58, pos: [0, 3, 8], look: [0, 1, 0] },
  { id: 'low', hfov: 48, pos: [5, 1.5, 4], look: [0, 1, 0] },
];

function makeView(options = {}) {
  const camera = new THREE.PerspectiveCamera(45, 16 / 9, 0.1, 100);
  camera.position.set(0, 3, 8);
  camera.lookAt(0, 1, 0);
  const canvas = new FakeCanvas();
  const view = new SceneView(camera, canvas, SHOTS, {
    minDistance: 2,
    maxDistance: 12,
    maxPan: 20,
    groundHeight: () => 0,
    ...options,
  });
  return { camera, canvas, view };
}

function closeTo(actual, expected, epsilon = 1e-6) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not close to ${expected}`);
}

function vectorCloseTo(actual, expected, epsilon = 1e-6) {
  closeTo(actual.x, expected.x, epsilon);
  closeTo(actual.y, expected.y, epsilon);
  closeTo(actual.z, expected.z, epsilon);
}

test('automatic update owns the camera target and is not overwritten by OrbitControls', () => {
  const { camera, view } = makeView();
  view.interactive = true;
  view.select('auto');
  const position = camera.position.clone();
  view.update(1 / 60, new THREE.Vector3(4, 2, -3));

  vectorCloseTo(view.controls.target, new THREE.Vector3(4, 2, -3));
  vectorCloseTo(camera.position, position);
  assert.equal(view.controls.enabled, false);
});

test('selecting a preset changes the camera pose', () => {
  const { camera, view } = makeView();
  const before = camera.position.clone();
  view.select('low');
  view.update(1, new THREE.Vector3(0, 0, 0));

  assert.ok(camera.position.distanceTo(before) > 0.1);
  assert.equal(view.id, 'low');
});

test('the first pointer or wheel interaction takes control into free mode', () => {
  const pointer = makeView();
  pointer.view.interactive = true;
  pointer.canvas.listeners.get('pointerdown')[0].listener({ type: 'pointerdown' });
  assert.equal(pointer.view.id, 'free');
  assert.equal(pointer.view.controls.enabled, true);

  const wheel = makeView();
  wheel.view.interactive = true;
  wheel.canvas.listeners.get('wheel')[0].listener({ type: 'wheel' });
  assert.equal(wheel.view.id, 'free');
});

test('taking free control preserves an automatic camera pose and viewing direction', () => {
  const { camera, view } = makeView();
  const focus = new THREE.Vector3(2, 1, -1);
  view.update(1 / 60, focus);
  camera.lookAt(new THREE.Vector3(8, 3, -4));
  const beforePosition = camera.position.clone();
  const beforeDirection = new THREE.Vector3();
  camera.getWorldDirection(beforeDirection);

  view.interactive = true;
  view.select('free');
  const afterDirection = new THREE.Vector3();
  camera.getWorldDirection(afterDirection);
  vectorCloseTo(camera.position, beforePosition);
  closeTo(beforeDirection.angleTo(afterDirection), 0, 1e-5);
});

test('setDistance clamps the free camera to OrbitControls distance limits', () => {
  const { view } = makeView();
  view.interactive = true;
  view.select('free');
  view.setDistance(100);
  closeTo(view.distance, 12);
  view.setDistance(0.1);
  closeTo(view.distance, 2);
});

test('free mode follows focus while preserving camera and target relative pose', () => {
  const { camera, view } = makeView();
  view.interactive = true;
  view.select('free');
  const firstFocus = new THREE.Vector3(2, 1, -1);
  view.update(1 / 60, firstFocus);
  const cameraOffset = camera.position.clone().sub(firstFocus);
  const targetOffset = view.controls.target.clone().sub(firstFocus);

  const nextFocus = new THREE.Vector3(7, 2, 4);
  view.update(1 / 60, nextFocus);
  vectorCloseTo(camera.position.clone().sub(nextFocus), cameraOffset);
  vectorCloseTo(view.controls.target.clone().sub(nextFocus), targetOffset);
});

test('save and restore preserve free camera pose relative to focus', () => {
  const source = makeView();
  source.view.interactive = true;
  source.view.select('free');
  const focus = new THREE.Vector3(3, 1, -2);
  source.view.update(1 / 60, focus);
  source.camera.position.set(10, 4, 5);
  source.view.controls.target.set(3, 1.5, -2.5);
  source.view.setFov(73);
  source.view.setOrbit(true);
  const saved = source.view.save();

  const restored = makeView();
  restored.view.interactive = true;
  restored.view.update(1 / 60, focus);
  restored.view.restore(saved);

  vectorCloseTo(restored.camera.position, source.camera.position);
  vectorCloseTo(restored.view.controls.target, source.view.controls.target);
  closeTo(restored.view.hfov, source.view.hfov);
  assert.equal(restored.view.controls.autoRotate, true);
});

test('dispose removes canvas and root listeners installed by SceneView and OrbitControls', () => {
  const { canvas, view } = makeView();
  assert.ok(canvas.count('pointerdown') > 0);
  assert.ok(canvas.count('wheel') > 0);
  assert.ok(canvas.root.count('keydown') > 0);

  view.dispose();

  assert.equal(canvas.count('pointerdown'), 0);
  assert.equal(canvas.count('wheel'), 0);
  assert.equal(canvas.count('pointercancel'), 0);
  assert.equal(canvas.count('contextmenu'), 0);
  assert.equal(canvas.root.count('keydown'), 0);
  assert.equal(canvas.style.touchAction, '');
});
