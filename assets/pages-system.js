/* ============================================================
   MandıraPro 2.0 — Kullanıcılar & Ayarlar
   ============================================================ */
(function (NS) {
  'use strict';

  NS.hooks = NS.hooks || {};

  NS.renderUsers = function () {
    const db = NS.state.db;
    const collectors = db.collectors;
    const users = db.users;
    const adminCount = users.filter(function (u) { return u.role === 'Yönetici'; }).length;

    const collectorCards = collectors.map(function (c) {
      const producers = db.producers.filter(function (p) { return p.collectorId === c.id; });
      const today = NS.todayISO();
      const stat = NS.routeStats(c.id, today, 'Sabah');
      return '<article class="collector-card">' +
        '<div class="cc-head"><span class="cl-av" style="background:' + c.color + '">' + NS.esc(NS.initials(c.name)) + '</span>' +
          '<div><b>' + NS.esc(c.name) + '</b><small>' + NS.esc(c.route) + ' · ' + NS.esc(c.plate) + '</small></div>' +
          '<span class="badge success">' + producers.length + ' üretici</span></div>' +
        '<div class="cc-metrics">' +
          '<div><small>Bugün</small><b>' + stat.done + '/' + stat.total + '</b></div>' +
          '<div><small>Toplanan</small><b>' + NS.fmtNum(stat.liters, 0) + ' L</b></div>' +
          '<div><small>Telefon</small><b style="font-size:10.5px">' + NS.esc(c.phone) + '</b></div>' +
        '</div>' +
        '<div class="cc-foot"><span class="tiny faint">' + NS.esc(c.shift) + '</span>' +
          '<div class="row gap-6"><button class="btn btn-ghost btn-sm" type="button" data-action="goto-route" data-collector="' + c.id + '">Rota</button>' +
          '<button class="icon-btn sm" type="button" data-action="edit-collector" data-id="' + c.id + '" title="Düzenle">' + NS.icon('edit') + '</button></div>' +
        '</div>' +
      '</article>';
    }).join('');

    const userRows = users.map(function (u) {
      const c = u.collectorId ? NS.collectorById(u.collectorId) : null;
      const p = u.producerId ? NS.producerById(u.producerId) : null;
      return '<tr>' +
        '<td><div class="prod-cell">' + NS.avatarHTML(u.name) + '<div><b>' + NS.esc(u.name) + '</b><small>@' + NS.esc(u.username) + '</small></div></div></td>' +
        '<td><span class="badge ' + (u.role === 'Yönetici' ? 'primary' : u.role === 'Sütçü' ? 'info' : 'success') + '">' + NS.esc(u.role) + '</span></td>' +
        '<td>' + (c ? NS.esc(c.route) : p ? NS.esc(p.code + ' · ' + p.village) : '<span class="faint">—</span>') + '</td>' +
        '<td>' + NS.esc(u.phone || '—') + '</td>' +
        '<td>' + (u.active ? '<span class="badge success">aktif</span>' : '<span class="badge">pasif</span>') + '</td>' +
        '<td><div class="row-actions">' +
          '<button class="icon-btn sm" type="button" data-action="edit-user" data-id="' + u.id + '" title="Düzenle">' + NS.icon('edit') + '</button>' +
          '<button class="icon-btn sm" type="button" data-action="delete-user" data-id="' + u.id + '" title="Sil">' + NS.icon('trash') + '</button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    return '<div class="page stagger">' +
      '<section class="page-head">' +
        '<div class="ph-left"><div class="page-kicker">' + NS.icon('shield') + ' erişim yönetimi</div>' +
          '<h1>Kullanıcılar</h1><p>' + users.length + ' hesap, ' + collectors.length + ' sütçü ve ' + adminCount + ' yönetici. Her sütçü yalnızca kendi rotasındaki üreticileri görür; üretici hesabı yalnızca kendi çiftliğine erişir.</p></div>' +
        '<div class="ph-actions">' +
          '<button class="btn btn-ghost" type="button" data-action="collector-new">' + NS.icon('route') + ' Sütçü ekle</button>' +
          '<button class="btn btn-primary" type="button" data-action="user-new">' + NS.icon('plus') + ' Kullanıcı ekle</button>' +
        '</div>' +
      '</section>' +

      '<div class="grid-4">' +
        '<div class="mini-stat"><small>Yönetici</small><b>' + adminCount + '</b><span>tüm işletme erişimi</span></div>' +
        '<div class="mini-stat"><small>Sütçü</small><b>' + users.filter(function (u) { return u.role === 'Sütçü'; }).length + '</b><span>saha ekibi</span></div>' +
        '<div class="mini-stat"><small>Üretici hesabı</small><b>' + users.filter(function (u) { return u.role === 'Üretici'; }).length + '</b><span>çiftlik portalı</span></div>' +
        '<div class="mini-stat"><small>Rota</small><b>' + collectors.length + '</b><span>' + db.producers.filter(function (p) { return p.active; }).length + ' aktif üretici</span></div>' +
      '</div>' +

      '<section class="card">' +
        '<div class="card-head card-head-rule"><div><h3>Sütçüler ve rotalar</h3><p>Her sütçünün kendi üretici listesi vardır</p></div></div>' +
        '<div class="card-body"><div class="collector-grid">' + collectorCards + '</div></div>' +
      '</section>' +

      '<section class="card">' +
        '<div class="card-head"><div><h3>Kullanıcı hesapları</h3><p>Yerel şifrelerle rol bazlı giriş</p></div><span class="badge">' + users.length + ' hesap</span></div>' +
        '<div class="card-body" style="padding-top:10px">' +
          '<div class="table-wrap"><table class="table"><thead><tr><th>Kullanıcı</th><th>Rol</th><th>Bağlı kayıt</th><th>Telefon</th><th>Durum</th><th></th></tr></thead><tbody>' + userRows + '</tbody></table></div>' +
          '<div class="inline-note mt-12">' + NS.icon('lock') + '<span>Şifreler tarayıcıda SHA-256 özetiyle saklanır. Demo hesaplarının şifresi 1234; gerçek kullanımda değiştirin.</span></div>' +
        '</div>' +
      '</section>' +
    '</div>';
  };

  NS.renderSettings = function () {
    const db = NS.state.db;
    const st = db.settings;
    if (!NS.state.settingsTab) NS.state.settingsTab = 'business';
    const tab = NS.state.settingsTab;
    const tabs = [
      ['business', 'İşletme bilgileri', 'building'],
      ['price', 'Fiyat listeleri', 'scale'],
      ['tanks', 'Tanklar', 'tank'],
      ['data', 'Veri & yedek', 'database']
    ];
    const nav = tabs.map(function (t) {
      return '<button type="button" class="' + (tab === t[0] ? 'active' : '') + '" data-action="settings-tab" data-tab="' + t[0] + '">' + NS.icon(t[2]) + ' ' + t[1] + '</button>';
    }).join('');

    let body = '';
    if (tab === 'business') {
      body = '<div class="settings-card">' +
        '<h2>İşletme bilgileri</h2><p>Fatura, makbuz ve rapor başlıklarında kullanılır.</p>' +
        '<form id="settingsBusinessForm">' +
          '<div class="form-grid">' +
            '<label class="field"><span class="field-label">Ticari ünvan</span><input class="input" name="businessName" value="' + NS.esc(st.businessName) + '" required></label>' +
            '<label class="field"><span class="field-label">Yetkili</span><input class="input" name="ownerName" value="' + NS.esc(st.ownerName) + '"></label>' +
            '<label class="field"><span class="field-label">Telefon</span><input class="input" name="phone" value="' + NS.esc(st.phone) + '"></label>' +
            '<label class="field"><span class="field-label">E-posta</span><input class="input" name="email" type="email" value="' + NS.esc(st.email) + '"></label>' +
            '<label class="field span-2"><span class="field-label">Adres</span><input class="input" name="address" value="' + NS.esc(st.address) + '"></label>' +
            '<label class="field"><span class="field-label">Vergi dairesi</span><input class="input" name="taxOffice" value="' + NS.esc(st.taxOffice) + '"></label>' +
            '<label class="field"><span class="field-label">Vergi no</span><input class="input" name="taxNo" value="' + NS.esc(st.taxNo) + '"></label>' +
            '<label class="field"><span class="field-label">MERSİS</span><input class="input" name="mersis" value="' + NS.esc(st.mersis) + '"></label>' +
            '<label class="field"><span class="field-label">Fatura ön eki</span><input class="input" name="invoicePrefix" value="' + NS.esc(st.invoicePrefix) + '"></label>' +
            '<label class="field"><span class="field-label">Sıradaki fatura no</span><input class="input" name="invoiceNext" type="number" min="1" value="' + Number(st.invoiceNext || 1) + '"></label>' +
            '<label class="field"><span class="field-label">KDV oranı (%)</span><input class="input" name="vatRate" type="number" min="0" max="100" value="' + Number(st.vatRate || 20) + '"></label>' +
            '<label class="field span-2"><span class="field-label">Belge dip notu</span><textarea class="textarea" name="deliveryNote" rows="2">' + NS.esc(st.deliveryNote) + '</textarea></label>' +
          '</div>' +
          '<div class="row between mt-16"><span class="inline-note">' + NS.icon('shield') + '<span>Bu bilgiler yalnızca yerel olarak saklanır.</span></span>' +
            '<button class="btn btn-primary" type="submit">' + NS.icon('check') + ' Bilgileri kaydet</button></div>' +
        '</form>' +
      '</div>';
    } else if (tab === 'price') {
      const cards = db.priceLists.map(function (pl) {
        const count = db.producers.filter(function (p) { return p.priceListId === pl.id; }).length;
        return '<article class="price-card">' +
          '<div class="pc-head"><div><h3>' + NS.esc(pl.name) + '</h3><p>' + NS.esc(pl.group) + '</p></div><span class="badge primary">' + count + ' üretici</span></div>' +
          '<div class="price-big">' + NS.fmtMoney(pl.basePrice, 2) + '<small>/ litre baz</small></div>' +
          '<div class="price-grades">' +
            '<div class="a"><span>A</span><b>+' + NS.fmtNum(pl.gradeDelta.A, 2) + ' ₺</b></div>' +
            '<div class="b"><span>B</span><b>' + NS.fmtNum(pl.gradeDelta.B, 2) + ' ₺</b></div>' +
            '<div class="c"><span>C</span><b>' + NS.fmtNum(pl.gradeDelta.C, 2) + ' ₺</b></div>' +
          '</div>' +
          (pl.note ? '<p class="small muted" style="line-height:1.5">' + NS.esc(pl.note) + '</p>' : '') +
          '<div class="pc-foot"><span class="tiny faint">Yürürlük: ' + NS.fmtDate(pl.effectiveFrom) + '</span>' +
            '<div class="row gap-6"><button class="btn btn-ghost btn-sm" type="button" data-action="price-edit" data-id="' + pl.id + '">Düzenle</button>' +
            '<button class="icon-btn sm" type="button" data-action="price-delete" data-id="' + pl.id + '" title="Sil">' + NS.icon('trash') + '</button></div></div>' +
        '</article>';
      }).join('');
      body = '<div class="settings-card">' +
        '<div class="row between"><div><h2>Fiyat listeleri</h2><p>Ürün grubuna göre baz fiyat ve kalite primleri.</p></div>' +
          '<button class="btn btn-primary btn-sm" type="button" data-action="price-new">' + NS.icon('plus') + ' Fiyat listesi</button></div>' +
        '<div class="price-grid mt-16">' + cards + '</div>' +
        '<div class="inline-note mt-16">' + NS.icon('info') + '<span>Tediye hesaplanırken her üreticinin fiyat listesi ve numune kalite sınıfı kullanılır. C sınıfı negatif fark uygular; yani kalite düştükçe litre fiyatı düşer.</span></div>' +
      '</div>';
    } else if (tab === 'tanks') {
      body = '<div class="settings-card">' +
        '<div class="row between"><div><h2>Tanklar</h2><p>Kapasite, sıcaklık ve temizlik takibi.</p></div>' +
          '<button class="btn btn-primary btn-sm" type="button" data-action="tank-new">' + NS.icon('plus') + ' Tank ekle</button></div>' +
        '<div class="stack gap-12 mt-16">' + db.tanks.map(function (t) {
          const pct = NS.tankPct(t);
          return '<div class="tank-settings-row"><div class="tank-mini" style="--fill:' + pct + '%"><i></i></div>' +
            '<div style="flex:1"><b>' + NS.esc(t.name) + '</b><small class="faint">' + NS.esc(t.code) + ' · ' + NS.esc(t.milkType) + ' · ' + NS.fmtNum(t.capacity, 0) + ' L kapasite</small>' +
              '<div class="row gap-6 mt-8"><span class="badge">' + NS.fmtNum(t.current, 0) + ' L</span><span class="badge info">' + NS.fmtNum(t.temperature, 1) + ' °C</span><span class="badge">%' + Math.round(pct) + '</span></div></div>' +
            '<div class="row gap-6"><button class="btn btn-ghost btn-sm" type="button" data-action="tank-measure" data-id="' + t.id + '">Ölçüm</button>' +
            '<button class="icon-btn sm" type="button" data-action="tank-edit" data-id="' + t.id + '" title="Düzenle">' + NS.icon('edit') + '</button></div></div>';
        }).join('') + '</div>' +
        '<div class="inline-note mt-16">' + NS.icon('info') + '<span>Anlık litre, sevkiyat ve ölçüm kayıtlarıyla güncellenir. Süt kaydı eklendiğinde ana tanka otomatik eklenir.</span></div>' +
      '</div>';
    } else {
      const size = new Blob([JSON.stringify(db)]).size;
      body = '<div class="settings-card">' +
        '<h2>Veri ve yedekleme</h2><p>Uygulama tamamen yerel çalışır; internet gerekmez.</p>' +
        '<div class="setting-row"><span class="alert-ico info">' + NS.icon('database') + '</span><div style="flex:1"><b>Yerel veri boyutu</b><small>' + NS.fmtNum(size / 1024, 0) + ' KB · ' + db.records.length + ' süt kaydı · ' + db.producers.length + ' üretici</small></div><span class="badge success">tarayıcı</span></div>' +
        '<div class="setting-row"><span class="alert-ico">' + NS.icon('moon') + '</span><div style="flex:1"><b>Görünüm</b><small>Kâğıt tonlu açık tema veya koyu tema.</small></div>' +
          '<div class="seg"><button type="button" class="' + (st.theme !== 'dark' ? 'active' : '') + '" data-action="set-theme" data-theme-opt="light">Açık</button><button type="button" class="' + (st.theme === 'dark' ? 'active' : '') + '" data-action="set-theme" data-theme-opt="dark">Koyu</button></div></div>' +
        '<div class="setting-row"><span class="alert-ico">' + NS.icon('download') + '</span><div style="flex:1"><b>JSON yedeği al</b><small>Tüm veriler tek dosyada. Başka bilgisayara taşımak için kullanın.</small></div><button class="btn btn-ghost btn-sm" type="button" data-action="backup-download">Yedek al</button></div>' +
        '<div class="setting-row"><span class="alert-ico">' + NS.icon('upload') + '</span><div style="flex:1"><b>Yedekten geri yükle</b><small>Mevcut verilerin üzerine yazar; önce yedek almanız önerilir.</small></div><button class="btn btn-ghost btn-sm" type="button" data-action="backup-restore">Dosya seç</button><input type="file" id="restoreFile" accept="application/json" hidden></div>' +
        '<div class="setting-row"><span class="alert-ico danger">' + NS.icon('refresh') + '</span><div style="flex:1"><b>Demo verilerini sıfırla</b><small>Tüm kayıtları siler ve zengin demo verisini yeniden kurar. Geri alınamaz.</small></div><button class="btn btn-danger btn-sm" type="button" data-action="reset-demo">Sıfırla</button></div>' +
        '<div class="inline-note mt-16">' + NS.icon('shield') + '<span>Eski MandıraPro 1.0 verileri bu sürümde kullanılmaz; silinmez. Yeni sürüm ayrı bir yerel anahtar kullanır.</span></div>' +
      '</div>';
    }

    return '<div class="page stagger">' +
      '<section class="page-head">' +
        '<div class="ph-left"><div class="page-kicker">' + NS.icon('settings') + ' sistem</div><h1>Ayarlar</h1><p>İşletme kimliği, fiyat listeleri, tank kapasiteleri ve yerel veri yönetimi.</p></div>' +
        '<div class="ph-actions"><button class="btn btn-ghost" type="button" data-action="backup-download">' + NS.icon('download') + ' Yedek al</button><button class="btn btn-primary" type="button" data-action="nav" data-view="dashboard">' + NS.icon('grid') + ' Panele dön</button></div>' +
      '</section>' +
      '<div class="settings-grid"><nav class="settings-nav">' + nav + '</nav><div>' + body + '</div></div>' +
    '</div>';
  };

})(window.MPApp);
