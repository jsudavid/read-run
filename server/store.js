// 照片中转的内存存储：配对码 -> { buf, mime, expireAt, filled }
// 硬约束（docs/adr/0002）：只在内存，进程重启即全丢；1 小时后删除；不落盘、不入库。
// 流程：教室电脑 reserve 占位并显码 -> 手机 fill 上传 -> 教室电脑 get 取（1 小时内可反复取）。
// 防恶作剧：一个码只接受一次上传（投影上的码可能被学生扫到），换照片需在教室端重新生成码。
// 读/删需另一把 128 位读取密钥（只有教室电脑持有）：6 位码可被穷举，但照片读不走。
import { randomInt, randomBytes, timingSafeEqual } from 'node:crypto';

export const TTL_MS = 60 * 60 * 1000;
const MAX_ROOMS = 2000;                     // 同时存活的配对码上限
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;  // 内存中照片总量上限
const store = new Map();
let totalBytes = 0;

function remove(code) {
  const item = store.get(code);
  if (!item) return;
  if (item.buf) totalBytes -= item.buf.length;
  store.delete(code);
}

function alive(code) {
  const item = store.get(code);
  if (!item) return null;
  if (Date.now() > item.expireAt) {
    remove(code);
    return null;
  }
  return item;
}

// 码是取照片的凭证，用密码学随机数；有限次重试，码空间耗尽时返回 null 而不是死循环
function newCode() {
  for (let i = 0; i < 50; i++) {
    const code = String(randomInt(100000, 1000000));
    if (!store.has(code)) return code;
  }
  return null;
}

export function sweep() {
  const now = Date.now();
  for (const [code, item] of store) if (now > item.expireAt) remove(code);
}

function keyOk(item, key) {
  if (typeof key !== 'string') return false;
  const a = Buffer.from(item.key);
  const b = Buffer.from(key);
  return a.length === b.length && timingSafeEqual(a, b);
}

// 返回 { code, key, expireAt }；容量满时返回 null
export function reserve() {
  if (store.size >= MAX_ROOMS) sweep();
  if (store.size >= MAX_ROOMS) return null;
  const code = newCode();
  if (!code) return null;
  const key = randomBytes(16).toString('base64url');
  const expireAt = Date.now() + TTL_MS;
  store.set(code, { key, buf: null, mime: null, expireAt, filled: false });
  return { code, key, expireAt };
}

// 返回 'ok' | 'not_found' | 'locked' | 'full'
export function fill(code, buf, mime) {
  const item = alive(code);
  if (!item) return 'not_found';
  if (item.filled) return 'locked';
  if (totalBytes + buf.length > MAX_TOTAL_BYTES) return 'full';
  totalBytes += buf.length;
  item.buf = buf;
  item.mime = mime;
  item.filled = true;
  return 'ok';
}

// null=不存在/已过期/密钥不对；{ pending:true }=已占位待上传；否则返回图片
export function get(code, key) {
  const item = alive(code);
  if (!item || !keyOk(item, key)) return null;
  if (!item.filled) return { pending: true, expireAt: item.expireAt };
  return { pending: false, buf: item.buf, mime: item.mime, expireAt: item.expireAt };
}

// 教室端提前删除今日照片（需密钥）
export function drop(code, key) {
  const item = alive(code);
  if (item && keyOk(item, key)) remove(code);
}

export function startSweeper(intervalMs = 60 * 1000) {
  const timer = setInterval(sweep, intervalMs);
  timer.unref?.();
  return timer;
}
