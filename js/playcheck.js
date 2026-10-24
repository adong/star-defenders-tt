/* TT Star Defenders: the play check. Drives the page the way a kid does: real keydown / keyup events on window and
   pointer events on the canvas (never the rules' inputs or the autopilot), lets the game run through its own runner
   (game.step), and measures where each cart really is on the screen (projected through the camera, as drawn).
   - direction: → / D move the cart right on screen and ← / A left, on all 10 waves; 1P as Teddy and as Tommy; in 2P
     Teddy's keys move only Teddy's cart and Tommy's only Tommy's
   - fire: Space fires, holding keeps firing, a tap shorter than a frame still fires; 2P: W and ↑ fire their own cart
   - touch: a finger brings the cart to it and fires; dragging slides it; lifting stops it; 2P halves of the screen
   - stuck: nothing leaves the cart stuck: sprinkled, landed jellies, calling the brother, pause, the ? panel, a lost
     window focus, a cancelled finger, keep going after running out of lives, and the next wave after a clear
   game.playCheck() runs it; game.playProve() runs it with the keys mirrored and with a sprinkle that freezes the cart,
   and passes only if both are caught. */
(function () {
  'use strict';
  const SD = window.SD;
  const NAMES = { ArrowRight: 'ArrowRight', ArrowLeft: 'ArrowLeft', ArrowUp: 'ArrowUp', KeyA: 'a', KeyD: 'd', KeyW: 'w', KeyT: 't', KeyP: 'p', Space: ' ', Escape: 'Escape', Slash: '/' };
  const key = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code, key: NAMES[code] || code, bubbles: true, cancelable: true }));
  const down = (code) => key('keydown', code);
  const up = (code) => key('keyup', code);
  const run = (s) => window.game.step(s, { draw: false });
  const canvas = () => document.getElementById('scene');
  const ptr = (type, x, y, id = 7) => canvas().dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId: id, pointerType: 'touch', isPrimary: true, bubbles: true, cancelable: true }));

  function screenX(id) {
    const g = window.game;
    g.view.shake = 0;
    g.view.update(g.sim, 0);
    return g.view.project(g.view.cartObj(id)).x;
  }
  // hold a key for a while, see which way the cart went on the screen
  function nudge(code, id, secs = 0.3) {
    const x0 = screenX(id), s0 = window.game.sim.player(id).x;
    down(code);
    run(secs);
    up(code);
    run(0.05);
    return { dx: screenX(id) - x0, ds: window.game.sim.player(id).x - s0 };
  }
  const centre = (id) => { const c = window.game.sim.player(id); c.x = SD.W / 2 + (window.game.sim.cannons.length === 2 ? (c === window.game.sim.cannons[0] ? -4 : 4) : 0); };

  function playCheck(o = {}) {
    const g = window.game;
    const lines = [], fails = [];
    const check = (name, ok, info) => { lines.push(`${ok ? '✓' : '✗'} ${name}${info ? ': ' + info : ''}`); if (!ok) fails.push(name); };
    g.keepAwake();
    g.sabotage(o.sabotage || null);
    const wasEasy = g.G.easy;
    try {
      // ---------------------------------------------------------------- direction, every wave
      for (const [mode, hero] of [['1p', 'teddy'], ['1p', 'tommy'], ['2p', 'teddy']]) {
        const bad = [];
        for (let w = 1; w <= SD.WAVES.length; w++) {
          g.start(w, mode, hero, w % 2 === 1);
          g.sim.o.quiet = true; // no sprinkles in the way of the measuring
          run(0.4);
          const pairs = mode === '2p' ? [['teddy', 'KeyD', 'KeyA'], ['tommy', 'ArrowRight', 'ArrowLeft']] : [[hero, 'ArrowRight', 'ArrowLeft'], [hero, 'KeyD', 'KeyA']];
          for (const [id, r, l] of pairs) {
            centre(id);
            const other = mode === '2p' ? (id === 'teddy' ? 'tommy' : 'teddy') : null;
            const ox = other && g.sim.player(other).x;
            const R = nudge(r, id), L = nudge(l, id);
            if (!(R.dx > 20)) bad.push(`wave ${w} ${id} ${r}: ${R.dx.toFixed(0)} px`);
            if (!(L.dx < -20)) bad.push(`wave ${w} ${id} ${l}: ${L.dx.toFixed(0)} px`);
            if (other && Math.abs(g.sim.player(other).x - ox) > 1e-6) bad.push(`wave ${w}: ${r}/${l} also moved ${other}`);
          }
        }
        check(`direction ${mode === '2p' ? '2P' : '1P ' + hero}`, !bad.length, bad.length ? bad.slice(0, 4).join('; ') : `${mode === '1p' ? '→/← and D/A' : "Teddy's D/A and Tommy's →/← (each only his own cart)"} move the right way on screen on all ${SD.WAVES.length} waves`);
      }

      // ---------------------------------------------------------------- fire
      {
        g.start(1, '1p', 'teddy', true);
        g.sim.o.quiet = true;
        run(1.8);
        const c = g.sim.player('teddy');
        let f0 = c.fired;
        down('Space'); run(0.05); const one = c.fired - f0;
        run(1.5); up('Space'); const held = c.fired - f0;
        run(1.2);
        f0 = c.fired;
        down('Space'); up('Space'); run(0.05); // a tap shorter than one frame
        const tap = c.fired - f0;
        check('fire 1P', one >= 1 && held >= 3 && tap >= 1, `Space fired ${one}, held 1.5 s fired ${held}, a quick tap fired ${tap}`);
        g.start(1, '2p', 'teddy', true);
        g.sim.o.quiet = true;
        run(1.8);
        const [T1, T2] = g.sim.cannons;
        down('KeyW'); run(0.05); up('KeyW'); run(0.4);
        const a = [T1.fired, T2.fired];
        down('ArrowUp'); run(0.05); up('ArrowUp'); run(0.4);
        const b = [T1.fired - a[0], T2.fired - a[1]];
        check('fire 2P', a[0] === 1 && a[1] === 0 && b[0] === 0 && b[1] === 1, `W fired Teddy ${a[0]} / Tommy ${a[1]}; ↑ fired Teddy ${b[0]} / Tommy ${b[1]}`);
      }

      // ---------------------------------------------------------------- touch
      {
        g.start(2, '1p', 'tommy', true);
        g.sim.o.quiet = true;
        run(1.8);
        const id = 'tommy', c = g.sim.player(id);
        const y = innerHeight * 0.6;
        const x0 = screenX(id), f0 = c.fired;
        ptr('pointerdown', x0 + 160, y); run(0.6);
        const toR = screenX(id) - x0, near = Math.abs(screenX(id) - (x0 + 160));
        ptr('pointermove', x0 - 120, y); run(0.7);
        const toL = screenX(id) - x0;
        const fired = c.fired - f0;
        ptr('pointerup', x0 - 120, y); run(0.05);
        const xs = screenX(id); run(0.4);
        const still = Math.abs(screenX(id) - xs);
        check('touch 1P', toR > 100 && near < 12 && toL < -90 && fired >= 2 && still < 1, `finger right: cart ${toR.toFixed(0)} px right (${near.toFixed(0)} px from the finger), drag left: ${toL.toFixed(0)} px, fired ${fired}, after lifting it moved ${still.toFixed(1)} px`);
        g.start(2, '2p', 'teddy', true);
        g.sim.o.quiet = true;
        run(1.8);
        const t0 = screenX('teddy'), m0 = screenX('tommy'), tf = g.sim.player('teddy').fired;
        ptr('pointerdown', innerWidth * 0.75, y, 8); ptr('pointermove', innerWidth * 0.75 + 60, y, 8); run(0.5);
        const mDx = screenX('tommy') - m0, tStill = Math.abs(screenX('teddy') - t0);
        ptr('pointerup', innerWidth * 0.75 + 60, y, 8);
        ptr('pointerdown', innerWidth * 0.25, y, 9); ptr('pointermove', innerWidth * 0.25 - 60, y, 9); run(0.5);
        const tDx = screenX('teddy') - t0, tFired = g.sim.player('teddy').fired - tf;
        ptr('pointerup', innerWidth * 0.25 - 60, y, 9);
        run(0.1);
        check('touch 2P', mDx > 40 && tStill < 1 && tDx < -40 && tFired >= 1, `right half dragged right: Tommy ${mDx.toFixed(0)} px (Teddy ${tStill.toFixed(1)}); left half dragged left: Teddy ${tDx.toFixed(0)} px, fired ${tFired}`);
      }

      // ---------------------------------------------------------------- stuck
      {
        const bad = [];
        const moves = (label, id = 'teddy') => {
          const R = nudge('ArrowRight', id), L = nudge('ArrowLeft', id);
          if (!(R.dx > 20 && L.dx < -20)) bad.push(`${label} (→ ${R.dx.toFixed(0)} px, ← ${L.dx.toFixed(0)} px)`);
        };
        const firesOk = (label, id = 'teddy') => {
          const c = g.sim.player(id), f0 = c.fired;
          down('Space'); run(0.6); up('Space'); run(0.05);
          if (!(c.fired > f0)) bad.push(`${label}: Space did not fire`);
        };
        g.start(3, '1p', 'teddy', true);
        g.sim.o.quiet = true;
        run(1.8);
        const c = g.sim.player('teddy');
        centre('teddy');
        // sprinkled: a sprinkle lands on the cart
        g.sim.sprinkles.push({ id: 9999, x: c.x, y: 2.0, vy: -3, kind: 0, spin: 0 });
        run(0.05);
        if (!(c.hitT > 0)) bad.push('the test sprinkle did not land');
        moves('while sprinkled');
        run(1.0);
        firesOk('after being sprinkled');
        // the jellies land
        g.sim.fy = 1; g.sim.placeAliens(); g.sim.stepT = 0; run(0.1);
        moves('after the jellies landed');
        // calling the brother (T), and during his beam
        down('KeyT'); up('KeyT'); run(0.2);
        if (!g.sim.buddy) bad.push('T did not call the brother');
        moves('while the brother is here');
        run(2.5);
        moves('during the rainbow beam');
        // pause with a key held, release it while paused, resume: the cart must not keep rolling
        down('ArrowRight'); run(0.1); down('KeyP'); up('KeyP');
        if (g.G.screen !== 'pause') bad.push('P did not pause');
        up('ArrowRight'); down('KeyP'); up('KeyP');
        const xp = screenX('teddy'); run(0.4);
        if (Math.abs(screenX('teddy') - xp) > 0.5) bad.push('after pause the cart kept rolling on its own');
        moves('after pause');
        // the ? panel
        Kit.help.open(); Kit.help.close(); run(0.05);
        moves('after the ? panel');
        // losing the window focus with a key held
        down('ArrowLeft'); run(0.1); window.dispatchEvent(new Event('blur'));
        const xb = screenX('teddy'); run(0.4);
        if (Math.abs(screenX('teddy') - xb) > 0.5) bad.push('after the window lost focus the cart kept rolling');
        up('ArrowLeft');
        moves('after losing focus');
        // a finger that gets cancelled (a system gesture)
        ptr('pointerdown', innerWidth * 0.3, innerHeight * 0.6, 11); run(0.1); ptr('pointercancel', innerWidth * 0.3, innerHeight * 0.6, 11);
        const f1 = c.fired; run(0.6);
        if (c.fired > f1 || g.ptrs.size) bad.push('a cancelled finger kept firing');
        moves('after a cancelled finger');
        // out of lives, then keep going
        g.sim.lives = 1;
        g.sim.sprinkles.push({ id: 9998, x: c.x, y: 2.0, vy: -3, kind: 0, spin: 0 });
        c.inv = 0;
        run(1.6);
        if (g.G.screen !== 'over') bad.push(`out of lives did not show the keep-going card (${g.G.screen})`);
        down('Enter'); up('Enter'); run(0.1);
        if (g.G.screen !== 'play') bad.push('Enter did not keep going');
        moves('after keep going');
        firesOk('after keep going');
        // clear the wave: the next one plays
        for (const a of g.sim.aliens) if (a.alive) g.sim.popAlien(a, 'test');
        run(3.6);
        if (g.sim.wave !== 3) bad.push(`the next wave did not start (wave ${g.sim.wave + 1}, ${g.sim.state})`);
        moves('on the next wave');
        firesOk('on the next wave');
        // 2P: one brother sprinkled, the other keeps going, then both move
        g.start(4, '2p', 'teddy', false);
        g.sim.o.quiet = true;
        run(1.8);
        centre('teddy'); centre('tommy');
        const tc = g.sim.player('tommy');
        g.sim.sprinkles.push({ id: 9997, x: tc.x, y: 2.0, vy: -3, kind: 0, spin: 0 });
        run(0.05);
        const R = nudge('ArrowRight', 'tommy'), D = nudge('KeyD', 'teddy');
        if (!(R.dx > 20 && D.dx > 20)) bad.push(`2P with Tommy sprinkled (Tommy → ${R.dx.toFixed(0)} px, Teddy D ${D.dx.toFixed(0)} px)`);
        down('KeyT'); up('KeyT'); run(0.3);
        const R2 = nudge('ArrowLeft', 'tommy'), D2 = nudge('KeyA', 'teddy');
        if (!(R2.dx < -20 && D2.dx < -20)) bad.push(`2P after the high five (Tommy ← ${R2.dx.toFixed(0)} px, Teddy A ${D2.dx.toFixed(0)} px)`);
        check('not stuck', !bad.length, bad.length ? bad.slice(0, 4).join('; ') : 'moves and fires after a sprinkle, landed jellies, the brother and his beam, pause, the ? panel, lost focus, a cancelled finger, keep going, the next wave, and in 2P');
      }
    } catch (e) {
      check('play check ran', false, String(e && e.stack || e));
    } finally {
      for (const code of Object.keys(NAMES)) up(code);
      g.sabotage(null);
      g.G.easy = wasEasy;
      g.title();
    }
    return { ok: !fails.length, lines, fails };
  }

  // the play check with the keys mirrored and with a sprinkle that freezes the cart: each must be caught
  function playProve() {
    const lines = [];
    let ok = true;
    for (const [sab, want] of [['mirror', 'direction'], ['stuckOops', 'not stuck']]) {
      const r = playCheck({ sabotage: sab });
      const caught = r.fails.some((f) => f.startsWith(want));
      ok = ok && caught;
      lines.push(`${caught ? '✓ caught' : '✗ NOT CAUGHT'}: "${sab}" → ${r.lines.filter((l) => l.startsWith('✗')).map((l) => l.slice(2, 160)).join(' | ') || 'everything passed'}`);
    }
    return { ok, lines };
  }

  window.game.playCheck = playCheck;
  window.game.playProve = playProve;
})();
