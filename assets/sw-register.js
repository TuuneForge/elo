/* ============================================================
   MandıraPro — Service Worker kaydı (PWA / offline)
   ============================================================ */
(function () {
  'use strict';

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js?v=20261025m', { scope: '/' })
        .then(function (registration) {
          // console.log('MandıraPro SW kayıtlı:', registration.scope);
        })
        .catch(function (err) {
          // console.log('MandıraPro SW kayıt hatası:', err);
        });
    });
  }

  // Çevrimiçi / çevrimdışı durumunu global state'e yansıt
  window.addEventListener('online', function () {
    document.body.classList.remove('offline');
    document.body.classList.add('online');
    if (window.MPApp && window.MPApp.state && window.MPApp.state.db) {
      // Kuyruktaki işlemleri senkronize etmeye çalış
      if (typeof window.MPApp.syncPending === 'function') {
        window.MPApp.syncPending();
      }
    }
  });

  window.addEventListener('offline', function () {
    document.body.classList.remove('online');
    document.body.classList.add('offline');
  });

  // İlk yükleme durumunu ayarla
  if (!navigator.onLine) {
    document.body.classList.add('offline');
  } else {
    document.body.classList.add('online');
  }
})();