// 映射层：声量强度 L(0..1) -> 场景驱动量。两个追逐场景共用。
// 瞬时 L 驱动动作表现（好懂）；连续达标驱动危险逼近与"已逃离"累积（防咳嗽、拍桌刷分）。
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class Signal {
  constructor(opts = {}) {
    this.goal = opts.goal ?? 0.5;         // 达标线：部署时预设，不开放给老师调
    this.spikeHold = 0.3;                 // 过线需持续 0.3s 才算达标（尖峰过滤）
    this.dropHold = 0.12;                 // 掉线需持续 0.12s 才算掉线（防音节间闪烁）
    this.dangerUp = 0.12;                 // 未达标时危险上升速率 /s：安静约 5s 会被追上
    this.dangerDown = 0.18;               // 达标时危险下降速率 /s
    this.streakGrace = 0.8;               // 换气停顿宽限：连续达标计时不立刻回落
    this.reset();
  }

  reset() {
    this.speed = 0;        // 0..1 平滑后的瞬时声量表现
    this.danger = 0.35;    // 0..1 危险逼近度
    this.run = 0;          // 0..1 奔跑强度（达标越稳越接近 1）
    this.worldSpeed = 0;   // 米/秒，世界滚动速度
    this.meters = 0;       // 已逃离距离，只增不减
    this.streak = 0;       // 连续达标秒数
    this._above = 0;
    this._below = 0;
    this._qualified = false;
  }

  update(L, dt) {
    this.speed += (L - this.speed) * (L > this.speed ? 0.5 : 0.12);

    if (L >= this.goal) {
      this._above += dt;
      this._below = 0;
      if (this._above >= this.spikeHold) this._qualified = true;
    } else {
      this._below += dt;
      this._above = 0;
      if (this._below >= this.dropHold) this._qualified = false;
    }

    if (this._qualified) {
      this.danger = clamp(this.danger - this.dangerDown * dt, 0, 1);
      this.streak += dt;
    } else {
      this.danger = clamp(this.danger + this.dangerUp * dt, 0, 1);
      if (this._below > this.streakGrace) this.streak = Math.max(0, this.streak - dt * 3);
    }

    const target = clamp((this._qualified ? 0.75 : 0.1) + this.speed * 0.3, 0, 1);
    this.run += (target - this.run) * Math.min(1, dt * 2.2);
    this.worldSpeed = 1.6 + this.run * 9.4;
    if (this._qualified) this.meters += this.worldSpeed * dt;
    return this;
  }

  get qualified() { return this._qualified; }
  get caught() { return this.danger >= 1; }

  // 被追上：危险回到安全距离，已逃离距离与连续达标都保留。
  softReset() {
    this.danger = 0.45;
    this._above = 0;
    this._qualified = false;
  }
}
