(() => {
  'use strict';
  const P = window.Pyraminx;
  const COLORS = P.PALETTE.map((p) => p.hex);
  const BLANK = '#f8f8f8';
  const H = Math.sqrt(3);
  const $ = (s) => document.querySelector(s);

  // ---------------------------------------------------------------- state
  let state = Array(36).fill(null);
  let selected = 0;
  let view = { yaw: -0.8, pitch: 0.38 };
  const HOME_VIEW = { ...view };
  let busy = false;
  let playing = false;
  const BASE_MS = 350; // duration of one move at 1.0x
  let speedMul = 1;    // 0.1x – 3.0x
  let playback = null; // { title, moves, states, index }

  const fill = (c) => (c === null || c === undefined ? BLANK : COLORS[c]);
  const ease = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

  // ---------------------------------------------------------------- 3D view
  function project(p, v) {
    const cy = Math.cos(v.yaw), sy = Math.sin(v.yaw);
    const x = p[0] * cy + p[2] * sy, z = -p[0] * sy + p[2] * cy, y = p[1];
    const cp = Math.cos(v.pitch), sp = Math.sin(v.pitch);
    return [x, y * cp - z * sp, y * sp + z * cp];
  }

  const inset = (pts, k) => {
    const c = [0, 1].map((i) => (pts[0][i] + pts[1][i] + pts[2][i]) / 3);
    return pts.map((p) => [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k]);
  };
  const ptsAttr = (pts) => pts.map((p) => p[0].toFixed(4) + ',' + p[1].toFixed(4)).join(' ');

  // Cross-section of the puzzle where a layer is cut (drawn black while it turns).
  function cutTriangle(letter) {
    const X = letter.toUpperCase();
    const t = letter === X ? 2 / 3 : 1 / 3;
    const V = P.VERT[X];
    return Object.keys(P.VERT).filter((k) => k !== X).map((k) => V.map((v, i) => v + t * (P.VERT[k][i] - v)));
  }

  function svg3D(st, v, anim, interactive) {
    const polys = [];
    const pushPoly = (pts3, normal, color, idx) => {
      const pp = pts3.map((p) => project(p, v));
      if (project(normal, v)[2] <= 0.01) return;
      polys.push({ pp, depth: (pp[0][2] + pp[1][2] + pp[2][2]) / 3, color, idx });
    };
    P.STICKERS.forEach((s, i) => {
      let pts = s.pts3, n = s.normal;
      if (anim && anim.set.has(i)) {
        pts = pts.map((p) => P.rotate(p, anim.axis, anim.angle));
        n = P.rotate(n, anim.axis, anim.angle);
      }
      pushPoly(pts, n, fill(st[i]), i);
    });
    if (anim) {
      const tri = cutTriangle(anim.letter);
      const axis = anim.axis;
      pushPoly(tri, axis, null, -1);
      pushPoly(tri.map((p) => P.rotate(p, axis, anim.angle)), P.rotate(axis.map((x) => -x), axis, anim.angle), null, -1);
    }
    polys.sort((a, b) => a.depth - b.depth);
    let out = '';
    for (const p of polys) {
      const flat = p.pp.map((q) => [q[0], -q[1]]);
      out += `<polygon points="${ptsAttr(flat)}" fill="#111" stroke="#111" stroke-width="0.05" stroke-linejoin="round"/>`;
      if (p.color) {
        out += `<polygon ${interactive ? `data-i="${p.idx}" class="sticker"` : ''} points="${ptsAttr(inset(flat, 0.8))}" fill="${p.color}" stroke="${p.color}" stroke-width="0.035" stroke-linejoin="round"/>`;
      }
    }
    return out;
  }

  function render(anim) {
    $('#cube').innerHTML = svg3D(state, view, anim, !busy);
    $('#net').innerHTML = netInner(state, true);
  }

  // ---------------------------------------------------------------- flat net
  function netInner(st, interactive) {
    let out = '';
    P.STICKERS.forEach((s, i) => {
      out += `<polygon points="${ptsAttr(s.pts2)}" fill="#111" stroke="#111" stroke-width="0.06" stroke-linejoin="round"/>`;
      out += `<polygon ${interactive ? `data-i="${i}" class="sticker"` : ''} points="${ptsAttr(inset(s.pts2, 0.78))}" fill="${fill(st[i])}" stroke="${fill(st[i])}" stroke-width="0.04" stroke-linejoin="round"/>`;
    });
    return out;
  }
  const NET_VIEWBOX = `-2.15 -0.15 4.3 ${(2 * H + 0.3).toFixed(3)}`;
  const netSVG = (st, cls = '') => `<svg viewBox="${NET_VIEWBOX}" class="${cls}" role="img" aria-label="Pyraminx net">${netInner(st, false)}</svg>`;
  const mini3D = (st, cls = '') => `<svg viewBox="-1.15 -1.15 2.3 2.3" class="${cls}" role="img" aria-label="Pyraminx">${svg3D(st, HOME_VIEW, null, false)}</svg>`;

  // ---------------------------------------------------------------- animation
  function animateMove(move) {
    const info = P.moveInfo(move);
    const set = new Set(info.stickers);
    return new Promise((resolve) => {
      const t0 = performance.now();
      const frame = (t) => {
        const k = Math.min(1, (t - t0) / (BASE_MS / speedMul));
        render({ set, axis: info.axis, angle: info.angle * ease(k), letter: info.letter });
        if (k < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  function animateView(target) {
    const from = { ...view };
    return new Promise((resolve) => {
      const t0 = performance.now();
      const frame = (t) => {
        const k = Math.min(1, (t - t0) / 450);
        const e = ease(k);
        view = { yaw: from.yaw + (target.yaw - from.yaw) * e, pitch: from.pitch + (target.pitch - from.pitch) * e };
        render();
        if (k < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
  }

  // ---------------------------------------------------------------- messages
  function message(text, kind = 'info') {
    const el = $('#message');
    if (!text) { el.classList.add('hidden'); return; }
    el.className = 'mt-4 rounded-md px-4 py-3 text-sm font-medium ' +
      (kind === 'error' ? 'bg-red-100 text-red-800 border border-red-300'
        : kind === 'ok' ? 'bg-green-100 text-green-800 border border-green-300'
          : 'bg-blue-50 text-blue-900 border border-blue-200');
    el.textContent = text;
  }

  // ---------------------------------------------------------------- palette
  function buildPalette() {
    $('#palette').innerHTML = P.PALETTE.map((c, i) =>
      `<button data-color="${i}" title="${c.name}" aria-label="Paint ${c.name}"
        class="palette-btn h-11 rounded-md border border-black/70 shadow transition"
        style="background:${c.hex}"></button>`).join('');
    $('#palette').addEventListener('click', (e) => {
      const b = e.target.closest('[data-color]');
      if (!b) return;
      selected = Number(b.dataset.color);
      updatePalette();
    });
    updatePalette();
  }
  function updatePalette() {
    document.querySelectorAll('.palette-btn').forEach((b) => {
      const on = Number(b.dataset.color) === selected;
      b.classList.toggle('ring-4', on);
      b.classList.toggle('ring-black/60', on);
      b.classList.toggle('scale-[1.03]', on);
      b.classList.toggle('shadow-lg', on);
    });
  }

  function paint(i) {
    if (busy) return;
    stopPlayback();
    state[i] = selected;
    render();
  }

  // ---------------------------------------------------------------- pointer: paint + drag to rotate
  function bindCube() {
    const svg = $('#cube');
    let down = null;
    svg.addEventListener('pointerdown', (e) => {
      down = { x: e.clientX, y: e.clientY, yaw: view.yaw, pitch: view.pitch, drag: false, target: e.target };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      if (!down.drag && Math.hypot(dx, dy) > 5) down.drag = true;
      if (down.drag) {
        view.yaw = down.yaw + dx * 0.01;
        view.pitch = Math.max(-1.5, Math.min(1.5, down.pitch + dy * 0.01));
        render();
      }
    });
    svg.addEventListener('pointerup', () => {
      if (down && !down.drag && down.target.dataset && down.target.dataset.i !== undefined) paint(Number(down.target.dataset.i));
      down = null;
    });
    $('#net').addEventListener('click', (e) => {
      if (e.target.dataset.i !== undefined) paint(Number(e.target.dataset.i));
    });
  }

  // ---------------------------------------------------------------- playback (solution / algorithm)
  function startPlayback(title, startState, moves, note) {
    stopPlayback();
    const states = [startState.slice()];
    moves.forEach((m) => states.push(P.apply(states[states.length - 1], [m])));
    playback = { title, moves, states, index: 0, note };
    state = startState.slice();
    $('#solution').classList.remove('hidden');
    renderPlayback();
    render();
  }

  function stopPlayback() {
    playing = false;
    if (!playback) return;
    playback = null;
    $('#solution').classList.add('hidden');
  }

  function renderPlayback() {
    const pb = playback;
    if (!pb) return;
    $('#sol-title').textContent = pb.title;
    $('#sol-note').textContent = pb.note || '';
    $('#sol-count').textContent = `${pb.moves.length} move${pb.moves.length === 1 ? '' : 's'}`;
    $('#sol-forward').textContent = pb.moves.join(' ') || '(already solved)';
    $('#sol-reverse').textContent = P.invert(pb.moves).join(' ') || '–';
    $('#sol-moves').innerHTML = pb.moves.map((m, i) =>
      `<button data-step="${i + 1}" class="move-chip rounded-md px-3 py-1.5 font-mono text-base font-bold border
        ${i < pb.index ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-100'}">${m}</button>`).join('');
    $('#sol-step').textContent = `Step ${pb.index} / ${pb.moves.length}`;
    $('#btn-play').innerHTML = playing ? '❚❚' : '▶';
    $('#sol-steps').innerHTML = pb.states.map((st, i) => `
      <button data-step="${i}" class="step-card flex flex-col items-center rounded-lg border-2 bg-white p-2 transition hover:shadow-md
        ${i === pb.index ? 'border-blue-600 shadow-md' : 'border-transparent'}">
        <div class="text-xs font-semibold text-gray-500">${i === 0 ? 'Start' : 'Step ' + i}</div>
        <div class="font-mono text-lg font-bold text-gray-800">${i === 0 ? '&nbsp;' : pb.moves[i - 1]}</div>
        ${mini3D(st, 'w-24 h-24')}
        ${netSVG(st, 'w-24 h-auto mt-1')}
      </button>`).join('');
  }

  async function step(dir) {
    const pb = playback;
    if (!pb || busy) return false;
    if (dir > 0 && pb.index >= pb.moves.length) return false;
    if (dir < 0 && pb.index <= 0) return false;
    busy = true;
    const move = dir > 0 ? pb.moves[pb.index] : P.invertMove(pb.moves[pb.index - 1]);
    await animateMove(move);
    pb.index += dir;
    state = pb.states[pb.index].slice();
    busy = false;
    render();
    renderPlayback();
    return true;
  }

  function jump(i) {
    const pb = playback;
    if (!pb || busy) return;
    playing = false;
    pb.index = Math.max(0, Math.min(pb.moves.length, i));
    state = pb.states[pb.index].slice();
    render();
    renderPlayback();
  }

  async function play(dir = 1) {
    if (!playback) return;
    if (playing) { playing = false; renderPlayback(); return; }
    if (dir > 0 && playback.index >= playback.moves.length) jump(0);
    playing = true;
    renderPlayback();
    while (playing && playback && (await step(dir))) await new Promise((r) => setTimeout(r, 80 / speedMul));
    playing = false;
    renderPlayback();
  }

  // ---------------------------------------------------------------- actions
  function solve() {
    if (busy) return;
    try {
      const { state: canon } = P.canonicalize(state);
      if (P.isSolved(canon)) { message('The puzzle is already solved!', 'ok'); return; }
      message('Solving…');
      setTimeout(() => {
        try {
          const t0 = performance.now();
          const moves = P.solve(canon);
          const ms = Math.round(performance.now() - t0);
          startPlayback('Optimal solution', state, moves,
            'Hold the puzzle exactly as shown in the 3D view. Press ▶ to play, or step forward and back.');
          message(`Solved in ${moves.length} moves (${ms} ms). The shortest solution is shown below.`, 'ok');
          document.getElementById('solution').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (err) { message(err.message, 'error'); }
      }, 30);
    } catch (err) { message(err.message, 'error'); }
  }

  function reset() {
    if (busy) return;
    stopPlayback();
    state = Array(36).fill(null);
    view = { ...HOME_VIEW };
    message('Pick a colour above, then click the stickers to paint your puzzle.');
    render();
  }

  function fillSolved() {
    if (busy) return;
    stopPlayback();
    state = P.SOLVED.slice();
    message('Filled with a solved puzzle.');
    render();
  }

  function scramble() {
    if (busy) return;
    stopPlayback();
    const r = P.randomState();
    state = r.state;
    $('#scramble-input').value = P.simplify(r.moves).join(' ');
    message('Random scramble applied. Press Solve! to find the shortest solution.');
    render();
  }

  function applyScramble() {
    if (busy) return;
    try {
      const moves = P.parse($('#scramble-input').value);
      stopPlayback();
      state = P.apply(P.SOLVED, moves);
      message(`Scramble applied (${moves.length} moves).`);
      render();
    } catch (err) { message(err.message, 'error'); }
  }

  function playAlgorithm(groupIdx, itemIdx, reverse) {
    if (busy) return;
    const item = window.ALGORITHM_GROUPS[groupIdx].items[itemIdx];
    const moves = reverse ? P.invert(item.alg) : P.parse(item.alg);
    const start = P.apply(P.SOLVED, P.invert(moves));
    startPlayback(`${item.name} – ${reverse ? 'Reverse' : 'Forward'}`, start, moves,
      reverse ? 'Reverse algorithm: undoes the forward algorithm.' : 'Forward algorithm: solves the case shown.');
    message(`Loaded "${item.name}" (${reverse ? 'reverse' : 'forward'}). Press ▶ to watch it.`);
    document.getElementById('solver').scrollIntoView({ behavior: 'smooth' });
    setTimeout(() => play(1), 700);
  }

  // ---------------------------------------------------------------- algorithm library
  function buildLibrary() {
    const groups = window.ALGORITHM_GROUPS;
    $('#alg-tabs').innerHTML = groups.map((g, gi) =>
      `<a href="#grp-${g.id}" class="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100">${g.title}</a>`).join('');
    $('#alg-groups').innerHTML = groups.map((g, gi) => `
      <section id="grp-${g.id}" class="scroll-mt-4">
        <h3 class="font-display text-3xl tracking-wide text-[#c62828]">${g.title}</h3>
        <p class="mt-1 max-w-3xl text-gray-700">${g.intro}</p>
        <div class="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          ${g.items.map((it, ii) => algCard(it, gi, ii)).join('')}
        </div>
      </section>`).join('');
    $('#alg-groups').addEventListener('click', (e) => {
      const b = e.target.closest('[data-play]');
      if (!b) return;
      playAlgorithm(Number(b.dataset.g), Number(b.dataset.i), b.dataset.play === 'reverse');
    });
  }

  function algCard(it, gi, ii) {
    const fwd = P.parse(it.alg);
    const rev = P.invert(fwd);
    const fwdCase = P.apply(P.SOLVED, rev); // what the forward algorithm solves
    const revCase = P.apply(P.SOLVED, fwd); // what the reverse algorithm solves
    const side = (label, moves, st, kind) => `
      <div class="flex flex-1 flex-col items-center rounded-lg ${kind === 'forward' ? 'bg-blue-50' : 'bg-amber-50'} p-3">
        <div class="text-xs font-bold uppercase tracking-wider ${kind === 'forward' ? 'text-blue-700' : 'text-amber-700'}">${label}</div>
        <div class="text-[11px] text-gray-500">solves this case</div>
        ${mini3D(st, 'mt-1 h-24 w-24')}
        ${netSVG(st, 'h-auto w-28')}
        <code class="mt-2 text-center font-mono text-sm font-bold text-gray-900">${moves.join(' ')}</code>
        <button data-play="${kind}" data-g="${gi}" data-i="${ii}"
          class="mt-2 rounded bg-[#3378e0] px-3 py-1 text-xs font-semibold text-white hover:bg-[#2563c9]">▶ Play ${kind}</button>
      </div>`;
    return `
      <article class="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h4 class="text-lg font-bold text-gray-900">${it.name}</h4>
        <p class="mt-1 text-sm text-gray-600">${it.desc}</p>
        ${it.alt ? `<p class="mt-1 text-sm text-gray-600">Left-hand version: <code class="font-mono font-semibold">${it.alt}</code></p>` : ''}
        <div class="mt-3 flex gap-3">
          ${side('Forward', fwd, fwdCase, 'forward')}
          ${side('Reverse', rev, revCase, 'reverse')}
        </div>
      </article>`;
  }

  // ---------------------------------------------------------------- speed
  function setSpeed(value) {
    speedMul = Math.round(Math.max(0.1, Math.min(3, value)) * 100) / 100;
    const slider = $('#speed');
    slider.value = speedMul;
    slider.style.setProperty('--fill', ((speedMul - 0.1) / 2.9) * 100 + '%');
    $('#speed-label').textContent = speedMul.toFixed(2) + 'x';
    document.querySelectorAll('.speed-chip').forEach((b) => b.classList.toggle('active', Number(b.dataset.speed) === speedMul));
  }

  // ---------------------------------------------------------------- init
  function init() {
    buildPalette();
    bindCube();
    buildLibrary();
    $('#btn-reset').onclick = reset;
    $('#btn-solved').onclick = fillSolved;
    $('#btn-scramble').onclick = scramble;
    $('#btn-apply').onclick = applyScramble;
    $('#scramble-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') applyScramble(); });
    $('#btn-solve').onclick = solve;
    $('#btn-left').onclick = () => !busy && animateView({ yaw: view.yaw - (2 * Math.PI) / 3, pitch: view.pitch });
    $('#btn-right').onclick = () => !busy && animateView({ yaw: view.yaw + (2 * Math.PI) / 3, pitch: view.pitch });
    $('#btn-flip').onclick = () => !busy && animateView({ yaw: view.yaw, pitch: view.pitch > 0 ? -1.1 : HOME_VIEW.pitch });
    $('#btn-full').onclick = () => {
      const el = $('#viewer');
      if (document.fullscreenElement) document.exitFullscreen();
      else if (el.requestFullscreen) el.requestFullscreen();
    };
    $('#btn-first').onclick = () => jump(0);
    $('#btn-last').onclick = () => jump(playback ? playback.moves.length : 0);
    $('#btn-prev').onclick = () => { playing = false; step(-1); };
    $('#btn-next').onclick = () => { playing = false; step(1); };
    $('#btn-play').onclick = () => play(1);
    $('#speed').oninput = (e) => setSpeed(Number(e.target.value));
    $('#speed-down').onclick = () => setSpeed(speedMul - 0.25);
    $('#speed-up').onclick = () => setSpeed(speedMul + 0.25);
    $('#speed-presets').addEventListener('click', (e) => { const b = e.target.closest('[data-speed]'); if (b) setSpeed(Number(b.dataset.speed)); });
    setSpeed(1);
    $('#sol-moves').addEventListener('click', (e) => { const b = e.target.closest('[data-step]'); if (b) jump(Number(b.dataset.step)); });
    $('#sol-steps').addEventListener('click', (e) => { const b = e.target.closest('[data-step]'); if (b) jump(Number(b.dataset.step)); });
    document.addEventListener('keydown', (e) => {
      if (!playback || e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') { playing = false; step(1); }
      if (e.key === 'ArrowLeft') { playing = false; step(-1); }
      if (e.key === ' ') { e.preventDefault(); play(1); }
    });
    message('Pick a colour above, then click the stickers to paint your puzzle. Drag the pyramid to turn it.');
    render();
    // Build the solver's lookup table in the background so the first solve is instant.
    setTimeout(() => P.buildTable(), 200);
  }

  document.addEventListener('DOMContentLoaded', init);
})();
