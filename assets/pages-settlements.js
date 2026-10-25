/* ============================================================
   MandıraPro 2.0 — Tediye
   ============================================================ */
(function (NS) {
  'use strict';

  NS.hooks = NS.hooks || {};

  NS.settlementPeriod = function () {
    const s = NS.state.settlement;
    if (!s.ym) s.ym = NS.todayISO().slice(0, 7);
    if (!s.half) s.half = 'full';
    return NS.periodRange(s.ym, s.half);
  };

  NS.settlementRows = function () {
    const s = NS.state.settlement;
    const range = NS.settlementPeriod();
    return NS.settlementBatch(range.start, range.end, s.collector || '');
  };

  NS.renderSettlements = function () {
    const db = NS.state.db;
    const s = NS.state.settlement;
    const range = NS.settlementPeriod();
    const rows = NS.settlementRows();
    const liters = NS.round(NS.sum(rows.map(function (r) { return r.liters; })), 1);
    const gross = NS.sum(rows.map(function (r) { return r.gross; }));
    const feed = NS.sum(rows.map(function (r) { return r.feedCost; }));
    const advances = NS.sum(rows.map(function (r) { return r.advances; }));
    const net = NS.sum(rows.map(function (r) { return r.net; }));
    const premium = NS.sum(rows.map(function (r) { return r.premium; }));
    const pl = db.priceLists[0];
    const collectors = NS.visibleCollectors();

    const months = [];
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const ym = d.getFullYear() + '-' + NS.pad(d.getMonth() + 1);
      months.push(ym);
    }
    if (months.indexOf(s.ym) === -1) months.unshift(s.ym);

    const rowsHTML = rows.map(function (r) {
      const p = r.producer;
      const c = NS.collectorById(p.collectorId);
      const existing = r.existing;
      const status = existing ? existing.status : 'Hazır';
      const counts = r.grades;
      return '<tr>' +
        '<td><input type="checkbox" class="settle-check" data-id="' + p.id + '" aria-label="' + NS.esc(p.name) + '"></td>' +
        '<td><div class="prod-cell">' + NS.avatarHTML(p.name) + '<div><b>' + NS.esc(p.name) + '</b><small>' + NS.esc(p.code) + ' · ' + NS.esc(c ? c.route : '') + '</small></div></div></td>' +
        '<td class="num"><b>' + NS.fmtNum(r.liters, 0) + '</b> <span class="faint">L</span><div class="cell-sub">' + r.count + ' kayıt</div></td>' +
        '<td class="num">' + NS.fmtMoney(r.avgPrice, 2) + '<div class="cell-sub">' + (r.avgQuality ? 'puan ' + NS.fmtNum(r.avgQuality, 0) : '—') + '</div></td>' +
        '<td><span class="q-mini a">A ' + counts.A + '</span> <span class="q-mini b">B ' + counts.B + '</span> <span class="q-mini c">C ' + counts.C + '</span></td>' +
        '<td class="num">' + NS.fmtMoney(r.gross, 2) + '</td>' +
        '<td class="num ' + (r.premium >= 0 ? 'tone-pos' : 'tone-neg') + '">' + (r.premium >= 0 ? '+' : '') + NS.fmtMoney(r.premium, 2) + '</td>' +
        '<td class="num">− ' + NS.fmtMoney(r.feedCost, 0) + '</td>' +
        '<td class="num">− ' + NS.fmtMoney(r.advances, 0) + '</td>' +
        '<td class="num"><b>' + NS.fmtMoney(r.net, 2) + '</b></td>' +
        '<td>' + NS.badge(status) + (existing && existing.receiptNo ? '<div class="cell-sub">' + NS.esc(existing.receiptNo) + '</div>' : '') + '</td>' +
        '<td><div class="row-actions">' +
          '<button class="icon-btn sm" type="button" data-action="settle-detail" data-producer="' + p.id + '" title="Döküm">' + NS.icon('info') + '</button>' +
          '<button class="icon-btn sm" type="button" data-action="settle-receipt" data-producer="' + p.id + '" title="Makbuz yazdır">' + NS.icon('printer') + '</button>' +
          (status === 'Hazır' ? '<button class="btn btn-soft btn-sm" type="button" data-action="settle-approve" data-producer="' + p.id + '">Onayla</button>' : '') +
          (status === 'Onaylandı' ? '<button class="btn btn-soft btn-sm" type="button" data-action="settle-pay" data-producer="' + p.id + '">Öde</button>' : '') +
        '</div></td>' +
      '</tr>';
    }).join('');

    return '<div class="page stagger">' +

      '<section class="page-head">' +
        '<div class="ph-left">' +
          '<div class="page-kicker">' + NS.icon('receipt') + ' üretici tediye dönemi</div>' +
          '<h1>Tediye</h1>' +
          '<p><b>' + NS.esc(range.label) + '</b> · ' + rows.length + ' üretici. Kalite primi, yem mahsubu ve avanslar otomatik hesaplanır. Net ödenecek <b>' + NS.fmtMoney(net, 0) + '</b>.</p>' +
        '</div>' +
        '<div class="ph-actions">' +
          '<button class="btn btn-ghost" type="button" data-action="settle-export">' + NS.icon('download') + ' Dışa aktar</button>' +
          '<button class="btn btn-ghost" type="button" data-action="settle-print-bulk">' + NS.icon('printer') + ' Toplu makbuz</button>' +
          '<button class="btn btn-primary" type="button" data-action="settle-save">' + NS.icon('wallet') + ' Dönemi kaydet</button>' +
        '</div>' +
      '</section>' +

      '<section class="ops-strip">' +
        '<div class="ops-cell"><small>Dönem</small><b>' + NS.esc(range.label) + '</b><span class="tiny faint">' + NS.fmtDate(range.start) + ' – ' + NS.fmtDate(range.end) + '</span></div>' +
        '<div class="ops-cell"><small>Fiyat listesi</small><b>' + NS.esc(pl ? pl.name : '—') + '</b><span class="tiny faint">baz ' + NS.fmtMoney(pl ? pl.basePrice : 0, 2) + ' · A +' + NS.fmtNum(pl ? pl.gradeDelta.A : 0, 2) + ' · C ' + NS.fmtNum(pl ? pl.gradeDelta.C : 0, 2) + '</span></div>' +
        '<div class="ops-cell"><small>Toplam süt</small><b>' + NS.fmtNum(liters, 1) + ' L</b><span class="tiny faint">ortalama ' + NS.fmtMoney(liters ? gross / liters : 0, 2) + '/L</span></div>' +
        '<div class="ops-cell"><small>Kalite primi</small><b>' + (premium >= 0 ? '+' : '') + NS.fmtMoney(premium, 0) + '</b><span class="tiny faint">' + (premium >= 0 ? 'kalite katkısı' : 'kalite kesintisi') + '</span></div>' +
      '</section>' +

      '<div class="grid-4">' +
        '<div class="mini-stat"><small>Brüt hakediş</small><b>' + NS.fmtMoney(gross, 0) + '</b><span>süt + kalite primi</span></div>' +
        '<div class="mini-stat"><small>Yem mahsubu</small><b>' + NS.fmtMoney(feed, 0) + '</b><span>kayıtlardaki yem bedeli</span></div>' +
        '<div class="mini-stat"><small>Avans / ödeme</small><b>' + NS.fmtMoney(advances, 0) + '</b><span>dönem içi düşülen</span></div>' +
        '<div class="mini-stat"><small>Net ödenecek</small><b>' + NS.fmtMoney(net, 0) + '</b><span>' + rows.length + ' üretici</span></div>' +
      '</div>' +

      '<section class="card">' +
        '<div class="card-head card-head-rule row between">' +
          '<div><h3>Üretici tediye tablosu</h3><p>Kaliteye göre otomatik hesaplandı</p></div>' +
          '<div class="row gap-6">' +
            '<select class="select" style="height:34px;font-size:11.5px;width:auto" data-filter="settle-month">' + months.map(function (m) {
              return '<option value="' + m + '"' + (s.ym === m ? ' selected' : '') + '>' + NS.esc(NS.capitalize(NS.monthLabel(m))) + '</option>';
            }).join('') + '</select>' +
            '<div class="seg">' +
              '<button type="button" class="' + (s.half === 'full' ? 'active' : '') + '" data-action="settle-half" data-half="full">Tüm ay</button>' +
              '<button type="button" class="' + (s.half === '1' ? 'active' : '') + '" data-action="settle-half" data-half="1">1. yarı</button>' +
              '<button type="button" class="' + (s.half === '2' ? 'active' : '') + '" data-action="settle-half" data-half="2">2. yarı</button>' +
            '</div>' +
            (NS.isAdmin() ? '<select class="select" style="height:34px;font-size:11.5px;width:auto" data-filter="settle-collector"><option value="">Tüm sütçüler</option>' + collectors.map(function (c) {
              return '<option value="' + c.id + '"' + (s.collector === c.id ? ' selected' : '') + '>' + NS.esc(c.route) + '</option>';
            }).join('') + '</select>' : '') +
          '</div>' +
        '</div>' +
        '<div class="card-body" style="padding-top:12px">' +
          '<div class="row between mb-10">' +
            '<label class="checkbox"><input type="checkbox" data-action="settle-all"> Tümünü seç</label>' +
            '<span class="small faint">Seçili üreticiler toplu makbuza eklenir; seçim yoksa tümü yazdırılır.</span>' +
          '</div>' +
          '<div class="table-wrap"><table class="table table-wide"><thead><tr>' +
            '<th style="width:30px"><span class="sr-only">Seç</span></th><th>Üretici</th><th class="num">Süt</th><th class="num">Ort. fiyat</th><th>Kalite</th><th class="num">Brüt</th><th class="num">Prim</th><th class="num">Yem</th><th class="num">Avans</th><th class="num">Net</th><th>Durum</th><th></th>' +
          '</tr></thead><tbody>' + (rowsHTML || '<tr><td colspan="12">' + NS.emptyState('receipt', 'Bu dönemde kayıt yok', 'Farklı bir dönem veya sütçü seçin.') + '</td></tr>') + '</tbody>' +
          (rows.length ? '<tfoot><tr><td></td><td>TOPLAM</td><td class="num">' + NS.fmtNum(liters, 0) + ' L</td><td></td><td></td><td class="num">' + NS.fmtMoney(gross, 0) + '</td><td class="num">' + NS.fmtMoney(premium, 0) + '</td><td class="num">− ' + NS.fmtMoney(feed, 0) + '</td><td class="num">− ' + NS.fmtMoney(advances, 0) + '</td><td class="num">' + NS.fmtMoney(net, 0) + '</td><td></td><td></td></tr></tfoot>' : '') +
          '</table></div>' +
          '<div class="inline-note mt-12">' + NS.icon('info') + '<span>Kaydettiğinizde dönem tediye defterine işlenir. Bir üreticiyi ödediğinizde net tutar cari hesaba ödeme olarak yansır.</span></div>' +
        '</div>' +
      '</section>' +

    '</div>';
  };

  NS.settlementFor = function (producerId) {
    const range = NS.settlementPeriod();
    return NS.settlementCalc(producerId, range.start, range.end);
  };

  NS.printSettlementReceipt = function (producerId) {
    const r = NS.settlementFor(producerId);
    if (!r || !r.producer) return;
    const p = r.producer;
    const c = NS.collectorById(p.collectorId);
    const receiptNo = r.existing ? r.existing.receiptNo : NS.nextReceiptNo(r.periodStart.slice(0, 7));
    const html =
      '<div class="doc-head">' +
        '<div class="doc-brand"><div class="doc-mark">MP</div><div><b>' + NS.esc(NS.state.db.settings.businessName) + '</b><small>Müstahsil tediye fişi</small></div></div>' +
        '<div class="doc-title"><h1>TEDİYE FİŞİ</h1><p>' + NS.esc(r.periodStart) + ' – ' + NS.esc(r.periodEnd) + '</p><div class="doc-no">' + NS.esc(receiptNo) + '</div></div>' +
      '</div>' +
      '<div class="doc-meta">' +
        '<div class="doc-party"><small>Üretici</small><b>' + NS.esc(p.name) + '</b><p>' + NS.esc(p.code) + ' · ' + NS.esc(p.village) + '<br>' + NS.esc(p.address) + '<br>Vergi no: ' + NS.esc(p.taxNo) + '<br>IBAN: ' + NS.esc(p.iban) + '</p></div>' +
        '<div class="doc-side">' +
          '<div><small>Rota</small><b>' + NS.esc(c ? c.route : '—') + '</b></div>' +
          '<div><small>Sütçü</small><b>' + NS.esc(c ? c.name : '—') + '</b></div>' +
          '<div><small>Kayıt sayısı</small><b>' + r.count + '</b></div>' +
          '<div><small>Ortalama puan</small><b>' + (r.avgQuality ? NS.fmtNum(r.avgQuality, 1) : '—') + '</b></div>' +
        '</div>' +
      '</div>' +
      '<table class="doc-table"><thead><tr><th>Hesap kalemi</th><th class="num">Miktar</th><th class="num">Birim</th><th class="num">Tutar</th></tr></thead><tbody>' +
        '<tr><td>Çiğ süt bedeli</td><td class="num">' + NS.fmtNum(r.liters, 1) + ' L</td><td class="num">' + NS.fmtMoney(r.avgPrice, 4) + '</td><td class="num">' + NS.fmtMoney(r.gross, 2) + '</td></tr>' +
        '<tr><td>Kalite primi / kesintisi</td><td class="num">A ' + r.grades.A + ' · B ' + r.grades.B + ' · C ' + r.grades.C + '</td><td class="num">—</td><td class="num">' + (r.premium >= 0 ? '+' : '') + NS.fmtMoney(r.premium, 2) + '</td></tr>' +
        '<tr><td>Yem bedeli mahsubu</td><td class="num">—</td><td class="num">—</td><td class="num">− ' + NS.fmtMoney(r.feedCost, 2) + '</td></tr>' +
        '<tr><td>Avans ve önceki ödemeler</td><td class="num">—</td><td class="num">—</td><td class="num">− ' + NS.fmtMoney(r.advances, 2) + '</td></tr>' +
      '</tbody><tfoot><tr><td colspan="3">NET ÖDENECEK TUTAR</td><td class="num">' + NS.fmtMoney(r.net, 2) + '</td></tr></tfoot></table>' +
      '<div class="doc-note">' + NS.esc(NS.state.db.settings.deliveryNote) + ' Ödeme durumu: ' + NS.esc(r.status) + '.</div>' +
      '<div class="doc-qr">' + NS.qrSVG('MP|TEDIYE|' + receiptNo + '|' + r.net, 3) + '<small>Belge doğrulama<br>' + NS.esc(receiptNo) + ' · ' + NS.fmtMoney(r.net, 2) + '<br>' + NS.esc(NS.state.db.settings.businessName) + '</small></div>' +
      '<div class="doc-sign"><div>Üretici imzası</div><div>Mandıra yetkilisi</div></div>' +
      '<div class="doc-footer"><span>' + NS.esc(NS.state.db.settings.businessName) + ' · ' + NS.esc(NS.state.db.settings.address) + '</span><span>' + NS.esc(NS.state.db.settings.phone) + ' · ' + NS.esc(NS.state.db.settings.email) + '</span></div>';
    NS.printDoc({ title: 'Tediye fişi', subtitle: p.name + ' · ' + receiptNo, html: html });
  };

  NS.printSettlementBulk = function (selectedIds) {
    const range = NS.settlementPeriod();
    const rows = NS.settlementRows().filter(function (r) { return !selectedIds.length || selectedIds.indexOf(r.producerId) !== -1; });
    if (!rows.length) { NS.toast('Makbuz için üretici yok', 'Dönemde kayıt bulunamadı.', 'warn'); return; }
    const totalNet = NS.sum(rows.map(function (r) { return r.net; }));
    const totalLiters = NS.sum(rows.map(function (r) { return r.liters; }));
    const table = rows.map(function (r, i) {
      return '<tr><td>' + (i + 1) + '</td><td>' + NS.esc(r.producer.name) + '</td><td>' + NS.esc(r.producer.code) + '</td>' +
        '<td class="num">' + NS.fmtNum(r.liters, 1) + '</td><td class="num">' + NS.fmtMoney(r.avgPrice, 2) + '</td>' +
        '<td class="num">' + NS.fmtMoney(r.feedCost, 0) + '</td><td class="num">' + NS.fmtMoney(r.advances, 0) + '</td>' +
        '<td class="num">' + NS.fmtMoney(r.net, 2) + '</td><td style="width:26mm"></td></tr>';
    }).join('');
    const html =
      '<div class="doc-head">' +
        '<div class="doc-brand"><div class="doc-mark">MP</div><div><b>' + NS.esc(NS.state.db.settings.businessName) + '</b><small>Tediye bordrosu</small></div></div>' +
        '<div class="doc-title"><h1>TEDİYE BORDROSU</h1><p>' + NS.esc(range.label) + '</p><div class="doc-no">' + NS.esc(NS.nextReceiptNo(range.start.slice(0, 7))) + '</div></div>' +
      '</div>' +
      '<p class="doc-p" style="margin-top:4mm">' + NS.fmtDate(range.start) + ' – ' + NS.fmtDate(range.end) + ' döneminde aşağıda adı geçen üreticilerden alınan sütün kalite, yem ve avans mahsupları sonrası net tutarlarıdır.</p>' +
      '<table class="doc-table"><thead><tr><th>#</th><th>Üretici</th><th>Kod</th><th class="num">Süt (L)</th><th class="num">Ort. fiyat</th><th class="num">Yem</th><th class="num">Avans</th><th class="num">Net</th><th>İmza</th></tr></thead><tbody>' + table + '</tbody>' +
      '<tfoot><tr><td colspan="3">TOPLAM · ' + rows.length + ' üretici</td><td class="num">' + NS.fmtNum(totalLiters, 1) + '</td><td></td><td></td><td></td><td class="num">' + NS.fmtMoney(totalNet, 2) + '</td><td></td></tr></tfoot></table>' +
      '<div class="doc-note">Bu bordro ' + NS.esc(NS.state.db.settings.businessName) + ' tarafından düzenlenmiştir. Kalite sınıfları numune sonuçlarına göre uygulanmıştır.</div>' +
      '<div class="doc-sign"><div>Düzenleyen</div><div>Onaylayan</div><div>Mali işler</div></div>' +
      '<div class="doc-footer"><span>' + NS.esc(NS.state.db.settings.address) + '</span><span>' + NS.esc(NS.state.db.settings.phone) + '</span></div>';
    NS.printDoc({ title: 'Tediye bordrosu', subtitle: range.label + ' · ' + rows.length + ' üretici', html: html });
  };

  NS.exportSettlements = function () {
    const rows = NS.settlementRows();
    const data = [['Üretici', 'Kod', 'Rota', 'Süt (L)', 'Ort. Fiyat', 'Brüt', 'Kalite Primi', 'Yem', 'Avans', 'Net', 'Durum', 'Makbuz']];
    rows.forEach(function (r) {
      const c = NS.collectorById(r.producer.collectorId);
      data.push([r.producer.name, r.producer.code, c ? c.route : '', r.liters, r.avgPrice, r.gross, r.premium, r.feedCost, r.advances, r.net, r.status, r.receiptNo || '']);
    });
    data.push([]);
    data.push(['TOPLAM', '', '', NS.sum(rows.map(function (r) { return r.liters; })), '', NS.sum(rows.map(function (r) { return r.gross; })), NS.sum(rows.map(function (r) { return r.premium; })), NS.sum(rows.map(function (r) { return r.feedCost; })), NS.sum(rows.map(function (r) { return r.advances; })), NS.sum(rows.map(function (r) { return r.net; }))]);
    NS.exportXLSX('mandirapro-tediye-' + NS.settlementPeriod().start + '.xlsx', [{ name: 'Tediye', rows: data, widths: [24, 10, 18, 10, 11, 12, 12, 12, 12, 14, 12, 18] }]);
  };

})(window.MPApp);
