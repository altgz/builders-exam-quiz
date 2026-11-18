/**
 * 二级建造师刷题 —— 纯前端单页应用
 * 数据来源：questions.json（fetch 读取）
 * 本地数据：localStorage，键名 bq:v1
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'bq:v1';
  const UNLOCK_KEY = 'bq:unlock:v1';
  const MAX_EXAMS = 20;

  // ===== 访问密码：修改下面这一行即可更换站点密码（区分大小写）=====
  // 修改后，已解锁的设备会因校验值变化而需要重新输入。
  const ACCESS_PASSWORD = 'Yuanzhi2026';

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
    unlocked: false
  };

  const dom = {};

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    cacheDom();
    app.store = loadStore();
    applyTheme();
    bindEvents();

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

    dom.quizMode = $('#quiz-mode');
    dom.quizCount = $('#quiz-count');
    dom.quizTimer = $('#quiz-timer');
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

    $('#btn-stats').addEventListener('click', function () {
      showView('stats');
    });
    $('#btn-stats-2').addEventListener('click', function () {
      showView('stats');
    });

    dom.btnBack.addEventListener('click', handleBack);
    dom.btnPrev.addEventListener('click', goPrev);
    dom.btnFav.addEventListener('click', toggleFavorite);
    dom.btnMain.addEventListener('click', handleMainAction);
    dom.btnHandin.addEventListener('click', function () {
      submitExam(false);
    });

    // 选项使用事件委托，避免每次重绘重复绑定
    dom.qOptions.addEventListener('click', handleOptionClick);

    dom.btnResultHome.addEventListener('click', function () {
      app.session = null;
      showView('home');
    });
    dom.btnRetryExam.addEventListener('click', function () {
      const size = app.lastResult ? app.lastResult.size : undefined;
      startExam(size);
    });

    dom.btnReset.addEventListener('click', resetAllData);

    window.addEventListener('scroll', function () {
      dom.topbar.classList.toggle('scrolled', window.scrollY > 4);
    }, { passive: true });

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onSchemeChange = function () {
      if ((app.store.settings.theme || 'auto') === 'auto') applyTheme();
    };
    if (media.addEventListener) media.addEventListener('change', onSchemeChange);
    else if (media.addListener) media.addListener(onSchemeChange);
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
    showView('home');

    // 首次进入才请求题库；锁定后再次解锁直接复用已加载的数据
    if (!app.questions.length) loadQuestions();
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
      if (!window.confirm('锁定后本次考试进度将丢失，确定锁定吗？')) return;
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
    showView('quiz');
    renderQuiz();
  }

  function startExam(sizeArg) {
    const pool = getPlayableFiltered();
    if (!pool.length) {
      toast('当前范围没有可抽取的题目');
      return;
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
        endAt: Date.now() + duration * 1000,
        remaining: duration,
        submitted: false
      }
    };

    dom.qOptions.innerHTML = '';
    showView('quiz');
    startTimer();
    renderQuiz();
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
      dom.quizTimer.classList.remove('hidden');
      dom.btnMain.textContent = s.index === s.ids.length - 1 ? '交卷' : '下一题';
      dom.btnMain.disabled = false;
      updateTimerUI();
    } else {
      dom.btnHandin.classList.add('hidden');
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
      showView('home');
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

  // 用绝对结束时间计算剩余秒数，切到后台再回来也不会走慢
  function tickTimer() {
    const s = app.session;
    if (!s || s.mode !== 'exam' || !s.exam || s.exam.submitted) {
      stopTimer();
      return;
    }

    const remain = Math.max(0, Math.ceil((s.exam.endAt - Date.now()) / 1000));
    s.exam.remaining = remain;
    updateTimerUI();

    if (remain <= 0) {
      stopTimer();
      submitExam(true);
    }
  }

  function updateTimerUI() {
    const s = app.session;
    if (!s || !s.exam) return;
    dom.quizTimer.textContent = formatClock(s.exam.remaining);
    dom.quizTimer.classList.toggle('urgent', s.exam.remaining <= 60);
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

    stopTimer();
    s.exam.submitted = true;

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
      Math.max(1, Math.round((Date.now() - s.startedAt) / 1000))
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
    if (!window.confirm('确定清除全部做题记录、错题、收藏和考试历史吗？此操作不可恢复。')) return;
    app.store = defaultStore();
    saveStore();
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

  function handleBack() {
    const view = document.body.dataset.view;

    if (view === 'quiz' && app.session && app.session.mode === 'exam' && !app.session.exam.submitted) {
      if (!window.confirm('退出后本次考试成绩不会保存，确定退出吗？')) return;
    }

    stopTimer();
    app.session = null;
    showView('home');
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
    saveStore();
    applyTheme();
    toast('主题：' + (next === 'auto' ? '跟随系统' : next === 'light' ? '浅色' : '深色'));
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

  function saveStore() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(app.store));
    } catch (err) {
      console.warn('本地数据保存失败', err);
    }
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
