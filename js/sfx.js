/* TT Star Defenders: sound effects, all synthesised with Kit.sound.tone and Kit.sound.hiss (no audio files), so they
   follow the kit's one sound switch. Our own sounds: the march is a soft toy-xylophone tick that speeds up, popped
   jellies burp, star-pops go "pew-pop", the cake saucer warbles. Every effect is silent until Kit.sound.init(). */
(function () {
  'use strict';
  const SD = (window.SD = window.SD || {});
  const S = Kit.sound;
  const { tone, hiss } = S;
  const notes = (list, o = {}) => list.forEach((f, i) => tone({ type: o.type || 'triangle', f, at: (o.at || 0) + i * (o.gap || 0.07), dur: o.dur || 0.16, vol: o.vol || 0.12 }));
  const MARCH = [659, 784, 880, 784];
  let lastPop = 0, lastChip = 0;

  SD.sfx = {
    // the march: a little four-note toy tune, one note per step (higher and brighter when they step down)
    step(n, down) {
      const f = MARCH[n % MARCH.length] * (down ? 1.5 : 1);
      tone({ type: 'sine', f, dur: 0.07, vol: 0.05 });
      tone({ type: 'triangle', f: f * 2, dur: 0.04, vol: 0.015 });
    },
    // a star-pop leaving the cannon: a springy pew
    fire() {
      tone({ type: 'square', f: 880, to: 1760, dur: 0.08, vol: 0.035, lp: 3000 });
      tone({ type: 'sine', f: 520, to: 1300, dur: 0.1, vol: 0.08 });
    },
    // a jelly pops and burps
    pop(kind, beam) {
      const now = performance.now();
      if (now - lastPop < 40) return;
      lastPop = now;
      const f = { a: 330, b: 392, c: 494 }[kind] || 392;
      hiss({ filter: 'bandpass', f: 2200, q: 2, dur: 0.05, vol: 0.12 });
      tone({ type: 'sine', f: f * 2, to: f * 3, dur: 0.08, vol: 0.12 });
      if (!beam) {
        tone({ type: 'sawtooth', f: 95, to: 70, dur: 0.22, vol: 0.05, lp: 500, at: 0.08 });
        tone({ type: 'sine', f: 140, to: 90, dur: 0.2, vol: 0.12, at: 0.08 });
      }
    },
    chip() {
      const now = performance.now();
      if (now - lastChip < 60) return;
      lastChip = now;
      tone({ type: 'sine', f: 240, to: 150, dur: 0.1, vol: 0.12 });
      hiss({ filter: 'lowpass', f: 900, dur: 0.06, vol: 0.06 });
    },
    // a sprinkle starts falling: a tiny whistle down
    drop() { tone({ type: 'sine', f: 1400, to: 900, dur: 0.12, vol: 0.03 }); },
    sprinklePop() { notes([1568, 2093], { gap: 0.04, vol: 0.05, type: 'sine' }); },
    splat() { hiss({ filter: 'bandpass', f: 1500, q: 1.5, dur: 0.06, vol: 0.05 }); },
    // sprinkled! a slide whistle down and a silly wobble
    sprinkled() {
      tone({ type: 'sine', f: 900, to: 260, dur: 0.4, vol: 0.13 });
      tone({ type: 'triangle', f: 330, to: 300, dur: 0.3, vol: 0.06, at: 0.4 });
      tone({ type: 'triangle', f: 300, to: 330, dur: 0.3, vol: 0.06, at: 0.55 });
    },
    // the jellies reached the floor and boinged back up
    landed() {
      tone({ type: 'sine', f: 120, to: 520, dur: 0.5, vol: 0.18 });
      tone({ type: 'sine', f: 520, to: 900, dur: 0.25, vol: 0.06, at: 0.45 });
    },
    saucer() { notes([784, 988, 1175], { gap: 0.06, vol: 0.05, type: 'sine' }); },
    saucerHum() {
      tone({ type: 'sine', f: 520, to: 640, dur: 0.2, vol: 0.025 });
      tone({ type: 'sine', f: 640, to: 520, dur: 0.2, vol: 0.025, at: 0.2 });
    },
    saucerPop() { S.coin(5); notes([1047, 1319, 1568, 2093], { gap: 0.06, vol: 0.09, at: 0.08 }); },
    wave() { notes([523, 784], { gap: 0.1, vol: 0.08 }); },
    clear() { notes([523, 659, 784, 1047, 784, 1047, 1319], { gap: 0.1, dur: 0.24, vol: 0.12 }); },
    done() { notes([523, 659, 784, 1047, 1319, 1568, 2093], { gap: 0.12, dur: 0.3, vol: 0.13 }); },
    over() { notes([392, 370, 349, 330], { gap: 0.22, dur: 0.3, vol: 0.1 }); },
    // the rainbow beam: a sweep up through a happy chord
    beam() {
      notes([523, 659, 784, 1047, 1319, 1568], { gap: 0.04, vol: 0.07, type: 'sine', dur: 0.3 });
      hiss({ filter: 'highpass', f: 3000, to: 6000, dur: 0.6, vol: 0.04 });
    },
    highfive() {
      hiss({ f: 1800, q: 1.2, dur: 0.07, vol: 0.4 });
      hiss({ f: 2400, q: 1.2, dur: 0.05, vol: 0.2, at: 0.05 });
      notes([659, 880, 1109, 1319], { gap: 0.06, vol: 0.1, at: 0.12 });
    },
    buddyIn() { tone({ type: 'sine', f: 400, to: 1200, dur: 0.35, vol: 0.1 }); hiss({ f: 1200, to: 3000, dur: 0.35, vol: 0.05 }); },
    buddyOut() { tone({ type: 'sine', f: 1200, to: 400, dur: 0.35, vol: 0.08 }); },
    gift() { S.coin(4); notes([1047, 1319], { gap: 0.08, vol: 0.08, at: 0.15 }); },
    click() { S.click(); },
    start() { S.powerup(); },
  };
})();
