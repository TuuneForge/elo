/* ============================================================
   MandıraPro 2.0 — Cari Hesap
   ============================================================ */
(function (NS) {
  'use strict';

  NS.hooks = NS.hooks || {};

  NS.accountRows = function () {
    const f = NS.state.accounts;
    const today = NS.todayISO();
    const start = NS.monthStart(today.slice(0, 7));
    let rows = NS.visibleProducers().map(function (p) {
      const month = NS.producerAccount(p.id, start, today);
      const all = NS.producerAccount(p.id);
      const c = NS.collectorById(p.collectorId);
      return { producer: p, collector: c, month: month, all: all };
    });
    if (f.q) {
      const q = f.q.toLocaleLowerCase('tr-TR');
      rows = rows.filter(function (r) {
        return [r.producer.name, r.producer.code, r.producer.village, r.collector ? r.collector.name : ''].join(' ').toLocaleLowerCase('tr-TR').indexOf(q) !== -1;
      });
    }
    if (f.status === 'payable') rows = rows.filter(function (r) { return r.all.balance > 0.5; });
    if (f.status === 'receivable') rows = rows.filter(function (r) { return r.all.balance < -0.5; });
    rows.sort(function (a, b) { return b.all.balance - a.all.balance; });
    return rows;
  };

  NS.renderAccounts = function () {
    const db = NS.state.db;
    const f = NS.state.accounts;
    const today = NS.todayISO();
    const start = NS.monthStart(today.slice(0, 7));
    const rows = NS.accountRows();
    const payable = rows.filter(function (r) { return r.all.balance > 0; });
    const receivable = rows.filter(function (r) { return r.all.balance < 0; });
    const totalPayable = NS.sum(payable.map(function (r) { return r.all.balance; }));
    const monthGross = NS.sum(rows.map(function (r) { return r.month.gross; }));
    const monthPaid = NS.sum(rows.map(function (r) { return r.month.paid; }));
    const monthFeed = NS.sum(rows.map(function (r) { return r.month.feedCost; }));

    const tableRows = rows.map(function (r) {
      const p = r.producer;
      const acc = r.month;
      const all = r.all;
      return '<tr class="clickable" data-action="statement-producer" data-id="' + p.id + '">' +
        '<td><div class="prod-cell">' + NS.avatarHTML(p.name) + '<div><b>' + NS.esc(p.name) + '</b><small>' + NS.esc(p.code) + ' · ' + NS.esc(r.collector ? r.collector.route : '') + '</small></div></div></td>' +
        '<td class="num"><b>' + NS.fmtNum(acc.liters, 0) + '</b> <span class="faint">L</span></td>' +
        '<td class="num">' + NS.fmtMoney(acc.gross, 0) + '</td>' +
        '<td class="num">− ' + NS.fmtMoney(acc.feedCost, 0) + '</td>' +
        '<td class="num">− ' + NS.fmtMoney(acc.orderTotal, 0) + '</td>' +
        '<td class="num">− ' + NS.fmtMoney(acc.paid, 0) + '</td>' +
        '<td class="num"><b class="' + (all.balance > 0 ? 'tone-pos' : all.balance < 0 ? 'tone-neg' : '') + '">' + NS.fmtMoney(all.balance, 2) + '</b></td>' +
        '<td>' + (all.balance > 0.5 ? '<span class="badge warn">ödenecek</span>' : all.balance < -0.5 ? '<span class="badge info">borçlu</span>' : '<span class="badge success">kapalı</span>') + '</td>' +
        '<td><div class="row-actions">' +
          '<button class="icon-btn sm" type="button" data-action="statement-producer" data-id="' + p.id + '" title="Ekstre">' + NS.icon('printer') + '</button>' +
          '<button class="icon-btn sm" type="button" data-action="payment-producer" data-id="' + p.id + '" title="Ödeme gir">' + NS.icon('wallet') + '</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    const recentPayments = db.payments.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); }).slice(0, 8);

    return '<div class="page stagger">' +

      '<section class="page-head">' +
        '<div class="ph-left">' +
          '<div class="page-kicker">' + NS.icon('book') + ' cari defter</div>' +
          '<h1>Cari hesaplar</h1>' +
          '<p>Bu ay üreticilere <b>' + NS.fmtMoney(monthGross, 0) + '</b> süt hakedişi doğdu; <b>' + NS.fmtMoney(monthPaid, 0) + '</b> ödeme yapıldı. Toplam ödenecek bakiye <b>' + NS.fmtMoney(totalPayable, 0) + '</b>.</p>' +
        '</div>' +
        '<div class="ph-actions">' +
          '<button class="btn btn-ghost" type="button" data-action="accounts-export">' + NS.icon('download') + ' Dışa aktar</button>' +
          '<button class="btn btn-primary" type="button" data-action="payment-producer">' + NS.icon('wallet') + ' Ödeme gir</button>' +
        '</div>' +
      '</section>' +

      '<div class="grid-4">' +
        '<div class="mini-stat"><small>Ödenecek bakiye</small><b class="tone-pos">' + NS.fmtMoney(totalPayable, 0) + '</b><span>' + payable.length + ' üretici alacaklı</span></div>' +
        '<div class="mini-stat"><small>Bu ay hakediş</small><b>' + NS.fmtMoney(monthGross, 0) + '</b><span>' + NS.fmtNum(NS.sum(rows.map(function (r) { return r.month.liters; })), 0) + ' litre</span></div>' +
        '<div class="mini-stat"><small>Yem mahsubu</small><b>' + NS.fmtMoney(monthFeed, 0) + '</b><span>bu ay verilen yem</span></div>' +
        '<div class="mini-stat"><small>Borçlu üretici</small><b class="' + (receivable.length ? 'tone-neg' : '') + '">' + receivable.length + '</b><span>sipariş/avans fazlası</span></div>' +
      '</div>' +

      '<section class="card">' +
        '<div class="card-head card-head-rule row between">' +
          '<div><h3>Üretici bakiyeleri</h3><p>Bu ay hareketleri ve güncel bakiye</p></div>' +
          '<div class="row gap-6">' +
            '<div class="seg">' +
              '<button type="button" class="' + (f.status === 'all' ? 'active' : '') + '" data-action="acc-status" data-status="all">Tümü</button>' +
              '<button type="button" class="' + (f.status === 'payable' ? 'active' : '') + '" data-action="acc-status" data-status="payable">Ödenecek</button>' +
              '<button type="button" class="' + (f.status === 'receivable' ? 'active' : '') + '" data-action="acc-status" data-status="receivable">Borçlu</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="card-body" style="padding-top:12px">' +
          '<div class="toolbar mb-10"><div class="toolbar-search">' + NS.icon('search') + '<input class="input" type="text" placeholder="Üretici, kod veya sütçü ara…" value="' + NS.esc(f.q) + '" data-filter="acc-q"></div>' +
            '<span class="small faint">' + rows.length + ' hesap</span></div>' +
          '<div class="table-wrap"><table class="table table-wide"><thead><tr><th>Üretici</th><th class="num">Bu ay süt</th><th class="num">Hakediş</th><th class="num">Yem</th><th class="num">Sipariş</th><th class="num">Ödenen</th><th class="num">Bakiye</th><th>Durum</th><th></th></tr></thead>' +
            '<tbody>' + (tableRows || '<tr><td colspan="9">' + NS.emptyState('book', 'Hesap bulunamadı', 'Arama veya filtreleri değiştirin.') + '</td></tr>') + '</tbody></table></div>' +
          '<div class="inline-note mt-12">' + NS.icon('info') + '<span>Bakiye = süt hakedişi − yem bedeli − ürün siparişleri − yapılan ödemeler. Satıra tıklayınca dönem ekstresi açılır.</span></div>' +
        '</div>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-head"><div><h3>Son ödemeler</h3><p>Avans ve tediye hareketleri</p></div><span class="badge">' + db.payments.length + ' kayıt</span></div>' +
        '<div class="card-body"><div class="stack gap-8">' +
          (recentPayments.map(function (p) {
            const pr = NS.producerById(p.producerId);
            return '<div class="payment-row">' +
              '<span class="payment-ico">' + NS.icon('wallet') + '</span>' +
              '<div><b>' + NS.esc(pr ? pr.name : '—') + '</b><small>' + NS.fmtDate(p.date) + ' · ' + NS.esc(p.type || 'Ödeme') + ' · ' + NS.esc(p.method || '') + '</small></div>' +
              '<b class="tone-pos">' + NS.fmtMoney(p.amount, 0) + '</b>' +
            '</div>';
          }).join('') || '<p class="small faint">Henüz ödeme kaydı yok.</p>') +
        '</div></div>' +
      '</section>' +

    '</div>';
  };

  NS.printProducerStatement = function (id) {
    const p = NS.producerById(id);
    if (!p) return;
    const today = NS.todayISO();
    const start = NS.monthStart(today.slice(0, 7));
    const records = NS.recordsForProducer(id, start, today).sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    const payments = NS.state.db.payments.filter(function (x) { return x.producerId === id && x.date >= start && x.date <= today; });
    const orders = NS.state.db.orders.filter(function (o) { return o.producerId === id && o.date >= start && o.date <= today && o.status === 'Teslim'; });
    const acc = NS.producerAccount(id, start, today);
    const c = NS.collectorById(p.collectorId);

    const lines = [];
    records.forEach(function (r) {
      lines.push({
        date: r.date,
        desc: 'Süt alımı · ' + NS.fmtNum(r.liters, 1) + ' L · ' + (r.quality ? r.quality.grade + ' kalite' : 'numune yok'),
        debit: NS.amountOfRecord(r),
        credit: NS.feedCostOf(r.feeds),
        feed: NS.feedKgOf(r.feeds)
      });
    });
    orders.forEach(function (o) {
      lines.push({ date: o.date, desc: 'Ürün siparişi · ' + o.no, debit: 0, credit: o.total, feed: 0 });
    });
    payments.forEach(function (x) {
      lines.push({ date: x.date, desc: (x.type || 'Ödeme') + ' · ' + (x.method || ''), debit: 0, credit: x.amount, feed: 0 });
    });
    lines.sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });

    let running = 0;
    const rows = lines.map(function (l) {
      running += l.debit - l.credit;
      return '<tr><td>' + NS.fmtDate(l.date) + '</td><td>' + NS.esc(l.desc) + '</td>' +
        '<td class="num">' + (l.debit ? NS.fmtMoney(l.debit, 2) : '') + '</td>' +
        '<td class="num">' + (l.credit ? NS.fmtMoney(l.credit, 2) : '') + '</td>' +
        '<td class="num">' + NS.fmtMoney(running, 2) + '</td></tr>';
    }).join('');

    const html =
      '<div class="doc-head"><div class="doc-brand"><div class="doc-mark">MP</div><div><b>' + NS.esc(NS.state.db.settings.businessName) + '</b><small>Üretici cari ekstresi</small></div></div>' +
      '<div class="doc-title"><h1>CARİ EKSTRE</h1><p>' + NS.monthLabel(today.slice(0, 7)) + '</p><div class="doc-no">' + NS.esc(p.code) + '</div></div></div>' +
      '<div class="doc-meta"><div class="doc-party"><small>Üretici</small><b>' + NS.esc(p.name) + '</b><p>' + NS.esc(p.village) + ' · ' + NS.esc(p.phone) + '<br>' + NS.esc(c ? c.route : '') + ' · ' + NS.esc(c ? c.name : '') + '</p></div>' +
      '<div class="doc-side"><div><small>Dönem</small><b>' + NS.fmtDate(start) + ' – ' + NS.fmtDate(today) + '</b></div><div><small>Süt</small><b>' + NS.fmtNum(acc.liters, 1) + ' L</b></div><div><small>Hakediş</small><b>' + NS.fmtMoney(acc.gross, 2) + '</b></div><div><small>Bakiye</small><b>' + NS.fmtMoney(acc.balance, 2) + '</b></div></div></div>' +
      '<table class="doc-table"><thead><tr><th>Tarih</th><th>Açıklama</th><th class="num">Alacak</th><th class="num">Borç</th><th class="num">Bakiye</th></tr></thead><tbody>' + (rows || '<tr><td colspan="5">Bu dönemde hareket yok.</td></tr>') + '</tbody>' +
      '<tfoot><tr><td colspan="2">DÖNEM SONU BAKİYE</td><td class="num">' + NS.fmtMoney(acc.gross, 2) + '</td><td class="num">' + NS.fmtMoney(acc.gross - acc.balance, 2) + '</td><td class="num">' + NS.fmtMoney(acc.balance, 2) + '</td></tr></tfoot></table>' +
      '<div class="doc-note">Alacak: süt hakedişi. Borç: yem, ürün siparişi ve ödemeler. Bakiye pozitifse mandıra üreticiye ödeme yapmalıdır.</div>' +
      '<div class="doc-qr">' + NS.qrSVG('MP|EKSTRE|' + p.code + '|' + today, 3) + '<small>Üretici cari ekstresi<br>' + NS.esc(p.code) + '<br>' + NS.esc(NS.state.db.settings.businessName) + '</small></div>' +
      '<div class="doc-sign"><div>Üretici</div><div>Mandıra muhasebe</div></div>' +
      '<div class="doc-footer"><span>' + NS.esc(NS.state.db.settings.address) + '</span><span>' + NS.esc(NS.state.db.settings.phone) + '</span></div>';
    NS.printDoc({ title: 'Cari ekstre', subtitle: p.name + ' · ' + NS.monthLabel(today.slice(0, 7)), html: html });
  };

  NS.exportAccounts = function () {
    const rows = [['Üretici', 'Kod', 'Sütçü', 'Bu ay süt (L)', 'Hakediş', 'Yem', 'Sipariş', 'Ödenen', 'Bakiye']];
    NS.accountRows().forEach(function (r) {
      rows.push([r.producer.name, r.producer.code, r.collector ? r.collector.name : '', r.month.liters, r.month.gross, r.month.feedCost, r.month.orderTotal, r.month.paid, r.all.balance]);
    });
    NS.exportXLSX('mandirapro-cari-' + NS.todayISO() + '.xlsx', [{ name: 'Cari', rows: rows, widths: [24, 10, 18, 14, 14, 14, 14, 14, 14] }]);
  };

})(window.MPApp);
