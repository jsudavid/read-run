import { Game, MODES } from './game.js';
import { AudioEngine } from './audio/engine.js';
import { SimSource } from './audio/sim.js';
import { processPhoto } from './photo/process.js';
import { SceneControls } from './scene-controls.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const canvas = $('#stage');
const game = new Game(canvas);
const sceneControls = new SceneControls(game);
const audio = new AudioEngine();
const sim = new SimSource();
const useSim = new URLSearchParams(location.search).get('sim') === '1';
const startBtn = $('#startBtn');
const startErr = $('#startErr');
const pauseBtn = $('#pauseBtn');
const sens = $('#sens');
const sensVal = $('#sensVal');
const micSel = $('#micSel');
const photoInput = $('#photoInput');
const photoChoose = $('#photoChoose');
const photoPreview = $('#photoPreview');
const photoStatus = $('#photoStatus');
let photoOperation = 0;
let toastTimer = 0;

function showToast(title, detail = '', icon = '🐦') {
  const el = document.createElement('div');
  el.className = 'toast in';
  el.innerHTML = '<span class="emo">🐦</span><div><b></b><small></small></div>';
  el.querySelector('.emo').textContent = icon;
  el.querySelector('b').textContent = title;
  el.querySelector('small').textContent = detail;
  $('#toasts').replaceChildren(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove('in');
    setTimeout(() => el.remove(), 500);
  }, 1800);
}

function setNudge(text) {
  const el = $('#nudge');
  el.textContent = text;
  el.classList.toggle('show', !!text);
}

function updatePauseUi(paused) {
  document.body.classList.toggle('paused', paused);
  pauseBtn.disabled = game.attract;
  pauseBtn.textContent = paused ? '▶' : '⏸';
  const action = paused ? '继续' : '暂停';
  pauseBtn.setAttribute('aria-label', action);
  pauseBtn.setAttribute('aria-pressed', String(paused));
  pauseBtn.title = `${action} (空格)`;
  $('#pauseStatus').hidden = !paused;
  if (paused) {
    $('#flash').classList.remove('go');
    $('#flash').textContent = '';
    $('#toasts').replaceChildren();
    clearTimeout(toastTimer);
    setNudge('');
  }
}

function setModeUi(index) {
  const id = MODES[index].id;
  document.body.dataset.mode = id;
  $$('.cams button').forEach((button) => {
    const selected = Number(button.dataset.mode) === index;
    button.classList.toggle('on', selected);
    button.setAttribute('aria-selected', String(selected));
  });
  $('#brandTitle').textContent = MODES[index].name;
  $('#brandSub').textContent = id === 'bike' ? '读得越响越久，骑得越快' : id === 'wolf' ? '保持达标，甩开狼群' : '持续朗读，点亮云端航线';
  $('#gUnit').textContent = id === 'bike' ? 'KM/H' : id === 'wolf' ? '%' : '高度 / m';
  $('.brand .logo').textContent = id === 'bike' ? '🐦' : id === 'wolf' ? '🐺' : '🎈';
  $('#vignette').style.opacity = '0';
  $('#flash').classList.remove('go');
  $('#toasts').replaceChildren();
  clearTimeout(toastTimer);
  setNudge('');
}

