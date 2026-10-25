/* ============================================================
   MandıraPro 2.0 — Süt Rotası (saha)
   ============================================================ */
(function (NS) {
  'use strict';

  NS.hooks = NS.hooks || {};

  NS.routeCtx = function () {
    const db = NS.state.db;
    if (!NS.state.routeFilter) NS.state.routeFilter = {};
    const f = NS.state.routeFilter;
    const fallbackCollector = NS.isCollector()
      ? NS.state.me.collectorId
      : (db.collectors[0] ? db.collectors[0].id : '');
    if (!f.collectorId || (!NS.isCollector() && !NS.collectorById(f.collectorId))) f.collectorId = fallbackCollector;
    if (NS.isCollector()) f.collectorId = NS.state.me.collectorId;
    if (!f.date) f.date = NS.todayISO();
    f.session = 'Sabah';
    return f;
  };

  NS.renderRoute = function () {
    const db = NS.state.db;
    const ctx = NS.routeCtx();
    const collector = NS.collectorById(ctx.collectorId);
    const stat = NS.routeStats(ctx.collectorId, ctx.date, ctx.session);
    const tank = NS.tankTotal();
    const isToday = ctx.date === NS.todayISO();
    const nextStop = stat.stops.find(function (s) { return !s.record; });
    const lastRecord = stat.stops.filter(function (s) { return s.record; }).slice(-1)[0];

    const stopHTML = stat.stops.map(function (s, i) {
      const p = s.producer;
      const done = !!s.record;
      const rec = s.record;
      const grade = rec && rec.quality ? rec.quality.grade : null;
      const extra = !!s.extra;
      const liters = rec ? Number(rec.liters || rec.milk) : 0;
      return '<div class="route-stop' + (done ? ' done' : ' is-pending') + (extra ? ' extra' : '') + '">' +
        '<span class="route-seq">' + (done ? NS.icon('check') : (i + 1)) + '</span>' +
        '<div class="route-main">' +
          '<b>' + NS.esc(p.name) + (extra ? ' <span class="badge warn" style="font-size:9px">İlave durak</span>' : '') + (done ? ' <span class="badge success" style="font-size:9px">Alındı</span>' : '') + '</b>' +
          '<small>' + NS.esc(p.code) + ' · ' + NS.esc(p.village) + ' · ' + p.animalCount + ' hayvan' + (done ? ' · ' + NS.esc(NS.clockTR(rec.createdAt)) : '') + '</small>' +
          '<div class="route-lit">' + (done
            ? 'Beklenen ' + NS.fmtNum(s.expected.avg, 0) + ' L · alınan ' + NS.fmtNum(liters, 1) + ' L'
            : 'Beklenen aralık ' + NS.fmtNum(s.expected.min, 0) + '–' + NS.fmtNum(s.expected.max, 0) + ' L · ortalama ' + NS.fmtNum(s.expected.avg, 0) + ' L') + '</div>' +
        '</div>' +
        '<div class="route-amount">' +
          (done
            ? '<b>' + NS.fmtNum(liters, 1) + ' L</b><small>' + (rec.amount ? NS.fmtMoney(rec.amount, 0) : '—') + '</small>'
            : '<b class="faint">—</b><small>bekliyor</small>') +
        '</div>' +
        '<div class="route-actions">' +
          (done ? NS.qualityBadge(grade) : '') +
          (done
            ? '<button class="icon-btn sm" type="button" data-action="edit-record" data-id="' + rec.id + '" title="Kaydı düzenle">' + NS.icon('edit') + '</button>'
            : '<button class="btn btn-primary btn-sm" type="button" data-action="collect-stop" data-producer="' + p.id + '" data-date="' + ctx.date + '">' + NS.icon('plus') + ' Tartım</button>') +
        '</div>' +
      '</div>';
    }).join('');

    const tankBars = db.tanks.map(function (t) {
      const pct = NS.tankPct(t);
      return '<div class="tank-line">' +
        '<div class="tank-line-head"><span>' + NS.esc(t.name) + '</span><b>' + NS.fmtNum(t.current, 0) + ' L</b></div>' +
        '<div class="bar-track"><div class="bar-fill" data-w="' + pct.toFixed(1) + '"></div></div>' +
        '<div class="tank-line-foot"><span>' + NS.fmtNum(t.temperature, 1) + ' °C</span><span>%' + Math.round(pct) + '</span></div>' +
      '</div>';
    }).join('');

    const collectorOptions = NS.visibleCollectors().map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === ctx.collectorId ? ' selected' : '') + '>' + NS.esc(c.name + ' — ' + c.route) + '</option>';
    }).join('');

    const recentSamples = db.samples.filter(function (s) { return s.collectorId === ctx.collectorId; }).slice(-3).reverse();

    return '<div class="page stagger">' +

      '<section class="page-head">' +
        '<div class="ph-left">' +
          '<div class="page-kicker">' + NS.icon('route') + ' saha operasyonu' + (isToday ? ' · bugün' : '') + '</div>' +
          '<h1>' + NS.esc(collector ? collector.route : 'Süt rotası') + '</h1>' +
          '<p>' + NS.esc(collector ? collector.name : '') + ' · ' + NS.esc(collector ? collector.plate : '') + ' · ' + NS.esc(collector ? collector.shift : '') + '. ' +
          'Rotanın <b>' + stat.done + '/' + stat.total + '</b> durağı tamam; <b>' + NS.fmtNum(stat.liters, 1) + ' litre</b> toplandı.</p>' +
        '</div>' +
        '<div class="ph-actions">' +
          '<input class="input" type="date" style="width:auto" value="' + ctx.date + '" data-filter="route-date" aria-label="Rota tarihi">' +
          '<button class="btn btn-primary" type="button" data-action="scan-open">' + NS.icon('scan') + ' QR okut</button>' +
        '</div>' +
      '</section>' +

      '<section class="ops-strip">' +
        '<div class="ops-cell"><small>Sütçü / araç</small><b>' + NS.esc(collector ? collector.name : '—') + '</b><span class="tiny faint">' + NS.esc(collector ? collector.plate : '') + '</span></div>' +
        '<div class="ops-cell"><small>Rota durumu</small><b>' + stat.done + '/' + stat.total + ' durak</b><span class="live-badge live"><i class="dot"></i>' + (stat.pending ? stat.pending + ' durak kaldı' : 'tamamlandı') + '</span></div>' +
        '<div class="ops-cell"><small>Toplanan</small><b>' + NS.fmtNum(stat.liters, 1) + ' L</b><span class="tiny faint">beklenen ' + NS.fmtNum(stat.expected, 0) + ' L</span></div>' +
        '<div class="ops-cell"><small>Sıradaki durak</small><b>' + NS.esc(nextStop ? nextStop.producer.name : 'Rota tamamlandı') + '</b><span class="tiny faint">' + (nextStop ? nextStop.producer.village + ' · ~' + NS.fmtNum(nextStop.expected.avg, 0) + ' L' : 'Tüm üreticiler alındı') + '</span></div>' +
      '</section>' +

      '<div class="grid-main">' +
        '<section class="card">' +
          '<div class="card-head card-head-rule row between">' +
            '<div><h3>Durak listesi</h3><p>Sıra numarasına göre · ' + NS.fmtDate(ctx.date) + '</p></div>' +
            '<div class="row gap-6">' +
              (NS.isAdmin() ? '<select class="select" style="width:auto;height:33px;font-size:11.5px" data-filter="route-collector">' + collectorOptions + '</select>' : '') +
              '<button class="btn btn-ghost btn-sm" type="button" data-action="route-extra">' + NS.icon('plus') + ' Başka rotadan ekle</button>' +
            '</div>' +
          '</div>' +
          '<div class="card-body" style="padding-top:8px">' +
            '<div class="route-list">' + (stopHTML || NS.emptyState('route', 'Durak yok', 'Bu rota için üretici tanımlanmamış.')) + '</div>' +
          '</div>' +
          '<div class="card-foot-line">' +
            '<span>' + NS.icon('info') + ' İlave duraklar yalnızca seçilen rotaya eklenir; üreticinin kendi rotası değişmez.</span>' +
            '<button class="btn btn-ghost btn-sm" type="button" data-action="print-route-sheet">' + NS.icon('printer') + ' Günlük alım listesi</button>' +
          '</div>' +
        '</section>' +

        '<div class="stack">' +
          '<section class="scan-card">' +
            '<div class="sc-eyebrow">Numune eşleme</div>' +
            '<h3>QR ile üreticiyi bul.</h3>' +
            '<p>Numune şişesindeki kodu okutun; süt kaydı ve üretici otomatik eşleşir.</p>' +
            '<div class="scan-box"><span class="scan-line"></span>' + NS.icon('qr') + '</div>' +
            '<div class="scan-cta">' +
              '<button class="btn btn-primary btn-sm" type="button" data-action="scan-open">' + NS.icon('scan') + ' Kamerayı aç</button>' +
              '<button class="btn btn-ghost btn-sm" type="button" data-action="scan-open" data-manual="1">Kod gir</button>' +
            '</div>' +
          '</section>' +

          '<section class="card">' +
            '<div class="card-head"><div><h3>Tanklar</h3><p>Toplam %' + Math.round(tank.pct) + ' dolu</p></div><a class="card-link" href="#" data-action="nav" data-view="tank">Sevkiyat ' + NS.icon('chevron-right') + '</a></div>' +
            '<div class="card-body"><div class="stack gap-10">' + tankBars + '</div>' +
              '<div class="inline-note mt-12">' + NS.icon('thermometer') + '<span>Soğuk zincir 4 °C altında tutulmalı. Sevkiyat sonrası tank temizliği kaydı girin.</span></div>' +
            '</div>' +
          '</section>' +

          '<section class="card">' +
            '<div class="card-head"><div><h3>Sahada yeni üretici</h3><p>Kaydı beklemeden sisteme ekleyin</p></div></div>' +
            '<div class="card-body">' +
              '<p class="small muted" style="line-height:1.55">Üretici kartındaki QR etiketiyle birlikte oluşturulur; sütçü, sıra ve fiyat listesi anında atanır.</p>' +
              '<button class="btn btn-soft w-full mt-12" type="button" data-action="new-producer">' + NS.icon('plus') + ' Üretici ekle</button>' +
            '</div>' +
          '</section>' +

          (recentSamples.length ? '<section class="card card-tight">' +
            '<div class="card-head"><div><h3>Son numuneler</h3><p>Bu rotaya ait</p></div><a class="card-link" href="#" data-action="nav" data-view="quality">Tümü ' + NS.icon('chevron-right') + '</a></div>' +
            '<div class="card-body"><div class="stack gap-8">' + recentSamples.map(function (s) {
              const p = NS.producerById(s.producerId);
              return '<div class="row between" style="font-size:11.5px"><span>' + NS.esc(p ? p.name : '') + ' <span class="code-tag">' + NS.esc(s.code.slice(-4)) + '</span></span>' + NS.badge(s.status) + '</div>';
            }).join('') + '</div></div>' +
          '</section>' : '') +
        '</div>' +
      '</div>' +

      (lastRecord ? '<div class="route-footnote">' + NS.icon('clock') + ' Son kayıt ' + NS.esc(NS.relTime(lastRecord.record.createdAt)) + ' · ' + NS.esc(NS.producerById(lastRecord.record.producerId).name) + ' · ' + NS.fmtNum(lastRecord.record.liters, 1) + ' L</div>' : '') +

    '</div>';
  };

  NS.hooks.route = function () {
    requestAnimationFrame(function () {
      NS.$$('[data-w]').forEach(function (el, i) {
        setTimeout(function () { el.style.width = el.dataset.w + '%'; }, 60 + i * 50);
      });
    });
  };

})(window.MPApp);
