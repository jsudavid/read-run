# Cloudflare Pages 部署

本项目可部署到 Cloudflare Pages Free：三款游戏、声音分析和“今日主角”本地图片处理均在浏览器运行。生产站点只发布静态 `dist` 文件，不运行 Express、Docker、配对码或照片上传服务。

Cloudflare Pages 提供 HTTPS，满足浏览器 `getUserMedia` 对麦克风安全上下文的要求。

## 当前部署

| 项目 | 本次发布记录 |
| --- | --- |
| 日期 | 2026-09-28 |
| Pages 项目名 | `read-run` |
| 生产地址 | https://read-run.pages.dev/ |
| 当前版本地址 | https://06b4652b.read-run.pages.dev/ |
| 环境 / 分支 | `Production` / `main` |
| 发布方式 | 控制台 Direct Upload，未连接 Git |
| 上传包 | `deploy/read-run-cloudflare-pages.zip`，约 222 KB |
| 当前版本备份 | `deploy/releases/read-run-20260928-06b4652b.zip` |

管理入口：登录 Cloudflare 后进入 **Compute → Workers & Pages → read-run**。本次控制台已显示 “Success!”，并在 Deployments 中记录生产版本 `06b4652b`。使用 Pages 免费静态托管，未创建付费资源或订阅。

发布记录：

| 日期 | 版本 | 更新内容 | 本地备份 |
| --- | --- | --- | --- |
| 2026-09-28 | `e3a6a172` | 首次发布三款游戏和本地选图 | `deploy/releases/read-run-20260928-e3a6a172.zip` |
| 2026-09-28 | `722d8c45` | 页面来源说明改为作者联系方式 | `deploy/releases/read-run-20260928-722d8c45.zip` |
| 2026-09-28 | `06b4652b` | 修复校准入口、实时音量显示和模拟声源灵敏度 | `deploy/releases/read-run-20260928-06b4652b.zip` |

本次上传包 SHA-256：`627404b22e813bfb4366a4bf9815e4b48e038ea66d6ce810a394ab3165b831fe`。

## 部署前检查

```sh
node --version       # 应为 >= 22.12.0
npm ci
npm test
npm run build
```

构建完成后应存在 `dist/index.html` 与 `dist/sw.js`。`.node-version` 声明构建所用的 Node 版本，本地环境仍以 `node --version` 的结果为准。

## Git 集成（备选）

若以后另建一个连接 Git 的 Pages 项目，可使用以下配置。当前 `read-run` 采用 Direct Upload，日常更新使用下文“后续更新”的步骤。

