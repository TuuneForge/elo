/* ============================================================
   MandıraPro 2.0 — Üretici / Çiftlik Portalı
   ============================================================ */
(function (NS) {
  'use strict';

  NS.hooks = NS.hooks || {};

  NS.farmCtx = function () {
    const p = NS.myProducer();
    if (!p) return null;
    const db = NS.state.db;
    const today = NS.todayISO();
    const monthStart = NS.monthStart(today.slice(0, 7));
    const records = NS.recordsForProducer(p.id);
    const monthRecords = records.filter(function (r) { return r.date >= monthStart && r.date <= today; });
    const samples = db.samples.filter(function (s) { return s.producerId === p.id; });
    const orders = db.orders.filter(function (o) { return o.producerId === p.id; });
    const payments = db.payments.filter(function (x) { return x.producerId === p.id; });
    const account = NS.producerAccount(p.id, monthStart, today);
    const all = NS.producerAccount(p.id);
    const collector = NS.collectorById(p.collectorId);
    const q = NS.avgQuality(monthRecords);
    const days = [];
    for (let i = 29; i >= 0; i--) days.push(NS.isoOffset(-i));
    return {
      producer: p, collector: collector, records: records, monthRecords: monthRecords,
      samples: samples, orders: orders, payments: payments, account: account, all: all,
      quality: q, today: today, monthStart: monthStart, days: days
    };
  };

  NS.farmHero = function (ctx, actions) {
    const p = ctx.producer;
    return '<section class="farm-hero">' +
      '<div class="fh-eyebrow">Süt rotası çiftlik · üretici portalı</div>' +
      '<h1>' + NS.esc(p.name) + '</h1>' +
      '<p>' + NS.esc(p.village) + ' · ' + NS.esc(p.animalCount) + ' hayvan · ' + NS.esc(ctx.collector ? ctx.collector.route : 'Rota atanmadı') + ' · Üretici no ' + NS.esc(p.code) + '</p>' +
      '<div class="fh-meta">' +
        '<div><small>Bu ay süt</small><b>' + NS.fmtNum(NS.sumLiters(ctx.monthRecords), 0) + ' L</b></div>' +
        '<div><small>Kalite</small><b>' + (ctx.quality ? NS.fmtNum(ctx.quality, 0) + ' / 100' : 'Numune bekliyor') + '</b></div>' +
        '<div><small>Aylık hakediş</small><b>' + NS.fmtMoney(ctx.account.gross, 0) + '</b></div>' +
        '<div><small>Güncel bakiye</small><b>' + NS.fmtMoney(ctx.all.balance, 0) + '</b></div>' +
      '</div>' +
      (actions ? '<div class="fh-actions">' + actions + '</div>' : '') +
    '</section>';
  };

  NS.renderFarm = function () {
    const ctx = NS.farmCtx();
    if (!ctx) return NS.emptyState('home', 'Çiftlik hesabı bulunamadı', 'Yöneticiden hesabınızı bir üretici kaydına bağlamasını isteyin.');
    const p = ctx.producer;
    const last = ctx.records.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 7);
    const recentSamples = ctx.samples.slice(-5).reverse();
    const lastOrder = ctx.orders.slice(-1)[0];
    const series = ctx.days.map(function (d) {
      const rec = ctx.records.find(function (r) { return r.date === d; });
      return rec ? Number(rec.liters) : 0;
    });
    NS._farm = { days: ctx.days, series: series };

    const deliveryRows = last.map(function (r) {
      return '<tr><td><b style="font-weight:600">' + NS.fmtDate(r.date) + '</b></td>' +
        '<td class="num"><b>' + NS.fmtNum(r.liters, 1) + '</b> L</td>' +
        '<td>' + NS.feedCellHTML(r.feeds) + '</td>' +
        '<td>' + (r.quality ? NS.qualityBadge(r.quality.grade, r.quality.score) : '<span class="badge">sonuç bekliyor</span>') + '</td>' +
        '<td class="num">' + NS.fmtMoney(r.amount, 2) + '</td></tr>';
    }).join('');

    const qualityRows = recentSamples.map(function (s) {
      return '<div class="sample-row"><div><b>' + NS.esc(s.code) + '</b><small>' + NS.fmtDate(s.date) + ' · ' + NS.esc(s.status) + '</small></div>' +
        '<div class="row gap-10">' + NS.qualityBadge(s.grade, s.score) + '</div></div>';
    }).join('');

    return '<div class="page stagger">' +
      '<section class="page-head"><div class="ph-left"><div class="page-kicker">' + NS.icon('home') + ' hoş geldiniz</div><h1>Çiftliğim</h1>' +
        '<p>Bu ay <b>' + NS.fmtNum(NS.sumLiters(ctx.monthRecords), 1) + ' litre</b> süt teslim ettiniz. Ortalama kalite <b>' + (ctx.quality ? NS.fmtNum(ctx.quality, 1) : '—') + '</b>, tahmini hakediş <b>' + NS.fmtMoney(ctx.account.gross, 0) + '</b>.</p></div>' +
        '<div class="ph-actions"><button class="btn btn-ghost" type="button" data-action="farm-print-statement">' + NS.icon('printer') + ' Hesap ekstresi</button>' +
        '<button class="btn btn-primary" type="button" data-action="new-order">' + NS.icon('package') + ' Sipariş talebi</button></div></section>' +

      NS.farmHero(ctx, '<button class="btn btn-ghost btn-sm" type="button" data-action="farm-qr">' + NS.icon('qr') + ' QR kodum</button>') +

      '<div class="grid-4">' +
        '<div class="mini-stat"><small>Bu ay teslim</small><b>' + NS.fmtNum(NS.sumLiters(ctx.monthRecords), 0) + ' <em>L</em></b><span>' + ctx.monthRecords.length + ' teslim</span></div>' +
        '<div class="mini-stat"><small>Kalite puanı</small><b>' + (ctx.quality ? NS.fmtNum(ctx.quality, 0) : '—') + '<em>/100</em></b><span>' + ctx.samples.filter(function (s) { return s.grade === 'A'; }).length + ' A sınıfı sonuç</span></div>' +
        '<div class="mini-stat"><small>Bu ay hakediş</small><b>' + NS.fmtMoney(ctx.account.gross, 0) + '</b><span>yem mahsubu ' + NS.fmtMoney(ctx.account.feedCost, 0) + '</span></div>' +
        '<div class="mini-stat"><small>Güncel bakiye</small><b class="' + (ctx.all.balance >= 0 ? 'tone-pos' : 'tone-neg') + '">' + NS.fmtMoney(ctx.all.balance, 0) + '</b><span>mandıra ile cari hesap</span></div>' +
      '</div>' +

      '<div class="grid-main">' +
        '<section class="card">' +
          '<div class="card-head"><div><h3>Son 30 gün süt teslimi</h3><p>Günlük litre</p></div><span class="badge primary">' + NS.fmtNum(NS.sum(series), 0) + ' L</span></div>' +
          '<div class="card-body"><div id="farmTrend"></div></div>' +
        '</section>' +
        '<section class="card">' +
          '<div class="card-head"><div><h3>Hesap özeti</h3><p>' + NS.capitalize(NS.monthLabel(ctx.today.slice(0, 7))) + '</p></div><a class="card-link" href="#" data-action="nav" data-view="farm-account">Detay ' + NS.icon('chevron-right') + '</a></div>' +
          '<div class="card-body">' +
            NS.statRow('Süt hakedişi', NS.fmtMoney(ctx.account.gross, 2)) +
            NS.statRow('Yem bedeli', '− ' + NS.fmtMoney(ctx.account.feedCost, 2)) +
            NS.statRow('Siparişler', '− ' + NS.fmtMoney(ctx.account.orderTotal, 2)) +
            NS.statRow('Ödemeler', '− ' + NS.fmtMoney(ctx.account.paid, 2)) +
            '<div class="stat-row" style="border-top:1px solid var(--border-strong);padding-top:7px"><span><b>Kalan</b></span><b class="' + (ctx.account.balance >= 0 ? 'tone-pos' : 'tone-neg') + '">' + NS.fmtMoney(ctx.account.balance, 2) + '</b></div>' +
            '<div class="inline-note mt-12">' + NS.icon('info') + '<span>Kesin tutar, ay sonu tediye ve kalite sonuçlarıyla netleşir.</span></div>' +
          '</div>' +
        '</section>' +
      '</div>' +

      '<div class="grid-2-eq">' +
        '<section class="card">' +
          '<div class="card-head"><div><h3>Son teslimler</h3><p>Süt ve kalite sonuçları</p></div><a class="card-link" href="#" data-action="nav" data-view="farm-milk">Tümü ' + NS.icon('chevron-right') + '</a></div>' +
          '<div class="card-body" style="padding-top:8px"><div class="table-wrap"><table class="table" style="min-width:0"><thead><tr><th>Tarih</th><th class="num">Süt</th><th>Yem</th><th>Kalite</th><th class="num">Tutar</th></tr></thead><tbody>' + (deliveryRows || '<tr><td colspan="5">' + NS.emptyState('drop', 'Teslim yok', 'Henüz süt kaydı görünmüyor.') + '</td></tr>') + '</tbody></table></div></div>' +
        '</section>' +
        '<section class="card">' +
          '<div class="card-head"><div><h3>Kalite sonuçları</h3><p>Numune sonuçları açıklandığında görünür</p></div><a class="card-link" href="#" data-action="nav" data-view="farm-milk">Sütlerim ' + NS.icon('chevron-right') + '</a></div>' +
          '<div class="card-body"><div class="stack gap-8">' + (qualityRows || NS.emptyState('flask', 'Numune yok', 'Numune alındığında sonuçlar burada listelenir.')) + '</div>' +
            (lastOrder ? '<div class="inline-note mt-12">' + NS.icon('package') + '<span>Son sipariş: <b>' + NS.esc(lastOrder.no) + '</b> · ' + NS.esc(lastOrder.status) + ' · ' + NS.fmtMoney(lastOrder.total, 0) + '</span></div>' : '') +
          '</div>' +
        '</section>' +
      '</div>' +

      '<div class="inline-note" style="padding:0 2px">' + NS.icon('shield') + '<span>Bu ekran yalnızca size ait süt, kalite ve hesap bilgilerini gösterir. Diğer üreticilerin verileri görünmez.</span></div>' +
    '</div>';
  };

  NS.hooks.farm = function () {
    const d = NS._farm;
    if (!d) return;
    NS.areaChart(NS.$('#farmTrend'), d.days.map(function (day, i) {
      return { label: NS.fmtDateShort(day), value: d.series[i] };
    }), { unit: 'L', height: 250, aria: 'Son 30 gün süt teslimi', valueFmt: function (v) { return NS.fmtNum(v, 1) + ' litre'; } });
  };

  NS.renderFarmMilk = function () {
    const ctx = NS.farmCtx();
    if (!ctx) return NS.emptyState('home', 'Çiftlik hesabı bulunamadı', '');
    if (!NS.state.farm.range) NS.state.farm.range = '30';
    const range = NS.state.farm.range;
    const from = range === 'all' ? '0000-01-01' : range === 'month' ? ctx.monthStart : NS.isoOffset(-29);
    const recs = ctx.records.filter(function (r) { return r.date >= from; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    const liters = NS.sumLiters(recs);
    const gross = NS.sumAmount(recs);
    const quality = NS.avgQuality(recs);
    const days = [];
    if (range === '30') {
      for (let i = 29; i >= 0; i--) days.push(NS.isoOffset(-i));
    } else {
      const keys = {};
      recs.forEach(function (r) { keys[r.date.slice(0, 7)] = true; });
      Object.keys(keys).sort().forEach(function (k) {
        const n = NS.daysInMonth(k);
        for (let i = 1; i <= n; i++) days.push(k + '-' + NS.pad(i));
      });
    }
    const series = days.map(function (d) {
      const dayRecs = recs.filter(function (r) { return r.date === d; });
      return NS.sumLiters(dayRecs);
    });
    NS._farmMilk = { days: days, series: series };

    const rows = recs.slice(0, 80).map(function (r) {
      const s = r.sampleId ? NS.state.db.samples.find(function (x) { return x.id === r.sampleId; }) : null;
      return '<tr>' +
        '<td><b style="font-weight:600">' + NS.fmtDate(r.date) + '</b></td>' +
        '<td class="num"><b>' + NS.fmtNum(r.liters, 1) + '</b> L</td>' +
        '<td>' + NS.feedCellHTML(r.feeds) + '</td>' +
        '<td>' + (r.quality ? nsQualityValues(r.quality) : '<span class="faint">numune bekliyor</span>') + '</td>' +
        '<td>' + (r.quality ? NS.qualityBadge(r.quality.grade, r.quality.score) : '—') + '</td>' +
        '<td class="num">' + NS.fmtMoney(r.price, 2) + '</td>' +
        '<td class="num">' + NS.fmtMoney(r.amount, 2) + '</td>' +
        '<td>' + (s ? '<span class="code-tag">' + NS.esc(s.code) + '</span>' : '<span class="faint">—</span>') + '</td></tr>';
    }).join('');

    function nsQualityValues(q) {
      return '<span class="small">Yağ ' + NS.fmtNum(q.fat, 1) + '</span><div class="cell-sub">Protein ' + NS.fmtNum(q.protein, 1) + ' · Somatik ' + NS.fmtNum(q.somatic, 0) + ' bin</div>';
    }

    return '<div class="page stagger">' +
      '<section class="page-head"><div class="ph-left"><div class="page-kicker">' + NS.icon('drop') + ' teslim geçmişi</div><h1>Sütlerim</h1>' +
        '<p>Seçilen dönemde <b>' + recs.length + '</b> teslim, <b>' + NS.fmtNum(liters, 1) + ' litre</b>. Ortalama kalite <b>' + (quality ? NS.fmtNum(quality, 1) : '—') + '</b>, hakediş <b>' + NS.fmtMoney(gross, 0) + '</b>.</p></div>' +
        '<div class="ph-actions"><button class="btn btn-ghost" type="button" data-action="farm-milk-export">' + NS.icon('download') + ' CSV indir</button>' +
        '<button class="btn btn-ghost" type="button" data-action="farm-print-statement">' + NS.icon('printer') + ' Ekstre</button></div></section>' +

      NS.farmHero(ctx, '<button class="btn btn-ghost btn-sm" type="button" data-action="farm-qr">' + NS.icon('qr') + ' QR kodum</button>') +

      '<div class="grid-4">' +
        '<div class="mini-stat"><small>Toplam süt</small><b>' + NS.fmtNum(liters, 0) + ' <em>L</em></b><span>' + recs.length + ' teslim</span></div>' +
        '<div class="mini-stat"><small>Ortalama kalite</small><b>' + (quality ? NS.fmtNum(quality, 0) : '—') + '<em>/100</em></b><span>' + ctx.samples.filter(function (s) { return s.grade === 'A'; }).length + ' A sınıfı</span></div>' +
        '<div class="mini-stat"><small>Ortalama fiyat</small><b>' + NS.fmtMoney(liters ? gross / liters : 0, 2) + '</b><span>kalite primi dahil</span></div>' +
        '<div class="mini-stat"><small>Hakediş</small><b>' + NS.fmtMoney(gross, 0) + '</b><span>seçilen dönem</span></div>' +
      '</div>' +

      '<div class="row gap-6"><span class="filter-label">Dönem</span><div class="seg">' +
        '<button type="button" class="' + (range === '30' ? 'active' : '') + '" data-action="farm-range" data-range="30">Son 30 gün</button>' +
        '<button type="button" class="' + (range === 'month' ? 'active' : '') + '" data-action="farm-range" data-range="month">Bu ay</button>' +
        '<button type="button" class="' + (range === 'all' ? 'active' : '') + '" data-action="farm-range" data-range="all">Tümü</button>' +
      '</div></div>' +

      '<section class="card"><div class="card-head"><div><h3>Teslim edilen süt</h3><p>Günlük litre</p></div><span class="badge primary">' + NS.fmtNum(NS.sum(series), 0) + ' L</span></div><div class="card-body"><div id="farmMilkTrend"></div></div></section>' +

      '<section class="card"><div class="card-head"><div><h3>Kayıtlar ve kalite</h3><p>Laboratuvar sonuçları süt kaydıyla eşleşir</p></div><span class="badge">' + recs.length + ' kayıt</span></div>' +
        '<div class="card-body" style="padding-top:10px"><div class="table-wrap"><table class="table table-wide"><thead><tr><th>Tarih</th><th class="num">Süt</th><th>Yem</th><th>Analiz</th><th>Kalite</th><th class="num">Birim fiyat</th><th class="num">Tutar</th><th>Numune</th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="8">' + NS.emptyState('drop', 'Kayıt yok', 'Seçilen dönemde teslim kaydı bulunmuyor.') + '</td></tr>') + '</tbody></table></div></div>' +
      '</section>' +
    '</div>';
  };

  NS.hooks['farm-milk'] = function () {
    const d = NS._farmMilk;
    if (!d) return;
    NS.areaChart(NS.$('#farmMilkTrend'), d.days.map(function (day, i) {
      return { label: NS.fmtDateShort(day), value: d.series[i] };
    }), { unit: 'L', height: 240, aria: 'Süt teslim grafiği', valueFmt: function (v) { return NS.fmtNum(v, 1) + ' litre'; } });
  };

  NS.renderFarmOrders = function () {
    const ctx = NS.farmCtx();
    if (!ctx) return NS.emptyState('home', 'Çiftlik hesabı bulunamadı', '');
    const orders = ctx.orders.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    const open = orders.filter(function (o) { return o.status !== 'Teslim'; });
    const rows = orders.map(function (o) {
      const next = MP.ORDER_STATUSES[MP.ORDER_STATUSES.indexOf(o.status) + 1];
      return '<tr class="clickable" data-action="order-view" data-id="' + o.id + '">' +
        '<td><b class="code-tag" style="font-size:11px">' + NS.esc(o.no) + '</b><div class="cell-sub">' + NS.fmtDate(o.date) + '</div></td>' +
        '<td>' + (o.items || []).map(function (it) { const p = NS.productById(it.productId); return '<div class="small">' + NS.esc(p ? p.name : it.productId) + ' <span class="faint">× ' + NS.fmtNum(it.qty, 0) + '</span></div>'; }).join('') + '</td>' +
        '<td class="num"><b>' + NS.fmtMoney(o.total || NS.orderTotal(o), 0) + '</b></td>' +
        '<td>' + NS.badge(o.status) + '</td>' +
        '<td>' + (next ? '<span class="small muted">Sıradaki: ' + next + '</span>' : '<span class="small tone-pos">Teslim edildi</span>') + '</td>' +
        '<td><button class="icon-btn sm" type="button" data-action="order-view" data-id="' + o.id + '">' + NS.icon('arrow-right') + '</button></td></tr>';
    }).join('');

    return '<div class="page stagger">' +
      '<section class="page-head"><div class="ph-left"><div class="page-kicker">' + NS.icon('package') + ' yem & malzeme</div><h1>Siparişlerim</h1>' +
        '<p><b>' + open.length + '</b> açık talebiniz var. Sipariş durumu mandıra tarafından güncellenir; teslim edildiğinde stok ve hesabınıza işlenir.</p></div>' +
        '<div class="ph-actions"><button class="btn btn-primary" type="button" data-action="new-order">' + NS.icon('plus') + ' Yeni sipariş talebi</button></div></section>' +

      NS.farmHero(ctx, '<button class="btn btn-ghost btn-sm" type="button" data-action="farm-qr">' + NS.icon('qr') + ' QR kodum</button>') +

      '<div class="grid-4">' +
        '<div class="mini-stat"><small>Açık talep</small><b>' + open.length + '</b><span>' + orders.filter(function (o) { return o.status === 'Talep'; }).length + ' onay bekliyor</span></div>' +
        '<div class="mini-stat"><small>Bu ay sipariş</small><b>' + NS.fmtMoney(NS.sum(orders.filter(function (o) { return o.date >= ctx.monthStart; }).map(function (o) { return o.total; })), 0) + '</b><span>' + orders.filter(function (o) { return o.date >= ctx.monthStart; }).length + ' sipariş</span></div>' +
        '<div class="mini-stat"><small>Teslim edilen</small><b>' + orders.filter(function (o) { return o.status === 'Teslim'; }).length + '</b><span>tamamlanan sipariş</span></div>' +
        '<div class="mini-stat"><small>Cari bakiye</small><b>' + NS.fmtMoney(ctx.all.balance, 0) + '</b><span>siparişler hesaba işlenir</span></div>' +
      '</div>' +

      '<section class="card"><div class="card-head card-head-rule"><div><h3>Sipariş geçmişi</h3><p>Talep, onay, hazırlık ve teslim</p></div></div>' +
        '<div class="card-body" style="padding-top:12px"><div class="table-wrap"><table class="table table-wide"><thead><tr><th>Sipariş</th><th>İçerik</th><th class="num">Tutar</th><th>Durum</th><th>Süreç</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="6">' + NS.emptyState('package', 'Sipariş yok', 'İlk sipariş talebinizi oluşturun.') + '</td></tr>') + '</tbody></table></div></div>' +
      '</section>' +

      '<div class="grid-2-eq">' +
        '<section class="card"><div class="card-head"><div><h3>Nasıl işler?</h3><p>Sipariş süreci</p></div></div><div class="card-body"><div class="order-steps">' +
          MP.ORDER_STATUSES.map(function (s, i) { return '<div class="order-step ' + (i === 0 ? 'current' : '') + '"><span></span><b>' + s + '</b></div>'; }).join('') +
        '</div><p class="small muted mt-12" style="line-height:1.6">Talebiniz mandıraya düşer. Onaylandığında hazırlanır ve teslimde hesabınıza borç olarak işlenir. Durumu bu ekrandan takip edebilirsiniz.</p></div></section>' +
        '<section class="card"><div class="card-head"><div><h3>Hesap özeti</h3><p>Bu ay</p></div><a class="card-link" href="#" data-action="nav" data-view="farm-account">Detay ' + NS.icon('chevron-right') + '</a></div><div class="card-body">' +
          NS.statRow('Süt hakedişi', NS.fmtMoney(ctx.account.gross, 2)) +
          NS.statRow('Yem bedeli', '− ' + NS.fmtMoney(ctx.account.feedCost, 2)) +
          NS.statRow('Siparişler', '− ' + NS.fmtMoney(ctx.account.orderTotal, 2)) +
          '<div class="stat-row" style="border-top:1px solid var(--border-strong);padding-top:7px"><span><b>Bakiye</b></span><b>' + NS.fmtMoney(ctx.account.balance, 2) + '</b></div>' +
        '</div></section>' +
      '</div>' +
    '</div>';
  };

  NS.renderFarmAccount = function () {
    const ctx = NS.farmCtx();
    if (!ctx) return NS.emptyState('home', 'Çiftlik hesabı bulunamadı', '');
    const p = ctx.producer;
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      months.push(d.getFullYear() + '-' + NS.pad(d.getMonth() + 1));
    }
    const monthData = months.map(function (ym) {
      const recs = ctx.records.filter(function (r) { return r.date.slice(0, 7) === ym; });
      return { ym: ym, liters: NS.sumLiters(recs), gross: NS.sumAmount(recs), feed: NS.sumFeedCost(recs) };
    });
    NS._farmAccount = monthData;

    const payments = ctx.payments.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    const orders = ctx.orders.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 5);

    return '<div class="page stagger">' +
      '<section class="page-head"><div class="ph-left"><div class="page-kicker">' + NS.icon('book') + ' cari hesap</div><h1>Hesabım</h1>' +
        '<p>Mandıra ile güncel bakiyeniz <b class="' + (ctx.all.balance >= 0 ? 'tone-pos' : 'tone-neg') + '">' + NS.fmtMoney(ctx.all.balance, 2) + '</b>. Bu ay hakediş <b>' + NS.fmtMoney(ctx.account.gross, 0) + '</b>.</p></div>' +
        '<div class="ph-actions"><button class="btn btn-ghost" type="button" data-action="farm-print-statement">' + NS.icon('printer') + ' Ekstre yazdır</button>' +
        '<button class="btn btn-primary" type="button" data-action="new-order">' + NS.icon('package') + ' Sipariş talebi</button></div></section>' +

      NS.farmHero(ctx, '<button class="btn btn-ghost btn-sm" type="button" data-action="farm-qr">' + NS.icon('qr') + ' QR kodum</button>') +

      '<div class="grid-4">' +
        '<div class="mini-stat"><small>Bu ay hakediş</small><b>' + NS.fmtMoney(ctx.account.gross, 0) + '</b><span>' + NS.fmtNum(ctx.account.liters, 0) + ' litre</span></div>' +
        '<div class="mini-stat"><small>Yem + sipariş</small><b>' + NS.fmtMoney(ctx.account.feedCost + ctx.account.orderTotal, 0) + '</b><span>bu ay mahsup</span></div>' +
        '<div class="mini-stat"><small>Yapılan ödeme</small><b>' + NS.fmtMoney(ctx.account.paid, 0) + '</b><span>bu ay</span></div>' +
        '<div class="mini-stat"><small>Güncel bakiye</small><b class="' + (ctx.all.balance >= 0 ? 'tone-pos' : 'tone-neg') + '">' + NS.fmtMoney(ctx.all.balance, 2) + '</b><span>tüm zamanlar</span></div>' +
      '</div>' +

      '<div class="grid-main">' +
        '<section class="card"><div class="card-head"><div><h3>Aylık hakediş</h3><p>Son 6 ay · süt ve yem</p></div><span class="badge primary">' + NS.fmtMoney(NS.sum(monthData.map(function (m) { return m.gross; })), 0) + '</span></div>' +
          '<div class="card-body"><div id="farmAccountChart"></div></div></section>' +

        '<section class="card"><div class="card-head"><div><h3>Hesap dökümü</h3><p>' + NS.capitalize(NS.monthLabel(ctx.today.slice(0, 7))) + '</p></div></div><div class="card-body">' +
          NS.statRow('Süt hakedişi', NS.fmtMoney(ctx.account.gross, 2)) +
          NS.statRow('Yem bedeli', '− ' + NS.fmtMoney(ctx.account.feedCost, 2)) +
          NS.statRow('Ürün siparişleri', '− ' + NS.fmtMoney(ctx.account.orderTotal, 2)) +
          NS.statRow('Ödemeler / avans', '− ' + NS.fmtMoney(ctx.account.paid, 2)) +
          '<div class="stat-row" style="border-top:1px solid var(--border-strong);padding-top:8px"><span><b>Kalan</b></span><b class="' + (ctx.account.balance >= 0 ? 'tone-pos' : 'tone-neg') + '" style="font-size:15px">' + NS.fmtMoney(ctx.account.balance, 2) + '</b></div>' +
          '<div class="inline-note mt-12">' + NS.icon('info') + '<span>Kesin bakiye ay sonu tediye ile netleşir.</span></div>' +
        '</div></section>' +
      '</div>' +

      '<div class="grid-2-eq">' +
        '<section class="card"><div class="card-head"><div><h3>Ödeme hareketleri</h3><p>Avans ve tediye ödemeleri</p></div><span class="badge">' + payments.length + '</span></div><div class="card-body"><div class="stack gap-8">' +
          (payments.length ? payments.map(function (x) {
            return '<div class="payment-row"><span class="payment-ico">' + NS.icon('wallet') + '</span><div><b>' + NY(x.type || 'Ödeme') + '</b><small>' + NS.fmtDate(x.date) + ' · ' + NS.esc(x.method || '') + '</small></div><b class="tone-pos">' + NS.fmtMoney(x.amount, 2) + '</b></div>';
          }).join('') : '<p class="small faint">Henüz ödeme kaydı yok.</p>') +
        '</div></div></section>' +
        '<section class="card"><div class="card-head"><div><h3>Son siparişler</h3><p>Yem ve malzeme</p></div><a class="card-link" href="#" data-action="nav" data-view="farm-orders">Tümü ' + NS.icon('chevron-right') + '</a></div><div class="card-body"><div class="stack gap-8">' +
          (orders.length ? orders.map(function (o) {
            return '<div class="row between" style="font-size:11.5px;padding:5px 0;border-bottom:1px dashed var(--border)"><span>' + NS.esc(o.no) + ' · ' + NS.fmtDate(o.date) + '</span><span class="row gap-8">' + NS.badge(o.status) + '<b>' + NS.fmtMoney(o.total, 0) + '</b></span></div>';
          }).join('') : '<p class="small faint">Sipariş yok.</p>') +
        '</div></div></section>' +
      '</div>' +
    '</div>';
  };

  function NY(s) { return NS.esc(s); }

  NS.hooks['farm-account'] = function () {
    const d = NS._farmAccount;
    if (!d) return;
    NS.barChart(NS.$('#farmAccountChart'), d.map(function (m) {
      return { label: NS.monthLabel(m.ym).split(' ')[0].slice(0, 3), value: m.gross, full: NS.monthLabel(m.ym) };
    }), { unit: '₺', height: 230, color: 'var(--primary)', aria: 'Aylık hakediş grafiği' });
  };

  NS.exportFarmMilk = function () {
    const ctx = NS.farmCtx();
    if (!ctx) return;
    const recs = ctx.records.slice().sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    const rows = [['Tarih', 'Süt (L)', 'Yağ', 'Protein', 'Somatik', 'Bakteri', 'Kalite', 'Puan', 'Birim fiyat', 'Tutar', 'Süt Yemi (kg)', 'Besi Yemi (kg)', 'Buzağı Yemi (kg)', 'Sarı Küspe (kg)', 'Toplam Yem (kg)', 'Yem Bedeli']];
    recs.forEach(function (r) {
      rows.push([r.date, r.liters, r.quality ? r.quality.fat : '', r.quality ? r.quality.protein : '', r.quality ? r.quality.somatic : '', r.quality ? r.quality.bacteria : '', r.quality ? r.quality.grade : '', r.quality ? r.quality.score : '', r.price, r.amount,
        r.feeds && r.feeds.sutYemi || 0, r.feeds && r.feeds.besiYemi || 0, r.feeds && r.feeds.buzagiYemi || 0, r.feeds && r.feeds.sariKusbe || 0,
        NS.feedKgOf(r.feeds), NS.feedCostOf(r.feeds)]);
    });
    NS.exportCSV('ciftlik-sut-' + NS.todayISO() + '.csv', rows[0], rows.slice(1));
  };

})(window.MPApp);
