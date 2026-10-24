/* 中文 for TT Star Defenders: the words on the page, the toasts, the wave names and tips, the ? panel, and the canvas
   text in the 3D scene (BURP!, YUM!, wrapped in Kit.lang.t in js/view.js). The 中文 logo is SD.TITLE_ZH (星星保卫队).
   Stays in English on purpose: the kids' names (TEDDY, TOMMY), the game's name in the tab and the ? panel, and key labels. */
(function () {
  const L = Kit.lang;
  L.keep(['TEDDY', 'TOMMY', 'Teddy', 'Tommy', SD.TITLE, 'Esc', '❚❚', '← TEDDY · TOMMY →']);

  // the 10 waves: names and tips (the wave banner)
  const WAVES = {
    'Hello, Jellies!': '果冻你好！', 'Pop every jelly alien before they march down!': '在外星人走下来之前，把它们全部戳破！',
    Checkers: '跳棋格', 'Watch out for the sprinkles they drop!': '小心它们扔下来的糖粒！',
    'Big V': '大大的 V', 'Hide behind the squishy shields!': '躲在软软的护盾后面！',
    Diamond: '钻石', 'Pop the cake saucer at the top for bonus points!': '打中上面的蛋糕飞碟，能得额外的分！',
    'Two Teams': '两个队', 'Call your brother for a rainbow beam!': '叫兄弟来放彩虹光束！',
    Smiley: '笑脸', 'Say cheese! Pop the smiley.': '笑一个！把笑脸戳破。',
    'Big Heart': '大爱心', 'The jellies love you. Pop them anyway!': '外星人很喜欢你，不过还是要戳破它们！',
    'Zig Zag': '之字形', 'Zig, zag, POP!': '左一下，右一下，砰！',
    Rocket: '火箭', '3, 2, 1... POP!': '3、2、1……砰！',
    'The Big Party': '超级大派对', 'The last wave. Pop them all!': '最后一波！全部戳破！',
  };
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', JUICE: '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };

  L.add(Object.assign({}, WAVES, {
    // title screen
    'Teddy & Tommy pop the jelly aliens!': 'Teddy 和 Tommy 来戳破果冻外星人！',
    'Teddy + Tommy together': 'Teddy 和 Tommy 一起玩',
    '🐣 EASY': '🐣 简单', '🔥 NORMAL': '🔥 普通', 'START AT WAVE': '起始波次',
    // HUD
    WAVE: '波次', 'HI-SCORE': '最高分', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)',
    'press T': '按 T', 'tap for another beam': '再点一下，再来一道彩虹', 'HIGH FIVE! ✋': '击掌！✋', 'HIGH FIVE': '击掌',
    '← DRAG TO SLIDE · HOLD TO POP →': '← 拖动移动 · 按住发射 →',
    // toasts
    'KEEP GOING! ❤️': '继续加油！❤️', 'OUT OF LIVES! 💔': '没有生命了！💔', 'THE JELLIES LANDED! BOING! 💔': '外星人落地啦！嘣！💔',
    '🎂 A CAKE SAUCER! POP IT!': '🎂 蛋糕飞碟！快打它！', 'ALL 10 WAVES! 🎉': '10 波全部通过啦！🎉', '✋ HIGH FIVE! SUPER STARS!': '✋ 击掌！超级星星！',
    // screens
    '▶ PLAY': '▶ 继续', '↻ START THIS WAVE AGAIN': '↻ 这一波重新开始', '🏠 MENU': '🏠 菜单',
    'OH NO!': '哎呀！', 'KEEP GOING!': '继续加油！', 'YOU DID IT!': '你做到了！', 'PLAY AGAIN': '再玩一次',
    // in the 3D scene (canvas text)
    'BURP!': '嗝！', 'YUM!': '好吃！',
    // the ? panel
    'slide the cannon': '移动大炮', 'fire star-pops (hold to keep firing)': '发射星星（按住一直发射）',
    'W or Space': 'W 或 空格', '↑ or /': '↑ 或 /', 'T or Enter': 'T 或 回车', 'P or Esc · M': 'P 或 Esc · M',
    '1 player: either set of keys works, and the mouse slides the cannon too (click to fire).': '单人时两套按键都能用，用鼠标也能移动大炮（点一下发射）。',
    'Put a finger down: the cannon rolls to it and fires while your finger stays down. Drag to slide. 2 players: Teddy uses the left half of the screen, Tommy the right. The round face button (top right) calls your brother.':
      '手指按在屏幕上，大炮就跑过去，手指一直按着就一直发射。拖动可以移动。双人时 Teddy 用屏幕左半边，Tommy 用右半边。右上角的圆形头像按钮可以叫兄弟来帮忙。',
  }));

  const N = '(TEDDY|TOMMY)';
  L.rule(new RegExp(`^CALL ${N}$`), '叫 $1');
  L.rule(new RegExp(`^${N} IS HERE!$`), '$1 来啦！');
  L.rule(new RegExp(`^${N} IS COMING TO HELP!$`), '$1 来帮忙啦！');
  L.rule(new RegExp(`^${N} SAYS: RAINBOW BEAM!$`), '$1 说：彩虹光束！');
  L.rule(new RegExp(`^${N} GOT SPRINKLED! 💔$`), '$1 被撒了一身糖粒！💔');
  L.rule(new RegExp(`^BYE BYE, ${N}! 👋$`), '$1 拜拜！👋');
  L.rule(new RegExp(`^(\\S+) (ICE CREAM|WATER|JUICE|COOKIE|WATERMELON|BANANA) FROM ${N}!( \\+❤️)?$`), (m, e, item, who, heal) => `${e} ${who} 送来的${TREAT[item]}！${heal || ''}`);
  L.rule(/^ready in (\d+)$/, '$1 秒后可以');
  L.rule(/^HIGH FIVE IN (\d+)…$/, '$1 秒后可以击掌…');
  L.rule(/^WAVE (\d+) OF (\d+)$/, '第 $1 波（共 $2 波）');
  L.rule(/^WAVE (\d+) CLEAR! \+([\d,]+) 🎉$/, '第 $1 波通过！+$2 🎉');
  L.rule(/^🎂 YUM! \+(\d+)$/, '🎂 好吃！+$1');
  L.rule(/^SCORE ([\d,]+)$/, '得分 $1');
  L.rule(/^HI-SCORE ([\d,]+)$/, '最高分 $1');
  L.rule(/^NEW HI-SCORE! ([\d,]+)$/, '新的最高分！$1');
  L.rule(/^The jellies got you on wave (\d+)\. Keep going: the ones you popped stay popped!$/, '第 $1 波的外星人把你撒满了糖粒。继续加油：戳破的外星人不会回来！');
  L.rule(/^(Teddy and Tommy|Teddy|Tommy) popped all (\d+) waves of jelly aliens!$/, (m, who, n) => `${who === 'Teddy and Tommy' ? 'Teddy 和 Tommy' : who} 戳破了全部 ${n} 波果冻外星人！`);
})();
