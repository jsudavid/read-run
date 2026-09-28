import * as THREE from 'three';
import { mulberry32 } from './noise.js';

// 沿路散布的道具（树、石、栅栏…）：一个 InstancedMesh 画几百个，滚出左边就从右边重生。
// 平时只平移整个网格；个体只在重生时重算矩阵。原点定期回拨，长时间运行不丢浮点精度。
const REBASE = 1000;

export class Scatter {
  // place(item, rand) 设置 item.z/y/s(缩放)/sy(纵向缩放)/rot/tilt/color，y 为相对地面的偏移
  // left/span：道具在场景 X 上的分布范围 [left, left+span)；jitter=false 时等间距（栅栏桩）
  constructor({ geometry, material, count, place, heightAt, seed = 1, castShadow = false, left = -110, span = 240, jitter = true }) {
    this.left = left;
    this.span = span;
    this.place = place;
    this.heightAt = heightAt;
    this.rand = mulberry32(seed);
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.castShadow = castShadow;
    this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.origin = 0;       // 世界坐标原点偏移
    this.items = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._p = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const it = { x: left + ((i + (jitter ? this.rand() : 0.5)) / count) * span };
      this._spawn(it, i);
      this.items.push(it);
    }
    this._commit();
  }

  _spawn(it, i) {
    Object.assign(it, { z: 0, y: 0, s: 1, sy: 1, rot: 0, tilt: 0, color: null, hide: false, wx: this.origin + it.x });
    this.place(it, this.rand);
    const wx = this.origin + it.x;
    this._p.set(it.x, this.heightAt(wx, it.z) + it.y, it.z);
    this._e.set(it.tilt, it.rot, it.tilt * 0.5);
    this._q.setFromEuler(this._e);
    const s = it.hide ? 0 : it.s;
    this._s.set(s, s * it.sy, s);
    this._m.compose(this._p, this._q, this._s);
    this.mesh.setMatrixAt(i, this._m);
    if (it.color) this.mesh.setColorAt(i, this._c.set(it.color));
  }

  _commit() {
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(scroll) {
    if (scroll - this.origin > REBASE) {
      const shift = REBASE;
      this.origin += shift;
      for (let i = 0; i < this.items.length; i++) {
        this.items[i].x -= shift;
        this.mesh.getMatrixAt(i, this._m);
        this._m.elements[12] -= shift;
        this.mesh.setMatrixAt(i, this._m);
      }
      this._commit();
    }
    const off = this.origin - scroll;
    this.mesh.position.x = off;
    let dirty = false;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      while (it.x + off < this.left) {
        it.x += this.span;
        this._spawn(it, i);
        dirty = true;
      }
    }
    if (dirty) this._commit();
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.dispose();
  }
}
