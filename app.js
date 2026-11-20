/* ============================================================
   二建刷题 · 可交互原型
   纯前端 / 无构建 / localStorage 键 bqproto:v1（与线上 bq:v1 隔离）
   ============================================================ */
(function () {
  'use strict';

  var KEY = 'bqproto:v1';
  var LEGACY_KEY = 'bq:v1';
  var MIGRATE_KEY = 'bqproto:migrate:v1';
  var UNLOCK_KEY = 'bq:unlock:v1';
  var ACCESS_PASSWORD = 'Yuanzhi2026';
  var SYNC_KEY = 'bq:sync:v1';
  var SUPABASE_URL = 'https://zjlwvalqqifmwayvkieu.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_h9S-a3UfvaL4jl8qM618xA_TOybeW7a';
  var SYNC_ENABLED = true;
  var FB = window.__QUESTIONS_FALLBACK__ || { meta: {}, questions: [] };
  var QUESTIONS = Array.isArray(FB.questions) ? FB.questions : [];
  var QMAP = {};
  QUESTIONS.forEach(function (q) { QMAP[q.id] = q; });

  var TYPE_LABEL = { single: '单选题', multiple: '多选题', judge: '判断题' };
  var MODE_LABEL = { order: '顺序练习', random: '随机练习', wrong: '错题重做', weak: '易错题练习', fav: '收藏练习', exam: '模拟考试' };

  /* 经验 / 等级：答对 +2 XP；Lv1→2 需 50，之后每级需求递增 50 */
  var XP_PER_CORRECT = 2;
  function xpNeed(lv) { return 50 * lv; }
  function levelInfo(xp) {
    var total = Math.max(0, Math.floor(parseInt(xp, 10) || 0));
    var lv = 1;
    var rest = total;
    while (lv < 999 && rest >= xpNeed(lv)) {
      rest -= xpNeed(lv);
      lv += 1;
    }
    return { level: lv, cur: rest, need: xpNeed(lv), total: total };
  }
  /* 模拟考试交卷按分数一次性结算经验 */
  function examXpFor(score) {
    if (score >= 90) return 60;
    if (score >= 80) return 45;
    if (score >= 70) return 30;
    if (score >= 60) return 20;
    return 10;
  }
  /* 考试奖金阶梯：只奖 90 分以上；改数字只改这里 */
  var EXAM_REWARD_TIERS = [
    { min: 100, coins: 800, label: '满分王者' },
    { min: 95, coins: 500, label: '高分通过' },
    { min: 90, coins: 300, label: '稳健通关' }
  ];

  function examRewardFor(score) {
    for (var i = 0; i < EXAM_REWARD_TIERS.length; i += 1) {
      if (score >= EXAM_REWARD_TIERS[i].min) return EXAM_REWARD_TIERS[i];
    }
    return { min: 0, coins: 0, label: '未达奖励线' };
  }
  var COLOR_LABEL = {
    green: '默认绿',
    'morandi-green': '灰绿',
    'morandi-purple': '淡紫',
    'morandi-coffee': '奶咖'
  };

  /* ---------------- 商城数据（价格集中在这里，按档位调整） ---------------- */
  /* 档位：基础 120–180 / 进阶 220–300 / 稀有 1200–1500 / 梦想称号 5000–20000 */
  var PRICE_BANDS = {
    daily: 120,
    dailyPlus: 150,
    basic: 180,
    standard: 220,
    premium: 300,
    rare: 1200,
    dream: 1500,
    bgBasic: 80,
    bgRare: 900,
    effect: 100,
    skin: 150,
    titleFun: 500,
    titleFairy: 1200,
    legend: [5000, 8000, 12000, 16000, 20000]
  };

  var TITLES = [
    { id: 'fun-1', tier: 'fun', tierName: '趣味 / 搞笑档', name: '⚒ 二建做题家', price: PRICE_BANDS.titleFun },
    { id: 'fun-2', tier: 'fun', tierName: '趣味 / 搞笑档', name: '🧱 精致的搬砖女孩', price: PRICE_BANDS.titleFun },
    { id: 'fun-3', tier: 'fun', tierName: '趣味 / 搞笑档', name: '👜 拿证后就去买包', price: PRICE_BANDS.titleFun },
    { id: 'fun-4', tier: 'fun', tierName: '趣味 / 搞笑档', name: '🏠 坐等收租的富婆', price: PRICE_BANDS.titleFun },
    { id: 'fairy-1', tier: 'fairy', tierName: '仙女档', name: '🌸 工地一枝花', price: PRICE_BANDS.titleFairy },
    { id: 'fairy-2', tier: 'fairy', tierName: '仙女档', name: '✨ 工地最美仙女', price: PRICE_BANDS.titleFairy },
    { id: 'fairy-3', tier: 'fairy', tierName: '仙女档', name: '🎀 戴粉色安全帽的女神', price: PRICE_BANDS.titleFairy },
    { id: 'fairy-4', tier: 'fairy', tierName: '仙女档', name: '👸 二建在逃公主', price: PRICE_BANDS.titleFairy },
    { id: 'fairy-5', tier: 'fairy', tierName: '仙女档', name: '💫 美貌与才华并存的考证达人', price: PRICE_BANDS.titleFairy },
    { id: 'legend-1', tier: 'legend', tierName: '终极荣耀档', name: '👑 通关大女主', price: PRICE_BANDS.legend[0] },
    { id: 'legend-2', tier: 'legend', tierName: '终极荣耀档', name: '👑 二建大女主', price: PRICE_BANDS.legend[1] },
    { id: 'legend-3', tier: 'legend', tierName: '终极荣耀档', name: '👑 建造师本师', price: PRICE_BANDS.legend[2] },
    { id: 'legend-4', tier: 'legend', tierName: '终极荣耀档', name: '👑 月入过万的甲方', price: PRICE_BANDS.legend[3] },
    { id: 'legend-5', tier: 'legend', tierName: '终极荣耀档', name: '👑 传说中的项目经理', price: PRICE_BANDS.legend[4] }
  ];

  var BACKGROUNDS = [
    { id: 'pink', name: '粉色渐变', price: PRICE_BANDS.bgBasic },
    { id: 'aurora', name: '极光星空', price: PRICE_BANDS.bgRare },
    { id: 'dopamine', name: '多巴胺配色', price: PRICE_BANDS.bgRare }
  ];

  /* ---------------- 四项新玩法的数值集中处（后续调档只改这里） ---------------- */
  /* 限定装饰：不进金币货架，只能用限定碎片兑换，或靠彩蛋极小概率直掉 */
  var LIMITED = [
    { id: 'peach', name: '限定 · 蜜桃落日', cost: 40, desc: '橘粉天光，猫猫趴在窗台看落日' },
    { id: 'northlight', name: '限定 · 深海夜光', cost: 40, desc: '深蓝海面的碎光，答题时安静发亮' }
  ];

  /* 随机彩蛋：每题「首次答对」判定一次 */
  var EGG = {
    rate: 0.12,        // 触发概率
    rateScale: 1,      // 概率倍数（想整体加/减掉落就动这一个）
    valueScale: 1,     // 金币数值倍数
    tiers: [
      { key: 'small', label: '小额金币', rate: 0.85, min: 20, max: 60 },
      { key: 'big', label: '大额金币', rate: 0.12, min: 150, max: 300 },
      { key: 'fragment', label: '限定碎片', rate: 0.03, amount: 1 }
    ],
    decorRate: 0.003,  // 独立直掉一件限定装饰
    fragmentCost: 40   // 兑换一件限定装饰所需碎片
  };

  /* 题型成就：题库里 chapter 字段实际是题型，所以按题型分组 */
  var BADGES = [
    { key: '单选题', name: '混凝土专家', icon: '🧱' },
    { key: '多选题', name: '钢筋大拿', icon: '🔩' },
    { key: '判断题', name: '防水行家', icon: '🛡️' }
  ];
  var BADGE_MIN_ANSWERED = 10;
  var BADGE_MIN_ACC = 90;

  var SKINS = [
    { id: 'bunny', name: '粉色兔耳安全帽', price: PRICE_BANDS.skin },
    { id: 'glasses', name: '黑框学霸眼镜', price: PRICE_BANDS.skin },
    { id: 'coffee', name: '冰美式', price: PRICE_BANDS.skin }
  ];

  /* 换装衣橱：52 套 × 8 动作，整猫帧直接切图，不再叠加配饰 */
  var OUTFIT_GROUPS = [
    { key: 'work', label: '职业装', folder: '01_职业装', items: [
      ['p01_blue-collar-coverall', '蓝领工装服', PRICE_BANDS.standard],
      ['p02_reflective-vest', '黄色反光背心', PRICE_BANDS.standard],
      ['p03_pm-suit', '项目经理小西装', PRICE_BANDS.rare],
      ['p04_cost-checker-plaid', '造价员格子衫', PRICE_BANDS.standard],
      ['p05_gold-chain', '包工头大金链', PRICE_BANDS.premium],
      ['p06_blueprint-tube', '工程图纸筒', PRICE_BANDS.standard],
      ['p07_mini-tape-measure', '迷你卷尺', PRICE_BANDS.basic],
      ['p08_red-hard-hat', '红色安全帽', PRICE_BANDS.premium],
      ['p09_blueprint-drawer', '画图小能手', PRICE_BANDS.standard],
      ['p10_brick-carrier', '搬砖达人', PRICE_BANDS.standard],
      ['p11_engineer-white-helmet', '二建工程师白安全帽', PRICE_BANDS.dream]
    ] },
    { key: 'festival', label: '节日装', folder: '02_节日装', items: [
      ['f01_lion-hat', '醒狮虎头帽', PRICE_BANDS.dream],
      ['f02_red-padded-jacket', '红红火火小棉袄', PRICE_BANDS.premium],
      ['f03_fortune-collar', '招财小项圈', PRICE_BANDS.basic],
      ['f04_red-envelope', '拜年小红包', PRICE_BANDS.standard],
      ['f05_santa-hat', '迷你圣诞帽', PRICE_BANDS.standard],
      ['f06_xmas-scarf', '红绿条纹围巾', PRICE_BANDS.standard],
      ['f07_antlers', '麋鹿小角', PRICE_BANDS.basic],
      ['f08_candy-cane', '拐杖糖', PRICE_BANDS.basic],
      ['f09_pumpkin-head', '南瓜头套', PRICE_BANDS.rare],
      ['f10_wizard-cloak', '魔法斗篷', PRICE_BANDS.dream],
      ['f11_devil-wings', '小恶魔翅膀', PRICE_BANDS.premium],
      ['f12_leaf-cape', '粽叶小披风', PRICE_BANDS.premium],
      ['f13_multicolor-rope-collar', '五彩绳项圈', PRICE_BANDS.basic]
    ] },
    { key: 'glasses', label: '眼镜', folder: '03_眼镜', items: [
      ['g01_black-square-glasses', '黑框学霸眼镜', PRICE_BANDS.basic],
      ['g02_gold-round-glasses', '金丝圆框眼镜', PRICE_BANDS.premium],
      ['g03_blue-light-goggles', '防蓝光护目镜', PRICE_BANDS.premium],
      ['g04_heart-red-glasses', '心形红框眼镜', PRICE_BANDS.basic],
      ['g05_candy-sunglasses', '彩色糖果墨镜', PRICE_BANDS.basic],
      ['g06_cat-ear-glasses', '猫耳发光眼镜', PRICE_BANDS.premium],
      ['g07_monocle', '单片眼镜', PRICE_BANDS.daily],
      ['g08_diving-mask', '潜水镜', PRICE_BANDS.basic]
    ] },
    { key: 'accessory', label: '配饰', folder: '04_配饰', items: [
      ['a01_pink-bell-collar', '粉色铃铛项圈', PRICE_BANDS.basic],
      ['a02_red-bell-collar', '红色小铃铛', PRICE_BANDS.basic],
      ['a03_gold-bell-collar', '金色大铃铛', PRICE_BANDS.standard],
      ['a04_sapphire-collar', '蓝宝石项圈', PRICE_BANDS.premium],
      ['a05_star-pendant', '星星小吊坠', PRICE_BANDS.basic],
      ['a06_pearl-collar', '珍珠项圈', PRICE_BANDS.standard],
      ['a07_red-velvet-bow', '红丝绒蝴蝶结', PRICE_BANDS.basic],
      ['a08_sailor-bow', '水手风蓝色蝴蝶结', PRICE_BANDS.basic],
      ['a09_big-back-bow', '后脑勺大蝴蝶结', PRICE_BANDS.standard],
      ['a10_duck-ring', '小黄鸭游泳圈', PRICE_BANDS.premium],
      ['a11_fluffy-neck-warmer', '毛绒围脖', PRICE_BANDS.standard],
      ['a12_mini-cloak', '小披风', PRICE_BANDS.premium]
    ] },
    { key: 'daily', label: '日常搭配', folder: '05_日常搭配', items: [
      ['d01_yellow-raincoat', '黄色小雨衣雨帽', PRICE_BANDS.dailyPlus],
      ['d02_blue-overalls-bowtie', '蓝色背带裤红领结', PRICE_BANDS.dailyPlus],
      ['d03_beret-scarf', '米色贝雷帽小围巾', PRICE_BANDS.daily],
      ['d04_yukata-headband', '红色和风小浴衣带发带', PRICE_BANDS.dailyPlus],
      ['d05_straw-hat-bag', '草帽小帆布包', PRICE_BANDS.daily]
    ] },
    { key: 'work', label: '职业装', folder: '06_白帽工程师', items: [
      ['e01_blueprint-engineer', '白帽工程师（图纸）', PRICE_BANDS.dream],
      ['e02_tape-inspector', '白帽质检员（卷尺）', PRICE_BANDS.premium],
      ['e03_hammer-worker', '白帽施工员（小锤子）', PRICE_BANDS.premium]
    ] }
  ];
  var OUTFITS = [];
  OUTFIT_GROUPS.forEach(function (group) {
    group.items.forEach(function (row) {
      OUTFITS.push({ id: row[0], name: row[1], price: row[2], group: group.key, groupLabel: group.label, folder: group.folder });
    });
  });
  var OUTFIT_ACTIONS = ['stand', 'run', 'jump', 'stretch', 'sleep', 'roll', 'eat', 'wave'];

  function outfitSrc(item, action) {
    return 'assets/cat-outfits/' + item.folder + '/' + item.id + '/' + item.id + '_' + action + '.png';
  }
  function exprSrc(item, expr) {
    return 'assets/cat-outfit-expr/' + item.folder + '/' + item.id + '/' + item.id + '_' + expr + '.png';
  }
  function equippedOutfit() {
    return state.equipped.outfit ? findItem('outfit', state.equipped.outfit) : null;
  }
  function frameFor(action) {
    var o = equippedOutfit();
    if (o) return EXPRESSION_SET[action] ? exprSrc(o, action) : outfitSrc(o, action);
    return SPRITE[action] || SPRITE.stand;
  }
  function preloadOutfit(item) {
    // 只预加载当前套的站立帧，其余动作/表情在真正播放时按需加载
    var img = new Image();
    img.src = outfitSrc(item, 'stand');
  }

  var EFFECTS = [
    { id: 'sakura', name: '答对掉落樱花', price: PRICE_BANDS.effect, emoji: '🌸🌸🌸' },
    { id: 'star', name: '答对掉落星星', price: PRICE_BANDS.effect, emoji: '✨✨✨' }
  ];

  function priceAudit() {
    var items = [];
    TITLES.forEach(function (x) { items.push({ cat: '称号', tier: x.tierName, name: x.name, price: x.price }); });
    OUTFITS.forEach(function (x) { items.push({ cat: '猫猫换装', tier: x.groupLabel, name: x.name, price: x.price }); });
    BACKGROUNDS.forEach(function (x) { items.push({ cat: '背景', tier: '背景', name: x.name, price: x.price }); });
    EFFECTS.forEach(function (x) { items.push({ cat: '特效', tier: '特效', name: x.name, price: x.price }); });
    SKINS.forEach(function (x) { items.push({ cat: '经典配饰', tier: '经典配饰', name: x.name, price: x.price }); });

    var total = items.reduce(function (s, x) { return s + x.price; }, 0);
    var byCategory = {};
    items.forEach(function (x) {
      if (!byCategory[x.cat]) byCategory[x.cat] = { count: 0, total: 0 };
      byCategory[x.cat].count += 1;
      byCategory[x.cat].total += x.price;
    });
    Object.keys(byCategory).forEach(function (k) {
      byCategory[k].avg = Math.round(byCategory[k].total / byCategory[k].count);
    });

    function bandOf(price) {
      if (price >= 5000) return '梦想';
      if (price >= 400) return '稀有';
      if (price >= 181) return '进阶';
      return '基础';
    }
    var byBand = { '基础': { count: 0, total: 0 }, '进阶': { count: 0, total: 0 }, '稀有': { count: 0, total: 0 }, '梦想': { count: 0, total: 0 } };
    items.forEach(function (x) {
      var b = byBand[bandOf(x.price)];
      b.count += 1;
      b.total += x.price;
    });
    Object.keys(byBand).forEach(function (k) {
      byBand[k].avg = byBand[k].count ? Math.round(byBand[k].total / byBand[k].count) : 0;
    });

    function sim(pattern, n) {
      var coins = 0;
      var streak = 0;
      for (var i = 0; i < n; i += 1) {
        if (pattern[i % pattern.length]) {
          coins += 10;
          streak += 1;
          if (streak % 3 === 0) coins += 30;
          if (streak % 10 === 0) coins += 100;
        } else {
          streak = 0;
        }
      }
      return coins;
    }
    var all = sim([1], 602) + 50;
    var p80 = sim([1, 1, 1, 1, 0], 602) + 50;
    var p60 = sim([1, 1, 1, 0, 0], 602) + 50;
    var mixed = sim([1, 1, 1, 1, 1, 0, 1, 1, 0, 1], 602) + 50;
    var income = { '100%': all, '80%': p80, '60%': p60, '混合中途答错': mixed };
    var rounds = {};
    Object.keys(income).forEach(function (k) { rounds[k] = +(total / income[k]).toFixed(2); });

    var daily30 = {
      '100%': sim([1], 30) + 50,
      '80%': sim([1, 1, 1, 1, 0], 30) + 50,
      '60%': sim([1, 1, 1, 0, 0], 30) + 50
    };
    var firstUltimate = PRICE_BANDS.legend[0];
    var secondUltimate = PRICE_BANDS.legend[1];

    return {
      count: items.length,
      total: total,
      byCategory: byCategory,
      byBand: byBand,
      income: income,
      rounds: rounds,
      daily30: daily30,
      daysToFirstUltimate: +(firstUltimate / daily30['100%']).toFixed(1),
      daysToSecondUltimate: +(secondUltimate / daily30['100%']).toFixed(1),
      firstUltimate: firstUltimate,
      secondUltimate: secondUltimate,
      legendPrices: PRICE_BANDS.legend,
      note: '每日首刷 +50 已计入；考试奖金不计入刷题收入'
    };
  }

  function findItem(kind, id) {
    var list = kind === 'title' ? TITLES : kind === 'bg' ? BACKGROUNDS : kind === 'skin' ? SKINS : kind === 'outfit' ? OUTFITS : EFFECTS;
    for (var i = 0; i < list.length; i += 1) if (list[i].id === id) return list[i];
    if (kind === 'bg') {
      for (var j = 0; j < LIMITED.length; j += 1) if (LIMITED[j].id === id) return LIMITED[j];
    }
    return null;
  }

  /* ---------------- 文案 ---------------- */
  // 12 条奖励/陪伴文案：5 日达标 + 4 高分 + 3 低分，按日期轮换
  var DAILY_LINES = [
    '辛苦啦！今天的知识量已达标，奖励自己喝杯奶茶吧！🧋',
    '太棒啦！今日份的努力已到账，快去伸个懒腰，看看窗外吧~ 🌿',
    '今天也坚持下来了，你真的超有毅力！去吃点甜品犒劳一下自己吧 🍰',
    '脑细胞消耗完毕！今天的你比昨天更优秀了一点点，早点休息哦 🌙',
    '进度条拉满！把手机放下，去敷个面膜放松一下吧 💆‍♀️'
  ];
  var HIGH_LINES = [
    '哇！这正确率也太高了吧，这就是未来的项目经理吗？😎',
    '这题都能做对？你简直是二建考场的黑马！🐎',
    '太牛了！照这个状态，证书已经在向你招手啦 🏆',
    '学神附体！请收下我的膝盖，继续保持这个手感哦 ✨'
  ];
  var LOW_LINES = [
    '没关系没关系，拍拍肩膀~ 错题其实是提前帮你排雷啦 💣',
    '今天状态可能不太好，允许自己有小失误，明天我们再战！💪',
    '别气馁，实务本来就难，把这几个“坑”记住，考场上就能多拿分 💯'
  ];

  var RIGHT_LINES = [
    '漂亮！+{n} 金币',
    '这题拿捏了~',
    '答对啦，+{n} 金币',
    '稳！下一题继续',
    '手感在线，+{n} 金币'
  ];
  var RIGHT_NO_COIN = [
    '这题已经拿下过啦~',
    '又稳又准，继续保持',
    '熟悉的味道，下一题！'
  ];
  var WRONG_LINES = [
    '哎呀，是个陷阱，记到小本本上！',
    '差一点点，看看解析再走~',
    '这题埋了坑，下次绕开它',
    '没关系，错题才是提分点'
  ];

  var rightIdx = 0;
  var wrongIdx = 0;

  function pickRight(n) {
    if (!n) {
      var a = RIGHT_NO_COIN[rightIdx % RIGHT_NO_COIN.length];
      rightIdx += 1;
      return a;
    }
    var line = RIGHT_LINES[rightIdx % RIGHT_LINES.length];
    rightIdx += 1;
    return line.replace('{n}', n);
  }

  function pickWrong() {
    var line = WRONG_LINES[wrongIdx % WRONG_LINES.length];
    wrongIdx += 1;
    return line;
  }

  function pickByDate(list) {
    var days = Math.floor(Date.now() / 86400000);
    return list[days % list.length];
  }

  /* ---------------- 日期工具 ---------------- */
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  function dateKey(dt) {
    return dt.getFullYear() + '-' + pad2(dt.getMonth() + 1) + '-' + pad2(dt.getDate());
  }

  function todayKey() { return dateKey(new Date()); }

  function parseYMD(s) {
    var p = String(s).split('-').map(Number);
    return new Date(p[0], p[1] - 1, p[2], 12, 0, 0, 0);
  }

  function startOfDay(dt) {
    return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
  }

  function addDays(dt, n) {
    var d = new Date(dt.getTime());
    d.setDate(d.getDate() + n);
    return d;
  }

  /* ---------------- 节日判定（本地日期） ---------------- */
  var SPRING = ['2024-02-10', '2025-01-29', '2026-02-17', '2027-02-06', '2028-01-26', '2029-02-13', '2030-02-03', '2031-01-23', '2032-02-11', '2033-01-31', '2034-02-19', '2035-02-08'];
  var DRAGON = ['2024-06-10', '2025-05-31', '2026-06-19', '2027-06-09', '2028-05-28', '2029-06-16', '2030-06-05', '2031-06-24', '2032-06-12', '2033-06-01', '2034-06-20', '2035-06-10'];
  var MID = ['2024-09-17', '2025-10-06', '2026-09-25', '2027-09-15', '2028-10-03', '2029-09-22', '2030-09-12', '2031-10-01', '2032-09-19', '2033-09-08', '2034-09-27', '2035-09-16'];

  function festivalFor(dt) {
    var m = dt.getMonth() + 1;
    var d = dt.getDate();
    var t = startOfDay(dt);

    // 春节：除夕（初一前一天）到正月初六
    for (var i = 0; i < SPRING.length; i += 1) {
      var cny = parseYMD(SPRING[i]);
      if (t >= startOfDay(addDays(cny, -1)) && t <= startOfDay(addDays(cny, 6))) return '春节';
    }
    // 端午、中秋（农历表）
    for (var j = 0; j < DRAGON.length; j += 1) {
      if (dateKey(dt) === DRAGON[j]) return '端午节';
    }
    for (var k = 0; k < MID.length; k += 1) {
      if (dateKey(dt) === MID[k]) return '中秋节';
    }

    if (m === 1 && d === 1) return '元旦';
    if (m === 12 && d >= 25) return '圣诞跨年';
    if (m === 3 && d === 7) return '3·7 女生节';
    if (m === 3 && d === 8) return '3·8 女神节';
    if (m === 5 && d === 20) return '520';
    if (m === 6 && d === 18) return '618';
    if (m === 10 && d >= 1 && d <= 7) return '国庆节';
    if (m === 11 && d === 11) return '双 11';
    return '';
  }

  function effectiveDate() {
    if (state.simDate) {
      var p = String(state.simDate).split('-').map(Number);
      if (p.length === 3 && p[0] && p[1] && p[2]) return new Date(p[0], p[1] - 1, p[2], 12, 0, 0, 0);
    }
    return new Date();
  }

  function festivalName() { return festivalFor(effectiveDate()); }

  function priceOf(item) {
    return festivalName() ? Math.round(item.price / 2) : item.price;
  }

  /* ---------------- 存档 ---------------- */
  function defaultState() {
    return {
      v: 1,
      coins: 0,
      coinDelta: 0,
      coinSeed: 3,
      xp: 0,
      level: 1,
      shopSeed: 3,
      equippedAt: 0,
      fragmentDelta: 0,
      color: 'morandi-green',
      theme: 'light',
      daily: { date: todayKey(), first: false, ids: {}, goalShown: false },
      dailyGoal: 20,
      studyLog: {},
      focus: false,
      streak: 0,
      bestStreak: 0,
      wrongStreak: 0,
      answered: {},
      solved: {},
      wrong: {},
      wrongCount: {},
      weak: {},
      blind: {},
      exams: [],
      badges: {},
      eggSeen: {},
      fragments: 0,
      fav: {},
      owned: {},
      equipped: { title: '', bg: '', skin: 'classic', outfit: '', fx: '' },
      sync: { loggedIn: false, email: '', lastSync: '' },
      pet: { left: null, top: null },
      petName: '小鹿',
      festClosed: '',
      simDate: '',
      resume: null
    };
  }

  function loadState() {
    var base = defaultState();
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return base;
      var saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return base;
      Object.keys(base).forEach(function (k) {
        if (saved[k] === undefined || saved[k] === null) return;
        if (k === 'daily' || k === 'equipped' || k === 'pet' || k === 'sync') {
          base[k] = Object.assign(base[k], saved[k]);
        } else {
          base[k] = saved[k];
        }
      });
      if (!base.equipped.skin) base.equipped.skin = 'classic';
      if (typeof base.equipped.outfit !== 'string') base.equipped.outfit = '';
      // 音效功能已移除：旧存档里的音效装备与已购记录直接丢弃，不影响打开
      delete base.equipped.sound;
      Object.keys(base.owned || {}).forEach(function (k) {
        if (k.indexOf('sound:') === 0) delete base.owned[k];
      });
      if (!base.wrongCount || typeof base.wrongCount !== 'object') base.wrongCount = {};
      Object.keys(base.wrong || {}).forEach(function (id) {
        var n = parseInt(base.wrongCount[id], 10);
        if (!n || n < 1) base.wrongCount[id] = 1;
      });
      if (!base.weak || typeof base.weak !== 'object') base.weak = {};
      Object.keys(base.weak).forEach(function (id) {
        if (!base.wrongCount[id]) delete base.weak[id];
      });
      if (!base.petName) base.petName = '小鹿';
      if (saved.coinSeed !== 3) { base.coins = 0; base.coinDelta = 0; base.coinSeed = 3; }
      if (saved.shopSeed !== 3) {
        base.owned = {};
        base.equipped = { title: '', bg: '', skin: 'classic', outfit: '', fx: '' };
        base.fragments = 0;
        base.fragmentDelta = 0;
        base.badges = {};
        base.shopSeed = 3;
      }
      // 老存档没有盲点记录：现有错题直接算作待消灭
      if (!base.blind || typeof base.blind !== 'object') base.blind = {};
      Object.keys(base.wrong || {}).forEach(function (id) {
        if (!base.blind[id]) base.blind[id] = 'active';
      });
      if (!base.badges || typeof base.badges !== 'object') base.badges = {};
      if (!base.eggSeen || typeof base.eggSeen !== 'object') base.eggSeen = {};
      if (typeof base.fragments !== 'number') base.fragments = 0;
      if (typeof base.dailyGoal !== 'number' || [10, 20, 30].indexOf(base.dailyGoal) < 0) base.dailyGoal = 20;
      if (!base.studyLog || typeof base.studyLog !== 'object') base.studyLog = {};
      if (typeof base.focus !== 'boolean') base.focus = false;
      // 旧存档没有 XP 字段：从 Lv1 / 0 XP 开始，不报错
      if (typeof base.xp !== 'number' || !isFinite(base.xp) || base.xp < 0) base.xp = 0;
      base.xp = Math.floor(base.xp);
      base.level = levelInfo(base.xp).level;
      if (typeof base.coinDelta !== 'number' || !isFinite(base.coinDelta)) base.coinDelta = 0;
      if (typeof base.fragmentDelta !== 'number' || !isFinite(base.fragmentDelta)) base.fragmentDelta = 0;
      if (typeof base.equippedAt !== 'number' || !isFinite(base.equippedAt)) base.equippedAt = 0;
      return base;
    } catch (e) {
      return base;
    }
  }

  /* 一次性迁移旧线上存档 bq:v1 → bqproto:v1，只跑一次，不覆盖已有新数据 */
  function migrateLegacyStore() {
    try {
      if (localStorage.getItem(MIGRATE_KEY) === '1') return;
      var raw = localStorage.getItem(LEGACY_KEY);
      if (!raw) { localStorage.setItem(MIGRATE_KEY, '1'); return; }
      var legacy = JSON.parse(raw);
      if (!legacy || typeof legacy !== 'object') { localStorage.setItem(MIGRATE_KEY, '1'); return; }

      var base = defaultState();
      var current = null;
      try { current = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { current = null; }
      if (current && typeof current === 'object') {
        Object.keys(base).forEach(function (k) {
          if (current[k] === undefined || current[k] === null) return;
          if (k === 'daily' || k === 'equipped' || k === 'pet' || k === 'sync') base[k] = Object.assign(base[k], current[k]);
          else base[k] = current[k];
        });
      }

      var records = legacy.records && typeof legacy.records === 'object' ? legacy.records : {};
      Object.keys(records).forEach(function (id) {
        var r = records[id];
        if (!r || !r.attempts) return;
        var local = base.answered[id];
        var ts = r.lastAt || 0;
        if (!local || (local.ts || 0) <= ts) {
          base.answered[id] = {
            picked: Array.isArray(r.lastAnswer) ? r.lastAnswer.slice() : [],
            correct: !!r.lastCorrect,
            ts: ts
          };
        }
        if (r.lastCorrect) base.solved[id] = true;
      });

      var wrongs = legacy.wrong && typeof legacy.wrong === 'object' ? legacy.wrong : {};
      Object.keys(wrongs).forEach(function (id) {
        var a = base.answered[id];
        var at = wrongs[id] && wrongs[id].at || 0;
        var n = parseInt(wrongs[id] && wrongs[id].count, 10) || 1;
        if (!a || !a.correct || (a.ts || 0) < at) {
          base.wrong[id] = true;
          base.wrongCount[id] = Math.max(base.wrongCount[id] || 0, n);
          if (base.wrongCount[id] >= 3) base.weak[id] = true;
        }
      });

      var favs = legacy.fav && typeof legacy.fav === 'object' ? legacy.fav : {};
      Object.keys(favs).forEach(function (id) { if (favs[id]) base.fav[id] = true; });

      if (Array.isArray(legacy.exams)) {
        base.exams = mergeExams(legacy.exams, base.exams);
      }

      Object.keys(base.wrong).forEach(function (id) {
        if (!base.blind[id]) base.blind[id] = 'active';
      });

      // 上线前统一归零：迁移不继承任何金币与商城状态，首次进入从 0 开始
      base.coins = 0;
      base.coinDelta = 0;
      base.coinSeed = 3;
      base.owned = {};
      base.equipped = { title: '', bg: '', skin: 'classic', outfit: '', fx: '' };
      base.equippedAt = 0;
      base.fragments = 0;
      base.fragmentDelta = 0;
      base.badges = {};
      base.shopSeed = 3;
      base.color = 'morandi-green';

      localStorage.setItem(KEY, JSON.stringify(base));
      localStorage.setItem(MIGRATE_KEY, '1');
    } catch (e) {}
  }

  migrateLegacyStore();
  var state = loadState();

  function ensureDaily() {
    var tk = todayKey();
    if (state.daily.date !== tk) {
      state.daily = { date: tk, first: false, ids: {}, goalShown: false };
      save();
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* 金币/碎片变动都记一份未同步增量，供跨设备合并时只结算一次 */
  function changeCoins(delta) {
    delta = Math.round(Number(delta) || 0);
    if (!delta) return;
    var before = Math.max(0, parseInt(state.coins, 10) || 0);
    state.coins = Math.max(0, before + delta);
    state.coinDelta = (parseInt(state.coinDelta, 10) || 0) + (state.coins - before);
  }

  function changeFragments(delta) {
    delta = Math.round(Number(delta) || 0);
    if (!delta) return;
    var before = Math.max(0, parseInt(state.fragments, 10) || 0);
    state.fragments = Math.max(0, before + delta);
    state.fragmentDelta = (parseInt(state.fragmentDelta, 10) || 0) + (state.fragments - before);
  }

  /* ---------------- DOM ---------------- */
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var els = {
    pet: $('#pet-card'),
    petBall: $('#pet-ball'),
    petAvatar: $('#pet-avatar'),
    petSprite: $('#pet-sprite'),
    petMenu: $('#pet-menu'),
    petEm: $('#pet-em'),
    petZzz: $('#pet-zzz'),
    petPlus: $('#pet-plus'),
    petSay: $('#pet-say'),
    petFx: $('#pet-fx'),
    petLevel: $('#pet-level'),
    petExp: $('#pet-exp-fill'),
    petGoal: $('#pet-goal'),
    petGoalText: $('#pet-goal-text'),
    petStreak: $('#pet-streak'),
    petStreakBadge: $('#pet-streak-badge'),
    bar: $('#quiz-bar'),
    main: $('#main'),
    toast: $('#toast')
  };

  var currentView = 'home';
  var currentQ = null;
  var session = null;
  var lastReport = null;
  var lastReportDataURL = '';
  var lastWrongIds = [];
  var picked = [];
  var shopTab = 'all';
  var catGroup = '全部';
  var homeScroll = 0;
  var mainAction = 'next';
  var bubbleOpen = false;
  var lastActive = Date.now();
  var comboTimer = null;
  var smashTimers = [];
  var questionAtId = '';
  var questionShownAt = 0;
  var cheeredQid = '';

  /* 8 个新表情：基础裸猫放在 cat/expr60，换装放在 cat-outfit-expr（避免覆盖同名 _sleep 动作帧） */
  var EXPRESSIONS = ['wink', 'cheer', 'like', 'surprise', 'angry', 'love', 'sleep', 'sad'];
  var EXPRESSION_SET = {};
  EXPRESSIONS.forEach(function (e) { EXPRESSION_SET[e] = true; });

  /* ---------------- 猫猫动作（用户提供的 60×60 素材） ---------------- */
  var SPRITE = {
    stand: 'assets/cat/frames60/stand_60.webp',
    run: 'assets/cat/frames60/run_60.png',
    jump: 'assets/cat/frames60/jump_60.png',
    stretch: 'assets/cat/frames60/stretch_60.png',
    roll: 'assets/cat/frames60/roll_60.png',
    eat: 'assets/cat/frames60/eat_60.png',
    wave: 'assets/cat/frames60/wave_60.png',
    // 新表情（裸猫）
    wink: 'assets/cat/expr60/basic_wink.png',
    cheer: 'assets/cat/expr60/basic_cheer.png',
    like: 'assets/cat/expr60/basic_like.png',
    surprise: 'assets/cat/expr60/basic_surprise.png',
    angry: 'assets/cat/expr60/basic_angry.png',
    love: 'assets/cat/expr60/basic_love.png',
    sleep: 'assets/cat/expr60/basic_sleep.png',
    sad: 'assets/cat/expr60/basic_sad.png'
  };
  /* 配饰锚点：x/y/w 都是 60×60 帧内的像素坐标，渲染时换算成百分比。
     眼镜 x/y = 双眼中心，w = 镜框总宽，r = 旋转角；
     兔耳帽 / 冰美式 x/y = 底部接触点（头顶 / 爪子），w = 宽度，r = 旋转角。
     数据来源：对 8 张 60×60 原图做暗色像素连通域测量，再按眼距换算镜框宽度。 */
  var ACC_ANCHORS = {
    glasses: {
      stand: [23.6, 20.75, 29.8, -1.1],
      run: [43.9, 21.65, 23.3, -8.0],
      jump: [46.95, 23.55, 20.1, 4.9],
      stretch: [45.0, 34.5, 26.7, -4.1],
      sleep: [19.75, 31.0, 22.0, 5.0],
      roll: [40.05, 26.05, 21.1, 70.6],
      eat: [41.4, 33.75, 19.8, 11.6],
      wave: [23.05, 16.55, 21.7, 13.7]
    },
    bunny: {
      stand: [24.0, 10.5, 40.0, 0],
      run: [44.0, 10.5, 38.0, -8],
      jump: [47.0, 12.5, 37.0, 5],
      stretch: [45.0, 24.0, 36.0, -4],
      sleep: [23.0, 21.5, 36.0, 6],
      roll: [49.0, 21.0, 34.0, 70],
      eat: [41.0, 22.5, 37.0, 12],
      wave: [23.0, 6.0, 38.0, 14]
    },
    coffee: {
      stand: [33.0, 56.0, 14.0, 0],
      run: [49.0, 48.0, 14.0, 0],
      jump: [52.0, 47.0, 14.0, 0],
      stretch: [52.0, 44.0, 14.0, 0],
      sleep: [32.0, 46.0, 14.0, 0],
      roll: [29.0, 42.0, 14.0, 0],
      eat: [44.0, 44.0, 14.0, 0],
      wave: [33.0, 46.0, 14.0, 0]
    }
  };
  var ACC_SPEC = {
    glasses: { vbW: 40, vbH: 16, ox: 50, oy: 53.125 },
    bunny: { vbW: 60, vbH: 26, ox: 50, oy: 100 },
    coffee: { vbW: 20, vbH: 24, ox: 50, oy: 100 }
  };
  var ACC_SELECTOR = { glasses: '.acc-glasses', bunny: '.acc-bunny', coffee: '.acc-coffee' };

  /* 头顶表情锚点：x = 头部实际中心，y = 头顶（60×60 帧内坐标） */
  var HEAD_ANCHORS = {
    stand: [23.6, 8.5],
    run: [43.9, 9.0],
    jump: [47.0, 11.5],
    stretch: [45.0, 23.0],
    sleep: [19.75, 19.5],
    roll: [49.0, 19.0],
    eat: [41.4, 21.0],
    wave: [23.05, 5.5],
    // 8 个新表情：按各帧暗色像素估算头部中心，睡眠沿用侧卧锚点
    wink: [23.1, 5.0],
    cheer: [27.1, 3.5],
    like: [27.8, 3.5],
    surprise: [26.1, 3.5],
    angry: [28.9, 6.5],
    love: [28.3, 4.5],
    sad: [27.7, 6.5]
  };

  function applyHeadAnchor(anim) {
    var a = HEAD_ANCHORS[anim] || HEAD_ANCHORS.stand;
    var x = (a[0] / 60 * 100).toFixed(3) + '%';
    var y = ((a[1] - 2) / 60 * 100).toFixed(3) + '%';
    [els.petEm, els.petZzz].forEach(function (el) {
      if (!el) return;
      el.style.left = x;
      el.style.top = y;
    });
  }

  function applyAccessoryAnchors(root, anim) {
    if (!root) return;
    var name = anim || 'stand';
    Object.keys(ACC_SELECTOR).forEach(function (key) {
      var el = root.querySelector(ACC_SELECTOR[key]);
      var spec = ACC_SPEC[key];
      var table = ACC_ANCHORS[key];
      var a = table && (table[name] || table.stand);
      if (!el || !spec || !a) return;
      var pct = function (v) { return (v / 60 * 100).toFixed(4) + '%'; };
      el.style.left = pct(a[0]);
      el.style.top = pct(a[1]);
      el.style.width = pct(a[2]);
      el.style.height = pct(a[2] * spec.vbH / spec.vbW);
      el.style.transformOrigin = spec.ox + '% ' + spec.oy + '%';
      el.style.transform =
        'translate(-' + spec.ox + '%, -' + spec.oy + '%) rotate(' + a[3] + 'deg)';
    });
  }

  var pose = 'stand';
  var poseTimer = null;
  var actionUntil = 0;
  var idleTimer = null;
  var roamX = 0;
  var roamY = 0;
  var roamDirX = -1;
  var draggingCat = false;
  var motionQuery = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  var reducedMotion = !!(motionQuery && motionQuery.matches);

  /* ---------------- 主题 ---------------- */
  function applyTheme() {
    document.documentElement.dataset.color = state.color;
    document.documentElement.dataset.theme = state.theme;
    document.documentElement.style.colorScheme = state.theme === 'dark' ? 'dark' : 'light';
    if (state.equipped.bg) document.documentElement.dataset.bg = state.equipped.bg;
    else delete document.documentElement.dataset.bg;
    $('#color-label').textContent = COLOR_LABEL[state.color] || '灰绿';
    $$('#color-menu button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.color === state.color);
    });
  }

  function applyEquipped() {
    applyTheme();
    var hasOutfit = !!equippedOutfit();
    var skin = hasOutfit ? 'classic' : (state.equipped.skin || 'classic');
    els.petAvatar.dataset.skin = skin;
    els.pet.dataset.skin = skin;
    els.pet.classList.toggle('has-outfit', hasOutfit);
    applyAccessoryAnchors(els.petAvatar, pose);
  }

  /* ---------------- 顶栏同步（真实 Supabase Auth + quiz_state） ---------------- */
  var syncSession = null;
  var syncSyncing = false;
  var syncApplying = false;
  var syncTimer = null;
  var syncDraftTimer = null;
  var syncDraftSupported = true;
  var syncStatusText = '未登录';

  function syncTimeText(ts) {
    if (!ts) return '尚未同步';
    var diff = Date.now() - ts;
    if (diff < 60000) return '上次同步：刚刚';
    var d = new Date(ts);
    return '上次同步：' + d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function setSyncStatus(text) {
    syncStatusText = text;
    renderSync();
  }

  function renderSync() {
    var btn = $('#btn-sync');
    if (btn) {
      var label = '未登录';
      if (syncSession) {
        if (syncSyncing || syncStatusText.indexOf('同步中') === 0) label = '同步中';
        else if (syncStatusText.indexOf('同步失败') === 0) label = '同步失败';
        else if (syncStatusText.indexOf('已同步') === 0) label = '已同步';
        else label = '已登录';
      }
      btn.textContent = label;
      btn.classList.toggle('is-synced', !!syncSession);
      btn.title = '跨设备同步 · ' + (syncSession ? syncStatusText : '未登录');
    }
    var form = $('#sync-form');
    var account = $('#sync-account');
    if (!form || !account) return;
    form.classList.toggle('hidden', !!syncSession);
    account.classList.toggle('hidden', !syncSession);
    var sub = $('#sync-sub');
    if (sub) sub.textContent = syncSession ? '已登录，刷题记录与模拟考试草稿会跨设备同步。' : '登录后，刷题记录与模拟考试草稿会跨设备同步。';
    if (syncSession) {
      $('#sync-email-view').textContent = syncSession.email || syncSession.userId || '已登录';
      $('#sync-time').textContent = syncStatusText === '未登录' ? syncTimeText(state.sync && state.sync.lastSync) : syncStatusText;
    }
  }

  var syncLastFocus = null;
  function openSync() {
    syncLastFocus = document.activeElement;
    renderSync();
    $('#sync-modal').classList.remove('hidden');
    if (!syncSession) {
      var email = $('#sync-email');
      if (email) setTimeout(function () { email.focus(); }, 60);
    }
  }

  function closeSync() {
    $('#sync-modal').classList.add('hidden');
    if (syncLastFocus && syncLastFocus.focus) { try { syncLastFocus.focus(); } catch (e) {} }
    syncLastFocus = null;
  }

  function apiUrl(path) {
    return SUPABASE_URL.replace(/\/+$/, '') + path;
  }

  function authHeaders() {
    return { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' };
  }

  function translateAuthError(message) {
    var text = String(message || '');
    if (/Invalid login credentials/i.test(text)) return '邮箱或密码错误';
    if (/Email not confirmed/i.test(text)) return '邮箱尚未验证，请先查收确认邮件';
    if (/Password should be at least/i.test(text)) return '密码至少 6 位';
    if (/Failed to fetch|NetworkError|Load failed/i.test(text)) return '网络不可用，已保持本地模式';
    return text;
  }

  async function authRequest(path, options) {
    var res = await fetch(apiUrl(path), options);
    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (!res.ok) {
      var raw = (data && (data.msg || data.message || data.error_description || data.error)) || ('HTTP ' + res.status);
      throw new Error(translateAuthError(raw));
    }
    return data;
  }

  function saveSyncSession(data) {
    if (!data || !data.access_token) return;
    syncSession = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      userId: data.user && data.user.id,
      email: data.user && data.user.email
    };
    try { localStorage.setItem(SYNC_KEY, JSON.stringify(syncSession)); } catch (e) {}
    renderSync();
  }

  function syncHeaders(session) {
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + session.accessToken,
      'Content-Type': 'application/json'
    };
  }

  async function ensureSyncSession() {
    if (!syncSession) return null;
    if (syncSession.expiresAt && syncSession.expiresAt - Date.now() > 60000) return syncSession;
    if (!syncSession.refreshToken) { syncSession = null; try { localStorage.removeItem(SYNC_KEY); } catch (e) {} renderSync(); return null; }
    try {
      var data = await authRequest('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ refresh_token: syncSession.refreshToken })
      });
      saveSyncSession(data);
      return syncSession;
    } catch (e) {
      syncSession = null;
      try { localStorage.removeItem(SYNC_KEY); } catch (err) {}
      renderSync();
      return null;
    }
  }

  async function signInSync() {
    if (!SYNC_ENABLED) return;
    var email = ($('#sync-email').value || '').trim();
    var password = $('#sync-password').value || '';
    if (!email || !password) { setSyncStatus('请填写邮箱和密码'); return; }
    setSyncStatus('登录中…');
    try {
      var data = await authRequest('/auth/v1/token?grant_type=password', {
        method: 'POST', headers: authHeaders(), body: JSON.stringify({ email: email, password: password })
      });
      saveSyncSession(data);
      $('#sync-password').value = '';
      await syncNow('login');
      toast('已登录，开始同步');
    } catch (e) {
      setSyncStatus('登录失败：' + e.message);
    }
  }

  async function signOutSync() {
    if (syncSession) {
      try {
        await fetch(apiUrl('/auth/v1/logout'), { method: 'POST', headers: Object.assign({ Authorization: 'Bearer ' + syncSession.accessToken }, authHeaders()) });
      } catch (e) {}
    }
    syncSession = null;
    syncStatusText = '未登录';
    try { localStorage.removeItem(SYNC_KEY); } catch (e) {}
    state.sync = { loggedIn: false, email: '', lastSync: '' };
    save();
    renderSync();
    toast('已退出云同步，本地数据保留');
  }

  function mergeExams(a, b) {
    var map = {};
    (a || []).concat(b || []).forEach(function (e) {
      if (!e || !e.id) return;
      map[e.id] = e;
    });
    return Object.keys(map)
      .map(function (id) { return map[id]; })
      .sort(function (x, y) { return (y.at || 0) - (x.at || 0); })
      .slice(0, 20);
  }

  function syncSnapshot(coinsOverride, fragmentsOverride) {
    var records = {};
    Object.keys(state.answered || {}).forEach(function (id) {
      var a = state.answered[id];
      records[id] = {
        attempts: 1,
        correct: a.correct ? 1 : 0,
        lastAnswer: (a.picked || []).slice(),
        lastCorrect: !!a.correct,
        lastAt: a.ts || 0
      };
    });
    var wrong = {};
    Object.keys(state.wrong || {}).forEach(function (id) {
      var a = state.answered && state.answered[id];
      wrong[id] = { count: (state.wrongCount && state.wrongCount[id]) || 1, at: (a && a.ts) || 0 };
    });
    // 云端表结构没有养成字段：统一放进保留键 __meta，随 records 一起同步
    records.__meta = {
      xp: parseInt(state.xp, 10) || 0,
      level: levelInfo(state.xp).level,
      coins: typeof coinsOverride === 'number' ? coinsOverride : (parseInt(state.coins, 10) || 0),
      fragments: typeof fragmentsOverride === 'number' ? fragmentsOverride : (parseInt(state.fragments, 10) || 0),
      owned: state.owned || {},
      equipped: state.equipped || {},
      equippedAt: parseInt(state.equippedAt, 10) || 0,
      badges: state.badges || {}
    };
    return { records: records, wrong: wrong, fav: state.fav || {}, exams: (state.exams || []).slice(0, 20) };
  }

  function emptyCloud(cloud) {
    var recordIds = Object.keys((cloud && cloud.records) || {}).filter(function (id) { return id !== '__meta'; });
    return !cloud || (!recordIds.length && !Object.keys(cloud.wrong || {}).length && !Object.keys(cloud.fav || {}).length && !(cloud.exams || []).length);
  }

  function mergeOwned(cloudOwned, localOwned) {
    var out = {};
    Object.keys(cloudOwned || {}).forEach(function (k) {
      if (k.indexOf('sound:') !== 0) out[k] = true;
    });
    Object.keys(localOwned || {}).forEach(function (k) { out[k] = true; });
    return out;
  }

  function mergeBadges(cloudBadges, localBadges) {
    var out = {};
    Object.keys(cloudBadges || {}).forEach(function (k) { out[k] = cloudBadges[k] || 1; });
    Object.keys(localBadges || {}).forEach(function (k) {
      out[k] = Math.max(Number(out[k]) || 0, Number(localBadges[k]) || 0) || 1;
    });
    return out;
  }

  function applyCloudState(cloud) {
    var cloudMeta = cloud && cloud.records && cloud.records.__meta;
    var cloudXp = cloudMeta ? (parseInt(cloudMeta.xp, 10) || 0) : 0;
    if (cloudXp > (parseInt(state.xp, 10) || 0)) {
      state.xp = cloudXp;
      state.level = levelInfo(state.xp).level;
      save();
      updatePetBubble();
    }

    // 金币/碎片：云端余额 + 本机未同步增量，避免两台设备直接相加或 max 造成凭空多钱
    var coinDeltaUsed = parseInt(state.coinDelta, 10) || 0;
    var fragmentDeltaUsed = parseInt(state.fragmentDelta, 10) || 0;
    var hasCloudCoins = !!(cloudMeta && typeof cloudMeta.coins === 'number');
    var hasCloudFragments = !!(cloudMeta && typeof cloudMeta.fragments === 'number');
    var mergedCoins = hasCloudCoins ? Math.max(0, cloudMeta.coins + coinDeltaUsed) : (parseInt(state.coins, 10) || 0);
    var mergedFragments = hasCloudFragments ? Math.max(0, cloudMeta.fragments + fragmentDeltaUsed) : (parseInt(state.fragments, 10) || 0);

    if (cloudMeta) {
      // 已购/徽章只增不减，取并集
      if (cloudMeta.owned) state.owned = mergeOwned(cloudMeta.owned, state.owned);
      if (cloudMeta.badges) state.badges = mergeBadges(cloudMeta.badges, state.badges);
      // 装备取时间较新的一侧
      var cloudEquipAt = parseInt(cloudMeta.equippedAt, 10) || 0;
      var localEquipAt = parseInt(state.equippedAt, 10) || 0;
      if (cloudMeta.equipped && cloudEquipAt >= localEquipAt) {
        state.equipped = Object.assign({ title: '', bg: '', skin: 'classic', outfit: '', fx: '' }, cloudMeta.equipped);
        state.equippedAt = cloudEquipAt;
      }
    }

    if (emptyCloud(cloud)) {
      applyEquipped();
      save();
      return { snap: syncSnapshot(mergedCoins, mergedFragments), coins: mergedCoins, fragments: mergedFragments, coinDeltaUsed: coinDeltaUsed, fragmentDeltaUsed: fragmentDeltaUsed };
    }
    var ids = {};
    Object.keys(cloud.records || {}).forEach(function (id) { if (id !== '__meta') ids[id] = true; });
    Object.keys(state.answered || {}).forEach(function (id) { ids[id] = true; });
    Object.keys(ids).forEach(function (id) {
      var c = cloud.records && cloud.records[id];
      var l = state.answered && state.answered[id];
      var localRec = l ? { attempts: (c && c.attempts) || 1, correct: l.correct ? 1 : 0, lastAnswer: l.picked || [], lastCorrect: !!l.correct, lastAt: l.ts || 0 } : null;
      var pick = !c ? localRec : (!localRec ? c : ((localRec.lastAt || 0) > (c.lastAt || 0) ? localRec : c));
      if (pick) {
        state.answered[id] = { picked: (pick.lastAnswer || []).slice(), correct: !!pick.lastCorrect, ts: pick.lastAt || 0 };
        if (pick.lastCorrect) state.solved[id] = true;
      }
    });
    var wrong = {};
    var wrongAt = {};
    var wrongCount = {};
    Object.keys(cloud.wrong || {}).forEach(function (id) {
      wrong[id] = true;
      wrongAt[id] = (cloud.wrong[id] && cloud.wrong[id].at) || 0;
      wrongCount[id] = (cloud.wrong[id] && cloud.wrong[id].count) || 1;
    });
    Object.keys(state.wrong || {}).forEach(function (id) {
      var a = state.answered && state.answered[id];
      var localN = (state.wrongCount && state.wrongCount[id]) || 1;
      wrong[id] = true;
      wrongAt[id] = Math.max(wrongAt[id] || 0, (a && a.ts) || 0);
      wrongCount[id] = Math.max(wrongCount[id] || 0, localN);
    });
    Object.keys(wrong).forEach(function (id) {
      var a = state.answered && state.answered[id];
      if (a && a.correct && (a.ts || 0) >= (wrongAt[id] || 0)) {
        delete wrong[id];
        delete wrongCount[id];
      }
    });
    state.wrong = wrong;
    state.wrongCount = wrongCount;
    state.fav = Object.assign({}, cloud.fav || {}, state.fav || {});
    state.exams = mergeExams(cloud.exams, state.exams);
    applyEquipped();
    save();
    renderHome();
    updateTopbar();
    updatePetBubble();
    if (currentView === 'shop') renderShop();
    return { snap: syncSnapshot(mergedCoins, mergedFragments), coins: mergedCoins, fragments: mergedFragments, coinDeltaUsed: coinDeltaUsed, fragmentDeltaUsed: fragmentDeltaUsed };
  }

  async function fetchCloudState(session) {
    var base = '/rest/v1/quiz_state?select=records,wrong,fav,exams';
    var suffix = '&user_id=eq.' + encodeURIComponent(session.userId);
    var res = await fetch(apiUrl(base + (syncDraftSupported ? ',exam_draft' : '') + suffix), { headers: syncHeaders(session) });
    if (!res.ok && syncDraftSupported && res.status === 400) {
      syncDraftSupported = false;
      res = await fetch(apiUrl(base + suffix), { headers: syncHeaders(session) });
    }
    if (!res.ok) throw new Error('读取云端失败（HTTP ' + res.status + '）');
    var rows = await res.json();
    return rows && rows.length ? rows[0] : null;
  }

  function examDraftForCloud() {
    var r = state.resume;
    if (!r || r.mode !== 'exam' || !Array.isArray(r.ids) || !r.ids.length) return null;
    return Object.assign({ kind: 'bqproto' }, r);
  }

  async function pushCloudState(session, snap, draft, touchDraft) {
    var body = {
      user_id: session.userId,
      records: snap.records,
      wrong: snap.wrong,
      fav: snap.fav,
      exams: snap.exams || [],
      updated_at: new Date().toISOString()
    };
    if (syncDraftSupported && touchDraft !== false) body.exam_draft = draft || null;
    var res = await fetch(apiUrl('/rest/v1/quiz_state'), {
      method: 'POST',
      headers: Object.assign(syncHeaders(session), { Prefer: 'resolution=merge-duplicates,return=minimal' }),
      body: JSON.stringify([body])
    });
    if (!res.ok && syncDraftSupported && res.status === 400) {
      syncDraftSupported = false;
      delete body.exam_draft;
      res = await fetch(apiUrl('/rest/v1/quiz_state'), {
        method: 'POST',
        headers: Object.assign(syncHeaders(session), { Prefer: 'resolution=merge-duplicates,return=minimal' }),
        body: JSON.stringify([body])
      });
    }
    if (!res.ok) throw new Error('写入云端失败（HTTP ' + res.status + '）');
  }

  function applyCloudDraft(raw) {
    if (!raw || raw.kind !== 'bqproto' || !Array.isArray(raw.ids) || !raw.ids.length) return null;
    var local = state.resume;
    if (local && local.mode === 'exam' && (local.savedAt || 0) >= (raw.savedAt || 0)) return local;
    state.resume = raw;
    save();
    renderResumeCard();
    toast('已载入云端未完成的模拟考试');
    return raw;
  }

  async function pushDraftOnly(keepalive) {
    if (!syncSession || !syncDraftSupported) return;
    var draft = examDraftForCloud();
    if (!draft) return;
    try {
      await fetch(apiUrl('/rest/v1/quiz_state?user_id=eq.' + encodeURIComponent(syncSession.userId)), {
        method: 'PATCH',
        headers: Object.assign(syncHeaders(syncSession), { Prefer: 'return=minimal' }),
        body: JSON.stringify({ exam_draft: draft, updated_at: new Date().toISOString() }),
        keepalive: !!keepalive
      });
    } catch (e) {}
  }

  async function clearCloudDraft() {
    if (!syncSession || !syncDraftSupported) return;
    try {
      await fetch(apiUrl('/rest/v1/quiz_state?user_id=eq.' + encodeURIComponent(syncSession.userId)), {
        method: 'PATCH',
        headers: Object.assign(syncHeaders(syncSession), { Prefer: 'return=minimal' }),
        body: JSON.stringify({ exam_draft: null, updated_at: new Date().toISOString() })
      });
    } catch (e) {}
  }

  function scheduleDraftSync() {
    if (!syncSession || syncApplying) return;
    if (syncDraftTimer) clearTimeout(syncDraftTimer);
    syncDraftTimer = setTimeout(function () {
      syncDraftTimer = null;
      pushDraftOnly(false);
    }, 2500);
  }

  async function syncNow(reason) {
    if (!SYNC_ENABLED) return;
    var session = await ensureSyncSession();
    if (!session) { setSyncStatus('未登录'); return; }
    if (syncSyncing) return;
    syncSyncing = true;
    setSyncStatus('同步中…');
    try {
      var cloud = await fetchCloudState(session);
      var mergedResult = applyCloudState(cloud);
      var draft = examDraftForCloud();
      var touchDraft = true;
      if (cloud && cloud.exam_draft) {
        if (cloud.exam_draft.kind === 'bqproto') {
          draft = applyCloudDraft(cloud.exam_draft) || draft;
        } else if (!draft) {
          // 云端是旧版考试草稿：本地没有新草稿时保持原样，不覆盖
          touchDraft = false;
        }
      }
      await pushCloudState(session, mergedResult.snap, draft, touchDraft);
      // 推送成功后落账；同步期间若又发生消费，保留为下一轮增量
      var extraCoins = (parseInt(state.coinDelta, 10) || 0) - mergedResult.coinDeltaUsed;
      var extraFragments = (parseInt(state.fragmentDelta, 10) || 0) - mergedResult.fragmentDeltaUsed;
      state.coins = Math.max(0, mergedResult.coins + extraCoins);
      state.coinDelta = extraCoins;
      state.fragments = Math.max(0, mergedResult.fragments + extraFragments);
      state.fragmentDelta = extraFragments;
      state.sync = { loggedIn: true, email: session.email || '', lastSync: Date.now() };
      save();
      updateTopbar();
      if (currentView === 'shop') renderShop();
      syncStatusText = '已同步 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
      renderSync();
    } catch (e) {
      setSyncStatus('同步失败：' + e.message);
    } finally {
      syncSyncing = false;
      renderSync();
    }
  }

  function scheduleSync() {
    if (!syncSession || syncApplying) return;
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { syncTimer = null; syncNow('auto'); }, 2500);
  }

  function initSync() {
    try {
      var raw = localStorage.getItem(SYNC_KEY);
      if (raw) syncSession = JSON.parse(raw);
    } catch (e) { syncSession = null; }
    if (syncSession && !syncSession.accessToken) syncSession = null;
    renderSync();
    if (syncSession) setTimeout(function () { syncNow('boot'); }, 600);
  }

  function updateTopbar() {
    $('#top-coins').textContent = state.coins.toLocaleString('zh-CN');
    var homeCoins = $('#home-coins');
    if (homeCoins) homeCoins.textContent = state.coins.toLocaleString('zh-CN');
    $('#shop-coins').textContent = state.coins.toLocaleString('zh-CN');
    renderSync();
  }

  var levelUpTimer = null;

  function petSizeForLevel(lv) {
    if (lv >= 9) return 92;
    if (lv >= 7) return 84;
    if (lv >= 5) return 76;
    if (lv >= 3) return 68;
    return 60;
  }

  function playLevelUp() {
    if (!els.pet) return;
    els.pet.classList.remove('is-levelup');
    void els.pet.offsetWidth;
    els.pet.classList.add('is-levelup');
    clearTimeout(levelUpTimer);
    levelUpTimer = setTimeout(function () { els.pet.classList.remove('is-levelup'); }, 800);
  }

  function addXp(n) {
    n = Math.max(0, Math.floor(parseInt(n, 10) || 0));
    if (!n) return 0;
    var before = levelInfo(state.xp).level;
    state.xp = (parseInt(state.xp, 10) || 0) + n;
    var info = levelInfo(state.xp);
    state.level = info.level;
    save();
    updatePetBubble();
    if (info.level > before) playLevelUp();
    return n;
  }

  function updatePetBubble() {
    var info = levelInfo(state.xp);
    els.petLevel.textContent = info.total > 0 ? 'Lv.' + info.level + ' · ' + info.total + ' XP' : 'Lv.' + info.level;
    els.petExp.style.width = Math.min(100, Math.round((info.cur / info.need) * 100)) + '%';
    els.petGoalText.textContent = '距 Lv.' + (info.level + 1) + ' 还需 ' + (info.need - info.cur) + ' XP';
    els.petStreak.textContent = state.streak;
    els.petStreakBadge.classList.toggle('hidden', !state.streak);
    if (els.pet) els.pet.dataset.size = String(petSizeForLevel(info.level));

    var nameEl = $('#pet-name');
    if (nameEl) nameEl.textContent = state.petName || '小鹿';
  }

  function updatePetHappy() {
    var happy = state.streak >= 5 && currentView === 'quiz';
    els.pet.classList.toggle('is-happy', happy);
  }

  /* ---------------- 视图 ---------------- */
  function showView(name) {
    var prev = currentView;
    if (prev === 'quiz' && name !== 'quiz') pauseSessionClock();
    if (name === 'shop' && prev === 'home') homeScroll = window.scrollY;
    currentView = name;
    ['home', 'quiz', 'shop', 'result'].forEach(function (v) {
      $('#view-' + v).classList.toggle('hidden', v !== name);
    });
    els.bar.classList.toggle('hidden', name !== 'quiz');
    els.pet.classList.toggle('hidden', name !== 'quiz');
    $('#btn-back').classList.toggle('hidden', name === 'home');
    document.body.classList.toggle('has-bar', name === 'quiz');
    document.body.dataset.page = name;
    document.body.dataset.view = name;
    applyFocusMode();
    $('#brand-text').textContent =
      name === 'home' ? '刷题助手' : name === 'shop' ? '金币商城' : name === 'result' ? '练习结果' : '顺序练习';

    if (name !== 'quiz') {
      closeBubble();
      clearTimeout(idleTimer);
      resetRoam();
      hideSmash();
      hideCombo();
    }
    if (name === 'shop') renderShop();
    if (name === 'home') renderHome();
    if (name === 'quiz') {
      if (session && !session.finished) resumeSessionClock();
      updatePetHappy();
      if (session) renderQuestion();
      if (els.pet.dataset.sleep !== '1') restorePose();
      scheduleIdle();
      scheduleAvoid();
    }
    if (name === 'home' && prev === 'shop') {
      requestAnimationFrame(function () { window.scrollTo(0, homeScroll); });
    } else {
      window.scrollTo(0, 0);
    }
  }

  /* ---------------- 首页 ---------------- */
  function filteredQuestions() {
    var subject = $('#filter-subject').value;
    var chapter = $('#filter-chapter').value;
    return QUESTIONS.filter(function (q) {
      if (subject && q.subject !== subject) return false;
      if (chapter && q.chapter !== chapter) return false;
      return true;
    });
  }

  /* ---------------- 易错题清单弹窗 ---------------- */
  function weakIds() {
    return Object.keys(state.weak || {}).filter(function (id) { return !!QMAP[id]; });
  }

  function renderWeakList() {
    var box = $('#weak-list');
    if (!box) return;
    var ids = weakIds();
    if (!ids.length) {
      box.innerHTML = '<p class="weak-empty">暂无易错题。同一题累计答错 3 次会自动加入。</p>';
      return;
    }
    box.innerHTML = ids.map(function (id) {
      var q = QMAP[id];
      return '<div class="weak-item">' +
        '<div class="weak-item-body"><strong>' + esc(q.stem) + '</strong>' +
        '<small>' + esc(q.subject || '') + ' · ' + esc(q.chapter || '') + ' · 答错 ' + (state.wrongCount[id] || 0) + ' 次</small></div>' +
        '<button class="btn ghost weak-remove" type="button" data-id="' + esc(id) + '">移除</button>' +
        '</div>';
    }).join('');
  }

  function openWeak() {
    renderWeakList();
    $('#weak-modal').classList.remove('hidden');
  }

  function closeWeak() {
    $('#weak-modal').classList.add('hidden');
  }

  function renderHome() {
    var answeredIds = Object.keys(state.answered);
    var wrongIds = Object.keys(state.wrong);
    var correct = 0;
    answeredIds.forEach(function (id) { if (state.answered[id] && state.answered[id].correct) correct += 1; });
    var acc = answeredIds.length ? Math.round((correct / answeredIds.length) * 100) : 0;

    $('#stat-total').textContent = QUESTIONS.length;
    $('#stat-answered').textContent = answeredIds.length;
    $('#stat-wrong').textContent = wrongIds.length;
    $('#stat-acc').textContent = acc + '%';

    var pool = filteredQuestions();
    var poolSet = {};
    pool.forEach(function (q) { poolSet[q.id] = true; });
    var wrongCount = wrongIds.filter(function (id) { return poolSet[id]; }).length;
    var favCount = Object.keys(state.fav).filter(function (id) { return poolSet[id]; }).length;
    var weakCount = Object.keys(state.weak || {}).filter(function (id) { return poolSet[id] && QMAP[id]; }).length;

    $('#count-order').textContent = pool.length + ' 题';
    $('#count-random').textContent = pool.length + ' 题';
    $('#count-wrong').textContent = wrongCount + ' 题';
    $('#count-fav').textContent = favCount + ' 题';
    var weakBtn = $('#btn-weak');
    if (weakBtn) {
      weakBtn.classList.toggle('is-empty', weakCount === 0);
      weakBtn.setAttribute('aria-label', weakCount ? '易错题练习，共 ' + weakCount + ' 题' : '易错题练习：同一题答错 3 次才会进来');
      weakBtn.title = weakCount ? '进入易错题练习' : '答错 3 次才会进来';
      var weakCountEl = $('#btn-weak-count');
      if (weakCountEl) weakCountEl.textContent = weakCount;
    }
    if ($('#weak-open')) {
      $('#weak-open').classList.toggle('hidden', weakCount === 0);
      if ($('#weak-open-count')) $('#weak-open-count').textContent = weakCount;
    }
    renderWeakList();
    $('#filter-count').textContent = '当前范围 ' + pool.length + ' 题';
    var goalSel = $('#daily-goal');
    if (goalSel && parseInt(goalSel.value, 10) !== goalSize()) goalSel.value = String(goalSize());

    updateFestivalBanner();
    updateTopbar();
    renderBlind();
    renderResumeCard();
    renderStreakCard();
  }

  function resumeSummary(r) {
    if (!r || !Array.isArray(r.ids) || !r.ids.length) return null;
    return {
      mode: MODE_LABEL[r.mode] || '练习',
      pos: Math.min((parseInt(r.index, 10) || 0) + 1, r.ids.length),
      total: r.ids.length,
      answered: Object.keys(r.entries || {}).length
    };
  }

  function renderResumeCard() {
    var card = $('#resume-card');
    if (!card) return;
    var s = resumeSummary(state.resume);
    if (!s) { card.classList.add('hidden'); return; }
    $('#resume-title').textContent = '继续上次练习';
    $('#resume-desc').textContent = s.mode + ' · 第 ' + s.pos + ' / ' + s.total + ' 题 · 已答 ' + s.answered + ' 题';
    card.classList.remove('hidden');
  }

  function updateFestivalBanner() {
    var fest = festivalName();
    var banner = $('#festival-banner');
    if (!fest) {
      banner.classList.add('hidden');
      return;
    }
    var key = dateKey(effectiveDate()) + '|' + fest;
    if (state.festClosed === key) {
      banner.classList.add('hidden');
      return;
    }
    $('#fb-title').textContent = fest + ' · 节日特惠';
    $('#fb-desc').textContent = '商城全场 5 折，今天买最划算（按本地日期判断）';
    banner.classList.remove('hidden');
  }

  /* ---------------- 易错题（累计答错 3 次） ---------------- */
  function markWrong(id) {
    state.wrong[id] = true;
    if (!state.wrongCount) state.wrongCount = {};
    var n = (parseInt(state.wrongCount[id], 10) || 0) + 1;
    state.wrongCount[id] = n;
    if (n >= 3) {
      if (!state.weak) state.weak = {};
      state.weak[id] = true;
    }
  }

  /* ---------------- 错题清盲点 ---------------- */
  function blindStats() {
    if (!state.blind) state.blind = {};
    var total = 0;
    var cleared = 0;
    Object.keys(state.blind).forEach(function (id) {
      total += 1;
      if (state.blind[id] === 'cleared') cleared += 1;
    });
    return { total: total, cleared: cleared, pending: Math.max(0, total - cleared) };
  }

  function blindWrong(id) {
    if (!state.blind) state.blind = {};
    state.blind[id] = 'active';
  }

  /* 只有 active → cleared 才算「划掉一个」，返回 true 用于播放动效 */
  function blindClear(id) {
    if (!state.blind) state.blind = {};
    if (state.blind[id] !== 'active') return false;
    state.blind[id] = 'cleared';
    return true;
  }

  function renderBlind() {
    var stats = blindStats();
    var pct = stats.total ? Math.round((stats.cleared / stats.total) * 100) : 0;
    var pending = 0;
    Object.keys(state.blind || {}).forEach(function (id) {
      if (state.blind[id] === 'active' && QMAP[id]) pending += 1;
    });

    // 首页：只写「累计消灭 X 道」，不再出现 X/总数
    var sub = $('#blind-sub-count');
    if (sub) sub.textContent = stats.cleared;
    var link = $('#blind-open');
    if (link) {
      link.classList.toggle('hidden', pending === 0);
      var linkCount = $('#blind-open-count');
      if (linkCount) linkCount.textContent = pending;
    }

    var bar = $('#blind-bar');
    if (bar) {
      bar.classList.toggle('hidden', !(session && session.mode === 'wrong'));
      var c = $('#blind-cleared');
      if (c) c.textContent = stats.cleared;
      var fill = $('#blind-fill');
      if (fill) fill.style.width = pct + '%';
    }
  }

  function goalSize() {
    return state.dailyGoal || 20;
  }

  function renderStreakCard() {
    var host = $('#streak-days');
    if (!host) return;
    var now = new Date();
    var count = 0;
    var cells = [];
    for (var i = 6; i >= 0; i -= 1) {
      var d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      var key = dateKey(d);
      var n = state.studyLog[key] || 0;
      cells.push('<div class="streak-day' + (n ? ' has' : '') + (i === 0 ? ' today' : '') + '"><div class="streak-dot">' + (n || '·') + '</div><span>' + (i === 0 ? '今天' : (d.getMonth() + 1) + '/' + d.getDate()) + '</span></div>');
    }
    for (var j = 0; j < 60; j += 1) {
      var dd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - j);
      if (!state.studyLog[dateKey(dd)]) break;
      count += 1;
    }
    $('#streak-title').textContent = '连续学习 ' + count + ' 天';
    host.innerHTML = cells.join('');
  }

  function applyFocusMode() {
    var on = !!state.focus && currentView === 'quiz';
    document.body.classList.toggle('focus-mode', on);
    var btn = $('#btn-focus');
    if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  }

  function pendingBlindIds() {
    return Object.keys(state.blind || {}).filter(function (id) {
      return state.blind[id] === 'active' && !!QMAP[id];
    });
  }

  function renderBlindSheet() {
    var ids = pendingBlindIds();
    var list = $('#blind-list');
    if (!list) return;
    $('#blind-summary').textContent = '累计消灭 ' + blindStats().cleared + ' 道 · 还有 ' + ids.length + ' 道待消灭';
    if (!ids.length) {
      list.innerHTML = '<p class="muted">目前没有待消灭的错题，继续保持。</p>';
    } else {
      list.innerHTML = ids.slice(0, 50).map(function (id) {
        var q = QMAP[id];
        return '<div class="blind-row"><span>' + esc(q.stem) + '</span><em>' + TYPE_LABEL[q.type] + '</em></div>';
      }).join('');
    }
    $('#blind-start').classList.toggle('hidden', !ids.length);
  }

  function strikeBlind() {
    var host = $('#blind-strike');
    if (!host || !session) return;
    var chip = document.createElement('span');
    chip.className = 'blind-chip';
    chip.textContent = '第 ' + (session.index + 1) + ' 题';
    host.appendChild(chip);
    setTimeout(function () { chip.classList.add('cut'); }, 30);
    setTimeout(function () { chip.classList.add('gone'); }, 900);
    setTimeout(function () { if (chip.parentNode) chip.parentNode.removeChild(chip); }, 1400);
  }

  /* ---------------- 题型成就徽章 ---------------- */
  function badgeGroupStats() {
    var map = {};
    BADGES.forEach(function (b) { map[b.key] = { answered: 0, correct: 0 }; });
    Object.keys(state.answered || {}).forEach(function (id) {
      var q = QMAP[id];
      if (!q || !map[q.chapter]) return;
      map[q.chapter].answered += 1;
      if (state.answered[id] && state.answered[id].correct) map[q.chapter].correct += 1;
    });
    return map;
  }

  function badgeAccuracy(key) {
    var g = badgeGroupStats()[key];
    if (!g || !g.answered) return 0;
    return Math.round((g.correct / g.answered) * 100);
  }

  function fmtMinute(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function renderBadges() {
    var host = $('#quiz-badges');
    if (!host) return;
    var html = '';
    BADGES.forEach(function (b) {
      if (!state.badges || !state.badges[b.key]) return;
      html += '<button class="quiz-badge" type="button" data-badge="' + b.key + '" title="' + b.name + '" aria-label="' + b.name + '">' + b.icon + '</button>';
    });
    host.innerHTML = html;
    host.classList.toggle('hidden', !html);
  }

  function checkBadges() {
    if (!state.badges) state.badges = {};
    var stats = badgeGroupStats();
    var unlocked = [];
    BADGES.forEach(function (b) {
      if (state.badges[b.key]) return;
      var g = stats[b.key];
      if (!g || g.answered < BADGE_MIN_ANSWERED) return;
      if (Math.round((g.correct / g.answered) * 100) < BADGE_MIN_ACC) return;
      state.badges[b.key] = Date.now();
      unlocked.push(b);
    });
    if (!unlocked.length) return;
    save();
    renderBadges();
    toast('🏅 解锁成就 · ' + unlocked.map(function (b) { return b.name; }).join('、'));
  }

  function openBadgePop(key) {
    var meta = null;
    BADGES.forEach(function (b) { if (b.key === key) meta = b; });
    if (!meta || !state.badges || !state.badges[key]) return;
    var pop = $('#badge-pop');
    pop.innerHTML = '<span class="badge-pop-icon">' + meta.icon + '</span>' +
      '<strong>' + meta.name + '</strong>' +
      '<span class="badge-pop-sub">' + meta.key + ' · 正确率 ' + badgeAccuracy(key) + '%（≥' + BADGE_MIN_ACC + '% 解锁）</span>' +
      '<small>解锁于 ' + fmtMinute(state.badges[key]) + '</small>';
    pop.classList.remove('hidden');
  }

  /* ---------------- 随机彩蛋 ---------------- */
  function randBetween(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  function eggPop(text, cls) {
    var host = $('#egg-fly');
    if (!host) return;
    var span = document.createElement('span');
    span.className = 'egg-item ' + (cls || '');
    span.textContent = text;
    span.style.left = (14 + Math.random() * 50).toFixed(1) + '%';
    host.appendChild(span);
    setTimeout(function () { if (span.parentNode) span.parentNode.removeChild(span); }, 1700);
  }

  function dropLimited() {
    var pool = LIMITED.filter(function (item) { return !state.owned['bg:' + item.id]; });
    if (!pool.length) return;
    var item = pool[Math.floor(Math.random() * pool.length)];
    state.owned['bg:' + item.id] = true;
    save();
    eggPop('★ 限定装饰', 'decor');
    showRewardToast('彩蛋 · 解锁' + item.name + '，已放进商城「背景」的限定兑换区。');
  }

  /* 只有首次答对才调用（由 submitAnswer 判断），同一题只判定一次 */
  function rollEgg(q) {
    if (!state.eggSeen) state.eggSeen = {};
    if (state.eggSeen[q.id]) return;
    state.eggSeen[q.id] = true;
    save();

    if (Math.random() < EGG.rate * EGG.rateScale) {
      var roll = Math.random();
      var acc = 0;
      var tier = EGG.tiers[EGG.tiers.length - 1];
      for (var i = 0; i < EGG.tiers.length; i += 1) {
        acc += EGG.tiers[i].rate;
        if (roll < acc) { tier = EGG.tiers[i]; break; }
      }
      if (tier.key === 'fragment') {
        changeFragments(tier.amount);
        if (session) session.eggFragments = (session.eggFragments || 0) + tier.amount;
        save();
        updateTopbar();
        renderFragBar();
        eggPop('✦ 碎片 +' + tier.amount, 'frag');
        toast('彩蛋 · 限定碎片 +' + tier.amount + '（' + state.fragments + '/' + EGG.fragmentCost + '）');
      } else {
        var coins = Math.round(randBetween(tier.min, tier.max) * EGG.valueScale);
        changeCoins(coins);
        if (session) session.eggCoins = (session.eggCoins || 0) + coins;
        save();
        updateTopbar();
        eggPop('+' + coins, 'coin');
      }
    }

    // 与 12% 掉落相互独立
    if (Math.random() < EGG.decorRate * EGG.rateScale) dropLimited();
  }

  /* ---------------- 答题 ---------------- */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i -= 1) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------------- 练习续做（静默保存，不弹确认） ---------------- */
  /* 只统计真正停留在答题页的时间；切页/隐藏/关闭时暂停，回来再继续 */
  function sessionActiveMs() {
    if (!session) return 0;
    return (session.activeMs || 0) + (session.segmentStart ? Math.max(0, Date.now() - session.segmentStart) : 0);
  }

  function pauseSessionClock() {
    if (!session || session.finished) return;
    session.activeMs = sessionActiveMs();
    session.segmentStart = null;
  }

  function resumeSessionClock() {
    if (!session || session.finished || session.segmentStart) return;
    session.segmentStart = Date.now();
  }

  function saveResume() {
    if (!session) return;
    if (session.finished) {
      state.resume = null;
      save();
      return;
    }
    state.resume = {
      mode: session.mode,
      ids: session.ids.slice(),
      index: session.index,
      entries: session.entries,
      drafts: session.drafts,
      picked: picked.slice(),
      startedAt: session.startedAt,
      activeMs: sessionActiveMs(),
      savedAt: Date.now()
    };
    save();
    if (session.mode === 'exam') scheduleDraftSync();
  }

  function restoreResume() {
    var r = state.resume;
    if (!r || !Array.isArray(r.ids) || !r.ids.length) return false;
    var ids = r.ids.filter(function (id) { return !!QMAP[id]; });
    if (!ids.length) {
      state.resume = null;
      save();
      return false;
    }
    var legacyMs = Math.max(0, (r.savedAt || Date.now()) - (r.startedAt || Date.now()));
    session = {
      mode: MODE_LABEL[r.mode] ? r.mode : 'order',
      ids: ids,
      index: Math.min(Math.max(0, parseInt(r.index, 10) || 0), ids.length - 1),
      entries: r.entries && typeof r.entries === 'object' ? r.entries : {},
      drafts: r.drafts && typeof r.drafts === 'object' ? r.drafts : {},
      startedAt: r.startedAt || Date.now(),
      activeMs: typeof r.activeMs === 'number' ? r.activeMs : legacyMs,
      segmentStart: Date.now(),
      finished: false
    };
    picked = Array.isArray(r.picked) ? r.picked.slice() : [];
    showView('quiz');
    return true;
  }

  function startSession(mode, limit) {
    ensureDaily();
    var pool;
    if (mode === 'wrong') {
      pool = Object.keys(state.wrong).map(function (id) { return QMAP[id]; }).filter(Boolean);
    } else if (mode === 'weak') {
      pool = Object.keys(state.weak || {}).map(function (id) { return QMAP[id]; }).filter(Boolean);
    } else if (mode === 'fav') {
      pool = Object.keys(state.fav).map(function (id) { return QMAP[id]; }).filter(Boolean);
    } else if (mode === 'exam') {
      var size = parseInt(($('#exam-size') || {}).value, 10) || 20;
      pool = shuffle(filteredQuestions()).slice(0, size);
    } else {
      pool = filteredQuestions();
    }
    if (mode !== 'order' && mode !== 'random') {
      var subject = $('#filter-subject').value;
      var chapter = $('#filter-chapter').value;
      pool = pool.filter(function (q) {
        if (subject && q.subject !== subject) return false;
        if (chapter && q.chapter !== chapter) return false;
        return true;
      });
    }
    if (!pool.length) {
      if (mode === 'weak') toast('还没有易错题，同一题答错 3 次后会自动加入');
      else if (mode === 'wrong') toast('还没有错题，先去做几题吧');
      else toast('还没有收藏，点底栏收藏按钮试试');
      return;
    }
    if (mode === 'random') pool = shuffle(pool);
    if (limit && pool.length > limit) pool = pool.slice(0, limit);

    session = {
      mode: mode,
      ids: pool.map(function (q) { return q.id; }),
      index: 0,
      entries: {},
      drafts: {},
      startedAt: Date.now(),
      activeMs: 0,
      segmentStart: Date.now(),
      finished: false
    };
    picked = [];
    saveResume();
    if (els.pet.dataset.sleep === '1') els.pet.dataset.sleep = '0';
    showView('quiz');
    setPose('stand');
    // 进入答题页：先给一个加油表情
    actionUntil = 0;
    actionPriority = 0;
    playPose('cheer', 1100, 62);
    scheduleIdle();
    markActive();
  }

  function startWithIds(ids, mode) {
    var pool = (ids || []).map(function (id) { return QMAP[id]; }).filter(Boolean);
    if (!pool.length) { toast('本次没有错题'); return; }
    session = {
      mode: mode || 'wrong',
      ids: pool.map(function (q) { return q.id; }),
      index: 0,
      entries: {},
      drafts: {},
      startedAt: Date.now(),
      activeMs: 0,
      segmentStart: Date.now(),
      finished: false
    };
    picked = [];
    saveResume();
    showView('quiz');
    setPose('stand');
    actionUntil = 0;
    actionPriority = 0;
    playPose('cheer', 1100, 62);
    scheduleIdle();
    markActive();
  }

  function renderQuestion(popLetter, feedback) {
    if (!session) return;
    var q = QMAP[session.ids[session.index]];
    if (!q) return;
    currentQ = q;
    if (questionAtId !== q.id) {
      questionAtId = q.id;
      questionShownAt = Date.now();
    }
    var entry = session.entries[q.id];

    if (!entry) {
      picked = (session.drafts[q.id] || []).slice();
    } else {
      picked = entry.picked.slice();
    }

    $('#quiz-mode').textContent = MODE_LABEL[session.mode] || '练习';
    $('#quiz-count').textContent = (session.index + 1) + ' / ' + session.ids.length;
    var titleEl = $('#quiz-title');
    if (titleEl) {
      var titleItem = state.equipped.title ? findItem('title', state.equipped.title) : null;
      if (titleItem) {
        titleEl.className = 'quiz-title user-title ' + titleItem.tier;
        titleEl.textContent = titleItem.name;
      } else {
        titleEl.className = 'quiz-title user-title hidden';
        titleEl.textContent = '';
      }
    }
    var streakChip = $('#quiz-streak');
    streakChip.classList.toggle('hidden', state.streak <= 0);
    streakChip.textContent = '连对 ' + state.streak;
    $('#q-type').textContent = TYPE_LABEL[q.type] || '单选题';
    $('#q-chapter').textContent = q.chapter || q.subject || '';
    $('#q-stem').textContent = q.stem;

    var letters = 'ABCDEFGH';
    var html = '';
    q.options.forEach(function (text, i) {
      var letter = letters[i];
      var cls = 'option';
      var tag = '';
      if (entry) {
        cls += ' locked';
        var isAns = q.answer.indexOf(letter) >= 0;
        var isPick = entry.picked.indexOf(letter) >= 0;
        if (isAns) cls += ' is-correct';
        else if (isPick) cls += ' is-wrong';
        else cls += ' is-dim';
        if (isAns) tag = '<span class="option-tag">正确答案</span>';
        else if (isPick) tag = '<span class="option-tag">错选</span>';
      } else if (picked.indexOf(letter) >= 0) {
        cls += ' is-selected';
      }
      if (popLetter === letter) cls += ' pop';
      html += '<button class="' + cls + '" type="button" data-letter="' + letter + '" aria-pressed="' + (picked.indexOf(letter) >= 0 ? 'true' : 'false') + '">' +
        '<span class="option-letter">' + letter + '</span>' +
        '<span class="option-text">' + esc(text) + '</span>' + tag + '</button>';
    });
    $('#q-options').innerHTML = html;

    if (entry) {
      var ansLetters = q.answer.join(' ');
      var mine = entry.picked.join(' ') || '未答';
      var notes = entry.notes && entry.notes.length ? ' · ' + entry.notes.join(' · ') : '';
      $('#q-analysis').innerHTML =
        '<div class="analysis-head"><b>答案 ' + ansLetters + '</b>' +
        '<span class="analysis-result ' + (entry.correct ? 'ok' : 'ng') + '">' +
        (entry.correct ? '回答正确' : '这题有点绕，先记下来') + '</span>' +
        '<span class="muted">你选 ' + mine + notes + '</span></div>' +
        '<p><span class="label">解析：</span>' + esc(q.analysis || '题库暂未提供解析，先记住正确答案吧。') + '</p>';
      $('#q-analysis').classList.remove('hidden');
    } else {
      $('#q-analysis').classList.add('hidden');
      $('#q-analysis').innerHTML = '';
    }

    updateBar();

    if (feedback) {
      var target = $('[data-letter="' + feedback.letter + '"]');
      if (target) {
        var span = document.createElement('span');
        span.className = 'opt-feedback';
        span.textContent = feedback.text;
        target.appendChild(span);
        setTimeout(function () {
          span.classList.add('fade');
          setTimeout(function () { if (span.parentNode) span.parentNode.removeChild(span); }, 380);
        }, 2600);
      }
    }

    renderBadges();
    renderBlind();
  }

  function updateBar() {
    if (!session || !currentQ) return;
    var q = currentQ;
    var entry = session.entries[q.id];
    var last = session.index === session.ids.length - 1;

    $('#btn-prev').disabled = session.index === 0;
    $('#btn-fav').textContent = state.fav[q.id] ? '★ 已收藏' : '☆ 收藏';
    $('#btn-fav').classList.toggle('active', !!state.fav[q.id]);

    var label;
    if (q.type === 'multiple' && !entry && picked.length > 0) {
      label = '提交答案';
      mainAction = 'submit';
    } else if (last) {
      label = '交卷 · 查看结果';
      mainAction = 'finish';
    } else {
      label = '下一题';
      mainAction = 'next';
    }
    $('#btn-main').textContent = label;
    $('#btn-main').disabled = false;
  }

  function sameSet(a, b) {
    if (a.length !== b.length) return false;
    var x = a.slice().sort().join('');
    var y = b.slice().sort().join('');
    return x === y;
  }

  function submitAnswer() {
    if (!session || !currentQ) return;
    var q = currentQ;
    if (session.entries[q.id]) return;
    if (!picked.length) {
      toast('先选一个答案吧');
      return;
    }

    ensureDaily();
    var correct = sameSet(picked, q.answer);
    var wasWrongBefore = !!state.wrong[q.id];
    var hadAnswered = !!state.answered[q.id];
    var isExam = session.mode === 'exam';
    var firstCorrect = correct && !state.solved[q.id];
    var blindCleared = false;
    var gained = 0;
    var notes = [];

    if (isExam) {
      // 考试整体结算：答对不单独发金币，也不打断平时连对
      if (correct) {
        state.solved[q.id] = true;
        if (state.wrong[q.id]) delete state.wrong[q.id];
        blindCleared = blindClear(q.id);
        state.wrongStreak = 0;
        playPose('like', 1000, 82);
      } else {
        markWrong(q.id);
        blindWrong(q.id);
        wrongAnswerPose(hadAnswered);
      }
    } else {
      if (!state.daily.first) {
        state.daily.first = true;
        gained += 50;
        notes.push('今日首刷 +50');
      }

      if (correct) {
        playPose('like', 1000, 82);
        if (!state.solved[q.id]) {
          gained += 10;
          state.solved[q.id] = true;
          notes.push('答对 +10');
        }
        state.streak += 1;
        if (state.streak > state.bestStreak) state.bestStreak = state.streak;
        if (state.streak % 3 === 0) {
          gained += 30;
          notes.push('连对 ' + state.streak + ' +30');
        }
        if (state.streak % 10 === 0) {
          gained += 100;
          notes.push('连对 ' + state.streak + ' +100');
        }
        if (state.wrong[q.id]) delete state.wrong[q.id];
        blindCleared = blindClear(q.id);
        state.daily.ids[q.id] = true;
        state.wrongStreak = 0;
      } else {
        state.streak = 0;
        markWrong(q.id);
        blindWrong(q.id);
        wrongAnswerPose(hadAnswered);
      }
    }

    state.answered[q.id] = { picked: picked.slice(), correct: correct, ts: Date.now() };
    var tk = todayKey();
    state.studyLog[tk] = (state.studyLog[tk] || 0) + 1;
    if (navigator.vibrate) {
      try { navigator.vibrate(correct ? 8 : [10, 40, 10]); } catch (e) {}
    }
    if (!isExam && gained) changeCoins(gained);
    if (!isExam && correct) addXp(XP_PER_CORRECT);
    checkBadges();
    if (firstCorrect) rollEgg(q);

    session.entries[q.id] = {
      picked: picked.slice(),
      correct: correct,
      gain: gained,
      notes: notes
    };

    saveResume();
    save();
    scheduleSync();

    var fbLetter = correct ? picked[picked.length - 1] : picked[0];
    var fbText = isExam ? (correct ? '答对了，继续下一题' : pickWrong()) : (correct ? pickRight(gained) : pickWrong());

    renderQuestion(null, { letter: fbLetter, text: fbText });

    updateTopbar();
    updatePetBubble();
    updatePetHappy();
    updateBar();
    renderBadges();
    renderBlind();
    if (blindCleared && session.mode === 'wrong' && correct) strikeBlind();

    if (correct && !isExam) {
      if (gained > 0) petPlus(gained);
      dropFx();
      // 错题重做里用顶部「划掉」轻动效，不再叠消消乐大弹层
      if (wasWrongBefore && session.mode !== 'wrong') showSmash(gained || 1);
      var milestone = 0;
      if (state.streak % 10 === 0) milestone += 100;
      if (state.streak % 3 === 0) milestone += 30;
      if (milestone) showCombo(state.streak, milestone);
      if (state.streak === 3 || state.streak === 5) {
        actionUntil = 0;
        actionPriority = 0;
        if (state.streak === 3) playPose('roll', 1500, 85);
        if (state.streak === 5) playPose('wave', 1500, 86);
      }
    } else if (correct && isExam) {
      dropFx();
    } else {
      updatePetHappy();
    }

    // 今日达标轻提示
    var todayCount = Object.keys(state.daily.ids).length;
    if (todayCount >= goalSize() && !state.daily.goalShown) {
      state.daily.goalShown = true;
      save();
      showRewardToast(pickByDate(DAILY_LINES));
    }

    markActive();
  }

  function goNext() {
    if (!session) return;
    var q = currentQ;
    var entry = q ? session.entries[q.id] : null;
    if (session.index < session.ids.length - 1) {
      session.index += 1;
      picked = [];
      actionUntil = 0;
      actionPriority = 0;
      if (entry && entry.correct) playPose('jump', 760, 80);
      else playPose('run', 620, 40);
      renderQuestion();
      window.scrollTo(0, 0);
    }
    saveResume();
    markActive();
  }

  function goPrev() {
    if (!session || session.index === 0) return;
    session.index -= 1;
    picked = [];
    renderQuestion();
    window.scrollTo(0, 0);
    saveResume();
    markActive();
  }

  function onOptionClick(e) {
    var btn = e.target.closest ? e.target.closest('.option') : null;
    if (!btn || !session || !currentQ) return;
    if (session.entries[currentQ.id]) return;
    var letter = btn.dataset.letter;

    if (currentQ.type === 'multiple') {
      var idx = picked.indexOf(letter);
      if (idx >= 0) picked.splice(idx, 1);
      else picked.push(letter);
      picked.sort();
      session.drafts[currentQ.id] = picked.slice();
      renderQuestion(letter);
      updateBar();
    } else {
      picked = [letter];
      session.drafts[currentQ.id] = picked.slice();
      renderQuestion(letter);
      setTimeout(submitAnswer, 130);
    }
    saveResume();
    markActive();
  }

  /* ---------------- 交卷成绩单 ---------------- */
  function gradeFor(score) {
    if (score >= 100) return '满分王者';
    if (score >= 95) return '高分通过';
    if (score >= 90) return '稳健通关';
    if (score >= 60) return '及格通关';
    return '继续加油';
  }

  function renderExamReport(score, correct, total, elapsed) {
    var mm = Math.floor(elapsed / 60);
    var ss = elapsed % 60;
    var titleItem = state.equipped.title ? findItem('title', state.equipped.title) : null;
    var titleName = titleItem ? titleItem.name : '未佩戴称号';
    var now = new Date();
    var dateText = dateKey(now) + ' ' + pad2(now.getHours()) + ':' + pad2(now.getMinutes());
    var grade = gradeFor(score);

    lastReport = {
      score: score,
      grade: grade,
      time: mm + ':' + pad2(ss),
      correct: correct + ' / ' + total,
      title: titleName,
      date: dateText,
      total: total
    };
    lastReportDataURL = '';
    var shareBtn = $('#report-share');
    if (shareBtn) shareBtn.classList.toggle('hidden', !navigator.share);

    $('#report-score').textContent = score;
    $('#report-grade').textContent = grade;
    $('#report-time').textContent = lastReport.time;
    $('#report-correct').textContent = lastReport.correct;
    $('#report-title').textContent = titleName;
    $('#report-date').textContent = dateText;
    $('#report-foot').textContent = score >= 90
      ? '超过 90 分奖励线，这份成绩可以发给朋友看看'
      : '离 90 分奖励线还差 ' + (90 - score) + ' 分，再来一次';
    $('#exam-report').classList.remove('hidden');
  }

  function exportReport() {
    if (!lastReport) return;
    var cs = getComputedStyle(document.documentElement);
    function pick(name, fallback) {
      var v = (cs.getPropertyValue(name) || '').trim();
      return v || fallback;
    }
    var colorBg = pick('--bg', '#eef1ec');
    var colorCard = pick('--card', '#ffffff');
    var colorText = pick('--text', '#333a34');
    var colorMuted = pick('--muted', '#7c877e');
    var colorAccent = pick('--accent', '#7c9a86');
    var colorAccentStrong = pick('--accent-strong', '#5f7d6a');
    var colorBorder = pick('--border', '#dfe5dd');

    var W = 1080;
    var H = 1440;
    var cv = document.createElement('canvas');
    cv.width = W;
    cv.height = H;
    var ctx = cv.getContext('2d');
    var font = '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif';

    ctx.fillStyle = colorBg;
    ctx.fillRect(0, 0, W, H);

    // 右上角柔光
    var glow = ctx.createRadialGradient(W - 120, 90, 20, W - 120, 90, 620);
    glow.addColorStop(0, colorAccent + '55');
    glow.addColorStop(1, colorAccent + '00');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // 卡片
    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.10)';
    ctx.shadowBlur = 40;
    ctx.shadowOffsetY = 18;
    ctx.fillStyle = colorCard;
    roundRect(84, 120, 912, 1200, 48);
    ctx.fill();
    ctx.restore();

    ctx.textAlign = 'center';
    ctx.fillStyle = colorMuted;
    ctx.font = '600 26px ' + font;
    ctx.fillText('2026 · 二级建造师 · 模拟考试', W / 2, 220);

    ctx.fillStyle = colorText;
    ctx.font = '800 34px ' + font;
    ctx.fillText('成 绩 单', W / 2, 282);

    // 分数
    ctx.fillStyle = colorAccentStrong;
    ctx.font = '800 230px ' + font;
    var scoreText = String(lastReport.score);
    ctx.fillText(scoreText, W / 2 - 18, 600);
    var sw = ctx.measureText(scoreText).width;
    ctx.fillStyle = colorMuted;
    ctx.font = '600 40px ' + font;
    ctx.fillText('分', W / 2 - 18 + sw / 2 + 34, 600);

    // 等级胶囊
    ctx.fillStyle = colorAccent + '22';
    roundRect(W / 2 - 150, 650, 300, 68, 34);
    ctx.fill();
    ctx.fillStyle = colorAccentStrong;
    ctx.font = '700 32px ' + font;
    ctx.fillText(lastReport.grade, W / 2, 696);

    // 分割线
    ctx.strokeStyle = colorBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(160, 790);
    ctx.lineTo(W - 160, 790);
    ctx.stroke();

    // 四行数据
    var rows = [
      ['用时', lastReport.time],
      ['答对', lastReport.correct],
      ['装备称号', lastReport.title],
      ['考试日期', lastReport.date]
    ];
    rows.forEach(function (row, i) {
      var y = 860 + i * 100;
      ctx.textAlign = 'left';
      ctx.fillStyle = colorMuted;
      ctx.font = '500 30px ' + font;
      ctx.fillText(row[0], 168, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = colorText;
      var size = 34;
      ctx.font = '700 ' + size + 'px ' + font;
      while (ctx.measureText(row[1]).width > 520 && size > 20) {
        size -= 2;
        ctx.font = '700 ' + size + 'px ' + font;
      }
      ctx.fillText(row[1], W - 168, y);
    });

    ctx.strokeStyle = colorBorder;
    ctx.beginPath();
    ctx.moveTo(160, 1206);
    ctx.lineTo(W - 160, 1206);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = colorMuted;
    ctx.font = '500 26px ' + font;
    ctx.fillText('二建刷题助手 · 每天练几题，稳步上岸', W / 2, 1256);

    ctx.fillStyle = colorAccent;
    ctx.font = '700 24px ' + font;
    ctx.fillText('题型覆盖 单选 / 多选 / 判断 · 共 ' + lastReport.total + ' 题', W / 2, 1298);

    // 生成 PNG：全部在点击事件同步链里完成，避免 iOS 拦截
    var filename = '二建模拟考试成绩单-' + lastReport.score + '分.png';
    var dataUrl;
    try {
      dataUrl = cv.toDataURL('image/png');
    } catch (e) {
      toast('导出失败，请再试一次');
      return;
    }
    lastReportDataURL = dataUrl;
    var ua = navigator.userAgent;
    var needsPreview = /iPhone|iPad|iPod|MicroMessenger/i.test(ua);
    if (needsPreview) {
      $('#report-preview-img').src = dataUrl;
      $('#report-preview').classList.remove('hidden');
      toast('已生成图片，长按保存到相册');
    } else {
      var a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { a.remove(); }, 300);
      toast('成绩单已保存为图片');
    }
  }

  function shareReport() {
    if (!lastReport || !lastReportDataURL || !navigator.share) return;
    var text = '二建模拟考试 ' + lastReport.score + ' 分 · ' + lastReport.grade + '，用时 ' + lastReport.time;
    try {
      var bin = atob(lastReportDataURL.split(',')[1]);
      var arr = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i += 1) arr[i] = bin.charCodeAt(i);
      var file = new File([arr], '二建模拟考试成绩单-' + lastReport.score + '分.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({ files: [file], title: '二建模拟考试成绩单', text: text }).catch(function () {});
        return;
      }
      navigator.share({ title: '二建模拟考试成绩单', text: text }).catch(function () {});
    } catch (e) {
      toast('当前浏览器不支持分享，可保存图片后发送');
    }
  }

  function finishSession() {
    if (!session) return;
    if (session.finished) return;
    var ids = session.ids;
    var entries = session.entries;
    var answered = 0;
    var correct = 0;
    ids.forEach(function (id) {
      if (entries[id]) {
        answered += 1;
        if (entries[id].correct) correct += 1;
      }
    });
    if (!answered) {
      toast('还没有作答，先做一题吧');
      return;
    }
    session.finished = true;
    pauseSessionClock();
    state.resume = null;
    save();

    var isExam = session.mode === 'exam';
    if (isExam) clearCloudDraft();
    scheduleSync();
    var score = isExam ? Math.round((correct / ids.length) * 100) : Math.round((correct / answered) * 100);
    var wrong = answered - correct;
    var unanswered = ids.length - answered;
    lastWrongIds = ids.filter(function (id) { return entries[id] && !entries[id].correct; });
    var redoBtn = $('#btn-redo-wrong');
    if (redoBtn) redoBtn.classList.toggle('hidden', !lastWrongIds.length);
    var elapsed = Math.max(1, Math.round(sessionActiveMs() / 1000));
    var mm = Math.floor(elapsed / 60);
    var ss = elapsed % 60;

    var high = score >= 80;
    $('#score-ring').style.setProperty('--score', score);
    $('#result-score').textContent = score;
    $('#result-title').textContent = isExam
      ? (score >= 90 ? '考试完成，奖励已到账' : '差一点就到奖励线，再来一次')
      : (high ? '表现出色，继续保持' : '基础还需巩固，建议错题重做');
    $('#result-correct').textContent = correct;
    $('#result-wrong').textContent = wrong;
    $('#result-unanswered').textContent = unanswered;
    $('#result-time').textContent = mm + ':' + pad2(ss);
    var eggEl = $('#result-egg');
    var eggCoins = session.eggCoins || 0;
    var eggFrags = session.eggFragments || 0;
    if (eggEl) {
      if (eggCoins || eggFrags) {
        eggEl.textContent = '本次彩蛋：' + (eggCoins ? '金币 +' + eggCoins : '') + (eggCoins && eggFrags ? ' · ' : '') + (eggFrags ? '限定碎片 +' + eggFrags : '');
        eggEl.classList.remove('hidden');
      } else {
        eggEl.classList.add('hidden');
      }
    }
    $('#result-eyebrow').textContent = MODE_LABEL[session.mode] + (isExam ? ' · 本次考试结果' : ' · 本次练习结果');

    if (isExam) {
      renderExamReport(score, correct, ids.length, elapsed);
    } else {
      $('#exam-report').classList.add('hidden');
    }

    if (isExam) {
      var tier = examRewardFor(score);
      if (!session.rewarded) {
        session.rewarded = true;
        session.examCoins = tier.coins;
        if (tier.coins > 0) {
          changeCoins(tier.coins);
          save();
          updateTopbar();
        }
      }
      if (!session.xpRewarded) {
        session.xpRewarded = true;
        session.examXp = examXpFor(score);
        addXp(session.examXp);
      }
      $('#result-exam-reward').classList.remove('hidden');
      $('#result-exam-tier').textContent = tier.coins > 0 ? tier.label : '本次未达奖励线';
      $('#result-exam-coins').textContent = tier.coins > 0 ? '+' + tier.coins + ' 金币' : '0 金币';
      $('#result-exam-text').textContent = tier.coins > 0
        ? '百分制 ' + score + ' 分，已发放考试奖金，经验 +' + session.examXp + ' XP，记得回来继续刷题。'
        : '这次没到奖励线，经验 +' + session.examXp + ' XP，再来一次。90 分起就有金币奖励。';
      $('#result-reward').classList.add('hidden');
    } else {
      $('#result-exam-reward').classList.add('hidden');
      $('#result-reward-tag').textContent = high ? '高分鼓励' : '错题安慰';
      $('#result-reward-text').textContent = pickByDate(high ? HIGH_LINES : LOW_LINES);
      $('#result-reward').classList.remove('hidden');
    }

    // 逐题回顾（只列已答，最多 60 条）
    var review = $('#review-list');
    review.innerHTML = '';
    var shown = 0;
    ids.forEach(function (id, i) {
      var entry = entries[id];
      if (!entry || shown >= 60) return;
      shown += 1;
      var q = QMAP[id];
      if (!q) return;
      var wrongPick = entry.picked.filter(function (l) { return q.answer.indexOf(l) < 0; });
      var yourAns = entry.picked.length ? entry.picked.join(' ') : '未答';
      var card = document.createElement('article');
      card.className = 'card review-card';
      card.innerHTML =
        '<div class="review-head"><span class="review-index">第 ' + (i + 1) + ' 题</span>' +
        '<span class="pill">' + (TYPE_LABEL[q.type] || '单选题') + '</span>' +
        '<span class="review-status ' + (entry.correct ? 'ok' : 'ng') + '">' + (entry.correct ? '答对' : '答错') + '</span></div>' +
        '<p class="review-stem">' + esc(q.stem) + '</p>' +
        '<div class="review-answers"><span>正确答案 <b>' + q.answer.join(' ') + '</b></span>' +
        '<span>你的答案 <b>' + yourAns + '</b></span></div>' +
        '<p class="review-analysis"><span class="label">解析：</span>' +
        esc(q.analysis || (wrongPick.length ? '选错的是 ' + wrongPick.join('、') + '，先记住正确答案。' : '题库暂未提供解析，先记住正确答案吧。')) + '</p>';
      review.appendChild(card);
    });
    $('#review-count').textContent = shown < answered ? '已展示前 60 题' : '含答案解析';

    // 低分交卷：先让猫猫难过一下，再进结果页
    if (score < 60) {
      els.pet.dataset.sleep = '0';
      playPose('sad', 900, 95);
      setTimeout(function () { showView('result'); }, 850);
    } else {
      showView('result');
    }
  }

  /* ---------------- 商城 ---------------- */
  function festBadge(kind, id) {
    if (kind && id && state.owned[kind + ':' + id]) return '';
    return festivalName() ? '<span class="fest-badge">节日特惠</span>' : '';
  }

  function priceHTML(item, kind, id) {
    var owned = !!state.owned[kind + ':' + id];
    if (owned) return '<span class="price">已拥有</span>';
    if (festivalName()) {
      return '<span class="price-wrap"><span class="price-old">' + item.price + '</span>' +
        '<span class="price"><i class="coin-dot"></i>' + priceOf(item) + '</span></span>';
    }
    return '<span class="price"><i class="coin-dot"></i>' + item.price + '</span>';
  }

  function actionBtn(kind, id) {
    var owned = !!state.owned[kind + ':' + id];
    var current = kind === 'skin' ? state.equipped.skin : kind === 'outfit' ? state.equipped.outfit : state.equipped[kind];
    var equipped = current === id;
    if (equipped) return '<button class="buy-btn equipped" type="button" disabled>使用中</button>';
    if (owned) return '<button class="buy-btn owned" type="button" data-action="equip" data-kind="' + kind + '" data-id="' + id + '">使用</button>';
    return '<button class="buy-btn" type="button" data-action="buy" data-kind="' + kind + '" data-id="' + id + '">购买</button>';
  }

  function renderShop() {
    updateTopbar();
    renderFragBar();
    var fest = festivalName();
    $('#festival-note').classList.toggle('hidden', !fest);
    if (fest) $('#festival-note-text').textContent = fest + ' · 全场 5 折，卡片标价已按折后价显示';
    $('#shop-sub').textContent = fest ? '节日特惠进行中 · 全场 5 折' : '答对 +10 · 每日首刷 +50 · 连对 3 题 +30 / 10 题 +100';

    $$('#shop-tabs .shop-tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === shopTab);
    });

    var body = $('#shop-body');
    body.innerHTML = '';

    if (shopTab === 'all' || shopTab === 'title') {
      var titleHtml = '<div class="section-head"><h2>称号</h2><span class="muted">装备后显示在答题页顶部中间</span></div>';
      ['fun', 'fairy', 'legend'].forEach(function (tier) {
        var list = TITLES.filter(function (t) { return t.tier === tier; });
        if (!list.length) return;
        var first = list[0];
        titleHtml += '<p class="tier-caption"><i class="tier-dot ' + tier + '"></i>' + first.tierName + '</p><div class="shop-grid">';
        list.forEach(function (item) {
          titleHtml += '<article class="shop-item tier-' + item.tier + '">' + festBadge('title', item.id) +
            (item.tier === 'legend' ? '<span class="legend-flag">终极</span>' : '') +
            '<div class="shop-preview"><span class="user-title ' + item.tier + '">' + esc(item.name) + '</span></div>' +
            '<strong class="shop-name">' + first.tierName + '</strong>' +
            '<div class="shop-foot">' + priceHTML(item, 'title', item.id) + actionBtn('title', item.id) + '</div>' +
            '</article>';
        });
        titleHtml += '</div>';
      });
      body.insertAdjacentHTML('beforeend', titleHtml);
    }

    if (shopTab === 'all' || shopTab === 'bg') {
      var bHtml = '<div class="section-head"><h2>页面背景</h2><span class="muted">50 / 80 / 100 金币</span></div><div class="shop-grid">';
      BACKGROUNDS.forEach(function (item) {
        bHtml += '<article class="shop-item">' + festBadge('bg', item.id) +
          '<div class="bg-thumb ' + item.id + '"></div>' +
          '<strong class="shop-name">' + esc(item.name) + '</strong>' +
          '<div class="shop-foot">' + priceHTML(item, 'bg', item.id) + actionBtn('bg', item.id) + '</div>' +
          '</article>';
      });
      bHtml += '</div>';

      bHtml += '<div class="section-head limited-head"><h2>限定兑换</h2><span class="muted">✦ ' + EGG.fragmentCost + ' 碎片 / 件</span></div>';
      bHtml += '<div class="shop-grid">';
      LIMITED.forEach(function (item) {
        bHtml += '<article class="shop-item limited-item">' +
          '<div class="bg-thumb ' + item.id + '"><span class="limited-flag">限定</span></div>' +
          '<strong class="shop-name">' + esc(item.name) + '</strong>' +
          '<span class="limited-desc">' + esc(item.desc) + '</span>' +
          '<div class="shop-foot"><span class="frag-price">✦ ' + (item.cost || EGG.fragmentCost) + '</span>' + limitedAction(item) + '</div>' +
          '</article>';
      });
      bHtml += '</div>';
      body.insertAdjacentHTML('beforeend', bHtml);
    }

    if (shopTab === 'all' || shopTab === 'cat') {
      var catLabels = ['全部'];
      OUTFIT_GROUPS.forEach(function (g) { if (catLabels.indexOf(g.label) < 0) catLabels.push(g.label); });
      var cHtml = '<div class="section-head"><h2>猫猫换装</h2><span class="muted">' + OUTFITS.length + ' 套 · 100–1500 金币</span></div>';
      cHtml += '<div class="cat-filters">';
      catLabels.forEach(function (label) {
        cHtml += '<button class="cat-filter' + (catGroup === label ? ' active' : '') + '" type="button" data-cat-group="' + esc(label) + '">' + esc(label) + '</button>';
      });
      cHtml += '</div><div class="shop-grid">';

      var baseOn = !state.equipped.outfit && (state.equipped.skin || 'classic') === 'classic';
      cHtml += '<article class="shop-item outfit-card">' +
        '<div class="cat-thumb outfit-thumb"><img loading="lazy" decoding="async" src="assets/cat/frames60/stand_60.webp" alt=""></div>' +
        '<strong class="shop-name">经典橘猫</strong>' +
        '<div class="shop-foot"><span class="price">免费</span>' +
        (baseOn ? '<button class="buy-btn equipped" type="button" disabled>使用中</button>' : '<button class="buy-btn owned" type="button" data-action="base">使用</button>') +
        '</div></article>';

      var list = catGroup === '全部' ? OUTFITS : OUTFITS.filter(function (item) { return item.groupLabel === catGroup; });
      list.forEach(function (item) {
        cHtml += '<article class="shop-item outfit-card">' + festBadge('outfit', item.id) +
          '<div class="cat-thumb outfit-thumb"><img loading="lazy" decoding="async" src="' + outfitSrc(item, 'stand') + '" alt=""></div>' +
          '<strong class="shop-name">' + esc(item.name) + '</strong>' +
          '<div class="shop-foot">' + priceHTML(item, 'outfit', item.id) + actionBtn('outfit', item.id) + '</div>' +
          '</article>';
      });
      cHtml += '</div>';

      if (catGroup === '全部') {
        cHtml += '<div class="section-head classic-head"><h2>经典配饰（叠加）</h2><span class="muted">100 金币 / 件</span></div><div class="shop-grid">';
        SKINS.forEach(function (item) {
          cHtml += '<article class="shop-item">' + festBadge('skin', item.id) +
            '<div class="cat-thumb" data-skin="' + item.id + '"></div>' +
            '<strong class="shop-name">' + esc(item.name) + '</strong>' +
            '<div class="shop-foot">' + priceHTML(item, 'skin', item.id) + actionBtn('skin', item.id) + '</div>' +
            '</article>';
        });
        cHtml += '</div>';
      }
      body.insertAdjacentHTML('beforeend', cHtml);
    }

    if (shopTab === 'all' || shopTab === 'fx') {
      var fHtml = '<div class="section-head"><h2>答对掉落特效</h2><span class="muted">50 金币 / 个</span></div><div class="shop-grid">';
      EFFECTS.forEach(function (item) {
        fHtml += '<article class="shop-item">' + festBadge('fx', item.id) +
          '<div class="fx-preview"><span class="fx-sample">' + item.emoji + '</span></div>' +
          '<strong class="shop-name">' + esc(item.name) + '</strong>' +
          '<div class="shop-foot">' + priceHTML(item, 'fx', item.id) + actionBtn('fx', item.id) + '</div>' +
          '</article>';
      });
      fHtml += '</div>';
      body.insertAdjacentHTML('beforeend', fHtml);
    }

    // 猫猫缩略图：复用同一份 SVG
    hydrateCatThumbs(body);
  }

  function hydrateCatThumbs(root) {
    var acc = $('#cat-accessories');
    $$('.cat-thumb[data-skin]', root).forEach(function (thumb) {
      if (thumb.querySelector('.thumb-cat')) return;
      var wrap = document.createElement('span');
      wrap.className = 'thumb-cat';
      var img = document.createElement('img');
      img.src = SPRITE.stand;
      img.alt = '';
      wrap.appendChild(img);
      if (acc) {
        var clone = acc.cloneNode(true);
        clone.removeAttribute('id');
        wrap.appendChild(clone);
        applyAccessoryAnchors(wrap, 'stand');
      }
      thumb.appendChild(wrap);
    });
  }

  function renderFragBar() {
    var n = state.fragments || 0;
    var count = $('#frag-count');
    if (count) count.textContent = n;
    var left = $('#frag-left');
    if (left) left.textContent = n >= EGG.fragmentCost ? ' · 已可兑换' : ' · 还差 ' + (EGG.fragmentCost - n) + ' 片';
    var bar = $('#frag-bar');
    if (bar) bar.classList.toggle('frag-ready', n >= EGG.fragmentCost);
  }

  function exchangeLimited(id) {
    var item = null;
    LIMITED.forEach(function (x) { if (x.id === id) item = x; });
    if (!item) return;
    var key = 'bg:' + id;
    if (state.owned[key]) { equipItem('bg', id); return; }
    var cost = item.cost || EGG.fragmentCost;
    if ((state.fragments || 0) < cost) {
      toast('碎片还差 ' + (cost - (state.fragments || 0)) + ' 片，答题碰彩蛋慢慢攒');
      return;
    }
    changeFragments(-cost);
    state.owned[key] = true;
    equipItem('bg', id);
    save();
    toast('兑换成功 · ' + item.name);
    if (currentView === 'shop') renderShop();
  }

  function limitedAction(item) {
    var key = 'bg:' + item.id;
    var cost = item.cost || EGG.fragmentCost;
    if (state.equipped.bg === item.id) return '<button class="buy-btn equipped" type="button" disabled>使用中</button>';
    if (state.owned[key]) return '<button class="buy-btn owned" type="button" data-action="equip" data-kind="bg" data-id="' + item.id + '">使用</button>';
    var lack = cost - (state.fragments || 0);
    if (lack > 0) return '<button class="buy-btn" type="button" disabled>还差 ' + lack + ' 片</button>';
    return '<button class="buy-btn" type="button" data-action="exchange" data-id="' + item.id + '">兑换</button>';
  }

  function buyItem(kind, id) {
    var item = findItem(kind, id);
    if (!item) return;
    var key = kind + ':' + id;
    if (state.owned[key]) { equipItem(kind, id); return; }
    var price = priceOf(item);
    if (state.coins < price) {
      toast('金币还不够，再去做几题吧');
      return;
    }
    changeCoins(-price);
    state.owned[key] = true;
    equipItem(kind, id, true);
  }

  function equipItem(kind, id, silent) {
    var item = findItem(kind, id);
    if (!item) return;
    if (kind === 'title') state.equipped.title = id;
    else if (kind === 'bg') state.equipped.bg = id;
    else if (kind === 'skin') { state.equipped.skin = id; state.equipped.outfit = ''; }
    else if (kind === 'outfit') { state.equipped.outfit = id; state.equipped.skin = 'classic'; preloadOutfit(item); }
    else if (kind === 'fx') state.equipped.fx = id;
    state.equippedAt = Date.now();
    applyEquipped();
    setPose(pose);
    save();
    updateTopbar();
    updatePetBubble();
    if (currentView === 'shop') renderShop();
  }

  function equipBase() {
    state.equipped.outfit = '';
    state.equipped.skin = 'classic';
    state.equippedAt = Date.now();
    applyEquipped();
    setPose(pose);
    save();
    updateTopbar();
    updatePetBubble();
    if (currentView === 'shop') renderShop();
  }

  function setSimDate(value) {
    state.simDate = value || '';
    save();
    if (currentView === 'shop') renderShop();
    updateFestivalBanner();
  }

  /* ---------------- 猫猫 ---------------- */
  function initPet() {
    els.petSprite.onerror = function () {
      var o = equippedOutfit();
      this.onerror = null;
      this.src = o ? outfitSrc(o, 'stand') : SPRITE.stand;
    };
    applyPetPosition();
    updatePetBubble();
    setPose('stand');
    scheduleIdle();
  }

  function setPose(name) {
    if (!SPRITE[name]) name = 'stand';
    pose = name;
    var src = frameFor(name);
    if (els.petSprite.getAttribute('src') !== src) els.petSprite.src = src;
    els.pet.dataset.anim = name;
    applyAccessoryAnchors(els.petAvatar, name);
    applyHeadAnchor(name);
    scheduleAvoid();
  }

  function restorePose() {
    actionUntil = 0;
    actionPriority = 0;
    if (els.pet.dataset.sleep === '1') setPose('sleep');
    else if (bubbleOpen) setPose(reducedMotion ? 'stand' : 'wave');
    else if (draggingCat) setPose(reducedMotion ? 'stand' : 'run');
    else setPose('stand');
  }

  /* 动作优先级：高优先级不会被低优先级打断，避免跳/跑闪烁
     答题反馈（点赞/惊讶/生气）高于跳跃，保证快速作答时也能看到表情 */
  var ACTION_PRIORITY = {
    wink: 15, run: 40, sad: 50, cheer: 55, wave: 60, roll: 70, jump: 80,
    like: 82, surprise: 84, angry: 86, love: 88, stretch: 90, sleep: 100
  };
  var actionPriority = 0;

  /* 第一次做错 → 惊讶；连错 2 题 → 生气（生气优先级更高，会盖过惊讶） */
  function wrongAnswerPose(hadAnswered) {
    state.wrongStreak = (state.wrongStreak || 0) + 1;
    if (state.wrongStreak >= 2) playPose('angry', 1300, 86);
    else if (!hadAnswered) playPose('surprise', 1300, 84);
  }

  // 播放一次动作，结束后回到当前应处状态
  function playPose(name, ms, priority) {
    if (reducedMotion && name !== 'sleep') return;
    var p = priority == null ? (ACTION_PRIORITY[name] || 0) : priority;
    if (Date.now() < actionUntil && p < actionPriority) return;
    setPose(name);
    actionUntil = Date.now() + ms;
    actionPriority = p;
    clearTimeout(poseTimer);
    poseTimer = setTimeout(restorePose, ms + 30);
  }

  /* ---------- 待机循环：站立为主，偶尔小范围走动 ---------- */
  var lastIdleKind = '';
  var idleBag = [];

  function scheduleIdle() {
    clearTimeout(idleTimer);
    if (reducedMotion || currentView !== 'quiz') return;
    idleTimer = setTimeout(idleTick, 6000 + Math.random() * 4000);
  }

  function nextIdleKind() {
    if (!idleBag.length) {
      idleBag = shuffle(['stand', 'stand', 'stand', 'wink', 'roam']);
    }
    var kind = idleBag.pop();
    if (kind === lastIdleKind && idleBag.length) kind = idleBag.pop();
    return kind;
  }

  function idleTick() {
    if (currentView !== 'quiz' || els.pet.dataset.sleep === '1' || bubbleOpen || draggingCat ||
        els.pet.classList.contains('is-shy') || Date.now() < actionUntil) {
      scheduleIdle();
      return;
    }
    // 同一题停留超过 40 秒还没作答 → 加油一次
    if (session && currentQ && !session.entries[currentQ.id] && cheeredQid !== currentQ.id &&
        Date.now() - questionShownAt > 40000) {
      cheeredQid = currentQ.id;
      playPose('cheer', 1400, 62);
      scheduleIdle();
      return;
    }
    var next = nextIdleKind();
    lastIdleKind = next;
    if (next === 'roam') {
      roamWalk();
    } else if (next === 'wink') {
      playPose('wink', 1400, 20);
    } else {
      setPose('stand');
    }
    scheduleIdle();
  }

  // 小范围走 2~3 步，每一步都有奔跑动作
  function roamWalk() {
    var steps = 2 + Math.floor(Math.random() * 2);
    var done = 0;
    (function step() {
      if (done >= steps) return;
      done += 1;
      roamStep();
      actionUntil = Math.max(actionUntil, Date.now() + 700);
      if (done < steps) setTimeout(step, 700);
    })();
  }

  /* ---------- 小范围走动：始终留在右下安全区，不压题干/选项 ---------- */
  function petBasePos() {
    var p = state.pet || {};
    if (p.left != null && p.top != null) return { left: p.left, top: p.top };
    var r = els.pet.getBoundingClientRect();
    return { left: r.left - roamX, top: r.top - roamY };
  }

  function overlapRect(a, b) {
    return !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
  }

  function contentHit(left, top) {
    var box = { left: left, top: top, right: left + 60, bottom: top + 60 };
    var hit = false;
    ['#q-stem', '#q-options'].forEach(function (sel) {
      var el = $(sel);
      if (!el) return;
      var b = el.getBoundingClientRect();
      if (b.width && b.height && overlapRect(box, b)) hit = true;
    });
    return hit;
  }

  function roamStep() {
    if (reducedMotion) return;
    var base = petBasePos();
    var moves = [[24, 0], [-24, 0], [0, -14], [0, 14], [18, -10], [-18, 10]];
    var move = moves[Math.floor(Math.random() * moves.length)];
    var nx = roamX + move[0] * roamDirX;
    var ny = roamY + move[1];
    if (Math.abs(nx) > 44) {
      roamDirX *= -1;
      nx = roamX + move[0] * roamDirX;
    }
    if (Math.abs(ny) > 26) ny = roamY;

    var left = base.left + nx;
    var top = base.top + ny;
    if (left < 6) nx = roamX + Math.abs(move[0]);
    if (left + 60 > window.innerWidth - 6) nx = roamX - Math.abs(move[0]);
    if (top < 70) ny = roamY + Math.abs(move[1] || 8);
    if (top + 60 > window.innerHeight - 80) ny = roamY - Math.abs(move[1] || 8);

    left = base.left + nx;
    top = base.top + ny;
    if (contentHit(left, top)) {
      nx = roamX;
      ny = roamY;
    }

    roamX = nx;
    roamY = ny;
    els.pet.style.setProperty('--roam-x', roamX + 'px');
    els.pet.style.setProperty('--roam-y', roamY + 'px');
    playPose('run', 680);
    scheduleAvoid();
  }

  function resetRoam() {
    roamX = 0;
    roamY = 0;
    els.pet.style.setProperty('--roam-x', '0px');
    els.pet.style.setProperty('--roam-y', '0px');
  }

  function beginCatDrag() {
    draggingCat = true;
    els.pet.classList.add('dragging');
    resetRoam();
    clearTimeout(idleTimer);
    closeBubble();
    setPose(reducedMotion ? 'stand' : 'run');
  }

  /* ---------- 与题干/选项重叠时淡出 + 点击穿透 ---------- */
  function avoidContent() {
    if (currentView !== 'quiz' || draggingCat) {
      els.pet.classList.remove('is-shy');
      return;
    }
    var r = els.pet.getBoundingClientRect();
    var hit = false;
    ['#q-stem', '#q-options'].forEach(function (sel) {
      var el = $(sel);
      if (!el) return;
      var b = el.getBoundingClientRect();
      if (b.width && b.height && overlapRect(r, b)) hit = true;
    });
    if (hit && bubbleOpen) closeBubble();
    els.pet.classList.toggle('is-shy', hit);
  }

  var avoidRaf = 0;

  function scheduleAvoid() {
    if (avoidRaf) return;
    avoidRaf = requestAnimationFrame(function () {
      avoidRaf = 0;
      avoidContent();
    });
  }

  function applyPetPosition() {
    resetRoam();
    var p = state.pet || {};
    if (p.left == null || p.top == null) {
      els.pet.classList.remove('is-floating');
      els.pet.style.left = '';
      els.pet.style.top = '';
      scheduleAvoid();
      return;
    }
    var pos = clampPet(p.left, p.top);
    els.pet.classList.add('is-floating');
    els.pet.style.left = pos.left + 'px';
    els.pet.style.top = pos.top + 'px';
    scheduleAvoid();
  }

  function clampPet(left, top) {
    var w = 60;
    var h = 60;
    var minTop = 66;
    var maxLeft = Math.max(6, window.innerWidth - w - 6);
    // 底部给操作栏留出空间，猫猫不压住按钮
    var maxTop = Math.max(minTop, window.innerHeight - h - 80);
    return {
      left: Math.min(Math.max(6, left), maxLeft),
      top: Math.min(Math.max(minTop, top), maxTop)
    };
  }

  function openBubble() {
    updatePetBubble();
    els.petMenu.classList.remove('hidden');
    bubbleOpen = true;
    var r = els.pet.getBoundingClientRect();
    els.petMenu.classList.toggle('left', r.right - (els.petMenu.offsetWidth || 220) - 6 < 8);
    var mh = els.petMenu.offsetHeight || 200;
    els.petMenu.classList.toggle('below', r.top < mh + 80);
    clearTimeout(poseTimer);
    actionUntil = 0;
    actionPriority = 0;
    setPose(reducedMotion ? 'stand' : 'wave');
    clearTimeout(idleTimer);
  }

  function closeBubble() {
    var wasOpen = bubbleOpen;
    els.petMenu.classList.add('hidden');
    bubbleOpen = false;
    if (wasOpen) {
      restorePose();
      scheduleIdle();
    }
  }

  function toggleBubble() {
    if (bubbleOpen) closeBubble();
    else openBubble();
  }

  function petJump() {
    playPose('jump', 720);
  }

  function petPlus(n) {
    els.petPlus.textContent = '+' + n;
    els.petPlus.classList.remove('show');
    void els.petPlus.offsetWidth;
    els.petPlus.classList.add('show');
    setTimeout(function () { els.petPlus.classList.remove('show'); }, 1250);
  }

  function petSay(text) {
    els.petSay.textContent = text;
    els.petSay.classList.remove('hidden');
    clearTimeout(els.petSay._timer);
    els.petSay._timer = setTimeout(function () { els.petSay.classList.add('hidden'); }, 1600);
  }

  function petPat() {
    els.pet.classList.remove('is-patting');
    void els.pet.offsetWidth;
    els.pet.classList.add('is-patting');
    petSay('呼噜呼噜~ 再摸摸');
    playPose('love', 1500, 88);
    setTimeout(function () { els.pet.classList.remove('is-patting'); }, 1600);
  }

  function sleepPet() {
    if (currentView !== 'quiz' || bubbleOpen || draggingCat) return;
    els.pet.dataset.sleep = '1';
    els.pet.classList.remove('is-happy');
    clearTimeout(idleTimer);
    clearTimeout(poseTimer);
    actionUntil = 0;
    actionPriority = 0;
    setPose('sleep');
  }

  function wakePet() {
    if (els.pet.dataset.sleep !== '1') return;
    els.pet.dataset.sleep = '0';
    els.pet.classList.remove('is-waking');
    void els.pet.offsetWidth;
    els.pet.classList.add('is-waking');
    petSay('伸个懒腰~');
    playPose('stretch', 1300, 90);
    setTimeout(function () { els.pet.classList.remove('is-waking'); }, 850);
    updatePetHappy();
    lastActive = Date.now();
    scheduleIdle();
  }

  function markActive() {
    lastActive = Date.now();
    if (els.pet.dataset.sleep === '1') wakePet();
  }

  function dropFx() {
    var kind = state.equipped.fx;
    if (!kind) return;
    var svg = FX_SVG[kind];
    if (!svg) return;
    var left = [6, 18, 33, 52, 68, 80, 90];
    var top = [8, 20, 10, 26, 14, 22, 9];
    for (var i = 0; i < 7; i += 1) {
      (function (idx) {
        var span = document.createElement('span');
        span.className = 'fx-item';
        span.style.left = left[idx] + '%';
        span.style.top = top[idx] + '%';
        span.style.width = span.style.height = (11 + (idx % 3) * 3) + 'px';
        span.style.animationDelay = '-' + (0.12 + idx * 0.14).toFixed(2) + 's';
        span.innerHTML = svg;
        els.petFx.appendChild(span);
        setTimeout(function () { if (span.parentNode) span.parentNode.removeChild(span); }, 1800);
      })(i);
    }
  }

  var FX_SVG = {
    sakura: '<svg viewBox="0 0 20 20"><path d="M10 1.5c2.1 3 4.3 4.1 7.4 4.1-1 3.1-1 5.5 0 8.7-3.1 0-5.3 1.1-7.4 4.2-2.1-3.1-4.3-4.2-7.4-4.2 1-3.2 1-5.6 0-8.7 3.1 0 5.3-1.1 7.4-4.1z" fill="#ffb3cf"/><circle cx="10" cy="10" r="1.9" fill="#fff2f7"/></svg>',
    star: '<svg viewBox="0 0 20 20"><path d="m10 1.3 2.7 5.5 6 .9-4.4 4.2 1.1 6-5.4-2.8-5.4 2.8 1.1-6L1.3 7.7l6-.9z" fill="#ffd166" stroke="#e9a93a" stroke-width="0.8"/></svg>'
  };

  /* ---------------- 错题消消乐 / 连击 ---------------- */
  function showSmash(amount) {
    smashTimers.forEach(clearTimeout);
    smashTimers = [];
    var layer = $('#smash-layer');
    var card = $('#smash-card');
    card.dataset.phase = 'before';
    $('#smash-label').textContent = '发现 1 个盲点';
    $('#smash-tip').textContent = '答对就能消灭 · 点击跳过';
    $('#smash-coins-text').textContent = '金币 +' + amount;
    layer.classList.remove('hidden');

    smashTimers.push(setTimeout(function () {
      card.dataset.phase = 'shatter';
      $('#smash-label').textContent = '啪！盲点碎了';
      $('#smash-tip').textContent = '碎屑散开 · 点击跳过';
    }, 480));
    smashTimers.push(setTimeout(function () {
      card.dataset.phase = 'coins';
      $('#smash-label').innerHTML = '<i class="coin-dot"></i>金币 +' + amount;
      $('#smash-tip').textContent = '已存入本地存档';
    }, 920));
    smashTimers.push(setTimeout(hideSmash, 1850));
  }

  function hideSmash() {
    smashTimers.forEach(clearTimeout);
    smashTimers = [];
    $('#smash-layer').classList.add('hidden');
  }

  function hideCombo() {
    clearTimeout(comboTimer);
    var layer = $('#combo-layer');
    if (!layer) return;
    layer.classList.add('hidden');
    layer.innerHTML = '';
  }

  function showComboLine(text) {
    var layer = $('#combo-layer');
    layer.classList.remove('hidden');
    layer.innerHTML = '<div class="combo-line">' + esc(text) + '</div>';
    clearTimeout(comboTimer);
    comboTimer = setTimeout(function () {
      layer.classList.add('hidden');
      layer.innerHTML = '';
    }, 1800);
  }

  function showCombo(streak, bonus) {
    var layer = $('#combo-layer');
    layer.classList.remove('hidden');
    layer.innerHTML = '';
    clearTimeout(comboTimer);
    var amount = bonus || 30;

    if (streak % 10 === 0) {
      var stars = [[8, 16], [22, 9], [36, 22], [50, 7], [64, 18], [78, 8], [90, 20], [14, 35], [28, 43], [42, 36], [56, 43], [72, 34], [86, 41], [50, 57]];
      var out = '<div class="combo-glow"></div>';
      stars.forEach(function (pos, idx) {
        var size = 14 + (idx % 4) * 5;
        out += '<span class="combo-piece combo-star" style="left:' + pos[0] + '%;top:' + pos[1] + '%;width:' + size + 'px;height:' + size + 'px;animation-delay:' + (idx * 0.05).toFixed(2) + 's">' + FX_SVG.star + '</span>';
      });
      out += '<div class="combo-title">连对 ' + streak + ' 题 · 金币 +' + amount + '</div>';
      layer.innerHTML = out;
      comboTimer = setTimeout(function () { layer.classList.add('hidden'); layer.innerHTML = ''; }, 2600);
      return;
    }

    if (streak % 6 === 0) {
      var petals = [[6, 14], [18, 3], [30, 20], [44, 7], [57, 17], [70, 4], [82, 19], [92, 9], [13, 36], [27, 45], [64, 41], [86, 37]];
      var html = '<div class="combo-line">连对 ' + streak + ' 题 · 金币 +' + amount + '</div>';
      petals.forEach(function (pos, idx) {
        html += '<span class="combo-piece" style="left:' + pos[0] + '%;top:' + pos[1] + '%;width:' + (15 + (idx % 3) * 5) + 'px;height:' + (15 + (idx % 3) * 5) + 'px;animation-delay:' + (idx * 0.04).toFixed(2) + 's">' + FX_SVG.sakura + '</span>';
      });
      layer.innerHTML = html;
      comboTimer = setTimeout(function () { layer.classList.add('hidden'); layer.innerHTML = ''; }, 2200);
      return;
    }

    layer.innerHTML = '<div class="combo-line">手感火热 🔥 连对 ' + streak + ' 题 · 金币 +' + amount + '</div>';
    comboTimer = setTimeout(function () { layer.classList.add('hidden'); layer.innerHTML = ''; }, 1600);
  }

  /* ---------------- 工具 ---------------- */
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  var toastTimer = null;

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { els.toast.classList.remove('show'); }, 1900);
  }

  function showRewardToast(text) {
    var box = $('#reward-toast');
    $('#reward-toast-text').textContent = text;
    box.classList.remove('hidden');
    clearTimeout(box._timer);
    box._timer = setTimeout(function () { box.classList.add('hidden'); }, 9000);
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    // 顶栏
    $('#btn-back').addEventListener('click', function () {
      // 不弹确认，静默存下当前进度，回首页由「继续上次练习」接手
      pauseSessionClock();
      saveResume();
      session = null;
      showView('home');
    });

    // 续做选择
    $('#resume-continue').addEventListener('click', function () {
      if (restoreResume()) renderResumeCard();
    });
    $('#resume-restart').addEventListener('click', function () {
      var mode = (state.resume && state.resume.mode) || 'order';
      state.resume = null;
      save();
      renderResumeCard();
      startSession(mode);
    });
    $('#btn-quick10').addEventListener('click', function () { startSession('random', 10); });
    $('#daily-goal').addEventListener('change', function () {
      var v = parseInt(this.value, 10);
      state.dailyGoal = [10, 20, 30].indexOf(v) >= 0 ? v : 20;
      state.daily.goalShown = Object.keys(state.daily.ids || {}).length >= state.dailyGoal;
      save();
      updatePetBubble();
      toast('每日目标已改为 ' + state.dailyGoal + ' 题');
    });
    $('#btn-focus').addEventListener('click', function () {
      state.focus = !state.focus;
      save();
      applyFocusMode();
      toast(state.focus ? '专注模式已开启' : '专注模式已关闭');
    });
    $('#blind-open').addEventListener('click', function () {
      renderBlindSheet();
      $('#blind-sheet').classList.remove('hidden');
    });
    $('#blind-close').addEventListener('click', function () { $('#blind-sheet').classList.add('hidden'); });
    $('#blind-sheet').addEventListener('click', function (e) { if (e.target === this) this.classList.add('hidden'); });
    $('#blind-start').addEventListener('click', function () {
      $('#blind-sheet').classList.add('hidden');
      startSession('wrong');
    });
    $('#btn-redo-wrong').addEventListener('click', function () { startWithIds(lastWrongIds, 'wrong'); });
    $('#report-share').addEventListener('click', shareReport);
    $('#report-preview-close').addEventListener('click', function () {
      $('#report-preview').classList.add('hidden');
    });

    $('#btn-coins').addEventListener('click', function () {
      this.classList.remove('is-press');
      void this.offsetWidth;
      this.classList.add('is-press');
      showView('shop');
    });

    // 同步 / 登录
    $('#btn-sync').addEventListener('click', openSync);
    $('#sync-close').addEventListener('click', closeSync);
    $('#sync-modal').addEventListener('click', function (e) {
      if (e.target === this) closeSync();
    });
    $('#sync-form').addEventListener('submit', function (e) {
      e.preventDefault();
      signInSync();
    });
    $('#sync-now').addEventListener('click', function () { syncNow('manual'); });
    $('#sync-logout').addEventListener('click', signOutSync);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeSync();
      if (e.key !== 'Tab') return;
      var modal = $('#sync-modal');
      if (!modal || modal.classList.contains('hidden')) return;
      var items = modal.querySelectorAll('button, input, [href], select, textarea');
      var list = Array.prototype.slice.call(items).filter(function (el) { return el.offsetParent !== null && !el.disabled; });
      if (!list.length) return;
      var first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    $('#btn-color').addEventListener('click', function (e) {
      e.stopPropagation();
      $('#color-menu').classList.toggle('hidden');
    });

    $('#color-menu').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-color]');
      if (!btn) return;
      state.color = btn.dataset.color;
      applyTheme();
      save();
      $('#color-menu').classList.add('hidden');
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('#color-menu') && !e.target.closest('#btn-color')) {
        $('#color-menu').classList.add('hidden');
      }
    });

    // 首页
    $$('.mode-row').forEach(function (row) {
      row.addEventListener('click', function () { startSession(row.dataset.mode); });
    });
    $('#weak-open').addEventListener('click', openWeak);
    $('#weak-close').addEventListener('click', closeWeak);
    $('#weak-modal').addEventListener('click', function (e) { if (e.target === this) closeWeak(); });
    $('#weak-list').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-id]');
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      if (!state.weak || !state.weak[id]) return;
      delete state.weak[id];
      save();
      renderHome();
      renderWeakList();
      toast('已移出易错题，错题重做记录不受影响');
    });
    $('#weak-clear').addEventListener('click', function () {
      if (!weakIds().length) return;
      if (!window.confirm('清空易错题清单？错题重做里的记录不会受影响。')) return;
      state.weak = {};
      save();
      renderHome();
      renderWeakList();
      toast('易错题已清空');
    });
    $('#btn-start').addEventListener('click', function () { startSession('order'); });
    $('#btn-weak').addEventListener('click', function () { startSession('weak'); });
    $('#btn-start-exam').addEventListener('click', function () { startSession('exam'); });
    $('#filter-subject').addEventListener('change', renderHome);
    $('#filter-chapter').addEventListener('change', renderHome);
    $('#fb-close').addEventListener('click', function () {
      var fest = festivalName();
      if (!fest) return;
      state.festClosed = dateKey(effectiveDate()) + '|' + fest;
      save();
      updateFestivalBanner();
    });

    // 答题
    $('#q-options').addEventListener('click', onOptionClick);
    $('#btn-prev').addEventListener('click', goPrev);
    $('#btn-main').addEventListener('click', function () {
      if (mainAction === 'submit') submitAnswer();
      else if (mainAction === 'finish') finishSession();
      else goNext();
    });
    $('#btn-fav').addEventListener('click', function () {
      if (!currentQ) return;
      if (state.fav[currentQ.id]) delete state.fav[currentQ.id];
      else state.fav[currentQ.id] = true;
      save();
      updateBar();
    });

    // 商城
    $('#shop-tabs').addEventListener('click', function (e) {
      var btn = e.target.closest('.shop-tab');
      if (!btn) return;
      shopTab = btn.dataset.tab;
      renderShop();
    });
    $('#shop-body').addEventListener('click', function (e) {
      var chip = e.target.closest('[data-cat-group]');
      if (chip) {
        catGroup = chip.dataset.catGroup;
        renderShop();
        return;
      }
      var btn = e.target.closest('[data-action]');
      if (!btn) return;
      var action = btn.dataset.action;
      if (action === 'buy') buyItem(btn.dataset.kind, btn.dataset.id);
      else if (action === 'equip') equipItem(btn.dataset.kind, btn.dataset.id);
      else if (action === 'base') equipBase();
      else if (action === 'exchange') exchangeLimited(btn.dataset.id);
    });

    // 结果页
    $('#btn-again').addEventListener('click', function () {
      var mode = session ? session.mode : 'order';
      session = null;
      startSession(mode);
    });
    $('#btn-home').addEventListener('click', function () { session = null; showView('home'); });

    // 成就徽章：点开看章名与解锁时间
    $('#quiz-badges').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-badge]');
      if (btn) openBadgePop(btn.dataset.badge);
    });
    document.addEventListener('pointerdown', function (e) {
      if (!e.target.closest('#badge-pop') && !e.target.closest('#quiz-badges')) {
        $('#badge-pop').classList.add('hidden');
      }
    }, true);

    // 成绩单：保存图片 / 关闭
    $('#report-save').addEventListener('click', exportReport);
    $('#report-close').addEventListener('click', function () { $('#exam-report').classList.add('hidden'); });
    $('#report-close-2').addEventListener('click', function () { $('#exam-report').classList.add('hidden'); });

    // 限定碎片入口
    $('#frag-go').addEventListener('click', function () {
      shopTab = 'bg';
      renderShop();
      var head = $('.limited-head');
      if (head) head.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // 猫猫
    bindPet();

    // 关闭达标提示
    $('.reward-close', $('#reward-toast')).addEventListener('click', function () {
      $('#reward-toast').classList.add('hidden');
    });

    // 消消乐点击跳过
    $('#smash-card').addEventListener('click', hideSmash);

    // 关闭/切走页面时静默保存，不弹任何确认
    window.addEventListener('beforeunload', function () { pauseSessionClock(); saveResume(); });
    window.addEventListener('pagehide', function () {
      pauseSessionClock();
      saveResume();
      if (session && session.mode === 'exam') pushDraftOnly(true);
    });
    window.addEventListener('pageshow', function (e) {
      if (e.persisted && currentView === 'quiz') resumeSessionClock();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        pauseSessionClock();
        saveResume();
      } else if (currentView === 'quiz') {
        resumeSessionClock();
      }
    });

    // 全局活跃
    ['pointerdown', 'keydown', 'touchstart'].forEach(function (ev) {
      document.addEventListener(ev, markActive, { passive: true });
    });

    // 点击外部收起猫球气泡
    document.addEventListener('pointerdown', function (e) {
      if (!bubbleOpen) return;
      if (e.target.closest('#pet-card')) return;
      closeBubble();
    }, true);

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        closeBubble();
        $('#color-menu').classList.add('hidden');
      }
    });

    window.addEventListener('resize', function () {
      if (state.pet && state.pet.left != null) {
        var pos = clampPet(state.pet.left, state.pet.top);
        state.pet = pos;
        els.pet.style.left = pos.left + 'px';
        els.pet.style.top = pos.top + 'px';
      }
      scheduleAvoid();
    });

    window.addEventListener('scroll', scheduleAvoid, { passive: true });

    // 跟随系统「减少动态效果」
    if (motionQuery) {
      var onMotion = function () {
        reducedMotion = motionQuery.matches;
        if (reducedMotion) {
          clearTimeout(idleTimer);
          resetRoam();
          setPose(els.pet.dataset.sleep === '1' ? 'sleep' : 'stand');
        } else {
          scheduleIdle();
        }
      };
      if (motionQuery.addEventListener) motionQuery.addEventListener('change', onMotion);
      else if (motionQuery.addListener) motionQuery.addListener(onMotion);
    }
  }

  function bindPet() {
    var pressTimer = null;
    var drag = null;

    els.petBall.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var r = els.pet.getBoundingClientRect();
      drag = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        offsetX: e.clientX - r.left,
        offsetY: e.clientY - r.top,
        dragging: false
      };
      try { els.pet.setPointerCapture(e.pointerId); } catch (err) {}
      clearTimeout(pressTimer);
      pressTimer = setTimeout(function () {
        if (!drag) return;
        drag.dragging = true;
        beginCatDrag();
      }, 330);
      markActive();
    });

    window.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.pointerId) return;
      var dx = e.clientX - drag.startX;
      var dy = e.clientY - drag.startY;
      if (!drag.dragging && Math.sqrt(dx * dx + dy * dy) > 7) {
        drag.dragging = true;
        clearTimeout(pressTimer);
        beginCatDrag();
      }
      if (!drag.dragging) return;
      e.preventDefault();
      resetRoam();
      var pos = clampPet(e.clientX - drag.offsetX, e.clientY - drag.offsetY);
      els.pet.classList.add('is-floating');
      els.pet.style.left = pos.left + 'px';
      els.pet.style.top = pos.top + 'px';
    }, { passive: false });

    window.addEventListener('pointerup', function (e) {
      if (!drag || e.pointerId !== drag.pointerId) return;
      clearTimeout(pressTimer);
      var wasDrag = drag.dragging;
      drag = null;
      els.pet.classList.remove('dragging');

      if (wasDrag) {
        var r = els.pet.getBoundingClientRect();
        var pos = clampPet(r.left, r.top);
        state.pet = { left: pos.left, top: pos.top };
        els.pet.style.left = pos.left + 'px';
        els.pet.style.top = pos.top + 'px';
        save();
        draggingCat = false;
        restorePose();
        scheduleIdle();
        scheduleAvoid();
      } else if (els.pet.dataset.sleep === '1') {
        wakePet();
      } else {
        // 点猫猫本体 = 摸摸头（冒爱心）；气泡顺带打开，方便看今日进度
        if (!bubbleOpen) openBubble();
        petPat();
      }
      markActive();
    });

    // 气泡里的进度条 → 衣橱
    els.petGoal.addEventListener('click', function (e) {
      e.stopPropagation();
      closeBubble();
      shopTab = 'cat';
      catGroup = '全部';
      showView('shop');
    });

    // 称号右边的 🐟：在气泡里直接吃东西
    $('#pet-feed').addEventListener('click', function (e) {
      e.stopPropagation();
      playPose('eat', 1600, 80);
    });

    // 猫猫改名（入口在猫猫弹层里）
    var renameRow = $('#pet-rename-row');
    var nameInput = $('#pet-name-input');
    $('#pet-rename').addEventListener('click', function (e) {
      e.stopPropagation();
      renameRow.classList.toggle('hidden');
      if (!renameRow.classList.contains('hidden')) {
        nameInput.value = state.petName || '小鹿';
        nameInput.focus();
        nameInput.select();
      }
    });
    function savePetName() {
      var v = (nameInput.value || '').trim().slice(0, 8);
      state.petName = v || '小鹿';
      save();
      updatePetBubble();
      renameRow.classList.add('hidden');
    }
    $('#pet-name-save').addEventListener('click', function (e) {
      e.stopPropagation();
      savePetName();
    });
    nameInput.addEventListener('click', function (e) { e.stopPropagation(); });
    nameInput.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') savePetName();
    });
  }

  /* ---------------- 启动 ---------------- */
  function passwordToken() {
    var hash = 2166136261;
    for (var i = 0; i < ACCESS_PASSWORD.length; i += 1) {
      hash ^= ACCESS_PASSWORD.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function initGate() {
    var gate = $('#gate');
    var form = $('#gate-form');
    var input = $('#gate-input');
    if (!gate || !form || !input) return;
    try {
      if (localStorage.getItem(UNLOCK_KEY) === passwordToken()) {
        gate.classList.add('hidden');
        document.body.classList.remove('gate-locked');
        return;
      }
    } catch (e) {}
    document.body.classList.add('gate-locked');
    setTimeout(function () { input.focus(); }, 80);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (input.value === ACCESS_PASSWORD) {
        try { localStorage.setItem(UNLOCK_KEY, passwordToken()); } catch (err) {}
        gate.classList.add('hidden');
        document.body.classList.remove('gate-locked');
        input.classList.remove('is-error');
        $('#gate-error').classList.add('hidden');
        toast('欢迎回来');
      } else {
        input.classList.add('is-error');
        var err = $('#gate-error');
        err.textContent = '密码不对，再试试';
        err.classList.remove('hidden');
        input.select();
      }
    });
  }

  function boot() {
    var params = new URLSearchParams(location.search);
    initGate();

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }

    // 隐藏清档方式：地址加 ?reset=1（无任何 UI，不打扰）
    if (params.get('reset') === '1') {
      try { localStorage.removeItem(KEY); } catch (e) {}
      params.delete('reset');
      var qs = params.toString();
      location.replace(location.pathname + (qs ? '?' + qs : '') + location.hash);
      return;
    }

    ensureDaily();
    applyEquipped();
    updateTopbar();
    initSync();
    initPet();

    // 科目下拉
    var subjects = {};
    QUESTIONS.forEach(function (q) { if (q.subject) subjects[q.subject] = true; });
    var sel = $('#filter-subject');
    Object.keys(subjects).forEach(function (s) {
      var opt = document.createElement('option');
      opt.value = s;
      opt.textContent = s;
      sel.appendChild(opt);
    });

    bind();
    renderHome();
    showView('home');

    // URL 参数方便验收截图，例如 ?page=shop&theme=dark&color=morandi-purple
    if (params.get('color') && COLOR_LABEL[params.get('color')]) {
      state.color = params.get('color');
      applyTheme();
    }
    if (params.get('theme') === 'dark' || params.get('theme') === 'light') {
      state.theme = params.get('theme');
      applyTheme();
    }
    var page = params.get('page');
    if (page === 'shop') showView('shop');
    else if (page === 'quiz') startSession('order');
    else if (page === 'home') showView('home');
    if (params.get('sleep') === '1') {
      if (currentView !== 'quiz') startSession('order');
      setTimeout(sleepPet, 300);
    }
    if (params.get('bubble') === '1') {
      if (currentView !== 'quiz') startSession('order');
      setTimeout(openBubble, 300);
    }

    // 有上次没做完的练习 → 首页展示「继续 / 重新开始」，不自动跳转

    // 2 分钟无操作 → 睡觉
    setInterval(function () {
      if (currentView !== 'quiz') return;
      if (els.pet.dataset.sleep === '1') return;
      if (Date.now() - lastActive > 120000) sleepPet();
    }, 5000);
  }

  // 测试/验收钩子
  window.__bqproto = {
    get state() { return state; },
    get session() { return session; },
    save: save,
    saveResume: saveResume,
    restoreResume: restoreResume,
    sessionActiveMs: sessionActiveMs,
    showView: showView,
    startSession: startSession,
    startWithIds: startWithIds,
    renderQuestion: renderQuestion,
    submitAnswer: submitAnswer,
    finishSession: finishSession,
    festivalName: festivalName,
    effectiveDate: effectiveDate,
    setSimDate: setSimDate,
    renderShop: renderShop,
    toggleBubble: toggleBubble,
    openBubble: openBubble,
    sleepPet: sleepPet,
    wakePet: wakePet,
    closeBubble: closeBubble,
    petJump: petJump,
    petPlus: petPlus,
    setPose: setPose,
    playPose: playPose,
    applyEquipped: applyEquipped,
    applyPetPosition: applyPetPosition,
    roamStep: roamStep,
    avoidContent: avoidContent,
    get petPose() { return pose; },
    get reducedMotion() { return reducedMotion; },
    SPRITE: SPRITE,
    showCombo: showCombo,
    showSmash: showSmash,
    toast: toast,
    priceAudit: priceAudit,
    PRICE_BANDS: PRICE_BANDS,
    OUTFITS: OUTFITS,
    QUESTIONS: QUESTIONS,
    blindStats: blindStats,
    renderBlind: renderBlind,
    badgeGroupStats: badgeGroupStats,
    checkBadges: checkBadges,
    renderBadges: renderBadges,
    rollEgg: rollEgg,
    exportReport: exportReport,
    get lastReport() { return lastReport; },
    EGG: EGG,
    LIMITED: LIMITED,
    BADGES: BADGES
  };

  boot();
})();

