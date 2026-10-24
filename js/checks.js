/* TT Star Defenders: the headless checks of the rules (js/sim.js). The same code runs in node (tools/check.js) and in
   the page (game.check(), game.prove()).
   - march:     the aliens step sideways, and at each edge they step down (and only there) and turn around; never past a wall
   - speed:     the march speeds up as they thin out (full formation, half, 4 left, the last one)
   - shields:   a star-pop from below and a sprinkle from above each chip a shield; a shot through a gap doesn't
   - waveEnd:   the wave goes on while one alien is left, ends the moment the last one pops, and the next wave starts
   - autopilot: the autopilot clears wave 1 on EASY (1 player as Teddy and as Tommy, and 2 players, several seeds)
   - frames:    the same inputs give the same game at 30, 60, 120 fps and a jumpy frame rate
   - beam:      the brother's rainbow beam pops one whole column and nothing else
   prove() runs each check against a sim with that rule broken (o.sabotage) and passes only if every check fails. */
(function (root) {
  'use strict';
  const SD = root.SD;
  const { DT, W, EDGE, STEP_DX } = SD;

  const runTo = (sim, cond, maxT, inputFn) => {
    while (!cond() && sim.t < maxT) { sim.step(DT, inputFn ? inputFn() : {}); }
    return cond();
  };
  const toPlay = (sim) => runTo(sim, () => sim.state === 'play', sim.t + 5);
  const fmt = (v, n = 2) => (+v).toFixed(n);

  // ---------------------------------------------------------------- march
  function march(sab) {
    const lines = [];
    let ok = true;
    for (const easy of [true, false]) {
      const sim = new SD.Sim({ wave: 0, easy, quiet: true, seed: 5, sabotage: sab });
      toPlay(sim);
      sim.events.length = 0;
      let prev = { fx: sim.fx, fy: sim.fy, dir: sim.dir };
      let downs = 0, sides = 0, bad = null;
      while (downs < 6 && sim.t < 300 && !bad) {
        sim.step(DT, {});
        for (const e of sim.events) {
          if (e.type !== 'step' || bad) continue;
          const atEdge = prev.dir > 0 ? e.hi + STEP_DX > W - EDGE : e.lo - STEP_DX < EDGE;
          if (atEdge) {
            if (!e.down) bad = `at the ${prev.dir > 0 ? 'right' : 'left'} edge they turned without stepping down`;
            else if (Math.abs(e.fy - (prev.fy - sim.D.dy)) > 1e-9) bad = `stepped down ${fmt(prev.fy - e.fy)} instead of ${sim.D.dy}`;
            else if (e.fx !== prev.fx) bad = 'moved sideways while stepping down';
            else if (e.dir !== -prev.dir) bad = 'stepped down but did not turn around';
            downs++;
          } else {
            if (e.down || e.fy !== prev.fy) bad = 'stepped down away from an edge';
            else if (Math.abs(e.fx - (prev.fx + prev.dir * STEP_DX)) > 1e-9) bad = 'a sideways step was not one step';
            sides++;
          }
          for (const a of sim.aliens) if (a.alive && (a.x < EDGE - 1e-9 || a.x > W - EDGE + 1e-9)) bad = `an alien went past the wall (x = ${fmt(a.x)})`;
          prev = { fx: e.fx, fy: e.fy, dir: e.dir };
        }
        sim.events.length = 0;
      }
      if (!bad && downs < 6) bad = `only ${downs} edge turns in ${fmt(sim.t, 0)} s`;
      ok = ok && !bad;
      lines.push(`${bad ? '✗' : '✓'} march (${easy ? 'EASY' : 'NORMAL'}): ${bad || `${downs} edge turns, each one step down (${sim.D.dy}) and a turn; ${sides} sideways steps, never past a wall`}`);
    }
    return { ok, lines };
  }

  // ---------------------------------------------------------------- speed
  function speed(sab) {
    const lines = [];
    let ok = true;
    for (const easy of [true, false]) {
      const res = [];
      const probe = new SD.Sim({ wave: 0, easy, quiet: true });
      const total = probe.total;
      for (const n of [total, Math.ceil(total / 2), 4, 1]) {
        const sim = new SD.Sim({ wave: 0, easy, quiet: true, seed: 2, sabotage: sab });
        // keep n aliens, spread over the formation
        const keep = new Set();
        for (let i = 0; i < n; i++) keep.add(sim.aliens[Math.floor((i * total) / n)].id);
        for (const a of sim.aliens) if (!keep.has(a.id)) sim.popAlien(a, 'test');
        toPlay(sim);
        sim.events.length = 0;
        const times = [];
        runTo(sim, () => times.length >= 9, sim.t + 60, () => {
          for (const e of sim.events) if (e.type === 'step') times.push(sim.t);
          sim.events.length = 0;
          return {};
        });
        const gaps = times.slice(1).map((t, i) => t - times[i]);
        res.push({ n, gap: gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length) });
      }
      let bad = null;
      for (let i = 1; i < res.length; i++) if (!(res[i].gap < res[i - 1].gap - 1e-6)) bad = `${res[i].n} left is not faster than ${res[i - 1].n} left`;
      if (!bad && !(res[res.length - 1].gap < res[0].gap * 0.4)) bad = 'the last alien is not much faster than a full formation';
      ok = ok && !bad;
      lines.push(`${bad ? '✗' : '✓'} speed (${easy ? 'EASY' : 'NORMAL'}): ${res.map((r) => `${r.n} left ${fmt(r.gap)} s/step`).join(' · ')}${bad ? ' · ' + bad : ''}`);
    }
    return { ok, lines };
  }

  // ---------------------------------------------------------------- shields
  function shields(sab) {
    const sim = new SD.Sim({ wave: 0, easy: true, quiet: true, seed: 4, sabotage: sab });
    toPlay(sim);
    sim.freezeT = 99; // hold the march still
    const c = sim.cannons[0];
    const fireFrom = (x) => {
      c.x = x;
      c.cool = 0;
      sim.events.length = 0;
      const before = sim.shieldCells();
      sim.step(DT, { [c.id]: { fire: true } });
      runTo(sim, () => sim.shots.length === 0, sim.t + 3);
      const pops = sim.events.filter((e) => e.type === 'pop').length;
      return { lost: before - sim.shieldCells(), pops };
    };
    const shot = fireFrom(SD.SHIELD_X[0]);
    const gap = fireFrom((SD.SHIELD_X[1] + SD.SHIELD_X[2]) / 2 + 0.05);
    // a sprinkle falling onto the third shield
    let before = sim.shieldCells();
    sim.freezeT = 0;
    sim.sprinkles.push({ id: 999, x: SD.SHIELD_X[2] + 0.1, y: SD.SH_Y + 3, vy: -3, kind: 0, spin: 0 });
    sim.events.length = 0;
    const spr = { lost: 0, floor: false };
    runTo(sim, () => !sim.sprinkles.some((k) => k.id === 999), sim.t + 4, () => {
      if (sim.events.some((e) => e.type === 'splat')) spr.floor = true;
      return {};
    });
    spr.lost = before - sim.shieldCells();
    let bad = null;
    if (!(shot.lost >= 1)) bad = 'a star-pop went through a shield without chipping it';
    else if (shot.pops) bad = 'a star-pop went through a shield and popped an alien';
    else if (gap.lost) bad = 'a shot through the gap between shields chipped one';
    else if (!(spr.lost >= 1) || spr.floor) bad = 'a sprinkle went through a shield without chipping it';
    return { ok: !bad, lines: [`${bad ? '✗' : '✓'} shields: ${bad || `a star-pop chipped ${shot.lost} bit(s), a sprinkle chipped ${spr.lost}, a shot through the gap chipped none and popped ${gap.pops} alien`}`] };
  }

  // ---------------------------------------------------------------- the end of a wave
  function waveEnd(sab) {
    const lines = [];
    let ok = true;
    for (const w of [0, 9]) {
      const sim = new SD.Sim({ wave: w, easy: true, quiet: true, seed: 6, sabotage: sab });
      toPlay(sim);
      const last = sim.aliens.reduce((b, a) => (a.y < b.y ? a : b));
      for (const a of sim.aliens) if (a !== last) sim.popAlien(a, 'test');
      runTo(sim, () => false, sim.t + 1);
      let bad = sim.state !== 'play' ? `the wave ended with an alien still there (${sim.state})` : null;
      if (!bad) {
        const c = sim.cannons[0];
        let popT = null, clearT = null;
        runTo(sim, () => clearT !== null || sim.t > 30, sim.t + 30, () => {
          if (!last.alive && popT === null) popT = sim.t;
          if (sim.state !== 'play' && clearT === null) clearT = sim.t;
          return { [c.id]: { x: last.x, fire: true } };
        });
        if (popT === null) bad = 'could not pop the last alien';
        else if (clearT === null) bad = 'the last alien popped but the wave did not end';
        else if (clearT - popT > DT * 1.5) bad = 'the wave ended late';
        else {
          runTo(sim, () => false, sim.t + 3.2);
          if (w < 9 && !(sim.wave === w + 1 && (sim.state === 'intro' || sim.state === 'play') && sim.alive === sim.total)) bad = `wave ${w + 2} did not start (${sim.state})`;
          if (w === 9 && sim.state !== 'done') bad = `the last wave did not finish the game (${sim.state})`;
        }
      }
      ok = ok && !bad;
      lines.push(`${bad ? '✗' : '✓'} wave end (wave ${w + 1}): ${bad || `still on with 1 alien left, ended the step the last one popped, ${w < 9 ? `wave ${w + 2} started` : 'the game is won'}`}`);
    }
    return { ok, lines };
  }

  // ---------------------------------------------------------------- the autopilot clears wave 1 on EASY
  function autopilot(sab, quick) {
    const seeds = quick ? [1, 2] : [1, 2, 3, 4, 5, 6];
    const runs = [];
    for (const cfg of [{ mode: '1p', hero: 'teddy' }, { mode: '1p', hero: 'tommy' }, { mode: '2p' }]) {
      for (const seed of seeds) {
        const sim = new SD.Sim(Object.assign({ wave: 0, easy: true, seed }, cfg));
        const bots = sim.cannons.map((c) => new SD.Bot(sim, c, { idle: sab === 'idleBot' }));
        runTo(sim, () => sim.state === 'clear' || sim.state === 'oops' || sim.state === 'over', 180, () => {
          const inp = {};
          for (const b of bots) inp[b.p.id] = b.input();
          return inp;
        });
        runs.push({ cfg, seed, ok: sim.state === 'clear', t: sim.t, lost: sim.D.lives - sim.lives, state: sim.state });
      }
    }
    const fails = runs.filter((r) => !r.ok);
    const avg = runs.reduce((a, r) => a + r.t, 0) / runs.length;
    const lost = runs.reduce((a, r) => a + r.lost, 0);
    return {
      ok: !fails.length,
      lines: [`${fails.length ? '✗' : '✓'} autopilot (EASY wave 1): ${runs.length - fails.length}/${runs.length} cleared (1P Teddy, 1P Tommy, 2P × ${seeds.length} seeds), ` +
        `avg ${fmt(avg, 0)} s, max ${fmt(Math.max(...runs.map((r) => r.t)), 0)} s, ${lost} lives lost in all` +
        (fails.length ? ` · failed: ${fails.slice(0, 3).map((r) => `${r.cfg.mode} ${r.cfg.hero || ''} seed ${r.seed} (${r.state} at ${fmt(r.t, 0)} s)`).join(', ')}` : '')],
    };
  }

  // the whole game on EASY by the autopilot (keeps going when out of lives, like a kid would): no wave can get stuck
  function soak(sab) {
    const sim = new SD.Sim({ wave: 0, easy: true, seed: 11, mode: '1p', hero: 'tommy' });
    const bot = new SD.Bot(sim, sim.cannons[0], { idle: sab === 'idleBot' });
    let keeps = 0;
    const waveT = [];
    let w0 = 0, t0 = 0;
    runTo(sim, () => sim.state === 'done', 2400, () => {
      if (sim.state === 'over') { keeps++; sim.keepGoing(); }
      if (sim.wave !== w0) { waveT.push(sim.t - t0); w0 = sim.wave; t0 = sim.t; }
      return { [bot.p.id]: bot.input() };
    });
    const ok = sim.state === 'done';
    return { ok, lines: [`${ok ? '✓' : '✗'} soak (all 10 waves, EASY, autopilot): ${ok ? `done in ${fmt(sim.t / 60, 1)} min, score ${sim.score}, kept going ${keeps}×, slowest wave ${fmt(Math.max(...waveT, 0), 0)} s` : `stuck on wave ${sim.wave + 1} (${sim.state})`}`] };
  }

  // ---------------------------------------------------------------- frame rates
  function frames(sab) {
    // the same keys, held at the same moments of game time
    const script = (sim) => {
      const t = sim.t;
      const right = (t > 0.3 && t < 1.4) || (t > 3.0 && t < 3.6) || (t > 7.2 && t < 7.9);
      const left = (t > 1.8 && t < 2.6) || (t > 4.0 && t < 5.5);
      const fire = t > 1.7 && t < 9 && Math.floor(t * 3) % 2 === 0;
      return { teddy: { ax: (right ? 1 : 0) - (left ? 1 : 0), x: null, fire } };
    };
    const cps = [2, 4, 6, 8, 10];
    const runAt = (dts) => {
      const sim = new SD.Sim({ wave: 0, easy: false, seed: 9 });
      const runner = new SD.Runner(sim, { rawDt: sab === 'rawDt' });
      const got = [];
      let i = 0;
      while (sim.t < 10.2) {
        runner.advance(dts(i++), (s) => {
          if (got.length < cps.length && s.t >= cps[got.length] - 1e-6) got.push(s.hash());
          return script(s);
        });
      }
      return got;
    };
    const jr = SD.mulberry(77);
    const rates = { '30 fps': () => 1 / 30, '60 fps': () => 1 / 60, '120 fps': () => 1 / 120, jumpy: () => 1 / 144 + jr() * (1 / 24 - 1 / 144) };
    const res = {};
    for (const k in rates) res[k] = runAt(rates[k]);
    const base = res['120 fps'];
    const diff = Object.keys(res).filter((k) => res[k].join() !== base.join());
    const ok = !diff.length;
    return { ok, lines: [`${ok ? '✓' : '✗'} frames: ${ok ? `30, 60, 120 fps and a jumpy rate match at ${cps.join(', ')} s (score ${base[base.length - 1].split('|')[2]})` : `${diff.join(', ')} differ from 120 fps`}`] };
  }

  // ---------------------------------------------------------------- the rainbow beam
  function beam(sab) {
    const sim = new SD.Sim({ wave: 0, easy: true, quiet: true, seed: 8, sabotage: sab });
    toPlay(sim);
    const before = new Map(sim.columns().map((c) => [c.col, c.n]));
    sim.callBuddy();
    let ev = null;
    runTo(sim, () => !sim.buddy, sim.t + 12, () => {
      for (const e of sim.events) if (e.type === 'beam' && !ev) ev = e;
      sim.events.length = 0;
      return {};
    });
    const after = new Map(sim.columns().map((c) => [c.col, c.n]));
    let bad = null;
    if (!ev) bad = 'no beam';
    else if (after.has(ev.col)) bad = `column ${ev.col + 1} still has ${after.get(ev.col)} alien(s)`;
    else for (const [col, n] of before) if (col !== ev.col && after.get(col) !== n) bad = `the beam also popped column ${col + 1}`;
    if (!bad && sim.buddy) bad = 'the brother never left';
    return { ok: !bad, lines: [`${bad ? '✗' : '✓'} beam: ${bad || `the rainbow beam popped all ${before.get(ev.col)} aliens in column ${ev.col + 1} and nothing else; the brother rolled away`}`] };
  }

  const CHECKS = { march: [march, 'noDown'], speed: [speed, 'noSpeed'], shields: [shields, 'hardShields'], waveEnd: [waveEnd, 'noEnd'],
    autopilot: [autopilot, 'idleBot'], frames: [frames, 'rawDt'], beam: [beam, 'noBeam'] };

  function run(o = {}) {
    const lines = [], fails = [];
    for (const k in CHECKS) {
      const r = CHECKS[k][0](null, o.quick);
      lines.push(...r.lines);
      if (!r.ok) fails.push(k);
    }
    if (!o.quick) {
      const r = soak(null);
      lines.push(...r.lines);
      if (!r.ok) fails.push('soak');
    }
    return { ok: !fails.length, lines, fails };
  }

  // every check, with its rule broken: each one must fail
  function prove() {
    const lines = [], missed = [];
    for (const k in CHECKS) {
      const [fn, sab] = CHECKS[k];
      const r = fn(sab, true);
      if (r.ok) missed.push(k);
      lines.push(`${r.ok ? '✗ NOT CAUGHT' : '✓ caught'}: ${k} with "${sab}" → ${r.lines.filter((l) => l.startsWith('✗')).map((l) => l.slice(2)).join(' | ') || 'passed'}`);
    }
    return { ok: !missed.length, lines, missed };
  }

  SD.checks = { run, prove, march, speed, shields, waveEnd, autopilot, frames, beam, soak };
})(typeof window !== 'undefined' ? window : globalThis);
