/* TT Star Defenders: the rules. No Three.js here, so node runs them too (tools/check.js).
   The field is W x H units, y up. Rows of jelly aliens march side to side in steps and step down at each edge; the
   march gets faster as fewer are left. The brothers' toy cannons roll along the floor and fire star-pops; aliens drop
   slow sprinkles; four squishy shields chip away; a cake saucer crosses the top for bonus points. 10 waves.
   Also here: the companion (the other brother rolls in a second cannon and fires a rainbow beam up one column),
   the 2-player high five, the autopilot (SD.Bot) and the fixed-step runner (SD.Runner).
   Time: the rules always step by DT = 1/120 s, whatever the screen's frame rate (SD.Runner), so the same inputs
   give the same game at 30, 60 or 120 fps. Randomness comes from a seeded generator.
   o.sabotage breaks one rule on purpose, so the checks (js/checks.js) can prove they notice. */
(function (root) {
  'use strict';
  const SD = (root.SD = root.SD || {});
  const DT = 1 / 120;
  const W = 26, H = 20;
  const MUZZLE_Y = 2.5;          // star-pops leave the barrel here
  const CART_HW = 0.85;          // half the cannon cart's width
  const HIT_TOP = 2.2;           // a sprinkle lower than this, over a cart, sprinkles that kid
  const LAND_Y = 2.4;            // an alien's feet this low: it has landed
  const COL_DX = 2.1, ROW_DY = 1.6;
  const TOP_ROW_Y = H - 2.7;
  const SAUCER_Y = H - 0.9;
  const ALIEN_HW = 0.66, ALIEN_HH = 0.56;
  const EDGE = 0.9;              // the aliens turn around this close to the walls
  const STEP_DX = 0.5;
  const CELL = 0.4, SH_COLS = 9, SH_ROWS = 5, SH_Y = 3.2;
  const SHIELD_X = [1, 2, 3, 4].map((i) => (W * i) / 5);
  const SH_MASK = ['.#######.', '#########', '#########', '###...###', '##.....##']; // top row first
  const BEAM_HW = 0.95;
  const PTS = { a: 10, b: 20, c: 30 };
  const SAUCER_PTS = [50, 100, 150, 200, 300];
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];

  // The two difficulties. base/fast: seconds between march steps with every alien there / with the last one.
  const DIFF = {
    easy: { lives: 5, base: 0.62, fast: 0.15, dy: 0.45, sprGap: 3.6, sprMax: 1, sprV: 3.0, aim: 0, shots: 2, cool: 0.26, shotV: 22,
      speed: 9, saucerGap: [16, 22], saucerV: 3.4, regrow: true, waveSpeed: 0.03, startDrop: 0 },
    normal: { lives: 3, base: 0.5, fast: 0.055, dy: 0.6, sprGap: 1.25, sprMax: 3, sprV: 5.2, aim: 0.4, shots: 1, cool: 0.3, shotV: 24,
      speed: 10.5, saucerGap: [14, 20], saucerV: 5, regrow: false, waveSpeed: 0.05, startDrop: 0.35 },
  };

  // 10 waves, each a new formation. Rows top first: c = Squishy (30), b = Boppy (20), a = Gummy (10), . = nobody.
  const WAVES = [
    { name: 'Hello, Jellies!', tip: 'Pop every jelly alien before they march down!', rows: ['cccccccc', 'bbbbbbbb', 'aaaaaaaa', 'aaaaaaaa'] },
    { name: 'Checkers', tip: 'Watch out for the sprinkles they drop!', rows: ['c.c.c.c.c', '.c.c.c.c.', 'b.b.b.b.b', '.b.b.b.b.', 'a.a.a.a.a'] },
    { name: 'Big V', tip: 'Hide behind the squishy shields!', rows: ['cc.....cc', 'cbb...bbc', '.bba.abb.', '..aaaaa..', '...aaa...'] },
    { name: 'Diamond', tip: 'Pop the cake saucer at the top for bonus points!', rows: ['...ccc...', '..bbbbb..', '.bbbbbbb.', '..aaaaa..', '...aaa...'] },
    { name: 'Two Teams', tip: 'Call your brother for a rainbow beam!', rows: ['ccc...ccc', 'bbb...bbb', 'bbb...bbb', 'aaa...aaa'] },
    { name: 'Smiley', tip: 'Say cheese! Pop the smiley.', rows: ['..bbbbb..', '.bc...cb.', '.b.....b.', '.ba...ab.', '..baaab..'] },
    { name: 'Big Heart', tip: 'The jellies love you. Pop them anyway!', rows: ['.cc...cc.', 'cccc.cccc', 'bbbbbbbbb', '.bbbbbbb.', '..aaaaa..'] },
    { name: 'Zig Zag', tip: 'Zig, zag, POP!', rows: ['cc..cc..c', '.bb..bb..', '..bb..bb.', 'a..aa..aa', 'aa..aa..a'] },
    { name: 'Rocket', tip: '3, 2, 1... POP!', rows: ['...ccc...', '..cbbbc..', '..bbbbb..', '.b.aaa.b.', 'aa.a.a.aa'] },
    { name: 'The Big Party', tip: 'The last wave. Pop them all!', rows: ['.ccccccc.', 'cbcbcbcbc', 'bbbbbbbbb', 'aaaaaaaaa', 'aaaaaaaaa'] },
  ];

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const buddyFor = (id) => (id === 'tommy' ? 'teddy' : 'tommy');

  function mulberry(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------------------------------------------------------------- the game
  // o: { wave (0-based), mode '1p' | '2p', hero, easy, seed, score, quiet (no sprinkles, no saucer), sabotage }
  function Sim(o = {}) {
    this.o = o;
    this.mode = o.mode === '2p' ? '2p' : '1p';
    this.hero = o.hero === 'tommy' ? 'tommy' : 'teddy';
    this.easy = o.easy !== false;
    this.D = DIFF[this.easy ? 'easy' : 'normal'];
    this.sab = o.sabotage || null;
    this.rand = mulberry(o.seed || 1);
    this.t = 0;
    this.steps = 0;
    this.score = o.score || 0;
    this.lives = o.lives || this.D.lives;
    this.events = [];
    this.giftIx = 0;
    this.cannons = (this.mode === '2p' ? ['teddy', 'tommy'] : [this.hero]).map((id, i, all) => ({
      id, x: all.length === 2 ? (i ? W * 0.62 : W * 0.38) : W / 2, vx: 0, cool: 0, hitT: 0, inv: 0, pose: 'ready', poseT: 0, fired: 0,
    }));
    this.shots = [];
    this.sprinkles = [];
    this.saucer = null;
    this.buddy = null;
    this.beam = null;
    this.hi5Cd = 0;
    this.superT = 0;
    this.nextId = 1;
    this.shields = SHIELD_X.map((x) => ({ x, cells: new Uint8Array(SH_COLS * SH_ROWS) }));
    this.regrowShields();
    this.startWave(o.wave || 0);
  }
  const P = Sim.prototype;

  P.ev = function (type, data) { this.events.push(Object.assign({ type }, data)); };
  P.player = function (id) { return this.cannons.find((c) => c.id === id); };
  P.addScore = function (n) { this.score += n; };

  P.regrowShields = function () {
    for (const s of this.shields) {
      for (let j = 0; j < SH_ROWS; j++) for (let i = 0; i < SH_COLS; i++) s.cells[j * SH_COLS + i] = SH_MASK[SH_ROWS - 1 - j][i] === '#' ? 1 : 0;
    }
  };
  P.shieldCells = function () { let n = 0; for (const s of this.shields) for (const c of s.cells) n += c; return n; };

  P.startWave = function (w) {
    this.wave = w;
    const def = WAVES[w];
    const cols = Math.max(...def.rows.map((r) => r.length));
    this.cols = cols;
    this.aliens = [];
    def.rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const k = row[c];
        if (k === '.' || k === ' ') continue;
        this.aliens.push({ id: this.nextId++, type: k, col: c, row: r, bx: (c - (cols - 1) / 2) * COL_DX, by: -r * ROW_DY, alive: true, x: 0, y: 0 });
      }
    });
    this.total = this.aliens.length;
    this.alive = this.total;
    this.fx = W / 2;
    this.fy0 = TOP_ROW_Y - Math.min(4, w) * this.D.startDrop;
    this.fy = this.fy0;
    this.dir = w % 2 ? -1 : 1;
    this.stepT = 0.4;
    this.marchN = 0;
    this.freezeT = 0;
    this.placeAliens();
    this.sprinkles.length = 0;
    this.shots.length = 0;
    this.saucer = null;
    this.saucerT = this.range(this.D.saucerGap) * 0.7;
    this.sprT = this.D.sprGap * 1.5;
    if (this.D.regrow && w > 0) this.regrowShields();
    this.state = 'intro';
    this.stateT = 0;
    for (const c of this.cannons) { c.pose = 'ready'; c.hitT = 0; }
    this.ev('wave', { wave: w });
  };

  P.range = function (r) { return r[0] + this.rand() * (r[1] - r[0]); };

  P.placeAliens = function () {
    for (const a of this.aliens) { a.x = this.fx + a.bx; a.y = this.fy + a.by; }
  };

  // seconds between march steps: slow with every alien there, fast with only a few left
  P.interval = function () {
    const D = this.D;
    const base = D.base * (1 - D.waveSpeed * this.wave);
    if (this.sab === 'noSpeed') return base;
    const f = this.alive / this.total;
    return D.fast + (base - D.fast) * Math.pow(f, 1.4);
  };

  P.columns = function () {
    const m = new Map();
    for (const a of this.aliens) {
      if (!a.alive) continue;
      let c = m.get(a.col);
      if (!c) m.set(a.col, (c = { col: a.col, x: a.x, n: 0, low: null }));
      c.n++;
      if (!c.low || a.y < c.low.y) c.low = a;
    }
    return [...m.values()];
  };
  P.colX = function (col) { return this.fx + (col - (this.cols - 1) / 2) * COL_DX; };

  // ---------------------------------------------------------------- one step
  // input: { teddy: { ax: -1..1, x: target x or null, fire: bool }, tommy: {...} }
  P.step = function (dt, input = {}) {
    this.t += dt;
    this.steps++;
    this.stateT += dt;
    if (this.hi5Cd > 0) this.hi5Cd = Math.max(0, this.hi5Cd - dt);
    if (this.superT > 0) this.superT = Math.max(0, this.superT - dt);
    const st = this.state;
    const moving = st === 'intro' || st === 'play' || st === 'oops';
    for (const c of this.cannons) this.updateCannon(c, moving ? input[c.id] || {} : {}, dt);
    this.updateShots(dt);
    this.updateSprinkles(dt);
    this.updateSaucer(dt);
    this.updateBuddy(dt);
    this.updateBeam(dt);
    if (st === 'intro') {
      if (this.stateT > 1.6) { this.state = 'play'; this.stateT = 0; }
    } else if (st === 'play') {
      if (this.freezeT > 0) this.freezeT = Math.max(0, this.freezeT - dt);
      else this.march(dt);
      this.dropSprinkles(dt);
      this.checkEnd();
    } else if (st === 'oops') {
      // out of lives: a moment to see it, then the shell shows the "keep going" card
      if (this.stateT > 1.2) { this.state = 'over'; this.stateT = 0; this.ev('over'); }
    } else if (st === 'clear') {
      if (this.stateT > 2.8) {
        if (this.wave + 1 >= WAVES.length) { this.state = 'done'; this.stateT = 0; this.ev('done'); }
        else this.startWave(this.wave + 1);
      }
    }
  };

  P.checkEnd = function () {
    const left = this.sab === 'noEnd' ? this.alive + (this.saucer ? 1 : 0) + 1 : this.alive;
    if (left > 0 || this.state !== 'play') return;
    this.state = 'clear';
    this.stateT = 0;
    this.sprinkles.length = 0;
    const bonus = 100 * (this.wave + 1);
    this.addScore(bonus);
    for (const c of this.cannons) { c.pose = 'celebrate'; c.poseT = 0; }
    this.ev('clear', { wave: this.wave, bonus, last: this.wave + 1 >= WAVES.length });
  };

  // ---------------------------------------------------------------- the cannons
  P.updateCannon = function (c, inp, dt) {
    const D = this.D;
    if (c.hitT > 0) c.hitT = Math.max(0, c.hitT - dt);
    if (c.inv > 0) c.inv = Math.max(0, c.inv - dt);
    if (c.cool > 0) c.cool = Math.max(0, c.cool - dt);
    if (c.poseT > 0) { c.poseT -= dt; if (c.poseT <= 0 && c.pose !== 'celebrate') c.pose = 'ready'; }
    const sp = D.speed;
    let vx;
    if (inp.x !== null && inp.x !== undefined && !inp.ax) {
      const d = clamp(inp.x, CART_HW + 0.2, W - CART_HW - 0.2) - c.x;
      vx = clamp(d * 14, -sp * 1.5, sp * 1.5);
      if (Math.abs(d) < 0.02) vx = d / dt;
    } else vx = clamp(inp.ax || 0, -1, 1) * sp;
    if (this.sab === 'stuckOops' && c.hitT > 0) vx = 0;
    c.vx = vx;
    c.x = clamp(c.x + vx * dt, CART_HW + 0.2, W - CART_HW - 0.2);
    if (inp.fire && this.state === 'play' && c.cool <= 0 && c.pose !== 'celebrate') {
      const mine = this.shots.reduce((n, s) => n + (s.by === c.id ? 1 : 0), 0);
      const max = D.shots + (this.superT > 0 ? 2 : 0);
      if (mine < max) {
        this.shots.push({ id: this.nextId++, by: c.id, x: c.x, y: MUZZLE_Y, vy: D.shotV * (this.superT > 0 ? 1.2 : 1), super: this.superT > 0 });
        c.cool = D.cool * (this.superT > 0 ? 0.55 : 1);
        c.fired++;
        this.ev('fire', { by: c.id, x: c.x });
      }
    }
  };

  P.hitCannon = function (c, x) {
    this.lives = Math.max(0, this.lives - 1);
    c.hitT = 1.0;
    c.inv = 2.6;
    c.pose = 'oops';
    c.poseT = 1.0;
    this.freezeT = Math.max(this.freezeT, 1.1);
    for (const s of this.sprinkles) this.ev('splat', { x: s.x, y: s.y, soft: true });
    this.sprinkles.length = 0;
    this.ev('sprinkled', { who: c.id, x: c.x, lives: this.lives });
    if (this.lives <= 0) { this.state = 'oops'; this.stateT = 0; }
  };

  // ---------------------------------------------------------------- the march
  P.march = function (dt) {
    this.stepT -= dt;
    if (this.stepT > 0) return;
    this.stepT += this.interval();
    if (this.alive <= 0) return;
    let lo = Infinity, hi = -Infinity;
    for (const a of this.aliens) if (a.alive) { lo = Math.min(lo, a.x); hi = Math.max(hi, a.x); }
    const dir = this.dir;
    const atEdge = dir > 0 ? hi + STEP_DX > W - EDGE : lo - STEP_DX < EDGE;
    let down = false;
    if (atEdge) {
      if (this.sab !== 'noDown') { this.fy -= this.D.dy; down = true; }
      this.dir = -dir;
    } else this.fx += dir * STEP_DX;
    this.marchN++;
    this.placeAliens();
    this.ev('step', { n: this.marchN, down, dir: this.dir, fx: this.fx, fy: this.fy, lo, hi, alive: this.alive });
    this.eatShields();
    let low = Infinity;
    for (const a of this.aliens) if (a.alive) low = Math.min(low, a.y - ALIEN_HH);
    if (low < LAND_Y) this.landed();
  };

  // an alien squashes any shield bits it walks into
  P.eatShields = function () {
    for (const a of this.aliens) {
      if (!a.alive || a.y - ALIEN_HH > SH_Y + SH_ROWS * CELL) continue;
      for (const s of this.shields) {
        if (Math.abs(a.x - s.x) > ALIEN_HW + (SH_COLS * CELL) / 2) continue;
        for (let j = 0; j < SH_ROWS; j++) for (let i = 0; i < SH_COLS; i++) {
          const k = j * SH_COLS + i;
          if (!s.cells[k]) continue;
          const cx = s.x - (SH_COLS * CELL) / 2 + (i + 0.5) * CELL, cy = SH_Y + (j + 0.5) * CELL;
          if (Math.abs(cx - a.x) < ALIEN_HW + CELL / 2 - 0.05 && Math.abs(cy - a.y) < ALIEN_HH + CELL / 2 - 0.05) { s.cells[k] = 0; this.ev('chip', { x: cx, y: cy, quiet: true }); }
        }
      }
    }
  };

  // The aliens reached the floor: a life, and the whole formation boings back up to the top.
  P.landed = function () {
    this.lives = Math.max(0, this.lives - 1);
    this.fy = this.fy0;
    this.placeAliens();
    this.freezeT = 1.6;
    this.sprinkles.length = 0;
    for (const c of this.cannons) { c.pose = 'oops'; c.poseT = 1.0; c.inv = Math.max(c.inv, 1.5); }
    this.ev('landed', { lives: this.lives });
    if (this.lives <= 0) { this.state = 'oops'; this.stateT = 0; }
  };

  P.popAlien = function (a, by) {
    if (!a.alive) return;
    a.alive = false;
    this.alive--;
    const pts = PTS[a.type] || 10;
    this.addScore(pts);
    this.ev('pop', { id: a.id, x: a.x, y: a.y, kind: a.type, by, pts });
  };

  // ---------------------------------------------------------------- star-pops
  P.updateShots = function (dt) {
    for (const s of this.shots) {
      const y0 = s.y;
      s.y += s.vy * dt;
      // a sprinkle in the way: both pop
      for (const k of this.sprinkles) {
        if (Math.abs(k.x - s.x) < 0.38 && k.y > y0 - 0.45 && k.y < s.y + 0.45) {
          k.dead = s.dead = true;
          this.addScore(5);
          this.ev('sprinklePop', { x: k.x, y: k.y, by: s.by });
          break;
        }
      }
      if (s.dead) continue;
      if (this.hitShield(s.x, s.y, 1)) { s.dead = true; continue; }
      for (const a of this.aliens) {
        if (a.alive && Math.abs(a.x - s.x) < ALIEN_HW + 0.1 && Math.abs(a.y - s.y) < ALIEN_HH + 0.1) {
          this.popAlien(a, s.by);
          s.dead = true;
          break;
        }
      }
      if (s.dead) continue;
      const u = this.saucer;
      if (u && !u.dead && Math.abs(u.x - s.x) < 1.25 && Math.abs(u.y - s.y) < 0.6) { this.popSaucer(s.by); s.dead = true; continue; }
      if (s.y > H + 0.6) { s.dead = true; this.ev('miss', { x: s.x }); }
    }
    this.shots = this.shots.filter((s) => !s.dead);
    this.sprinkles = this.sprinkles.filter((k) => !k.dead);
  };

  // dir: 1 = a star-pop from below (chips the hit bit and one above), -1 = a sprinkle from above (and one below)
  P.hitShield = function (x, y, dir) {
    if (y < SH_Y || y >= SH_Y + SH_ROWS * CELL) return false;
    for (const s of this.shields) {
      const i = Math.floor((x - (s.x - (SH_COLS * CELL) / 2)) / CELL);
      if (i < 0 || i >= SH_COLS) continue;
      const j = Math.floor((y - SH_Y) / CELL);
      if (!s.cells[j * SH_COLS + i]) return false;
      if (this.sab === 'hardShields') return false;
      s.cells[j * SH_COLS + i] = 0;
      const j2 = j + dir, i2 = i + (this.rand() < 0.5 ? -1 : 1);
      if (j2 >= 0 && j2 < SH_ROWS && this.rand() < 0.6) s.cells[j2 * SH_COLS + i] = 0;
      if (i2 >= 0 && i2 < SH_COLS && this.rand() < 0.35) s.cells[j * SH_COLS + i2] = 0;
      const cx = s.x - (SH_COLS * CELL) / 2 + (i + 0.5) * CELL, cy = SH_Y + (j + 0.5) * CELL;
      this.ev('chip', { x: cx, y: cy, dir });
      return true;
    }
    return false;
  };

  // ---------------------------------------------------------------- sprinkles
  P.dropSprinkles = function (dt) {
    if (this.o.quiet || this.freezeT > 0) return;
    const D = this.D;
    this.sprT -= dt;
    if (this.sprT > 0) return;
    const gap = D.sprGap * Math.max(0.55, 1 - 0.05 * this.wave);
    this.sprT = gap * (0.6 + this.rand() * 0.8);
    const max = D.sprMax + (this.easy ? 0 : Math.floor(this.wave / 4));
    if (this.sprinkles.length >= max) return;
    const cols = this.columns();
    if (!cols.length) return;
    let pick;
    if (this.rand() < D.aim) {
      const tx = this.cannons[Math.floor(this.rand() * this.cannons.length)].x;
      pick = cols.reduce((b, c) => (Math.abs(c.x - tx) < Math.abs(b.x - tx) ? c : b));
    } else pick = cols[Math.floor(this.rand() * cols.length)];
    const a = pick.low;
    this.sprinkles.push({ id: this.nextId++, x: a.x, y: a.y - ALIEN_HH - 0.1, vy: -D.sprV * (1 + 0.02 * this.wave), kind: Math.floor(this.rand() * 5), spin: this.rand() * 6 });
    this.ev('drop', { x: a.x, y: a.y, alien: a.id });
  };

  P.updateSprinkles = function (dt) {
    if (this.freezeT > 0 && this.state === 'play') return;
    for (const k of this.sprinkles) {
      k.y += k.vy * dt;
      k.spin += dt * 5;
      if (this.hitShield(k.x, k.y, -1)) { k.dead = true; continue; }
      if (k.y < HIT_TOP && k.y > 0.2) {
        for (const c of this.cannons) {
          if (c.inv <= 0 && Math.abs(c.x - k.x) < CART_HW + 0.12 && this.state === 'play') {
            k.dead = true;
            this.hitCannon(c, k.x);
            break;
          }
        }
        if (k.dead) break; // hitCannon cleared the list
      }
      if (k.y < 0.15) { k.dead = true; this.ev('splat', { x: k.x, y: 0.15 }); }
    }
    this.sprinkles = this.sprinkles.filter((k) => !k.dead);
  };

  // ---------------------------------------------------------------- the cake saucer
  P.updateSaucer = function (dt) {
    const u = this.saucer;
    if (u) {
      u.x += u.vx * dt;
      u.t += dt;
      if (u.x < -2.5 || u.x > W + 2.5) { this.saucer = null; this.ev('saucerGone'); }
      return;
    }
    if (this.o.quiet || this.state !== 'play' || this.alive < 4) return;
    this.saucerT -= dt;
    if (this.saucerT > 0) return;
    this.saucerT = this.range(this.D.saucerGap);
    const fromLeft = this.rand() < 0.5;
    this.saucer = { id: this.nextId++, x: fromLeft ? -2 : W + 2, y: SAUCER_Y, vx: (fromLeft ? 1 : -1) * this.D.saucerV, t: 0,
      pts: SAUCER_PTS[Math.floor(this.rand() * SAUCER_PTS.length)] };
    this.ev('saucer', { x: this.saucer.x });
  };

  P.popSaucer = function (by) {
    const u = this.saucer;
    this.saucer = null;
    this.addScore(u.pts);
    this.ev('saucerPop', { x: u.x, y: u.y, pts: u.pts, by });
  };

  // ---------------------------------------------------------------- the companion (1 player)
  // The other brother pops in, does his signature move, tosses a treat, then rolls his own cannon under the fullest
  // column and fires a rainbow beam up the whole column. Every extra call is one more treat and one more beam.
  P.callBuddy = function () {
    if (this.state !== 'play' && this.state !== 'intro') return false;
    if (this.mode === '2p') return this.highFive();
    const hero = this.cannons[0];
    let B = this.buddy;
    if (!B || B.state === 'leave') {
      const side = hero.x > W / 2 ? -1 : 1;
      const x = side > 0 ? W - 1.3 : 1.3;
      B = this.buddy = { id: buddyFor(hero.id), state: 'enter', t: 0, x, vx: 0, side, pending: 0, gave: false, col: -1 };
      this.ev('buddyIn', { who: B.id, x });
    }
    B.pending++;
    return true;
  };

  P.highFive = function () {
    if (this.hi5Cd > 0) return false;
    this.hi5Cd = 15;
    this.superT = 8;
    for (const c of this.cannons) { c.pose = 'hi5'; c.poseT = 1.2; }
    const mid = (this.cannons[0].x + this.cannons[1].x) / 2;
    this.ev('highfive', { x: mid });
    return true;
  };

  P.bestColumn = function () {
    const cols = this.columns();
    if (!cols.length) return null;
    const hx = this.cannons[0].x;
    cols.sort((a, b) => b.n - a.n || a.low.y - b.low.y || Math.abs(a.x - hx) - Math.abs(b.x - hx));
    return cols[0].col;
  };

  P.updateBuddy = function (dt) {
    const B = this.buddy;
    if (!B) return;
    B.t += dt;
    const go = (s) => { B.state = s; B.t = 0; B.gave = false; };
    const rollTo = (tx, sp) => {
      const d = clamp(tx, CART_HW + 0.2, W - CART_HW - 0.2) - B.x;
      B.vx = clamp(d * 10, -sp, sp);
      B.x += B.vx * dt;
      return Math.abs(d) < 0.12;
    };
    const ended = this.state === 'clear' || this.state === 'done' || this.state === 'oops' || this.state === 'over';
    if (ended && B.state !== 'leave' && B.state !== 'bye') { B.pending = 0; go('bye'); }
    switch (B.state) {
      case 'enter': B.vx = 0; if (B.t > 0.5) go('hello'); break;
      case 'hello': if (B.t > 1.1) go('give'); break;
      case 'give': {
        B.vx = 0;
        if (!B.gave && B.t > 0.3) {
          B.gave = true;
          const [emoji, name] = TREATS[this.giftIx++ % TREATS.length];
          const hero = this.cannons[0];
          this.addScore(100);
          const heal = this.lives < this.D.lives;
          if (heal) this.lives++;
          this.ev('gift', { emoji, name, from: B.id, to: hero.id, x: B.x, tx: hero.x, heal });
        }
        if (B.t > 0.8) {
          B.col = this.bestColumn();
          go(B.col === null ? 'bye' : 'roll');
        }
        break;
      }
      case 'roll': {
        if (this.alive <= 0 || !this.columns().some((c) => c.col === B.col)) { B.col = this.bestColumn(); if (B.col === null) { B.pending = 0; go('bye'); break; } }
        if (rollTo(this.colX(B.col), 16) || B.t > 3) {
          B.pending = Math.max(0, B.pending - 1);
          this.beam = { col: B.col, x: this.colX(B.col), t: 0, by: B.id };
          if (this.sab === 'noBeam') this.beam.col = -99;
          this.ev('beam', { who: B.id, x: this.beam.x, col: B.col });
          go('beam');
        }
        break;
      }
      case 'beam':
        if (this.beam) rollTo(this.beam.x, 16);
        else if (B.pending > 0) go('give');
        else go('bye');
        break;
      case 'bye':
        B.vx = 0;
        if (B.pending > 0 && !ended) go('give');
        else if (B.t > 1.2) go('leave');
        break;
      case 'leave':
        if (B.pending > 0 && !ended) go('give');
        else if (rollTo(B.side > 0 ? W + 3 : -3, 12) || B.t > 1.5) { this.buddy = null; this.ev('buddyOut', { who: B.id }); }
        break;
    }
  };

  P.updateBeam = function (dt) {
    const b = this.beam;
    if (!b) return;
    b.t += dt;
    if (b.col >= 0) b.x = this.colX(b.col);
    for (const a of this.aliens) if (a.alive && a.col === b.col && Math.abs(a.x - b.x) < BEAM_HW) this.popAlien(a, 'beam');
    const u = this.saucer;
    if (u && Math.abs(u.x - b.x) < 1.6) this.popSaucer('beam');
    for (const k of this.sprinkles) if (Math.abs(k.x - b.x) < BEAM_HW) { k.dead = true; this.ev('sprinklePop', { x: k.x, y: k.y, by: 'beam' }); }
    this.sprinkles = this.sprinkles.filter((k) => !k.dead);
    if (b.t > 0.9) { this.beam = null; this.ev('beamEnd'); }
    if (this.state === 'play') this.checkEnd();
  };

  // ---------------------------------------------------------------- keep going (out of lives)
  // Full lives again, right where you are: popped aliens stay popped, and the march goes back up to the top.
  P.keepGoing = function () {
    this.lives = this.D.lives;
    this.fy = this.fy0;
    this.placeAliens();
    this.sprinkles.length = 0;
    this.shots.length = 0;
    this.freezeT = 1.2;
    for (const c of this.cannons) { c.pose = 'ready'; c.hitT = 0; c.inv = 2; }
    this.state = 'play';
    this.stateT = 0;
  };

  // a cheap fingerprint of everything that matters (the frame-rate check compares these)
  P.hash = function () {
    const f = (v) => v.toFixed(4);
    const parts = [this.state, this.wave, this.score, this.lives, this.alive, this.marchN, f(this.fx), f(this.fy), this.dir, this.shieldCells()];
    for (const c of this.cannons) parts.push(c.id, f(c.x), c.fired, f(c.cool));
    for (const s of this.shots) parts.push('s', f(s.x), f(s.y));
    for (const k of this.sprinkles) parts.push('k', f(k.x), f(k.y));
    if (this.saucer) parts.push('u', f(this.saucer.x));
    return parts.join('|');
  };

  // ---------------------------------------------------------------- the autopilot
  // Picks the nearest column it can reach, lines up under its lowest alien and fires; steps aside from sprinkles
  // that would land on it, and stays out from under the shields when it can (so it doesn't chip its own cover).
  // In 2 players each bot keeps to its own half. o.idle: never fires (for the checks' sabotaged run).
  function Bot(sim, p, o = {}) { this.sim = sim; this.p = p; this.o = o; }
  Bot.prototype.input = function () {
    const s = this.sim, p = this.p, D = s.D;
    if (s.state !== 'play' && s.state !== 'intro') return { ax: 0, x: null, fire: false };
    let tx = p.x, fire = false;
    const cols = s.columns();
    if (cols.length) {
      let lo = 0, hi = W;
      if (s.cannons.length === 2) {
        const left = s.cannons[0] === p;
        const mid = cols.length > 1 ? cols.reduce((m, c) => m + c.x, 0) / cols.length : W / 2;
        const mine = cols.filter((c) => (left ? c.x <= mid + 0.01 : c.x >= mid - 0.01));
        if (mine.length) { lo = Math.min(...mine.map((c) => c.x)) - 1; hi = Math.max(...mine.map((c) => c.x)) + 1; }
      }
      let best = null, bestS = Infinity;
      for (const c of cols) {
        if (c.x < lo || c.x > hi) continue;
        const lead = s.dir * STEP_DX * Math.min(1, 0.6 / s.interval());
        const x = c.x + lead * 0.5;
        const score = Math.abs(x - p.x) + (c.low.y - 2) * 0.35 - (s.alive < 6 ? 0 : c.n * 0.1);
        if (score < bestS) { bestS = score; best = { x, c }; }
      }
      if (best) {
        tx = best.x;
        fire = Math.abs(p.x - best.c.x) < 0.45;
      }
    }
    const u = s.saucer;
    if (u && cols.length > 3 && Math.abs(u.x - p.x) < 4) { const lead = u.vx * ((u.y - 2.5) / D.shotV); if (Math.abs(u.x + lead - p.x) < 0.4) fire = true; }
    // sprinkles: find a spot where nothing will land on us in time
    const danger = (x) => {
      for (const k of s.sprinkles) {
        const tLand = (k.y - HIT_TOP) / -k.vy;
        if (tLand < 0) continue;
        const tGet = Math.abs(x - p.x) / D.speed;
        if (Math.abs(k.x - x) < CART_HW + 0.55 && tLand < tGet + 0.9) return true;
      }
      return false;
    };
    if (danger(tx) || danger(p.x)) {
      let pick = null;
      for (const d of [0, 1.2, -1.2, 2.2, -2.2, 3.4, -3.4, 4.6, -4.6, 6, -6]) {
        const x = clamp(tx + d, 1.1, W - 1.1);
        if (!danger(x)) { pick = x; break; }
      }
      if (pick !== null) { tx = pick; fire = fire && Math.abs(p.x - tx) < 0.45; }
    }
    if (this.o.idle) fire = false;
    return { ax: 0, x: tx, fire };
  };

  // ---------------------------------------------------------------- the fixed-step runner
  // The screen's frames come at any rate; the rules always move in steps of DT. Leftover time waits for the next
  // frame. After a long stall (a hidden tab) the backlog is dropped instead of fast-forwarding.
  // o.rawDt (sabotage): step by the frame's own dt instead.
  function Runner(sim, o = {}) { this.sim = sim; this.acc = 0; this.steps = 0; this.o = o; }
  Runner.prototype.advance = function (frameDt, inputFn) {
    if (this.o.rawDt) { this.sim.step(frameDt, inputFn ? inputFn(this.sim) : {}); this.steps++; return 1; }
    this.acc += frameDt;
    let n = 0;
    while (this.acc >= DT - 1e-9 && n < 8) {
      this.sim.step(DT, inputFn ? inputFn(this.sim) : {});
      this.acc -= DT;
      n++;
      this.steps++;
    }
    if (this.acc > DT) this.acc = 0;
    return n;
  };

  Object.assign(SD, {
    DT, W, H, MUZZLE_Y, CART_HW, HIT_TOP, LAND_Y, COL_DX, ROW_DY, TOP_ROW_Y, SAUCER_Y, ALIEN_HW, ALIEN_HH, EDGE, STEP_DX,
    CELL, SH_COLS, SH_ROWS, SH_Y, SHIELD_X, SH_MASK, BEAM_HW, PTS, TREATS, DIFF, WAVES, Sim, Bot, Runner, mulberry, clamp,
  });
})(typeof window !== 'undefined' ? window : globalThis);
