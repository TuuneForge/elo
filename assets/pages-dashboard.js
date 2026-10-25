/* ============================================================
   MandıraPro 2.0 — Genel Bakış
   ============================================================ */
(function (NS) {
  'use strict';

  NS.hooks = NS.hooks || {};

  NS.renderDashboard = function () {
    const db = NS.state.db;
    const today = NS.todayISO();
    const yesterday = NS.isoOffset(-1);
    const ym = today.slice(0, 7);
    const prevYm = NS.prevMonth(ym);
    const dayN = Number(today.slice(8, 10));
    const prevEnd = prevYm + '-' + NS.pad(Math.min(dayN, NS.daysInMonth(prevYm)));

    const todayRecs = NS.recordsOn(today);
    const yRecs = NS.recordsOn(yesterday);
    const monthRecs = NS.monthRecords(ym);
    const prevRecs = NS.recordsIn(prevYm + '-01', prevEnd);
    const todayLiters = NS.sumLiters(todayRecs);
    const yLiters = NS.sumLiters(yRecs);
    const monthLiters = NS.sumLiters(monthRecs);
    const monthAmount = NS.sumAmount(monthRecs);
    const todayAmount = NS.sumAmount(todayRecs);
    const yAmount = NS.sumAmount(yRecs);
    const tank = NS.tankTotal();
    const tankMain = db.tanks[0];
    const avgScore = NS.avgQuality(monthRecs);
    const grades = NS.gradeCounts(monthRecs);

    const routeStats = NS.visibleCollectors().map(function (c) {
      return { collector: c, stat: NS.routeStats(c.id, today, 'Sabah') };
    });
    const totalStops = NS.sum(routeStats.map(function (x) { return x.stat.total; }));
    const totalDone = NS.sum(routeStats.map(function (x) { return x.stat.done; }));
    const totalPending = totalStops - totalDone;

    const days = NS.last14 = (function () {
      const arr = [];
      for (let i = 13; i >= 0; i--) arr.push(NS.isoOffset(-i));
      return arr;
    })();
    const series = days.map(function (d) { return NS.sumLiters(NS.recordsOn(d)); });

    const top = NS.visibleProducers().map(function (p) {
      const recs = monthRecs.filter(function (r) { return r.producerId === p.id; });
      return { producer: p, liters: NS.sumLiters(recs), quality: NS.avgQuality(recs), amount: NS.sumAmount(recs) };
    }).filter(function (x) { return x.liters > 0; }).sort(function (a, b) { return b.liters - a.liters; }).slice(0, 5);

    const alerts = NS.alerts();
    const activity = NS.activity(8);
    const eventsHTML = activity.map(function (e) {
      const tone = e.tone === 'quality' ? 'quality' : e.tone === 'danger' ? 'danger' : e.tone === 'money' ? 'money' : e.tone === 'order' ? 'order' : e.tone === 'done' ? 'done' : 'milk';
      return '<div class="activity-row">' +
        '<span class="activity-ico act-' + tone + '">' + NS.icon(e.icon) + '</span>' +
        '<div class="activity-main"><b>' + NS.esc(e.title) + '</b><small>' + NS.esc(e.sub) + '</small></div>' +
        '<span class="activity-time">' + NS.esc(NS.relTime(e.at)) + '</span>' +
      '</div>';
    }).join('') || NS.emptyState('activity', 'Henüz hareket yok', 'Saha kayıtları girdikçe burada canlanır.');

    const topHTML = top.map(function (x, i) {
      const pct = Math.max(4, x.liters / top[0].liters * 100);
      return '<div class="top-item">' +
        '<span class="top-rank">' + String(i + 1).padStart(2, '0') + '</span>' +
        '<div class="top-main">' +
          '<div class="top-name"><span>' + NS.esc(x.producer.name) + '</span><em>' + NS.fmtNum(x.liters, 0) + ' L</em></div>' +
          '<div class="bar-track"><div class="bar-fill" data-w="' + pct.toFixed(1) + '"></div></div>' +
        '</div>' +
        '<span class="badge ' + NS.qualityTone(x.producer && (x.quality ? (x.quality >= 82 ? 'A' : x.quality >= 65 ? 'B' : 'C') : null)) + '" style="font-size:9px">' + (x.quality ? x.quality.toFixed(0) : '—') + '</span>' +
      '</div>';
    }).join('') || NS.emptyState('users', 'Bu ay veri yok', 'Kayıtlar başladığında sıralama oluşur.');

    const tankRows = db.tanks.map(function (t) {
      const pct = NS.tankPct(t);
      return '<div class="tank-line">' +
        '<div class="tank-line-head"><span>' + NS.esc(t.name) + '</span><b>' + NS.fmtNum(t.current, 0) + ' / ' + NS.fmtNum(t.capacity, 0) + ' L</b></div>' +
        '<div class="bar-track"><div class="bar-fill" data-w="' + pct.toFixed(1) + '"></div></div>' +
        '<div class="tank-line-foot"><span>' + NS.fmtNum(t.temperature, 1) + ' °C · ' + NS.esc(t.milkType) + '</span><span>' + Math.round(pct) + '%</span></div>' +
      '</div>';
    }).join('');

    const alertsHTML = alerts.length ? alerts.slice(0, 5).map(function (a) {
      return '<button type="button" class="alert-item" data-action="goto" data-view="' + a.view + '">' +
        '<span class="alert-ico ' + a.tone + '">' + NS.icon(a.icon) + '</span>' +
        '<span class="alert-main"><b>' + NS.esc(a.title) + '</b><span>' + NS.esc(a.text) + '</span></span>' +
      '</button>';
    }).join('') : '<div class="alert-empty">Bekleyen kritik uyarı yok. Operasyon akıyor.</div>';

    const collectorHTML = routeStats.map(function (x) {
      const s = x.stat;
      const next = s.stops.find(function (z) { return !z.record; });
      return '<div class="collector-line">' +
        '<div class="cl-top">' +
          '<span class="cl-av" style="background:' + x.collector.color + '">' + NS.esc(NS.initials(x.collector.name)) + '</span>' +
          '<span class="cl-name"><b>' + NS.esc(x.collector.name) + '</b><small>' + NS.esc(x.collector.route) + ' · ' + s.done + '/' + s.total + ' durak</small></span>' +
          '<span class="cl-lit">' + NS.fmtNum(s.liters, 0) + '<small> L</small></span>' +
        '</div>' +
        '<div class="bar-track"><div class="bar-fill" data-w="' + s.pct + '%"></div></div>' +
        '<div class="cl-foot"><span>' + (next ? 'Sırada: ' + NS.esc(next.producer.name) : 'Rota tamamlandı') + '</span><span>' + s.pct + '%</span></div>' +
      '</div>';
    }).join('');

    const greeting = NS.greeting();
    const firstName = String((NS.state.me && NS.state.me.name) || '').split(' ')[0];
    const yesterdayTrend = NS.pct(todayLiters, yLiters);
    const amountTrend = NS.pct(todayAmount, yAmount);
    const tankPct = Math.round(tank.pct);

    NS._dash = { series: series, days: days, grades: grades, avgScore: avgScore };

    return '<div class="page stagger">' +

      '<section class="page-head">' +
        '<div class="ph-left">' +
          '<div class="page-kicker">' + NS.icon('activity') + ' canlı operasyon · ' + NS.fmtDate(today) + '</div>' +
          '<h1>' + NS.esc(greeting) + ', ' + NS.esc(firstName) + '.</h1>' +
          '<p>Bugün <b>' + NS.fmtNum(todayLiters, 1) + ' litre</b> süt alındı; <b>' + totalPending + ' durak</b> yolda. ' +
          'Tanklar %' + tankPct + ' dolu, bu ayın ortalama kalite skoru <b>' + (avgScore ? NS.fmtNum(avgScore, 1) : '—') + '</b>.</p>' +
        '</div>' +
        '<div class="ph-actions">' +
          '<button class="btn btn-ghost" type="button" data-action="print-route-sheet">' + NS.icon('printer') + ' Günlük liste</button>' +
          '<button class="btn btn-ghost" type="button" data-action="nav" data-view="route">' + NS.icon('route') + ' Süt rotası</button>' +
          '<button class="btn btn-primary" type="button" data-action="new-record">' + NS.icon('plus') + ' Yeni kayıt</button>' +
        '</div>' +
      '</section>' +

      '<section class="ops-strip">' +
        '<div class="ops-cell"><small>Rota durumu</small><b>' + totalDone + ' / ' + totalStops + ' durak tamam</b><span class="live-badge live"><i class="dot"></i>saha aktif</span></div>' +
        '<div class="ops-cell"><small>Toplam tank</small><b>' + NS.fmtNum(tank.current, 0) + ' / ' + NS.fmtNum(tank.capacity, 0) + ' L</b><span class="live-badge"><i class="dot"></i>%' + tankPct + ' dolu</span></div>' +
        '<div class="ops-cell"><small>Kalite ortalaması</small><b>' + (avgScore ? NS.fmtNum(avgScore, 1) + ' / 100' : '—') + '</b><span class="live-badge"><i class="dot"></i>' + (grades.A + grades.B + grades.C) + ' numune</span></div>' +
        '<div class="ops-cell"><small>Son numune</small><b>' + (db.samples.length ? NS.esc(db.samples[db.samples.length - 1].code) : '—') + '</b><span class="live-badge"><i class="dot"></i>' + (db.samples.length ? db.samples[db.samples.length - 1].status : 'kayıt yok') + '</span></div>' +
      '</section>' +

      '<div class="grid-kpi">' +
        NS.kpiCard({ tone: 'teal', icon: 'drop', value: todayLiters, digits: 1, unit: 'L', label: 'Bugün toplanan süt', trend: yesterdayTrend, spark: series }) +
        NS.kpiCard({ tone: 'blue', icon: 'tank', value: tank.current, digits: 0, unit: 'L', label: 'Tankta bekleyen süt', badge: '%' + tankPct + ' doluluk', badgeTone: tankPct > 85 ? 'warn' : 'info', spark: series, sparkColor: 'var(--info)' }) +
        NS.kpiCard({ tone: 'green', icon: 'wallet', value: todayAmount, digits: 0, unit: '₺', label: 'Bugünkü üretici hakedişi', trend: amountTrend, spark: series.map(function (v) { return v * 16.5; }), sparkColor: 'var(--success)' }) +
        NS.kpiCard({ tone: 'amber', icon: 'route', value: totalPending, digits: 0, unit: 'durak', label: 'Bekleyen saha durağı', badge: routeStats.length + ' aktif rota', badgeTone: 'warn', spark: series.slice(-10), sparkColor: 'var(--accent)' }) +
      '</div>' +

      '<div class="grid-main">' +
        '<section class="card">' +
          '<div class="card-head">' +
            '<div><h3>Son 14 günde süt toplama</h3><p>Günlük litre · tüm rotalar</p></div>' +
            '<div class="row gap-10"><span class="badge primary">' + NS.fmtNum(NS.sum(series), 0) + ' L toplam</span><span class="badge">ort. ' + NS.fmtNum(NS.sum(series) / series.length, 0) + ' L</span></div>' +
          '</div>' +
          '<div class="card-body"><div id="milkTrend"></div></div>' +
        '</section>' +

        '<section class="card">' +
          '<div class="card-head"><div><h3>Tank durumu</h3><p>Anlık soğutma hattı</p></div><a class="card-link" href="#" data-action="nav" data-view="tank">Detay ' + NS.icon('chevron-right') + '</a></div>' +
          '<div class="card-body">' +
            '<div class="tank-panel">' +
              '<div class="tank-visual" id="tankVisual" style="--fill:0%">' +
                '<div class="tank-fill"></div>' +
                '<div class="tank-level"><b id="tankPctLabel">0%</b><small>doluluk</small></div>' +
              '</div>' +
              '<div class="tank-meta">' +
                '<h3>' + NS.esc(tankMain ? tankMain.name : 'Tank') + '</h3>' +
                '<div class="tank-numbers"><b>' + NS.fmtNum(tankMain ? tankMain.current : 0, 0) + '</b><span>/ ' + NS.fmtNum(tankMain ? tankMain.capacity : 0, 0) + ' litre</span></div>' +
                '<div class="tank-details">' +
                  '<div><small>Sıcaklık</small><b>' + NS.fmtNum(tankMain ? tankMain.temperature : 0, 1) + ' °C</b></div>' +
                  '<div><small>Son temizlik</small><b>' + NS.fmtDateShort(tankMain ? tankMain.lastCleanedAt : '') + '</b></div>' +
                  '<div><small>Son sevkiyat</small><b>' + NS.fmtDateShort(tankMain ? tankMain.lastDispatchAt : '') + '</b></div>' +
                '</div>' +
                '<div class="tank-meter">' + Array.from({ length: 12 }).map(function (_, i) { return '<i class="' + (i < Math.round(tankPct / 100 * 12) ? (tankPct > 85 ? 'warn' : 'on') : '') + '"></i>'; }).join('') + '</div>' +
                '<div class="tank-chip-row">' + NS.dotBadge(tankPct > 85 ? 'sevkiyat önerilir' : 'soğuk zincir uygun', tankPct > 85 ? 'warn' : 'live') + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="stack gap-10 mt-16">' + tankRows + '</div>' +
          '</div>' +
        '</section>' +
      '</div>' +

      '<div class="grid-3">' +
        '<section class="card">' +
          '<div class="card-head"><div><h3>Rota canlı akışı</h3><p>Günlük rota · ' + totalDone + '/' + totalStops + ' durak</p></div><span class="live-badge live"><i class="dot"></i>canlı</span></div>' +
          '<div class="card-body"><div class="collector-list">' + (collectorHTML || NS.emptyState('route', 'Rota yok', 'Sütçü ve rota tanımlayın.')) + '</div></div>' +
        '</section>' +

        '<section class="card">' +
          '<div class="card-head"><div><h3>Kalite dağılımı</h3><p>' + NS.esc(NS.capitalize(NS.monthLabel(ym))) + '</p></div><a class="card-link" href="#" data-action="nav" data-view="quality">Laboratuvar ' + NS.icon('chevron-right') + '</a></div>' +
          '<div class="card-body">' +
            '<div class="donut-box">' +
              '<div class="donut-chart" id="qualityDonut"></div>' +
              '<div class="legend" style="flex:1">' +
                '<div class="legend-row"><i style="background:var(--success)"></i><span>A sınıfı</span><b>' + grades.A + '</b></div>' +
                '<div class="legend-row"><i style="background:var(--info)"></i><span>B sınıfı</span><b>' + grades.B + '</b></div>' +
                '<div class="legend-row"><i style="background:var(--danger)"></i><span>C sınıfı</span><b>' + grades.C + '</b></div>' +
                '<div class="legend-row" style="border-top:1px dashed var(--border);padding-top:7px;margin-top:2px"><i style="background:var(--border-strong)"></i><span>Numune bekleyen</span><b>' + grades['-'] + '</b></div>' +
              '</div>' +
            '</div>' +
            '<div class="inline-note mt-12">' + NS.icon('flask') + '<span>A sınıfı süt, fiyat listesindeki kalite primiyle tediye edilir.</span></div>' +
          '</div>' +
        '</section>' +

        '<section class="card">' +
          '<div class="card-head"><div><h3>Akıllı uyarılar</h3><p>Bugün dikkat isteyenler</p></div><span class="badge ' + (alerts.length ? 'warn' : 'success') + '">' + alerts.length + '</span></div>' +
          '<div class="alerts-mini">' + alertsHTML + '</div>' +
        '</section>' +
      '</div>' +

      '<div class="grid-2-eq">' +
        '<section class="card">' +
          '<div class="card-head"><div><h3>Son hareketler</h3><p>Saha, laboratuvar ve ticaret</p></div><a class="card-link" href="#" data-action="nav" data-view="records">Kayıtlar ' + NS.icon('chevron-right') + '</a></div>' +
          '<div class="card-body"><div class="activity">' + eventsHTML + '</div></div>' +
        '</section>' +

        '<section class="card">' +
          '<div class="card-head"><div><h3>Ayın üreticileri</h3><p>Toplanan litreye göre ilk beş</p></div><a class="card-link" href="#" data-action="nav" data-view="producers">Tümü ' + NS.icon('chevron-right') + '</a></div>' +
          '<div class="card-body"><div class="top-list">' + topHTML + '</div></div>' +
        '</section>' +
      '</div>' +

    '</div>';
  };

  NS.hooks.dashboard = function () {
    const d = NS._dash;
    if (!d) return;

    NS.areaChart(NS.$('#milkTrend'), d.series.map(function (v, i) {
      return { label: NS.fmtDateShort(d.days[i]), value: v };
    }), {
      unit: 'L', height: 236,
      aria: 'Son 14 gün süt toplama grafiği',
      valueFmt: function (v) { return NS.fmtNum(v, 1) + ' litre'; }
    });

    const totalGrades = d.grades.A + d.grades.B + d.grades.C;
    NS.donut(NS.$('#qualityDonut'), [
      { label: 'A sınıfı', value: d.grades.A, color: 'var(--success)' },
      { label: 'B sınıfı', value: d.grades.B, color: 'var(--info)' },
      { label: 'C sınıfı', value: d.grades.C, color: 'var(--danger)' }
    ], {
      centerValue: d.avgScore ? NS.fmtNum(d.avgScore, 0) : '—',
      centerLabel: totalGrades ? 'ortalama puan' : 'numune yok'
    });

    const tank = NS.tankTotal();
    const pct = Math.round(tank.pct);
    const visual = NS.$('#tankVisual');
    if (visual) {
      requestAnimationFrame(function () { visual.style.setProperty('--fill', pct + '%'); });
    }
    const lbl = NS.$('#tankPctLabel');
    if (lbl) NS.countUp(lbl, pct, { digits: 0 });

    requestAnimationFrame(function () {
      NS.$$('[data-w]').forEach(function (el, i) {
        setTimeout(function () { el.style.width = el.dataset.w + '%'; }, 60 + i * 55);
      });
    });
  };

})(window.MPApp);
