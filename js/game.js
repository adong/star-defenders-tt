/* TT Star Defenders: everything around the simulation. Screens, keyboard, mouse and finger input, the HUD, the
   companion button, toasts, the wave banner, HI-SCORE saving, the title-screen demo, and test hooks on window.game. */
(function () {
  'use strict';
  const SD = window.SD, S = Kit.sound;
  const { DT, W } = SD;
  const $ = (id) => document.getElementById(id);
  const NAME = { teddy: 'TEDDY', tommy: 'TOMMY' };
  const cls = (who) => (who === 'tommy' ? 'm' : 't');
  const fmt = (n) => n.toLocaleString('en-US');

  // ---------------------------------------------------------------- saving
  const SAVE_KEY = 'starDefendersTT.v1';
  const save = { hi: { easy: 0, normal: 0 }, reached: { easy: 1, normal: 1 }, hero: 'teddy', easy: true };
  try { Object.assign(save, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* storage blocked */ }
  const store = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* storage blocked */ } };
  const dkey = () => (G.easy ? 'easy' : 'normal');

  const view = new SD.View($('scene'));
  const faces = Kit.portraits([Kit.roster.get('teddy'), Kit.roster.get('tommy')], { size: 160 });

  const G = {
    screen: 'title', mode: '1p', hero: save.hero === 'tommy' ? 'tommy' : 'teddy', easy: save.easy !== false,
    startWave: 0, sim: null, runner: null, demo: null, held: false, keepAwake: false,
    toasts: [], touchOn: false, bannerT: 9, auto: null, doneT: 0, saucerT: 0, sabotage: null, newHi: false,
  };

  // ---------------------------------------------------------------- input
  const keys = new Set();
  const tapped = new Set();   // keys pressed since the last rules step: a quick tap still counts
  const aim = { teddy: null, tommy: null };  // where a finger or the mouse wants each cart (field x)
  const ptrs = new Map();
  const tapFire = new Set();  // a finger or click came down since the last rules step: fire at least once

  addEventListener('keydown', (e) => {
    S.init();
    if (/^Arrow|^Space$/.test(e.code)) e.preventDefault();
    const fresh = !keys.has(e.code);
    keys.add(e.code);
    tapped.add(e.code);
    if (fresh && !e.repeat) onKey(e.code);
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); ptrs.clear(); });

  function onKey(code) {
    const sc = G.screen;
    if (code === 'KeyM') return toggleMute();
    if (sc === 'play') {
      if (code === 'KeyT' || code === 'Enter' || code === 'NumpadEnter') callBuddy();
      else if (code === 'KeyP' || code === 'Escape') pause();
    } else if (sc === 'pause') {
      if (code === 'KeyP' || code === 'Escape' || code === 'Space' || code === 'Enter') resume();
    } else if (sc === 'title') {
      if (code === 'Enter' || code === 'Space') startGame('1p', G.hero);
      else if (code === 'Digit2' || code === 'Numpad2') startGame('2p');
      else if (code === 'Digit1' || code === 'Numpad1') startGame('1p', G.hero);
      else if (code === 'ArrowLeft' || code === 'KeyA') pickHero('teddy');
      else if (code === 'ArrowRight' || code === 'KeyD') pickHero('tommy');
      else if (code === 'KeyE') setEasy(!G.easy);
    } else if (sc === 'over') {
      if (code === 'Enter' || code === 'Space') keepGoing();
      else if (code === 'Escape') toTitle();
    } else if (sc === 'win') {
      if (code === 'Enter' || code === 'Space') startGame(G.mode, G.hero, 0);
      else if (code === 'Escape') toTitle();
    }
  }

  // what every cart wants this step (keys, fingers, the mouse, or the autopilot)
  function inputs() {
    const k = (c) => (keys.has(c) || tapped.has(c) ? 1 : 0);
    const out = {};
    const one = (id, ax, fire) => {
      if (ax) aim[id] = null; // keys take over from the mouse until it moves again
      let held = tapFire.has(id);
      for (const q of ptrs.values()) if (q.who === id) held = true;
      out[id] = { ax, x: aim[id], fire: !!(fire || held) };
    };
    if (G.mode === '2p') {
      one('teddy', k('KeyD') - k('KeyA'), k('KeyW') || k('Space'));
      one('tommy', k('ArrowRight') - k('ArrowLeft'), k('ArrowUp') || k('Slash'));
    } else {
      one(G.hero, (k('KeyD') || k('ArrowRight')) - (k('KeyA') || k('ArrowLeft')), k('Space') || k('KeyW') || k('ArrowUp'));
    }
    if (G.sabotage === 'mirror') for (const id in out) out[id].ax = -out[id].ax;
    if (G.auto && G.auto.length && G.auto[0].sim === G.sim) for (const b of G.auto) out[b.p.id] = b.input();
    return out;
  }

  // Fingers and the mouse. 1 player: the cart rolls to the finger (or follows the mouse) and fires while it's down.
  // 2 players: the left half of the screen is Teddy's, the right half Tommy's; each drags his own cart (a little
  // faster than the finger, so half a screen reaches all the way across) and fires while his finger is down.
  function setupPointer() {
    const cv = $('scene');
    const clampX = (x) => Math.max(0, Math.min(W, x));
    cv.addEventListener('pointerdown', (e) => {
      S.init();
      if (e.pointerType === 'touch' && !G.touchOn) { G.touchOn = true; layoutHud(); }
      if (G.screen !== 'play' || !G.sim) return;
      const who = G.mode === '2p' ? (e.clientX < innerWidth / 2 ? 'teddy' : 'tommy') : G.hero;
      const c = G.sim.player(who);
      if (!c) return;
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
      ptrs.set(e.pointerId, { who, x0: e.clientX, cx0: c.x, mouse: e.pointerType === 'mouse' });
      if (G.mode !== '2p') aim[who] = clampX(view.worldX(e.clientX));
      tapFire.add(who);
      e.preventDefault();
    });
    cv.addEventListener('pointermove', (e) => {
      const q = ptrs.get(e.pointerId);
      if (q) aim[q.who] = clampX(G.mode === '2p' ? q.cx0 + ((e.clientX - q.x0) / view.ppu) * 1.6 : view.worldX(e.clientX));
      else if (e.pointerType === 'mouse' && G.mode === '1p' && G.screen === 'play') aim[G.hero] = clampX(view.worldX(e.clientX));
    });
    const end = (e) => {
      const q = ptrs.get(e.pointerId);
      if (!q) return;
      ptrs.delete(e.pointerId);
      if (!q.mouse) aim[q.who] = null; // the cart stops where it is
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('lostpointercapture', end);
    if (matchMedia('(pointer: coarse)').matches) G.touchOn = true;
  }

  // ---------------------------------------------------------------- flow
  const SCREENS = ['title', 'pause', 'over', 'win'];
  function show(screen) {
    G.screen = screen;
    for (const id of SCREENS) $(id).classList.toggle('hidden', id !== screen);
    const playing = screen !== 'title';
    $('hud').classList.toggle('hidden', !playing);
    S.music(screen === 'play' ? 'play' : screen === 'pause' ? 'pause' : screen === 'over' ? 'over' : 'title');
    if (screen !== 'play') { ptrs.clear(); tapFire.clear(); keys.clear(); aim.teddy = aim.tommy = null; }
    layoutHud();
  }

  function startGame(mode, hero, wave) {
    S.init();
    SD.sfx.start();
    G.mode = mode;
    if (hero) { G.hero = hero; save.hero = hero; }
    save.easy = G.easy;
    store();
    G.demo = null;
    G.auto = null;
    G.doneT = 0;
    G.newHi = false;
    clearToasts();
    const w = Math.max(0, Math.min(SD.WAVES.length - 1, wave ?? G.startWave));
    G.sim = new SD.Sim({ wave: w, mode, hero: G.hero, easy: G.easy, seed: (Math.random() * 1e9) | 0, sabotage: G.sabotage });
    G.runner = new SD.Runner(G.sim);
    view.setGame(G.sim);
    G.sim.events.length = 0;
    waveBanner(w);
    setupHud();
    view.update(G.sim, 0);
    show('play');
  }

  function waveBanner(w) {
    const def = SD.WAVES[w];
    $('bnNum').textContent = `WAVE ${w + 1} OF ${SD.WAVES.length}`;
    $('bnName').textContent = def.name;
    $('bnTip').textContent = def.tip;
    G.bannerT = 0;
  }

  function keepGoing() {
    if (!G.sim || G.screen !== 'over') return;
    G.sim.keepGoing();
    clearToasts();
    toast('KEEP GOING! ❤️', { big: true, life: 1.6 });
    show('play');
  }

  function win() {
    const sim = G.sim;
    const who = G.mode === '2p' ? 'Teddy and Tommy' : G.hero === 'tommy' ? 'Tommy' : 'Teddy';
    keepHi();
    $('winText').textContent = `${who} popped all ${SD.WAVES.length} waves of jelly aliens!`;
    $('winScore').textContent = `SCORE ${fmt(sim.score)}`;
    $('winHi').textContent = G.newHi ? `NEW HI-SCORE! ${fmt(save.hi[dkey()])}` : `HI-SCORE ${fmt(save.hi[dkey()])}`;
    show('win');
  }

  function keepHi() {
    const sim = G.sim, k = dkey();
    if (!sim) return;
    if (sim.score > (save.hi[k] || 0)) { save.hi[k] = sim.score; G.newHi = true; }
    save.reached[k] = Math.max(save.reached[k] || 1, Math.min(SD.WAVES.length, sim.wave + 1));
    store();
  }

  function pause() { if (G.screen === 'play') show('pause'); }
  function resume() { if (G.screen === 'pause') show('play'); }

  function toTitle() {
    keepHi();
    clearToasts();
    G.sim = null;
    G.auto = null;
    startDemo();
    show('title');
    refreshTitle();
  }

  function callBuddy() {
    const sim = G.sim;
    if (!sim || G.screen !== 'play') return;
    S.init();
    if (!sim.callBuddy() && G.mode === '2p' && sim.hi5Cd > 0) toast(`HIGH FIVE IN ${Math.ceil(sim.hi5Cd)}…`, { life: 0.9 });
  }

  // ---------------------------------------------------------------- the simulation's events
  function afterSteps(n) {
    const sim = G.sim;
    if (n > 0) { tapped.clear(); tapFire.clear(); }
    for (const ev of sim.events) handle(ev, sim);
    sim.events.length = 0;
    if (sim.state === 'over' && G.screen === 'play') {
      keepHi();
      $('overText').textContent = sim.lives <= 0 && sim.wave >= 0 ? `The jellies got you on wave ${sim.wave + 1}. Keep going: the ones you popped stay popped!` : '';
      show('over');
    }
    if (sim.state === 'done' && G.screen === 'play') {
      G.doneT += n * DT;
      if (G.doneT > 3) win();
    }
  }

  function handle(ev, sim, quiet) {
    view.onEvent(ev, sim);
    if (quiet) return;
    const fx = SD.sfx;
    switch (ev.type) {
      case 'wave': fx.wave(); waveBanner(ev.wave); break;
      case 'step': fx.step(ev.n, ev.down); break;
      case 'fire': fx.fire(); break;
      case 'pop': fx.pop(ev.kind, ev.by === 'beam'); break;
      case 'chip': if (!ev.quiet) fx.chip(); break;
      case 'drop': fx.drop(); break;
      case 'sprinklePop': fx.sprinklePop(); break;
      case 'splat': if (!ev.soft) fx.splat(); break;
      case 'sprinkled': fx.sprinkled(); toast(ev.lives > 0 ? `${NAME[ev.who]} GOT SPRINKLED! 💔` : 'OUT OF LIVES! 💔', { big: true, cls: cls(ev.who), life: 1.5 }); break;
      case 'landed': fx.landed(); toast(ev.lives > 0 ? 'THE JELLIES LANDED! BOING! 💔' : 'OUT OF LIVES! 💔', { big: true, life: 1.8 }); break;
      case 'saucer': fx.saucer(); toast('🎂 A CAKE SAUCER! POP IT!', { life: 1.6 }); break;
      case 'saucerPop': fx.saucerPop(); toast(`🎂 YUM! +${ev.pts}`, { big: true, life: 1.4 }); break;
      case 'clear':
        fx.clear();
        toast(ev.last ? 'ALL 10 WAVES! 🎉' : `WAVE ${ev.wave + 1} CLEAR! +${ev.bonus} 🎉`, { big: true, life: 2.4 });
        keepHi();
        break;
      case 'done': fx.done(); break;
      case 'buddyIn': fx.buddyIn(); toast(`${NAME[ev.who]} IS COMING TO HELP!`, { cls: cls(ev.who), life: 1.8 }); break;
      case 'gift': fx.gift(); toast(`${ev.emoji} ${ev.name} FROM ${NAME[ev.from]}!${ev.heal ? ' +❤️' : ''}`, { cls: cls(ev.from), life: 2 }); break;
      case 'beam': fx.beam(); toast(`${NAME[ev.who]} SAYS: RAINBOW BEAM!`, { big: true, cls: cls(ev.who), life: 2 }); break;
      case 'buddyOut': fx.buddyOut(); toast(`BYE BYE, ${NAME[ev.who]}! 👋`, { cls: cls(ev.who), life: 1.4 }); break;
      case 'highfive': fx.highfive(); toast('✋ HIGH FIVE! SUPER STARS!', { big: true, life: 2 }); break;
      case 'over': fx.over(); break;
    }
  }

  // ---------------------------------------------------------------- the title-screen demo
  function startDemo(w) {
    w = w ?? Math.floor(Math.random() * SD.WAVES.length);
    const sim = new SD.Sim({ wave: w, mode: '2p', seed: (Math.random() * 1e9) | 0, easy: true });
    G.demo = { sim, w, t: 0, runner: new SD.Runner(sim), bots: sim.cannons.map((c) => new SD.Bot(sim, c)) };
    view.setGame(sim);
  }

  function demoInput() {
    const inp = {};
    for (const b of G.demo.bots) inp[b.p.id] = b.input();
    return inp;
  }

  function demoAfter() {
    const d = G.demo;
    for (const ev of d.sim.events) handle(ev, d.sim, true);
    d.sim.events.length = 0;
    if (d.sim.lives < 2) d.sim.lives = 3;
    if (d.sim.state === 'clear' && d.sim.stateT > 2 || d.sim.state === 'over' || d.sim.state === 'oops' || d.t > 60) startDemo((d.w + 1 + Math.floor(Math.random() * 3)) % SD.WAVES.length);
  }

  // ---------------------------------------------------------------- HUD
  function setupHud() {
    const two = G.mode === '2p';
    $('pcard').className = 'pcard' + (two ? ' two' : G.hero === 'tommy' ? ' m' : '');
    $('faceA').src = two ? faces.teddy : faces[G.hero];
    $('faceA').className = 'face' + (!two && G.hero === 'tommy' ? ' m' : '');
    $('faceB').src = faces.tommy;
    $('faceB').classList.toggle('hidden', !two);
    const btn = $('callBtn'), bud = Kit.roster.buddyFor(G.hero);
    btn.classList.toggle('t', !two && bud === 'teddy');
    btn.querySelector('img').src = faces[bud];
    btn.querySelector('img').classList.toggle('hidden', two);
    btn.querySelector('.five').classList.toggle('hidden', !two);
    G.hudCache = {};
    updateHud();
    layoutHud();
  }

  function layoutHud() {
    const playing = !$('hud').classList.contains('hidden');
    const h = innerHeight, w = innerWidth;
    const short = h <= 520;
    const top = document.querySelector('#hud .top');
    if (playing) {
      view.margins.top = short ? 6 : Math.min(h * 0.22, top.getBoundingClientRect().bottom + 4);
      view.margins.bottom = G.touchOn ? (short ? 30 : Math.max(44, Math.min(80, h * 0.08))) : 8;
    } else {
      view.margins.top = 8;
      view.margins.bottom = 8;
    }
    view.margins.left = 58; // clear of the kit's round buttons in the middle of the left edge
    view.margins.right = w < 900 ? 8 : 12;
    view.alignBottom = playing;
    if (short && playing) {
      // a phone on its side: the score card on the left, the buttons on the right, the field between them
      const r = (id) => $(id).getBoundingClientRect();
      view.margins.left = Math.max(58, r('pcard').right + 6);
      view.margins.right = Math.max(8, w - Math.min(r('callBtn').left, document.querySelector('#hud .mid').getBoundingClientRect().left) + 6);
    }
    view.fit(true);
    const strip = $('strip');
    strip.classList.toggle('hidden', !(playing && G.touchOn && G.screen === 'play'));
    strip.style.height = view.margins.bottom + 'px';
    $('stripText').textContent = G.mode === '2p' ? '← TEDDY · TOMMY →' : '← DRAG TO SLIDE · HOLD TO POP →';
  }
  addEventListener('resize', () => setTimeout(layoutHud, 50));

  function setText(key, el, text, html) {
    if (G.hudCache[key] === text) return;
    G.hudCache[key] = text;
    if (html) el.innerHTML = text; else el.textContent = text;
  }

  function updateHud() {
    const sim = G.sim;
    if (!sim || !G.hudCache) return;
    setText('score', $('score'), fmt(sim.score));
    const narrow = innerWidth < 480;
    const hearts = sim.lives <= 0 ? '💔' : narrow && sim.lives > 2 ? `❤️×${sim.lives}` : '❤️'.repeat(Math.min(sim.lives, 6));
    setText('hearts', $('hearts'), hearts);
    setText('wave', $('waveNum'), String(sim.wave + 1));
    const hi = Math.max(save.hi[dkey()] || 0, sim.score);
    setText('hi', $('hiNum'), fmt(hi));
    const B = sim.buddy, here = !!B && B.state !== 'leave';
    const btn = $('callBtn');
    btn.classList.toggle('here', here || sim.superT > 0);
    const bud = Kit.roster.buddyFor(G.hero);
    let label;
    if (G.mode === '2p') {
      const cd = sim.hi5Cd;
      btn.querySelector('.cool').style.background = cd > 0 ? `conic-gradient(rgba(10,8,25,0.65) ${(cd / 15) * 360}deg, transparent 0)` : 'none';
      label = cd > 0 ? `HIGH FIVE<small>ready in ${Math.ceil(cd)}</small>` : 'HIGH FIVE! ✋<small>press T</small>';
    } else {
      btn.querySelector('.cool').style.background = 'none';
      label = here ? `${NAME[bud]} IS HERE!<small>tap for another beam</small>` : `CALL ${NAME[bud]}<small>press T</small>`;
    }
    setText('call', btn.querySelector('em'), label, true);
    $('superBar').classList.toggle('hidden', !(sim.superT > 0));
    if (sim.superT > 0) $('superBar').querySelector('b').style.transform = `scaleX(${Math.max(0, Math.min(1, sim.superT / 8))})`;
  }

  // ---------------------------------------------------------------- toasts and the wave banner (game time)
  function toast(text, o = {}) {
    const el = document.createElement('div');
    el.className = 'toast' + (o.big ? ' huge' : '') + (o.cls ? ' ' + o.cls : '');
    el.textContent = text;
    $('toasts').appendChild(el);
    G.toasts.push({ el, t: 0, life: o.life || 1.6 });
    const live = G.toasts.filter((q) => !q.done);
    if (live.length > 3) live[0].life = 0;
  }

  function clearToasts() {
    for (const q of G.toasts) q.el.remove();
    G.toasts = [];
  }

  function updateToasts(dt) {
    for (const q of G.toasts) {
      q.t += dt;
      const a = Math.min(1, q.t * 6, (q.life - q.t) * 4);
      q.el.style.opacity = Math.max(0, a);
      q.el.style.transform = `scale(${0.7 + 0.3 * Math.min(1, q.t * 6) + (q.t < 0.25 ? Math.sin(q.t * 12.5) * 0.08 : 0)})`;
      if (q.t >= q.life) { q.el.remove(); q.done = true; }
    }
    G.toasts = G.toasts.filter((q) => !q.done);
  }

  function updateBanner(dt) {
    const sim = G.sim;
    if (G.screen === 'play' && sim) G.bannerT += dt;
    const on = G.screen === 'play' && sim && (sim.state === 'intro' || sim.state === 'play') && G.bannerT < 2.6;
    $('banner').classList.toggle('hidden', !on);
    if (on) $('banner').style.opacity = Math.min(1, (2.6 - G.bannerT) * 3);
  }

  // a warble while the cake saucer is crossing (game time, so it stops when paused)
  function updateSaucerSound(dt) {
    const sim = G.sim;
    if (!sim || G.screen !== 'play' || !sim.saucer) return;
    G.saucerT -= dt;
    if (G.saucerT <= 0) { G.saucerT = 0.42; SD.sfx.saucerHum(); }
  }

  // ---------------------------------------------------------------- the loop
  function tick(dt) {
    let n = 0;
    if (G.sim && (G.screen === 'play' || G.screen === 'win' || G.screen === 'over')) {
      if (G.screen === 'play') { n = G.runner.advance(dt, inputs); afterSteps(n); }
      else { G.runner.advance(dt, () => ({})); for (const ev of G.sim.events) handle(ev, G.sim, true); G.sim.events.length = 0; }
    } else if (G.screen === 'title' && G.demo) {
      G.demo.t += dt;
      G.demo.runner.advance(dt, demoInput);
      demoAfter();
    }
    const sim = activeSim();
    if (sim) view.update(sim, dt);
    updateHud();
    updateToasts(dt);
    updateBanner(dt);
    updateSaucerSound(dt);
    view.render();
  }

  const activeSim = () => (G.screen === 'title' ? G.demo && G.demo.sim : G.sim);

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (G.held) { view.render(); return; }
    tick(dt);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (!G.keepAwake) { pause(); S.suspend(); }
    } else S.resume();
  });

  // ---------------------------------------------------------------- the title screen
  function refreshTitle() {
    const zh = Kit.lang.is('zh');
    $('logo').innerHTML = zh ? `<span class="b">${SD.TITLE_ZH}</span>` : SD.TITLE.replace(/^(\S+) (\S+) (\S+)$/, '<span class="a">$1</span> <span class="b">$2</span><br><span class="c">$3</span>');
    $('subtitle').textContent = SD.SUBTITLE;
    for (const b of document.querySelectorAll('.kid')) {
      b.querySelector('img').src = faces[b.dataset.hero];
      b.classList.toggle('pick', b.dataset.hero === G.hero);
    }
    $('img2pT').src = faces.teddy;
    $('img2pM').src = faces.tommy;
    for (const b of document.querySelectorAll('#segEasy button')) b.classList.toggle('on', (b.dataset.easy === '1') === G.easy);
    const max = maxWave();
    if (G.startWave >= max) G.startWave = 0;
    $('startNum').textContent = String(G.startWave + 1);
    $('btnWave').classList.toggle('hidden', max <= 1);
    const hi = save.hi[dkey()] || 0;
    $('bestLine').textContent = hi ? `HI-SCORE ${fmt(hi)}` : '';
    muteIcons();
  }
  Kit.lang.onChange(() => { if (G.screen === 'title') refreshTitle(); });

  const maxWave = () => Math.max(1, Math.min(SD.WAVES.length, save.reached[dkey()] || 1));

  function pickHero(id) { G.hero = id; save.hero = id; store(); refreshTitle(); }

  function setEasy(on) {
    G.easy = on;
    save.easy = on;
    store();
    refreshTitle();
  }

  function toggleMute() {
    S.init();
    S.toggleMute();
    muteIcons();
  }

  function muteIcons() {
    const m = S.isMuted() ? '🔇' : '🔊';
    $('btnMute').textContent = m;
    $('btnMute2').textContent = m;
  }
  S.onMute(muteIcons);

  function wire() {
    const click = (id, fn) => $(id).addEventListener('click', (e) => { S.init(); SD.sfx.click(); fn(e); });
    for (const b of document.querySelectorAll('.kid')) b.addEventListener('click', () => startGame('1p', b.dataset.hero));
    click('btn2p', () => startGame('2p'));
    for (const b of document.querySelectorAll('#segEasy button')) b.addEventListener('click', () => { S.init(); SD.sfx.click(); setEasy(b.dataset.easy === '1'); });
    click('btnWave', () => { G.startWave = (G.startWave + 1) % maxWave(); refreshTitle(); });
    click('btnMute', toggleMute);
    click('btnMute2', toggleMute);
    click('btnPause', pause);
    click('btnResume', resume);
    click('btnRestart', () => startGame(G.mode, G.hero, G.sim ? G.sim.wave : 0));
    click('btnMenu', toTitle);
    click('btnKeep', keepGoing);
    click('btnOverMenu', toTitle);
    click('btnAgain', () => startGame(G.mode, G.hero, 0));
    click('btnWinMenu', toTitle);
    $('callBtn').addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); callBuddy(); });
  }

  // ---------------------------------------------------------------- start
  setupPointer();
  wire();
  const q = new URLSearchParams(location.search);
  if (q.has('wave')) {
    if (q.has('easy')) G.easy = q.get('easy') === '1';
    startGame(q.get('mode') === '2p' ? '2p' : '1p', q.get('hero') === 'tommy' ? 'tommy' : G.hero, (+q.get('wave') || 1) - 1);
  } else {
    startDemo();
    show('title');
    refreshTitle();
  }
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- test hooks
  // The Browser pane throttles requestAnimationFrame while hidden, so tests drive the game with step().
  window.game = {
    G, view, faces, save, keys, aim, ptrs,
    get sim() { return G.sim; },
    // advance the game by `seconds` of game time through the same runner the screen uses; draw: false skips rendering
    step(seconds = 0.5, o = {}) {
      const frames = Math.max(1, Math.round(seconds / (1 / 60)));
      for (let i = 0; i < frames; i++) {
        if (o.draw === false) {
          let n = 0;
          if (G.sim && G.screen === 'play') { n = G.runner.advance(1 / 60, inputs); afterSteps(n); }
          else if (G.screen === 'title' && G.demo) { G.demo.runner.advance(1 / 60, demoInput); demoAfter(); }
          const sim = activeSim();
          if (sim) view.update(sim, 1 / 60);
          updateToasts(1 / 60);
          updateBanner(1 / 60);
        } else tick(1 / 60);
      }
      updateHud();
      view.render();
      return this.state();
    },
    hold(on = true) { G.held = on; },
    keepAwake() { G.keepAwake = true; },
    start(wave = 1, mode = '1p', hero = 'teddy', easy = true) { G.easy = easy; startGame(mode, hero, wave - 1); return this.state(); },
    title() { toTitle(); },
    demo(wave = 1) { toTitle(); startDemo(wave - 1); },
    call() { callBuddy(); },
    pause, resume, keepGoing,
    showTouch(on = true) { G.touchOn = on; layoutHud(); },
    sabotage(kind) { G.sabotage = kind || null; },
    state() {
      const s = G.sim;
      return {
        screen: G.screen, mode: G.mode, hero: G.hero, easy: G.easy,
        sim: s && { state: s.state, wave: s.wave + 1, t: +s.t.toFixed(2), alive: s.alive, total: s.total, lives: s.lives, score: s.score,
          carts: s.cannons.map((c) => `${c.id}@${c.x.toFixed(2)} ${c.pose}${c.hitT > 0 ? ' sprinkled' : ''}`), shots: s.shots.length, sprinkles: s.sprinkles.length,
          saucer: !!s.saucer, buddy: s.buddy && `${s.buddy.id}:${s.buddy.state}`, beam: !!s.beam },
      };
    },
    // the headless checks (js/checks.js), the same as `node tools/check.js`
    check(quick = true) { const r = SD.checks.run({ quick }); return { ok: r.ok, lines: r.lines }; },
    prove() { const r = SD.checks.prove(); return { ok: r.ok, lines: r.lines }; },
    // the autopilot plays the real game (screenshots, demos)
    autopilot(on = true) { G.auto = on && G.sim ? G.sim.cannons.map((c) => new SD.Bot(G.sim, c)) : null; },
  };
})();
