/* ============================================================
   MandıraPro — İş mantığı ve ortak bileşenler
   ============================================================ */
(function (NS) {
  'use strict';

  const S = function () { return NS.state; };

  NS.customerById = function (id) {
    return S().db.customers.find(function (c) { return c.id === id; }) || null;
  };

  /* ---------------- Hesaplamalar ---------------- */
  NS.recordIncome = function (r) {
    return (Number(r.milk) || 0) * (Number(S().db.settings.milkPrice) || 0);
  };
  NS.recordFeedCost = function (r) {
    const prices = S().db.settings.feedPrices || {};
    return NS.FEEDS.reduce(function (sum, f) {
      return sum + (Number(r.feeds && r.feeds[f.key]) || 0) * (Number(prices[f.key]) || 0);
    }, 0);
  };
  NS.recordFeedKg = function (r) {
    return NS.FEEDS.reduce(function (sum, f) {
      return sum + (Number(r.feeds && r.feeds[f.key]) || 0);
    }, 0);
  };
  NS.feedTotals = function (records) {
    const t = {};
    NS.FEEDS.forEach(function (f) { t[f.key] = 0; });
    records.forEach(function (r) {
      NS.FEEDS.forEach(function (f) { t[f.key] += Number(r.feeds && r.feeds[f.key]) || 0; });
    });
    return t;
  };
  NS.recordsOn = function (date) {
    return S().db.records.filter(function (r) { return r.date === date; });
  };
  NS.recordsIn = function (start, end) {
    return S().db.records.filter(function (r) { return r.date >= start && r.date <= end; });
  };
  NS.monthRecords = function (ym) {
    return NS.recordsIn(ym + '-01', NS.monthEnd(ym));
  };
  NS.sumMilk = function (records) {
    return NS.sum(records.map(function (r) { return r.milk; }));
  };
  NS.sumIncome = function (records) {
    return NS.sum(records.map(NS.recordIncome));
  };
  NS.sumFeedKg = function (records) {
    return NS.sum(records.map(NS.recordFeedKg));
  };
  NS.sumFeedCost = function (records) {
    return NS.sum(records.map(NS.recordFeedCost));
  };
  NS.sumNet = function (records) {
    return NS.sum(records.map(function (r) { return NS.recordIncome(r) - NS.recordFeedCost(r); }));
  };

  NS.customerMonthStats = function (ym) {
    const recs = NS.monthRecords(ym);
    const map = {};
    S().db.customers.forEach(function (c) {
      map[c.id] = { milk: 0, feedKg: 0, income: 0, cost: 0, net: 0, count: 0 };
    });
    recs.forEach(function (r) {
      const m = map[r.customerId];
      if (!m) return;
      m.milk += Number(r.milk) || 0;
      m.feedKg += NS.recordFeedKg(r);
      m.income += NS.recordIncome(r);
      m.cost += NS.recordFeedCost(r);
      m.count += 1;
    });
    Object.keys(map).forEach(function (id) {
      map[id].net = map[id].income - map[id].cost;
    });
    return map;
  };

  NS.lastNDays = function (n) {
    const arr = [];
    for (let i = n - 1; i >= 0; i--) arr.push(NS.isoOffset(-i));
    return arr;
  };

  NS.pctChange = function (cur, prev) {
    if (!prev || prev <= 0) return null;
    return (cur - prev) / prev * 100;
  };

  NS.recordRangeStart = function (range) {
    if (range === 'today') return NS.todayISO();
    if (range === 'week') return NS.isoOffset(-6);
    if (range === 'all') return '0000-01-01';
    return NS.monthStart(NS.todayISO().slice(0, 7));
  };

  /* ---------------- Ortak arayüz parçaları ---------------- */
  NS.kpiCard = function (o) {
    const trendHTML = (o.trend === null || o.trend === undefined)
      ? (o.badge ? '<span class="badge ' + (o.badgeTone || 'primary') + '">' + NS.esc(o.badge) + '</span>' : '')
      : '<span class="kpi-trend ' + (o.trend >= 0 ? 'up' : 'down') + '">' +
          NS.icon(o.trend >= 0 ? 'arrow-up' : 'arrow-down') +
          NS.fmtNum(Math.abs(o.trend), 1) + '%</span>';

    return '<article class="kpi">' +
      '<div class="kpi-top">' +
        '<span class="kpi-icon ' + (o.tone || 'teal') + '">' + NS.icon(o.icon) + '</span>' +
        trendHTML +
      '</div>' +
      '<div class="kpi-value"><span data-count="' + (Number(o.value) || 0) + '" data-digits="' + (o.digits || 0) + '">0</span>' +
        (o.unit ? '<small>' + NS.esc(o.unit) + '</small>' : '') + '</div>' +
      '<div class="kpi-label">' + NS.esc(o.label) + '</div>' +
      '<div class="kpi-spark" data-spark=\'' + JSON.stringify(o.spark || []) + '\' data-spark-color="' + (o.sparkColor || 'var(--primary-2)') + '"></div>' +
    '</article>';
  };

  NS.pageList = function (page, pages) {
    const arr = [];
    if (pages <= 7) {
      for (let i = 1; i <= pages; i++) arr.push(i);
      return arr;
    }
    arr.push(1);
    if (page > 3) arr.push('…');
    for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) arr.push(i);
    if (page < pages - 2) arr.push('…');
    arr.push(pages);
    return arr;
  };

  NS.pagerHTML = function (total, page, perPage, action) {
    const pages = Math.max(1, Math.ceil(total / perPage));
    const start = total ? (page - 1) * perPage + 1 : 0;
    const end = Math.min(total, page * perPage);
    const nums = NS.pageList(page, pages).map(function (p) {
      if (p === '…') return '<span class="muted" style="padding:0 4px">…</span>';
      return '<button type="button" class="icon-btn' + (p === page ? ' active' : '') + '" data-action="' + action + '" data-page="' + p + '"' + (p === page ? ' aria-current="page"' : '') + '>' + p + '</button>';
    }).join('');
    return '<div class="pager">' +
      '<span class="pager-info">' + (total ? start + '–' + end + ' / ' + total + ' kayıt' : '0 kayıt') + '</span>' +
      '<div class="pager-btns">' +
        '<button type="button" class="icon-btn" data-action="' + action + '" data-page="' + (page - 1) + '"' + (page <= 1 ? ' disabled' : '') + ' aria-label="Önceki">' + NS.icon('chevron-left') + '</button>' +
        nums +
        '<button type="button" class="icon-btn" data-action="' + action + '" data-page="' + (page + 1) + '"' + (page >= pages ? ' disabled' : '') + ' aria-label="Sonraki">' + NS.icon('chevron-right') + '</button>' +
      '</div>' +
    '</div>';
  };

  NS.emptyState = function (icon, title, msg) {
    return '<div class="empty-state">' +
      '<div class="empty-ico">' + NS.icon(icon) + '</div>' +
      '<b>' + NS.esc(title) + '</b>' +
      '<p>' + NS.esc(msg || '') + '</p>' +
    '</div>';
  };

  NS.feedChipsHTML = function (r, onlyPositive) {
    const chips = NS.FEEDS.filter(function (f) {
      const v = Number(r.feeds && r.feeds[f.key]) || 0;
      return onlyPositive === false ? true : v > 0;
    }).map(function (f) {
      const v = Number(r.feeds && r.feeds[f.key]) || 0;
      return '<span class="feed-chip"><i style="background:' + f.color + '"></i>' + NS.esc(f.label) + ' ' + NS.fmtNum(v, 1) + ' kg</span>';
    });
    return chips.length ? chips.join(' ') : '<span class="faint">—</span>';
  };

  /* KPI mini grafiklerini doldur */
  NS.renderSparklines = function (root) {
    const scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll('.kpi-spark[data-spark]'), function (el) {
      if (el.getAttribute('data-spark-done') === '1') return;
      let values = [];
      try { values = JSON.parse(el.getAttribute('data-spark')); } catch (e) { values = []; }
      if (!values || !values.length) return;
      el.setAttribute('data-spark-done', '1');
      NS.sparkline(el, values, el.getAttribute('data-spark-color') || 'var(--primary-2)');
    });
  };

  /* ---------------- Dışa aktarma ---------------- */
  NS.downloadText = function (filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      if (a.parentNode) a.parentNode.removeChild(a);
    }, 300);
  };

  NS.csvRow = function (cells) {
    return cells.map(function (c) {
      if (typeof c === 'number') return String(c).replace('.', ',');
      const s = String(c === null || c === undefined ? '' : c);
      return '"' + s.replace(/"/g, '""') + '"';
    }).join(';');
  };

  NS.exportRecordsCSV = function () {
    if (!NS.filteredRecords) return;
    const list = NS.filteredRecords();
    if (!list.length) { NS.toast('Dışa aktarılacak kayıt yok', 'Filtreleri değiştirip tekrar deneyin.', 'warn'); return; }
    const rows = [NS.csvRow(['Tarih', 'Müşteri', 'Süt (L)', 'Süt Yemi (kg)', 'Besi Yemi (kg)', 'Buzağı Yemi (kg)', 'Sarı Küspe (kg)', 'Süt Geliri (₺)', 'Yem Gideri (₺)', 'Net (₺)', 'Not'])];
    list.forEach(function (r) {
      const c = NS.customerById(r.customerId);
      rows.push(NS.csvRow([
        r.date,
        c ? c.name : '',
        Number(r.milk) || 0,
        Number(r.feeds.sutYemi) || 0,
        Number(r.feeds.besiYemi) || 0,
        Number(r.feeds.buzagiYemi) || 0,
        Number(r.feeds.sariKusbe) || 0,
        Number(NS.recordIncome(r).toFixed(2)),
        Number(NS.recordFeedCost(r).toFixed(2)),
        Number((NS.recordIncome(r) - NS.recordFeedCost(r)).toFixed(2)),
        r.note || ''
      ]));
    });
    NS.downloadText('mandirapro-kayitlar-' + NS.todayISO() + '.csv', '\uFEFF' + rows.join('\r\n'), 'text/csv;charset=utf-8');
    NS.toast('CSV indirildi', list.length + ' kayıt dışa aktarıldı.', 'success');
  };

  NS.exportReportCSV = function (ym) {
    const recs = NS.monthRecords(ym);
    if (!recs.length) { NS.toast('Bu ay için kayıt yok', 'Farklı bir ay seçin.', 'warn'); return; }
    const stats = NS.customerMonthStats(ym);
    const rows = [NS.csvRow(['Müşteri', 'Kayıt', 'Süt (L)', 'Süt Geliri (₺)', 'Yem (kg)', 'Yem Gideri (₺)', 'Net (₺)'])];
    NS.state.db.customers.forEach(function (c) {
      const s = stats[c.id];
      if (!s || s.count === 0) return;
      rows.push(NS.csvRow([
        c.name,
        s.count,
        Number(s.milk.toFixed(1)),
        Number(s.income.toFixed(2)),
        Number(s.feedKg.toFixed(1)),
        Number(s.cost.toFixed(2)),
        Number(s.net.toFixed(2))
      ]));
    });
    rows.push(NS.csvRow([
      'TOPLAM', recs.length,
      Number(NS.sumMilk(recs).toFixed(1)),
      Number(NS.sumIncome(recs).toFixed(2)),
      Number(NS.sumFeedKg(recs).toFixed(1)),
      Number(NS.sumFeedCost(recs).toFixed(2)),
      Number(NS.sumNet(recs).toFixed(2))
    ]));
    NS.downloadText('mandirapro-rapor-' + ym + '.csv', '\uFEFF' + rows.join('\r\n'), 'text/csv;charset=utf-8');
    NS.toast('Rapor indirildi', NS.monthLabel(ym) + ' özeti CSV olarak kaydedildi.', 'success');
  };

  NS.downloadBackup = function () {
    const db = NS.state.db;
    const text = JSON.stringify(db, null, 2);
    NS.downloadText('mandirapro-yedek-' + NS.todayISO() + '.json', text, 'application/json;charset=utf-8');
    NS.toast('Yedek indirildi', 'Tüm veriler JSON dosyasına kaydedildi.', 'success');
  };

  /* ---------------- Etkinlik akışı ---------------- */
  NS.recentActivity = function (limit) {
    const db = NS.state.db;
    const events = [];
    const recent = db.records.slice(-400);
    recent.forEach(function (r) {
      const c = NS.customerById(r.customerId);
      if (!c) return;
      const fkg = NS.recordFeedKg(r);
      events.push({
        at: r.createdAt || (r.date + 'T08:00:00'),
        type: 'milk',
        title: NS.fmtNum(r.milk, 1) + ' L süt kaydı',
        sub: c.name + (fkg > 0 ? ' · ' + NS.fmtNum(fkg, 1) + ' kg yem' : ''),
        when: r.date
      });
    });
    db.customers.forEach(function (c) {
      events.push({
        at: c.createdAt + 'T09:00:00',
        type: 'customer',
        title: 'Yeni müşteri eklendi',
        sub: c.name + (c.village ? ' · ' + c.village : ''),
        when: c.createdAt
      });
    });
    events.sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); });
    return events.slice(0, limit || 8);
  };

})(window.MPApp);
