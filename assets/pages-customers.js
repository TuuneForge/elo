/* ============================================================
   MandıraPro — Müşteriler sayfası, formu ve detay çekmecesi
   ============================================================ */
(function (NS) {
  'use strict';

  function filteredCustomers() {
    const st = NS.state.cust;
    const q = st.q.toLowerCase().trim();
    return NS.state.db.customers.filter(function (c) {
      if (st.filter === 'active' && !c.active) return false;
      if (st.filter === 'passive' && c.active) return false;
      if (!q) return true;
      return c.name.toLowerCase().indexOf(q) !== -1 ||
             String(c.village || '').toLowerCase().indexOf(q) !== -1 ||
             String(c.phone || '').indexOf(q) !== -1;
    }).sort(function (a, b) { return a.name.localeCompare(b.name, 'tr'); });
  }

  function cardsHTML() {
    const ym = NS.todayISO().slice(0, 7);
    const stats = NS.customerMonthStats(ym);
    const list = filteredCustomers();

    if (!list.length) {
      return '<div style="grid-column:1/-1">' +
        NS.emptyState('users', 'Müşteri bulunamadı', 'Aramayı değiştirin veya yeni bir müşteri ekleyin.') + '</div>';
    }

    return list.map(function (c) {
      const s = stats[c.id] || { milk: 0, net: 0, count: 0 };
      return '<article class="customer-card" data-action="open-customer" data-id="' + c.id + '" tabindex="0" role="button" aria-label="' + NS.esc(c.name) + ' detayı">' +
        '<div class="customer-top">' +
          NS.avatarHTML(c.name) +
          '<div class="customer-name"><b>' + NS.esc(c.name) + '</b>' +
            '<small>' + NS.esc(c.village || 'Köy belirtilmemiş') + ' · ' + s.count + ' kayıt</small></div>' +
          '<span style="margin-left:auto;color:var(--faint)">' + NS.icon('chevron-right') + '</span>' +
        '</div>' +
        '<div class="customer-metrics">' +
          '<div class="cm"><small>BU AY SÜT</small><b>' + NS.fmtNum(s.milk, 1) + ' L</b></div>' +
          '<div class="cm"><small>BU AY NET</small><b style="color:' + (s.net >= 0 ? 'var(--success)' : 'var(--danger)') + '">' + NS.fmtMoney(s.net, 0) + '</b></div>' +
        '</div>' +
        '<div class="customer-foot">' +
          '<span class="phone">' + NS.icon('phone') + ' ' + NS.esc(c.phone || 'Telefon yok') + '</span>' +
          '<span class="badge ' + (c.active ? 'success' : '') + '"><span class="dot"></span>' + (c.active ? 'Aktif' : 'Pasif') + '</span>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  NS.renderCustomers = function () {
    const st = NS.state.cust;
    const seg = function (f, label) {
      return '<button type="button" data-action="cust-filter" data-filter="' + f + '" class="' + (st.filter === f ? 'active' : '') + '">' + label + '</button>';
    };
    const count = filteredCustomers().length;

    return '<div class="page">' +
      '<div class="toolbar">' +
        '<div class="seg">' + seg('all', 'Tümü') + seg('active', 'Aktif') + seg('passive', 'Pasif') + '</div>' +
        '<div class="toolbar-search">' + NS.icon('search') +
          '<input class="input" type="text" data-filter="cust-q" placeholder="İsim, köy veya telefon ara…" value="' + NS.esc(st.q) + '">' +
        '</div>' +
        '<span class="badge primary" style="margin-left:2px">' + NS.esc(NS.capitalize(NS.monthLabel(NS.todayISO().slice(0, 7)))) + '</span>' +
        '<div class="grow"></div>' +
        '<span class="pager-info" id="custCount">' + count + ' müşteri</span>' +
        '<button type="button" class="btn btn-primary" data-action="new-customer">' + NS.icon('plus') + ' Yeni Müşteri</button>' +
      '</div>' +
      '<div class="customer-grid" id="customerGrid">' + cardsHTML() + '</div>' +
    '</div>';
  };

  NS.refreshCustomerGrid = function () {
    const grid = NS.$('#customerGrid');
    if (grid) grid.innerHTML = cardsHTML();
    const cnt = NS.$('#custCount');
    if (cnt) cnt.textContent = filteredCustomers().length + ' müşteri';
  };

  /* ---------------- Müşteri formu ---------------- */
  NS.openCustomerModal = function (id) {
    const c = id ? NS.customerById(id) : null;
    const body =
      '<form id="customerForm" data-id="' + (c ? c.id : '') + '" autocomplete="off">' +
        '<div class="form-grid">' +
          '<label class="field span-2"><span class="field-label">Ad Soyad *</span>' +
            '<input class="input" type="text" name="name" value="' + NS.esc(c ? c.name : '') + '" placeholder="örn. Ahmet Yılmaz" required maxlength="60">' +
          '</label>' +
          '<label class="field"><span class="field-label">Telefon</span>' +
            '<input class="input" type="tel" name="phone" value="' + NS.esc(c ? c.phone : '') + '" placeholder="05xx xxx xx xx" maxlength="24">' +
          '</label>' +
          '<label class="field"><span class="field-label">Köy / Bölge</span>' +
            '<input class="input" type="text" name="village" value="' + NS.esc(c ? c.village : '') + '" placeholder="örn. Yukarıköy" maxlength="40">' +
          '</label>' +
          '<label class="field span-2"><span class="field-label">Not</span>' +
            '<textarea class="textarea" name="note" rows="2" placeholder="İsteğe bağlı not…">' + NS.esc(c ? c.note : '') + '</textarea>' +
          '</label>' +
          '<label class="checkbox span-2"><input type="checkbox" name="active"' + (!c || c.active ? ' checked' : '') + '> Aktif müşteri (kayıt girişine açık)</label>' +
        '</div>' +
      '</form>';

    NS.openModal({
      title: c ? 'Müşteriyi Düzenle' : 'Yeni Müşteri',
      subtitle: c ? 'Bilgileri güncelleyin.' : 'Süt toplama listenize yeni bir üretici ekleyin.',
      icon: 'users',
      body: body,
      footer: '<button type="button" class="btn btn-ghost" data-action="close-modal">Vazgeç</button>' +
        '<button type="submit" form="customerForm" class="btn btn-primary">' + NS.icon('check') + ' Kaydet</button>'
    });
  };

  /* ---------------- Detay çekmecesi ---------------- */
  NS.openCustomerDrawer = function (id) {
    const c = NS.customerById(id);
    if (!c) return;

    const ym = NS.todayISO().slice(0, 7);
    const recs = NS.state.db.records.filter(function (r) { return r.customerId === id; })
      .sort(function (a, b) { return b.date.localeCompare(a.date); });
    const monthRecs = recs.filter(function (r) { return r.date >= NS.monthStart(ym); });
    const milk = NS.sumMilk(monthRecs);
    const feedKg = NS.sumFeedKg(monthRecs);
    const net = NS.sumNet(monthRecs);
    const recent = recs.slice(0, 8);

    const recentHTML = recent.map(function (r) {
      const fkg = NS.recordFeedKg(r);
      const rNet = NS.recordIncome(r) - NS.recordFeedCost(r);
      return '<div class="activity-row">' +
        '<span class="activity-ico act-milk">' + NS.icon('drop') + '</span>' +
        '<div class="activity-main"><b>' + NS.fmtDate(r.date) + '</b>' +
          '<small>' + NS.fmtNum(r.milk, 1) + ' L süt' + (fkg > 0 ? ' · ' + NS.fmtNum(fkg, 1) + ' kg yem' : '') + '</small></div>' +
        '<span class="activity-time" style="color:' + (rNet >= 0 ? 'var(--success)' : 'var(--danger)') + '">' + NS.fmtMoney(rNet, 2) + '</span>' +
      '</div>';
    }).join('') || '<div class="empty-state" style="padding:24px 8px"><b style="font-size:13px">Henüz kayıt yok</b></div>';

    const html =
      '<div class="drawer-head">' +
        NS.avatarHTML(c.name) +
        '<div><h3>' + NS.esc(c.name) + '</h3>' +
          '<small>' + NS.esc(c.village || 'Köy belirtilmemiş') + ' · ' +
            '<span style="color:' + (c.active ? 'var(--success)' : 'var(--faint)') + '">' + (c.active ? 'Aktif' : 'Pasif') + '</span></small></div>' +
        '<button type="button" class="icon-btn" data-action="close-drawer" aria-label="Kapat">' + NS.icon('x') + '</button>' +
      '</div>' +
      '<div class="drawer-body">' +
        '<div class="drawer-stats">' +
          '<div class="cm"><small>BU AY SÜT</small><b>' + NS.fmtNum(milk, 1) + ' L</b></div>' +
          '<div class="cm"><small>BU AY YEM</small><b>' + NS.fmtNum(feedKg, 1) + ' kg</b></div>' +
          '<div class="cm"><small>BU AY NET</small><b style="color:' + (net >= 0 ? 'var(--success)' : 'var(--danger)') + '">' + NS.fmtMoney(net, 0) + '</b></div>' +
        '</div>' +

        '<div>' +
          '<div class="drawer-section" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">' +
            '<h4 style="margin:0">Son 30 Gün Süt</h4>' +
            '<span class="badge primary">' + NS.fmtNum(NS.sumMilk(recs.filter(function (r) { return r.date >= NS.isoOffset(-29); })), 1) + ' L</span>' +
          '</div>' +
          '<div class="kpi-spark" id="custSpark" style="height:64px"></div>' +
        '</div>' +

        '<div class="drawer-actions">' +
          '<button type="button" class="btn btn-primary" data-action="record-for-customer" data-id="' + c.id + '">' + NS.icon('plus') + ' Yeni Kayıt</button>' +
          '<button type="button" class="btn btn-ghost" data-action="edit-customer" data-id="' + c.id + '">' + NS.icon('edit') + ' Düzenle</button>' +
          '<button type="button" class="btn btn-danger" data-action="delete-customer" data-id="' + c.id + '">' + NS.icon('trash') + ' Sil</button>' +
        '</div>' +

        '<div class="drawer-section">' +
          '<h4>İletişim</h4>' +
          '<div style="display:flex;flex-direction:column;gap:9px;font-size:13px">' +
            '<div style="display:flex;align-items:center;gap:9px;color:var(--muted)">' + NS.icon('phone') + NS.esc(c.phone || 'Telefon kayıtlı değil') + '</div>' +
            '<div style="display:flex;align-items:center;gap:9px;color:var(--muted)">' + NS.icon('pin') + NS.esc(c.village || 'Köy kayıtlı değil') + '</div>' +
            (c.note ? '<div style="display:flex;align-items:flex-start;gap:9px;color:var(--muted)">' + NS.icon('clipboard') + '<span>' + NS.esc(c.note) + '</span></div>' : '') +
          '</div>' +
        '</div>' +

        '<div class="drawer-section">' +
          '<h4>Son Kayıtlar</h4>' +
          '<div class="activity">' + recentHTML + '</div>' +
        '</div>' +
      '</div>';

    NS.openDrawer(html);

    const series = NS.lastNDays(30).map(function (d) {
      return NS.sumMilk(NS.recordsOn(d).filter(function (r) { return r.customerId === id; }));
    });
    NS.sparkline(NS.$('#custSpark'), series, 'var(--primary-2)');
  };

})(window.MPApp);
