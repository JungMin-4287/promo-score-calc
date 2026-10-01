// 전망(applyPlan) 새 규칙 확인: 올해 칸·예정 연수/입상/학위/기간·근무성적 가정·실제 기록 불변
const assert = require('assert');
const E = require('../src/engine.js');
const base = '2027-02-28';
let n = 0;
const ok = (name, fn) => { try { fn(); n++; console.log('  ✔', name); } catch (e) { console.log('  ✘', name, '\n     ', e.message); process.exitCode = 1; } };
const mk = () => {
  const s = E.defaultState();
  s.profile.baseDate = base; s.profile.kind = 'g1'; s.profile.firstQualDate = '2015-08-27';
  s.career = [{ label: 'A', start: '2012-03-01', end: '', grade: '가', rate: 1 }];
  s.training.qual = { name: '중등1정교사자격', label: '', start: '', end: '', score: 95, full: 100 };
  s.bonus.periods = [{ cat: 'head', start: '2026-03-01', end: '2027-02-28', label: '카드 부장' }];
  s.bonus.yearHours = { 2026: 78 };
  s.bonus.violence = ['2025'];
  return s;
};
const cmp = (st, d = base) => E.compute(E.applyPlan(st), d);
const R0 = E.compute(mk(), base);
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 0.0006, `${m || ''} ${a} ≠ ${b}`);

