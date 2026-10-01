// 카드 변환(card-map.js)의 실제 카드에 없는 경우들을 손으로 만든 표로 확인한다.
const assert = require('assert');
const E = require('../src/engine.js');
const CardMap = require('../src/card-map.js');

const C = (...lines) => ({ lines, text: lines.join('') });
const row = cells => ({ cells: Object.fromEntries(Object.entries(cells).map(([k, v]) => [k, Array.isArray(v) ? C(...v) : C(v)])), all: Object.values(cells).map(v => (Array.isArray(v) ? v.join('') : v)) });
const tbl = (kind, section, rows) => ({ kind, section, page: 1, rows });
let n = 0;
const ok = (name, fn) => { try { fn(); n++; console.log('  ✔', name); } catch (e) { console.log('  ✘', name, '\n     ', e.message); process.exitCode = 1; } };

const base = { meta: { cardDate: '2026.10.01', school: 'A중학교', kind: '교사(중학교)', pos: '교사(중등)', step: '20호봉' }, tables: [] };
const parsed = extra => ({ meta: base.meta, tables: extra });

console.log('— 변환 규칙 확인 —');

ok('휴직·임용 전 비군복무 경력·미분류 가산점은 넣지 않고 알려 준다', () => {
  const r = CardMap.toState(parsed([
    tbl('career', '인사카드', [
      row({ period: ['2018.03.01 ~', '2022.02.28'], type: '교육청내전보', dept: 'X지원청 가학교', issuer: '교육감' }),
      row({ period: ['2012.03.01 ~', '2018.02.28'], type: '일반공채(일반)', dept: 'X지원청 나학교', issuer: '교육감' }),
      row({ period: ['2019.03.01 ~', '2020.02.29'], type: '육아휴직', dept: 'X지원청 가학교', issuer: '교육감' }),
      row({ period: ['2022.03.01 ~'], type: '교육청내전보', dept: 'X지원청 다학교', issuer: '교육감' }),
    ]),
    tbl('precareer', '인사카드', [
      row({ period: '2005.03.01 ~ 2006.02.28', placeKind: '사립학교', place: '라고등학교', pos: '기간제교사', civil: '비공무원' }),
      row({ period: '2007.01.10 ~ 2008.10.09', placeKind: '군', place: '군', pos: '', civil: '비공무원' }),
    ]),
    tbl('bonus', '인사카드', [
      row({ area: '미지의영역', period: ['2024.03.01 ~', '2025.02.28'], org: '', note: '무엇' }),
      row({ area: '농어촌', period: ['2024.03.01 ~', '2025.02.28'], org: '', note: '농어촌(가)' }),
    ]),
  ]), { E, kind: 'g1', baseDate: '2027-02-28' });
  assert.deepStrictEqual(r.patch.career.map(c => c.label), ['나학교', '가학교', '다학교(현재)', '임용 전 군복무(2007.1.10.~2008.10.9.)']);
  assert.strictEqual(r.patch.career[2].end, '');
  assert.ok(r.warn.some(w => /휴직 1건/.test(w)), '휴직 안내');
  assert.ok(r.warn.some(w => /군복무 외 1건/.test(w)), '임용 전 경력 안내');
  assert.ok(r.warn.some(w => /가산점 1행은 어떤 항목인지/.test(w)), '미분류 안내');
  assert.strictEqual(r.patch.bonus.periods.length, 1);
});

ok('같은 학교로 이어지는 임용은 한 줄로 합친다', () => {
  const r = CardMap.toState(parsed([tbl('career', '인사카드', [
    row({ period: ['2015.03.01 ~', '2018.02.28'], type: '전보', dept: 'Q청 가학교' }),
    row({ period: ['2018.03.01 ~', '2020.02.29'], type: '전보', dept: 'Q청 가학교' }),
  ])]), { E, kind: 'g1', baseDate: '2027-02-28' });
  assert.strictEqual(r.patch.career.length, 1);
  assert.strictEqual(r.patch.career[0].start, '2015-03-01');
  assert.strictEqual(r.patch.career[0].end, '2020-02-29');
});

