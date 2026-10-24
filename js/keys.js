/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: SD.TITLE,
  cols: ['Teddy', 'Tommy'],
  keys: [
    ['slide the cannon', 'A D', '← →'],
    ['fire star-pops (hold to keep firing)', 'W or Space', '↑ or /'],
    ['call your brother · high five', 'T or Enter', 'T or Enter'],
    ['pause · sound', 'P or Esc · M', ''],
  ],
  note: '1 player: either set of keys works, and the mouse slides the cannon too (click to fire).',
  touch: 'Put a finger down: the cannon rolls to it and fires while your finger stays down. Drag to slide. 2 players: Teddy uses the left half of the screen, Tommy the right. The round face button (top right) calls your brother.',
});
