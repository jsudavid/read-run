// 极简内存限流：固定窗口，按客户端 IP 计数。单实例部署足够；多实例需换共享存储。
export function rateLimit({ windowMs, max }) {
  const hits = new Map();
  const timer = setInterval(() => hits.clear(), windowMs);
  timer.unref?.();
  return (req, res, next) => {
    const key = req.ip || 'unknown';
    const n = (hits.get(key) || 0) + 1;
    hits.set(key, n);
    if (n > max) {
      res.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return res.status(429).json({ error: 'too_many_requests' });
    }
    next();
  };
}
