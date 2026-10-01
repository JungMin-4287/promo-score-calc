/* ───────── 행별·요약 계산 표시 ───────── */
const badge = (cls, txt) => `<span class="badge ${cls}">${txt}</span>`;
const dutyMax = () => (isTeacher() ? 18 : 6);
const maxOf = () => R.max;

const DRV = {
  career(i) {
    const r = state.career[i]; if (!r) return '';
    const s = E.norm(r.start);
    if (!s) return '<span class="muted">시작일을 입력하세요 (예: 2012-03-01 또는 2012.3.1.)</span>';
    let e = r.end ? E.norm(r.end) : R.baseDate;
    if (!e) return badge('bad', '종료일 형식을 확인하세요');
    if (s > R.baseDate) return badge('info', '평정기준일 이후라 반영하지 않습니다');
    if (e > R.baseDate) e = R.baseDate;
    if (e < s) return badge('bad', '종료일이 시작일보다 빠릅니다');
    const md = E.diffMD(s, e);
    const det = R.career.detail.find(d => d.idxs.includes(i));
    let tag = '';
    if (det) {
      if (det.basic > 0 && det.over > 0) tag = badge('ok', '기본경력 + 초과경력');
      else if (det.basic > 0) tag = badge('ok', '기본경력');
      else if (det.over > 0) tag = badge('info', '초과경력');
      else tag = badge('', '20년을 넘는 기간이라 점수에 반영되지 않음');
    }
    const rate = +r.rate === 0.5 ? ' <span class="muted">(환산 50%)</span>' : '';
    return `<span class="num">${mdText(md.months, md.days)}</span>${rate} ${tag}`;
  },
  course(i) {
    const c = R.training.courses[i]; if (!c) return '';
    const slot = R.training.slots.find(s => s.course === c);
    let b;
    if (c.status === 'ok') {
      if (slot && slot.slot === '성적') b = badge('ok', `성적 1건 · 환산 ${slot.conv}점 → ${fx(slot.points, 3)}점`);
      else if (slot) b = badge('ok', '이수실적 6점');
      else b = badge('info', '인정되지만 3건 한도 밖(점수 반영 없음)');
    } else if (c.status === 'future') b = badge('info', '평정기준일 이후 — 반영 안 됨');
    else b = badge('bad', `불인정 · ${esc(c.reason)}`);
    const exp = c.expires ? `<span class="muted">10년 만료 ${dotd(c.expires)}</span>` : '';
    return `${b} ${exp}`;
  },
  contest(i) {
    const c = R.training.research.contests[i]; if (!c) return '';
    if (!c.date) return '<span class="muted">입상일을 입력하세요</span>';
    if (c.date > R.baseDate) return badge('info', '평정기준일 이후 — 반영 안 됨');
    if (c.dup) return badge('warn', '같은 학년도에 더 높은 실적이 있어 제외');
    return `${badge('ok', fx(c.points, 3) + '점')} <span class="muted">${c.key}학년도 입상 기준</span>`;
  },
  degree(i) {
    const g = state.training.degrees[i]; if (!g) return '';
    const t = E.DEGREE[g.level]; const pts = g.related ? t.related : t.other;
    const d = R.training.research.degree;
    if (g.date && E.norm(g.date) && E.norm(g.date) > R.baseDate) return badge('info', '평정기준일 이후 — 반영 안 됨');
    if (d && d.i === i) return `${badge('ok', pts + '점 인정')} <span class="muted">${g.related ? '직무 관련' : '직무 관련 아님(그 밖의 학위)'}</span>`;
    return badge('warn', `${pts}점이지만 다른 학위가 더 높아 제외(하나만 인정)`);
  },
  period(i) {
    const p = state.bonus.periods[i]; if (!p) return '';
    if (!E.norm(p.start)) return '<span class="muted">시작일·종료일을 입력하세요 (종료일을 비우면 평정기준일까지)</span>';
    const info = R.bonus.rowInfo[i];
    const rate = `<span class="muted">${catRateText(p.cat)}</span>`;
    if (!info) return `${badge('info', '평정기준일 이후이거나 인정 기간 밖')} ${rate}`;
    const full = mdText(info.fullMonths, info.fullDays);
    if (info.status === 'full') return `${badge('ok', `${full} 인정`)}${info.over ? ' ' + badge('info', `그중 ${mdText(info.over.months, info.over.days)}은 보직교사 초과경력`) : ''} ${rate}`;
    if (info.status === 'part') return `${badge('warn', `${mdText(info.months, info.days)}만 인정`)} <span class="muted">(전체 ${full} 중 겹치는 항목·인정 기간 때문에 일부 제외)</span> ${rate}`;
    return `${badge('bad', '인정되지 않음')} <span class="muted">같은 기간에 월 평정점이 더 높은 항목이 있거나 인정 기간 밖입니다</span> ${rate}`;
  },
  perf(y) {
    const ch = R.perf.chosen.find(c => String(c.y) === String(y));
    const v = state.perf[y];
    if (ch) return `${badge('ok', `반영 ${Math.round(ch.w * 100)}%`)} <span class="num">${fx(ch.s, 3)} × ${ch.w} = ${fx(ch.s * ch.w, 3)}</span>${ch.imputed ? ' ' + badge('warn', '입력이 없어 규정으로 보정한 값') : ''}`;
    if (isNum(v)) return badge('', isTeacher() ? '유리한 3개 학년도가 아니라 반영 안 됨' : '교감 평정은 최근 3개 학년도만 반영');
    return '';
  },
  yh(k) {
    const c = R.bonus.parts.trainBonus.credits.find(x => x.key === k);
    if (!c) return '<span class="muted">—</span>';
    const ex = c.excluded ? ` <span class="muted xs">(연수성적용 ${c.excluded}시간 제외)</span>` : '';
    return `<span class="num">${c.credit}학점</span>${c.raw > 4 ? ' <span class="muted xs">(상한 4학점)</span>' : ''}${ex}`;
  },
  'sum:career'() {
    const c = R.career;
    return `기본 <b>${c.basic.months}개월</b> · 초과 <b>${mdText(c.over.months, c.over.days)}</b> → <b>${fx(c.total)}점</b> / 70`;
  },
  'sum:perf'() { return R.perf.value === null ? '근무성적 입력 전' : `근무성적 <b>${fx(R.perf.value)}점</b> / 100`; },
  'sum:qual'() { const q = R.training.qual; return `<b>${fx(q.points)}점</b> / 9 <span class="muted">${q.note ? '· ' + esc(q.note) : ''}</span>`; },
  'sum:duty'() { return `<b>${fx(R.training.duty)}점</b> / ${dutyMax()}`; },
  'sum:contest'() { return `연구대회 합계 <b>${fx(R.training.research.contestSum)}점</b>`; },
  'sum:degree'() { const d = R.training.research.degree; return d ? `학위 <b>${fx(d.points)}점</b>` : '학위 <b>0점</b>'; },
  'sum:research'() { const r = R.training.research; return `연구실적 <b>${fx(R.training.researchPoints)}점</b> / 3 <span class="muted">(연구대회 ${fx(r.contestSum, 2)} + 학위 ${fx(r.degree ? r.degree.points : 0, 2)}, 상한 3점)</span>`; },
  'sum:yearly'() { const b = R.bonus.parts; return `직무연수 <b>${fx(b.trainBonus.points)}점</b>(${b.trainBonus.creditSum}학점) · 학교폭력 <b>${fx(b.violence.points)}점</b>(${b.violence.count}회)`; },
  'sum:periods'() { const b = R.bonus.parts; const v = R.bonus.total - b.trainBonus.points - b.violence.points - b.cert.points - b.other.points; return `기간으로 계산한 가산점 <b>${fx(v)}점</b>`; },
};

