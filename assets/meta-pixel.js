(function (w, d, s, u) {
  if (w.fbq) return;
  var n = w.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  };
  if (!w._fbq) w._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];
  var t = d.createElement(s);
  t.async = true;
  t.src = u;
  var x = d.getElementsByTagName(s)[0];
  x.parentNode.insertBefore(t, x);
})(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

fbq('init', '1421154963204117');
fbq('track', 'PageView');

window.wgTrackContact = function () {
  if (typeof fbq === 'function') fbq('track', 'Contact');
  if (typeof gtag === 'function') gtag('event', 'contact_click', { event_category: 'engagement', event_label: 'zalo' });
};
window.wgTrackLead = function () {
  var success = document.getElementById('success');
  if (success && success.dataset.metaLeadTracked === '1') return;
  if (success) success.dataset.metaLeadTracked = '1';
  if (typeof fbq === 'function') fbq('track', 'Lead');
  if (typeof gtag === 'function') gtag('event', 'generate_lead', { event_category: 'conversion', event_label: 'import_landing_form' });
};

(function () {
  function trackContact() {
    window.wgTrackContact();
  }
  function trackLead() {
    window.wgTrackLead();
  }
  function init() {
    if (!document.getElementById('wg-zalo-button')) {
      var zalo = document.createElement('a');
      zalo.id = 'wg-zalo-button';
      zalo.href = 'https://zalo.me/0339952005';
      zalo.target = '_blank';
      zalo.rel = 'noopener noreferrer';
      zalo.setAttribute('aria-label', 'Nhắn tin với White Glove qua Zalo');
      zalo.innerHTML = '<img src="https://commons.wikimedia.org/wiki/Special:FilePath/Icon_of_Zalo.svg" alt="" width="36" height="36" style="display:block;width:36px;height:36px;border-radius:10px;background:#fff;padding:2px;"><span>Nhắn Zalo</span>';
      zalo.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9999;display:flex;align-items:center;gap:10px;background:#b18a52;color:#fff;padding:14px 22px;border:1px solid rgba(255,255,255,.55);border-radius:999px;box-shadow:0 12px 30px rgba(35,28,19,.24);font:700 16px/1.1 Arial,sans-serif;text-decoration:none;min-height:64px;';
      zalo.addEventListener('click', trackContact);
      document.body.appendChild(zalo);
    }
    document.querySelectorAll('a[href^="tel:"], a[href^="mailto:"], a[href*="zalo.me"]:not(#wg-zalo-button)').forEach(function (el) {
      el.addEventListener('click', trackContact);
    });
    var success = document.getElementById('success');
    if (success) {
      new MutationObserver(function () {
        if (success.style.display === 'block') trackLead();
      }).observe(success, { attributes: true, attributeFilter: ['style'] });
      if (success.style.display === 'block') trackLead();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
