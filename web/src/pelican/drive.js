// 声音 -> 骑行：没有声音就不踩（车滑行着停下），声音越大、读得越持久，骑得越快。
// effort 跟"响不响"；sustain 跟"读得久不久"（连续朗读约 10 秒蓄满，停下后慢慢泄掉）。
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class BikeDrive {
  constructor() {
    this.gate = 0.1;       // 声量低于它算"没声音"（底噪、翻书声）
    this.bridge = 0.45;    // 句间换气停顿 0.45s 内不断踩
    this.maxSpeed = 12.5;  // m/s ≈ 45 km/h
    this.reset();
  }

  reset() {
    this.effort = 0;       // 0..1 当下用力程度
    this.sustain = 0;      // 0..1 持久度
    this.speed = 0;        // m/s
    this.accel = 0;
    this.meters = 0;       // 总里程，只增不减
    this.pedaling = false;
    this.streak = 0;       // 连续朗读秒数（HUD 用）
    this._quiet = 99;
  }

  update(L, dt) {
    const voiced = L > this.gate;
    this._quiet = voiced ? 0 : this._quiet + dt;
    this.pedaling = this._quiet < this.bridge;

    const e = voiced ? clamp((L - this.gate) / (1 - this.gate), 0, 1) : 0;
    this.effort += (e - this.effort) * Math.min(1, dt * (e > this.effort ? 6 : 2.5));

    if (this.pedaling) {
      this.sustain = Math.min(1, this.sustain + dt / 10);
      this.streak += dt;
    } else {
      if (this._quiet > 1.5) this.sustain = Math.max(0, this.sustain - dt / 4);
      if (this._quiet > 1.5) this.streak = 0;
    }

    let acc;
    if (this.pedaling) {
      const target = this.maxSpeed * (0.18 + 0.82 * this.effort) * (0.45 + 0.55 * this.sustain);
      acc = clamp((target - this.speed) * 1.2, -3, 3.2);
    } else {
      acc = -(2.2 + this.speed * 0.35); // 不踩就刹停：约 2 秒停稳
    }
    this.accel = acc;
    this.speed = clamp(this.speed + acc * dt, 0, this.maxSpeed);
    if (this.speed < 0.05 && !this.pedaling) this.speed = 0;
    this.meters += this.speed * dt;
    return this;
  }

  get kmh() { return this.speed * 3.6; }
}
