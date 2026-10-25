/* ============================================================
   MandıraPro 2.0 — Üreticiler
   ============================================================ */
(function (NS) {
  'use strict';

  NS.hooks = NS.hooks || {};

  NS.filteredProducers = function () {
    const f = NS.state.prod;
    let list = NS.visibleProducers().slice();
    if (f.collector) list = list.filter(function (p) { return p.collectorId === f.collector; });
    if (f.status === 'active') list = list.filter(function (p) { return p.active; });
    if (f.status === 'passive') list = list.filter(function (p) { return !p.active; });
    if (f.q) {
      const q = f.q.toLocaleLowerCase('tr-TR');
      list = list.filter(function (p) {
        return [p.name, p.code, p.village, p.phone, p.address].join(' ').toLocaleLowerCase('tr-TR').indexOf(q) !== -1;
      });
    }
    list.sort(function (a, b) {
      const ca = NS.collectorById(a.collectorId), cb = NS.collectorById(b.collectorId);
      const ra = ca ? ca.route : '', rb = cb ? cb.route : '';
      return ra.localeCompare(rb, 'tr') || (a.sira || 0) - (b.sira || 0);
    });
    return list;
  };

  NS.renderProducers = function () {
    const f = NS.state.prod;
    const all = NS.visibleProducers();
    const list = NS.filteredProducers();
    const today = NS.todayISO();
    const from30 = NS.isoOffset(-29);
    const perPage = 24;
    const page = Math.max(1, Math.min(f.page || 1, Math.ceil(list.length / perPage) || 1));
    const pageList = list.slice((page - 1) * perPage, page * perPage);
    const visibleIds = {};
    list.forEach(function (p) { visibleIds[p.id] = true; });
    const listRecords = NS.state.db.records.filter(function (r) {
      return visibleIds[r.producerId] && r.date >= from30 && r.date <= today;
    });
    const listAnimals = NS.sum(list.map(function (p) { return p.animalCount; }));
    const listLiters = NS.sumLiters(listRecords);
    const listBalance = NS.sum(list.map(function (p) { return NS.producerAccount(p.id).balance; }));
    const activeCount = list.filter(function (p) { return p.active; }).length;

    const collectors = NS.visibleCollectors();
    const counts = {};
    all.forEach(function (p) { counts[p.collectorId] = (counts[p.collectorId] || 0) + 1; });

    const chips = '<button type="button" class="chip' + (!f.collector ? ' active' : '') + '" data-action="prod-collector" data-collector="">Tümü <span class="count">' + all.length + '</span></button>' +
      collectors.map(function (c) {
        return '<button type="button" class="chip' + (f.collector === c.id ? ' active' : '') + '" data-action="prod-collector" data-collector="' + c.id + '">' +
          '<i style="width:6px;height:6px;border-radius:50%;background:' + c.color + '"></i>' + NS.esc(c.route) + ' <span class="count">' + (counts[c.id] || 0) + '</span>' +
        '</button>';
      }).join('');

    const rows = pageList.map(function (p) {
      const c = NS.collectorById(p.collectorId);
      const recs = NS.recordsForProducer(p.id, from30, today);
      const liters = NS.sumLiters(recs);
      const q = NS.avgQuality(recs);
      const acc = NS.producerAccount(p.id);
      return '<button type="button" class="prod-row" data-action="open-producer" data-id="' + p.id + '">' +
        '<span class="prod-row-avatar">' + NS.avatarHTML(p.name) + '</span>' +
        '<span class="prod-row-main">' +
          '<span class="prod-row-title"><b>' + NS.esc(p.name) + '</b><code>' + NS.esc(p.code) + '</code>' + (p.active ? '' : '<i class="status-dot"></i><span class="passive">Pasif</span>') + '</span>' +
          '<span class="prod-row-sub">' + NS.esc(p.village) + ' · ' + NS.esc(p.phone || 'Telefon yok') + '</span>' +
        '</span>' +
        '<span class="prod-row-route"><i class="route-dot" style="background:' + (c ? c.color : 'var(--faint)') + '"></i><span><b>' + NS.esc(c ? c.route : 'Rota yok') + '</b><small>' + (c ? NS.esc(c.name) + ' · ' : '') + 'sıra ' + p.sira + '</small></span></span>' +
        '<span class="prod-row-metric liters-metric"><b>' + NS.fmtNum(liters, 0) + ' L</b><small>30 gün</small></span>' +
        '<span class="prod-row-metric balance-metric"><b class="' + (acc.balance > 0 ? 'tone-pos' : acc.balance < 0 ? 'tone-neg' : 'tone-muted') + '">' + NS.fmtMoney(acc.balance, 0) + '</b><small>bakiye</small></span>' +
        '<span class="prod-row-quality">' + (q ? NS.qualityBadge(q >= 82 ? 'A' : q >= 65 ? 'B' : 'C', q) : '<span class="faint">—</span>') + '</span>' +
        '<span class="prod-row-arrow">' + NS.icon('chevron-right') + '</span>' +
      '</button>';
    }).join('');

    return '<div class="page stagger">' +

      '<section class="simple-head">' +
        '<div class="simple-summary">' +
          '<span class="simple-label">Üretici defteri</span>' +
          '<p><b>' + list.length + '</b> üretici <i>·</i> <b>' + listAnimals + '</b> hayvan <i>·</i> son 30 gün <b>' + NS.fmtNum(listLiters, 0) + ' L</b>' +
            (activeCount !== list.length ? ' <i>·</i> <b>' + activeCount + '</b> aktif' : '') + '</p>' +
        '</div>' +
        '<div class="simple-actions">' +
          '<details class="mini-menu">' +
            '<summary class="btn btn-ghost btn-sm menu-summary">' + NS.icon('more') + ' İşlemler ' + NS.icon('chevron-down') + '</summary>' +
            '<div class="mini-menu-pop">' +
              '<button type="button" data-action="export-producers">' + NS.icon('download') + '<span><b>Listeyi dışa aktar</b><small>Excel üretici dosyası</small></span></button>' +
              '<button type="button" data-action="import-producers">' + NS.icon('upload') + '<span><b>Excel’den içe aktar</b><small>Üreticileri toplu ekle</small></span></button>' +
              '<button type="button" data-action="producer-template">' + NS.icon('file-text') + '<span><b>Excel şablonu</b><small>Boş doldurma şablonu</small></span></button>' +
            '</div>' +
          '</details>' +
          '<button class="btn btn-primary btn-sm" type="button" data-action="new-producer">' + NS.icon('plus') + ' Yeni üretici</button>' +
        '</div>' +
      '</section>' +

      '<section class="list-panel">' +
        '<div class="list-toolbar">' +
          '<div class="search-field">' + NS.icon('search') + '<input class="input" type="text" placeholder="Ad, kod, köy veya telefon ara…" value="' + NS.esc(f.q) + '" data-filter="prod-q"></div>' +
          '<select class="select compact" data-filter="prod-status">' +
            '<option value="all"' + (f.status === 'all' ? ' selected' : '') + '>Tüm durumlar</option>' +
            '<option value="active"' + (f.status === 'active' ? ' selected' : '') + '>Aktif</option>' +
            '<option value="passive"' + (f.status === 'passive' ? ' selected' : '') + '>Pasif</option>' +
          '</select>' +
        '</div>' +
        '<div class="chip-row list-chips">' + chips + '</div>' +
        '<div class="producer-list">' + (rows || NS.emptyState('users', 'Üretici bulunamadı', 'Aramayı veya filtreyi değiştirin.')) + '</div>' +
        (list.length > perPage ? NS.pagerHTML(list.length, page, perPage, 'prod-page') : '<div class="list-foot"><span>' + list.length + ' üretici listeleniyor</span>' + (f.q || f.status !== 'all' || f.collector ? '<button type="button" data-action="prod-clear">Filtreleri temizle</button>' : '') + '</div>') +
      '</section>' +

      '<div class="list-hint">' + NS.icon('qr') + '<span>QR etiketi her üreticinin numune şişesine yapıştırılır. Listeden bir üreteci seçin; kayıt, kalite, cari ve fatura ekranları orada açılır.</span></div>' +

    '</div>';
  };

  NS.hooks.producers = function () {
    NS.$$('.producer-card').forEach(function (card) {
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
      });
    });
  };

  /* ---------------- Detay çekmecesi ---------------- */
  NS.openProducerDrawer = function (id, tab) {
    const p = NS.producerById(id);
    if (!p || !NS.canSeeProducer(id)) return;
    const c = NS.collectorById(p.collectorId);
    const today = NS.todayISO();
    const from30 = NS.isoOffset(-29);
    const recs30 = NS.recordsForProducer(id, from30, today);
    const allRecs = NS.recordsForProducer(id);
    const q = NS.avgQuality(recs30);
    const acc = NS.producerAccount(id);
    const account = NS.producerAccount(id, NS.monthStart(today.slice(0, 7)), today);
    const samples = NS.state.db.samples.filter(function (s) { return s.producerId === id; }).slice(-6).reverse();
    const payments = NS.state.db.payments.filter(function (x) { return x.producerId === id; }).slice(-5).reverse();
    const currentTab = tab || 'overview';

    const tabs = [
      ['overview', 'Genel'], ['milk', 'Süt kayıtları'], ['quality', 'Kalite'], ['account', 'Hesap']
    ];

    let tabBody = '';
    if (currentTab === 'overview') {
      tabBody =
        '<div class="detail-section"><h4>Üretici bilgileri</h4>' +
          NS.statRow('Telefon', p.phone || '—') +
          NS.statRow('Köy / adres', p.village + ' · ' + p.address) +
          NS.statRow('Vergi no / dairesi', p.taxNo + ' · ' + p.taxOffice) +
          NS.statRow('IBAN', p.iban || '—') +
          NS.statRow('Fiyat listesi', NS.priceListFor(p) ? NS.priceListFor(p).name : '—') +
          NS.statRow('Kayıt tarihi', NS.fmtDate(p.joinedAt)) +
          (p.note ? NS.statRow('Not', p.note) : '') +
        '</div>' +
        '<div class="detail-section"><h4>QR etiketi</h4>' +
          '<div class="row gap-14">' +
            '<div class="qr-box"><div>' + NS.qrSVG(p.qr, 4) + '</div><div class="qr-label">' + NS.esc(p.code) + '</div></div>' +
            '<div style="flex:1"><p class="small muted" style="line-height:1.55">Numune şişesine yapıştırın. Tarayıcı, kodu okutunca bu üreticiyi otomatik seçer.</p>' +
              '<div class="stack gap-6 mt-12">' +
                '<button class="btn btn-ghost btn-sm" type="button" data-action="qr-print" data-id="' + p.id + '">' + NS.icon('printer') + ' Etiket yazdır</button>' +
                '<button class="btn btn-ghost btn-sm" type="button" data-action="copy-qr" data-id="' + p.id + '">' + NS.icon('copy') + ' Kodu kopyala</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="detail-section"><h4>Rota</h4>' +
          '<div class="route-mini">' +
            '<span class="route-dot" style="background:' + (c ? c.color : 'var(--faint)') + '"></span>' +
            '<div><b>' + NS.esc(c ? c.route : '—') + '</b><small>' + NS.esc(c ? c.name : '') + ' · sıra ' + p.sira + '</small></div>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-action="goto-route" data-collector="' + p.collectorId + '">Rotayı aç</button>' +
          '</div>' +
        '</div>';
    } else if (currentTab === 'milk') {
      const rows = allRecs.slice(-12).reverse().map(function (r) {
        return '<tr><td>' + NS.fmtDate(r.date) + '</td>' +
          '<td class="num"><b>' + NS.fmtNum(r.liters, 1) + '</b> L</td>' +
          '<td>' + (r.quality ? NS.qualityBadge(r.quality.grade, r.quality.score) : '<span class="faint">—</span>') + '</td>' +
          '<td class="num">' + NS.fmtMoney(r.amount, 0) + '</td></tr>';
      }).join('');
      tabBody = '<div class="detail-section"><h4>Son 12 kayıt</h4>' +
        (rows ? '<div class="table-wrap"><table class="table" style="min-width:0"><thead><tr><th>Tarih</th><th class="num">Süt</th><th>Kalite</th><th class="num">Tutar</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : NS.emptyState('drop', 'Kayıt yok', 'Bu üretici için henüz süt kaydı girilmemiş.')) +
        '<button class="btn btn-primary btn-sm mt-12" type="button" data-action="record-for-producer" data-id="' + p.id + '">' + NS.icon('plus') + ' Süt kaydı ekle</button></div>';
    } else if (currentTab === 'quality') {
      const qRows = samples.map(function (s) {
        return '<div class="sample-row"><div><b>' + NS.esc(s.code) + '</b><small>' + NS.fmtDate(s.date) + ' · ' + NS.esc(s.status) + '</small></div>' +
          '<div class="row gap-10"><span class="small">Yağ ' + (s.fat ? NS.fmtNum(s.fat, 1) : '—') + ' · Protein ' + (s.protein ? NS.fmtNum(s.protein, 1) : '—') + '</span>' + NS.qualityBadge(s.grade, s.score) + '</div></div>';
      }).join('');
      tabBody = '<div class="detail-section"><h4>Kalite özeti</h4>' +
        '<div class="stat-grid">' +
          '<div class="cm"><small>Ortalama puan</small><b>' + (q ? NS.fmtNum(q, 1) : '—') + '</b></div>' +
          '<div class="cm"><small>A sınıfı</small><b>' + NS.gradeCounts(recs30).A + '</b></div>' +
          '<div class="cm"><small>C sınıfı</small><b class="' + (NS.gradeCounts(recs30).C ? 'tone-neg' : '') + '">' + NS.gradeCounts(recs30).C + '</b></div>' +
        '</div>' +
        '<div class="mt-16">' + (qRows || NS.emptyState('flask', 'Numune yok', 'Numune alındığında sonuçlar burada görünür.')) + '</div>' +
        '<button class="btn btn-ghost btn-sm mt-12" type="button" data-action="sample-for-producer" data-id="' + p.id + '">' + NS.icon('flask') + ' Numune oluştur</button>' +
      '</div>';
    } else {
      tabBody = '<div class="detail-section"><h4>Bu ay hesap</h4>' +
        NS.statRow('Toplanan süt', NS.fmtNum(account.liters, 1) + ' L') +
        NS.statRow('Süt hakedişi', NS.fmtMoney(account.gross, 2)) +
        NS.statRow('Yem bedeli', '− ' + NS.fmtMoney(account.feedCost, 2)) +
        NS.statRow('Ürün siparişleri', '− ' + NS.fmtMoney(account.orderTotal, 2)) +
        NS.statRow('Yapılan ödemeler', '− ' + NS.fmtMoney(account.paid, 2)) +
        '<div class="stat-row" style="border-top:1px solid var(--border-strong);margin-top:5px;padding-top:8px"><span><b>Kalan bakiye</b></span><b class="' + (account.balance >= 0 ? 'tone-pos' : 'tone-neg') + '" style="font-size:15px">' + NS.fmtMoney(account.balance, 2) + '</b></div>' +
        '<div class="row gap-6 mt-12">' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="statement-producer" data-id="' + p.id + '">' + NS.icon('printer') + ' Ekstre</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="payment-producer" data-id="' + p.id + '">' + NS.icon('wallet') + ' Ödeme gir</button>' +
        '</div>' +
        '<div class="detail-section mt-16"><h4>Tüm zamanlar</h4>' +
          NS.statRow('Toplam süt', NS.fmtNum(acc.liters, 1) + ' L') +
          NS.statRow('Toplam hakediş', NS.fmtMoney(acc.gross, 0)) +
          NS.statRow('Toplam yem', NS.fmtMoney(acc.feedCost, 0)) +
          NS.statRow('Toplam ödeme', NS.fmtMoney(acc.paid, 0)) +
        '</div>' +
        (payments.length ? '<div class="detail-section mt-16"><h4>Son ödemeler</h4>' + payments.map(function (x) {
          return '<div class="row between" style="font-size:11.5px;padding:5px 0;border-bottom:1px dashed var(--border)"><span>' + NS.fmtDate(x.date) + ' · ' + NS.esc(x.type) + '</span><b>' + NS.fmtMoney(x.amount, 0) + '</b></div>';
        }).join('') + '</div>' : '') +
      '</div>';
    }

    const body =
      '<div class="drawer-head">' + NS.avatarHTML(p.name) +
        '<div><h3>' + NS.esc(p.name) + '</h3><small>' + NS.esc(p.code) + ' · ' + NS.esc(p.village) + ' · ' + NS.esc(c ? c.route : '') + '</small></div>' +
        '<button class="icon-btn" type="button" data-action="close-drawer" aria-label="Kapat">' + NS.icon('x') + '</button>' +
      '</div>' +
      '<div class="drawer-body">' +
        '<div class="drawer-stats">' +
          '<div class="cm"><small>30 GÜN</small><b>' + NS.fmtNum(NS.sumLiters(recs30), 0) + ' L</b></div>' +
          '<div class="cm"><small>KALİTE</small><b>' + (q ? NS.fmtNum(q, 0) : '—') + '</b></div>' +
          '<div class="cm"><small>BAKİYE</small><b class="' + (acc.balance >= 0 ? 'tone-pos' : 'tone-neg') + '">' + NS.fmtMoney(acc.balance, 0) + '</b></div>' +
        '</div>' +
        '<div class="drawer-actions">' +
          '<button class="btn btn-primary btn-sm" type="button" data-action="record-for-producer" data-id="' + p.id + '">' + NS.icon('plus') + ' Süt kaydı</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="edit-producer" data-id="' + p.id + '">' + NS.icon('edit') + ' Düzenle</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="qr-producer" data-id="' + p.id + '">' + NS.icon('qr') + ' QR</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="delete-producer" data-id="' + p.id + '">' + NS.icon('trash') + '</button>' +
        '</div>' +
        '<div class="detail-tabs">' + tabs.map(function (t) {
          return '<button type="button" class="' + (currentTab === t[0] ? 'active' : '') + '" data-action="producer-tab" data-id="' + p.id + '" data-tab="' + t[0] + '">' + t[1] + '</button>';
        }).join('') + '</div>' +
        '<div class="stack gap-14">' + tabBody + '</div>' +
      '</div>';

    NS.openDrawer(body, 'wide');
  };

  NS.openProducerQR = function (id) {
    const p = NS.producerById(id);
    if (!p) return;
    NS.openModal({
      title: 'Üretici QR etiketi',
      subtitle: p.name + ' · ' + p.code,
      size: 'sm',
      body:
        '<div class="stack gap-14 center">' +
          '<div class="qr-box" style="margin:0 auto"><div>' + NS.qrSVG(p.qr, 5) + '</div><div class="qr-label">' + NS.esc(p.code) + ' · ' + NS.esc(p.name) + '</div></div>' +
          '<p class="small muted" style="max-width:300px;margin:0 auto;line-height:1.55">Numune şişesinin üzerine yapıştırın. QR okutulduğunda üretici kaydı otomatik eşleşir.</p>' +
          '<span class="code-tag">' + NS.esc(p.qr) + '</span>' +
        '</div>',
      footer:
        '<button class="btn btn-ghost" type="button" data-action="copy-qr" data-id="' + p.id + '">' + NS.icon('copy') + ' Kodu kopyala</button>' +
        '<button class="btn btn-primary" type="button" data-action="qr-print" data-id="' + p.id + '">' + NS.icon('printer') + ' Etiket yazdır</button>'
    });
  };

  NS.printProducerLabels = function (id) {
    const p = NS.producerById(id);
    if (!p) return;
    const one = '<div class="label-card"><div class="label-qr">' + NS.qrSVG(p.qr, 5) + '</div>' +
      '<div class="label-info"><b>' + NS.esc(p.name) + '</b><span>' + NS.esc(p.code) + ' · ' + NS.esc(p.village) + '</span><small>MandıraPro numune etiketi</small></div></div>';
    NS.printDoc({
      title: 'Üretici etiketi',
      subtitle: p.code,
      html: '<div class="doc-sheet" style="min-height:auto"><h2 class="doc-h2">Numune etiketi</h2><p class="doc-p">Etiketi kesip numune şişesine yapıştırın. Bir sayfada dört kopya bulunur.</p><div class="label-grid">' + one + one + one + one + '</div></div>'
    });
  };

  NS.exportProducerList = function () {
    const list = NS.filteredProducers();
    const rows = [['Kod', 'Ad Soyad', 'Telefon', 'Köy', 'Adres', 'Sütçü', 'Rota', 'Sıra', 'Hayvan', 'Fiyat Listesi', 'Aktif', 'Bakiye (₺)']];
    list.forEach(function (p) {
      const c = NS.collectorById(p.collectorId);
      rows.push([p.code, p.name, p.phone, p.village, p.address, c ? c.name : '', c ? c.route : '', p.sira, p.animalCount, NS.priceListFor(p) ? NS.priceListFor(p).name : '', p.active ? 'Evet' : 'Hayır', NS.producerAccount(p.id).balance]);
    });
    NS.exportXLSX('mandirapro-ureticiler-' + NS.todayISO() + '.xlsx', [{ name: 'Üreticiler', rows: rows, widths: [10, 24, 18, 16, 26, 20, 20, 8, 10, 18, 8, 14] }]);
  };

})(window.MPApp);
