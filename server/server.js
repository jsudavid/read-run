import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { reserve, fill, get, drop, startSweeper } from './store.js';
import { rateLimit } from './ratelimit.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT) || 8080;
const DEV = process.env.NODE_ENV === 'development';
// 手机访问的基址。本机测试时 localhost 手机访问不到，可设为局域网地址，如 http://192.168.1.20:8080
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/+$/, '');
const CODE_RE = /^\d{6}$/;

const app = express();
app.disable('x-powered-by');
// 只信任前面一跳反代（Caddy），防止客户端伪造 X-Forwarded-For 绕过限流
app.set('trust proxy', Number(process.env.TRUST_PROXY ?? 1));

app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'no-referrer');
  res.set('Permissions-Policy', 'microphone=(self), geolocation=()');
  next();
});

// 按文件头识别图片真实类型，不信任客户端声明的 Content-Type
function sniff(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.readUInt32BE(0) === 0x89504e47) return 'image/png';
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const baseUrl = (req) => PUBLIC_URL || `${req.protocol}://${req.get('host')}`;

// 教室电脑：生成配对码（码给手机上传用，key 只留在教室电脑用来读照片）
app.post('/api/room', rateLimit({ windowMs: 60_000, max: 30 }), async (req, res) => {
  const room = reserve();
  if (!room) return res.status(503).json({ error: 'busy' });
  const uploadUrl = `${baseUrl(req)}/upload.html?code=${room.code}`;
  let qr = null;
  try {
    qr = await QRCode.toDataURL(uploadUrl, { margin: 1, width: 360, errorCorrectionLevel: 'M' });
  } catch { /* 二维码失败不阻断，数字码仍可用 */ }
  res.set('Cache-Control', 'no-store');
  res.json({ ...room, uploadUrl, qr });
});

// 手机：上传照片（原始二进制）
app.post(
  '/api/room/:code/photo',
  rateLimit({ windowMs: 60_000, max: 20 }),
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '6mb' }),
  (req, res) => {
    if (!CODE_RE.test(req.params.code)) return res.status(404).json({ error: 'code_not_found' });
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(415).json({ error: 'unsupported_type' });
    const mime = sniff(req.body);
    if (!mime) return res.status(415).json({ error: 'unsupported_type' });
    const r = fill(req.params.code, req.body, mime);
    if (r === 'not_found') return res.status(404).json({ error: 'code_not_found' });
    if (r === 'locked') return res.status(409).json({ error: 'code_used' });
    if (r === 'full') return res.status(503).json({ error: 'busy' });
    res.json({ ok: true });
  }
);

// 教室电脑：轮询取照片。404=码不存在/过期；202=等待上传；200=图片
app.get('/api/room/:code/photo', rateLimit({ windowMs: 60_000, max: 600 }), (req, res) => {
  res.set('Cache-Control', 'no-store');
  const item = CODE_RE.test(req.params.code) ? get(req.params.code, req.get('x-room-key')) : null;
  if (!item) return res.status(404).json({ error: 'code_not_found' });
  if (item.pending) return res.status(202).json({ pending: true, expireAt: item.expireAt });
  res.set('Content-Type', item.mime);
  res.set('X-Expire-At', String(item.expireAt));
  res.send(item.buf);
});

// 教室电脑：提前删除今日照片
app.delete('/api/room/:code', rateLimit({ windowMs: 60_000, max: 30 }), (req, res) => {
  if (CODE_RE.test(req.params.code)) drop(req.params.code, req.get('x-room-key'));
  res.status(204).end();
});

app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }));

if (DEV) {
  const { createServer } = await import('vite');
  const vite = await createServer({ configFile: path.join(ROOT, 'vite.config.js'), server: { middlewareMode: true } });
  app.use(vite.middlewares);
} else {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) {
    console.error('[read-run] 找不到 dist/，请先运行 npm run build');
    process.exit(1);
  }
  app.use('/assets', express.static(path.join(DIST, 'assets'), { immutable: true, maxAge: '1y' }));
  app.use(express.static(DIST, { extensions: ['html'], setHeaders: (res) => res.set('Cache-Control', 'no-cache') }));
}

app.use((err, req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'too_large' });
  console.error('[read-run]', err);
  res.status(500).json({ error: 'server_error' });
});

startSweeper();
app.listen(PORT, () => console.log(`[read-run] ${DEV ? 'dev' : 'prod'} serving on :${PORT}`));
