// 국가기술자격증(컴퓨터활용능력 등) 선택가산점 확인 — 가장 유리한 1개만, 상한 0.50, 학점화·기간·평정기준일 이후 취득 제외, 전망(plan.certs)
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
  return s;
};
const pts = (s, d = base) => E.compute(s, d).bonus.parts.cert;
const sel = (s, d = base) => E.compute(s, d).bonus.select;
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 0.0006, `${m || ''} ${a} ≠ ${b}`);
const cert = (type, date, extra) => Object.assign({ type, name: '', date, credited: false }, extra || {});

console.log('— 국가기술자격증 확인 —');
ok('자격증이 없으면 0점', () => near(pts(mk()).points, 0));
ok('컴퓨터활용능력 1급 0.50 · 2급 0.25', () => {
  const a = mk(); a.bonus.certs = [cert('cpu1', '2020-06-01')]; near(pts(a).points, 0.5, '1급');
  const b = mk(); b.bonus.certs = [cert('cpu2', '2020-06-01')]; near(pts(b).points, 0.25, '2급');
});
ok('담당 과목과 관계없이 정보화 관련 자격은 인정(물리 교사의 컴퓨터활용능력 1급)', () => {
  const s = mk(); s.bonus.certs = [cert('cpu1', '2020-06-01')];
  const c = pts(s); assert.strictEqual(c.rows[0].status, 'ok'); assert.strictEqual(c.rows[0].spec.it, true);
});
ok('가장 유리한 1개만 — 2급 + 1급 + 워드 1급이어도 0.50(합산 안 함)', () => {
  const s = mk(); s.bonus.certs = [cert('cpu2', '2018-01-01'), cert('cpu1', '2020-06-01'), cert('wp1', '2021-06-01')];
  const c = pts(s); near(c.points, 0.5); assert.strictEqual(c.chosen, 1); assert.deepStrictEqual(c.rows.map(r => r.status), ['dup', 'ok', 'dup']);
});
ok('0.25짜리 둘이어도 0.25(합산 안 함)', () => {
  const s = mk(); s.bonus.certs = [cert('cpu2', '2018-01-01'), cert('wp2', '2019-01-01')]; near(pts(s).points, 0.25);
});
ok('선택가산점 합계에 들어간다(+0.50)', () => {
  const s = mk(), r0 = sel(s); s.bonus.certs = [cert('cpu1', '2020-06-01')]; near(sel(s) - r0, 0.5);
});
ok('평정기준일 이후 취득은 반영하지 않는다', () => {
  const s = mk(); s.bonus.certs = [cert('cpu1', '2027-06-01')];
  near(pts(s).points, 0); assert.strictEqual(pts(s).rows[0].status, 'future'); near(pts(s, '2028-02-29').points, 0.5, '다음 해 명부');
});
ok('직무연수 학점으로 쓴 자격(학점화)은 선택가산점에서 뺀다', () => {
  const s = mk(); s.bonus.certs = [cert('cpu1', '2020-06-01', { credited: true })];
  near(pts(s).points, 0); assert.strictEqual(pts(s).rows[0].status, 'credited');
  s.bonus.certs.push(cert('cpu2', '2019-06-01')); near(pts(s).points, 0.25, '학점화한 것을 빼고 남은 것');
});
ok('문서실무사는 2016.3.1.~2019.6.25. 취득분만', () => {
  const a = mk(); a.bonus.certs = [cert('it50', '2017-06-01', { name: '문서실무사' })]; near(pts(a).points, 0.5);
  const b = mk(); b.bonus.certs = [cert('it50', '2021-06-01', { name: '문서실무사' })]; near(pts(b).points, 0); assert.strictEqual(pts(b).rows[0].status, 'window');
  const c = mk(); c.bonus.certs = [cert('it50', '', { name: '문서실무사' })]; near(pts(c).points, 0, '날짜가 없으면 기간 확인 불가');
});
ok('취득일을 비워 두면 평정기준일 이전으로 본다', () => { const s = mk(); s.bonus.certs = [cert('cpu1', '')]; near(pts(s).points, 0.5); });
ok('정보화 관련이 아닌 자격은 담당 과목 조건 안내가 따라온다', () => {
  const s = mk(); s.bonus.certs = [cert('g50', '2020-01-01')];
  const r = E.compute(s, base).bonus; near(r.parts.cert.points, 0.5); assert.ok(r.notes.some(t => /담당 과목과 관련/.test(t)));
  const t = mk(); t.bonus.certs = [cert('cpu1', '2020-01-01')]; assert.ok(!E.compute(t, base).bonus.notes.some(x => /담당 과목과 관련/.test(x)));
});
ok('교감·교장 평정은 교감 직위에서 딴 자격만 평정한다는 안내', () => {
  const s = mk(); s.profile.kind = 'j1'; s.bonus.certs = [cert('cpu1', '2020-01-01')];
  assert.ok(E.compute(s, base).bonus.notes.some(t => /교감 직위/.test(t)));
});
ok('예전 저장 파일의 점수 칸(cert 0.25)도 그대로 계산한다', () => { const s = mk(); s.bonus.cert = 0.25; near(pts(s).points, 0.25); s.bonus.certs = [cert('cpu1', '2020-01-01')]; near(pts(s).points, 0.5, '자격증 행이 더 유리하면'); });