ok('박사·석사: 직무연관 Y 는 연관으로, 졸업일은 학력사항에서', () => {
  const r = CardMap.toState(parsed([
    tbl('degree', '인사카드', [row({ school: ['가대학교 대학원(2013.03~2015.02)'], major: '교육학', degree: '국내석사', rel: 'Y' }), row({ school: '나대학교 대학원', major: '물리학', degree: '국내박사', rel: '유관' })]),
    tbl('education', '인사카드', [row({ from: '2013.03', to: '2015.02', level: '석사과정졸업', major: '교육학' }), row({ from: '2016.03', to: '2020.08', level: '박사과정졸업', major: '물리학' })]),
  ]), { E, kind: 'g1', baseDate: '2027-02-28' });
  assert.deepStrictEqual(r.patch.training.degrees.map(d => [d.level, d.related, d.date]), [['석사', true, '2015-02-28'], ['박사', true, '2020-08-31']]);
  assert.ok(!r.warn.some(w => /직무연관성/.test(w)));
});

ok('교감 평정구분은 교감 자격연수를 고른다', () => {
  const t = tbl('training', '인사카드', [
    row({ no: 'a', name: '2010학년도 1급 정교사자격연수', org: '가연수원', kind: '자격연수', period: '2010.07.01~2010.07.20', score: '90.50', rel: 'Y' }),
    row({ no: 'b', name: '2020학년도 중등 교감자격연수', org: '나연수원', kind: '자격연수', period: '2020.07.01~2020.08.10', score: '96.00', rel: 'Y' }),
  ]);
  const g1 = CardMap.toState(parsed([t]), { E, kind: 'g1', baseDate: '2027-02-28' });
  const g2 = CardMap.toState(parsed([t]), { E, kind: 'g2', baseDate: '2027-02-28' });
  assert.strictEqual(g1.patch.training.qual.score, 90.5);
  assert.strictEqual(g2.patch.training.qual.score, 96);
  assert.strictEqual(g2.patch.training.qual.name, '중등교감자격');
});

ok('직무연수 방식 추정: 원격/집합/미확인, 60시간 미만·기간 만료는 목록에서 뺀다', () => {
  const mk = (name, org, per, h) => row({ no: '', name, org, kind: '직무연수', period: [per, `(${h}시간 0분)`], score: '88', rel: 'Y' });
  const r = CardMap.toState(parsed([tbl('training', '인사카드', [
    mk('가 연수', '나 원격교육연수원', '2018.01.01~2018.02.10', 60),
    mk('집합 직무연수', '다 연수원', '2018.03.01~2018.03.20', 60),
    mk('라 연수', '마 연수원', '2018.04.01~2018.05.20', 60),
    mk('짧은 연수', '바 연수원', '2018.06.01~2018.06.05', 30),
    mk('옛날 연수', '사 연수원', '2008.01.01~2008.02.10', 60),
    mk('2022 연수', '아 연수원', '2022.04.01~2022.05.20', 60),
  ])]), { E, kind: 'g1', baseDate: '2027-02-28' });
  const m = Object.fromEntries(r.patch.training.courses.map(c => [c.label.split('(')[0].split(' —')[0], c.mode]));
  assert.deepStrictEqual(m, { '가 연수': '원격', '집합 직무연수': '집합', '라 연수': '미확인', '2022 연수': '미확인' });
  assert.ok(r.warn.some(w => /1건은 집합\/원격 여부/.test(w) && /라 연수/.test(w)), '2021 이후 시작은 안내하지 않는다');
  assert.ok(!r.warn.some(w => /2022 연수/.test(w)));
  assert.deepStrictEqual(r.patch.bonus.yearHours, { '2008': 60, '2017': 60, '2018': 150, '2022': 60 });
});

