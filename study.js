/* FlexLex — in-browser study overlay.
 *
 * A taster, not the app: Flashcards + Write over a word list that is already
 * in memory on the calling page. Deliberately has no storage, no scoring
 * history, and no SRS — those live in the app, and the results screen points
 * there.
 *
 * Used by:
 *   /create — study the set you're building, before you've shared it.
 *   /s      — study a set someone shared with you, before installing.
 *
 * Both callers already hold the pairs, so this module never decodes a link,
 * never touches the network, and never persists anything.
 *
 * Usage:  FlexLexStudy.open({ name, src, tgt, pairs: [{word, translation}] })
 *
 * Word data can come from a stranger's URL fragment, so every user string is
 * written with textContent — never innerHTML.
 */
(function () {
  'use strict';

  var PLAY_URL =
    'https://play.google.com/store/apps/details?id=com.flexlex.app';

  var CSS = [
    '.flx-study{position:fixed;inset:0;z-index:9999;background:#10121a;',
    'color:#e4e6ef;display:flex;flex-direction:column;overflow-y:auto;',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;',
    'line-height:1.5;-webkit-tap-highlight-color:transparent}',
    '.flx-study *{box-sizing:border-box;margin:0;padding:0}',
    '.flx-study__bar{display:flex;align-items:center;gap:12px;padding:16px 20px;',
    'border-bottom:1px solid rgba(255,255,255,0.08);position:sticky;top:0;',
    'background:#10121a;z-index:2}',
    '.flx-study__title{font-weight:800;letter-spacing:-0.3px;font-size:1rem;',
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1}',
    '.flx-study__sub{color:#8a8fa8;font-size:0.85rem;white-space:nowrap}',
    '.flx-study__x{flex:none;width:36px;height:36px;border-radius:8px;',
    'background:#1c1f2e;border:1px solid rgba(255,255,255,0.08);color:#8a8fa8;',
    'cursor:pointer;font-family:inherit;display:flex;align-items:center;',
    'justify-content:center}',
    '.flx-study__x:hover{color:#e4e6ef}',
    '.flx-study__body{flex:1;width:100%;max-width:640px;margin:0 auto;',
    'padding:24px 20px 40px;display:flex;flex-direction:column}',

    /* mode picker */
    '.flx-pick{display:flex;flex-direction:column;gap:14px;margin:auto 0}',
    '.flx-pick h2{font-size:1.5rem;letter-spacing:-0.5px;margin-bottom:2px}',
    '.flx-pick p.lead{color:#8a8fa8;margin-bottom:10px}',
    '.flx-mode{display:flex;align-items:center;gap:16px;text-align:left;',
    'padding:18px;border-radius:20px;background:#161923;cursor:pointer;',
    'border:1px solid rgba(255,255,255,0.08);color:inherit;font-family:inherit;',
    'width:100%;transition:border-color .15s,transform .1s}',
    '.flx-mode:hover:not(:disabled){border-color:#5ea3f8;transform:translateY(-1px)}',
    '.flx-mode:disabled{opacity:0.45;cursor:not-allowed}',
    '.flx-mode__ic{flex:none;width:48px;height:48px;border-radius:14px;',
    'display:flex;align-items:center;justify-content:center;font-size:1.4rem}',
    '.flx-mode__t{font-weight:800;font-size:1.05rem}',
    '.flx-mode__d{color:#8a8fa8;font-size:0.88rem}',
    '.flx-opt{display:flex;align-items:center;justify-content:space-between;',
    'gap:12px;padding:14px 18px;border-radius:12px;background:#161923;',
    'border:1px solid rgba(255,255,255,0.08);margin-top:4px}',
    '.flx-opt__l{font-size:0.9rem}',
    '.flx-opt__h{color:#8a8fa8;font-size:0.8rem;margin-top:2px}',
    '.flx-swap{flex:none;padding:9px 14px;border-radius:8px;background:#1c1f2e;',
    'border:1px solid rgba(255,255,255,0.08);color:#e4e6ef;cursor:pointer;',
    'font-weight:700;font-size:0.85rem;font-family:inherit;white-space:nowrap;',
    'display:inline-flex;align-items:center;gap:7px}',
    '.flx-swap:hover{border-color:#5ea3f8}',
    '.flx-swap[aria-pressed="true"]{background:rgba(94,163,248,0.15);',
    'border-color:#5ea3f8;color:#5ea3f8}',

    /* progress */
    '.flx-prog{height:6px;border-radius:99px;background:#1c1f2e;overflow:hidden;',
    'margin-bottom:20px;flex:none}',
    '.flx-prog__f{height:100%;border-radius:99px;background:linear-gradient(',
    '90deg,#5ea3f8,#a07cec);width:0;transition:width .25s ease}',

    /* flashcard */
    '.flx-card{perspective:1400px;flex:1;min-height:260px;margin-bottom:20px;',
    'cursor:pointer;border:none;background:none;padding:0;width:100%;',
    'font-family:inherit;color:inherit;display:block}',
    '.flx-card__in{position:relative;width:100%;height:100%;min-height:260px;',
    'transition:transform .45s cubic-bezier(.2,.8,.2,1);transform-style:preserve-3d}',
    '.flx-card.is-flipped .flx-card__in{transform:rotateY(180deg)}',
    '.flx-card__f,.flx-card__b{position:absolute;inset:0;display:flex;',
    'flex-direction:column;align-items:center;justify-content:center;gap:10px;',
    'padding:28px;border-radius:20px;backface-visibility:hidden;',
    '-webkit-backface-visibility:hidden;border:1px solid rgba(255,255,255,0.08);',
    'background:#161923;text-align:center;overflow-y:auto}',
    '.flx-card__b{transform:rotateY(180deg);',
    'background:linear-gradient(145deg,#1c1f2e,#191d2b);border-color:rgba(94,163,248,0.35)}',
    '.flx-card__txt{font-size:clamp(1.4rem,5vw,2rem);font-weight:800;',
    'letter-spacing:-0.5px;overflow-wrap:anywhere}',
    '.flx-card__hint{color:#8a8fa8;font-size:0.8rem}',
    '.flx-card__side{color:#8a8fa8;font-size:0.72rem;text-transform:uppercase;',
    'letter-spacing:1px;font-weight:700}',
    '.flx-nav{display:flex;gap:12px;align-items:center;flex:none}',
    '.flx-nav__b{flex:1;padding:14px;border-radius:12px;background:#1c1f2e;',
    'border:1px solid rgba(255,255,255,0.08);color:#e4e6ef;cursor:pointer;',
    'font-weight:700;font-size:0.95rem;font-family:inherit}',
    '.flx-nav__b:hover:not(:disabled){border-color:#5ea3f8}',
    '.flx-nav__b:disabled{opacity:0.35;cursor:not-allowed}',

    /* write */
    '.flx-w{display:flex;flex-direction:column;flex:1}',
    '.flx-w__card{background:#161923;border:1px solid rgba(255,255,255,0.08);',
    'border-radius:20px;padding:28px;text-align:center;margin-bottom:16px}',
    '.flx-w__ask{color:#8a8fa8;font-size:0.78rem;text-transform:uppercase;',
    'letter-spacing:1px;font-weight:700;margin-bottom:10px}',
    '.flx-w__word{font-size:clamp(1.4rem,5vw,2rem);font-weight:800;',
    'letter-spacing:-0.5px;overflow-wrap:anywhere}',
    '.flx-w__in{width:100%;padding:15px;border-radius:12px;background:#1c1f2e;',
    'border:1px solid rgba(255,255,255,0.08);color:#e4e6ef;font-size:1.05rem;',
    'font-family:inherit;text-align:center}',
    '.flx-w__in:focus{outline:none;border-color:#5ea3f8}',
    '.flx-w__in:disabled{opacity:0.7}',
    '.flx-w__in.is-ok{border-color:#4ad66d}',
    '.flx-w__in.is-no{border-color:#f06060}',
    '.flx-fb{min-height:52px;margin-top:12px;font-size:0.92rem;',
    'display:flex;flex-direction:column;gap:2px;justify-content:center}',
    '.flx-fb__ok{color:#4ad66d;font-weight:700}',
    '.flx-fb__no{color:#f06060;font-weight:700}',
    '.flx-fb__near{color:#f5a742;font-weight:700}',
    '.flx-fb__ans{color:#8a8fa8}',
    '.flx-fb__ans b{color:#e4e6ef}',

    /* results */
    '.flx-res{margin:auto 0;text-align:center}',
    '.flx-res__pc{font-size:3.4rem;font-weight:800;letter-spacing:-2px;',
    'background:linear-gradient(90deg,#5ea3f8,#a07cec,#3dd6c8);',
    '-webkit-background-clip:text;background-clip:text;color:transparent}',
    '.flx-res__s{color:#8a8fa8;margin-bottom:24px}',
    '.flx-res__ic{color:#4ad66d;display:flex;justify-content:center;',
    'margin-bottom:10px}',
    '.flx-res__cta{background:#161923;border:1px solid rgba(255,255,255,0.08);',
    'border-radius:20px;padding:22px;margin-bottom:16px;text-align:left}',
    '.flx-res__cta h3{font-size:1.05rem;margin-bottom:6px}',
    '.flx-res__cta p{color:#8a8fa8;font-size:0.9rem;margin-bottom:14px}',
    '.flx-btn{display:block;width:100%;padding:14px 20px;border-radius:12px;',
    'font-weight:700;font-size:1rem;border:none;cursor:pointer;',
    'text-align:center;text-decoration:none;font-family:inherit;margin-bottom:10px}',
    '.flx-btn--p{background:linear-gradient(135deg,#5ea3f8,#a07cec);color:#fff;',
    'box-shadow:0 8px 24px rgba(94,163,248,0.25)}',
    '.flx-btn--g{background:#1c1f2e;color:#e4e6ef;',
    'border:1px solid rgba(255,255,255,0.08)}',
    '.flx-miss{text-align:left;margin-top:8px}',
    '.flx-miss h4{font-size:0.78rem;text-transform:uppercase;letter-spacing:1px;',
    'color:#8a8fa8;margin-bottom:8px}',
    '.flx-miss__r{display:flex;justify-content:space-between;gap:16px;',
    'padding:11px 0;border-bottom:1px solid rgba(255,255,255,0.08);font-size:0.92rem}',
    '.flx-miss__r:last-child{border-bottom:none}',
    '.flx-miss__t{color:#8a8fa8;text-align:right}',
    '@media(prefers-reduced-motion:reduce){.flx-study *{transition:none!important}}'
  ].join('');

  function injectCss() {
    if (document.getElementById('flx-study-css')) return;
    var s = document.createElement('style');
    s.id = 'flx-study-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* Inline stroke icons — no icon font, no network, inherit currentColor.
   * 24×24 grid, 1.6 stroke, round caps. */
  var ICONS = {
    cards:
      '<rect x="2.75" y="7.25" width="12.5" height="14" rx="2.5"/>' +
      '<path d="M7.5 4.25h9.25a2.5 2.5 0 0 1 2.5 2.5v10"/>',
    pen:
      '<path d="M4 20.25h3.9L18.6 9.55a2.76 2.76 0 0 0-3.9-3.9L4 16.35v3.9z"/>' +
      '<path d="M13.9 6.45l3.9 3.9"/>',
    check:
      '<circle cx="12" cy="12" r="9.25"/><path d="M7.75 12.4l2.9 2.9 5.6-5.6"/>',
    close: '<path d="M6.25 6.25l11.5 11.5M17.75 6.25L6.25 17.75"/>',
    swap:
      '<path d="M4 8.5h13M13.5 5l3.5 3.5-3.5 3.5"/>' +
      '<path d="M20 15.5H7M10.5 12L7 15.5l3.5 3.5"/>'
  };

  function icon(name, size) {
    var s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24');
    s.setAttribute('width', size || 22);
    s.setAttribute('height', size || 22);
    s.setAttribute('fill', 'none');
    s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.6');
    s.setAttribute('stroke-linecap', 'round');
    s.setAttribute('stroke-linejoin', 'round');
    s.setAttribute('aria-hidden', 'true');
    // Static author-written markup only — never user data.
    s.innerHTML = ICONS[name] || '';
    return s;
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text; // never innerHTML — untrusted words
    return n;
  }

  function shuffled(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ── answer checking ───────────────────────────────────────────────────
   * Lenient on the things that aren't the point (case, spacing, an article
   * the set didn't ask for), strict on the thing that is (the word). Accents
   * are graded as "nearly" rather than wrong: marking `cafe` a failure
   * teaches nothing, but silently accepting it hides a real spelling.
   */
  function norm(s) {
    return (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function bare(s) {
    // NFD splits é into e + U+0301, which the range below then strips.
    return norm(s).normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  // "the cat / a cat" and "der Hund, das Tier" both offer several answers.
  function alternatives(expected) {
    return expected
      .split(/[\/,;]|\bor\b/)
      .map(function (s) { return s.trim(); })
      .filter(Boolean);
  }

  // → 'ok' | 'near' (right word, wrong accents) | 'no'
  function grade(input, expected) {
    var alts = alternatives(expected);
    if (!alts.length) alts = [expected];
    var i;
    for (i = 0; i < alts.length; i++) {
      if (norm(input) === norm(alts[i])) return 'ok';
    }
    for (i = 0; i < alts.length; i++) {
      if (bare(input) && bare(input) === bare(alts[i])) return 'near';
    }
    return 'no';
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent || '');
  }

  var FlexLexStudy = {
    open: function (set) {
      injectCss();

      var all = (set.pairs || [])
        .map(function (p) {
          return {
            word: (p.word || '').trim(),
            translation: (p.translation || '').trim()
          };
        })
        .filter(function (p) { return p.word || p.translation; });

      if (!all.length) return;

      // Reversed so the prompt is the language you're recalling *into*.
      var flipped = false;
      var overlay = el('div', 'flx-study');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Study ' + (set.name || 'set'));

      var lastFocus = document.activeElement;
      var scrollY = window.scrollY;
      document.body.style.overflow = 'hidden';

      // ── chrome ──────────────────────────────────────────────────────────
      var bar = el('div', 'flx-study__bar');
      var title = el('div', 'flx-study__title', set.name || 'Study');
      var sub = el('div', 'flx-study__sub');
      var x = el('button', 'flx-study__x');
      x.appendChild(icon('close', 18));
      x.type = 'button';
      x.setAttribute('aria-label', 'Close study');
      bar.appendChild(title);
      bar.appendChild(sub);
      bar.appendChild(x);

      var body = el('div', 'flx-study__body');
      overlay.appendChild(bar);
      overlay.appendChild(body);

      var onKey = null;

      function close() {
        if (onKey) document.removeEventListener('keydown', onKey);
        document.body.style.overflow = '';
        overlay.remove();
        window.scrollTo(0, scrollY);
        if (lastFocus && lastFocus.focus) lastFocus.focus();
      }
      x.addEventListener('click', close);

      function setKeys(handler) {
        if (onKey) document.removeEventListener('keydown', onKey);
        onKey = function (e) {
          if (e.key === 'Escape') { close(); return; }
          if (handler) handler(e);
        };
        document.addEventListener('keydown', onKey);
      }

      function clear() { body.innerHTML = ''; sub.textContent = ''; }

      function promptOf(p) { return flipped ? p.translation : p.word; }
      function answerOf(p) { return flipped ? p.word : p.translation; }

      // ── mode picker ─────────────────────────────────────────────────────
      function pick() {
        clear();
        setKeys(null);

        var wrap = el('div', 'flx-pick');
        wrap.appendChild(el('h2', null, 'Study this set'));

        var langs = [set.src, set.tgt].filter(Boolean).join(' → ');
        wrap.appendChild(el('p', 'lead',
          all.length + (all.length === 1 ? ' word' : ' words') +
          (langs ? ' · ' + langs : '')));

        // Write needs both sides; the builder allows a word with no
        // translation, so a half-filled set can flashcard but not type.
        var typeable = all.filter(function (p) {
          return p.word && p.translation;
        });

        var fc = el('button', 'flx-mode');
        fc.type = 'button';
        var fcIc = el('div', 'flx-mode__ic');
        fcIc.appendChild(icon('cards'));
        fcIc.style.background = 'rgba(94,163,248,0.12)';
        fcIc.style.color = '#5ea3f8';
        var fcTx = el('div');
        fcTx.appendChild(el('div', 'flx-mode__t', 'Flashcards'));
        fcTx.appendChild(el('div', 'flx-mode__d', 'Flip through every word at your own pace'));
        fc.appendChild(fcIc); fc.appendChild(fcTx);
        fc.addEventListener('click', function () { flashcards(); });
        wrap.appendChild(fc);

        var wr = el('button', 'flx-mode');
        wr.type = 'button';
        var wrIc = el('div', 'flx-mode__ic');
        wrIc.appendChild(icon('pen'));
        wrIc.style.background = 'rgba(160,124,236,0.12)';
        wrIc.style.color = '#a07cec';
        var wrTx = el('div');
        wrTx.appendChild(el('div', 'flx-mode__t', 'Write'));
        wrTx.appendChild(el('div', 'flx-mode__d',
          typeable.length
            ? 'Type each translation and get it checked'
            : 'Needs both sides filled in'));
        wr.appendChild(wrIc); wr.appendChild(wrTx);
        wr.disabled = typeable.length === 0;
        wr.addEventListener('click', function () { write(typeable); });
        wrap.appendChild(wr);

        var opt = el('div', 'flx-opt');
        var optL = el('div');
        optL.appendChild(el('div', 'flx-opt__l', 'Ask me in'));
        var dir = el('div', 'flx-opt__h');
        optL.appendChild(dir);
        var swap = el('button', 'flx-swap');
        swap.type = 'button';
        swap.appendChild(icon('swap', 16));
        swap.appendChild(el('span', null, 'Swap'));
        function paintDir() {
          var a = flipped ? (set.tgt || 'translation') : (set.src || 'word');
          var b = flipped ? (set.src || 'word') : (set.tgt || 'translation');
          dir.textContent = a + ' → ' + b;
          swap.setAttribute('aria-pressed', flipped ? 'true' : 'false');
        }
        paintDir();
        swap.addEventListener('click', function () {
          flipped = !flipped;
          paintDir();
        });
        opt.appendChild(optL); opt.appendChild(swap);
        wrap.appendChild(opt);

        body.appendChild(wrap);
      }

      // ── flashcards ──────────────────────────────────────────────────────
      function flashcards() {
        clear();
        var deck = all.slice();
        var i = 0;
        var isFlipped = false;

        var prog = el('div', 'flx-prog');
        var fill = el('div', 'flx-prog__f');
        prog.appendChild(fill);

        var card = el('button', 'flx-card');
        card.type = 'button';
        card.setAttribute('aria-label', 'Flip card');
        var inner = el('div', 'flx-card__in');
        var front = el('div', 'flx-card__f');
        var back = el('div', 'flx-card__b');
        inner.appendChild(front); inner.appendChild(back);
        card.appendChild(inner);

        var fSide = el('div', 'flx-card__side');
        var fTxt = el('div', 'flx-card__txt');
        var fHint = el('div', 'flx-card__hint', 'Tap to reveal');
        front.appendChild(fSide); front.appendChild(fTxt); front.appendChild(fHint);

        var bSide = el('div', 'flx-card__side');
        var bTxt = el('div', 'flx-card__txt');
        back.appendChild(bSide); back.appendChild(bTxt);

        var nav = el('div', 'flx-nav');
        var prev = el('button', 'flx-nav__b', 'Previous');
        prev.type = 'button';
        var next = el('button', 'flx-nav__b', 'Next');
        next.type = 'button';
        var sh = el('button', 'flx-nav__b', 'Shuffle');
        sh.type = 'button';
        sh.style.flex = 'none';
        sh.style.padding = '14px 16px';
        nav.appendChild(prev); nav.appendChild(sh); nav.appendChild(next);

        function paint() {
          var p = deck[i];
          fSide.textContent = flipped ? (set.tgt || 'Translation') : (set.src || 'Word');
          bSide.textContent = flipped ? (set.src || 'Word') : (set.tgt || 'Translation');
          fTxt.textContent = promptOf(p) || '—';
          bTxt.textContent = answerOf(p) || '—';
          sub.textContent = (i + 1) + ' / ' + deck.length;
          fill.style.width = (((i + 1) / deck.length) * 100) + '%';
          prev.disabled = i === 0;
          next.textContent = i === deck.length - 1 ? 'Done' : 'Next';
          // Reset the flip without animating back mid-swipe.
          isFlipped = false;
          card.classList.remove('is-flipped');
        }

        function flip() {
          isFlipped = !isFlipped;
          card.classList.toggle('is-flipped', isFlipped);
        }

        card.addEventListener('click', flip);
        prev.addEventListener('click', function () {
          if (i > 0) { i--; paint(); }
        });
        next.addEventListener('click', function () {
          if (i < deck.length - 1) { i++; paint(); }
          else results(null, 'flashcards');
        });
        sh.addEventListener('click', function () {
          deck = shuffled(deck); i = 0; paint();
        });

        setKeys(function (e) {
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); flip(); }
          else if (e.key === 'ArrowRight') {
            if (i < deck.length - 1) { i++; paint(); }
          } else if (e.key === 'ArrowLeft') {
            if (i > 0) { i--; paint(); }
          }
        });

        body.appendChild(prog);
        body.appendChild(card);
        body.appendChild(nav);
        paint();
      }

      // ── write ───────────────────────────────────────────────────────────
      function write(pool) {
        clear();
        var deck = shuffled(pool); // a test, so order shouldn't be learnable
        var i = 0;
        var score = 0;
        var missed = [];
        var answered = false;

        var prog = el('div', 'flx-prog');
        var fill = el('div', 'flx-prog__f');
        prog.appendChild(fill);

        var wrap = el('div', 'flx-w');
        var qCard = el('div', 'flx-w__card');
        var ask = el('div', 'flx-w__ask');
        var word = el('div', 'flx-w__word');
        qCard.appendChild(ask); qCard.appendChild(word);

        var input = el('input', 'flx-w__in');
        input.type = 'text';
        input.autocomplete = 'off';
        input.autocapitalize = 'off';
        input.spellcheck = false;
        input.setAttribute('aria-label', 'Your answer');

        var fb = el('div', 'flx-fb');
        fb.setAttribute('role', 'status');
        fb.setAttribute('aria-live', 'polite');

        var go = el('button', 'flx-btn flx-btn--p', 'Check');
        go.type = 'button';
        go.style.marginTop = '14px';
        var skip = el('button', 'flx-btn flx-btn--g', "I don't know");
        skip.type = 'button';

        wrap.appendChild(qCard);
        wrap.appendChild(input);
        wrap.appendChild(fb);
        wrap.appendChild(go);
        wrap.appendChild(skip);

        function paint() {
          var p = deck[i];
          ask.textContent = 'Write this in ' +
            (flipped ? (set.src || 'the other language')
                     : (set.tgt || 'the other language'));
          word.textContent = promptOf(p);
          input.value = '';
          input.disabled = false;
          input.className = 'flx-w__in';
          fb.textContent = '';
          go.textContent = 'Check';
          skip.style.display = '';
          answered = false;
          sub.textContent = (i + 1) + ' / ' + deck.length;
          fill.style.width = ((i / deck.length) * 100) + '%';
          input.focus();
        }

        function showAnswer(kind, expected) {
          fb.textContent = '';
          var head = el('div',
            kind === 'ok' ? 'flx-fb__ok' : kind === 'near' ? 'flx-fb__near' : 'flx-fb__no',
            kind === 'ok' ? 'Correct'
              : kind === 'near' ? 'Nearly — mind the accents'
              : 'Not quite');
          fb.appendChild(head);
          if (kind !== 'ok') {
            var line = el('div', 'flx-fb__ans');
            line.appendChild(document.createTextNode('Answer: '));
            line.appendChild(el('b', null, expected));
            fb.appendChild(line);
          }
        }

        function advance() {
          if (i < deck.length - 1) { i++; paint(); }
          else {
            fill.style.width = '100%';
            results({ score: score, total: deck.length, missed: missed }, 'write');
          }
        }

        function check(gaveUp) {
          var p = deck[i];
          var expected = answerOf(p);

          if (answered) { advance(); return; }

          var kind = gaveUp ? 'no' : grade(input.value, expected);
          if (!gaveUp && !input.value.trim()) return; // empty ≠ a guess

          // "Nearly" counts — the word was recalled; the accent is a note.
          if (kind === 'ok' || kind === 'near') score++;
          else missed.push({ q: promptOf(p), a: expected });

          input.disabled = true;
          input.classList.add(kind === 'no' ? 'is-no' : 'is-ok');
          showAnswer(kind, expected);
          answered = true;
          go.textContent = i === deck.length - 1 ? 'See results' : 'Next';
          skip.style.display = 'none';
          go.focus();
        }

        go.addEventListener('click', function () { check(false); });
        skip.addEventListener('click', function () { check(true); });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); check(false); }
        });

        setKeys(function (e) {
          if (e.key === 'Enter' && answered) { e.preventDefault(); advance(); }
        });

        body.appendChild(prog);
        body.appendChild(wrap);
        paint();
      }

      // ── results ─────────────────────────────────────────────────────────
      function results(stats, mode) {
        clear();
        setKeys(null);

        var wrap = el('div', 'flx-res');

        if (stats) {
          var pc = Math.round((stats.score / stats.total) * 100);
          wrap.appendChild(el('div', 'flx-res__pc', pc + '%'));
          wrap.appendChild(el('p', 'flx-res__s',
            stats.score + ' of ' + stats.total + ' correct'));
        } else {
          var done = el('div', 'flx-res__ic');
          done.appendChild(icon('check', 56));
          wrap.appendChild(done);
          wrap.appendChild(el('p', 'flx-res__s',
            'That’s every card in this set.'));
        }

        var cta = el('div', 'flx-res__cta');
        cta.appendChild(el('h3', null, 'Keep going in the app'));
        cta.appendChild(el('p', null,
          'This page is just a taster. FlexLex has nine study modes, spaced ' +
          'repetition that schedules your reviews, streaks, and offline ' +
          'access — and it remembers your progress.'));
        var get = el('a', 'flx-btn flx-btn--p', 'Get FlexLex on Google Play');
        get.href = PLAY_URL;
        get.target = '_blank';
        get.rel = 'noopener';
        cta.appendChild(get);
        wrap.appendChild(cta);

        var again = el('button', 'flx-btn flx-btn--g',
          mode === 'write' ? 'Try again' : 'Study again');
        again.type = 'button';
        again.addEventListener('click', pick);
        wrap.appendChild(again);

        var done = el('button', 'flx-btn flx-btn--g', 'Close');
        done.type = 'button';
        done.addEventListener('click', close);
        wrap.appendChild(done);

        if (stats && stats.missed.length) {
          var m = el('div', 'flx-miss');
          m.appendChild(el('h4', null, 'Worth another look'));
          stats.missed.forEach(function (r) {
            var row = el('div', 'flx-miss__r');
            row.appendChild(el('span', null, r.q));
            row.appendChild(el('span', 'flx-miss__t', r.a));
            m.appendChild(row);
          });
          wrap.appendChild(m);
        }

        body.appendChild(wrap);
      }

      document.body.appendChild(overlay);
      pick();
      x.focus();
    }
  };

  window.FlexLexStudy = FlexLexStudy;
  window.FlexLexStudyIsAndroid = isAndroid;
})();
