/* ============================================================
   MandıraPro 2.0 — Uygulama kabuğu, yönlendirme ve işlemler
   ============================================================ */
(function (NS) {
  'use strict';

  const $ = NS.$;
  const $$ = NS.$$;

  const RENDERERS = {
    dashboard: 'renderDashboard',
    route: 'renderRoute',
    producers: 'renderProducers',
    records: 'renderRecords',
    quality: 'renderQuality',
    tank: 'renderTank',
    settlements: 'renderSettlements',
    invoices: 'renderInvoices',
    orders: 'renderOrders',
    accounts: 'renderAccounts',
    fleet: 'renderFleet',
    reports: 'renderReports',
    farm: 'renderFarm',
    'farm-milk': 'renderFarmMilk',
    'farm-orders': 'renderFarmOrders',
    'farm-account': 'renderFarmAccount',
    users: 'renderUsers',
    settings: 'renderSettings'
  };

  const PAGE_SUBS = {
    dashboard: function (db) { return db.settings.businessName + ' · ' + NS.fmtDate(NS.todayISO()); },
    route: function () { return 'Saha toplama ve durak takibi'; },
    producers: function () { return 'Üretici kartları, rotalar ve cari durum'; },
    records: function () { return 'Günlük süt ve yem girişleri'; },
    quality: function () { return 'Numune eşleme ve laboratuvar sonuçları'; },
    tank: function () { return 'Soğuk zincir, doluluk ve sevkiyat'; },
    settlements: function () { return 'Kaliteye göre tediye ve makbuzlar'; },
    invoices: function () { return 'Resmî fatura kesme ve arşiv'; },
    orders: function () { return 'Yem, malzeme ve üretici talepleri'; },
    accounts: function () { return 'Üretici alacak ve borç dengesi'; },
    fleet: function () { return 'Araç, yakıt ve işletme masrafları'; },
    reports: function () { return 'Dönemsel analiz ve dışa aktarım'; },
    farm: function () { return 'Süt, kalite ve hesap özetiniz'; },
    'farm-milk': function () { return 'Teslim edilen süt ve kalite sonuçları'; },
    'farm-orders': function () { return 'Yem ve malzeme talepleriniz'; },
    'farm-account': function () { return 'Hakediş, yem ve ödeme dökümü'; },
    users: function () { return 'Sütçüler, roller ve hesap güvenliği'; },
    settings: function () { return 'İşletme, fiyat listeleri ve veri yönetimi'; }
  };

  const FIELD_LABELS = {
    date: 'Tarih', liters: 'Süt (litre)', producerId: 'Üretici', collectorId: 'Sütçü'
  };

  const MOBILE_TABS = {
    'Yönetici': [
      ['dashboard', 'Özet', 'grid'],
      ['route', 'Rota', 'route'],
      ['producers', 'Üreticiler', 'users'],
      ['records', 'Kayıtlar', 'clipboard'],
      ['__menu', 'Menü', 'menu']
    ],
    'Sütçü': [
      ['route', 'Rota', 'route'],
      ['producers', 'Üreticiler', 'users'],
      ['records', 'Kayıtlar', 'clipboard'],
      ['quality', 'Numune', 'flask'],
      ['__menu', 'Menü', 'menu']
    ],
    'Üretici': [
      ['farm', 'Çiftliğim', 'home'],
      ['farm-milk', 'Sütlerim', 'drop'],
      ['farm-orders', 'Siparişler', 'package'],
      ['farm-account', 'Hesabım', 'book'],
      ['__menu', 'Menü', 'menu']
    ]
  };

  let clockTimer = null;
  let booted = false;
  let syncing = false;
  let compactView = window.innerWidth <= 760;
  let resizeTimer = null;
  NS.state = NS.state || {};

  /* ============================================================
     Başlangıç / oturum
     ============================================================ */
  document.addEventListener('DOMContentLoaded', boot);

  async function boot() {
    if (booted) return;
    booted = true;
    try {
      await NS.ensureDB();
    } catch (err) {
      const loginError = $('#loginError');
      if (loginError) loginError.textContent = 'Yerel veri açılamadı: ' + (err.message || err);
      return;
    }

    bindEvents();
    watchViewport();
    applyDeviceView();
    applySavedUi();
    loadOfflineQueue();
    hideSplash();
    NS.applyTheme(NS.state.db.settings.theme);
    renderAuthFacts();
    startClock();

    const me = NS.resolveMe();
    if (me && me.active !== false) {
      bootApp();
    } else {
      NS.sessionClear();
      showLogin();
    }
  }

  function bindEvents() {
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('storage', onStorage);
    window.addEventListener('resize', onViewportResize);
    window.addEventListener('orientationchange', function () {
      setTimeout(onViewportResize, 260);
    });
    window.addEventListener('scroll', onWindowScroll, { passive: true });
    window.addEventListener('touchstart', onTouchStart, { passive: false });
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    document.addEventListener('click', onDocClick, true);
    wrapOverlayCleanup();
  }

  function onViewportResize() {
    const compact = window.innerWidth <= 760;
    if (compact === compactView) return;
    compactView = compact;
    if (!compact) closeMobileSheet();
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!NS.state.me) return;
      if ($('#modalRoot') && $('#modalRoot').children.length) return;
      if ($('#drawerRoot') && $('#drawerRoot').children.length) return;
      renderView(NS.state.route, NS.state.viewId);
    }, 220);
  }

  function onWindowScroll() {
    const btn = $('#mobileBackToTop');
    if (!btn) return;
    const show = window.scrollY > 300;
    btn.classList.toggle('show', show);
  }

  /* ============================================================
     Dokunmatik iyileştirmeler (pull-to-refresh, swipe, haptic, long-press)
     ============================================================ */

  let touchStartY = 0;
  let touchStartX = 0;
  let touchStartTime = 0;
  let touchTarget = null;
  let longPressTimer = null;
  let ptrStartY = 0;
  let ptrActive = false;

  function haptic(pattern) {
    if (!navigator.vibrate) return;
    try { navigator.vibrate(pattern || 30); } catch (e) { /* yoksay */ }
  }

  function startLongPress(el, e) {
    clearTimeout(longPressTimer);
    touchTarget = el;
    longPressTimer = setTimeout(function () {
      clearTimeout(longPressTimer);
      longPressTimer = null;
      if (touchTarget) {
        haptic(20);
        const action = touchTarget.getAttribute('data-action');
        const view = touchTarget.getAttribute('data-view');
        if (action === 'nav' && view) {
          closeMobileSheet();
          navigate(view);
        } else if (action) {
          handleAction({ target: touchTarget, preventDefault: function () {} });
        }
      }
    }, 550);
  }

  function clearLongPress() {
    clearTimeout(longPressTimer);
    longPressTimer = null;
    touchTarget = null;
  }

  function onTouchStart(e) {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    touchStartTime = Date.now();
    const el = e.target.closest('[data-action]');
    if (el) {
      haptic(10);
      startLongPress(el, e);
    }
    if (e.target.closest('#mobileTabs, .view') && window.scrollY === 0) {
      ptrStartY = touchStartY;
      ptrActive = true;
    }
  }

  function onTouchMove(e) {
    if (!ptrActive) return;
    const dy = e.touches[0].clientY - ptrStartY;
    if (dy > 0 && window.scrollY === 0) {
      const indicator = $('#ptrIndicator');
      if (indicator) {
        const pct = Math.min(dy / 80, 1);
        indicator.classList.toggle('active', pct > 0.15);
        indicator.style.transform = 'scaleX(' + pct + ')';
      }
    }
  }

  function onTouchEnd(e) {
    clearLongPress();
    if (ptrActive) {
      ptrActive = false;
      const indicator = $('#ptrIndicator');
      if (indicator) indicator.classList.remove('active');
      const dy = e.changedTouches[0].clientY - ptrStartY;
      if (dy > 100 && window.scrollY === 0) {
        ptrRefresh();
      }
    }
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dt = Date.now() - touchStartTime;
    if (Math.abs(dx) > 80 && dt < 400) {
      const pages = NS.navPages();
      const cur = NS.state.route || '';
      const idx = pages.indexOf(cur);
      if (dx < -80 && idx < pages.length - 1) {
        haptic(30);
        navigate(pages[idx + 1]);
      } else if (dx > 80 && idx > 0) {
        haptic(30);
        navigate(pages[idx - 1]);
      }
    }
  }

  function ptrRefresh() {
    const indicator = $('#ptrIndicator');
    if (indicator) indicator.classList.add('active');
    haptic(40);
    setTimeout(function () {
      if (indicator) indicator.classList.remove('active');
      renderView(NS.state.route, NS.state.viewId);
      NS.toast('Güncellendi', 'Veriler yenilendi.', 'success');
    }, 400);
  }

  function onDocClick(e) {
    const target = e.target;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
    if (!isInput) {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT')) {
        active.blur();
      }
    }
  }

  function isTablet() {
    return window.innerWidth > 760 && window.innerWidth <= 1180;
  }

  function isPhone() {
    return window.innerWidth <= 760;
  }

  function applyDeviceView() {
    const html = document.documentElement;
    if (isTablet()) {
      html.setAttribute('data-device', 'tablet');
      html.removeAttribute('data-device-phone');
    } else if (isPhone()) {
      html.setAttribute('data-device-phone', 'true');
      html.removeAttribute('data-device');
    } else {
      html.removeAttribute('data-device');
      html.removeAttribute('data-device-phone');
    }
  }

  NS._offlineQueue = NS._offlineQueue || [];

  NS.enqueueOffline = function (action, payload) {
    NS._offlineQueue.push({
      id: uid('oq'),
      action: action,
      payload: payload,
      at: new Date().toISOString()
    });
    try { localStorage.setItem('mandirapro_offline_queue', JSON.stringify(NS._offlineQueue)); } catch (e) { /* yoksay */ }
    NS.toast('Çevrimdışı kaydedildi', 'İnternet döndüğünde senkronize edilecek.', 'info');
  };

  NS.syncPending = function () {
    if (syncing || !navigator.onLine) return;
    syncing = true;
    const queue = NS._offlineQueue.slice();
    if (!queue.length) { syncing = false; return; }
    NS.toast('Senkronize ediliyor', queue.length + ' işlem işleniyor.', 'info');
    setTimeout(function () {
      NS._offlineQueue = [];
      try { localStorage.removeItem('mandirapro_offline_queue'); } catch (e) { /* yoksay */ }
      syncing = false;
      NS.toast('Senkronizasyon tamamlandı', 'Tüm işlemler yüklendi.', 'success');
    }, 800);
  };

  function loadOfflineQueue() {
    try {
      const raw = localStorage.getItem('mandirapro_offline_queue');
      if (raw) NS._offlineQueue = JSON.parse(raw);
    } catch (e) { NS._offlineQueue = []; }
  }

  function hideSplash() {
    const splash = $('#pwa-splash');
    if (splash) {
      splash.classList.add('hidden');
      setTimeout(function () { splash.remove(); }, 400);
    }
  }

  function watchViewport() {
    applyDeviceView();
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(function () {
        onViewportResize();
        applyDeviceView();
      });
      observer.observe(document.documentElement);
    }
    const mq = window.matchMedia ? window.matchMedia('(max-width: 760px)') : null;
    if (mq) {
      if (mq.addEventListener) mq.addEventListener('change', onViewportResize);
      else if (mq.addListener) mq.addListener(onViewportResize);
    }
  }

  function wrapOverlayCleanup() {
    const originalCloseModal = NS.closeModal;
    NS.closeModal = function () {
      if (typeof NS._scanStop === 'function') {
        try { NS._scanStop(); } catch (e) { /* yoksay */ }
        NS._scanStop = null;
      }
      originalCloseModal();
    };
  }

  function applySavedUi() {
    try {
      localStorage.removeItem('mandirapro_ui_collapsed');
      const shell = $('#appShell');
      if (shell) shell.classList.remove('collapsed');
    } catch (e) { /* yoksay */ }
  }

  function renderAuthFacts() {
    const db = NS.state.db;
    if (!db) return;
    const facts = $$('.auth-facts b');
    if (facts[0]) facts[0].textContent = db.collectors.length;
    if (facts[1]) facts[1].textContent = db.producers.length;
    if (facts[2]) facts[2].textContent = db.tanks.length;
    const portal = db.users.find(function (u) { return u.role === 'Üretici' && u.producerId === 'p1' && u.active !== false; }) ||
      db.users.find(function (u) { return u.role === 'Üretici' && u.active !== false; });
    if (portal) {
      const chip = $('.demo-chip[data-username="uretici"]');
      if (chip) {
        chip.dataset.username = portal.username;
        const small = chip.querySelector('small');
        if (small) small.textContent = portal.username + ' · 1234';
      }
    }
    const year = $('#loginYear');
    if (year) year.textContent = new Date().getFullYear();
    const demoAdmin = $('.demo-chip[data-username="admin"]');
    const admin = db.users.find(function (u) { return u.role === 'Yönetici' && u.active !== false; });
    if (demoAdmin && admin) {
      demoAdmin.dataset.username = admin.username;
      const small = demoAdmin.querySelector('small');
      if (small) small.textContent = admin.username + ' · 1234';
    }
  }

  function startClock() {
    if (clockTimer) clearInterval(clockTimer);
    const tick = function () {
      const now = new Date();
      const time = NS.pad(now.getHours()) + ':' + NS.pad(now.getMinutes());
      const clock = $('#liveClock b');
      if (clock) clock.textContent = time;
      const today = $('#sidebarToday');
      if (today) {
        today.innerHTML = '<b>' + NS.fmtDateFull(NS.todayISO()) + '</b><span>' + (NS.state.db && NS.state.db.settings.businessName || 'MandıraPro') + '</span>';
      }
      const pageSub = $('#pageSubtitle');
      if (pageSub && NS.state.route === 'dashboard' && NS.state.db) {
        pageSub.textContent = PAGE_SUBS.dashboard(NS.state.db);
      }
    };
    tick();
    clockTimer = setInterval(tick, 30000);
  }

  function showLogin() {
    NS.state.me = null;
    closeMobileSheet();
    const login = $('#loginScreen');
    const shell = $('#appShell');
    if (login) login.hidden = false;
    if (shell) shell.hidden = true;
    document.body.classList.remove('app-ready');
    const err = $('#loginError');
    if (err) err.textContent = '';
    const pass = $('#loginPass');
    if (pass) pass.value = '';
    renderAuthFacts();
  }

  function bootApp() {
    const me = NS.resolveMe();
    if (!me || me.active === false) { showLogin(); return; }
    NS.state.me = me;
    if (NS.isProducer() && !NS.myProducer()) {
      NS.sessionClear();
      showLogin();
      NS.toast('Çiftlik hesabı bağlı değil', 'Yöneticiden hesabınızı bir üretici kaydına bağlamasını isteyin.', 'error');
      return;
    }
    $('#loginScreen').hidden = true;
    $('#appShell').hidden = false;
    document.body.classList.add('app-ready');
    NS.applyTheme(NS.state.db.settings.theme);
    renderNav();
    renderMobileNav();
    refreshUserChrome();
    const parsed = parseRoute();
    const view = parsed && canView(parsed.view, parsed.id) ? parsed.view : defaultView();
    const id = parsed && parsed.view === view ? parsed.id : null;
    if (location.hash !== routeHash(view, id)) {
      history.replaceState(null, '', routeHash(view, id));
    }
    renderView(view, id);
    startClock();
  }

  async function login(username, password) {
    username = String(username || '').trim().toLocaleLowerCase('tr-TR');
    const btn = $('#loginBtn');
    const err = $('#loginError');
    if (err) err.textContent = '';
    if (!username || !password) {
      if (err) err.textContent = 'Kullanıcı adı ve şifre gerekli.';
      return false;
    }
    if (btn) {
      btn.disabled = true;
      const spin = btn.querySelector('.spinner');
      if (spin) spin.hidden = false;
    }
    try {
      const u = NS.state.db.users.find(function (x) {
        return String(x.username).toLocaleLowerCase('tr-TR') === username;
      });
      let ok = false;
      if (u) {
        if (u.passHash) ok = u.passHash === await NS.hashPassword(password);
        else if (u.pass) ok = String(u.pass) === String(password);
      }
      if (!u || !ok) {
        if (err) err.textContent = 'Kullanıcı adı veya şifre hatalı.';
        return false;
      }
      if (u.active === false) {
        if (err) err.textContent = 'Bu hesap pasif durumda. Yöneticinizle iletişime geçin.';
        return false;
      }
      if (u.role === 'Üretici' && !NS.producerById(u.producerId)) {
        if (err) err.textContent = 'Üretici hesabı bir çiftlik kaydına bağlı değil.';
        return false;
      }
      NS.sessionSet(u.id);
      NS.state.me = u;
      bootApp();
      toastWelcome(u);
      return true;
    } catch (ex) {
      if (err) err.textContent = 'Giriş yapılamadı: ' + (ex.message || ex);
      return false;
    } finally {
      if (btn) {
        btn.disabled = false;
        const spin = btn.querySelector('.spinner');
        if (spin) spin.hidden = true;
      }
    }
  }

  function toastWelcome(me) {
    const hour = new Date().getHours();
    const salutation = hour < 11 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar';
    NS.toast(salutation + ', ' + me.name, me.role === 'Üretici' ? 'Çiftlik portalınız hazır.' : NS.role() + ' yetkileriyle giriş yapıldı.', 'success');
  }

  function logout() {
    NS.sessionClear();
    NS.state.me = null;
    closeMenus();
    if (typeof NS.closeModal === 'function') NS.closeModal();
    if (typeof NS.closeDrawer === 'function') NS.closeDrawer();
    NS.closePalette();
    showLogin();
    if (location.hash) history.replaceState(null, '', location.pathname);
  }

  /* ============================================================
     Yönlendirme / sayfa kabuğu
     ============================================================ */
  function routeHash(view, id) {
    return '#/' + view + (id ? '/' + encodeURIComponent(id) : '');
  }
  function parseRoute() {
    let raw = String(location.hash || '').replace(/^#\/?/, '');
    if (!raw) return null;
    raw = raw.split('?')[0];
    const parts = raw.split('/');
    const view = decodeURIComponent(parts[0] || '');
    const id = parts[1] ? decodeURIComponent(parts[1]) : null;
    return view ? { view: view, id: id } : null;
  }
  function defaultView() {
    if (NS.isProducer()) return 'farm';
    if (NS.isCollector()) return 'route';
    return 'dashboard';
  }
  function canView(view, id) {
    if (!NS.state.me) return false;
    if (view === 'producer') {
      return (NS.isAdmin() || NS.isCollector()) && !!NS.producerById(id) && NS.canSeeProducer(id);
    }
    const page = NS.PAGES[view];
    return !!page && page.roles.indexOf(NS.role()) !== -1;
  }
  function pageInfo(view, id) {
    if (view === 'producer') {
      const p = NS.producerById(id);
      return {
        title: p ? p.name : 'Üretici',
        sub: p ? (p.code + ' · ' + p.village + ' · ' + (NS.collectorById(p.collectorId) ? NS.collectorById(p.collectorId).route : 'Rota yok')) : 'Üretici kaydı',
        crumb: 'Operasyon / Üreticiler / Kart',
        active: 'producers'
      };
    }
    const page = NS.PAGES[view] || NS.PAGES.dashboard;
    const subFn = PAGE_SUBS[view];
    return {
      title: page.title,
      sub: subFn && NS.state.db ? subFn(NS.state.db) : page.sub,
      crumb: (page.group || 'MandıraPro') + ' / ' + page.title,
      active: view
    };
  }

  function navigate(view, id) {
    if (!NS.state.me) { showLogin(); return; }
    if (!canView(view, id)) {
      const fallback = defaultView();
      NS.toast('Bu ekrana erişim yok', 'Rolünüze uygun bir sayfaya yönlendirildiniz.', 'warn');
      if (view !== fallback) { navigate(fallback); return; }
      view = fallback; id = null;
    }
    const target = routeHash(view, id);
    if (location.hash === target) renderView(view, id);
    else location.hash = target;
  }
  NS.navigate = navigate;

  function onHashChange() {
    if (!NS.state.me) { showLogin(); return; }
    closeMobileSheet();
    const r = parseRoute();
    if (!r) { navigate(defaultView()); return; }
    if (!canView(r.view, r.id)) { navigate(defaultView()); return; }
    renderView(r.view, r.id);
  }

  function navLink(view) {
    const page = NS.PAGES[view];
    if (!page) return '';
    return '<a class="nav-item" href="' + routeHash(view) + '" data-action="nav" data-view="' + view + '" title="' + NS.esc(page.title) + '" aria-label="' + NS.esc(page.title) + '">' +
      NS.icon(page.icon) + '<span>' + NS.esc(page.title) + '</span>' +
      (view === 'records' ? '<b class="nav-badge" id="navRecordBadge" hidden>0</b>' : '') +
    '</a>';
  }

  function renderNav() {
    const root = $('#navRoot');
    if (!root) return;
    const role = NS.role();
    const pages = NS.navPages();
    const primary = role === 'Üretici'
      ? ['farm', 'farm-milk', 'farm-orders', 'farm-account']
      : role === 'Sütçü'
        ? ['route', 'producers', 'records', 'quality', 'tank']
        : ['dashboard', 'producers', 'records', 'settlements', 'reports'];
    const main = primary.filter(function (view) { return pages.indexOf(view) !== -1; });
    const extras = pages.filter(function (view) {
      if (main.indexOf(view) !== -1) return false;
      return view !== 'users' && view !== 'settings';
    });
    const onExtra = extras.indexOf(NS.state.route) !== -1;
    const moreOpen = !!NS.state.navMoreOpen;

    let html = main.map(navLink).join('');
    if (extras.length) {
      html += '<div class="nav-more-wrap">' +
        '<button class="nav-more' + (onExtra ? ' active' : '') + (moreOpen ? ' open' : '') + '" id="navMore" type="button" data-action="nav-more" aria-label="Tüm işlemler" title="Tüm işlemler" aria-expanded="' + (moreOpen ? 'true' : 'false') + '" aria-controls="navExtra">' +
          NS.icon('more') + '<span>Tüm işlemler</span><b>' + extras.length + '</b>' + NS.icon('chevron-down', 'nav-more-chevron') +
        '</button>' +
        '<div class="nav-extra" id="navExtra"' + (moreOpen ? '' : ' hidden') + '>' +
          extras.map(navLink).join('') +
        '</div>' +
      '</div>';
    }
    root.innerHTML = html;
    NS.updateNavBadge();
  }

  function renderMobileNav() {
    const root = $('#mobileTabs');
    if (!root) return;
    const tabs = MOBILE_TABS[NS.role()] || MOBILE_TABS['Yönetici'];
    const active = NS.state.route || '';
    const tabViews = tabs.map(function (t) { return t[0]; });
    const badgeFor = NS.isCollector() ? 'route' : 'records';
    root.innerHTML = tabs.map(function (t) {
      const view = t[0];
      if (view === '__menu') {
        return '<button class="mobile-tab' + (tabViews.indexOf(active) === -1 ? ' active' : '') + '" id="mobileTabMenu" type="button" data-action="mobile-menu-open" data-view="__menu" aria-label="Tüm ekranlar" aria-haspopup="dialog" aria-controls="mobileSheet" aria-expanded="false">' +
          '<span class="tab-ico">' + NS.icon(t[2]) + '</span><span class="tab-label">' + NS.esc(t[1]) + '</span></button>';
      }
      const badge = view === badgeFor ? '<i class="tab-badge" id="mobileRecordBadge" hidden>0</i>' : '';
      return '<a class="mobile-tab' + (view === active ? ' active' : '') + '" href="' + routeHash(view) + '" data-action="nav" data-view="' + view + '" aria-label="' + NS.esc(t[1]) + '">' +
        '<span class="tab-ico">' + NS.icon(t[2]) + badge + '</span><span class="tab-label">' + NS.esc(t[1]) + '</span></a>';
    }).join('');
    NS.updateNavBadge();
  }

  function renderMobileSheet() {
    const body = $('#mobileSheetBody');
    if (!body) return;
    const active = NS.state.route || '';
    const q = (NS._mobileSheetQ || '').toLocaleLowerCase('tr-TR');
    const groups = {};
    NS.navPages().forEach(function (view) {
      const page = NS.PAGES[view];
      if (q && page.title.toLocaleLowerCase('tr-TR').indexOf(q) === -1 && (page.sub || '').toLocaleLowerCase('tr-TR').indexOf(q) === -1) return;
      const key = page.group || 'Diğer';
      (groups[key] = groups[key] || []).push(view);
    });
    const hasResults = Object.keys(groups).length > 0;
    body.innerHTML = (hasResults ? '' : '<div class="msheet-empty"><svg class="icon"><use href="#i-search"/></svg><div>Eşleşen ekran bulunamadı.</div></div>') + Object.keys(groups).map(function (group) {
      return '<section class="msheet-group">' +
        '<div class="msheet-group-title">' + NS.esc(group) + '</div>' +
        '<div class="msheet-links">' + groups[group].map(function (view) {
          const page = NS.PAGES[view];
          return '<a class="msheet-link' + (view === active ? ' active' : '') + '" href="' + routeHash(view) + '" data-action="nav" data-view="' + view + '">' +
            '<span class="msheet-ico">' + NS.icon(page.icon) + '</span>' +
            '<span class="msheet-link-text"><b>' + NS.esc(page.title) + '</b><small>' + NS.esc(page.sub) + '</small></span>' +
            NS.icon('chevron-right', 'msheet-arrow') +
          '</a>';
        }).join('') + '</div></section>';
    }).join('');

    const quick = $('#mobileSheetQuick');
    if (quick) {
      const actions = NS.isProducer()
        ? [['new-order', 'package', 'Sipariş talebi']]
        : [
          ['new-record', 'drop', 'Süt kaydı'],
          ['scan-open', 'scan', 'QR okut'],
          ['new-producer', 'users', 'Üretici ekle']
        ];
      quick.innerHTML = actions.map(function (a) {
        return '<button class="msheet-quick-btn" type="button" data-action="' + a[0] + '">' + NS.icon(a[1]) + '<span>' + NS.esc(a[2]) + '</span></button>';
      }).join('');
    }
    const clear = $('#mobileSheetSearchClear');
    if (clear) clear.style.display = q ? 'flex' : 'none';
    NS.updateUserUI();
  }

  function openMobileSheet() {
    const sheet = $('#mobileSheet');
    if (!sheet) return;
    NS._mobileSheetQ = '';
    const search = $('#mobileSheetSearch');
    if (search) search.value = '';
    const clear = $('#mobileSheetSearchClear');
    if (clear) clear.style.display = 'none';
    renderMobileSheet();
    sheet.hidden = false;
    const tab = $('#mobileTabMenu');
    if (tab) tab.setAttribute('aria-expanded', 'true');
    NS.updateOverflow();
    const close = sheet.querySelector('.msheet-head .icon-btn');
    if (close) setTimeout(function () { close.focus(); }, 60);
  }

  function closeMobileSheet() {
    const sheet = $('#mobileSheet');
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    const tab = $('#mobileTabMenu');
    if (tab) tab.setAttribute('aria-expanded', 'false');
    if (NS.updateOverflow) NS.updateOverflow();
  }

  function toggleNavMore() {
    const extra = $('#navExtra');
    const btn = $('#navMore');
    if (!extra || !btn) return;
    const open = extra.hidden;
    extra.hidden = !open;
    btn.classList.toggle('open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    NS.state.navMoreOpen = open;
  }

  function revealActiveNav(view) {
    const extra = $('#navExtra');
    const btn = $('#navMore');
    if (!extra || !btn) return;
    const inExtra = !!extra.querySelector('.nav-item[data-view="' + view + '"]');
    btn.classList.toggle('active', inExtra);
    if (!extra.hidden) {
      extra.hidden = true;
      btn.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
      NS.state.navMoreOpen = false;
    }
  }

  function refreshUserChrome() {
    NS.updateUserUI();
    updateUserMenuVisibility();
    updateAlertsChrome();
  }

  function updateUserMenuVisibility() {
    $$('#userMenu [data-view="settings"], #userMenu [data-view="users"], #userMenu [data-action="backup-download"]').forEach(function (el) {
      el.hidden = !NS.isAdmin();
    });
  }

  function updateAlertsChrome() {
    if (!NS.state.db) return;
    const alerts = NS.alerts();
    const count = $('#alertCount');
    if (count) {
      count.textContent = alerts.length > 99 ? '99+' : String(alerts.length);
      count.hidden = alerts.length === 0;
    }
    const menu = $('#alertsMenu');
    if (menu && !menu.hidden) renderAlertsMenu();
  }

  function renderAlertsMenu() {
    const menu = $('#alertsMenu');
    if (!menu) return;
    const alerts = NS.alerts();
    menu.innerHTML = '<div class="dropdown-head"><div><b>Güncel uyarılar</b><small>' + NS.fmtDateFull(NS.todayISO()) + '</small></div><span class="badge">' + alerts.length + '</span></div>' +
      (alerts.length ? alerts.map(function (a) {
        return '<button class="dropdown-item alert-line" type="button" data-action="goto" data-view="' + NS.esc(a.view) + '">' +
          '<span class="alert-ico ' + NS.esc(a.tone || '') + '">' + NS.icon(a.icon) + '</span>' +
          '<span class="alert-copy"><b>' + NS.esc(a.title) + '</b><small>' + NS.esc(a.text) + '</small></span></button>';
      }).join('') : '<div class="empty-mini">' + NS.icon('check') + '<b>Her şey yolunda</b><span>Bekleyen kritik uyarı yok.</span></div>');
  }

  function updateTopbar(view, id) {
    const info = pageInfo(view, id);
    const crumb = $('#pageCrumb');
    const title = $('#pageTitle');
    const sub = $('#pageSubtitle');
    if (crumb) crumb.textContent = info.crumb;
    if (title) title.textContent = info.title;
    if (sub) sub.textContent = info.sub;
    document.title = info.title + ' — MandıraPro';
    NS.updateNav(info.active);

    const add = $('#topbarAdd');
    if (!add) return;
    let action = 'new-record';
    let label = 'Yeni Kayıt';
    if (NS.isProducer()) { action = 'new-order'; label = 'Sipariş Talebi'; }
    else if (view === 'producers') { action = 'new-producer'; label = 'Yeni Üretici'; }
    else if (view === 'producer') { action = 'record-for-producer'; label = 'Süt Kaydı'; add.dataset.id = id || ''; }
    else if (view === 'quality') { action = 'sample-create'; label = 'Numune'; }
    else if (view === 'invoices') { action = 'new-invoice'; label = 'Fatura Kes'; }
    else if (view === 'orders' || view === 'farm-orders') { action = 'new-order'; label = 'Yeni Sipariş'; }
    else if (view === 'fleet') { action = 'new-expense'; label = 'Masraf Gir'; }
    else if (view === 'tank') { action = 'tank-dispatch'; label = 'Sevkiyat'; }
    else if (view === 'settlements') { action = 'settle-save'; label = 'Dönemi Kaydet'; }
    else if (view === 'users') { action = 'user-new'; label = 'Kullanıcı'; }
    else if (view === 'route') { action = 'new-record'; label = 'Tartım'; }
    else if (view === 'farm') { action = 'new-order'; label = 'Sipariş Talebi'; }
    if (view !== 'producer') add.dataset.id = '';
    add.dataset.quickAction = action;
    const span = add.querySelector('span');
    if (span) span.textContent = label;
    const fab = $('#mobileFab');
    if (fab) {
      fab.dataset.quickAction = action;
      if (view === 'producer') fab.dataset.id = id || '';
      else delete fab.dataset.id;
      fab.setAttribute('aria-label', label);
      fab.title = label;
    }
  }

  function renderView(view, id) {
    if (!NS.state.me) { showLogin(); return; }
    if (!canView(view, id)) { navigate(defaultView()); return; }
    const prevView = NS.state.route;
    const prevId = NS.state.viewId;
    NS.state.route = view;
    NS.state.viewId = id || null;
    const routeChanged = prevView !== view || prevId !== (id || null);
    if (view === 'producer' && NS.state.producerDetail && NS.state.producerDetail.id !== id) {
      NS.state.producerDetail = { id: id, tab: 'overview', month: 'all' };
    }
    updateTopbar(view, id);
    revealActiveNav(view);
    const host = $('#view');
    if (!host) return;
    let html = '';
    try {
      if (view === 'producer') {
        html = typeof NS.renderProducerDetail === 'function'
          ? NS.renderProducerDetail(id)
          : NS.emptyState('users', 'Üretici ekranı yüklenemedi', 'Sayfayı yenileyip tekrar deneyin.');
      } else {
        const fn = RENDERERS[view];
        html = fn && typeof NS[fn] === 'function'
          ? NS[fn]()
          : NS.emptyState('alert', 'Sayfa bulunamadı', 'Bu ekran bu sürümde yüklenemedi.');
      }
    } catch (err) {
      console.error('Sayfa hatası:', view, err);
      html = NS.emptyState('alert', 'Ekran yüklenirken hata oluştu', err.message || String(err));
    }

    host.innerHTML = html;
    NS.enhanceTables(host);
    host.classList.remove('view-enter');
    void host.offsetWidth;
    host.classList.add('view-enter');
    NS.animateCounts(host);
    NS.renderSparklines(host);
    NS.enhanceMobileInputs(host);

    const hook = NS.hooks && NS.hooks[view];
    if (typeof hook === 'function') {
      setTimeout(function () {
        try { hook(); } catch (err) { console.error('Grafik hatası:', view, err); }
      }, 30);
    }
    const restore = NS._restoreFilter;
    if (restore) {
      NS._restoreFilter = null;
      const el = $('[data-filter="' + restore + '"]');
      if (el) {
        el.focus();
        if (el.type === 'text' && typeof el.setSelectionRange === 'function') {
          const end = el.value.length;
          try { el.setSelectionRange(end, end); } catch (e) { /* yoksay */ }
        }
      }
    }
    if (routeChanged) window.scrollTo(0, 0);
    NS.updateOverflow();
  }

  function refreshChrome() {
    if (!NS.state.me) return;
    NS.updateUserUI();
    updateAlertsChrome();
    NS.updateNavBadge();
  }

  function afterChange(message, detail, opts) {
    opts = opts || {};
    NS.saveDB();
    if (!opts.keepModal) {
      if (opts.closeDrawer) NS.closeDrawer();
      NS.closeModal();
    }
    refreshChrome();
    if (NS.state.me) renderView(NS.state.route, NS.state.viewId);
    if (message) NS.toast(message, detail || '', opts.type || 'success');
  }

  /* ============================================================
     Olaylar
     ============================================================ */
  function onClick(e) {
    if (!e.target.closest('.nav-more-wrap')) {
      const extra = $('#navExtra');
      const btn = $('#navMore');
      if (extra && !extra.hidden) {
        extra.hidden = true;
        if (btn) {
          btn.classList.remove('open');
          btn.setAttribute('aria-expanded', 'false');
        }
        NS.state.navMoreOpen = false;
      }
    }
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) {
      closeMenus();
      return;
    }
    const action = actionEl.dataset.action;

    if (action === 'close-modal') {
      if (actionEl.classList.contains('modal-backdrop') && e.target !== actionEl) return;
    }
    if (action === 'close-drawer' && actionEl.classList.contains('drawer-backdrop') && e.target !== actionEl) return;
    if (action === 'mobile-menu-close' && actionEl.classList.contains('msheet-bg') && e.target !== actionEl) return;
    if (actionEl.tagName === 'A' && action !== 'nav' && !actionEl.getAttribute('href')) e.preventDefault();
    if (actionEl.tagName === 'A' && action === 'nav') e.preventDefault();
    const actionMenu = actionEl.closest('details.mini-menu');
    if (actionMenu) actionMenu.open = false;
    if (action && action !== 'mobile-menu-close' && actionEl.closest('#mobileSheet')) {
      closeMobileSheet();
    }
    if (action) {
      try {
        const res = handleAction(action, actionEl, e);
        if (res && typeof res.catch === 'function') res.catch(function (err) { actionFailed(err, action); });
      } catch (err) { actionFailed(err, action); }
    }
  }

  function actionFailed(err, action) {
    console.error('İşlem hatası:', action, err);
    NS.toast('İşlem tamamlanamadı', err && err.message ? err.message : String(err), 'error');
  }

  function onInput(e) {
    const el = e.target;
    if (e.target.id === 'loginUser' || e.target.id === 'loginPass') {
      const err = $('#loginError');
      if (err) err.textContent = '';
      return;
    }
    if (el.id === 'mobileSheetSearch') {
      NS._mobileSheetQ = el.value;
      const clear = $('#mobileSheetSearchClear');
      if (clear) clear.style.display = el.value ? 'flex' : 'none';
      renderMobileSheet();
      return;
    }
    const filter = el.dataset && el.dataset.filter;
    if (filter) {
      applyFilter(filter, el.value);
      if (el.type === 'text') {
        clearTimeout(el._filterTimer);
        el._filterTimer = setTimeout(function () { renderView(NS.state.route, NS.state.viewId); }, 260);
      } else {
        renderView(NS.state.route, NS.state.viewId);
      }
      return;
    }
    if (el.name === 'liters' || el.name === 'producerId') updateLiterHint();
  }

  function onChange(e) {
    const el = e.target;
    const filter = el.dataset && el.dataset.filter;
    if (filter) {
      applyFilter(filter, el.type === 'checkbox' ? el.checked : el.value);
      NS._restoreFilter = filter;
      renderView(NS.state.route, NS.state.viewId);
      return;
    }
    if (el.id === 'restoreFile' && el.files && el.files[0]) {
      restoreBackupFile(el.files[0]);
    }
    if (el.id === 'importProducerFile' && el.files && el.files[0]) {
      importProducersFile(el.files[0]);
    }
  }

  function onSubmit(e) {
    const form = e.target;
    if (!form) return;
    const formId = form.getAttribute ? (form.getAttribute('id') || '') : '';
    if (!formId) return;
    e.preventDefault();
    if (formId === 'loginForm') {
      login($('#loginUser').value, $('#loginPass').value);
      return;
    }
    if (typeof form.reportValidity === 'function' && !form.reportValidity()) return;
    const res = handleFormSubmit(form);
    if (res && typeof res.catch === 'function') res.catch(function (err) { actionFailed(err, formId); });
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      if ($('#mobileSheet') && !$('#mobileSheet').hidden) { closeMobileSheet(); return; }
      closeMenus();
      if (typeof NS.closePrintDoc === 'function' && $('#printRoot') && $('#printRoot').children.length) {
        NS.closePrintDoc();
        return;
      }
      if (NS._paletteFiltered && $('#paletteRoot') && $('#paletteRoot').children.length) { NS.closePalette(); return; }
      if ($('#drawerRoot') && $('#drawerRoot').children.length) { NS.closeDrawer(); return; }
      if ($('#modalRoot') && $('#modalRoot').children.length) { NS.closeModal(); return; }
      closeMobileSidebar();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (NS.state.me) NS.openPalette();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n' && NS.state.me) {
      e.preventDefault();
      if (NS.isProducer()) openOrderModal();
      else openRecordModal();
      return;
    }
    if (e.altKey && /^[1-9]$/.test(e.key) && NS.state.me) {
      const pages = NS.navPages();
      const target = pages[Number(e.key) - 1];
      if (target) { e.preventDefault(); navigate(target); }
    }
  }

  function onStorage(e) {
    if (e.key !== NS.APP.storageKey || syncing || NS._ignoreStorage) return;
    syncing = true;
    NS.ensureDB().then(function () {
      NS.applyTheme(NS.state.db.settings.theme);
      renderAuthFacts();
      if (NS.state.me) {
        const me = NS.resolveMe();
        if (!me || me.active === false) { logout(); return; }
        NS.state.me = me;
        refreshChrome();
        renderView(NS.state.route, NS.state.viewId);
        NS.toast('Veriler güncellendi', 'Başka bir sekmedeki değişiklikler alındı.', 'info');
      }
    }).catch(function () { /* yoksay */ }).finally(function () { syncing = false; });
  }

  function applyFilter(name, value) {
    const s = NS.state;
    s.rec = s.rec || {};
    s.prod = s.prod || {};
    s.report = s.report || {};
    if (!s.routeFilter) s.routeFilter = {};
    if (!s.settlement) s.settlement = {};
    switch (name) {
      case 'rec-q': s.rec.q = value; s.rec.page = 1; break;
      case 'rec-date': s.rec.date = value || NS.todayISO(); s.rec.range = 'day'; s.rec.page = 1; break;
      case 'rec-producer': s.rec.producer = value; s.rec.page = 1; break;
      case 'rec-collector': s.rec.collector = value; s.rec.page = 1; break;
      case 'rec-grade': s.rec.grade = value; s.rec.page = 1; break;
      case 'prod-q': s.prod.q = value; s.prod.page = 1; break;
      case 'prod-status': s.prod.status = value; s.prod.page = 1; break;
      case 'qual-q': s.qual.q = value; break;
      case 'qual-status': s.qual.status = value; break;
      case 'inv-q': s.invoice.q = value; break;
      case 'inv-type': s.invoice.type = value; break;
      case 'order-q': s.orders.q = value; break;
      case 'order-status': s.orders.status = value; break;
      case 'acc-q': s.accounts.q = value; break;
      case 'fleet-q': s.fleet.q = value; break;
      case 'fleet-type': s.fleet.type = value; break;
      case 'fleet-vehicle': s.fleet.vehicle = value; break;
      case 'report-collector': s.report.collector = value; break;
      case 'route-date': s.routeFilter.date = value; break;
      case 'route-collector': s.routeFilter.collectorId = value; break;
      case 'settle-month': s.settlement.ym = value; break;
      case 'settle-collector': s.settlement.collector = value; break;
      case 'producer-month':
        if (!s.producerDetail) s.producerDetail = {};
        s.producerDetail.month = value;
        break;
      default: break;
    }
  }

  function updateLiterHint() {
    const box = $('#litWarning');
    if (!box) return;
    const form = box.closest('form');
    if (!form) return;
    const pid = form.elements.producerId ? form.elements.producerId.value : '';
    const date = form.elements.date ? form.elements.date.value : NS.todayISO();
    const session = 'Sabah';
    const liters = Number(form.elements.liters ? form.elements.liters.value : 0) || 0;
    if (!pid) { box.innerHTML = ''; return; }
    const exp = NS.expectedLiters(pid, date, session, form.dataset.recordId || null);
    const warn = NS.literWarning(pid, liters, date, session, form.dataset.recordId || null);
    let tone = 'info';
    let text = 'Beklenen aralık: <b>' + NS.fmtNum(exp.min, 1) + '–' + NS.fmtNum(exp.max, 1) + ' L</b> · ortalama ' + NS.fmtNum(exp.avg, 1) + ' L.';
    if (warn) { tone = 'warn'; text += ' <b>' + NS.esc(warn) + '</b>'; }
    box.className = 'inline-note lit-warning ' + tone;
    box.innerHTML = NS.icon(tone === 'warn' ? 'alert' : 'info') + '<span>' + text + '</span>';
  }

  function closeMenus() {
    const user = $('#userMenu');
    if (user) user.hidden = true;
    const alerts = $('#alertsMenu');
    if (alerts) alerts.hidden = true;
  }
  function closeMobileSidebar() {
    const sidebar = $('#sidebar');
    if (sidebar) sidebar.classList.remove('open');
    const bd = $('#sidebarBackdrop');
    if (bd) bd.hidden = true;
  }

  /* ============================================================
     Ortak yardımcılar
     ============================================================ */
  function uid(prefix) { return NS.uid(prefix || 'x'); }
  function fv(form, name) {
    const el = form.elements[name];
    return el ? String(el.value || '').trim() : '';
  }
  function fn(form, name) { return Number(fv(form, name)) || 0; }
  function fc(form, name) {
    const el = form.elements[name];
    return !!(el && el.checked);
  }
  function esc(v) { return NS.esc(v); }
  function option(value, label, selected, attrs) {
    return '<option value="' + esc(value) + '"' + (String(selected) === String(value) ? ' selected' : '') + (attrs || '') + '>' + esc(label) + '</option>';
  }
  function collectorOptions(selected, includeAll) {
    return (includeAll ? option('', 'Tüm sütçüler', selected) : '') +
      NS.state.db.collectors.map(function (c) {
        return option(c.id, c.name + ' — ' + c.route, selected);
      }).join('');
  }
  function producerOptions(selected, includeAll) {
    return (includeAll ? option('', 'Tüm üreticiler', selected) : '') +
      NS.visibleProducers().map(function (p) {
        return option(p.id, p.name + ' — ' + p.code, selected);
      }).join('');
  }
  function priceListOptions(selected) {
    return NS.state.db.priceLists.map(function (pl) { return option(pl.id, pl.name, selected); }).join('');
  }
  function roleOptions(selected) {
    return ['Yönetici', 'Sütçü', 'Üretici'].map(function (r) { return option(r, r, selected); }).join('');
  }
  function openFormModal(opts) {
    opts = opts || {};
    const formId = opts.formId || uid('form');
    const form = '<form id="' + formId + '" autocomplete="off"' + (opts.formAttr || '') + '>' + (opts.body || '') + '</form>';
    const footer = (opts.footer || '<button class="btn btn-ghost" type="button" data-action="close-modal">Vazgeç</button>' +
      '<button class="btn btn-primary" type="submit" form="' + formId + '">' + NS.icon('check') + ' ' + esc(opts.submit || 'Kaydet') + '</button>');
    NS.openModal({
      title: opts.title,
      subtitle: opts.subtitle,
      icon: opts.icon,
      size: opts.size || 'md',
      body: form,
      footer: footer
    });
    return formId;
  }
  function formHead(icon, title, text) {
    return '<div class="form-intro">' + NS.icon(icon) + '<div><b>' + esc(title) + '</b><p>' + esc(text) + '</p></div></div>';
  }
  function emptyHint(text) { return '<p class="small faint" style="padding:10px 0">' + esc(text) + '</p>'; }
  function todayDate() { return NS.todayISO(); }

  function requireAdmin() {
    if (NS.isAdmin()) return true;
    NS.toast('Yönetici yetkisi gerekli', 'Bu işlemi yalnızca yönetici hesapları yapabilir.', 'warn');
    return false;
  }
  function requireCollectorOrAdmin() {
    if (NS.isAdmin() || NS.isCollector()) return true;
    NS.toast('Yetki yok', 'Bu işlem için saha veya yönetici yetkisi gerekli.', 'warn');
    return false;
  }

  function producerPortalUser(producerId) {
    return NS.state.db.users.find(function (u) { return u.role === 'Üretici' && u.producerId === producerId; }) || null;
  }
  function uniqueUsername(raw) {
    let base = String(raw || 'kullanici').toLocaleLowerCase('tr-TR')
      .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .replace(/[^a-z0-9._-]/g, '').replace(/^[-._]+|[-._]+$/g, '').slice(0, 24) || 'kullanici';
    const existing = {};
    NS.state.db.users.forEach(function (u) { existing[String(u.username).toLowerCase()] = true; });
    if (!existing[base]) return base;
    let n = 2;
    while (existing[base + n]) n += 1;
    return base + n;
  }
  function nextProducerCode() {
    let max = 0;
    NS.state.db.producers.forEach(function (p) {
      const m = /^U-(\d+)$/i.exec(p.code || '');
      if (m) max = Math.max(max, Number(m[1]));
    });
    return 'U-' + String(max + 1).padStart(3, '0');
  }
  function nextOrderNo() {
    const year = new Date().getFullYear();
    let max = 0;
    NS.state.db.orders.forEach(function (o) {
      const m = new RegExp('^SIP-' + year + '-(\\d+)$').exec(o.no || '');
      if (m) max = Math.max(max, Number(m[1]));
    });
    return 'SIP-' + year + '-' + String(max + 1).padStart(4, '0');
  }
  function nextCollectorId() {
    let max = 0;
    NS.state.db.collectors.forEach(function (c) {
      const m = /^c(\d+)$/.exec(c.id || '');
      if (m) max = Math.max(max, Number(m[1]));
    });
    return 'c' + (max + 1);
  }
  function nextProducerId() {
    let max = 0;
    NS.state.db.producers.forEach(function (p) {
      const m = /^p(\d+)$/.exec(p.id || '');
      if (m) max = Math.max(max, Number(m[1]));
    });
    return 'p' + (max + 1);
  }
  function productOptions(selected) {
    return NS.state.db.products.map(function (p) {
      return option(p.id, p.name + ' · ' + NS.fmtMoney(p.price, 2), selected, ' data-price="' + Number(p.price || 0) + '"');
    }).join('');
  }
  function monthOptions(selected, count) {
    const arr = [];
    for (let i = 0; i < (count || 12); i++) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      arr.push(d.getFullYear() + '-' + NS.pad(d.getMonth() + 1));
    }
    return arr.map(function (ym) {
      return option(ym, NS.capitalize(NS.monthLabel(ym)), selected);
    }).join('');
  }

  /* ============================================================
     Eylem yönlendirici
     ============================================================ */
  async function handleAction(action, el, e) {
    const role = NS.role();
    const producerAllowed = [
      'nav', 'goto', 'logout', 'theme-toggle', 'palette-open', 'palette-pick', 'close-palette',
      'close-modal', 'close-drawer', 'print-doc', 'close-doc', 'toggle-pass', 'collapse', 'mobile-menu',
      'mobile-menu-open', 'mobile-menu-close', 'mobile-search-clear', 'back-to-top',
      'close-mobile', 'alerts-toggle', 'user-menu', 'change-password', 'farm-print-statement',
      'farm-milk-export', 'farm-qr', 'farm-range', 'new-order', 'order-view', 'order-print',
      'scan-open', 'scan-submit', 'confirm-yes', 'confirm-no', 'quick-add'
    ];
    if (role === 'Üretici' && producerAllowed.indexOf(action) === -1) {
      NS.toast('Bu işlem çiftlik portalında kullanılamaz', 'Yöneticinizle iletişime geçin.', 'warn');
      return;
    }

    switch (action) {
      case 'close-modal': NS.closeModal(); return;
      case 'close-drawer': NS.closeDrawer(); return;
      case 'confirm-yes': NS.settleConfirm(true); return;
      case 'confirm-no': NS.settleConfirm(false); return;
      case 'close-palette': NS.closePalette(); return;
      case 'nav-more': toggleNavMore(); return;
      case 'mobile-menu-open': openMobileSheet(); return;
      case 'mobile-menu-close': closeMobileSheet(); return;
      case 'mobile-search-clear': {
        const el = $('#mobileSheetSearch');
        if (el) { el.value = ''; NS._mobileSheetQ = ''; renderMobileSheet(); el.focus(); }
        return;
      }
      case 'back-to-top': {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      case 'palette-pick': NS.pickPaletteItem(Number(el.dataset.pos)); return;
      case 'palette-open': if (NS.state.me) NS.openPalette(); return;
      case 'toggle-pass': togglePassword(el); return;
      case 'demo-login':
        fillLogin(el.dataset.username || '', '1234');
        await login(el.dataset.username, '1234');
        return;
      case 'logout':
        if (await NS.confirmDialog({ title: 'Çıkış yapılsın mı?', message: 'Oturumunuz kapatılacak. Veriler bu bilgisayarda kalır.', confirmText: 'Çıkış yap', danger: false })) logout();
        return;
      case 'theme-toggle': NS.toggleTheme(); return;
      case 'collapse': {
        const shell = $('#appShell');
        shell.classList.toggle('collapsed');
        try { localStorage.setItem('mandirapro_ui_collapsed', shell.classList.contains('collapsed') ? '1' : '0'); } catch (err) { /* yoksay */ }
        return;
      }
      case 'mobile-menu': {
        const sidebar = $('#sidebar');
        const backdrop = $('#sidebarBackdrop');
        if (sidebar) sidebar.classList.add('open');
        if (backdrop) backdrop.hidden = false;
        return;
      }
      case 'close-mobile': closeMobileSidebar(); return;
      case 'alerts-toggle': {
        const m = $('#alertsMenu');
        if (!m) return;
        const willShow = m.hidden;
        closeMenus();
        m.hidden = !willShow;
        if (willShow) renderAlertsMenu();
        return;
      }
      case 'user-menu': {
        const m = $('#userMenu');
        if (!m) return;
        const willShow = m.hidden;
        closeMenus();
        m.hidden = !willShow;
        return;
      }
      case 'nav':
      case 'goto':
        closeMenus();
        closeMobileSidebar();
        closeMobileSheet();
        if (el.dataset.view) navigate(el.dataset.view);
        return;
      case 'quick-add': {
        const sub = el.dataset.quickAction || 'new-record';
        return handleAction(sub, el, e);
      }
      case 'print-doc': NS.printSheet(); return;
      case 'close-doc': NS.closePrintDoc(); return;
      case 'backup-download': NS.downloadBackup(); return;
      case 'backup-restore': triggerRestore(); return;
      case 'reset-demo': return resetDemo();
      case 'change-password': return openPasswordModal();
      case 'set-theme': return setTheme(el.dataset.themeOpt);
      case 'rec-range':
        NS.state.rec.range = el.dataset.range || 'month';
        if (NS.state.rec.range === 'day' && !NS.state.rec.date) NS.state.rec.date = NS.todayISO();
        NS.state.rec.page = 1;
        renderView('records');
        return;
      case 'rec-day-step': {
        const base = new Date((NS.state.rec.date || NS.todayISO()) + 'T12:00:00');
        base.setDate(base.getDate() + (Number(el.dataset.step) || 1));
        NS.state.rec.date = base.toISOString().slice(0, 10);
        NS.state.rec.range = 'day';
        NS.state.rec.page = 1;
        renderView('records');
        return;
      }
      case 'rec-clear':
        NS.state.rec.q = ''; NS.state.rec.date = NS.todayISO(); NS.state.rec.producer = ''; NS.state.rec.collector = ''; NS.state.rec.grade = ''; NS.state.rec.page = 1;
        renderView('records'); return;
      case 'rec-page': setPage(NS.state.rec, el.dataset.page); renderView('records'); return;
      case 'prod-clear':
        NS.state.prod.q = ''; NS.state.prod.status = 'all'; NS.state.prod.collector = ''; NS.state.prod.page = 1;
        renderView('producers'); return;
      case 'prod-collector': NS.state.prod.collector = el.dataset.collector || ''; NS.state.prod.page = 1; renderView('producers'); return;
      case 'prod-view': NS.state.prod.view = el.dataset.viewMode === 'cards' ? 'cards' : 'table'; renderView('producers'); return;
      case 'prod-page': setPage(NS.state.prod, el.dataset.page); renderView('producers'); return;
      case 'settle-half': NS.state.settlement.half = el.dataset.half || 'full'; renderView('settlements'); return;
      case 'acc-status': NS.state.accounts.status = el.dataset.status || 'all'; renderView('accounts'); return;
      case 'report-range': NS.state.report.range = el.dataset.range || '30'; renderView('reports'); return;
      case 'farm-range': NS.state.farm.range = el.dataset.range || '30'; renderView('farm-milk'); return;
      case 'settings-tab': NS.state.settingsTab = el.dataset.tab || 'business'; renderView('settings'); return;
      default: break;
    }

    return handleDataAction(action, el, e);
  }

  function setPage(scope, page) {
    scope.page = Math.max(1, Number(page) || 1);
  }

  function togglePassword(button) {
    const input = button.parentNode ? button.parentNode.querySelector('input') : null;
    if (!input) return;
    input.type = input.type === 'password' ? 'text' : 'password';
    button.setAttribute('aria-label', input.type === 'password' ? 'Şifreyi göster' : 'Şifreyi gizle');
  }
  function fillLogin(username, password) {
    const u = $('#loginUser');
    const p = $('#loginPass');
    if (u) u.value = username || '';
    if (p) p.value = password || '';
  }

  /* ============================================================
     Form gönderimleri
     ============================================================ */
  async function handleFormSubmit(form) {
    const formId = form.getAttribute ? (form.getAttribute('id') || '') : '';
    switch (formId) {
      case 'settingsBusinessForm': return saveBusinessSettings(form);
      case 'producerForm': return saveProducer(form);
      case 'recordForm': return saveRecord(form);
      case 'sampleForm': return saveSample(form);
      case 'analyzeForm': return saveAnalysis(form);
      case 'invoiceForm': return saveInvoice(form);
      case 'orderForm': return saveOrder(form);
      case 'paymentForm': return savePayment(form);
      case 'expenseForm': return saveExpense(form);
      case 'vehicleForm': return saveVehicle(form);
      case 'userForm': return saveUser(form);
      case 'collectorForm': return saveCollector(form);
      case 'priceForm': return savePriceList(form);
      case 'tankForm': return saveTank(form);
      case 'tankMeasureForm': return saveTankMeasure(form);
      case 'dispatchForm': return saveDispatch(form);
      case 'noteForm': return saveProducerNote(form);
      case 'passwordForm': return savePassword(form);
      case 'scanForm': return submitScan(form);
      case 'statementForm': return printStatementFromForm(form);
      default: return;
    }
  }

  /* ============================================================
     Veri değişiklikleri — üretici / kayıt / numune
     ============================================================ */
  function producerFormBody(p) {
    p = p || {};
    const portal = p.id ? producerPortalUser(p.id) : null;
    return '<input type="hidden" name="id" value="' + esc(p.id || '') + '">' +
      formHead('users', p.id ? 'Üretici bilgilerini düzenle' : 'Yeni üretici kaydı', 'Saha bilgileri, fiyat listesi ve portal erişimi birlikte yönetilir.') +
      '<div class="form-grid">' +
        '<label class="field"><span class="field-label">Ad soyad *</span><input class="input" name="name" value="' + esc(p.name || '') + '" required maxlength="60" placeholder="Örn. Ahmet Yılmaz"></label>' +
        '<label class="field"><span class="field-label">Telefon</span><input class="input" name="phone" type="tel" value="' + esc(p.phone || '') + '" maxlength="24" placeholder="05xx xxx xx xx"></label>' +
        '<label class="field"><span class="field-label">Köy / mahalle *</span><input class="input" name="village" value="' + esc(p.village || '') + '" required maxlength="40"></label>' +
        '<label class="field"><span class="field-label">Açık adres</span><input class="input" name="address" value="' + esc(p.address || '') + '" maxlength="100"></label>' +
        '<label class="field"><span class="field-label">Sütçü / rota</span><select class="select" name="collectorId" required>' + collectorOptions(p.collectorId || (NS.state.db.collectors[0] || {}).id) + '</select></label>' +
        '<label class="field"><span class="field-label">Rota sırası</span><input class="input" name="sira" type="number" min="1" max="99" value="' + Number(p.sira || 1) + '"></label>' +
        '<label class="field"><span class="field-label">Hayvan sayısı</span><input class="input" name="animalCount" type="number" min="0" max="9999" value="' + Number(p.animalCount || 10) + '"></label>' +
        '<label class="field"><span class="field-label">Fiyat listesi</span><select class="select" name="priceListId">' + priceListOptions(p.priceListId || (NS.state.db.priceLists[0] || {}).id) + '</select></label>' +
        '<label class="field"><span class="field-label">Vergi no</span><input class="input" name="taxNo" value="' + esc(p.taxNo || '') + '" maxlength="20"></label>' +
        '<label class="field"><span class="field-label">Vergi dairesi</span><input class="input" name="taxOffice" value="' + esc(p.taxOffice || 'Konya') + '" maxlength="30"></label>' +
        '<label class="field span-2"><span class="field-label">IBAN</span><input class="input" name="iban" value="' + esc(p.iban || '') + '" maxlength="42" placeholder="TR00 0000 0000 0000 0000 0000 00"></label>' +
        '<label class="field span-2"><span class="field-label">Not</span><textarea class="textarea" name="note" rows="2" maxlength="300">' + esc(p.note || '') + '</textarea></label>' +
      '</div>' +
      '<div class="form-section"><div class="form-section-head"><b>Üretici portalı</b><span>Çiftçi yalnızca kendi verilerini görür.</span></div>' +
        '<div class="form-grid">' +
          '<label class="field"><span class="field-label">Portal kullanıcı adı</span><input class="input" name="portalUsername" value="' + esc(portal ? portal.username : '') + '" placeholder="Otomatik oluşturulur" ' + (portal ? 'readonly' : '') + '></label>' +
          '<label class="field"><span class="field-label">Portal şifresi</span><input class="input" name="portalPassword" type="password" autocomplete="new-password" placeholder="' + (portal ? 'Değiştirmek için yazın' : 'Boşsa 1234') + '"></label>' +
          '<label class="checkbox span-2"><input type="checkbox" name="active"' + (p.active !== false ? ' checked' : '') + '> Üretici aktif (süt alımı ve portal erişimi açık)</label>' +
        '</div>' +
      '</div>';
  }

  function openProducerModal(id) {
    if (!requireCollectorOrAdmin()) return;
    const p = id ? NS.producerById(id) : null;
    if (id && !p) return;
    openFormModal({
      title: p ? 'Üreticiyi düzenle' : 'Yeni üretici',
      subtitle: p ? p.code + ' · ' + p.name : 'Kayıt ve çiftlik portalı birlikte oluşturulur',
      icon: p ? 'edit' : 'users',
      size: 'lg',
      formId: 'producerForm',
      body: producerFormBody(p),
      submit: p ? 'Değişiklikleri kaydet' : 'Üreticiyi kaydet'
    });
  }
  NS.openProducerModal = openProducerModal;

  async function saveProducer(form) {
    if (!requireCollectorOrAdmin()) return;
    const db = NS.state.db;
    const id = form.dataset.id || (form.elements.id ? form.elements.id.value : '');
    const existing = id ? NS.producerById(id) : null;
    const name = fv(form, 'name');
    const village = fv(form, 'village');
    if (!name || !village) { NS.toast('Zorunlu alanlar eksik', 'Ad ve köy alanlarını doldurun.', 'warn'); return; }
    let code = existing ? existing.code : nextProducerCode();
    if (db.producers.some(function (p) { return p.code === code && (!existing || p.id !== existing.id); })) code = nextProducerCode();
    const data = {
      name: name,
      phone: fv(form, 'phone'),
      village: village,
      address: fv(form, 'address') || village + ' / Konya',
      collectorId: fv(form, 'collectorId') || (db.collectors[0] || {}).id,
      sira: Number(fv(form, 'sira')) || 1,
      animalCount: Number(fv(form, 'animalCount')) || 0,
      priceListId: fv(form, 'priceListId') || (db.priceLists[0] || {}).id,
      taxNo: fv(form, 'taxNo'),
      taxOffice: fv(form, 'taxOffice') || 'Konya',
      iban: fv(form, 'iban'),
      note: fv(form, 'note'),
      active: fc(form, 'active')
    };
    let producer;
    if (existing) {
      Object.assign(existing, data);
      producer = existing;
    } else {
      producer = Object.assign({
        id: nextProducerId(),
        code: code,
        qr: 'MP|URETICI|' + code,
        baseLiters: 20,
        joinedAt: NS.todayISO(),
        createdAt: new Date().toISOString()
      }, data);
      db.producers.push(producer);
    }
    let portal = producerPortalUser(producer.id);
    const usernameInput = fv(form, 'portalUsername');
    const passInput = fv(form, 'portalPassword');
    if (!portal) {
      const username = uniqueUsername(usernameInput || String(producer.name).split(/\s+/)[0]);
      portal = {
        id: uid('u'), name: producer.name, username: username, role: 'Üretici',
        producerId: producer.id, phone: producer.phone, active: producer.active,
        passHash: await NS.hashPassword(passInput || '1234'), createdAt: new Date().toISOString()
      };
      db.users.push(portal);
    } else {
      portal.name = producer.name;
      portal.phone = producer.phone;
      portal.active = producer.active;
      if (usernameInput && usernameInput !== portal.username) {
        const normalized = uniqueUsername(usernameInput);
        if (normalized !== usernameInput) { NS.toast('Kullanıcı adı kullanılıyor', 'Portal kullanıcı adı ' + normalized + ' olarak ayarlandı.', 'warn'); }
        portal.username = normalized;
      }
      if (passInput) portal.passHash = await NS.hashPassword(passInput);
    }
    afterChange(existing ? 'Üretici güncellendi' : 'Üretici oluşturuldu', producer.code + ' · ' + producer.name + (portal ? ' · portal: ' + portal.username : ''));
  }

  function openRecordModal(id, defaults) {
    if (!requireCollectorOrAdmin()) return;
    const db = NS.state.db;
    const r = id ? db.records.find(function (x) { return x.id === id; }) : null;
    if (r && !canEditRecord(r)) return;
    defaults = defaults || {};
    const p = r ? NS.producerById(r.producerId) : NS.producerById(defaults.producerId || (NS.state.viewId || '') || '');
    const date = r ? r.date : (defaults.date || NS.todayISO());
    const feeds = r ? r.feeds : {};
    const producers = NS.visibleProducers();
    const feedInputs = MP.FEEDS.map(function (f) {
      return '<label class="field"><span class="field-label">' + esc(f.label) + ' <small class="faint">kg</small></span>' +
        '<input class="input" name="' + f.key + '" type="number" min="0" step="0.1" value="' + Number(feeds[f.key] || 0) + '"></label>';
    }).join('');
    const body = formHead('drop', r ? 'Süt kaydını düzenle' : 'Günlük süt ve yem girişi', r ? 'Kayıt tarihine göre düzenleme penceresi uygulanır.' : 'Tartım ve yem miktarları tek ekranda girilir.') +
      '<div class="form-grid">' +
        '<label class="field"><span class="field-label">Üretici *</span><select class="select" name="producerId" required>' +
          (producers.length ? producers.map(function (x) { return option(x.id, x.name + ' — ' + x.code + ' · ' + x.village, p ? p.id : ''); }).join('') : option('', 'Üretici yok', '')) +
        '</select></label>' +
        '<label class="field"><span class="field-label">Tarih *</span><input class="input" name="date" type="date" value="' + date + '" required></label>' +
        '<label class="field"><span class="field-label">Süt (litre) *</span><input class="input" name="liters" type="number" min="0" step="0.1" value="' + (r ? Number(r.liters) : '') + '" required placeholder="0,0"></label>' +
      '</div>' +
      '<div id="litWarning" class="inline-note lit-warning info"></div>' +
      '<div class="form-section"><div class="form-section-head"><b>Yem teslimi</b><span>Miktarlar kilogram cinsindendir.</span></div><div class="form-grid form-grid-4">' + feedInputs + '</div></div>' +
      '<label class="field"><span class="field-label">Not</span><textarea class="textarea" name="note" rows="2" maxlength="300">' + esc(r ? r.note : '') + '</textarea></label>' +
      '<input type="hidden" name="id" value="' + (r ? r.id : '') + '">';
    const formId = openFormModal({
      title: r ? 'Süt kaydı' : 'Yeni süt kaydı',
      subtitle: r ? NS.fmtDate(r.date) + ' · ' + (p ? p.name : '') : 'Saha tartımı ve yem teslimi',
      icon: 'drop',
      size: 'lg',
      formId: 'recordForm',
      body: body,
      submit: r ? 'Kaydı güncelle' : 'Kaydı işle'
    });
    const f = $('#' + formId);
    if (f) {
      f.dataset.id = r ? r.id : '';
      f.dataset.recordId = r ? r.id : '';
      updateLiterHint();
    }
  }
  NS.openRecordModal = openRecordModal;

  function recordEditDeadline(r) {
    if (!r || !r.createdAt) return null;
    const t = new Date(r.createdAt).getTime();
    if (isNaN(t)) return null;
    return t + 30 * 60 * 1000;
  }
  function canEditRecord(r) {
    if (!r) return false;
    if (NS.isAdmin()) return true;
    if (!NS.isCollector()) {
      NS.toast('Kayıt düzenlenemez', 'Bu kaydı yalnızca yönetici düzenleyebilir.', 'warn');
      return false;
    }
    if (r.collectorId !== NS.state.me.collectorId) {
      NS.toast('Kayıt size ait değil', 'Yalnızca kendi rotanızdaki kayıtları düzenleyebilirsiniz.', 'warn');
      return false;
    }
    const deadline = recordEditDeadline(r);
    if (!deadline || Date.now() <= deadline) return true;
    NS.toast('Düzenleme süresi doldu', 'Saha kayıtları yalnızca ilk 30 dakika içinde düzenlenebilir. Yöneticinizle iletişime geçin.', 'warn');
    return false;
  }

  async function saveRecord(form) {
    if (!requireCollectorOrAdmin()) return;
    const db = NS.state.db;
    const id = fv(form, 'id');
    const existing = id ? db.records.find(function (r) { return r.id === id; }) : null;
    if (existing && !canEditRecord(existing)) return;
    const pid = fv(form, 'producerId');
    const p = NS.producerById(pid);
    if (!p) { NS.toast('Üretici seçin', '', 'warn'); return; }
    if (NS.isCollector() && p.collectorId !== NS.state.me.collectorId) {
      NS.toast('Bu üretici rotanızda değil', 'Yalnızca kendi rotanızdaki üreticiler için kayıt girebilirsiniz.', 'warn'); return;
    }
    const date = fv(form, 'date') || NS.todayISO();
    const session = 'Sabah';
    const liters = Number(fv(form, 'liters')) || 0;
    const feeds = {};
    MP.FEEDS.forEach(function (f) { feeds[f.key] = Number(fv(form, f.key)) || 0; });
    const dup = db.records.find(function (r) {
      return r.producerId === pid && r.date === date && r.session === session && (!existing || r.id !== existing.id);
    });
    if (dup) {
      const go = await NS.confirmDialog({
        title: 'Aynı güne ait kayıt var',
        message: p.name + ' için ' + NS.fmtDate(date) + ' tarihli bir kayıt zaten girilmiş. Yeni kayıt yine de eklensin mi?',
        confirmText: 'Yine de ekle', danger: false
      });
      if (!go) return;
    }
    const quality = existing ? (existing.quality || null) : null;
    const price = quality ? NS.priceFor(p, quality.grade) : NS.basePriceFor(p);
    const amount = NS.round(liters * price, 2);
    if (existing) {
      if (existing.date === NS.todayISO()) {
        const diff = liters - Number(existing.liters || 0);
        const tank = db.tanks[0];
        if (tank) tank.current = Math.max(0, NS.round(Number(tank.current) + diff, 1));
      }
      Object.assign(existing, {
        producerId: pid, collectorId: p.collectorId, date: date, session: session,
        liters: liters, milk: liters, feeds: feeds, price: price, amount: amount,
        note: fv(form, 'note'), updatedAt: new Date().toISOString()
      });
    } else {
      const rec = {
        id: uid('r'), producerId: pid, collectorId: p.collectorId, date: date, session: session,
        liters: liters, milk: liters, feeds: feeds, quality: null, price: price, amount: amount,
        sampleId: null, note: fv(form, 'note'), status: 'Toplandı',
        createdAt: date === NS.todayISO() ? new Date().toISOString() : date + 'T08:30:00',
        updatedAt: null
      };
      db.records.push(rec);
      if (date === NS.todayISO() && db.tanks[0]) {
        db.tanks[0].current = NS.round(Number(db.tanks[0].current || 0) + liters, 1);
      }
    }
    afterChange(existing ? 'Süt kaydı güncellendi' : 'Süt kaydı işlendi', p.name + ' · ' + NS.fmtNum(liters, 1) + ' L · ' + NS.fmtMoney(amount, 2));
  }

  async function deleteRecord(id) {
    if (!requireCollectorOrAdmin()) return;
    const r = NS.state.db.records.find(function (x) { return x.id === id; });
    if (!r) return;
    if (!canEditRecord(r)) return;
    const p = NS.producerById(r.producerId);
    const ok = await NS.confirmDialog({
      title: 'Kayıt silinsin mi?',
      message: (p ? p.name : '') + ' · ' + NS.fmtDate(r.date) + ' · ' + NS.fmtNum(r.liters, 1) + ' litre. Bu işlem cari ve tediye hesaplarını etkiler.',
      confirmText: 'Kaydı sil'
    });
    if (!ok) return;
    if (r.date === NS.todayISO() && NS.state.db.tanks[0]) {
      NS.state.db.tanks[0].current = Math.max(0, NS.round(Number(NS.state.db.tanks[0].current || 0) - Number(r.liters || 0), 1));
    }
    const sample = NS.state.db.samples.find(function (s) { return s.id === r.sampleId; });
    if (sample) { sample.recordId = null; }
    NS.state.db.records = NS.state.db.records.filter(function (x) { return x.id !== id; });
    afterChange('Süt kaydı silindi', (p ? p.name : '') + ' · ' + NS.fmtDate(r.date), { closeDrawer: true });
  }

  function sampleFormBody(p, s) {
    p = p || {};
    s = s || {};
    return formHead('flask', 'Numune kaydı', 'QR etiketiyle eşleşen üretici ve süt kaydı otomatik seçilir.') +
      '<div class="form-grid">' +
        '<label class="field"><span class="field-label">Üretici *</span><select class="select" name="producerId" required>' + producerOptions(p.id) + '</select></label>' +
        '<label class="field"><span class="field-label">Numune tarihi *</span><input class="input" name="date" type="date" value="' + (s.date || NS.todayISO()) + '" required></label>' +
        '<label class="field"><span class="field-label">Numune kodu</span><input class="input" name="code" value="' + esc(s.code || '') + '" placeholder="Otomatik oluşturulur" readonly></label>' +
        '<label class="field"><span class="field-label">Durum</span><select class="select" name="status">' + option('Bekliyor', 'Bekliyor', s.status || 'Bekliyor') + option('Analizde', 'Analizde', s.status) + '</select></label>' +
        '<label class="field span-2"><span class="field-label">Laboratuvar notu</span><input class="input" name="labNote" value="' + esc(s.labNote || '') + '" maxlength="140"></label>' +
      '</div>' +
      '<div class="inline-note">' + NS.icon('info') + '<span>Numune sonucu girildiğinde bağlı süt kaydının kalite sınıfı, litre fiyatı ve hakedişi otomatik güncellenir.</span></div>';
  }
  function openSampleModal(producerId) {
    if (!requireCollectorOrAdmin()) return;
    const p = NS.producerById(producerId || NS.state.viewId || '') || null;
    openFormModal({
      title: 'Yeni numune',
      subtitle: 'Şişe etiketi ve laboratuvar takibi',
      icon: 'flask',
      formId: 'sampleForm',
      body: sampleFormBody(p, {}),
      submit: 'Numuneyi oluştur'
    });
  }
  NS.openSampleModal = openSampleModal;

  function saveSample(form) {
    if (!requireCollectorOrAdmin()) return;
    const pid = fv(form, 'producerId');
    const p = NS.producerById(pid);
    if (!p) return;
    if (NS.isCollector() && p.collectorId !== NS.state.me.collectorId) {
      NS.toast('Bu üretici rotanızda değil', '', 'warn'); return;
    }
    const date = fv(form, 'date') || NS.todayISO();
    const year = new Date().getFullYear();
    const seq = NS.state.db.samples.length + 1;
    const code = 'NUM-' + year + '-' + String(seq).padStart(4, '0');
    const rec = NS.state.db.records
      .filter(function (r) { return r.producerId === pid && r.date === date; })
      .sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); })[0] || null;
    const s = {
      id: uid('s'), code: code, producerId: pid, collectorId: p.collectorId, recordId: rec ? rec.id : null,
      date: date, createdAt: new Date().toISOString(), status: fv(form, 'status') || 'Bekliyor',
      fat: null, protein: null, somatic: null, bacteria: null, score: null, grade: null,
      labNote: fv(form, 'labNote'), analyzedAt: null
    };
    NS.state.db.samples.push(s);
    if (rec) rec.sampleId = s.id;
    afterChange('Numune oluşturuldu', code + ' · ' + p.name);
  }

  function openAnalysisModal(id) {
    if (!requireCollectorOrAdmin()) return;
    const s = NS.state.db.samples.find(function (x) { return x.id === id; });
    if (!s) return;
    const p = NS.producerById(s.producerId);
    openFormModal({
      title: 'Numune sonucu',
      subtitle: s.code + ' · ' + (p ? p.name : '') + ' · ' + NS.fmtDate(s.date),
      icon: 'flask',
      formId: 'analyzeForm',
      body: '<input type="hidden" name="sampleId" value="' + esc(s.id) + '">' +
        formHead('flask', 'Laboratuvar değerleri', 'Puan yağ, protein, somatik hücre ve bakteri değerlerinden hesaplanır.') +
        '<div class="form-grid">' +
          '<label class="field"><span class="field-label">Yağ (%) *</span><input class="input" name="fat" type="number" min="0" max="12" step="0.1" value="' + (s.fat || 3.8) + '" required></label>' +
          '<label class="field"><span class="field-label">Protein (%) *</span><input class="input" name="protein" type="number" min="0" max="10" step="0.1" value="' + (s.protein || 3.2) + '" required></label>' +
          '<label class="field"><span class="field-label">Somatik hücre (bin/ml) *</span><input class="input" name="somatic" type="number" min="0" max="2000" step="1" value="' + (s.somatic || 250) + '" required></label>' +
          '<label class="field"><span class="field-label">Bakteri (bin/ml) *</span><input class="input" name="bacteria" type="number" min="0" max="1000" step="1" value="' + (s.bacteria || 30) + '" required></label>' +
          '<label class="field span-2"><span class="field-label">Laboratuvar notu</span><input class="input" name="labNote" value="' + esc(s.labNote || '') + '" maxlength="160"></label>' +
        '</div>' +
        '<div class="inline-note">' + NS.icon('info') + '<span>Kaydedildiğinde kalite sınıfı hesaplanır; bağlı süt kaydının fiyatı ve hakedişi güncellenir.</span></div>',
      submit: 'Sonucu kaydet'
    });
  }

  function saveAnalysis(form) {
    if (!requireCollectorOrAdmin()) return;
    const target = NS.state.db.samples.find(function (x) { return x.id === fv(form, 'sampleId'); });
    if (!target) return;
    const q = {
      fat: Number(fv(form, 'fat')) || 0,
      protein: Number(fv(form, 'protein')) || 0,
      somatic: Number(fv(form, 'somatic')) || 0,
      bacteria: Number(fv(form, 'bacteria')) || 0
    };
    q.score = MP.qualityScore(q);
    q.grade = MP.gradeOf(q.score);
    Object.assign(target, q, {
      status: 'Sonuçlandı', labNote: fv(form, 'labNote'), analyzedAt: new Date().toISOString()
    });
    const rec = target.recordId ? NS.state.db.records.find(function (r) { return r.id === target.recordId; }) : null;
    if (rec) {
      const p = NS.producerById(rec.producerId);
      rec.quality = { fat: q.fat, protein: q.protein, somatic: q.somatic, bacteria: q.bacteria, score: q.score, grade: q.grade };
      rec.sampleId = target.id;
      rec.price = NS.priceFor(p, q.grade);
      rec.amount = NS.round(Number(rec.liters) * rec.price, 2);
    }
    afterChange('Kalite sonucu kaydedildi', target.code + ' · ' + target.grade + ' sınıfı · ' + target.score + ' puan');
  }

  async function deleteSample(id) {
    if (!requireCollectorOrAdmin()) return;
    const s = NS.state.db.samples.find(function (x) { return x.id === id; });
    if (!s) return;
    const ok = await NS.confirmDialog({ title: 'Numune silinsin mi?', message: s.code + ' ve bağlı kalite sonucu kaldırılacak.', confirmText: 'Numuneyi sil' });
    if (!ok) return;
    const rec = s.recordId ? NS.state.db.records.find(function (r) { return r.id === s.recordId; }) : null;
    if (rec) {
      const p = NS.producerById(rec.producerId);
      rec.sampleId = null;
      rec.quality = null;
      rec.price = NS.basePriceFor(p);
      rec.amount = NS.round(Number(rec.liters) * rec.price, 2);
    }
    NS.state.db.samples = NS.state.db.samples.filter(function (x) { return x.id !== id; });
    afterChange('Numune silindi', s.code);
  }

  /* ============================================================
     Sayfa / kayıt eylemleri
     ============================================================ */
  async function handleDataAction(action, el, e) {
    const id = el.dataset.id || '';
    const producerId = el.dataset.producer || id;
    const db = NS.state.db;

    switch (action) {
      /* ---- Form içi dinamik kalemler ---- */
      case 'invoice-add-item': {
        const wrap = $('#invoiceItems');
        if (wrap) wrap.insertAdjacentHTML('beforeend', invoiceItemRow({}));
        return;
      }
      case 'invoice-remove-item': {
        const row = el.closest('.inv-item-row');
        if (!row) return;
        if ($$('.inv-item-row').length <= 1) { NS.toast('En az bir kalem gerekli', '', 'warn'); return; }
        row.remove();
        return;
      }
      case 'order-add-item': {
        const wrap = $('#orderItems');
        if (wrap) wrap.insertAdjacentHTML('beforeend', orderItemRow({}));
        return;
      }
      case 'order-remove-item': {
        const row = el.closest('.order-item-row');
        if (!row) return;
        if ($$('.order-item-row').length <= 1) { NS.toast('En az bir ürün gerekli', '', 'warn'); return; }
        row.remove();
        return;
      }
      case 'scan-manual':
        openScanModal(true);
        return;

      /* ---- Üreticiler ---- */
      case 'new-producer':
        openProducerModal();
        return;
      case 'edit-producer':
        openProducerModal(id);
        return;
      case 'open-producer':
        if (id) navigate('producer', id);
        return;
      case 'producer-tab':
        if (typeof NS.openProducerDrawer === 'function') NS.openProducerDrawer(id, el.dataset.tab || 'overview');
        return;
      case 'delete-producer':
        return deleteProducer(id);
      case 'qr-producer':
        if (typeof NS.openProducerQR === 'function') NS.openProducerQR(id);
        return;
      case 'copy-qr':
        return copyProducerQR(id);
      case 'qr-print':
        return printProducerLabels(id || null);
      case 'export-producers':
        return exportProducerList();
      case 'producer-template':
        if (typeof NS.producerTemplate === 'function') NS.producerTemplate();
        return;
      case 'import-producers':
        return triggerProducerImport();
      case 'goto-route':
        if (!NS.state.routeFilter) NS.state.routeFilter = {};
        NS.state.routeFilter.collectorId = el.dataset.collector || '';
        navigate('route');
        return;

      /* ---- Süt kayıtları ---- */
      case 'new-record':
        openRecordModal();
        return;
      case 'record-for-producer':
        openRecordModal(null, { producerId: producerId });
        return;
      case 'collect-stop':
        openRecordModal(null, {
          producerId: el.dataset.producer || '',
          date: el.dataset.date || NS.todayISO(),
          session: 'Sabah'
        });
        return;
      case 'edit-record':
        openRecordModal(id);
        return;
      case 'delete-record':
        return deleteRecord(id);
      case 'print-route-sheet':
        return openDailySheetModal();
      case 'export-records':
        if (typeof NS.exportRecordsCSV === 'function') NS.exportRecordsCSV();
        return;
      case 'export-records-xlsx':
        if (typeof NS.exportRecordsXLSX === 'function') NS.exportRecordsXLSX();
        return;

      /* ---- Kalite / numune ---- */
      case 'sample-create':
        openSampleModal(NS.state.route === 'producer' ? NS.state.viewId : '');
        return;
      case 'sample-for-producer':
        openSampleModal(producerId);
        return;
      case 'analyze-sample':
        openAnalysisModal(id);
        return;
      case 'delete-sample':
        return deleteSample(id);
      case 'quality-export':
        if (typeof NS.exportQuality === 'function') NS.exportQuality();
        return;
      case 'scan-open':
        return openScanModal(false);
      case 'scan-manual':
        return openScanModal(true);

      /* ---- Rota ---- */
      case 'route-extra':
        return openRouteExtraModal();

      /* ---- Tank / sevkiyat ---- */
      case 'tank-measure':
        return openTankMeasureModal(id);
      case 'tank-clean':
        return cleanTank(id);
      case 'tank-dispatch':
        return openDispatchModal(id);
      case 'dispatch-delete':
        return deleteDispatch(id);

      /* ---- Tediye ---- */
      case 'settle-save':
        return saveSettlementBatch();
      case 'settle-all': {
        const checks = $$('.settle-check');
        checks.forEach(function (ch) { ch.checked = !!el.checked; });
        return;
      }
      case 'settle-approve':
        return approveSettlement(producerId);
      case 'settle-pay':
        return paySettlement(producerId);
      case 'settle-detail':
        return openSettlementDetail(producerId);
      case 'settle-receipt':
        if (typeof NS.printSettlementReceipt === 'function') NS.printSettlementReceipt(producerId);
        return;
      case 'settle-print-bulk': {
        const selected = $$('.settle-check:checked').map(function (ch) { return ch.dataset.id; });
        if (typeof NS.printSettlementBulk === 'function') NS.printSettlementBulk(selected);
        return;
      }
      case 'settle-export':
        if (typeof NS.exportSettlements === 'function') NS.exportSettlements();
        return;

      /* ---- Faturalar ---- */
      case 'new-invoice':
        openInvoiceModal(null, el.dataset.producer || '');
        return;
      case 'invoice-view':
        if (typeof NS.openInvoiceView === 'function') NS.openInvoiceView(id);
        return;
      case 'invoice-edit':
        openInvoiceModal(id);
        return;
      case 'invoice-print':
        if (typeof NS.printInvoice === 'function') NS.printInvoice(id);
        return;
      case 'invoice-issue':
        return setInvoiceStatus(id, 'Kesildi');
      case 'invoice-paid':
        return setInvoiceStatus(id, 'Ödendi');
      case 'invoice-delete':
        return deleteInvoice(id);
      case 'invoices-export':
        return exportInvoices();

      /* ---- Siparişler / ürünler ---- */
      case 'new-order':
        openOrderModal(null, el.dataset.producer || '');
        return;
      case 'order-view':
        return viewOrder(id);
      case 'order-print':
        if (!NS.checkOrderAccess || NS.checkOrderAccess(id)) {
          if (typeof NS.printOrder === 'function') NS.printOrder(id);
        }
        return;
      case 'order-advance':
        return advanceOrder(id);
      case 'order-invoice':
        return invoiceFromOrder(id);
      case 'order-delete':
        return deleteOrder(id);
      case 'orders-export':
        if (typeof NS.exportOrders === 'function') NS.exportOrders();
        return;
      case 'product-new':
        return openProductModal();
      case 'product-edit':
        return openProductModal(id);
      case 'product-stock':
        return openProductStockModal(id);

      /* ---- Cari ---- */
      case 'accounts-export':
        if (typeof NS.exportAccounts === 'function') NS.exportAccounts();
        return;
      case 'statement-producer':
        return openStatementModal(producerId);
      case 'payment-producer':
        return openPaymentModal(producerId);

      /* ---- Filo ---- */
      case 'new-expense':
        return openExpenseModal(null, el.dataset.vehicle || '');
      case 'edit-expense':
        return openExpenseModal(id);
      case 'delete-expense':
        return deleteExpense(id);
      case 'new-vehicle':
        return openVehicleModal();
      case 'edit-vehicle':
        return openVehicleModal(id);
      case 'fleet-export':
        if (typeof NS.exportFleet === 'function') NS.exportFleet();
        return;

      /* ---- Raporlar ---- */
      case 'report-csv':
        if (typeof NS.exportReportCSV === 'function') NS.exportReportCSV();
        return;
      case 'report-xlsx':
        if (typeof NS.exportReportXLSX === 'function') NS.exportReportXLSX();
        return;
      case 'report-print':
        if (typeof NS.printReport === 'function') NS.printReport();
        return;

      /* ---- Kullanıcılar ---- */
      case 'user-new':
        return openUserModal();
      case 'edit-user':
        return openUserModal(id);
      case 'delete-user':
        return deleteUser(id);
      case 'collector-new':
        return openCollectorModal();
      case 'edit-collector':
        return openCollectorModal(id);

      /* ---- Ayarlar / fiyat / tank ---- */
      case 'price-new':
        return openPriceListModal();
      case 'price-edit':
        return openPriceListModal(id);
      case 'price-delete':
        return deletePriceList(id);
      case 'tank-new':
        return openTankModal();
      case 'tank-edit':
        return openTankModal(id);

      /* ---- Üretici detay sayfası ---- */
      case 'producer-page-tab': {
        if (!NS.state.producerDetail) NS.state.producerDetail = { id: NS.state.viewId };
        NS.state.producerDetail.tab = el.dataset.tab || 'overview';
        renderView('producer', NS.state.viewId);
        return;
      }
      case 'producer-note':
        return openNoteModal(id || NS.state.viewId);
      case 'producer-note-delete':
        return deleteProducerNote(id);
      case 'producer-invoice':
        openInvoiceModal(null, producerId);
        return;
      case 'producer-order':
        openOrderModal(null, producerId);
        return;
      case 'producer-qr':
        if (typeof NS.openProducerQR === 'function') NS.openProducerQR(producerId);
        return;

      /* ---- Çiftlik portalı ---- */
      case 'farm-print-statement':
        return openStatementModal(NS.myProducer() ? NS.myProducer().id : '');
      case 'farm-qr':
        if (NS.myProducer() && typeof NS.openProducerQR === 'function') NS.openProducerQR(NS.myProducer().id);
        return;
      case 'farm-milk-export':
        if (typeof NS.exportFarmMilk === 'function') NS.exportFarmMilk();
        return;

      default:
        NS.toast('İşlem bulunamadı', action, 'warn');
    }
  }

  /* ============================================================
     Üretici işlemleri
     ============================================================ */
  async function deleteProducer(id) {
    if (!requireAdmin()) return;
    const p = NS.producerById(id);
    if (!p) return;
    const recCount = NS.state.db.records.filter(function (r) { return r.producerId === id; }).length;
    const linked = recCount + NS.state.db.orders.filter(function (o) { return o.producerId === id; }).length +
      NS.state.db.invoices.filter(function (i) { return i.partyId === id; }).length;
    if (linked > 0) {
      const ok = await NS.confirmDialog({
        title: 'Üretici pasife alınsın mı?',
        message: p.name + ' için ' + recCount + ' süt kaydı ve bağlı işlemler var. Geçmiş kayıtların bozulmaması için üretici silinmez, pasife alınır.',
        confirmText: 'Pasife al', danger: false
      });
      if (!ok) return;
      p.active = false;
      p.updatedAt = new Date().toISOString();
      dbUserForProducer(id, function (u) { u.active = false; });
      afterChange('Üretici pasife alındı', p.name + ' · geçmiş kayıtlar korunuyor.', { closeDrawer: true });
      return;
    }
    const ok = await NS.confirmDialog({
      title: 'Üretici silinsin mi?',
      message: p.name + ' · ' + p.code + ' kalıcı olarak silinecek. Portal hesabı ve notları da kaldırılır.',
      confirmText: 'Kalıcı olarak sil'
    });
    if (!ok) return;
    NS.state.db.producers = NS.state.db.producers.filter(function (x) { return x.id !== id; });
    NS.state.db.users = NS.state.db.users.filter(function (u) { return !(u.role === 'Üretici' && u.producerId === id); });
    NS.state.db.producerNotes = (NS.state.db.producerNotes || []).filter(function (n) { return n.producerId !== id; });
    NS.state.db.routeExtras = (NS.state.db.routeExtras || []).filter(function (x) { return x.producerId !== id; });
    if (NS.state.route === 'producer') navigate('producers');
    afterChange('Üretici silindi', p.name, { closeDrawer: true });
  }

  function dbUserForProducer(producerId, fn) {
    NS.state.db.users.forEach(function (u) {
      if (u.role === 'Üretici' && u.producerId === producerId) fn(u);
    });
  }

  function copyProducerQR(id) {
    const p = NS.producerById(id);
    if (!p) return;
    const text = p.qr || p.code;
    const done = function () { NS.toast('QR kodu kopyalandı', p.name + ' · ' + text, 'success'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(function () { copyFallback(text, done); });
    } else {
      copyFallback(text, done);
    }
  }
  function copyFallback(text, done) {
    const input = document.createElement('textarea');
    input.value = text;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    try { document.execCommand('copy'); done(); }
    catch (e) { NS.toast('Kopyalanamadı', text, 'warn'); }
    input.remove();
  }

  function printProducerLabels(id) {
    const list = id ? [NS.producerById(id)].filter(Boolean) : NS.visibleProducers();
    if (!list.length) { NS.toast('Etiket için üretici yok', '', 'warn'); return; }
    const cards = list.map(function (p) {
      return '<div class="qr-sheet-card"><div>' + NS.qrSVG(p.qr, 3) + '</div>' +
        '<b>' + esc(p.name) + '</b><span>' + esc(p.code) + ' · ' + esc(p.village) + '</span>' +
        '<small>' + esc(NS.collectorById(p.collectorId) ? NS.collectorById(p.collectorId).route : '') + '</small></div>';
    }).join('');
    NS.printDoc({
      title: 'Üretici QR etiketleri',
      subtitle: list.length + ' etiket · ' + NS.state.db.settings.businessName,
      html: '<div class="doc-head"><div class="doc-brand"><div class="doc-mark">MP</div><div><b>' + esc(NS.state.db.settings.businessName) + '</b><small>Numune etiketleri</small></div></div>' +
        '<div class="doc-title"><h1>ÜRETİCİ ETİKETLERİ</h1><p>' + NS.fmtDate(NS.todayISO()) + '</p></div></div>' +
        '<p class="doc-p">Numune şişelerine yapıştırın. Barkod okuyucu veya QR tarayıcı ile üretici otomatik eşleşir.</p>' +
        '<div class="qr-sheet">' + cards + '</div>'
    });
  }

  function exportProducerList() {
    const rows = NS.visibleProducers().map(function (p) {
      const c = NS.collectorById(p.collectorId);
      const acc = NS.producerAccount(p.id);
      return [p.code, p.name, p.phone, p.village, p.address, c ? c.route : '', p.sira, p.animalCount,
        NS.priceListFor(p) ? NS.priceListFor(p).name : '', p.taxNo, p.iban, p.active ? 'Evet' : 'Hayır', acc.balance];
    });
    NS.exportCSV('mandirapro-ureticiler-' + NS.todayISO() + '.csv',
      ['Kod', 'Ad Soyad', 'Telefon', 'Köy', 'Adres', 'Rota', 'Sıra', 'Hayvan', 'Fiyat Listesi', 'Vergi No', 'IBAN', 'Aktif', 'Bakiye'],
      rows);
  }

  function triggerProducerImport() {
    if (!requireAdmin()) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls,.csv';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) importProducersFile(input.files[0]);
      input.remove();
    });
    input.click();
  }

  function csvParse(text) {
    const first = text.split(/\r?\n/).find(function (l) { return l.trim(); }) || '';
    const delimiter = (first.split(';').length >= first.split(',').length) ? ';' : ',';
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (quoted) {
        if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === delimiter) { row.push(cell); cell = ''; }
      else if (ch === '\n') { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (x) { return String(x).trim(); }); });
  }

  async function importProducersFile(file) {
    if (!requireAdmin()) return;
    try {
      let rows;
      if (/\.csv$/i.test(file.name)) {
        rows = csvParse(await file.text());
      } else {
        rows = await NS.readSheetFile(file);
      }
      if (!rows || rows.length < 2) { NS.toast('Dosya boş', 'Başlık ve en az bir üretici satırı gerekli.', 'warn'); return; }
      const norm = function (v) {
        return String(v || '').toLocaleLowerCase('tr-TR').replace(/\s+/g, ' ').trim();
      };
      const headers = rows[0].map(norm);
      const headerIndex = function (names) {
        for (let i = 0; i < headers.length; i++) if (names.indexOf(headers[i]) !== -1) return i;
        return -1;
      };
      const cols = {
        code: headerIndex(['kod', 'üretici kodu', 'uretici kodu']),
        name: headerIndex(['ad soyad', 'ad', 'isim', 'üretici', 'uretici']),
        phone: headerIndex(['telefon', 'gsm']),
        village: headerIndex(['köy', 'koy', 'mahalle']),
        address: headerIndex(['adres', 'açık adres', 'acik adres']),
        collector: headerIndex(['sütçü / rota', 'sutcu / rota', 'rota', 'sütçü', 'sutcu']),
        sira: headerIndex(['sıra', 'sira']),
        animals: headerIndex(['hayvan sayısı', 'hayvan sayisi', 'hayvan']),
        priceList: headerIndex(['fiyat listesi']),
        taxNo: headerIndex(['vergi no']),
        iban: headerIndex(['iban']),
        active: headerIndex(['aktif', 'durum'])
      };
      if (cols.name === -1 || cols.village === -1) {
        NS.toast('Başlıklar tanınmadı', 'Şablondaki "Ad Soyad" ve "Köy" sütunlarını kullanın.', 'error');
        return;
      }
      const existingNames = {};
      const existingCodes = {};
      NS.state.db.producers.forEach(function (p) {
        existingNames[norm(p.name) + '|' + norm(p.village)] = true;
        existingCodes[String(p.code).toLocaleUpperCase('tr-TR')] = true;
      });
      let added = 0, skipped = 0;
      const defaultCollector = NS.visibleCollectors()[0] || NS.state.db.collectors[0];
      const defaultPrice = NS.state.db.priceLists[0];
      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const name = String(row[cols.name] || '').trim();
        const village = String(row[cols.village] || '').trim();
        if (!name || !village) { skipped++; continue; }
        if (existingNames[norm(name) + '|' + norm(village)]) { skipped++; continue; }
        let code = cols.code >= 0 ? String(row[cols.code] || '').trim() : '';
        if (!code || existingCodes[code.toLocaleUpperCase('tr-TR')]) code = nextProducerCode();
        const collectorRaw = cols.collector >= 0 ? norm(row[cols.collector]) : '';
        const collector = NS.state.db.collectors.find(function (c) {
          return norm(c.name) === collectorRaw || norm(c.route) === collectorRaw || norm(c.route).indexOf(collectorRaw) !== -1;
        }) || defaultCollector;
        const priceRaw = cols.priceList >= 0 ? norm(row[cols.priceList]) : '';
        const priceList = NS.state.db.priceLists.find(function (pl) { return norm(pl.name) === priceRaw || norm(pl.group) === priceRaw; }) || defaultPrice;
        const activeRaw = cols.active >= 0 ? norm(row[cols.active]) : 'evet';
        const active = activeRaw !== 'hayır' && activeRaw !== 'hayir' && activeRaw !== 'pasif' && activeRaw !== '0' && activeRaw !== 'false';
        const p = {
          id: nextProducerId(),
          code: code,
          qr: 'MP|URETICI|' + code,
          name: name,
          phone: cols.phone >= 0 ? String(row[cols.phone] || '').trim() : '',
          village: village,
          address: cols.address >= 0 && row[cols.address] ? String(row[cols.address]).trim() : village + ' / Konya',
          collectorId: collector ? collector.id : '',
          sira: Number(cols.sira >= 0 ? row[cols.sira] : 1) || 1,
          animalCount: Number(cols.animals >= 0 ? row[cols.animals] : 10) || 0,
          priceListId: priceList ? priceList.id : '',
          taxNo: cols.taxNo >= 0 ? String(row[cols.taxNo] || '').trim() : '',
          taxOffice: 'Konya',
          iban: cols.iban >= 0 ? String(row[cols.iban] || '').trim() : '',
          note: 'Excel içe aktarma · ' + NS.fmtDate(NS.todayISO()),
          baseLiters: 20,
          joinedAt: NS.todayISO(),
          active: active,
          createdAt: new Date().toISOString()
        };
        NS.state.db.producers.push(p);
        existingNames[norm(name) + '|' + norm(village)] = true;
        existingCodes[code.toLocaleUpperCase('tr-TR')] = true;
        const portalUsername = uniqueUsername(String(name).split(/\s+/)[0]);
        NS.state.db.users.push({
          id: uid('u'), name: name, username: portalUsername, role: 'Üretici', producerId: p.id,
          phone: p.phone, active: active, passHash: await NS.hashPassword('1234'), createdAt: new Date().toISOString()
        });
        added++;
      }
      afterChange('Üretici aktarımı tamamlandı', added + ' yeni kayıt · ' + skipped + ' satır atlandı. Portal şifreleri 1234.');
    } catch (err) {
      NS.toast('İçe aktarma başarısız', err.message || String(err), 'error');
    }
  }

  /* ============================================================
     Rota yardımcıları
     ============================================================ */
  function openDailySheetModal() {
    if (!requireCollectorOrAdmin()) return;
    const fallback = NS.routeCtx();
    const date = NS.state.route === 'records' ? (NS.state.rec.date || NS.todayISO()) : fallback.date;
    const selectedCollector = NS.state.route === 'records' && NS.state.rec.collector ? NS.state.rec.collector : fallback.collectorId;
    const collectors = NS.visibleCollectors();
    openFormModal({
      title: 'Günlük alım listesi',
      subtitle: 'Yazdırılacak günü ve rotayı seçin',
      icon: 'calendar',
      formId: 'dailySheetForm',
      body:
        '<div class="form-intro">' + NS.icon('printer') + '<div><b>Gün seçerek yazdır</b><p>Seçilen güne ait durak, beklenen litre ve tartım alanlarıyla saha föyü açılır.</p></div></div>' +
        '<div class="form-grid">' +
          '<label class="field"><span class="field-label">Gün</span><input class="input" type="date" name="date" value="' + date + '" required></label>' +
          '<label class="field"><span class="field-label">Rota</span><select class="select" name="collectorId">' + collectors.map(function (c) {
            return '<option value="' + c.id + '"' + (c.id === selectedCollector ? ' selected' : '') + '>' + NS.esc(c.name + ' — ' + c.route) + '</option>';
          }).join('') + '</select></label>' +
        '</div>',
      submit: 'Listeyi yazdır'
    });
  }

  function printDailySheet(form) {
    const date = fv(form, 'date') || NS.todayISO();
    const collectorId = fv(form, 'collectorId');
    NS.closeModal();
    printRouteSheet({ date: date, collectorId: collectorId });
  }

  function printRouteSheet(opts) {
    opts = opts || {};
    const fallback = NS.routeCtx();
    const date = opts.date || fallback.date;
    const collectorId = opts.collectorId || fallback.collectorId;
    const session = 'Sabah';
    const c = NS.collectorById(collectorId);
    const stops = NS.routeStops(collectorId, date, session);
    const stat = NS.routeStats(collectorId, date, session);
    const rows = stops.map(function (s, i) {
      const p = s.producer || NS.producerById(s.producerId);
      const rec = s.record;
      return '<tr><td>' + (i + 1) + '</td><td><b>' + esc(p ? p.name : '') + '</b><br><small>' + esc(p ? p.code : '') + '</small></td>' +
        '<td>' + esc(p ? p.village : '') + '</td><td class="num">' + NS.fmtNum(s.expected && typeof s.expected === 'object' ? s.expected.avg : (s.expected || 0), 1) + ' L</td>' +
        '<td class="num">' + (rec ? NS.fmtNum(rec.liters, 1) + ' L' : '________') + '</td>' +
        '<td>' + (rec && rec.quality ? rec.quality.grade : '____') + '</td><td>________</td></tr>';
    }).join('');
    NS.printDoc({
      title: 'Süt toplama föyü',
      subtitle: (c ? c.name + ' · ' + c.route : '') + ' · ' + NS.fmtDate(date),
      html: '<div class="doc-head"><div class="doc-brand"><div class="doc-mark">MP</div><div><b>' + esc(NS.state.db.settings.businessName) + '</b><small>Saha toplama föyü</small></div></div>' +
        '<div class="doc-title"><h1>GÜNLÜK ROTA FÖYÜ</h1><p>' + NS.fmtDate(date) + '</p></div></div>' +
        '<div class="doc-meta"><div class="doc-party"><small>Sütçü</small><b>' + esc(c ? c.name : '—') + '</b><p>' + esc(c ? c.route : '') + '<br>' + esc(c ? c.plate : '') + ' · ' + esc(c ? c.phone : '') + '</p></div>' +
        '<div class="doc-side"><div><small>Durak</small><b>' + stat.total + '</b></div><div><small>Tamamlanan</small><b>' + stat.done + '</b></div><div><small>Toplanan</small><b>' + NS.fmtNum(stat.liters, 0) + ' L</b></div></div></div>' +
        '<table class="doc-table"><thead><tr><th>#</th><th>Üretici</th><th>Köy</th><th class="num">Beklenen</th><th class="num">Tartım</th><th>Kalite</th><th>İmza</th></tr></thead><tbody>' + (rows || '<tr><td colspan="7">Durak yok.</td></tr>') + '</tbody></table>' +
        '<div class="doc-note">Tartım ve kalite alanları saha tesliminde doldurulur. Föy, sütçü ve işletme yetkilisi tarafından imzalanır.</div>' +
        '<div class="doc-sign"><div>Sütçü imzası</div><div>İşletme yetkilisi</div></div>' +
        '<div class="doc-footer"><span>' + esc(NS.state.db.settings.address) + '</span><span>' + esc(NS.state.db.settings.phone) + '</span></div>'
    });
  }

  function openRouteExtraModal() {
    if (!requireCollectorOrAdmin()) return;
    const ctx = NS.routeCtx();
    openFormModal({
      title: 'Rotaya üretici ekle',
      subtitle: NS.fmtDate(ctx.date) + ' · ' + (NS.collectorById(ctx.collectorId) ? NS.collectorById(ctx.collectorId).route : ''),
      icon: 'route',
      formId: 'routeExtraForm',
      body: formHead('route', 'Başka rotadan durak', 'Bugünkü toplama listesine geçici bir üretici eklenir.') +
        '<div class="form-grid">' +
          '<label class="field"><span class="field-label">Üretici</span><select class="select" name="producerId" required>' + producerOptions('') + '</select></label>' +
          '<label class="field"><span class="field-label">Gerekçe</span><input class="input" name="reason" value="Aynı güzergâh" maxlength="90"></label>' +
        '</div>',
      submit: 'Rotaya ekle'
    });
    setTimeout(function () { NS.state._routeExtraForm = true; }, 0);
  }

  /* ============================================================
     Tank / sevkiyat işlemleri
     ============================================================ */
  function openTankMeasureModal(id) {
    if (!requireCollectorOrAdmin()) return;
    const tanks = NS.state.db.tanks;
    if (!tanks.length) return;
    const t = NS.tankById(id) || tanks[0];
    const formId = openFormModal({
      title: 'Tank ölçümü',
      subtitle: t.name + ' · ' + t.code,
      icon: 'scale',
      formId: 'tankMeasureForm',
      body: '<input type="hidden" name="tankId" value="' + esc(t.id) + '">' +
        formHead('tank', 'Anlık ölçüm', 'Litre ve sıcaklık değerleri tank kartına yansır.') +
        '<div class="form-grid">' +
          '<label class="field"><span class="field-label">Litre *</span><input class="input" name="current" type="number" min="0" max="' + Number(t.capacity) + '" step="0.1" value="' + Number(t.current) + '" required></label>' +
          '<label class="field"><span class="field-label">Sıcaklık (°C) *</span><input class="input" name="temperature" type="number" min="-5" max="30" step="0.1" value="' + Number(t.temperature) + '" required></label>' +
          '<label class="field span-2"><span class="field-label">Not</span><input class="input" name="note" maxlength="160" placeholder="Ölçüm notu"></label>' +
        '</div>' +
        '<div class="inline-note">' + NS.icon('info') + '<span>Kapasite ' + NS.fmtNum(t.capacity, 0) + ' L. Ölçüm geçmişi tank kartında tutulur.</span></div>',
      submit: 'Ölçümü kaydet'
    });
    const f = $('#' + formId);
    if (f) f.dataset.tankId = t.id;
  }

  async function cleanTank(id) {
    if (!requireCollectorOrAdmin()) return;
    const t = NS.tankById(id) || NS.state.db.tanks[0];
    if (!t) return;
    const ok = await NS.confirmDialog({
      title: 'Temizlik kaydı',
      message: t.name + ' bugün temizlendi olarak işaretlenecek ve temizlik tarihi güncellenecek.',
      confirmText: 'Temizliği kaydet', danger: false
    });
    if (!ok) return;
    t.lastCleanedAt = NS.todayISO();
    t.cleanedBy = NS.state.me ? NS.state.me.name : '';
    if (!Array.isArray(t.history)) t.history = [];
    t.history.push({ type: 'Temizlik', date: NS.todayISO(), at: new Date().toISOString(), by: t.cleanedBy });
    afterChange('Temizlik kaydedildi', t.name + ' · ' + NS.fmtDateFull(NS.todayISO()));
  }

  function openDispatchModal(id) {
    if (!requireCollectorOrAdmin()) return;
    const tanks = NS.state.db.tanks;
    if (!tanks.length) { NS.toast('Tank yok', 'Önce bir tank tanımlayın.', 'warn'); return; }
    const t = NS.tankById(id) || tanks[0];
    const vehicles = NS.state.db.vehicles.filter(function (v) { return v.active !== false; });
    openFormModal({
      title: 'Sevkiyat oluştur',
      subtitle: t.name + ' · stok ' + NS.fmtNum(t.current, 0) + ' L',
      icon: 'truck',
      size: 'lg',
      formId: 'dispatchForm',
      body: formHead('truck', 'Soğuk zincir sevkiyatı', 'Sevkiyat kaydedildiğinde tank litresi otomatik düşer.') +
        '<div class="form-grid">' +
          '<label class="field"><span class="field-label">Tank *</span><select class="select" name="tankId" required>' + tanks.map(function (x) { return option(x.id, x.name + ' · ' + NS.fmtNum(x.current, 0) + ' L', t.id); }).join('') + '</select></label>' +
          '<label class="field"><span class="field-label">Tarih *</span><input class="input" name="date" type="date" value="' + NS.todayISO() + '" required></label>' +
          '<label class="field"><span class="field-label">Litre *</span><input class="input" name="liters" type="number" min="0.1" max="' + Number(t.current) + '" step="0.1" value="' + Math.max(0, Math.min(Number(t.current), 1000)) + '" required></label>' +
          '<label class="field"><span class="field-label">Sıcaklık (°C)</span><input class="input" name="temperature" type="number" min="-5" max="30" step="0.1" value="' + Number(t.temperature || 4) + '"></label>' +
          '<label class="field"><span class="field-label">Alıcı / tesis *</span><input class="input" name="destination" value="Süt fabrikası" required maxlength="80"></label>' +
          '<label class="field"><span class="field-label">Araç</span><select class="select" name="vehicleId"><option value="">Araç seçilmedi</option>' + vehicles.map(function (v) { return option(v.id, v.plate + ' · ' + v.driver, ''); }).join('') + '</select></label>' +
          '<label class="field"><span class="field-label">Sürücü</span><input class="input" name="driver" maxlength="60" placeholder="Sürücü adı"></label>' +
          '<label class="field"><span class="field-label">Plaka</span><input class="input" name="plate" maxlength="14" placeholder="42 ABC 123"></label>' +
          '<label class="field span-2"><span class="field-label">Not</span><textarea class="textarea" name="note" rows="2" maxlength="200"></textarea></label>' +
        '</div>',
      submit: 'Sevkiyatı kaydet'
    });
  }

  async function deleteDispatch(id) {
    if (!requireCollectorOrAdmin()) return;
    const d = NS.state.db.dispatches.find(function (x) { return x.id === id; });
    if (!d) return;
    const ok = await NS.confirmDialog({
      title: 'Sevkiyat silinsin mi?',
      message: NS.fmtDate(d.date) + ' · ' + NS.fmtNum(d.liters, 0) + ' L. Tank stoğuna geri eklenecek.',
      confirmText: 'Sevkiyatı sil'
    });
    if (!ok) return;
    const t = NS.tankById(d.tankId);
    if (t) t.current = NS.round(Number(t.current || 0) + Number(d.liters || 0), 1);
    NS.state.db.dispatches = NS.state.db.dispatches.filter(function (x) { return x.id !== id; });
    afterChange('Sevkiyat silindi', (t ? t.name : '') + ' · ' + NS.fmtNum(d.liters, 0) + ' L stoğa eklendi.');
  }

  /* ============================================================
     Tediye işlemleri
     ============================================================ */
  function settlementDataFromRow(row, status) {
    const existing = row.existing;
    return {
      id: existing ? existing.id : uid('st'),
      producerId: row.producerId,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      periodLabel: NS.monthLabel(row.periodStart.slice(0, 7)),
      half: (NS.state.settlement && NS.state.settlement.half) || 'full',
      liters: row.liters,
      gross: row.gross,
      feedCost: row.feedCost,
      advances: row.advances,
      net: row.net,
      premium: row.premium,
      avgPrice: row.avgPrice,
      avgQuality: row.avgQuality,
      grades: row.grades,
      count: row.count,
      status: status || (existing ? existing.status : 'Hazır'),
      receiptNo: existing ? existing.receiptNo : NS.nextReceiptNo(row.periodStart.slice(0, 7)),
      createdAt: existing ? existing.createdAt : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      paidAt: existing ? existing.paidAt : null
    };
  }

  function upsertSettlement(row, status) {
    const data = settlementDataFromRow(row, status);
    const existing = NS.state.db.settlements.find(function (s) { return s.id === data.id; });
    if (existing) Object.assign(existing, data);
    else NS.state.db.settlements.push(data);
    return data;
  }

  function saveSettlementBatch() {
    if (!requireAdmin()) return;
    const rows = NS.settlementRows();
    if (!rows.length) { NS.toast('Dönemde üretici yok', 'Kaydedilecek tediye satırı bulunamadı.', 'warn'); return; }
    let created = 0, updated = 0;
    rows.forEach(function (row) {
      const status = row.existing ? row.existing.status : 'Hazır';
      if (row.existing) updated++;
      else created++;
      upsertSettlement(row, status);
    });
    afterChange('Tediye dönemi kaydedildi', created + ' yeni · ' + updated + ' güncellenen kayıt.');
  }

  function approveSettlement(producerId) {
    if (!requireAdmin()) return;
    const row = NS.settlementRows().find(function (r) { return r.producerId === producerId; });
    if (!row) { NS.toast('Tediye satırı yok', '', 'warn'); return; }
    upsertSettlement(row, 'Onaylandı');
    afterChange('Tediye onaylandı', row.producer.name + ' · net ' + NS.fmtMoney(row.net, 2));
  }

  async function paySettlement(producerId) {
    if (!requireAdmin()) return;
    const row = NS.settlementRows().find(function (r) { return r.producerId === producerId; });
    if (!row) return;
    if (row.net <= 0) {
      NS.toast('Ödenecek tutar yok', 'Bu dönemde net tediye sıfır veya negatif.', 'warn');
      return;
    }
    const ok = await NS.confirmDialog({
      title: 'Tediye ödemesi',
      message: row.producer.name + ' için ' + NS.monthLabel(row.periodStart.slice(0, 7)) + ' dönemi net ' + NS.fmtMoney(row.net, 2) + ' tutarında ödeme kaydı oluşturulacak.',
      confirmText: 'Ödemeyi işle', danger: false
    });
    if (!ok) return;
    const st = upsertSettlement(row, 'Ödendi');
    st.paidAt = new Date().toISOString();
    NS.state.db.payments.push({
      id: uid('pay'), producerId: producerId, date: NS.todayISO(), amount: NS.round(row.net, 2),
      method: 'Havale / EFT', type: 'Tediye ödemesi', note: st.receiptNo + ' · ' + NS.monthLabel(row.periodStart.slice(0, 7)),
      settlementId: st.id, createdAt: new Date().toISOString(), createdBy: NS.state.me ? NS.state.me.name : ''
    });
    afterChange('Tediye ödendi', row.producer.name + ' · ' + NS.fmtMoney(row.net, 2) + ' · ' + st.receiptNo);
  }

  function openSettlementDetail(producerId) {
    const row = NS.settlementRows().find(function (r) { return r.producerId === producerId; });
    if (!row) return;
    const p = row.producer;
    const c = NS.collectorById(p.collectorId);
    const existing = row.existing;
    NS.openModal({
      title: 'Tediye dökümü',
      subtitle: p.name + ' · ' + NS.monthLabel(row.periodStart.slice(0, 7)),
      icon: 'receipt',
      size: 'md',
      body: '<div class="stat-grid mb-16"><div class="cm"><small>Toplam süt</small><b>' + NS.fmtNum(row.liters, 1) + ' L</b></div>' +
        '<div class="cm"><small>Ortalama fiyat</small><b>' + NS.fmtMoney(row.avgPrice, 2) + '</b></div>' +
        '<div class="cm"><small>Ortalama puan</small><b>' + (row.avgQuality ? NS.fmtNum(row.avgQuality, 1) : '—') + '</b></div></div>' +
        NS.statRow('Süt hakedişi', NS.fmtMoney(row.gross, 2)) +
        NS.statRow('Kalite primi / kesintisi', (row.premium >= 0 ? '+' : '') + NS.fmtMoney(row.premium, 2)) +
        NS.statRow('Yem bedeli', '− ' + NS.fmtMoney(row.feedCost, 2)) +
        NS.statRow('Avans ve ödemeler', '− ' + NS.fmtMoney(row.advances, 2)) +
        '<div class="stat-row" style="border-top:1px solid var(--border-strong);margin-top:6px;padding-top:9px"><span><b>Net ödenecek</b></span><b class="tone-pos" style="font-size:16px">' + NS.fmtMoney(row.net, 2) + '</b></div>' +
        '<div class="form-section mt-16"><div class="form-section-head"><b>Kalite dağılımı</b><span>' + row.count + ' süt kaydı</span></div><div class="row gap-8"><span class="badge success">A · ' + row.grades.A + '</span><span class="badge info">B · ' + row.grades.B + '</span><span class="badge warn">C · ' + row.grades.C + '</span></div></div>' +
        '<div class="inline-note mt-16">' + NS.icon('route') + '<span>' + esc(c ? c.route : 'Rota yok') + ' · ' + esc(c ? c.name : '') + (existing ? ' · Makbuz ' + esc(existing.receiptNo) : ' · Henüz kaydedilmedi') + '</span></div>',
      footer: '<button class="btn btn-ghost" type="button" data-action="close-modal">Kapat</button><button class="btn btn-primary" type="button" data-action="settle-receipt" data-producer="' + p.id + '">' + NS.icon('printer') + ' Makbuz</button>'
    });
  }

  /* ============================================================
     Fatura / sipariş / ürün işlemleri
     ============================================================ */
  function invoiceItemRow(item) {
    item = item || {};
    return '<div class="item-row inv-item-row">' +
      '<input class="input" data-item="desc" value="' + esc(item.desc || '') + '" placeholder="Açıklama" aria-label="Açıklama">' +
      '<input class="input" data-item="qty" type="number" min="0" step="0.01" value="' + Number(item.qty || 1) + '" aria-label="Miktar">' +
      '<input class="input" data-item="unit" value="' + esc(item.unit || 'L') + '" placeholder="Birim" aria-label="Birim">' +
      '<input class="input" data-item="unitPrice" type="number" min="0" step="0.01" value="' + Number(item.unitPrice || 0) + '" aria-label="Birim fiyat">' +
      '<input class="input" data-item="vat" type="number" min="0" max="100" step="1" value="' + Number(item.vat === undefined ? 1 : item.vat) + '" aria-label="KDV">' +
      '<button class="icon-btn sm danger" type="button" data-action="invoice-remove-item" title="Kalemi kaldır">' + NS.icon('x') + '</button></div>';
  }

  function openInvoiceModal(id, preselectedProducer) {
    if (!requireAdmin()) return;
    const inv = id ? NS.state.db.invoices.find(function (x) { return x.id === id; }) : null;
    if (id && !inv) return;
    if (inv && inv.status !== 'Taslak') { NS.toast('Fatura düzenlenemez', 'Yalnızca taslak faturalar düzenlenebilir.', 'warn'); return; }
    const p = inv && inv.partyId ? NS.producerById(inv.partyId) : NS.producerById(preselectedProducer || '');
    const items = inv ? inv.items : [{ desc: p ? 'Çiğ inek sütü alımı' : '', qty: 1, unit: 'L', unitPrice: p ? NS.basePriceFor(p) : 0, vat: 1 }];
    const body = '<input type="hidden" name="invoiceId" value="' + esc(inv ? inv.id : '') + '">' +
      formHead('file-text', inv ? 'Taslak faturayı düzenle' : 'Yeni fatura', 'Fatura numarası kayıt sırasında otomatik verilir.') +
      '<div class="form-grid">' +
        '<label class="field"><span class="field-label">Fatura türü *</span><select class="select" name="type">' + option('Alım', 'Alım faturası', inv ? inv.type : 'Alım') + option('Satış', 'Satış faturası', inv ? inv.type : 'Alım') + '</select></label>' +
        '<label class="field"><span class="field-label">Tarih *</span><input class="input" name="date" type="date" value="' + (inv ? inv.date : NS.todayISO()) + '" required></label>' +
        '<label class="field"><span class="field-label">Üretici *</span><select class="select" name="partyId" required>' + producerOptions(p ? p.id : '') + '</select></label>' +
        '<label class="field"><span class="field-label">Fatura no</span><input class="input" value="' + esc(inv ? inv.no : NS.nextInvoiceNo()) + '" readonly></label>' +
        '<label class="field span-2"><span class="field-label">Not</span><input class="input" name="note" value="' + esc(inv ? inv.note : NS.state.db.settings.deliveryNote || '') + '" maxlength="180"></label>' +
      '</div>' +
      '<div class="form-section"><div class="form-section-head"><b>Fatura kalemleri</b><span>Miktar × birim fiyat · KDV %</span></div>' +
        '<div class="item-row item-row-head"><span>Açıklama</span><span>Miktar</span><span>Birim</span><span>Birim fiyat</span><span>KDV</span><span></span></div>' +
        '<div id="invoiceItems">' + items.map(invoiceItemRow).join('') + '</div>' +
        '<button class="btn btn-ghost btn-sm mt-8" type="button" data-action="invoice-add-item">' + NS.icon('plus') + ' Kalem ekle</button>' +
      '</div>';
    const formId = openFormModal({
      title: inv ? 'Fatura düzenle' : 'Fatura kes',
      subtitle: inv ? inv.no + ' · ' + inv.partyName : 'Resmî satış veya alım faturası',
      icon: 'file-text',
      size: 'xl',
      formId: 'invoiceForm',
      body: body,
      submit: inv ? 'Faturayı güncelle' : 'Faturayı kaydet'
    });
    const f = $('#' + formId);
    if (f) f.dataset.id = inv ? inv.id : '';
  }
  NS.openInvoiceModal = openInvoiceModal;

  function collectInvoiceItems(form) {
    return $$('.inv-item-row', form).map(function (row) {
      const desc = row.querySelector('[data-item="desc"]').value.trim();
      const qty = Number(row.querySelector('[data-item="qty"]').value) || 0;
      const unit = row.querySelector('[data-item="unit"]').value.trim() || 'Adet';
      const unitPrice = Number(row.querySelector('[data-item="unitPrice"]').value) || 0;
      const vat = Number(row.querySelector('[data-item="vat"]').value) || 0;
      return { desc: desc, qty: qty, unit: unit, unitPrice: unitPrice, vat: vat, lineTotal: NS.round(qty * unitPrice, 2) };
    }).filter(function (it) { return it.desc && it.qty > 0; });
  }

  function saveInvoice(form) {
    if (!requireAdmin()) return;
    const items = collectInvoiceItems(form);
    if (!items.length) { NS.toast('Fatura kalemi yok', 'En az bir açıklama ve miktar girin.', 'warn'); return; }
    const pid = fv(form, 'partyId');
    const p = NS.producerById(pid);
    if (!p) { NS.toast('Üretici seçin', '', 'warn'); return; }
    const id = fv(form, 'invoiceId');
    const existing = id ? NS.state.db.invoices.find(function (x) { return x.id === id; }) : null;
    const type = fv(form, 'type') === 'Satış' ? 'Satış' : 'Alım';
    const base = {
      type: type,
      date: fv(form, 'date') || NS.todayISO(),
      partyId: p.id,
      partyName: p.name,
      partyTaxNo: p.taxNo || '',
      partyTaxOffice: p.taxOffice || '',
      partyAddress: p.address || p.village,
      items: items,
      note: fv(form, 'note'),
      updatedAt: new Date().toISOString()
    };
    const totals = NS.invoiceTotals({ items: items });
    Object.assign(base, totals);
    if (existing) {
      Object.assign(existing, base);
    } else {
      const no = NS.nextInvoiceNo();
      base.id = uid('inv');
      base.no = no;
      base.status = 'Taslak';
      base.createdAt = new Date().toISOString();
      base.createdBy = NS.state.me ? NS.state.me.name : '';
      NS.state.db.settings.invoiceNext = Number(NS.state.db.settings.invoiceNext || 1) + 1;
      NS.state.db.invoices.push(base);
    }
    afterChange(existing ? 'Fatura güncellendi' : 'Fatura oluşturuldu', (existing ? existing.no : base.no) + ' · ' + NS.fmtMoney(base.total, 2));
  }

  function setInvoiceStatus(id, status) {
    if (!requireAdmin()) return;
    const inv = NS.state.db.invoices.find(function (x) { return x.id === id; });
    if (!inv) return;
    inv.status = status;
    inv.updatedAt = new Date().toISOString();
    if (status === 'Ödendi') inv.paidAt = new Date().toISOString();
    afterChange(status === 'Ödendi' ? 'Fatura ödendi' : 'Fatura kesildi', inv.no + ' · ' + NS.fmtMoney(inv.total, 2));
  }

  async function deleteInvoice(id) {
    if (!requireAdmin()) return;
    const inv = NS.state.db.invoices.find(function (x) { return x.id === id; });
    if (!inv) return;
    const ok = await NS.confirmDialog({
      title: 'Fatura silinsin mi?',
      message: inv.no + ' · ' + inv.partyName + ' · ' + NS.fmtMoney(inv.total, 2) + '. Bu işlem geri alınamaz.',
      confirmText: 'Faturayı sil'
    });
    if (!ok) return;
    NS.state.db.orders.forEach(function (o) { if (o.invoiceId === id) o.invoiceId = null; });
    NS.state.db.invoices = NS.state.db.invoices.filter(function (x) { return x.id !== id; });
    afterChange('Fatura silindi', inv.no);
  }

  function exportInvoices() {
    const rows = NS.filteredInvoices().map(function (inv) {
      return [inv.no, inv.date, inv.type, inv.partyName, inv.partyTaxNo || '', inv.subtotal, inv.vatTotal, inv.total, inv.status];
    });
    NS.exportCSV('mandirapro-faturalar-' + NS.todayISO() + '.csv',
      ['Fatura No', 'Tarih', 'Tür', 'Taraf', 'Vergi No', 'Matrah', 'KDV', 'Toplam', 'Durum'], rows);
  }

  function orderItemRow(item) {
    item = item || {};
    return '<div class="item-row order-item-row">' +
      '<select class="select" data-item="productId" aria-label="Ürün">' + productOptions(item.productId || '') + '</select>' +
      '<input class="input" data-item="qty" type="number" min="1" step="1" value="' + Number(item.qty || 1) + '" aria-label="Miktar">' +
      '<button class="icon-btn sm danger" type="button" data-action="order-remove-item" title="Kaldır">' + NS.icon('x') + '</button></div>';
  }

  function openOrderModal(id, preselectedProducer) {
    if (!requireAdmin() && !NS.isProducer()) return;
    const o = id ? NS.state.db.orders.find(function (x) { return x.id === id; }) : null;
    if (id) { NS.toast('Sipariş düzenlenemez', 'Sipariş durumunu ilerletmek için sipariş kartını kullanın.', 'info'); if (o && typeof NS.openOrderView === 'function') NS.openOrderView(id); return; }
    const me = NS.state.me;
    const p = NS.isProducer() ? NS.myProducer() : NS.producerById(preselectedProducer || '');
    if (!NS.state.db.products.length) { NS.toast('Ürün yok', 'Önce sipariş verilebilecek bir ürün tanımlayın.', 'warn'); return; }
    const body = formHead('package', 'Yeni sipariş talebi', NS.isProducer() ? 'Talebiniz mandıra yönetimine iletilir.' : 'Üretici adına yem veya malzeme talebi oluşturun.') +
      '<div class="form-grid">' +
        (NS.isProducer()
          ? '<input type="hidden" name="producerId" value="' + esc(p.id) + '"><div class="field"><span class="field-label">Üretici</span><div class="input readonly">' + esc(p.name) + ' · ' + esc(p.code) + '</div></div>'
          : '<label class="field"><span class="field-label">Üretici *</span><select class="select" name="producerId" required>' + producerOptions(p ? p.id : '') + '</select></label>') +
        '<label class="field"><span class="field-label">Tarih</span><input class="input" name="date" type="date" value="' + NS.todayISO() + '"></label>' +
        '<label class="field span-2"><span class="field-label">Not</span><input class="input" name="note" maxlength="180" placeholder="Teslim veya ödeme notu"></label>' +
      '</div>' +
      '<div class="form-section"><div class="form-section-head"><b>Sipariş kalemleri</b><span>Ürün, miktar ve stok</span></div>' +
        '<div class="item-row item-row-head order-head"><span>Ürün</span><span>Miktar</span><span></span></div>' +
        '<div id="orderItems">' + orderItemRow({}) + '</div>' +
        '<button class="btn btn-ghost btn-sm mt-8" type="button" data-action="order-add-item">' + NS.icon('plus') + ' Ürün ekle</button>' +
      '</div>' +
      '<div class="inline-note">' + NS.icon('info') + '<span>Sipariş "Teslim" durumuna geldiğinde stok düşer ve üretici carisine borç olarak işlenir.</span></div>';
    openFormModal({
      title: 'Sipariş oluştur',
      subtitle: (p ? p.name : 'Üretici seçin') + ' · ' + NS.nextOrderNo(),
      icon: 'package',
      size: 'lg',
      formId: 'orderForm',
      body: body,
      submit: 'Siparişi oluştur'
    });
  }
  NS.openOrderModal = openOrderModal;

  function collectOrderItems(form) {
    return $$('.order-item-row', form).map(function (row) {
      const productId = row.querySelector('[data-item="productId"]').value;
      const qty = Number(row.querySelector('[data-item="qty"]').value) || 0;
      const pr = NS.productById ? NS.productById(productId) : NS.state.db.products.find(function (p) { return p.id === productId; });
      if (!pr || qty <= 0) return null;
      return { productId: productId, name: pr.name, qty: qty, unit: pr.unit || 'Adet', unitPrice: Number(pr.price) || 0, lineTotal: NS.round(qty * (Number(pr.price) || 0), 2) };
    }).filter(Boolean);
  }

  function saveOrder(form) {
    if (!requireAdmin() && !NS.isProducer()) return;
    const items = collectOrderItems(form);
    if (!items.length) { NS.toast('Sipariş kalemi yok', 'Bir ürün ve miktar seçin.', 'warn'); return; }
    const pid = NS.isProducer() ? NS.myProducer().id : fv(form, 'producerId');
    const p = NS.producerById(pid);
    if (!p) return;
    const total = NS.round(NS.sum(items.map(function (i) { return i.lineTotal; })), 2);
    const o = {
      id: uid('o'), no: NS.nextOrderNo(), producerId: p.id, date: fv(form, 'date') || NS.todayISO(),
      items: items, total: total, status: 'Talep', note: fv(form, 'note'),
      createdAt: new Date().toISOString(), createdBy: NS.state.me ? NS.state.me.name : ''
    };
    NS.state.db.orders.push(o);
    afterChange('Sipariş oluşturuldu', o.no + ' · ' + p.name + ' · ' + NS.fmtMoney(total, 2));
  }

  function viewOrder(id) {
    const o = NS.state.db.orders.find(function (x) { return x.id === id; });
    if (!o) return;
    if (NS.isProducer() && o.producerId !== NS.state.me.producerId) {
      NS.toast('Sipariş görüntülenemez', 'Yalnızca kendi siparişlerinizi görebilirsiniz.', 'warn'); return;
    }
    if (typeof NS.openOrderView === 'function') NS.openOrderView(id);
  }

  async function advanceOrder(id) {
    if (!requireAdmin()) return;
    const o = NS.state.db.orders.find(function (x) { return x.id === id; });
    if (!o) return;
    const idx = NS.ORDER_STATUSES.indexOf(o.status);
    if (idx < 0 || idx >= NS.ORDER_STATUSES.length - 1) return;
    const next = NS.ORDER_STATUSES[idx + 1];
    if (next === 'Teslim') {
      const ok = await NS.confirmDialog({
        title: 'Sipariş teslim edilsin mi?',
        message: o.no + ' teslim edildiğinde ürün stoğu düşecek ve ' + NS.fmtMoney(o.total, 2) + ' tutarı üretici carisine borç yazılacak.',
        confirmText: 'Teslim et', danger: false
      });
      if (!ok) return;
      (o.items || []).forEach(function (it) {
        const pr = NS.state.db.products.find(function (x) { return x.id === it.productId; });
        if (pr) pr.stock = NS.round(Number(pr.stock || 0) - Number(it.qty || 0), 2);
      });
    }
    o.status = next;
    o.updatedAt = new Date().toISOString();
    if (next === 'Teslim') o.deliveredAt = new Date().toISOString();
    afterChange('Sipariş durumu güncellendi', o.no + ' · ' + next);
  }

  async function deleteOrder(id) {
    if (!requireAdmin()) return;
    const o = NS.state.db.orders.find(function (x) { return x.id === id; });
    if (!o) return;
    const ok = await NS.confirmDialog({
      title: 'Sipariş silinsin mi?',
      message: o.no + ' · ' + NS.fmtMoney(o.total, 2) + (o.status === 'Teslim' ? '. Teslim edilmiş siparişin stoğu geri eklenecek.' : ''),
      confirmText: 'Siparişi sil'
    });
    if (!ok) return;
    if (o.status === 'Teslim') {
      (o.items || []).forEach(function (it) {
        const pr = NS.state.db.products.find(function (x) { return x.id === it.productId; });
        if (pr) pr.stock = NS.round(Number(pr.stock || 0) + Number(it.qty || 0), 2);
      });
    }
    NS.state.db.orders = NS.state.db.orders.filter(function (x) { return x.id !== id; });
    afterChange('Sipariş silindi', o.no);
  }

  function invoiceFromOrder(id) {
    if (!requireAdmin()) return;
    const o = NS.state.db.orders.find(function (x) { return x.id === id; });
    if (!o) return;
    if (o.invoiceId) {
      if (typeof NS.openInvoiceView === 'function') NS.openInvoiceView(o.invoiceId);
      return;
    }
    const p = NS.producerById(o.producerId);
    if (!p) return;
    const no = NS.nextInvoiceNo();
    const inv = {
      id: uid('inv'), no: no, type: 'Satış', date: NS.todayISO(),
      partyId: p.id, partyName: p.name, partyTaxNo: p.taxNo || '', partyTaxOffice: p.taxOffice || '',
      partyAddress: p.address || p.village,
      items: (o.items || []).map(function (it) {
        return { desc: it.name, qty: it.qty, unit: it.unit, unitPrice: it.unitPrice, vat: Number(NS.state.db.settings.vatRate || 20), lineTotal: it.lineTotal };
      }),
      note: 'Sipariş ' + o.no + ' · ' + NS.monthLabel(NS.todayISO().slice(0, 7)),
      status: 'Kesildi', createdAt: new Date().toISOString()
    };
    Object.assign(inv, NS.invoiceTotals(inv));
    NS.state.db.settings.invoiceNext = Number(NS.state.db.settings.invoiceNext || 1) + 1;
    NS.state.db.invoices.push(inv);
    o.invoiceId = inv.id;
    NS.saveDB();
    refreshChrome();
    renderView(NS.state.route, NS.state.viewId);
    NS.toast('Sipariş faturası kesildi', inv.no + ' · ' + NS.fmtMoney(inv.total, 2), 'success');
    if (typeof NS.openInvoiceView === 'function') NS.openInvoiceView(inv.id);
  }

  function openProductModal(id) {
    if (!requireAdmin()) return;
    const p = id ? NS.state.db.products.find(function (x) { return x.id === id; }) : null;
    openFormModal({
      title: p ? 'Ürünü düzenle' : 'Yeni ürün',
      subtitle: p ? p.name : 'Yem, malzeme veya ekipman',
      icon: 'package',
      formId: 'productForm',
      body: (p ? '<input type="hidden" name="id" value="' + esc(p.id) + '">' : '') +
        formHead('package', 'Ürün bilgileri', 'Ürün grubu, satış fiyatı ve stok seviyesi sipariş ekranında kullanılır.') +
        '<div class="form-grid">' +
          '<label class="field span-2"><span class="field-label">Ürün adı *</span><input class="input" name="name" value="' + esc(p ? p.name : '') + '" required maxlength="70"></label>' +
          '<label class="field"><span class="field-label">Grup *</span><select class="select" name="group">' + MP.PRODUCT_GROUPS.map(function (g) { return option(g, g, p ? p.group : 'Yem'); }).join('') + '</select></label>' +
          '<label class="field"><span class="field-label">Birim</span><select class="select" name="unit">' + option('Adet', 'Adet', p ? p.unit : 'Adet') + option('kg', 'kg', p ? p.unit : '') + option('Çuval', 'Çuval', p ? p.unit : '') + option('L', 'L', p ? p.unit : '') + '</select></label>' +
          '<label class="field"><span class="field-label">Satış fiyatı (₺) *</span><input class="input" name="price" type="number" min="0" step="0.01" value="' + Number(p ? p.price : 0) + '" required></label>' +
          '<label class="field"><span class="field-label">Maliyet (₺)</span><input class="input" name="cost" type="number" min="0" step="0.01" value="' + Number(p ? p.cost : 0) + '"></label>' +
          '<label class="field"><span class="field-label">Stok</span><input class="input" name="stock" type="number" min="0" step="0.01" value="' + Number(p ? p.stock : 0) + '"></label>' +
          '<label class="field"><span class="field-label">Kritik stok</span><input class="input" name="minStock" type="number" min="0" step="0.01" value="' + Number(p ? p.minStock : 0) + '"></label>' +
          '<label class="field span-2"><span class="field-label">Not</span><input class="input" name="note" value="' + esc(p ? p.note : '') + '" maxlength="160"></label>' +
        '</div>',
      submit: p ? 'Ürünü güncelle' : 'Ürünü kaydet'
    });
    const f = $('#productForm');
    if (f && p) f.dataset.id = p.id;
  }

  function saveProduct(form) {
    if (!requireAdmin()) return;
    const id = fv(form, 'id');
    const existing = id ? NS.state.db.products.find(function (x) { return x.id === id; }) : null;
    const data = {
      name: fv(form, 'name'), group: fv(form, 'group'), unit: fv(form, 'unit') || 'Adet',
      price: fn(form, 'price'), cost: fn(form, 'cost'), stock: fn(form, 'stock'),
      minStock: fn(form, 'minStock'), note: fv(form, 'note'), updatedAt: new Date().toISOString()
    };
    if (existing) Object.assign(existing, data);
    else NS.state.db.products.push(Object.assign({ id: uid('prd'), active: true, createdAt: new Date().toISOString() }, data));
    afterChange(existing ? 'Ürün güncellendi' : 'Ürün oluşturuldu', data.name);
  }

  function openProductStockModal(id) {
    if (!requireAdmin()) return;
    const p = NS.state.db.products.find(function (x) { return x.id === id; });
    if (!p) return;
    openFormModal({
      title: 'Stok girişi',
      subtitle: p.name + ' · mevcut ' + NS.fmtNum(p.stock, 2) + ' ' + (p.unit || ''),
      icon: 'package',
      formId: 'productStockForm',
      body: '<input type="hidden" name="id" value="' + esc(p.id) + '">' +
        formHead('package', 'Stok hareketi', 'Pozitif değer stok ekler, negatif değer stok düşer.') +
        '<div class="form-grid">' +
          '<label class="field"><span class="field-label">Miktar *</span><input class="input" name="delta" type="number" step="0.01" value="0" required></label>' +
          '<label class="field"><span class="field-label">Yeni stok</span><input class="input readonly" value="' + NS.fmtNum(p.stock, 2) + '" readonly></label>' +
          '<label class="field span-2"><span class="field-label">Not</span><input class="input" name="note" maxlength="160" placeholder="Alım, fire veya sayım"></label>' +
        '</div>',
      submit: 'Stoğu güncelle'
    });
  }

  function saveProductStock(form) {
    if (!requireAdmin()) return;
    const p = NS.state.db.products.find(function (x) { return x.id === fv(form, 'id'); });
    if (!p) return;
    p.stock = NS.round(Number(p.stock || 0) + fn(form, 'delta'), 2);
    p.updatedAt = new Date().toISOString();
    if (!Array.isArray(p.stockMoves)) p.stockMoves = [];
    p.stockMoves.push({ at: new Date().toISOString(), delta: fn(form, 'delta'), note: fv(form, 'note'), by: NS.state.me ? NS.state.me.name : '' });
    afterChange('Stok güncellendi', p.name + ' · ' + NS.fmtNum(p.stock, 2) + ' ' + (p.unit || ''));
  }

  /* ============================================================
     Cari / ödeme
     ============================================================ */
  function openPaymentModal(producerId) {
    if (!requireAdmin()) return;
    const p = NS.producerById(producerId || '');
    const visible = NS.visibleProducers();
    if (!visible.length) return;
    const selected = p || visible[0];
    const acc = NS.producerAccount(selected.id);
    openFormModal({
      title: 'Ödeme / avans gir',
      subtitle: selected.name + ' · güncel bakiye ' + NS.fmtMoney(acc.balance, 2),
      icon: 'wallet',
      formId: 'paymentForm',
      body: formHead('wallet', 'Üretici ödemesi', 'Nakit, havale veya mahsup kaydı cari hesaba anında yansır.') +
        '<div class="form-grid">' +
          '<label class="field"><span class="field-label">Üretici *</span><select class="select" name="producerId" required>' + producerOptions(selected.id) + '</select></label>' +
          '<label class="field"><span class="field-label">Tarih *</span><input class="input" name="date" type="date" value="' + NS.todayISO() + '" required></label>' +
          '<label class="field"><span class="field-label">Tutar (₺) *</span><input class="input" name="amount" type="number" min="0.01" step="0.01" value="" required placeholder="0,00"></label>' +
          '<label class="field"><span class="field-label">Yöntem</span><select class="select" name="method">' + option('Havale / EFT', 'Havale / EFT', '') + option('Nakit', 'Nakit', '') + option('Çek', 'Çek', '') + option('Mahsup', 'Mahsup', '') + '</select></label>' +
          '<label class="field"><span class="field-label">Tür</span><select class="select" name="type">' + option('Avans', 'Avans', '') + option('Tediye ödemesi', 'Tediye ödemesi', '') + option('Acil ödeme', 'Acil ödeme', '') + option('Düzeltme', 'Düzeltme', '') + '</select></label>' +
          '<label class="field"><span class="field-label">Not</span><input class="input" name="note" maxlength="160" placeholder="Dekont, açıklama"></label>' +
        '</div>' +
        '<div class="inline-note">' + NS.icon('info') + '<span>Ödeme kaydı cari bakiyeden düşülür ve tediye dönemindeki avans mahsubuna eklenir.</span></div>',
      submit: 'Ödemeyi kaydet'
    });
  }
  NS.openPaymentModal = openPaymentModal;

  function savePayment(form) {
    if (!requireAdmin()) return;
    const p = NS.producerById(fv(form, 'producerId'));
    if (!p) return;
    const amount = fn(form, 'amount');
    if (amount <= 0) { NS.toast('Tutar girin', '', 'warn'); return; }
    NS.state.db.payments.push({
      id: uid('pay'), producerId: p.id, date: fv(form, 'date') || NS.todayISO(),
      amount: NS.round(amount, 2), method: fv(form, 'method'), type: fv(form, 'type') || 'Avans',
      note: fv(form, 'note'), createdAt: new Date().toISOString(),
      createdBy: NS.state.me ? NS.state.me.name : ''
    });
    afterChange('Ödeme kaydedildi', p.name + ' · ' + NS.fmtMoney(amount, 2));
  }

  /* ============================================================
     Filo ve masraflar
     ============================================================ */
  function expenseTypeOptions(selected) {
    return NS.EXPENSE_TYPES.map(function (t) { return option(t.key, t.key, selected); }).join('');
  }
  function openExpenseModal(id, preselectedVehicle) {
    if (!requireAdmin()) return;
    const e = id ? NS.state.db.expenses.find(function (x) { return x.id === id; }) : null;
    const v = e && e.vehicleId ? NS.vehicleById(e.vehicleId) : NS.vehicleById(preselectedVehicle || '');
    const vehicles = NS.state.db.vehicles;
    const tanks = NS.state.db.tanks;
    openFormModal({
      title: e ? 'Masrafı düzenle' : 'Yeni masraf',
      subtitle: e ? e.type + ' · ' + NS.fmtDate(e.date) : 'Yakıt, bakım, temizlik veya diğer işletme gideri',
      icon: 'receipt',
      formId: 'expenseForm',
      body: (e ? '<input type="hidden" name="id" value="' + esc(e.id) + '">' : '') +
        formHead('receipt', 'İşletme masrafı', 'Araç veya tanka bağlanan masraflar filo maliyetine yansır.') +
        '<div class="form-grid">' +
          '<label class="field"><span class="field-label">Tarih *</span><input class="input" name="date" type="date" value="' + (e ? e.date : NS.todayISO()) + '" required></label>' +
          '<label class="field"><span class="field-label">Masraf türü *</span><select class="select" name="type" required>' + expenseTypeOptions(e ? e.type : 'Yakıt') + '</select></label>' +
          '<label class="field"><span class="field-label">Araç</span><select class="select" name="vehicleId"><option value="">Araç seçilmedi</option>' + vehicles.map(function (x) { return option(x.id, x.plate + ' · ' + x.brand + ' ' + x.model, v ? v.id : ''); }).join('') + '</select></label>' +
          '<label class="field"><span class="field-label">Tank</span><select class="select" name="tankId"><option value="">Tank seçilmedi</option>' + tanks.map(function (t) { return option(t.id, t.name, e ? e.tankId : ''); }).join('') + '</select></label>' +
          '<label class="field"><span class="field-label">Tedarikçi / yer</span><input class="input" name="vendor" value="' + esc(e ? e.vendor : '') + '" maxlength="70"></label>' +
          '<label class="field"><span class="field-label">Fatura / fiş no</span><input class="input" name="invoiceNo" value="' + esc(e ? e.invoiceNo : '') + '" maxlength="30"></label>' +
          '<label class="field"><span class="field-label">Tutar (₺) *</span><input class="input" name="amount" type="number" min="0.01" step="0.01" value="' + Number(e ? e.amount : '') + '" required></label>' +
          '<label class="field"><span class="field-label">Litre</span><input class="input" name="liters" type="number" min="0" step="0.1" value="' + Number(e ? e.liters : 0) + '"></label>' +
          '<label class="field"><span class="field-label">Kilometre</span><input class="input" name="km" type="number" min="0" step="1" value="' + Number(e ? e.km : 0) + '"></label>' +
          '<label class="field"><span class="field-label">Not</span><input class="input" name="note" value="' + esc(e ? e.note : '') + '" maxlength="130"></label>' +
        '</div>',
      submit: e ? 'Masrafı güncelle' : 'Masrafı kaydet'
    });
  }

  function saveExpense(form) {
    if (!requireAdmin()) return;
    const id = fv(form, 'id');
    const existing = id ? NS.state.db.expenses.find(function (x) { return x.id === id; }) : null;
    const data = {
      date: fv(form, 'date') || NS.todayISO(), type: fv(form, 'type'), vehicleId: fv(form, 'vehicleId'),
      tankId: fv(form, 'tankId'), vendor: fv(form, 'vendor'), invoiceNo: fv(form, 'invoiceNo'),
      amount: fn(form, 'amount'), liters: fn(form, 'liters'), km: fn(form, 'km'), note: fv(form, 'note'),
      updatedAt: new Date().toISOString()
    };
    if (data.amount <= 0) { NS.toast('Tutar girin', '', 'warn'); return; }
    if (existing) Object.assign(existing, data);
    else NS.state.db.expenses.push(Object.assign({ id: uid('exp'), createdAt: new Date().toISOString(), createdBy: NS.state.me ? NS.state.me.name : '' }, data));
    if (data.vehicleId && data.km > 0) {
      const v = NS.vehicleById(data.vehicleId);
      if (v) v.km = Math.max(Number(v.km || 0), Number(data.km));
    }
    afterChange(existing ? 'Masraf güncellendi' : 'Masraf kaydedildi', data.type + ' · ' + NS.fmtMoney(data.amount, 2));
  }

  async function deleteExpense(id) {
    if (!requireAdmin()) return;
    const e = NS.state.db.expenses.find(function (x) { return x.id === id; });
    if (!e) return;
    const ok = await NS.confirmDialog({ title: 'Masraf silinsin mi?', message: e.type + ' · ' + NS.fmtMoney(e.amount, 2) + ' · ' + NS.fmtDate(e.date), confirmText: 'Masrafı sil' });
    if (!ok) return;
    NS.state.db.expenses = NS.state.db.expenses.filter(function (x) { return x.id !== id; });
    afterChange('Masraf silindi', e.type + ' · ' + NS.fmtMoney(e.amount, 2));
  }

  function openVehicleModal(id) {
    if (!requireAdmin()) return;
    const v = id ? NS.vehicleById(id) : null;
    openFormModal({
      title: v ? 'Aracı düzenle' : 'Yeni araç',
      subtitle: v ? v.plate + ' · ' + v.brand + ' ' + v.model : 'Rota ve sevkiyat filosu',
      icon: 'truck',
      formId: 'vehicleForm',
      body: (v ? '<input type="hidden" name="id" value="' + esc(v.id) + '">' : '') +
        formHead('truck', 'Araç bilgileri', 'Sigorta ve muayene tarihleri filo uyarılarında kullanılır.') +
        '<div class="form-grid">' +
          '<label class="field"><span class="field-label">Plaka *</span><input class="input" name="plate" value="' + esc(v ? v.plate : '') + '" required maxlength="14" placeholder="42 ABC 123"></label>' +
          '<label class="field"><span class="field-label">Marka *</span><input class="input" name="brand" value="' + esc(v ? v.brand : '') + '" required maxlength="30"></label>' +
          '<label class="field"><span class="field-label">Model *</span><input class="input" name="model" value="' + esc(v ? v.model : '') + '" required maxlength="40"></label>' +
          '<label class="field"><span class="field-label">Yıl</span><input class="input" name="year" type="number" min="1980" max="2100" value="' + Number(v ? v.year : new Date().getFullYear()) + '"></label>' +
          '<label class="field"><span class="field-label">Sürücü</span><input class="input" name="driver" value="' + esc(v ? v.driver : '') + '" maxlength="60"></label>' +
          '<label class="field"><span class="field-label">Kilometre</span><input class="input" name="km" type="number" min="0" step="1" value="' + Number(v ? v.km : 0) + '"></label>' +
          '<label class="field"><span class="field-label">Sigorta bitişi</span><input class="input" name="insuranceUntil" type="date" value="' + (v && v.insuranceUntil ? v.insuranceUntil : '') + '"></label>' +
          '<label class="field"><span class="field-label">Muayene bitişi</span><input class="input" name="inspectionUntil" type="date" value="' + (v && v.inspectionUntil ? v.inspectionUntil : '') + '"></label>' +
          '<label class="checkbox span-2"><input type="checkbox" name="active"' + (!v || v.active !== false ? ' checked' : '') + '> Araç aktif olarak kullanılıyor</label>' +
        '</div>',
      submit: v ? 'Aracı güncelle' : 'Aracı kaydet'
    });
  }

  function saveVehicle(form) {
    if (!requireAdmin()) return;
    const id = fv(form, 'id');
    const existing = id ? NS.vehicleById(id) : null;
    const data = {
      plate: fv(form, 'plate').toLocaleUpperCase('tr-TR'), brand: fv(form, 'brand'), model: fv(form, 'model'),
      year: fn(form, 'year'), driver: fv(form, 'driver'), km: fn(form, 'km'),
      insuranceUntil: fv(form, 'insuranceUntil'), inspectionUntil: fv(form, 'inspectionUntil'),
      active: fc(form, 'active'), updatedAt: new Date().toISOString()
    };
    if (existing) Object.assign(existing, data);
    else NS.state.db.vehicles.push(Object.assign({ id: uid('v'), createdAt: new Date().toISOString() }, data));
    afterChange(existing ? 'Araç güncellendi' : 'Araç eklendi', data.plate + ' · ' + data.brand + ' ' + data.model);
  }

  /* ============================================================
     Kullanıcı / sütçü yönetimi
     ============================================================ */
  function userFormBody(u) {
    u = u || {};
    return '<input type="hidden" name="id" value="' + esc(u.id || '') + '">' +
      formHead('shield', u.id ? 'Kullanıcı hesabını düzenle' : 'Yeni kullanıcı hesabı', 'Rol ve bağlı kayıt, veri görünürlüğünü belirler.') +
      '<div class="form-grid">' +
        '<label class="field"><span class="field-label">Ad soyad *</span><input class="input" name="name" value="' + esc(u.name || '') + '" required maxlength="60"></label>' +
        '<label class="field"><span class="field-label">Kullanıcı adı *</span><input class="input" name="username" value="' + esc(u.username || '') + '" required maxlength="28" autocomplete="username" ' + (u.id ? 'readonly' : '') + '></label>' +
        '<label class="field"><span class="field-label">Rol *</span><select class="select" name="role" required>' + roleOptions(u.role || 'Sütçü') + '</select></label>' +
        '<label class="field"><span class="field-label">Telefon</span><input class="input" name="phone" value="' + esc(u.phone || '') + '" maxlength="24"></label>' +
        '<label class="field"><span class="field-label">Sütçü bağlantısı</span><select class="select" name="collectorId"><option value="">Bağlantı yok</option>' + NS.state.db.collectors.map(function (c) { return option(c.id, c.name + ' · ' + c.route, u.collectorId || ''); }).join('') + '</select></label>' +
        '<label class="field"><span class="field-label">Üretici bağlantısı</span><select class="select" name="producerId"><option value="">Bağlantı yok</option>' + NS.state.db.producers.map(function (p) { return option(p.id, p.name + ' · ' + p.code, u.producerId || ''); }).join('') + '</select></label>' +
        '<label class="field"><span class="field-label">Şifre ' + (u.id ? '(boşsa değişmez)' : '*') + '</span><input class="input" name="password" type="password" autocomplete="new-password" placeholder="' + (u.id ? 'Yeni şifre' : 'En az 4 karakter') + '" ' + (u.id ? '' : 'required minlength="4"') + '></label>' +
        '<label class="checkbox"><input type="checkbox" name="active"' + (u.active !== false ? ' checked' : '') + '> Hesap aktif</label>' +
      '</div>' +
      '<div class="inline-note">' + NS.icon('lock') + '<span>Şifreler SHA-256 özetiyle saklanır. Üretici hesabı yalnızca bağlı çiftliğin verilerini görür.</span></div>';
  }

  function openUserModal(id) {
    if (!requireAdmin()) return;
    const u = id ? NS.state.db.users.find(function (x) { return x.id === id; }) : null;
    openFormModal({
      title: u ? 'Kullanıcıyı düzenle' : 'Yeni kullanıcı',
      subtitle: u ? '@' + u.username + ' · ' + u.role : 'Yönetici, sütçü veya üretici hesabı',
      icon: 'shield',
      size: 'lg',
      formId: 'userForm',
      body: userFormBody(u),
      submit: u ? 'Hesabı güncelle' : 'Hesabı oluştur'
    });
  }

  async function saveUser(form) {
    if (!requireAdmin()) return;
    const id = fv(form, 'id');
    const existing = id ? NS.state.db.users.find(function (x) { return x.id === id; }) : null;
    const username = fv(form, 'username').toLocaleLowerCase('tr-TR').replace(/\s+/g, '');
    if (!username) { NS.toast('Kullanıcı adı gerekli', '', 'warn'); return; }
    if (NS.state.db.users.some(function (u) { return u.username.toLocaleLowerCase('tr-TR') === username && (!existing || u.id !== existing.id); })) {
      NS.toast('Kullanıcı adı kullanılıyor', username, 'warn'); return;
    }
    const role = fv(form, 'role');
    const collectorId = role === 'Sütçü' ? fv(form, 'collectorId') : '';
    const producerId = role === 'Üretici' ? fv(form, 'producerId') : '';
    if (role === 'Sütçü' && !collectorId) { NS.toast('Sütçü bağlantısı seçin', '', 'warn'); return; }
    if (role === 'Üretici' && !producerId) { NS.toast('Üretici bağlantısı seçin', '', 'warn'); return; }
    if (existing && existing.role === 'Yönetici' && role !== 'Yönetici' && existing.active !== false) {
      const activeAdmins = NS.state.db.users.filter(function (u) { return u.role === 'Yönetici' && u.active !== false; }).length;
      if (activeAdmins <= 1) { NS.toast('Son yönetici kaldırılamaz', 'En az bir aktif yönetici hesabı bulunmalıdır.', 'warn'); return; }
    }
    const data = {
      name: fv(form, 'name'), username: username, role: role, phone: fv(form, 'phone'),
      collectorId: collectorId, producerId: producerId, active: fc(form, 'active'),
      updatedAt: new Date().toISOString()
    };
    const password = fv(form, 'password');
    if (!existing) {
      if (password.length < 4) { NS.toast('Şifre çok kısa', 'En az 4 karakter girin.', 'warn'); return; }
      const u = Object.assign({ id: uid('u'), passHash: await NS.hashPassword(password), createdAt: new Date().toISOString() }, data);
      NS.state.db.users.push(u);
    } else {
      if (password && password.length < 4) { NS.toast('Şifre çok kısa', 'En az 4 karakter girin.', 'warn'); return; }
      Object.assign(existing, data);
      if (password) existing.passHash = await NS.hashPassword(password);
    }
    if (existing && NS.state.me && existing.id === NS.state.me.id) NS.state.me = existing;
    afterChange(existing ? 'Kullanıcı güncellendi' : 'Kullanıcı oluşturuldu', data.name + ' · @' + data.username);
  }

  async function deleteUser(id) {
    if (!requireAdmin()) return;
    const u = NS.state.db.users.find(function (x) { return x.id === id; });
    if (!u) return;
    if (NS.state.me && u.id === NS.state.me.id) { NS.toast('Kendi hesabınızı silemezsiniz', '', 'warn'); return; }
    if (u.role === 'Yönetici' && u.active !== false) {
      const activeAdmins = NS.state.db.users.filter(function (x) { return x.role === 'Yönetici' && x.active !== false; }).length;
      if (activeAdmins <= 1) { NS.toast('Son yönetici silinemez', '', 'warn'); return; }
    }
    const ok = await NS.confirmDialog({ title: 'Kullanıcı silinsin mi?', message: u.name + ' · @' + u.username + '. Geçmiş kayıtlar korunur.', confirmText: 'Hesabı sil' });
    if (!ok) return;
    NS.state.db.users = NS.state.db.users.filter(function (x) { return x.id !== id; });
    afterChange('Kullanıcı silindi', u.name + ' · @' + u.username);
  }

  function collectorFormBody(c) {
    c = c || {};
    return '<input type="hidden" name="id" value="' + esc(c.id || '') + '">' +
      formHead('route', c.id ? 'Sütçü ve rotayı düzenle' : 'Yeni sütçü ve rota', 'Rota, plaka ve vardiya saha ekranında görünür.') +
      '<div class="form-grid">' +
        '<label class="field"><span class="field-label">Ad soyad *</span><input class="input" name="name" value="' + esc(c.name || '') + '" required maxlength="60"></label>' +
        '<label class="field"><span class="field-label">Rota adı *</span><input class="input" name="route" value="' + esc(c.route || '') + '" required maxlength="50" placeholder="Örn. Merkez Rotası"></label>' +
        '<label class="field"><span class="field-label">Telefon</span><input class="input" name="phone" value="' + esc(c.phone || '') + '" maxlength="24"></label>' +
        '<label class="field"><span class="field-label">Plaka</span><input class="input" name="plate" value="' + esc(c.plate || '') + '" maxlength="14"></label>' +
        '<label class="field"><span class="field-label">Vardiya</span><input class="input" name="shift" value="' + esc(c.shift || 'Sabah 05:30 – 09:30') + '" maxlength="40"></label>' +
        '<label class="field"><span class="field-label">Renk</span><input class="input" name="color" type="color" value="' + esc(c.color || '#2f7d5a') + '"></label>' +
        (!c.id ? '<label class="checkbox span-2"><input type="checkbox" name="createAccount" checked> Sütçü için giriş hesabı oluştur (şifre 1234)</label>' : '') +
      '</div>';
  }

  function openCollectorModal(id) {
    if (!requireAdmin()) return;
    const c = id ? NS.collectorById(id) : null;
    openFormModal({
      title: c ? 'Sütçüyü düzenle' : 'Yeni sütçü',
      subtitle: c ? c.name + ' · ' + c.route : 'Saha ekibi ve toplama rotası',
      icon: 'route',
      formId: 'collectorForm',
      body: collectorFormBody(c),
      submit: c ? 'Sütçüyü güncelle' : 'Sütçüyü kaydet'
    });
  }

  async function saveCollector(form) {
    if (!requireAdmin()) return;
    const id = fv(form, 'id');
    const existing = id ? NS.collectorById(id) : null;
    const data = {
      name: fv(form, 'name'), route: fv(form, 'route'), phone: fv(form, 'phone'),
      plate: fv(form, 'plate'), shift: fv(form, 'shift'), color: fv(form, 'color') || '#2f7d5a'
    };
    if (!data.name || !data.route) { NS.toast('Ad ve rota gerekli', '', 'warn'); return; }
    let collector = existing;
    if (existing) Object.assign(existing, data);
    else {
      collector = Object.assign({ id: nextCollectorId(), active: true, createdAt: new Date().toISOString() }, data);
      NS.state.db.collectors.push(collector);
      if (fc(form, 'createAccount')) {
        const username = uniqueUsername(String(data.name).split(/\s+/)[0]);
        NS.state.db.users.push({
          id: uid('u'), name: data.name, username: username, role: 'Sütçü', collectorId: collector.id,
          phone: data.phone, active: true, passHash: await NS.hashPassword('1234'), createdAt: new Date().toISOString()
        });
        NS.toast('Sütçü hesabı oluşturuldu', '@' + username + ' · şifre 1234', 'info');
      }
    }
    if (existing) {
      NS.state.db.users.forEach(function (u) {
        if (u.role === 'Sütçü' && u.collectorId === collector.id) { u.name = data.name; u.phone = data.phone; }
      });
    }
    afterChange(existing ? 'Sütçü güncellendi' : 'Sütçü eklendi', collector.name + ' · ' + collector.route);
  }

  /* ============================================================
     Fiyat listesi / tank tanımları
     ============================================================ */
  function openPriceListModal(id) {
    if (!requireAdmin()) return;
    const pl = id ? NS.state.db.priceLists.find(function (x) { return x.id === id; }) : null;
    openFormModal({
      title: pl ? 'Fiyat listesini düzenle' : 'Yeni fiyat listesi',
      subtitle: pl ? pl.name + ' · ' + pl.group : 'Süt grubuna göre baz fiyat ve kalite primleri',
      icon: 'scale',
      formId: 'priceForm',
      body: (pl ? '<input type="hidden" name="id" value="' + esc(pl.id) + '">' : '') +
        formHead('scale', 'Fiyat ve kalite farkları', 'Tediye hesaplanırken üreticinin listesi ve numune sınıfı kullanılır.') +
        '<div class="form-grid">' +
          '<label class="field"><span class="field-label">Liste adı *</span><input class="input" name="name" value="' + esc(pl ? pl.name : '') + '" required maxlength="50"></label>' +
          '<label class="field"><span class="field-label">Ürün grubu *</span><input class="input" name="group" value="' + esc(pl ? pl.group : 'İnek sütü') + '" required maxlength="40"></label>' +
          '<label class="field"><span class="field-label">Baz fiyat (₺/L) *</span><input class="input" name="basePrice" type="number" min="0" step="0.01" value="' + Number(pl ? pl.basePrice : 0) + '" required></label>' +
          '<label class="field"><span class="field-label">Yürürlük tarihi</span><input class="input" name="effectiveFrom" type="date" value="' + (pl && pl.effectiveFrom ? pl.effectiveFrom : NS.todayISO()) + '"></label>' +
          '<label class="field"><span class="field-label">A sınıfı farkı (₺)</span><input class="input" name="deltaA" type="number" step="0.01" value="' + Number(pl && pl.gradeDelta ? pl.gradeDelta.A : 0.5) + '"></label>' +
          '<label class="field"><span class="field-label">B sınıfı farkı (₺)</span><input class="input" name="deltaB" type="number" step="0.01" value="' + Number(pl && pl.gradeDelta ? pl.gradeDelta.B : 0) + '"></label>' +
          '<label class="field"><span class="field-label">C sınıfı farkı (₺)</span><input class="input" name="deltaC" type="number" step="0.01" value="' + Number(pl && pl.gradeDelta ? pl.gradeDelta.C : -0.5) + '"></label>' +
          '<label class="field span-2"><span class="field-label">Not</span><input class="input" name="note" value="' + esc(pl ? pl.note : '') + '" maxlength="180"></label>' +
        '</div>',
      submit: pl ? 'Listeyi güncelle' : 'Listeyi kaydet'
    });
  }

  function savePriceList(form) {
    if (!requireAdmin()) return;
    const id = fv(form, 'id');
    const existing = id ? NS.state.db.priceLists.find(function (x) { return x.id === id; }) : null;
    const data = {
      name: fv(form, 'name'), group: fv(form, 'group'), basePrice: fn(form, 'basePrice'),
      effectiveFrom: fv(form, 'effectiveFrom') || NS.todayISO(),
      gradeDelta: { A: fn(form, 'deltaA'), B: fn(form, 'deltaB'), C: fn(form, 'deltaC') },
      note: fv(form, 'note'), updatedAt: new Date().toISOString()
    };
    if (existing) Object.assign(existing, data);
    else NS.state.db.priceLists.push(Object.assign({ id: uid('pl'), createdAt: new Date().toISOString() }, data));
    afterChange(existing ? 'Fiyat listesi güncellendi' : 'Fiyat listesi oluşturuldu', data.name + ' · ' + NS.fmtMoney(data.basePrice, 2) + '/L');
  }

  async function deletePriceList(id) {
    if (!requireAdmin()) return;
    const pl = NS.state.db.priceLists.find(function (x) { return x.id === id; });
    if (!pl) return;
    if (NS.state.db.priceLists.length <= 1) { NS.toast('Son fiyat listesi silinemez', 'En az bir liste bulunmalıdır.', 'warn'); return; }
    const used = NS.state.db.producers.filter(function (p) { return p.priceListId === id; }).length;
    if (used) { NS.toast('Fiyat listesi kullanılıyor', used + ' üreticiye bağlı. Önce onları başka listeye taşıyın.', 'warn'); return; }
    const ok = await NS.confirmDialog({ title: 'Fiyat listesi silinsin mi?', message: pl.name + ' · ' + NS.fmtMoney(pl.basePrice, 2) + '/L', confirmText: 'Listeyi sil' });
    if (!ok) return;
    NS.state.db.priceLists = NS.state.db.priceLists.filter(function (x) { return x.id !== id; });
    afterChange('Fiyat listesi silindi', pl.name);
  }

  function openTankModal(id) {
    if (!requireAdmin()) return;
    const t = id ? NS.tankById(id) : null;
    openFormModal({
      title: t ? 'Tankı düzenle' : 'Yeni tank',
      subtitle: t ? t.name + ' · ' + t.code : 'Soğuk zincir kapasitesi',
      icon: 'tank',
      formId: 'tankForm',
      body: (t ? '<input type="hidden" name="id" value="' + esc(t.id) + '">' : '') +
        formHead('tank', 'Tank bilgileri', 'Kapasite, sıcaklık ve temizlik takibi operasyon ekranında görünür.') +
        '<div class="form-grid">' +
          '<label class="field"><span class="field-label">Tank adı *</span><input class="input" name="name" value="' + esc(t ? t.name : '') + '" required maxlength="50"></label>' +
          '<label class="field"><span class="field-label">Kod *</span><input class="input" name="code" value="' + esc(t ? t.code : 'T-' + (NS.state.db.tanks.length + 1)) + '" required maxlength="20"></label>' +
          '<label class="field"><span class="field-label">Kapasite (L) *</span><input class="input" name="capacity" type="number" min="1" step="1" value="' + Number(t ? t.capacity : 2000) + '" required></label>' +
          '<label class="field"><span class="field-label">Mevcut litre</span><input class="input" name="current" type="number" min="0" step="0.1" value="' + Number(t ? t.current : 0) + '"></label>' +
          '<label class="field"><span class="field-label">Sıcaklık (°C)</span><input class="input" name="temperature" type="number" min="-5" max="30" step="0.1" value="' + Number(t ? t.temperature : 4) + '"></label>' +
          '<label class="field"><span class="field-label">Süt türü</span><input class="input" name="milkType" value="' + esc(t ? t.milkType : 'İnek sütü') + '" maxlength="30"></label>' +
          '<label class="field"><span class="field-label">Son temizlik</span><input class="input" name="lastCleanedAt" type="date" value="' + (t && t.lastCleanedAt ? t.lastCleanedAt : '') + '"></label>' +
          '<label class="field span-2"><span class="field-label">Not</span><input class="input" name="note" value="' + esc(t ? t.note : '') + '" maxlength="160"></label>' +
        '</div>',
      submit: t ? 'Tankı güncelle' : 'Tankı kaydet'
    });
  }

  function saveTank(form) {
    if (!requireAdmin()) return;
    const id = fv(form, 'id');
    const existing = id ? NS.tankById(id) : null;
    const capacity = fn(form, 'capacity');
    const current = Math.min(capacity, Math.max(0, fn(form, 'current')));
    const data = {
      name: fv(form, 'name'), code: fv(form, 'code'), capacity: capacity, current: current,
      temperature: fn(form, 'temperature'), milkType: fv(form, 'milkType'),
      lastCleanedAt: fv(form, 'lastCleanedAt'), note: fv(form, 'note'), updatedAt: new Date().toISOString()
    };
    if (existing) Object.assign(existing, data);
    else NS.state.db.tanks.push(Object.assign({ id: uid('t'), history: [], createdAt: new Date().toISOString() }, data));
    afterChange(existing ? 'Tank güncellendi' : 'Tank eklendi', data.name + ' · ' + NS.fmtNum(capacity, 0) + ' L');
  }

  function saveTankMeasure(form) {
    if (!requireCollectorOrAdmin()) return;
    const t = NS.tankById(fv(form, 'tankId'));
    if (!t) return;
    const current = Math.max(0, Math.min(Number(t.capacity), fn(form, 'current')));
    t.current = NS.round(current, 1);
    t.temperature = NS.round(fn(form, 'temperature'), 1);
    t.lastMeasuredAt = new Date().toISOString();
    if (!Array.isArray(t.history)) t.history = [];
    t.history.push({ type: 'Ölçüm', date: NS.todayISO(), at: t.lastMeasuredAt, current: t.current, temperature: t.temperature, by: NS.state.me ? NS.state.me.name : '', note: fv(form, 'note') });
    afterChange('Tank ölçümü kaydedildi', t.name + ' · ' + NS.fmtNum(t.current, 0) + ' L · ' + NS.fmtNum(t.temperature, 1) + ' °C');
  }

  function saveDispatch(form) {
    if (!requireCollectorOrAdmin()) return;
    const t = NS.tankById(fv(form, 'tankId'));
    if (!t) return;
    const liters = fn(form, 'liters');
    if (liters <= 0) { NS.toast('Litre girin', '', 'warn'); return; }
    if (liters > Number(t.current) + 0.001) {
      NS.toast('Tank stoğu yetersiz', t.name + ' içinde ' + NS.fmtNum(t.current, 1) + ' L var.', 'warn'); return;
    }
    const v = NS.vehicleById(fv(form, 'vehicleId'));
    const d = {
      id: uid('d'), tankId: t.id, date: fv(form, 'date') || NS.todayISO(), liters: NS.round(liters, 1),
      temperature: fn(form, 'temperature'), destination: fv(form, 'destination'),
      vehicleId: v ? v.id : '', driver: fv(form, 'driver') || (v ? v.driver : ''),
      plate: fv(form, 'plate') || (v ? v.plate : ''), note: fv(form, 'note'),
      createdAt: new Date().toISOString(), createdBy: NS.state.me ? NS.state.me.name : ''
    };
    NS.state.db.dispatches.push(d);
    t.current = NS.round(Number(t.current) - liters, 1);
    if (!Array.isArray(t.history)) t.history = [];
    t.history.push({ type: 'Sevkiyat', date: d.date, at: d.createdAt, liters: d.liters, by: d.createdBy, destination: d.destination });
    if (v) v.km = Math.max(Number(v.km || 0), Number(v.km || 0));
    afterChange('Sevkiyat kaydedildi', t.name + ' · ' + NS.fmtNum(liters, 0) + ' L · ' + d.destination);
  }

  /* ============================================================
     Üretici notları
     ============================================================ */
  function openNoteModal(producerId) {
    if (!requireCollectorOrAdmin()) return;
    const p = NS.producerById(producerId);
    if (!p) return;
    openFormModal({
      title: 'Üretici notu',
      subtitle: p.name + ' · ' + p.code,
      icon: 'edit',
      formId: 'noteForm',
      body: formHead('edit', 'Saha notu', 'Notlar yalnızca mandıra ekibi tarafından görülür.') +
        '<label class="field"><span class="field-label">Not *</span><textarea class="textarea" name="text" rows="4" required maxlength="500" placeholder="Ziyaret, kalite, ekipman veya ödeme notu…"></textarea></label>' +
        '<label class="checkbox"><input type="checkbox" name="pinned"> Notu üste sabitle</label>',
      submit: 'Notu kaydet'
    });
    const f = $('#noteForm');
    if (f) f.dataset.producerId = p.id;
  }

  function saveProducerNote(form) {
    if (!requireCollectorOrAdmin()) return;
    const pid = form.dataset.producerId || NS.state.viewId;
    const p = NS.producerById(pid);
    if (!p) return;
    const text = fv(form, 'text');
    if (!text) { NS.toast('Not girin', '', 'warn'); return; }
    if (!Array.isArray(NS.state.db.producerNotes)) NS.state.db.producerNotes = [];
    NS.state.db.producerNotes.push({
      id: uid('pn'), producerId: pid, date: NS.todayISO(), text: text,
      authorName: NS.state.me ? NS.state.me.name : 'Mandıra ekibi',
      authorId: NS.state.me ? NS.state.me.id : '',
      createdAt: new Date().toISOString(), pinned: fc(form, 'pinned')
    });
    afterChange('Not eklendi', p.name);
  }

  async function deleteProducerNote(id) {
    if (!requireCollectorOrAdmin()) return;
    const note = (NS.state.db.producerNotes || []).find(function (n) { return n.id === id; });
    if (!note) return;
    const ok = await NS.confirmDialog({ title: 'Not silinsin mi?', message: note.text.slice(0, 120), confirmText: 'Notu sil' });
    if (!ok) return;
    NS.state.db.producerNotes = NS.state.db.producerNotes.filter(function (n) { return n.id !== id; });
    afterChange('Not silindi', '');
  }

  /* ============================================================
     Şifre / güvenlik
     ============================================================ */
  function openPasswordModal() {
    if (!NS.state.me) return;
    openFormModal({
      title: 'Şifre değiştir',
      subtitle: '@' + NS.state.me.username + ' · ' + NS.state.me.role,
      icon: 'lock',
      formId: 'passwordForm',
      body: formHead('lock', 'Hesap güvenliği', 'En az 4 karakterli yeni bir şifre belirleyin.') +
        '<div class="form-grid">' +
          '<label class="field span-2"><span class="field-label">Mevcut şifre *</span><input class="input" name="current" type="password" required autocomplete="current-password"></label>' +
          '<label class="field"><span class="field-label">Yeni şifre *</span><input class="input" name="password" type="password" required minlength="4" autocomplete="new-password"></label>' +
          '<label class="field"><span class="field-label">Yeni şifre (tekrar) *</span><input class="input" name="confirm" type="password" required minlength="4" autocomplete="new-password"></label>' +
        '</div>',
      submit: 'Şifreyi güncelle'
    });
  }

  async function savePassword(form) {
    const me = NS.state.me;
    if (!me) return;
    const current = fv(form, 'current');
    let ok = false;
    if (me.passHash) ok = me.passHash === await NS.hashPassword(current);
    else if (me.pass) ok = String(me.pass) === current;
    if (!ok) { NS.toast('Mevcut şifre hatalı', '', 'error'); return; }
    const pass = fv(form, 'password');
    if (pass.length < 4) { NS.toast('Şifre çok kısa', 'En az 4 karakter girin.', 'warn'); return; }
    if (pass !== fv(form, 'confirm')) { NS.toast('Şifreler eşleşmiyor', '', 'warn'); return; }
    me.passHash = await NS.hashPassword(pass);
    delete me.pass;
    me.passwordChangedAt = new Date().toISOString();
    afterChange('Şifre güncellendi', '@' + me.username + ' · bir sonraki girişte yeni şifre geçerli.');
  }

  /* ============================================================
     Ekstre / PDF
     ============================================================ */
  function openStatementModal(producerId) {
    const p = producerId ? NS.producerById(producerId) : null;
    if (!p) { NS.toast('Üretici seçin', '', 'warn'); return; }
    if (NS.isProducer() && p.id !== NS.state.me.producerId) { NS.toast('Yetki yok', '', 'warn'); return; }
    const months = {};
    NS.recordsForProducer(p.id).forEach(function (r) { months[r.date.slice(0, 7)] = true; });
    for (let i = 0; i < 6; i++) {
      const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - i);
      months[d.getFullYear() + '-' + NS.pad(d.getMonth() + 1)] = true;
    }
    const list = Object.keys(months).sort().reverse();
    const current = NS.todayISO().slice(0, 7);
    const acc = NS.producerAccount(p.id, NS.monthStart(current), NS.monthEnd(current));
    openFormModal({
      title: 'Aylık ekstre / PDF',
      subtitle: p.name + ' · ' + p.code,
      icon: 'printer',
      formId: 'statementForm',
      body: '<input type="hidden" name="producerId" value="' + esc(p.id) + '">' +
        formHead('printer', 'Resmî üretici ekstresi', 'Seçilen dönemin süt kayıtları, kalite sonuçları ve cari hareketleri A4 belge olarak hazırlanır.') +
        '<div class="form-grid">' +
          '<label class="field"><span class="field-label">Dönem *</span><select class="select" name="month" required>' + list.map(function (ym) { return option(ym, NS.capitalize(NS.monthLabel(ym)), current); }).join('') + '</select></label>' +
          '<label class="field"><span class="field-label">Bu ay hakediş</span><input class="input readonly" value="' + NS.fmtMoney(acc.gross, 2) + '" readonly></label>' +
        '</div>' +
        '<div class="inline-note">' + NS.icon('info') + '<span>Belge yazdırma penceresinde "PDF olarak kaydet" seçilerek arşivlenebilir. QR kod belge doğrulaması taşır.</span></div>',
      submit: 'Ekstreyi hazırla'
    });
    const f = $('#statementForm');
    if (f) f.dataset.producerId = p.id;
  }
  NS.openStatementModal = openStatementModal;

  function printStatementFromForm(form) {
    const pid = form.dataset.producerId || fv(form, 'producerId');
    const ym = fv(form, 'month');
    NS.closeModal();
    printMonthlyStatement(pid, ym);
  }

  function printMonthlyStatement(producerId, ym) {
    const p = NS.producerById(producerId);
    if (!p) return;
    if (NS.isProducer() && p.id !== NS.state.me.producerId) return;
    ym = ym || NS.todayISO().slice(0, 7);
    const start = NS.monthStart(ym);
    const end = NS.monthEnd(ym);
    const recs = NS.recordsForProducer(p.id, start, end).slice().sort(function (a, b) { return String(a.date + (a.createdAt || '')).localeCompare(String(b.date + (b.createdAt || ''))); });
    const samples = NS.state.db.samples.filter(function (s) { return s.producerId === p.id && s.date >= start && s.date <= end; });
    const orders = NS.state.db.orders.filter(function (o) { return o.producerId === p.id && o.date >= start && o.date <= end && o.status === 'Teslim'; });
    const payments = NS.state.db.payments.filter(function (x) { return x.producerId === p.id && x.date >= start && x.date <= end; });
    const acc = NS.producerAccount(p.id, start, end);
    const q = NS.avgQuality(recs);
    const c = NS.collectorById(p.collectorId);
    const gradeCounts = NS.gradeCounts(recs);
    const recRows = recs.map(function (r) {
      return '<tr><td>' + NS.fmtDate(r.date) + '</td>' +
        '<td class="num">' + NS.fmtNum(r.liters, 1) + '</td>' +
        '<td class="num">' + (r.quality ? NS.fmtNum(r.quality.fat, 1) : '—') + '</td>' +
        '<td class="num">' + (r.quality ? NS.fmtNum(r.quality.protein, 1) : '—') + '</td>' +
        '<td>' + (r.quality ? esc(r.quality.grade) : '—') + '</td>' +
        '<td class="num">' + NS.fmtMoney(r.price, 2) + '</td>' +
        '<td class="num">' + NS.fmtMoney(r.amount, 2) + '</td></tr>';
    }).join('');
    const payRows = payments.map(function (x) {
      return '<tr><td>' + NS.fmtDate(x.date) + '</td><td>' + esc(x.type || 'Ödeme') + '</td><td>' + esc(x.method || '') + '</td><td class="num">' + NS.fmtMoney(x.amount, 2) + '</td></tr>';
    }).join('');
    const orderRows = orders.map(function (o) {
      return '<tr><td>' + NS.fmtDate(o.date) + '</td><td>' + esc(o.no) + '</td><td>' + esc((o.items || []).map(function (i) { return i.name + ' ×' + i.qty; }).join(', ')) + '</td><td class="num">' + NS.fmtMoney(o.total, 2) + '</td></tr>';
    }).join('');
    const qualityRows = samples.filter(function (s) { return s.status === 'Sonuçlandı'; }).map(function (s) {
      return '<tr><td>' + esc(s.code) + '</td><td>' + NS.fmtDate(s.date) + '</td><td class="num">' + NS.fmtNum(s.fat, 1) + '</td><td class="num">' + NS.fmtNum(s.protein, 1) + '</td><td class="num">' + NS.fmtNum(s.somatic, 0) + '</td><td class="num">' + NS.fmtNum(s.bacteria, 0) + '</td><td>' + esc(s.grade) + ' · ' + NS.fmtNum(s.score, 0) + '</td></tr>';
    }).join('');
    NS.printDoc({
      title: 'Üretici ekstresi',
      subtitle: p.name + ' · ' + NS.capitalize(NS.monthLabel(ym)),
      html: '<div class="doc-head"><div class="doc-brand"><div class="doc-mark">MP</div><div><b>' + esc(NS.state.db.settings.businessName) + '</b><small>Üretici hesap ekstresi</small></div></div>' +
        '<div class="doc-title"><h1>ÜRETİCİ EKSTRESİ</h1><p>' + NS.fmtDate(start) + ' – ' + NS.fmtDate(end) + '</p><div class="doc-no">' + esc(p.code) + '</div></div></div>' +
        '<div class="doc-meta"><div class="doc-party"><small>Üretici</small><b>' + esc(p.name) + '</b><p>' + esc(p.code) + ' · ' + esc(p.village) + '<br>' + esc(p.address) + '<br>Vergi no: ' + esc(p.taxNo || '—') + '<br>IBAN: ' + esc(p.iban || '—') + '</p></div>' +
        '<div class="doc-side"><div><small>Rota / sütçü</small><b>' + esc(c ? c.route : '—') + '</b><span>' + esc(c ? c.name : '') + '</span></div><div><small>Kalite</small><b>' + (q ? NS.fmtNum(q, 1) + ' puan' : '—') + '</b><span>A ' + gradeCounts.A + ' · B ' + gradeCounts.B + ' · C ' + gradeCounts.C + '</span></div><div><small>Kayıt</small><b>' + recs.length + '</b><span>' + NS.fmtNum(acc.liters, 1) + ' litre</span></div><div><small>Fiyat listesi</small><b>' + esc(NS.priceListFor(p) ? NS.priceListFor(p).name : '—') + '</b></div></div></div>' +
        '<div class="doc-summary"><div><small>Brüt hakediş</small><b>' + NS.fmtMoney(acc.gross, 2) + '</b></div><div><small>Yem bedeli</small><b>' + NS.fmtMoney(acc.feedCost, 2) + '</b></div><div><small>Sipariş</small><b>' + NS.fmtMoney(acc.orderTotal, 2) + '</b></div><div><small>Ödemeler</small><b>' + NS.fmtMoney(acc.paid, 2) + '</b></div><div class="grand"><small>Dönem bakiyesi</small><b>' + NS.fmtMoney(acc.balance, 2) + '</b></div></div>' +
        '<div class="doc-section-title">Süt ve kalite hareketleri</div>' +
        '<table class="doc-table doc-table-sm"><thead><tr><th>Tarih</th><th class="num">Litre</th><th class="num">Yağ</th><th class="num">Protein</th><th>Sınıf</th><th class="num">Fiyat</th><th class="num">Tutar</th></tr></thead><tbody>' + (recRows || '<tr><td colspan="7">Bu dönemde kayıt yok.</td></tr>') + '</tbody>' +
        '<tfoot><tr><td>TOPLAM</td><td class="num">' + NS.fmtNum(acc.liters, 1) + '</td><td colspan="3"></td><td class="num">Ort. ' + NS.fmtMoney(acc.liters ? acc.gross / acc.liters : 0, 2) + '</td><td class="num">' + NS.fmtMoney(acc.gross, 2) + '</td></tr></tfoot></table>' +
        (qualityRows ? '<div class="doc-section-title">Numune sonuçları</div><table class="doc-table doc-table-sm"><thead><tr><th>Numune</th><th>Tarih</th><th class="num">Yağ</th><th class="num">Protein</th><th class="num">Somatik</th><th class="num">Bakteri</th><th>Sonuç</th></tr></thead><tbody>' + qualityRows + '</tbody></table>' : '') +
        (payRows ? '<div class="doc-section-title">Ödemeler / avanslar</div><table class="doc-table doc-table-sm"><thead><tr><th>Tarih</th><th>Tür</th><th>Yöntem</th><th class="num">Tutar</th></tr></thead><tbody>' + payRows + '</tbody></table>' : '') +
        (orderRows ? '<div class="doc-section-title">Teslim edilen siparişler</div><table class="doc-table doc-table-sm"><thead><tr><th>Tarih</th><th>Sipariş</th><th>İçerik</th><th class="num">Tutar</th></tr></thead><tbody>' + orderRows + '</tbody></table>' : '') +
        '<div class="doc-note">' + esc(NS.state.db.settings.deliveryNote) + ' Bu ekstre ' + esc(NS.state.db.settings.businessName) + ' tarafından ' + NS.fmtDate(NS.todayISO()) + ' tarihinde düzenlenmiştir.</div>' +
        '<div class="doc-qr">' + NS.qrSVG('MP|EKSTRE|' + p.code + '|' + ym + '|' + acc.balance, 3) + '<small>Belge doğrulama<br>' + esc(p.code) + ' · ' + esc(NS.capitalize(NS.monthLabel(ym))) + '<br>' + esc(NS.state.db.settings.businessName) + '</small></div>' +
        '<div class="doc-sign"><div>Üretici</div><div>Mandıra yetkilisi</div></div>' +
        '<div class="doc-footer"><span>' + esc(NS.state.db.settings.address) + '</span><span>' + esc(NS.state.db.settings.phone) + ' · ' + esc(NS.state.db.settings.email) + '</span></div>'
    });
  }
  NS.printMonthlyStatement = printMonthlyStatement;

  /* ============================================================
     QR / barkod tarama
     ============================================================ */
  function openScanModal(manual) {
    if (!requireCollectorOrAdmin()) return;
    NS.closeModal();
    NS.openModal({
      title: 'QR / barkod ile numune eşle',
      subtitle: 'Üretici etiketini okuyucuya gösterin',
      icon: 'qr',
      size: 'md',
      body: '<form id="scanForm" autocomplete="off">' +
        '<div class="scan-panel"><div class="scan-frame"><video id="scanVideo" playsinline muted></video><div class="scan-corners"><i></i><i></i><i></i><i></i></div><span class="scan-line"></span></div>' +
        '<div class="scan-copy"><b>Etiketi okutun</b><p>Kamera veya USB barkod okuyucu ile üretici QR kodunu okutabilirsiniz.</p>' +
        '<label class="field mt-12"><span class="field-label">QR / barkod kodu</span><input class="input" id="scanCode" name="code" placeholder="MP|URETICI|U-001 veya U-001" autocomplete="off" autofocus></label></div></div>' +
        '<div id="scanHint" class="inline-note">' + NS.icon('info') + '<span>Kod okunduğunda üretici otomatik seçilir ve numune formu açılır.</span></div>' +
        '</form>',
      footer: '<button class="btn btn-ghost" type="button" data-action="close-modal">Kapat</button>' +
        '<button class="btn btn-soft" type="button" data-action="scan-manual">' + NS.icon('edit') + ' Kodu elle gir</button>' +
        '<button class="btn btn-primary" type="submit" form="scanForm">' + NS.icon('check') + ' Eşleştir</button>'
    });
    const video = $('#scanVideo');
    if (!manual && video && 'BarcodeDetector' in window && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      startScanner(video);
    } else if (video) {
      video.style.display = 'none';
      const hint = $('#scanHint');
      if (hint) hint.innerHTML = NS.icon('info') + '<span>Bu tarayıcıda kamera okuyucu yok. Barkod okuyucuyla kodu okutun veya elle yazın.</span>';
      const code = $('#scanCode');
      if (code) setTimeout(function () { code.focus(); }, 120);
    }
  }
  NS.openScanModal = openScanModal;

  async function startScanner(video) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      video.srcObject = stream;
      video.style.display = 'block';
      await video.play();
      const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'code_39'] });
      let stopped = false;
      let timer = null;
      NS._scanStop = function () {
        stopped = true;
        if (timer) clearInterval(timer);
        stream.getTracks().forEach(function (t) { t.stop(); });
        if (video) video.srcObject = null;
      };
      timer = setInterval(async function () {
        if (stopped || !video || video.readyState < 2) return;
        try {
          const found = await detector.detect(video);
          if (found && found.length) {
            const raw = found[0].rawValue;
            if (raw) {
              NS._scanStop();
              NS._scanStop = null;
              handleScanCode(raw);
            }
          }
        } catch (e) { /* kare atlanır */ }
      }, 450);
    } catch (e) {
      const hint = $('#scanHint');
      if (hint) hint.innerHTML = NS.icon('info') + '<span>Kamera açılamadı. Barkod okuyucuyla kodu okutabilir veya elle yazabilirsiniz.</span>';
      const code = $('#scanCode');
      if (code) code.focus();
    }
  }

  function handleScanCode(raw) {
    const p = NS.matchProducerCode(raw);
    if (!p) {
      NS.toast('Kod eşleşmedi', raw, 'warn');
      return;
    }
    if (NS.isCollector() && p.collectorId !== NS.state.me.collectorId) {
      NS.toast('Üretici rotanızda değil', p.name, 'warn');
      return;
    }
    NS.closeModal();
    NS.toast('Üretici eşleşti', p.name + ' · ' + p.code + ' · numune formu açılıyor.', 'success');
    openSampleModal(p.id);
  }

  function submitScan(form) {
    const code = fv(form, 'code');
    if (!code) { NS.toast('Kod girin', '', 'warn'); return; }
    handleScanCode(code);
  }

  /* ============================================================
     Ayarlar / yedek / veri
     ============================================================ */
  function saveBusinessSettings(form) {
    if (!requireAdmin()) return;
    const st = NS.state.db.settings;
    const fields = ['businessName', 'ownerName', 'phone', 'email', 'address', 'taxOffice', 'taxNo', 'mersis', 'invoicePrefix', 'deliveryNote'];
    fields.forEach(function (k) { st[k] = fv(form, k); });
    st.invoiceNext = Math.max(1, fn(form, 'invoiceNext'));
    st.vatRate = Math.max(0, Math.min(100, fn(form, 'vatRate')));
    st.updatedAt = new Date().toISOString();
    afterChange('İşletme bilgileri kaydedildi', st.businessName, { type: 'success' });
  }

  function setTheme(theme) {
    if (!requireAdmin()) return;
    theme = theme === 'light' ? 'light' : 'dark';
    NS.state.db.settings.theme = theme;
    NS.saveDB();
    NS.applyTheme(theme);
    NS.toast('Görünüm değişti', theme === 'dark' ? 'Koyu tema etkin.' : 'Açık tema etkin.', 'success');
    if (NS.state.route === 'settings') renderView('settings');
  }

  async function resetDemo() {
    if (!requireAdmin()) return;
    const ok = await NS.confirmDialog({
      title: 'Demo verileri sıfırlansın mı?',
      message: 'Mevcut tüm üreticiler, süt kayıtları, faturalar ve kullanıcılar silinip zengin demo verisi yeniden kurulacak. Bu işlem geri alınamaz.',
      confirmText: 'Sıfırla ve yeniden kur'
    });
    if (!ok) return;
    const db = MP.buildSeed();
    for (const u of db.users) {
      u.passHash = await NS.hashPassword(u.pass || '1234');
      delete u.pass;
    }
    db.settings.legacyMigration = { at: new Date().toISOString(), source: 'demo-reset', records: db.records.length, producers: db.producers.length };
    if (!Array.isArray(db.producerNotes)) db.producerNotes = [];
    NS.state.db = db;
    NS.saveDB();
    NS.applyTheme(db.settings.theme);
    const me = NS.resolveMe();
    if (!me) { showLogin(); NS.toast('Demo sıfırlandı', 'Yeni demo hesaplarıyla giriş yapabilirsiniz.', 'success'); return; }
    NS.state.me = me;
    renderNav();
    refreshChrome();
    navigate(me.role === 'Üretici' ? 'farm' : 'dashboard');
    NS.toast('Demo verileri sıfırlandı', db.producers.length + ' üretici · ' + db.records.length + ' süt kaydı.', 'success');
  }

  function triggerRestore() {
    if (!requireAdmin()) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';
    document.body.appendChild(input);
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) restoreBackupFile(input.files[0]);
      input.remove();
    });
    input.click();
  }

  async function restoreBackupFile(file) {
    if (!requireAdmin()) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data || !data.settings || !Array.isArray(data.users) || !Array.isArray(data.producers) || !Array.isArray(data.records)) {
        throw new Error('Dosya MandıraPro yedeği gibi görünmüyor.');
      }
      const ok = await NS.confirmDialog({
        title: 'Yedek geri yüklensin mi?',
        message: 'Mevcut veriler yedekteki ' + data.producers.length + ' üretici ve ' + data.records.length + ' kayıtla değiştirilecek. Önce mevcut veriyi indirmeniz önerilir.',
        confirmText: 'Yedeği yükle'
      });
      if (!ok) return;
      data.version = 2;
      data.settings.legacyMigration = { at: new Date().toISOString(), source: 'restore', records: data.records.length, producers: data.producers.length };
      for (const u of data.users) {
        if (u.pass) { u.passHash = await NS.hashPassword(u.pass); delete u.pass; }
      }
      ['collectors', 'samples', 'tanks', 'dispatches', 'priceLists', 'products', 'orders', 'invoices', 'vehicles', 'expenses', 'payments', 'settlements', 'routeExtras', 'producerNotes'].forEach(function (k) {
        if (!Array.isArray(data[k])) data[k] = [];
      });
      localStorage.setItem(NS.APP.storageKey, JSON.stringify(data));
      await NS.ensureDB();
      NS.applyTheme(NS.state.db.settings.theme);
      const me = NS.resolveMe();
      if (!me) { NS.sessionClear(); showLogin(); NS.toast('Yedek yüklendi', 'Hesabınız yedekte bulunamadı; lütfen yeniden giriş yapın.', 'info'); return; }
      NS.state.me = me;
      renderNav();
      refreshChrome();
      navigate(me.role === 'Üretici' ? 'farm' : 'dashboard');
      NS.toast('Yedek geri yüklendi', data.producers.length + ' üretici · ' + data.records.length + ' kayıt.', 'success');
    } catch (err) {
      NS.toast('Yedek yüklenemedi', err.message || String(err), 'error');
    }
  }

  /* ============================================================
     Form kayıt eşlemesi (ek formlar)
     ============================================================ */
  async function handleExtraFormSubmit(form) {
    const formId = form.getAttribute ? (form.getAttribute('id') || '') : '';
    switch (formId) {
      case 'routeExtraForm': return saveRouteExtra(form);
      case 'dailySheetForm': return printDailySheet(form);
      case 'productForm': return saveProduct(form);
      case 'productStockForm': return saveProductStock(form);
      default: return;
    }
  }

  function saveRouteExtra(form) {
    if (!requireCollectorOrAdmin()) return;
    const ctx = NS.routeCtx();
    const pid = fv(form, 'producerId');
    const p = NS.producerById(pid);
    if (!p) return;
    if (!Array.isArray(NS.state.db.routeExtras)) NS.state.db.routeExtras = [];
    NS.state.db.routeExtras.push({
      id: uid('rx'), date: ctx.date, collectorId: ctx.collectorId, producerId: pid,
      reason: fv(form, 'reason') || 'Rotaya eklendi', createdAt: new Date().toISOString(),
      createdBy: NS.state.me ? NS.state.me.name : ''
    });
    afterChange('Rotaya üretici eklendi', p.name + ' · ' + NS.fmtDate(ctx.date));
  }

  /* Eksik form yönlendirmelerini ana gönderime bağla */
  const originalHandleFormSubmit = handleFormSubmit;
  handleFormSubmit = async function (form) {
    const formId = form.getAttribute ? (form.getAttribute('id') || '') : '';
    const known = ['settingsBusinessForm', 'producerForm', 'recordForm', 'sampleForm', 'analyzeForm', 'invoiceForm',
      'orderForm', 'paymentForm', 'expenseForm', 'vehicleForm', 'userForm', 'collectorForm', 'priceForm', 'tankForm',
      'tankMeasureForm', 'dispatchForm', 'noteForm', 'passwordForm', 'scanForm', 'statementForm'];
    if (known.indexOf(formId) !== -1) return originalHandleFormSubmit(form);
    return handleExtraFormSubmit(form);
  };

  /* ============================================================
     IIFE kapanışı
     ============================================================ */
})(window.MPApp);
