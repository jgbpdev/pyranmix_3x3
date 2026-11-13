/*
 * Pyraminx engine: geometry, moves, optimal solver.
 * Works in the browser (window.Pyraminx) and in Node (module.exports).
 *
 * Notation (standard):
 *   U L R B  = big layer turns (tip + middle layer) around the Up / Left / Right / Back vertex
 *   u l r b  = tip turns only
 *   Clockwise = looking at that vertex from outside. A prime (') is anticlockwise.
 */
(function (root) {
  'use strict';

  const S3 = Math.sqrt(8) / 3;
  const SIN60 = Math.sqrt(3) / 2;
  const H = Math.sqrt(3);

  // Regular tetrahedron, centred on the origin, unit circumradius.
  const VERT = {
    U: [0, 1, 0],
    L: [-S3 * SIN60, -1 / 3, S3 * 0.5],
    R: [S3 * SIN60, -1 / 3, S3 * 0.5],
    B: [0, -1 / 3, -S3],
  };

  // Faces, the vertices they touch and their 2D position in the flat net (y down).
  const FACES = [
    { id: 'F', name: 'Front', verts: ['U', 'L', 'R'], net: { U: [0, 0], L: [-1, H], R: [1, H] } },
    { id: 'R', name: 'Right', verts: ['U', 'R', 'B'], net: { U: [0, 0], R: [1, H], B: [2, 0] } },
    { id: 'D', name: 'Bottom', verts: ['L', 'B', 'R'], net: { L: [-1, H], B: [0, 2 * H], R: [1, H] } },
    { id: 'L', name: 'Left', verts: ['U', 'B', 'L'], net: { U: [0, 0], B: [-2, 0], L: [-1, H] } },
  ];

  // Colour palette (index = colour id). Solved state: face i has colour i.
  const PALETTE = [
    { name: 'Red', hex: '#d50000' },
    { name: 'Blue', hex: '#2962ff' },
    { name: 'Yellow', hex: '#ffd600' },
    { name: 'Green', hex: '#00c853' },
  ];

  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const scale = (a, s) => a.map((x) => x * s);
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = (a) => scale(a, 1 / Math.hypot(...a));

  function rotate(p, k, theta) {
    // Rodrigues rotation of point p about unit axis k.
    const c = Math.cos(theta), s = Math.sin(theta);
    const kxp = [k[1] * p[2] - k[2] * p[1], k[2] * p[0] - k[0] * p[2], k[0] * p[1] - k[1] * p[0]];
    const kdp = dot(k, p) * (1 - c);
    return [0, 1, 2].map((i) => p[i] * c + kxp[i] * s + k[i] * kdp);
  }

  // ---- Build the 36 stickers -------------------------------------------------
  const N = 3;
  const STICKERS = [];
  FACES.forEach((f, fi) => {
    const [a, b, c] = f.verts;
    const normal = norm(add(add(VERT[a], VERT[b]), VERT[c]));
    const P = (i, j) => [1 - (i + j) / N, i / N, j / N];
    const at3 = (w) => add(add(scale(VERT[a], w[0]), scale(VERT[b], w[1])), scale(VERT[c], w[2]));
    const at2 = (w) => [0, 1].map((k) => f.net[a][k] * w[0] + f.net[b][k] * w[1] + f.net[c][k] * w[2]);
    const push = (ws, kind) => {
      const pts3 = ws.map(at3);
      const pts2 = ws.map(at2);
      const c3 = scale(pts3.reduce(add), 1 / 3);
      STICKERS.push({ face: fi, kind, pts3, pts2, c3, normal });
    };
    for (let i = 0; i < N; i++) {
      for (let j = 0; i + j < N; j++) {
        const tip = i + j === 0 || i === N - 1 || j === N - 1;
        push([P(i, j), P(i + 1, j), P(i, j + 1)], tip ? 'tip' : 'edge');
      }
    }
    for (let i = 0; i < N - 1; i++) {
      for (let j = 0; i + j < N - 1; j++) push([P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], 'center');
    }
  });

  const SOLVED = STICKERS.map((s) => s.face);

  // ---- Moves -----------------------------------------------------------------
  const AXES = 'ULRB';
  const LAYER = {}; // move letter -> sticker indices that turn
  const PERM = {};  // move token  -> permutation (new[t] = old[perm[t]])

  function nearest(p) {
    let best = -1, bd = Infinity;
    STICKERS.forEach((s, i) => {
      const d = Math.hypot(s.c3[0] - p[0], s.c3[1] - p[1], s.c3[2] - p[2]);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  for (const X of AXES) {
    const axis = VERT[X];
    for (const [letter, limit] of [[X, 0.12], [X.toLowerCase(), 0.55]]) {
      const set = [];
      STICKERS.forEach((s, i) => { if (dot(s.c3, axis) > limit) set.push(i); });
      LAYER[letter] = set;
      const perm = STICKERS.map((_, i) => i);
      for (const i of set) perm[nearest(rotate(STICKERS[i].c3, axis, (-2 * Math.PI) / 3))] = i;
      PERM[letter] = perm;
      PERM[letter + "'"] = perm.map((_, t) => perm[perm[t]]);
    }
  }

  function moveInfo(token) {
    const letter = token[0];
    return {
      letter,
      stickers: LAYER[letter],
      axis: VERT[letter.toUpperCase()],
      angle: (token.includes("'") ? 1 : -1) * (2 * Math.PI) / 3,
    };
  }

  function parse(str) {
    if (Array.isArray(str)) return str.slice();
    const out = [];
    const tokens = String(str).replace(/[’`´]/g, "'").trim().split(/\s+/).filter(Boolean);
    for (const t of tokens) {
      const m = /^([ULRBulrb])('?)(2?)('?)$/.exec(t);
      if (!m) throw new Error('Unknown move: ' + t);
      const prime = (m[2] || m[4]) ? "'" : '';
      out.push(m[1] + prime);
      if (m[3]) out.push(m[1] + prime);
    }
    return out;
  }

  function apply(state, moves) {
    let st = state.slice();
    for (const m of parse(moves)) {
      const p = PERM[m];
      st = p.map((src) => st[src]);
    }
    return st;
  }

  const invertMove = (m) => (m.includes("'") ? m[0] : m + "'");
  const invert = (moves) => parse(moves).reverse().map(invertMove);

  // Simplify X X -> X', X' X' -> X, X X' -> nothing, X X X -> nothing.
  function simplify(moves) {
    const out = [];
    for (const m of parse(moves)) {
      const last = out[out.length - 1];
      if (last && last[0] === m[0]) {
        const n = ((last.includes("'") ? 2 : 1) + (m.includes("'") ? 2 : 1)) % 3;
        out.pop();
        if (n === 1) out.push(m[0]);
        if (n === 2) out.push(m[0] + "'");
      } else out.push(m);
    }
    return out;
  }

  const toString = (moves) => parse(moves).join(' ');

  // ---- Solver ----------------------------------------------------------------
  const TIP_IDX = STICKERS.map((s, i) => (s.kind === 'tip' ? i : -1)).filter((i) => i >= 0);
  const BODY_IDX = STICKERS.map((s, i) => (s.kind !== 'tip' ? i : -1)).filter((i) => i >= 0);
  const BIG = ['U', "U'", 'L', "L'", 'R', "R'", 'B', "B'"];
  const key = (st) => BODY_IDX.map((i) => st[i]).join('');
  const isSolved = (st) => st.every((c, i) => c === SOLVED[i]);

  // Each tip sticker paired with the axial-centre sticker of the same vertex on the same face.
  const TIP_PAIRS = {};
  for (const X of AXES) {
    const axis = VERT[X];
    TIP_PAIRS[X] = LAYER[X.toLowerCase()].map((t) => {
      let best = -1, bd = -Infinity;
      STICKERS.forEach((s, i) => {
        if (s.kind === 'center' && s.face === STICKERS[t].face && dot(s.c3, axis) > bd) { bd = dot(s.c3, axis); best = i; }
      });
      return [t, best];
    });
  }

  let TABLE = null; // body key -> moves from solved (depth <= 6)
  const TABLE_DEPTH = 6;
  const SEARCH_DEPTH = 5;

  function buildTable() {
    if (TABLE) return TABLE;
    TABLE = new Map();
    TABLE.set(key(SOLVED), []);
    let frontier = [{ st: SOLVED, path: [] }];
    for (let d = 1; d <= TABLE_DEPTH; d++) {
      const next = [];
      for (const node of frontier) {
        const lastAxis = node.path.length ? node.path[node.path.length - 1][0] : '';
        for (const m of BIG) {
          if (m[0] === lastAxis) continue;
          const st = PERM[m].map((src) => node.st[src]);
          const k = key(st);
          if (TABLE.has(k)) continue;
          const path = node.path.concat(m);
          TABLE.set(k, path);
          next.push({ st, path });
        }
      }
      frontier = next;
    }
    return TABLE;
  }

  function solveTips(state) {
    const moves = [];
    let st = state;
    for (const X of AXES) {
      const tip = X.toLowerCase();
      const ok = (s) => TIP_PAIRS[X].every(([t, c]) => s[t] === s[c]);
      for (const m of ['', tip, tip + "'"]) {
        const s2 = m ? apply(st, [m]) : st;
        if (ok(s2)) { if (m) moves.push(m); st = s2; break; }
      }
    }
    return { moves, state: st };
  }

  /**
   * Solve a state given in canonical colours (face i has colour i when solved).
   * Returns the optimal list of moves (tips first, then at most 11 layer moves).
   */
  function solve(state) {
    const table = buildTable();
    const tips = solveTips(state);
    let best = null;
    let frontier = [{ st: tips.state, path: [] }];
    for (let d = 0; d <= SEARCH_DEPTH && !(best && best.length <= d); d++) {
      for (const node of frontier) {
        const hit = table.get(key(node.st));
        if (hit) {
          const total = node.path.concat(invert(hit));
          if (!best || total.length < best.length) best = total;
        }
      }
      if (d === SEARCH_DEPTH) break;
      const next = [];
      for (const node of frontier) {
        const lastAxis = node.path.length ? node.path[node.path.length - 1][0] : '';
        for (const m of BIG) {
          if (m[0] === lastAxis) continue;
          next.push({ st: PERM[m].map((src) => node.st[src]), path: node.path.concat(m) });
        }
      }
      frontier = next;
    }
    if (!best) throw new Error('This colour pattern cannot be solved. Please check the stickers.');
    const solution = tips.moves.concat(best);
    if (!isSolved(apply(state, solution))) throw new Error('This colour pattern cannot be solved. Please check the stickers.');
    return solution;
  }

  /**
   * Convert a user-painted state (any colour ids, null = unpainted) to canonical colours.
   * The colour of a face is worked out from the tips: the colour missing from a tip
   * belongs to the face opposite that vertex.
   */
  const OPPOSITE = { U: 'D', L: 'R', R: 'L', B: 'F' };
  function canonicalize(state) {
    if (state.some((c) => c === null || c === undefined)) throw new Error('Please paint every sticker first.');
    const counts = {};
    state.forEach((c) => { counts[c] = (counts[c] || 0) + 1; });
    const colors = Object.keys(counts);
    if (colors.length !== 4 || colors.some((c) => counts[c] !== 9)) {
      throw new Error('Every colour must appear exactly 9 times (one full face each).');
    }
    const map = {};
    for (const X of AXES) {
      const tipColors = LAYER[X.toLowerCase()].map((i) => String(state[i]));
      const missing = colors.filter((c) => !tipColors.includes(c));
      if (missing.length !== 1 || new Set(tipColors).size !== 3) throw new Error('The ' + X + ' tip has an impossible colour combination.');
      map[missing[0]] = FACES.findIndex((f) => f.id === OPPOSITE[X]);
    }
    if (new Set(Object.values(map)).size !== 4) throw new Error('The tips have an impossible colour combination.');
    return { state: state.map((c) => map[String(c)]), map };
  }

  function randomState() {
    let st = SOLVED.slice();
    const moves = [];
    let last = '';
    for (let i = 0; i < 25; i++) {
      let m;
      do { m = BIG[Math.floor(Math.random() * BIG.length)]; } while (m[0] === last);
      last = m[0];
      moves.push(m);
    }
    for (const t of 'ulrb') {
      const r = Math.floor(Math.random() * 3);
      if (r === 1) moves.push(t);
      if (r === 2) moves.push(t + "'");
    }
    st = apply(st, moves);
    return { state: st, moves };
  }

  const api = {
    VERT, FACES, PALETTE, STICKERS, SOLVED, LAYER, PERM,
    rotate, dot, parse, apply, invert, invertMove, simplify, toString,
    moveInfo, solve, canonicalize, buildTable, isSolved, randomState,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Pyraminx = api;
})(typeof window !== 'undefined' ? window : globalThis);
