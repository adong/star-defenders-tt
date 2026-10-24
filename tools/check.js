#!/usr/bin/env node
/* TT Star Defenders: the headless check. Loads the same rules the game uses (js/sim.js, no Three.js) and runs js/checks.js.
   node tools/check.js            every check, plus a soak of all 10 waves on EASY
   node tools/check.js --quick    fewer seeds, no soak
   node tools/check.js --prove    the fail variant: each check against a sim with that rule broken; passes only if all fail */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const ctx = { console, Date, Math };
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['title.js', 'sim.js', 'checks.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'js', f), 'utf8'), ctx, { filename: f });
const t0 = Date.now();
if (process.argv.includes('--prove')) {
  const res = ctx.SD.checks.prove();
  console.log(res.lines.join('\n'));
  console.log(res.ok ? `\nEVERY BROKEN RULE WAS CAUGHT (${((Date.now() - t0) / 1000).toFixed(1)} s)` : `\n${res.missed.length} BROKEN RULE(S) NOT CAUGHT: ${res.missed.join(', ')}`);
  process.exit(res.ok ? 0 : 1);
}
const res = ctx.SD.checks.run({ quick: process.argv.includes('--quick') });
console.log(res.lines.join('\n'));
console.log(res.ok ? `\nALL CHECKS PASS (${((Date.now() - t0) / 1000).toFixed(1)} s)` : `\n${res.fails.length} CHECK(S) FAILED: ${res.fails.join(', ')}`);
process.exit(res.ok ? 0 : 1);
