/* ============================================================
   MandıraPro — Grafik Motoru (bağımlılıksız SVG)
   ============================================================ */
(function (NS) {
  'use strict';

  let seq = 0;
  const reduceMotion = function () {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  };

  /* ---------------- Mini sparkline ---------------- */
  NS.sparkline = function (el, values, color) {
    if (!el) return;
    values = (values || []).map(Number);
    if (values.length < 2) { el.innerHTML = ''; return; }

    const W = 120, H = 34, pad = 3;
    const min = Math.min.apply(null, values);
    const max = Math.max.apply(null, values);
    const range = (max - min) || 1;
    const x = function (i) { return pad + (W - pad * 2) * i / (values.length - 1); };
    const y = function (v) { return H - pad - ((v - min) / range) * (H - pad * 2); };

    let d = '';
    values.forEach(function (v, i) {
      d += (i === 0 ? 'M' : 'L') + x(i).toFixed(2) + ' ' + y(v).toFixed(2);
    });

    const gid = 'sp' + (++seq);
    const c = color || 'var(--primary-2)';
    el.innerHTML =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" aria-hidden="true">' +
        '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
          '<stop offset="0%" style="stop-color:' + c + ';stop-opacity:.22"/>' +
          '<stop offset="100%" style="stop-color:' + c + ';stop-opacity:0"/>' +
        '</linearGradient></defs>' +
        '<path class="spark-fill" d="' + d + ' L ' + x(values.length - 1) + ' ' + H + ' L ' + x(0) + ' ' + H + ' Z" fill="url(#' + gid + ')" opacity="0"/>' +
        '<path class="spark-line" d="' + d + '" fill="none" style="stroke:' + c + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' +
      '</svg>';

    if (reduceMotion()) {
      const fill = el.querySelector('.spark-fill');
      if (fill) fill.style.opacity = '1';
      return;
    }

    const line = el.querySelector('.spark-line');
    try {
      const len = line.getTotalLength();
      if (len > 0) {
        line.style.strokeDasharray = len;
        line.style.strokeDashoffset = len;
        requestAnimationFrame(function () {
          line.style.transition = 'stroke-dashoffset .9s ease';
          line.style.strokeDashoffset = '0';
          const fill = el.querySelector('.spark-fill');
          if (fill) { fill.style.transition = 'opacity .8s ease .15s'; fill.style.opacity = '1'; }
        });
      }
    } catch (e) { /* yoksay */ }
  };

  /* ---------------- Alan (çizgi) grafiği ---------------- */
  NS.areaChart = function (el, points, opts) {
    if (!el) return;
    opts = opts || {};
    points = (points || []).map(function (p) {
      return { label: String(p.label), value: Number(p.value) || 0 };
    });

    if (!points.length || points.every(function (p) { return !p.value; })) {
      el.innerHTML = '<div class="chart-empty">Bu dönem için veri yok</div>';
      return;
    }

    const W = Math.max(280, Math.min(760, Math.round(el.clientWidth || 760)));
    const narrow = W < 520;
    const H = opts.height || 250;
    const m = { t: 16, r: narrow ? 10 : 18, b: 27, l: narrow ? 38 : 48 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const n = points.length;

    const maxV = Math.max.apply(null, points.map(function (p) { return p.value; }));
    const max = Math.max(1, maxV) * 1.18;
    const x = function (i) { return n <= 1 ? m.l + iw / 2 : m.l + iw * i / (n - 1); };
    const y = function (v) { return m.t + ih - ih * Math.max(0, v) / max; };

    let d = '';
    for (let i = 0; i < n; i++) {
      const px = x(i).toFixed(2);
      const py = y(points[i].value).toFixed(2);
      if (i === 0) {
        d += 'M' + px + ' ' + py;
      } else {
        const px0 = x(i - 1).toFixed(2);
        const py0 = y(points[i - 1].value).toFixed(2);
        const cx = ((x(i - 1) + x(i)) / 2).toFixed(2);
        d += ' C' + cx + ' ' + py0 + ' ' + cx + ' ' + py + ' ' + px + ' ' + py;
      }
    }
    const areaD = d + ' L ' + x(n - 1).toFixed(2) + ' ' + (m.t + ih) + ' L ' + x(0).toFixed(2) + ' ' + (m.t + ih) + ' Z';

    /* Izgara + Y etiketleri */
    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const v = max * i / 4;
      const yy = y(v).toFixed(2);
      grid += '<line x1="' + m.l + '" y1="' + yy + '" x2="' + (W - m.r) + '" y2="' + yy + '" style="stroke:var(--border)" stroke-width="1"' + (i === 0 ? '' : ' stroke-dasharray="3 5"') + '/>';
      grid += '<text x="' + (m.l - 9) + '" y="' + (Number(yy) + 3.5) + '" text-anchor="end" style="fill:var(--faint);font-size:10px">' + NS.fmtCompact(v) + '</text>';
    }

    /* X etiketleri */
    let xlabels = '';
    const step = Math.max(1, Math.ceil(n / (narrow ? 4 : 7)));
    for (let i = 0; i < n; i += step) {
      xlabels += '<text x="' + x(i).toFixed(2) + '" y="' + (H - 7) + '" text-anchor="middle" style="fill:var(--faint);font-size:10px">' + NS.esc(points[i].label) + '</text>';
    }
    const lastShown = Math.floor((n - 1) / step) * step;
    if (lastShown !== n - 1 && (n - 1 - lastShown) >= Math.ceil(step / 2)) {
      xlabels += '<text x="' + x(n - 1).toFixed(2) + '" y="' + (H - 7) + '" text-anchor="middle" style="fill:var(--faint);font-size:10px">' + NS.esc(points[n - 1].label) + '</text>';
    }

    const color = opts.color || 'var(--primary)';
    const gid = 'ag' + (++seq);
    const fmt = opts.valueFmt || function (v) {
      return NS.fmtNum(v, 1) + (opts.unit ? ' ' + opts.unit : '');
    };

    el.innerHTML =
      '<div class="chart-wrap">' +
        '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + NS.esc(opts.aria || 'Grafik') + '">' +
          '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1">' +
            '<stop offset="0%" style="stop-color:' + color + ';stop-opacity:.26"/>' +
            '<stop offset="100%" style="stop-color:' + color + ';stop-opacity:0"/>' +
          '</linearGradient></defs>' +
          grid +
          '<path class="area-fill" d="' + areaD + '" fill="url(#' + gid + ')" opacity="0"/>' +
          '<path class="area-line" d="' + d + '" fill="none" style="stroke:' + color + '" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>' +
          '<g class="hover-g" style="opacity:0;pointer-events:none">' +
            '<line class="hover-line" y1="' + m.t + '" y2="' + (m.t + ih) + '" style="stroke:var(--primary);stroke-width:1;stroke-dasharray:3 4"/>' +
            '<circle class="hover-dot" r="4.6" style="fill:var(--surface);stroke:' + color + ';stroke-width:2.4"/>' +
          '</g>' +
          xlabels +
        '</svg>' +
        '<div class="chart-tip"></div>' +
      '</div>';

    const svg = el.querySelector('svg');
    const tip = el.querySelector('.chart-tip');
    const hoverG = el.querySelector('.hover-g');
    const hoverLine = el.querySelector('.hover-line');
    const hoverDot = el.querySelector('.hover-dot');

    function showPoint(e) {
      const rect = svg.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width * W;
      let idx = Math.round((px - m.l) / iw * (n - 1));
      idx = NS.clamp(idx, 0, n - 1);
      const p = points[idx];
      const cx = x(idx);
      const cy = y(p.value);

      hoverLine.setAttribute('x1', cx);
      hoverLine.setAttribute('x2', cx);
      hoverDot.setAttribute('cx', cx);
      hoverDot.setAttribute('cy', cy);
      hoverG.style.opacity = '1';

      tip.innerHTML = '<b>' + NS.esc(p.label) + '</b><br>' + NS.esc(fmt(p.value));
      tip.style.left = (cx / W * 100) + '%';
      tip.style.top = (cy / H * 100) + '%';
      tip.classList.add('show');
    }
    function hidePoint() {
      hoverG.style.opacity = '0';
      tip.classList.remove('show');
    }
    svg.addEventListener('mousemove', showPoint);
    svg.addEventListener('pointerdown', showPoint);
    svg.addEventListener('pointermove', showPoint);
    svg.addEventListener('mouseleave', hidePoint);
    svg.addEventListener('pointerleave', hidePoint);
    svg.addEventListener('pointercancel', hidePoint);

    if (!reduceMotion()) {
      const line = el.querySelector('.area-line');
      const fill = el.querySelector('.area-fill');
      try {
        const len = line.getTotalLength();
        if (len > 0) {
          line.style.strokeDasharray = len;
          line.style.strokeDashoffset = len;
          requestAnimationFrame(function () {
            line.style.transition = 'stroke-dashoffset 1.05s cubic-bezier(.16,1,.3,1)';
            line.style.strokeDashoffset = '0';
            fill.style.transition = 'opacity .9s ease .15s';
            fill.style.opacity = '1';
          });
        }
      } catch (e) { fill.style.opacity = '1'; }
    } else {
      el.querySelector('.area-fill').style.opacity = '1';
    }
  };

  /* ---------------- Donut ---------------- */
  NS.donut = function (el, segments, opts) {
    if (!el) return;
    opts = opts || {};
    segments = (segments || []).filter(function (s) { return s.value > 0; });
    const total = segments.reduce(function (s, x) { return s + x.value; }, 0);

    if (!total) {
      el.innerHTML = '<div class="chart-empty" style="height:168px;padding:0">Veri yok</div>';
      return;
    }

    let offset = 0;
    const circles = segments.map(function (seg) {
      const pct = seg.value / total * 100;
      const c = '<circle cx="21" cy="21" r="15.9155" fill="none" style="stroke:' + seg.color + '" stroke-width="5.2" stroke-dasharray="0 100" stroke-dashoffset="' + (-offset).toFixed(3) + '" data-target="' + pct.toFixed(3) + ' ' + (100 - pct).toFixed(3) + '">' +
        '<title>' + NS.esc(seg.label) + ': ' + NS.fmtNum(seg.value, 1) + ' kg</title></circle>';
      offset += pct;
      return c;
    }).join('');

    el.innerHTML =
      '<svg viewBox="0 0 42 42" style="transform:rotate(-90deg)" aria-hidden="true">' +
        '<circle cx="21" cy="21" r="15.9155" fill="none" style="stroke:var(--surface-3)" stroke-width="5.2"/>' +
        circles +
      '</svg>' +
      '<div class="donut-center"><b>' + NS.esc(opts.centerValue || '') + '</b><small>' + NS.esc(opts.centerLabel || '') + '</small></div>';

    requestAnimationFrame(function () {
      el.querySelectorAll('circle[data-target]').forEach(function (c) {
        c.style.transition = 'stroke-dasharray .95s cubic-bezier(.16,1,.3,1)';
        c.setAttribute('stroke-dasharray', c.dataset.target);
      });
    });
  };

  /* ---------------- Sütun grafiği ---------------- */
  NS.barChart = function (el, points, opts) {
    if (!el) return;
    opts = opts || {};
    points = (points || []).map(function (p) {
      return { label: String(p.label), value: Number(p.value) || 0, full: p.full || p.label };
    });

    if (!points.length || points.every(function (p) { return !p.value; })) {
      el.innerHTML = '<div class="chart-empty">Bu dönem için veri yok</div>';
      return;
    }

    const W = Math.max(280, Math.min(760, Math.round(el.clientWidth || 760)));
    const narrow = W < 520;
    const H = opts.height || 250;
    const m = { t: 16, r: narrow ? 10 : 18, b: 27, l: narrow ? 38 : 48 };
    const iw = W - m.l - m.r;
    const ih = H - m.t - m.b;
    const n = points.length;
    const maxV = Math.max.apply(null, points.map(function (p) { return p.value; }));
    const max = Math.max(1, maxV) * 1.12;
    const slot = iw / n;
    const bw = Math.max(2, slot * 0.58);

    let grid = '';
    for (let i = 0; i <= 4; i++) {
      const v = max * i / 4;
      const yy = (m.t + ih - ih * v / max).toFixed(2);
      grid += '<line x1="' + m.l + '" y1="' + yy + '" x2="' + (W - m.r) + '" y2="' + yy + '" style="stroke:var(--border)" stroke-width="1"' + (i === 0 ? '' : ' stroke-dasharray="3 5"') + '/>';
      grid += '<text x="' + (m.l - 9) + '" y="' + (Number(yy) + 3.5) + '" text-anchor="end" style="fill:var(--faint);font-size:10px">' + NS.fmtCompact(v) + '</text>';
    }

    let bars = '';
    const labelStep = Math.max(1, Math.ceil(n / (narrow ? 6 : 10)));
    for (let i = 0; i < n; i++) {
      const p = points[i];
      const x = m.l + slot * i + (slot - bw) / 2;
      const h = Math.max(0, ih * p.value / max);
      const y = m.t + ih - h;
      const isHi = opts.highlightIndex === i;
      bars += '<rect class="chart-bar bar-anim' + (isHi ? ' hi' : '') + '" x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" width="' + bw.toFixed(2) + '" height="' + Math.max(h, 0.5).toFixed(2) + '" rx="3" ' +
        'style="fill:' + (isHi ? 'var(--accent)' : (opts.color || 'var(--primary)')) + ';opacity:' + (isHi ? '1' : '.82') + ';transform-box:fill-box;transform-origin:bottom">' +
        '<title>' + NS.esc(p.full) + ' — ' + NS.fmtNum(p.value, 1) + (opts.unit ? ' ' + opts.unit : '') + '</title></rect>';

      if (i % labelStep === 0) {
        bars += '<text x="' + (m.l + slot * i + slot / 2).toFixed(2) + '" y="' + (H - 7) + '" text-anchor="middle" style="fill:var(--faint);font-size:10px">' + NS.esc(p.label) + '</text>';
      }
    }

    el.innerHTML =
      '<div class="chart-wrap"><svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + NS.esc(opts.aria || 'Sütun grafiği') + '">' +
        grid + bars +
      '</svg></div>';
  };

})(window.MPApp);
