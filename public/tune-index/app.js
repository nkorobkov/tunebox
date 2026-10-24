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
    // Pages showing the book's own notation set a caption on #list instead;
    // a card whose notation comes from elsewhere carries its own.
    meta.textContent = card.getAttribute('data-note') || list.getAttribute('data-note') ||
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

  // Row click opens the score; clicks on the thesession link and the add button pass through.
  list.addEventListener('click', function (e) {
    if (e.target.closest('a, .add-wrap')) return;
    var head = e.target.closest('.tune-head');
    if (!head) return;
    var card = head.closest('.tune');
    if (card.getAttribute('data-a') === '1') toggle(card);
  });
  list.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.closest('.add-wrap')) return;
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

  // ---- add to TuneBox ----
  // Same origin as the app, so a signed-in visitor's PocketBase session is in
  // localStorage (the SDK's LocalAuthStore entry): add the tune right here
  // after a small confirmation. Signed-out visitors get a sign-in dialog; if
  // they sign in, the tune is parked in localStorage and the app creates it
  // after the OAuth round trip (src/lib/pending-tune.js — keep the key in sync).
  var PB_URL = list.getAttribute('data-pb');
  var PENDING_KEY = 'tunebox.pendingTune';

  function session() {
    try {
      var auth = JSON.parse(localStorage.getItem('pocketbase_auth'));
      if (!auth || !auth.token || !auth.record) return null;
      var payload = JSON.parse(atob(auth.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (!(payload.exp * 1000 > Date.now() + 60000)) return null;
      return { token: auth.token, userId: auth.record.id };
    } catch (e) {
      return null;
    }
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  function tuneName(card) {
    return card.querySelector('.tune-name').firstChild.nodeValue;
  }

  // The user_tunes record for a card, in the shape the app's own importers use.
  function buildTune(card) {
    var link = card.querySelector('a.btn-session');
    var m = link && /thesession\.org\/tunes\/(\d+)/.exec(link.href);
    var type = card.getAttribute('data-t');
    var tune = {
      title: tuneName(card),
      // thesession (and the app's tempo/meter defaults) call double jigs plain jigs.
      type: type === 'double jig' ? 'jig' : type || undefined,
      session_id: m ? Number(m[1]) : undefined,
      session_url: m ? link.href : undefined,
    };
    if (card.getAttribute('data-a') !== '1') return Promise.resolve(tune);
    return loadAbcData().then(function (data) {
      var abc = data[card.getAttribute('data-id')];
      if (abc) {
        tune.abc = abc;
        var key = /^K:\s*(\S+)/m.exec(abc);
        if (key) tune.setting_key = key[1];
      }
      return tune;
    });
  }

  function pbFetch(s, path, opts) {
    opts = opts || {};
    opts.headers = { 'Authorization': s.token, 'Content-Type': 'application/json' };
    return fetch(PB_URL + path, opts).then(function (r) {
      if (!r.ok) { var err = new Error('HTTP ' + r.status); err.status = r.status; throw err; }
      return r.json();
    });
  }

  function findExisting(s, tune) {
    if (!tune.session_id) return Promise.resolve(null);
    var filter = encodeURIComponent('user = "' + s.userId + '" && session_id = ' + tune.session_id);
    return pbFetch(s, '/api/collections/user_tunes/records?perPage=1&fields=id&filter=' + filter)
      .then(function (res) { return res.items[0] || null; })
      .catch(function () { return null; }); // the check is a courtesy; adding still works
  }

  function createTune(s, tune) {
    tune.user = s.userId;
    tune.labels = [];
    tune.instruments = {};
    return pbFetch(s, '/api/collections/user_tunes/records', { method: 'POST', body: JSON.stringify(tune) });
  }

  // -- small confirmation popover (signed in) --
  var openPop = null;
  function closePop() {
    if (!openPop) return;
    openPop.pop.remove();
    openPop.btn.setAttribute('aria-expanded', 'false');
    openPop = null;
  }
  document.addEventListener('click', function (e) {
    if (openPop && !openPop.wrap.contains(e.target)) closePop();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && openPop) { var b = openPop.btn; closePop(); b.focus(); }
  });

  function openLink(id) {
    var a = el('a', null, 'Open in TuneBox');
    a.href = '/tune/' + id;
    return a;
  }

  function showPop(s, card, wrap, btn) {
    closePop();
    var pop = el('div', 'add-pop');
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', 'Add to your tunebook');
    wrap.appendChild(pop);
    btn.setAttribute('aria-expanded', 'true');
    openPop = { pop: pop, btn: btn, wrap: wrap };

    function render(msg, actions) {
      pop.textContent = '';
      pop.appendChild(msg);
      if (actions) pop.appendChild(actions);
    }
    function confirmView(existing) {
      var msg = el('p');
      if (existing) {
        msg.appendChild(document.createTextNode('Already in your tunebook. '));
        msg.appendChild(openLink(existing.id));
      } else {
        msg.textContent = 'Add to your tunebook?';
      }
      var actions = el('div', 'actions');
      var cancel = el('button', 'btn', 'Cancel');
      cancel.type = 'button';
      cancel.addEventListener('click', function () { closePop(); btn.focus(); });
      var add = el('button', 'btn btn-primary', existing ? 'Add again' : 'Add');
      add.type = 'button';
      add.addEventListener('click', function () {
        add.disabled = cancel.disabled = true;
        add.textContent = 'Adding…';
        buildTune(card).then(function (tune) { return createTune(s, tune); }).then(function (rec) {
          btn.classList.add('added');
          btn.innerHTML = '&#10003;';
          btn.setAttribute('aria-label', 'Added to your tunebook');
          var done = el('p');
          done.appendChild(document.createTextNode('Added. '));
          done.appendChild(openLink(rec.id));
          render(done);
        }).catch(function (err) {
          if (err.status === 401 || err.status === 403) { closePop(); showSignin(card); return; }
          add.disabled = cancel.disabled = false;
          add.textContent = 'Try again';
          msg.className = 'add-error';
          msg.textContent = 'Could not add the tune — check your connection.';
        });
      });
      actions.appendChild(cancel);
      actions.appendChild(add);
      render(msg, actions);
      add.focus();
    }

    render(el('p', null, 'Checking your tunebook…'));
    buildTune(card).then(function (tune) { return findExisting(s, tune); }, function () { return null; })
      .then(function (existing) { if (openPop && openPop.pop === pop) confirmView(existing); });
  }

  // -- sign-in dialog (signed out) --
  var dialog = null, dialogTitle, dialogError, signinBtn, pendingCard = null;
  function buildDialog() {
    dialog = el('dialog', 'signin');
    dialog.setAttribute('aria-labelledby', 'signin-title');
    var close = el('button', 'close');
    close.type = 'button';
    close.innerHTML = '&times;';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', function () { dialog.close(); });
    var logo = el('img');
    logo.src = '/tunebook.svg';
    logo.alt = 'TuneBox';
    dialogTitle = el('h2');
    dialogTitle.id = 'signin-title';
    var p = el('p', null, 'TuneBox is a free digital tunebook and practice planner. Sign in and this tune goes straight into your library, with its sheet music, ready to practice.');
    dialogError = el('p', 'add-error');
    dialogError.hidden = true;
    signinBtn = el('button', 'btn btn-primary', 'Sign in with Google');
    signinBtn.type = 'button';
    signinBtn.addEventListener('click', startSignin);
    [close, logo, dialogTitle, p, dialogError, signinBtn].forEach(function (n) { dialog.appendChild(n); });
    // Click on the backdrop (outside the dialog box) closes it.
    dialog.addEventListener('click', function (e) {
      var r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
    });
    document.body.appendChild(dialog);
  }

  function showSignin(card) {
    if (!dialog) buildDialog();
    pendingCard = card;
    dialogTitle.textContent = 'Add “' + tuneName(card) + '” to your tunebook';
    dialogError.hidden = true;
    signinBtn.disabled = false;
    signinBtn.textContent = 'Sign in with Google';
    dialog.showModal();
  }

  // Same steps as loginWithGoogle in src/lib/auth.jsx: the app at / finishes
  // the code exchange (pb_oauth_pending), then claims the pending tune.
  function startSignin() {
    signinBtn.disabled = true;
    signinBtn.textContent = 'Redirecting…';
    Promise.all([
      buildTune(pendingCard),
      fetch(PB_URL + '/api/collections/users/auth-methods').then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      }),
    ]).then(function (res) {
      var google = (res[1].oauth2 && res[1].oauth2.providers || []).filter(function (p) { return p.name === 'google'; })[0];
      if (!google) throw new Error('Google sign-in is not configured');
      localStorage.setItem(PENDING_KEY, JSON.stringify({ tune: res[0], savedAt: Date.now() }));
      localStorage.setItem('pb_oauth_pending', JSON.stringify({
        provider: google.name, codeVerifier: google.codeVerifier, state: google.state,
      }));
      location.href = google.authURL + encodeURIComponent(location.origin + '/');
    }).catch(function () {
      signinBtn.disabled = false;
      signinBtn.textContent = 'Sign in with Google';
      dialogError.textContent = 'Sign-in could not start — check your connection and try again.';
      dialogError.hidden = false;
    });
  }

  cards.forEach(function (card) {
    var wrap = el('span', 'add-wrap');
    var btn = el('button', 'btn-add', '+');
    btn.type = 'button';
    btn.title = 'Add to your TuneBox tunebook';
    btn.setAttribute('aria-label', 'Add ' + tuneName(card) + ' to your tunebook');
    btn.setAttribute('aria-haspopup', 'dialog');
    btn.addEventListener('click', function () {
      if (openPop && openPop.btn === btn) { closePop(); return; }
      var s = session();
      if (s) showPop(s, card, wrap, btn); else showSignin(card);
    });
    wrap.appendChild(btn);
    card.querySelector('.tune-head').appendChild(wrap);
  });
})();