function paintDerived() {
  if (!R) return;
  $$('[data-drv]').forEach(el => {
    const raw = el.dataset.drv; const k = raw.indexOf(':');
    const type = raw.slice(0, k), arg = raw.slice(k + 1);
    const fn = type === 'sum' ? DRV['sum:' + arg] : DRV[type];
    try { el.innerHTML = fn ? fn(arg === '' ? undefined : (/^\d+$/.test(arg) && type !== 'perf' && type !== 'yh' ? +arg : arg)) : ''; } catch (e) { el.innerHTML = ''; }
  });
  paintTables();
}

function paintTables() {
  const tc = $('#tbl-career tbody');
  if (tc) {
    const c = R.career;
    const row = (name, months, days, pts) => `<tr><td>${name}</td><td>${mdText(months, days)}</td><td>${fx(pts, 4)}</td></tr>`;
    let h = '';
    ['가', '나', '다'].forEach(g => { const b = c.basic.by[g]; if (b.months || b.days) h += row(`기본경력 ${g}경력`, b.months, b.days, b.points); });
    h += `<tr><td>기본경력 소계(상한 64)</td><td>${mdText(c.basic.months, c.basic.days)}</td><td>${fx(c.basic.points, 4)}</td></tr>`;
    ['가', '나', '다'].forEach(g => { const b = c.over.by[g]; if (b.months || b.days) h += row(`초과경력 ${g}경력`, b.months, b.days, b.points); });
    h += `<tr><td>초과경력 소계(상한 6)</td><td>${mdText(c.over.months, c.over.days)}</td><td>${fx(c.over.points, 4)}</td></tr>`;
    h += `<tr class="tot"><td>경력평정점(소수 셋째 자리)</td><td></td><td>${fx(c.total, 3)}</td></tr>`;
    tc.innerHTML = h;
    const ex = $('#career-extra');
    if (ex) {
      const parts = [];
      if (c.maxDate) parts.push(`이대로 계속 근무하면 <b>${dotd(c.maxDate)}</b>쯤 경력 70점(기본 15년 + 초과 5년)을 채웁니다.`);
      else parts.push('경력평정이 이미 만점(70점)입니다.');
      const lostDays = c.detail.reduce((a, d) => a + d.lost, 0);
      if (lostDays > 0) parts.push(`20년을 넘는 경력 ${mdText(Math.floor(lostDays / 30), lostDays % 30)}은 점수에 반영되지 않습니다.`);
      ex.innerHTML = parts.join(' ');
    }
  }
  const tb = $('#tbl-bonus tbody');
  if (tb) {
    const b = R.bonus.parts;
    const r = (name, pts, cap, extra = '') => `<tr><td>${name}${extra ? ` <span class="muted xs">${extra}</span>` : ''}</td><td>${fx(pts, 4)}</td><td>${cap == null ? '' : fx(cap, 2)}</td><td>${cap != null && pts >= cap - 1e-9 ? badge('ok', '상한') : ''}</td></tr>`;
    let h = `<thead><tr><th>항목</th><th>인정 점수</th><th>상한</th><th></th></tr></thead>`;
    h += `<tr><td colspan="4" style="background:var(--surface-2);font-weight:600">공통가산점</td></tr>`;
    h += r('직무연수 이수실적', b.trainBonus.points, 1, `${b.trainBonus.creditSum}학점`);
    h += r('학교폭력 예방·대응', b.violence.points, 1, `${b.violence.count}회`);
    h += r('연구·시범학교(교육부 + 교육감 합산)', b.research.points, 1.25, `교육부 ${fx(b.research.edu, 3)}(상한 1.0) · 교육감 ${fx(b.research.office, 3)}`);
    h += r('재외국민교육기관·파견교원', b.dispatch.points, 1);
    h += `<tr><td colspan="4" style="background:var(--surface-2);font-weight:600">선택가산점</td></tr>`;
    h += r('보직교사·장학사', b.head.points, 1.75, `계산값 ${fx(b.head.raw, 3)}`);
    h += r('보직교사 초과근무', b.headOver.points, 0.4);
    h += r('도서·벽지·한센병', b.island.points, 1.5);
    h += r('농어촌·정책지원·특수여건', b.rural.points, 1.26, `농어촌 ${fx(b.rural.rural, 3)} · 정책 ${fx(b.rural.policy, 3)} · 특수여건 ${fx(b.rural.special, 3)}(상한 0.54), 계산값 ${fx(b.rural.raw, 3)}`);
    h += r('특수학교·학급', b.sped.points, 0.75);
    h += r('순회교사', b.circuit.points, 1);
    h += r('교육발전(담임·청소년단체·우수지도·체전)', b.eduDev.points, 0.5, `담임 ${fx(b.eduDev.homeroom, 3)} · 청소년단체 ${fx(b.eduDev.youth, 3)}`);
    h += r('국가기술자격', b.cert.points, 0.5);
    if (b.other.points) h += r('기타 규정 항목', b.other.points, null);
    h += `<tr class="tot"><td>가산점 합계</td><td>${fx(R.bonus.total, 4)}</td><td colspan="2"></td></tr>`;
    tb.parentElement.innerHTML = h;   // thead 포함 교체
  }
  const po = $('#plan-out');
  if (po) po.innerHTML = renderProjection();
}

