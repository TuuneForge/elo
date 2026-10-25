/* ============================================================
   MandıraPro 2.0 — Tank & Sevkiyat
   ============================================================ */
(function (NS) {
  'use strict';

  NS.hooks = NS.hooks || {};

  NS.renderTank = function () {
    const db = NS.state.db;
    const today = NS.todayISO();
    const total = NS.tankTotal();
    const dispatches = db.dispatches.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    const todayDispatches = dispatches.filter(function (d) { return d.date === today; });
    const todayIn = NS.sumLiters(NS.recordsOn(today).filter(function (r) { return NS.canSeeProducer(r.producerId); }));
    const todayOut = NS.sum(todayDispatches.map(function (d) { return d.liters; }));
    const lastDispatch = dispatches[0];
    const avgTemp = db.tanks.length ? NS.sum(db.tanks.map(function (t) { return t.temperature; })) / db.tanks.length : 0;

    const tankCards = db.tanks.map(function (t) {
      const pct = NS.tankPct(t);
      const cleanedDays = t.lastCleanedAt ? NS.daysBetween(t.lastCleanedAt, today) : null;
      const status = pct >= 95 ? ['danger', 'doluluk sınırı'] : pct >= 82 ? ['warn', 'sevkiyat zamanı'] : ['success', 'uygun'];
      return '<article class="tank-card">' +
        '<div class="tank-card-head">' +
          '<div><h3>' + NS.esc(t.name) + '</h3><p>' + NS.esc(t.milkType) + ' · ' + NS.esc(t.code) + '</p></div>' +
          '<span class="badge ' + status[0] + '">' + status[1] + '</span>' +
        '</div>' +
        '<div class="tank-panel">' +
          '<div class="tank-visual" data-tank="' + t.id + '" style="--fill:0%">' +
            '<div class="tank-fill"></div>' +
            '<div class="tank-level"><b>' + Math.round(pct) + '%</b><small>doluluk</small></div>' +
          '</div>' +
          '<div class="tank-meta">' +
            '<div class="tank-numbers"><b>' + NS.fmtNum(t.current, 0) + '</b><span>/ ' + NS.fmtNum(t.capacity, 0) + ' litre</span></div>' +
            '<div class="tank-details">' +
              '<div><small>Sıcaklık</small><b>' + NS.fmtNum(t.temperature, 1) + ' °C</b></div>' +
              '<div><small>Boş hacim</small><b>' + NS.fmtNum(t.capacity - t.current, 0) + ' L</b></div>' +
              '<div><small>Son temizlik</small><b>' + (cleanedDays === null ? '—' : cleanedDays + ' gün önce') + '</b></div>' +
            '</div>' +
            '<div class="tank-meter">' + Array.from({ length: 14 }).map(function (_, i) {
              return '<i class="' + (i < Math.round(pct / 100 * 14) ? (pct > 85 ? 'warn' : 'on') : '') + '"></i>';
            }).join('') + '</div>' +
            '<div class="tank-chip-row">' +
              NS.dotBadge(t.temperature <= 4.5 ? 'soğuk zincir uygun' : 'sıcaklık takip', t.temperature <= 4.5 ? 'live' : 'warn') +
              (cleanedDays !== null && cleanedDays > 7 ? '<span class="badge warn">temizlik gecikti</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="tank-card-actions">' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="tank-measure" data-id="' + t.id + '">' + NS.icon('scale') + ' Ölçüm gir</button>' +
          '<button class="btn btn-soft btn-sm" type="button" data-action="tank-dispatch" data-id="' + t.id + '">' + NS.icon('truck') + ' Sevkiyat</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-action="tank-clean" data-id="' + t.id + '">' + NS.icon('spray') + ' Temizlik</button>' +
        '</div>' +
        (t.note ? '<p class="tiny faint" style="margin-top:8px">' + NS.esc(t.note) + '</p>' : '') +
      '</article>';
    }).join('');

    const dispatchRows = dispatches.slice(0, 14).map(function (d) {
      const t = NS.tankById(d.tankId);
      return '<tr>' +
        '<td><b style="font-weight:600">' + NS.fmtDate(d.date) + '</b><div class="cell-sub">' + NS.esc(d.createdAt ? NS.clockTR(d.createdAt) : '') + '</div></td>' +
        '<td>' + NS.esc(t ? t.name : '—') + '</td>' +
        '<td class="num"><b>' + NS.fmtNum(d.liters, 0) + '</b> L</td>' +
        '<td>' + NS.fmtNum(d.temperature, 1) + ' °C</td>' +
        '<td>' + NS.esc(d.destination) + '<div class="cell-sub">' + NS.esc(d.driver || '') + '</div></td>' +
        '<td><span class="code-tag">' + NS.esc(d.plate || '—') + '</span></td>' +
        '<td><div class="row-actions"><button class="icon-btn sm" type="button" data-action="dispatch-delete" data-id="' + d.id + '" title="Sil">' + NS.icon('trash') + '</button></div></td>' +
      '</tr>';
    }).join('');

    const days = [];
    for (let i = 13; i >= 0; i--) days.push(NS.isoOffset(-i));
    const incoming = days.map(function (d) { return NS.sumLiters(NS.recordsOn(d).filter(function (r) { return NS.canSeeProducer(r.producerId); })); });
    const outgoing = days.map(function (d) {
      return NS.sum(db.dispatches.filter(function (x) { return x.date === d; }).map(function (x) { return x.liters; }));
    });
    NS._tank = { days: days, incoming: incoming, outgoing: outgoing };

    return '<div class="page stagger">' +

      '<section class="page-head">' +
        '<div class="ph-left">' +
          '<div class="page-kicker">' + NS.icon('tank') + ' soğuk zincir</div>' +
          '<h1>Tank &amp; sevkiyat</h1>' +
          '<p>Tanklarda <b>' + NS.fmtNum(total.current, 0) + ' litre</b> süt var; toplam kapasite ' + NS.fmtNum(total.capacity, 0) + ' litre. Bugün <b>' + NS.fmtNum(todayIn, 0) + ' L</b> giriş, <b>' + NS.fmtNum(todayOut, 0) + ' L</b> sevkiyat.</p>' +
        '</div>' +
        '<div class="ph-actions">' +
          '<button class="btn btn-ghost" type="button" data-action="tank-measure">' + NS.icon('scale') + ' Ölçüm</button>' +
          '<button class="btn btn-ghost" type="button" data-action="tank-clean">' + NS.icon('spray') + ' Temizlik kaydı</button>' +
          '<button class="btn btn-primary" type="button" data-action="tank-dispatch">' + NS.icon('truck') + ' Sevkiyat oluştur</button>' +
        '</div>' +
      '</section>' +

      '<div class="grid-4">' +
        '<div class="mini-stat"><small>Toplam doluluk</small><b>%' + Math.round(total.pct) + '</b><span>' + NS.fmtNum(total.current, 0) + ' / ' + NS.fmtNum(total.capacity, 0) + ' L</span></div>' +
        '<div class="mini-stat"><small>Ortalama sıcaklık</small><b>' + NS.fmtNum(avgTemp, 1) + ' <em>°C</em></b><span>hedef 4 °C altı</span></div>' +
        '<div class="mini-stat"><small>Bugünkü giriş</small><b>' + NS.fmtNum(todayIn, 0) + ' <em>L</em></b><span>' + NS.recordsOn(today).length + ' süt kaydı</span></div>' +
        '<div class="mini-stat"><small>Son sevkiyat</small><b>' + (lastDispatch ? NS.fmtDateShort(lastDispatch.date) : '—') + '</b><span>' + (lastDispatch ? NS.fmtNum(lastDispatch.liters, 0) + ' L · ' + NS.esc(lastDispatch.destination) : 'kayıt yok') + '</span></div>' +
      '</div>' +

      '<div class="grid-2-eq">' + tankCards + '</div>' +

      '<div class="grid-main">' +
        '<section class="card">' +
          '<div class="card-head"><div><h3>Günlük süt girişi</h3><p>Son 14 gün · litre</p></div><span class="badge primary">' + NS.fmtNum(NS.sum(incoming), 0) + ' L</span></div>' +
          '<div class="card-body"><div id="tankTrend"></div></div>' +
        '</section>' +
        '<section class="card">' +
          '<div class="card-head"><div><h3>Sevkiyat hareketi</h3><p>Son 14 gün · litre</p></div><a class="card-link" href="#" data-action="tank-dispatch">Yeni sevkiyat ' + NS.icon('chevron-right') + '</a></div>' +
          '<div class="card-body">' +
            '<div class="stack gap-10">' + db.tanks.map(function (t) {
              const out = NS.sum(db.dispatches.filter(function (d) { return d.tankId === t.id; }).map(function (d) { return d.liters; }));
              return '<div class="stat-row"><span>' + NS.esc(t.name) + '</span><b>' + NS.fmtNum(out, 0) + ' L sevk</b></div>';
            }).join('') +
            '<div class="stat-row"><span>Bugün sevk edilen</span><b>' + NS.fmtNum(todayOut, 0) + ' L</b></div>' +
            '<div class="stat-row"><span>Toplam sevkiyat kaydı</span><b>' + dispatches.length + '</b></div>' +
            '</div>' +
            '<div class="inline-note mt-12">' + NS.icon('info') + '<span>Sevkiyat girildiğinde tanktaki litre otomatik düşer. Temizlik kaydı son temizlik tarihini günceller.</span></div>' +
          '</div>' +
        '</section>' +
      '</div>' +

      '<section class="card">' +
        '<div class="card-head"><div><h3>Sevkiyat geçmişi</h3><p>Son 14 kayıt</p></div><span class="badge">' + dispatches.length + ' kayıt</span></div>' +
        '<div class="card-body" style="padding-top:10px">' +
          '<div class="table-wrap"><table class="table"><thead><tr><th>Tarih</th><th>Tank</th><th class="num">Litre</th><th>Sıcaklık</th><th>Alıcı</th><th>Plaka</th><th></th></tr></thead>' +
          '<tbody>' + (dispatchRows || '<tr><td colspan="7">' + NS.emptyState('truck', 'Sevkiyat yok', 'İlk sevkiyatı oluşturduğunuzda burada görünür.') + '</td></tr>') + '</tbody></table></div>' +
        '</div>' +
      '</section>' +

    '</div>';
  };

  NS.hooks.tank = function () {
    const d = NS._tank;
    if (d) {
      NS.areaChart(NS.$('#tankTrend'), d.days.map(function (day, i) {
        return { label: NS.fmtDateShort(day), value: d.incoming[i] };
      }), { unit: 'L', height: 230, aria: 'Günlük süt girişi', valueFmt: function (v) { return NS.fmtNum(v, 1) + ' litre'; } });
    }
    NS.$$('[data-tank]').forEach(function (el) {
      const id = el.dataset.tank;
      const t = NS.tankById(id);
      if (!t) return;
      const pct = NS.tankPct(t);
      requestAnimationFrame(function () { el.style.setProperty('--fill', pct + '%'); });
    });
  };

})(window.MPApp);
