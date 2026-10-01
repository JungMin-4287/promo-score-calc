/* 승진점수 계산 엔진 — 브라우저·노드 공용(순수 함수)
 * 근거: 울산광역시교육청 「2026학년도 중등 교육공무원 승진 및 자격연수후보자 명부작성요령」(2025.11.)
 *       +「2026 승진·자격연수 평정프로그램(엑셀)」의 수식. 2027 명부(평정기준일 2027.2.28.)용 요령은 아직 없어 2026 기준을 그대로 쓰되,
 *       직무연수 '10년 2개월' 경과조치는 2025학년도 평정(2026.2.28.)까지만 적용한다.
 * 반올림: 경력 3자리, 근평 3자리, 교육성적 3자리, 가산점 합 4자리, 총점 4자리(엑셀 ROUND 와 같은 '반올림').
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Promo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ───────── 날짜 도우미 (ISO 'YYYY-MM-DD' 문자열은 사전순 = 날짜순) ───────── */
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const dim = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
  function norm(s) {
    if (s === null || s === undefined) return null;
    s = String(s).trim();
    if (!s) return null;
    const m = /^(\d{4})[.\-\/ ]+(\d{1,2})[.\-\/ ]+(\d{1,2})\.?$/.exec(s) || /^(\d{4})(\d{2})(\d{2})$/.exec(s);
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12 || d < 1 || d > dim(y, mo)) return null;
    return `${y}-${pad(mo)}-${pad(d)}`;
  }
  const P = s => ({ y: +s.slice(0, 4), m: +s.slice(5, 7), d: +s.slice(8, 10) });
  const utc = s => { const o = P(s); return Date.UTC(o.y, o.m - 1, o.d); };
  const fmt = ms => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
  const addDays = (s, n) => fmt(utc(s) + n * 86400000);
  const daysBetween = (a, b) => Math.round((utc(b) - utc(a)) / 86400000);
  function addMonths(s, n) {
    const o = P(s); const t = o.y * 12 + (o.m - 1) + n;
    const y = Math.floor(t / 12), m = ((t % 12) + 12) % 12 + 1;
    return `${y}-${pad(m)}-${pad(Math.min(o.d, dim(y, m)))}`;
  }
  const addYears = (s, n) => addMonths(s, 12 * n);
  const minD = (a, b) => (a < b ? a : b);
  const maxD = (a, b) => (a > b ? a : b);
  const year = s => +s.slice(0, 4);
  const rnd = (x, d) => { const f = Math.pow(10, d); return Math.round(+(x * f).toFixed(7)) / f; };
  const capTo = (x, c) => (rnd(x, 8) >= c ? c : x);

  /** 엑셀 DATEDIF(시작, 종료+1, "m") 와 "md" (양끝 포함). 일수 30 이상은 29로 본다(프로그램과 같은 처리). */
  function diffMD(start, end) {
    if (!start || !end || end < start) return { months: 0, days: 0 };
    const e1 = addDays(end, 1);
    const S = P(start), E = P(e1);
    let months = (E.y - S.y) * 12 + (E.m - S.m);
    if (E.d < S.d) months--;
    if (months < 0) return { months: 0, days: 0 };
    // 엑셀 DATEDIF "md"와 같은 계산: 종료일(+1)의 일 − 시작일의 일, 모자라면 종료월 바로 앞 달의 일수를 더한다
    const prevDim = dim(E.m === 1 ? E.y - 1 : E.y, E.m === 1 ? 12 : E.m - 1);
    let days = E.d >= S.d ? E.d - S.d : prevDim - S.d + E.d;
    if (days >= 30) days = 29;
    if (days < 0) days = 0;
    return { months, days };
  }
  const mdText = (months, days) => `${months}개월${days ? ' ' + days + '일' : ''}`;

  /* ───────── 평정 기간(연수 학점·학교폭력 단위) ───────── */
  // ~2015: 달력 연도 / 2016: 2016.1.1.~2017.2.28.(14개월) / 2017~: 학년도(3.1.~익년 2.말)
  function periodKey(d) {
    const o = P(d);
    if (d < '2016-01-01') return String(o.y);
    if (d < '2017-03-01') return '2016';
    return String(o.m <= 2 ? o.y - 1 : o.y);
  }
  function periodStart(k) { const y = +k; return y <= 2015 ? `${y}-01-01` : y === 2016 ? '2016-01-01' : `${y}-03-01`; }
  function periodEnd(k) { const y = +k; return y <= 2015 ? `${y}-12-31` : y === 2016 ? '2017-02-28' : `${y + 1}-02-${pad(dim(y + 1, 2))}`; }
  function periodLabel(k) {
    const y = +k;
    if (y <= 2015) return `${y}년(1.1.~12.31.)`;
    if (y === 2016) return '2016(2016.1.1.~2017.2.28.)';
    return `${y}학년도`;
  }
  /** from~to 사이에 걸치는 평정 기간 키 목록(오름차순) */
  function periodKeys(from, to) {
    const a = +periodKey(from), b = +periodKey(to);
    const out = [];
    for (let y = a; y <= b; y++) out.push(String(y));
    return out;
  }
  /** 학년도 시작 연도 → 그 학년도의 마지막 날(평정기준일 후보) */
  const schoolYearEnd = y => `${y + 1}-02-${pad(dim(y + 1, 2))}`;

  /* ───────── 상수: 규정 ───────── */
  const KINDS = {
    g1: { label: '교감자격연수 후보자', pos: 'teacher', qualName: '중등1정교사자격', qualK: 0.025 },
    g2: { label: '교감승진 후보자', pos: 'teacher', qualName: '중등교감자격', qualK: 0.05 },
    j1: { label: '교장자격연수 후보자', pos: 'vice', qualName: '중등교감자격', qualK: 0.05 },
    j2: { label: '교장승진 후보자', pos: 'vice', qualName: '중등교장자격', qualK: 0.05 },
  };
  const MAX = { career: 70, perf: 100, qual: 9, duty: 18, dutyVice: 6, research: 3, bonusCommon: 3.5, bonusSelect: 9.91 };

  /* 국가기술자격증(선택가산점) — 명부작성요령 선택가산점 8)과 평정프로그램 '국가기술 자격증 소지 교사(가장 유리한 자격증 1개만 기입)'.
   * 0.50점: 기술사·기능장·기사·산업기사·서비스분야 1급 / 0.25점: 기능사·서비스분야 2·3급. 합산하지 않고 가장 유리한 1개만(상한 0.50).
   * 정보화 관련 자격증(국가기술자격법 시행령의 정보 분야 + 서비스 분야의 워드프로세서·컴퓨터활용능력)은 담당 과목·근무교 계열·학교급과 관계없이 인정하고,
   * 그 밖의 자격은 담당 과목과 관련되고 그 과목을 직접 가르친 경우에만 인정한다(특성화·특목고 등). 직무연수 학점으로 쓴 자격은 제외.
   * 문서실무사는 2016.3.1.~2019.6.25. 취득분만 인정. 교감·교장 평정은 해당 직위(또는 전직 전 직위)에서 취득한 자격만. */
  const CERTS = {
    cpu1: { label: '컴퓨터활용능력 1급', pts: 0.5, it: true },
    cpu2: { label: '컴퓨터활용능력 2급', pts: 0.25, it: true },
    wp1: { label: '워드프로세서 1급', pts: 0.5, it: true },
    wp2: { label: '워드프로세서 2급', pts: 0.25, it: true },
    it50: { label: '정보 분야 기술사·기사·산업기사(정보처리기사 등)', pts: 0.5, it: true },
    it25: { label: '정보 분야 기능사·서비스 3급(정보처리기능사·워드프로세서 3급 등)', pts: 0.25, it: true },
    g50: { label: '그 밖의 기술사·기능장·기사·산업기사·서비스분야 1급', pts: 0.5, it: false },
    g25: { label: '그 밖의 기능사·서비스분야 2·3급', pts: 0.25, it: false },
  };
  const DOC_WINDOW = ['2016-03-01', '2019-06-25'];

  const CAREER_TABLE = {
    basic: { 가: { max: 64, m: 0.3555, d: 0.0118 }, 나: { max: 60, m: 0.3333, d: 0.0111 }, 다: { max: 56, m: 0.3111, d: 0.0103 } },
    over: { 가: { max: 6, m: 0.1, d: 0.0033 }, 나: { max: 5, m: 0.0833, d: 0.0027 }, 다: { max: 4, m: 0.0666, d: 0.0022 } },
  };
  const BASIC_DAYS = 180 * 30, OVER_DAYS = 60 * 30;

  const CONTEST = { '전국1등급': 1.5, '전국2등급': 1.25, '전국3등급': 1.0, '시도1등급': 1.0, '시도2등급': 0.75, '시도3등급': 0.5 };
  const COAUTHOR = n => (n <= 1 ? 1 : n === 2 ? 0.7 : n === 3 ? 0.5 : 0.3);
  const DEGREE = { 박사: { related: 3, other: 1.5 }, 석사: { related: 1.5, other: 1.0 } };
  const DUTY_CONV = s => (s > 95 ? 100 : s > 90 ? 95 : s > 85 ? 90 : 85);

  /* 선택·공통 가산점 항목(기간형). m=월 평정점, d=일 평정점 */
  const R_HOME = d => (d < '2016-03-01' ? { m: 0.002, d: 0.00007 } : { m: 0.003, d: 0.0001 });
  const R_CIRC = d => (d < '2016-03-01' ? { m: 0.01, d: 0.00033 } : { m: 0.005, d: 0.00017 });
  const CATS = {
    edu_research: { label: '교육부 지정 연구·시범학교', group: '공통', rate: () => ({ m: 0.018, d: 0.0006 }), from: '1973-01-01', fam: 'edu_research' },
    office_research: { label: '시·도교육감 지정 연구·시범학교', group: '선택', rate: () => ({ m: 0.010, d: 0.00033 }), from: '1973-01-01', fam: 'office_research' },
    overseas: { label: '재외국민교육기관 파견', group: '공통', rate: () => ({ m: 0.015, d: 0.0005 }), fam: 'overseas' },
    dispatch_old: { label: '교육감 발령 파견교원(2020.2.29. 이전 선발)', group: '선택', rate: () => ({ m: 0.021, d: 0.0007 }), fam: 'dispatch' },
    dispatch_new: { label: '교육감 발령 파견교원(2020.3.1. 이후 선발)', group: '선택', rate: () => ({ m: 0.010, d: 0.00033 }), fam: 'dispatch' },
    head: { label: '보직교사(1급정교사) — 부장 등', group: '선택', rate: () => ({ m: 0.021, d: 0.0007 }), fam: 'head' },
    specialist: { label: '장학사·교육연구사', group: '선택', rate: () => ({ m: 0.021, d: 0.0007 }), fam: 'specialist' },
    island_a: { label: '도서·벽지 가급지', group: '선택', rate: () => ({ m: 0.042, d: 0.0014 }), from: '1967-04-01', fam: 'island' },
    island_b: { label: '도서·벽지 나급지(울산학생교육원 ~2021.2.28.)', group: '선택', rate: () => ({ m: 0.034, d: 0.00113 }), from: '1967-04-01', fam: 'island' },
    island_c: { label: '도서·벽지 다급지(울산학생교육원 2021.3.1.~)', group: '선택', rate: () => ({ m: 0.025, d: 0.00083 }), from: '1967-04-01', fam: 'island' },
    island_d: { label: '도서·벽지 라급지', group: '선택', rate: () => ({ m: 0.017, d: 0.00057 }), from: '1967-04-01', fam: 'island' },
    hansen: { label: '한센병환자 자녀 학교(학급) ~2008.12.31.', group: '선택', rate: () => ({ m: 0.021, d: 0.0007 }), to: '2008-12-31', fam: 'hansen' },
    rural: { label: '농어촌학교(읍·면)', group: '선택', rate: () => ({ m: 0.015, d: 0.0005 }), from: '1995-03-01', fam: 'rural' },
    policy: { label: '정책지원학교', group: '선택', rate: () => ({ m: 0.012, d: 0.0004 }), from: '2010-05-01', fam: 'rural' },
    special: { label: '특수여건학교', group: '선택', rate: () => ({ m: 0.009, d: 0.0003 }), from: '2003-03-01', fam: 'rural' },
    sped_school: { label: '특수학교 담임(~2007.2.28.)', group: '선택', rate: () => ({ m: 0.021, d: 0.0007 }), to: '2007-02-28', fam: 'sped' },
    sped_class: { label: '특수학급 담임(~2007.2.28.)', group: '선택', rate: () => ({ m: 0.0105, d: 0.00035 }), to: '2007-02-28', fam: 'sped' },
    circuit: { label: '순회교사', group: '선택', rate: R_CIRC, fam: 'circuit', splitAt: ['2016-03-01'] },
    homeroom: { label: '담임교사(중등)', group: '선택', rate: R_HOME, from: '2010-03-01', fam: 'edu_dev', splitAt: ['2016-03-01'] },
    youth: { label: '청소년단체 활동 지도(~2021.2.28.)', group: '선택', rate: R_HOME, from: '2010-03-01', to: '2021-02-28', fam: 'edu_dev', splitAt: ['2016-03-01'] },
    excellent: { label: '교육활동 우수지도(2016.3.1.~2021.2.28.)', group: '선택', rate: () => ({ m: 0.003, d: 0.0001 }), from: '2016-03-01', to: '2021-02-28', fam: 'edu_dev' },
  };
  const CAT_ORDER = Object.keys(CATS);
  // 동일 기간 중복 불가(×) — 명부작성요령 [표38] 울산 승진가산점 규정 제5조제2항 관련
  const CONFLICT_FAM = [
    ['head', 'hansen'], ['head', 'circuit'], ['head', 'edu_dev_home'],
    ['specialist', 'island'], ['specialist', 'rural'],
    ['island', 'hansen'], ['island', 'rural'], ['island', 'sped'], ['island', 'dispatch'], ['island', 'circuit*'],
    ['hansen', 'rural'], ['hansen', 'sped'], ['hansen', 'circuit'],
    ['rural', 'sped'], ['rural', 'dispatch'], ['rural', 'circuit*'],
    ['sped', 'circuit'],
    ['edu_research', 'office_research'], ['edu_research', 'dispatch'], ['edu_research', 'circuit'],
    ['office_research', 'dispatch'], ['office_research', 'circuit'],
    ['dispatch', 'edu_dev'],
    ['circuit', 'edu_dev'],
  ];
  // 담임교사·청소년단체·우수지도는 서로도 중복 불가(교육발전 항목 '유리한 것 하나'), 보직교사와는 담임만 충돌
  function conflicts(a, b, circuitDual) {
    if (a === b) return false;
    const fa = CATS[a].fam, fb = CATS[b].fam;
    if (fa === fb) return true;   // 같은 계열(농어촌·정책지원·특수여건 / 도서벽지 급지 / 특수학교·학급 / 파견 / 담임·청소년단체·우수지도)은 한 기간에 하나만
    const fas = [fa, fa === 'edu_dev' && a === 'homeroom' ? 'edu_dev_home' : null].filter(Boolean);
    const fbs = [fb, fb === 'edu_dev' && b === 'homeroom' ? 'edu_dev_home' : null].filter(Boolean);
    for (const [x, y] of CONFLICT_FAM) {
      const star = x.endsWith('*') || y.endsWith('*');
      const xx = x.replace('*', ''), yy = y.replace('*', '');
      const hit = (fas.includes(xx) && fbs.includes(yy)) || (fas.includes(yy) && fbs.includes(xx));
      if (hit) {
        if (star && circuitDual) continue;       // 농어촌·도서벽지 학교에 적을 둔 순회교사(△)는 동시 인정
        return true;
      }
    }
    return false;
  }

  /* ───────── 1. 경력평정 ───────── */
  function careerScore(periods, baseDate) {
    const warnings = [];
    const rows = [];
    (periods || []).forEach((p, i) => {
      const s = norm(p.start);
      if (!s) return;
      let e = p.end ? norm(p.end) : baseDate;
      if (!e) { warnings.push(`경력 ${i + 1}행: 종료일 형식이 올바르지 않습니다.`); return; }
      if (s > baseDate) return;
      if (e > baseDate) e = baseDate;
      if (e < s) { warnings.push(`경력 ${i + 1}행: 종료일이 시작일보다 빠릅니다.`); return; }
      rows.push({ s, e, grade: p.grade || '가', rate: +p.rate === 0.5 ? 0.5 : 1, label: p.label || '', mil: !!p.mil, idx: i });
    });
    // 같은 날 두 경력이 있을 수 없으므로 겹친 날짜는 한 번만 센다(높은 등급 > 낮은 등급, 100% > 50% 우선)
    {
      const pri = r => ({ 가: 0, 나: 1, 다: 2 }[r.grade] * 10 + (r.rate === 1 ? 0 : 1));
      const byPri = rows.slice().sort((a, b) => pri(a) - pri(b) || (a.s < b.s ? -1 : 1));
      const acc = [];
      for (const r of byPri) {
        const segs = subtract(r.s, r.e, acc.map(a => [a.s, a.e]));
        if (segs.length !== 1 || segs[0][0] !== r.s || segs[0][1] !== r.e) warnings.push(`경력 기간이 겹쳐 겹친 날짜는 한 번만 계산했습니다: ${r.label || r.s}`);
        for (const [s, e] of segs) acc.push({ ...r, s, e });
      }
      rows.length = 0;
      acc.forEach(a => rows.push(a));
    }
    rows.sort((a, b) => (a.s < b.s ? -1 : a.s > b.s ? 1 : 0));
    // 이어지는 같은 등급·환산율 기간은 합쳐서 월·일 계산(프로그램의 '연속근무')
    const runs = [];
    for (const r of rows) {
      const last = runs[runs.length - 1];
      if (last && last.grade === r.grade && last.rate === r.rate && last.mil === r.mil && addDays(last.e, 1) === r.s) { last.e = r.e; last.parts.push(r); }
      else runs.push({ s: r.s, e: r.e, grade: r.grade, rate: r.rate, mil: r.mil, parts: [r] });
    }
    let eduDays = 0;
    for (const r of runs) {
      const { months, days } = diffMD(r.s, r.e);
      r.c = r.rate === 1 ? months * 30 + days : months * 15 + Math.floor(days / 2);
      r.md = { months, days };
      if (r.parts.some(p => !p.mil)) eduDays += r.c;
    }
    // 평정기준일에서 거슬러 올라가며 기본경력(180개월) → 초과경력(60개월)에 배정
    const byRecent = runs.slice().sort((a, b) => (a.e < b.e ? 1 : a.e > b.e ? -1 : 0));
    const B = { 가: 0, 나: 0, 다: 0 }, O = { 가: 0, 나: 0, 다: 0 };
    let accB = 0, accO = 0;
    const detail = [];
    for (const r of byRecent) {
      let c = r.c;
      const toB = Math.min(c, BASIC_DAYS - accB);
      const d = { s: r.s, e: r.e, grade: r.grade, rate: r.rate, label: r.parts.map(p => p.label).filter(Boolean).join('·'), idxs: r.parts.map(p => p.idx), basic: 0, over: 0, lost: 0 };
      if (toB > 0) { B[r.grade] += toB; accB += toB; c -= toB; d.basic = toB; }
      if (c > 0 && accO < OVER_DAYS) { const toO = Math.min(c, OVER_DAYS - accO); O[r.grade] += toO; accO += toO; c -= toO; d.over = toO; }
      d.lost = c;
      if (r.rate === 1) {   // 기간 안에서의 경계일(처음 ~ lost, over, basic 순으로 이어짐)
        const at = x => addDays(addMonths(r.s, Math.floor(x / 30)), x % 30);
        if (d.over > 0) { d.overFrom = at(d.lost); d.overTo = d.basic > 0 ? addDays(at(d.lost + d.over), -1) : r.e; }
        if (d.basic > 0) d.basicFrom = at(d.lost + d.over);
      }
      detail.push(d);
    }
    const score = (tbl, tot, fullMonths) => {
      let sum = 0; const by = {};
      for (const g of ['가', '나', '다']) {
        const M = Math.floor(tot[g] / 30), D = tot[g] % 30;
        let p = M >= fullMonths ? tbl[g].max : M * tbl[g].m + D * tbl[g].d;
        p = Math.min(p, tbl[g].max);
        by[g] = { months: M, days: D, points: p };
        sum += p;
      }
      return { by, sum };
    };
    const sb = score(CAREER_TABLE.basic, B, 180), so = score(CAREER_TABLE.over, O, 60);
    const basicPts = Math.min(sb.sum, 64), overPts = Math.min(so.sum, 6);
    const total = rnd(basicPts + overPts, 3);
    const creditedDays = runs.reduce((a, r) => a + r.c, 0);
    let maxDate = null;   // 이대로 계속 근무할 때 경력 70점(20년)을 채우는 날
    if (creditedDays < BASIC_DAYS + OVER_DAYS) {
      const R = BASIC_DAYS + OVER_DAYS - creditedDays;
      maxDate = addDays(addMonths(baseDate, Math.floor(R / 30)), R % 30);
    }
    if (accB < BASIC_DAYS && rows.length) warnings.push(`기본경력이 ${Math.floor(accB / 30)}개월(15년=180개월 미만)입니다.`);
    return {
      total, basic: { by: sb.by, points: basicPts, months: Math.floor(accB / 30), days: accB % 30, full: accB >= BASIC_DAYS },
      over: { by: so.by, points: overPts, months: Math.floor(accO / 30), days: accO % 30, full: accO >= OVER_DAYS },
      detail, warnings, eduMonths: Math.floor(eduDays / 30), eduDays,
      creditedDays, maxDate,
    };
  }

  /* ───────── 2. 근무성적 ───────── */
  function perfScore(kindKey, baseDate, scores) {
    const kind = KINDS[kindKey];
    const Y = year(baseDate);
    const ys = [Y - 1, Y - 2, Y - 3, Y - 4, Y - 5];
    const has = y => scores && scores[y] !== undefined && scores[y] !== null && scores[y] !== '' && !isNaN(+scores[y]);
    const val = y => +scores[y];
    const warnings = [];
    const W = [0.34, 0.33, 0.33];
    let list = ys.filter(has).map(y => ({ y, s: val(y), imputed: false }));
    if (kind.pos === 'vice') {
      const need = ys.slice(0, 3);
      if (!need.every(has)) return { value: null, chosen: [], warnings: ['교감 근무성적은 교육청이 입력합니다. 점수를 입력하지 않으면 근평을 뺀 합계만 표시합니다.'], pending: true, candidates: list };
      const chosen = need.map((y, i) => ({ y, s: val(y), w: W[i] }));
      return { value: rnd(chosen.reduce((a, c) => a + c.s * c.w, 0), 3), chosen, warnings, candidates: list };
    }
    if (list.length < 3) {
      if (list.length === 0) return { value: null, chosen: [], warnings: ['근무성적을 입력하세요(최근 5년 중 유리한 3년).'], pending: true, candidates: [] };
      // 평정점 없는 학년도: 전후 평균(앞 평정이 없으면 85점) — 명부작성요령 Ⅲ-1-사-5)
      warnings.push('근평이 3개년 미만이라 없는 학년도를 규정(전후 평균, 앞 평정 없으면 85점)대로 채워 계산했습니다.');
      const asc = ys.slice().reverse();
      const filled = {};
      asc.forEach((y, i) => {
        if (has(y)) { filled[y] = val(y); return; }
        let before = null, after = null;
        for (let j = i - 1; j >= 0; j--) if (has(asc[j])) { before = val(asc[j]); break; }
        for (let j = i + 1; j < asc.length; j++) if (has(asc[j])) { after = val(asc[j]); break; }
        if (before === null) before = 85;
        filled[y] = after === null ? before : (before + after) / 2;
      });
      list = ys.map(y => ({ y, s: filled[y], imputed: !has(y) }));
    }
    const sorted = list.slice().sort((a, b) => b.y - a.y);
    let best = null;
    for (let i = 0; i < sorted.length; i++) for (let j = i + 1; j < sorted.length; j++) for (let k = j + 1; k < sorted.length; k++) {
      const v = sorted[i].s * W[0] + sorted[j].s * W[1] + sorted[k].s * W[2];
      if (!best || v > best.v + 1e-9) best = { v, c: [sorted[i], sorted[j], sorted[k]] };
    }
    const chosen = best.c.map((c, i) => ({ y: c.y, s: c.s, w: W[i], imputed: c.imputed }));
    return { value: rnd(best.v, 3), chosen, warnings, candidates: list };
  }

  /* ───────── 3. 연수성적 ───────── */
  function dutyWindowStart(baseDate, opt) {
    if (opt && opt.windowStart) return opt.windowStart;
    // 경과조치: 2016~2025학년도 평정(기준일 ~2026.2.28.)은 '10년 2개월'(프로그램: 기준연도-10년 1.1.)
    if (baseDate <= '2026-02-28') return `${year(baseDate) - 10}-01-01`;
    return addDays(addYears(baseDate, -10), 1);
  }
  function trainingScore(state, baseDate, opt) {
    const kindKey = state.profile.kind, kind = KINDS[kindKey];
    const T = state.training || {};
    const warnings = [], notes = [];
    // ① 자격연수
    const q = T.qual || {};
    let qual = { points: 0, note: '' };
    const full = +q.full || 100, score = q.score === '' || q.score == null ? null : +q.score;
    if (score !== null && !isNaN(score)) {
      let eff = score;
      if (eff < full * 0.6) { qual = { points: 0, note: '성적이 만점의 6할 미만이면 평정하지 않습니다.' }; }
      else {
        if (eff < full * 0.8) { eff = full * 0.8; notes.push('자격연수 성적이 만점의 8할 미만이라 8할로 평정했습니다.'); }
        qual = { points: 9 - (full - eff) * kind.qualK, k: kind.qualK, score, full, note: `9 − (${full} − ${eff}) × ${kind.qualK}` };
      }
    } else qual.note = '자격연수 성적을 입력하세요.';
    if (q.name && q.name !== kind.qualName) warnings.push(`평정구분(${kind.label})의 자격연수는 '${kind.qualName}'입니다.`);

    // ② 직무연수 (60시간 이상 · 최근 10년 · 원격은 2021.1.1. 이후 시작분만)
    const winStart = dutyWindowStart(baseDate, opt);
    const remoteFrom = '2021-01-01';
    const remoteApplies = kind.pos === 'teacher' ? baseDate >= '2024-02-29' : baseDate >= '2021-02-28';
    const all = (T.courses || []).map((c, i) => {
      const start = norm(c.start), end = norm(c.end);
      const hours = +c.hours || 0;
      const sc = c.score === '' || c.score == null ? null : +c.score;
      const o = { i, label: c.label || `과정 ${i + 1}`, start, end, hours, score: sc, mode: c.mode === '원격' ? '원격' : c.mode === '미확인' ? '미확인' : '집합', expires: end ? addYears(end, 10) : null, status: 'ok', reason: '' };
      if (!end) { o.status = 'no'; o.reason = '종료일 없음'; }
      else if (end > baseDate) { o.status = 'future'; o.reason = '평정기준일 이후'; }
      else if (hours < 60) { o.status = 'no'; o.reason = '60시간 미만'; }
      else if (end < winStart) { o.status = 'no'; o.reason = `기간 만료(${winStart} 이전)`; }
      else if ((o.mode === '원격' || o.mode === '미확인') && !(remoteApplies && start && start >= remoteFrom)) {
        o.status = 'no';
        o.reason = o.mode === '미확인' ? '집합/원격이 확인되지 않아 우선 불인정(이수증으로 확인, 집합이면 ‘집합’으로 변경)' : (remoteApplies ? '2021.1.1. 이전 시작 원격연수는 불인정' : '이 평정기준일에는 원격연수 불인정');
      }
      return o;
    });
    const eligible = all.filter(c => c.status === 'ok');
    const isTeacher = kind.pos === 'teacher';
    const slots = [];
    let duty = 0;
    if (eligible.length) {
      const withScore = eligible.filter(c => c.score !== null && !isNaN(c.score)).sort((a, b) => DUTY_CONV(b.score) - DUTY_CONV(a.score) || b.score - a.score);
      const best = withScore[0];
      if (!isTeacher) { // 교감·전문직: 성적 1건만(6점)
        if (best) { const conv = DUTY_CONV(best.score); slots.push({ slot: '성적', course: best, conv, points: 6 * conv / 100 }); }
        else notes.push('교감·교장 평정은 성적이 있는 60시간 이상 직무연수 1건(만점 6점)만 반영합니다.');
      } else {
        const optA = best ? 6 * DUTY_CONV(best.score) / 100 + 6 * Math.min(2, eligible.length - 1) : -1;
        const optB = 6 * Math.min(2, eligible.length);
        if (best && optA >= optB) {
          slots.push({ slot: '성적', course: best, conv: DUTY_CONV(best.score), points: 6 * DUTY_CONV(best.score) / 100 });
          eligible.filter(c => c !== best).sort((a, b) => (a.end < b.end ? 1 : -1)).slice(0, 2).forEach(c => slots.push({ slot: '이수', course: c, points: 6 }));
        } else {
          eligible.slice().sort((a, b) => (a.end < b.end ? 1 : -1)).slice(0, 2).forEach(c => slots.push({ slot: '이수', course: c, points: 6 }));
        }
      }
      duty = slots.reduce((a, s) => a + s.points, 0);
    }
    slots.forEach(s => { s.course.used = s.slot; });
    const education = rnd(Math.min(isTeacher ? 27 : 15, rnd((qual.points || 0) + duty, 3)), 3);

    // ③ 연구실적(교사만): 연구대회 입상(학년도별 1건) + 학위 → 3점 상한
    let research = { points: 0, contests: [], degree: null, sum: 0 };
    if (isTeacher) {
      const byKey = {};
      const list = (T.contests || []).map((c, i) => {
        const d = norm(c.date);
        const base = CONTEST[c.scale] || 0;
        const co = COAUTHOR(+c.authors || 1);
        const key = d ? (d < '2016-12-30' ? String(year(d)) : String(P(d).m <= 2 ? year(d) - 1 : year(d))) : null;
        const pts = d && d <= baseDate ? base * co : 0;
        return { i, label: c.label || `대회 ${i + 1}`, date: d, scale: c.scale, authors: +c.authors || 1, key, points: pts, dup: false };
      });
      list.forEach(c => { if (c.key !== null && c.points > 0) { if (!byKey[c.key] || c.points > byKey[c.key].points) byKey[c.key] = c; } });
      list.forEach(c => { if (c.key !== null && c.points > 0 && byKey[c.key] !== c) { c.dup = true; } });
      const contestSum = list.filter(c => !c.dup).reduce((a, c) => a + c.points, 0);
      let degree = null;
      (T.degrees || []).forEach((g, i) => {
        const d = norm(g.date);
        if (d && d > baseDate) return;
        const t = DEGREE[g.level];
        if (!t) return;
        const pts = g.related ? t.related : t.other;
        if (!degree || pts > degree.points) degree = { i, label: g.label || g.level, level: g.level, related: !!g.related, points: pts, date: d };
      });
      const sum = contestSum + (degree ? degree.points : 0);
      research = { points: Math.min(3, sum), contests: list, contestSum, degree, sum };
    }
    return { qual, duty, slots, courses: all, windowStart: winStart, education, research, researchPoints: research.points, warnings, notes, remoteApplies };
  }

  /* ───────── 4. 가산점 ───────── */
  // 구간 [s,e] 에서 blockers 와 겹치는 부분을 뺀 구간들
  function subtract(s, e, blockers) {
    let segs = [[s, e]];
    for (const [bs, be] of blockers) {
      const next = [];
      for (const [a, b] of segs) {
        if (be < a || bs > b) { next.push([a, b]); continue; }
        if (bs > a) next.push([a, addDays(bs, -1)]);
        if (be < b) next.push([addDays(be, 1), b]);
      }
      segs = next;
    }
    return segs;
  }
  function mergeRanges(list) { // 같은 항목끼리 겹치거나 이어지는 구간 병합
    const a = list.slice().sort((x, y) => (x[0] < y[0] ? -1 : 1));
    const out = [];
    for (const r of a) {
      const last = out[out.length - 1];
      if (last && r[0] <= addDays(last[1], 1)) last[1] = maxD(last[1], r[1]);
      else out.push([r[0], r[1]]);
    }
    return out;
  }
  function splitAtDates(s, e, dates) {
    let segs = [[s, e]];
    for (const d of dates || []) {
      const next = [];
      for (const [a, b] of segs) {
        if (d > a && d <= b) { next.push([a, addDays(d, -1)], [d, b]); } else next.push([a, b]);
      }
      segs = next;
    }
    return segs;
  }
  /** 가산점(선택) 구간의 월·일. 평정프로그램은 '시작일이 1일이 아니고 종료일이 2월 말일'이면
   *  2월을 30일 달로 보아 일수를 시작월 말일까지의 일수로 센다(예: 3.15.~익년 2.28. → 11개월 + 17일). */
  function bonusMD(s, e) {
    const r = diffMD(s, e);
    const S = P(s), E = P(e);
    if (S.d > 1 && E.m === 2 && E.d > 27) {
      let d = dim(S.y, S.m) - S.d + 1;
      if (d >= 30) d = 29;
      return { months: r.months, days: d };
    }
    return r;
  }
  function segPoints(s, e, rate) { const { months, days } = bonusMD(s, e); return { months, days, pts: months * rate.m + days * rate.d }; }

  /** 국가기술자격증: 가장 유리한 1개만(상한 0.50). rows[i] 는 B.certs[i] 의 결과 — status: ok(반영) | dup(더 유리한 1개만 인정) | credited(학점화) | future(평정기준일 이후 취득) | window(문서실무사 기간 밖) | type(종류 미선택) */
  function certScore(B, baseDate, kindKey) {
    const list = Array.isArray(B.certs) ? B.certs : [];
    const rows = list.map(c => {
      const spec = c && CERTS[c.type], d = norm(c && c.date);
      const r = { status: 'ok', points: 0, spec: spec || null, key: c && c.type };
      if (!spec) { r.status = 'type'; return r; }
      if (c.credited) { r.status = 'credited'; return r; }
      if (d && d > baseDate) { r.status = 'future'; return r; }
      if (/문서실무/.test(String(c.name || '')) && !(d && d >= DOC_WINDOW[0] && d <= DOC_WINDOW[1])) { r.status = 'window'; return r; }
      r.points = spec.pts;
      return r;
    });
    let chosen = -1;
    rows.forEach((r, i) => { if (r.status === 'ok' && (chosen < 0 || r.points > rows[chosen].points)) chosen = i; });
    rows.forEach((r, i) => { if (r.status === 'ok' && i !== chosen) r.status = 'dup'; });
    const legacy = Math.max(0, +B.cert || 0);      // 예전 저장 파일(점수만 고르던 칸)·평정프로그램 대조용 직접 점수
    const best = chosen >= 0 ? rows[chosen].points : 0;
    return { points: Math.min(Math.max(best, legacy), 0.5), rows, chosen, vice: !!(KINDS[kindKey] && KINDS[kindKey].pos === 'vice') };
  }

  function bonusScore(state, baseDate, training) {
    const B = state.bonus || {};
    const kind = KINDS[state.profile.kind];
    const warnings = [], notes = [];
    // ── 기간형 항목 ──
    const items = [];
    (B.periods || []).forEach((p, i) => {
      const cat = CATS[p.cat];
      if (!cat) return;
      const s0 = norm(p.start);
      if (!s0) return;
      let e0 = p.end ? norm(p.end) : baseDate;
      if (!e0) return;
      let s = s0, e = minD(e0, baseDate);
      if (s > baseDate) return;
      if (cat.from && s < cat.from) { warnings.push(`${cat.label}: ${cat.from} 이전 구간은 인정되지 않아 잘랐습니다.`); s = cat.from; }
      if (cat.to && e > cat.to) { warnings.push(`${cat.label}: ${cat.to} 이후 구간은 인정되지 않아 잘랐습니다.`); e = cat.to; }
      if (e < s) return;
      items.push({ cat: p.cat, s, e, label: p.label || '', dual: !!p.dual, idx: i });
    });
    // 같은 항목끼리 병합 → 요율이 바뀌는 날짜에서 분할
    const byCat = {};
    items.forEach(it => { (byCat[it.cat] = byCat[it.cat] || { ranges: [], dual: false, labels: [] }); byCat[it.cat].ranges.push([it.s, it.e]); byCat[it.cat].dual = byCat[it.cat].dual || it.dual; if (it.label) byCat[it.cat].labels.push(it.label); });
    let pieces = [];
    for (const cat of Object.keys(byCat)) {
      for (const [s, e] of mergeRanges(byCat[cat].ranges)) {
        for (const [a, b] of splitAtDates(s, e, CATS[cat].splitAt)) pieces.push({ cat, s: a, e: b, rate: CATS[cat].rate(a), dual: byCat[cat].dual });
      }
    }
    // 보직교사 상한(1.75점 = 83개월 10일) 초과분 계산에 쓰는 도우미 (아래 resolve 후 실행)
    const resolve = (src) => {
      const sorted = src.slice().sort((a, b) => b.rate.m - a.rate.m || CAT_ORDER.indexOf(a.cat) - CAT_ORDER.indexOf(b.cat) || (a.s < b.s ? -1 : 1));
      const acc = [];
      for (const p of sorted) {
        const blockers = acc.filter(a => conflicts(a.cat, p.cat, p.dual || a.dual)).map(a => [a.s, a.e]);
        for (const [s, e] of subtract(p.s, p.e, blockers)) acc.push({ ...p, s, e });
      }
      return acc;
    };
    // 보직교사·장학사 누적(83월 10일 = 2500일, 30일=1개월)
    const HEAD_CAP_DAYS = 2500;
    const headOver = (acc) => {
      const hs = acc.filter(a => a.cat === 'head' || a.cat === 'specialist').sort((a, b) => (a.s < b.s ? -1 : 1));
      let used = 0; const counted = [], over = [];
      for (const h of hs) {
        const { months, days } = diffMD(h.s, h.e);
        const len = months * 30 + days;
        if (used >= HEAD_CAP_DAYS) { over.push([h.s, h.e]); used += len; continue; }
        if (used + len <= HEAD_CAP_DAYS) { counted.push(h); used += len; continue; }
        // 경계 분할: 앞부분은 보직교사, 뒷부분은 초과경력
        const remain = HEAD_CAP_DAYS - used;
        const cut = addDays(addMonths(h.s, Math.floor(remain / 30)), remain % 30);   // 경계일(포함하지 않는 첫날)
        counted.push({ ...h, e: addDays(cut, -1) });
        over.push([cut, h.e]);
        used += len;
      }
      return { counted, over, used };
    };
    let acc = resolve(pieces);
    let ho = headOver(acc);
    // 2022.3.1. 이전의 초과분은 가산점이 없으므로 그 구간은 다른 항목(담임 등)이 쓸 수 있게 되돌려 다시 계산
    const voidRanges = [];
    for (const [s, e] of ho.over) { if (s < '2022-03-01') voidRanges.push([s, minD(e, '2022-02-28')]); }
    if (voidRanges.length) {
      const trimmed = [];
      for (const p of pieces) {
        if (p.cat === 'head' || p.cat === 'specialist') for (const [s, e] of subtract(p.s, p.e, voidRanges)) trimmed.push({ ...p, s, e });
        else trimmed.push(p);
      }
      acc = resolve(trimmed);
      ho = headOver(acc);
    }
    const overSegs = [];
    for (const [s, e] of ho.over) {
      const from = maxD(s, '2022-03-01');
      if (from <= e) overSegs.push({ cat: 'head_over', s: from, e, rate: { m: 0.003, d: 0.0001 } });
    }
    // 보직교사 초과분은 담임(동률 0.003)과 택일 — 위에서 보직이 우선했으므로 별도 조정 없음
    const finalSegs = acc.filter(a => !(a.cat === 'head' || a.cat === 'specialist')).concat(ho.counted, overSegs);
    const sums = {}; const segDetail = {};
    for (const sg of finalSegs) {
      const r = segPoints(sg.s, sg.e, sg.rate);
      sums[sg.cat] = (sums[sg.cat] || 0) + r.pts;
      (segDetail[sg.cat] = segDetail[sg.cat] || { months: 0, days: 0, segs: [] });
      segDetail[sg.cat].months += r.months; segDetail[sg.cat].days += r.days;
      segDetail[sg.cat].segs.push({ s: sg.s, e: sg.e, months: r.months, days: r.days, pts: r.pts });
    }
    // 입력 행별 인정 결과(중복·상한 처리 뒤)
    const rowInfo = {};
    for (const it of items) {
      const keys = (it.cat === 'head' || it.cat === 'specialist') ? [it.cat, 'head_over'] : [it.cat];
      const fullMD = bonusMD(it.s, it.e), fullD = fullMD.months * 30 + fullMD.days;
      let dd = 0, overDD = 0;
      for (const sg of finalSegs.filter(g => keys.includes(g.cat))) {
        const s = maxD(sg.s, it.s), e = minD(sg.e, it.e);
        if (s <= e) { const r = bonusMD(s, e), v = r.months * 30 + r.days; if (sg.cat === 'head_over') overDD += v; else dd += v; }
      }
      const tot = dd + overDD;
      rowInfo[it.idx] = {
        months: Math.floor(tot / 30), days: tot % 30, fullMonths: fullMD.months, fullDays: fullMD.days,
        over: overDD > 0 ? { months: Math.floor(overDD / 30), days: overDD % 30 } : null,
        status: tot <= 0 ? 'none' : tot >= fullD ? 'full' : 'part',
      };
    }
    const S = k => sums[k] || 0;
    const dmOf = k => { const d = segDetail[k]; if (!d) return { months: 0, days: 0 }; const t = d.months * 30 + d.days; return { months: Math.floor(t / 30), days: t % 30 }; };

    // ── 공통 ──
    // 연구·시범학교: 교육부(1.0) + 교육감 → 합산 1.25
    const eduR = Math.min(S('edu_research'), 1.0), offR = Math.min(S('office_research'), 1.25);
    const research = Math.min(eduR + offR, 1.25);
    const ovs = Math.min(S('overseas'), 0.5), dsp = Math.min(S('dispatch_old') + S('dispatch_new'), 1.0);
    const dispatch = Math.min(ovs + dsp, 1.0);
    // 직무연수(학점) — 연수성적에 쓴 과정은 제외
    const yh = B.yearHours || {};
    const excl = {};
    ((training && training.slots) || []).forEach(s => { if (s.course && s.course.end) { const k = periodKey(s.course.end); excl[k] = (excl[k] || 0) + s.course.hours; } });
    const credits = [];
    let creditSum = 0;
    Object.keys(yh).map(Number).sort((a, b) => a - b).forEach(y => {
      const k = String(y);
      if (periodStart(k) > baseDate) return;
      const hours = +yh[k] || 0;
      if (!hours) return;
      const ex = excl[k] || 0;
      const net = Math.max(0, hours - ex);
      const raw = Math.floor(rnd(net / 15, 6));
      const c = Math.min(4, raw);
      credits.push({ key: k, hours, excluded: ex, net, raw, credit: c });
      creditSum += c;
    });
    const trainBonus = Math.min(creditSum * 0.02, 1.0);
    // 학교폭력 예방·대응: 연 1회 0.1점, 합계 1.0점
    const vSet = new Set((B.violence || []).map(String).filter(k => /^\d{4}$/.test(k) && periodStart(k) <= baseDate));
    const violence = Math.min(vSet.size * 0.1, 1.0);
    const common = trainBonus + violence + research + dispatch;

    // ── 선택 ──
    const headSpec = Math.min(S('head') + S('specialist'), 1.75);
    const headOverPts = Math.min(S('head_over'), 0.4);
    const island = Math.min(S('island_a') + S('island_b') + S('island_c') + S('island_d') + S('hansen'), 1.5);
    const ruralParts = { rural: Math.min(S('rural'), 1.26), policy: Math.min(S('policy'), 1.26), special: Math.min(S('special'), 0.54) };
    const ruralSum = Math.min(ruralParts.rural + ruralParts.policy + ruralParts.special, 1.26);
    const sped = Math.min(S('sped_school') + S('sped_class'), 0.75);
    const circuit = Math.min(S('circuit'), 1.0);
    const nat = Math.min(+B.national || 0, 0.1);
    const eduDevRaw = Math.min(S('homeroom'), 0.5) + Math.min(S('youth'), 0.5) + Math.min(S('excellent'), 0.5) + nat;
    const eduDev = Math.min(eduDevRaw, 0.5);
    const certRes = certScore(B, baseDate, state.profile && state.profile.kind);
    const cert = certRes.points;
    const other = Math.max(0, +B.other || 0);
    const select = headSpec + island + ruralSum + sped + circuit + eduDev + headOverPts + cert + other;

    if (S('edu_research') > 1.0 + 1e-9) notes.push('교육부 지정 연구·시범학교(공통) 상한 1.00점에 이미 도달해 추가 경력은 점수가 늘지 않습니다.');
    if (headOverPts > 0 || ho.used >= HEAD_CAP_DAYS) notes.push('보직교사 경력이 상한(1.75점=83개월 10일)을 넘어 초과분은 월 0.003점(상한 0.40점)으로 계산됩니다.');
    if (certRes.chosen >= 0 && certRes.vice) notes.push('국가기술자격증은 교감 직위(또는 전직 전 직위)에서 취득한 것만 평정합니다. 교감 임용 이후 취득한 자격인지 확인하세요.');
    if (certRes.chosen >= 0 && certRes.rows[certRes.chosen].spec && !certRes.rows[certRes.chosen].spec.it) notes.push('정보화 관련이 아닌 국가기술자격증은 담당 과목과 관련되고 그 과목을 직접 가르친 경우에만 인정됩니다.');
    return {
      common: rnd(common, 4), select: rnd(select, 4), total: rnd(common + select, 4),
      parts: {
        trainBonus: { points: trainBonus, credits, creditSum, cap: 1.0 },
        violence: { points: violence, count: vSet.size, cap: 1.0 },
        research: { points: research, edu: eduR, office: offR, cap: 1.25, eduRaw: S('edu_research'), officeRaw: S('office_research'), ...{ eduDM: dmOf('edu_research'), officeDM: dmOf('office_research') } },
        dispatch: { points: dispatch, overseas: ovs, dispatch: dsp, cap: 1.0 },
        head: { points: headSpec, raw: S('head') + S('specialist'), cap: 1.75, dm: dmOf('head'), usedDays: ho.used },
        headOver: { points: headOverPts, raw: S('head_over'), cap: 0.4, dm: dmOf('head_over') },
        island: { points: island, cap: 1.5 },
        rural: { points: ruralSum, cap: 1.26, rural: ruralParts.rural, policy: ruralParts.policy, special: ruralParts.special, raw: S('rural') + S('policy') + S('special'), dm: { rural: dmOf('rural'), policy: dmOf('policy'), special: dmOf('special') } },
        sped: { points: sped, cap: 0.75 },
        circuit: { points: circuit, cap: 1.0 },
        eduDev: { points: eduDev, cap: 0.5, homeroom: Math.min(S('homeroom'), 0.5), youth: Math.min(S('youth'), 0.5), excellent: Math.min(S('excellent'), 0.5), national: nat, raw: eduDevRaw, dm: { homeroom: dmOf('homeroom'), youth: dmOf('youth'), excellent: dmOf('excellent') } },
        cert: { points: cert, cap: 0.5, rows: certRes.rows, chosen: certRes.chosen },
        other: { points: other },
      },
      segDetail, rowInfo, warnings, notes,
    };
  }

  /* ───────── 5. 한국사 요건 · 응시 요건 ───────── */
  function eligibility(state, baseDate, careerRes) {
    const p = state.profile, kind = KINDS[p.kind];
    const out = [];
    if (p.kind === 'g1') {
      const kh = p.koreanHistory || '';
      out.push({
        key: 'history', ok: kh === 'exam' || kh === 'course', unknown: !kh || kh === 'unknown',
        text: '한국사 요건: 한국사능력검정시험 3급 이상 합격 또는 한국사 관련 연수 합산 60시간 이상 이수(교감 자격연수 응시대상자 순위명부 작성 조건)',
      });
      const qd = norm(p.firstQualDate);
      out.push({
        key: 'career3', ok: careerRes.eduMonths >= 36 && !!qd, unknown: !qd,
        text: `교육경력 3년 이상 + 중등 1급 정교사 자격 소지(평정기준일 기준, 현재 교육경력 ${Math.floor(careerRes.eduMonths / 12)}년 ${careerRes.eduMonths % 12}개월)`,
      });
    }
    return out;
  }

  /* ───────── 종합 ───────── */
  function compute(state, baseDateOverride, opt) {
    const baseDate = norm(baseDateOverride || state.profile.baseDate);
    const kind = KINDS[state.profile.kind];
    const career = careerScore(state.career, baseDate);
    const perf = perfScore(state.profile.kind, baseDate, state.perf || {});
    const training = trainingScore(state, baseDate, opt);
    const bonus = bonusScore(state, baseDate, training);
    const perfVal = perf.value;
    const sumWithoutPerf = rnd(career.total + training.education + training.researchPoints + bonus.total, 4);
    const total = perfVal === null ? null : rnd(sumWithoutPerf + perfVal, 4);
    const max = {
      career: 70, perf: 100, qual: 9, duty: kind.pos === 'teacher' ? 18 : 6, research: kind.pos === 'teacher' ? 3 : 0,
      bonusCommon: 3.5, bonusSelect: 9.91,
    };
    const maxTotal = max.career + max.perf + max.qual + max.duty + max.research + max.bonusCommon + max.bonusSelect;
    const elig = eligibility(state, baseDate, career);
    return { baseDate, kind: state.profile.kind, career, perf, training, bonus, sumWithoutPerf, total, max, maxTotal, elig };
  }

  /* ───────── 시나리오(앞으로 N년) ───────── */
  /** 전망(예상) 입력을 실제 기록 위에 얹은 상태를 만든다. 실제 기록(state)은 건드리지 않는다.
   *  plan.years  : [{year(학년도 시작 연도), career(false면 근무 경력을 더하지 않음 — 올해 칸), head, homeroom, school:'rural'|'special'|'policy'|'none',
   *                  research:'none'|'edu'|'office', violence, hours(추가 연수 시간)}]
   *  plan.courses/contests/degrees/periods/certs : 예정 직무연수·연구대회·학위·가산점 기간·국가기술자격증(실제 행과 같은 모양)
   *  plan.perf   : { 학년도: 근무성적 합산점(가정) } — 실제 입력이 있어도 이 값이 우선
   *  plan.perfFill : 비어 있는 학년도를 이 점수로 가정
   *  예정 항목은 실제 행들 뒤에 같은 순서로 붙이므로, 화면에서 (실제 행 수 + 순번)으로 결과를 찾을 수 있다. */
  function applyPlan(state) {
    const plan = state.plan;
    if (!plan) return state;
    const years = Array.isArray(plan.years) ? plan.years.filter(y => y && +y.year) : [];
    const list = k => (Array.isArray(plan[k]) ? plan[k].filter(r => r && typeof r === 'object') : []);
    const perfMap = plan.perf && typeof plan.perf === 'object' ? plan.perf : {};
    const okNum = v => v !== undefined && v !== null && v !== '' && !isNaN(+v);
    const fill = okNum(plan.perfFill) ? +plan.perfFill : null;
    if (!years.length && !list('courses').length && !list('contests').length && !list('degrees').length && !list('periods').length
      && !list('certs').length && !Object.keys(perfMap).some(k => okNum(perfMap[k])) && fill === null) return state;
    const s = JSON.parse(JSON.stringify(state));
    s.career = (s.career || []).filter(r => !r.plan);
    // 지금 근무 중(종료일을 비운) 경력이 있으면 어느 평정기준일에서도 이어서 계산되므로, 학년도 칸마다 경력 행을 따로 더하지 않는다
    // (그렇지 않으면 마지막 전망 학년도 이후 날짜에서 경력이 멈춘다). 종료일을 적어 둔 경우에만 학년도 칸이 근무를 이어 준다.
    const working = s.career.some(r => !r.end && !r.mil);
    s.bonus = s.bonus || {};
    s.bonus.periods = (s.bonus.periods || []).filter(r => !r.plan);
    s.bonus.violence = (s.bonus.violence || []).slice();
    s.bonus.yearHours = Object.assign({}, s.bonus.yearHours || {});
    s.perf = Object.assign({}, s.perf || {});
    s.training = s.training || {};
    s.training.courses = (s.training.courses || []).filter(c => !c.plan);
    s.training.contests = (s.training.contests || []).filter(c => !c.plan);
    s.training.degrees = (s.training.degrees || []).filter(c => !c.plan);
    for (const c of list('courses')) s.training.courses.push({ ...c, plan: true });
    for (const c of list('contests')) s.training.contests.push({ ...c, plan: true });
    for (const g of list('degrees')) s.training.degrees.push({ ...g, plan: true });
    for (const p of list('periods')) s.bonus.periods.push({ ...p, plan: true });
    s.bonus.certs = (s.bonus.certs || []).filter(c => !c.plan);
    for (const c of list('certs')) s.bonus.certs.push({ ...c, plan: true });
    for (const y of years) {
      const yr = +y.year, st = `${yr}-03-01`, en = schoolYearEnd(yr);
      if (y.career !== false && !working) s.career.push({ start: st, end: en, grade: plan.careerGrade || '가', rate: 1, label: `${yr}학년도(계획)`, plan: true });
      const add = (cat) => s.bonus.periods.push({ cat, start: st, end: en, label: `${yr}학년도(계획)`, plan: true });
      if (y.head) add('head');
      if (y.homeroom) add('homeroom');
      if (y.school && y.school !== 'none') add(y.school);
      if (y.research === 'edu') add('edu_research'); else if (y.research === 'office') add('office_research');
      if (y.violence && !s.bonus.violence.includes(String(yr))) s.bonus.violence.push(String(yr));
      if (okNum(y.hours)) s.bonus.yearHours[String(yr)] = rnd((+s.bonus.yearHours[String(yr)] || 0) + (+y.hours), 2);   // 실제 시간에 더한다
      if (okNum(y.perf)) s.perf[yr] = +y.perf;     // 예전 저장 파일(학년도 행에 근무성적을 적던 때)과의 호환
    }
    for (const k of Object.keys(perfMap)) if (okNum(perfMap[k])) s.perf[k] = +perfMap[k];
    if (fill !== null) {
      const y0 = year(norm(state.profile && state.profile.baseDate) || '2027-02-28');
      for (let y = y0 - 7; y <= y0 + 8; y++) if (!okNum(s.perf[y])) s.perf[y] = fill;
    }
    return s;
  }

  function defaultState() {
    return {
      version: 1,
      profile: { name: '', kind: 'g1', baseDate: '2027-02-28', firstQualDate: '', koreanHistory: '' },
      career: [{ label: '', start: '', end: '', grade: '가', rate: 1 }],
      perf: {},
      training: { qual: { name: '중등1정교사자격', label: '', start: '', end: '', score: '', full: 100 }, courses: [], contests: [], degrees: [] },
      bonus: { periods: [], yearHours: {}, violence: [], certs: [], cert: 0, national: 0, other: 0 },
      plan: { years: [], courses: [], contests: [], degrees: [], periods: [], certs: [], perf: {}, perfFill: '', target: '', careerGrade: '가' },
    };
  }

  return {
    KINDS, MAX, CATS, CAT_ORDER, CONTEST, DEGREE, CAREER_TABLE, CERTS,
    norm, diffMD, mdText, addDays, addMonths, addYears, rnd, daysBetween, periodKey, periodStart, periodEnd, periodLabel, schoolYearEnd, dutyWindowStart,
    careerScore, perfScore, trainingScore, bonusScore, eligibility, compute, applyPlan, defaultState, periodKeys,
    _internal: { conflicts, subtract, mergeRanges, splitAtDates },
  };
});