function updateHud(hud, level) {
  if (!sceneControls.panel.hidden) sceneControls.update();
  const isBike = hud.kind === 'bike';
  const isBalloon = hud.kind === 'balloon';
  const value = isBike ? Math.min(1, hud.kmh / 45) : isBalloon ? Math.min(1, hud.altitude / 32) : Math.min(1, hud.level);
  $('#gVal').textContent = isBike ? Math.round(hud.kmh) : isBalloon ? Math.round(hud.altitude) : Math.round(hud.level * 100);
  $('#speedArc').style.strokeDashoffset = String(245 * (1 - value));
  $('#lvl').style.width = `${Math.round(level * 100)}%`;
  $('#calMeter').style.width = `${Math.round(level * 100)}%`;
  $('#calValue').textContent = `${Math.round(level * 100)}%`;
  $('#calSource').textContent = game.attract ? '演示声量，开始后切换为麦克风' : '当前麦克风声量';
  $('.gauge').classList.toggle('hit', !game.paused && !isBike && hud.qualified);
  if (isBike) {
    $('#streakVal').textContent = hud.streak.toFixed(1);
    $('#distVal').textContent = (hud.meters / 1000).toFixed(2);
    $('#fishCount').textContent = String(hud.fish || 0);
    setNudge(game.paused || hud.pedaling ? '' : '一起读起来，鹈鹕就会继续前进');
  } else if (hud.kind === 'chase') {
    $('#gapVal').textContent = Math.max(0, hud.gap).toFixed(1);
    $('#streak2Val').textContent = hud.streak.toFixed(1);
    $('#escVal').textContent = Math.round(hud.meters);
    $('#nextVal').textContent = Math.ceil((hud.meters + 1) / 200) * 200;
    const caughtCount = $('#caughtCount');
    const count = String(hud.caughtCount);
    if (caughtCount.textContent !== count) caughtCount.textContent = count;
    $('#vignette').style.opacity = String(Math.min(0.82, hud.danger * 0.82));
    setNudge(game.paused || hud.qualified ? '' : '保持声音越过达标线');
  } else if (isBalloon) {
    $('#balloonStreak').textContent = hud.streak.toFixed(1);
    $('#balloonStreakMobile').textContent = hud.streak.toFixed(1);
    $('#balloonMeters').textContent = Math.round(hud.meters);
    $('#starCount').textContent = String(hud.stars);
    $('#segmentCount').textContent = String(hud.segments);
    $('#routeProgress').style.width = `${Math.round(hud.segmentProgress * 100)}%`;
    $('#balloonStatus').textContent = hud.grounded ? '云端停靠' : hud.qualified ? hud.rising ? '稳步上升' : '平稳巡航' : '缓缓飘行';
    setNudge(game.paused || hud.qualified ? '' : hud.grounded ? '一起朗读，再次起航' : '');
  }
}

function openModal(id) { document.getElementById(id)?.classList.add('show'); }
function closeModals() { $$('.modal.show').forEach((modal) => modal.classList.remove('show')); }

async function refreshMics() {
  const mics = await AudioEngine.listMics().catch(() => []);
  if (!mics.length) return;
  const selected = micSel.value;
  micSel.innerHTML = '<option value="">默认麦克风</option>';
  for (const mic of mics) {
    const option = document.createElement('option');
    option.value = mic.deviceId;
    option.textContent = mic.label;
    micSel.append(option);
  }
  if ([...micSel.options].some((option) => option.value === selected)) micSel.value = selected;
}

function showStartError(message) {
  startErr.hidden = !message;
  startErr.textContent = message;
}

async function begin() {
  if (document.body.classList.contains('started')) return;
  startBtn.disabled = true;
  showStartError('');
  try {
    let source;
    if (useSim) {
      source = sim;
    } else {
      if (!AudioEngine.isSupported()) throw new Error('INSECURE');
      await audio.start(micSel.value || undefined);
      source = audio;
      await refreshMics();
    }
    game.begin(source);
    document.body.classList.add('started');
    updatePauseUi(game.paused);
    closeModals();
  } catch (error) {
    const message = error?.name === 'NotAllowedError'
      ? '麦克风权限被拒绝，请在浏览器地址栏允许麦克风后重试。'
      : error?.name === 'NotFoundError'
        ? '没有找到可用麦克风，请连接设备后重试。'
        : error?.message === 'INSECURE'
          ? '当前地址无法访问麦克风，请使用 localhost 或 HTTPS 打开。'
          : '麦克风启动失败，请检查设备后重试。';
    showStartError(message);
  } finally {
    startBtn.disabled = false;
  }
}

function reset() {
  game.reset();
  $('#flash').classList.remove('go');
  $('#vignette').style.opacity = '0';
  setNudge('');
}

async function choosePhoto(file) {
  if (!file) return;
  const operation = ++photoOperation;
  photoChoose.disabled = false;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    photoStatus.className = 'status bad';
    photoStatus.textContent = '请选择 JPG、PNG 或 WebP 图片。';
    return;
  }
  if (file.size > 12 * 1024 * 1024) {
    photoStatus.className = 'status bad';
    photoStatus.textContent = '图片不能超过 12 MB，请先压缩后重试。';
    return;
  }
  photoStatus.className = 'status';
  photoStatus.textContent = '正在处理照片…';
  photoChoose.disabled = true;
  try {
    const { headSprite, mainColor } = await processPhoto(file);
    if (operation !== photoOperation) return;
    const preview = headSprite.toDataURL('image/png');
    game.setPhoto(headSprite, mainColor);
    photoPreview.src = preview;
    photoPreview.hidden = false;
    photoStatus.className = 'status ok';
    photoStatus.textContent = '照片已就位，主角已更新。';
  } catch {
    if (operation !== photoOperation) return;
    photoStatus.className = 'status bad';
    photoStatus.textContent = '照片处理失败，请选择其他图片。';
  } finally {
    if (operation === photoOperation) photoChoose.disabled = false;
  }
}