console.log('— 전망 계산 확인 —');
ok('전망 입력이 비어 있으면 실제 기록 계산과 같다', () => { const s = mk(); assert.strictEqual(E.applyPlan(s), s); near(cmp(s).sumWithoutPerf, R0.sumWithoutPerf); });
ok('실제 기록(state)은 전망을 적용해도 바뀌지 않는다', () => { const s = mk(); s.plan.courses = [{ label: 'x', start: '2027-01-05', end: '2027-01-24', hours: 60, score: 96, mode: '집합' }]; const before = JSON.stringify(s); E.applyPlan(s); assert.strictEqual(JSON.stringify(s), before); });
ok('올해 칸(근무 경력 없음): 학교폭력 실적 +0.1, 경력은 그대로', () => {
  const s = mk(); s.plan.years = [{ year: 2026, career: false, violence: true }];
  const r = cmp(s); near(r.bonus.parts.violence.points - R0.bonus.parts.violence.points, 0.1, '학폭'); near(r.career.total, R0.career.total, '경력');
});
ok('올해 칸에서 카드에 이미 있는 부장을 다시 켜도 두 번 세지 않는다', () => {
  const s = mk(); s.plan.years = [{ year: 2026, career: false, head: true }];
  near(cmp(s).bonus.parts.head.points, R0.bonus.parts.head.points);
});
ok('올해 담임은 부장과 같은 기간이라 점수가 오르지 않는다(중복 불가)', () => {
  const s = mk(); s.plan.years = [{ year: 2026, career: false, homeroom: true }];
  near(cmp(s).bonus.total, R0.bonus.total);
});
ok('올해 농어촌 켜면 월 0.015 × 12 = 0.18 늘어난다', () => {
  const s = mk(); s.plan.years = [{ year: 2026, career: false, school: 'rural' }];
  near(cmp(s).bonus.parts.rural.points, 0.18);
});
ok('올해 칸과 다음 해 칸을 같이 쓰면 경력이 끊기지 않고 이어진다', () => {
  const s = mk(); s.plan.years = [{ year: 2026, career: false }, { year: 2027 }];
  const r = cmp(s, '2028-02-29'); const r0 = E.compute(mk(), '2028-02-29');
  near(r.career.total, r0.career.total, '경력(계속 근무하는 기준선과 같아야 함)');
});
ok('예정 직무연수(집합, 예상 성적 96, 평정기준일 이전 종료) → 직무연수 +6', () => {
  const s = mk(); s.plan.courses = [{ label: '겨울 연수', start: '2027-01-11', end: '2027-01-29', hours: 60, score: 96, mode: '집합' }];
  near(cmp(s).training.duty - R0.training.duty, 6);
});
ok('평정기준일 이후 종료하는 예정 연수는 그 날짜에는 반영되지 않고 다음 해부터', () => {
  const s = mk(); s.plan.courses = [{ label: '내년 연수', start: '2027-07-05', end: '2027-07-20', hours: 60, score: 96, mode: '집합' }];
  near(cmp(s).training.duty, R0.training.duty); near(cmp(s, '2028-02-29').training.duty - E.compute(mk(), '2028-02-29').training.duty, 6);
});
ok('올해 추가 연수 시간은 실제 시간에 더한다(78 + 10 = 88 → 학점 상한 4)', () => {
  const s = mk(); s.plan.years = [{ year: 2026, career: false, hours: 10 }];
  const p = E.applyPlan(s); assert.strictEqual(p.bonus.yearHours['2026'], 88);
});
ok('예정 연구대회(시·도 1등급 1.0)가 연구실적에 더해진다', () => {
  const s = mk(); s.plan.contests = [{ label: '예정', date: '2026-12-01', scale: '시도1등급', authors: 1 }];
  near(cmp(s).training.researchPoints - R0.training.researchPoints, 1.0);
});
ok('예정 학위(석사 직무관련 1.5)', () => {
  const s = mk(); s.plan.degrees = [{ level: '석사', related: true, label: '예정', date: '2027-02-20' }];
  near(cmp(s).training.researchPoints - R0.training.researchPoints, 1.5);
});
ok('예정 가산점 기간(특수여건, 자유 입력)', () => {
  const s = mk(); s.plan.periods = [{ cat: 'special', label: '예정', start: '2026-03-01', end: '2027-02-28' }];
  near(cmp(s).bonus.parts.rural.points, 0.108);
});
ok('근무성적 가정값: 학년도별 입력과 빈 칸 채우기', () => {
  const s = mk(); s.plan.perf = { 2026: 99, 2025: 98, 2024: 97 };
  near(cmp(s).perf.value, 99 * 0.34 + 98 * 0.33 + 97 * 0.33, '3개 입력');
  const f = mk(); f.plan.perfFill = 96; near(cmp(f).perf.value, 96, '빈 칸 채우기');
  assert.strictEqual(R0.perf.value, null);      // 실제 기록은 근평이 비어 있다
});
ok('실제 근무성적이 있어도 전망 값이 우선(그 학년도만)', () => {
  const s = mk(); s.perf = { 2026: 90, 2025: 90, 2024: 90 }; s.plan.perf = { 2026: 100 };
  near(cmp(s).perf.value, 100 * 0.34 + 90 * 0.33 + 90 * 0.33); near(E.compute(s, base).perf.value, 90);
});
ok('예전 형식(학년도 행에 근무성적)도 읽는다', () => {
  const s = mk(); s.plan.years = [{ year: 2026, career: false, perf: 99 }, { year: 2025, career: false, perf: 98 }, { year: 2024, career: false, perf: 97 }];
  near(cmp(s).perf.value, 99 * 0.34 + 98 * 0.33 + 97 * 0.33);
});
ok('근무 중(종료일 비움)이면 마지막 전망 학년도 이후 날짜에도 경력이 계속 늘어난다', () => {
  const s = mk(); s.plan.years = [{ year: 2026, career: false }, { year: 2027 }];
  const r = cmp(s, '2031-02-28'), r0 = E.compute(mk(), '2031-02-28');
  near(r.career.total, r0.career.total, '2031 경력');
});
ok('종료일을 적은 마지막 근무 행이면 전망 학년도가 근무를 이어 준다', () => {
  const s = mk(); s.career = [{ label: 'A', start: '2012-03-01', end: '2027-02-28', grade: '가', rate: 1 }]; s.plan.years = [{ year: 2027 }];
  const r = cmp(s, '2028-02-29'); const ref = mk(); ref.career = [{ label: 'A', start: '2012-03-01', end: '', grade: '가', rate: 1 }];
  near(r.career.total, E.compute(ref, '2028-02-29').career.total, '종료일 있는 경우');
});
console.log(n + '개 확인 통과' + (process.exitCode ? ' (실패 있음)' : ''));
