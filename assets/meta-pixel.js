(function (w, d, s, u, id) {
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
})(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js', '1421154963204117');

fbq('init', '1421154963204117');
fbq('track', 'PageView');

(function () {
  function trackContact() {
    fbq('track', 'Contact', { content_name: 'website_contact_click' });
  }
  function trackLead() {
    var success = document.getElementById('success');
    if (!success || success.dataset.metaLeadTracked === '1') return;
    success.dataset.metaLeadTracked = '1';
    fbq('track', 'Lead', { content_name: 'quote_request' });
  }
  function init() {
    if (!document.getElementById('wg-zalo-button')) {
      var zalo = document.createElement('a');
      zalo.id = 'wg-zalo-button';
      zalo.href = 'https://zalo.me/0339952005';
      zalo.target = '_blank';
      zalo.rel = 'noopener noreferrer';
      zalo.setAttribute('aria-label', 'Nhắn tin với White Glove qua Zalo');
      zalo.textContent = '💬 Zalo';
      zalo.style.cssText = 'position:fixed;right:20px;bottom:20px;z-index:9999;display:flex;align-items:center;gap:8px;background:#0068ff;color:#fff;padding:12px 16px;border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.2);font:600 14px/1.1 Arial,sans-serif;text-decoration:none;';
      zalo.addEventListener('click', function () {
        fbq('track', 'Contact', { content_name: 'zalo_button' });
        if (typeof gtag === 'function') gtag('event', 'whatsapp_click', { event_category: 'contact', event_label: 'floating_zalo_button' });
      });
      document.body.appendChild(zalo);
    }
    document.querySelectorAll('a[href^="tel:"], a[href^="mailto:"], a[href*="zalo.me"]').forEach(function (el) {
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