| 设置 | 值 |
| --- | --- |
| Production branch | 实际生产分支，例如 `main` |
| Framework preset | `Vite` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION=22.12.0` |

选择 Cloudflare Free 计划即可开始。部署完成后从 `*.pages.dev` 地址打开并允许麦克风权限。

## Direct Upload（不连接 Git）

本项目采用控制台 **Direct Upload**，发布过程如下（2026-09-28 实际界面）：

1. 登录 Cloudflare，进入 **Compute → Workers & Pages**，点击 **Create application**。
2. 在 “Create an app” 页面底部点击 **Continue to Pages**。这是当前界面进入 Pages 的入口。
3. 在 **Drag and drop your files** 下点击 **Get started**。
4. 将 **Project name** 填为 `read-run`，点击 **Create project**。首次创建需要这一步，日常更新进入已有项目即可。
5. 在 **Upload your project assets** 区域点击 **file**，选择 `deploy/read-run-cloudflare-pages.zip`。也可选择 **folder** 上传整个 `dist` 目录。
6. 等待文件上传并校验成功，再点击 **Deploy site**。

压缩包的根目录直接包含 `index.html`、`sw.js`、`_headers` 和 `assets/`，不要再套一层 `dist/` 或项目目录。选择 Pages 的免费静态站点，不需要 Workers、R2 或数据库。

## 后续更新

在项目根目录执行：

```sh
npm ci
npm test
npm run build
cd dist
zip -r -FS ../deploy/read-run-cloudflare-pages.zip .
cd ..
```

`zip -FS` 会同步当前构建文件并清理压缩包里的旧资源，避免上一次构建的 JS/CSS 混入新包。使用 macOS/Linux 自带或已安装的 `zip`；没有 `zip` 时直接上传 `dist` 文件夹。

1. 进入 **Compute → Workers & Pages → read-run → Deployments**，点击 **Create deployment**。
2. 在 **Select your deployment environment** 选择 **Production**。若选择 Preview，只生成预览版本，不替换教学用的生产地址。
3. 点击 **file** 上传刚生成的压缩包，或点击 **folder** 上传整个 `dist` 文件夹。
4. 等待全部文件上传成功，点击 **Save and deploy**。这是日常更新按钮；首次创建项目时的按钮叫 **Deploy site**。
5. 从 https://read-run.pages.dev/ 验证新版本。生产地址保持不变，每次发布还会生成一个单独的版本地址。

这个 Direct Upload 项目不会自动从本地目录或 Git 获取改动，每次更新都需要重新构建和上传。每次上线后建议把压缩包另存到 `deploy/releases/`，文件名包含日期或版本号。

更新后重新打开生产地址或刷新页面，让 Service Worker 检查新版本。若页面仍旧，可关闭本站其他标签页后再次刷新；必要时在浏览器开发者工具的 **Application → Service Workers** 中注销本站旧 Worker，再刷新。

### 恢复旧版

保留上一版部署包。需要恢复时，在同一项目中执行 **Create deployment → Production**，上传旧包，再点击 **Save and deploy**。这会重新发布旧内容，生产地址保持不变。首版和当前版都已保存在 `deploy/releases/`。

## Wrangler 发布（可选）

适合当前工作目录没有 Git 仓库或希望手动发布构建产物的情况。先在 Cloudflare 账户中登录 Wrangler；下列命令不会输出访问令牌。

```sh
npx wrangler login
npm run build
npx wrangler pages deploy dist --project-name read-run --branch main
```

当前 `read-run` 项目已经创建，无需再执行 `pages project create`。浏览器登录与 Wrangler 登录相互独立；首次使用 CLI 仍需 `npx wrangler login`。`wrangler pages deploy` 的输出会给出本次发布 URL；不要把 `?sim=1` 作为生产教学入口，该参数仅用于没有麦克风时的调试。

## 图片、缓存与响应头

“今日主角”通过当前设备的文件选择器读取 JPG、PNG 或 WebP。原图和处理结果都不上传；刷新或关闭页面后需要再次选择。麦克风声音同样只在当前浏览器处理。

`web/public/_headers` 会随 Vite 构建复制到 `dist/_headers`。它允许本站使用麦克风，禁用摄像头和定位权限，给带哈希的 `/assets/*` 设置长期缓存，并让 HTML 和 Service Worker 每次检查更新。该文件没有 CSP，因此不会阻断本地图片处理使用的 `blob:` / `data:` URL。

Service Worker 在首次成功加载后预缓存本次构建的游戏资源；网络短暂中断不影响已加载的游戏或本地选图。

## 发布状态与验收

本次灵敏度修复发布验证（版本 `06b4652b`）：

- `npm test`：20 项通过；`npm run build`：成功。
- 控制台选择 `Production`，上传包内 5 个文件全部成功上传，点击 **Save and deploy** 后显示 “Success!”。
- 公网首页、`sw.js`、JS 和 CSS 均返回 HTTP 200，SHA-256 与本地 `dist` 对应文件逐一相同；麦克风权限策略和缓存响应头正常。
- 在公网 `?sim=1&quality=low` 验证开始前校准入口、开始按钮和三款游戏切换。灵敏度从 100 调到 50、80 再恢复 100，数值正常更新；动物追赶与云端探险的音量百分比和音量条实时同步，云端探险可以上升并收集星星。
- 未发现本站脚本运行时错误。浏览器扩展产生的主题依赖警告与本站无关；本次使用模拟声量，未进行真实麦克风朗读测试。

此前发布验证记录：

- `npm test`：19 项通过；`npm run build`：成功。
- 本地桌面和手机各 153 项 WebGL 检查通过，包括三款游戏的相机、暂停、计分、图片解码和头像映射。
- 生产首页、`sw.js` 均返回 HTTP 200；确认 HTTPS、`Permissions-Policy` 与 `Cache-Control: no-cache` 生效。
- 在公网生产地址实际选择本地 PNG，头像预览与主角更新成功。
- 使用 `?sim=1&quality=low` 在公网验证开始及三款游戏切换，未记录运行时错误。该验证使用模拟声量，未替代教室麦克风和实际朗读验收。

本地测试和构建通过只表示具备部署条件。后续更新也需确认 Cloudflare 发布成功，并从生产地址完成一次验收。

上线后分别进入三款游戏，确认开始、暂停、视角切换可用；选择本地图片后切换场景，头像应继续显示，删除后恢复默认主角。刷新页面应清除今日照片，允许麦克风后朗读应驱动画面。
