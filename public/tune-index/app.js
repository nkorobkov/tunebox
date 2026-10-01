// Progressive enhancement shared by the standalone tune-index pages
// (public/{portland-collection,foinn-seisiun}/index.html, generated via
// scripts/lib/tune-index-page.mjs). The tune list is fully static HTML;
// this script adds search/filter/sort over the cards' data attributes and
// lazy-loads abcjs + the page's ABC payload (#list[data-abc]) on the first
// "Sheet music" click.
(function () {
  'use strict';

  var list = document.getElementById('list');
  var cards = Array.prototype.slice.call(list.querySelectorAll('.tune'));
  var controls = document.getElementById('controls');
  var emptyEl = document.getElementById('empty');
  var countEl = document.getElementById('count');
  var q = document.getElementById('q');
  var bookSel = document.getElementById('book'); // optional
  var typeSel = document.getElementById('type');
  var availSel = document.getElementById('avail'); // optional
  var sortSel = document.getElementById('sort');

  var tunes = cards.map(function (el) {
    return {
      el: el,
      name: el.getAttribute('data-n'),
      // Also searchable: the tune's name on thesession, when it differs.
      search: el.getAttribute('data-n') + ' ' + (el.getAttribute('data-s') || ''),
      // Position in the books, when the page has page numbers.
      order: el.hasAttribute('data-o') ? Number(el.getAttribute('data-o')) : null,
      book: el.getAttribute('data-b'),
      type: el.getAttribute('data-t'),
      hasAbc: el.getAttribute('data-a') === '1',
      hasUrl: el.getAttribute('data-l') === '1',
    };
  });

  // ---- search / filter / sort ----
  function apply() {
    var term = q.value.trim().toLowerCase();
    var bk = bookSel ? bookSel.value : '', tp = typeSel.value, av = availSel ? availSel.value : '', so = sortSel.value;

    var visible = tunes.filter(function (t) {
      if (term && t.search.indexOf(term) === -1) return false;
      if (bk && t.book !== bk) return false;
      if (tp && t.type !== tp) return false;
      if (av === 'abc' && !t.hasAbc) return false;
      if (av === 'link' && !t.hasUrl) return false;
      if (av === 'na' && t.hasUrl) return false;
      return true;
    });

    tunes.forEach(function (t) { t.el.hidden = true; });

    // Cards start alphabetical; only reorder for the other sorts.
    if (so !== 'name') {
      visible = visible.slice().sort(function (a, b) {
        if (so === 'book' && a.order !== null) return a.order - b.order;
        if (so === 'book' && a.book !== b.book) return a.book < b.book ? -1 : 1;
        if (so === 'type' && a.type !== b.type) return (a.type || '~') < (b.type || '~') ? -1 : 1;
        return a.name < b.name ? -1 : 1;
      });
      visible.forEach(function (t) { list.appendChild(t.el); });
    } else {
      tunes.forEach(function (t) { list.appendChild(t.el); });
    }

    visible.forEach(function (t) { t.el.hidden = false; });
    emptyEl.style.display = visible.length ? 'none' : 'block';
    countEl.textContent = visible.length + ' of ' + tunes.length + ' tunes';
  }

  [q, bookSel, typeSel, availSel, sortSel].forEach(function (el) {
    if (el) el.addEventListener('input', apply);
  });
  controls.hidden = false;
  apply();

  // ---- lazy abcjs + ABC data ----
  var abcjsPromise = null;
  function loadAbcjs() {
    if (!abcjsPromise) {
      abcjsPromise = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = '/abcjs/abcjs-basic-min.js';
        s.onload = function () { resolve(window.ABCJS); };
        s.onerror = function () { abcjsPromise = null; reject(new Error('abcjs failed to load')); };
        document.head.appendChild(s);
      });
    }
    return abcjsPromise;
  }

  var abcPromise = null;
  function loadAbcData() {
    if (!abcPromise) {
      abcPromise = fetch(list.getAttribute('data-abc')).then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }).catch(function (err) { abcPromise = null; throw err; });
    }
    return abcPromise;
  }

  var currentSynth = null; // one player at a time
  function stopSynth() {
    if (currentSynth) { try { currentSynth.pause(); } catch (e) {} currentSynth = null; }
  }

  function renderTune(ABCJS, abc, card, detail) {
    var meta = document.createElement('p');
    meta.className = 'meta';
    var settings = card.getAttribute('data-settings');
    // Pages showing the book's own notation set a caption on #list instead.
    meta.textContent = list.getAttribute('data-note') ||
      (settings ? 'First of ' + settings + ' settings on thesession.org · ' : '') +
      'notation from thesession.org — the book’s version may differ';
    var score = document.createElement('div');
    score.className = 'score';
    var audio = document.createElement('div');
    detail.appendChild(meta);
    detail.appendChild(score);
    detail.appendChild(audio);

    var visual = ABCJS.renderAbc(score, abc, { responsive: 'resize', add_classes: true });

    if (ABCJS.synth.supportsAudio()) {
      var ctrl = new ABCJS.synth.SynthController();
      ctrl.load(audio, {
        onStart: function () { if (currentSynth && currentSynth !== ctrl) stopSynth(); currentSynth = ctrl; },
      }, { displayLoop: true, displayRestart: true, displayPlay: true, displayProgress: true, displayWarp: true });
      ctrl.setTune(visual[0], false, { chordsOff: false, soundFontUrl: '/soundfonts/FluidR3_GM/' })
        .catch(function () {
          audio.innerHTML = '<p class="meta">Could not prepare audio for this tune.</p>';
        });
    }
  }

  function toggle(card) {
    var head = card.querySelector('.tune-head');
    var detail = card.querySelector('.tune-detail');
    var open = detail.hidden;
    detail.hidden = !open;
    card.classList.toggle('open', open);
    head.setAttribute('aria-expanded', String(open));
    if (open && !detail.dataset.loaded) {
      detail.dataset.loaded = '1';
      detail.textContent = 'Loading…';
      Promise.all([loadAbcjs(), loadAbcData()]).then(function (res) {
        detail.textContent = '';
        renderTune(res[0], res[1][card.getAttribute('data-id')], card, detail);
      }).catch(function () {
        detail.dataset.loaded = '';
        detail.textContent = 'Could not load the sheet music — check your connection and try again.';
      });
    }
  }

  // Row click opens the score; clicks on the thesession link pass through.
  list.addEventListener('click', function (e) {
    if (e.target.closest('a')) return;
    var head = e.target.closest('.tune-head');
    if (!head) return;
    var card = head.closest('.tune');
    if (card.getAttribute('data-a') === '1') toggle(card);
  });
  list.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var head = e.target.closest('.tune-head');
    if (!head) return;
    e.preventDefault();
    toggle(head.closest('.tune'));
  });

  // Expandable rows are keyboard-reachable buttons.
  cards.forEach(function (el) {
    if (el.getAttribute('data-a') !== '1') return;
    var head = el.querySelector('.tune-head');
    head.setAttribute('role', 'button');
    head.setAttribute('tabindex', '0');
    head.setAttribute('aria-expanded', 'false');
  });
})();
