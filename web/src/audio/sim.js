// 模拟声源：合成"全班齐读"的声量曲线（整句起伏 + 换气停顿 + 偶尔整体变小声）。
// 用途：开场待机画面的演示动画；?sim=1 时替代真实麦克风做调试。与 AudioEngine 接口一致。
export class SimSource {
  constructor() {
    this.t = 0;
    this.L = 0;
    this.gain = 40;
  }

  static isSupported() { return true; }
  async start() {}
  async stop() {}
  async restart() {}
  get deviceId() { return 'sim'; }
  setSensitivity(v) { this.gain = 8 * Math.pow(16.25, Math.max(0, Math.min(100, Number(v))) / 100); }

  update(dt) {
    this.t += dt;
    const t = this.t;
    const SENT = 3.7;                 // 一句 3.3s + 换气 0.4s
    const ph = t % SENT;
    // 整句包络：起音 0.25s，收尾 0.3s，句间换气为 0
    let env = 0;
    if (ph < 3.3) env = Math.min(1, ph / 0.25) * Math.min(1, (3.3 - ph) / 0.3);
    // 音节级抖动
    const syl = 0.08 * Math.sin(t * 23) + 0.05 * Math.sin(t * 37 + 1.3);
    // 每 ~40s 出现一段 8s 左右的"整体变小声"，让危险逼近也能被看到
    const lull = 1 - 0.55 * Math.max(0, Math.sin(t * 0.157) - 0.72) / 0.28;
    const target = Math.min(1, Math.max(0, (0.72 + syl) * env * lull * (this.gain / 40)));
    this.L += (target - this.L) * (target > this.L ? 0.35 : 0.075);
    return this.L;
  }
}
