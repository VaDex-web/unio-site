(function () {
  // Сетка звонков ДГТУ, минуты от полуночи (server/data/docs/timetable/bells.md).
  // Время — московское: Ростов живёт по нему.
  var PAIRS = [
    [510, 605], [615, 710], [720, 815], [855, 950],
    [960, 1055], [1065, 1160], [1170, 1265]
  ];

  // Пример дня на экране телефона. Аудитории настоящие — есть на карте.
  var DAY = [
    ['Физика', '1-320', 'Практика'],
    ['Математический анализ', '8-322', 'Лекция'],
    ['Программирование', '8-307', 'Лабораторная'],
    ['Английский язык', '1-460', 'Практика'],
    ['История России', '8-218', 'Лекция'],
    ['Философия', '1-384', 'Семинар'],
    ['Компьютерная графика', '8-312', 'Лабораторная']
  ];

  function $(id) { return document.getElementById(id); }
  function hm(m) { return Math.floor(m / 60) + ':' + String(m % 60).padStart(2, '0'); }

  function moscow() {
    var date = new Date();
    var parts = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23'
    }).formatToParts(date);
    var get = function (t) { return (parts.find(function (p) { return p.type === t; }) || {}).value; };
    var label = new Intl.DateTimeFormat('ru-RU', {
      timeZone: 'Europe/Moscow', weekday: 'long', day: 'numeric', month: 'long'
    }).format(date);
    return {
      day: get('weekday'),
      min: Number(get('hour')) * 60 + Number(get('minute')),
      label: label.charAt(0).toUpperCase() + label.slice(1)
    };
  }

  function show(state) {
    $('ph-now-label').textContent = state.label;
    $('ph-now-subject').textContent = state.subject;
    $('ph-now-room').textContent = state.room;
    $('ph-count').textContent = state.count;
    $('ph-count-unit').textContent = state.unit;
    $('ph-count-note').textContent = state.note;
    $('ph-bar').style.width = state.progress + '%';
  }

  function room(i) {
    return 'Ауд. ' + DAY[i][1] + (DAY[i][2] ? ' · ' + DAY[i][2] : '');
  }

  // Сколько осталось: до ста минут — минутами, дальше — часами.
  function left(m) { return m < 100 ? [String(m), 'мин'] : [hm(m), 'ч']; }

  function list(from, current) {
    var ol = $('ph-list');
    ol.innerHTML = '';
    for (var i = Math.max(0, from); i < Math.min(PAIRS.length, from + 3); i++) {
      var li = document.createElement('li');
      if (current !== null && i < current) li.className = 'past';
      li.innerHTML = '<time>' + hm(PAIRS[i][0]) + '</time><div><b>' + DAY[i][0] +
        '</b><span>' + room(i) + '</span></div>';
      ol.appendChild(li);
    }
  }

  function tick() {
    var now = moscow();
    var m = now.min;
    $('ph-date').textContent = now.label;

    if (now.day === 'вс') {
      show({ label: 'Сегодня выходной', subject: DAY[0][0], room: 'Первая пара в понедельник · ' + DAY[0][1],
        count: '8:30', unit: '', note: 'в понедельник', progress: 0 });
      list(0, null);
      return;
    }
    if (m < PAIRS[0][0]) {
      var a = left(PAIRS[0][0] - m);
      show({ label: 'Первая пара', subject: DAY[0][0], room: room(0),
        count: a[0], unit: a[1], note: 'до начала', progress: 0 });
      list(0, null);
      return;
    }
    if (m >= PAIRS[PAIRS.length - 1][1]) {
      show({ label: 'Пары закончились', subject: DAY[0][0], room: 'Завтра · ' + DAY[0][1],
        count: '8:30', unit: '', note: 'первая пара завтра', progress: 100 });
      list(0, null);
      return;
    }
    for (var i = 0; i < PAIRS.length; i++) {
      var p = PAIRS[i];
      if (m >= p[0] && m < p[1]) {
        var b = left(p[1] - m);
        show({ label: 'Идёт ' + (i + 1) + '-я пара', subject: DAY[i][0], room: room(i),
          count: b[0], unit: b[1], note: 'до звонка', progress: (m - p[0]) / (p[1] - p[0]) * 100 });
        list(i - 1, i);
        return;
      }
      if (m < p[0]) {
        var c = left(p[0] - m);
        show({ label: i === 3 ? 'Большая перемена' : 'Перемена', subject: DAY[i][0], room: room(i),
          count: c[0], unit: c[1], note: 'до начала', progress: 0 });
        list(i - 1, i);
        return;
      }
    }
  }

  tick();
  setInterval(tick, 20000);

  // --- Карта ----------------------------------------------------------------
  var box = document.getElementById('map');
  var frame = box.querySelector('iframe');
  var toggle = document.getElementById('map-toggle');

  toggle.addEventListener('click', function () {
    var live = box.classList.toggle('live');
    toggle.setAttribute('aria-pressed', String(live));
    toggle.textContent = live ? 'Готово' : 'Покрутить корпуса';
  });

  // Когда корпуса собрались, показываем маршрут — так же, как в приложении.
  var shown = false;
  var started = Date.now();
  function mapWindow() {
    try { return frame.contentWindow; } catch (e) { return null; }
  }
  function whenReady() {
    if (shown) return;
    var win = mapWindow();
    var doc = win && win.document;
    if (!doc || !win.campus || !doc.body || !doc.body.classList.contains('ready')) {
      if (Date.now() - started > 25000) {
        box.classList.add('failed');
        return;
      }
      setTimeout(whenReady, 300);
      return;
    }
    shown = true;
    var go = function () { setTimeout(function () { win.campus.route(null, '8-322'); }, 600); };
    if (!('IntersectionObserver' in window)) { go(); return; }
    var seen = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { seen.disconnect(); go(); }
    }, { threshold: 0.5 });
    seen.observe(box);
  }

  // Карта рисует кадр только по запросу. Если окно меняло размер, пока
  // вкладка была скрыта, холст очищается, а нового кадра никто не просит —
  // остаётся пустое небо. Поэтому после таких событий просим перерисовать.
  function redraw() {
    var win = mapWindow();
    if (win && win.campus) win.dispatchEvent(new Event('resize'));
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) redraw();
  });
  window.addEventListener('pageshow', redraw);
  if ('ResizeObserver' in window) new ResizeObserver(redraw).observe(box);

  // Страница открыта прямо из файла: браузер не даст карте загрузить модели.
  if (location.protocol === 'file:') box.classList.add('failed', 'from-file');

  frame.addEventListener('load', whenReady);
  whenReady();
})();

