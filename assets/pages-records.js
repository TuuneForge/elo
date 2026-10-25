/* ============================================================
   MandıraPro 2.0 — Süt Kayıtları
   ============================================================ */
(function (NS) {
  'use strict';

  NS.hooks = NS.hooks || {};

  function isoShift(iso, days) {
    const d = new Date((iso || NS.todayISO()) + 'T12:00:00');
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  }

  NS.recordRange = function (range, date) {
    const day = date || NS.todayISO();
    if (range === 'day' || range === 'today') return { start: day, end: day };
    if (range === 'week') return { start: isoShift(day, -6), end: day };
    if (range === 'month') return { start: NS.monthStart(day.slice(0, 7)), end: NS.monthEnd(day.slice(0, 7)) };
    return { start: '0000-01-01', end: '9999-12-31' };
  };

  NS.recordsFiltered = function () {
    const f = NS.state.rec;
    const range = NS.recordRange(f.range, f.date);
    let list = NS.visibleRecords().filter(function (r) { return r.date >= range.start && r.date <= range.end; });
    if (f.producer) list = list.filter(function (r) { return r.producerId === f.producer; });
    if (f.collector) list = list.filter(function (r) { return r.collectorId === f.collector; });
    if (f.grade) {
      list = list.filter(function (r) {
        const g = r.quality ? r.quality.grade : '-';
        return g === f.grade;
      });
    }
    if (f.q) {
      const q = f.q.toLocaleLowerCase('tr-TR');
      list = list.filter(function (r) {
        const p = NS.producerById(r.producerId);
        return [p ? p.name : '', p ? p.code : '', p ? p.village : '', r.note || '', r.date].join(' ').toLocaleLowerCase('tr-TR').indexOf(q) !== -1;
      });
    }
    list.sort(function (a, b) {
      return String(b.date + (b.createdAt || '')).localeCompare(String(a.date + (a.createdAt || '')));
    });
    return list;
  };

  function rangeCaption(f) {
    const day = f.date || NS.todayISO();
    if (f.range === 'day' || f.range === 'today') return NS.fmtDateFull(day);
    if (f.range === 'week') return NS.fmtDateShort(isoShift(day, -6)) + ' – ' + NS.fmtDateShort(day);
    if (f.range === 'month') return NS.monthLabel(day.slice(0, 7));
    return 'Tüm zamanlar';
  }

  NS.renderRecords = function () {
    const f = NS.state.rec;
    const list = NS.recordsFiltered();
    const perPage = f.perPage || 12;
    const page = Math.max(1, Math.min(f.page || 1, Math.ceil(list.length / perPage) || 1));
    const rows = list.slice((page - 1) * perPage, page * perPage);
    const totalLiters = NS.sumLiters(list);
    const totalAmount = NS.sumAmount(list);
    const totalFeedKg = NS.sumFeedKg(list);
    const avgQ = NS.avgQuality(list);
    const collectors = NS.visibleCollectors();
    const producers = NS.visibleProducers();
    const selectedDay = f.date || NS.todayISO();
    const advCount = [f.collector, f.grade].filter(Boolean).length;

    const bodyRows = rows.map(function (r) {
      const p = NS.producerById(r.producerId);
      const c = NS.collectorById(r.collectorId);
      const grade = r.quality ? r.quality.grade : null;
      const sample = r.sampleId ? NS.state.db.samples.find(function (s) { return s.id === r.sampleId; }) : null;
      return '<tr class="clickable" data-action="edit-record" data-id="' + r.id + '">' +
        '<td data-label="Tarih"><b class="rec-date">' + NS.fmtDate(r.date) + '</b></td>' +
        '<td data-label="Üretici"><div class="prod-cell">' + NS.avatarHTML(p ? p.name : '?') + '<div><b>' + NS.esc(p ? p.name : '—') + '</b><small>' + NS.esc(p ? p.code : '') + ' · ' + NS.esc(p ? p.village : '') + '</small></div></div></td>' +
        '<td data-label="Süt" class="num"><b>' + NS.fmtNum(r.liters, 1) + '</b> <span class="faint">L</span><span class="cell-sub">' + NS.esc(c ? c.route : '—') + '</span></td>' +
        '<td data-label="Kalite">' + (r.quality
          ? NS.qualityBadge(grade, r.quality.score) + '<div class="cell-sub">Yağ ' + NS.fmtNum(r.quality.fat, 1) + ' · Protein ' + NS.fmtNum(r.quality.protein, 1) + '</div>'
          : '<span class="badge">numune yok</span>') + (sample ? '<div class="cell-sub code-sub">' + NS.esc(sample.code) + '</div>' : '') + '</td>' +
        '<td data-label="Yem">' + NS.feedCellHTML(r.feeds) + '</td>' +
        '<td data-label="Hakediş" class="num"><b>' + NS.fmtMoney(r.amount, 0) + '</b><span class="cell-sub">' + NS.fmtMoney(r.price, 2) + ' / L</span></td>' +
        '<td class="rec-row-actions"><div class="row-actions">' +
          '<button class="icon-btn sm" type="button" data-action="edit-record" data-id="' + r.id + '" title="Düzenle">' + NS.icon('edit') + '</button>' +
          '<button class="icon-btn sm" type="button" data-action="delete-record" data-id="' + r.id + '" title="Sil">' + NS.icon('trash') + '</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    return '<div class="page stagger">' +

      '<section class="simple-head">' +
        '<div class="simple-summary">' +
          '<span class="simple-label">Seçili dönem</span>' +
          '<p><b>' + list.length + '</b> kayıt <i>·</i> <b>' + NS.fmtNum(totalLiters, 1) + ' L</b> süt <i>·</i> <b>' + NS.fmtNum(totalFeedKg, 1) + ' kg</b> yem <i>·</i> <b>' + NS.fmtMoney(totalAmount, 0) + '</b> hakediş' +
            (avgQ ? ' <i>·</i> kalite <b>' + NS.fmtNum(avgQ, 0) + '</b>' : '') + '</p>' +
        '</div>' +
        '<div class="simple-actions">' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="print-route-sheet">' + NS.icon('printer') + ' Günlük liste</button>' +
          '<details class="mini-menu">' +
            '<summary class="btn btn-ghost btn-sm menu-summary">' + NS.icon('download') + ' Dışa aktar ' + NS.icon('chevron-down') + '</summary>' +
            '<div class="mini-menu-pop">' +
              '<button type="button" data-action="export-records-xlsx">' + NS.icon('file-text') + '<span><b>Excel</b><small>Kalite ve fiyat ayrıntılı</small></span></button>' +
              '<button type="button" data-action="export-records">' + NS.icon('download') + '<span><b>CSV</b><small>Hızlı tablo çıktısı</small></span></button>' +
            '</div>' +
          '</details>' +
          '<button class="btn btn-primary btn-sm" type="button" data-action="new-record">' + NS.icon('plus') + ' Yeni kayıt</button>' +
        '</div>' +
      '</section>' +

      '<section class="list-panel">' +
        '<div class="records-controls">' +
          '<div class="search-field">' + NS.icon('search') + '<input class="input" type="text" placeholder="Üretici, kod, köy veya not ara…" value="' + NS.esc(f.q) + '" data-filter="rec-q"></div>' +
          '<select class="select compact" data-filter="rec-producer"><option value="">Tüm üreticiler</option>' + producers.map(function (p) {
            return '<option value="' + p.id + '"' + (f.producer === p.id ? ' selected' : '') + '>' + NS.esc(p.name) + '</option>';
          }).join('') + '</select>' +
          '<details class="filter-more"' + (advCount ? ' open' : '') + '>' +
            '<summary class="btn btn-ghost btn-sm filter-toggle">' + NS.icon('filter') + ' Filtreler' + (advCount ? ' <b>' + advCount + '</b>' : '') + '</summary>' +
            '<div class="filter-pop">' +
              (NS.isAdmin() ? '<label class="field"><span class="field-label">Rota</span><select class="select" data-filter="rec-collector"><option value="">Tüm rotalar</option>' + collectors.map(function (c) {
                return '<option value="' + c.id + '"' + (f.collector === c.id ? ' selected' : '') + '>' + NS.esc(c.route) + '</option>';
              }).join('') + '</select></label>' : '') +
              '<label class="field"><span class="field-label">Kalite</span><select class="select" data-filter="rec-grade"><option value="">Tüm kalite</option><option value="A"' + (f.grade === 'A' ? ' selected' : '') + '>A sınıfı</option><option value="B"' + (f.grade === 'B' ? ' selected' : '') + '>B sınıfı</option><option value="C"' + (f.grade === 'C' ? ' selected' : '') + '>C sınıfı</option><option value="-"'+ (f.grade === '-' ? ' selected' : '') + '>Numune bekleyen</option></select></label>' +
              '<button class="btn btn-ghost btn-sm filter-clear" type="button" data-action="rec-clear">' + NS.icon('x') + ' Temizle</button>' +
            '</div>' +
          '</details>' +
        '</div>' +

        '<div class="date-strip">' +
          '<div class="seg range-seg">' +
            '<button type="button" class="' + (f.range === 'day' || f.range === 'today' ? 'active' : '') + '" data-action="rec-range" data-range="day">Gün</button>' +
            '<button type="button" class="' + (f.range === 'week' ? 'active' : '') + '" data-action="rec-range" data-range="week">Hafta</button>' +
            '<button type="button" class="' + (f.range === 'month' ? 'active' : '') + '" data-action="rec-range" data-range="month">Ay</button>' +
            '<button type="button" class="' + (f.range === 'all' ? 'active' : '') + '" data-action="rec-range" data-range="all">Tümü</button>' +
          '</div>' +
          '<div class="date-stepper">' +
            '<button class="icon-btn sm" type="button" data-action="rec-day-step" data-step="-1" title="Önceki gün" aria-label="Önceki gün">' + NS.icon('chevron-left') + '</button>' +
            '<label class="date-field">' + NS.icon('calendar') + '<input type="date" value="' + selectedDay + '" data-filter="rec-date" aria-label="Gün seç"></label>' +
            '<button class="icon-btn sm" type="button" data-action="rec-day-step" data-step="1" title="Sonraki gün" aria-label="Sonraki gün">' + NS.icon('chevron-right') + '</button>' +
          '</div>' +
          '<span class="date-caption">' + NS.esc(rangeCaption(f)) + '</span>' +
        '</div>' +

        '<div class="table-wrap"><table class="table record-table"><thead><tr>' +
          '<th>Tarih</th><th>Üretici</th><th class="num">Süt</th><th>Kalite</th><th>Yem</th><th class="num">Hakediş</th><th></th>' +
        '</tr></thead><tbody>' + (bodyRows || '<tr><td colspan="7">' + NS.emptyState('clipboard', 'Kayıt bulunamadı', 'Tarihi değiştirin, filtreleri temizleyin veya yeni kayıt ekleyin.') + '</td></tr>') + '</tbody>' +
        (list.length ? '<tfoot><tr><td colspan="2">TOPLAM · ' + list.length + ' kayıt</td><td class="num">' + NS.fmtNum(totalLiters, 1) + ' L</td><td></td><td class="num">' + NS.fmtNum(NS.sumFeedKg(list), 1) + ' kg yem</td><td class="num">' + NS.fmtMoney(totalAmount, 0) + '</td><td></td></tr></tfoot>' : '') +
        '</table></div>' +
        NS.pagerHTML(list.length, page, perPage, 'rec-page') +
      '</section>' +

    '</div>';
  };

  NS.exportRecordsXLSX = function () {
    const list = NS.recordsFiltered();
    if (!list.length) { NS.toast('Dışa aktarılacak kayıt yok', 'Filtreleri değiştirin.', 'warn'); return; }
    const headers = ['Tarih', 'Üretici', 'Kod', 'Köy', 'Sütçü', 'Rota', 'Süt (L)', 'Yağ %', 'Protein %', 'Somatik', 'Bakteri', 'Kalite', 'Puan', 'Birim Fiyat', 'Tutar', 'Numune', 'Süt Yemi (kg)', 'Besi Yemi (kg)', 'Buzağı Yemi (kg)', 'Sarı Küspe (kg)', 'Toplam Yem (kg)', 'Yem Bedeli', 'Not'];
    const rows = [headers];
    list.forEach(function (r) {
      const p = NS.producerById(r.producerId);
      const c = NS.collectorById(r.collectorId);
      const s = r.sampleId ? NS.state.db.samples.find(function (x) { return x.id === r.sampleId; }) : null;
      rows.push([
        r.date, p ? p.name : '', p ? p.code : '', p ? p.village : '', c ? c.name : '', c ? c.route : '',
        r.liters, r.quality ? r.quality.fat : '', r.quality ? r.quality.protein : '', r.quality ? r.quality.somatic : '', r.quality ? r.quality.bacteria : '',
        r.quality ? r.quality.grade : '', r.quality ? r.quality.score : '', r.price, r.amount, s ? s.code : '',
        r.feeds && r.feeds.sutYemi || 0, r.feeds && r.feeds.besiYemi || 0, r.feeds && r.feeds.buzagiYemi || 0, r.feeds && r.feeds.sariKusbe || 0,
        NS.feedKgOf(r.feeds), NS.feedCostOf(r.feeds), r.note || ''
      ]);
    });
    rows.push([]);
    rows.push(['TOPLAM', '', '', '', '', '', NS.sumLiters(list), '', '', '', '', '', '', '', NS.sumAmount(list), '', '', '', '', '', NS.sumFeedKg(list), NS.sumFeedCost(list), '']);
    NS.exportXLSX('mandirapro-sut-kayitlari-' + NS.todayISO() + '.xlsx', [{ name: 'Süt Kayıtları', rows: rows, widths: [12, 22, 9, 14, 18, 18, 10, 8, 9, 10, 9, 8, 7, 11, 12, 14, 12, 12, 13, 12, 14, 12, 28] }]);
  };

  NS.exportRecordsCSV = function () {
    const list = NS.recordsFiltered();
    if (!list.length) { NS.toast('Dışa aktarılacak kayıt yok', 'Filtreleri değiştirin.', 'warn'); return; }
    const headers = ['Tarih', 'Üretici', 'Kod', 'Sütçü', 'Süt (L)', 'Kalite', 'Puan', 'Birim Fiyat', 'Tutar', 'Numune', 'Süt Yemi (kg)', 'Besi Yemi (kg)', 'Buzağı Yemi (kg)', 'Sarı Küspe (kg)', 'Toplam Yem (kg)', 'Yem Bedeli', 'Not'];
    const rows = list.map(function (r) {
      const p = NS.producerById(r.producerId);
      const c = NS.collectorById(r.collectorId);
      const s = r.sampleId ? NS.state.db.samples.find(function (x) { return x.id === r.sampleId; }) : null;
      return [r.date, p ? p.name : '', p ? p.code : '', c ? c.name : '', r.liters, r.quality ? r.quality.grade : '', r.quality ? r.quality.score : '', r.price, r.amount, s ? s.code : '',
        r.feeds && r.feeds.sutYemi || 0, r.feeds && r.feeds.besiYemi || 0, r.feeds && r.feeds.buzagiYemi || 0, r.feeds && r.feeds.sariKusbe || 0,
        NS.feedKgOf(r.feeds), NS.feedCostOf(r.feeds), r.note || ''];
    });
    NS.exportCSV('mandirapro-kayitlar-' + NS.todayISO() + '.csv', headers, rows);
  };

})(window.MPApp);
