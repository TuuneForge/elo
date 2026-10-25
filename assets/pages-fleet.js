/* ============================================================
   MandıraPro 2.0 — Filo & Masraf
   ============================================================ */
(function (NS) {
  'use strict';

  NS.hooks = NS.hooks || {};

  NS.filteredExpenses = function () {
    const f = NS.state.fleet;
    let list = NS.state.db.expenses.slice();
    if (f.type !== 'all') list = list.filter(function (e) { return e.type === f.type; });
    if (f.vehicle) list = list.filter(function (e) { return e.vehicleId === f.vehicle; });
    if (f.q) {
      const q = f.q.toLocaleLowerCase('tr-TR');
      list = list.filter(function (e) {
        const v = NS.vehicleById(e.vehicleId);
        const t = e.tankId ? NS.tankById(e.tankId) : null;
        return [e.type, e.vendor, e.note, e.invoiceNo, v ? v.plate : '', t ? t.name : ''].join(' ').toLocaleLowerCase('tr-TR').indexOf(q) !== -1;
      });
    }
    list.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    return list;
  };

  NS.fuelConsumption = function (vehicleId) {
    const db = NS.state.db;
    const fuels = db.expenses.filter(function (e) { return e.vehicleId === vehicleId && e.type === 'Yakıt' && e.liters && e.km; })
      .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
    if (fuels.length < 2) return null;
    const first = fuels[0], last = fuels[fuels.length - 1];
    const km = Number(last.km) - Number(first.km);
    if (km <= 0) return null;
    const liters = NS.sum(fuels.slice(1).map(function (e) { return e.liters; }));
    return { value: NS.round(liters / km * 100, 1), km: km, liters: NS.round(liters, 1) };
  };

  NS.renderFleet = function () {
    const db = NS.state.db;
    const f = NS.state.fleet;
    const today = NS.todayISO();
    const ym = today.slice(0, 7);
    const prevYm = NS.prevMonth(ym);
    const monthExp = db.expenses.filter(function (e) { return e.date.slice(0, 7) === ym; });
    const prevExp = db.expenses.filter(function (e) { return e.date.slice(0, 7) === prevYm; });
    const monthTotal = NS.sum(monthExp.map(function (e) { return e.amount; }));
    const prevTotal = NS.sum(prevExp.map(function (e) { return e.amount; }));
    const fuelLiters = NS.sum(monthExp.filter(function (e) { return e.type === 'Yakıt'; }).map(function (e) { return e.liters; }));
    const monthLiters = NS.sumLiters(NS.monthRecords(ym));
    const costPerLiter = monthLiters ? monthTotal / monthLiters : null;
    const list = NS.filteredExpenses();
    const total = NS.sum(list.map(function (e) { return e.amount; }));

    const categories = MP.EXPENSE_TYPES.map(function (t) {
      return { label: t.key, value: NS.sum(monthExp.filter(function (e) { return e.type === t.key; }).map(function (e) { return e.amount; })), color: t.color };
    }).filter(function (x) { return x.value > 0; });

    const monthKeys = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      monthKeys.push(d.getFullYear() + '-' + NS.pad(d.getMonth() + 1));
    }
    const trend = monthKeys.map(function (m) {
      const s = NS.sum(db.expenses.filter(function (e) { return e.date.slice(0, 7) === m; }).map(function (e) { return e.amount; }));
      return { label: NS.monthLabel(m).split(' ')[0].slice(0, 3), value: s, full: NS.monthLabel(m) };
    });
    NS._fleet = { categories: categories, trend: trend, monthTotal: monthTotal };

    const vehicleCards = db.vehicles.map(function (v) {
      const cons = NS.fuelConsumption(v.id);
      const vehExp = NS.sum(db.expenses.filter(function (e) { return e.vehicleId === v.id && e.date >= NS.monthStart(ym); }).map(function (e) { return e.amount; }));
      const insDays = NS.daysUntil(v.insuranceUntil);
      const inspDays = NS.daysUntil(v.inspectionUntil);
      const insTone = insDays < 0 ? 'danger' : insDays <= 45 ? 'warn' : 'success';
      const inspTone = inspDays < 0 ? 'danger' : inspDays <= 45 ? 'warn' : 'success';
      return '<article class="vehicle-card">' +
        '<div class="vc-head"><div><h3>' + NS.esc(v.plate) + '</h3><p>' + NS.esc(v.brand + ' ' + v.model + ' · ' + v.year) + '</p></div><span class="badge ' + (v.active ? 'success' : '') + '">' + (v.active ? 'aktif' : 'pasif') + '</span></div>' +
        '<div class="vc-metrics">' +
          '<div><small>Kilometre</small><b>' + NS.fmtNum(v.km, 0) + '</b></div>' +
          '<div><small>Tüketim</small><b>' + (cons ? NS.fmtNum(cons.value, 1) + ' <em>L/100</em>' : '—') + '</b></div>' +
          '<div><small>Bu ay masraf</small><b>' + NS.fmtMoney(vehExp, 0) + '</b></div>' +
        '</div>' +
        '<div class="vc-chips">' +
          '<span class="badge ' + insTone + '">' + NS.icon('shield') + ' Sigorta ' + (insDays < 0 ? 'gecikti' : insDays + ' gün') + '</span>' +
          '<span class="badge ' + inspTone + '">' + NS.icon('truck') + ' Muayene ' + (inspDays < 0 ? 'gecikti' : inspDays + ' gün') + '</span>' +
        '</div>' +
        '<div class="vc-foot">' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="new-expense" data-vehicle="' + v.id + '">' + NS.icon('plus') + ' Masraf</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="edit-vehicle" data-id="' + v.id + '">' + NS.icon('edit') + ' Düzenle</button>' +
        '</div>' +
      '</article>';
    }).join('');

    const rows = list.slice(0, 60).map(function (e) {
      const v = NS.vehicleById(e.vehicleId);
      const t = e.tankId ? NS.tankById(e.tankId) : null;
      const type = MP.EXPENSE_TYPES.find(function (x) { return x.key === e.type; }) || { icon: 'more', color: 'var(--muted)' };
      return '<tr>' +
        '<td><b style="font-weight:600">' + NS.fmtDate(e.date) + '</b><div class="cell-sub">' + NS.esc(e.invoiceNo || '') + '</div></td>' +
        '<td><span class="exp-type"><span class="exp-ico" style="color:' + type.color + '">' + NS.icon(type.icon) + '</span>' + NS.esc(e.type) + '</span></td>' +
        '<td>' + NS.esc(v ? v.plate : t ? t.name : '—') + '<div class="cell-sub">' + NS.esc(e.vendor || '') + '</div></td>' +
        '<td>' + NS.esc(e.note || '') + '</td>' +
        '<td class="num">' + (e.liters ? NS.fmtNum(e.liters, 1) + ' L' : e.km ? NS.fmtNum(e.km, 0) + ' km' : '—') + '</td>' +
        '<td class="num"><b>' + NS.fmtMoney(e.amount, 2) + '</b></td>' +
        '<td><div class="row-actions">' +
          '<button class="icon-btn sm" type="button" data-action="edit-expense" data-id="' + e.id + '" title="Düzenle">' + NS.icon('edit') + '</button>' +
          '<button class="icon-btn sm" type="button" data-action="delete-expense" data-id="' + e.id + '" title="Sil">' + NS.icon('trash') + '</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    return '<div class="page stagger">' +

      '<section class="page-head">' +
        '<div class="ph-left">' +
          '<div class="page-kicker">' + NS.icon('truck') + ' filo & maliyet</div>' +
          '<h1>Filo ve masraflar</h1>' +
          '<p>' + db.vehicles.length + ' araç, ' + monthExp.length + ' bu ay masraf kaydı. Bu ayın toplam gideri <b>' + NS.fmtMoney(monthTotal, 0) + '</b>; litre başına maliyet <b>' + (costPerLiter ? NS.fmtMoney(costPerLiter, 2) : '—') + '</b>.</p>' +
        '</div>' +
        '<div class="ph-actions">' +
          '<button class="btn btn-ghost" type="button" data-action="fleet-export">' + NS.icon('download') + ' Dışa aktar</button>' +
          '<button class="btn btn-ghost" type="button" data-action="new-vehicle">' + NS.icon('truck') + ' Araç ekle</button>' +
          '<button class="btn btn-primary" type="button" data-action="new-expense">' + NS.icon('plus') + ' Masraf gir</button>' +
        '</div>' +
      '</section>' +

      '<div class="grid-4">' +
        '<div class="mini-stat"><small>Bu ay gider</small><b>' + NS.fmtMoney(monthTotal, 0) + '</b><span>' + (prevTotal ? (monthTotal >= prevTotal ? '+' : '') + NS.fmtNum(NS.pct(monthTotal, prevTotal), 0) + '% geçen aya göre' : 'geçen ay kayıt yok') + '</span></div>' +
        '<div class="mini-stat"><small>Yakıt</small><b>' + NS.fmtNum(fuelLiters, 0) + ' <em>L</em></b><span>bu ay alınan motorin</span></div>' +
        '<div class="mini-stat"><small>Litre başı maliyet</small><b>' + (costPerLiter ? NS.fmtMoney(costPerLiter, 2) : '—') + '</b><span>' + NS.fmtNum(monthLiters, 0) + ' L süt üretimine karşı</span></div>' +
        '<div class="mini-stat"><small>Kritik evrak</small><b>' + db.vehicles.filter(function (v) { return NS.daysUntil(v.insuranceUntil) <= 45 || NS.daysUntil(v.inspectionUntil) <= 45; }).length + '</b><span>45 gün içinde sigorta/muayene</span></div>' +
      '</div>' +

      '<section class="vehicle-grid">' + vehicleCards + '</section>' +

      '<div class="grid-main">' +
        '<section class="card">' +
          '<div class="card-head"><div><h3>Masraf trendi</h3><p>Son 6 ay · toplam gider</p></div><span class="badge primary">' + NS.fmtMoney(monthTotal, 0) + '</span></div>' +
          '<div class="card-body"><div id="fleetTrend"></div></div>' +
        '</section>' +
        '<section class="card">' +
          '<div class="card-head"><div><h3>Masraf dağılımı</h3><p>' + NS.esc(NS.capitalize(NS.monthLabel(ym))) + '</p></div></div>' +
          '<div class="card-body">' +
            '<div class="donut-box"><div class="donut-chart" id="fleetDonut"></div>' +
              '<div class="legend" style="flex:1">' + categories.map(function (c) {
                return '<div class="legend-row"><i style="background:' + c.color + '"></i><span>' + NS.esc(c.label) + '</span><b>' + NS.fmtMoney(c.value, 0) + '</b></div>';
              }).join('') + '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +
      '</div>' +

      '<section class="card">' +
        '<div class="card-head card-head-rule row between">' +
          '<div><h3>Masraf defteri</h3><p>Yakıt, bakım, temizlik ve diğerleri</p></div>' +
          '<div class="row gap-6">' +
            '<select class="select" style="height:33px;font-size:11.5px;width:auto" data-filter="fleet-type"><option value="all">Tüm türler</option>' + MP.EXPENSE_TYPES.map(function (t) {
              return '<option value="' + t.key + '"' + (f.type === t.key ? ' selected' : '') + '>' + t.key + '</option>';
            }).join('') + '</select>' +
            '<select class="select" style="height:33px;font-size:11.5px;width:auto" data-filter="fleet-vehicle"><option value="">Tüm araçlar</option>' + db.vehicles.map(function (v) {
              return '<option value="' + v.id + '"' + (f.vehicle === v.id ? ' selected' : '') + '>' + NS.esc(v.plate) + '</option>';
            }).join('') + '</select>' +
          '</div>' +
        '</div>' +
        '<div class="card-body" style="padding-top:12px">' +
          '<div class="toolbar mb-10"><div class="toolbar-search">' + NS.icon('search') + '<input class="input" type="text" placeholder="Tedarikçi, not veya plaka ara…" value="' + NS.esc(f.q) + '" data-filter="fleet-q"></div>' +
            '<span class="small faint">' + list.length + ' kayıt · ' + NS.fmtMoney(total, 0) + '</span></div>' +
          '<div class="table-wrap"><table class="table table-wide"><thead><tr><th>Tarih</th><th>Tür</th><th>Araç / tank</th><th>Açıklama</th><th class="num">Miktar</th><th class="num">Tutar</th><th></th></tr></thead>' +
            '<tbody>' + (rows || '<tr><td colspan="7">' + NS.emptyState('wallet', 'Masraf yok', 'Yeni masraf girerek filo maliyetini takip edin.') + '</td></tr>') + '</tbody>' +
          '</table></div>' +
        '</div>' +
      '</section>' +

    '</div>';
  };

  NS.hooks.fleet = function () {
    const d = NS._fleet;
    if (!d) return;
    NS.donut(NS.$('#fleetDonut'), d.categories, {
      centerValue: NS.fmtCompact(d.monthTotal),
      centerLabel: '₺ bu ay'
    });
    NS.barChart(NS.$('#fleetTrend'), d.trend, {
      unit: '₺', height: 230, color: 'var(--accent)', aria: 'Son 6 ay masraf trendi'
    });
  };

  NS.exportFleet = function () {
    const list = NS.filteredExpenses();
    const rows = [['Tarih', 'Tür', 'Araç', 'Plaka', 'Tedarikçi', 'Açıklama', 'Litre', 'KM', 'Tutar', 'Fatura No']];
    list.forEach(function (e) {
      const v = NS.vehicleById(e.vehicleId);
      const t = e.tankId ? NS.tankById(e.tankId) : null;
      rows.push([e.date, e.type, v ? v.brand + ' ' + v.model : t ? t.name : '', v ? v.plate : '', e.vendor || '', e.note || '', e.liters || '', e.km || '', e.amount, e.invoiceNo || '']);
    });
    NS.exportXLSX('mandirapro-filo-masraf-' + NS.todayISO() + '.xlsx', [{ name: 'Masraflar', rows: rows, widths: [12, 14, 22, 14, 20, 34, 9, 10, 12, 14] }]);
  };

})(window.MPApp);
