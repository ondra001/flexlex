/* FlexLex — theme switching.
 *
 * Load this in <head>, BEFORE any stylesheet paints, so a dark-mode visitor
 * never gets a white flash. It is deliberately tiny and synchronous.
 *
 * Order of precedence: the visitor's saved choice, then their OS setting.
 * "system" is a real, resettable state — not just "whatever we guessed".
 */
(function () {
  var KEY = 'flexlex-theme';

  function saved() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  /* Applied immediately, before first paint. */
  var pref = saved();
  if (pref === 'dark' || pref === 'light') {
    document.documentElement.setAttribute('data-theme', pref);
  }

  function systemIsDark() {
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  /* What the visitor is actually looking at right now. */
  function active() {
    var set = document.documentElement.getAttribute('data-theme');
    if (set) return set;
    return systemIsDark() ? 'dark' : 'light';
  }

  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem(KEY, theme); } catch (e) { /* private mode — fine */ }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#16150F' : '#FBF7EC');
  }

  window.FlexLexTheme = {
    active: active,
    toggle: function () {
      apply(active() === 'dark' ? 'light' : 'dark');
    },
    /* Wire up every .theme-btn on the page. Safe to call more than once. */
    mount: function () {
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', active() === 'dark' ? '#16150F' : '#FBF7EC');

      document.querySelectorAll('.theme-btn').forEach(function (btn) {
        if (btn.dataset.mounted) return;
        btn.dataset.mounted = '1';
        btn.setAttribute('aria-label', 'Switch theme');
        btn.addEventListener('click', function () {
          window.FlexLexTheme.toggle();
          btn.setAttribute('aria-label', 'Switch theme');
        });
      });
    }
  };

  /* Follow the OS while the visitor hasn't expressed a preference. */
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function () {
      if (!saved()) {
        document.documentElement.removeAttribute('data-theme');
        var meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', systemIsDark() ? '#16150F' : '#FBF7EC');
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.FlexLexTheme.mount(); });
  } else {
    window.FlexLexTheme.mount();
  }
})();
