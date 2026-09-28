const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const damp = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));

// Voice-powered flight: qualification filters spikes; short breaths preserve lift.
export class BalloonFlight {
  constructor() {
    this.goal = 0.5;
    this.spikeHold = 0.35;
    this.dropHold = 0.15;
    this.breathGrace = 1.2;
    this.maxAltitude = 32;
    this.segmentLength = 160;
    this.starEvery = 35;
    this.reset();
  }

  reset() {
    this.altitude = 0;
    this.velocity = 0;
    this.speed = 0;
    this.meters = 0;
    this.stars = 0;
    this.segments = 0;
    this.streak = 0;
    this._above = 0;
    this._below = this.breathGrace + 1;
    this._qualified = false;
    this.nextStarIndex = 1;
  }

  update(level, dt) {
    if (dt <= 0) return this;
    if (level >= this.goal) {
      this._above += dt;
      this._below = 0;
      if (this._above >= this.spikeHold) this._qualified = true;
    } else {
      this._above = 0;
      this._below += dt;
      if (this._below >= this.dropHold) this._qualified = false;
    }

    const breathing = !this.qualified && this._below <= this.breathGrace && this.altitude > 0;
    if (this.qualified) this.streak += dt;
    else if (this._below > this.breathGrace) this.streak = 0;

    const lift = this.qualified ? Math.min(2.8, 1.8 + this.streak * 0.08) : breathing ? 0 : -1.4;
    this.velocity = damp(this.velocity, lift, 2.5, dt);
    this.altitude = clamp(this.altitude + this.velocity * dt, 0, this.maxAltitude);
    if (this.altitude === 0 || this.altitude === this.maxAltitude) this.velocity = 0;

    const flying = this.altitude > 0.5 && (this.qualified || breathing);
    this.speed = damp(this.speed, flying ? Math.min(7, 5 + this.streak * 0.1) : 0, 1.8, dt);
    if (this.altitude > 0.5) this.meters += this.speed * dt;
    while (this.meters >= this.nextStar) {
      if (this.qualified && this.altitude >= 8) this.stars++;
      this.nextStarIndex++;
    }
    this.segments = Math.floor(this.meters / this.segmentLength);
    return this;
  }

  get qualified() { return this._qualified; }
  get grounded() { return this.altitude === 0; }
  get nextStar() { return this.nextStarIndex * this.starEvery; }
}