// --- Интерактив и анимации ---------------------------------------------------
(function () {
  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');
  var calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(id) { return document.getElementById(id); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, calm ? 0 : ms); }); }

  // Один раз, когда элемент показался на экране.
  function onShow(el, fn, threshold) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) { io.disconnect(); fn(); }
    }, { threshold: threshold || 0.25 });
    io.observe(el);
  }

  // Плашки выезжают по очереди: соседи в одном ряду — с небольшой задержкой.
  function reveal(el) {
    if (el.classList.contains('shown')) return;
    var left = el.getBoundingClientRect().left;
    el.style.transitionDelay = (left > window.innerWidth * 0.55 ? 0.16 : left > window.innerWidth * 0.3 ? 0.08 : 0) + 's';
    el.classList.add('shown');
    setTimeout(function () { el.style.transitionDelay = ''; }, 1200);
  }
  var hidden = Array.prototype.slice.call(document.querySelectorAll('[data-reveal]'));
  hidden.forEach(function (el) { onShow(el, function () { reveal(el); }, 0.15); });
  // Прыжок по ссылке или быстрая прокрутка проскакивают плашки, и наблюдатель
  // их не замечает. Всё, что уже выше низа экрана, показываем сразу.
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      ticking = false;
      hidden = hidden.filter(function (el) {
        if (el.getBoundingClientRect().top < window.innerHeight * 0.9) { reveal(el); return false; }
        return true;
      });
    });
  }, { passive: true });

  // --- Телефон: вкладки и наклон за курсором --------------------------------
  var pages = $('ph-pages');
  var tabs = document.querySelectorAll('.ph-tabs button');
  tabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      pages.dataset.page = tab.dataset.page;
      tabs.forEach(function (t) {
        var on = t === tab;
        t.classList.toggle('on', on);
        t.setAttribute('aria-pressed', String(on));
      });
    });
  });

  var hero = document.querySelector('.hero');
  var phone = document.querySelector('.phone');
  if (!calm && window.matchMedia('(hover: hover)').matches) {
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      var x = (e.clientX - r.left) / r.width - 0.5;
      var y = (e.clientY - r.top) / r.height - 0.5;
      phone.classList.add('tilting');
      phone.style.setProperty('--ry', (x * 10).toFixed(2) + 'deg');
      phone.style.setProperty('--rx', (-y * 6).toFixed(2) + 'deg');
    });
    hero.addEventListener('pointerleave', function () {
      phone.classList.remove('tilting');
      phone.style.setProperty('--ry', '0deg');
      phone.style.setProperty('--rx', '0deg');
    });
  }

  // --- Справки: заказ прямо на сайте ----------------------------------------
  var certs = ['Справка для стипендии', 'Справка в пенсионный фонд', 'Справка об обучении'];
  var certBtn = $('cert-btn');
  var certList = $('cert-list');
  var ordered = 0;
  certBtn.addEventListener('click', async function () {
    certBtn.disabled = true;
    var row = document.createElement('div');
    row.className = 'cert-row new';
    row.innerHTML = '<span>' + certs[ordered % certs.length] + '</span><em class="tag">Заказана</em>';
    ordered++;
    certList.insertBefore(row, certList.firstChild);
    while (certList.children.length > 3) certList.removeChild(certList.lastChild);
    certBtn.textContent = 'Заказано';
    await wait(1800);
    var tag = row.querySelector('.tag');
    tag.textContent = 'Готова';
    tag.classList.add('tag-ok', 'flip');
    certBtn.textContent = 'Заказать ещё';
    certBtn.disabled = false;
  });

  // --- Баллы: считаются при появлении, по нажатию — подробности --------------
  var grades = $('grades');
  function count(el, to) {
    if (calm) { el.textContent = to; return; }
    var start = performance.now();
    (function step(now) {
      var t = Math.min(1, (now - start) / 900);
      el.textContent = Math.round(to * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(step);
    })(start);
  }
  onShow(grades, function () {
    grades.closest('.plate').classList.add('shown');
    grades.querySelectorAll('.grade').forEach(function (g) {
      count(g.querySelector('b'), Number(g.dataset.score));
    });
  }, 0.4);
  grades.querySelectorAll('.grade').forEach(function (g) {
    g.addEventListener('click', function () {
      var open = !g.classList.contains('open');
      grades.querySelectorAll('.grade').forEach(function (o) { o.classList.remove('open'); });
      g.classList.toggle('open', open);
    });
  });

  // --- СКИФ: уведомления приходят одно за другим ----------------------------
  var pushes = $('pushes');
  var feed = [
    ['Через час закроется тест', 'Физика, СКИФ'],
    ['Новые баллы', 'Математический анализ, КТ2'],
    ['Завтра дедлайн', 'Лабораторная №4, программирование'],
    ['Справка готова', 'Можно забрать в 1-452']
  ];
  var fed = 0;
  function nextPush() {
    var item = feed[fed % feed.length];
    fed++;
    var el = document.createElement('div');
    el.className = 'push';
    el.innerHTML = '<img src="mark.svg" alt=""><p><b>' + item[0] + '</b>' + item[1] + '</p>';
    Array.prototype.forEach.call(pushes.children, function (c) { c.classList.add('old'); });
    pushes.insertBefore(el, pushes.firstChild);
    while (pushes.children.length > 2) pushes.removeChild(pushes.lastChild);
  }
  onShow(pushes, function () {
    nextPush();
    setTimeout(nextPush, calm ? 0 : 900);
    if (!calm) setInterval(nextPush, 4200);
  }, 0.5);

  // --- Вася отвечает ---------------------------------------------------------
  // Ответы — из справочников, по которым Вася работает в приложении.
  var answers = [
    'Столовая и кофейня — в 8 корпусе, с 8:00. Буфеты — в главном и во 2 корпусе.',
    'Пара идёт 1 час 35 минут. Первая — 8:30–10:05, вторая — 10:15–11:50. Большая перемена — с 13:35 до 14:15.',
    'В 7 корпусе. Абонемент учебной литературы — 7-208, научной — 7-104. Работает с 9:00 до 18:00.',
    'Главный корпус, аудитории 1-452 и 1-453. Пн–пт с 8:30 до 17:00. Там справки, стипендии и заявления.'
  ];
  var chat = $('chat');
  var asks = $('asks');
  function bubble(text, me) {
    var p = document.createElement('p');
    p.className = 'bubble' + (me ? ' bubble-me' : '');
    p.textContent = text;
    chat.appendChild(p);
    chat.scrollTop = chat.scrollHeight;
    return p;
  }
  asks.querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', async function () {
      asks.querySelectorAll('button').forEach(function (x) { x.disabled = true; });
      bubble(b.textContent, true);
      await wait(250);
      var typing = bubble('', false);
      typing.classList.add('typing');
      typing.innerHTML = '<span></span><span></span><span></span>';
      chat.scrollTop = chat.scrollHeight;
      await wait(900);
      typing.remove();
      bubble(answers[Number(b.dataset.q)], false);
      b.remove();
      asks.querySelectorAll('button').forEach(function (x) { x.disabled = false; });
    });
  });

  // --- Языки ------------------------------------------------------------------
  var phrases = {
    ru: 'Вся учёба в ДГТУ — в одном приложении',
    en: 'All your DSTU studies in one app',
    zh: '顿河国立技术大学的学习，尽在一个应用',
    ar: 'كل دراستك في الجامعة في تطبيق واحد',
    fr: 'Toutes vos études à la DSTU dans une seule appli'
  };
  var say = $('langs-say');
  var langBtns = document.querySelectorAll('#langs button');
  langBtns.forEach(function (b) {
    b.addEventListener('click', async function () {
      langBtns.forEach(function (x) { x.classList.toggle('on', x === b); });
      say.classList.add('out');
      await wait(200);
      say.textContent = phrases[b.dataset.lang];
      say.lang = b.dataset.lang;
      say.dir = b.dataset.lang === 'ar' ? 'rtl' : 'ltr';
      say.classList.remove('out');
    });
  });
})();
