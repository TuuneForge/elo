/* ============================================================
   MandıraPro 2.0 — Numune & Kalite
   ============================================================ */
(function (NS) {
  'use strict';

  NS.hooks = NS.hooks || {};

  NS.filteredSamples = function () {
    const f = NS.state.qual;
    let list = NS.state.db.samples.filter(NS.canSeeProducer ? function (s) { return NS.canSeeProducer(s.producerId); } : function () { return true; });
    if (f.status !== 'all') list = list.filter(function (s) { return s.status === f.status; });
    if (f.q) {
      const q = f.q.toLocaleLowerCase('tr-TR');
      list = list.filter(function (s) {
        const p = NS.producerById(s.producerId);
        return [s.code, p ? p.name : '', p ? p.code : '', p ? p.village : ''].join(' ').toLocaleLowerCase('tr-TR').indexOf(q) !== -1;
      });
    }
    list.sort(function (a, b) { return String(b.date + (b.createdAt || '')).localeCompare(String(a.date + (a.createdAt || ''))); });
    return list;
  };

  NS.renderQuality = function () {
    const db = NS.state.db;
    const f = NS.state.qual;
    const list = NS.filteredSamples();
    const from30 = NS.isoOffset(-29);
    const recent = list.filter(function (s) { return s.date >= from30; });
    const done = recent.filter(function (s) { return s.status === 'Sonuçlandı'; });
    const pending = recent.filter(function (s) { return s.status !== 'Sonuçlandı'; });
    const avg = done.length ? NS.sum(done.map(function (s) { return s.score || 0; })) / done.length : null;
    const cCount = done.filter(function (s) { return s.grade === 'C'; }).length;
    const aCount = done.filter(function (s) { return s.grade === 'A'; }).length;
    const pl = db.priceLists[0];

    const rows = list.slice(0, 40).map(function (s) {
      const p = NS.producerById(s.producerId);
      const c = NS.collectorById(s.collectorId);
      return '<tr>' +
        '<td><b class="code-tag" style="font-size:11px">' + NS.esc(s.code) + '</b><div class="cell-sub">' + NS.fmtDate(s.date) + '</div></td>' +
        '<td><div class="prod-cell">' + NS.avatarHTML(p ? p.name : '?') + '<div><b>' + NS.esc(p ? p.name : '—') + '</b><small>' + NS.esc(p ? p.code : '') + ' · ' + NS.esc(c ? c.route : '') + '</small></div></div></td>' +
        '<td><span class="badge ' + NS.statusTone(s.status) + '">' + NS.esc(s.status) + '</span></td>' +
        '<td>' + (s.fat ? '<span class="small">Yağ <b>' + NS.fmtNum(s.fat, 1) + '</b></span><div class="cell-sub">Protein ' + NS.fmtNum(s.protein, 1) + '</div>' : '<span class="faint">—</span>') + '</td>' +
        '<td>' + (s.somatic ? '<span class="small">' + NS.fmtNum(s.somatic, 0) + ' bin</span><div class="cell-sub">Bakteri ' + NS.fmtNum(s.bacteria, 0) + '</div>' : '<span class="faint">—</span>') + '</td>' +
        '<td>' + NS.qualityBadge(s.grade, s.score) + '</td>' +
        '<td class="num">' + (s.score ? '<b>' + NS.fmtNum(s.score, 0) + '</b><div class="cell-sub">/ 100</div>' : '<span class="faint">—</span>') + '</td>' +
        '<td><div class="row-actions">' +
          (s.status !== 'Sonuçlandı'
            ? '<button class="btn btn-soft btn-sm" type="button" data-action="analyze-sample" data-id="' + s.id + '">' + NS.icon('flask') + ' Sonuç gir</button>'
            : '<button class="icon-btn sm" type="button" data-action="analyze-sample" data-id="' + s.id + '" title="Düzenle">' + NS.icon('edit') + '</button>') +
          '<button class="icon-btn sm" type="button" data-action="delete-sample" data-id="' + s.id + '" title="Sil">' + NS.icon('trash') + '</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    const dayLabels = [];
    const dayScores = [];
    for (let i = 13; i >= 0; i--) {
      const d = NS.isoOffset(-i);
      const ds = db.samples.filter(function (s) { return s.date === d && s.status === 'Sonuçlandı' && NS.canSeeProducer(s.producerId); });
      dayLabels.push(NS.fmtDateShort(d));
      dayScores.push(ds.length ? NS.round(NS.sum(ds.map(function (s) { return s.score || 0; })) / ds.length, 1) : 0);
    }
    NS._quality = { labels: dayLabels, scores: dayScores };

    return '<div class="page stagger">' +

      '<section class="page-head">' +
        '<div class="ph-left">' +
          '<div class="page-kicker">' + NS.icon('flask') + ' laboratuvar · kalite kontrol</div>' +
          '<h1>Numune &amp; kalite</h1>' +
          '<p>Son 30 günde <b>' + done.length + '</b> sonuç, <b>' + pending.length + '</b> numune işlemde. Ortalama skor <b>' + (avg ? NS.fmtNum(avg, 1) : '—') + '</b>; A sınıfı oranı %' + (done.length ? Math.round(aCount / done.length * 100) : 0) + '.</p>' +
        '</div>' +
        '<div class="ph-actions">' +
          '<button class="btn btn-ghost" type="button" data-action="quality-export">' + NS.icon('download') + ' Dışa aktar</button>' +
          '<button class="btn btn-ghost" type="button" data-action="scan-open" data-manual="1">' + NS.icon('qr') + ' Kod gir</button>' +
          '<button class="btn btn-primary" type="button" data-action="scan-open">' + NS.icon('scan') + ' Numune eşle</button>' +
        '</div>' +
      '</section>' +

      '<div class="grid-4">' +
        '<div class="mini-stat"><small>İşlemdeki numune</small><b>' + pending.length + '</b><span>' + recent.filter(function (s) { return s.status === 'Analizde'; }).length + ' analizde · ' + recent.filter(function (s) { return s.status === 'Bekliyor'; }).length + ' bekliyor</span></div>' +
        '<div class="mini-stat"><small>Ortalama skor</small><b>' + (avg ? NS.fmtNum(avg, 0) : '—') + '<em>/100</em></b><span>son 30 gün</span></div>' +
        '<div class="mini-stat"><small>A sınıfı oranı</small><b>%' + (done.length ? Math.round(aCount / done.length * 100) : 0) + '</b><span>' + aCount + ' numune</span></div>' +
        '<div class="mini-stat"><small>C sınıfı uyarı</small><b class="' + (cCount ? 'tone-neg' : '') + '">' + cCount + '</b><span>fiyat primi düşer</span></div>' +
      '</div>' +

      '<div class="grid-main">' +
        '<section class="card">' +
          '<div class="card-head"><div><h3>Günlük ortalama kalite skoru</h3><p>Son 14 gün · sonuçlanan numuneler</p></div><span class="badge primary">' + (pl ? NS.esc(pl.name) : 'Fiyat listesi') + '</span></div>' +
          '<div class="card-body"><div id="qualityTrend"></div></div>' +
        '</section>' +

        '<section class="card">' +
          '<div class="card-head"><div><h3>Kalite basamakları</h3><p>Fiyat listesine otomatik yansır</p></div><a class="card-link" href="#" data-action="nav" data-view="settings">Fiyatlar ' + NS.icon('chevron-right') + '</a></div>' +
          '<div class="card-body">' +
            '<div class="quality-scale" style="flex-direction:column">' +
              '<div class="q-grade a"><span class="g">A</span><div><b>A · 82 puan ve üzeri</b><small>Yağ, protein ve somatik üst bandı</small></div><span class="badge success" style="margin-left:auto">+' + NS.fmtNum(pl ? pl.gradeDelta.A : 0, 2) + ' ₺/L</span></div>' +
              '<div class="q-grade b"><span class="g">B</span><div><b>B · 65 – 81 puan</b><small>Standart kabul bandı</small></div><span class="badge info" style="margin-left:auto">baz fiyat</span></div>' +
              '<div class="q-grade c"><span class="g">C</span><div><b>C · 64 puan ve altı</b><small>Somatik veya bakteri yüksek</small></div><span class="badge danger" style="margin-left:auto">' + NS.fmtNum(pl ? pl.gradeDelta.C : 0, 2) + ' ₺/L</span></div>' +
            '</div>' +
            '<div class="inline-note mt-12">' + NS.icon('info') + '<span>Skor; yağ (%30), protein (%25), somatik hücre (%25) ve bakteri (%20) ağırlığıyla hesaplanır. Sonuç girildiği an kayıt fiyatı ve tediye yeniden hesaplanır.</span></div>' +
          '</div>' +
        '</section>' +
      '</div>' +

      '<section class="card">' +
        '<div class="card-head card-head-rule row between">' +
          '<div><h3>Numune kuyruğu</h3><p>QR koduyla üreticiye bağlı numuneler</p></div>' +
          '<div class="row gap-6">' +
            '<select class="select" style="height:34px;font-size:11.5px;width:auto" data-filter="qual-status">' +
              '<option value="all"' + (f.status === 'all' ? ' selected' : '') + '>Tüm durumlar</option>' +
              '<option value="Bekliyor"' + (f.status === 'Bekliyor' ? ' selected' : '') + '>Bekliyor</option>' +
              '<option value="Analizde"' + (f.status === 'Analizde' ? ' selected' : '') + '>Analizde</option>' +
              '<option value="Sonuçlandı"' + (f.status === 'Sonuçlandı' ? ' selected' : '') + '>Sonuçlandı</option>' +
            '</select>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-action="sample-create">' + NS.icon('plus') + ' Numune</button>' +
          '</div>' +
        '</div>' +
        '<div class="card-body" style="padding-top:12px">' +
          '<div class="toolbar mb-10"><div class="toolbar-search">' + NS.icon('search') + '<input class="input" type="text" placeholder="Numune kodu veya üretici ara…" value="' + NS.esc(f.q) + '" data-filter="qual-q"></div>' +
            '<span class="small faint">' + list.length + ' numune</span></div>' +
          '<div class="table-wrap"><table class="table table-wide"><thead><tr>' +
            '<th>Numune</th><th>Üretici</th><th>Durum</th><th>Yağ / protein</th><th>Somatik / bakteri</th><th>Kalite</th><th class="num">Skor</th><th></th>' +
          '</tr></thead><tbody>' + (rows || '<tr><td colspan="8">' + NS.emptyState('flask', 'Numune yok', 'QR okutarak veya elle numune oluşturun.') + '</td></tr>') + '</tbody></table></div>' +
        '</div>' +
      '</section>' +

      '<div class="inline-note" style="padding:0 2px">' + NS.icon('qr') + '<span>Numune etiketleri üretici kaydındaki QR kodu taşır. Sahada okutulan kod, numuneyi doğrudan ilgili üretici ve süt kaydıyla eşleştirir.</span></div>' +

    '</div>';
  };

  NS.hooks.quality = function () {
    const d = NS._quality;
    if (!d) return;
    NS.barChart(NS.$('#qualityTrend'), d.labels.map(function (l, i) {
      return { label: l, value: d.scores[i], full: l + ' · ' + d.scores[i] + ' puan' };
    }), {
      unit: 'puan', height: 220, color: 'var(--info)',
      aria: 'Günlük ortalama kalite skoru'
    });
  };

  NS.exportQuality = function () {
    const list = NS.filteredSamples();
    const rows = [['Numune', 'Tarih', 'Üretici', 'Kod', 'Durum', 'Yağ', 'Protein', 'Somatik', 'Bakteri', 'Puan', 'Sınıf', 'Not']];
    list.forEach(function (s) {
      const p = NS.producerById(s.producerId);
      rows.push([s.code, s.date, p ? p.name : '', p ? p.code : '', s.status, s.fat || '', s.protein || '', s.somatic || '', s.bacteria || '', s.score || '', s.grade || '', s.labNote || '']);
    });
    NS.exportXLSX('mandirapro-numuneler-' + NS.todayISO() + '.xlsx', [{ name: 'Numuneler', rows: rows, widths: [16, 12, 22, 10, 12, 8, 9, 10, 10, 8, 8, 30] }]);
  };

})(window.MPApp);
