import test from 'node:test';
import assert from 'node:assert/strict';
import { BalloonFlight } from '../web/src/balloon/flight.js';

function advance(flight, seconds, level, dt = 0.05) {
  for (let elapsed = 0; elapsed < seconds - 1e-9; elapsed += dt) flight.update(level, dt);
}

test('balloon flight starts grounded with an empty route record', () => {
  const flight = new BalloonFlight();

  assert.equal(flight.altitude, 0);
  assert.equal(flight.meters, 0);
  assert.equal(flight.stars, 0);
  assert.equal(flight.segments, 0);
  assert.equal(flight.streak, 0);
  assert.equal(flight.speed, 0);
  assert.equal(flight.grounded, true);
  assert.equal(flight.qualified, false);
  assert.equal(flight.nextStar, flight.starEvery);
  assert.equal(flight.nextStarIndex, 1);
});

test('brief volume spikes do not launch the balloon', () => {
  const flight = new BalloonFlight();
  advance(flight, flight.spikeHold - 0.05, 1);
  advance(flight, 0.5, 0);

  assert.equal(flight.qualified, false);
  assert.equal(flight.altitude, 0);
  assert.equal(flight.meters, 0);
  assert.equal(flight.stars, 0);
});

test('sustained reading gains altitude and awards stars and route segments', () => {
  const flight = new BalloonFlight();
  advance(flight, 40, 0.9);

  assert.equal(flight.qualified, true);
  assert.ok(flight.altitude > 8, `expected usable altitude, got ${flight.altitude}`);
  assert.ok(flight.altitude <= flight.maxAltitude);
  assert.ok(flight.meters >= flight.segmentLength, `expected route progress, got ${flight.meters}`);
  assert.ok(flight.stars >= 1, `expected collected stars, got ${flight.stars}`);
  assert.equal(flight.segments, Math.floor(flight.meters / flight.segmentLength));
  assert.equal(flight.nextStar, (flight.stars + 1) * flight.starEvery);
  assert.equal(flight.nextStarIndex, flight.stars + 1);
  assert.ok(flight.streak > 0);
});

test('qualified lift is driven by sustained reading, not extreme loudness', () => {
  const softer = new BalloonFlight();
  const louder = new BalloonFlight();
  advance(softer, 12, 0.55);
  advance(louder, 12, 1);

  assert.equal(softer.qualified, true);
  assert.equal(louder.qualified, true);
  assert.ok(Math.abs(softer.altitude - louder.altitude) < 1e-9);
  assert.ok(Math.abs(softer.speed - louder.speed) < 1e-9);
  assert.equal(softer.meters, louder.meters);
});

test('breathing pauses hold altitude briefly, silence lands safely, and rewards persist', () => {
  const flight = new BalloonFlight();
  advance(flight, 40, 0.9);
  const before = { altitude: flight.altitude, meters: flight.meters, stars: flight.stars, segments: flight.segments, streak: flight.streak };

  advance(flight, flight.breathGrace - 0.1, 0);
  assert.ok(flight.altitude >= before.altitude - 0.05, `${flight.altitude} should hold near ${before.altitude}`);
  assert.ok(flight.meters >= before.meters);
  assert.equal(flight.stars, before.stars);
  assert.equal(flight.segments, before.segments);

  advance(flight, 30, 0);
  assert.equal(flight.altitude, 0);
  assert.equal(flight.grounded, true);
  assert.ok(flight.meters >= before.meters);
  assert.equal(flight.stars, before.stars);
  assert.equal(flight.segments, before.segments);
  assert.ok(flight.streak <= before.streak);
});

test('reset starts a new route without retaining flight progress', () => {
  const flight = new BalloonFlight();
  advance(flight, 40, 0.9);
  flight.reset();

  assert.equal(flight.altitude, 0);
  assert.equal(flight.meters, 0);
  assert.equal(flight.stars, 0);
  assert.equal(flight.segments, 0);
  assert.equal(flight.streak, 0);
  assert.equal(flight.speed, 0);
  assert.equal(flight.grounded, true);
  assert.equal(flight.qualified, false);
});
