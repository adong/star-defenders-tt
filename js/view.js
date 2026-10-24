/* TT Star Defenders: the Three.js scene. A fixed arcade camera looks straight at the field (y up, the kids' carts on
   the floor). Builds the backdrop, the toy-cube pillars and the launch pad once; the jellies for each wave (each one a
   single merged mesh with vertex colours, plus two googly pupils); a cart, a kid and a star cannon for every brother;
   the squishy shields (one instanced mesh each); the cake saucer, star-pops, sprinkles and the rainbow beam; and the
   effects (popped jellies float off in bubbles, crumbs, confetti, floating scores). Exposes SD.View. Rules: js/sim.js. */
(function () {
  'use strict';
  const T = THREE, G = Kit.gfx, SD = window.SD, A = SD.art;
  const { W, H, SH_COLS, SH_ROWS, CELL, SH_Y, SHIELD_X, MUZZLE_Y } = SD;
  const KID_S = 0.8;                 // the kids' size on their carts
  const DECK_Y = 0.34;               // the top of a cart's deck
  const GUN_UP = 2.1;                // the star cannon's drum, held over his head
  const BOX = { x0: -1.6, x1: W + 1.6, y0: -0.9, y1: H + 0.5 }; // what the camera frames
  const SIG_T = 2.4;                 // Teddy switches between boxing and the jump shot this often

  const v3 = (x, y, z) => new T.Vector3(x, y, z);
  const M = (x, y, z, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0) =>
    new T.Matrix4().compose(v3(x, y, z), new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), v3(sx, sy, sz));

  // one geometry with vertex colours from several simple parts (one draw call per jelly)
  function merge(parts) {
    const list = [];
    let n = 0;
    for (const p of parts) {
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
      g.applyMatrix4(p.m);
      list.push([g, new T.Color(p.color)]);
      n += g.attributes.position.count;
    }
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3);
    let o = 0;
    for (const [g, c] of list) {
      const cnt = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3);
      nor.set(g.attributes.normal.array, o * 3);
      for (let i = 0; i < cnt; i++) { col[(o + i) * 3] = c.r; col[(o + i) * 3 + 1] = c.g; col[(o + i) * 3 + 2] = c.b; }
      o += cnt;
      g.dispose();
    }
    const out = new T.BufferGeometry();
    out.setAttribute('position', new T.BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.BufferAttribute(nor, 3));
    out.setAttribute('color', new T.BufferAttribute(col, 3));
    out.computeBoundingSphere();
    return out;
  }

  // ---------------------------------------------------------------- the jellies
  const GEO = {};
  const geo = (k, make) => GEO[k] || (GEO[k] = make());
  const EYE = { a: [0.21, 0.12, 0.45], b: [0.22, 0.1, 0.52], c: [0.22, 0.16, 0.5] };

  function jellyGeometry(type, color) {
    return geo('jelly' + type + color, () => {
      const dark = G.shade(color, -0.28), light = G.shade(color, 0.35);
      const sphere = geo('sph', () => new T.SphereGeometry(1, 22, 16));
      const parts = [];
      const add = (g, c, m) => parts.push({ geo: g, color: c, m });
      const [ex, ey, ez] = EYE[type];
      if (type === 'a') {
        add(sphere, color, M(0, -0.02, 0, 0.66, 0.55, 0.52));
        add(sphere, dark, M(-0.3, -0.5, 0.05, 0.2, 0.12, 0.18));
        add(sphere, dark, M(0.3, -0.5, 0.05, 0.2, 0.12, 0.18));
        add(sphere, light, M(0, 0.55, 0, 0.11));
      } else if (type === 'b') {
        const prof = [[0, -0.5], [0.6, -0.5], [0.66, -0.4], [0.6, -0.24], [0.65, -0.08], [0.57, 0.1], [0.59, 0.24], [0.43, 0.42], [0.22, 0.52], [0, 0.55]];
        add(new T.LatheGeometry(prof.map(([r, y]) => new T.Vector2(r, y)), 22), color, M(0, 0, 0, 1, 1, 0.85));
        add(new T.CylinderGeometry(0.035, 0.035, 0.36, 6), dark, M(0, 0.7, 0));
        add(sphere, '#ffe14a', M(0, 0.9, 0, 0.12));
      } else {
        add(new T.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), color, M(0, -0.12, 0, 0.68, 0.64, 0.56));
        add(new T.TorusGeometry(0.66, 0.09, 8, 24), light, M(0, -0.12, 0, 1.02, 0.85, 1, Math.PI / 2, 0, 0));
        for (let i = 0; i < 4; i++) {
          const x = -0.39 + i * 0.26;
          add(new T.CapsuleGeometry(0.075, 0.24, 4, 8), dark, M(x, -0.42, 0.04, 1, 1, 1, 0, 0, (i % 2 ? 0.25 : -0.25)));
        }
      }
      // googly eye whites, a smile and pink cheeks
      add(sphere, '#ffffff', M(-ex, ey, ez, 0.21, 0.23, 0.12));
      add(sphere, '#ffffff', M(ex, ey, ez, 0.21, 0.23, 0.12));
      add(new T.TorusGeometry(0.12, 0.035, 6, 14, Math.PI), '#3a1036', M(0, ey - 0.27, ez + 0.06, 1, 1, 1, 0, 0, Math.PI));
      add(sphere, '#ff8fb1', M(-ex - 0.17, ey - 0.2, ez - 0.02, 0.09, 0.06, 0.04));
      add(sphere, '#ff8fb1', M(ex + 0.17, ey - 0.2, ez - 0.02, 0.09, 0.06, 0.04));
      return merge(parts);
    });
  }
  let jellyMat = null, pupilMat = null, pupilGeo = null;

  function View(canvas) {
    const r = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.outputEncoding = T.sRGBEncoding;
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.shadowMap.enabled = true;
    r.shadowMap.type = T.PCFSoftShadowMap;
    this.renderer = r;
    this.canvas = canvas;
    this.scene = new T.Scene();
    this.scene.background = new T.Color('#1d1b52');
    this.camera = new T.PerspectiveCamera(22, 1, 1, 600);
    this.scene.add(new T.HemisphereLight('#ffffff', '#6a5a9a', 1.0));
    const sun = new T.DirectionalLight('#fff4e2', 1.0);
    sun.position.set(W / 2 - 9, H + 12, 24);
    sun.target.position.set(W / 2, H / 2, -1);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 22, bottom: -22, near: 1, far: 90 });
    sun.shadow.bias = -0.001;
    this.scene.add(sun, sun.target);
    jellyMat = jellyMat || new T.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.15 });
    pupilMat = pupilMat || new T.MeshStandardMaterial({ color: '#14121f', roughness: 0.2 });
    pupilGeo = pupilGeo || new T.SphereGeometry(0.1, 12, 10);
    this.margins = { top: 64, bottom: 8, left: 8, right: 8 };
    this.size = [0, 0];
    this.shake = 0;
    this.t = 0;
    this.actors = new Map();
    this.jellies = new Map();
    this.floaters = [];
    this.fx = [];
    this.m4 = new T.Matrix4();
    this.col = new T.Color();
    this.buildStage();
  }

  // ---------------------------------------------------------------- the stage (built once)
  View.prototype.buildStage = function () {
    const g = new T.Group();
    const sky = A.backdrop();
    const back = new T.Mesh(new T.PlaneGeometry(100, 100), new T.MeshLambertMaterial({ map: sky, emissive: '#ffffff', emissiveMap: sky, emissiveIntensity: 0.6 }));
    back.position.set(W / 2, H / 2 + 2, -2.4); // the picture's middle band lands where the old 100 x 62 one did
    back.receiveShadow = true;
    g.add(back);
    // toy-cube pillars down both sides
    const cells = [];
    for (let y = 0; y < H + 1; y++) { cells.push([-0.6, y + 0.5]); cells.push([W + 0.6, y + 0.5]); }
    const cols = ['#ff7ab8', '#ffd23f', '#4fd8ff', '#8cff6b', '#c38bff'];
    const pillar = new T.InstancedMesh(new T.BoxGeometry(1.0, 0.96, 1.4), new T.MeshStandardMaterial({ roughness: 0.45 }), cells.length);
    cells.forEach(([x, y], i) => {
      this.m4.makeTranslation(x, y, 0);
      pillar.setMatrixAt(i, this.m4);
      pillar.setColorAt(i, this.col.set(cols[(Math.floor(y) + (x < 0 ? 0 : 2)) % cols.length]));
    });
    pillar.castShadow = pillar.receiveShadow = true;
    g.add(pillar);
    // the launch pad
    const ft = A.floorTexture().clone();
    ft.needsUpdate = true;
    ft.repeat.set((W + 70) / 4, 1);
    const floor = new T.Mesh(new T.BoxGeometry(W + 70, 1, 4), new T.MeshStandardMaterial({ map: ft, roughness: 0.75 }));
    floor.position.set(W / 2, -0.5, 0.2);
    floor.receiveShadow = true;
    g.add(floor);
    const under = new T.Mesh(new T.PlaneGeometry(W + 70, 30), new T.MeshBasicMaterial({ color: '#2a2152' }));
    under.position.set(W / 2, -16, 2.3);
    g.add(under);
    // the four shields
    this.shieldMeshes = SHIELD_X.map((x, si) => {
      const n = SH_COLS * SH_ROWS;
      const m = new T.InstancedMesh(new T.BoxGeometry(CELL * 1.02, CELL * 1.02, 0.9), new T.MeshStandardMaterial({ roughness: 0.85 }), n);
      m.instanceMatrix.setUsage(T.DynamicDrawUsage);
      const tints = [['#ffc2dc', '#ffd6e6', '#fff0f5'], ['#ffd9b0', '#ffe6c9', '#fff5e8'], ['#d9c8ff', '#e6dbff', '#f5f0ff'], ['#bff0e0', '#d6f7ec', '#effcf7']][si];
      for (let j = 0; j < SH_ROWS; j++) for (let i = 0; i < SH_COLS; i++) m.setColorAt(j * SH_COLS + i, this.col.set(tints[(i + j) % 3]));
      m.castShadow = m.receiveShadow = true;
      m.position.set(x, 0, 0);
      g.add(m);
      return { m, x, wob: 0, cells: null };
    });
    // the rainbow beam
    const bt = A.beamTexture();
    this.beam = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: bt, transparent: true, depthWrite: false, blending: T.AdditiveBlending }));
    this.beam.renderOrder = 3;
    this.beam.visible = false;
    g.add(this.beam);
    this.beamTex = bt;
    this.stage = g;
    this.scene.add(g);
    this.saucer = this.makeSaucer();
    this.saucer.root.visible = false;
    this.scene.add(this.saucer.root);
  };

  // A new game (or the title demo): forget the old one's models.
  View.prototype.setGame = function (sim) {
    for (const v of this.actors.values()) this.drop(v);
    this.actors.clear();
    this.clearJellies();
    for (const f of this.fx) { this.scene.remove(f.obj); f.obj.material.dispose(); }
    this.fx = [];
    this.sim = sim;
    this.buildJellies(sim);
    this.fit(true);
  };

  View.prototype.clearJellies = function () {
    for (const v of this.jellies.values()) this.scene.remove(v.root);
    this.jellies.clear();
    for (const f of this.floaters) this.scene.remove(f.v.root);
    this.floaters = [];
  };

  View.prototype.buildJellies = function (sim) {
    for (const v of this.jellies.values()) this.scene.remove(v.root);
    this.jellies.clear();
    const pal = A.PALETTES[sim.wave % A.PALETTES.length];
    for (const a of sim.aliens) {
      const root = new T.Group();
      const body = new T.Mesh(jellyGeometry(a.type, pal[a.type]), jellyMat);
      body.castShadow = true;
      root.add(body);
      const [ex, ey, ez] = EYE[a.type];
      const pupils = [-1, 1].map((s) => {
        const p = new T.Mesh(pupilGeo, pupilMat);
        p.scale.set(1, 1, 0.5);
        p.position.set(s * ex, ey, ez + 0.1);
        root.add(p);
        return { p, x0: s * ex, y0: ey, ox: 0, oy: 0, vx: 0, vy: 0 };
      });
      root.position.set(a.x, a.y, 0);
      this.scene.add(root);
      this.jellies.set(a.id, { a, root, body, pupils, ph: Math.random() * 6, hop: 0, x: a.x, y: a.y, row: a.row });
    }
    this.waveKey = sim.wave;
  };

  // ---------------------------------------------------------------- the carts
  function sprite(map, w, h, o) {
    const s = new T.Sprite(new T.SpriteMaterial(Object.assign({ map, transparent: true, depthWrite: false }, o)));
    s.scale.set(w, h || w, 1);
    return s;
  }

  View.prototype.makeCart = function (id, buddy) {
    const tint = A.TINT[id];
    const root = new T.Group(), body = new T.Group();
    root.add(body);
    const mat = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.45 }, o));
    const deck = new T.Mesh(new T.BoxGeometry(1.7, 0.16, 0.8), mat(tint));
    deck.position.y = DECK_Y - 0.08;
    const trim = new T.Mesh(new T.BoxGeometry(1.78, 0.07, 0.86), mat('#ffd23f'));
    trim.position.y = DECK_Y - 0.17;
    body.add(deck, trim);
    const wheels = [];
    const wg = new T.CylinderGeometry(0.15, 0.15, 0.12, 18), wm = mat('#2a2540', { roughness: 0.6 }), hm = mat('#ffffff');
    for (const x of [-0.55, 0.55]) for (const z of [0.4, -0.4]) {
      const w = new T.Group();
      const tyre = new T.Mesh(wg, wm);
      tyre.rotation.x = Math.PI / 2;
      const hub = new T.Mesh(new T.BoxGeometry(0.14, 0.05, 0.13), hm);
      w.add(tyre, hub);
      w.position.set(x, 0.15, z);
      body.add(w);
      wheels.push(w);
    }
    // the kid
    const entry = Kit.roster.get(id);
    const p = Kit.people.build(entry.look);
    p.root.scale.setScalar(KID_S);
    p.root.rotation.y = Math.PI;
    const kid = new T.Group();
    kid.position.y = DECK_Y;
    kid.add(p.root);
    body.add(kid);
    // the star cannon: a drum he holds, a fat barrel with stripes, a star on the end
    const gun = new T.Group();
    const drum = new T.Mesh(new T.CylinderGeometry(0.3, 0.3, 0.3, 20), mat(G.shade(tint, -0.25)));
    const barrel = new T.Group();
    const tube = new T.Mesh(new T.CylinderGeometry(0.22, 0.3, 0.75, 20), mat(tint, { roughness: 0.35 }));
    tube.position.y = 0.375;
    barrel.add(tube);
    for (const y of [0.15, 0.6]) {
      const ring = new T.Mesh(new T.TorusGeometry(y < 0.3 ? 0.29 : 0.24, 0.05, 8, 20), mat('#ffd23f'));
      ring.rotation.x = Math.PI / 2;
      ring.position.y = y;
      barrel.add(ring);
    }
    barrel.position.y = 0.12;
    const tip = sprite(A.starTexture(A.LIGHT[id]), 0.62);
    tip.position.y = 0.98;
    gun.add(drum, barrel, tip);
    body.add(gun);
    root.traverse((n) => { if (n.isMesh) n.castShadow = true; });
    const flash = sprite(A.flameTexture(), 0.9, 0.9, { blending: T.AdditiveBlending });
    flash.visible = false;
    body.add(flash);
    const dizzy = sprite(A.dizzyTexture(), 1.3, 0.33);
    dizzy.visible = false;
    body.add(dizzy);
    let tag = null;
    if (buddy) {
      tag = G.nameTag(entry.name, entry.tag);
      tag.scale.multiplyScalar(0.75);
      body.add(tag);
    }
    this.scene.add(root);
    return { root, body, kid, p, gun, barrel, tip, wheels, flash, dizzy, tag, entry, ph: 0, roll: 0, recoil: 0, gunY: GUN_UP, gunZ: 0, celebT: 0, ballT: 0, yaw: Math.PI, pop: buddy ? 0 : 1 };
  };

  View.prototype.get = function (key, make) {
    let v = this.actors.get(key);
    if (!v) { v = make(); this.actors.set(key, v); }
    v.seen = true;
    return v;
  };

  View.prototype.drop = function (v) {
    this.scene.remove(v.root);
    disposeTree(v.root);
  };

  function disposeTree(o) {
    o.traverse((n) => {
      if (n.geometry && !n.isSprite && !n.userData.shared) n.geometry.dispose();
      if (n.material) (Array.isArray(n.material) ? n.material : [n.material]).forEach((mt) => { if (mt !== jellyMat && mt !== pupilMat) mt.dispose(); });
    });
  }

  // ---------------------------------------------------------------- the cake saucer
  View.prototype.makeSaucer = function () {
    const root = new T.Group(), cake = new T.Group();
    root.add(cake);
    const mat = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.5 }, o));
    const add = (g, m, x, y, z) => { const o = new T.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; cake.add(o); return o; };
    add(new T.CylinderGeometry(1.15, 1.22, 0.36, 28), mat('#ff8fc8'), 0, 0, 0);
    const rim = add(new T.TorusGeometry(1.2, 0.1, 8, 28), mat('#ffffff'), 0, 0.17, 0);
    rim.rotation.x = Math.PI / 2;
    add(new T.CylinderGeometry(0.82, 0.88, 0.32, 28), mat('#fff1d6'), 0, 0.34, 0);
    const drip = add(new T.TorusGeometry(0.84, 0.07, 8, 28), mat('#ff6fae'), 0, 0.5, 0);
    drip.rotation.x = Math.PI / 2;
    add(new T.SphereGeometry(0.14, 14, 10), mat('#ff3355', { roughness: 0.2 }), 0, 0.62, 0);
    const flames = [];
    [-0.45, 0, 0.45].forEach((x, i) => {
      add(new T.CylinderGeometry(0.05, 0.05, 0.32, 8), mat(['#4fd8ff', '#ffd23f', '#8cff6b'][i]), x, 0.66, i === 1 ? -0.35 : 0.1);
      const f = sprite(A.flameTexture(), 0.32, 0.45, { blending: T.AdditiveBlending });
      f.position.set(x, 0.92, i === 1 ? -0.35 : 0.1);
      cake.add(f);
      flames.push(f);
    });
    // saucer lights round the bottom
    const lights = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const l = add(new T.SphereGeometry(0.08, 8, 6), new T.MeshStandardMaterial({ color: '#ffffff', emissive: '#ffe14a', emissiveIntensity: 1 }), Math.cos(a) * 1.18, -0.16, Math.sin(a) * 1.18);
      lights.push(l);
    }
    cake.rotation.x = 0.38;
    return { root, cake, flames, lights };
  };

  // ---------------------------------------------------------------- every frame
  View.prototype.update = function (sim, dt) {
    this.t += dt;
    this.sim = sim;
    if (this.waveKey !== sim.wave) this.buildJellies(sim);
    for (const v of this.actors.values()) v.seen = false;
    this.syncJellies(sim, dt);
    this.syncShields(sim, dt);
    for (const c of sim.cannons) this.syncCart(this.get('cart' + c.id, () => this.makeCart(c.id, false)), c, sim, dt);
    if (sim.buddy) this.syncBuddy(this.get('buddy' + sim.buddy.id, () => this.makeCart(sim.buddy.id, true)), sim.buddy, sim, dt);
    for (const s of sim.shots) this.syncShot(this.get(s, () => this.makeShot(s)), s, dt);
    for (const k of sim.sprinkles) this.syncSprinkle(this.get(k, () => this.makeSprinkle(k)), k, dt);
    for (const [key, v] of this.actors) if (!v.seen) { this.drop(v); this.actors.delete(key); }
    this.syncSaucer(sim, dt);
    this.syncBeam(sim, dt);
    this.stepFloaters(dt);
    this.stepFx(dt);
    this.fit();
    const sh = this.shake > 0 ? (this.shake = Math.max(0, this.shake - dt)) * 0.6 : 0;
    this.camera.position.set(this.camX + (sh ? (Math.random() - 0.5) * sh : 0), this.camY + (sh ? (Math.random() - 0.5) * sh : 0), this.dist);
  };

  const easeOutBack = (k) => { const c = 1.6; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };

  View.prototype.syncJellies = function (sim, dt) {
    const intro = sim.state === 'intro';
    const hero = sim.cannons[0];
    for (const v of this.jellies.values()) {
      const a = v.a;
      if (!a.alive) { if (!v.popped) v.root.visible = false; continue; }
      // a little delay by row, so the march ripples down the formation
      const rate = 26 - v.row * 3.5;
      v.x += (a.x - v.x) * Math.min(1, dt * rate);
      v.y += (a.y - v.y) * Math.min(1, dt * rate);
      v.hop = Math.max(0, v.hop - dt * 6);
      let y = v.y + Math.sin(v.hop * Math.PI) * 0.16, vis = true;
      if (intro) {
        const k = Math.max(0, Math.min(1, (sim.stateT - v.row * 0.12) / 0.8));
        y += (1 - easeOutBack(k)) * 14;
        vis = k > 0;
      }
      v.root.visible = vis;
      v.root.position.set(v.x, y, 0);
      // squash and stretch, and a gentle jiggle
      const sq = Math.sin(v.hop * Math.PI) * 0.12;
      const jig = Math.sin(this.t * 5 + v.ph) * 0.03;
      v.root.scale.set(1 + sq * 0.6 + jig, 1 - sq + -jig * 0.7, 1);
      v.root.rotation.z = Math.sin(this.t * 2.2 + v.ph) * 0.07;
      // googly pupils: look at the kid, wobble on springs
      const dx = (hero ? hero.x : W / 2) - v.x, dy = 1 - v.y, d = Math.hypot(dx, dy) || 1;
      for (const e of v.pupils) {
        const tx = (dx / d) * 0.07, ty = (dy / d) * 0.07;
        e.vx += ((tx - e.ox) * 120 - e.vx * 9) * dt;
        e.vy += ((ty - e.oy) * 120 - e.vy * 9) * dt;
        e.ox += e.vx * dt;
        e.oy += e.vy * dt;
        e.p.position.x = e.x0 + e.ox;
        e.p.position.y = e.y0 + e.oy;
      }
    }
  };

  View.prototype.syncShields = function (sim, dt) {
    sim.shields.forEach((s, si) => {
      const v = this.shieldMeshes[si];
      let dirty = !v.cells || v.sim !== sim;
      if (!dirty) for (let i = 0; i < s.cells.length; i++) if (s.cells[i] !== v.cells[i]) { dirty = true; break; }
      v.wob = Math.max(0, v.wob - dt * 3);
      const breathe = 1 + Math.sin(this.t * 2 + si) * 0.015 + Math.sin(v.wob * 18) * v.wob * 0.08;
      v.m.scale.set(1 + (1 - breathe) * 0.5, breathe, 1);
      v.m.position.y = SH_Y * (1 - breathe); // squash toward the floor, not the middle
      if (!dirty) return;
      if (v.cells && v.sim === sim) v.wob = 1;
      v.cells = Uint8Array.from(s.cells);
      v.sim = sim;
      for (let j = 0; j < SH_ROWS; j++) for (let i = 0; i < SH_COLS; i++) {
        const k = j * SH_COLS + i;
        const x = -(SH_COLS * CELL) / 2 + (i + 0.5) * CELL, y = SH_Y + (j + 0.5) * CELL;
        if (s.cells[k]) this.m4.makeTranslation(x, y, 0); else this.m4.makeScale(0, 0, 0);
        v.m.setMatrixAt(k, this.m4);
      }
      v.m.instanceMatrix.needsUpdate = true;
    });
  };

  View.prototype.syncCart = function (v, c, sim, dt) {
    const k = 1 - Math.exp(-16 * dt);
    v.root.position.set(c.x, 0, 0.3);
    v.roll += c.vx * dt / 0.15;
    for (const w of v.wheels) w.rotation.z = -v.roll;
    let mode = 'carry', lift = 0;
    const moving = Math.abs(c.vx) > 1;
    if (c.pose === 'celebrate' || c.pose === 'hi5' || sim.state === 'done') {
      v.celebT += dt;
      const sig = v.entry.signature || ['wave'];
      mode = c.pose === 'hi5' ? 'cheer' : sig[Math.floor(v.celebT / SIG_T) % sig.length];
    } else v.celebT = 0;
    if (c.pose === 'oops' || c.hitT > 0) mode = 'oops';
    lift = this.signatureLift(v, mode, c.x, dt);
    v.ph += dt * (moving ? 10 : mode === 'boxing' ? 7.5 : 5);
    SD.pose(v.p, v.ph, mode, k, { moving: moving && mode === 'carry' });
    v.kid.position.y = DECK_Y + lift;
    this.syncGun(v, mode === 'carry', dt);
    v.yaw += (Math.PI + Math.max(-0.4, Math.min(0.4, -c.vx * 0.03)) - v.yaw) * Math.min(1, dt * 10);
    v.p.root.rotation.y = v.yaw;
    // blinking while safe after a sprinkle; dizzy stars while sprinkled
    v.body.visible = !(c.inv > 0 && c.hitT <= 0 && Math.floor(this.t * 12) % 2 === 0);
    v.dizzy.visible = c.hitT > 0;
    if (v.dizzy.visible) { v.dizzy.position.set(0, DECK_Y + 1.9, 0.4); v.dizzy.material.rotation = Math.sin(this.t * 8) * 0.2; v.dizzy.position.x = Math.sin(this.t * 7) * 0.12; }
  };

  // the jump shot needs a hop and a ball
  View.prototype.signatureLift = function (v, mode, x, dt) {
    if (mode === 'jumpshot') {
      const c = (this.t * 1.1) % 1;
      v.ballT -= dt;
      if (c > 0.3 && v.ballT <= 0) { v.ballT = 0.85; this.emojiFly('🏀', x + 0.2, 1.8, x + (x < W / 2 ? 3 : -3), 7, 0.9, 1.6); }
      return Math.sin(Math.min(1, c / 0.6) * Math.PI) * 0.45;
    }
    if (mode === 'peace' || mode === 'cheer') return Math.abs(Math.sin(this.t * 4)) * 0.2;
    return 0;
  };

  // over his head while he plays; down on the deck behind him while he celebrates or says hello
  View.prototype.syncGun = function (v, up, dt) {
    const e = Math.min(1, dt * 10);
    v.gunY += ((up ? GUN_UP + v.kid.position.y - DECK_Y : DECK_Y + 0.15) - v.gunY) * e;
    v.gunZ += ((up ? 0 : -0.55) - v.gunZ) * e;
    v.recoil = Math.max(0, v.recoil - dt * 7);
    v.gun.position.set(0, v.gunY - v.recoil * 0.12, v.gunZ);
    v.barrel.scale.set(1 + v.recoil * 0.15, 1 - v.recoil * 0.22, 1 + v.recoil * 0.15);
    v.tip.material.rotation += dt * 1.5;
    v.flash.visible = v.recoil > 0.55;
    v.flash.position.set(0, v.gunY + 1.05, 0.2);
  };

  View.prototype.syncBuddy = function (v, B, sim, dt) {
    const k = 1 - Math.exp(-16 * dt);
    const st = B.state;
    let mode = 'carry';
    if (st === 'enter' || st === 'hello') mode = Kit.roster.signature(v.entry, 'hello');
    else if (st === 'bye' || st === 'leave') mode = Kit.roster.signature(v.entry, 'goodbye');
    else if (st === 'give') mode = 'give';
    const lift = this.signatureLift(v, mode, B.x, dt);
    v.ph += dt * (mode === 'boxing' ? 7.5 : 6);
    SD.pose(v.p, v.ph, mode, k, { moving: Math.abs(B.vx) > 1 && mode === 'carry' });
    v.kid.position.y = DECK_Y + lift;
    this.syncGun(v, mode === 'carry', dt);
    v.roll += B.vx * dt / 0.15;
    for (const w of v.wheels) w.rotation.z = -v.roll;
    // pops in with a bounce, at his buddy size
    const scale = v.entry.buddyScale || 0.8;
    v.pop += ((st === 'leave' ? 0.6 : 1) - v.pop) * Math.min(1, dt * 7);
    const s = scale * v.pop * (1 + (st === 'enter' ? Math.sin(Math.min(1, B.t * 2) * Math.PI) * 0.2 : 0));
    v.root.scale.setScalar(Math.max(0.001, s));
    v.root.position.set(B.x, 0, 1.0);
    v.yaw += (Math.PI + Math.max(-0.4, Math.min(0.4, -B.vx * 0.03)) - v.yaw) * Math.min(1, dt * 10);
    v.p.root.rotation.y = v.yaw;
    v.tag.position.set(0, (mode === 'carry' ? GUN_UP + 1.35 : DECK_Y + 2.1) + lift, 0.3);
  };

  View.prototype.makeShot = function (s) {
    const root = sprite(A.starTexture(s.super ? '#ff9ad5' : A.LIGHT[s.by] || '#ffffff'), s.super ? 0.85 : 0.7);
    this.scene.add(root);
    return { root, trail: 0 };
  };
  View.prototype.syncShot = function (v, s, dt) {
    v.root.position.set(s.x, s.y, 0.5);
    v.root.material.rotation += dt * 9;
    v.trail -= dt;
    if (v.trail <= 0) {
      v.trail = 0.035;
      this.particle({ x: s.x + (Math.random() - 0.5) * 0.15, y: s.y - 0.3, vy: -1, life: 0.3, size: 0.22, color: s.super ? '#ff9ad5' : '#fff3a0', add: true, z: 0.4 });
    }
  };

  View.prototype.makeSprinkle = function (k) {
    const root = new T.Group();
    const col = A.SPRINKLE[k.kind % A.SPRINKLE.length];
    const m = new T.Mesh(geo('sprinkle', () => new T.CapsuleGeometry(0.12, 0.42, 4, 10)), new T.MeshStandardMaterial({ color: col, roughness: 0.3, emissive: col, emissiveIntensity: 0.25 }));
    m.userData.shared = true;
    m.castShadow = true;
    const glow = sprite(G.glowTexture(), 1.1, 1.1, { color: col, opacity: 0.55, blending: T.AdditiveBlending });
    root.add(glow, m);
    this.scene.add(root);
    return { root, m };
  };
  View.prototype.syncSprinkle = function (v, k) {
    v.root.position.set(k.x, k.y, 0.4);
    v.m.rotation.z = k.spin;
    v.m.rotation.x = k.spin * 0.6;
  };

  View.prototype.syncSaucer = function (sim, dt) {
    const u = sim.saucer, s = this.saucer;
    s.root.visible = !!u;
    if (!u) return;
    s.root.position.set(u.x, u.y + Math.sin(u.t * 3) * 0.15, 0);
    s.cake.rotation.y += dt * 1.2;
    s.cake.rotation.z = Math.sin(u.t * 2) * 0.08;
    s.lights.forEach((l, i) => { l.material.emissiveIntensity = (Math.floor(u.t * 6) + i) % 2 ? 1.4 : 0.2; });
    s.flames.forEach((f, i) => f.scale.set(0.32 + Math.sin(this.t * 20 + i) * 0.04, 0.45 + Math.sin(this.t * 17 + i * 2) * 0.08, 1));
  };

  View.prototype.syncBeam = function (sim, dt) {
    const b = sim.beam;
    this.beam.visible = !!b;
    if (!b) return;
    const y0 = 2.2, y1 = H + 1;
    const grow = Math.min(1, b.t / 0.12), fade = Math.min(1, (0.9 - b.t) / 0.2);
    this.beam.scale.set(1.6 * (0.8 + 0.2 * Math.sin(this.t * 40)) * grow, (y1 - y0) * grow, 1);
    this.beam.position.set(b.x, y0 + ((y1 - y0) * grow) / 2, 0.6);
    this.beam.material.opacity = Math.max(0, fade);
    this.beamTex.offset.y -= dt * 2;
    if (Math.random() < dt * 40) this.particle({ x: b.x + (Math.random() - 0.5) * 1.2, y: y0 + Math.random() * (y1 - y0) * grow, vy: 2, life: 0.4, size: 0.35, map: G.emojiTexture('✨'), z: 0.8 });
  };

  // ---------------------------------------------------------------- popped jellies float away in bubbles
  View.prototype.popJelly = function (id, by) {
    const v = this.jellies.get(id);
    if (!v || v.popped) return;
    v.popped = true;
    v.root.visible = true;
    const bubble = sprite(A.bubbleTexture(), 1.9);
    bubble.position.z = 0.6;
    v.root.add(bubble);
    v.bubble = bubble;
    v.root.scale.set(0.85, 0.85, 1);
    for (const e of v.pupils) { e.vx += (Math.random() - 0.5) * 6; e.vy += 4; }
    this.floaters.push({ v, t: 0, ph: Math.random() * 6, beam: by === 'beam' });
  };

  View.prototype.stepFloaters = function (dt) {
    for (const f of this.floaters) {
      f.t += dt;
      const v = f.v, r = v.root;
      r.position.y += (1.4 + f.t * 1.6) * dt;
      r.position.x += Math.sin(f.t * 3 + f.ph) * 0.7 * dt;
      r.rotation.z = Math.sin(f.t * 2.5 + f.ph) * 0.25;
      v.bubble.material.rotation = -r.rotation.z;
      for (const e of v.pupils) {
        e.vx += (-e.ox * 60 - e.vx * 4) * dt;
        e.vy += (-e.oy * 60 - e.vy * 4) * dt;
        e.ox += e.vx * dt;
        e.oy += e.vy * dt;
        e.p.position.x = e.x0 + e.ox;
        e.p.position.y = e.y0 + e.oy;
      }
      if (f.t > 1.6) {
        const k = Math.max(0, 1 - (f.t - 1.6) / 0.25);
        r.scale.setScalar(0.85 * k + 0.001);
      }
      if (f.t > 1.85 && !f.done) {
        f.done = true;
        this.scene.remove(r);
        r.remove(v.bubble);
        v.bubble.material.dispose();
        this.burst(r.position.x, r.position.y, '#d8f6ff', 8, 3, 0.2, { grav: 0 });
      }
    }
    this.floaters = this.floaters.filter((f) => !f.done);
  };

  // ---------------------------------------------------------------- effects
  View.prototype.particle = function (o) {
    const map = o.map || G.dotTexture();
    const s = sprite(map, o.size || 0.3, o.size || 0.3, { color: o.color || '#ffffff', blending: o.add ? T.AdditiveBlending : T.NormalBlending });
    s.position.set(o.x, o.y, o.z ?? 1.2);
    this.scene.add(s);
    this.fx.push({ obj: s, vx: o.vx || 0, vy: o.vy || 0, life: o.life || 0.6, max: o.life || 0.6, size: o.size || 0.3,
      grow: o.grow || 0, grav: o.grav || 0, spin: o.spin || 0, fade: o.fade ?? true, path: o.path, sx: o.sx, sy: o.sy, done: o.done });
  };

  View.prototype.stepFx = function (dt) {
    for (const f of this.fx) {
      f.life -= dt;
      const s = f.obj, a = Math.max(0, f.life / f.max);
      if (f.path) {
        const u = 1 - a, P = f.path;
        s.position.x = P.x0 + (P.x1 - P.x0) * u;
        s.position.y = P.y0 + (P.y1 - P.y0) * u + Math.sin(u * Math.PI) * P.arc;
        s.material.rotation += dt * 8;
      } else {
        f.vy -= f.grav * dt;
        s.position.x += f.vx * dt;
        s.position.y += f.vy * dt;
        s.material.rotation += f.spin * dt;
      }
      const sz = Math.max(0.01, f.size * (1 + f.grow * (1 - a)));
      s.scale.set(sz * (f.sx || 1), sz * (f.sy || 1), 1);
      if (f.fade) s.material.opacity = Math.min(1, a * 2.2);
      if (f.life <= 0) {
        this.scene.remove(s);
        s.material.dispose();
        if (f.done) f.done();
      }
    }
    this.fx = this.fx.filter((f) => f.life > 0);
    if (this.fx.length > 500) { for (const f of this.fx.splice(0, this.fx.length - 500)) { this.scene.remove(f.obj); f.obj.material.dispose(); } }
  };

  View.prototype.burst = function (x, y, color, n, speed, size, o = {}) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const sp = speed * (0.5 + Math.random() * 0.7);
      this.particle(Object.assign({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp + (o.up || 0), life: 0.45 + Math.random() * 0.25, size: size || 0.28, color, grav: o.grav ?? 4 }, o.p));
    }
  };

  // floating text ("+30", "BURP!") that rises and fades
  View.prototype.popup = function (text, x, y, color, big) {
    const s = sprite(A.textTexture(Kit.lang.t(text), color || '#ffffff'), 1, 1);
    s.position.set(x, y, 1.6);
    this.scene.add(s);
    const w = big ? 6 : 2.6;
    this.fx.push({ obj: s, vx: 0, vy: big ? 1 : 1.6, life: big ? 1.3 : 0.8, max: big ? 1.3 : 0.8, size: w, grow: 0.12, grav: 0, spin: 0, fade: true, sx: 1, sy: 0.25 });
  };

  View.prototype.emojiFly = function (emoji, x0, y0, x1, y1, time, arc, done) {
    const s = sprite(G.emojiTexture(emoji), 1);
    s.position.set(x0, y0, 1.4);
    this.scene.add(s);
    this.fx.push({ obj: s, life: time, max: time, size: 1.0, grow: 0.2, fade: false, path: { x0, y0, x1, y1, arc: arc ?? 2 }, done });
  };

  View.prototype.confetti = function (n) {
    const cols = ['#ff4b4b', '#ffd93b', '#3d8bff', '#2fd6b0', '#a066e8', '#ffffff', '#ff7ab8'];
    for (let i = 0; i < n; i++) {
      this.particle({ x: Math.random() * W, y: H - 1 + Math.random() * 4, vx: (Math.random() - 0.5) * 3, vy: -1.5 - Math.random() * 3,
        life: 3 + Math.random() * 1.5, size: 0.4, color: cols[i % cols.length], spin: (Math.random() - 0.5) * 10, map: squareTexture(), fade: true, z: 2 });
    }
  };

  let squareTex = null;
  function squareTexture() {
    if (squareTex) return squareTex;
    const [c, g] = G.makeCanvas(16, 16);
    g.fillStyle = '#fff';
    g.fillRect(2, 4, 12, 8);
    return (squareTex = G.toTexture(c));
  }

  let burps = 0;
  // what happened in the rules this step
  View.prototype.onEvent = function (ev, sim) {
    switch (ev.type) {
      case 'wave': if (this.sim === sim) this.buildJellies(sim); break;
      case 'step':
        for (const v of this.jellies.values()) if (v.a.alive) v.hop = 1;
        break;
      case 'fire': { const v = this.actors.get('cart' + ev.by); if (v) v.recoil = 1; break; }
      case 'pop': {
        this.popJelly(ev.id, ev.by);
        const pal = A.PALETTES[sim.wave % A.PALETTES.length];
        this.burst(ev.x, ev.y, pal[ev.kind] || '#ffffff', 10, 4, 0.28, { grav: 2 });
        this.popup('+' + ev.pts, ev.x, ev.y + 0.7, '#ffe14a');
        if (++burps % 3 === 1) this.popup('BURP!', ev.x + 0.4, ev.y + 1.4, '#9ff2d6');
        break;
      }
      case 'chip':
        if (!ev.quiet || Math.random() < 0.3) this.burst(ev.x, ev.y, '#fff0f5', ev.quiet ? 3 : 6, 2.5, 0.2, { grav: 6 });
        break;
      case 'sprinklePop': this.burst(ev.x, ev.y, '#fff3a0', 8, 3, 0.22, { grav: 1 }); this.popup('+5', ev.x, ev.y + 0.5, '#ffffff'); break;
      case 'splat': this.burst(ev.x, ev.y, A.SPRINKLE[Math.floor(Math.random() * 5)], ev.soft ? 4 : 6, 2, 0.18, { up: 1.5, grav: 8 }); break;
      case 'sprinkled': {
        this.shake = 0.35;
        for (let i = 0; i < 18; i++) this.particle({ x: ev.x + (Math.random() - 0.5) * 1.6, y: 1.2 + Math.random() * 1.2, vx: (Math.random() - 0.5) * 4, vy: 2 + Math.random() * 3,
          grav: 9, life: 0.9, size: 0.26, color: A.SPRINKLE[i % 5], map: squareTexture(), spin: 12 });
        break;
      }
      case 'landed': this.shake = 0.6; this.burst(W / 2, 3, '#ffffff', 24, 7, 0.3, { grav: 3 }); break;
      case 'saucerPop':
        this.burst(ev.x, ev.y, '#ff8fc8', 22, 6, 0.32, { grav: 5 });
        this.burst(ev.x, ev.y, '#fff1d6', 14, 4, 0.26, { grav: 5 });
        this.popup('+' + ev.pts, ev.x, ev.y - 0.6, '#ffe14a', true);
        this.popup('YUM!', ev.x, ev.y - 1.6, '#ff9ad5');
        break;
      case 'beam': this.burst(ev.x, MUZZLE_Y, '#ffffff', 16, 6, 0.3, { grav: 0 }); break;
      case 'gift': this.emojiFly(ev.emoji, ev.x, 2.2, ev.tx, 2.6, 0.8, 2.5); break;
      case 'highfive': {
        const s = sprite(G.emojiTexture('✋'), 1.6);
        s.position.set(ev.x, 3.6, 1.6);
        this.scene.add(s);
        this.fx.push({ obj: s, vx: 0, vy: 0.8, life: 1.4, max: 1.4, size: 1.6, grow: 0.6, grav: 0, spin: 0, fade: true });
        this.confetti(40);
        break;
      }
      case 'clear': this.confetti(ev.last ? 180 : 70); break;
      case 'done': this.confetti(160); break;
    }
  };

  // ---------------------------------------------------------------- the camera
  // Frame the field between the HUD at the top and the finger strip at the bottom (and beside the kit's buttons).
  View.prototype.fit = function (force) {
    const c = this.canvas, w = c.clientWidth || window.innerWidth, h = c.clientHeight || window.innerHeight;
    const key = JSON.stringify(this.margins);
    if (!force && w === this.size[0] && h === this.size[1] && this.marginKey === key) return;
    this.size = [w, h];
    this.marginKey = key;
    this.renderer.setSize(w, h, false);
    const mg = this.margins;
    const bw = BOX.x1 - BOX.x0, bh = BOX.y1 - BOX.y0;
    const availW = Math.max(100, w - mg.left - mg.right), availH = Math.max(100, h - mg.top - mg.bottom);
    const ppu = Math.min(availW / bw, availH / bh);
    let cx = mg.left + availW / 2;
    if (Math.abs(cx - w / 2) > 1 && w / 2 - (bw * ppu) / 2 >= mg.left && w / 2 + (bw * ppu) / 2 <= w - mg.right) cx = w / 2;
    let cy = mg.top + availH / 2;
    if (this.alignBottom) cy = Math.max(cy, mg.top + availH - (bh * ppu) / 2);
    const vh = h / ppu;
    const d = vh / 2 / Math.tan(T.MathUtils.degToRad(this.camera.fov / 2));
    this.camX = (BOX.x0 + BOX.x1) / 2 - (cx - w / 2) / ppu;
    this.camY = (BOX.y0 + BOX.y1) / 2 + (cy - h / 2) / ppu;
    this.camera.aspect = w / h;
    this.camera.position.set(this.camX, this.camY, d);
    this.camera.lookAt(this.camX, this.camY, 0);
    this.camera.updateProjectionMatrix();
    this.ppu = ppu;
    this.dist = d;
    this.screenW = w;
    this.screenH = h;
  };

  // screen pixels <-> the field (on the z = 0 plane)
  View.prototype.worldX = function (clientX) { return this.camX + (clientX - this.screenW / 2) / this.ppu; };
  View.prototype.screenY = function (y) { return this.screenH / 2 - (y - this.camY) * this.ppu; };
  View.prototype.screenX = function (x) { return this.screenW / 2 + (x - this.camX) * this.ppu; };
  // where a 3D object really is on the screen (through the camera, as drawn): the play check uses this
  View.prototype.project = function (obj) {
    obj.updateWorldMatrix(true, false);
    const p = new T.Vector3().setFromMatrixPosition(obj.matrixWorld).project(this.camera);
    return { x: ((p.x + 1) / 2) * this.screenW, y: ((1 - p.y) / 2) * this.screenH };
  };
  View.prototype.cartObj = function (id) { const v = this.actors.get('cart' + id); return v && v.root; };

  View.prototype.render = function () {
    this.renderer.render(this.scene, this.camera);
  };

  SD.View = View;
})();