ok('연도별 연수시간은 학년도(3.1.~2월 말)로 모은다', () => {
  const mk = (per, h, m) => row({ name: 'x', org: 'y', kind: '직무연수', period: [per, `(${h}시간 ${m}분)`], rel: 'Y' });
  const r = CardMap.toState(parsed([tbl('training', '인사카드', [mk('2024.02.01~2024.02.20', 15, 0), mk('2024.03.01~2024.03.20', 15, 30), mk('2024.12.01~2024.12.05', 5, 15)])]), { E, kind: 'g1', baseDate: '2027-02-28' });
  assert.deepStrictEqual(r.patch.bonus.yearHours, { '2023': 15, '2024': 20.75 });
});

ok('구역마다 건수가 다르면 알려 준다', () => {
  const mkb = n => Array.from({ length: n }, (_, i) => row({ area: '농어촌', period: [`${2020 + i}.03.01 ~`, `${2021 + i}.02.28`], note: '농어촌' }));
  const r = CardMap.toState(parsed([tbl('bonus', '가산점', mkb(3)), tbl('bonus', '인사카드', mkb(2))]), { E, kind: 'g1', baseDate: '2027-02-28' });
  assert.ok(r.warn.some(w => /가산점 건수가 구역마다 다릅니다/.test(w)));
  assert.strictEqual(r.patch.bonus.periods.length, 3);
});

ok('연구대회 등급 읽기: 전국/시도, 공동 연구자 상한 4', () => {
  const r = CardMap.toState(parsed([tbl('research', '인사카드', [
    row({ title: '전국 대회~주최', grade: '전국대회 1등급', date: '2019.08.01', authors: '6' }),
    row({ title: '시도 대회~주최', grade: '시도대회 3등급', date: '2018.07.03', authors: '1' }),
    row({ title: '이상한~주최', grade: '우수', date: '2018.07.03', authors: '' }),
  ])]), { E, kind: 'g1', baseDate: '2027-02-28' });
  assert.deepStrictEqual(r.patch.training.contests.map(c => [c.scale, c.authors]), [['전국1등급', 4], ['시도3등급', 1], ['시도3등급', 1]]);
  assert.ok(r.warn.some(w => /등급\(우수\)을 읽지 못했습니다/.test(w)));
});

ok('가산점 분류: 시도특색 비고별, 연구학교 공통/선택, 학교폭력', () => {
  const c = CardMap.classifyBonus;
  assert.strictEqual(c('시도특색가산점', '담임교사(가)'), 'homeroom');
  assert.strictEqual(c('시도특색가산점', '특수여건(가)'), 'special');
  assert.strictEqual(c('시도특색가산점', 'RCY 지도'), 'youth');
  assert.strictEqual(c('연구・시범학교(공통)', 'x'), 'edu_research');
  assert.strictEqual(c('연구・시범학교(선택)', 'x'), 'office_research');
  assert.strictEqual(c('학교폭력예방및기여(공통)', 'x'), 'violence');
  assert.strictEqual(c('도서벽지', '나급지 학교'), 'island_b');
  assert.strictEqual(c('알수없음', '그냥'), null);
});

ok('같은 항목·같은 기간 중복은 한 번만, 날짜 없는 가산점 행은 알린다', () => {
  const r = CardMap.toState(parsed([
    tbl('bonus', '인사카드', [
      row({ area: '보직교사', period: ['2024.03.01 ~', '2025.02.28'], note: '부장' }),
      row({ area: '농어촌', period: '', note: '날짜 없음' }),
    ]),
    tbl('career', '인사카드', [
      row({ period: ['2024.03.01 ~', '2025.02.28'], type: '보직교사', dept: 'Q청 가학교' }),
      row({ period: ['2020.03.01 ~'], type: '전보', dept: 'Q청 가학교' }),
    ]),
  ]), { E, kind: 'g1', baseDate: '2027-02-28' });
  assert.strictEqual(r.patch.bonus.periods.filter(p => p.cat === 'head').length, 1);
  assert.ok(r.warn.some(w => w.includes('가산점 1행은 기간(날짜)을 읽지 못해')));
});

console.log(n + '개 확인 통과' + (process.exitCode ? ' (실패 있음)' : ''));