/* ───────── 전망 표 + 선 그래프 ───────── */
function renderProjection() {
  const cols = projection();
  if (cols.length < 2) return '<div class="empty">계획 학년도를 입력하면 전망이 나타납니다.</div>';
  const teacher = isTeacher();
  const pend = cols.some(c => c.r.total === null);
  const val = c => (pend ? c.r.sumWithoutPerf : c.r.total);
  const th = cols.map(c => `<th>${dshort(c.date)}</th>`).join('');
  const line = (label, get, dec = 3, cls = '') => {
    const vals = cols.map(c => get(c.r));
    const tds = vals.map((v, i) => {
      const up = i > 0 && v !== null && vals[i - 1] !== null && v > vals[i - 1] + 1e-9;
      return `<td class="${up ? 'up' : (v === null ? 'nil' : '')}">${v === null ? '—' : fx(v, dec)}${up ? ` <span class="xs">▲${fx(v - vals[i - 1], 3)}</span>` : ''}</td>`;
    }).join('');
    return `<tr class="${cls}"><td>${label}</td>${tds}</tr>`;
  };
  const table = `<div class="tbl-wrap"><table class="t"><thead><tr><th>평정기준일</th>${th}</tr></thead><tbody>
    ${line('경력평정(70)', r => r.career.total)}
    ${line('근무성적(100)', r => r.perf.value)}
    ${line('자격연수(9)', r => r.training.qual.points)}
    ${line(`직무연수(${dutyMax()})`, r => r.training.duty)}
    ${teacher ? line('연구실적(3)', r => r.training.researchPoints) : ''}
    ${line('가산점 공통(3.5)', r => r.bonus.common)}
    ${line('가산점 선택(9.91)', r => r.bonus.select)}
    ${line('근평 제외 합계', r => r.sumWithoutPerf)}
    ${line('총점', r => r.total, 3, 'tot')}
  </tbody></table></div>`;
  // 선 그래프(합계 한 줄)
  const vals = cols.map(val);
  const W = 640, H = 210, L = 44, Rm = 20, T = 26, B = 32;
  let lo = Math.min(...vals), hi = Math.max(...vals);
  lo = Math.floor((lo - 2) / 5) * 5; hi = Math.ceil((hi + 2) / 5) * 5;
  if (hi - lo < 10) hi = lo + 10;
  const x = i => L + (W - L - Rm) * (cols.length === 1 ? 0.5 : i / (cols.length - 1));
  const y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
  const ticks = []; const step = (hi - lo) / 4; for (let k = 0; k <= 4; k++) ticks.push(lo + step * k);
  const pts = vals.map((v, i) => [x(i), y(v)]);
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const area = `${path} L${pts[pts.length - 1][0].toFixed(1)},${(H - B).toFixed(1)} L${pts[0][0].toFixed(1)},${(H - B).toFixed(1)} Z`;
  const svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="평정기준일별 ${pend ? '근평 제외 합계' : '총점'} 변화 선 그래프. 표와 같은 값입니다.">
    ${ticks.map(t => `<line class="grid-l" x1="${L}" x2="${W - Rm}" y1="${y(t).toFixed(1)}" y2="${y(t).toFixed(1)}"/><text x="${L - 8}" y="${(y(t) + 4).toFixed(1)}" text-anchor="end">${Math.round(t)}</text>`).join('')}
    <path class="ar" d="${area}"/><path class="ln" d="${path}"/>
    ${pts.map((p, i) => `<g><circle class="dt" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="5"/><circle class="hit" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="16"><title>${dshort(cols[i].date)} ${pend ? '근평 제외 합계' : '총점'} ${fx(vals[i], 3)}</title></circle></g>`).join('')}
    ${pts.map((p, i) => (i === 0 || i === pts.length - 1) ? `<text class="lbl" x="${p[0].toFixed(1)}" y="${(p[1] - 11).toFixed(1)}" text-anchor="${i === 0 ? 'start' : 'end'}">${fx(vals[i], 3)}</text>` : '').join('')}
    ${pts.map((p, i) => `<text x="${p[0].toFixed(1)}" y="${H - 10}" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}">${dshort(cols[i].date)}</text>`).join('')}
  </svg>`;
  const expire = [];
  R.training.courses.forEach(c => { if (c.status === 'ok' && c.expires && c.expires <= cols[cols.length - 1].date) expire.push(`‘${esc(c.label)}’ ${dotd(c.expires)}`); });
  return `<div class="chart-box">${svg}</div>
    <p class="note">${pend ? '근무성적이 비어 있어 <b>근평을 뺀 합계</b>를 그렸습니다.' : '총점 변화입니다.'} 세로 눈금은 ${lo}점부터라 변화 폭이 커 보이니, 정확한 값은 아래 표를 보세요.</p>
    ${table}
    ${expire.length ? `<div class="callout warn"><b>직무연수 10년 만료 예정:</b> ${expire.join(', ')} — 만료일이 지난 평정기준일부터 점수에서 빠집니다.</div>` : ''}`;
}

/* ───────── 확인 필요 · 점수 올리는 방법 ───────── */
function whatIf(mut) {
  const s = clone(state); mut(s);
  return E.compute(E.applyPlan(s), R.baseDate);
}
function buildChecks() {
  const out = [];
  const add = (cls, html) => out.push({ cls, html });
  if (R.invalidBase) add('bad', '평정기준일 형식이 올바르지 않아 마지막으로 입력한 올바른 날짜(' + dshort(R.baseDate) + ')로 계산하고 있습니다. 예: 2027-02-28');
  R.elig.forEach(e => { if (!e.ok) add(e.unknown ? 'warn' : 'bad', (e.unknown ? '확인하세요: ' : '요건 미충족: ') + esc(e.text)); });
  if (R.perf.value === null) add('warn', isTeacher() ? '근무성적을 입력하면 총점이 나옵니다(지금은 근평을 뺀 합계).' : '교감 근무성적은 교육청 입력이라 근평을 뺀 합계로 표시합니다.');
  const bad = R.training.courses.filter(c => c.status === 'no');
  if (bad.length) add('bad', `인정되지 않는 직무연수 ${bad.length}건: ${bad.map(c => `‘${esc(c.label)}’(${esc(c.reason)})`).join(', ')}. 이수증으로 집합·원격 여부와 시작일을 확인하세요.`);
  const d = R.training.research.degree;
  if (d && !d.related && d.level === '석사') add('warn', '석사학위가 “직무 관련 아님”으로 계산됐습니다. 교과·교육 관련 학위인데 인사기록카드에 N으로 돼 있다면 정정을 요청하세요.');
  [...R.career.warnings, ...(R.perf.pending ? [] : R.perf.warnings), ...R.training.warnings, ...R.bonus.warnings].forEach(w => add('warn', esc(w)));
  if (state.plan.on && state.plan.years.some(y => `${y.year}-03-01` <= R.baseDate)) add('info', '평정기준일이 계획 학년도에 걸쳐 있어 <b>계획(가정)이 포함된 값</b>입니다.');
  return out;
}
function buildTips() {
  const tips = []; const T = R.training; const teacher = isTeacher();
  const base = R.sumWithoutPerf;
  // 직무연수
  const dm = dutyMax();
  if (T.duty < dm - 1e-9) {
    const have = T.slots.length, need = Math.max(0, (teacher ? 3 : 1) - have);
    const gain = dm - T.duty;
    tips.push({ gain, html: `<b>직무연수 ${fx(T.duty, 1)}/${dm}점.</b> 인정되는 60시간 이상 과정이 ${have}건입니다.${need ? ` ${need}건을 더 이수하면 최대 +${fx(gain, 1)}점` : ''}${teacher ? '(성적 1건은 95점 초과여야 6점, 이수 2건은 건당 6점).' : '(성적 95점 초과 시 6점).'} 원격은 2021.1.1. 이후 시작한 과정만 됩니다.` });
  }
  // 석사 직무관련
  const g = state.training.degrees.findIndex(x => x.level === '석사' && !x.related);
  if (teacher && g >= 0) {
    const r2 = whatIf(s => { s.training.degrees[g].related = true; });
    const gain = r2.sumWithoutPerf - base;
    if (gain > 0.0004) tips.push({ gain, html: `<b>석사학위 직무관련 인정.</b> 지금은 “기타 학위”라 1.0점입니다. 직무관련으로 인정되면 연구실적이 <b>+${fx(gain, 3)}점</b>(상한 3점 적용 후)입니다.` });
  }
  // 학교폭력
  const vc = R.bonus.parts.violence.count;
  if (vc < 10) {
    const lastKey = E.periodKey(R.baseDate);
    const has = state.bonus.violence.includes(lastKey);
    if (!has) tips.push({ gain: 0.1, html: `<b>학교폭력 예방·대응 실적.</b> ${E.periodLabel(lastKey)}에 학교폭력 관련 실적이 등재되면 <b>+0.1점</b>입니다(현재 ${vc}회, 상한 10회).` });
  }
  // 연구실적 여지
  if (teacher && R.training.researchPoints < 2.9995) {
    const room = 3 - R.training.researchPoints;
    tips.push({ gain: room, html: `<b>연구실적 여지 ${fx(room, 3)}점.</b> 연구대회 입상(시·도 3등급 0.5점부터 전국 1등급 1.5점)이나 학위로 채울 수 있습니다. 한 학년도에 1건만 인정됩니다.` });
  }
  // 근평
  if (R.perf.value !== null && R.perf.value < 99.999) tips.push({ gain: 100 - R.perf.value, html: `<b>근무성적.</b> 반영되는 3개 학년도 합산점이 모두 1점 오르면 총점이 <b>+1.000점</b> 오릅니다(현재 ${fx(R.perf.value)}점, 만점 100).` });
  // 경력
  if (R.career.total < 69.9995 && R.career.maxDate) tips.push({ gain: 70 - R.career.total, html: `<b>경력평정.</b> 계속 근무하면 ${dotd(R.career.maxDate)}쯤 70점에 이릅니다(현재 ${fx(R.career.total)}점). 근무 기간이 늘면 시간이 가장 정직하게 점수를 올려 줍니다.` });
  // 보직교사
  const hp = R.bonus.parts.head;
  if (hp.raw > 0 && hp.points < 1.75 - 1e-9) {
    const left = Math.max(0, 2500 - hp.usedDays);
    tips.push({ gain: 1.75 - hp.points, html: `<b>보직교사.</b> 1.75점 상한까지 ${mdText(Math.floor(left / 30), left % 30)} 남았습니다. 이후 근무는 월 0.003점(상한 0.40점)으로 바뀝니다.` });
  }
  tips.sort((a, b) => b.gain - a.gain);
  return tips.slice(0, 6);
}
function capsReached() {
  const b = R.bonus.parts, out = [];
  if (b.research.eduRaw >= 1 - 1e-9) out.push('교육부 지정 연구학교(공통) 1.00점');
  if (b.rural.raw >= 1.26 - 1e-9) out.push('농어촌·정책지원·특수여건 1.26점');
  if (b.trainBonus.points >= 1 - 1e-9) out.push('직무연수 학점 1.00점');
  if (b.violence.points >= 1 - 1e-9) out.push('학교폭력 실적 1.00점');
  if (b.head.points >= 1.75 - 1e-9) out.push('보직교사 1.75점');
  if (b.eduDev.raw >= 0.5 - 1e-9) out.push('교육발전 0.50점');
  if (R.career.basic.full && R.career.over.full) out.push('경력평정 70점');
  return out;
}

/* ───────── 결과 패널 ───────── */
function renderResult() {
  if (!R) return;
  const K = kindCfg(), teacher = isTeacher();
  const pend = R.total === null;
  const shown = pend ? R.sumWithoutPerf : R.total;
  const meters = [
    ['경력평정', R.career.total, 70, 3],
    ['근무성적', R.perf.value, 100, 3],
    ['자격연수', R.training.qual.points, 9, 3],
    ['직무연수', R.training.duty, dutyMax(), 3],
    ...(teacher ? [['연구실적', R.training.researchPoints, 3, 3]] : []),
    ['가산점 · 공통', R.bonus.common, 3.5, 3],
    ['가산점 · 선택', R.bonus.select, 9.91, 3],
  ];
  const mHtml = meters.map(([n, v, mx, d]) => {
    if (v === null) return `<li><div class="m-top"><span class="m-name">${n}</span><span class="m-val muted">입력 전<span class="m-max"> / ${mx}</span></span></div><div class="meter pending"></div></li>`;
    const pct = Math.max(0, Math.min(100, v / mx * 100));
    return `<li><div class="m-top"><span class="m-name">${n}${v >= mx - 1e-9 ? '<span class="cap">만점</span>' : ''}</span><span class="m-val">${fx(v, d)}<span class="m-max"> / ${mx}</span></span></div><div class="meter" role="meter" aria-label="${n}" aria-valuemin="0" aria-valuemax="${mx}" aria-valuenow="${fx(v, d)}"><i style="width:${pct.toFixed(1)}%"></i></div></li>`;
  }).join('');
  const checks = buildChecks(), tips = buildTips(), caps = capsReached();
  const ic = { warn: '!', bad: '✕', info: 'i', ok: '✓' };
  $('#result').innerHTML = `
    <div class="card score">
      <div class="eyebrow">${esc(K.label)} · 평정기준일 ${dshort(R.baseDate)}</div>
      <div class="hero${pend ? ' pending' : ''}"><span>${fx(shown, 3)}</span><span class="of">/ ${fx(R.maxTotal, 2)}점${pend ? ' (근평 제외)' : ''}</span></div>
      <div class="sub">${pend ? '근무성적을 입력하면 총점이 계산됩니다.' : `공식 표기(소수 4자리) <b>${fx(R.total, 4)}</b>`}</div>
      <ul class="meters">${mHtml}</ul>
    </div>
    ${checks.length ? `<div class="card"><h3>확인이 필요한 것 <span class="badge warn">${checks.length}</span></h3><ul class="list">${checks.map(c => `<li><span class="ic ${c.cls}">${ic[c.cls]}</span><span>${c.html}</span></li>`).join('')}</ul></div>` : ''}
    ${tips.length ? `<div class="card"><h3>점수를 올릴 수 있는 곳</h3><ul class="list">${tips.map(t => `<li><span class="ic ok">＋</span><span>${t.html}</span></li>`).join('')}</ul>${caps.length ? `<p class="foot" style="margin-top:10px">이미 상한에 닿아 더 늘려도 변화가 없는 항목: ${caps.join(' · ')}</p>` : ''}</div>` : (caps.length ? `<div class="card"><p class="foot">상한에 닿은 항목: ${caps.join(' · ')}</p></div>` : '')}
    <details class="help" data-help="result"${ui.helpClosed && ui.helpClosed.result ? '' : ' open'}><summary><span class="hi" aria-hidden="true">?</span>결과 보는 법</summary><div class="help-body">
      <p><span class="k">큰 숫자</span>경력·근무성적·연수성적·가산점을 모두 더한 예상 총점입니다. 근무성적이 비어 있으면 근평을 뺀 합계가 나옵니다.</p>
      <p><span class="k">막대</span>항목별 점수가 만점의 얼마인지 보여 줍니다.</p>
      <p><span class="k">확인이 필요한 것</span>점수가 달라질 수 있거나 요건이 모자란 부분입니다.</p>
      <p><span class="k">점수를 올릴 수 있는 곳</span>지금 입력한 값에서 더 얻을 수 있는 점수를 큰 순서로 보여 줍니다.</p>
    </div></details>
    <p class="foot">참고용 계산입니다. 최종 점수는 학교 평정과 교육청 확인을 거쳐 확정됩니다. 입력한 내용은 이 브라우저에만 저장되고 서버로 보내지 않습니다.</p>`;
  $('#minibar').innerHTML = `<div><div class="eyebrow xs muted">${esc(K.label)}${pend ? ' · 근평 제외' : ''}</div><div class="mb-val num">${fx(shown, 3)}<span class="muted small"> / ${fx(R.maxTotal, 2)}</span></div></div><div class="mb-sub">평정기준일<br>${dshort(R.baseDate)}</div>`;
}

/* ───────── 탭 위 '확인 필요' 점 ───────── */
function tabFlag(k) {
  if (!R) return false;
  if (k === 'basic') return R.elig.some(e => !e.ok);
  if (k === 'perf') return R.perf.value === null;
  if (k === 'training') return R.training.courses.some(c => c.status === 'no');
  return false;
}
function updateTabFlags() {
  $$('#tabs .tab').forEach(b => {
    const on = tabFlag(b.dataset.tab); let d = b.querySelector('.dot');
    if (on && !d) { d = document.createElement('span'); d.className = 'dot'; d.setAttribute('aria-label', '확인 필요'); b.appendChild(d); }
    else if (!on && d) d.remove();
  });
}
