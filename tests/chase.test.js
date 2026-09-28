import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector2, Vector3 } from 'three';
import { Signal } from '../web/src/audio/signal.js';

globalThis.matchMedia = () => ({ matches: false });
const { ChaseMode } = await import('../web/src/chase.js');

function makeMode(attract = false) {
  const events = [];
  const mode = Object.create(ChaseMode.prototype);
  Object.assign(mode, {
    attract, caughtCount: 0, sig: new Signal(), _size: new Vector2(),
    focus: new Vector3(),
    on: { caught: () => events.push(mode.hud.caughtCount) },
    rig: { camera: {}, kick() {} },
    view: { id: 'free', automatic: false, update() {} },
    settings: { autoMood: true, fog: 1, exposure: 1, bloomBoost: 1 },
    world: {
      scene: { fog: {} }, dangerS: 0.35, gap: 14, exposure: 1,
      caught() {}, update() {},
    },
    renderer: {
      gl: { getDrawingBufferSize: (size) => size.set(800, 450) },
      setExposure() {},
    },
  });
  return { mode, events };
}

function advance(mode, seconds, level) {
  for (let frame = 0; frame < seconds * 20; frame++) {
    mode.update(0.05, level, frame * 0.05);
  }
}

test('each catch increments once and preserves escaped distance', () => {
  const { mode, events } = makeMode();
  advance(mode, 2, 0.8);
  advance(mode, 0.2, 0);
  const meters = mode.meters;
  assert.ok(meters > 0);

  advance(mode, 9, 0);
  assert.equal(mode.hud.caughtCount, 1);
  assert.deepEqual(events, [1]);
  assert.equal(mode.meters, meters);

  mode.update(0.05, 0, 11.05);
  assert.equal(mode.hud.caughtCount, 1);
  advance(mode, 5, 0);
  assert.equal(mode.hud.caughtCount, 2);
  assert.deepEqual(events, [1, 2]);
});

test('opening animation and sustained qualified reading do not record catches', () => {
  const demo = makeMode(true);
  advance(demo.mode, 20, 0);
  assert.equal(demo.mode.hud.caughtCount, 0);
  assert.deepEqual(demo.events, []);

  const reading = makeMode();
  advance(reading.mode, 30, 0.8);
  assert.equal(reading.mode.hud.caughtCount, 0);
  assert.deepEqual(reading.events, []);
});
