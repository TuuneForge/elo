/* ============================================================
   MandıraPro 2.0 — Çekirdek
   Yardımcılar · roller · hesaplar · yazdırma · QR · Excel
   ============================================================ */
window.MPApp = window.MPApp || {};

(function (NS) {
  'use strict';

  const MP = window.MP;
  NS.APP = MP.APP;
  NS.FEEDS = MP.FEEDS;
  NS.EXPENSE_TYPES = MP.EXPENSE_TYPES;
  NS.PRODUCT_GROUPS = MP.PRODUCT_GROUPS;
  NS.ORDER_STATUSES = MP.ORDER_STATUSES;
  NS.ROLES = MP.ROLES;

  NS.PAGES = {
    dashboard: { title: 'Genel Bakış', sub: 'Operasyonun bugünkü resmi', icon: 'grid', group: 'Operasyon', roles: ['Yönetici'] },
    route: { title: 'Süt Rotası', sub: 'Saha toplama ve durak takibi', icon: 'route', group: 'Operasyon', roles: ['Yönetici', 'Sütçü'] },
    producers: { title: 'Üreticiler', sub: 'Sütçü bazlı üretici kayıtları', icon: 'users', group: 'Operasyon', roles: ['Yönetici', 'Sütçü'] },
    records: { title: 'Süt Kayıtları', sub: 'Toplama, kalite ve yem kayıtları', icon: 'clipboard', group: 'Operasyon', roles: ['Yönetici', 'Sütçü'] },
    quality: { title: 'Numune & Kalite', sub: 'QR eşleme ve laboratuvar sonuçları', icon: 'flask', group: 'Operasyon', roles: ['Yönetici', 'Sütçü'] },
    tank: { title: 'Tank & Sevkiyat', sub: 'Anlık doluluk, sıcaklık ve sevkiyat', icon: 'tank', group: 'Operasyon', roles: ['Yönetici', 'Sütçü'] },
    settlements: { title: 'Tediye', sub: 'Kaliteye göre otomatik hesap ve makbuz', icon: 'receipt', group: 'Ticaret', roles: ['Yönetici'] },
    invoices: { title: 'Faturalar', sub: 'Resmî fatura kesme ve arşiv', icon: 'file-text', group: 'Ticaret', roles: ['Yönetici'] },
    orders: { title: 'Sipariş & Ürün', sub: 'Yem, malzeme ve üretici talepleri', icon: 'package', group: 'Ticaret', roles: ['Yönetici'] },
    accounts: { title: 'Cari Hesap', sub: 'Üretici alacak ve borç dengesi', icon: 'book', group: 'Ticaret', roles: ['Yönetici'] },
    fleet: { title: 'Filo & Masraf', sub: 'Yakıt, bakım, temizlik ve maliyet', icon: 'truck', group: 'Analiz', roles: ['Yönetici'] },
    reports: { title: 'Raporlar', sub: 'Kapsamlı analiz ve dışa aktarım', icon: 'chart', group: 'Analiz', roles: ['Yönetici'] },
    farm: { title: 'Çiftliğim', sub: 'Süt, kalite ve hesap özeti', icon: 'home', group: 'Çiftlik', roles: ['Üretici'] },
    'farm-milk': { title: 'Sütlerim', sub: 'Teslim edilen süt ve kalite sonuçları', icon: 'drop', group: 'Çiftlik', roles: ['Üretici'] },
    'farm-orders': { title: 'Siparişlerim', sub: 'Yem ve malzeme talepleri', icon: 'package', group: 'Çiftlik', roles: ['Üretici'] },
    'farm-account': { title: 'Hesabım', sub: 'Hakediş, yem ve ödeme dökümü', icon: 'book', group: 'Çiftlik', roles: ['Üretici'] },
    users: { title: 'Kullanıcılar', sub: 'Sütçüler, roller ve hesaplar', icon: 'shield', group: 'Sistem', roles: ['Yönetici'] },
    settings: { title: 'Ayarlar', sub: 'İşletme, fiyat listeleri ve yedekleme', icon: 'settings', group: 'Sistem', roles: ['Yönetici'] }
  };
  NS.NAV_ORDER = ['dashboard', 'route', 'producers', 'records', 'quality', 'tank', 'settlements', 'invoices', 'orders', 'accounts', 'fleet', 'reports', 'farm', 'farm-milk', 'farm-orders', 'farm-account', 'users', 'settings'];

  NS.state = {
    db: null,
    me: null,
    route: 'dashboard',
    rec: { range: 'month', date: '', q: '', producer: '', collector: '', grade: '', page: 1, perPage: 12 },
    prod: { q: '', collector: '', status: 'all', view: 'table' },
    qual: { status: 'all', q: '' },
    settlement: { ym: '', half: 'full', collector: '', q: '' },
    invoice: { type: 'all', q: '' },
    fleet: { type: 'all', vehicle: '', q: '' },
    orders: { status: 'all', q: '' },
    report: { range: '30', collector: '', month: '' },
    accounts: { q: '', status: 'all' },
    farm: { tab: 'overview' }
  };

  /* ---------------- Kısayollar / biçim ---------------- */
  NS.$ = function (sel, root) { return (root || document).querySelector(sel); };
  NS.$$ = function (sel, root) { return Array.from((root || document).querySelectorAll(sel)); };
  NS.pad = function (n) { return n < 10 ? '0' + n : '' + n; };

  NS.todayISO = function () {
    const d = new Date();
    return d.getFullYear() + '-' + NS.pad(d.getMonth() + 1) + '-' + NS.pad(d.getDate());
  };
  NS.isoOffset = function (days) {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d.getFullYear() + '-' + NS.pad(d.getMonth() + 1) + '-' + NS.pad(d.getDate());
  };
  NS.monthStart = function (ym) { return ym + '-01'; };
  NS.daysInMonth = function (ym) {
    const p = ym.split('-');
    return new Date(Number(p[0]), Number(p[1]), 0).getDate();
  };
  NS.monthEnd = function (ym) { return ym + '-' + NS.pad(NS.daysInMonth(ym)); };
  NS.prevMonth = function (ym) {
    const p = ym.split('-').map(Number);
    const d = new Date(p[0], p[1] - 2, 1);
    return d.getFullYear() + '-' + NS.pad(d.getMonth() + 1);
  };
  NS.parseDate = function (iso) { return new Date(String(iso).slice(0, 10) + 'T12:00:00'); };
  NS.fmtDate = function (iso) {
    if (!iso) return '—';
    return NS.parseDate(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  NS.fmtDateFull = function (iso) {
    if (!iso) return '—';
    return NS.parseDate(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  NS.fmtDateShort = function (iso) {
    if (!iso) return '—';
    return NS.parseDate(iso).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
  };
  NS.weekday = function (iso) {
    return NS.parseDate(iso).toLocaleDateString('tr-TR', { weekday: 'long' });
  };
  NS.monthLabel = function (ym) {
    return NS.parseDate(ym + '-01').toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
  };
  NS.fmtNum = function (n, digits) {
    const d = digits === undefined ? 0 : digits;
    return Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: d, maximumFractionDigits: d });
  };
  NS.fmtMoney = function (n, digits) {
    const d = digits === undefined ? 0 : digits;
    return NS.fmtNum(n, d) + ' ₺';
  };
  NS.fmtL = function (n, digits) { return NS.fmtNum(n, digits === undefined ? 1 : digits) + ' L'; };
  NS.fmtCompact = function (n) {
    return new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(n) || 0);
  };
  NS.esc = function (s) {
    return String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  NS.uid = function (prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  };
  NS.clamp = function (v, min, max) { return Math.min(max, Math.max(min, v)); };
  NS.sum = function (arr) { return arr.reduce(function (a, b) { return a + Number(b || 0); }, 0); };
  NS.round = function (v, d) { const m = Math.pow(10, d || 0); return Math.round((Number(v) || 0) * m) / m; };
  NS.pct = function (a, b) { if (!b) return null; return (a - b) / b * 100; };
  NS.daysBetween = function (a, b) {
    return Math.round((NS.parseDate(b) - NS.parseDate(a)) / 86400000);
  };
  NS.daysUntil = function (iso) {
    if (!iso) return null;
    return NS.daysBetween(NS.todayISO(), iso);
  };
  NS.capitalize = function (s) {
    s = String(s || '');
    return s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1);
  };
  NS.initials = function (name) {
    const parts = String(name || '?').trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };
  const AV = [
    ['#2f6b4f', '#5b9672'], ['#a4602f', '#c98f5c'], ['#365d7a', '#6b90aa'],
    ['#7d5a3c', '#a98560'], ['#6b7f4a', '#93a86b'], ['#8a5a5a', '#b98282'],
    ['#4f6b63', '#7f9b92'], ['#8a6f3f', '#b99a66']
  ];
  NS.avatarGradient = function (name) {
    let h = 0;
    const s = String(name || '');
    for (let i = 0; i < s.length; i++) h = (h + s.charCodeAt(i) * (i + 1)) % 997;
    const g = AV[h % AV.length];
    return 'linear-gradient(135deg,' + g[0] + ',' + g[1] + ')';
  };
  NS.avatarHTML = function (name, extra) {
    return '<span class="avatar ' + (extra || '') + '" style="background:' + NS.avatarGradient(name) + '">' + NS.esc(NS.initials(name)) + '</span>';
  };
  NS.icon = function (name, cls) {
    return '<svg class="icon ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
  };
  NS.relTime = function (iso) {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const min = 60000, hour = 3600000, day = 86400000;
    if (isNaN(diff)) return NS.fmtDateShort(iso);
    if (diff < min) return 'az önce';
    if (diff < hour) return Math.floor(diff / min) + ' dk önce';
    if (diff < day) return Math.floor(diff / hour) + ' sa önce';
    if (diff < 2 * day) return 'dün';
    return NS.fmtDateShort(iso);
  };
  NS.clockTR = function (date) {
    return new Date(date || Date.now()).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  };
  NS.greeting = function () {
    const h = new Date().getHours();
    if (h < 6) return 'İyi geceler';
    if (h < 12) return 'Günaydın';
    if (h < 18) return 'İyi günler';
    return 'İyi akşamlar';
  };
  NS.periodRange = function (ym, half) {
    const start = ym + '-01';
    const end = NS.monthEnd(ym);
    if (half === '1') return { start: start, end: ym + '-15', label: NS.monthLabel(ym) + ' · 1. yarı' };
    if (half === '2') return { start: ym + '-16', end: end, label: NS.monthLabel(ym) + ' · 2. yarı' };
    return { start: start, end: end, label: NS.monthLabel(ym) };
  };
  NS.debounce = function (fn, wait) {
    let t = null;
    return function () {
      const args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait || 180);
    };
  };

  /* ---------------- Rol / kapsam ---------------- */
  NS.role = function () { return NS.state.me ? NS.state.me.role : null; };
  NS.isAdmin = function () { return NS.role() === 'Yönetici'; };
  NS.isCollector = function () { return NS.role() === 'Sütçü'; };
  NS.isProducer = function () { return NS.role() === 'Üretici'; };
  NS.canCollect = function () { return NS.isAdmin() || NS.isCollector(); };
  NS.myCollector = function () {
    if (!NS.state.me) return null;
    if (NS.isCollector()) return NS.collectorById(NS.state.me.collectorId);
    return null;
  };
  NS.myProducer = function () {
    if (!NS.state.me || !NS.isProducer()) return null;
    return NS.producerById(NS.state.me.producerId);
  };
  NS.visibleProducers = function () {
    const db = NS.state.db;
    if (!db) return [];
    if (NS.isProducer()) {
      const p = NS.myProducer();
      return p ? [p] : [];
    }
    if (NS.isCollector()) {
      return db.producers.filter(function (p) { return p.collectorId === NS.state.me.collectorId; });
    }
    return db.producers;
  };
  NS.visibleCollectors = function () {
    const db = NS.state.db;
    if (!db) return [];
    if (NS.isCollector()) return db.collectors.filter(function (c) { return c.id === NS.state.me.collectorId; });
    return db.collectors;
  };
  NS.visibleRecords = function () {
    const db = NS.state.db;
    if (!db) return [];
    if (NS.isProducer()) {
      const p = NS.myProducer();
      return p ? db.records.filter(function (r) { return r.producerId === p.id; }) : [];
    }
    if (NS.isCollector()) {
      const cid = NS.state.me.collectorId;
      return db.records.filter(function (r) { return r.collectorId === cid; });
    }
    return db.records;
  };
  NS.canSeeProducer = function (id) {
    if (NS.isAdmin()) return true;
    return NS.visibleProducers().some(function (p) { return p.id === id; });
  };

  /* ---------------- Kayıt erişimi ---------------- */
  NS.producerById = function (id) { return (NS.state.db ? NS.state.db.producers.find(function (p) { return p.id === id; }) : null) || null; };
  NS.collectorById = function (id) { return (NS.state.db ? NS.state.db.collectors.find(function (c) { return c.id === id; }) : null) || null; };
  NS.tankById = function (id) { return (NS.state.db ? NS.state.db.tanks.find(function (t) { return t.id === id; }) : null) || null; };
  NS.vehicleById = function (id) { return (NS.state.db ? NS.state.db.vehicles.find(function (v) { return v.id === id; }) : null) || null; };
  NS.productById = function (id) { return (NS.state.db ? NS.state.db.products.find(function (p) { return p.id === id; }) : null) || null; };
  NS.priceListById = function (id) { return (NS.state.db ? NS.state.db.priceLists.find(function (p) { return p.id === id; }) : null) || null; };
  NS.userById = function (id) { return (NS.state.db ? NS.state.db.users.find(function (u) { return u.id === id; }) : null) || null; };
  NS.priceListFor = function (producer) {
    const db = NS.state.db;
    if (!db) return null;
    if (producer && producer.priceListId) {
      const pl = NS.priceListById(producer.priceListId);
      if (pl) return pl;
    }
    return db.priceLists[0] || null;
  };
  NS.basePriceFor = function (producer) {
    const pl = NS.priceListFor(producer);
    return pl ? Number(pl.basePrice) : Number(NS.state.db.settings.milkPrice || 0);
  };
  NS.priceFor = function (producer, grade) {
    const pl = NS.priceListFor(producer);
    if (!pl) return Number(NS.state.db.settings.milkPrice || 0);
    const delta = (pl.gradeDelta && pl.gradeDelta[grade || 'B']) || 0;
    return NS.round(Number(pl.basePrice) + delta, 2);
  };
  NS.amountOfRecord = function (r) {
    if (!r) return 0;
    if (r.amount !== undefined && r.amount !== null) return Number(r.amount);
    const p = NS.producerById(r.producerId);
    const grade = r.quality ? r.quality.grade : 'B';
    return NS.round((Number(r.liters || r.milk) || 0) * NS.priceFor(p, grade), 2);
  };
  NS.feedCostOf = function (feeds) {
    const prices = NS.state.db.settings.feedPrices || {};
    return NS.round(MP.FEEDS.reduce(function (s, f) {
      return s + (Number(feeds && feeds[f.key]) || 0) * (Number(prices[f.key]) || 0);
    }, 0), 2);
  };
  NS.feedKgOf = function (feeds) {
    return MP.FEEDS.reduce(function (s, f) { return s + (Number(feeds && feeds[f.key]) || 0); }, 0);
  };
  NS.feedEntries = function (feeds) {
    return MP.FEEDS.map(function (f) {
      return { key: f.key, label: f.label, short: f.short, color: f.color, kg: Number(feeds && feeds[f.key]) || 0 };
    }).filter(function (f) { return f.kg > 0; });
  };
  NS.feedText = function (feeds) {
    return NS.feedEntries(feeds).map(function (f) {
      return f.label + ' ' + NS.fmtNum(f.kg, 1);
    }).join(' · ');
  };
  NS.feedCellHTML = function (feeds) {
    const entries = NS.feedEntries(feeds);
    if (!entries.length) return '<span class="faint">yem yok</span>';
    return '<b>' + NS.fmtNum(NS.feedKgOf(feeds), 1) + ' kg</b>' +
      '<div class="feed-breakdown">' + entries.map(function (f) {
        return '<span class="feed-part"><i style="background:' + f.color + '"></i>' + NS.esc(f.label) + ' ' + NS.fmtNum(f.kg, 1) + '</span>';
      }).join('') + '</div>';
  };
  NS.recordsIn = function (start, end, list) {
    const arr = list || NS.visibleRecords();
    return arr.filter(function (r) { return r.date >= start && r.date <= end; });
  };
  NS.recordsOn = function (date, list) { return (list || NS.visibleRecords()).filter(function (r) { return r.date === date; }); };
  NS.monthRecords = function (ym, list) { return NS.recordsIn(NS.monthStart(ym), NS.monthEnd(ym), list); };
  NS.recordsForProducer = function (producerId, start, end) {
    return NS.state.db.records.filter(function (r) {
      return r.producerId === producerId && (!start || r.date >= start) && (!end || r.date <= end);
    });
  };
  NS.sumLiters = function (records) { return NS.round(NS.sum(records.map(function (r) { return Number(r.liters || r.milk) || 0; })), 1); };
  NS.sumAmount = function (records) { return NS.sum(records.map(NS.amountOfRecord)); };
  NS.sumFeedCost = function (records) { return NS.sum(records.map(function (r) { return NS.feedCostOf(r.feeds); })); };
  NS.sumFeedKg = function (records) { return NS.sum(records.map(function (r) { return NS.feedKgOf(r.feeds); })); };
  NS.avgQuality = function (records) {
    const qs = records.map(function (r) { return r.quality && r.quality.score; }).filter(function (x) { return typeof x === 'number'; });
    if (!qs.length) return null;
    return NS.round(NS.sum(qs) / qs.length, 1);
  };
  NS.gradeCounts = function (records) {
    const out = { A: 0, B: 0, C: 0, '-': 0 };
    records.forEach(function (r) {
      const g = r.quality ? r.quality.grade : '-';
      out[g] = (out[g] || 0) + 1;
    });
    return out;
  };
  NS.qualityTone = function (grade) {
    return grade === 'A' ? 'success' : grade === 'B' ? 'info' : grade === 'C' ? 'danger' : 'muted';
  };
  NS.qualityBadge = function (grade, score) {
    if (!grade) return '<span class="badge">—</span>';
    return '<span class="badge ' + NS.qualityTone(grade) + ' q-badge"><b>' + grade + '</b>' + (score ? '<span>' + NS.fmtNum(score, 0) + '</span>' : '') + '</span>';
  };
  NS.statusTone = function (status) {
    const map = {
      'Ödendi': 'success', 'Kesildi': 'success', 'Teslim': 'success', 'Onaylandı': 'info',
      'Hazır': 'info', 'Analizde': 'info', 'Taslak': 'warn', 'Talep': 'warn', 'Bekliyor': 'warn',
      'Hazırlanıyor': 'warn', 'Toplandı': 'success'
    };
    return map[status] || 'primary';
  };
  NS.badge = function (status) {
    return '<span class="badge ' + NS.statusTone(status) + '">' + NS.esc(status) + '</span>';
  };
  NS.dotBadge = function (label, tone) {
    return '<span class="live-badge ' + (tone || '') + '"><i class="dot"></i>' + NS.esc(label) + '</span>';
  };

  /* ---------------- Akıllı litre aralığı ---------------- */
  NS.expectedLiters = function (producerId) {
    const today = NS.todayISO();
    const from = NS.isoOffset(-21);
    const recs = NS.state.db.records.filter(function (r) {
      return r.producerId === producerId && r.date >= from && r.date < today;
    }).slice(-21);
    const p = NS.producerById(producerId);
    if (recs.length < 3) {
      const base = p ? Number(p.baseLiters) || 0 : 0;
      return { avg: base, min: base * 0.7, max: base * 1.3, std: 0, samples: recs.length, source: 'base' };
    }
    const vals = recs.map(function (r) { return Number(r.liters || r.milk) || 0; });
    const avg = NS.sum(vals) / vals.length;
    const variance = vals.reduce(function (s, v) { return s + Math.pow(v - avg, 2); }, 0) / vals.length;
    const std = Math.sqrt(variance);
    const margin = Math.max(avg * 0.16, std * 2.1, 4);
    return {
      avg: NS.round(avg, 1),
      min: NS.round(Math.max(0, avg - margin), 1),
      max: NS.round(avg + margin, 1),
      std: NS.round(std, 1),
      samples: vals.length,
      source: 'history'
    };
  };
  NS.literWarning = function (producerId, liters, date, session) {
    const p = NS.producerById(producerId);
    if (!p) return null;
    const dup = NS.state.db.records.find(function (r) {
      return r.producerId === producerId && r.date === date;
    });
    if (dup) return { type: 'duplicate', message: p.name + ' için ' + date + ' tarihli kayıt zaten var.', expected: null };
    const exp = NS.expectedLiters(producerId);
    const v = Number(liters) || 0;
    if (exp.samples >= 3 && v > 0 && (v < exp.min || v > exp.max)) {
      return {
        type: v > exp.max ? 'high' : 'low',
        message: v > exp.max ? 'Bu litre, üreticinin son 3 haftalık ortalamasının üzerinde.' : 'Bu litre, üreticinin son 3 haftalık ortalamasının altında.',
        expected: exp
      };
    }
    return null;
  };

  /* ---------------- Rota ---------------- */
  NS.routeStops = function (collectorId, date, session) {
    const db = NS.state.db;
    const base = db.producers.filter(function (p) { return p.collectorId === collectorId && p.active; });
    const extras = db.routeExtras.filter(function (x) {
      return x.collectorId === collectorId && x.date === date;
    });
    const extraProducerIds = {};
    extras.forEach(function (x) { extraProducerIds[x.producerId] = x; });
    const ids = {};
    const stops = [];
    base.forEach(function (p) {
      ids[p.id] = true;
      const rec = db.records.find(function (r) {
        return r.producerId === p.id && r.date === date && (!session || r.session === session);
      });
      stops.push({ producer: p, extra: null, record: rec || null, expected: NS.expectedLiters(p.id) });
    });
    extras.forEach(function (x) {
      if (ids[x.producerId]) return;
      const p = NS.producerById(x.producerId);
      if (!p) return;
      ids[p.id] = true;
      const rec = db.records.find(function (r) {
        return r.producerId === p.id && r.date === date && (!session || r.session === session);
      });
      stops.push({ producer: p, extra: x, record: rec || null, expected: NS.expectedLiters(p.id) });
    });
    stops.sort(function (a, b) {
      if (!!a.extra !== !!b.extra) return a.extra ? 1 : -1;
      return (a.producer.sira || 0) - (b.producer.sira || 0);
    });
    return stops;
  };
  NS.routeStats = function (collectorId, date, session) {
    const stops = NS.routeStops(collectorId, date, session);
    const done = stops.filter(function (s) { return s.record; });
    return {
      stops: stops,
      total: stops.length,
      done: done.length,
      pending: stops.length - done.length,
      liters: NS.sumLiters(done.map(function (s) { return s.record; })),
      expected: NS.round(NS.sum(stops.map(function (s) { return s.expected.avg; })), 1),
      pct: stops.length ? Math.round(done.length / stops.length * 100) : 0
    };
  };
  NS.defaultSession = function () {
    return 'Sabah';
  };

  /* ---------------- Tank ---------------- */
  NS.tankPct = function (t) { return t && t.capacity ? NS.clamp(t.current / t.capacity * 100, 0, 100) : 0; };
  NS.tankTotal = function () {
    const tanks = NS.state.db.tanks;
    return {
      current: NS.sum(tanks.map(function (t) { return t.current; })),
      capacity: NS.sum(tanks.map(function (t) { return t.capacity; })),
      pct: tanks.length ? NS.round(NS.sum(tanks.map(function (t) { return t.current; })) / NS.sum(tanks.map(function (t) { return t.capacity; })) * 100, 0) : 0
    };
  };

  /* ---------------- Cari / tediye ---------------- */
  NS.producerAccount = function (producerId, start, end) {
    const s = start || '0000-01-01';
    const e = end || '9999-12-31';
    const recs = NS.state.db.records.filter(function (r) { return r.producerId === producerId && r.date >= s && r.date <= e; });
    const orders = NS.state.db.orders.filter(function (o) {
      return o.producerId === producerId && o.date >= s && o.date <= e && o.status === 'Teslim';
    });
    const pays = NS.state.db.payments.filter(function (p) { return p.producerId === producerId && p.date >= s && p.date <= e; });
    const liters = NS.sumLiters(recs);
    const gross = NS.round(NS.sumAmount(recs), 2);
    const feedCost = NS.round(NS.sumFeedCost(recs), 2);
    const orderTotal = NS.round(NS.sum(orders.map(function (o) { return o.total; })), 2);
    const paid = NS.round(NS.sum(pays.map(function (p) { return p.amount; })), 2);
    return {
      liters: liters, gross: gross, feedCost: feedCost, orderTotal: orderTotal,
      paid: paid, balance: NS.round(gross - feedCost - orderTotal - paid, 2),
      records: recs.length, orders: orders.length
    };
  };
  NS.settlementCalc = function (producerId, start, end) {
    const db = NS.state.db;
    const p = NS.producerById(producerId);
    const recs = db.records.filter(function (r) { return r.producerId === producerId && r.date >= start && r.date <= end; });
    const basePrice = NS.basePriceFor(p);
    const liters = NS.sumLiters(recs);
    const gross = NS.round(NS.sumAmount(recs), 2);
    const baseGross = NS.round(liters * basePrice, 2);
    const feedCost = NS.round(NS.sumFeedCost(recs), 2);
    const advances = NS.round(NS.sum(db.payments.filter(function (x) {
      return x.producerId === producerId && x.date >= start && x.date <= end;
    }).map(function (x) { return x.amount; })), 2);
    const grades = NS.gradeCounts(recs);
    const avgQuality = NS.avgQuality(recs);
    const existing = db.settlements.find(function (s) {
      return s.producerId === producerId && s.periodStart === start && s.periodEnd === end;
    });
    return {
      producer: p,
      producerId: producerId,
      periodStart: start,
      periodEnd: end,
      records: recs,
      count: recs.length,
      liters: liters,
      gross: gross,
      basePrice: basePrice,
      baseGross: baseGross,
      premium: NS.round(gross - baseGross, 2),
      feedCost: feedCost,
      advances: advances,
      net: NS.round(gross - feedCost - advances, 2),
      grades: grades,
      avgQuality: avgQuality,
      avgPrice: liters ? NS.round(gross / liters, 2) : 0,
      existing: existing || null,
      status: existing ? existing.status : 'Hazır',
      receiptNo: existing ? existing.receiptNo : null
    };
  };
  NS.settlementBatch = function (start, end, collectorId) {
    const rows = [];
    NS.visibleProducers().forEach(function (p) {
      if (collectorId && p.collectorId !== collectorId) return;
      const calc = NS.settlementCalc(p.id, start, end);
      if (calc.count > 0 || calc.advances > 0) rows.push(calc);
    });
    return rows.sort(function (a, b) { return b.net - a.net; });
  };
  NS.nextNumber = function (prefix, current) {
    return prefix + '-' + new Date().getFullYear() + '-' + String(current || 1).padStart(4, '0');
  };
  NS.nextInvoiceNo = function () {
    const s = NS.state.db.settings;
    return NS.nextNumber(s.invoicePrefix || 'FTR', s.invoiceNext || 1);
  };
  NS.nextReceiptNo = function (ym) {
    const count = NS.state.db.settlements.length + 1;
    return 'TDI-' + String(ym || NS.todayISO().slice(0, 7)).replace('-', '') + '-' + String(count).padStart(3, '0');
  };

  /* ---------------- Uyarılar / akış ---------------- */
  NS.alerts = function () {
    const db = NS.state.db;
    const out = [];
    const today = NS.todayISO();
    const nowHour = new Date().getHours();

    db.tanks.forEach(function (t) {
      const pct = NS.tankPct(t);
      if (pct >= 82) {
        out.push({ id: 'tank-' + t.id, tone: 'warn', icon: 'tank', title: t.name + ' %' + Math.round(pct) + ' dolu', text: NS.fmtNum(t.current, 0) + ' L / ' + NS.fmtNum(t.capacity, 0) + ' L · sevkiyat planlayın.', view: 'tank' });
      }
      if (Number(t.temperature) > 6) {
        out.push({ id: 'temp-' + t.id, tone: 'danger', icon: 'thermometer', title: t.name + ' sıcaklığı yüksek', text: NS.fmtNum(t.temperature, 1) + ' °C · soğutma kontrol edilmeli.', view: 'tank' });
      }
    });

    if (NS.canCollect() && nowHour >= 9) {
      NS.visibleCollectors().forEach(function (c) {
        const stat = NS.routeStats(c.id, today, 'Sabah');
        if (stat.pending > 0) {
          out.push({ id: 'route-' + c.id, tone: 'info', icon: 'route', title: c.route + ' · ' + stat.pending + ' durak bekliyor', text: stat.done + '/' + stat.total + ' tamamlandı. Kalan tahmini ' + NS.fmtNum(NS.sum(stat.stops.filter(function (s) { return !s.record; }).map(function (s) { return s.expected.avg; })), 0) + ' L.', view: 'route' });
        }
      });
    }

    const weekAgo = NS.isoOffset(-7);
    const badSamples = db.samples.filter(function (s) { return s.date >= weekAgo && s.status === 'Sonuçlandı' && s.grade === 'C'; });
    if (badSamples.length) {
      out.push({ id: 'quality-c', tone: 'danger', icon: 'flask', title: badSamples.length + ' numune C sınıfı', text: 'Son 7 günde kalite eşiğinin altında kalan numune var. Tediye fiyatı düşer.', view: 'quality' });
    }

    const anomalies = [];
    NS.recordsOn(today).forEach(function (r) {
      const exp = NS.expectedLiters(r.producerId);
      const v = Number(r.liters || r.milk) || 0;
      if (exp.samples >= 3 && v > 0 && (v < exp.min || v > exp.max)) anomalies.push({ r: r, exp: exp, v: v });
    });
    if (anomalies.length) {
      const a = anomalies[0];
      const p = NS.producerById(a.r.producerId);
      out.push({ id: 'anomaly', tone: 'warn', icon: 'activity', title: 'Akıllı litre uyarısı · ' + (p ? p.name : ''), text: NS.fmtNum(a.v, 1) + ' L girildi; beklenen ' + NS.fmtNum(a.exp.min, 1) + '–' + NS.fmtNum(a.exp.max, 1) + ' L.', view: 'records' });
    }

    db.vehicles.forEach(function (v) {
      const ins = NS.daysUntil(v.insuranceUntil);
      const insp = NS.daysUntil(v.inspectionUntil);
      if (ins !== null && ins <= 45) {
        out.push({ id: 'ins-' + v.id, tone: ins < 15 ? 'danger' : 'warn', icon: 'shield', title: v.plate + ' sigorta ' + (ins < 0 ? 'gecikti' : ins + ' gün kaldı'), text: 'Poliçe bitiş: ' + NS.fmtDate(v.insuranceUntil), view: 'fleet' });
      }
      if (insp !== null && insp <= 45) {
        out.push({ id: 'insp-' + v.id, tone: 'warn', icon: 'truck', title: v.plate + ' muayene ' + (insp < 0 ? 'gecikti' : insp + ' gün kaldı'), text: 'Muayene bitiş: ' + NS.fmtDate(v.inspectionUntil), view: 'fleet' });
      }
    });

    const lowStock = db.products.filter(function (p) { return Number(p.stock) <= Number(p.minStock); });
    if (lowStock.length) {
      out.push({ id: 'stock', tone: 'warn', icon: 'package', title: lowStock.length + ' üründe stok azaldı', text: lowStock.slice(0, 2).map(function (p) { return p.name; }).join(', ') + '.', view: 'orders' });
    }

    const waiting = db.settlements.filter(function (s) { return s.status === 'Onaylandı'; });
    if (waiting.length) {
      out.push({ id: 'settle', tone: 'info', icon: 'receipt', title: waiting.length + ' tediye onay bekliyor', text: NS.monthLabel(waiting[0].periodStart.slice(0, 7)) + ' dönemi ödeme için hazır.', view: 'settlements' });
    }

    return out.slice(0, 9);
  };

  NS.activity = function (limit) {
    const db = NS.state.db;
    const events = [];
    db.records.slice(-120).forEach(function (r) {
      if (!NS.canSeeProducer(r.producerId)) return;
      const p = NS.producerById(r.producerId);
      if (!p) return;
      events.push({
        at: r.createdAt || (r.date + 'T08:00:00'),
        icon: 'drop', tone: 'milk', title: NS.fmtNum(r.liters, 1) + ' L süt alındı',
        sub: p.name + ' · ' + (NS.collectorById(r.collectorId) ? NS.collectorById(r.collectorId).route : '') + (r.quality ? ' · ' + r.quality.grade + ' kalite' : ''),
        view: 'records'
      });
    });
    db.samples.filter(function (s) { return s.status === 'Sonuçlandı'; }).slice(-20).forEach(function (s) {
      const p = NS.producerById(s.producerId);
      if (!p) return;
      events.push({
        at: s.analyzedAt || (s.date + 'T14:00:00'), icon: 'flask', tone: s.grade === 'C' ? 'danger' : 'quality',
        title: 'Numune sonucu · ' + s.grade + ' sınıfı', sub: p.name + ' · skor ' + NS.fmtNum(s.score, 0), view: 'quality'
      });
    });
    db.orders.slice(-15).forEach(function (o) {
      const p = NS.producerById(o.producerId);
      if (!p) return;
      events.push({
        at: o.createdAt || (o.date + 'T10:00:00'), icon: 'package', tone: o.status === 'Teslim' ? 'done' : 'order',
        title: 'Sipariş ' + (o.status === 'Talep' ? 'talebi' : o.status.toLowerCase()), sub: p.name + ' · ' + o.no + ' · ' + NS.fmtMoney(o.total, 0), view: 'orders'
      });
    });
    db.payments.slice(-10).forEach(function (p) {
      const pr = NS.producerById(p.producerId);
      if (!pr) return;
      events.push({
        at: p.createdAt || (p.date + 'T12:00:00'), icon: 'wallet', tone: 'money',
        title: (p.type || 'Ödeme') + ' · ' + NS.fmtMoney(p.amount, 0), sub: pr.name + ' · ' + (p.method || 'Havale'), view: 'accounts'
      });
    });
    events.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    return events.slice(0, limit || 8);
  };

  /* ---------------- Depolama / oturum ---------------- */
  NS.saveDB = function () {
    try {
      localStorage.setItem(NS.APP.storageKey, JSON.stringify(NS.state.db));
    } catch (e) {
      NS.toast('Kaydedilemedi', 'Tarayıcı depolama alanı dolu olabilir. Yedek alıp eski kayıtları azaltın.', 'error');
    }
  };
  NS.sessionGet = function () {
    try { return JSON.parse(sessionStorage.getItem(NS.APP.sessionKey) || 'null'); } catch (e) { return null; }
  };
  NS.sessionSet = function (userId) {
    try { sessionStorage.setItem(NS.APP.sessionKey, JSON.stringify({ userId: userId, at: Date.now() })); } catch (e) { /* yoksay */ }
  };
  NS.sessionClear = function () {
    try { sessionStorage.removeItem(NS.APP.sessionKey); } catch (e) { /* yoksay */ }
  };
  NS.resolveMe = function () {
    const s = NS.sessionGet();
    if (!s || !NS.state.db) return null;
    return NS.state.db.users.find(function (u) { return u.id === s.userId; }) || null;
  };

  NS.hashPassword = async function (str) {
    str = String(str);
    if (window.crypto && window.crypto.subtle) {
      try {
        const buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
        return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
      } catch (e) { /* geri dön */ }
    }
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < str.length; i++) {
      const c = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
      h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
    }
    return 'fnv' + h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0');
  };

  NS.ensureDB = async function () {
    let db = null;
    let legacy = null;
    try {
      const raw = localStorage.getItem(NS.APP.storageKey);
      db = raw ? JSON.parse(raw) : null;
      const legacyRaw = localStorage.getItem(NS.APP.legacyKey);
      legacy = legacyRaw ? JSON.parse(legacyRaw) : null;
    } catch (e) { db = null; }

    const valid = db && db.settings && Array.isArray(db.users) && Array.isArray(db.producers) && Array.isArray(db.records);
    /* Bu makinedeki ilk 2.0 demo defteri, 1.0 verisi sanılarak açılmadan
       önce fark edilir. Kullanıcı verisi oluşmuş defterlere dokunulmaz. */
    const untouchedDemo = valid && !db.settings.legacyMigration &&
      db.version === 2 && db.producers.length === 15 && db.records.length === 1605;

    if (!valid || untouchedDemo) {
      if (untouchedDemo || legacy) {
        db = MP.migrateLegacy(legacy, MP.buildSeed());
      } else {
        db = MP.buildSeed();
      }
    }

    /* Eski/yarım kayıtları tamamla */
    const seed = MP.buildSeed();
    let changed = !valid || untouchedDemo;
    ['collectors', 'producers', 'samples', 'tanks', 'dispatches', 'priceLists', 'products', 'orders', 'invoices', 'vehicles', 'expenses', 'payments', 'settlements', 'routeExtras', 'producerNotes'].forEach(function (k) {
      if (!Array.isArray(db[k])) { db[k] = seed[k]; changed = true; }
    });
    if (!db.settings.feedPrices) { db.settings.feedPrices = seed.settings.feedPrices; changed = true; }
    if (!db.settings.quality) { db.settings.quality = seed.settings.quality; changed = true; }
    if (!db.settings.invoicePrefix) { db.settings.invoicePrefix = 'EMP'; changed = true; }
    if (!db.settings.invoiceNext) { db.settings.invoiceNext = 1; changed = true; }
    if (!db.settings.theme) { db.settings.theme = 'light'; changed = true; }
    if (!db.settings.vatRate) { db.settings.vatRate = 20; changed = true; }
    if (!db.version || db.version < 2) { db.version = 2; changed = true; }
    if (!db.settings.legacyMigration) {
      db.settings.legacyMigration = {
        at: new Date().toISOString(),
        source: legacy ? 'v1' : 'demo',
        records: db.records.length,
        producers: db.producers.length
      };
      changed = true;
    }

    for (const u of db.users) {
      if (u.pass) { u.passHash = await NS.hashPassword(u.pass); delete u.pass; changed = true; }
    }
    NS.state.db = db;
    if (changed) NS.saveDB();
    return db;
  };

  /* ---------------- Tema ---------------- */
  NS.applyTheme = function (theme) {
    theme = theme === 'dark' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    const ic = NS.$('#themeIcon use');
    if (ic) ic.setAttribute('href', theme === 'dark' ? '#i-sun' : '#i-moon');
  };
  NS.toggleTheme = function () {
    const db = NS.state.db;
    if (!db) return;
    db.settings.theme = db.settings.theme === 'dark' ? 'light' : 'dark';
    NS.saveDB();
    NS.applyTheme(db.settings.theme);
  };

  /* ---------------- Bildirim ---------------- */
  NS.toast = function (title, message, type) {
    const root = NS.$('#toastRoot');
    if (!root) return;
    type = type || 'success';
    const icons = { success: 'check', error: 'alert', warn: 'alert', info: 'info' };
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.innerHTML =
      '<span class="toast-ico">' + NS.icon(icons[type] || 'info') + '</span>' +
      '<div class="toast-body"><b>' + NS.esc(title) + '</b>' + (message ? '<span>' + NS.esc(message) + '</span>' : '') + '</div>' +
      '<button class="toast-x" type="button" aria-label="Kapat">' + NS.icon('x') + '</button>' +
      '<span class="toast-progress"></span>';
    root.appendChild(el);
    let closed = false;
    function remove() {
      if (closed) return;
      closed = true;
      el.classList.add('out');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 260);
    }
    el.querySelector('.toast-x').addEventListener('click', remove);
    setTimeout(remove, 4600);
  };

  /* ---------------- Katmanlar ---------------- */
  NS.updateOverflow = function () {
    const modalOpen = NS.$('#modalRoot') && NS.$('#modalRoot').children.length > 0;
    const drawerOpen = NS.$('#drawerRoot') && NS.$('#drawerRoot').children.length > 0;
    const paletteOpen = NS.$('#paletteRoot') && NS.$('#paletteRoot').children.length > 0;
    const sb = NS.$('#sidebarBackdrop');
    const sbOpen = sb && !sb.hidden;
    const sheet = NS.$('#mobileSheet');
    const sheetOpen = sheet && !sheet.hidden;
    document.body.style.overflow = (modalOpen || drawerOpen || paletteOpen || sbOpen || sheetOpen) ? 'hidden' : '';
  };

  NS.openModal = function (opts) {
    opts = opts || {};
    const root = NS.$('#modalRoot');
    if (!root) return;
    const iconHTML = opts.icon ? '<div class="modal-ico">' + NS.icon(opts.icon) + '</div>' : '';
    root.innerHTML =
      '<div class="modal-backdrop" data-action="close-modal">' +
        '<div class="modal' + (opts.size ? ' ' + opts.size : '') + '" role="dialog" aria-modal="true">' +
          '<div class="modal-head">' + iconHTML +
            '<div><h3>' + NS.esc(opts.title) + '</h3>' + (opts.subtitle ? '<p>' + NS.esc(opts.subtitle) + '</p>' : '') + '</div>' +
            '<button class="icon-btn sm" type="button" data-action="close-modal" aria-label="Kapat">' + NS.icon('x') + '</button>' +
          '</div>' +
          '<div class="modal-body">' + (opts.body || '') + '</div>' +
          (opts.footer ? '<div class="modal-foot">' + opts.footer + '</div>' : '') +
        '</div>' +
      '</div>';
    NS.enhanceTables(root);
    NS.updateOverflow();
    setTimeout(function () {
      const f = NS.$('#modalRoot .modal-body input:not([type=hidden]):not([type=checkbox]), #modalRoot .modal-body select, #modalRoot .modal-body textarea');
      if (f) f.focus();
    }, 80);
  };
  NS.closeModal = function () {
    if (NS._confirmResolve) { NS.settleConfirm(false); return; }
    const root = NS.$('#modalRoot');
    if (root) root.innerHTML = '';
    NS.updateOverflow();
  };

  NS.confirmDialog = function (opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      NS._confirmResolve = resolve;
      const root = NS.$('#modalRoot');
      root.innerHTML =
        '<div class="modal-backdrop" data-action="close-modal">' +
          '<div class="modal sm" role="dialog" aria-modal="true">' +
            '<div class="modal-head">' +
              '<div class="modal-ico confirm-ico">' + NS.icon('alert') + '</div>' +
              '<div><h3>' + NS.esc(opts.title || 'Emin misiniz?') + '</h3>' +
              (opts.message ? '<p>' + NS.esc(opts.message) + '</p>' : '') + '</div>' +
              '<button class="icon-btn sm" type="button" data-action="close-modal" aria-label="Kapat">' + NS.icon('x') + '</button>' +
            '</div>' +
            (opts.body ? '<div class="modal-body">' + opts.body + '</div>' : '') +
            '<div class="modal-foot" style="padding-top:16px">' +
              '<button class="btn btn-ghost" type="button" data-action="confirm-no">Vazgeç</button>' +
              '<button class="btn ' + (opts.danger === false ? 'btn-primary' : 'btn-danger') + '" type="button" data-action="confirm-yes">' + NS.esc(opts.confirmText || 'Sil') + '</button>' +
            '</div>' +
          '</div>' +
        '</div>';
      NS.updateOverflow();
    });
  };
  NS.settleConfirm = function (ok) {
    const r = NS._confirmResolve;
    NS._confirmResolve = null;
    const root = NS.$('#modalRoot');
    if (root) root.innerHTML = '';
    NS.updateOverflow();
    if (r) r(ok);
  };

  NS.openDrawer = function (innerHTML, width) {
    const root = NS.$('#drawerRoot');
    if (!root) return;
    root.innerHTML =
      '<div class="drawer-backdrop" data-action="close-drawer"></div>' +
      '<aside class="drawer' + (width === 'wide' ? ' wide' : '') + '" role="dialog" aria-modal="true">' + innerHTML + '</aside>';
    NS.enhanceTables(root);
    NS.updateOverflow();
  };
  NS.closeDrawer = function () {
    const root = NS.$('#drawerRoot');
    if (root) root.innerHTML = '';
    NS.updateOverflow();
  };

  /* ---------------- Komut paleti ---------------- */
  NS._paletteItems = [];
  NS._paletteFiltered = [];
  NS._paletteActive = 0;
  NS._paletteQuery = '';

  NS.openPalette = function () {
    const db = NS.state.db;
    const items = [];
    NS.navPages().forEach(function (v) {
      const page = NS.PAGES[v];
      items.push({ group: 'Sayfalar', icon: page.icon, label: page.title, hint: page.group, run: function () { NS.navigate(v); } });
    });
    items.push({ group: 'Hızlı İşlemler', icon: 'plus', label: 'Yeni süt kaydı', hint: 'N', run: function () { NS.openRecordModal(); } });
    if (NS.isAdmin()) items.push({ group: 'Hızlı İşlemler', icon: 'users', label: 'Yeni üretici', hint: '', run: function () { NS.openProducerModal(); } });
    if (NS.canCollect()) items.push({ group: 'Hızlı İşlemler', icon: 'qr', label: 'QR ile numune eşle', hint: '', run: function () { NS.openScanModal(); } });
    if (NS.canCollect()) items.push({ group: 'Hızlı İşlemler', icon: 'route', label: 'Süt rotasını aç', hint: '', run: function () { NS.navigate('route'); } });
    if (NS.isAdmin()) items.push({ group: 'Hızlı İşlemler', icon: 'file-text', label: 'Fatura kes', hint: '', run: function () { NS.openInvoiceModal(); } });
    items.push({ group: 'Hızlı İşlemler', icon: 'moon', label: 'Temayı değiştir', hint: '', run: function () { NS.toggleTheme(); } });
    (db ? NS.visibleProducers() : []).forEach(function (p) {
      items.push({
        group: 'Üreticiler', icon: 'users', label: p.name, hint: p.code + ' · ' + p.village,
        run: function () { NS.openProducerDrawer(p.id); }
      });
    });
    NS._paletteItems = items;
    NS._paletteActive = 0;
    NS._paletteQuery = '';

    NS.$('#paletteRoot').innerHTML =
      '<div class="palette-backdrop" data-action="close-palette">' +
        '<div class="palette" role="dialog" aria-modal="true">' +
          '<div class="palette-input-wrap">' + NS.icon('search') +
            '<input id="paletteInput" type="text" placeholder="Sayfa, üretici veya işlem ara…" autocomplete="off" spellcheck="false">' +
            '<kbd>Esc</kbd>' +
          '</div>' +
          '<div class="palette-list" id="paletteList"></div>' +
        '</div>' +
      '</div>';

    const input = NS.$('#paletteInput');
    input.focus();
    input.addEventListener('input', function () {
      NS._paletteQuery = input.value;
      NS._paletteActive = 0;
      NS.renderPaletteList();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        NS._paletteActive = Math.min(NS._paletteFiltered.length - 1, NS._paletteActive + 1);
        NS.renderPaletteList();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        NS._paletteActive = Math.max(0, NS._paletteActive - 1);
        NS.renderPaletteList();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        NS.pickPaletteItem(NS._paletteActive);
      }
    });
    NS.renderPaletteList();
    NS.updateOverflow();
  };

  NS.renderPaletteList = function () {
    const q = NS._paletteQuery.toLowerCase().trim();
    const filtered = NS._paletteItems.map(function (it, i) { return { it: it, i: i }; }).filter(function (x) {
      if (!q) return true;
      return x.it.label.toLowerCase().indexOf(q) !== -1 || (x.it.group || '').toLowerCase().indexOf(q) !== -1;
    });
    NS._paletteFiltered = filtered;
    if (NS._paletteActive >= filtered.length) NS._paletteActive = Math.max(0, filtered.length - 1);
    const list = NS.$('#paletteList');
    if (!list) return;
    if (!filtered.length) { list.innerHTML = '<div class="palette-empty">Sonuç bulunamadı</div>'; return; }
    let html = '';
    let lastGroup = '';
    filtered.forEach(function (x, pos) {
      if (x.it.group !== lastGroup) {
        html += '<div class="palette-label">' + NS.esc(x.it.group) + '</div>';
        lastGroup = x.it.group;
      }
      html += '<button type="button" class="palette-item' + (pos === NS._paletteActive ? ' active' : '') + '" data-action="palette-pick" data-pos="' + pos + '">' +
        '<span class="palette-ico">' + NS.icon(x.it.icon) + '</span>' +
        '<b>' + NS.esc(x.it.label) + '</b>' +
        (x.it.hint ? '<small>' + NS.esc(x.it.hint) + '</small>' : '') +
        '</button>';
    });
    list.innerHTML = html;
    const activeEl = list.querySelector('.palette-item.active');
    if (activeEl) activeEl.scrollIntoView({ block: 'nearest' });
  };
  NS.pickPaletteItem = function (pos) {
    const x = NS._paletteFiltered[pos];
    if (!x) return;
    NS.closePalette();
    x.it.run();
  };
  NS.closePalette = function () {
    const root = NS.$('#paletteRoot');
    if (root) root.innerHTML = '';
    NS.updateOverflow();
  };

  /* ---------------- Kullanıcı arayüzü ---------------- */
  NS.navPages = function () {
    const role = NS.role();
    const out = [];
    NS.NAV_ORDER.forEach(function (k) {
      const p = NS.PAGES[k];
      if (p && p.roles.indexOf(role) !== -1) out.push(k);
    });
    return out;
  };
  NS.updateUserUI = function () {
    const me = NS.state.me;
    if (!me) return;
    NS.$$('[data-user-name]').forEach(function (el) { el.textContent = me.name; });
    NS.$$('[data-user-role]').forEach(function (el) {
      const c = me.collectorId ? NS.collectorById(me.collectorId) : null;
      const pr = me.producerId ? NS.producerById(me.producerId) : null;
      el.textContent = me.role + (c ? ' · ' + c.route : pr ? ' · ' + pr.code : '');
    });
    NS.$$('[data-user-email]').forEach(function (el) { el.textContent = '@' + me.username; });
    NS.$$('[data-avatar]').forEach(function (el) {
      el.textContent = NS.initials(me.name);
      el.style.background = NS.avatarGradient(me.name);
    });
    const roleChip = NS.$('#brandRole');
    if (roleChip) roleChip.textContent = me.role === 'Yönetici' ? 'Yönetim' : me.role === 'Sütçü' ? 'Saha' : 'Çiftlik';
    const brandName = NS.$('#brandName');
    if (brandName) brandName.textContent = 'MandıraPro';
  };
  NS.updateNavBadge = function () {
    if (!NS.state.db) return;
    let n = 0;
    if (NS.isProducer()) n = 0;
    else if (NS.isCollector()) n = NS.routeStats(NS.state.me.collectorId, NS.todayISO(), 'Sabah').pending;
    else n = NS.state.db.records.filter(function (r) { return r.date === NS.todayISO(); }).length;
    ['#navRecordBadge', '#mobileRecordBadge'].forEach(function (id) {
      const b = NS.$(id);
      if (!b) return;
      b.textContent = n > 99 ? '99+' : String(n);
      b.hidden = n === 0;
    });
  };
  NS.updateNav = function (view) {
    NS.$$('.nav-item[data-view], .mobile-tab[data-view], .msheet-link[data-view]').forEach(function (el) {
      el.classList.toggle('active', el.dataset.view === view);
    });
    const menuTab = NS.$('#mobileTabMenu');
    if (menuTab) {
      const inTabs = !!NS.$('.mobile-tab[data-view="' + view + '"]');
      menuTab.classList.toggle('active', !inTabs);
    }
  };

  /* ---------------- Sayaç / mini grafik ---------------- */
  NS.countUp = function (el, target, opts) {
    opts = opts || {};
    const digits = opts.digits === undefined ? 0 : opts.digits;
    const fmt = function (v) { return NS.fmtNum(v, digits); };
    if (!el) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.textContent = fmt(target);
      return;
    }
    if (document.hidden) { el.textContent = fmt(target); return; }
    let finished = false;
    const finish = function () { if (finished) return; finished = true; el.textContent = fmt(target); };
    const start = performance.now();
    const dur = 820;
    function frame(now) {
      if (finished) return;
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3);
      el.textContent = fmt(target * eased);
      if (t < 1) requestAnimationFrame(frame); else finish();
    }
    requestAnimationFrame(frame);
    setTimeout(finish, dur + 400);
  };
  /* Mobilde geniş tabloları etiketli kartlara çevirmek için başlıkları taşır */
  NS.enhanceTables = function (root) {
    const scope = root || document;
    NS.$$('table.table', scope).forEach(function (table) {
      if (table.dataset.mobileReady === '1') return;
      if (table.classList.contains('record-table') || table.classList.contains('doc-table')) return;
      if (!table.tHead || !table.tHead.rows.length) return;
      const heads = Array.prototype.slice.call(table.tHead.rows[0].cells);
      if (heads.length < 2) return;
      table.classList.add('mobile-cards');
      if (table.parentElement && table.parentElement.classList.contains('table-wrap')) {
        table.parentElement.classList.add('table-wrap-cards');
      }
      NS.$$('tbody tr', table).forEach(function (tr) {
        Array.prototype.slice.call(tr.cells).forEach(function (td, i) {
          if (td.hasAttribute('data-label')) return;
          const th = heads[i];
          td.setAttribute('data-label', th ? String(th.textContent || '').replace(/\s+/g, ' ').trim() : '');
        });
      });
      table.dataset.mobileReady = '1';
    });
  };

  NS.animateCounts = function (root) {
    NS.$$('[data-count]', root || document).forEach(function (el) {
      const target = parseFloat(el.dataset.count || '0');
      const digits = parseInt(el.dataset.digits || '0', 10);
      NS.countUp(el, target, { digits: digits });
    });
  };
  NS.renderSparklines = function (root) {
    const scope = root || document;
    NS.$$('.kpi-spark[data-spark]', scope).forEach(function (el) {
      if (el.getAttribute('data-spark-done') === '1') return;
      let values = [];
      try { values = JSON.parse(el.getAttribute('data-spark')); } catch (e) { values = []; }
      if (!values || !values.length) return;
      el.setAttribute('data-spark-done', '1');
      NS.sparkline(el, values, el.getAttribute('data-spark-color') || 'var(--primary-2)');
    });
  };

  /* ---------------- Ortak parçalar ---------------- */
  NS.kpiCard = function (o) {
    const trendHTML = (o.trend === null || o.trend === undefined)
      ? (o.badge ? '<span class="badge ' + (o.badgeTone || 'primary') + '">' + NS.esc(o.badge) + '</span>' : '')
      : '<span class="kpi-trend ' + (o.trend >= 0 ? 'up' : 'down') + '">' + NS.icon(o.trend >= 0 ? 'arrow-up' : 'arrow-down') + NS.fmtNum(Math.abs(o.trend), 1) + '%</span>';
    return '<article class="kpi' + (o.flat ? ' flat' : '') + '">' +
      '<div class="kpi-top">' +
        '<span class="kpi-icon ' + (o.tone || 'teal') + '">' + NS.icon(o.icon) + '</span>' + trendHTML +
      '</div>' +
      '<div class="kpi-value"><span data-count="' + (Number(o.value) || 0) + '" data-digits="' + (o.digits || 0) + '">0</span>' +
        (o.unit ? '<small>' + NS.esc(o.unit) + '</small>' : '') + '</div>' +
      '<div class="kpi-label">' + NS.esc(o.label) + '</div>' +
      '<div class="kpi-spark" data-spark=\'' + JSON.stringify(o.spark || []) + '\' data-spark-color="' + (o.sparkColor || 'var(--primary-2)') + '"></div>' +
    '</article>';
  };
  NS.emptyState = function (icon, title, msg) {
    return '<div class="empty-state"><div class="empty-ico">' + NS.icon(icon) + '</div><b>' + NS.esc(title) + '</b><p>' + NS.esc(msg || '') + '</p></div>';
  };
  NS.pagerHTML = function (total, page, perPage, action) {
    const pages = Math.max(1, Math.ceil(total / perPage));
    const start = total ? (page - 1) * perPage + 1 : 0;
    const end = Math.min(total, page * perPage);
    return '<div class="pager">' +
      '<span class="pager-info">' + (total ? start + '–' + end + ' / ' + total + ' kayıt' : '0 kayıt') + '</span>' +
      '<div class="pager-btns">' +
        '<button type="button" class="icon-btn" data-action="' + action + '" data-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + ' aria-label="Önceki">' + NS.icon('chevron-left') + '</button>' +
        '<span class="pager-now">' + page + ' / ' + pages + '</span>' +
        '<button type="button" class="icon-btn" data-action="' + action + '" data-page="' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + ' aria-label="Sonraki">' + NS.icon('chevron-right') + '</button>' +
      '</div>' +
    '</div>';
  };
  NS.noteBanner = function (icon, text) {
    return '<div class="note-banner">' + NS.icon(icon) + '<div>' + text + '</div></div>';
  };
  NS.statRow = function (label, value, tone) {
    return '<div class="stat-row"><span>' + NS.esc(label) + '</span><b' + (tone ? ' class="' + tone + '"' : '') + '>' + NS.esc(value) + '</b></div>';
  };

  /* ---------------- QR ---------------- */
  NS.qrSVG = function (text, cellSize) {
    try {
      const qr = window.qrcode(0, 'M');
      qr.addData(String(text));
      qr.make();
      return qr.createSvgTag(cellSize || 4, 4);
    } catch (e) {
      return '<div class="qr-fallback">' + NS.esc(text) + '</div>';
    }
  };
  NS.matchProducerCode = function (raw) {
    if (!raw) return null;
    const text = String(raw).trim().toUpperCase();
    const db = NS.state.db;
    let code = text;
    if (text.indexOf('|') !== -1) {
      const parts = text.split('|');
      code = (parts[parts.length - 1] || '').trim();
    }
    return db.producers.find(function (p) {
      return String(p.code).toUpperCase() === code || String(p.qr).toUpperCase() === text;
    }) || db.producers.find(function (p) {
      return text.indexOf(String(p.code).toUpperCase()) !== -1;
    }) || null;
  };

  /* ---------------- Dışa aktarma ---------------- */
  NS.downloadText = function (filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); if (a.parentNode) a.parentNode.removeChild(a); }, 320);
  };
  NS.csvRow = function (cells) {
    return cells.map(function (c) {
      if (typeof c === 'number') return String(c).replace('.', ',');
      const s = String(c === null || c === undefined ? '' : c);
      return '"' + s.replace(/"/g, '""') + '"';
    }).join(';');
  };
  NS.exportCSV = function (filename, headers, rows) {
    const all = [NS.csvRow(headers)].concat(rows.map(NS.csvRow));
    NS.downloadText(filename, '\uFEFF' + all.join('\r\n'), 'text/csv;charset=utf-8');
    NS.toast('CSV indirildi', filename, 'success');
  };
  NS.exportXLSX = function (filename, sheets) {
    if (!window.XLSX) { NS.toast('Excel motoru yüklenemedi', 'Sayfayı yenileyip tekrar deneyin.', 'error'); return; }
    try {
      const wb = XLSX.utils.book_new();
      sheets.forEach(function (sh) {
        const ws = XLSX.utils.aoa_to_sheet(sh.rows);
        if (sh.widths) ws['!cols'] = sh.widths.map(function (w) { return { wch: w }; });
        XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
      });
      XLSX.writeFile(wb, filename);
      NS.toast('Excel indirildi', filename, 'success');
    } catch (e) {
      NS.toast('Excel oluşturulamadı', e.message || 'Bilinmeyen hata', 'error');
    }
  };
  NS.producerTemplate = function () {
    const headers = ['Kod', 'Ad Soyad', 'Telefon', 'Köy', 'Adres', 'Sütçü / Rota', 'Sıra', 'Hayvan Sayısı', 'Fiyat Listesi', 'Vergi No', 'IBAN', 'Aktif'];
    const sample = ['U-100', 'Örnek Üretici', '0532 000 00 00', 'Merkez', 'Merkez / Konya', 'Merkez Rotası', 10, 12, 'Standart İnek', '3000000000', 'TR00 0000 0000 0000 0000 0000 00', 'Evet'];
    NS.exportXLSX('mandirapro-uretici-sablonu.xlsx', [
      { name: 'Üreticiler', rows: [headers, sample], widths: [10, 24, 18, 16, 24, 22, 8, 14, 18, 14, 34, 8] },
      {
        name: 'Kılavuz', rows: [
          ['MandıraPro — Üretici İçe Aktarma Kılavuzu'],
          [''],
          ['Kural', 'Açıklama'],
          ['Zorunlu alanlar', 'Ad Soyad ve Köy. Kod boş bırakılırsa otomatik üretilir.'],
          ['Sütçü / Rota', 'Sistemdeki rota adı veya sütçü adı yazılabilir. Eşleşmezse seçtiğiniz varsayılan rota kullanılır.'],
          ['Fiyat Listesi', 'Standart İnek, Manda Sütü veya Organik İnek. Boşsa Standart İnek atanır.'],
          ['Aktif', 'Evet / Hayır. Boşsa Evet kabul edilir.'],
          ['Not', 'Aynı kod iki kez kullanılamaz; mevcut kod satırı atlanır.']
        ], widths: [24, 90]
      }
    ]);
  };
  NS.readSheetFile = function (file) {
    return new Promise(function (resolve, reject) {
      if (!window.XLSX) { reject(new Error('Excel motoru yok')); return; }
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          resolve(rows);
        } catch (err) { reject(err); }
      };
      reader.onerror = function () { reject(new Error('Dosya okunamadı')); };
      reader.readAsArrayBuffer(file);
    });
  };

  /* ---------------- Yazdırma ---------------- */
  NS.printDoc = function (opts) {
    const root = NS.$('#printRoot');
    if (!root) return;
    root.innerHTML =
      '<div class="doc-overlay">' +
        '<div class="doc-toolbar">' +
          '<div><b>' + NS.esc(opts.title || 'Belge') + '</b>' + (opts.subtitle ? '<span>' + NS.esc(opts.subtitle) + '</span>' : '') + '</div>' +
          '<div class="doc-toolbar-actions">' +
            '<button class="btn btn-primary btn-sm" type="button" data-action="print-doc">' + NS.icon('printer') + ' Yazdır / PDF</button>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-action="close-doc">' + NS.icon('x') + ' Kapat</button>' +
          '</div>' +
        '</div>' +
        '<div class="doc-scroll"><article class="doc-sheet">' + (opts.html || '') + '</article></div>' +
      '</div>';
    document.body.classList.add('doc-open');
    NS.updateOverflow();
  };
  NS.closePrintDoc = function () {
    const root = NS.$('#printRoot');
    if (root) root.innerHTML = '';
    document.body.classList.remove('doc-open');
    NS.updateOverflow();
  };
  NS.printSheet = function () { window.print(); };

  /* ---------------- Mobil input iyileştirmeleri ---------------- */
  NS.enhanceMobileInputs = function (root) {
    if (!root) return;
    var inputs = root.querySelectorAll('input[type="number"]');
    for (var i = 0; i < inputs.length; i++) {
      var inp = inputs[i];
      if (!inp.getAttribute('inputmode')) {
        inp.setAttribute('inputmode', 'numeric');
      }
    }
    // Metin alanlarına uygun autocomplete ekle
    var textInputs = root.querySelectorAll('input[type="text"]:not([autocomplete])');
    for (var j = 0; j < textInputs.length; j++) {
      var inp2 = textInputs[j];
      var name = (inp2.getAttribute('name') || '').toLowerCase();
      if (name.indexOf('name') !== -1) inp2.setAttribute('autocomplete', 'name');
      else if (name.indexOf('phone') !== -1 || name.indexOf('tel') !== -1) inp2.setAttribute('autocomplete', 'tel');
      else if (name.indexOf('email') !== -1) inp2.setAttribute('autocomplete', 'email');
      else if (name.indexOf('address') !== -1) inp2.setAttribute('autocomplete', 'street-address');
      else if (name.indexOf('username') !== -1) inp2.setAttribute('autocomplete', 'username');
      else if (name.indexOf('password') !== -1) inp2.setAttribute('autocomplete', 'current-password');
    }
    // Textarea boyutunu mobilde genişlet
    var textareas = root.querySelectorAll('textarea');
    for (var k = 0; k < textareas.length; k++) {
      textareas[k].setAttribute('rows', Math.max(3, (textareas[k].getAttribute('rows') || 3)));
    }
  };

  /* ---------------- Yedek ---------------- */
  NS.downloadBackup = function () {
    const text = JSON.stringify(NS.state.db, null, 2);
    NS.downloadText('mandirapro-yedek-' + NS.todayISO() + '.json', text, 'application/json;charset=utf-8');
    NS.toast('Yedek indirildi', 'Tüm veriler JSON dosyasına kaydedildi.', 'success');
  };

})(window.MPApp);
