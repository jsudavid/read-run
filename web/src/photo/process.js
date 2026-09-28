// 照片处理（浏览器端，前期简版，见 Q20 "先简单做"）。
// 不引 ML 抠图库（会破坏离线缓存体积）。做法：照片裁成头像圆 + 主色调双色调压暗，
// 投影远处认得出"是自己人 / 今天主角是X色的"，但脸部细节被压掉（对齐 Q9/Q13/Q20）。
// 注意：照片像素只停留在本机 canvas，处理完只把成品 sprite 交给渲染层。

function decode(blob) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('无法解码图片'));
    };
    img.src = url;
  });
}

// 取主色调：降采样后在 HSV 里挑"较饱和、非极暗极亮"的主导色
function dominantColor(cvs) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 32;
  const g = c.getContext('2d');
  g.drawImage(cvs, 0, 0, 32, 32);
  const d = g.getImageData(0, 0, 32, 32).data;
  let br = 0, bg = 0, bb = 0, n = 0;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    const sat = mx === 0 ? 0 : (mx - mn) / mx;
    if (sat > 0.18 && mx > 40 && mx < 245) { br += r; bg += gg; bb += b; n++; }
  }
  if (!n) return { r: 120, g: 170, b: 255 }; // 兜底冷蓝
  return { r: Math.round(br / n), g: Math.round(bg / n), b: Math.round(bb / n) };
}

// blob -> { headSprite: canvas(圆形双色调头像), mainColor:'#rrggbb' }
export async function processPhoto(blob) {
  const img = await decode(blob);
  const SZ = 220;
  const cvs = document.createElement('canvas');
  cvs.width = SZ; cvs.height = SZ;
  const g = cvs.getContext('2d');

  // cover-fit，偏上取（照片一般脸在上半部）
  const scale = Math.max(SZ / img.width, SZ / img.height);
  const dw = img.width * scale, dh = img.height * scale;
  g.drawImage(img, (SZ - dw) / 2, (SZ - dh) * 0.3, dw, dh);

  const mc = dominantColor(cvs);
  const hex = `#${[mc.r, mc.g, mc.b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;

  // 双色调压暗：暗部 -> 近黑，亮部 -> 主色，中间过渡。脸部细节被压平。
  const src = g.getImageData(0, 0, SZ, SZ);
  const p = src.data;
  const dark = { r: 12, g: 16, b: 24 };
  for (let i = 0; i < p.length; i += 4) {
    const lum = (p[i] * 0.299 + p[i + 1] * 0.587 + p[i + 2] * 0.114) / 255;
    const t = Math.pow(lum, 1.3); // 压暗中间调
    p[i] = dark.r + (mc.r - dark.r) * t;
    p[i + 1] = dark.g + (mc.g - dark.g) * t;
    p[i + 2] = dark.b + (mc.b - dark.b) * t;
  }
  g.putImageData(src, 0, 0);

  // 裁成圆 + 描边（作为跑动主角的"头"）
  const out = document.createElement('canvas');
  out.width = SZ; out.height = SZ;
  const og = out.getContext('2d');
  og.save();
  og.beginPath();
  og.arc(SZ / 2, SZ / 2, SZ / 2 - 4, 0, Math.PI * 2);
  og.clip();
  og.drawImage(cvs, 0, 0);
  og.restore();
  og.lineWidth = 6;
  og.strokeStyle = hex;
  og.beginPath();
  og.arc(SZ / 2, SZ / 2, SZ / 2 - 4, 0, Math.PI * 2);
  og.stroke();

  return { headSprite: out, mainColor: hex };
}
