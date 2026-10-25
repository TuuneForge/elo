/* ============================================================
   MandıraPro 2.0 — Sipariş & Ürün
   ============================================================ */
(function (NS) {
  'use strict';

  NS.hooks = NS.hooks || {};

  NS.filteredOrders = function () {
    const f = NS.state.orders;
    let list = NS.state.db.orders.slice();
    if (f.status !== 'all') list = list.filter(function (o) { return o.status === f.status; });
    if (f.q) {
      const q = f.q.toLocaleLowerCase('tr-TR');
      list = list.filter(function (o) {
        const p = NS.producerById(o.producerId);
        return [o.no, p ? p.name : '', p ? p.code : '', o.note].join(' ').toLocaleLowerCase('tr-TR').indexOf(q) !== -1;
      });
    }
    list.sort(function (a, b) { return String(b.date + b.no).localeCompare(String(a.date + a.no)); });
    return list;
  };

  NS.orderTotal = function (o) {
    return NS.round(NS.sum((o.items || []).map(function (it) { return (Number(it.qty) || 0) * (Number(it.unitPrice) || 0); })), 2);
  };
  NS.nextOrderNo = function () {
    return NS.nextNumber('SIP', NS.state.db.orders.length + 1);
  };

  NS.renderOrders = function () {
    const db = NS.state.db;
    const f = NS.state.orders;
    const list = NS.filteredOrders();
    const open = db.orders.filter(function (o) { return o.status !== 'Teslim'; }).length;
    const monthOrders = db.orders.filter(function (o) { return o.date.slice(0, 7) === NS.todayISO().slice(0, 7); });
    const monthTotal = NS.sum(monthOrders.map(function (o) { return o.total || NS.orderTotal(o); }));
    const lowStock = db.products.filter(function (p) { return Number(p.stock) <= Number(p.minStock); });
    const nextStatus = function (s) {
      const i = MP.ORDER_STATUSES.indexOf(s);
      return i >= 0 && i < MP.ORDER_STATUSES.length - 1 ? MP.ORDER_STATUSES[i + 1] : null;
    };

    const orderRows = list.map(function (o) {
      const p = NS.producerById(o.producerId);
      const next = nextStatus(o.status);
      return '<tr class="clickable" data-action="order-view" data-id="' + o.id + '">' +
        '<td><b class="code-tag" style="font-size:11px">' + NS.esc(o.no) + '</b><div class="cell-sub">' + NS.fmtDate(o.date) + '</div></td>' +
        '<td><div class="prod-cell">' + NS.avatarHTML(p ? p.name : '?') + '<div><b>' + NS.esc(p ? p.name : '—') + '</b><small>' + NS.esc(p ? p.code + ' · ' + p.village : '') + '</small></div></div></td>' +
        '<td>' + (o.items || []).length + ' kalem<div class="cell-sub">' + NS.esc((o.items || []).map(function (it) { const pr = NS.productById(it.productId); return pr ? pr.name.split(' ')[0] : it.productId; }).slice(0, 2).join(', ')) + '</div></td>' +
        '<td class="num"><b>' + NS.fmtMoney(o.total || NS.orderTotal(o), 0) + '</b></td>' +
        '<td>' + NS.badge(o.status) + '</td>' +
        '<td>' + (o.invoiceId ? '<span class="badge success">faturalı</span>' : '<span class="faint small">—</span>') + '</td>' +
        '<td><div class="row-actions">' +
          (next ? '<button class="btn btn-soft btn-sm" type="button" data-action="order-advance" data-id="' + o.id + '">' + NS.esc(next) + '</button>' : '') +
          '<button class="icon-btn sm" type="button" data-action="order-view" data-id="' + o.id + '" title="Detay">' + NS.icon('arrow-right') + '</button>' +
          '<button class="icon-btn sm" type="button" data-action="order-delete" data-id="' + o.id + '" title="Sil">' + NS.icon('trash') + '</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    const productsByGroup = {};
    db.products.forEach(function (p) {
      productsByGroup[p.group] = productsByGroup[p.group] || [];
      productsByGroup[p.group].push(p);
    });
    const productCards = MP.PRODUCT_GROUPS.filter(function (g) { return productsByGroup[g]; }).map(function (g) {
      return '<div class="product-group">' +
        '<div class="product-group-head"><h4>' + NS.esc(g) + '</h4><span>' + productsByGroup[g].length + ' ürün</span></div>' +
        '<div class="product-list">' + productsByGroup[g].map(function (p) {
          const low = Number(p.stock) <= Number(p.minStock);
          return '<div class="product-row">' +
            '<div class="pr-main"><b>' + NS.esc(p.name) + '</b><small>' + NS.fmtMoney(p.price, 2) + ' / ' + NS.esc(p.unit) + ' · KDV %' + p.vat + '</small></div>' +
            '<div class="pr-stock ' + (low ? 'low' : '') + '"><b>' + NS.fmtNum(p.stock, 0) + '</b><small>' + NS.esc(p.unit) + '</small></div>' +
            '<div class="row-actions">' +
              '<button class="icon-btn sm" type="button" data-action="product-stock" data-id="' + p.id + '" title="Stok gir">' + NS.icon('package') + '</button>' +
              '<button class="icon-btn sm" type="button" data-action="product-edit" data-id="' + p.id + '" title="Düzenle">' + NS.icon('edit') + '</button>' +
            '</div>' +
          '</div>';
        }).join('') + '</div>' +
      '</div>';
    }).join('');

    return '<div class="page stagger">' +

      '<section class="page-head">' +
        '<div class="ph-left">' +
          '<div class="page-kicker">' + NS.icon('package') + ' yem & malzeme</div>' +
          '<h1>Sipariş ve ürünler</h1>' +
          '<p><b>' + open + '</b> açık sipariş, bu ay <b>' + NS.fmtMoney(monthTotal, 0) + '</b> sipariş tutarı. ' + (lowStock.length ? '<b class="tone-neg">' + lowStock.length + ' üründe</b> stok minimumun altında.' : 'Stok seviyeleri uygun.') + '</p>' +
        '</div>' +
        '<div class="ph-actions">' +
          '<button class="btn btn-ghost" type="button" data-action="orders-export">' + NS.icon('download') + ' Dışa aktar</button>' +
          '<button class="btn btn-ghost" type="button" data-action="product-new">' + NS.icon('plus') + ' Ürün</button>' +
          '<button class="btn btn-primary" type="button" data-action="new-order">' + NS.icon('package') + ' Sipariş oluştur</button>' +
        '</div>' +
      '</section>' +

      '<div class="grid-4">' +
        '<div class="mini-stat"><small>Açık sipariş</small><b>' + open + '</b><span>' + db.orders.filter(function (o) { return o.status === 'Talep'; }).length + ' yeni talep</span></div>' +
        '<div class="mini-stat"><small>Bu ay sipariş</small><b>' + NS.fmtMoney(monthTotal, 0) + '</b><span>' + monthOrders.length + ' sipariş</span></div>' +
        '<div class="mini-stat"><small>Ürün çeşidi</small><b>' + db.products.length + '</b><span>' + Object.keys(productsByGroup).length + ' grupta</span></div>' +
        '<div class="mini-stat"><small>Stok uyarısı</small><b class="' + (lowStock.length ? 'tone-neg' : '') + '">' + lowStock.length + '</b><span>minimum seviyenin altında</span></div>' +
      '</div>' +

      '<section class="card">' +
        '<div class="card-head card-head-rule row between">' +
          '<div><h3>Siparişler</h3><p>Üretici talepleri ve teslim durumu</p></div>' +
          '<div class="row gap-6">' +
            '<select class="select" style="height:33px;font-size:11.5px;width:auto" data-filter="order-status"><option value="all">Tüm durumlar</option>' + MP.ORDER_STATUSES.map(function (s) {
              return '<option value="' + s + '"' + (f.status === s ? ' selected' : '') + '>' + s + '</option>';
            }).join('') + '</select>' +
          '</div>' +
        '</div>' +
        '<div class="card-body" style="padding-top:12px">' +
          '<div class="toolbar mb-10"><div class="toolbar-search">' + NS.icon('search') + '<input class="input" type="text" placeholder="Sipariş no veya üretici ara…" value="' + NS.esc(f.q) + '" data-filter="order-q"></div>' +
            '<span class="small faint">' + list.length + ' sipariş</span></div>' +
          '<div class="table-wrap"><table class="table table-wide"><thead><tr><th>Sipariş</th><th>Üretici</th><th>İçerik</th><th class="num">Tutar</th><th>Durum</th><th>Fatura</th><th></th></tr></thead>' +
            '<tbody>' + (orderRows || '<tr><td colspan="7">' + NS.emptyState('package', 'Sipariş yok', 'Üreticilerden gelen talepler burada birikir.') + '</td></tr>') + '</tbody></table></div>' +
        '</div>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-head card-head-rule"><div><h3>Ürün kataloğu</h3><p>Gruplu yem, kaba yem, malzeme ve ekipman</p></div></div>' +
        '<div class="card-body"><div class="product-groups">' + (productCards || NS.emptyState('package', 'Ürün yok', 'Ürün ekleyerek sipariş almaya başlayın.')) + '</div></div>' +
      '</section>' +

      '<div class="inline-note" style="padding:0 2px">' + NS.icon('leaf') + '<span>Ürün fiyatları sipariş ve faturaya aynen yansır. Sipariş teslim edildiğinde stok düşer; düşük stok uyarısı panele düşer.</span></div>' +

    '</div>';
  };

  NS.openOrderView = function (id) {
    const db = NS.state.db;
    const o = db.orders.find(function (x) { return x.id === id; });
    if (!o) return;
    const p = NS.producerById(o.producerId);
    const nextStatus = function (s) {
      const i = MP.ORDER_STATUSES.indexOf(s);
      return i >= 0 && i < MP.ORDER_STATUSES.length - 1 ? MP.ORDER_STATUSES[i + 1] : null;
    };
    const next = nextStatus(o.status);
    const timeline = MP.ORDER_STATUSES.map(function (s) {
      const idx = MP.ORDER_STATUSES.indexOf(s);
      const curIdx = MP.ORDER_STATUSES.indexOf(o.status);
      const state = idx < curIdx ? 'done' : idx === curIdx ? 'current' : '';
      return '<div class="order-step ' + state + '"><span></span><b>' + s + '</b></div>';
    }).join('');
    const invoice = o.invoiceId ? db.invoices.find(function (i) { return i.id === o.invoiceId; }) : null;

    NS.openModal({
      title: 'Sipariş ' + o.no,
      subtitle: (p ? p.name : '') + ' · ' + NS.fmtDate(o.date),
      size: 'lg',
      body:
        '<div class="order-steps">' + timeline + '</div>' +
        '<div class="table-wrap"><table class="table" style="min-width:0"><thead><tr><th>Ürün</th><th class="num">Miktar</th><th class="num">Birim fiyat</th><th class="num">Tutar</th></tr></thead><tbody>' +
          (o.items || []).map(function (it) {
            const pr = NS.productById(it.productId);
            return '<tr><td>' + NS.esc(pr ? pr.name : it.productId) + '</td><td class="num">' + NS.fmtNum(it.qty, 2) + ' ' + NS.esc(pr ? pr.unit : '') + '</td><td class="num">' + NS.fmtMoney(it.unitPrice, 2) + '</td><td class="num">' + NS.fmtMoney(it.qty * it.unitPrice, 2) + '</td></tr>';
          }).join('') +
        '</tbody><tfoot><tr><td colspan="3">TOPLAM</td><td class="num">' + NS.fmtMoney(o.total || NS.orderTotal(o), 2) + '</td></tr></tfoot></table></div>' +
        (o.note ? '<div class="inline-note mt-12">' + NS.icon('info') + '<span>' + NS.esc(o.note) + '</span></div>' : '') +
        (invoice ? '<div class="note-banner mt-12">' + NS.icon('file-text') + '<div>Bu sipariş <b>' + NS.esc(invoice.no) + '</b> numaralı faturaya bağlandı. <button class="btn btn-ghost btn-sm" data-action="invoice-print" data-id="' + invoice.id + '">Faturayı aç</button></div></div>' : ''),
      footer:
        '<button class="btn btn-ghost" type="button" data-action="close-modal">Kapat</button>' +
        '<button class="btn btn-ghost" type="button" data-action="order-print" data-id="' + o.id + '">' + NS.icon('printer') + ' Sipariş fişi</button>' +
        (!invoice && o.status === 'Teslim' ? '<button class="btn btn-ghost" type="button" data-action="order-invoice" data-id="' + o.id + '">' + NS.icon('file-text') + ' Faturaya dönüştür</button>' : '') +
        (next ? '<button class="btn btn-primary" type="button" data-action="order-advance" data-id="' + o.id + '">' + NS.icon('check') + ' ' + next + '</button>' : '')
    });
  };

  NS.printOrder = function (id) {
    const o = NS.state.db.orders.find(function (x) { return x.id === id; });
    if (!o) return;
    const p = NS.producerById(o.producerId);
    const html = '<div class="doc-head"><div class="doc-brand"><div class="doc-mark">MP</div><div><b>' + NS.esc(NS.state.db.settings.businessName) + '</b><small>Sipariş fişi</small></div></div>' +
      '<div class="doc-title"><h1>SİPARİŞ FİŞİ</h1><p>' + NS.fmtDate(o.date) + '</p><div class="doc-no">' + NS.esc(o.no) + '</div></div></div>' +
      '<div class="doc-meta"><div class="doc-party"><small>Üretici</small><b>' + NS.esc(p ? p.name : '—') + '</b><p>' + NS.esc(p ? p.code + ' · ' + p.village : '') + '</p></div><div class="doc-side"><div><small>Durum</small><b>' + NS.esc(o.status) + '</b></div><div><small>Teslim</small><b>Mandıra teslimi</b></div></div></div>' +
      '<table class="doc-table"><thead><tr><th>Ürün</th><th class="num">Miktar</th><th class="num">Birim fiyat</th><th class="num">Tutar</th></tr></thead><tbody>' +
      (o.items || []).map(function (it) { const pr = NS.productById(it.productId); return '<tr><td>' + NS.esc(pr ? pr.name : it.productId) + '</td><td class="num">' + NS.fmtNum(it.qty, 2) + ' ' + NS.esc(pr ? pr.unit : '') + '</td><td class="num">' + NS.fmtMoney(it.unitPrice, 2) + '</td><td class="num">' + NS.fmtMoney(it.qty * it.unitPrice, 2) + '</td></tr>'; }).join('') +
      '</tbody><tfoot><tr><td colspan="3">TOPLAM</td><td class="num">' + NS.fmtMoney(o.total || NS.orderTotal(o), 2) + '</td></tr></tfoot></table>' +
      '<div class="doc-note">' + NS.esc(o.note || 'Sipariş, mandıra tarafından hazırlanacaktır.') + '</div>' +
      '<div class="doc-sign"><div>Üretici</div><div>Teslim eden</div></div>';
    NS.printDoc({ title: 'Sipariş fişi', subtitle: o.no, html: html });
  };

  NS.exportOrders = function () {
    const rows = [['Sipariş No', 'Tarih', 'Üretici', 'Kod', 'Durum', 'Tutar', 'Fatura', 'Not']];
    NS.filteredOrders().forEach(function (o) {
      const p = NS.producerById(o.producerId);
      rows.push([o.no, o.date, p ? p.name : '', p ? p.code : '', o.status, o.total || NS.orderTotal(o), o.invoiceId ? 'Evet' : '', o.note || '']);
    });
    NS.exportXLSX('mandirapro-siparisler-' + NS.todayISO() + '.xlsx', [{ name: 'Siparişler', rows: rows, widths: [16, 12, 22, 10, 12, 12, 10, 34] }]);
  };

})(window.MPApp);
