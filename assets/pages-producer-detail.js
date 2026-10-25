/* ============================================================
   MandıraPro 2.0 — Üretici detay sayfası
   ============================================================ */
(function (NS) {
  'use strict';

  NS.hooks = NS.hooks || {};

  function esc(v) { return NS.esc(v); }
  function option(value, label, selected) {
    return '<option value="' + esc(value) + '"' + (String(selected) === String(value) ? ' selected' : '') + '>' + esc(label) + '</option>';
  }
  function tabBtn(key, label, icon, current, count) {
    return '<button type="button" class="pp-tab' + (current === key ? ' active' : '') + '" data-action="producer-page-tab" data-tab="' + key + '">' +
      NS.icon(icon) + '<span>' + esc(label) + '</span>' + (count !== undefined ? '<b>' + count + '</b>' : '') + '</button>';
  }
  function mini(label, value, sub, tone) {
    return '<div class="pp-stat"><small>' + esc(label) + '</small><b' + (tone ? ' class="' + tone + '"' : '') + '>' + value + '</b><span>' + esc(sub || '') + '</span></div>';
  }

  NS.renderProducerDetail = function (id) {
    const db = NS.state.db;
    const p = NS.producerById(id);
    if (!p) return NS.emptyState('users', 'Üretici bulunamadı', 'Kayıt silinmiş veya erişim yetkiniz yok.');
    if (!NS.canSeeProducer(id)) return NS.emptyState('lock', 'Bu üreticiye erişim yok', 'Sütçü hesapları yalnızca kendi rotasındaki üreticileri görür.');

    if (!NS.state.producerDetail || NS.state.producerDetail.id !== id) {
      NS.state.producerDetail = { id: id, tab: 'overview', month: 'all' };
    }
    const ui = NS.state.producerDetail;
    const tab = ui.tab || 'overview';

    const today = NS.todayISO();
    const ym = today.slice(0, 7);
    const monthStart = NS.monthStart(ym);
    const from30 = NS.isoOffset(-29);
    const c = NS.collectorById(p.collectorId);
    const portal = db.users.find(function (u) { return u.role === 'Üretici' && u.producerId === id; }) || null;
    const allRecords = NS.recordsForProducer(id).slice().sort(function (a, b) { return String(b.date + (b.createdAt || '')).localeCompare(String(a.date + (a.createdAt || ''))); });
    const monthRecords = allRecords.filter(function (r) { return r.date >= monthStart && r.date <= today; });
    const recs30 = allRecords.filter(function (r) { return r.date >= from30; });
    const samples = db.samples.filter(function (s) { return s.producerId === id; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    const invoices = db.invoices.filter(function (i) { return i.partyId === id; }).sort(function (a, b) { return String(b.date + b.no).localeCompare(String(a.date + a.no)); });
    const payments = db.payments.filter(function (x) { return x.producerId === id; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    const orders = db.orders.filter(function (o) { return o.producerId === id; }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    const settlements = db.settlements.filter(function (s) { return s.producerId === id; }).sort(function (a, b) { return String(b.periodStart).localeCompare(String(a.periodStart)); });
    const notes = (db.producerNotes || []).filter(function (n) { return n.producerId === id; }).sort(function (a, b) {
      if (!!b.pinned !== !!a.pinned) return b.pinned ? 1 : -1;
      return String(b.createdAt || b.date).localeCompare(String(a.createdAt || a.date));
    });
    const allAcc = NS.producerAccount(id);
    const monthAcc = NS.producerAccount(id, monthStart, today);
    const q30 = NS.avgQuality(recs30);
    const qMonth = NS.avgQuality(monthRecords);
    const grades = NS.gradeCounts(recs30);
    const monthGrades = NS.gradeCounts(monthRecords);
    const hasToday = allRecords.some(function (r) { return r.date === today; });
    const lastSample = samples.find(function (s) { return s.status === 'Sonuçlandı'; });

    const months = {};
    allRecords.forEach(function (r) { months[r.date.slice(0, 7)] = true; });
    for (let i = 0; i < 6; i++) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      months[d.getFullYear() + '-' + NS.pad(d.getMonth() + 1)] = true;
    }
    const monthSelect = '<div class="pp-filter"><label>Dönem</label><select class="select" data-filter="producer-month">' +
      option('all', 'Tüm zamanlar', ui.month) +
      Object.keys(months).sort().reverse().map(function (m) { return option(m, NS.capitalize(NS.monthLabel(m)), ui.month); }).join('') +
      '</select></div>';
    const filteredRecords = ui.month && ui.month !== 'all'
      ? allRecords.filter(function (r) { return r.date.slice(0, 7) === ui.month; })
      : allRecords;
    const filteredSamples = ui.month && ui.month !== 'all'
      ? samples.filter(function (s) { return String(s.date).slice(0, 7) === ui.month; })
      : samples;

    const hero =
      '<section class="pp-hero">' +
        '<div class="pp-hero-main">' +
          '<a class="pp-back" href="#/producers" data-action="nav" data-view="producers" title="Üreticilere dön">' + NS.icon('chevron-left') + '</a>' +
          '<div class="pp-avatar" style="background:' + NS.avatarGradient(p.name) + '">' + esc(NS.initials(p.name)) + '</div>' +
          '<div class="pp-identity">' +
            '<div class="pp-eyebrow">' + NS.icon('users') + ' ÜRETİCİ KARTI <span class="pp-code">' + esc(p.code) + '</span></div>' +
            '<h1>' + esc(p.name) + '</h1>' +
            '<div class="pp-meta">' +
              '<span>' + NS.icon('pin') + esc(p.village) + '</span>' +
              '<span>' + NS.icon('route') + esc(c ? c.route : 'Rota atanmadı') + '</span>' +
              (p.phone ? '<span>' + NS.icon('phone') + esc(p.phone) + '</span>' : '') +
              '<span class="pp-status ' + (p.active !== false ? 'active' : 'passive') + '"><i></i>' + (p.active !== false ? 'Aktif üretici' : 'Pasif kayıt') + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="pp-hero-actions">' +
          '<button class="btn btn-primary" type="button" data-action="record-for-producer" data-id="' + p.id + '">' + NS.icon('plus') + ' Süt kaydı</button>' +
          '<button class="btn btn-ghost" type="button" data-action="statement-producer" data-id="' + p.id + '">' + NS.icon('printer') + ' Aylık ekstre</button>' +
          '<button class="btn btn-ghost btn-icon-only" type="button" data-action="qr-producer" data-id="' + p.id + '" title="QR etiketi">' + NS.icon('qr') + '</button>' +
          '<button class="btn btn-ghost" type="button" data-action="edit-producer" data-id="' + p.id + '">' + NS.icon('edit') + ' Düzenle</button>' +
          (NS.isAdmin() ? '<button class="btn btn-ghost btn-icon-only danger" type="button" data-action="delete-producer" data-id="' + p.id + '" title="Üreticiyi sil / pasife al">' + NS.icon('trash') + '</button>' : '') +
        '</div>' +
        '<div class="pp-statbar">' +
          mini('Son 30 gün', NS.fmtNum(NS.sumLiters(recs30), 0) + ' <em>L</em>', recs30.length + ' kayıt', '') +
          mini('Kalite puanı', q30 ? NS.fmtNum(q30, 1) : '—', lastSample ? 'son numune ' + NS.fmtDate(lastSample.date) : 'numune yok', q30 && q30 < 70 ? 'tone-neg' : '') +
          mini('Bu ay hakediş', NS.fmtMoney(monthAcc.gross, 0), monthRecords.length + ' kayıt', '') +
          mini('Güncel bakiye', NS.fmtMoney(allAcc.balance, 0), allAcc.balance >= 0 ? 'mandıra borçlu' : 'üretici borçlu', allAcc.balance >= 0 ? 'tone-pos' : 'tone-neg') +
        '</div>' +
      '</section>';

    const tabs = '<nav class="pp-tabs" aria-label="Üretici detay sekmeleri">' +
      tabBtn('overview', 'Genel bakış', 'grid', tab) +
      tabBtn('milk', 'Süt kayıtları', 'drop', tab, allRecords.length) +
      tabBtn('quality', 'Kalite', 'flask', tab, samples.length) +
      tabBtn('account', 'Cari hesap', 'book', tab) +
      tabBtn('invoices', 'Faturalar', 'file-text', tab, invoices.length) +
      tabBtn('payments', 'Ödemeler', 'wallet', tab, payments.length) +
      tabBtn('notes', 'Notlar', 'edit', tab, notes.length) +
      '</nav>';

    let body = '';
    if (tab === 'overview') body = renderOverview();
    else if (tab === 'milk') body = renderMilk();
    else if (tab === 'quality') body = renderQuality();
    else if (tab === 'account') body = renderAccount();
    else if (tab === 'invoices') body = renderInvoices();
    else if (tab === 'payments') body = renderPayments();
    else body = renderNotes();

    return '<div class="page pp-page stagger">' + hero + tabs + body + '</div>';

    /* ---- Genel bakış ---- */
    function renderOverview() {
      const days = [];
      const values = [];
      for (let i = 29; i >= 0; i--) {
        const d = NS.isoOffset(-i);
        days.push(d);
        values.push(NS.sumLiters(allRecords.filter(function (r) { return r.date === d; })));
      }
      NS._producerChart = { days: days, values: values };
      const recent = allRecords.slice(0, 7);
      const recentRows = recent.map(function (r) {
        return '<tr>' +
          '<td><b>' + NS.fmtDateShort(r.date) + '</b></td>' +
          '<td class="num"><b>' + NS.fmtNum(r.liters, 1) + '</b> L</td>' +
          '<td>' + NS.feedCellHTML(r.feeds) + '</td>' +
          '<td>' + (r.quality ? NS.qualityBadge(r.quality.grade, r.quality.score) : '<span class="badge">numune yok</span>') + '</td>' +
          '<td class="num">' + NS.fmtMoney(r.amount, 0) + '</td>' +
          '<td><button class="icon-btn sm" type="button" data-action="edit-record" data-id="' + r.id + '" title="Düzenle">' + NS.icon('edit') + '</button></td></tr>';
      }).join('');
      const lastPay = payments[0];
      const notePreview = notes.slice(0, 2).map(function (n) {
        return '<div class="pp-note-mini"><div class="pp-note-top"><b>' + esc(n.authorName || 'Mandıra ekibi') + '</b><span>' + NS.fmtDate(n.date) + '</span></div><p>' + esc(n.text) + '</p></div>';
      }).join('') || '<div class="pp-empty-small">' + NS.icon('edit') + '<span>Henüz not eklenmemiş.</span></div>';
      const invPreview = invoices.slice(0, 3).map(function (inv) {
        return '<button class="pp-list-line" type="button" data-action="invoice-view" data-id="' + inv.id + '"><span><b>' + esc(inv.no) + '</b><small>' + NS.fmtDate(inv.date) + ' · ' + esc(inv.type) + '</small></span><span class="pp-line-end"><b>' + NS.fmtMoney(inv.total, 0) + '</b>' + NS.badge(inv.status) + '</span></button>';
      }).join('') || '<div class="pp-empty-small">' + NS.icon('file-text') + '<span>Fatura kaydı yok.</span></div>';

      return '<div class="pp-overview">' +
        '<section class="card pp-chart-card">' +
          '<div class="card-head"><div><h3>Son 30 gün süt üretimi</h3><p>Günlük toplam litre ve dalgalanma</p></div><span class="badge primary">' + NS.fmtNum(NS.sum(values), 0) + ' L</span></div>' +
          '<div class="card-body"><div id="producerTrend"></div>' +
            '<div class="pp-chart-foot"><div><small>Günlük ortalama</small><b>' + NS.fmtNum(values.length ? NS.sum(values) / values.length : 0, 1) + ' L</b></div>' +
            '<div><small>En yüksek gün</small><b>' + NS.fmtNum(Math.max.apply(null, values.concat([0])), 1) + ' L</b></div>' +
            '<div><small>Kayıtlı gün</small><b>' + values.filter(function (v) { return v > 0; }).length + ' / 30</b></div></div>' +
          '</div>' +
        '</section>' +

        '<section class="card pp-info-card">' +
          '<div class="card-head"><div><h3>Çiftlik bilgileri</h3><p>İletişim, rota ve resmî kayıt</p></div><button class="icon-btn sm" type="button" data-action="edit-producer" data-id="' + p.id + '">' + NS.icon('edit') + '</button></div>' +
          '<div class="card-body pp-info-list">' +
            infoRow('Telefon', p.phone || '—') +
            infoRow('Adres', p.address || p.village) +
            infoRow('Rota / sütçü', (c ? c.route + ' · ' + c.name : '—')) +
            infoRow('Rota sırası', String(p.sira || '—') + '. durak') +
            infoRow('Hayvan sayısı', p.animalCount ? p.animalCount + ' baş' : '—') +
            infoRow('Fiyat listesi', NS.priceListFor(p) ? NS.priceListFor(p).name : '—') +
            infoRow('Vergi no / dairesi', (p.taxNo || '—') + ' · ' + (p.taxOffice || '—')) +
            infoRow('IBAN', p.iban || '—') +
            infoRow('Kayıt tarihi', NS.fmtDate(p.joinedAt)) +
            infoRow('Portal kullanıcısı', portal ? '@' + portal.username : 'Hesap yok') +
          '</div>' +
        '</section>' +

        '<section class="card pp-recent-card">' +
          '<div class="card-head"><div><h3>Son süt kayıtları</h3><p>Son 7 teslimat ve kalite sonucu</p></div><button class="btn btn-ghost btn-sm" type="button" data-action="producer-page-tab" data-tab="milk">Tüm kayıtlar ' + NS.icon('chevron-right') + '</button></div>' +
          '<div class="card-body" style="padding-top:10px"><div class="table-wrap"><table class="table"><thead><tr><th>Tarih</th><th class="num">Litre</th><th>Yem</th><th>Kalite</th><th class="num">Tutar</th><th></th></tr></thead><tbody>' +
            (recentRows || '<tr><td colspan="6">' + NS.emptyState('drop', 'Kayıt yok', 'İlk süt kaydını ekleyerek başlayın.') + '</td></tr>') + '</tbody></table></div></div>' +
        '</section>' +

        '<aside class="pp-side">' +
          '<section class="card pp-account-snap">' +
            '<div class="card-head"><div><h3>Cari özet</h3><p>Bu ay ve genel bakiye</p></div></div>' +
            '<div class="card-body">' +
              '<div class="pp-account-hero"><small>Güncel bakiye</small><b class="' + (allAcc.balance >= 0 ? 'tone-pos' : 'tone-neg') + '">' + NS.fmtMoney(allAcc.balance, 2) + '</b><span>' + (allAcc.balance >= 0 ? 'Mandıra üreticiye borçlu' : 'Üretici mandıraya borçlu') + '</span></div>' +
              '<div class="pp-account-lines">' +
                '<div><span>Süt hakedişi</span><b>+' + NS.fmtMoney(monthAcc.gross, 2) + '</b></div>' +
                '<div><span>Yem bedeli</span><b>−' + NS.fmtMoney(monthAcc.feedCost, 2) + '</b></div>' +
                '<div><span>Sipariş</span><b>−' + NS.fmtMoney(monthAcc.orderTotal, 2) + '</b></div>' +
                '<div><span>Ödemeler</span><b>−' + NS.fmtMoney(monthAcc.paid, 2) + '</b></div>' +
              '</div>' +
              '<div class="pp-two-btns"><button class="btn btn-primary btn-sm" type="button" data-action="payment-producer" data-id="' + p.id + '">' + NS.icon('wallet') + ' Ödeme</button>' +
                '<button class="btn btn-ghost btn-sm" type="button" data-action="statement-producer" data-id="' + p.id + '">' + NS.icon('printer') + ' Ekstre</button></div>' +
            '</div>' +
          '</section>' +

          '<section class="card">' +
            '<div class="card-head"><div><h3>Kalite dağılımı</h3><p>Son 30 gün · ' + (q30 ? NS.fmtNum(q30, 1) + ' puan' : 'sonuç yok') + '</p></div><button class="btn btn-ghost btn-sm" type="button" data-action="producer-page-tab" data-tab="quality">Detay</button></div>' +
            '<div class="card-body">' +
              '<div class="pp-quality-bars">' +
                qualityBar('A', grades.A, recs30.length, 'a') +
                qualityBar('B', grades.B, recs30.length, 'b') +
                qualityBar('C', grades.C, recs30.length, 'c') +
              '</div>' +
              '<div class="pp-quality-foot"><span>30 gün</span><b>' + NS.fmtNum(NS.sumLiters(recs30), 0) + ' L</b><span>Bu ay</span><b>' + NS.fmtNum(NS.sumLiters(monthRecords), 0) + ' L</b></div>' +
            '</div>' +
          '</section>' +

          '<section class="card">' +
            '<div class="card-head"><div><h3>Son notlar</h3><p>Saha ekibi notları</p></div><button class="icon-btn sm" type="button" data-action="producer-note" data-id="' + p.id + '" title="Not ekle">' + NS.icon('plus') + '</button></div>' +
            '<div class="card-body">' + notePreview + '</div>' +
          '</section>' +

          '<section class="card">' +
            '<div class="card-head"><div><h3>Son faturalar</h3><p>Satış ve alım evrakı</p></div><button class="icon-btn sm" type="button" data-action="producer-invoice" data-id="' + p.id + '" title="Fatura kes">' + NS.icon('plus') + '</button></div>' +
            '<div class="card-body pp-compact-list">' + invPreview + '</div>' +
          '</section>' +
        '</aside>' +
      '</div>';
    }

    /* ---- Süt kayıtları ---- */
    function renderMilk() {
      const list = filteredRecords;
      const total = NS.sumLiters(list);
      const amount = NS.sumAmount(list);
      const rows = list.map(function (r) {
        return '<tr>' +
          '<td><b>' + NS.fmtDate(r.date) + '</b></td>' +
          '<td class="num"><b>' + NS.fmtNum(r.liters, 1) + '</b> L</td>' +
          '<td>' + NS.feedCellHTML(r.feeds) + '</td>' +
          '<td>' + (r.quality ? NS.qualityBadge(r.quality.grade, r.quality.score) : '<span class="badge">numune yok</span>') + '</td>' +
          '<td>' + (r.quality ? '<span class="small">Yağ ' + NS.fmtNum(r.quality.fat, 1) + ' · Protein ' + NS.fmtNum(r.quality.protein, 1) + '</span>' : '<span class="faint small">—</span>') + '</td>' +
          '<td class="num">' + NS.fmtMoney(r.price, 2) + '</td>' +
          '<td class="num"><b>' + NS.fmtMoney(r.amount, 2) + '</b></td>' +
          '<td><div class="row-actions"><button class="icon-btn sm" type="button" data-action="edit-record" data-id="' + r.id + '" title="Düzenle">' + NS.icon('edit') + '</button>' +
            (NS.isAdmin() ? '<button class="icon-btn sm danger" type="button" data-action="delete-record" data-id="' + r.id + '" title="Sil">' + NS.icon('trash') + '</button>' : '') + '</div></td></tr>';
      }).join('');
      return '<section class="card pp-content-card">' +
        '<div class="card-head card-head-rule"><div><h3>Süt kayıtları</h3><p>' + (ui.month === 'all' ? 'Tüm dönem' : NS.capitalize(NS.monthLabel(ui.month))) + ' · ' + list.length + ' kayıt</p></div>' +
          '<div class="pp-head-tools">' + monthSelect + '<button class="btn btn-ghost btn-sm" type="button" data-action="export-records">' + NS.icon('download') + ' CSV</button>' +
          '<button class="btn btn-primary btn-sm" type="button" data-action="record-for-producer" data-id="' + p.id + '">' + NS.icon('plus') + ' Kayıt</button></div></div>' +
        '<div class="pp-summary-strip">' +
          '<div><small>Toplam süt</small><b>' + NS.fmtNum(total, 1) + ' L</b></div>' +
          '<div><small>Toplam hakediş</small><b>' + NS.fmtMoney(amount, 2) + '</b></div>' +
          '<div><small>Ortalama litre</small><b>' + NS.fmtNum(list.length ? total / list.length : 0, 1) + ' L</b></div>' +
          '<div><small>Kalite</small><b>' + (NS.avgQuality(list) ? NS.fmtNum(NS.avgQuality(list), 1) : '—') + '</b></div>' +
        '</div>' +
        '<div class="card-body" style="padding-top:10px"><div class="table-wrap"><table class="table table-wide"><thead><tr><th>Tarih</th><th class="num">Litre</th><th>Yem</th><th>Kalite</th><th>Analiz</th><th class="num">Fiyat</th><th class="num">Tutar</th><th></th></tr></thead><tbody>' +
          (rows || '<tr><td colspan="8">' + NS.emptyState('drop', 'Kayıt bulunamadı', 'Seçili dönemde süt kaydı yok.') + '</td></tr>') + '</tbody></table></div>' +
        '<div class="inline-note mt-12">' + NS.icon('clock') + '<span>Saha kayıtları ilk 30 dakika içinde düzenlenebilir; yönetici hesapları geçmiş kayıtları düzeltebilir. Her değişiklik cari ve tediye hesabına anında yansır.</span></div></div>' +
      '</section>';
    }

    /* ---- Kalite ---- */
    function renderQuality() {
      const sampleRows = filteredSamples.map(function (s) {
        return '<tr>' +
          '<td><b class="code-tag">' + esc(s.code) + '</b><div class="cell-sub">' + NS.fmtDate(s.date) + '</div></td>' +
          '<td>' + NS.badge(s.status) + '</td>' +
          '<td class="num">' + (s.fat ? NS.fmtNum(s.fat, 1) : '—') + '</td>' +
          '<td class="num">' + (s.protein ? NS.fmtNum(s.protein, 1) : '—') + '</td>' +
          '<td class="num">' + (s.somatic ? NS.fmtNum(s.somatic, 0) : '—') + '</td>' +
          '<td class="num">' + (s.bacteria ? NS.fmtNum(s.bacteria, 0) : '—') + '</td>' +
          '<td>' + (s.status === 'Sonuçlandı' ? NS.qualityBadge(s.grade, s.score) : '<span class="faint small">bekliyor</span>') + '</td>' +
          '<td><div class="row-actions">' +
            '<button class="btn btn-ghost btn-sm" type="button" data-action="analyze-sample" data-id="' + s.id + '">' + NS.icon('flask') + ' ' + (s.status === 'Sonuçlandı' ? 'Düzenle' : 'Sonuç') + '</button>' +
            '<button class="icon-btn sm danger" type="button" data-action="delete-sample" data-id="' + s.id + '" title="Sil">' + NS.icon('trash') + '</button>' +
          '</div></td></tr>';
      }).join('');
      return '<div class="pp-quality-grid">' +
        '<section class="card pp-content-card">' +
          '<div class="card-head card-head-rule"><div><h3>Numune ve analiz geçmişi</h3><p>' + filteredSamples.length + ' numune · ' + samples.filter(function (s) { return s.status === 'Sonuçlandı'; }).length + ' sonuçlanmış</p></div>' +
            '<div class="pp-head-tools">' + monthSelect + '<button class="btn btn-primary btn-sm" type="button" data-action="sample-for-producer" data-id="' + p.id + '">' + NS.icon('flask') + ' Numune</button></div></div>' +
          '<div class="card-body" style="padding-top:10px"><div class="table-wrap"><table class="table table-wide"><thead><tr><th>Numune</th><th>Durum</th><th class="num">Yağ</th><th class="num">Protein</th><th class="num">Somatik</th><th class="num">Bakteri</th><th>Sonuç</th><th></th></tr></thead><tbody>' +
            (sampleRows || '<tr><td colspan="8">' + NS.emptyState('flask', 'Numune yok', 'QR etiketiyle numune oluşturun; sonuç girildiğinde fiyat otomatik güncellenir.') + '</td></tr>') + '</tbody></table></div></div>' +
        '</section>' +
        '<aside class="pp-side">' +
          '<section class="card pp-quality-side"><div class="card-head"><div><h3>Kalite özeti</h3><p>Son 30 gün</p></div></div><div class="card-body">' +
            '<div class="pp-quality-score"><span class="q-ring" style="--q:' + Math.max(0, Math.min(100, q30 || 0)) + '"><b>' + (q30 ? NS.fmtNum(q30, 0) : '—') + '</b><small>puan</small></span>' +
            '<div><b>' + (q30 >= 85 ? 'Çok iyi' : q30 >= 70 ? 'İyi' : q30 ? 'Takip gerekli' : 'Sonuç yok') + '</b><p>' + (lastSample ? 'Son analiz ' + NS.fmtDate(lastSample.date) : 'Henüz sonuçlanmış numune yok.') + '</p></div></div>' +
            '<div class="pp-quality-bars mt-16">' +
              qualityBar('A', grades.A, recs30.length, 'a') + qualityBar('B', grades.B, recs30.length, 'b') + qualityBar('C', grades.C, recs30.length, 'c') +
            '</div>' +
            '<div class="pp-account-lines mt-16"><div><span>Bu ay A / B / C</span><b>' + monthGrades.A + ' / ' + monthGrades.B + ' / ' + monthGrades.C + '</b></div><div><span>Bu ay ortalama</span><b>' + (qMonth ? NS.fmtNum(qMonth, 1) : '—') + '</b></div><div><span>Numune sayısı</span><b>' + samples.length + '</b></div></div>' +
          '</div></section>' +
          '<section class="card"><div class="card-head"><div><h3>Nasıl hesaplanır?</h3><p>Kalite primi ve kesintisi</p></div></div><div class="card-body"><div class="pp-info-block">' +
            '<p>Yağ, protein, somatik hücre ve bakteri değerlerinden 100 üzerinden puan üretilir. A sınıfı baz fiyata prim ekler, C sınıfı kesinti uygular.</p>' +
            '<div class="pp-formula"><span>A</span><b>+' + NS.fmtNum(NS.priceListFor(p) ? NS.priceListFor(p).gradeDelta.A : 0, 2) + ' ₺</b><span>B</span><b>' + NS.fmtNum(NS.priceListFor(p) ? NS.priceListFor(p).gradeDelta.B : 0, 2) + ' ₺</b><span>C</span><b>' + NS.fmtNum(NS.priceListFor(p) ? NS.priceListFor(p).gradeDelta.C : 0, 2) + ' ₺</b></div>' +
          '</div></div></section>' +
        '</aside></div>';
    }

    /* ---- Cari hesap ---- */
    function renderAccount() {
      const start = ui.month === 'all' ? '0000-01-01' : NS.monthStart(ui.month);
      const end = ui.month === 'all' ? '9999-12-31' : NS.monthEnd(ui.month);
      const acc = NS.producerAccount(id, start, end);
      const lines = [];
      allRecords.forEach(function (r) {
        if (r.date < start || r.date > end) return;
        lines.push({ date: r.date, at: r.createdAt || r.date, desc: 'Süt alımı', sub: NS.fmtNum(r.liters, 1) + ' L · ' + (r.quality ? r.quality.grade : 'numune yok'), debit: Number(r.amount) || 0, credit: 0, icon: 'drop' });
        const feed = NS.feedCostOf(r.feeds);
        if (feed > 0) lines.push({ date: r.date, at: r.createdAt || r.date, desc: 'Yem teslimi', sub: NS.feedText(r.feeds) + ' kg', debit: 0, credit: feed, icon: 'package' });
      });
      orders.forEach(function (o) {
        if (o.date < start || o.date > end || o.status !== 'Teslim') return;
        lines.push({ date: o.date, at: o.createdAt || o.date, desc: 'Sipariş ' + o.no, sub: (o.items || []).map(function (i) { return i.name; }).join(', '), debit: 0, credit: Number(o.total) || 0, icon: 'package' });
      });
      payments.forEach(function (x) {
        if (x.date < start || x.date > end) return;
        lines.push({ date: x.date, at: x.createdAt || x.date, desc: x.type || 'Ödeme', sub: (x.method || '') + (x.note ? ' · ' + x.note : ''), debit: 0, credit: Number(x.amount) || 0, icon: 'wallet' });
      });
      lines.sort(function (a, b) { return String(a.date + (a.at || '')).localeCompare(String(b.date + (b.at || ''))); });
      let running = 0;
      const allLines = lines.map(function (l) { running += l.debit - l.credit; l.balance = running; return l; });
      const shown = allLines.slice(-80).reverse();
      const rows = shown.map(function (l) {
        return '<tr><td><b>' + NS.fmtDate(l.date) + '</b></td>' +
          '<td><span class="pp-ledger-desc">' + NS.icon(l.icon) + '<span><b>' + esc(l.desc) + '</b><small>' + esc(l.sub) + '</small></span></span></td>' +
          '<td class="num tone-pos">' + (l.debit ? '+' + NS.fmtMoney(l.debit, 2) : '—') + '</td>' +
          '<td class="num ' + (l.credit ? 'tone-neg' : 'faint') + '">' + (l.credit ? '−' + NS.fmtMoney(l.credit, 2) : '—') + '</td>' +
          '<td class="num"><b>' + NS.fmtMoney(l.balance, 2) + '</b></td></tr>';
      }).join('');
      return '<div class="pp-account-grid">' +
        '<section class="card pp-content-card">' +
          '<div class="card-head card-head-rule"><div><h3>Cari hareketler</h3><p>' + (ui.month === 'all' ? 'Tüm dönem' : NS.capitalize(NS.monthLabel(ui.month))) + ' · son 80 hareket</p></div>' +
            '<div class="pp-head-tools">' + monthSelect + '<button class="btn btn-primary btn-sm" type="button" data-action="payment-producer" data-id="' + p.id + '">' + NS.icon('wallet') + ' Ödeme</button></div></div>' +
          '<div class="pp-summary-strip">' +
            '<div><small>Süt hakedişi</small><b>' + NS.fmtMoney(acc.gross, 2) + '</b></div>' +
            '<div><small>Yem</small><b>−' + NS.fmtMoney(acc.feedCost, 2) + '</b></div>' +
            '<div><small>Ödenen</small><b>−' + NS.fmtMoney(acc.paid, 2) + '</b></div>' +
            '<div class="grand"><small>Dönem bakiyesi</small><b class="' + ((acc.gross - acc.feedCost - acc.orderTotal - acc.paid) >= 0 ? 'tone-pos' : 'tone-neg') + '">' + NS.fmtMoney(acc.gross - acc.feedCost - acc.orderTotal - acc.paid, 2) + '</b></div>' +
          '</div>' +
          '<div class="card-body" style="padding-top:10px"><div class="table-wrap"><table class="table table-wide"><thead><tr><th>Tarih</th><th>Hareket</th><th class="num">Alacak</th><th class="num">Borç</th><th class="num">Bakiye</th></tr></thead><tbody>' +
            (rows || '<tr><td colspan="5">' + NS.emptyState('book', 'Hareket yok', 'Seçili dönemde cari hareket bulunmuyor.') + '</td></tr>') + '</tbody></table></div>' +
          '<div class="inline-note mt-12">' + NS.icon('info') + '<span>Bakiye pozitifken mandıra üreticiye ödeme yapmalıdır. Sipariş yalnızca "Teslim" durumunda borç olarak işlenir.</span></div></div>' +
        '</section>' +
        '<aside class="pp-side">' +
          '<section class="card"><div class="card-head"><div><h3>Dönem özeti</h3><p>Hesap kalemleri</p></div></div><div class="card-body pp-account-lines">' +
            '<div><span>Toplam süt</span><b>' + NS.fmtNum(acc.liters, 1) + ' L</b></div>' +
            '<div><span>Süt hakedişi</span><b>+' + NS.fmtMoney(acc.gross, 2) + '</b></div>' +
            '<div><span>Yem bedeli</span><b>−' + NS.fmtMoney(acc.feedCost, 2) + '</b></div>' +
            '<div><span>Siparişler</span><b>−' + NS.fmtMoney(acc.orderTotal, 2) + '</b></div>' +
            '<div><span>Ödemeler</span><b>−' + NS.fmtMoney(acc.paid, 2) + '</b></div>' +
            '<div class="grand"><span>Dönem bakiyesi</span><b>' + NS.fmtMoney(acc.gross - acc.feedCost - acc.orderTotal - acc.paid, 2) + '</b></div>' +
            '<button class="btn btn-ghost btn-block mt-12" type="button" data-action="statement-producer" data-id="' + p.id + '">' + NS.icon('printer') + ' Aylık ekstre / PDF</button>' +
          '</div></section>' +
          '<section class="card"><div class="card-head"><div><h3>Son ödemeler</h3><p>Havale, nakit ve mahsup</p></div></div><div class="card-body pp-compact-list">' +
            (payments.slice(0, 4).map(function (x) { return '<div class="pp-list-line"><span><b>' + NS.fmtDate(x.date) + '</b><small>' + esc(x.type) + ' · ' + esc(x.method || '') + '</small></span><span class="pp-line-end"><b>' + NS.fmtMoney(x.amount, 2) + '</b></span></div>'; }).join('') || '<div class="pp-empty-small">' + NS.icon('wallet') + '<span>Henüz ödeme yapılmadı.</span></div>') +
          '</div></section>' +
        '</aside></div>';
    }

    /* ---- Faturalar ---- */
    function renderInvoices() {
      const rows = invoices.map(function (inv) {
        return '<tr class="clickable" data-action="invoice-view" data-id="' + inv.id + '">' +
          '<td><b class="code-tag">' + esc(inv.no) + '</b><div class="cell-sub">' + NS.fmtDate(inv.date) + '</div></td>' +
          '<td><span class="badge ' + (inv.type === 'Satış' ? 'primary' : 'info') + '">' + esc(inv.type) + '</span></td>' +
          '<td class="num">' + (inv.items || []).length + '</td><td class="num">' + NS.fmtMoney(inv.total, 2) + '</td>' +
          '<td>' + NS.badge(inv.status) + '</td>' +
          '<td><div class="row-actions"><button class="icon-btn sm" type="button" data-action="invoice-print" data-id="' + inv.id + '" title="Yazdır">' + NS.icon('printer') + '</button>' +
            (inv.status === 'Taslak' ? '<button class="icon-btn sm" type="button" data-action="invoice-edit" data-id="' + inv.id + '" title="Düzenle">' + NS.icon('edit') + '</button>' : '') +
          '</div></td></tr>';
      }).join('');
      return '<section class="card pp-content-card">' +
        '<div class="card-head card-head-rule"><div><h3>Üretici faturaları</h3><p>' + invoices.length + ' evrak · ' + NS.fmtMoney(NS.sum(invoices.map(function (i) { return i.total; })), 2) + ' toplam</p></div>' +
          '<button class="btn btn-primary btn-sm" type="button" data-action="producer-invoice" data-id="' + p.id + '">' + NS.icon('plus') + ' Fatura kes</button></div>' +
        '<div class="card-body" style="padding-top:10px"><div class="table-wrap"><table class="table"><thead><tr><th>Fatura no</th><th>Tür</th><th class="num">Kalem</th><th class="num">Toplam</th><th>Durum</th><th></th></tr></thead><tbody>' +
          (rows || '<tr><td colspan="6">' + NS.emptyState('file-text', 'Fatura yok', 'Bu üretici için henüz fatura kesilmedi.') + '</td></tr>') + '</tbody></table></div></div>' +
      '</section>';
    }

    /* ---- Ödemeler ---- */
    function renderPayments() {
      const payRows = payments.map(function (x) {
        return '<tr><td><b>' + NS.fmtDate(x.date) + '</b></td><td>' + esc(x.type) + '</td><td>' + esc(x.method || '—') + '</td><td>' + esc(x.note || '') + '</td><td class="num"><b>' + NS.fmtMoney(x.amount, 2) + '</b></td></tr>';
      }).join('');
      const stRows = settlements.map(function (s) {
        return '<tr><td><b>' + NS.fmtDate(s.periodStart) + ' – ' + NS.fmtDate(s.periodEnd) + '</b><div class="cell-sub">' + esc(s.receiptNo || '') + '</div></td>' +
          '<td class="num">' + NS.fmtNum(s.liters, 1) + ' L</td><td class="num">' + NS.fmtMoney(s.net, 2) + '</td><td>' + NS.badge(s.status) + '</td>' +
          '<td><button class="icon-btn sm" type="button" data-action="settle-receipt" data-producer="' + p.id + '" title="Makbuz">' + NS.icon('printer') + '</button></td></tr>';
      }).join('');
      return '<div class="pp-payment-grid">' +
        '<section class="card pp-content-card"><div class="card-head card-head-rule"><div><h3>Ödeme geçmişi</h3><p>' + payments.length + ' ödeme · toplam ' + NS.fmtMoney(NS.sum(payments.map(function (x) { return x.amount; })), 2) + '</p></div>' +
          '<button class="btn btn-primary btn-sm" type="button" data-action="payment-producer" data-id="' + p.id + '">' + NS.icon('plus') + ' Ödeme gir</button></div>' +
          '<div class="card-body" style="padding-top:10px"><div class="table-wrap"><table class="table"><thead><tr><th>Tarih</th><th>Tür</th><th>Yöntem</th><th>Not</th><th class="num">Tutar</th></tr></thead><tbody>' +
            (payRows || '<tr><td colspan="5">' + NS.emptyState('wallet', 'Ödeme yok', 'Üreticiye yapılan avans ve tediye ödemeleri burada görünür.') + '</td></tr>') + '</tbody></table></div></div></section>' +
        '<section class="card"><div class="card-head"><div><h3>Tediye dönemleri</h3><p>Kaydedilmiş net hakedişler</p></div></div><div class="card-body" style="padding-top:10px"><div class="table-wrap"><table class="table"><thead><tr><th>Dönem</th><th class="num">Süt</th><th class="num">Net</th><th>Durum</th><th></th></tr></thead><tbody>' +
          (stRows || '<tr><td colspan="5">' + NS.emptyState('receipt', 'Tediye yok', 'Tediye dönemi kaydedildiğinde burada listelenir.') + '</td></tr>') + '</tbody></table></div></div></section>' +
      '</div>';
    }

    /* ---- Notlar ---- */
    function renderNotes() {
      const cards = notes.map(function (n) {
        return '<article class="pp-note' + (n.pinned ? ' pinned' : '') + '">' +
          '<div class="pp-note-head"><div><b>' + esc(n.authorName || 'Mandıra ekibi') + '</b><small>' + NS.fmtDate(n.date) + ' · ' + NS.relTime(n.createdAt) + '</small></div>' +
          '<div class="row gap-6">' + (n.pinned ? '<span class="badge warn">' + NS.icon('pin') + ' sabit</span>' : '') +
          '<button class="icon-btn sm danger" type="button" data-action="producer-note-delete" data-id="' + n.id + '" title="Notu sil">' + NS.icon('trash') + '</button></div></div>' +
          '<p>' + esc(n.text) + '</p></article>';
      }).join('');
      return '<section class="card pp-content-card"><div class="card-head card-head-rule"><div><h3>Üretici notları</h3><p>' + notes.length + ' not · saha ekibi ve yönetim notları</p></div>' +
        '<button class="btn btn-primary btn-sm" type="button" data-action="producer-note" data-id="' + p.id + '">' + NS.icon('plus') + ' Not ekle</button></div>' +
        '<div class="card-body"><div class="pp-notes">' + (cards || NS.emptyState('edit', 'Henüz not yok', 'Ziyaret, kalite veya ödeme notu ekleyerek çiftlik geçmişini güçlendirin.')) + '</div></div></section>';
    }

    function infoRow(label, value) {
      return '<div class="pp-info-row"><span>' + esc(label) + '</span><b title="' + esc(value) + '">' + esc(value) + '</b></div>';
    }
    function qualityBar(grade, count, total, tone) {
      const pct = total ? Math.round(count / total * 100) : 0;
      return '<div class="pp-qbar ' + tone + '"><div class="pp-qbar-head"><span>' + grade + ' sınıfı</span><b>' + count + ' <small>· %' + pct + '</small></b></div><span class="pp-qbar-track"><i style="width:' + pct + '%"></i></span></div>';
    }
  };

  NS.hooks.producer = function () {
    const d = NS._producerChart;
    const el = NS.$('#producerTrend');
    if (d && el && typeof NS.areaChart === 'function') {
      NS.areaChart(el, d.days.map(function (day, i) {
        return { label: NS.fmtDateShort(day), value: d.values[i] };
      }), { unit: 'L', height: 230, aria: 'Üretici son 30 gün süt üretimi', valueFmt: function (v) { return NS.fmtNum(v, 1) + ' litre'; } });
    }
  };

})(window.MPApp);
