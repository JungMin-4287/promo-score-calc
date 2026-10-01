/* ───────── 공통 도구 ───────── */
const E = window.Promo;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fx = (x, d = 3) => (x === null || x === undefined || Number.isNaN(+x) ? '—' : (+x).toFixed(d));
const dot = iso => (iso ? iso.replace(/-/g, '.') : '');
const dotd = iso => (iso ? dot(iso) + '.' : '');
const clone = o => JSON.parse(JSON.stringify(o));
const isNum = v => v !== '' && v !== null && v !== undefined && !Number.isNaN(+v);
const yearOf = iso => +iso.slice(0, 4);
const pad2 = n => String(n).padStart(2, '0');
const mdText = (m, d) => `${m}개월${d ? ' ' + d + '일' : ''}`;
const dshort = iso => (iso ? `${+iso.slice(0, 4)}.${+iso.slice(5, 7)}.${+iso.slice(8, 10)}.` : '');

function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
function setPath(obj, path, val) {
  const ks = path.split('.'); let o = obj;
  for (let i = 0; i < ks.length - 1; i++) { const k = ks[i]; if (o[k] == null) o[k] = /^\d+$/.test(ks[i + 1]) ? [] : {}; o = o[k]; }
  o[ks[ks.length - 1]] = val;
}

/* ───────── 상태 ─────────
 * 개인정보 보호: 이 앱은 입력값을 브라우저 저장소(쿠키·웹 저장소·IndexedDB)에 저장하지 않는다.
 * 새로 고치거나 닫으면 처음 상태로 돌아가며, 보관은 '입력값 저장'으로 받은 파일로 한다. */
const TPL = {
  careerWork: () => ({ label: '', start: '', end: '', grade: '가', rate: 1 }),
  careerMil: () => ({ label: '임용 전 군복무', start: '', end: '', grade: '가', rate: 1, mil: true }),
  careerLeave: () => ({ label: '휴직(환산 50%)', start: '', end: '', grade: '가', rate: 0.5 }),
  course: () => ({ label: '', start: '', end: '', hours: 60, score: '', mode: '집합' }),
  contest: () => ({ label: '', date: '', scale: '시도2등급', authors: 1 }),
  degree: () => ({ level: '석사', related: false, label: '', date: '' }),
  period: cat => ({ cat: cat || 'rural', label: '', start: '', end: '' }),
};

function normalizeState(raw) {
  const d = E.defaultState();
  const s = raw && typeof raw === 'object' ? raw : {};
  const out = {
    version: 1,
    profile: Object.assign({}, d.profile, s.profile || {}),
    career: Array.isArray(s.career) ? s.career : d.career,
    perf: s.perf && typeof s.perf === 'object' ? s.perf : {},
    training: {
      qual: Object.assign({}, d.training.qual, (s.training && s.training.qual) || {}),
      courses: (s.training && Array.isArray(s.training.courses)) ? s.training.courses : [],
      contests: (s.training && Array.isArray(s.training.contests)) ? s.training.contests : [],
      degrees: (s.training && Array.isArray(s.training.degrees)) ? s.training.degrees : [],
    },
    bonus: {
      periods: (s.bonus && Array.isArray(s.bonus.periods)) ? s.bonus.periods : [],
      yearHours: (s.bonus && s.bonus.yearHours && typeof s.bonus.yearHours === 'object') ? s.bonus.yearHours : {},
      violence: (s.bonus && Array.isArray(s.bonus.violence)) ? s.bonus.violence.map(String) : [],
      cert: (s.bonus && +s.bonus.cert) || 0, national: (s.bonus && +s.bonus.national) || 0, other: (s.bonus && +s.bonus.other) || 0,
    },
    plan: Object.assign({ on: false, years: [], courses: [], careerGrade: '가' }, s.plan || {}),
  };
  if (!E.KINDS[out.profile.kind]) out.profile.kind = 'g1';
  if (!E.norm(out.profile.baseDate)) out.profile.baseDate = d.profile.baseDate;
  out.profile.baseDate = E.norm(out.profile.baseDate);
  out.career = out.career.filter(r => r && typeof r === 'object');
  out.training.courses = out.training.courses.filter(r => r && typeof r === 'object');
  out.bonus.periods = out.bonus.periods.filter(r => r && E.CATS[r.cat]);
  out.plan.years = Array.isArray(out.plan.years) ? out.plan.years.filter(y => y && +y.year) : [];
  out.plan.courses = Array.isArray(out.plan.courses) ? out.plan.courses : [];
  return out;
}

