/**
 * 二级建造师刷题 —— 纯前端单页应用
 * 数据来源：questions.json（fetch 读取）
 * 本地数据：localStorage，键名 bq:v1
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'bq:v1';
  const UNLOCK_KEY = 'bq:unlock:v1';
  const SYNC_KEY = 'bq:sync:v1';
  const EXAM_DRAFT_KEY = 'bq:exam-draft:v1';
  const MAX_EXAMS = 20;

  // ===== 访问密码：修改下面这一行即可更换站点密码（区分大小写）=====
  // 修改后，已解锁的设备会因校验值变化而需要重新输入。
  const ACCESS_PASSWORD = 'Yuanzhi2026';

  // ===== 可选云同步（Supabase）=====
  // 两项都填写后才启用同步；留空时站点完全保持纯本地 localStorage 模式。
  // Project URL 例：https://abcdefgh.supabase.co
  // anon key 在 Supabase 控制台 Project Settings → API 中获取（可公开的 anon public key）。
  const SUPABASE_URL = 'https://zjlwvalqqifmwayvkieu.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_h9S-a3UfvaL4jl8qM618xA_TOybeW7a';
  const SYNC_ENABLED = Boolean(SUPABASE_URL.trim() && SUPABASE_ANON_KEY.trim());

  const MODE_LABEL = {
    sequence: '顺序练习',
    random: '随机练习',
    wrong: '错题重做',
    fav: '收藏练习',
    exam: '模拟考试'
  };

  const TYPE_LABEL = {
    single: '单选题',
    multiple: '多选题',
    judge: '判断题'
  };

  const $ = function (selector) {
    return document.querySelector(selector);
  };

  // 应用级状态：题库、筛选条件、当前练习会话、考试结果等
  const app = {
    questions: [],
    byId: {},
    subjects: [],
    chapters: [],
    store: null,
    filter: { subject: 'all', chapter: 'all' },
    session: null,
    lastResult: null,
    timerId: null,
    toastId: null,
    unlocked: false,
    // 浏览器历史深度：0 为首页，页面级切换递增，系统返回按 popstate 回退
    nav: { depth: 0 },
    // 云同步运行时状态：session 为 Supabase 登录会话，applying 防止同步回写触发再次同步
    sync: {
      session: null,
      timer: null,
      draftTimer: null,
      syncing: false,
      applying: false,
      // 云端若未加 exam_draft 列，自动降级为只同步学习数据
      draftSupported: true,
      statusText: '未登录'
    }
  };

  const dom = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheDom();
    app.store = loadStore();
    applyTheme();
    bindEvents();
    initSync();

    // 未解锁时停留在密码页，不请求题库，也不渲染首页数据
    if (checkUnlock()) enterApp();
    else showGate();
  }

  function cacheDom() {
    dom.gate = $('#gate');
    dom.gateForm = $('#gate-form');
    dom.gateInput = $('#gate-input');
    dom.gateError = $('#gate-error');

    dom.topbar = $('.topbar');
    dom.main = $('#main');
    dom.btnBack = $('#btn-back');
    dom.btnTheme = $('#btn-theme');
    dom.topbarTitle = $('#topbar-title');
    dom.topProgress = $('#top-progress');
    dom.topProgressFill = $('#top-progress-fill');

    dom.btnSync = $('#btn-sync');
    dom.syncModal = $('#sync-modal');
    dom.syncMask = $('#sync-mask');
    dom.btnSyncClose = $('#btn-sync-close');
    dom.syncStatus = $('#sync-status');
    dom.authForm = $('#auth-form');
    dom.authEmail = $('#auth-email');
    dom.authPassword = $('#auth-password');
    dom.syncUser = $('#sync-user');
    dom.syncEmail = $('#sync-email');
    dom.btnSyncNow = $('#btn-sync-now');
    dom.btnLogout = $('#btn-logout');

    dom.heroDesc = $('#hero-desc');
    dom.homeTotal = $('#home-total');
    dom.homeDone = $('#home-done');
    dom.homeWrong = $('#home-wrong');
    dom.homeAccuracy = $('#home-accuracy');
    dom.filterCount = $('#filter-count');
    dom.loadError = $('#load-error');
    dom.filterSubject = $('#filter-subject');
    dom.filterChapter = $('#filter-chapter');
    dom.countSequence = $('#count-sequence');
    dom.countRandom = $('#count-random');
    dom.countWrong = $('#count-wrong');
    dom.countFav = $('#count-fav');
    dom.examSize = $('#exam-size');
    dom.examTimeHint = $('#exam-time-hint');
    dom.btnStartExam = $('#btn-start-exam');
    dom.recentExams = $('#recent-exams');
    dom.examDraftCard = $('#exam-draft-card');
    dom.examDraftMeta = $('#exam-draft-meta');
    dom.btnResumeExam = $('#btn-resume-exam');
    dom.btnDropDraft = $('#btn-drop-draft');

    dom.quizMode = $('#quiz-mode');
    dom.quizCount = $('#quiz-count');
    dom.quizTimer = $('#quiz-timer');
    dom.btnAbandonExam = $('#btn-abandon-exam');
    dom.btnHandin = $('#btn-handin');
    dom.qType = $('#q-type');
    dom.qChapter = $('#q-chapter');
    dom.qStem = $('#q-stem');
    dom.qOptions = $('#q-options');
    dom.qAnalysis = $('#q-analysis');

    dom.quizBar = $('#quiz-bar');
    dom.btnPrev = $('#btn-prev');
    dom.btnFav = $('#btn-fav');
    dom.btnMain = $('#btn-main');

    dom.statAccuracy = $('#stat-accuracy');
    dom.statsScope = $('#stats-scope');
    dom.statAttempts = $('#stat-attempts');
    dom.statDone = $('#stat-done');
    dom.statTotal = $('#stat-total');
    dom.statWrong = $('#stat-wrong');
    dom.statFav = $('#stat-fav');
    dom.chapterStats = $('#chapter-stats');
    dom.examHistory = $('#exam-history');
    dom.btnReset = $('#btn-reset');

    dom.resultScore = $('#result-score');
    dom.resultTitle = $('#result-title');
    dom.resultCorrect = $('#result-correct');
    dom.resultWrong = $('#result-wrong');
    dom.resultUnanswered = $('#result-unanswered');
    dom.resultTime = $('#result-time');
    dom.reviewList = $('#review-list');
    dom.scoreRing = document.querySelector('.score-ring');
    dom.btnRetryExam = $('#btn-retry-exam');
    dom.btnResultHome = $('#btn-result-home');

    dom.btnLock = $('#btn-lock');
    dom.toast = $('#toast');
  }

  function bindEvents() {
    dom.gateForm.addEventListener('submit', handleUnlock);
    dom.gateInput.addEventListener('input', function () {
      dom.gateError.classList.add('hidden');
      dom.gateInput.classList.remove('is-error');
    });
    dom.btnLock.addEventListener('click', lockApp);
    dom.btnTheme.addEventListener('click', cycleTheme);

    dom.filterSubject.addEventListener('change', function () {
      app.filter.subject = dom.filterSubject.value;
      app.filter.chapter = 'all';
      buildChapterOptions();
      renderHome();
    });

    dom.filterChapter.addEventListener('change', function () {
      app.filter.chapter = dom.filterChapter.value;
      renderHome();
    });

    Array.prototype.forEach.call(document.querySelectorAll('[data-mode]'), function (btn) {
      btn.addEventListener('click', function () {
        startPractice(btn.getAttribute('data-mode'));
      });
    });

    dom.examSize.addEventListener('change', updateExamHint);
    dom.btnStartExam.addEventListener('click', function () {
      startExam();
    });
    dom.btnResumeExam.addEventListener('click', function () {
      resumeExamDraft();
    });
    dom.btnDropDraft.addEventListener('click', dropExamDraft);

    $('#btn-stats').addEventListener('click', function () {
      navTo('stats');
    });
    $('#btn-stats-2').addEventListener('click', function () {
      navTo('stats');
    });

    dom.btnBack.addEventListener('click', handleBack);
    dom.btnPrev.addEventListener('click', goPrev);
    dom.btnFav.addEventListener('click', toggleFavorite);
    dom.btnMain.addEventListener('click', handleMainAction);
    dom.btnHandin.addEventListener('click', function () {
      submitExam(false);
    });
    dom.btnAbandonExam.addEventListener('click', abandonExam);

    // 选项使用事件委托，避免每次重绘重复绑定
    dom.qOptions.addEventListener('click', handleOptionClick);

    dom.btnResultHome.addEventListener('click', function () {
      goBackToHome();
    });
    dom.btnRetryExam.addEventListener('click', function () {
      const size = app.lastResult ? app.lastResult.size : undefined;
      startExam(size, true);
    });

    dom.btnReset.addEventListener('click', resetAllData);

    window.addEventListener('scroll', function () {
      dom.topbar.classList.toggle('scrolled', window.scrollY > 4);
    }, { passive: true });

    // 考试计时采用“离开即暂停”：关闭/刷新/切后台时暂停并落盘当前剩余时间
    const pauseAndSaveExam = function () {
      pauseExamTimer();
      saveExamDraft(true);
    };
    window.addEventListener('beforeunload', pauseAndSaveExam);
    window.addEventListener('pagehide', pauseAndSaveExam);
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') {
        pauseAndSaveExam();
      } else if (document.body.dataset.view === 'quiz' && app.session && app.session.mode === 'exam' && !app.session.exam.submitted) {
        // 回到前台继续考试：从暂停时保存的剩余时间接着走
        resumeExamTimer();
      }
    });

    // 系统返回/侧滑：按页面级历史回退，不参与答题页内部的上一题
    window.addEventListener('popstate', handlePopState);

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSchemeChange = function () {
      if ((app.store.settings.theme || 'auto') === 'auto') applyTheme();
    };
    if (media.addEventListener) media.addEventListener('change', onSchemeChange);
    else if (media.addListener) media.addListener(onSchemeChange);

    // 云同步入口：未配置 Supabase 时按钮不显示，绑定也不会影响本地功能
    if (SYNC_ENABLED) {
      dom.btnSync.addEventListener('click', openSyncModal);
      dom.btnSyncClose.addEventListener('click', closeSyncModal);
      dom.syncMask.addEventListener('click', closeSyncModal);
      dom.authForm.addEventListener('submit', function (e) {
        e.preventDefault();
        signIn();
      });
      dom.btnLogout.addEventListener('click', signOut);
      dom.btnSyncNow.addEventListener('click', function () {
        syncNow('manual');
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && !dom.syncModal.classList.contains('hidden')) closeSyncModal();
      });
    }
  }

  /* ---------------------------- 访问密码 ---------------------------- */

  function handleUnlock(e) {
    e.preventDefault();

    if (dom.gateInput.value !== ACCESS_PASSWORD) {
      dom.gateError.textContent = '密码错误，请重试';
      dom.gateError.classList.remove('hidden');
      dom.gateInput.classList.add('is-error');
      dom.gateInput.value = '';
      dom.gateInput.focus();
      return;
    }

    app.unlocked = true;
    persistUnlock();
    dom.gateError.classList.add('hidden');
    dom.gateInput.classList.remove('is-error');
    dom.gateInput.value = '';
    enterApp();
  }

  function enterApp() {
    dom.gate.classList.add('hidden');
    dom.topbar.classList.remove('hidden');
    dom.main.classList.remove('hidden');
    // 解锁进入或重新解锁时，把当前历史位置归位到首页
    app.nav.depth = 0;
    history.replaceState({ view: 'home', modal: null, depth: 0 }, '');
    showView('home');

    // 首次进入才请求题库；锁定后再次解锁直接复用已加载的数据
    if (!app.questions.length) loadQuestions();
    else maybeResumeExamDraft();

    // 已登录时进入站点后与云端同步一次（未配置或未登录时不做任何请求）
    if (SYNC_ENABLED && app.sync.session) syncNow('enter');
  }

  function showGate() {
    stopTimer();
    dom.gate.classList.remove('hidden');
    dom.topbar.classList.add('hidden');
    dom.main.classList.add('hidden');
    dom.quizBar.classList.add('hidden');
    dom.topProgress.classList.add('hidden');
    document.body.classList.remove('has-bar');
    dom.gateError.classList.add('hidden');
    dom.gateInput.classList.remove('is-error');
    dom.gateInput.value = '';
    window.setTimeout(function () {
      dom.gateInput.focus();
    }, 0);
  }

  function lockApp() {
    if (app.session && app.session.mode === 'exam' && !app.session.exam.submitted) {
      if (!window.confirm('锁定后本次考试进度会保留，重新解锁后可继续；考试计时将暂停。确定锁定吗？')) return;
      pauseExamTimer();
      saveExamDraft(true);
    }

    stopTimer();
    app.session = null;
    app.lastResult = null;
    app.unlocked = false;
    clearUnlock();
    dom.qOptions.innerHTML = '';
    dom.btnHandin.classList.add('hidden');
    dom.quizTimer.classList.add('hidden');
    dom.toast.classList.remove('show');
    closeSyncModalFromHistory();
    showGate();
  }

  function checkUnlock() {
    if (app.unlocked) return true;
    if (readUnlockToken() === passwordToken()) {
      app.unlocked = true;
      return true;
    }
    return false;
  }

  // 只保存密码散列，不把明文写入 localStorage；修改密码后旧解锁状态自动失效
  function passwordToken() {
    let hash = 2166136261;
    for (let i = 0; i < ACCESS_PASSWORD.length; i += 1) {
      hash ^= ACCESS_PASSWORD.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function persistUnlock() {
    try {
      localStorage.setItem(UNLOCK_KEY, passwordToken());
    } catch (err) {
      console.warn('解锁状态保存失败', err);
    }
  }

  function readUnlockToken() {
    try {
      return localStorage.getItem(UNLOCK_KEY);
    } catch (err) {
      return null;
    }
  }

  function clearUnlock() {
    try {
      localStorage.removeItem(UNLOCK_KEY);
    } catch (err) {
      // 隐私模式下可能无法写入，忽略即可
    }
  }

  /* ---------------------------- 题库加载 ---------------------------- */

  async function loadQuestions() {
    try {
      const data = await fetchQuestionData();
      const meta = data.meta || {};

      app.questions = data.questions.filter(isValidQuestion).map(function (q) {
        const options = q.options.map(String);
        const answer = (Array.isArray(q.answer) ? q.answer : [])
          .map(function (a) { return String(a).toUpperCase(); })
          .filter(function (letter) {
            return /^[A-F]$/.test(letter) && letter.charCodeAt(0) - 65 < options.length;
          });

        return {
          id: String(q.id),
          subject: q.subject || meta.subject || '未分类科目',
          chapter: q.chapter || '未分类章节',
          type: q.type,
          stem: q.stem || '',
          options: options,
          answer: unique(answer).sort(),
          analysis: q.analysis || '源文件未提供解析。'
        };
      });

      app.byId = {};
      app.questions.forEach(function (q) {
        app.byId[q.id] = q;
      });
      app.subjects = unique(app.questions.map(function (q) { return q.subject; }));
      app.chapters = unique(app.questions.map(function (q) { return q.chapter; }));

      buildFilterOptions();
      renderHome();

      // 题库就绪后才能校验草稿中的题号，恢复未完成的模拟考试
      maybeResumeExamDraft();

      const missing = app.questions.filter(function (q) { return q.answer.length === 0; }).length;
      dom.heroDesc.textContent = '已收录 ' + app.questions.length + ' 道题' +
        (missing ? '（其中 ' + missing + ' 道源文件缺少答案，暂不参与练习）' : '') +
        '，按科目与章节挑题，作答后立即查看解析。';
    } catch (err) {
      console.error(err);
      dom.loadError.textContent = '题库加载失败：请确认 questions.json 或 questions-data.js 与 index.html 位于同一目录。';
      dom.loadError.classList.remove('hidden');
      dom.heroDesc.textContent = '题库加载失败，请检查题库文件是否完整。';
    }
  }

  // 优先请求 questions.json；失败时（例如直接双击 index.html）自动加载内联兜底数据
  async function fetchQuestionData() {
    try {
      const res = await fetch('questions.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (!data || !Array.isArray(data.questions)) throw new Error('题库缺少 questions 数组');
      return data;
    } catch (err) {
      console.warn('questions.json 加载失败，尝试使用 questions-data.js 兜底', err);
      return loadFallbackData();
    }
  }

  function loadFallbackData() {
    return new Promise(function (resolve, reject) {
      if (window.__QUESTIONS_FALLBACK__) {
        resolve(window.__QUESTIONS_FALLBACK__);
        return;
      }

      const script = document.createElement('script');
      script.src = 'questions-data.js';
      script.onload = function () {
        if (window.__QUESTIONS_FALLBACK__) resolve(window.__QUESTIONS_FALLBACK__);
        else reject(new Error('questions-data.js 未提供题库数据'));
      };
      script.onerror = function () {
        reject(new Error('questions-data.js 加载失败'));
      };
      document.head.appendChild(script);
    });
  }

  function isValidQuestion(q) {
    if (!q || !q.id || !q.stem) return false;
    if (!Array.isArray(q.options) || q.options.length < 2) return false;
    if (!Array.isArray(q.answer)) return false;
    if (['single', 'multiple', 'judge'].indexOf(q.type) === -1) return false;

    // 答案必须是 options 中真实存在的选项字母；允许空数组，用于源文件本身缺少答案的题目
    const maxIndex = q.options.length - 1;
    return q.answer.every(function (letter) {
      const index = String(letter).toUpperCase().charCodeAt(0) - 65;
      return index >= 0 && index <= maxIndex;
    });
  }

  /* ---------------------------- 首页渲染 ---------------------------- */

  function buildFilterOptions() {
    const subjects = [{ value: 'all', label: '全部科目' }].concat(
      app.subjects.map(function (s) { return { value: s, label: s }; })
    );
    fillSelect(dom.filterSubject, subjects, app.filter.subject);
    buildChapterOptions();
  }

  function buildChapterOptions() {
    const chapters = unique(
      app.questions
        .filter(function (q) { return app.filter.subject === 'all' || q.subject === app.filter.subject; })
        .map(function (q) { return q.chapter; })
    );
    const items = [{ value: 'all', label: '全部章节' }].concat(
      chapters.map(function (c) { return { value: c, label: c }; })
    );
    const exists = items.some(function (item) { return item.value === app.filter.chapter; });
    if (!exists) app.filter.chapter = 'all';
    fillSelect(dom.filterChapter, items, app.filter.chapter);
  }

  function renderHome() {
    if (!app.questions.length) return;

    const pool = getFiltered();
    const playable = pool.filter(function (q) { return q.answer.length > 0; });
    const agg = aggregateRecords(pool);
    const done = agg.done;
    const wrong = pool.filter(function (q) { return !!app.store.wrong[q.id]; }).length;
    const fav = pool.filter(function (q) { return !!app.store.fav[q.id]; }).length;

    dom.homeTotal.textContent = pool.length;
    dom.homeDone.textContent = done;
    dom.homeWrong.textContent = wrong;
    dom.homeAccuracy.textContent = agg.accuracy === null ? '--' : Math.round(agg.accuracy * 100) + '%';
    dom.filterCount.textContent = '当前范围 ' + pool.length + ' 题';

    dom.countSequence.textContent = playable.length + ' 题';
    dom.countRandom.textContent = playable.length + ' 题';
    dom.countWrong.textContent = wrong + ' 题';
    dom.countFav.textContent = fav + ' 题';

    buildExamSizes(playable.length);
    renderRecentExams();
    renderExamDraftCard();
  }

  function renderRecentExams() {
    const list = app.store.exams.slice(0, 3);
    if (!list.length) {
      dom.recentExams.innerHTML = '<div class="empty">还没有考试记录，先来做一套模拟卷。</div>';
      return;
    }
    dom.recentExams.innerHTML = list.map(function (e) {
      return '<div class="exam-mini">' +
        '<div class="em-left">' +
          '<strong>' + formatDate(e.at) + '</strong>' +
          '<span>正确 ' + e.correct + '/' + e.total + ' · 用时 ' + formatClock(e.usedSec) + '</span>' +
        '</div>' +
        '<span class="em-score">' + e.score + ' 分</span>' +
      '</div>';
    }).join('');
  }

  function buildExamSizes(total) {
    if (total < 1) {
      dom.examSize.innerHTML = '<option value="0">暂无题目</option>';
      dom.examSize.disabled = true;
      dom.btnStartExam.disabled = true;
      dom.examTimeHint.textContent = '';
      return;
    }

    dom.examSize.disabled = false;
    dom.btnStartExam.disabled = false;

    const values = [10, 20, 30, 50, 100].filter(function (n) { return n < total; });
    if (!values.length) values.push(total);

    const prev = parseInt(dom.examSize.value, 10);
    const keep = values.indexOf(prev) !== -1 ? prev : (values.indexOf(30) !== -1 ? 30 : values[values.length - 1]);

    dom.examSize.innerHTML = values.map(function (n) {
      const label = n === total ? '全部 ' + n + ' 题' : n + ' 题';
      return '<option value="' + n + '">' + label + '</option>';
    }).join('');
    dom.examSize.value = String(keep);
    updateExamHint();
  }

  function updateExamHint() {
    const n = parseInt(dom.examSize.value, 10) || 0;
    dom.examTimeHint.textContent = n ? '限时 ' + examMinutes(n) + ' 分钟' : '';
  }

  // 模拟考试按每题 1.5 分钟估算时长，最少 5 分钟
  function examMinutes(size) {
    return Math.max(5, Math.round(size * 1.5));
  }

  /* ---------------------------- 练习会话 ---------------------------- */

  function getFiltered() {
    return app.questions.filter(function (q) {
      const subjectOk = app.filter.subject === 'all' || q.subject === app.filter.subject;
      const chapterOk = app.filter.chapter === 'all' || q.chapter === app.filter.chapter;
      return subjectOk && chapterOk;
    });
  }

  // 练习与考试只使用有答案的题目，避免源文件缺答案的题影响判题
  function getPlayableFiltered() {
    return getFiltered().filter(function (q) { return q.answer.length > 0; });
  }

  function startPractice(mode) {
    let pool = getPlayableFiltered();
    if (mode === 'wrong') {
      pool = pool.filter(function (q) { return !!app.store.wrong[q.id]; });
    }
    if (mode === 'fav') {
      pool = pool.filter(function (q) { return !!app.store.fav[q.id]; });
    }

    if (!pool.length) {
      toast(mode === 'wrong' ? '当前范围还没有错题' : '当前范围还没有收藏题目');
      return;
    }

    if (mode === 'random') pool = shuffle(pool.slice());

    app.session = {
      mode: mode,
      ids: pool.map(function (q) { return q.id; }),
      index: 0,
      entries: {},
      startedAt: Date.now(),
      exam: null
    };

    dom.qOptions.innerHTML = '';
    navTo('quiz');
    renderQuiz();
  }

  function startExam(sizeArg, replaceCurrent) {
    const pool = getPlayableFiltered();
    if (!pool.length) {
      toast('当前范围没有可抽取的题目');
      return;
    }

    // 已有草稿时，开始新考试视为放弃旧草稿
    if (readExamDraft()) {
      if (!window.confirm('已有未完成的模拟考试。开始新考试将放弃原草稿，确定吗？')) return;
      // 新考试会立即写入并同步草稿，这里只清本地，避免与随后的上传竞争
      clearExamDraft(true);
    }

    let size = sizeArg || parseInt(dom.examSize.value, 10) || pool.length;
    size = Math.min(size, pool.length);

    const ids = shuffle(pool.slice()).slice(0, size).map(function (q) { return q.id; });
    const minutes = examMinutes(size);
    const duration = minutes * 60;

    app.session = {
      mode: 'exam',
      ids: ids,
      index: 0,
      entries: {},
      startedAt: Date.now(),
      exam: {
        size: size,
        duration: duration,
        // 暂停制计时：remaining 为剩余秒数，runningSince 为本段计时起点
        remaining: duration,
        runningSince: Date.now(),
        paused: false,
        submitted: false
      }
    };

    dom.qOptions.innerHTML = '';
    if (replaceCurrent) replaceView('quiz');
    else navTo('quiz');
    startTimer();
    renderQuiz();
    saveExamDraft();
  }

  function ensureEntry(id) {
    if (!app.session.entries[id]) {
      app.session.entries[id] = { selected: [], submitted: false, correct: null };
    }
    return app.session.entries[id];
  }

  function currentQuestion() {
    if (!app.session) return null;
    return app.byId[app.session.ids[app.session.index]] || null;
  }

  /* ---------------------------- 答题页渲染 ---------------------------- */

  function renderQuiz() {
    const s = app.session;
    const q = currentQuestion();
    if (!s || !q) return;

    const entry = ensureEntry(q.id);
    const isExam = s.mode === 'exam';
    const judged = entry.submitted && !isExam;

    dom.quizMode.textContent = MODE_LABEL[s.mode];
    dom.quizCount.textContent = (s.index + 1) + ' / ' + s.ids.length;
    dom.topProgressFill.style.width = ((s.index + 1) / s.ids.length * 100) + '%';

    dom.qType.textContent = TYPE_LABEL[q.type] || q.type;
    dom.qChapter.textContent = q.chapter;
    dom.qStem.textContent = q.stem;

    dom.qOptions.innerHTML = q.options.map(function (text, i) {
      const letter = String.fromCharCode(65 + i);
      const picked = entry.selected.indexOf(letter) !== -1;
      let cls = 'option';
      let tag = '';

      // 练习模式判题后：正确答案标绿，错选项标红，其余选项弱化
      if (judged) {
        cls += ' locked';
        if (q.answer.indexOf(letter) !== -1) {
          cls += ' is-correct';
          tag = '正确';
        } else if (picked) {
          cls += ' is-wrong';
          tag = '错选';
        } else {
          cls += ' is-dim';
        }
      } else if (picked) {
        cls += ' is-selected';
      }

      return '<button type="button" class="' + cls + '" data-letter="' + letter + '"' +
        (judged ? ' disabled' : '') + '>' +
        '<span class="option-letter">' + letter + '</span>' +
        '<span class="option-text">' + escapeHtml(text) + '</span>' +
        (tag ? '<span class="option-tag">' + tag + '</span>' : '') +
      '</button>';
    }).join('');

    if (judged) {
      const ok = !!entry.correct;
      dom.qAnalysis.innerHTML =
        '<div class="analysis-head">' +
          '<span>正确答案 <b>' + formatAnswer(q, q.answer) + '</b></span>' +
          '<span>你的答案 <b>' + formatAnswer(q, entry.selected) + '</b></span>' +
          '<span class="analysis-result ' + (ok ? 'ok' : 'ng') + '">' + (ok ? '回答正确' : '回答错误') + '</span>' +
        '</div>' +
        '<p><span class="label">解析：</span>' + escapeHtml(q.analysis) + '</p>';
      dom.qAnalysis.classList.remove('hidden');
    } else {
      dom.qAnalysis.classList.add('hidden');
      dom.qAnalysis.innerHTML = '';
    }

    dom.btnFav.classList.toggle('active', !!app.store.fav[q.id]);
    dom.btnFav.textContent = app.store.fav[q.id] ? '★ 已收藏' : '☆ 收藏';
    dom.btnPrev.disabled = s.index === 0;

    if (isExam) {
      dom.btnHandin.classList.remove('hidden');
      dom.btnAbandonExam.classList.remove('hidden');
      dom.quizTimer.classList.remove('hidden');
      dom.btnMain.textContent = s.index === s.ids.length - 1 ? '交卷' : '下一题';
      dom.btnMain.disabled = false;
      updateTimerUI();
    } else {
      dom.btnHandin.classList.add('hidden');
      dom.btnAbandonExam.classList.add('hidden');
      dom.quizTimer.classList.add('hidden');

      // 多选题必须选择后手动提交，单选与判断题点击选项立即判定
      if (q.type === 'multiple' && !entry.submitted) {
        dom.btnMain.textContent = '提交答案';
        dom.btnMain.disabled = entry.selected.length === 0;
      } else {
        dom.btnMain.textContent = s.index === s.ids.length - 1 ? '完成练习' : '下一题';
        dom.btnMain.disabled = false;
      }
    }
  }

  function handleOptionClick(e) {
    const btn = e.target.closest('.option');
    if (!btn || btn.disabled) return;

    const s = app.session;
    const q = currentQuestion();
    if (!s || !q) return;

    const entry = ensureEntry(q.id);
    if (entry.submitted && s.mode !== 'exam') return;

    const letter = btn.getAttribute('data-letter');

    if (q.type === 'multiple') {
      // 多选：点击切换选中状态，练习模式下不立即判题
      const idx = entry.selected.indexOf(letter);
      if (idx === -1) entry.selected.push(letter);
      else entry.selected.splice(idx, 1);
      entry.submitted = false;
      renderQuiz();
      return;
    }

    // 单选 / 判断：只保留一个选项
    entry.selected = [letter];
    if (s.mode === 'exam') {
      renderQuiz();
      saveExamDraft();
    } else {
      submitCurrent();
    }
  }

  // 判定当前题并写入做题记录、错题本
  function submitCurrent() {
    const s = app.session;
    const q = currentQuestion();
    if (!s || !q || s.mode === 'exam') return;

    const entry = ensureEntry(q.id);
    if (entry.submitted || !entry.selected.length) return;

    entry.submitted = true;
    entry.correct = isCorrect(q, entry.selected);
    applyRecord(q, entry.selected, entry.correct);
    saveStore();
    renderQuiz();
    revealAnalysis();
  }

  // 判题后若解析在屏幕下方，自动滚动到解析区域，减少手动滑动
  function revealAnalysis() {
    requestAnimationFrame(function () {
      if (!app.session) return;
      const rect = dom.qAnalysis.getBoundingClientRect();
      if (rect.height && rect.top > window.innerHeight * 0.58) {
        window.scrollTo({
          top: window.scrollY + rect.top - 72,
          behavior: 'smooth'
        });
      }
    });
  }

  function goPrev() {
    const s = app.session;
    if (!s || s.index === 0) return;
    s.index -= 1;
    renderQuiz();
    saveExamDraft();
    window.scrollTo(0, 0);
  }

  function handleMainAction() {
    const s = app.session;
    const q = currentQuestion();
    if (!s || !q) return;

    if (s.mode === 'exam') {
      if (s.index === s.ids.length - 1) {
        submitExam(false);
      } else {
        s.index += 1;
        renderQuiz();
        saveExamDraft();
        window.scrollTo(0, 0);
      }
      return;
    }

    const entry = ensureEntry(q.id);

    // 多选未提交时，主按钮承担“提交答案”的职责
    if (q.type === 'multiple' && !entry.submitted) {
      submitCurrent();
      return;
    }

    if (s.index === s.ids.length - 1) {
      goBackToHome();
      toast('本组练习完成');
      return;
    }

    s.index += 1;
    renderQuiz();
    window.scrollTo(0, 0);
  }

  function toggleFavorite() {
    const q = currentQuestion();
    if (!q) return;

    if (app.store.fav[q.id]) {
      delete app.store.fav[q.id];
      toast('已取消收藏');
    } else {
      app.store.fav[q.id] = true;
      toast('已加入收藏');
    }
    saveStore();
    renderQuiz();
  }

  /* ---------------------------- 判题与记录 ---------------------------- */

  // 答案比对：多选题必须与正确答案完全一致（顺序无关）
  function isCorrect(q, selected) {
    if (selected.length !== q.answer.length) return false;
    return q.answer.every(function (letter) {
      return selected.indexOf(letter) !== -1;
    });
  }

  /**
   * 做题记录结构：
   * records[id] = { attempts, correct, lastAnswer, lastCorrect, lastAt }
   * 错题本结构：
   * wrong[id] = { count, at }
   * 只要答对一次就从错题本移除，答错则累计错误次数。
   */
  function applyRecord(q, selected, correct) {
    const rec = app.store.records[q.id] || { attempts: 0, correct: 0 };
    rec.attempts += 1;
    if (correct) rec.correct += 1;
    rec.lastAnswer = selected.slice().sort();
    rec.lastCorrect = correct;
    rec.lastAt = Date.now();
    app.store.records[q.id] = rec;

    if (correct) {
      delete app.store.wrong[q.id];
    } else {
      const old = app.store.wrong[q.id];
      app.store.wrong[q.id] = {
        count: (old && old.count ? old.count : 0) + 1,
        at: Date.now()
      };
    }
  }

  /* ---------------------------- 模拟考试 ---------------------------- */

  /**
   * 考试草稿：{ ids, index, entries(仅 selected), startedAt, duration, remaining, size }
   * 计时采用“离开即暂停”：remaining 保存退出那一刻的剩余秒数，
   * 重新进入时从它接着走；登录后随账号同步到云端。
   */
  function draftFromSession() {
    const s = app.session;
    if (!s || s.mode !== 'exam' || !s.exam || s.exam.submitted) return null;

    const entries = {};
    s.ids.forEach(function (id) {
      const entry = s.entries[id];
      entries[id] = { selected: entry && entry.selected ? entry.selected.slice() : [] };
    });

    return {
      ids: s.ids.slice(),
      index: s.index,
      entries: entries,
      startedAt: s.startedAt,
      duration: s.exam.duration,
      remaining: examRemainingSeconds(),
      size: s.exam.size,
      updatedAt: Date.now()
    };
  }

  // flush 为 true 时立即尝试推送云端，用于关闭/刷新等页面即将卸载的场景
  function saveExamDraft(flush) {
    const draft = draftFromSession();
    if (!draft) return;
    writeExamDraft(draft);
    if (flush) pushCloudDraft();
    else scheduleDraftSync();
  }

  function writeExamDraft(draft) {
    try {
      if (draft) localStorage.setItem(EXAM_DRAFT_KEY, JSON.stringify(draft));
      else localStorage.removeItem(EXAM_DRAFT_KEY);
    } catch (err) {
      console.warn('考试草稿保存失败', err);
    }
    renderExamDraftCard();
  }

  function readDraftRaw() {
    try {
      const raw = localStorage.getItem(EXAM_DRAFT_KEY);
      return raw ? normalizeDraft(JSON.parse(raw)) : null;
    } catch (err) {
      return null;
    }
  }

  // 兼容旧版本草稿：没有 remaining 时，按旧的绝对结束时间换算一次
  function normalizeDraft(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (!Array.isArray(raw.ids) || !raw.ids.length) return null;
    if (typeof raw.duration !== 'number' || !raw.duration) return null;

    let remaining = typeof raw.remaining === 'number' ? raw.remaining : null;
    if (remaining === null) {
      remaining = typeof raw.endAt === 'number'
        ? Math.max(0, Math.ceil((raw.endAt - Date.now()) / 1000))
        : raw.duration;
    }
    remaining = Math.max(0, Math.min(raw.duration, Math.round(remaining)));

    const ids = raw.ids.filter(function (id) { return typeof id === 'string'; });
    if (!ids.length) return null;

    const entries = {};
    ids.forEach(function (id) {
      const saved = raw.entries && raw.entries[id];
      entries[id] = {
        selected: (saved && Array.isArray(saved.selected) ? saved.selected : [])
          .filter(function (letter) { return /^[A-F]$/.test(letter); })
      };
    });

    return {
      ids: ids,
      index: Math.max(0, parseInt(raw.index, 10) || 0),
      entries: entries,
      startedAt: raw.startedAt || Date.now(),
      duration: raw.duration,
      remaining: remaining,
      size: Math.min(raw.size || ids.length, ids.length),
      updatedAt: raw.updatedAt || 0
    };
  }

  function readExamDraft() {
    const draft = readDraftRaw();
    if (!draft) return null;
    // 题库若发生变化，移除已不存在的题号
    draft.ids = draft.ids.filter(function (id) { return !!app.byId[id]; });
    return draft.ids.length ? draft : null;
  }

  // skipCloud：只清本地，不动云端（例如清除全部数据时会整行删除）
  function clearExamDraft(skipCloud) {
    writeExamDraft(null);
    if (!skipCloud) clearCloudDraft();
  }

  function buildExamSession(draft) {
    const entries = {};
    draft.ids.forEach(function (id) {
      const q = app.byId[id];
      if (!q) return;
      const saved = draft.entries && draft.entries[id];
      const selected = (saved && Array.isArray(saved.selected) ? saved.selected : [])
        .filter(function (letter) {
          return /^[A-F]$/.test(letter) && letter.charCodeAt(0) - 65 < q.options.length;
        });
      entries[id] = { selected: selected, submitted: false, correct: null };
    });

    const index = Math.min(
      Math.max(parseInt(draft.index, 10) || 0, 0),
      draft.ids.length - 1
    );

    return {
      mode: 'exam',
      ids: draft.ids.slice(),
      index: index,
      entries: entries,
      startedAt: draft.startedAt || Date.now(),
      exam: {
        size: Math.min(draft.size || draft.ids.length, draft.ids.length),
        duration: draft.duration,
        // 从草稿保存的剩余时间继续，不按真实流逝扣
        remaining: Math.max(0, Math.min(draft.duration, draft.remaining)),
        runningSince: Date.now(),
        paused: false,
        submitted: false
      }
    };
  }

  function resumeExamDraft(fromHistory) {
    const draft = readExamDraft();
    if (!draft) {
      clearExamDraft(true);
      return false;
    }

    app.session = buildExamSession(draft);

    // 剩余时间已在退出前耗尽：按草稿中已答内容自动交卷
    if (app.session.exam.remaining <= 0) {
      submitExam(true);
      toast('考试时间已结束，已自动交卷');
      return true;
    }

    dom.qOptions.innerHTML = '';
    if (fromHistory) showView('quiz');
    else navTo('quiz');
    startTimer();
    renderQuiz();
    toast('已恢复未完成的模拟考试');
    return true;
  }

  function maybeResumeExamDraft() {
    if (app.session) return;
    if (document.body.dataset.view !== 'home') return;
    if (!readExamDraft()) return;
    resumeExamDraft();
  }

  function dropExamDraft() {
    if (!window.confirm('放弃未完成的模拟考试？已答内容将清空，无法恢复。')) return;
    clearExamDraft();
    toast('已放弃未完成的考试');
  }

  function abandonExam() {
    if (!app.session || app.session.mode !== 'exam' || app.session.exam.submitted) return;
    if (!window.confirm('放弃本次模拟考试？当前已答内容将清空，且不会计入成绩。')) return;

    pauseExamTimer();
    app.session = null;
    clearExamDraft();
    goBackToHome();
    toast('已放弃本次考试');
  }

  function renderExamDraftCard() {
    if (!dom.examDraftCard) return;
    const draft = readExamDraft();
    if (!draft) {
      dom.examDraftCard.classList.add('hidden');
      return;
    }

    const answered = draft.ids.filter(function (id) {
      const entry = draft.entries && draft.entries[id];
      return entry && Array.isArray(entry.selected) && entry.selected.length > 0;
    }).length;

    dom.examDraftMeta.textContent = '剩余 ' + formatClock(draft.remaining) +
      ' · 已答 ' + answered + '/' + draft.ids.length;
    dom.examDraftCard.classList.remove('hidden');
  }

  function startTimer() {
    stopTimer();
    app.timerId = setInterval(tickTimer, 1000);
    tickTimer();
  }

  function stopTimer() {
    if (app.timerId) {
      clearInterval(app.timerId);
      app.timerId = null;
    }
  }

  // 剩余秒数：暂停时取保存值，运行中按本段经过时间扣减
  function examRemainingSeconds() {
    const s = app.session;
    if (!s || !s.exam) return 0;
    const e = s.exam;
    if (e.paused || !e.runningSince) return Math.max(0, Math.round(e.remaining || 0));
    const elapsed = Math.floor((Date.now() - e.runningSince) / 1000);
    return Math.max(0, Math.round(e.remaining - elapsed));
  }

  function pauseExamTimer() {
    const s = app.session;
    if (!s || s.mode !== 'exam' || !s.exam || s.exam.submitted) return;
    if (!s.exam.paused) {
      s.exam.remaining = examRemainingSeconds();
      s.exam.paused = true;
      s.exam.runningSince = null;
    }
    stopTimer();
  }

  function resumeExamTimer() {
    const s = app.session;
    if (!s || s.mode !== 'exam' || !s.exam || s.exam.submitted) return;
    if (s.exam.paused) {
      s.exam.paused = false;
      s.exam.runningSince = Date.now();
    }
    startTimer();
  }

  function tickTimer() {
    const s = app.session;
    if (!s || s.mode !== 'exam' || !s.exam || s.exam.submitted) {
      stopTimer();
      return;
    }

    const remain = examRemainingSeconds();
    updateTimerUI(remain);

    if (remain <= 0) {
      s.exam.remaining = 0;
      stopTimer();
      submitExam(true);
    }
  }

  function updateTimerUI(remainArg) {
    const s = app.session;
    if (!s || !s.exam) return;
    const remain = typeof remainArg === 'number' ? remainArg : examRemainingSeconds();
    dom.quizTimer.textContent = formatClock(remain);
    dom.quizTimer.classList.toggle('urgent', remain <= 60);
  }

  /**
   * 交卷算分：
   * 每题等分，得分 = 答对题数 / 总题数 × 100（四舍五入）
   * 未作答按错误计分；已作答题目写入做题记录与错题本。
   */
  function submitExam(auto) {
    const s = app.session;
    if (!s || s.mode !== 'exam' || !s.exam || s.exam.submitted) return;

    const unanswered = s.ids.filter(function (id) {
      const e = s.entries[id];
      return !e || !e.selected.length;
    }).length;

    if (!auto && unanswered > 0) {
      if (!window.confirm('还有 ' + unanswered + ' 题未作答，未答题按错误计分，确定交卷吗？')) return;
    }

    const remainingBeforeSubmit = examRemainingSeconds();
    stopTimer();
    s.exam.submitted = true;
    clearExamDraft();

    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    s.ids.forEach(function (id) {
      const q = app.byId[id];
      const entry = ensureEntry(id);

      if (!entry.selected.length) {
        unansweredCount += 1;
        entry.submitted = true;
        entry.correct = false;
        return;
      }

      const ok = isCorrect(q, entry.selected);
      entry.submitted = true;
      entry.correct = ok;
      applyRecord(q, entry.selected, ok);

      if (ok) correctCount += 1;
      else wrongCount += 1;
    });

    const score = Math.round(correctCount / s.ids.length * 100);
    const usedSec = Math.min(
      s.exam.duration,
      Math.max(1, s.exam.duration - remainingBeforeSubmit)
    );

    app.store.exams.unshift({
      id: 'exam-' + Date.now(),
      at: Date.now(),
      total: s.ids.length,
      correct: correctCount,
      score: score,
      usedSec: usedSec,
      size: s.exam.size
    });
    app.store.exams = app.store.exams.slice(0, MAX_EXAMS);
    saveStore();

    app.lastResult = {
      ids: s.ids.slice(),
      entries: s.entries,
      correctCount: correctCount,
      wrongCount: wrongCount,
      unansweredCount: unansweredCount,
      score: score,
      usedSec: usedSec,
      size: s.exam.size
    };

    renderResult();
    showView('result');
    // 结果页替换答题页这条历史，系统返回时直接回首页，而不是回到已交卷的答题页
    history.replaceState({ view: 'result', modal: null, depth: app.nav.depth }, '');
  }

  function renderResult() {
    const r = app.lastResult;
    if (!r) {
      showView('home');
      return;
    }

    dom.resultScore.textContent = r.score;
    dom.scoreRing.style.setProperty('--score', r.score);
    dom.resultCorrect.textContent = r.correctCount;
    dom.resultWrong.textContent = r.wrongCount;
    dom.resultUnanswered.textContent = r.unansweredCount;
    dom.resultTime.textContent = formatClock(r.usedSec);

    if (r.score >= 85) dom.resultTitle.textContent = '表现出色，继续保持';
    else if (r.score >= 60) dom.resultTitle.textContent = '达到及格线，再接再厉';
    else dom.resultTitle.textContent = '基础还需巩固，建议错题重做';

    dom.reviewList.innerHTML = r.ids.map(function (id, i) {
      const q = app.byId[id];
      const entry = r.entries[id] || { selected: [], correct: false };
      const statusText = !entry.selected.length ? '未作答' : (entry.correct ? '正确' : '错误');

      return '<article class="card review-card">' +
        '<div class="review-head">' +
          '<span class="review-index">第 ' + (i + 1) + ' 题</span>' +
          '<span class="pill">' + (TYPE_LABEL[q.type] || q.type) + '</span>' +
          '<span class="review-status ' + (entry.correct ? 'ok' : 'ng') + '">' + statusText + '</span>' +
        '</div>' +
        '<p class="review-stem">' + escapeHtml(q.stem) + '</p>' +
        '<div class="review-answers">' +
          '<span>你的答案 <b>' + formatAnswer(q, entry.selected) + '</b></span>' +
          '<span>正确答案 <b>' + formatAnswer(q, q.answer) + '</b></span>' +
        '</div>' +
        '<div class="review-analysis"><b>解析：</b>' + escapeHtml(q.analysis) + '</div>' +
      '</article>';
    }).join('');
  }

  /* ---------------------------- 统计页 ---------------------------- */

  function renderStats() {
    const agg = aggregateRecords(app.questions);
    dom.statsScope.textContent = '统计范围：全部 ' + app.questions.length + ' 题（首页数字随科目/章节筛选变化）';
    dom.statAccuracy.textContent = agg.accuracy === null ? '--' : Math.round(agg.accuracy * 100) + '%';
    dom.statAttempts.textContent = '共 ' + agg.attempts + ' 次作答';
    dom.statDone.textContent = agg.done;
    dom.statTotal.textContent = '共 ' + app.questions.length + ' 题';

    dom.statWrong.textContent = Object.keys(app.store.wrong).filter(function (id) {
      return !!app.byId[id];
    }).length;
    dom.statFav.textContent = Object.keys(app.store.fav).filter(function (id) {
      return !!app.byId[id];
    }).length;

    renderChapterStats();
    renderExamHistory();
  }

  // 章节掌握情况：正确率按该章节所有题目的累计作答次数计算
  function renderChapterStats() {
    const groups = {};
    app.questions.forEach(function (q) {
      if (!groups[q.chapter]) groups[q.chapter] = [];
      groups[q.chapter].push(q);
    });

    const names = Object.keys(groups);
    if (!names.length) {
      dom.chapterStats.innerHTML = '<div class="empty">暂无章节数据</div>';
      return;
    }

    dom.chapterStats.innerHTML = names.map(function (name) {
      const list = groups[name];
      let attempts = 0;
      let correct = 0;
      let done = 0;

      list.forEach(function (q) {
        const r = app.store.records[q.id];
        if (!r || !r.attempts) return;
        done += 1;
        attempts += r.attempts;
        correct += r.correct;
      });

      const accuracy = attempts ? Math.round(correct / attempts * 100) : 0;
      return '<div class="chapter-row">' +
        '<div class="chapter-top">' +
          '<strong>' + escapeHtml(name) + '</strong>' +
          '<span>已做 ' + done + '/' + list.length + ' · 正确率 ' + (attempts ? accuracy + '%' : '--') + '</span>' +
        '</div>' +
        '<div class="chapter-bar"><i style="width:' + accuracy + '%"></i></div>' +
      '</div>';
    }).join('');
  }

  function renderExamHistory() {
    if (!app.store.exams.length) {
      dom.examHistory.innerHTML = '<div class="empty">暂无考试记录</div>';
      return;
    }

    dom.examHistory.innerHTML = app.store.exams.map(function (e) {
      return '<div class="exam-mini">' +
        '<div class="em-left">' +
          '<strong>' + formatDate(e.at) + '</strong>' +
          '<span>共 ' + e.total + ' 题 · 正确 ' + e.correct + ' · 用时 ' + formatClock(e.usedSec) + '</span>' +
        '</div>' +
        '<span class="em-score">' + e.score + ' 分</span>' +
      '</div>';
    }).join('');
  }

  function resetAllData() {
    if (!window.confirm('确定清除全部做题记录、错题、收藏、考试历史和未完成的考试草稿吗？此操作不可恢复。')) return;
    stopTimer();
    app.session = null;
    // 本地草稿随整行云端数据一起删除，这里不再单独推送
    clearExamDraft(true);
    app.store = defaultStore();
    saveStore(true);
    // 已登录时同步清除云端记录，避免下次登录又把旧数据合并回来
    deleteCloudState();
    app.filter = { subject: 'all', chapter: 'all' };
    applyTheme();
    buildFilterOptions();
    renderHome();
    renderStats();
    toast('本地数据已清除');
  }

  /* ---------------------------- 视图与主题 ---------------------------- */

  function showView(name) {
    ['home', 'quiz', 'stats', 'result'].forEach(function (view) {
      $('#view-' + view).classList.toggle('hidden', view !== name);
    });

    const isQuiz = name === 'quiz';
    document.body.dataset.view = name;
    document.body.classList.toggle('has-bar', isQuiz);
    dom.quizBar.classList.toggle('hidden', !isQuiz);
    dom.topProgress.classList.toggle('hidden', !isQuiz);
    dom.btnBack.classList.toggle('hidden', name === 'home');

    if (name === 'home') dom.topbarTitle.textContent = '刷题助手';
    else if (name === 'stats') dom.topbarTitle.textContent = '学习统计';
    else if (name === 'result') dom.topbarTitle.textContent = '考试结果';
    else if (app.session) dom.topbarTitle.textContent = MODE_LABEL[app.session.mode];

    if (name === 'home') renderHome();
    if (name === 'stats') renderStats();
    if (name !== 'quiz') dom.topProgressFill.style.width = '0';

    window.scrollTo(0, 0);
  }

  // 页面级前进：写入一条历史，系统返回时回到上一屏
  function navTo(name) {
    app.nav.depth += 1;
    history.pushState({ view: name, modal: null, depth: app.nav.depth }, '');
    showView(name);
  }

  // 原地替换当前历史（交卷结果页、重新考试），避免返回时回到已结束的答题页
  function replaceView(name) {
    history.replaceState({ view: name, modal: null, depth: app.nav.depth }, '');
    showView(name);
  }

  function leaveQuizState() {
    if (app.session && app.session.mode === 'exam' && !app.session.exam.submitted) {
      // 离开考试即暂停：剩余时间写入草稿，回来时从该值继续
      pauseExamTimer();
      saveExamDraft(true);
      toast('考试已暂停，可在首页继续');
    }
    stopTimer();
    app.session = null;
  }

  function goBackToHome() {
    const state = history.state;
    if (state && state.depth > 0) {
      history.back();
      return;
    }

    leaveQuizState();
    app.nav.depth = 0;
    history.replaceState({ view: 'home', modal: null, depth: 0 }, '');
    showView('home');
  }

  // popstate 只负责“恢复目标页”，不再写历史，避免返回键来回叠加
  function handlePopState(e) {
    const state = e.state || { view: 'home', modal: null, depth: 0 };
    app.nav.depth = state.depth || 0;

    if (state.modal === 'sync') openSyncModalFromHistory();
    else closeSyncModalFromHistory();

    if (state.view && state.view !== document.body.dataset.view) {
      applyViewFromHistory(state.view);
    }
  }

  function applyViewFromHistory(name) {
    if (name === 'quiz') {
      // 前进回到答题页：练习会话已释放时，优先恢复考试草稿
      if (!app.session) {
        if (readExamDraft()) {
          resumeExamDraft(true);
          return;
        }
        app.nav.depth = 0;
        history.replaceState({ view: 'home', modal: null, depth: 0 }, '');
        showView('home');
        toast('练习状态已失效，请重新开始');
        return;
      }

      showView('quiz');
      if (app.session.mode === 'exam') resumeExamTimer();
      renderQuiz();
      return;
    }

    if (name === 'result' && !app.lastResult) {
      app.nav.depth = 0;
      history.replaceState({ view: 'home', modal: null, depth: 0 }, '');
      showView('home');
      return;
    }

    if (document.body.dataset.view === 'quiz') leaveQuizState();
    if (name === 'home' && app.session) app.session = null;
    showView(name);
  }

  function handleBack() {
    const view = document.body.dataset.view;

    if (view === 'quiz' && app.session && app.session.mode === 'exam' && !app.session.exam.submitted) {
      if (!window.confirm('退出后本次考试进度会保留，可在首页继续；考试计时将暂停。确定退出吗？')) return;
    }

    goBackToHome();
  }

  function applyTheme() {
    const mode = app.store.settings.theme || 'auto';
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = mode === 'dark' || (mode === 'auto' && prefersDark);

    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.dataset.themeMode = mode;
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    updateThemeButton();
  }

  function updateThemeButton() {
    const mode = app.store.settings.theme || 'auto';
    if (mode === 'auto') {
      dom.btnTheme.textContent = '跟随系统';
      dom.btnTheme.title = '当前跟随系统，点击切换为浅色';
    } else if (mode === 'light') {
      dom.btnTheme.textContent = '浅色';
      dom.btnTheme.title = '当前浅色，点击切换为深色';
    } else {
      dom.btnTheme.textContent = '深色';
      dom.btnTheme.title = '当前深色，点击切换为跟随系统';
    }
  }

  function cycleTheme() {
    const order = ['auto', 'light', 'dark'];
    const current = app.store.settings.theme || 'auto';
    const next = order[(order.indexOf(current) + 1) % order.length];
    app.store.settings.theme = next;
    saveStore(true);
    applyTheme();
    toast('主题：' + (next === 'auto' ? '跟随系统' : next === 'light' ? '浅色' : '深色'));
  }

  /* ---------------------------- 云同步（可选） ---------------------------- */

  // 配置为空时整块逻辑不启用：不显示入口、不发请求，本地模式完全不受影响
  function initSync() {
    if (!SYNC_ENABLED) return;

    dom.btnSync.classList.remove('hidden');
    try {
      const raw = localStorage.getItem(SYNC_KEY);
      if (raw) app.sync.session = JSON.parse(raw);
    } catch (err) {
      app.sync.session = null;
    }
    updateSyncUI();
  }

  function updateSyncUI() {
    if (!SYNC_ENABLED) return;
    const session = app.sync.session;
    dom.authForm.classList.toggle('hidden', Boolean(session));
    dom.syncUser.classList.toggle('hidden', !session);
    if (session) {
      dom.syncEmail.textContent = session.email || session.userId || '已登录';
      setSyncStatus(app.sync.statusText === '未登录' ? '已登录' : app.sync.statusText);
    } else {
      setSyncStatus('未登录');
    }
  }

  function openSyncModal() {
    if (!SYNC_ENABLED) return;
    const state = history.state;
    if (!(state && state.modal === 'sync')) {
      app.nav.depth += 1;
      history.pushState({
        view: document.body.dataset.view,
        modal: 'sync',
        depth: app.nav.depth
      }, '');
    }
    openSyncModalFromHistory();
  }

  // 供 popstate 使用：只显示，不再写历史
  function openSyncModalFromHistory() {
    if (!SYNC_ENABLED) return;
    dom.syncModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    if (!app.sync.session) {
      window.setTimeout(function () {
        dom.authEmail.focus();
      }, 0);
    }
  }

  function closeSyncModal() {
    const state = history.state;
    if (state && state.modal === 'sync') {
      history.back();
      return;
    }
    closeSyncModalFromHistory();
  }

  function closeSyncModalFromHistory() {
    dom.syncModal.classList.add('hidden');
    document.body.classList.remove('modal-open');
  }

  // 同步状态同时写入弹窗和顶栏按钮，顶栏只显示简短状态
  function setSyncStatus(text) {
    app.sync.statusText = text;
    if (dom.syncStatus) dom.syncStatus.textContent = text;
    if (!dom.btnSync) return;

    let label = '同步';
    if (!app.sync.session) label = '未登录';
    else if (text.indexOf('同步中') === 0) label = '同步中';
    else if (text.indexOf('已同步') === 0) label = '已同步';
    else if (text.indexOf('同步失败') === 0) label = '同步失败';
    dom.btnSync.textContent = label;
    dom.btnSync.title = '跨设备同步 · ' + text;
  }

  function apiUrl(path) {
    return SUPABASE_URL.replace(/\/+$/, '') + path;
  }

  function authHeaders() {
    return {
      apikey: SUPABASE_ANON_KEY,
      'Content-Type': 'application/json'
    };
  }

  async function authRequest(path, options) {
    const res = await fetch(apiUrl(path), options);
    let data = null;
    try {
      data = await res.json();
    } catch (err) {
      data = null;
    }
    if (!res.ok) {
      const raw = (data && (data.msg || data.message || data.error_description || data.error)) || ('HTTP ' + res.status);
      throw new Error(translateAuthError(raw));
    }
    return data;
  }

  function translateAuthError(message) {
    const text = String(message || '');
    if (/Invalid login credentials/i.test(text)) return '邮箱或密码错误';
    if (/Email not confirmed/i.test(text)) return '邮箱尚未验证，请先查收确认邮件';
    if (/Password should be at least/i.test(text)) return '密码至少 6 位';
    if (/Failed to fetch|NetworkError/i.test(text)) return '网络不可用，已保持本地模式';
    return text;
  }

  function saveSession(data) {
    if (!data || !data.access_token) return;
    app.sync.session = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
      userId: data.user && data.user.id,
      email: data.user && data.user.email
    };
    try {
      localStorage.setItem(SYNC_KEY, JSON.stringify(app.sync.session));
    } catch (err) {
      console.warn('登录状态保存失败', err);
    }
  }

  async function signIn() {
    if (!SYNC_ENABLED) return;
    const email = dom.authEmail.value.trim();
    const password = dom.authPassword.value;
    if (!email || !password) {
      setSyncStatus('请填写邮箱和密码');
      return;
    }

    setSyncStatus('登录中…');
    try {
      const data = await authRequest('/auth/v1/token?grant_type=password', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ email: email, password: password })
      });
      saveSession(data);
      dom.authPassword.value = '';
      updateSyncUI();
      await syncNow('login');
    } catch (err) {
      const message = /Failed to fetch|NetworkError|Load failed/i.test(err.message)
        ? '网络不可用，请稍后重试'
        : err.message;
      setSyncStatus('登录失败：' + message);
    }
  }

  async function signOut() {
    const session = app.sync.session;
    if (session) {
      // 服务端登出失败不影响本地：先清本地会话
      try {
        await fetch(apiUrl('/auth/v1/logout'), {
          method: 'POST',
          headers: Object.assign({ Authorization: 'Bearer ' + session.accessToken }, authHeaders())
        });
      } catch (err) {
        // 离线登出时忽略即可
      }
    }
    app.sync.session = null;
    try {
      localStorage.removeItem(SYNC_KEY);
    } catch (err) {
      // 忽略
    }
    dom.authPassword.value = '';
    updateSyncUI();
    toast('已退出云同步，本地数据保留');
  }

  // 访问令牌过期自动刷新；刷新失败则视为未登录，答题不受影响
  async function ensureSession() {
    const session = app.sync.session;
    if (!session) return null;
    if (session.expiresAt && session.expiresAt - Date.now() > 60000) return session;
    if (!session.refreshToken) {
      app.sync.session = null;
      localStorage.removeItem(SYNC_KEY);
      updateSyncUI();
      return null;
    }

    try {
      const data = await authRequest('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ refresh_token: session.refreshToken })
      });
      saveSession(data);
      updateSyncUI();
      return app.sync.session;
    } catch (err) {
      app.sync.session = null;
      localStorage.removeItem(SYNC_KEY);
      updateSyncUI();
      return null;
    }
  }

  function syncHeaders(session) {
    return {
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + session.accessToken,
      'Content-Type': 'application/json'
    };
  }

  async function fetchCloudState(session) {
    const base = '/rest/v1/quiz_state?select=records,wrong,fav,exams';
    const suffix = '&user_id=eq.' + encodeURIComponent(session.userId);
    let res = await fetch(apiUrl(base + (app.sync.draftSupported ? ',exam_draft' : '') + suffix), {
      headers: syncHeaders(session)
    });

    // 云端尚未执行加列 SQL 时，自动降级为只同步学习数据
    if (!res.ok && app.sync.draftSupported && res.status === 400) {
      app.sync.draftSupported = false;
      res = await fetch(apiUrl(base + suffix), { headers: syncHeaders(session) });
    }

    if (!res.ok) throw new Error('读取云端失败（HTTP ' + res.status + '）');
    const rows = await res.json();
    return rows && rows.length ? rows[0] : null;
  }

  async function pushCloudState(session, state, examDraft) {
    const body = {
      user_id: session.userId,
      records: state.records,
      wrong: state.wrong,
      fav: state.fav,
      exams: state.exams,
      updated_at: new Date().toISOString()
    };
    if (app.sync.draftSupported) body.exam_draft = examDraft || null;

    let res = await fetch(apiUrl('/rest/v1/quiz_state'), {
      method: 'POST',
      headers: Object.assign(syncHeaders(session), {
        Prefer: 'resolution=merge-duplicates,return=minimal'
      }),
      body: JSON.stringify([body])
    });

    if (!res.ok && app.sync.draftSupported && res.status === 400) {
      app.sync.draftSupported = false;
      delete body.exam_draft;
      res = await fetch(apiUrl('/rest/v1/quiz_state'), {
        method: 'POST',
        headers: Object.assign(syncHeaders(session), {
          Prefer: 'resolution=merge-duplicates,return=minimal'
        }),
        body: JSON.stringify([body])
      });
    }

    if (!res.ok) throw new Error('写入云端失败（HTTP ' + res.status + '）');
  }

  // 只更新考试草稿列，不动学习数据；keepalive 让关闭/刷新时的请求尽量发出
  async function patchCloudDraft(session, draft, keepalive) {
    const res = await fetch(
      apiUrl('/rest/v1/quiz_state?user_id=eq.' + encodeURIComponent(session.userId)),
      {
        method: 'PATCH',
        headers: Object.assign(syncHeaders(session), { Prefer: 'return=minimal' }),
        body: JSON.stringify({ exam_draft: draft || null, updated_at: new Date().toISOString() }),
        keepalive: !!keepalive
      }
    );
    return res;
  }

  async function pushCloudDraft() {
    if (!SYNC_ENABLED || !app.sync.session || !app.sync.draftSupported) return;
    const draft = readDraftRaw();
    const session = await ensureSession();
    if (!session) return;
    try {
      const res = await patchCloudDraft(session, draft, true);
      if (!res.ok) throw new Error('HTTP ' + res.status);
    } catch (err) {
      // 云端失败不影响本地草稿，下次保存或同步时重试
      console.warn('考试草稿同步失败', err);
    }
  }

  async function clearCloudDraft() {
    if (!SYNC_ENABLED || !app.sync.session || !app.sync.draftSupported) return;
    const session = await ensureSession();
    if (!session) return;
    try {
      const res = await patchCloudDraft(session, null, true);
      if (!res.ok) throw new Error('HTTP ' + res.status);
    } catch (err) {
      console.warn('云端考试草稿清除失败', err);
    }
  }

  // 答题过程中草稿变化较频繁，延迟合并后再上传
  function scheduleDraftSync() {
    if (!SYNC_ENABLED || !app.sync.session || !app.sync.draftSupported) return;
    if (app.sync.draftTimer) clearTimeout(app.sync.draftTimer);
    app.sync.draftTimer = setTimeout(function () {
      app.sync.draftTimer = null;
      pushCloudDraft();
    }, 1200);
  }

  async function deleteCloudState() {
    if (!SYNC_ENABLED || !app.sync.session) return;
    const session = app.sync.session;
    try {
      await fetch(apiUrl('/rest/v1/quiz_state?user_id=eq.' + encodeURIComponent(session.userId)), {
        method: 'DELETE',
        headers: syncHeaders(session)
      });
    } catch (err) {
      console.warn('云端数据清除失败', err);
    }
  }

  function snapshotLocal() {
    return cloneData({
      records: app.store.records,
      wrong: app.store.wrong,
      fav: app.store.fav,
      exams: app.store.exams
    });
  }

  function cloneData(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function unionKeys(a, b) {
    const set = {};
    Object.keys(a || {}).forEach(function (key) { set[key] = true; });
    Object.keys(b || {}).forEach(function (key) { set[key] = true; });
    return Object.keys(set);
  }

  function isEmptyState(state) {
    if (!state) return true;
    return !Object.keys(state.records || {}).length &&
      !Object.keys(state.wrong || {}).length &&
      !Object.keys(state.fav || {}).length &&
      !(state.exams || []).length;
  }

  /**
   * 合并规则（简单可预期）：
   * 1. 云端为空：直接上传本地。
   * 2. 云端非空：以云端为准，再并入本地较新的部分，避免丢掉新做的题。
   *    - 做题记录：次数取两边较大值，最近作答信息取时间较新的一方。
   *    - 错题：取并集，次数与时间取较大值；若最近一次已答对则移出。
   *    - 收藏：取并集（取消收藏不会跨设备同步）。
   *    - 考试历史：按考试 id 去重后合并，保留最近 20 条。
   */
  function mergeSyncedState(cloud, local) {
    const records = {};
    unionKeys(cloud.records, local.records).forEach(function (id) {
      const c = cloud.records[id];
      const l = local.records[id];
      if (!c) { records[id] = l; return; }
      if (!l) { records[id] = c; return; }

      const newer = (l.lastAt || 0) > (c.lastAt || 0) ? l : c;
      records[id] = {
        attempts: Math.max(c.attempts || 0, l.attempts || 0),
        correct: Math.max(c.correct || 0, l.correct || 0),
        lastAnswer: newer.lastAnswer,
        lastCorrect: newer.lastCorrect,
        lastAt: Math.max(c.lastAt || 0, l.lastAt || 0)
      };
    });

    const wrong = {};
    unionKeys(cloud.wrong, local.wrong).forEach(function (id) {
      const c = cloud.wrong[id];
      const l = local.wrong[id];
      const at = Math.max((c && c.at) || 0, (l && l.at) || 0);
      const rec = records[id];
      // 与本地规则一致：最近一次已经答对，就不再留在错题本
      if (rec && rec.lastCorrect && (rec.lastAt || 0) >= at) return;
      wrong[id] = {
        count: Math.max((c && c.count) || 0, (l && l.count) || 0),
        at: at
      };
    });

    const fav = Object.assign({}, cloud.fav || {}, local.fav || {});
    return {
      records: records,
      wrong: wrong,
      fav: fav,
      exams: mergeExamLists(cloud.exams, local.exams)
    };
  }

  function mergeExamLists(cloudExams, localExams) {
    const map = {};
    (cloudExams || []).concat(localExams || []).forEach(function (exam) {
      if (!exam || !exam.id) return;
      map[exam.id] = exam;
    });
    return Object.keys(map)
      .map(function (id) { return map[id]; })
      .sort(function (a, b) { return (b.at || 0) - (a.at || 0); })
      .slice(0, MAX_EXAMS);
  }

  function applySyncedState(state) {
    app.sync.applying = true;
    app.store.records = state.records || {};
    app.store.wrong = state.wrong || {};
    app.store.fav = state.fav || {};
    app.store.exams = state.exams || [];
    saveStore(true);
    app.sync.applying = false;

    if (app.questions.length) {
      renderHome();
      renderStats();
    }
  }

  /**
   * 草稿合并取舍（不做实时互斥）：
   * - 本机正在考试时不打断，始终以本机草稿为准；
   * - 同一次考试（startedAt 相同）：逐题合并已选答案，题号与剩余时间取 updatedAt 较新的一份；
   * - 不同考试：取 updatedAt 更新的一份，另一份被覆盖；
   * - 云端草稿剩余时间为 0：视为已结束，不再恢复。
   * 两台设备同时作答同一份考试时，后保存的一方会覆盖先保存的一方。
   */
  function mergeDrafts(local, cloud) {
    if (local.startedAt !== cloud.startedAt) {
      return (local.updatedAt || 0) >= (cloud.updatedAt || 0) ? local : cloud;
    }

    const newer = (local.updatedAt || 0) >= (cloud.updatedAt || 0) ? local : cloud;
    const older = newer === local ? cloud : local;
    const entries = {};
    newer.ids.forEach(function (id) {
      const n = newer.entries[id];
      const o = older.entries[id];
      entries[id] = {
        selected: n && n.selected.length ? n.selected : (o ? o.selected.slice() : [])
      };
    });

    return Object.assign({}, newer, { entries: entries });
  }

  function mergeDraftWithCloud(cloudRaw) {
    let cloud = normalizeDraft(cloudRaw);
    if (cloud && cloud.remaining <= 0) cloud = null;

    // 正在考试：本机优先，避免同步把当前作答覆盖掉
    if (app.session && app.session.mode === 'exam' && !app.session.exam.submitted) {
      return draftFromSession();
    }

    const local = readDraftRaw();
    if (!local) {
      if (cloud) {
        writeExamDraft(cloud);
        toast('已载入云端未完成的模拟考试');
        maybeResumeExamDraft();
      }
      return cloud;
    }
    if (!cloud) return local;

    const merged = mergeDrafts(local, cloud);
    if (JSON.stringify(merged) !== JSON.stringify(local)) {
      writeExamDraft(merged);
      if ((merged.updatedAt || 0) > (local.updatedAt || 0)) {
        toast('已载入云端更新的考试草稿');
      }
    }
    return merged;
  }

  async function syncNow(reason) {
    if (!SYNC_ENABLED) return;
    const session = await ensureSession();
    if (!session) {
      setSyncStatus('未登录');
      return;
    }
    if (app.sync.syncing) return;

    app.sync.syncing = true;
    setSyncStatus('同步中…');
    try {
      const cloud = await fetchCloudState(session);
      const local = snapshotLocal();
      // 云端还没有任何数据时，以本地为准直接上传；否则先合并再回写
      const merged = isEmptyState(cloud) ? local : mergeSyncedState(cloud, local);
      applySyncedState(merged);

      const draft = mergeDraftWithCloud(cloud && cloud.exam_draft);
      await pushCloudState(session, merged, draft);
      setSyncStatus('已同步 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      const message = /Failed to fetch|NetworkError|Load failed/i.test(err.message)
        ? '网络不可用，请稍后重试'
        : err.message;
      setSyncStatus('同步失败：' + message);
    } finally {
      app.sync.syncing = false;
    }
  }

  // 本地写入后延迟同步，合并网络抖动期间的连续作答
  function scheduleSync() {
    if (!SYNC_ENABLED || !app.sync.session || app.sync.applying) return;
    if (app.sync.timer) clearTimeout(app.sync.timer);
    app.sync.timer = setTimeout(function () {
      app.sync.timer = null;
      syncNow('auto');
    }, 2500);
  }

  /* ---------------------------- 本地存储 ---------------------------- */

  function defaultStore() {
    return {
      version: 1,
      records: {},
      wrong: {},
      fav: {},
      exams: [],
      settings: { theme: 'auto' }
    };
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultStore();
      const parsed = JSON.parse(raw);
      const theme = parsed.settings && parsed.settings.theme;
      return {
        version: 1,
        records: parsed.records && typeof parsed.records === 'object' ? parsed.records : {},
        wrong: parsed.wrong && typeof parsed.wrong === 'object' ? parsed.wrong : {},
        fav: parsed.fav && typeof parsed.fav === 'object' ? parsed.fav : {},
        exams: Array.isArray(parsed.exams) ? parsed.exams : [],
        settings: {
          theme: ['auto', 'light', 'dark'].indexOf(theme) !== -1 ? theme : 'auto'
        }
      };
    } catch (err) {
      console.warn('本地数据读取失败，已重置', err);
      return defaultStore();
    }
  }

  function saveStore(skipSync) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(app.store));
    } catch (err) {
      console.warn('本地数据保存失败', err);
    }
    // 登录后本地每次落盘都安排一次延迟同步；skipSync 用于主题、同步回写等不需要上传的场景
    if (!skipSync) scheduleSync();
  }

  /* ---------------------------- 工具函数 ---------------------------- */

  function aggregateRecords(questions) {
    let attempts = 0;
    let correct = 0;
    let done = 0;

    questions.forEach(function (q) {
      const r = app.store.records[q.id];
      if (!r || !r.attempts) return;
      done += 1;
      attempts += r.attempts;
      correct += r.correct || 0;
    });

    return {
      attempts: attempts,
      correct: correct,
      done: done,
      accuracy: attempts ? correct / attempts : null
    };
  }

  function formatAnswer(q, letters) {
    if (!letters || !letters.length) return '未作答';
    if (q.type === 'judge') {
      return letters.map(function (letter) {
        const index = letter.charCodeAt(0) - 65;
        return q.options[index] || letter;
      }).join('、');
    }
    return letters.slice().sort().join(' ');
  }

  function fillSelect(select, items, value) {
    select.innerHTML = items.map(function (item) {
      return '<option value="' + escapeHtml(item.value) + '">' + escapeHtml(item.label) + '</option>';
    }).join('');
    select.value = value;
  }

  function unique(list) {
    const result = [];
    list.forEach(function (item) {
      if (result.indexOf(item) === -1) result.push(item);
    });
    return result;
  }

  function shuffle(list) {
    for (let i = list.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = list[i];
      list[i] = list[j];
      list[j] = temp;
    }
    return list;
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }

  function formatClock(seconds) {
    const total = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  }

  function formatDate(timestamp) {
    const d = new Date(timestamp);
    const pad = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function toast(message) {
    dom.toast.textContent = message;
    dom.toast.classList.add('show');
    clearTimeout(app.toastId);
    app.toastId = setTimeout(function () {
      dom.toast.classList.remove('show');
    }, 1800);
  }
})();