console.log('— 전망(예정 자격증) —');
ok('예정 자격증: 취득 예정일 전에는 반영되지 않고 그날 이후 명부부터 반영', () => {
  const s = mk(); s.plan.certs = [cert('cpu1', '2027-08-01')];
  near(E.compute(E.applyPlan(s), base).bonus.parts.cert.points, 0, '지금 명부');
  near(E.compute(E.applyPlan(s), '2028-02-29').bonus.parts.cert.points, 0.5, '1년 뒤 명부');
  near(E.compute(s, '2028-02-29').bonus.parts.cert.points, 0, '실제 기록(카드)은 그대로');
});
ok('이미 0.50점 자격이 있으면 예정 자격증은 점수를 더하지 않는다(1개만 인정)', () => {
  const s = mk(); s.bonus.certs = [cert('wp1', '2019-01-01')]; s.plan.certs = [cert('cpu1', '2027-08-01')];
  near(E.compute(E.applyPlan(s), '2028-02-29').bonus.parts.cert.points, 0.5); near(sel(E.applyPlan(s), '2028-02-29'), sel(s, '2028-02-29'));
});
ok('0.25점 자격만 있을 때 1급을 따면 +0.25', () => {
  const s = mk(); s.bonus.certs = [cert('cpu2', '2019-01-01')]; s.plan.certs = [cert('cpu1', '2027-08-01')];
  near(E.compute(E.applyPlan(s), '2028-02-29').bonus.parts.cert.points - E.compute(s, '2028-02-29').bonus.parts.cert.points, 0.25);
});
ok('예정 행의 결과는 실제 행 수 뒤에 같은 순서로 나온다', () => {
  const s = mk(); s.bonus.certs = [cert('cpu2', '2019-01-01')]; s.plan.certs = [cert('cpu1', '2027-08-01'), cert('wp1', '2027-09-01')];
  const rows = E.compute(E.applyPlan(s), '2028-02-29').bonus.parts.cert.rows;
  assert.deepStrictEqual(rows.map(r => r.status), ['dup', 'ok', 'dup']);
});
ok('실제 기록(state)은 전망을 적용해도 바뀌지 않는다', () => {
  const s = mk(); s.plan.certs = [cert('cpu1', '2027-08-01')]; const before = JSON.stringify(s); E.applyPlan(s); assert.strictEqual(JSON.stringify(s), before);
});
console.log(n + '개 확인 통과' + (process.exitCode ? ' (실패 있음)' : ''));