/* 예시(가상 인물) — 화면이 비어 보이지 않도록 처음에만 보여 준다 */
function sampleState() {
  const P = (cat, start, end, label) => ({ cat, start, end, label });
  return normalizeState({
    profile: { name: '예시(가상 인물)', kind: 'g1', baseDate: '2027-02-28', firstQualDate: '2013-08-30', koreanHistory: 'course' },
    career: [
      { label: 'A중학교', start: '2010-03-01', end: '2014-02-28', grade: '가', rate: 1 },
      { label: 'B중학교', start: '2014-03-01', end: '2018-02-28', grade: '가', rate: 1 },
      { label: 'C중학교(현재)', start: '2018-03-01', end: '', grade: '가', rate: 1 },
      { label: '임용 전 군복무', start: '2007-05-01', end: '2009-02-28', grade: '가', rate: 1, mil: true },
    ],
    perf: { 2026: 99.2, 2025: 98.7, 2024: 99.5, 2023: 97.9, 2022: 98.3 },
    training: {
      qual: { name: '중등1정교사자격', label: '1급 정교사 자격연수', start: '2013-07-15', end: '2013-08-02', score: 93, full: 100 },
      courses: [
        { label: '교과 심화 직무연수(집합)', start: '2019-07-22', end: '2019-08-09', hours: 90, score: 92, mode: '집합' },
        { label: 'AI 활용 수업 설계(원격)', start: '2022-07-01', end: '2022-08-12', hours: 60, score: 96, mode: '원격' },
        { label: '학생 상담 기초(원격, 2018)', start: '2018-10-01', end: '2018-11-10', hours: 60, score: 90, mode: '원격' },
      ],
      contests: [
        { label: '시·도 교육자료전', date: '2016-07-02', scale: '시도2등급', authors: 2 },
        { label: '학습지도연구대회', date: '2019-07-10', scale: '시도1등급', authors: 1 },
      ],
      degrees: [{ level: '석사', related: true, label: '○○대학교 교육대학원', date: '2017-02-20' }],
    },
    bonus: {
      periods: [
        P('head', '2020-03-01', '2027-02-28', '부장교사'),
        P('rural', '2014-03-01', '2018-02-28', 'B중학교(농어촌)'),
        P('special', '2018-03-01', '2027-02-28', 'C중학교(특수여건)'),
        P('edu_research', '2016-03-01', '2017-02-28', '교육부 지정 연구학교'),
        P('edu_research', '2021-03-01', '2022-02-28', '교육부 지정 연구학교'),
        P('office_research', '2012-03-01', '2013-02-28', '시·도교육청 지정 연구학교'),
        P('homeroom', '2010-03-01', '2014-02-28', 'A중학교'),
        P('homeroom', '2015-03-01', '2016-02-29', 'B중학교'),
        P('homeroom', '2017-03-01', '2019-02-28', 'B·C중학교'),
        P('youth', '2018-03-01', '2021-02-28', '청소년단체(RCY) 지도'),
      ],
      yearHours: { 2010: 30, 2011: 60, 2012: 75, 2013: 60, 2014: 90, 2015: 45, 2016: 60, 2017: 100, 2018: 120, 2019: 75, 2020: 60, 2021: 90, 2022: 105, 2023: 80, 2024: 62, 2025: 70, 2026: 48 },
      violence: ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'],
    },
    plan: {
      on: true, careerGrade: '가',
      years: [2027, 2028, 2029].map(y => ({ year: y, head: true, homeroom: false, school: 'special', research: 'none', violence: true, hours: 60, perf: 99 })),
      courses: [],
    },
  });
}

let state, ui = { tab: 'basic', sample: false, dirty: false, pasteCat: 'rural', helpClosed: {} };
let R = null;            // 현재 평정기준일 결과

function initState() {
  state = sampleState();
  ui.sample = true;
}

let lastGoodBase = null;
const curBase = () => (R ? R.baseDate : (E.norm(state.profile.baseDate) || '2027-02-28'));
function recompute() {
  const bd = E.norm(state.profile.baseDate);     // 입력 도중의 잘못된 날짜는 마지막 올바른 날짜로 계산을 이어 간다
  if (bd) lastGoodBase = bd;
  R = E.compute(E.applyPlan(state), bd || lastGoodBase || '2027-02-28');
  R.invalidBase = !bd;
}

/* ───────── 파일 저장·불러오기 ───────── */
let DL = null;   // downloads 기능(아티팩트 뷰어에서만)
const inViewer = typeof window.claude !== 'undefined' && !!window.claude && typeof window.claude.use === 'function';
if (inViewer) {
  try { Promise.resolve(window.claude.use('downloads')).then(d => { DL = d || null; }).catch(() => { DL = null; }); } catch (e) { DL = null; }
}
function stamp() { const d = new Date(); return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}`; }
function exportJson() {
  return JSON.stringify({ app: 'promo-calc', version: 1, savedAt: new Date().toISOString(), state }, null, 1);
}
async function saveFile(filename, text, mime) {
  if (inViewer) {
    if (DL) {
      try { await DL.save({ filename, data: text }); ui.dirty = false; toast('저장했습니다'); return; }
      catch (e) { if (e && e.code === 'declined') return; /* 아래 복사 창으로 */ }
    }
    showTextModal(`${filename} 내용`, text, '아래 내용을 복사해 메모장에 붙여넣고 .json 파일로 저장하세요.');
    return;
  }
  try {
    const url = URL.createObjectURL(new Blob([text], { type: mime || 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    ui.dirty = false;
    toast('저장했습니다');
  } catch (e) { showTextModal(`${filename} 내용`, text, '복사해서 파일로 저장하세요.'); }
}
function importText(text) {
  let o;
  try { o = JSON.parse(text); } catch (e) { toast('JSON 형식이 아닙니다'); return false; }
  const st = o && o.state ? o.state : o;
  if (!st || typeof st !== 'object' || !(st.career || st.profile || st.bonus)) { toast('이 앱에서 저장한 파일이 아닌 것 같습니다'); return false; }
  state = normalizeState(st);
  ui.sample = false; ui.dirty = true;
  return true;
}