function setupPhoto() {
  photoChoose.addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', () => {
    const file = photoInput.files?.[0];
    photoInput.value = '';
    choosePhoto(file);
  });
}

function setupEvents() {
  startBtn.addEventListener('click', begin);
  pauseBtn.addEventListener('click', () => game.setPaused(!game.paused));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.setPaused(true);
  });
  window.addEventListener('blur', () => game.setPaused(true));
  sens.value = localStorage.getItem('readrun.sensitivity') || '50';
  const applySensitivity = () => {
    const value = Number(sens.value);
    sensVal.textContent = String(value);
    audio.setSensitivity(value);
    sim.setSensitivity(value);
    localStorage.setItem('readrun.sensitivity', String(value));
  };
  sens.addEventListener('input', applySensitivity);
  applySensitivity();
  micSel.addEventListener('change', async () => {
    if (audio.stream) await audio.restart(micSel.value || undefined).catch(() => {});
  });
  $$('.cams button').forEach((button) => button.addEventListener('click', () => {
    const index = Number(button.dataset.mode);
    game.switchMode(index);
    setModeUi(index);
  }));
  $$('[data-open]').forEach((button) => button.addEventListener('click', () => {
    const id = button.dataset.open;
    openModal(id);
  }));
  $$('[data-close]').forEach((button) => button.addEventListener('click', closeModals));
  $$('.modal').forEach((modal) => modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModals();
  }));
  $('[data-act="reset"]').addEventListener('click', reset);
  $('[data-act="full"]').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.();
  });
  $('#photoRemove').addEventListener('click', () => {
    photoOperation++;
    photoChoose.disabled = false;
    game.clearPhoto();
    photoInput.value = '';
    photoPreview.removeAttribute('src');
    photoPreview.hidden = true;
    photoStatus.className = 'status';
    photoStatus.textContent = '未选择照片，使用默认主角。';
  });
  document.addEventListener('keydown', (event) => {
    if (event.target.matches('input, select, textarea') || event.target.isContentEditable) return;
    if (event.code === 'Space' && !event.ctrlKey && !event.metaKey && !event.altKey && document.body.classList.contains('started') && !event.target.closest('button, a, [role="button"]')) {
      event.preventDefault();
      if (!event.repeat) game.setPaused(!game.paused);
    }
    if (event.key.toLowerCase() === 'f') $('[data-act="full"]').click();
    if (event.key.toLowerCase() === 'r' && document.body.classList.contains('started')) reset();
    if (event.key === '1') { game.switchMode(0); setModeUi(0); }
    if (event.key === '2') { game.switchMode(1); setModeUi(1); }
    if (event.key === '3') { game.switchMode(2); setModeUi(2); }
    if (event.key.toLowerCase() === 'p') openModal('mPhoto');
    if (event.key.toLowerCase() === 's') openModal('mSettings');
    if (event.key.toLowerCase() === 'h') openModal('mHelp');
    if (event.key.toLowerCase() === 'c') sceneControls.toggle();
    if (event.key === 'Escape') { closeModals(); sceneControls.toggle(false); }
  });
}

game.on.frame = updateHud;
game.on.pause = updatePauseUi;
game.on.milestone = (meters) => game.mode.kind === 'balloon'
  ? showToast(`已点亮 ${game.mode.hud.segments} 段航线`, '继续向下一座云端驿站前进', '🎈')
  : showToast(`已前进 ${meters} 米`, '保持这个声音');
game.on.fish = (golden) => showToast(golden ? '抓到金色鱼！' : '抓到一条鱼');
game.on.star = (count) => showToast(`已收集 ${count} 颗星星`, '', '⭐');
game.on.caught = () => {
  const flash = $('#flash');
  flash.textContent = '继续读，重新出发';
  flash.classList.remove('go');
  void flash.offsetWidth;
  flash.classList.add('go');
};

setModeUi(0);
updatePauseUi(game.paused);
setupEvents();
setupPhoto();
game.start();
window.__game = game;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
