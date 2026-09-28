import { defineConfig } from 'vite';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

// 构建时生成 Service Worker：把本次构建产物全部列入预缓存清单，
// 首屏加载后即可抗断网（ADR-0001）。缓存名带内容哈希，每次部署自动换代。
function serviceWorkerPlugin() {
  return {
    name: 'read-run-sw',
    apply: 'build',
    generateBundle(_options, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const shell = ['/', ...files.map((f) => '/' + f)];
      const version = createHash('sha256').update(files.sort().join('|')).digest('hex').slice(0, 10);
      const source = `// 自动生成，勿手改（vite.config.js）
const CACHE = 'read-run-${version}';
const SHELL = ${JSON.stringify([...new Set(shell)])};

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    // 页面：联网时取最新，断网时回退缓存
    e.respondWith(fetch(req).catch(() => caches.match(url.pathname === '/' ? '/' : url.pathname)));
    return;
  }
  // 带哈希的静态资源：缓存优先
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
`;
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

export default defineConfig({
  root: resolve(import.meta.dirname, 'web'),
  base: '/',
  appType: 'mpa',
  build: {
    outDir: resolve(import.meta.dirname, 'dist'),
    emptyOutDir: true,
    target: 'es2020',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      input: { main: resolve(import.meta.dirname, 'web/index.html') },
    },
  },
  plugins: [serviceWorkerPlugin()],
});
