/* ============================================================
   MandıraPro 2.0 — Raporlar
   ============================================================ */
(function (NS) {
  'use strict';

  NS.hooks = NS.hooks || {};

  NS.reportRange = function () {
    const r = NS.state.report.range || '30';
    const today = NS.todayISO();
    if (r === 'month') return { start: NS.monthStart(today.slice(0, 7)), end: today, label: NS.capitalize(NS.monthLabel(today.slice(0, 7))) };
    if (r === 'prev') {
      const ym = NS.prevMonth(today.slice(0, 7));
      return { start: ym + '-01', end: NS.monthEnd(ym), label: NS.capitalize(NS.monthLabel(ym)) };
    }
    if (r === '90') return { start: NS.isoOffset(-89), end: today, label: 'Son 90 gün' };
    if (r === 'all') return { start: '0000-01-01', end: today, label: 'Tüm zamanlar' };
    return { start: NS.isoOffset(-29), end: today, label: 'Son 30 gün' };
  };

  NS.reportData = function () {
    const db = NS.state.db;
    const range = NS.reportRange();
    const collector = NS.state.report.collector || '';
    let records = NS.visibleRecords().filter(function (r) { return r.date >= range.start && r.date <= range.end; });
    if (collector) records = records.filter(function (r) { return r.collectorId === collector; });
    const expenses = db.expenses.filter(function (e) { return e.date >= range.start && e.date <= range.end; });
    const liters = NS.sumLiters(records);
    const gross = NS.sumAmount(records);
    const feedCost = NS.sumFeedCost(records);
    const expenseTotal = NS.sum(expenses.map(function (e) { return e.amount; }));
    const quality = NS.avgQuality(records);

    const producers = NS.visibleProducers().map(function (p) {
      const recs = records.filter(function (r) { return r.producerId === p.id; });
      return {
        producer: p,
        collector: NS.collectorById(p.collectorId),
        liters: NS.sumLiters(recs),
        gross: NS.sumAmount(recs),
        feedCost: NS.sumFeedCost(recs),
        count: recs.length,
        quality: NS.avgQuality(recs)
      };
    }).filter(function (x) { return x.count > 0; }).sort(function (a, b) { return b.liters - a.liters; });

    const collectors = NS.visibleCollectors().map(function (c) {
      if (collector && c.id !== collector) return null;
      const recs = records.filter(function (r) { return r.collectorId === c.id; });
      return {
        collector: c,
        liters: NS.sumLiters(recs),
        gross: NS.sumAmount(recs),
        count: recs.length,
        quality: NS.avgQuality(recs),
        producers: NS.visibleProducers().filter(function (p) { return p.collectorId === c.id; }).length
      };
    }).filter(Boolean).filter(function (x) { return x.count > 0; });

    const categories = MP.EXPENSE_TYPES.map(function (t) {
      return { label: t.key, value: NS.sum(expenses.filter(function (e) { return e.type === t.key; }).map(function (e) { return e.amount; })), color: t.color };
    }).filter(function (x) { return x.value > 0; });

    /* Zaman serisi */
    const points = [];
    if (range.start === '0000-01-01') {
      for (let i = 11; i >= 0; i--) {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
        const ym = d.getFullYear() + '-' + NS.pad(d.getMonth() + 1);
        const recs = records.filter(function (r) { return r.date.slice(0, 7) === ym; });
        points.push({ label: NS.monthLabel(ym).split(' ')[0].slice(0, 3), value: NS.sumLiters(recs), full: NS.monthLabel(ym) });
      }
    } else {
      const days = Math.max(1, NS.daysBetween(range.start, range.end) + 1);
      for (let i = 0; i < days; i++) {
        const d = new Date(NS.parseDate(range.start));
        d.setDate(d.getDate() + i);
        const iso = d.getFullYear() + '-' + NS.pad(d.getMonth() + 1) + '-' + NS.pad(d.getDate());
        const recs = records.filter(function (r) { return r.date === iso; });
        points.push({ label: NS.fmtDateShort(iso), value: NS.sumLiters(recs), full: NS.fmtDate(iso) });
      }
    }

    return {
      range: range, records: records, expenses: expenses, producers: producers, collectors: collectors,
      categories: categories, points: points, liters: liters, gross: gross, feedCost: feedCost,
      expenseTotal: expenseTotal, quality: quality, net: NS.round(gross - feedCost - expenseTotal, 2),
      grades: NS.gradeCounts(records)
    };
  };

  NS.renderReports = function () {
    const d = NS.reportData();
    const s = NS.state.report;
    const collectors = NS.visibleCollectors();
    const range = d.range;
    NS._report = d;

    const producerRows = d.producers.map(function (x) {
      const share = d.liters ? x.liters / d.liters * 100 : 0;
      return '<tr>' +
        '<td><div class="prod-cell">' + NS.avatarHTML(x.producer.name) + '<div><b>' + NS.esc(x.producer.name) + '</b><small>' + NS.esc(x.producer.code) + ' · ' + NS.esc(x.collector ? x.collector.route : '') + '</small></div></div></td>' +
        '<td class="num"><b>' + NS.fmtNum(x.liters, 0) + '</b> <span class="faint">L</span></td>' +
        '<td>' + (x.quality ? NS.qualityBadge(x.quality >= 82 ? 'A' : x.quality >= 65 ? 'B' : 'C', x.quality) : '<span class="faint">—</span>') + '</td>' +
        '<td class="num">' + NS.fmtMoney(x.gross, 0) + '</td>' +
        '<td class="num">' + NS.fmtMoney(x.feedCost, 0) + '</td>' +
        '<td class="num">' + NS.fmtNum(x.count, 0) + '</td>' +
        '<td class="num"><div class="share-cell"><span>' + NS.fmtNum(share, 1) + '%</span><div class="bar-track"><div class="bar-fill" data-w="' + share.toFixed(1) + '"></div></div></div></td>' +
      '</tr>';
    }).join('');

    const collectorRows = d.collectors.map(function (x) {
      return '<div class="collector-line">' +
        '<div class="cl-top"><span class="cl-av" style="background:' + x.collector.color + '">' + NS.esc(NS.initials(x.collector.name)) + '</span>' +
          '<span class="cl-name"><b>' + NS.esc(x.collector.name) + '</b><small>' + NS.esc(x.collector.route) + ' · ' + x.producers + ' üretici</small></span>' +
          '<span class="cl-lit">' + NS.fmtNum(x.liters, 0) + '<small> L</small></span></div>' +
        '<div class="bar-track"><div class="bar-fill" data-w="' + (d.liters ? x.liters / d.liters * 100 : 0).toFixed(1) + '%"></div></div>' +
        '<div class="cl-foot"><span>' + x.count + ' kayıt · ' + (x.quality ? 'kalite ' + NS.fmtNum(x.quality, 0) : 'kalite —') + '</span><span>' + NS.fmtMoney(x.gross / 1000, 1) + ' bin ₺</span></div>' +
      '</div>';
    }).join('');

    const expenseRows = d.categories.map(function (c) {
      const pct = d.expenseTotal ? c.value / d.expenseTotal * 100 : 0;
      return '<div class="expense-line"><span><i style="background:' + c.color + '"></i>' + NS.esc(c.label) + '</span>' +
        '<div class="bar-track"><div class="bar-fill" data-w="' + pct.toFixed(1) + '%"></div></div>' +
        '<b>' + NS.fmtMoney(c.value, 0) + '</b></div>';
    }).join('');

    return '<div class="page stagger">' +

      '<section class="page-head">' +
        '<div class="ph-left">' +
          '<div class="page-kicker">' + NS.icon('chart') + ' yönetim raporu</div>' +
          '<h1>Raporlar</h1>' +
          '<p><b>' + NS.esc(range.label) + '</b> · ' + d.records.length + ' süt kaydı, ' + NS.fmtNum(d.liters, 1) + ' litre. Brüt hakediş ' + NS.fmtMoney(d.gross, 0) + '; filo ve işletme giderleri düşüldükten sonra net katkı <b>' + NS.fmtMoney(d.net, 0) + '</b>.</p>' +
        '</div>' +
        '<div class="ph-actions">' +
          '<button class="btn btn-ghost" type="button" data-action="report-csv">' + NS.icon('download') + ' CSV</button>' +
          '<button class="btn btn-ghost" type="button" data-action="report-xlsx">' + NS.icon('download') + ' Excel</button>' +
          '<button class="btn btn-primary" type="button" data-action="report-print">' + NS.icon('printer') + ' Raporu yazdır</button>' +
        '</div>' +
      '</section>' +

      '<section class="card card-tight">' +
        '<div class="card-body row between" style="padding:10px 14px">' +
          '<div class="row gap-8"><span class="filter-label">Dönem</span>' +
            '<div class="seg">' +
              '<button type="button" class="' + (s.range === '30' ? 'active' : '') + '" data-action="report-range" data-range="30">30 gün</button>' +
              '<button type="button" class="' + (s.range === 'month' ? 'active' : '') + '" data-action="report-range" data-range="month">Bu ay</button>' +
              '<button type="button" class="' + (s.range === 'prev' ? 'active' : '') + '" data-action="report-range" data-range="prev">Geçen ay</button>' +
              '<button type="button" class="' + (s.range === '90' ? 'active' : '') + '" data-action="report-range" data-range="90">90 gün</button>' +
              '<button type="button" class="' + (s.range === 'all' ? 'active' : '') + '" data-action="report-range" data-range="all">Tümü</button>' +
            '</div>' +
          '</div>' +
          '<div class="row gap-8"><span class="filter-label">Sütçü</span>' +
            '<select class="select" style="height:33px;font-size:11.5px;width:auto" data-filter="report-collector"><option value="">Tüm sütçüler</option>' + collectors.map(function (c) {
              return '<option value="' + c.id + '"' + (s.collector === c.id ? ' selected' : '') + '>' + NS.esc(c.route) + '</option>';
            }).join('') + '</select>' +
            '<span class="small faint">' + NS.fmtDate(range.start) + ' – ' + NS.fmtDate(range.end) + '</span>' +
          '</div>' +
        '</div>' +
      '</section>' +

      '<div class="grid-4">' +
        '<div class="mini-stat"><small>Toplanan süt</small><b>' + NS.fmtNum(d.liters, 0) + ' <em>L</em></b><span>' + d.records.length + ' kayıt · ' + d.producers.length + ' üretici</span></div>' +
        '<div class="mini-stat"><small>Brüt hakediş</small><b>' + NS.fmtMoney(d.gross, 0) + '</b><span>ortalama ' + NS.fmtMoney(d.liters ? d.gross / d.liters : 0, 2) + '/L</span></div>' +
        '<div class="mini-stat"><small>Kalite ortalaması</small><b>' + (d.quality ? NS.fmtNum(d.quality, 0) : '—') + '<em>/100</em></b><span>A ' + d.grades.A + ' · B ' + d.grades.B + ' · C ' + d.grades.C + '</span></div>' +
        '<div class="mini-stat"><small>Net katkı</small><b class="' + (d.net >= 0 ? 'tone-pos' : 'tone-neg') + '">' + NS.fmtMoney(d.net, 0) + '</b><span>hakediş − yem − masraf</span></div>' +
      '</div>' +

      '<div class="grid-main">' +
        '<section class="card">' +
          '<div class="card-head"><div><h3>Süt toplama eğrisi</h3><p>' + NS.esc(range.label) + ' · litre</p></div><span class="badge primary">' + NS.fmtNum(d.liters, 0) + ' L</span></div>' +
          '<div class="card-body"><div id="reportTrend"></div></div>' +
        '</section>' +
        '<section class="card">' +
          '<div class="card-head"><div><h3>Masraf dağılımı</h3><p>' + NS.esc(range.label) + '</p></div><span class="badge">' + NS.fmtMoney(d.expenseTotal, 0) + '</span></div>' +
          '<div class="card-body">' +
            '<div class="donut-box"><div class="donut-chart" id="reportDonut"></div><div class="legend" style="flex:1">' +
              (d.categories.length ? d.categories.map(function (c) {
                return '<div class="legend-row"><i style="background:' + c.color + '"></i><span>' + NS.esc(c.label) + '</span><b>' + NS.fmtMoney(c.value, 0) + '</b></div>';
              }).join('') : '<span class="small faint">Masraf kaydı yok</span>') +
            '</div></div>' +
          '</div>' +
        '</section>' +
      '</div>' +

      '<div class="grid-2-eq">' +
        '<section class="card">' +
          '<div class="card-head"><div><h3>Sütçü performansı</h3><p>Rota bazlı toplama</p></div></div>' +
          '<div class="card-body"><div class="collector-list">' + (collectorRows || NS.emptyState('route', 'Veri yok', 'Bu dönemde kayıt bulunmuyor.')) + '</div></div>' +
        '</section>' +
        '<section class="card">' +
          '<div class="card-head"><div><h3>Gider kalemleri</h3><p>Yakıt, yem, personel ve diğer</p></div><a class="card-link" href="#" data-action="nav" data-view="fleet">Filo ' + NS.icon('chevron-right') + '</a></div>' +
          '<div class="card-body"><div class="expense-lines">' + (expenseRows || '<p class="small faint">Bu dönemde masraf kaydı yok.</p>') + '</div>' +
            '<div class="stat-row" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)"><span>Toplam masraf</span><b>' + NS.fmtMoney(d.expenseTotal, 2) + '</b></div>' +
            '<div class="stat-row"><span>Yem bedeli (süt içi)</span><b>' + NS.fmtMoney(d.feedCost, 2) + '</b></div>' +
            '<div class="stat-row"><span>Net katkı</span><b class="' + (d.net >= 0 ? 'tone-pos' : 'tone-neg') + '">' + NS.fmtMoney(d.net, 2) + '</b></div>' +
          '</div>' +
        '</section>' +
      '</div>' +

      '<section class="card">' +
        '<div class="card-head card-head-rule"><div><h3>Üretici performansı</h3><p>Litreyi büyükten küçüğe sıralı</p></div></div>' +
        '<div class="card-body" style="padding-top:12px">' +
          '<div class="table-wrap"><table class="table table-wide"><thead><tr><th>Üretici</th><th class="num">Süt</th><th>Kalite</th><th class="num">Hakediş</th><th class="num">Yem</th><th class="num">Kayıt</th><th class="num">Pay</th></tr></thead>' +
          '<tbody>' + (producerRows || '<tr><td colspan="7">' + NS.emptyState('chart', 'Rapor verisi yok', 'Farklı bir dönem seçin.') + '</td></tr>') + '</tbody></table></div>' +
        '</div>' +
      '</section>' +

    '</div>';
  };

  NS.hooks.reports = function () {
    const d = NS._report;
    if (!d) return;
    NS.areaChart(NS.$('#reportTrend'), d.points.map(function (p) { return { label: p.label, value: p.value }; }), {
      unit: 'L', height: 250, aria: 'Dönem süt toplama grafiği',
      valueFmt: function (v) { return NS.fmtNum(v, 1) + ' litre'; }
    });
    NS.donut(NS.$('#reportDonut'), d.categories, {
      centerValue: NS.fmtCompact(d.expenseTotal),
      centerLabel: '₺ masraf'
    });
    requestAnimationFrame(function () {
      NS.$$('[data-w]').forEach(function (el, i) {
        setTimeout(function () { el.style.width = el.dataset.w + '%'; }, 50 + i * 35);
      });
    });
  };

  NS.printReport = function () {
    const d = NS.reportData();
    const producerRows = d.producers.slice(0, 15).map(function (x, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + NS.esc(x.producer.name) + '</td><td>' + NS.esc(x.collector ? x.collector.route : '') + '</td>' +
        '<td class="num">' + NS.fmtNum(x.liters, 1) + '</td><td class="num">' + NS.fmtNum(x.quality || 0, 0) + '</td><td class="num">' + NS.fmtMoney(x.gross, 0) + '</td><td class="num">' + x.count + '</td></tr>';
    }).join('');
    const collectorRows = d.collectors.map(function (x) {
      return '<tr><td>' + NS.esc(x.collector.name) + '</td><td>' + NS.esc(x.collector.route) + '</td><td class="num">' + NS.fmtNum(x.liters, 1) + '</td><td class="num">' + NS.fmtMoney(x.gross, 0) + '</td><td class="num">' + x.count + '</td><td class="num">' + (x.quality ? NS.fmtNum(x.quality, 0) : '—') + '</td></tr>';
    }).join('');
    const expenseRows = d.categories.map(function (c) {
      return '<tr><td>' + NS.esc(c.label) + '</td><td class="num">' + NS.fmtMoney(c.value, 2) + '</td><td class="num">' + (d.expenseTotal ? NS.fmtNum(c.value / d.expenseTotal * 100, 1) : '0') + '%</td></tr>';
    }).join('');
    const html =
      '<div class="doc-head"><div class="doc-brand"><div class="doc-mark">MP</div><div><b>' + NS.esc(NS.state.db.settings.businessName) + '</b><small>Yönetim raporu</small></div></div>' +
      '<div class="doc-title"><h1>DÖNEM RAPORU</h1><p>' + NS.esc(d.range.label) + '</p><div class="doc-no">' + NS.fmtDate(NS.todayISO()) + '</div></div></div>' +
      '<div class="doc-summary">' +
        '<div><small>Toplanan süt</small><b>' + NS.fmtNum(d.liters, 1) + ' L</b></div>' +
        '<div><small>Brüt hakediş</small><b>' + NS.fmtMoney(d.gross, 0) + '</b></div>' +
        '<div><small>Masraf</small><b>' + NS.fmtMoney(d.expenseTotal, 0) + '</b></div>' +
        '<div><small>Net katkı</small><b>' + NS.fmtMoney(d.net, 0) + '</b></div>' +
      '</div>' +
      '<div class="doc-badge-line"><span>' + d.records.length + ' süt kaydı</span><span>' + d.producers.length + ' üretici</span><span>Ortalama kalite ' + (d.quality ? NS.fmtNum(d.quality, 1) : '—') + '</span><span>A ' + d.grades.A + ' / B ' + d.grades.B + ' / C ' + d.grades.C + '</span></div>' +
      '<div class="doc-section-title">Sütçü performansı</div>' +
      '<table class="doc-table"><thead><tr><th>Sütçü</th><th>Rota</th><th class="num">Süt (L)</th><th class="num">Hakediş</th><th class="num">Kayıt</th><th class="num">Kalite</th></tr></thead><tbody>' + (collectorRows || '<tr><td colspan="6">Veri yok.</td></tr>') + '</tbody></table>' +
      '<div class="doc-section-title">Üretici performansı · ilk 15</div>' +
      '<table class="doc-table"><thead><tr><th>#</th><th>Üretici</th><th>Rota</th><th class="num">Süt (L)</th><th class="num">Kalite</th><th class="num">Hakediş</th><th class="num">Kayıt</th></tr></thead><tbody>' + (producerRows || '<tr><td colspan="7">Veri yok.</td></tr>') + '</tbody></table>' +
      '<div class="doc-section-title">Gider dağılımı</div>' +
      '<table class="doc-table"><thead><tr><th>Kalem</th><th class="num">Tutar</th><th class="num">Pay</th></tr></thead><tbody>' + (expenseRows || '<tr><td colspan="3">Masraf yok.</td></tr>') + '</tbody>' +
      '<tfoot><tr><td>TOPLAM</td><td class="num">' + NS.fmtMoney(d.expenseTotal, 2) + '</td><td class="num">%100</td></tr></tfoot></table>' +
      '<div class="doc-note">Rapor ' + NS.esc(NS.state.db.settings.businessName) + ' yerel kayıtlarından üretilmiştir. Kalite puanı numune sonuçlarına dayanır.</div>' +
      '<div class="doc-footer"><span>' + NS.esc(NS.state.db.settings.address) + '</span><span>MandıraPro 2.0</span></div>';
    NS.printDoc({ title: 'Dönem raporu', subtitle: d.range.label, html: html });
  };

  NS.exportReportXLSX = function () {
    const d = NS.reportData();
    const summary = [
      ['MandıraPro dönem raporu', d.range.label],
      ['Tarih aralığı', NS.fmtDate(d.range.start) + ' – ' + NS.fmtDate(d.range.end)],
      [],
      ['Toplanan süt (L)', d.liters],
      ['Brüt hakediş (₺)', d.gross],
      ['Yem bedeli (₺)', d.feedCost],
      ['Masraf (₺)', d.expenseTotal],
      ['Net katkı (₺)', d.net],
      ['Ortalama kalite', d.quality || ''],
      ['A / B / C numune', d.grades.A + ' / ' + d.grades.B + ' / ' + d.grades.C]
    ];
    const producers = [['Üretici', 'Kod', 'Sütçü', 'Rota', 'Süt (L)', 'Hakediş', 'Yem', 'Kayıt', 'Kalite']];
    d.producers.forEach(function (x) {
      producers.push([x.producer.name, x.producer.code, x.collector ? x.collector.name : '', x.collector ? x.collector.route : '', x.liters, x.gross, x.feedCost, x.count, x.quality || '']);
    });
    const collectors = [['Sütçü', 'Rota', 'Üretici', 'Süt (L)', 'Hakediş', 'Kayıt', 'Kalite']];
    d.collectors.forEach(function (x) {
      collectors.push([x.collector.name, x.collector.route, x.producers, x.liters, x.gross, x.count, x.quality || '']);
    });
    const expenses = [['Tarih', 'Tür', 'Araç', 'Açıklama', 'Tutar']];
    d.expenses.forEach(function (e) {
      const v = NS.vehicleById(e.vehicleId);
      expenses.push([e.date, e.type, v ? v.plate : '', e.note || '', e.amount]);
    });
    const categories = [['Gider kalemi', 'Tutar', 'Pay %']];
    d.categories.forEach(function (c) {
      categories.push([c.label, c.value, d.expenseTotal ? NS.round(c.value / d.expenseTotal * 100, 1) : 0]);
    });
    NS.exportXLSX('mandirapro-rapor-' + NS.todayISO() + '.xlsx', [
      { name: 'Özet', rows: summary, widths: [26, 28] },
      { name: 'Üreticiler', rows: producers, widths: [24, 10, 18, 18, 12, 14, 12, 10, 10] },
      { name: 'Sütçüler', rows: collectors, widths: [20, 20, 10, 12, 14, 10, 10] },
      { name: 'Giderler', rows: expenses, widths: [12, 14, 14, 34, 14] },
      { name: 'Gider Özeti', rows: categories, widths: [18, 14, 10] }
    ]);
  };

  NS.exportReportCSV = function () {
    const d = NS.reportData();
    const rows = d.producers.map(function (x) {
      return [x.producer.name, x.producer.code, x.collector ? x.collector.name : '', x.liters, x.gross, x.feedCost, x.count, x.quality || ''];
    });
    NS.exportCSV('mandirapro-rapor-' + NS.todayISO() + '.csv', ['Üretici', 'Kod', 'Sütçü', 'Süt (L)', 'Hakediş', 'Yem', 'Kayıt', 'Kalite'], rows);
  };

})(window.MPApp);
