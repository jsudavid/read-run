import { Renderer } from './three/renderer.js';
import { SimSource } from './audio/sim.js';
import { PelicanMode } from './pelican/mode.js';
import { ChaseMode } from './chase.js';
import { BalloonMode } from './balloon/mode.js';

// 岩浆逃生（worlds/lavaWorld.js、actors/lava.js）按需求暂停开发：代码保留，不进场景列表
export const MODES = [
  { id: 'bike', name: '鹈鹕骑行', create: (r, o) => new PelicanMode(r, o) },
  { id: 'wolf', name: '动物追赶', create: (r, o) => new ChaseMode(r, o) },
  { id: 'balloon', name: '云端探险', create: (r, o) => new BalloonMode(r, o) },
];

// 宿主：声源 -> 当前模式（各自负责模拟、镜头、渲染）。UI 通过 on.* 拿事件，通过 hud 读状态。
export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.sim = new SimSource();
    this.source = this.sim;         // 开场待机用模拟声源，点"开始"后换成麦克风
    this.attract = true;
    this.paused = false;
    this.photo = null;
    this.modeIdx = 0;
    this.nextMilestone = 1;
    this.t = 0;
    this.sceneStates = new Map();
    this.on = { milestone: null, caught: null, fish: null, star: null, frame: null, mode: null, view: null, pause: null };
    this.renderer.onTierChange = (tier) => this.mode?.applyTier(tier);
    this.setMode(0);
  }

  setMode(i) {
    if (this.mode) this.sceneStates.set(this.modeIdx, { view: this.mode.view.save(), settings: { ...this.mode.settings } });
    this.mode?.dispose();
    this.mode = null;               // 新模式构造期间渲染器回调不要打到旧模式上
    this.modeIdx = i;
    const mode = MODES[i].create(this.renderer, { attract: this.attract });
    const saved = this.sceneStates.get(i);
    if (saved) {
      mode.view.restore(saved.view);
      Object.assign(mode.settings, saved.settings);
    }
    mode.view.onChange = () => this.on.view?.(mode.view);
    mode.on.caught = () => this.on.caught?.();
    mode.on.fish = (golden) => this.on.fish?.(golden);
    mode.on.star = (count) => this.on.star?.(count);
    if (this.photo) mode.setPhoto(this.photo.canvas, this.photo.color);
    this.mode = mode;
    // Place actors and apply restored settings before rendering a new paused scene.
    if (this.paused) mode.update(0, 0, this.t);
    this.nextMilestone = 1;
    this.on.mode?.(mode);
  }

  // 正式开始：换成真实声源，从零米重新出发
  begin(source) {
    this.source = source;
    this.attract = false;
    this.setPaused(false);
    this.reset();
  }

  setPaused(paused) {
    if (this.attract || this.paused === paused) return;
    this.paused = paused;
    this.on.pause?.(paused);
  }

  // 清空当前场景的进展与累积（老师"重置"、换场景都走这里）
  reset() { this.setMode(this.modeIdx); }

  switchMode(i) {
    if (i !== this.modeIdx) this.setMode(i);
  }

  setPhoto(canvas, color) {
    this.photo = { canvas, color };
    this.mode.setPhoto(canvas, color);
  }

  clearPhoto() {
    this.photo = null;
    this.mode.clearPhoto();
  }

  start() {
    const ro = new ResizeObserver(() => this.renderer.resize());
    ro.observe(this.canvas);
    let last = performance.now();
    const frame = (now) => {
      requestAnimationFrame(frame);
      const ms = now - last;
      if (ms < 15) return; // 高刷屏上封顶 60fps，给核显留余量
      last = now;
      this.renderer.adapt(ms);
      this._tick(Math.min(0.05, ms / 1000));
    };
    requestAnimationFrame(frame);
  }

  _tick(dt) {
    const L = this.source.update(dt);
    const mode = this.mode;
    if (!this.paused) {
      this.t += dt;
      mode.update(dt, L, this.t);
      if (!this.attract && mode.meters >= this.nextMilestone * mode.milestone) {
        this.on.milestone?.(this.nextMilestone * mode.milestone);
        this.nextMilestone++;
        mode.celebrate();
      }
    } else {
      mode.updateCamera(dt, this.t, true);
    }
    mode.render(this.t);
    this.on.frame?.(mode.hud, L);
  }
}
