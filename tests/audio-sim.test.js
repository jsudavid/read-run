import test from 'node:test';
import assert from 'node:assert/strict';
import { SimSource } from '../web/src/audio/sim.js';

function sample(sensitivity) {
  const source = new SimSource();
  source.setSensitivity(sensitivity);
  for (let i = 0; i < 100; i++) source.update(0.01);
  return source.L;
}

test('simulation sensitivity changes volume while staying normalized', () => {
  const quiet = sample(10);
  const loud = sample(90);
  assert.ok(loud > quiet, `${loud} should be greater than ${quiet}`);
  assert.ok(quiet >= 0 && loud <= 1, `${quiet}..${loud} must stay in 0..1`);
});
