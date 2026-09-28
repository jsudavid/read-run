const $ = (selector) => document.querySelector(selector);

export class SceneControls {
  constructor(game) {
    this.game = game;
    this.panel = $('#sceneControls');
    this.shot = $('#viewShot');
    this.distance = $('#viewDistance');
    this.fov = $('#viewFov');
    this.orbit = $('#viewOrbit');
    this.settings = [...this.panel.querySelectorAll('[data-scene-setting]')];
    $('#viewBtn').addEventListener('click', () => this.toggle());
    $('#viewClose').addEventListener('click', () => this.toggle(false));
    this.shot.addEventListener('change', () => this.game.mode.view.select(this.shot.value));
    this.orbit.addEventListener('change', () => this.game.mode.view.setOrbit(this.orbit.checked));
    $('#viewNear').addEventListener('click', () => this.game.mode.view.setDistance(this.game.mode.view.distance / 1.25));
    $('#viewFar').addEventListener('click', () => this.game.mode.view.setDistance(this.game.mode.view.distance * 1.25));
    $('#viewReset').addEventListener('click', () => this.game.mode.view.select('auto'));
    this.distance.addEventListener('input', () => this.game.mode.view.setDistance(Number(this.distance.value)));
    this.fov.addEventListener('input', () => this.game.mode.view.setFov(Number(this.fov.value)));
    $('#cinematic').addEventListener('change', (event) => {
      document.body.classList.toggle('cinematic', event.target.checked);
      document.body.classList.toggle('bars', event.target.checked);
    });
    this.settings.forEach((input) => input.addEventListener('input', () => {
      const key = input.dataset.sceneSetting;
      this.game.mode.settings[key] = input.type === 'checkbox' ? input.checked : input.tagName === 'SELECT' ? input.value : Number(input.value);
      if (key === 'mood') this.game.mode.settings.autoMood = false;
      this.update();
    }));
    $('#sceneQuality').value = game.renderer.locked ? game.renderer.tierName : 'auto';
    $('#sceneQuality').addEventListener('change', (event) => game.renderer.setQuality(event.target.value));
    game.on.mode = () => this.bind();
    game.on.view = () => this.update();
    this.bind();
  }

  toggle(show = this.panel.hidden) {
    this.panel.hidden = !show;
    $('#viewBtn').setAttribute('aria-expanded', String(show));
    $('#viewBtn').classList.toggle('on', show);
    if (show) this.update();
  }

  bind() {
    const { view } = this.game.mode;
    const shots = [{ id: 'auto', name: '自动跟拍' }, { id: 'cine', name: '电影运镜' }, ...view.shots, { id: 'free', name: '自由环绕' }];
    this.shot.replaceChildren(...shots.map(({ id, name }) => new Option(name, id)));
    this.distance.min = String(view.controls.minDistance);
    this.distance.max = String(view.controls.maxDistance);
    this.update();
  }

  update() {
    const { view, settings } = this.game.mode;
    this.shot.value = view.id;
    this.orbit.checked = view.controls.autoRotate;
    if (document.activeElement !== this.distance) this.distance.value = String(view.distance);
    if (document.activeElement !== this.fov) this.fov.value = String(view.hfov);
    $('#viewDistanceValue').textContent = `${view.distance.toFixed(1)} m`;
    $('#viewFovValue').textContent = `${Math.round(view.hfov)}°`;
    this.settings.forEach((input) => {
      const key = input.dataset.sceneSetting;
      if (!(key in settings)) return;
      if (input.type === 'checkbox') input.checked = settings[key];
      else if (input.tagName === 'SELECT') input.value = settings[key];
      else {
        if (key === 'bloomBoost') input.disabled = !this.game.renderer.tier.bloom;
        if (document.activeElement !== input) input.value = settings[key];
        input.parentElement.querySelector('output').textContent = key === 'hour'
          ? `${Math.floor(settings[key])}:${String(Math.floor((settings[key] % 1) * 60)).padStart(2, '0')}`
          : Number(settings[key]).toFixed(2);
      }
    });
  }
}
