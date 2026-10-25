/* ============================================================
   MandıraPro 2.0 — Veri Modeli ve Demo Üretici
   Süt Rotası · Numune/Kalite · Tank · Tediye · Fatura · Filo
   Tüm veri tarayıcıda (localStorage) tutulur.
   ============================================================ */
window.MP = window.MP || {};

(function () {
  'use strict';

  MP.APP = {
    name: 'MandıraPro',
    short: 'Mandıra',
    version: '2.0.0',
    storageKey: 'mandirapro_db_v2',
    sessionKey: 'mandirapro_session_v2',
    legacyKey: 'mandirapro_db_v1'
  };

  MP.FEEDS = [
    { key: 'sutYemi',    label: 'Süt Yemi',    short: 'Süt',     color: '#3f7d5b' },
    { key: 'besiYemi',   label: 'Besi Yemi',   short: 'Besi',    color: '#b9723f' },
    { key: 'buzagiYemi', label: 'Buzağı Yemi', short: 'Buzağı',  color: '#c9a227' },
    { key: 'sariKusbe',  label: 'Sarı Küspe',  short: 'Küspe',   color: '#8a6f3f' }
  ];

  MP.EXPENSE_TYPES = [
    { key: 'Yakıt', color: '#b9723f', icon: 'fuel' },
    { key: 'Bakım', color: '#3f7d5b', icon: 'wrench' },
    { key: 'Temizlik', color: '#3b657a', icon: 'spray' },
    { key: 'Personel', color: '#8a6f3f', icon: 'users' },
    { key: 'Elektrik', color: '#c9a227', icon: 'bolt' },
    { key: 'Yem Alımı', color: '#6b7f4a', icon: 'leaf' },
    { key: 'Diğer', color: '#7b7f78', icon: 'more' }
  ];

  MP.PRODUCT_GROUPS = ['Yem', 'Kaba Yem', 'Malzeme', 'Ekipman'];
  MP.ORDER_STATUSES = ['Talep', 'Onaylandı', 'Hazır', 'Teslim'];
  MP.GRADES = ['A', 'B', 'C'];

  MP.ROLES = { ADMIN: 'Yönetici', COLLECTOR: 'Sütçü', PRODUCER: 'Üretici' };

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function round1(v) { return Math.round(v * 10) / 10; }
  function round2(v) { return Math.round(v * 100) / 100; }

  /* Kalite puanı — yağ, protein, somatik ve bakteri üzerinden 100'lük skor */
  MP.qualityScore = function (q) {
    if (!q) return null;
    const fat = Number(q.fat) || 0;
    const protein = Number(q.protein) || 0;
    const somatic = Number(q.somatic) || 0;
    const bacteria = Number(q.bacteria) || 0;
    if (!fat && !protein) return null;
    const fs = clamp((fat - 3.0) / 1.1 * 30, 0, 30);
    const ps = clamp((protein - 2.8) / 0.9 * 25, 0, 25);
    const ss = clamp((650 - somatic) / 450 * 25, 0, 25);
    const bs = clamp((170 - bacteria) / 120 * 20, 0, 20);
    return Math.round((fs + ps + ss + bs) * 10) / 10;
  };

  MP.gradeOf = function (q) {
    const score = typeof q === 'number' ? q : MP.qualityScore(q);
    if (score === null) return null;
    if (score >= 82) return 'A';
    if (score >= 65) return 'B';
    return 'C';
  };

  MP.buildSeed = function () {
    const rand = mulberry32(24102026);
    const now = new Date();
    now.setHours(12, 0, 0, 0);

    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function iso(n) {
      const d = new Date(now);
      d.setDate(d.getDate() - n);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    function monthKey(n) {
      const d = new Date(now);
      d.setDate(1);
      d.setMonth(d.getMonth() - n);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1);
    }
    function monthEnd(ym) {
      const p = ym.split('-').map(Number);
      return ym + '-' + pad(new Date(p[0], p[1], 0).getDate());
    }
    function ymLabel(ym) {
      const p = ym.split('-').map(Number);
      return new Date(p[0], p[1] - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    }

    const DAYS = 120;

    /* ---------------- Ekipler / sütçüler ---------------- */
    const collectors = [
      { id: 'c1', name: 'Ela Yılmaz',   route: 'Merkez Rotası',   phone: '0532 415 20 11', plate: '42 ABC 118', vehicleId: 'v1', color: '#2f6b4f', active: true, shift: '06:30 – 10:30' },
      { id: 'c2', name: 'Mehmet Gündoğar', route: 'Yukarıköy Rotası', phone: '0533 210 44 78', plate: '42 KLM 806', vehicleId: 'v2', color: '#a4602f', active: true, shift: '06:15 – 10:45' },
      { id: 'c3', name: 'Muhammed Gündoğar', route: 'Çamlık Rotası', phone: '0542 337 91 05', plate: '42 TR 214',  vehicleId: 'v3', color: '#365d7a', active: true, shift: '06:45 – 11:00' }
    ];

    /* ---------------- Fiyat listeleri ---------------- */
    const priceLists = [
      {
        id: 'pl1', name: 'Standart İnek', group: 'İnek Sütü', basePrice: 16.50,
        gradeDelta: { A: 0.90, B: 0, C: -1.40 }, effectiveFrom: '2026-07-01', active: true,
        note: 'Yağ ≥ 3,8 ve somatik ≤ 400 bin için A primi uygulanır.'
      },
      {
        id: 'pl2', name: 'Manda Sütü', group: 'Manda Sütü', basePrice: 28.00,
        gradeDelta: { A: 1.50, B: 0, C: -2.00 }, effectiveFrom: '2026-06-15', active: true,
        note: 'Manda sütü ayrı fiyat grubunda değerlendirilir.'
      },
      {
        id: 'pl3', name: 'Organik İnek', group: 'Organik', basePrice: 19.40,
        gradeDelta: { A: 1.20, B: 0, C: -1.60 }, effectiveFrom: '2026-08-01', active: true,
        note: 'Organik sertifikalı üreticiler.'
      }
    ];

    /* ---------------- Üreticiler ---------------- */
    const producerSeed = [
      ['Havva Demir',     'Çayırbaşı', '0532 118 44 21', 'c1', 1, 24, 'pl1', 66, true],
      ['Ahmet Kaya',      'Merkez',    '0542 337 91 05', 'c1', 2, 18, 'pl1', 48, true],
      ['Fatma Çelik',     'Aşağıköy',  '0535 602 18 33', 'c1', 3, 15, 'pl1', 39, true],
      ['Ali Koç',         'Yukarıköy', '0544 728 60 12', 'c1', 4, 12, 'pl3', 31, true],
      ['Emine Aydın',     'Merkez',    '0537 260 93 18', 'c1', 5, 9,  'pl1', 24, false],
      ['Mehmet Şahin',    'Yukarıköy', '0536 145 77 90', 'c2', 1, 30, 'pl1', 82, true],
      ['Zeynep Arslan',   'Çamlık',    '0531 884 10 27', 'c2', 2, 21, 'pl1', 57, true],
      ['Hüseyin Öztürk',  'Çamlık',    '0543 512 68 44', 'c2', 3, 16, 'pl3', 43, true],
      ['Ayşe Yıldız',     'Aşağıköy',  '0538 741 09 62', 'c2', 4, 11, 'pl1', 29, true],
      ['Kemal Doğan',     'Sazlık',    '0530 662 87 14', 'c2', 5, 7,  'pl2', 34, true],
      ['Şerife Korkmaz',  'Merkez',    '0539 205 66 70', 'c3', 1, 27, 'pl1', 72, true],
      ['Osman Polat',     'Yeşilova',  '0541 918 32 56', 'c3', 2, 14, 'pl1', 36, true],
      ['Nurten Aksoy',    'Yeşilova',  '0533 604 71 28', 'c3', 3, 19, 'pl3', 51, true],
      ['İbrahim Çetin',   'Çamlık',    '0546 122 95 30', 'c3', 4, 22, 'pl1', 60, true],
      ['Sultan Uysal',    'Merkez',    '0534 890 16 47', 'c3', 5, 8,  'pl1', 21, true]
    ];

    const producers = producerSeed.map(function (row, i) {
      const code = 'U-' + String(i + 1).padStart(3, '0');
      return {
        id: 'p' + (i + 1),
        code: code,
        name: row[0],
        phone: row[2],
        village: row[1],
        address: row[1] + ' / Konya',
        collectorId: row[3],
        sira: row[4],
        animalCount: row[5],
        priceListId: row[6],
        baseLiters: row[7],
        active: row[8],
        taxNo: String(3000000000 + Math.floor(rand() * 600000000)),
        taxOffice: 'Konya',
        iban: 'TR' + String(12 + Math.floor(rand() * 80)) + ' 0006 2000 ' + String(1000 + Math.floor(rand() * 8999)) + ' 0001 ' + String(10 + Math.floor(rand() * 89)) + ' ' + String(10 + Math.floor(rand() * 89)),
        qr: 'MP|URETICI|' + code,
        joinedAt: iso(500 + i * 11),
        note: i === 4 ? 'Kış döneminde üretime ara verdi.' : (i === 9 ? 'Manda sütü — ayrı fiyat listesi.' : ''),
        createdAt: iso(500 + i * 11)
      };
    });

    /* ---------------- Kullanıcılar ---------------- */
    const users = [
      { id: 'u1', name: 'Cuma Yılmaz', username: 'admin', role: 'Yönetici', pass: '1234', phone: '0532 000 00 01', active: true, createdAt: iso(600) },
      { id: 'u2', name: 'Ela Yılmaz', username: 'ela', role: 'Sütçü', pass: '1234', phone: '0532 415 20 11', collectorId: 'c1', active: true, createdAt: iso(420) },
      { id: 'u3', name: 'Mehmet Gündoğar', username: 'mehmet', role: 'Sütçü', pass: '1234', phone: '0533 210 44 78', collectorId: 'c2', active: true, createdAt: iso(390) },
      { id: 'u4', name: 'Havva Demir', username: 'uretici', role: 'Üretici', pass: '1234', phone: '0532 118 44 21', producerId: 'p1', active: true, createdAt: iso(300) },
      { id: 'u5', name: 'Muhammed Gündoğar', username: 'muhammed', role: 'Sütçü', pass: '1234', phone: '0542 337 91 05', collectorId: 'c3', active: true, createdAt: iso(260) }
    ];

    /* ---------------- Yardımcı hesaplar ---------------- */
    const feedPrices = { sutYemi: 12.40, besiYemi: 14.60, buzagiYemi: 16.20, sariKusbe: 8.40 };

    function feedCostOf(feeds) {
      return round2(MP.FEEDS.reduce(function (s, f) {
        return s + (Number(feeds && feeds[f.key]) || 0) * (Number(feedPrices[f.key]) || 0);
      }, 0));
    }

    function makeQuality(bias) {
      const fat = round1(3.55 + rand() * 0.85 + (bias || 0) * 0.22);
      const protein = round1(3.05 + rand() * 0.45 + (bias || 0) * 0.10);
      const somatic = Math.round(150 + rand() * 360 - (bias || 0) * 45);
      const bacteria = Math.round(18 + rand() * 80 - (bias || 0) * 12);
      const q = { fat: fat, protein: protein, somatic: Math.max(60, somatic), bacteria: Math.max(8, bacteria) };
      q.score = MP.qualityScore(q);
      q.grade = MP.gradeOf(q.score);
      return q;
    }

    function priceFor(producer, grade) {
      const pl = priceLists.find(function (x) { return x.id === producer.priceListId; }) || priceLists[0];
      const delta = (pl.gradeDelta && pl.gradeDelta[grade || 'B']) || 0;
      return round2(pl.basePrice + delta);
    }

    /* ---------------- Kayıtlar ---------------- */
    const records = [];
    let recordSeq = 0;

    for (let day = DAYS; day >= 0; day--) {
      const date = iso(day);
      const dow = new Date(date + 'T12:00:00').getDay();
      const weekend = (dow === 0 || dow === 6) ? 1.05 : 1;
      const month = Number(date.slice(5, 7));
      const season = (month >= 5 && month <= 9) ? 1.06 : 0.97;

      producers.forEach(function (p, idx) {
        if (!p.active) return;
        if (day > 18 && p.id === 'p5') return;
        if (rand() < 0.045) return;
        if (day === 0 && rand() < 0.32) return; // bugünün bekleyen durakları
        const collector = collectors.find(function (c) { return c.id === p.collectorId; });
        if (!collector) return;

        const liters = round1(p.baseLiters * season * weekend * (0.84 + rand() * 0.32));
        if (liters <= 0) return;

        const feeds = { sutYemi: 0, besiYemi: 0, buzagiYemi: 0, sariKusbe: 0 };
        if (rand() < 0.34) {
          MP.FEEDS.forEach(function (f) {
            if (rand() < 0.55) feeds[f.key] = Math.round((rand() * 18 + 2) * 10) / 10;
          });
        }

        const q = rand() < 0.12 ? null : makeQuality((idx % 5) - 2);
        const grade = q ? q.grade : 'B';
        const price = priceFor(p, grade);
        const createdHour = 6 + Math.floor(rand() * 4);
        const createdMin = Math.floor(rand() * 60);
        recordSeq += 1;

        records.push({
          id: 'r' + recordSeq,
          producerId: p.id,
          collectorId: p.collectorId,
          date: date,
          session: 'Sabah',
          liters: liters,
          milk: liters,
          feeds: feeds,
          quality: q,
          price: price,
          amount: round2(liters * price),
          sampleId: null,
          note: rand() < 0.04 ? 'Sağım sonrası numune alındı.' : '',
          status: 'Toplandı',
          createdAt: date + 'T' + pad(createdHour) + ':' + pad(createdMin) + ':00',
          updatedAt: null
        });
      });
    }

    /* ---------------- Numuneler ---------------- */
    const samples = [];
    let sampleSeq = 0;
    const sampleCandidates = records.filter(function (r) {
      const diff = Math.round((now - new Date(r.date + 'T12:00:00')) / 86400000);
      return diff <= 3 && rand() < 0.62;
    });

    sampleCandidates.forEach(function (r) {
      const diff = Math.round((now - new Date(r.date + 'T12:00:00')) / 86400000);
      sampleSeq += 1;
      const code = 'NUM-' + now.getFullYear() + '-' + String(sampleSeq).padStart(4, '0');
      let status = 'Sonuçlandı';
      if (diff === 0) status = rand() < 0.55 ? 'Analizde' : 'Bekliyor';
      else if (diff === 1) status = rand() < 0.40 ? 'Analizde' : 'Sonuçlandı';
      const q = status === 'Sonuçlandı' ? (r.quality || makeQuality(0)) : null;
      const s = {
        id: 's' + sampleSeq,
        code: code,
        producerId: r.producerId,
        collectorId: r.collectorId,
        recordId: r.id,
        date: r.date,
        createdAt: r.createdAt,
        status: status,
        fat: q ? q.fat : null,
        protein: q ? q.protein : null,
        somatic: q ? q.somatic : null,
        bacteria: q ? q.bacteria : null,
        score: q ? q.score : null,
        grade: q ? q.grade : null,
        labNote: status === 'Sonuçlandı' && q && q.grade === 'C' ? 'Somatik hücre yüksek; üretici bilgilendirildi.' : '',
        analyzedAt: status === 'Sonuçlandı' ? r.date + 'T14:20:00' : null
      };
      samples.push(s);
      r.sampleId = s.id;
      if (q) r.quality = q;
    });

    /* ---------------- Tanklar & sevkiyatlar ---------------- */
    const tanks = [
      {
        id: 't1', name: 'Ana Toplama Tankı', code: 'TNK-01', capacity: 6000, current: 4180,
        temperature: 4.1, milkType: 'İnek sütü', lastCleanedAt: iso(5),
        lastDispatchAt: iso(1), note: 'Sağım sonrası dolduruldu.'
      },
      {
        id: 't2', name: 'Soğutma Tankı', code: 'TNK-02', capacity: 2500, current: 940,
        temperature: 3.4, milkType: 'Manda sütü', lastCleanedAt: iso(9),
        lastDispatchAt: iso(4), note: 'Ayrı hat — manda sütü.'
      }
    ];

    const dispatches = [];
    for (let i = 1; i <= 18; i += 2) {
      dispatches.push({
        id: 'd' + i,
        tankId: i % 4 === 1 ? 't2' : 't1',
        date: iso(i),
        liters: i % 4 === 1 ? 640 : 1850 + Math.round(rand() * 450),
        temperature: round1(3.7 + rand() * 0.8),
        destination: i % 4 === 1 ? 'Manda Süt Ürünleri' : 'Konya Süt A.Ş.',
        plate: i % 4 === 1 ? '42 MND 12' : '42 SÜT 51',
        driver: i % 4 === 1 ? 'Kemal Doğan' : 'Ramazan Yalçın',
        note: '',
        createdAt: iso(i) + 'T11:10:00'
      });
    }

    /* ---------------- Ürünler, siparişler, faturalar ---------------- */
    const products = [
      { id: 'pr1', name: 'Süt Yemi 50 kg', group: 'Yem', unit: 'çuval', price: 830, vat: 20, stock: 124, minStock: 30 },
      { id: 'pr2', name: 'Besi Yemi 50 kg', group: 'Yem', unit: 'çuval', price: 760, vat: 20, stock: 88, minStock: 25 },
      { id: 'pr3', name: 'Buzağı Yemi 25 kg', group: 'Yem', unit: 'çuval', price: 520, vat: 20, stock: 46, minStock: 15 },
      { id: 'pr4', name: 'Sarı Küspe 40 kg', group: 'Yem', unit: 'çuval', price: 380, vat: 20, stock: 62, minStock: 20 },
      { id: 'pr5', name: 'Mısır Silajı', group: 'Kaba Yem', unit: 'ton', price: 3200, vat: 20, stock: 18, minStock: 6 },
      { id: 'pr6', name: 'Yonca Balyası', group: 'Kaba Yem', unit: 'balya', price: 145, vat: 20, stock: 240, minStock: 50 },
      { id: 'pr7', name: 'Sağma Eldiveni', group: 'Malzeme', unit: 'kutu', price: 210, vat: 20, stock: 35, minStock: 10 },
      { id: 'pr8', name: 'Tank Dezenfektanı 5 L', group: 'Malzeme', unit: 'adet', price: 340, vat: 20, stock: 8, minStock: 12 },
      { id: 'pr9', name: 'Süt Kovası 30 L', group: 'Ekipman', unit: 'adet', price: 480, vat: 20, stock: 6, minStock: 5 }
    ];

    function productById(id) { return products.find(function (p) { return p.id === id; }); }

    const orders = [
      { id: 'o1', no: 'SIP-2026-0004', producerId: 'p1', date: iso(1), status: 'Yolda', note: 'Teslim edilecek.', items: [
        { productId: 'pr1', qty: 2, unitPrice: 830 }, { productId: 'pr7', qty: 1, unitPrice: 210 }
      ], createdAt: iso(1) + 'T09:40:00' },
      { id: 'o2', no: 'SIP-2026-0003', producerId: 'p6', date: iso(3), status: 'Teslim', note: '', items: [
        { productId: 'pr2', qty: 4, unitPrice: 760 }, { productId: 'pr6', qty: 40, unitPrice: 145 }
      ], createdAt: iso(3) + 'T08:15:00' },
      { id: 'o3', no: 'SIP-2026-0002', producerId: 'p11', date: iso(5), status: 'Onaylandı', note: 'Cuma sabahı hazırlanacak.', items: [
        { productId: 'pr1', qty: 3, unitPrice: 830 }, { productId: 'pr5', qty: 2, unitPrice: 3200 }
      ], createdAt: iso(5) + 'T16:05:00' },
      { id: 'o4', no: 'SIP-2026-0001', producerId: 'p2', date: iso(9), status: 'Teslim', note: '', items: [
        { productId: 'pr3', qty: 2, unitPrice: 520 }, { productId: 'pr8', qty: 1, unitPrice: 340 }
      ], createdAt: iso(9) + 'T07:40:00' },
      { id: 'o5', no: 'SIP-2026-0005', producerId: 'p1', date: iso(0), status: 'Talep', note: 'Kendi talebi.', items: [
        { productId: 'pr4', qty: 2, unitPrice: 380 }, { productId: 'pr7', qty: 1, unitPrice: 210 }
      ], createdAt: iso(0) + 'T07:05:00' }
    ];
    // 'Yolda' ara durumu demo için iş akışında Hazır olarak eşlenir
    orders.forEach(function (o) { o.status = o.status === 'Yolda' ? 'Hazır' : o.status; });

    function orderTotal(o) {
      return round2(o.items.reduce(function (s, it) { return s + it.qty * it.unitPrice; }, 0));
    }
    orders.forEach(function (o) { o.total = orderTotal(o); });

    const invoices = [
      {
        id: 'inv1', no: 'EMP-2026-0001', date: iso(24), type: 'Satış', status: 'Ödendi',
        partyType: 'Üretici', partyId: 'p2', partyName: 'Ahmet Kaya', partyTaxNo: '3123456789',
        partyAddress: 'Merkez / Konya', note: 'Yem satışı.',
        items: [
          { desc: 'Süt Yemi 50 kg', qty: 2, unit: 'çuval', unitPrice: 830, vat: 20 },
          { desc: 'Besi Yemi 50 kg', qty: 1, unit: 'çuval', unitPrice: 760, vat: 20 }
        ]
      },
      {
        id: 'inv2', no: 'EMP-2026-0002', date: iso(18), type: 'Satış', status: 'Kesildi',
        partyType: 'Üretici', partyId: 'p6', partyName: 'Mehmet Şahin', partyTaxNo: '3212345678',
        partyAddress: 'Yukarıköy / Konya', note: 'Kaba yem satışı.',
        items: [
          { desc: 'Yonca Balyası', qty: 60, unit: 'balya', unitPrice: 145, vat: 20 },
          { desc: 'Mısır Silajı', qty: 4, unit: 'ton', unitPrice: 3200, vat: 20 }
        ]
      },
      {
        id: 'inv3', no: 'EMP-2026-0003', date: iso(15), type: 'Alım', status: 'Kesildi',
        partyType: 'Üretici', partyId: 'p3', partyName: 'Fatma Çelik', partyTaxNo: '3987654321',
        partyAddress: 'Aşağıköy / Konya', note: 'Ekim ayı ilk yarı süt alımı.',
        items: [{ desc: 'Çiğ İnek Sütü — 1. dönem', qty: 1180, unit: 'litre', unitPrice: 16.50, vat: 1 }]
      },
      {
        id: 'inv4', no: 'EMP-2026-0004', date: iso(4), type: 'Satış', status: 'Taslak',
        partyType: 'Üretici', partyId: 'p11', partyName: 'Şerife Korkmaz', partyTaxNo: '3456789012',
        partyAddress: 'Merkez / Konya', note: '',
        items: [
          { desc: 'Süt Yemi 50 kg', qty: 3, unit: 'çuval', unitPrice: 830, vat: 20 },
          { desc: 'Tank Dezenfektanı 5 L', qty: 1, unit: 'adet', unitPrice: 340, vat: 20 }
        ]
      },
      {
        id: 'inv5', no: 'EMP-2026-0005', date: iso(2), type: 'Satış', status: 'Ödendi',
        partyType: 'Üretici', partyId: 'p1', partyName: 'Havva Demir', partyTaxNo: '3678901234',
        partyAddress: 'Çayırbaşı / Konya', note: 'Eldiven ve küspe satışı.',
        items: [
          { desc: 'Sağma Eldiveni', qty: 2, unit: 'kutu', unitPrice: 210, vat: 20 },
          { desc: 'Sarı Küspe 40 kg', qty: 3, unit: 'çuval', unitPrice: 380, vat: 20 }
        ]
      }
    ].map(function (inv) {
      let sub = 0, vatTotal = 0;
      inv.items.forEach(function (it) {
        const line = round2(it.qty * it.unitPrice);
        it.lineTotal = line;
        sub += line;
        vatTotal += line * (Number(it.vat) || 0) / 100;
      });
      inv.subtotal = round2(sub);
      inv.vatTotal = round2(vatTotal);
      inv.total = round2(sub + vatTotal);
      return inv;
    });

    const settings = {
      businessName: 'Elimayalı Mandıra',
      ownerName: 'Cuma Yılmaz',
      phone: '0532 000 00 00',
      email: 'info@elimayali.com',
      address: 'Merkez / Konya',
      taxOffice: 'Konya',
      taxNo: '1234567890',
      mersis: '0123456789000015',
      theme: 'light',
      milkPrice: 16.50,
      feedPrices: feedPrices,
      vatRate: 20,
      invoicePrefix: 'EMP',
      invoiceNext: 6,
      tankCapacity: 6000,
      currency: '₺',
      workStart: '06:30',
      quality: { fatBase: 3.8, proteinBase: 3.2, somaticLimit: 400, bacteriaLimit: 100, gradeA: 82, gradeB: 65 },
      deliveryNote: 'Süt, soğuk zincir kurallarına uygun olarak teslim alınmıştır.'
    };

    /* ---------------- Filo ---------------- */
    const vehicles = [
      {
        id: 'v1', plate: '42 ABC 118', brand: 'Ford', model: 'Transit 350L', year: 2021,
        km: 148320, fuelType: 'Dizel', tankL: 80, active: true,
        insuranceUntil: iso(-52), inspectionUntil: iso(-120),
        note: 'Merkez rotası — soğutmalı kasa.'
      },
      {
        id: 'v2', plate: '42 KLM 806', brand: 'Fiat', model: 'Ducato 16m³', year: 2019,
        km: 212450, fuelType: 'Dizel', tankL: 90, active: true,
        insuranceUntil: iso(-18), inspectionUntil: iso(-38),
        note: 'Yukarıköy rotası.'
      },
      {
        id: 'v3', plate: '42 TR 214', brand: 'Renault', model: 'Master L3H2', year: 2023,
        km: 76500, fuelType: 'Dizel', tankL: 80, active: true,
        insuranceUntil: iso(-300), inspectionUntil: iso(-410),
        note: 'Çamlık rotası.'
      }
    ];

    /* ---------------- Masraflar ---------------- */
    const expenses = [];
    let expSeq = 0;
    function pushExpense(e) {
      expSeq += 1;
      expenses.push(Object.assign({
        id: 'e' + expSeq, createdAt: e.date + 'T18:00:00', vendor: '', invoiceNo: '', note: ''
      }, e));
    }

    for (let d = 70; d >= 0; d -= 7) {
      const vehicle = d % 14 === 0 ? vehicles[0] : (d % 14 === 7 ? vehicles[1] : vehicles[2]);
      const liters = round1(48 + rand() * 24);
      pushExpense({
        date: iso(d), type: 'Yakıt', vehicleId: vehicle.id, amount: round2(liters * 46.90),
        liters: liters, km: vehicle.km - d * 210, vendor: d % 21 === 0 ? 'Petrol Ofisi' : 'Opet', invoiceNo: 'YK-' + (7000 + d)
      });
    }
    pushExpense({ date: iso(12), type: 'Bakım', vehicleId: 'v1', amount: 4250, vendor: 'Ford Yetkili Servis', note: 'Periyodik bakım + yağ değişimi', invoiceNo: 'BKM-1182' });
    pushExpense({ date: iso(31), type: 'Bakım', vehicleId: 'v2', amount: 1860, vendor: 'Usta Oto', note: 'Fren balatası ve filtre', invoiceNo: 'BKM-0964' });
    pushExpense({ date: iso(58), type: 'Bakım', vehicleId: 'v3', amount: 760, vendor: 'Lastikçi Hüseyin', note: 'Lastik tamiri', invoiceNo: 'BKM-0711' });
    for (let d = 66; d >= 0; d -= 10) {
      if (d % 20 === 0) {
        pushExpense({ date: iso(d), type: 'Temizlik', tankId: 't1', amount: 450, note: 'Tank iç temizliği ve dezenfeksiyon', vendor: 'Kendi ekibi' });
      } else {
        pushExpense({ date: iso(d), type: 'Temizlik', vehicleId: 'v1', amount: 220, note: 'Araç iç-dış yıkama', vendor: 'Ova Yıkama' });
      }
    }
    pushExpense({ date: iso(9), type: 'Personel', amount: 28500, note: 'Eylül personel maaşları', vendor: 'Bordro' });
    pushExpense({ date: iso(39), type: 'Personel', amount: 26800, note: 'Ağustos personel maaşları', vendor: 'Bordro' });
    pushExpense({ date: iso(8), type: 'Elektrik', amount: 5480, note: 'Soğutma tankı elektrik tüketimi', vendor: 'Enerjisa' });
    pushExpense({ date: iso(38), type: 'Elektrik', amount: 5120, note: 'Ağustos elektrik', vendor: 'Enerjisa' });
    pushExpense({ date: iso(16), type: 'Yem Alımı', amount: 42600, vendor: 'Konya Yem Ltd.', note: 'Süt yemi 50 çuval', invoiceNo: 'YEM-2241' });
    pushExpense({ date: iso(27), type: 'Diğer', amount: 920, vendor: 'Ziraat Odası', note: 'Üyelik aidatı' });

    /* ---------------- Avans / ödemeler ---------------- */
    const payments = [
      { id: 'pay1', producerId: 'p1', date: iso(6), amount: 5000, method: 'Havale', type: 'Avans', note: 'Ekim avansı', createdAt: iso(6) + 'T10:20:00' },
      { id: 'pay2', producerId: 'p6', date: iso(4), amount: 12000, method: 'Havale', type: 'Ödeme', note: 'Eylül tediye bakiyesi', createdAt: iso(4) + 'T11:05:00' },
      { id: 'pay3', producerId: 'p3', date: iso(9), amount: 3500, method: 'Nakit', type: 'Avans', note: '', createdAt: iso(9) + 'T09:35:00' },
      { id: 'pay4', producerId: 'p11', date: iso(2), amount: 7500, method: 'Havale', type: 'Ödeme', note: 'Eylül tediye bakiyesi', createdAt: iso(2) + 'T15:10:00' }
    ];

    /* ---------------- Tediyeler (son 3 tam ay) ---------------- */
    const settlements = [];
    let setSeq = 0;
    for (let m = 1; m <= 3; m++) {
      const ym = monthKey(m);
      const start = ym + '-01';
      const end = monthEnd(ym);
      const monthRecords = records.filter(function (r) { return r.date >= start && r.date <= end; });
      producers.forEach(function (p) {
        const prs = monthRecords.filter(function (r) { return r.producerId === p.id; });
        if (!prs.length) return;
        const liters = round1(prs.reduce(function (s, r) { return s + r.liters; }, 0));
        const gross = round2(prs.reduce(function (s, r) { return s + r.amount; }, 0));
        const feedCost = round2(prs.reduce(function (s, r) { return s + feedCostOf(r.feeds); }, 0));
        const advances = 0;
        setSeq += 1;
        settlements.push({
          id: 'st' + setSeq,
          producerId: p.id,
          periodStart: start,
          periodEnd: end,
          periodLabel: ymLabel(ym),
          liters: liters,
          gross: gross,
          feedCost: feedCost,
          advances: advances,
          net: round2(gross - feedCost - advances),
          avgPrice: round2(gross / liters),
          status: m === 1 ? 'Onaylandı' : 'Ödendi',
          receiptNo: 'TDI-' + ym.replace('-', '') + '-' + String(p.sira + 1).padStart(3, '0'),
          createdAt: end + 'T17:00:00',
          paidAt: m === 1 ? null : end + 'T18:00:00',
          note: ''
        });
      });
    }

    /* ---------------- Dinamik rota örneği ---------------- */
    const routeExtras = [{
      id: 'rx1',
      date: iso(0),
      collectorId: 'c1',
      producerId: 'p13',
      reason: 'Aynı güzergâh — Yukarıköy çıkışı',
      createdAt: iso(0) + 'T06:10:00'
    }];

    return {
      version: 2,
      createdAt: new Date().toISOString(),
      settings: settings,
      collectors: collectors,
      producers: producers,
      users: users,
      priceLists: priceLists,
      records: records,
      samples: samples,
      tanks: tanks,
      dispatches: dispatches,
      products: products,
      orders: orders,
      invoices: invoices,
      vehicles: vehicles,
      expenses: expenses,
      payments: payments,
      settlements: settlements,
      routeExtras: routeExtras
    };
  };

  /* ============================================================
     MandıraPro 1.0 uyumluluğu
     Eski tarayıcı verisi bulunamazsa, 1.0 sürümünün deterministik
     demo defterini yeniden üretir. Böylece 10 üretici ve 1.538
     süt kaydı yeni sürüme birebir taşınabilir.
     ============================================================ */
  MP.buildLegacySeed = function () {
    const rand = mulberry32(20261024);
    const DAYS = 180;
    const customersSeed = [
      { name: 'Ela Yılmaz',     phone: '0532 415 20 11', village: 'Merkez' },
      { name: 'Havva Demir',    phone: '0533 210 44 78', village: 'Yukarıköy' },
      { name: 'Ahmet Kaya',     phone: '0542 337 91 05', village: 'Merkez' },
      { name: 'Fatma Çelik',    phone: '0535 602 18 33', village: 'Aşağıköy' },
      { name: 'Mehmet Şahin',   phone: '0544 728 60 12', village: 'Merkez' },
      { name: 'Zeynep Arslan',  phone: '0536 145 77 90', village: 'Çamlık' },
      { name: 'Ali Koç',        phone: '0545 390 25 61', village: 'Yukarıköy' },
      { name: 'Ayşe Yıldız',    phone: '0531 884 10 27', village: 'Aşağıköy' },
      { name: 'Hüseyin Öztürk', phone: '0543 512 68 44', village: 'Çamlık' },
      { name: 'Emine Aydın',    phone: '0537 260 93 18', village: 'Merkez' }
    ];
    const notes = ['Yağ oranı düşük çıktı', 'Öğlen sağımı yapıldı', 'Yem teslimi tamamlandı', 'Numune alındı', 'Sağlık kontrolü yapıldı'];
    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function isoDaysAgo(n) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - n);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    function r1(v) { return Math.round(v * 10) / 10; }

    const customers = customersSeed.map(function (c, i) {
      return {
        id: 'c' + (i + 1), name: c.name, phone: c.phone, village: c.village,
        note: '', active: i !== 9, createdAt: isoDaysAgo(DAYS + 30 - i * 3)
      };
    });
    const records = [];
    for (let day = DAYS; day >= 0; day--) {
      const date = isoDaysAgo(day);
      const dow = new Date(date + 'T12:00:00').getDay();
      const weekend = (dow === 0 || dow === 6) ? 1.08 : 1;
      customers.forEach(function (c, idx) {
        if (!c.active) return;
        if (rand() < 0.05) return;
        const base = 24 + ((idx * 7) % 22);
        const milk = r1(base * weekend * (0.72 + rand() * 0.62));
        const feeds = {
          sutYemi:    r1(rand() < 0.72 ? rand() * 14 : 0),
          besiYemi:   r1(rand() < 0.52 ? rand() * 10 : 0),
          buzagiYemi: r1(rand() < 0.38 ? rand() * 6 : 0),
          sariKusbe:  r1(rand() < 0.33 ? rand() * 8 : 0)
        };
        const totalFeed = feeds.sutYemi + feeds.besiYemi + feeds.buzagiYemi + feeds.sariKusbe;
        if (milk <= 0 && totalFeed <= 0) return;
        records.push({
          id: 'r-' + date + '-' + c.id, customerId: c.id, date: date, milk: milk, feeds: feeds,
          note: rand() < 0.05 ? notes[Math.floor(rand() * notes.length)] : '',
          createdAt: date + 'T' + pad(7 + Math.floor(rand() * 10)) + ':' + pad(Math.floor(rand() * 60)) + ':00',
          updatedAt: null
        });
      });
    }
    return {
      version: 1,
      createdAt: new Date().toISOString(),
      settings: {
        businessName: 'Elimayalı Mandıra', ownerName: 'Cuma Yılmaz', phone: '0532 000 00 00',
        address: 'Merkez / Konya', milkPrice: 16.5, theme: 'dark',
        feedPrices: { sutYemi: 11.5, besiYemi: 13.9, buzagiYemi: 15.2, sariKusbe: 7.8 }
      },
      users: [
        { id: 'u1', name: 'Cuma Yılmaz', username: 'admin', role: 'Yönetici', pass: '1234' },
        { id: 'u2', name: 'Ela Yılmaz', username: 'ela', role: 'Operatör', pass: '1234' },
        { id: 'u3', name: 'Eymen', username: 'eymen', role: 'Yönetici', pass: '1234', active: true }
      ],
      customers: customers,
      records: records
    };
  };

  MP.migrateLegacy = function (legacy, richBase) {
    const base = richBase || MP.buildSeed();
    const fallback = MP.buildLegacySeed();
    const src = legacy && Array.isArray(legacy.customers) && legacy.customers.length ? legacy : fallback;
    const rand = mulberry32(16102026);
    const now = new Date();

    function pad(n) { return n < 10 ? '0' + n : '' + n; }
    function iso(n) {
      const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    function monthKey(n) {
      const d = new Date(now); d.setDate(1); d.setMonth(d.getMonth() - n);
      return d.getFullYear() + '-' + pad(d.getMonth() + 1);
    }
    function monthEnd(ym) {
      const p = ym.split('-').map(Number);
      return ym + '-' + pad(new Date(p[0], p[1], 0).getDate());
    }
    function ymLabel(ym) {
      const p = ym.split('-').map(Number);
      return new Date(p[0], p[1] - 1, 1).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    }
    function money(v) { return Math.round((Number(v) || 0) * 100) / 100; }

    const srcSettings = src.settings || {};
    const settings = Object.assign({}, base.settings, srcSettings);
    settings.theme = srcSettings.theme === 'light' ? 'light' : 'dark';
    if (!settings.businessName || settings.businessName === 'Elimayali Mandıra') settings.businessName = 'Elimayalı Mandıra';
    settings.milkPrice = Number(srcSettings.milkPrice) || 16.5;
    settings.feedPrices = Object.assign({}, base.settings.feedPrices, srcSettings.feedPrices || {});
    settings.quality = base.settings.quality;
    settings.invoicePrefix = base.settings.invoicePrefix || 'EMP';
    settings.createdAt = undefined;
    delete settings.createdAt;

    const villageCollector = { 'Merkez': 'c1', 'Yukarıköy': 'c2', 'Aşağıköy': 'c2', 'Çamlık': 'c3' };
    const routeCounter = { c1: 0, c2: 0, c3: 0 };
    const legacyRecords = Array.isArray(src.records) ? src.records : [];
    const avgMap = {};
    legacyRecords.forEach(function (r) {
      const key = r.customerId || r.producerId;
      if (!key) return;
      if (!avgMap[key]) avgMap[key] = { sum: 0, n: 0 };
      avgMap[key].sum += Number(r.milk || r.liters) || 0;
      avgMap[key].n += 1;
    });

    const producers = src.customers.map(function (c, i) {
      const id = 'p' + (i + 1);
      const collectorId = villageCollector[c.village] || ['c1', 'c2', 'c3'][i % 3];
      routeCounter[collectorId] += 1;
      const stats = avgMap[c.id] || avgMap[id] || null;
      const baseLiters = stats && stats.n ? Math.round(stats.sum / stats.n * 10) / 10 : 20 + i * 2;
      const code = 'U-' + String(i + 1).padStart(3, '0');
      const animalCount = Math.max(8, Math.round(baseLiters / 2.8 + 4));
      return {
        id: id,
        legacyId: c.id || null,
        code: code,
        name: c.name || ('Üretici ' + (i + 1)),
        phone: c.phone || '',
        village: c.village || 'Merkez',
        address: (c.village || 'Merkez') + ' / Konya',
        collectorId: collectorId,
        sira: routeCounter[collectorId],
        animalCount: animalCount,
        priceListId: 'pl1',
        baseLiters: baseLiters,
        active: c.active !== false,
        taxNo: String(3000000000 + i * 137 + 114),
        taxOffice: 'Konya',
        iban: 'TR' + String(32 + i) + ' 0006 2000 ' + String(1000 + i * 731) + ' 0001 ' + String(10 + i) + ' ' + String(10 + i * 3),
        qr: 'MP|URETICI|' + code,
        joinedAt: c.createdAt || iso(500 + i * 11),
        note: c.note || (c.active === false ? 'Kış döneminde üretime ara verdi.' : ''),
        createdAt: c.createdAt || iso(500 + i * 11)
      };
    });
    const byLegacyId = {};
    producers.forEach(function (p) { if (p.legacyId) byLegacyId[p.legacyId] = p; });

    /* Fiyat listesi eski süt fiyatına göre hizalanır */
    const priceLists = base.priceLists.map(function (pl, i) {
      pl = Object.assign({}, pl);
      if (i === 0) pl.basePrice = settings.milkPrice;
      return pl;
    });

    /* Kullanıcılar: eski hesaplar + eymen + her üretici için portal hesabı */
    const roleMap = { 'Operatör': 'Sütçü', 'Operator': 'Sütçü', 'Yönetici': 'Yönetici', 'Sütçü': 'Sütçü', 'Üretici': 'Üretici' };
    const users = [];
    const usedUsernames = {};
    function uniqueUsername(baseName) {
      let u = String(baseName || 'kullanici').toLocaleLowerCase('tr-TR')
        .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
        .replace(/[^a-z0-9._-]/g, '').slice(0, 24) || 'kullanici';
      if (!usedUsernames[u]) { usedUsernames[u] = true; return u; }
      let n = 2;
      while (usedUsernames[u + n]) n += 1;
      u = u + n; usedUsernames[u] = true; return u;
    }
    (Array.isArray(src.users) ? src.users : []).forEach(function (u, i) {
      const username = uniqueUsername(u.username || ('kullanici' + (i + 1)));
      const role = roleMap[u.role] || 'Sütçü';
      const obj = {
        id: u.id || ('u' + (i + 1)), name: u.name || username, username: username,
        role: role, passHash: u.passHash || null, pass: u.pass || null,
        phone: u.phone || '', active: u.active !== false,
        createdAt: u.createdAt || iso(600), source: 'v1'
      };
      if (role === 'Sütçü') {
        obj.collectorId = u.collectorId && base.collectors.some(function (c) { return c.id === u.collectorId; })
          ? u.collectorId : (i === 1 ? 'c1' : base.collectors[i % base.collectors.length].id);
      }
      if (u.producerId) {
        const pr = producers.find(function (p) { return p.id === u.producerId || p.legacyId === u.producerId; });
        if (pr) obj.producerId = pr.id;
      }
      users.push(obj);
    });
    if (!users.length) {
      users.push({ id: 'u1', name: 'Cuma Yılmaz', username: 'admin', role: 'Yönetici', pass: '1234', phone: '0532 000 00 01', active: true, createdAt: iso(600), source: 'v1' });
      users.push({ id: 'u2', name: 'Ela Yılmaz', username: 'ela', role: 'Sütçü', pass: '1234', phone: '0532 415 20 11', collectorId: 'c1', active: true, createdAt: iso(420), source: 'v1' });
    }
    if (!users.some(function (u) { return u.username === 'eymen'; })) {
      users.push({ id: 'u-eymen', name: 'Eymen', username: 'eymen', role: 'Yönetici', pass: '1234', phone: '', active: true, createdAt: iso(20), source: 'recovered' });
      usedUsernames.eymen = true;
    }
    if (!users.some(function (u) { return u.role === 'Yönetici' && u.active !== false; })) {
      users[0].role = 'Yönetici';
      users[0].active = true;
    }
    producers.forEach(function (p) {
      if (users.some(function (u) { return u.producerId === p.id; })) return;
      let baseName = String(p.name).toLocaleLowerCase('tr-TR')
        .replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c')
        .split(/\s+/)[0] || ('uretim' + p.id);
      if (p.id === 'p1' && !usedUsernames.uretici) baseName = 'uretici';
      const username = uniqueUsername(baseName);
      users.push({
        id: 'u-' + p.id, name: p.name, username: username, role: 'Üretici',
        pass: '1234', phone: p.phone, producerId: p.id, active: p.active,
        createdAt: p.joinedAt, source: 'portal'
      });
    });

    /* Süt kayıtları — litre, tarih ve yem miktarları aynen korunur */
    const records = [];
    let seq = 0;
    legacyRecords.forEach(function (r) {
      const srcCid = r.customerId || r.producerId;
      const p = byLegacyId[srcCid] || producers[0];
      if (!p) return;
      const liters = Number(r.liters !== undefined ? r.liters : r.milk) || 0;
      const feeds = {};
      MP.FEEDS.forEach(function (f) { feeds[f.key] = Number(r.feeds && r.feeds[f.key]) || 0; });
      seq += 1;
      records.push({
        id: 'r' + seq,
        legacyId: r.id || null,
        producerId: p.id,
        collectorId: p.collectorId,
        date: String(r.date || iso(0)).slice(0, 10),
        session: r.session || 'Sabah',
        liters: liters,
        milk: liters,
        feeds: feeds,
        quality: null,
        price: settings.milkPrice,
        amount: money(liters * settings.milkPrice),
        sampleId: null,
        note: r.note || '',
        status: 'Toplandı',
        createdAt: r.createdAt || (String(r.date || iso(0)).slice(0, 10) + 'T08:30:00'),
        updatedAt: r.updatedAt || null,
        legacy: true
      });
    });
    records.sort(function (a, b) { return String(a.date + a.createdAt).localeCompare(String(b.date + b.createdAt)); });

    /* Son iki haftanın bir bölümüne numune ve kalite sonucu işlenir */
    const samples = [];
    const sampled = {};
    let sampleSeq = 0;
    const recent = records.filter(function (r) { return r.date >= iso(15); });
    recent.forEach(function (r, idx) {
      if (idx % 3 !== 0 && r.date !== iso(0)) return;
      if (r.date === iso(0) && idx % 2 === 0) return;
      const age = Math.round((new Date(now.getFullYear(), now.getMonth(), now.getDate()) - new Date(r.date + 'T12:00:00')) / 86400000);
      const fat = Math.round((3.45 + rand() * 0.95) * 10) / 10;
      const protein = Math.round((2.95 + rand() * 0.5) * 10) / 10;
      const somatic = Math.round(120 + rand() * 400);
      const bacteria = Math.round(12 + rand() * 88);
      const q = { fat: fat, protein: protein, somatic: somatic, bacteria: bacteria };
      q.score = MP.qualityScore(q);
      q.grade = MP.gradeOf(q.score);
      let status = 'Sonuçlandı';
      if (age <= 0) status = rand() < 0.55 ? 'Analizde' : 'Bekliyor';
      else if (age === 1) status = rand() < 0.35 ? 'Analizde' : 'Sonuçlandı';
      sampleSeq += 1;
      const s = {
        id: 's' + sampleSeq,
        code: 'NUM-' + now.getFullYear() + '-' + String(sampleSeq).padStart(4, '0'),
        producerId: r.producerId, collectorId: r.collectorId, recordId: r.id,
        date: r.date, createdAt: r.createdAt, status: status,
        fat: status === 'Sonuçlandı' ? q.fat : null,
        protein: status === 'Sonuçlandı' ? q.protein : null,
        somatic: status === 'Sonuçlandı' ? q.somatic : null,
        bacteria: status === 'Sonuçlandı' ? q.bacteria : null,
        score: status === 'Sonuçlandı' ? q.score : null,
        grade: status === 'Sonuçlandı' ? q.grade : null,
        labNote: status === 'Sonuçlandı' && q.grade === 'C' ? 'Somatik hücre yüksek; üretici bilgilendirildi.' : '',
        analyzedAt: status === 'Sonuçlandı' ? r.date + 'T14:20:00' : null
      };
      samples.push(s);
      r.sampleId = s.id;
      if (status === 'Sonuçlandı') {
        r.quality = q;
        r.price = money(settings.milkPrice + ((q.grade === 'A' ? 0.9 : q.grade === 'C' ? -1.4 : 0)));
        r.amount = money(r.liters * r.price);
      }
      sampled[r.id] = true;
    });

    const tanks = base.tanks.map(function (t) { return Object.assign({}, t); });
    const dispatches = base.dispatches.map(function (d) { return Object.assign({}, d); });
    const collectors = base.collectors.map(function (c) { return Object.assign({}, c); });
    const vehicles = base.vehicles.map(function (v) { return Object.assign({}, v); });
    const expenses = base.expenses.map(function (e) { return Object.assign({}, e); });
    const products = base.products.map(function (p) { return Object.assign({}, p); });

    /* Ürün, sipariş ve faturalar yeni üretici listesine göre kurulur */
    const orderDefs = [
      { p: 'p1', day: 0, status: 'Talep', items: [['pr4', 2], ['pr7', 1]], note: 'Hafta sonu teslimi.' },
      { p: 'p2', day: 1, status: 'Hazır', items: [['pr1', 2], ['pr6', 20]], note: '' },
      { p: 'p3', day: 3, status: 'Onaylandı', items: [['pr2', 3], ['pr5', 1]], note: 'Cuma sabahı hazırlanacak.' },
      { p: 'p6', day: 5, status: 'Teslim', items: [['pr3', 2], ['pr8', 1]], note: '' },
      { p: 'p1', day: 8, status: 'Teslim', items: [['pr1', 4], ['pr4', 2]], note: '' },
      { p: 'p4', day: 11, status: 'Talep', items: [['pr6', 30]], note: 'Kendi talebi.' }
    ];
    const orders = orderDefs.map(function (d, i) {
      const p = producers.find(function (x) { return x.id === d.p; }) || producers[0];
      const items = d.items.map(function (it) {
        const product = products.find(function (x) { return x.id === it[0]; });
        return { productId: it[0], qty: it[1], unitPrice: product ? product.price : 0 };
      });
      const total = money(items.reduce(function (s, it) { return s + it.qty * it.unitPrice; }, 0));
      return {
        id: 'o' + (i + 1), no: 'SIP-' + now.getFullYear() + '-' + String(i + 1).padStart(4, '0'),
        producerId: p.id, date: iso(d.day), status: d.status, note: d.note,
        items: items, total: total, invoiceId: null,
        createdAt: iso(d.day) + 'T09:' + pad(10 + i * 4) + ':00'
      };
    });

    function invoiceFromDef(def, i) {
      const p = producers.find(function (x) { return x.id === def.p; }) || producers[0];
      const items = def.items.map(function (it) {
        const product = products.find(function (x) { return x.id === it[0]; });
        return {
          desc: it[0] === 'milk' ? 'Çiğ İnek Sütü — dönem teslimi' : (product ? product.name : it[0]),
          qty: it[1], unit: it[0] === 'milk' ? 'litre' : (product ? product.unit : 'adet'),
          unitPrice: it[2], vat: it[0] === 'milk' ? 1 : (product ? product.vat : 20)
        };
      });
      let sub = 0, vatTotal = 0;
      items.forEach(function (it) {
        const line = money(it.qty * it.unitPrice);
        it.lineTotal = line;
        sub += line;
        vatTotal += line * it.vat / 100;
      });
      return {
        id: 'inv' + (i + 1), no: (base.settings.invoicePrefix || 'EMP') + '-' + now.getFullYear() + '-' + String(i + 1).padStart(4, '0'),
        date: iso(def.day), type: def.type, status: def.status, partyType: 'Üretici', partyId: p.id,
        partyName: p.name, partyTaxNo: p.taxNo, partyAddress: p.address, note: def.note || '',
        items: items, subtotal: money(sub), vatTotal: money(vatTotal), total: money(sub + vatTotal)
      };
    }
    const invoices = [
      invoiceFromDef({ p: 'p2', day: 24, type: 'Satış', status: 'Ödendi', note: 'Yem satışı.', items: [['pr1', 2, 830], ['pr2', 1, 760]] }, 0),
      invoiceFromDef({ p: 'p6', day: 18, type: 'Satış', status: 'Kesildi', note: 'Kaba yem satışı.', items: [['pr6', 60, 145], ['pr5', 4, 3200]] }, 1),
      invoiceFromDef({ p: 'p3', day: 15, type: 'Alım', status: 'Kesildi', note: 'Dönem süt alımı.', items: [['milk', 1180, settings.milkPrice]] }, 2),
      invoiceFromDef({ p: 'p5', day: 4, type: 'Satış', status: 'Taslak', note: '', items: [['pr1', 3, 830], ['pr8', 1, 340]] }, 3),
      invoiceFromDef({ p: 'p1', day: 2, type: 'Satış', status: 'Ödendi', note: 'Eldiven ve küspe satışı.', items: [['pr7', 2, 210], ['pr4', 3, 380]] }, 4)
    ];

    const payments = [
      { id: 'pay1', producerId: 'p1', date: iso(6), amount: 5000, method: 'Havale', type: 'Avans', note: 'Dönem avansı', createdAt: iso(6) + 'T10:20:00' },
      { id: 'pay2', producerId: 'p6', date: iso(8), amount: 12000, method: 'Havale', type: 'Ödeme', note: 'Tediye bakiyesi', createdAt: iso(8) + 'T11:05:00' },
      { id: 'pay3', producerId: 'p3', date: iso(9), amount: 3500, method: 'Nakit', type: 'Avans', note: '', createdAt: iso(9) + 'T09:35:00' },
      { id: 'pay4', producerId: 'p2', date: iso(2), amount: 7500, method: 'Havale', type: 'Ödeme', note: 'Tediye bakiyesi', createdAt: iso(2) + 'T15:10:00' }
    ];

    const settlements = [];
    let setSeq = 0;
    for (let m = 1; m <= 3; m++) {
      const ym = monthKey(m);
      const start = ym + '-01';
      const end = monthEnd(ym);
      const monthRecords = records.filter(function (r) { return r.date >= start && r.date <= end; });
      producers.forEach(function (p) {
        const prs = monthRecords.filter(function (r) { return r.producerId === p.id; });
        if (!prs.length) return;
        const liters = Math.round(prs.reduce(function (s, r) { return s + r.liters; }, 0) * 10) / 10;
        const gross = money(prs.reduce(function (s, r) { return s + r.amount; }, 0));
        const feedCost = money(prs.reduce(function (s, r) {
          return s + MP.FEEDS.reduce(function (x, f) { return x + (r.feeds[f.key] || 0) * (settings.feedPrices[f.key] || 0); }, 0);
        }, 0));
        const advances = money(payments.filter(function (x) { return x.producerId === p.id && x.date >= start && x.date <= end; }).reduce(function (s, x) { return s + x.amount; }, 0));
        setSeq += 1;
        settlements.push({
          id: 'st' + setSeq, producerId: p.id, periodStart: start, periodEnd: end,
          periodLabel: ymLabel(ym), liters: liters, gross: gross, feedCost: feedCost,
          advances: advances, net: money(gross - feedCost - advances),
          avgPrice: liters ? money(gross / liters) : 0,
          status: m === 1 ? 'Onaylandı' : 'Ödendi',
          receiptNo: 'TDI-' + ym.replace('-', '') + '-' + String(p.sira + 1).padStart(3, '0'),
          createdAt: end + 'T17:00:00', paidAt: m === 1 ? null : end + 'T18:00:00', note: ''
        });
      });
    }

    const routeExtras = [{ id: 'rx1', date: iso(0), collectorId: 'c1', producerId: 'p6', reason: 'Aynı güzergâh — numune teslimi', createdAt: iso(0) + 'T06:10:00' }];
    const producerNotes = [
      { id: 'pn1', producerId: 'p1', date: iso(2), text: 'Sağım ünitesinin contası yenilendi; süt kalitesi takip edilecek.', authorName: 'Ela Yılmaz', createdAt: iso(2) + 'T11:20:00', pinned: true },
      { id: 'pn2', producerId: 'p3', date: iso(5), text: 'Yem ambarındaki nem nedeniyle teslimatlar kapalı alana alınacak.', authorName: 'Cuma Yılmaz', createdAt: iso(5) + 'T09:10:00', pinned: false },
      { id: 'pn3', producerId: 'p6', date: iso(1), text: 'Kışlık yem siparişi için önümüzdeki hafta görüşülecek.', authorName: 'Ela Yılmaz', createdAt: iso(1) + 'T16:40:00', pinned: false }
    ];

    delete settings.createdAt;
    settings.legacyMigration = {
      at: now.toISOString(),
      source: legacy && Array.isArray(legacy.customers) ? 'v1' : 'recovered',
      records: records.length,
      producers: producers.length
    };

    return {
      version: 2,
      createdAt: src.createdAt || now.toISOString(),
      migratedAt: now.toISOString(),
      settings: settings,
      collectors: collectors,
      producers: producers,
      users: users,
      priceLists: priceLists,
      records: records,
      samples: samples,
      tanks: tanks,
      dispatches: dispatches,
      products: products,
      orders: orders,
      invoices: invoices,
      vehicles: vehicles,
      expenses: expenses,
      payments: payments,
      settlements: settlements,
      routeExtras: routeExtras,
      producerNotes: producerNotes
    };
  };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
})();
