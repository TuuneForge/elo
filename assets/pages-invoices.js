/* ============================================================
   MandıraPro 2.0 — Faturalar
   ============================================================ */
(function (NS) {
  'use strict';

  NS.hooks = NS.hooks || {};

  NS.filteredInvoices = function () {
    const f = NS.state.invoice;
    let list = NS.state.db.invoices.slice();
    if (f.type !== 'all') list = list.filter(function (i) { return i.type === f.type; });
    if (f.q) {
      const q = f.q.toLocaleLowerCase('tr-TR');
      list = list.filter(function (i) {
        return [i.no, i.partyName, i.note, i.partyTaxNo].join(' ').toLocaleLowerCase('tr-TR').indexOf(q) !== -1;
      });
    }
    list.sort(function (a, b) { return String(b.date + b.no).localeCompare(String(a.date + a.no)); });
    return list;
  };

  NS.invoiceTotals = function (inv) {
    let sub = 0, vat = 0;
    (inv.items || []).forEach(function (it) {
      const line = NS.round((Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 2);
      sub += line;
      vat += line * (Number(it.vat) || 0) / 100;
    });
    return { subtotal: NS.round(sub, 2), vatTotal: NS.round(vat, 2), total: NS.round(sub + vat, 2) };
  };

  NS.renderInvoices = function () {
    const db = NS.state.db;
    const f = NS.state.invoice;
    const today = NS.todayISO();
    const ym = today.slice(0, 7);
    const list = NS.filteredInvoices();
    const monthInv = db.invoices.filter(function (i) { return i.date.slice(0, 7) === ym; });
    const sales = NS.sum(monthInv.filter(function (i) { return i.type === 'Satış'; }).map(function (i) { return i.total; }));
    const buys = NS.sum(monthInv.filter(function (i) { return i.type === 'Alım'; }).map(function (i) { return i.total; }));
    const outstanding = NS.sum(db.invoices.filter(function (i) { return i.status === 'Kesildi'; }).map(function (i) { return i.total; }));
    const drafts = db.invoices.filter(function (i) { return i.status === 'Taslak'; }).length;

    const rows = list.map(function (inv) {
      return '<tr class="clickable" data-action="invoice-view" data-id="' + inv.id + '">' +
        '<td><b class="code-tag" style="font-size:11px">' + NS.esc(inv.no) + '</b><div class="cell-sub">' + NS.fmtDate(inv.date) + '</div></td>' +
        '<td><span class="badge ' + (inv.type === 'Satış' ? 'primary' : 'info') + '">' + NS.esc(inv.type) + '</span></td>' +
        '<td><b>' + NS.esc(inv.partyName) + '</b><div class="cell-sub">' + NS.esc(inv.partyTaxNo || '') + '</div></td>' +
        '<td class="num">' + inv.items.length + '<div class="cell-sub">kalem</div></td>' +
        '<td class="num">' + NS.fmtMoney(inv.subtotal, 2) + '</td>' +
        '<td class="num">' + NS.fmtMoney(inv.vatTotal, 2) + '</td>' +
        '<td class="num"><b>' + NS.fmtMoney(inv.total, 2) + '</b></td>' +
        '<td>' + NS.badge(inv.status) + '</td>' +
        '<td><div class="row-actions">' +
          '<button class="icon-btn sm" type="button" data-action="invoice-print" data-id="' + inv.id + '" title="Yazdır">' + NS.icon('printer') + '</button>' +
          (inv.status === 'Taslak' ? '<button class="icon-btn sm" type="button" data-action="invoice-edit" data-id="' + inv.id + '" title="Düzenle">' + NS.icon('edit') + '</button>' : '') +
          '<button class="icon-btn sm" type="button" data-action="invoice-delete" data-id="' + inv.id + '" title="Sil">' + NS.icon('trash') + '</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    return '<div class="page stagger">' +

      '<section class="page-head">' +
        '<div class="ph-left">' +
          '<div class="page-kicker">' + NS.icon('file-text') + ' resmî evrak</div>' +
          '<h1>Faturalar</h1>' +
          '<p>Bu ay <b>' + NS.fmtMoney(sales, 0) + '</b> satış, <b>' + NS.fmtMoney(buys, 0) + '</b> alım faturası kesildi. Tahsil edilmeyi bekleyen <b>' + NS.fmtMoney(outstanding, 0) + '</b>.</p>' +
        '</div>' +
        '<div class="ph-actions">' +
          '<button class="btn btn-ghost" type="button" data-action="invoices-export">' + NS.icon('download') + ' Dışa aktar</button>' +
          '<button class="btn btn-ghost" type="button" data-action="nav" data-view="settings">' + NS.icon('building') + ' Firma bilgileri</button>' +
          '<button class="btn btn-primary" type="button" data-action="new-invoice">' + NS.icon('plus') + ' Fatura kes</button>' +
        '</div>' +
      '</section>' +

      '<div class="grid-4">' +
        '<div class="mini-stat"><small>Bu ay satış</small><b>' + NS.fmtMoney(sales, 0) + '</b><span>' + monthInv.filter(function (i) { return i.type === 'Satış'; }).length + ' fatura</span></div>' +
        '<div class="mini-stat"><small>Bu ay alım</small><b>' + NS.fmtMoney(buys, 0) + '</b><span>' + monthInv.filter(function (i) { return i.type === 'Alım'; }).length + ' fatura</span></div>' +
        '<div class="mini-stat"><small>Tahsilat bekleyen</small><b>' + NS.fmtMoney(outstanding, 0) + '</b><span>kesildi, ödenmedi</span></div>' +
        '<div class="mini-stat"><small>Taslak</small><b>' + drafts + '</b><span>tamamlanmayı bekliyor</span></div>' +
      '</div>' +

      '<section class="card">' +
        '<div class="card-head card-head-rule row between">' +
          '<div><h3>Fatura arşivi</h3><p>Satış ve alım faturaları</p></div>' +
          '<div class="row gap-6">' +
            '<select class="select" style="height:33px;font-size:11.5px;width:auto" data-filter="inv-type"><option value="all">Tüm türler</option><option value="Satış"' + (f.type === 'Satış' ? ' selected' : '') + '>Satış</option><option value="Alım"' + (f.type === 'Alım' ? ' selected' : '') + '>Alım</option></select>' +
          '</div>' +
        '</div>' +
        '<div class="card-body" style="padding-top:12px">' +
          '<div class="toolbar mb-10"><div class="toolbar-search">' + NS.icon('search') + '<input class="input" type="text" placeholder="Fatura no, ünvan veya vergi no ara…" value="' + NS.esc(f.q) + '" data-filter="inv-q"></div>' +
            '<span class="small faint">' + list.length + ' fatura</span></div>' +
          '<div class="table-wrap"><table class="table table-wide"><thead><tr><th>Fatura no</th><th>Tür</th><th>Taraf</th><th class="num">Kalem</th><th class="num">Matrah</th><th class="num">KDV</th><th class="num">Toplam</th><th>Durum</th><th></th></tr></thead>' +
            '<tbody>' + (rows || '<tr><td colspan="9">' + NS.emptyState('file-text', 'Fatura yok', 'İlk faturayı keserek başlayın.') + '</td></tr>') + '</tbody></table></div>' +
          '<div class="inline-note mt-12">' + NS.icon('shield') + '<span>Fatura numarası otomatik sıralı üretilir. Çıktı A4 resmî fatura düzeninde hazırlanır; tarayıcının “PDF olarak kaydet” seçeneğiyle arşivlenebilir.</span></div>' +
        '</div>' +
      '</section>' +

    '</div>';
  };

  NS.invoiceHTML = function (inv) {
    const db = NS.state.db;
    const st = db.settings;
    const isSale = inv.type === 'Satış';
    const seller = isSale
      ? { name: st.businessName, taxNo: st.taxNo, taxOffice: st.taxOffice, address: st.address, mersis: st.mersis }
      : { name: inv.partyName, taxNo: inv.partyTaxNo, taxOffice: '', address: inv.partyAddress, mersis: '' };
    const buyer = isSale
      ? { name: inv.partyName, taxNo: inv.partyTaxNo, taxOffice: '', address: inv.partyAddress, mersis: '' }
      : { name: st.businessName, taxNo: st.taxNo, taxOffice: st.taxOffice, address: st.address, mersis: st.mersis };

    const vatGroups = {};
    inv.items.forEach(function (it) {
      const rate = Number(it.vat) || 0;
      const line = NS.round((Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 2);
      if (!vatGroups[rate]) vatGroups[rate] = { base: 0, vat: 0 };
      vatGroups[rate].base += line;
      vatGroups[rate].vat += line * rate / 100;
    });

    const items = inv.items.map(function (it, i) {
      const line = NS.round((Number(it.qty) || 0) * (Number(it.unitPrice) || 0), 2);
      return '<tr><td>' + (i + 1) + '</td><td>' + NS.esc(it.desc) + '</td><td class="num">' + NS.fmtNum(it.qty, 2) + ' ' + NS.esc(it.unit || '') + '</td>' +
        '<td class="num">' + NS.fmtMoney(it.unitPrice, 2) + '</td><td class="num">%' + (it.vat || 0) + '</td><td class="num">' + NS.fmtMoney(line, 2) + '</td></tr>';
    }).join('');

    const vatRows = Object.keys(vatGroups).map(function (rate) {
      const g = vatGroups[rate];
      return '<tr><td>KDV %' + rate + ' matrahı</td><td class="num">' + NS.fmtMoney(g.base, 2) + '</td></tr>' +
        '<tr><td>KDV %' + rate + '</td><td class="num">' + NS.fmtMoney(g.vat, 2) + '</td></tr>';
    }).join('');

    return '<div class="doc-head">' +
        '<div class="doc-brand"><div class="doc-mark">MP</div><div><b>' + NS.esc(st.businessName) + '</b><small>' + (isSale ? 'Satış faturası' : 'Alım faturası') + '</small></div></div>' +
        '<div class="doc-title"><h1>' + (isSale ? 'SATIŞ FATURASI' : 'ALIM FATURASI') + '</h1><p>' + NS.fmtDate(inv.date) + '</p><div class="doc-no">' + NS.esc(inv.no) + '</div></div>' +
      '</div>' +
      '<div class="doc-meta">' +
        '<div class="doc-party"><small>Satıcı</small><b>' + NS.esc(seller.name) + '</b><p>' + NS.esc(seller.address) + '<br>Vergi dairesi: ' + NS.esc(seller.taxOffice || '—') + ' · No: ' + NS.esc(seller.taxNo) + (seller.mersis ? '<br>MERSİS: ' + NS.esc(seller.mersis) : '') + '</p></div>' +
        '<div class="doc-party"><small>Alıcı</small><b>' + NS.esc(buyer.name) + '</b><p>' + NS.esc(buyer.address) + '<br>Vergi dairesi: ' + NS.esc(buyer.taxOffice || '—') + ' · No: ' + NS.esc(buyer.taxNo) + '</p></div>' +
      '</div>' +
      '<table class="doc-table"><thead><tr><th>#</th><th>Açıklama</th><th class="num">Miktar</th><th class="num">Birim fiyat</th><th class="num">KDV</th><th class="num">Tutar</th></tr></thead><tbody>' + items + '</tbody></table>' +
      '<div class="doc-totals"><table>' + vatRows +
        '<tr><td>Mal / hizmet toplamı</td><td>' + NS.fmtMoney(inv.subtotal, 2) + '</td></tr>' +
        '<tr><td>KDV toplamı</td><td>' + NS.fmtMoney(inv.vatTotal, 2) + '</td></tr>' +
        '<tr class="grand"><td>GENEL TOPLAM</td><td>' + NS.fmtMoney(inv.total, 2) + '</td></tr>' +
      '</table></div>' +
      (inv.note ? '<div class="doc-note">' + NS.esc(inv.note) + '</div>' : '') +
      '<div class="doc-qr">' + NS.qrSVG('MP|FATURA|' + inv.no + '|' + inv.total, 3) + '<small>Fatura doğrulama<br>' + NS.esc(inv.no) + '<br>' + NS.esc(NS.state.db.settings.businessName) + ' · ' + NS.esc(NS.state.db.settings.phone) + '<br>Ödeme durumu: ' + NS.esc(inv.status) + '</small></div>' +
      '<div class="doc-sign"><div>Düzenleyen</div><div>Kaşe / imza</div></div>' +
      '<div class="doc-footer"><span>' + NS.esc(st.businessName) + ' · ' + NS.esc(st.address) + '</span><span>' + NS.esc(st.phone) + ' · ' + NS.esc(st.email) + '</span></div>';
  };

  NS.printInvoice = function (id) {
    const inv = NS.state.db.invoices.find(function (x) { return x.id === id; });
    if (!inv) return;
    NS.printDoc({ title: inv.no, subtitle: inv.type + ' faturası · ' + inv.partyName, html: NS.invoiceHTML(inv) });
  };

  NS.openInvoiceView = function (id) {
    const inv = NS.state.db.invoices.find(function (x) { return x.id === id; });
    if (!inv) return;
    const st = NS.state.db.settings;
    const canIssue = inv.status === 'Taslak';
    NS.openModal({
      title: 'Fatura ' + inv.no,
      subtitle: inv.type + ' · ' + inv.partyName + ' · ' + NS.fmtDate(inv.date),
      size: 'lg',
      body:
        '<div class="stat-grid mb-16">' +
          '<div class="cm"><small>Matrah</small><b>' + NS.fmtMoney(inv.subtotal, 2) + '</b></div>' +
          '<div class="cm"><small>KDV</small><b>' + NS.fmtMoney(inv.vatTotal, 2) + '</b></div>' +
          '<div class="cm"><small>Genel toplam</small><b>' + NS.fmtMoney(inv.total, 2) + '</b></div>' +
        '</div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Açıklama</th><th class="num">Miktar</th><th class="num">Birim fiyat</th><th class="num">KDV</th><th class="num">Tutar</th></tr></thead><tbody>' +
          inv.items.map(function (it) {
            return '<tr><td>' + NS.esc(it.desc) + '</td><td class="num">' + NS.fmtNum(it.qty, 2) + ' ' + NS.esc(it.unit || '') + '</td><td class="num">' + NS.fmtMoney(it.unitPrice, 2) + '</td><td class="num">%' + it.vat + '</td><td class="num">' + NS.fmtMoney(it.lineTotal, 2) + '</td></tr>';
          }).join('') + '</tbody></table></div>' +
        '<div class="row between mt-16"><span class="badge ' + NS.statusTone(inv.status) + '">' + NS.esc(inv.status) + '</span><span class="small faint">' + NS.esc(st.businessName) + ' · ' + NS.esc(st.taxNo) + '</span></div>',
      footer:
        '<button class="btn btn-ghost" type="button" data-action="close-modal">Kapat</button>' +
        (inv.status === 'Taslak' ? '<button class="btn btn-ghost" type="button" data-action="invoice-issue" data-id="' + inv.id + '">' + NS.icon('check') + ' Faturayı kes</button>' : '') +
        (inv.status === 'Kesildi' ? '<button class="btn btn-ghost" type="button" data-action="invoice-paid" data-id="' + inv.id + '">' + NS.icon('wallet') + ' Ödendi işaretle</button>' : '') +
        '<button class="btn btn-primary" type="button" data-action="invoice-print" data-id="' + inv.id + '">' + NS.icon('printer') + ' Yazdır / PDF</button>'
    });
  };

  NS.exportInvoices = function () {
    const list = NS.filteredInvoices();
    const rows = [['Fatura No', 'Tarih', 'Tür', 'Taraf', 'Vergi No', 'Matrah', 'KDV', 'Toplam', 'Durum', 'Not']];
    list.forEach(function (i) {
      rows.push([i.no, i.date, i.type, i.partyName, i.partyTaxNo || '', i.subtotal, i.vatTotal, i.total, i.status, i.note || '']);
    });
    NS.exportXLSX('mandirapro-faturalar-' + NS.todayISO() + '.xlsx', [{ name: 'Faturalar', rows: rows, widths: [18, 12, 10, 26, 14, 14, 12, 14, 12, 30] }]);
  };

})(window.MPApp);
