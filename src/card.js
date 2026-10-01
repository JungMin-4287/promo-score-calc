/* 인사기록카드(NEIS 출력 PDF) 해석기
 * pdf.js 가 준 글자 조각·표 선 좌표만으로 표를 복원하고, 승진점수 계산기 입력값으로 옮긴다.
 * DOM·pdf.js 에 의존하지 않아 브라우저와 Node 에서 같은 코드로 시험한다.
 * 두 가지 출력 양식을 모두 읽는다.
 *   A) 「개인인사기록 <구역> 기준일…」 제목이 붙은 구역별 쪽 (연수이수·가산점·연구실적·임용발령사항 …)
 *   B) 「인사카드」(법정 양식) — 1.신상사항 … 20.임용전 경력이 번호 순서로 이어진 쪽
 * 열은 표 머리글의 글자(예: 연수기간, 시행기관)로, 줄은 가로선으로 찾는다. 글자 위치(좌표)를 외워 두지 않는다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Card = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const nz = s => String(s == null ? '' : s).replace(/\s+/g, '');

  /* ───────── 1. pdf.js 쪽 → 글자 조각 + 표 선 ───────── */
  async function extractPage(pdfjs, page, n) {
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = [];
    for (const i of tc.items) {
      if (!i.str || !i.str.trim()) continue;
      const h = Math.abs(i.transform[3]) || i.height || 8;
      items.push({ x: i.transform[4], y: vp.height - i.transform[5], w: i.width || 0, h, s: i.str });
    }
    const OPS = pdfjs.OPS;
    const ol = await page.getOperatorList();
    let ctm = [1, 0, 0, 1, 0, 0]; const stack = [];
    const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];
    const P = (x, y) => [ctm[0] * x + ctm[2] * y + ctm[4], vp.height - (ctm[1] * x + ctm[3] * y + ctm[5])];
    const H = [], V = [];
    const seg = (p1, p2) => {
      if (Math.abs(p1[1] - p2[1]) < 1.5 && Math.abs(p1[0] - p2[0]) > 1.5) H.push([(p1[1] + p2[1]) / 2, Math.min(p1[0], p2[0]), Math.max(p1[0], p2[0])]);
      else if (Math.abs(p1[0] - p2[0]) < 1.5 && Math.abs(p1[1] - p2[1]) > 1.5) V.push([(p1[0] + p2[0]) / 2, Math.min(p1[1], p2[1]), Math.max(p1[1], p2[1])]);
    };
    for (let i = 0; i < ol.fnArray.length; i++) {
      const f = ol.fnArray[i], a = ol.argsArray[i];
      if (f === OPS.save) stack.push(ctm.slice());
      else if (f === OPS.restore) ctm = stack.pop() || ctm;
      else if (f === OPS.transform) ctm = mul(ctm, a);
      else if (f === OPS.constructPath) {
        const ops = a[0], co = a[1]; let ci = 0, cx = 0, cy = 0;
        for (const op of ops) {
          if (op === OPS.moveTo) { cx = co[ci++]; cy = co[ci++]; }
          else if (op === OPS.lineTo) { const x = co[ci++], y = co[ci++]; seg(P(cx, cy), P(x, y)); cx = x; cy = y; }
          else if (op === OPS.rectangle) {
            const x = co[ci++], y = co[ci++], w = co[ci++], h = co[ci++];
            const p1 = P(x, y), p2 = P(x + w, y + h);
            const x0 = Math.min(p1[0], p2[0]), x1 = Math.max(p1[0], p2[0]), y0 = Math.min(p1[1], p2[1]), y1 = Math.max(p1[1], p2[1]);
            if (y1 - y0 < 2.5 && x1 - x0 > 3) H.push([(y0 + y1) / 2, x0, x1]);
            else if (x1 - x0 < 2.5 && y1 - y0 > 3) V.push([(x0 + x1) / 2, y0, y1]);
            else if (x1 - x0 > 3 && y1 - y0 > 3) { H.push([y0, x0, x1], [y1, x0, x1]); V.push([x0, y0, y1], [x1, y0, y1]); }
          } else if (op === OPS.curveTo) ci += 6; else if (op === OPS.curveTo2 || op === OPS.curveTo3) ci += 4;
        }
      }
    }
    return { n, w: vp.width, h: vp.height, items, H, V };
  }

  /* 같은 선의 조각을 이어 붙인다: [위치, 시작, 끝] → {p, a, b} */
  function mergeSegs(list) {
    const arr = list.slice().sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const out = [];
    for (const [p, a, b] of arr) {
      let m = null;
      for (let k = out.length - 1; k >= 0 && p - out[k].p <= 0.9; k--) {
        if (a <= out[k].b + 1.5 && b >= out[k].a - 1.5) { m = out[k]; break; }
      }
      if (m) { m.a = Math.min(m.a, a); m.b = Math.max(m.b, b); } else out.push({ p, a, b });
    }
    return out;
  }
  const cluster = (xs, tol) => {
    const s = xs.slice().sort((a, b) => a - b), out = [];
    for (const x of s) { const L = out[out.length - 1]; if (L && x - L.last <= tol) { L.sum += x; L.n++; L.last = x; } else out.push({ sum: x, n: 1, last: x }); }
    return out.map(c => c.sum / c.n);
  };

  /* ───────── 2. 머리글 글자로 표 종류·열 이름을 정한다 ───────── */
  const KINDS = [
    { kind: 'training', need: [/연수기간/, /과정명/], cols: { no: /이수번호/, name: /과정명/, org: /연수기관/, kind: /연수구분/, period: /연수기간/, score: /성적/, rel: /직무연관/, credit: /평정학점|연도별/ } },
    { kind: 'bonus', need: [/영역/, /연도/, /시행기관/], cols: { area: /영역/, period: /연도/, org: /시행기관/, note: /비고/ } },
    { kind: 'research', need: [/연구주제/, /수상일자/], cols: { title: /연구주제/, period: /연구기간/, grade: /등급/, date: /수상일자/, authors: /연구자수/ } },
    { kind: 'career', need: [/임용구분/, /발령청|부서/], cols: { period: /^기간/, type: /임용구분/, pos: /직급|직위/, dept: /부서/, issuer: /발령청|발령기관/ } },
    { kind: 'precareer', need: [/근무처구분/, /공무원여부/], cols: { period: /^기간/, placeKind: /근무처구분/, place: /^근무처$/, pos: /직위/, civil: /공무원여부/ } },
    { kind: 'degree', need: [/전공학과/, /학위/], cols: { school: /학교명/, major: /전공학과/, degree: /^학위$/, rel: /직무연관/ } },
    { kind: 'license', need: [/표시과목/, /관련법규/], cols: { date: /년월일|취득/, type: /종별/, subject: /표시과목/ } },
    { kind: 'education', need: [/입학년월/, /졸업년월/], cols: { from: /입학년월/, to: /졸업년월/, level: /^학력$/, major: /학과/ } },
    { kind: 'military', need: [/병역구분/, /복무기간/], cols: { type: /병역종류/, branch: /군별/, period: /복무기간/ } },
  ];
  const ANCHOR = /연수기간|시행기관|연구주제|임용구분|근무처구분|전공학과|입학년월|병역구분|표시과목/;

  function pageSection(pg, prev) {
    const top = pg.items.filter(it => it.y < 112).sort((a, b) => a.y - b.y || a.x - b.x).map(it => it.s).join(' ').replace(/\s+/g, ' ');
    const m = /개인인사기록\s*(.+?)\s*(?:기준일|출력자|$)/.exec(top);
    if (m) return m[1].trim();
    return prev;
  }

  /* 쪽 하나에서 표 찾기 */
  function tablesOnPage(pg, section) {
    // 쪽 밖으로 삐져나간 선(표 오른쪽 숨은 부분)은 자르고, 쪽 안에 남는 길이로만 본다
    const Hm = mergeSegs(pg.H.filter(h => h[0] >= 0 && h[0] <= pg.h).map(h => [h[0], Math.max(0, h[1]), Math.min(pg.w, h[2])]).filter(h => h[2] - h[1] > 1));
    const Vm = mergeSegs(pg.V.filter(v => v[0] >= 0 && v[0] <= pg.w).map(v => [v[0], Math.max(0, v[1]), Math.min(pg.h, v[2])]).filter(v => v[2] - v[1] > 1));
    const Hw = Hm.filter(h => h.b - h.a >= 300);
    const ys = cluster(Hw.map(h => h.p), 0.9);
    const out = [], seen = new Set();
    for (const an of pg.items) {
      if (!ANCHOR.test(nz(an.s))) continue;
      const yc = an.y - an.h * 0.3;
      let top = -Infinity, bot = Infinity;
      for (const y of ys) { if (y <= yc) top = Math.max(top, y); else bot = Math.min(bot, y); }
      if (!isFinite(top) || !isFinite(bot) || bot - top > 95) continue;
      const key = Math.round(top);
      if (seen.has(key)) continue;
      seen.add(key);
      const line = Hw.find(h => Math.abs(h.p - top) <= 1.2);
      if (!line) continue;
      // 머리글 구간을 가로지르는 세로선 = 열 경계
      const xs = cluster(Vm.filter(v => v.a <= top + 2.5 && v.b >= bot - 2.5 && v.p >= line.a - 2 && v.p <= line.b + 2).map(v => v.p), 1.6);
      if (xs.length < 3) continue;
      const cols = [];
      for (let k = 0; k + 1 < xs.length; k++) cols.push({ a: xs[k], b: xs[k + 1], label: '' });
      const inBand = pg.items.filter(it => { const c = it.y - it.h * 0.3; return c >= top && c < bot; });
      for (const c of cols) {
        c.label = nz(inBand.filter(it => { const xc = it.x + it.w / 2; return xc >= c.a && xc < c.b; }).sort((p, q) => p.y - q.y || p.x - q.x).map(it => it.s).join(''));
      }
      const labels = cols.map(c => c.label);
      const def = KINDS.find(d => d.need.every(re => labels.some(l => re.test(l))));
      if (!def) continue;
      const map = {}; const used = new Set();
      for (const [k, re] of Object.entries(def.cols)) {
        const idx = labels.findIndex((l, i) => !used.has(i) && re.test(l));
        if (idx >= 0) { map[k] = idx; used.add(idx); }
      }
      // 줄 나누기: 머리글 아래쪽 표 너비 가로선 사이 구간 가운데, 열 세로선이 덮인 구간만 행
      const inner = xs.slice(1, -1);
      const rows = [];
      let prev = bot;
      for (const y of ys) {
        if (y <= bot + 0.5) continue;
        const covered = inner.length ? inner.filter(x => Vm.some(v => Math.abs(v.p - x) <= 1.6 && v.a <= prev + 3 && v.b >= y - 3)).length / inner.length : 1;
        if (covered < 0.6) break;
        const cellAt = idx => {
          const c = cols[idx];
          const its = pg.items.filter(it => { const xc = it.x + it.w / 2, yy = it.y - it.h * 0.3; return xc >= c.a && xc < c.b && yy >= prev && yy < y; }).sort((p, q) => p.y - q.y || p.x - q.x);
          const lines = [];
          for (const it of its) {
            const L = lines[lines.length - 1];
            if (L && Math.abs(L.y - it.y) < 2.4) { L.s += (it.x - L.end > 3.5 ? ' ' : '') + it.s.trim(); L.end = it.x + it.w; }
            else lines.push({ y: it.y, s: it.s.trim(), end: it.x + it.w });
          }
          return { lines: lines.map(l => l.s), text: lines.map(l => l.s).join('') };
        };
        const all = cols.map((_, idx) => cellAt(idx));
        const cells = {};
        for (const [k, idx] of Object.entries(map)) cells[k] = all[idx];
        if (all.some(c => c.text)) rows.push({ y0: prev, y1: y, cells, all: all.map(c => c.text) });
        prev = y;
      }
      out.push({ kind: def.kind, section, page: pg.n, top, labels, rows });
    }
    return out;
  }

  /* 맨 위 인적사항 띠(소속·교원구분·호봉 …) */
  function pageMeta(pg) {
    const meta = {};
    const joined = pg.items.filter(it => it.y < 112).sort((a, b) => a.y - b.y || a.x - b.x).map(it => it.s).join(' ');
    const bd = /기준일\s*(\d{4}\.\d{2}\.\d{2})/.exec(joined); if (bd) meta.cardDate = bd[1];
    const nextTo = label => {
      const it = pg.items.find(i => nz(i.s) === label && i.y > 100 && i.y < 270);
      if (!it) return '';
      const r = pg.items.filter(j => j !== it && Math.abs(j.y - it.y) < 3 && j.x > it.x + it.w - 1).sort((a, b) => a.x - b.x)[0];
      return r ? r.s.trim() : '';
    };
    for (const [k, lab] of [['school', '소속'], ['kind', '교원구분'], ['pos', '직위'], ['step', '호봉'], ['duty', '보직']]) { const v = nextTo(lab); if (v) meta[k] = v; }
    return meta;
  }

  /* ───────── 3. 전체 쪽 → 표 목록 ───────── */
  function parse(pages) {
    const tables = []; let meta = {}; let section = '';
    for (const pg of pages) {
      if (pg.w > pg.h) continue;           // 가로로 넘친 쪽(표 오른쪽 끝)·요약서는 쓰지 않는다
      section = pageSection(pg, section);
      if (!meta.cardDate) meta = Object.assign(pageMeta(pg), meta);
      for (const t of tablesOnPage(pg, section)) tables.push(t);
    }
    return { meta, tables };
  }

  return { extractPage, parse, nz, _internal: { mergeSegs, cluster, tablesOnPage, pageSection } };
});
