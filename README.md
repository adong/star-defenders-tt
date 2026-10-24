# TT Star Defenders

[![TT Star Defenders title screen](docs/screenshot.jpg)](https://adong.github.io/star-defenders-tt/)

Press **?** any time (or tap the round **?** button on the left edge) to see the keys. The game waits while you look.
Tap the language button under it (the A文 icon) to switch between English and 中文; the dashboard and every game remember the choice.

**中文：** 星星保卫队！一排排摇摇晃晃、眼睛滴溜溜转的果冻外星人左右走、到边就往下走一步。Teddy 和 Tommy 推着玩具大炮发射星星，把它们一个个戳破。10 波，单人或双人一起玩。

## Play

An arcade shooter in our own style, starring Teddy and Tommy, built with Claude Code from plain JavaScript and
Three.js. Rows of wobbly, googly-eyed jelly aliens march side to side and step down at each edge. The brother rides a
toy cart with a star cannon held over his head: slide it along the bottom and fire star-pops from behind four squishy
shields. Nobody gets hurt: popped jellies burp and float off in bubbles, and a sprinkle that lands on you just covers
you in sprinkles. There are no image, model or audio files: the kids are the shared kit's blocky characters, every
texture is painted on a canvas, and every sound is synthesised.

- **Double-click `index.html`.** It works offline because Three.js and the kit are copied into `kit/`.
- **Send one file:** `dist/star-defenders-tt.html` is the whole game in one page (about 820 KB). Rebuild it after any
  edit: `python3 kit/tools/bundle.py . --name star-defenders-tt`
- The two fonts load from Google Fonts when online. Offline, the game falls back to Arial Black and the system font.
- The name lives in one place, `js/title.js` (`SD.TITLE`, and `SD.TITLE_ZH` = 星星保卫队 for the 中文 logo), plus the
  page `<title>` in `index.html`.
- **Pick a brother** (1 PLAYER) or **2 PLAYERS**, 🐣 EASY (the default) or 🔥 NORMAL, and (once you've reached later
  waves) START AT WAVE. Behind the title the brothers play a wave by themselves.
- **The jellies:** Gummy (round, 10 points), Boppy (a jelly-mould with an antenna, 20) and Squishy (a little
  jellyfish, 30). Their pupils wobble on springs and watch your cart.
- **The march:** the whole formation steps sideways, and when the outside jelly reaches a wall they all step down
  and turn around. The fewer are left, the faster they march (a little four-note toy tune ticks along with them). If
  they reach the floor, you lose a life and they all boing back up to the top.
- **Sprinkles:** jellies drop slow candy sprinkles. One that lands on your cart costs a life (hearts at the top
  left): you're sprinkled, dizzy stars spin round your head, the march stops for a moment, and you blink for a
  couple of seconds while nothing can sprinkle you. You can always keep rolling and firing. A star-pop that hits a
  sprinkle pops it (+5).
- **Shields:** four squishy marshmallow shields. Star-pops and sprinkles both chip bits off them, and jellies that
  march into them squash them.
- **The cake saucer** crosses the top now and then: pop it for 50 to 300 bonus points ("YUM!").
- **10 waves, each a new formation:** Hello, Jellies! · Checkers · Big V · Diamond · Two Teams · Smiley · Big Heart ·
  Zig Zag · Rocket · The Big Party. Each starts with a banner and a tip; clearing one gives a bonus (100 × the wave),
  the brother does his signature move with confetti, and the next wave marches in.
- **Winning:** after wave 10 the brothers do their signature moves (Teddy's Tyson-style boxing and his 🏀 jump shot,
  Tommy's Y pose with peace fingers), confetti, and YOU DID IT! with your score, the HI-SCORE and PLAY AGAIN.
- **🐣 EASY** (for Tommy, 5): a slower march with smaller steps down, rare slow sprinkles (one at a time), two
  star-pops in the air at once, shields that regrow between waves, and 5 lives.
- **🔥 NORMAL** (for Teddy, 8): the arcade rules. A faster march that starts a little lower each wave, more and
  faster sprinkles (some aimed at you), one star-pop at a time, shields that don't regrow, 3 lives.
- **2 players** play together: two carts side by side (they can roll past each other), shared lives, one team score.
- **Out of lives:** "OH NO!" and **KEEP GOING!** gives you full lives right where you are: the jellies you popped
  stay popped and the rest go back up to the top. **↻ START THIS WAVE AGAIN** (in the pause menu) starts it fresh.
- **HI-SCORE** is kept for each difficulty and shows at the top while you play.

### How it's checked

All the rules live in `js/sim.js` (no Three.js), so `node tools/check.js` plays the real game headlessly in under a
second, and `game.check()` runs the same checks in the page. `node tools/check.js --prove` (and `game.prove()`) is the
fail variant: every check runs again with its rule broken on purpose, and passes only if every check fails.

| check | what passes | the broken rule that must fail |
|---|---|---|
| march | on EASY and NORMAL, every time the outside jelly reaches a wall the formation steps down exactly one step and turns around; every other step is exactly one step sideways; no jelly ever goes past a wall | jellies that turn at the wall without stepping down |
| speed | the time between march steps with all 32, 16, 4 and 1 left gets shorter each time (EASY 0.62 → 0.15 s, NORMAL 0.50 → 0.06 s) | a march that never speeds up |
| shields | a star-pop from under a shield chips it (and stops there); a sprinkle from above chips it; a shot through the gap between two shields chips nothing | shields that let everything through |
| wave end | with one jelly left the wave goes on; it ends on the very step the last one pops (shot down by the cart), then the next wave starts; after wave 10 the game is won | a wave that doesn't end when the last jelly pops |
| autopilot | clears wave 1 on EASY as Teddy, as Tommy and with 2 players, 6 seeds each (18 runs, about a minute each) | an autopilot that never fires |
| frames | the same keys held at the same moments give the same game (score, carts, jellies, shields, shots, sprinkles) at 30, 60 and 120 frames a second and at a jumpy frame rate | stepping by the frame time instead of the fixed step |
| beam | the brother's rainbow beam pops every jelly in its column and nothing else, then he rolls away | a beam that misses its column |
| soak | the autopilot plays all 10 waves on EASY (keeping going when out of lives, as a kid would): no wave can get stuck | |

The rules always step by 1/120 s (`SD.Runner` keeps the leftover time for the next frame), so the frame rate never
changes the game.

**The play check** (`game.playCheck()`, in the page) plays the way a kid does: real `keydown` / `keyup` events on
`window` and pointer events on the canvas, never the rules' inputs or the autopilot, and it measures where each cart
really is on the screen (projected through the camera, as drawn):

- → / D move the cart right on the screen and ← / A left, on all 10 waves, as Teddy and as Tommy; in 2 players Teddy's
  keys move only Teddy's cart and Tommy's only Tommy's;
- Space fires, holding it keeps firing, and a tap shorter than one frame still fires; in 2 players W and ↑ fire their
  own cart;
- a finger brings the cart to it and fires, dragging slides it, lifting stops it; in 2 players each half of the screen
  drives its own cart;
- nothing leaves the cart stuck: while sprinkled, after the jellies land, while the brother is here and during his
  beam, after pause (with a key held when it paused), the ? panel, losing the window focus, a cancelled finger, keep
  going after running out of lives, the next wave, and in 2 players with one brother sprinkled.

`game.playProve()` runs it again with the keys mirrored and with a sprinkle that freezes the cart: both are caught.
All of these were run in the Browser pane and on `dist/star-defenders-tt.html` from `file://` in headless Chrome.

Test hooks (the Browser pane throttles animation when hidden, so tests drive the game themselves):
`game.start(wave, '1p' | '2p', hero, easy)`, `game.step(seconds, { draw: false })`, `game.call()`, `game.autopilot()`,
`game.state()`, `game.check()`, `game.prove()`, `game.playCheck()`, `game.playProve()`, `game.demo(wave)`.
`index.html?wave=7&mode=2p` (or `&hero=tommy&easy=0`) opens a wave directly.

## Controls

| | Keys | Mouse / touch |
|---|---|---|
| **1 player** | ← → or A D slide the cannon, Space (or W / ↑) fires star-pops; hold to keep firing | put a finger down anywhere: the cart rolls to it and fires while your finger stays down; drag to slide. The mouse slides the cannon and a click fires |
| **2 players**: Teddy | A D, W or Space fires | the left half of the screen |
| **2 players**: Tommy | ← →, ↑ or / fires | the right half of the screen |
| call your brother (1 player) / high five (2 players) | T or Enter | the round face button, top right |
| pause / sound | P or Esc / M | ❚❚ / 🔊 at the top |

On a touch screen a faint strip along the bottom ("← DRAG TO SLIDE · HOLD TO POP →") sits under the field, and the
field stays clear of the kit's round buttons on the left edge. On a phone on its side the score card and the buttons
go down the sides, next to the field. On the title screen: Enter starts one player as the brother you picked last
(← → to switch), 2 starts two players, E switches easy mode.

## Companion

In 1 player, call the other brother any time with **T** (or Enter, or his face button, top right), as often as you
like:

- He pops in at the side of the field at his buddy size (Tommy is smaller than Teddy), riding his own cart, and does
  his signature move.
- He tosses you a treat (🍦 💧 🧃 🍪 🍉 🍌, +100, and a life back if you've lost one): "🍦 ICE CREAM FROM TOMMY!".
- Then he rolls his cart under the fullest column and fires a **rainbow beam** up the whole column: every jelly in it
  pops and floats off in a bubble ("TOMMY SAYS: RAINBOW BEAM!"). The beam also pops sprinkles and the cake saucer.
- Call again while he's there for another treat and another beam. Then he waves bye and rolls off.

In 2 players both brothers are already playing, so the button is a **HIGH FIVE**: both cheer, a ✋ and confetti, and
8 seconds of **super stars** (two more star-pops in the air each and faster firing), then 15 s to wait (shown on the
button).

## Files

```
index.html        page, HUD, screens (CSS inline)
js/title.js       the game's name (one place)
js/sim.js         the rules: the march, star-pops, sprinkles, shields, the cake saucer, waves, lives, the companion and
                  the high five, the autopilot (SD.Bot) and the fixed-step runner (SD.Runner); no Three.js, so it also
                  runs in Node
js/checks.js      the headless checks and their broken-rule versions (node tools/check.js, game.check(), game.prove())
js/art.js         canvas-painted textures: the night sky, the launch pad, star-pops, bubbles, the rainbow beam
js/view.js        the Three.js scene: jellies (one merged mesh each, plus googly pupils), carts, kids and cannons,
                  shields (instanced), the cake saucer, the beam, effects
js/poses.js       extra poses on top of Kit.people.pose (carry, oops, cheer)
js/sfx.js         sounds made with Kit.sound.tone / hiss (pew, burp, the march tick, the saucer warble, ...)
js/game.js        screens, keyboard, mouse and touch, HUD, companion button, toasts, the wave banner, HI-SCORE, the title
                  demo, test hooks
js/playcheck.js   the real-key and touch play check (game.playCheck(), game.playProve())
js/keys.js        the keys the ? panel shows (Kit.help)
js/zh.js          中文: every word on the page, the wave names and tips, the canvas words, the ? panel (Kit.lang)
tools/check.js    the headless check (node tools/check.js [--quick | --prove])
tools/shoot.js    screenshots with headless Chrome (node tools/shoot.js tools/shots.json docs 1200 750)
kit/              copy of ~/claude-games/kit (python3 ../kit/tools/sync.py .); don't edit it here
docs/             the screenshot
dist/star-defenders-tt.html   the single-page build
```

## Not verified

- **Sound:** every effect goes through `Kit.sound` and follows the kit's one sound switch, but nobody listened: all
  testing was muted.
- **Real touch devices:** fingers were tested with simulated pointer events at iPad (1024x768) and phone (390x844,
  740x360) sizes, not with a real finger on a real iPad or phone. On a phone held upright the field is small.
- **Real kids:** the march speeds, the sprinkle rates and how long a wave takes (the autopilot needs about a minute
  for wave 1 on EASY; a 5-year-old will take longer) are guesses until Teddy and Tommy play it.
- **Home-screen icon:** the apple-touch-icon is drawn by script like the other games; not tried on a device.
