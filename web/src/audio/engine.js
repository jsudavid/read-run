// 音频引擎：声量计算逐行沿用 2D 版已调好的手感（FR-02/03/04/06）。
// 红线：回声消除/降噪/自动增益全部关闭；绝不外放麦克风声音（哑节点 gain=0，防啸叫 NFR-07）。

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.analyser = null;
    this.stream = null;
    this.buf = null;
    this.useFloat = true;
    this.raw = 0;
    this.level = 0;
    this.floor = 0.006;
    this.gain = 40;
    this.L = 0; // 归一化声量强度 0..1，全部反馈的唯一输入
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.ctx?.state === 'suspended') this.ctx.resume().catch(() => {});
    });
  }

  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  static async listMics() {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const all = await navigator.mediaDevices.enumerateDevices();
    return all
      .filter((d) => d.kind === 'audioinput')
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `麦克风 ${i + 1}` }));
  }

  get deviceId() {
    return this.stream?.getAudioTracks()[0]?.getSettings().deviceId || '';
  }

  async start(deviceId) {
    if (!AudioEngine.isSupported()) throw new Error('INSECURE');
    const audio = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { ...audio, deviceId: { exact: deviceId } } : audio,
      });
    } catch (e) {
      // 记住的设备被拔掉了：退回默认设备，别让老师卡住
      if (!deviceId || (e.name !== 'OverconstrainedError' && e.name !== 'NotFoundError')) throw e;
      this.stream = await navigator.mediaDevices.getUserMedia({ audio });
    }
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === 'suspended') await this.ctx.resume();

    const src = this.ctx.createMediaStreamSource(this.stream);
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0;
    src.connect(this.analyser);
    const mute = this.ctx.createGain();
    mute.gain.value = 0;
    this.analyser.connect(mute);
    mute.connect(this.ctx.destination);

    this.useFloat = typeof this.analyser.getFloatTimeDomainData === 'function';
    this.buf = this.useFloat ? new Float32Array(this.analyser.fftSize) : new Uint8Array(this.analyser.fftSize);
  }

  async stop() {
    this.stream?.getTracks().forEach((t) => t.stop());
    await this.ctx?.close?.().catch(() => {});
    this.ctx = this.analyser = this.stream = null;
  }

  // 换麦克风：保留增益，底噪会在几秒内重新自适应
  async restart(deviceId) {
    await this.stop();
    await this.start(deviceId);
  }

  readRMS() {
    if (!this.analyser) return 0;
    let s = 0;
    if (this.useFloat) {
      this.analyser.getFloatTimeDomainData(this.buf);
      for (let i = 0; i < this.buf.length; i++) s += this.buf[i] * this.buf[i];
    } else {
      this.analyser.getByteTimeDomainData(this.buf);
      for (let i = 0; i < this.buf.length; i++) {
        const v = (this.buf[i] - 128) / 128;
        s += v * v;
      }
    }
    return Math.sqrt(s / this.buf.length);
  }

  update(dt) {
    this.raw = this.readRMS();
    if (this.raw < this.floor) this.floor = this.raw; // 自动噪声地板
    else this.floor = Math.min(0.05, this.floor + 0.00035 * dt * 60);
    this.floor = clamp(this.floor, 0.0008, 0.05);
    this.level += (this.raw - this.level) * (this.raw > this.level ? 0.55 : 0.075); // 快攻慢放
    const x = Math.max(0, (this.level - this.floor) * this.gain);
    this.L = x / (1 + x); // 软饱和归一化
    return this.L;
  }

  // 灵敏度 0..100 -> 增益，指数映射（沿用 2D 版曲线）
  setSensitivity(v) {
    this.gain = 8 * Math.pow(16.25, clamp(v, 0, 100) / 100);
  }
}
