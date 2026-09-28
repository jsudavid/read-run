import test from 'node:test';
import assert from 'node:assert/strict';

globalThis.matchMedia = () => ({ matches: false });
const { Game } = await import('../web/src/game.js');

function makeGame() {
  const calls = { source: 0, update: 0, camera: 0, render: [], frame: 0, milestones: [], celebrations: 0, pause: [] };
  const hud = { meters: 190, caughtCount: 2, streak: 4, danger: 0.8 };
  const game = Object.assign(Object.create(Game.prototype), {
    attract: false, paused: false, t: 7, nextMilestone: 1,
    source: { update() { calls.source++; return 0.9; } },
    mode: {
      hud, milestone: 200,
      get meters() { return hud.meters; },
      update() { calls.update++; hud.meters += 10; },
      updateCamera(dt, time, paused) { calls.camera++; assert.equal(dt, 0.05); assert.equal(time, 7); assert.equal(paused, true); },
      render(time) { calls.render.push(time); },
      celebrate() { calls.celebrations++; },
    },
    on: {
      frame(state, level) { calls.frame++; assert.equal(state, hud); assert.equal(level, 0.9); },
      milestone: (meters) => calls.milestones.push(meters),
      pause: (paused) => calls.pause.push(paused),
    },
  });
  return { game, calls, hud };
}

test('pause freezes simulation and rewards while keeping the scene rendered', () => {
  const { game, calls, hud } = makeGame();
  const before = { ...hud };
  game.setPaused(true);
  for (let frame = 0; frame < 600; frame++) game._tick(0.05);

  assert.deepEqual(hud, before);
  assert.equal(game.t, 7);
  assert.equal(calls.update, 0);
  assert.equal(calls.camera, 600);
  assert.equal(calls.source, 600);
  assert.equal(calls.frame, 600);
  assert.equal(calls.render.length, 600);
  assert.ok(calls.render.every((time) => time === 7));
  assert.deepEqual(calls.milestones, []);

  game.setPaused(false);
  game._tick(0.05);
  assert.equal(game.t, 7.05);
  assert.equal(calls.update, 1);
  assert.equal(hud.meters, 200);
  assert.equal(hud.caughtCount, 2);
  assert.deepEqual(calls.milestones, [200]);
  assert.equal(calls.celebrations, 1);
});

test('pause is unavailable before starting and notifies only on state changes', () => {
  const { game, calls } = makeGame();
  game.attract = true;
  game.setPaused(true);
  assert.equal(game.paused, false);
  assert.deepEqual(calls.pause, []);

  game.attract = false;
  game.setPaused(true);
  game.setPaused(true);
  game.setPaused(false);
  assert.deepEqual(calls.pause, [true, false]);
});

test('begin starts a fresh active game', () => {
  const { game, calls } = makeGame();
  game.paused = true;
  game.attract = true;
  let resets = 0;
  game.reset = () => resets++;
  const source = { update: () => 0 };
  game.begin(source);

  assert.equal(game.source, source);
  assert.equal(game.attract, false);
  assert.equal(game.paused, false);
  assert.equal(resets, 1);
  assert.deepEqual(calls.pause, [false]);
});
