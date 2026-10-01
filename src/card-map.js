/* 인사기록카드 표(Card.parse 결과) → 승진점수 계산기 입력값
 * card.js 가 복원한 표를 읽어 경력·연수·연구·가산점 항목으로 옮기고, 사람이 확인해야 할 점을 따로 모은다.
 * DOM 에 의존하지 않는다. 엔진(Promo)은 opts.E 로 받는다(없어도 동작은 하되 항목 이름 확인은 생략).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./card.js'));
  else root.CardMap = factory(root.Card);
})(typeof self !== 'undefined' ? self : this, function (Card) {
  'use strict';
  const nz = Card.nz;
  const p2 = n => String(n).padStart(2, '0');
  const iso = (y, m, d) => y + '-' + p2(m) + '-' + p2(d);
  const dateList = s => Array.from(String(s || '').matchAll(/(\d{4})\.(\d{1,2})\.(\d{1,2})/g)).map(m => iso(m[1], m[2], m[3]));
  const monthEnd = (y, m) => iso(y, m, new Date(Date.UTC(+y, +m, 0)).getUTCDate());
  const dsh = d => (d ? +d.slice(0, 4) + '.' + +d.slice(5, 7) + '.' + +d.slice(8, 10) + '.' : '');
  const rnd2 = x => Math.round(x * 100) / 100;
  const T = (r, k) => (r.cells[k] ? r.cells[k].text : '');
  const tidy = s => String(s || '').replace(/\s+/g, ' ').trim();

  /* 같은 표가 구역마다 있으면(연수/자격면허·연수이수·인사카드 …) 행이 가장 많은 구역 하나만 쓴다 */
  function pick(parsed, kind) {
    const groups = new Map();
    for (const tb of parsed.tables) if (tb.kind === kind) { if (!groups.has(tb.section)) groups.set(tb.section, []); groups.get(tb.section).push.apply(groups.get(tb.section), tb.rows); }
    let best = null;
    for (const [section, rows] of groups) if (!best || rows.length > best.rows.length) best = { section, rows };
    return { rows: best ? best.rows : [], section: best ? best.section : '', sizes: Array.from(groups, ([s, r]) => [s, r.length]) };
  }

  /* 가산점 영역·비고 → 계산기 항목 */
  function classifyBonus(area, note) {
    const a = nz(area), n = nz(note), s = a + n;
    if (/^학교폭력/.test(a)) return 'violence';
    if (/^농어촌/.test(a)) return 'rural';
    if (/연구/.test(a) && /\(공통\)/.test(a)) return 'edu_research';
    if (/연구/.test(a) && /\(선택\)/.test(a)) return 'office_research';
    if (/^시도특색/.test(a)) {
      if (/^담임/.test(n)) return 'homeroom';
      if (/^특수여건/.test(n)) return 'special';
      if (/RCY|청소년단체/i.test(n)) return 'youth';
      if (/우수지도/.test(n)) return 'excellent';
      if (/^정책지원/.test(n)) return 'policy';
      if (/^농어촌/.test(n)) return 'rural';
    }
    if (/학교폭력/.test(s)) return 'violence';
    if (/보직|부장교사/.test(s)) return 'head';
    if (/연구.*시범|연구학교/.test(s)) return /\(선택\)|교육감|시도교육청/.test(s) ? 'office_research' : 'edu_research';
    if (/농어촌/.test(s)) return 'rural';
    if (/특수여건/.test(s)) return 'special';
    if (/정책지원/.test(s)) return 'policy';
    if (/담임/.test(s)) return 'homeroom';
    if (/청소년|RCY/i.test(s)) return 'youth';
    if (/우수지도/.test(s)) return 'excellent';
    if (/순회/.test(s)) return 'circuit';
    if (/장학사|교육연구사/.test(s)) return 'specialist';
    if (/도서|벽지/.test(s)) { const m = /([가나다라])급지/.exec(s); return m ? 'island_' + 'abcd'['가나다라'.indexOf(m[1])] : null; }
    if (/재외/.test(s)) return 'overseas';
    return null;
  }

  /* 연수 방식(집합/원격)은 카드에 없다 — 이름·기관에 '원격'이 있으면 원격, 집합 표시가 있으면 집합, 아니면 미확인 */
  function guessMode(r) {
    const s = nz(r.no + r.name + r.org);
    if (/원격|사이버|온라인|이러닝|e러닝|elearning/i.test(s)) return '원격';
    if (/집합|대면|현장|합숙|워크숍|워크샵|캠프/.test(s)) return '집합';
    return '미확인';
  }

  const QUAL_RE = { g1: /1급.*정교사|정교사.*1급|1정/, g2: /교감/, j1: /교감/, j2: /교장/ };

  function toState(parsed, opts) {
    opts = opts || {};
    const E = opts.E || null;
    const kindKey = opts.kind || 'g1';
    const baseDate = opts.baseDate || '';
    const pKey = d => (E ? E.periodKey(d) : String(+d.slice(0, 4) - (+d.slice(5, 7) <= 2 ? 1 : 0)));
    const kindLabel = E && E.KINDS[kindKey] ? E.KINDS[kindKey].label : kindKey;
    const info = [], warn = [];
    const patch = { profile: {}, career: [], training: { qual: null, courses: [], contests: [], degrees: [] }, bonus: { periods: [], yearHours: {}, violence: [] } };
    const meta = parsed.meta || {};
    const mismatch = (label, p) => {
      const sizes = p.sizes.map(x => x[1]);
      if (sizes.length > 1 && Math.max.apply(null, sizes) !== Math.min.apply(null, sizes)) warn.push(label + ' 건수가 구역마다 다릅니다(' + p.sizes.map(x => x[0] + ' ' + x[1]).join(', ') + '). 가장 많은 쪽을 따랐으니 값을 한 번 훑어보세요.');
    };

    /* 인적사항 */
    if (meta.cardDate) info.push(['카드', '기준일 ' + meta.cardDate + [meta.school, meta.kind, meta.step].filter(Boolean).map(x => ' · ' + x).join('')]);
    if (/교감/.test(meta.pos || '') && /^g/.test(kindKey)) warn.push('카드의 직위가 교감인데 평정구분이 ‘' + kindLabel + '’입니다. 기본 탭에서 평정구분을 확인하세요.');
    if (/교사/.test(meta.pos || '') && /^j/.test(kindKey)) warn.push('카드의 직위가 교사인데 평정구분이 ‘' + kindLabel + '’입니다. 기본 탭에서 평정구분을 확인하세요.');

    /* 자격면허 → 1급 정교사 취득일 */
    const lic = pick(parsed, 'license');
    for (const r of lic.rows) {
      const all = nz(r.all.join(' '));
      if (/정교사\(?1급\)?|1급정교사/.test(all)) { const d = dateList(r.all.join(' '))[0]; if (d) { patch.profile.firstQualDate = d; break; } }
    }
    if (patch.profile.firstQualDate) info.push(['1급 정교사 취득일', dsh(patch.profile.firstQualDate)]);
    else warn.push('자격면허에서 1급 정교사 취득일을 찾지 못했습니다. 기본 탭에서 직접 입력하세요.');

    /* 연수이수 */
    const tp = pick(parsed, 'training'); mismatch('연수이수', tp);
    const trs = tp.rows.map(r => {
      const per = T(r, 'period'), ds = dateList(per), hm = /\((\d+)시간\s*(\d+)분\)/.exec(per), sc = parseFloat(T(r, 'score'));
      return { no: T(r, 'no'), name: tidy(T(r, 'name')), org: tidy(T(r, 'org')), kind: nz(T(r, 'kind')), start: ds[0] || '', end: ds[1] || ds[0] || '', hours: hm ? rnd2(+hm[1] + (+hm[2]) / 60) : NaN, score: isNaN(sc) ? null : sc, rel: nz(T(r, 'rel')) };
    }).filter(x => x.start || x.name);
    const duty = trs.filter(x => /직무/.test(x.kind));
    const qual = trs.filter(x => /자격/.test(x.kind));
    info.push(['연수이수', '총 ' + trs.length + '건 (직무연수 ' + duty.length + ', 자격연수 ' + qual.length + ', 기타 ' + (trs.length - duty.length - qual.length) + ')']);

    // 자격연수 — 평정구분에 맞는 것 하나
    const qre = QUAL_RE[kindKey] || QUAL_RE.g1;
    const qm = qual.filter(x => qre.test(nz(x.name))).sort((a, b) => (a.end < b.end ? 1 : -1))[0];
    if (qm) {
      patch.training.qual = { name: E && E.KINDS[kindKey] ? E.KINDS[kindKey].qualName : '', label: qm.name + (qm.org ? '(' + qm.org + ')' : ''), start: qm.start, end: qm.end, score: qm.score == null ? '' : qm.score, full: 100 };
      info.push(['자격연수', qm.name + ' · ' + dsh(qm.start) + '~' + dsh(qm.end) + ' · 성적 ' + (qm.score == null ? '없음' : qm.score)]);
      if (qm.score == null) warn.push('자격연수 성적이 카드에 없습니다. 연수·연구 탭에서 직접 입력하세요.');
    } else warn.push('평정구분에 맞는 자격연수 기록을 카드에서 찾지 못했습니다. 연수·연구 탭에서 직접 입력하세요.');

    // 직무연수 60시간 이상
    const winStart = E && baseDate ? E.dutyWindowStart(baseDate) : '';
    const longAll = duty.filter(x => x.hours >= 60);
    const long = longAll.filter(x => !winStart || !x.end || x.end >= winStart);   // 10년이 지난 과정은 점수에 쓰일 일이 없다
    const unknown = [];
    for (const x of long.slice().sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0))) {
      const mode = guessMode(x);
      patch.training.courses.push({ label: x.name + (x.org ? '(' + x.org + ')' : '') + (x.score == null ? ' — 성적 미기재' : ''), start: x.start, end: x.end, hours: x.hours, score: x.score == null ? '' : x.score, mode });
      if (mode === '미확인' && x.start < '2021-01-01' && (!winStart || x.end >= winStart)) unknown.push(x);
    }
    const longDesc = long.slice().sort((a, b) => (a.start < b.start ? -1 : 1));
    info.push(['60시간 이상 직무연수', long.length + '건' + (long.length ? ' (' + dsh(longDesc[0].start) + ' ~ ' + dsh(longDesc[longDesc.length - 1].start) + ' 시작)' : '') + (longAll.length > long.length ? ' · 기간(10년)이 지난 ' + (longAll.length - long.length) + '건은 제외' : '')]);
    if (unknown.length) warn.push('직무연수 ' + unknown.length + '건은 집합/원격 여부가 카드에 없습니다(' + unknown.map(x => '‘' + x.name.slice(0, 18) + '’').join(', ') + '). 2021.1.1. 이전 시작 원격연수는 점수가 되지 않아 우선 ‘확인 필요’(원격으로 계산)로 두었습니다. 이수증을 보고 집합이면 연수·연구 탭에서 ‘집합’으로 바꾸세요.');

    // 연도별 직무연수 시간(가산점 학점용) — 평정 기간(학년도) 키로 합산
    for (const x of duty) { if (!x.end || isNaN(x.hours)) continue; const k = pKey(x.end); patch.bonus.yearHours[k] = rnd2((patch.bonus.yearHours[k] || 0) + x.hours); }

    /* 연구실적 → 연구대회 */
    const rp = pick(parsed, 'research'); mismatch('연구실적', rp);
    for (const r of rp.rows) {
      const g = nz(T(r, 'grade')), lv = /전국|국가|국제/.test(g) ? '전국' : /시도|시·도|광역|교육청/.test(g) ? '시도' : '', no = /([123])\s*등급/.exec(g);
      const date = dateList(T(r, 'date'))[0] || '', au = parseInt(T(r, 'authors'), 10);
      const label = tidy(T(r, 'title').split('~')[0]);
      let scale = lv && no ? lv + no[1] + '등급' : '';
      if (!scale) { warn.push('연구실적 ‘' + label + '’의 등급(' + (g || '없음') + ')을 읽지 못했습니다. 연수·연구 탭에서 대회 규모를 고르세요.'); scale = '시도3등급'; }
      patch.training.contests.push({ label, date, scale, authors: au >= 1 ? Math.min(au, 4) : 1 });
    }
    info.push(['연구대회 입상', patch.training.contests.length + '건']);

    /* 학위(석·박사) */
    const dg = pick(parsed, 'degree'), ed = pick(parsed, 'education');
    for (const r of dg.rows) {
      const deg = nz(T(r, 'degree')), level = /박사/.test(deg) ? '박사' : /석사/.test(deg) ? '석사' : '';
      if (!level) continue;
      const rel = nz(T(r, 'rel')), related = /^(Y|유관|관련|예)/i.test(rel) && !/무관/.test(rel);
      let date = '';
      const er = ed.rows.find(e => nz(T(e, 'level')).indexOf(level) >= 0);
      const em = er && /(\d{4})\.(\d{1,2})/.exec(T(er, 'to'));
      if (em) date = monthEnd(em[1], em[2]);
      else { const rg = /(\d{4})\.(\d{1,2})\s*~\s*(\d{4})\.(\d{1,2})/.exec(T(r, 'school')); if (rg) date = monthEnd(rg[3], rg[4]); }
      patch.training.degrees.push({ level, related, label: tidy(T(r, 'school').replace(/\(.*?\)/g, '') + ' ' + T(r, 'major') + ' ' + T(r, 'degree')), date });
      if (!related) warn.push(level + ' 학위의 직무연관성이 ‘' + (rel || '미기재') + '’입니다. 직무와 관련 있으면 연구실적 점수가 더 높습니다(석사 1.0 → 1.5점). 사실과 다르면 연수·연구 탭에서 바꾸세요.');
    }
    info.push(['학위', patch.training.degrees.length ? patch.training.degrees.map(d => d.level + (d.related ? '(직무관련)' : '(직무무관)')).join(', ') : '석·박사 없음']);

    /* 가산점 */
    const bp = pick(parsed, 'bonus'); mismatch('가산점', bp);
    const periods = [], unclassified = [], counts = {};
    let noDate = 0;
    for (const r of bp.rows) {
      const ds = dateList(T(r, 'period')), area = tidy(T(r, 'area')), note = tidy(T(r, 'note'));
      if (!ds.length) { noDate++; continue; }
      const cat = classifyBonus(area, note);
      if (cat === 'violence') { const k = pKey(ds[0]); if (patch.bonus.violence.indexOf(k) < 0) patch.bonus.violence.push(k); counts.violence = (counts.violence || 0) + 1; continue; }
      if (!cat || (E && !E.CATS[cat])) { unclassified.push({ area, note, start: ds[0], end: ds[1] || '' }); continue; }
      periods.push({ cat, start: ds[0], end: ds[1] || '', label: note || area });
      counts[cat] = (counts[cat] || 0) + 1;
    }
    if (noDate) warn.push('가산점 ' + noDate + '행은 기간(날짜)을 읽지 못해 넣지 않았습니다. 해당하면 가산점 탭에서 직접 추가하세요.');
    if (unclassified.length) warn.push('가산점 ' + unclassified.length + '행은 어떤 항목인지 알 수 없어 넣지 않았습니다: ' + unclassified.map(u => (u.area + (u.note ? '·' + u.note : '')) + ' ' + dsh(u.start) + '~' + dsh(u.end)).join(' / ') + '. 해당하면 가산점 탭에서 직접 추가하세요.');

    /* 경력(임용발령사항) */
    const cp = pick(parsed, 'career');
    const sch = d => { const w = tidy(d).split(' ').filter(Boolean); return w.length ? w[w.length - 1] : ''; };
    const runs = [], leaves = [];
    for (const r of cp.rows) {
      const ds = dateList(T(r, 'period')), type = nz(T(r, 'type')), school = sch(T(r, 'dept')) || sch(T(r, 'issuer'));
      if (!ds.length) continue;
      const s = ds[0], e = ds[1] || '';
      if (/보직/.test(type)) { periods.push({ cat: 'head', start: s, end: e, label: '보직교사' + (school ? '(' + school + ')' : '') }); counts.head = (counts.head || 0) + 1; }
      else if (/휴직/.test(type) && !/복직/.test(type)) leaves.push({ type, start: s, end: e });
      else if (/복직|직위해제|정직|강등|면직|퇴직|파면|해임/.test(type)) continue;
      else runs.push({ label: school || tidy(type), start: s, end: e, grade: '가', rate: 1 });
    }
    runs.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
    const merged = [];
    for (const r of runs) {
      const L = merged[merged.length - 1];
      if (L && L.label === r.label && L.end && E && E.addDays(L.end, 1) === r.start) L.end = r.end; else merged.push(Object.assign({}, r));
    }
    if (merged.length) { const last = merged[merged.length - 1]; if (!last.end) last.label += '(현재)'; }
    patch.career = merged;
    info.push(['근무 이력', merged.length ? merged.map(c => c.label.replace(/\(현재\)$/, '')).join(' → ') : '찾지 못함']);
    if (!merged.length) warn.push('임용발령사항에서 근무 이력을 찾지 못했습니다. 경력 탭에서 직접 입력하세요.');
    if (leaves.length) warn.push('휴직 ' + leaves.length + '건이 있습니다(' + leaves.map(l => l.type + ' ' + dsh(l.start) + '~' + dsh(l.end)).join(', ') + '). 공무상 질병·병역·육아·입양 휴직은 근무로 100% 인정되어 그대로 두면 되고, 해외 유학·연수 휴직은 50%, 그 밖은 평정에서 빠집니다. 경력 탭에서 해당 기간을 확인하세요.');

    /* 임용 전 경력 — 군복무만 가경력으로 */
    const pc = pick(parsed, 'precareer'), mil = pick(parsed, 'military');
    const others = [];
    for (const r of pc.rows) {
      const ds = dateList(T(r, 'period')), kind = nz(T(r, 'placeKind') + T(r, 'place'));
      if (!ds.length) continue;
      if (/군/.test(kind) && !/학교|교육/.test(kind)) {
        const br = mil.rows[0] && nz(T(mil.rows[0], 'branch'));
        patch.career.push({ label: '임용 전 군복무(' + (br ? br + ', ' : '') + dsh(ds[0]) + '~' + dsh(ds[1] || ds[0]) + ')', start: ds[0], end: ds[1] || ds[0], grade: '가', rate: 1, mil: true });
      } else others.push(tidy(T(r, 'place')) + ' ' + dsh(ds[0]) + '~' + dsh(ds[1] || ''));
    }
    if (!patch.career.some(c => c.mil) && mil.rows.length) {
      const ds = dateList(T(mil.rows[0], 'period'));
      if (ds.length >= 2) patch.career.push({ label: '임용 전 군복무(병역사항 ' + dsh(ds[0]) + '~' + dsh(ds[1]) + ')', start: ds[0], end: ds[1], grade: '가', rate: 1, mil: true });
    }
    if (patch.career.some(c => c.mil)) info.push(['군복무', patch.career.filter(c => c.mil).map(c => dsh(c.start) + '~' + dsh(c.end)).join(', ')]);
    if (others.length) warn.push('임용 전 경력 중 군복무 외 ' + others.length + '건(' + others.join(' / ') + ')은 평정 인정 여부를 확인해야 해서 넣지 않았습니다. 인정되면 경력 탭에서 추가하세요.');

    // 같은 항목이 같은 기간으로 두 번 나오면(가산점 표와 임용발령 양쪽 등) 한 번만
    const seenP = new Set();
    const uniq = periods.filter(p => { const k = p.cat + '|' + p.start + '|' + p.end; if (seenP.has(k)) return false; seenP.add(k); return true; });
    periods.length = 0; Array.prototype.push.apply(periods, uniq);
    Object.keys(counts).forEach(k => { if (k !== 'violence') delete counts[k]; });
    periods.forEach(p => { counts[p.cat] = (counts[p.cat] || 0) + 1; });
    const order = E ? Object.keys(E.CATS) : [];
    periods.sort((a, b) => (order.indexOf(a.cat) - order.indexOf(b.cat)) || (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
    patch.bonus.periods = periods;
    const catName = k => (E && E.CATS[k] ? E.CATS[k].label.replace(/\(.*$/, '') : k);
    info.push(['가산점', periods.length || counts.violence ? Object.keys(counts).filter(k => k !== 'violence').map(k => catName(k) + ' ' + counts[k]).join(' · ') + (counts.violence ? (periods.length ? ' · ' : '') + '학교폭력 ' + counts.violence + '년' : '') : '없음']);

    /* 올해(평정기준일이 속한 학년도) 분이 카드에 아직 없을 수 있다 */
    if (baseDate) {
      const want = pKey(baseDate);
      const cardMax = periods.filter(p => p.cat !== 'head').reduce((m, p) => (pKey(p.start) > m ? pKey(p.start) : m), '0000');
      if (cardMax !== '0000' && cardMax < want) warn.push('카드의 가산점은 ' + (E ? E.periodLabel(cardMax) : cardMax) + '까지입니다. 평정기준일이 속한 ' + (E ? E.periodLabel(want) : want) + ' 분(담임·농어촌·연구학교·학교폭력 실적 등)은 카드에 아직 올라오지 않았을 수 있으니 가산점 탭에서 해당하면 직접 추가하세요.');
    }
    return { patch, info, warn, meta, stats: { training: trs.length, duty: duty.length, long: long.length, bonusRows: bp.rows.length, unclassified: unclassified.length, sections: { training: tp.section, bonus: bp.section, career: cp.section } } };
  }

  return { toState, classifyBonus, guessMode };
});
