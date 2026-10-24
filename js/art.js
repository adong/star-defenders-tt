/* TT Star Defenders: everything painted on a canvas. The space-toy-room backdrop, the launch-pad floor, the star-pop,
   the bubble a popped alien floats off in, the rainbow beam, glows and floating text. No image files. Exposes SD.art. */
(function () {
  'use strict';
  const SD = (window.SD = window.SD || {});
  const G = Kit.gfx;
  const { makeCanvas, toTexture } = G;
  const cache = {};
  const once = (key, make) => cache[key] || (cache[key] = make());

  // three looks for the jellies, one per wave (in turn): Gummy (a), Boppy (b), Squishy (c)
  const PALETTES = [
    { a: '#5fe07a', b: '#ff7ab8', c: '#a77bff' },
    { a: '#ffb347', b: '#4fd8ff', c: '#ff6b8a' },
    { a: '#c3f55c', b: '#ff9ad5', c: '#7aa7ff' },
  ];
  const TINT = { teddy: '#3d9bff', tommy: '#2fd6a2' };
  const LIGHT = { teddy: '#9fd0ff', tommy: '#9ff2d6' };
  const SPRINKLE = ['#ff5a8a', '#ffd23f', '#4fd8ff', '#8cff6b', '#c38bff'];

  // ---------------------------------------------------------------- the backdrop: a friendly night sky
  // Square, so the planets stay round: the picture is the middle band (rows OY..OY+640); above and below it the sky
  // carries on (a tall phone shows more sky than a wide screen).
  function backdrop() {
    return once('bg', () => {
      const BW = 1024, BH = 1024, OY = 192;
      const [c, g] = makeCanvas(BW, BH);
      g.fillStyle = '#1d1b52';
      g.fillRect(0, 0, BW, OY + 1);
      g.fillStyle = '#6a3d9a';
      g.fillRect(0, OY + 639, BW, BH - OY - 639);
      const gr = g.createLinearGradient(0, OY, 0, OY + 640);
      gr.addColorStop(0, '#1d1b52');
      gr.addColorStop(0.55, '#3b2a7a');
      gr.addColorStop(1, '#6a3d9a');
      g.fillStyle = gr;
      g.fillRect(0, OY, BW, 640);
      let seed = 11;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      // soft clouds of colour
      for (const [x, y, r, col] of [[180, 160, 260, 'rgba(255,120,200,0.16)'], [820, 420, 300, 'rgba(90,200,255,0.14)'], [520, 80, 220, 'rgba(160,120,255,0.18)']]) {
        const rg = g.createRadialGradient(x, y + OY, 0, x, y + OY, r);
        rg.addColorStop(0, col);
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg;
        g.fillRect(0, 0, BW, BH);
      }
      // stars (round dots only: nothing that could look like a star-pop or a sprinkle)
      for (let i = 0; i < 560; i++) {
        g.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`;
        const r = rnd() < 0.08 ? 1.8 : 0.9;
        g.beginPath(); g.arc(rnd() * BW, rnd() * BH, r, 0, Math.PI * 2); g.fill();
      }
      // a smiling candy moon
      g.fillStyle = '#ffe9a8';
      g.beginPath(); g.arc(880, OY + 110, 46, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(220,180,100,0.45)';
      for (const [x, y, r] of [[862, 92, 9], [900, 130, 11], [895, 88, 5]]) { g.beginPath(); g.arc(x, y + OY, r, 0, Math.PI * 2); g.fill(); }
      g.strokeStyle = '#a5753a';
      g.lineWidth = 3;
      g.beginPath(); g.arc(872, OY + 112, 14, 0.2, Math.PI - 0.2); g.stroke();
      // a ringed planet and a little striped one
      g.fillStyle = '#ff9a6b';
      g.beginPath(); g.arc(130, OY + 470, 38, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,230,160,0.95)';
      g.lineWidth = 6;
      g.beginPath(); g.ellipse(130, OY + 470, 68, 14, -0.3, 0, Math.PI * 2); g.stroke();
      g.save();
      g.beginPath(); g.arc(640, OY + 560, 26, 0, Math.PI * 2); g.clip();
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#7ae7ff' : '#4fb2ff'; g.fillRect(600, OY + 532 + i * 10, 80, 10); }
      g.restore();
      g.font = `30px ${G.EMOJI_FONT}`;
      g.fillText('🪐', 320, OY + 120);
      return toTexture(c);
    });
  }

  // the launch pad the carts roll on: bright toy tiles
  function floorTexture() {
    return once('floor', () => {
      const [c, g] = makeCanvas(256, 64);
      const cols = ['#ff6b6b', '#ffd23f', '#4fd8ff', '#8cff6b'];
      for (let i = 0; i < 4; i++) { g.fillStyle = cols[i]; g.fillRect(i * 64, 0, 64, 64); }
      g.strokeStyle = 'rgba(20,18,40,0.35)';
      g.lineWidth = 4;
      for (let i = 0; i < 4; i++) g.strokeRect(i * 64 + 2, 2, 60, 60);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 4; i++) { g.beginPath(); g.arc(i * 64 + 32, 32, 9, 0, Math.PI * 2); g.fill(); }
      const t = toTexture(c);
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      return t;
    });
  }

  function starPath(g, x, y, r1, r2, n = 5, rot = -Math.PI / 2) {
    g.beginPath();
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n;
      g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
    g.closePath();
  }

  // a star-pop: a fat yellow star with a glow in the kid's colour
  function starTexture(glow) {
    return once('star' + glow, () => {
      const [c, g] = makeCanvas(128, 128);
      const rg = g.createRadialGradient(64, 64, 8, 64, 64, 62);
      rg.addColorStop(0, glow);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = 0.7;
      g.fillStyle = rg;
      g.fillRect(0, 0, 128, 128);
      g.globalAlpha = 1;
      starPath(g, 64, 66, 40, 18);
      g.lineJoin = 'round';
      g.lineWidth = 7;
      g.strokeStyle = '#14121f';
      g.stroke();
      g.fillStyle = '#ffe14a';
      g.fill();
      starPath(g, 58, 58, 16, 7);
      g.fillStyle = 'rgba(255,255,255,0.75)';
      g.fill();
      return toTexture(c);
    });
  }

  // the bubble a popped jelly floats away in
  function bubbleTexture() {
    return once('bubble', () => {
      const [c, g] = makeCanvas(128, 128);
      const rg = g.createRadialGradient(64, 64, 40, 64, 64, 62);
      rg.addColorStop(0, 'rgba(255,255,255,0.05)');
      rg.addColorStop(0.8, 'rgba(180,240,255,0.35)');
      rg.addColorStop(1, 'rgba(255,255,255,0.9)');
      g.fillStyle = rg;
      g.beginPath(); g.arc(64, 64, 62, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,170,240,0.6)';
      g.lineWidth = 3;
      g.beginPath(); g.arc(64, 64, 58, 2.2, 3.6); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath(); g.ellipse(42, 40, 14, 8, -0.7, 0, Math.PI * 2); g.fill();
      return toTexture(c);
    });
  }

  // the rainbow beam: bands across, bright in the middle, soft at the edges
  function beamTexture() {
    return once('beam', () => {
      const [c, g] = makeCanvas(128, 256);
      const cols = ['#ff4b4b', '#ff9a2e', '#ffe14a', '#5fe07a', '#4fb2ff', '#a77bff'];
      const bw = 128 / cols.length;
      cols.forEach((col, i) => { g.fillStyle = col; g.fillRect(i * bw, 0, bw + 1, 256); });
      const lg = g.createLinearGradient(0, 0, 128, 0);
      lg.addColorStop(0, 'rgba(255,255,255,0)');
      lg.addColorStop(0.5, 'rgba(255,255,255,0.55)');
      lg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = lg;
      g.fillRect(0, 0, 128, 256);
      // soft sides
      g.globalCompositeOperation = 'destination-in';
      const sg = g.createLinearGradient(0, 0, 128, 0);
      sg.addColorStop(0, 'rgba(0,0,0,0)');
      sg.addColorStop(0.15, 'rgba(0,0,0,1)');
      sg.addColorStop(0.85, 'rgba(0,0,0,1)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = sg;
      g.fillRect(0, 0, 128, 256);
      const t = toTexture(c);
      t.wrapT = THREE.RepeatWrapping;
      return t;
    });
  }

  // a candle flame / muzzle flash
  function flameTexture() {
    return once('flame', () => G.radialTexture(64, [[0, 'rgba(255,255,230,1)'], [0.35, 'rgba(255,210,80,0.9)'], [1, 'rgba(255,120,40,0)']]));
  }

  // dizzy stars over a sprinkled kid
  function dizzyTexture() {
    return once('dizzy', () => {
      const [c, g] = makeCanvas(256, 64);
      for (let i = 0; i < 4; i++) {
        starPath(g, 32 + i * 64, 32, 22, 10);
        g.fillStyle = ['#ffe14a', '#ff9ad5', '#9fe8ff', '#c3f55c'][i];
        g.fill();
        g.lineWidth = 3;
        g.strokeStyle = '#14121f';
        g.stroke();
      }
      return toTexture(c);
    });
  }

  // floating text ("+30", "BURP!"): drawn wide, the sprite is scaled 4:1
  function textTexture(text, color) {
    return once('txt' + text + color, () => {
      const [c, g] = makeCanvas(512, 128);
      g.font = `72px ${G.FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 12;
      g.strokeStyle = '#14121f';
      g.lineJoin = 'round';
      g.strokeText(text, 256, 66);
      g.fillStyle = color;
      g.fillText(text, 256, 66);
      return toTexture(c);
    });
  }

  SD.art = { PALETTES, TINT, LIGHT, SPRINKLE, backdrop, floorTexture, starTexture, bubbleTexture, beamTexture, flameTexture, dizzyTexture, textTexture };
})();
