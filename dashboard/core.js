/* Общий движок дашбордов Maison Sauvage. Данные берёт из data.js, ничего не выдумывает. */
(function () {
  const D = window.MS_DATA;
  const NB = ' ';
  const group = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, NB);
  const comma = (x, d) => Number(x).toFixed(d).replace('.', ',');
  const MG = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const MN = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  const MS3 = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const plural = (n, a, b, c) => { const m = Math.abs(n) % 100, k = m % 10; return m > 10 && m < 20 ? c : k > 1 && k < 5 ? b : k === 1 ? a : c; };

  const MS = {
    data: D,
    calm: matchMedia('(prefers-reduced-motion: reduce)').matches,
    params: new URLSearchParams(location.search),
    num: group,
    comma,
    mln: (rp, d = 1) => comma(rp / 1e6, d),
    rp: (rp, d = 1) => comma(rp / 1e6, d) + NB + 'млн' + NB + 'Rp',
    usd: rp => group(rp / D.rate) + NB + '$',
    usdRaw: x => group(x) + NB + '$',
    pct: (x, d = 0) => comma(x * 100, d) + '%',
    plural,
    date: iso => { const p = iso.split('-'); return +p[2] + NB + MG[+p[1] - 1]; },
    dateShort: iso => { const p = iso.split('-'); return p[2] + '.' + p[1]; },
    monthName: k => { const p = k.split('-'); return MN[+p[1] - 1] + ' ' + p[0]; },
    monthShort: k => MS3[+k.split('-')[1] - 1],
    daysTo: iso => Math.max(0, Math.ceil((new Date(iso + 'T00:00:00+08:00') - Date.now()) / 864e5)),
    daysWord: n => n + NB + plural(n, 'день', 'дня', 'дней')
  };

  /* Цели */
  const m = D.month, next = D.next[0];
  MS.goal = Object.assign({}, next, {
    left: Math.max(next.rev - m.rev, 0),
    progress: Math.min(m.rev / next.rev, 1),
    daysLeft: Math.max(m.days - m.day, 0)
  });
  MS.goal.perDay = MS.goal.left / Math.max(MS.goal.daysLeft, 1);
  MS.rentNext = Object.assign({}, D.rent.schedule[0], { daysLeft: MS.daysTo(D.rent.schedule[0].d) });

  /* Победа, которую показываем по кнопке: реальная следующая ступень */
  MS.win = {
    title: 'Сентябрь побит',
    value: MS.rp(next.rev),
    valueUsd: MS.usd(next.rev),
    sub: 'Следующая ступень: август, ' + MS.rp(D.next[1].rev),
    goal: next,
    nextGoal: D.next[1]
  };

  /* Что изменилось с прошлого открытия этой страницы */
  const vKey = 'ms_visit:' + location.pathname;
  let prev = null;
  try { prev = JSON.parse(localStorage.getItem(vKey) || 'null'); } catch (e) {}
  const deltaRev = prev ? D.month.rev - (prev.key === D.month.key ? prev.rev : 0) : D.report.rev;
  MS.visit = {
    first: !prev,
    fromRev: prev && prev.key === D.month.key ? prev.rev : Math.max(D.month.rev - D.report.rev, 0),
    deltaRev,
    text: prev
      ? (deltaRev > 0 ? 'С прошлого открытия +' + MS.rp(deltaRev) : 'Новый отчёт придёт в 21:00')
      : 'За последний отчёт +' + MS.rp(D.report.rev)
  };
  try { localStorage.setItem(vKey, JSON.stringify({ rev: D.month.rev, key: D.month.key, ts: Date.now() })); } catch (e) {}

  /* Находка дня: реальные факты, каждый день новая, по нажатию следующая */
  const b = D.brands, wd = D.weekdays, top3 = wd.slice(2, 5);
  const sum = D.months.reduce((a, x) => (x.rev > a.rev ? x : a));
  MS.insights = [
    D.report.bestSince ? MS.date(D.report.d) + ' лучший день с ' + MS.date(D.report.bestSince) : MS.date(D.report.d) + ' новый рекорд дня',
    D.topShare.b + ' дал ' + D.topShare.n + ' из ' + D.topShare.of + ' вещей за 30 дней',
    '«Нет размера» звучало в ' + D.why.noSizeDays + ' ' + plural(D.why.noSizeDays, 'день', 'дня', 'дней') + ' из ' + D.why.of + '. Гость уже зашёл и хотел купить',
    'Среда, четверг и пятница в среднем дают ' + MS.rp(top3[1].avg) + ' в день. Воскресенье ' + MS.rp(wd[6].avg),
    'С открытия продано ' + group(D.totals.items) + ' вещей на ' + comma(D.totals.rev / 1e9, 2) + ' млрд Rp',
    'В лучший месяц продавались ' + b.peakCount + ' брендов. За последние 30 дней ' + b.active30,
    'Аренда оплачена на ' + D.rent.paidPct + '%. После апреля 2027 ещё ' + D.rent.monthsFree + ' месяцев без платежей',
    'Рекорд дня ' + MS.rp(D.records.bestDay.rev) + ' стоит с ' + MS.date(D.records.bestDay.d),
    'Лучший месяц ' + MS.monthName(sum.m).toLowerCase() + ': ' + MS.rp(sum.rev)
  ];
  const dayN = Math.floor(Date.now() / 864e5);
  MS.insightIndex = dayN % MS.insights.length;
  MS.insight = () => MS.insights[MS.insightIndex];
  MS.nextInsight = () => { MS.insightIndex = (MS.insightIndex + 1) % MS.insights.length; return MS.insight(); };

  /* Задачи дня: галочки живут в браузере */
  const tKey = 'ms_tasks';
  let done = {};
  try { done = JSON.parse(localStorage.getItem(tKey) || '{}'); } catch (e) {}
  MS.tasks = () => D.tasks.map((t, i) => Object.assign({}, t, { i, done: !!done[i] }));
  MS.toggleTask = i => {
    done[i] = !done[i];
    try { localStorage.setItem(tKey, JSON.stringify(done)); } catch (e) {}
    MS.sound[done[i] ? 'chime' : 'click']();
    return done[i];
  };

  /* Счётчик чисел */
  MS.count = (el, from, to, ms, fmt) => {
    fmt = fmt || (x => group(x));
    if (MS.calm || MS.params.has('shot') || !ms) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    (function step(t) {
      const k = Math.min((t - t0) / ms, 1), e = 1 - Math.pow(1 - k, 4);
      el.textContent = fmt(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    })(t0);
  };

  /* Цикл кадров, который спит на скрытой вкладке */
  MS.loop = fn => {
    let last = performance.now(), id = 0;
    const run = t => { const dt = Math.max(0, Math.min((t - last) / 1000, .05)); last = t; fn(t / 1000, dt); id = requestAnimationFrame(run); };
    const start = () => { if (!id) { last = performance.now(); id = requestAnimationFrame(run); } };
    const stop = () => { cancelAnimationFrame(id); id = 0; };
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
    start();
    return stop;
  };

  /* Звук: всё синтезируется на лету, файлов нет */
  const Snd = {
    ctx: null, master: null,
    on: (() => { try { return localStorage.getItem('ms_sound') !== '0'; } catch (e) { return true; } })(),
    init() {
      if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return this.ctx; }
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return null;
      this.ctx = new C();
      this.master = this.ctx.createDynamicsCompressor();
      const g = this.ctx.createGain(); g.gain.value = .55;
      this.master.connect(g); g.connect(this.ctx.destination);
      return this.ctx;
    },
    tone(f, dur, o = {}) {
      if (!this.on || !this.init()) return;
      const c = this.ctx, t = c.currentTime + (o.at || 0), v = c.createOscillator(), g = c.createGain();
      v.type = o.type || 'sine'; v.frequency.setValueAtTime(f, t);
      if (o.to) v.frequency.exponentialRampToValueAtTime(o.to, t + dur);
      g.gain.setValueAtTime(.0001, t);
      g.gain.exponentialRampToValueAtTime(o.gain || .2, t + (o.attack || .008));
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      v.connect(g); g.connect(this.master); v.start(t); v.stop(t + dur + .03);
    },
    noise(dur, o = {}) {
      if (!this.on || !this.init()) return;
      const c = this.ctx, t = c.currentTime + (o.at || 0), n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), a = buf.getChannelData(0);
      for (let i = 0; i < n; i++) a[i] = Math.random() * 2 - 1;
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      s.buffer = buf; f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.from || 400, t);
      f.frequency.exponentialRampToValueAtTime(o.to || 4000, t + dur);
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(o.gain || .3, t + dur * (o.peak || .7));
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      s.connect(f); f.connect(g); g.connect(this.master); s.start(t);
    },
    click() { this.tone(1400, .05, { type: 'square', gain: .05 }); },
    tick() { this.tone(2200, .03, { gain: .06 }); },
    chime() { [880, 1320, 1760].forEach((f, i) => this.tone(f, .5, { at: i * .07, gain: .12 })); },
    rise(sec = 1.6) { this.tone(70, sec, { to: 880, type: 'sawtooth', gain: .08, attack: .3 }); this.noise(sec, { from: 200, to: 6000, gain: .12 }); },
    boom() { this.tone(110, 1.4, { to: 28, gain: .6 }); this.noise(.9, { from: 2500, to: 80, gain: .4, peak: .05 }); },
    win() { [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => { this.tone(f, 1.2, { at: i * .1, gain: .16, type: 'triangle' }); this.tone(f * 2, .9, { at: i * .1, gain: .05 }); }); },
    toggle() { this.on = !this.on; try { localStorage.setItem('ms_sound', this.on ? '1' : '0'); } catch (e) {} if (this.on) this.click(); return this.on; }
  };
  MS.sound = Snd;
  MS.vibrate = p => { if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate(p); };

  /* Навигация между вариантами */
  const V = [
    ['01-vysotomer', 'Высотомер'], ['02-dom-korabl', 'Дом-корабль'], ['03-biokupol', 'Биокупол'], ['04-shkura', 'Шкура зверя'], ['05-orbita', 'Орбита'],
    ['06-kolchuga', 'Кольчуга 66'], ['07-pult', 'Пульт 69'], ['08-nebo', 'Небо'], ['09-kurtka', 'Лётная куртка'], ['10-vizor', 'Визор']
  ];
  MS.variants = V;
  function nav() {
    const cur = V.findIndex(v => location.pathname.includes('/' + v[0]));
    if (cur < 0) return;
    const go = d => { location.href = '../' + V[(cur + d + V.length) % V.length][0] + '/'; };
    const s = document.createElement('style');
    s.textContent = '.ms-nav{position:fixed;z-index:99999;left:14px;bottom:calc(10px + env(safe-area-inset-bottom));display:flex;align-items:center;gap:2px;height:38px;padding:0 4px;border-radius:19px;background:rgba(8,8,10,.72);color:#fff;font:500 13px/1 system-ui,-apple-system,sans-serif;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}.ms-nav button,.ms-nav a{all:unset;cursor:pointer;display:flex;align-items:center;justify-content:center;min-width:34px;height:34px;border-radius:17px;color:#fff;text-decoration:none}.ms-nav button:hover,.ms-nav a:hover{background:rgba(255,255,255,.14)}.ms-nav .n{padding:0 8px;white-space:nowrap}.ms-nav :focus-visible{outline:2px solid #fff}@media(max-width:640px){.ms-nav{left:50%;transform:translateX(-50%)}}';
    document.head.appendChild(s);
    const n = document.createElement('nav');
    n.className = 'ms-nav'; n.setAttribute('aria-label', 'Варианты дашборда');
    n.innerHTML = '<button aria-label="Предыдущий вариант">‹</button><a class="n" href="../">' + (cur + 1) + ' из 10 · ' + V[cur][1] + '</a><button aria-label="Следующий вариант">›</button><button aria-label="Звук" class="s"></button>';
    const [p, , x, sb] = n.children;
    const paint = () => { sb.textContent = Snd.on ? '♪' : '×'; sb.title = Snd.on ? 'Звук включён' : 'Звук выключен'; };
    p.onclick = () => go(-1); x.onclick = () => go(1); sb.onclick = () => { Snd.toggle(); paint(); }; paint();
    document.body.appendChild(n);
    addEventListener('keydown', e => { if (e.target.closest && e.target.closest('input,textarea')) return; if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); });
  }

  /* Вариант вызывает MS.ready(playWin): кнопка «Показать победу» и ?win=1 идут сюда */
  MS.ready = playWin => {
    MS.playWin = () => { Snd.init(); playWin(); };
    if (MS.params.has('win')) setTimeout(() => playWin(), +MS.params.get('win') || 300);
  };

  window.MS = MS;
  if (document.body) nav(); else addEventListener('DOMContentLoaded', nav);
})();
