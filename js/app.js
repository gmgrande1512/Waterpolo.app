/*
 * Waterpolo Táctico — pizarra táctica para charlas técnicas.
 * Sin dependencias: HTML + CSS + JavaScript. Los datos quedan en el dispositivo (localStorage).
 */
(function () {
  'use strict';

  const APP_VERSION = '1.1.0';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const $ = (s) => document.querySelector(s);

  /* ================= Modelo ================= */

  const PIECES = [
    { id: 'A1', team: 'A' }, { id: 'A2', team: 'A' }, { id: 'A3', team: 'A' },
    { id: 'A4', team: 'A' }, { id: 'A5', team: 'A' }, { id: 'A6', team: 'A' },
    { id: 'D1', team: 'D' }, { id: 'D2', team: 'D' }, { id: 'D3', team: 'D' },
    { id: 'D4', team: 'D' }, { id: 'D5', team: 'D' }, { id: 'D6', team: 'D' },
    { id: 'DG', team: 'D', gk: true },
  ];
  const PIECE = Object.fromEntries(PIECES.map((p) => [p.id, p]));
  const IDS = PIECES.map((p) => p.id).concat('ball');
  const CATEGORIES = window.WP.categories;

  const DEFAULT_ROSTER = { A1: 2, A2: 3, A3: 4, A4: 5, A5: 6, A6: 7, D1: 2, D2: 3, D3: 4, D4: 5, D5: 6, D6: 7, DG: 1 };
  const DEFAULT_NAMES = { A: 'Ataque', D: 'Defensa' };

  const K = { plays: 'wp.plays.v1', roster: 'wp.roster.v1', current: 'wp.current.v1', prefs: 'wp.prefs.v1' };

  const store = {
    get(key, def) {
      try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; } catch (e) { return def; }
    },
    set(key, val) {
      try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
    },
  };

  const clone = (o) => JSON.parse(JSON.stringify(o));
  const uid = () => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const round = (v) => Math.round(v * 100) / 100;

  // Completa y corrige un paso (por si viene de una importación).
  function normalizeStep(s) {
    const def = window.WP.defaultStep();
    const out = { pos: {}, hidden: [], note: '' };
    for (const id of IDS) {
      const p = s && s.pos && s.pos[id];
      if (Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])) {
        out.pos[id] = [round(clamp(+p[0], -0.6, 25.6)), round(clamp(+p[1], -0.4, 20.4))];
      } else {
        out.pos[id] = def.pos[id].slice();
      }
    }
    if (s && Array.isArray(s.hidden)) out.hidden = s.hidden.filter((h) => PIECE[h]);
    if (s && typeof s.note === 'string') out.note = s.note.slice(0, 240);
    return out;
  }

  function normalizePlay(p) {
    if (!p || typeof p !== 'object' || !Array.isArray(p.steps) || !p.steps.length) return null;
    return {
      id: typeof p.id === 'string' ? p.id : uid(),
      name: String(p.name || 'Jugada sin nombre').slice(0, 80),
      category: CATEGORIES.includes(p.category) ? p.category : 'Mis jugadas',
      description: String(p.description || '').slice(0, 400),
      view: p.view === 'full' ? 'full' : 'half',
      steps: p.steps.slice(0, 60).map(normalizeStep),
      updated: +p.updated || Date.now(),
    };
  }

  function newPlay() {
    return { id: null, builtin: false, name: 'Jugada nueva', category: 'Mis jugadas', description: '', view: 'half', steps: [window.WP.defaultStep()] };
  }

  /* ================= Estado ================= */

  const savedRoster = store.get(K.roster, {});
  let roster = Object.assign({}, DEFAULT_ROSTER, savedRoster.numbers || {});
  let teamNames = Object.assign({}, DEFAULT_NAMES, savedRoster.names || {});
  let prefs = Object.assign({ arrows: true, speed: 1 }, store.get(K.prefs, {}));
  let custom = (store.get(K.plays, []) || []).map(normalizePlay).filter(Boolean);

  let play, idx = 0, dirty = false;
  (function restore() {
    const cur = store.get(K.current, null);
    const p = cur && normalizePlay(cur.play);
    if (p) {
      play = Object.assign(p, { id: cur.play.id || null, builtin: !!cur.play.builtin });
      idx = clamp(cur.idx | 0, 0, play.steps.length - 1);
      dirty = !!cur.dirty;
    } else {
      play = newPlay();
    }
  })();

  let orient = 'landscape';
  let anim = null;        // animación en curso
  let playing = false;

  const step = () => play.steps[idx];
  const last = () => play.steps.length - 1;

  function saveCurrent() {
    store.set(K.current, { play, idx, dirty });
  }
  function saveRoster() {
    store.set(K.roster, { numbers: roster, names: teamNames });
  }
  function savePrefs() {
    store.set(K.prefs, prefs);
  }
  function markDirty() {
    dirty = true;
    saveCurrent();
    updateUI();
  }

  /* ================= Geometría ================= */

  function rangeX() {
    return play.view === 'full' ? [-1.3, 26.3] : [11.3, 26.3];
  }
  const toView = (p) => (orient === 'landscape' ? [p[0], p[1]] : [p[1], 25 - p[0]]);
  const fromView = (X, Y) => (orient === 'landscape' ? [X, Y] : [25 - Y, X]);

  function clientToModel(cx, cy) {
    const svg = $('#pool');
    const pt = svg.createSVGPoint();
    pt.x = cx; pt.y = cy;
    const v = pt.matrixTransform(svg.getScreenCTM().inverse());
    return fromView(v.x, v.y);
  }

  function el(tag, attrs, parent) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }

  let lastLayoutKey = '';
  function layout() {
    const stage = $('#stage');
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return;
    const [x0, x1] = rangeX();
    const len = x1 - x0, wid = 22;
    const sLand = Math.min(W / len, H / wid);
    const sPort = Math.min(W / wid, H / len);
    // Media pileta: siempre con el arco arriba. Pileta entera: la orientación que mejor entre.
    orient = play.view === 'half' || sPort > sLand * 1.05 ? 'portrait' : 'landscape';
    const svg = $('#pool');
    if (orient === 'landscape') svg.setAttribute('viewBox', `${x0} -1 ${len} ${wid}`);
    else svg.setAttribute('viewBox', `-1 ${25 - x1} ${wid} ${len}`);
    const key = orient + play.view;
    if (key !== lastLayoutKey) {
      lastLayoutKey = key;
      drawPool();
    }
    renderCurrent();
  }

  function drawPool() {
    const g = $('#poolG');
    g.innerHTML = '';
    g.setAttribute('transform', orient === 'portrait' ? 'matrix(0,-1,1,0,0,25)' : 'matrix(1,0,0,1,0,0)');
    el('rect', { x: -3, y: -3, width: 31, height: 26, class: 'deck' }, g);
    el('rect', { x: 0, y: 0, width: 25, height: 20, class: 'water' }, g);
    for (let y = 2.5; y < 20; y += 2.5) el('line', { x1: 0, y1: y, x2: 25, y2: y, class: 'ripple' }, g);

    // Líneas: arco (blanca), 5 m (amarilla), 6 m (verde), mitad (blanca)
    const lines = [[0, 'goal'], [25, 'goal'], [5, 'yellow'], [20, 'yellow'], [6, 'green'], [19, 'green'], [12.5, 'half']];
    for (const [x, c] of lines) el('line', { x1: x, y1: 0, x2: x, y2: 20, class: 'ln ' + c }, g);

    // Área de 2 m (reglas World Aquatics 2023): rectángulo desde la línea de gol
    // hasta los 2 m, y 2 m hacia afuera de cada palo (postes en y = 8.5 y 11.5).
    el('rect', { x: 23, y: 6.5, width: 2, height: 7, class: 'box2' }, g);
    el('rect', { x: 0, y: 6.5, width: 2, height: 7, class: 'box2' }, g);

    // Marcas laterales de color sobre los bordes
    const segs = [[0, 2, 'red'], [2, 5, 'yellow'], [5, 6, 'green'], [6, 12.5, 'white'], [12.5, 19, 'white'], [19, 20, 'green'], [20, 23, 'yellow'], [23, 25, 'red']];
    for (const [a, b, c] of segs) {
      el('line', { x1: a, y1: -0.2, x2: b, y2: -0.2, class: 'mark ' + c }, g);
      el('line', { x1: a, y1: 20.2, x2: b, y2: 20.2, class: 'mark ' + c }, g);
    }

    // Arcos (3 m de ancho)
    el('rect', { x: 25, y: 8.5, width: 0.9, height: 3, class: 'net' }, g);
    el('rect', { x: -0.9, y: 8.5, width: 0.9, height: 3, class: 'net' }, g);
    el('line', { x1: 25, y1: 8.5, x2: 25, y2: 11.5, class: 'post' }, g);
    el('line', { x1: 0, y1: 8.5, x2: 0, y2: 11.5, class: 'post' }, g);
  }

  /* ================= Dibujo de piezas ================= */

  function teamClass(id) {
    if (id === 'ball') return 'ball';
    const p = PIECE[id];
    return p.gk ? 'G' : p.team;
  }

  function drawArrows(from, to) {
    const ag = $('#arrowsG');
    for (const id of IDS) {
      if (from.hidden.includes(id) || to.hidden.includes(id)) continue;
      const a = from.pos[id], b = to.pos[id];
      const d = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (d < 0.35) continue;
      const cut = id === 'ball' ? 0.38 : 0.7;
      if (d <= cut + 0.05) continue;
      const k = (d - cut) / d;
      const end = [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
      const va = toView(a), vb = toView(end);
      const cls = teamClass(id);
      if (id !== 'ball') {
        const vg = toView(a);
        el('circle', { cx: vg[0], cy: vg[1], r: 0.55, class: 'ghost ' + cls }, ag);
      }
      const mk = id === 'ball' ? 'mkB' : cls === 'A' ? 'mkA' : cls === 'G' ? 'mkG' : 'mkD';
      el('line', { x1: va[0], y1: va[1], x2: vb[0], y2: vb[1], class: 'arrow ' + cls, 'marker-end': `url(#${mk})` }, ag);
    }
  }

  function renderFrame(pos, opac, arrowPair) {
    const ag = $('#arrowsG'), pg = $('#piecesG');
    ag.innerHTML = '';
    pg.innerHTML = '';
    if (arrowPair) drawArrows(arrowPair[0], arrowPair[1]);

    for (const p of PIECES) {
      const o = opac[p.id] == null ? 1 : opac[p.id];
      if (o <= 0.01) continue;
      const v = toView(pos[p.id]);
      const g = el('g', { class: 'piece ' + teamClass(p.id), 'data-id': p.id, transform: `translate(${v[0]},${v[1]})`, opacity: o }, pg);
      el('circle', { r: 0.58, class: 'hit' }, g);
      el('circle', { r: 0.55, class: 'cap' }, g);
      const t = el('text', { y: 0.02 }, g);
      t.textContent = roster[p.id];
    }
    const vb = toView(pos.ball);
    const b = el('g', { class: 'piece ball', 'data-id': 'ball', transform: `translate(${vb[0]},${vb[1]})` }, pg);
    el('circle', { r: 0.45, class: 'hit' }, b);
    el('circle', { r: 0.3, class: 'b' }, b);
    el('path', { d: 'M-0.3 0 Q0 -0.18 0.3 0 M0 -0.3 Q0.17 0 0 0.3', class: 'seam' }, b);
  }

  function opacityFor(s) {
    const o = {};
    for (const id of s.hidden) o[id] = 0;
    return o;
  }

  function renderCurrent() {
    const s = step();
    const pair = prefs.arrows && idx > 0 ? [play.steps[idx - 1], s] : null;
    renderFrame(s.pos, opacityFor(s), pair);
    showCaption(s.note);
    updateUI();
  }

  function showCaption(text) {
    const c = $('#caption');
    c.textContent = text || '';
    c.hidden = !text;
  }

  /* ================= Interfaz ================= */

  function updateUI() {
    $('#playName').textContent = play.name;
    $('#playName').classList.toggle('dirty', dirty);
    $('#playCat').textContent = (play.builtin ? 'Jugada base · ' : '') + play.category + ' · ' + play.steps.length + (play.steps.length === 1 ? ' paso' : ' pasos');
    $('#stepLabel').textContent = `Paso ${idx + 1}/${play.steps.length}`;
    const busy = !!anim;
    $('#btnFirst').disabled = idx === 0 && !busy;
    $('#btnPrev').disabled = idx === 0 && !busy;
    $('#btnNext').disabled = idx >= last() || busy;
    $('#btnPlay').disabled = play.steps.length < 2;
    $('#btnDelStep').disabled = play.steps.length < 2 || busy;
    $('#btnAddStep').disabled = busy;
    $('#icoPlay').innerHTML = playing
      ? '<path d="M7 4h4v16H7zM13 4h4v16h-4z" fill="currentColor"/>'
      : '<path d="M7 4l13 8-13 8z" fill="currentColor"/>';
    $('#btnPlay').title = playing ? 'Pausa' : 'Reproducir';
    const note = $('#note');
    if (document.activeElement !== note) note.value = step().note || '';
    note.disabled = busy;
    $('#btnView').textContent = play.view === 'full' ? 'Pileta entera' : 'Media pileta';
    $('#btnArrows').classList.toggle('off', !prefs.arrows);
    $('#speed').value = String(prefs.speed);
    renderBench();
  }

  function renderBench() {
    const bench = $('#bench');
    const hidden = step().hidden;
    bench.innerHTML = '';
    if (!hidden.length) { bench.hidden = true; return; }
    bench.hidden = false;
    const lbl = document.createElement('span');
    lbl.textContent = 'Fuera del agua (tocá para volver):';
    bench.appendChild(lbl);
    for (const id of hidden) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = `${teamNames[PIECE[id].team]} ${roster[id]}`;
      b.onclick = () => {
        stopAnim();
        step().hidden = step().hidden.filter((h) => h !== id);
        markDirty();
        renderCurrent();
      };
      bench.appendChild(b);
    }
  }

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  /* ================= Arrastre ================= */

  let drag = null;
  const svg = $('#pool');

  svg.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('[data-id]');
    if (!g) return;
    if (anim) stopAnim();
    const id = g.getAttribute('data-id');
    if (id !== 'ball' && step().hidden.includes(id)) return;
    const m = clientToModel(e.clientX, e.clientY);
    const p = step().pos[id];
    drag = { id, off: [p[0] - m[0], p[1] - m[1]], sx: e.clientX, sy: e.clientY, moved: false, pointer: e.pointerId };
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  svg.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointer) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 6) return;
    drag.moved = true;
    const m = clientToModel(e.clientX, e.clientY);
    const x = round(clamp(m[0] + drag.off[0], -0.6, 25.6));
    const y = round(clamp(m[1] + drag.off[1], -0.4, 20.4));
    step().pos[drag.id] = [x, y];
    renderCurrent();
    const g = $(`#piecesG [data-id="${drag.id}"]`);
    if (g) g.classList.add('dragging');
  });

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.pointer) return;
    const d = drag;
    drag = null;
    try { svg.releasePointerCapture(e.pointerId); } catch (err) { /* nada */ }
    if (d.moved) { markDirty(); renderCurrent(); }
    else if (d.id !== 'ball' && e.type === 'pointerup') openPiece(d.id);
  }
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  /* ================= Reproducción ================= */

  function stopAnim() {
    if (anim) {
      cancelAnimationFrame(anim.raf);
      clearTimeout(anim.timer);
    }
    anim = null;
    playing = false;
    renderCurrent();
  }

  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  function transition(j, done) {
    const from = play.steps[j - 1], to = play.steps[j];
    const dur = 1400 / prefs.speed;
    const t0 = performance.now();
    showCaption(to.note);
    const tick = (now) => {
      if (!anim) return;
      const t = Math.min(1, (now - t0) / dur);
      const e = ease(t);
      const pos = {}, op = {};
      for (const id of IDS) {
        const a = from.pos[id], b = to.pos[id];
        pos[id] = [a[0] + (b[0] - a[0]) * e, a[1] + (b[1] - a[1]) * e];
        const hf = from.hidden.includes(id), ht = to.hidden.includes(id);
        op[id] = hf && ht ? 0 : hf ? e : ht ? 1 - e : 1;
      }
      renderFrame(pos, op, prefs.arrows ? [from, to] : null);
      if (t < 1) anim.raf = requestAnimationFrame(tick);
      else { idx = j; saveCurrent(); done(); }
    };
    anim.raf = requestAnimationFrame(tick);
  }

  function playAll() {
    if (play.steps.length < 2) return;
    if (playing) { stopAnim(); return; }
    if (anim) stopAnim();
    if (idx >= last()) idx = 0;
    anim = {};
    playing = true;
    renderCurrent();
    const go = () => {
      if (!anim || !playing) return;
      if (idx >= last()) { anim = null; playing = false; renderCurrent(); return; }
      transition(idx + 1, () => {
        renderCurrent();
        if (anim) anim.timer = setTimeout(go, 800 / prefs.speed);
      });
    };
    anim.timer = setTimeout(go, 300);
  }

  function nextStep() {
    if (anim || idx >= last()) return;
    anim = {};
    updateUI();
    transition(idx + 1, () => { anim = null; renderCurrent(); });
  }

  /* ================= Pasos ================= */

  function addStep() {
    stopAnim();
    const s = clone(step());
    s.note = '';
    play.steps.splice(idx + 1, 0, s);
    idx++;
    markDirty();
    renderCurrent();
    toast(`Paso ${idx + 1} creado: mové los jugadores`);
  }

  function delStep() {
    if (play.steps.length < 2) return;
    stopAnim();
    if (!confirm(`¿Borrar el paso ${idx + 1}?`)) return;
    play.steps.splice(idx, 1);
    idx = Math.min(idx, last());
    markDirty();
    renderCurrent();
  }

  /* ================= Diálogo de jugador ================= */

  let editing = null;
  function openPiece(id) {
    editing = id;
    const p = PIECE[id];
    $('#pieceTitle').textContent = `${teamNames[p.team]}${p.gk ? ' · Arquero' : ''} — gorro ${roster[id]}`;
    const grid = $('#numGrid');
    grid.innerHTML = '';
    const mates = PIECES.filter((q) => q.team === p.team && q.id !== id);
    for (let n = 1; n <= 15; n++) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = n;
      if (roster[id] === n) b.className = 'current';
      else if (mates.some((q) => roster[q.id] === n)) b.className = 'used';
      b.onclick = () => { setNumber(id, n); $('#dlgPiece').close(); };
      grid.appendChild(b);
    }
    $('#dlgPiece').showModal();
  }

  function setNumber(id, n) {
    const team = PIECE[id].team;
    const other = PIECES.find((q) => q.team === team && q.id !== id && roster[q.id] === n);
    if (other) roster[other.id] = roster[id];
    roster[id] = n;
    saveRoster();
    renderCurrent();
    if ($('#dlgOpts').open) renderRoster();
  }

  $('#btnHidePiece').onclick = () => {
    if (!editing) return;
    if (!step().hidden.includes(editing)) step().hidden.push(editing);
    $('#dlgPiece').close();
    markDirty();
    renderCurrent();
    toast('Jugador fuera del agua en este paso');
  };

  /* ================= Biblioteca ================= */

  function allPlays() {
    return window.WP.plays.map((p) => Object.assign(clone(p), { builtin: true })).concat(custom.map((p) => Object.assign(clone(p), { builtin: false })));
  }

  function confirmDiscard() {
    return !dirty || confirm('La jugada actual tiene cambios sin guardar. ¿Descartarlos?');
  }

  function openPlay(p) {
    if (!confirmDiscard()) return false;
    stopAnim();
    play = normalizePlay(p);
    play.id = p.id;
    play.builtin = !!p.builtin;
    idx = 0;
    dirty = false;
    saveCurrent();
    layout();
    return true;
  }

  function renderLibrary() {
    const q = $('#libSearch').value.trim().toLowerCase();
    const list = $('#libList');
    list.innerHTML = '';
    const plays = allPlays().filter((p) => !q || (p.name + ' ' + p.description + ' ' + p.category).toLowerCase().includes(q));
    if (!plays.length) {
      list.innerHTML = '<div class="lib-empty">No hay jugadas que coincidan.</div>';
      return;
    }
    for (const cat of CATEGORIES) {
      const items = plays.filter((p) => p.category === cat);
      if (!items.length) continue;
      const h = document.createElement('div');
      h.className = 'lib-cat';
      h.textContent = cat;
      list.appendChild(h);
      for (const p of items) {
        const row = document.createElement('div');
        row.className = 'lib-item';
        const open = document.createElement('button');
        open.className = 'lib-open';
        const b = document.createElement('b');
        b.textContent = p.name;
        if (p.builtin) { const bd = document.createElement('span'); bd.className = 'badge'; bd.textContent = 'BASE'; bd.style.display = 'inline-block'; b.appendChild(bd); }
        const sp = document.createElement('span');
        sp.textContent = `${p.steps.length} pasos${p.description ? ' · ' + p.description : ''}`;
        open.append(b, sp);
        open.onclick = () => { if (openPlay(p)) $('#dlgLib').close(); };
        row.appendChild(open);
        if (!p.builtin) {
          const del = document.createElement('button');
          del.className = 'btn icon';
          del.title = 'Borrar jugada';
          del.innerHTML = '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>';
          del.onclick = () => {
            if (!confirm(`¿Borrar "${p.name}" de la biblioteca? No se puede deshacer.`)) return;
            custom = custom.filter((c) => c.id !== p.id);
            store.set(K.plays, custom);
            if (play.id === p.id) { play.id = null; dirty = true; saveCurrent(); updateUI(); }
            renderLibrary();
          };
          row.appendChild(del);
        }
        list.appendChild(row);
      }
    }
  }

  /* ================= Guardar ================= */

  function openSave() {
    stopAnim();
    const sel = $('#saveCat');
    sel.innerHTML = '';
    for (const c of CATEGORIES) {
      const o = document.createElement('option');
      o.value = o.textContent = c;
      sel.appendChild(o);
    }
    const isCustom = !!play.id && !play.builtin && custom.some((c) => c.id === play.id);
    $('#saveName').value = play.builtin ? play.name + ' (mi versión)' : play.name;
    sel.value = play.builtin ? 'Mis jugadas' : play.category;
    $('#saveDesc').value = play.description || '';
    $('#saveAsNew').checked = false;
    $('#saveAsNewWrap').hidden = !isCustom;
    $('#saveHint').textContent = play.builtin
      ? 'Es una jugada base: se guarda una copia tuya para que puedas modificarla.'
      : isCustom ? 'Se actualizará la jugada de la biblioteca.' : 'Se agregará a la biblioteca.';
    $('#dlgSave').showModal();
    setTimeout(() => $('#saveName').select(), 50);
  }

  $('#saveForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#saveName').value.trim();
    if (!name) return;
    const isCustom = !!play.id && !play.builtin && custom.some((c) => c.id === play.id);
    const asNew = !isCustom || $('#saveAsNew').checked;
    const obj = {
      id: asNew ? uid() : play.id,
      name,
      category: $('#saveCat').value,
      description: $('#saveDesc').value.trim(),
      view: play.view,
      steps: clone(play.steps),
      updated: Date.now(),
    };
    const next = asNew ? custom.concat(obj) : custom.map((c) => (c.id === obj.id ? obj : c));
    if (!store.set(K.plays, next)) {
      alert('No se pudo guardar: el almacenamiento del dispositivo está lleno o bloqueado.');
      return;
    }
    custom = next;
    play = Object.assign(clone(obj), { builtin: false });
    dirty = false;
    saveCurrent();
    $('#dlgSave').close();
    updateUI();
    toast('Jugada guardada en la biblioteca');
  });

  /* ================= Opciones ================= */

  function renderRoster() {
    const box = $('#roster');
    box.innerHTML = '';
    for (const team of ['A', 'D']) {
      const t = document.createElement('div');
      t.className = 'team';
      const name = document.createElement('input');
      name.className = 'input';
      name.value = teamNames[team];
      name.maxLength = 20;
      name.oninput = () => { teamNames[team] = name.value.trim() || DEFAULT_NAMES[team]; saveRoster(); renderBench(); };
      t.appendChild(name);
      for (const p of PIECES.filter((q) => q.team === team)) {
        const r = document.createElement('div');
        r.className = 'rrow';
        const lab = document.createElement('span');
        const dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = p.gk ? 'var(--gk)' : team === 'A' ? 'var(--atk)' : 'var(--def)';
        lab.appendChild(dot);
        lab.appendChild(document.createTextNode(p.gk ? 'Arquero' : `Jugador ${p.id[1]}`));
        const sel = document.createElement('select');
        sel.className = 'input';
        for (let n = 1; n <= 15; n++) {
          const o = document.createElement('option');
          o.value = o.textContent = n;
          sel.appendChild(o);
        }
        sel.value = roster[p.id];
        sel.onchange = () => { setNumber(p.id, +sel.value); };
        r.append(lab, sel);
        t.appendChild(r);
      }
      box.appendChild(t);
    }
    $('#rosterWarn').hidden = true;
  }

  $('#btnResetRoster').onclick = () => {
    roster = Object.assign({}, DEFAULT_ROSTER);
    teamNames = Object.assign({}, DEFAULT_NAMES);
    saveRoster();
    renderRoster();
    renderCurrent();
  };

  $('#btnExport').onclick = async () => {
    if (!custom.length) { toast('Todavía no guardaste jugadas propias'); return; }
    const data = JSON.stringify({ app: 'waterpolo-tactico', version: 1, exported: new Date().toISOString(), roster, names: teamNames, plays: custom }, null, 1);
    const fname = `jugadas-waterpolo-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([data], { type: 'application/json' });
    try {
      const file = new File([blob], fname, { type: 'application/json' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Jugadas de waterpolo' });
        return;
      }
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };

  $('#importFile').onchange = async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const list = Array.isArray(data) ? data : data.plays;
      const plays = (Array.isArray(list) ? list : []).map(normalizePlay).filter(Boolean);
      if (!plays.length) throw new Error('sin jugadas');
      let next = custom.slice();
      for (const p of plays) {
        const i = next.findIndex((c) => c.id === p.id);
        if (i >= 0) next[i] = p; else next.push(p);
      }
      if (!store.set(K.plays, next)) throw new Error('almacenamiento');
      custom = next;
      if (data.roster && confirm('El archivo trae números de jugadores. ¿Usarlos también?')) {
        for (const id in data.roster) if (PIECE[id] && data.roster[id] >= 1 && data.roster[id] <= 15) roster[id] = data.roster[id] | 0;
        if (data.names) for (const t of ['A', 'D']) if (data.names[t]) teamNames[t] = String(data.names[t]).slice(0, 20);
        saveRoster();
        renderRoster();
        renderCurrent();
      }
      toast(`${plays.length} jugada(s) importada(s)`);
    } catch (err) {
      alert('No se pudo importar el archivo. Tiene que ser una exportación de esta app.');
    }
  };

  /* ================= Botones ================= */

  $('#btnLib').onclick = () => { stopAnim(); $('#libSearch').value = ''; renderLibrary(); $('#dlgLib').showModal(); };
  $('#libSearch').oninput = renderLibrary;
  $('#btnNew').onclick = () => {
    if (!confirmDiscard()) return;
    stopAnim();
    play = newPlay();
    idx = 0;
    dirty = false;
    saveCurrent();
    layout();
    toast('Jugada nueva: ubicá a los jugadores y agregá pasos');
  };
  $('#btnSave').onclick = openSave;
  $('#btnOpts').onclick = () => { stopAnim(); renderRoster(); $('#dlgOpts').showModal(); };
  $('#btnFirst').onclick = () => { stopAnim(); idx = 0; saveCurrent(); renderCurrent(); };
  $('#btnPrev').onclick = () => { stopAnim(); idx = Math.max(0, idx - 1); saveCurrent(); renderCurrent(); };
  $('#btnNext').onclick = nextStep;
  $('#btnPlay').onclick = playAll;
  $('#btnAddStep').onclick = addStep;
  $('#btnDelStep').onclick = delStep;
  $('#speed').onchange = (e) => { prefs.speed = +e.target.value || 1; savePrefs(); };
  $('#btnArrows').onclick = () => { prefs.arrows = !prefs.arrows; savePrefs(); if (!anim) renderCurrent(); else updateUI(); };
  $('#btnView').onclick = () => {
    stopAnim();
    play.view = play.view === 'full' ? 'half' : 'full';
    markDirty();
    layout();
  };
  $('#note').addEventListener('input', (e) => {
    step().note = e.target.value;
    showCaption(step().note);
    dirty = true;
    $('#playName').classList.add('dirty');
  });
  $('#note').addEventListener('change', saveCurrent);
  $('#note').addEventListener('keydown', (e) => { if (e.key === 'Enter') e.target.blur(); });

  // Cerrar diálogos: botón [data-close] o tocando afuera
  document.querySelectorAll('dialog').forEach((d) => {
    d.addEventListener('click', (e) => {
      if (e.target === d || e.target.closest('[data-close]')) d.close();
    });
  });

  // Atajos de teclado (útil con tablet + teclado o en la compu)
  document.addEventListener('keydown', (e) => {
    if (document.querySelector('dialog[open]') || e.target.matches('input, textarea, select')) return;
    if (e.key === ' ') { e.preventDefault(); playAll(); }
    else if (e.key === 'ArrowRight') nextStep();
    else if (e.key === 'ArrowLeft') $('#btnPrev').click();
  });

  window.addEventListener('beforeunload', saveCurrent);
  document.addEventListener('visibilitychange', () => { if (document.hidden) saveCurrent(); });

  $('#appVersion').textContent = APP_VERSION;

  new ResizeObserver(() => layout()).observe($('#stage'));
  layout();

  // Funcionamiento sin conexión (cuando se sirve por https)
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Para pruebas automáticas
  window.__wp = { get play() { return play; }, get idx() { return idx; }, roster: () => roster };
})();
