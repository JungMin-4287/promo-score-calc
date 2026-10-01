/* ───────── 화면 조각 도우미 ───────── */
const kindCfg = () => E.KINDS[state.profile.kind];
const isTeacher = () => kindCfg().pos === 'teacher';
function tx(path, o = {}) {
  const v = getPath(state, path);
  return `<input type="text" autocomplete="off" spellcheck="false" data-path="${path}" value="${esc(v == null ? '' : v)}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.attrs || ''}>`;
}
function dt(path, o = {}) {
  const v = getPath(state, path);
  return `<input type="text" inputmode="numeric" autocomplete="off" data-kind="date" data-path="${path}" value="${esc(v == null ? '' : v)}" placeholder="${o.ph || '2020-03-01'}" maxlength="14"${o.attrs || ''}>`;
}
function nm(path, o = {}) {
  const v = getPath(state, path);
  return `<input type="text" inputmode="decimal" autocomplete="off" data-kind="num" data-path="${path}" value="${esc(v == null ? '' : v)}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.attrs || ''}>`;
}
function sl(path, options, o = {}) {
  const v = String(getPath(state, path) == null ? '' : getPath(state, path));
  const body = options.map(opt => {
    if (!Array.isArray(opt) && opt.group) return `<optgroup label="${esc(opt.group)}">${opt.items.map(([val, lab]) => `<option value="${esc(val)}"${String(val) === v ? ' selected' : ''}>${esc(lab)}</option>`).join('')}</optgroup>`;
    return `<option value="${esc(opt[0])}"${String(opt[0]) === v ? ' selected' : ''}>${esc(opt[1])}</option>`;
  }).join('');
  return `<select data-path="${path}"${o.render ? ' data-render="1"' : ''}${o.kind ? ` data-kind="${o.kind}"` : ''}>${body}</select>`;
}
function ck(path, label, o = {}) {
  const v = !!getPath(state, path);
  return `<label class="chk"><input type="checkbox" data-path="${path}"${v ? ' checked' : ''}${o.render ? ' data-render="1"' : ''}> ${label}</label>`;
}
const fl = (label, inner, cls = '') => `<label class="fl ${cls}"><span class="lb">${label}</span>${inner}</label>`;
const flDiv = (label, inner, cls = '') => `<div class="fl ${cls}"><span class="lb">${label}</span>${inner}</div>`;
const drv = (type, idx, cls = 'info') => `<div class="${cls}" data-drv="${type}:${idx}"></div>`;
const sec = (title, sum, inner, note) => `<section class="sec"><div class="sec-h"><h3>${title}</h3>${sum ? `<div class="sec-sum" ${sum}</div>` : ''}</div>${note ? `<p class="note">${note}</p>` : ''}${inner}</section>`;
const sumSlot = id => `data-drv="${id}">`;   // sec() 에서 <div class="sec-sum" data-drv="..."> 로 열린다
const addBtn = (label, act, extra = '') => `<button type="button" class="btn sm" data-act="${act}" ${extra}>＋ ${label}</button>`;
/* 가상(예정) 항목: 추가 버튼·행 머리말·행 체크 */
const vBtn = (label, arr, tpl) => `<button type="button" class="btn sm vbtn" data-act="add-virtual" data-arr="${arr}" data-tpl="${tpl}">＋ ${label}</button>`;
const vHead = (r, what) => (isV(r) ? `<div class="vrow-h"><span class="vtag">가상(예정)</span><span class="muted">${what} 확정 점수에는 넣지 않고 “가상 포함” 점수에만 반영합니다.</span></div>` : '');
const vCk = path => ck(path, '가상(예정)', { render: true });

const GRADES = [['가', '가경력'], ['나', '나경력'], ['다', '다경력']];
const RATES = [['1', '100%'], ['0.5', '50%']];
const SCALES = [['전국1등급', '전국 1등급(1.50)'], ['전국2등급', '전국 2등급(1.25)'], ['전국3등급', '전국 3등급(1.00)'], ['시도1등급', '시·도 1등급(1.00)'], ['시도2등급', '시·도 2등급(0.75)'], ['시도3등급', '시·도 3등급(0.50)']];
const AUTHORS = [['1', '1인(100%)'], ['2', '2인(70%)'], ['3', '3인(50%)'], ['4', '4인 이상(30%)']];
const CAT_GROUPS = [
  { group: '자주 쓰는 항목', items: [['head', '보직교사(부장 등)'], ['rural', '농어촌학교'], ['special', '특수여건학교'], ['policy', '정책지원학교'], ['homeroom', '담임교사'], ['edu_research', '교육부 지정 연구·시범학교(공통)'], ['office_research', '시·도교육감 지정 연구·시범학교']] },
  { group: '그 밖의 선택가산점', items: [['youth', '청소년단체 활동 지도(~2021.2.28.)'], ['excellent', '교육활동 우수지도(~2021.2.28.)'], ['circuit', '순회교사'], ['specialist', '장학사·교육연구사'], ['island_a', '도서·벽지 가급지'], ['island_b', '도서·벽지 나급지(울산학생교육원 ~2021.2)'], ['island_c', '도서·벽지 다급지(울산학생교육원 2021.3~)'], ['island_d', '도서·벽지 라급지'], ['hansen', '한센병환자 자녀 학교(~2008.12.31.)'], ['dispatch_old', '파견교원(2020.2.29. 이전 선발)'], ['dispatch_new', '파견교원(2020.3.1. 이후 선발)'], ['sped_school', '특수학교 담임(~2007.2.28.)'], ['sped_class', '특수학급 담임(~2007.2.28.)']] },
  { group: '공통가산점', items: [['overseas', '재외국민교육기관 파견']] },
];
const catLabel = k => (E.CATS[k] ? E.CATS[k].label : k);
function catRateText(k) {
  const c = E.CATS[k]; if (!c) return '';
  const a = c.rate('2030-01-01'), b = c.rate('2000-01-01');
  const f = r => `월 ${r.m}점`;
  return (a.m !== b.m) ? `${f(b)}(2016.3.1. 이전) · ${f(a)}(이후)` : f(a);
}


/* ───────── 화면별 사용 설명 ───────── */
const HELP = {
  basic: {
    goal: '어떤 명부의 점수를 볼지(평정구분), 언제 기준으로 볼지(평정기준일)를 정합니다.',
    steps: [
      '<b>평정구분</b>: 교사가 교감 자격연수 대상자로 뽑히는 순위를 보려면 “교감자격연수 후보자”를 고릅니다.',
      '<b>평정기준일</b>: 3월 31일 명부는 직전 학년도 말(2월 말일) 기준입니다. 2027.3.31. 명부면 <b>2027.2.28.</b> 버튼을 누르세요. 더 먼 날짜를 고르면 그날까지의 근무를 “전망” 탭에서 가정해야 점수에 들어갑니다.',
      '<b>1급 정교사 자격 취득일</b>과 <b>한국사 요건</b>을 확인합니다. 한국사 요건은 점수가 아니라 명부에 오를 수 있는지를 정하는 조건입니다.',
    ],
    whereLabel: '저장',
    where: '이 페이지는 입력한 값을 저장하지 않습니다. 새로 고치거나 닫으면 사라지니, 위쪽 “입력값 저장”으로 파일을 받아 두었다가 다음에 “카드(PDF) 불러오기”에서 그 파일(또는 인사기록카드 PDF)을 여세요.',
    read: '오른쪽(모바일은 아래) 채점표가 총점과 항목별 점수입니다. 탭 이름 옆 빨간 점은 확인할 것이 있다는 표시입니다.',
  },
  career: {
    goal: '근무 이력을 넣으면 최근 15년은 기본경력, 그 앞 5년은 초과경력으로 자동으로 나눠 70점 만점의 경력평정점을 계산합니다.',
    steps: [
      '<b>＋ 근무 기간</b>을 눌러 근무처, 시작일, 종료일을 넣습니다. 지금도 근무 중이면 종료일은 비워 두세요(평정기준일까지로 계산).',
      '임용 전에 병역을 마쳤다면 <b>＋ 임용 전 군복무</b>를 추가합니다. 교사는 가경력으로 평정하고, 초과경력 5년을 채우는 데 쓰입니다.',
      '휴직 기간은 넣지 않으면 빠집니다. 공무상 질병·병역·육아·입양 휴직은 100%로 인정되니 그 기간을 근무로 넣고, 해외 유학·연수 휴직은 <b>＋ 휴직(환산 50%)</b>으로 넣으세요.',
    ],
    whereLabel: '카드에서 찾는 곳',
    where: '인사기록카드 <b>임용발령사항(전체)</b>의 기간과 <b>임용전경력</b>(군복무)에서 옮깁니다. 날짜는 2015.3.1.도 2015-03-01도 되고, 시작일 칸에 “2015.03.01 ~ 2018.02.28”을 통째로 붙여넣으면 종료일까지 채워집니다. 여러 줄은 아래 “여러 줄 붙여넣기”가 빠릅니다. 2월은 말일(28 또는 29일)까지 넣어야 한 달로 계산됩니다.',
    read: '행 아래 배지가 기본경력인지 초과경력인지 알려 주고, 맨 아래 표가 점수 계산 과정을 보여 줍니다.',
  },
  perf: {
    goal: '최근 5개 학년도의 합산점 가운데 유리한 3개를 자동으로 골라 34%·33%·33%로 반영합니다.',
    steps: [
      '학년도별 <b>합산점</b>(근무성적평정 60점 + 다면평가 40점, 100점 만점)을 넣습니다. 모르는 해는 비워 두세요.',
      '<b>반영 34%</b>처럼 배지가 붙은 해가 점수에 들어간 해입니다. 가장 유리한 조합은 계산기가 찾습니다.',
      '아직 점수를 모른다면 가정할 점수를 적고 <b>빈 칸 채우기</b>를 누르세요(예: 99).',
    ],
    whereLabel: '점수는 어디서',
    where: '근무성적은 인사기록카드에 없습니다. 학교 교감·인사 담당자에게 교육청 조정을 거친 최종 합산점을 물어보세요.',
    read: '비워 두면 총점 대신 “근평을 뺀 합계”가 나옵니다. 교감·교장 평정은 교육청이 입력하므로 비워 둬도 됩니다.',
  },
  training: {
    goal: '자격연수(9점)·직무연수(18점)·연구실적(3점)을 계산합니다.',
    steps: [
      '<b>자격연수</b>: 1급 정교사 자격연수 성적과 만점을 넣습니다. 교감자격연수 후보자는 이 성적을 씁니다.',
      '<b>직무연수</b>: <b>60시간 이상</b> 과정만 추가합니다. 성적이 없으면 비워 두고, 방식(집합/원격)은 이수증으로 확인해 고르세요. 배지에서 인정 여부와 이유를 볼 수 있습니다.',
      '<b>연구대회</b>의 등급·연구자 수와 <b>학위</b>(석사·박사, 직무 관련 여부)를 넣습니다.',
      '<b>가상 점수</b>: 아직 이수하지 않은 연수는 <b>＋ 가상(예정) 연수</b>로 넣고 예상 성적을 적으세요. 확정 점수와 따로 “가상 포함” 점수로 보여 줍니다. 연구대회·학위도 같은 방식입니다.',
    ],
    whereLabel: '카드에서 찾는 곳',
    where: '인사기록카드 <b>연수이수</b> 표(연수구분이 “자격연수”인 줄의 연수성적, 연수번호에 “원격”이 들어 있으면 원격), <b>연구실적</b> 표, <b>대학원에서의 학위취득</b> 표(직무연관성 칸)에서 옮깁니다.',
    read: '“불인정” 배지가 있으면 이수증의 시작일과 방식을 다시 확인하세요. 60시간 미만 연수는 여기가 아니라 “가산점” 탭의 연도별 시간에 넣습니다.',
  },
  bonus: {
    goal: '연수 학점·학교폭력 실적(공통)과 보직교사·농어촌·담임·연구학교 같은 기간(선택)을 계산합니다.',
    steps: [
      '<b>위쪽 표</b>: 해당 연도 직무연수 시간 합계를 넣습니다(자격연수 시간은 뺍니다). 학교폭력 예방·대응 실적이 있는 해는 체크합니다.',
      '<b>아래 목록</b>: 항목을 고르고 기간을 넣습니다. 카드 가산점 표의 한 줄이 한 행입니다. <b>+1년 복제</b>로 다음 해 행을 빨리 만들 수 있습니다.',
      '줄이 많으면 <b>여러 줄 붙여넣기</b>에 카드 표를 복사해 넣고 “행으로 추가”를 누르세요.',
      '<b>올해 카드에 아직 없는 것</b>(부장·담임·농어촌·연구학교·학교폭력)은 목록 위의 버튼을 눌러 <b>가상</b>으로 켜 보세요. 확정 점수와 따로 “가상 포함” 점수로 보여 줍니다.',
    ],
    whereLabel: '카드에서 찾는 곳',
    where: '인사기록카드 <b>연수이수</b> 표의 연도별 맨 위 줄 “연도별연수시간누계”, <b>가산점</b> 표의 영역·연도·비고, 보직교사는 <b>임용발령사항</b>에서 임용구분이 “보직교사”인 기간입니다.',
    read: '행마다 “인정 / 일부 인정 / 인정되지 않음” 배지가 붙습니다. 같은 기간에 겹치는 항목(예: 보직교사와 담임)은 점수가 높은 쪽만 인정됩니다. 아래 요약 표의 “상한” 배지는 더 늘려도 점수가 오르지 않는다는 뜻입니다.',
  },
  plan: {
    goal: '평정기준일 이후에도 계속 근무한다고 가정하고, 해마다 점수가 어떻게 바뀌는지 봅니다.',
    steps: [
      '<b>계획을 계산에 반영</b>을 켭니다.',
      '학년도마다 보직교사·담임·근무학교 유형·연구학교·학교폭력 실적·연수 시간·예상 근무성적을 정합니다. 학년도는 <b>추가</b> 버튼으로 늘립니다.',
      '새로 이수할 60시간 이상 직무연수와 올해 카드에 아직 없는 부장·담임은 <b>연수·연구</b>·<b>가산점</b> 탭에서 <b>가상(예정)</b>으로 넣으면 이 전망에도 함께 반영됩니다.',
    ],
    whereLabel: '보는 법',
    where: '아래 그래프와 표에서 해마다 어느 항목이 오르고(▲) 어느 항목이 줄어드는지 봅니다. 직무연수가 10년이 지나 빠지는 시점은 주황색 안내로 알려 줍니다.',
    read: '가정에 따른 계산이라 확정 점수가 아닙니다. 평정기준일을 계획 학년도까지 늦추면 그 가정이 채점표 점수에도 들어갑니다.',
  },
  ref: {
    goal: '이 계산기가 쓰는 배점, 상한, 중복 불가 조합을 한눈에 정리했습니다.',
    steps: [
      '계산 결과가 이상할 때 해당 항목의 배점과 상한을 여기서 확인하세요.',
      '어떤 항목이 몇 점까지 오를 수 있는지 알아볼 때도 쓸 수 있습니다.',
    ],
    whereLabel: '참고',
    where: '근거 문서와 이 계산기가 가정한 것(2026학년도 요령 적용, 직무연수 10년 등)은 맨 아래에 적어 두었습니다.',
    read: '',
  },
};
function help(tab) {
  const h = HELP[tab]; if (!h) return '';
  const closed = ui.helpClosed && ui.helpClosed[tab];
  return '<details class="help" data-help="' + tab + '"' + (closed ? '' : ' open') + '><summary><span class="hi" aria-hidden="true">?</span>이 화면 사용법</summary>' +
    '<div class="help-body"><p><span class="k">하는 일</span>' + h.goal + '</p>' +
    '<ol>' + h.steps.map(s => '<li>' + s + '</li>').join('') + '</ol>' +
    (h.where ? '<p><span class="k">' + h.whereLabel + '</span>' + h.where + '</p>' : '') +
    (h.read ? '<p><span class="k">읽는 법</span>' + h.read + '</p>' : '') +
    '</div></details>';
}

/* ───────── 탭 목록 ───────── */
const TABS = [['basic', '기본'], ['career', '경력', 1], ['perf', '근무성적', 2], ['training', '연수·연구', 3], ['bonus', '가산점', 4], ['plan', '전망', 5], ['ref', '기준표']];
const GUIDE_STEPS = [
  ['career', '경력', ' 탭에 근무 이력과 임용 전 군복무를 넣습니다.'],
  ['perf', '근무성적', ' 탭에 최근 5개 학년도 합산점을 넣습니다.'],
  ['training', '연수·연구', ' 탭에 자격연수 성적, 60시간 이상 직무연수, 연구대회·학위를 넣습니다.'],
  ['bonus', '가산점', ' 탭에 연도별 연수 시간, 학교폭력 실적, 보직교사·농어촌·연구학교 같은 기간을 넣습니다.'],
  ['plan', '전망', ' 탭에서 앞으로 몇 년간 근무 계획을 가정해 점수 변화를 봅니다.'],
];
/** 화면 맨 위(탭 위)의 '입력 순서' — 기본 탭에서만 펼쳐 보이고, 단계 이름을 누르면 그 탭으로 이동 */
function renderGuide() {
  const el = $('#guide'); if (!el) return;
  if (ui.tab !== 'basic') { el.innerHTML = ''; return; }
  const closed = ui.helpClosed && ui.helpClosed.guide;
  el.innerHTML = '<details class="guide" data-help="guide"' + (closed ? '' : ' open') + '><summary><h2>입력 순서</h2></summary>' +
    '<p class="guide-lead">먼저 아래에서 평정구분과 평정기준일을 정한 뒤, 이 순서로 채우세요. 이름을 누르면 그 화면으로 갑니다. 아직 확정되지 않은 연수·부장·담임이 궁금하면 연수·가산점 탭의 <b>가상(예정)</b>으로 넣어 가상 점수를 따로 볼 수 있습니다.</p>' +
    '<ol class="steps">' + GUIDE_STEPS.map((s, i) => '<li><span class="n">' + (i + 1) + '</span><div><button type="button" class="step-link" data-act="tab" data-tab="' + s[0] + '">' + s[1] + '</button>' + s[2] + '</div></li>').join('') + '</ol></details>';
}

/* ───────── 탭 1: 기본 ───────── */
function tabBasic() {
  const p = state.profile;
  const kinds = [
    ['g1', '교감자격연수 후보자', '교사 → 교감 자격연수 응시대상자 순위명부', '자격연수: 1급 정교사 자격연수 성적(×0.025)'],
    ['g2', '교감 승진후보자', '교감 자격증을 딴 교사의 승진후보자 명부', '자격연수: 교감 자격연수 성적(×0.05)'],
    ['j1', '교장자격연수 후보자', '교감 → 교장 자격연수 대상자 명부', '자격연수: 교감 자격연수 성적(×0.05)'],
    ['j2', '교장 승진후보자', '교장 자격증을 딴 교감의 승진후보자 명부', '자격연수: 교장 자격연수 성적(×0.05)'],
  ];
  const chips = [['2026-02-28', '2026.2.28.'], ['2027-02-28', '2027.2.28.'], ['2028-02-29', '2028.2.29.'], ['2029-02-28', '2029.2.28.'], ['2030-02-28', '2030.2.28.'], ['2031-02-28', '2031.2.28.']];
  return `<h2>기본 정보</h2>
  <p class="lead">어떤 명부의 점수를 볼지, 언제 기준으로 볼지 정합니다. 명부는 해마다 3월 31일에 만들고, 점수는 직전 학년도 말(2월 말일)을 기준으로 평정합니다.</p>
  ${help('basic')}
  <section class="sec">
    <div class="sec-h"><h3>평정구분</h3></div>
    <div class="radios" role="radiogroup" aria-label="평정구분">
      ${kinds.map(([k, t, d, s]) => `<label class="rcard"><input type="radio" name="kind" data-path="profile.kind" data-render="1" value="${k}"${p.kind === k ? ' checked' : ''}><div><b>${t}</b><span>${d}<br>${s}</span></div></label>`).join('')}
    </div>
  </section>
  <section class="sec">
    <div class="sec-h"><h3>평정기준일</h3></div>
    <div class="grid">
      ${fl('평정기준일(해당 학년도 말일)', dt('profile.baseDate', { ph: '2027-02-28' }), 'c4')}
      ${fl('이름·메모(선택)', tx('profile.name', { ph: '표시용, 저장 파일에만 들어갑니다' }), 'c8')}
    </div>
    <div class="chips" role="group" aria-label="평정기준일 바로 고르기">
      ${chips.map(([v, l]) => `<button type="button" class="chip" data-act="set-base" data-v="${v}" aria-pressed="${p.baseDate === v}">${l}</button>`).join('')}
    </div>
    <p class="note">2027.3.31. 명부는 평정기준일 <b>2027.2.28.</b>입니다. 이 앱의 배점은 2026학년도 명부작성요령(울산, 2025.11.)을 따르며, 2027학년도 요령이 나오면 달라진 부분이 있는지 확인하세요.</p>
  </section>
  <section class="sec">
    <div class="sec-h"><h3>응시 요건 확인</h3></div>
    <div class="grid">
      ${fl('1급 정교사 자격 취득일', dt('profile.firstQualDate', { ph: '2015-08-27' }), 'c4')}
      ${p.kind === 'g1' ? fl('한국사 요건 (교감자격연수 후보자)', sl('profile.koreanHistory', [['unknown', '확인 필요(아직 모름)'], ['exam', '한국사능력검정시험 3급 이상 합격'], ['course', '한국사 관련 연수 합산 60시간 이상'], ['none', '해당 없음(미충족)']], { render: true }), 'c8') : ''}
    </div>
    <p class="note">교감 자격연수 응시대상자 순위명부에 오르려면 1급 정교사 자격을 가지고 교육경력 3년 이상이어야 하고, 한국사능력검정 3급 이상 또는 한국사 연수 60시간 이상이 있어야 합니다. 점수와 별개의 요건이라 점수가 아무리 높아도 요건이 없으면 명부에 오르지 못합니다.</p>
  </section>`;
}

/* ───────── 탭 2: 경력 ───────── */
function careerRow(i) {
  return `<div class="rowc" data-row="career:${i}">
    ${fl('근무처·내용', tx(`career.${i}.label`, { ph: '○○중학교' }), 'c4')}
    ${fl('시작일', dt(`career.${i}.start`), 'c2')}
    ${fl('종료일(비우면 기준일까지)', dt(`career.${i}.end`, { ph: '현재 근무 중' }), 'c2')}
    ${fl('등급', sl(`career.${i}.grade`, GRADES, { render: true }), 'c2')}
    ${fl('환산율', sl(`career.${i}.rate`, RATES, { kind: 'num', render: true }), 'c2')}
    ${drv('career', i)}
    <div class="act">${ck(`career.${i}.mil`, '임용 전 군복무', { render: true })}<button type="button" class="btn sm danger" data-act="del" data-arr="career" data-i="${i}" aria-label="이 행 삭제">삭제</button></div>
  </div>`;
}
function tabCareer() {
  const rows = state.career.map((_, i) => careerRow(i)).join('');
  return `<h2>경력평정</h2>
  <p class="lead">근무 이력을 순서와 상관없이 넣으면 평정기준일에서 거슬러 올라가며 <b>기본경력 15년(180개월)</b>, 그 앞 <b>초과경력 5년(60개월)</b>에 자동으로 나눕니다. 일시퇴직·휴직 기간은 넣지 않으면 빠집니다.</p>
  ${help('career')}
  ${sec('근무 이력', sumSlot('sum:career'), `
    <div class="rows" id="rows-career">${rows || '<div class="empty">아직 입력한 경력이 없습니다. 아래 버튼으로 추가하세요.</div>'}</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px">${addBtn('근무 기간', 'add', 'data-arr="career" data-tpl="careerWork"')}${addBtn('임용 전 군복무(가경력)', 'add', 'data-arr="career" data-tpl="careerMil"')}${addBtn('휴직(환산 50%)', 'add', 'data-arr="career" data-tpl="careerLeave"')}</div>
    <details class="fold"><summary>여러 줄 붙여넣기 (임용발령사항 등)</summary><div class="in">
      <p class="note">한 줄에 <b>2022.03.01 ~ 2023.02.28 ○○중학교</b>처럼 기간이 들어 있으면 행으로 바꿔 줍니다. 등급은 가경력, 환산율은 100%로 들어가니 필요하면 고치세요.</p>
      <textarea id="paste-career" autocomplete="off" spellcheck="false" placeholder="2015.03.01 ~ 2018.02.28 A중학교&#10;2018.03.01 ~ 2022.02.28 B중학교"></textarea>
      <div style="margin-top:8px"><button type="button" class="btn sm" data-act="paste-career">행으로 추가</button></div>
    </div></details>`,
    '교사의 임용 전 군복무는 가경력입니다. 휴직은 사유에 따라 100%(공무상 질병·병역·육아·입양 등), 50%(해외 유학·연수 등), 0%(그 밖의 휴직: 입력하지 않음)로 나뉩니다. 같은 날짜가 겹치면 한 번만 셉니다.')}
  ${sec('평정 결과', '', `<div class="tbl-wrap"><table class="t" id="tbl-career"><tbody></tbody></table></div><p class="note" id="career-extra"></p>`)}`;
}

/* ───────── 탭 3: 근무성적 ───────── */
function tabPerf() {
  const Y = yearOf(curBase());
  const teacher = isTeacher();
  const years = [Y - 1, Y - 2, Y - 3, Y - 4, Y - 5];
  const rows = years.map((y, k) => {
    const dim = (!teacher && k > 2);
    return `<div class="rowc" data-row="perf:${y}">
      <div class="fl c4"><span class="lb">평정 학년도</span><div style="min-height:34px;display:flex;align-items:center;font-weight:600">${y}학년도 <span class="muted small" style="margin-left:8px">(${y}.3.1.~${dshort(E.schoolYearEnd(y))})</span></div></div>
      ${flDiv('합산점(100점 만점)', `<input type="text" inputmode="decimal" autocomplete="off" data-kind="num" data-path="perf.${y}" value="${esc(state.perf[y] == null ? '' : state.perf[y])}" placeholder="예: 99.5"${dim ? ' disabled' : ''}>`, 'c3')}
      ${drv('perf', y)}
    </div>`;
  }).join('');
  return `<h2>근무성적평정</h2>
  <p class="lead">${teacher
    ? '최근 5개 학년도 합산점(근무성적평정 60점 + 다면평가 40점) 가운데 <b>유리한 3개 학년도</b>를 골라, 기준일에 가까운 해부터 <b>34%·33%·33%</b>로 반영합니다. 5개를 모두 넣으면 가장 유리한 조합을 자동으로 찾습니다.'
    : '교감 근무성적은 교육청이 입력합니다. 직전 3개 학년도 합산점을 알고 있다면 넣어서 34%·33%·33%로 반영해 볼 수 있습니다. 비워 두면 근평을 뺀 합계만 보여 줍니다.'}</p>
  ${help('perf')}
  ${sec('학년도별 합산점', sumSlot('sum:perf'), `
    <div class="rows">${rows}</div>
    <div class="grid" style="margin-top:6px">
      ${flDiv('빈 칸을 한꺼번에 채워 보기(가정)', `<div style="display:flex;gap:8px"><input type="text" inputmode="decimal" id="fill-perf" placeholder="예: 99" style="max-width:120px"><button type="button" class="btn sm" data-act="fill-perf">빈 칸 채우기</button><button type="button" class="btn sm ghost" data-act="clear-perf">모두 지우기</button></div>`, 'c12')}
    </div>`,
    '근무성적은 학교에서 평정한 뒤 교육청 조정을 거쳐 확정됩니다. 합산점은 분포비율(수 95점 이상 30%, 우 90점 이상 40%, 미 85점 이상 20%, 양 10%)을 맞춰 평정하므로, 실제 점수는 인사기록카드에 없고 학교 담당자에게서 확인해야 합니다. 평정점이 없는 학년도(휴직 등)는 앞뒤 평균으로 채우고, 앞 평정이 없으면 85점으로 봅니다.')}`;
}

/* ───────── 탭 4: 연수·연구 ───────── */
function courseRow(i) {
  const c = state.training.courses[i];
  return `<div class="rowc${isV(c) ? ' virtual' : ''}" data-row="course:${i}">
    ${vHead(c, '아직 이수하지 않은 연수입니다.')}
    ${fl('과정명', tx(`training.courses.${i}.label`, { ph: '직무연수 과정명' }), 'c4')}
    ${fl('시작일', dt(`training.courses.${i}.start`), 'c2')}
    ${fl('종료일', dt(`training.courses.${i}.end`), 'c2')}
    ${fl('시간', nm(`training.courses.${i}.hours`), 'c2')}
    ${fl(isV(c) ? '예상 성적(95점 초과면 6점)' : '성적(없으면 비움)', nm(`training.courses.${i}.score`, { ph: '예: 92' }), 'c2')}
    ${fl('방식', sl(`training.courses.${i}.mode`, [['집합', '집합(대면)'], ['원격', '원격(온라인)'], ['미확인', '확인 필요(원격으로 계산)']], { render: true }), 'c3')}
    ${drv('course', i)}
    <div class="act">${vCk(`training.courses.${i}.virtual`)}<button type="button" class="btn sm danger" data-act="del" data-arr="training.courses" data-i="${i}" aria-label="이 연수 삭제">삭제</button></div>
  </div>`;
}
function contestRow(i) {
  const c = state.training.contests[i];
  return `<div class="rowc${isV(c) ? ' virtual' : ''}" data-row="contest:${i}">
    ${vHead(c, '아직 입상하지 않은 실적입니다.')}
    ${fl('대회·실적명', tx(`training.contests.${i}.label`, { ph: '시·도 교육자료전 등' }), 'c4')}
    ${fl('입상일', dt(`training.contests.${i}.date`), 'c2')}
    ${fl('대회 규모·등급', sl(`training.contests.${i}.scale`, SCALES), 'c3')}
    ${fl('연구자 수', sl(`training.contests.${i}.authors`, AUTHORS, { kind: 'num' }), 'c3')}
    ${drv('contest', i)}
    <div class="act">${vCk(`training.contests.${i}.virtual`)}<button type="button" class="btn sm danger" data-act="del" data-arr="training.contests" data-i="${i}" aria-label="이 실적 삭제">삭제</button></div>
  </div>`;
}
function degreeRow(i) {
  const g = state.training.degrees[i];
  return `<div class="rowc${isV(g) ? ' virtual' : ''}" data-row="degree:${i}">
    ${vHead(g, '아직 취득하지 않은 학위입니다.')}
    ${fl('구분', sl(`training.degrees.${i}.level`, [['석사', '석사'], ['박사', '박사']]), 'c2')}
    ${fl('학위·기관', tx(`training.degrees.${i}.label`, { ph: '○○대 교육대학원' }), 'c4')}
    ${fl('취득일', dt(`training.degrees.${i}.date`), 'c3')}
    <div class="fl c3"><span class="lb">직무 관련</span>${ck(`training.degrees.${i}.related`, '직무와 관련 있음')}</div>
    ${drv('degree', i)}
    <div class="act">${vCk(`training.degrees.${i}.virtual`)}<button type="button" class="btn sm danger" data-act="del" data-arr="training.degrees" data-i="${i}" aria-label="이 학위 삭제">삭제</button></div>
  </div>`;
}
function tabTraining() {
  const T = state.training, K = kindCfg(), teacher = isTeacher();
  const q = T.qual;
  const win = R ? E.dutyWindowStart(R.baseDate) : '';
  return `<h2>연수성적평정</h2>
  <p class="lead">${teacher ? '자격연수 9점 + 직무연수 18점 + 연구실적 3점, 모두 30점 만점입니다.' : '교감·교장 평정은 자격연수 9점 + 직무연수 성적 1건 6점, 모두 15점 만점입니다(연구실적 없음).'}</p>
  ${help('training')}
  ${sec('자격연수', sumSlot('sum:qual'), `
    <div class="grid">
      ${fl('자격연수 과정', tx('training.qual.label', { ph: '1급 정교사 자격연수' }), 'c4')}
      ${fl('시작일(선택)', dt('training.qual.start'), 'c2')}
      ${fl('종료일(선택)', dt('training.qual.end'), 'c2')}
      ${fl('성적', nm('training.qual.score', { ph: '예: 95' }), 'c2')}
      ${fl('만점', nm('training.qual.full', { ph: '100' }), 'c2')}
    </div>`,
    `이번 평정구분의 자격연수는 <b>${K.qualName === '중등1정교사자격' ? '1급 정교사 자격연수' : K.qualName === '중등교감자격' ? '교감 자격연수' : '교장 자격연수'}</b> 성적이고, 점수는 9 − (만점 − 성적) × ${K.qualK}입니다. 성적이 만점의 8할 미만이면 8할로 보고, 6할 미만이면 평정하지 않습니다.`)}
  ${sec('직무연수(60시간 이상 과정)', sumSlot('sum:duty'), `
    <div class="rows" id="rows-courses">${T.courses.map((_, i) => courseRow(i)).join('') || '<div class="empty">60시간 이상 직무연수를 추가하세요. 아직 이수하지 않은 연수는 <b>＋ 가상(예정) 연수</b>로 넣어 보세요. 60시간 미만 연수는 <b>가산점</b> 탭의 연도별 시간에 넣습니다.</div>'}</div>
    <div class="addbar">${addBtn('연수 과정', 'add', 'data-arr="training.courses" data-tpl="course"')}${vBtn('가상(예정) 연수', 'training.courses', 'vcourse')}</div>`,
    `최근 10년(<b class="num">${dotd(win)}</b> 이후 종료) 안에 마친 <b>60시간 이상</b> 과정만 셉니다. 성적이 있는 과정 중 가장 높은 1건은 성적(6점 × 환산성적 ÷ 100), 그 밖의 과정은 건당 6점(이수실적)으로 최대 3건입니다.
     <b>원격연수는 2021.1.1. 이후 시작한 과정만</b> 인정하고 그 이전 원격연수는 성적과 이수실적 모두 인정하지 않습니다(교사는 2024.3.31. 명부부터 원격 인정). 환산표: 95점 초과 100 · 90점 초과 95 · 85점 초과 90 · 85점 이하 85.
     <b>가상(예정) 연수</b>는 아직 이수하지 않은 과정입니다. 종료일을 평정기준일 이전으로 두고 예상 성적을 적으면, 확정 점수와 따로 “가상 포함” 점수로 보여 줍니다.`)}
  ${teacher ? sec('연구대회 입상 실적', sumSlot('sum:contest'), `
    <div class="rows" id="rows-contests">${T.contests.map((_, i) => contestRow(i)).join('') || '<div class="empty">입상 실적이 있으면 추가하세요.</div>'}</div>
    <div class="addbar">${addBtn('입상 실적', 'add', 'data-arr="training.contests" data-tpl="contest"')}${vBtn('가상(예정) 입상', 'training.contests', 'vcontest')}</div>`,
    '한 학년도에 1건(점수가 높은 것)만 인정합니다. 공동 연구는 2인 70%, 3인 50%, 4인 이상 30%. 학생 지도 공적으로 받은 표창은 연구실적이 아닙니다.') : ''}
  ${teacher ? sec('학위 취득 실적', sumSlot('sum:degree'), `
    <div class="rows" id="rows-degrees">${T.degrees.map((_, i) => degreeRow(i)).join('') || '<div class="empty">석사·박사 학위가 있으면 추가하세요.</div>'}</div>
    <div class="addbar">${addBtn('학위', 'add', 'data-arr="training.degrees" data-tpl="degree"')}${vBtn('가상(예정) 학위', 'training.degrees', 'vdegree')}</div>`,
    '석사 직무관련 1.5점·기타 1.0점, 박사 직무관련 3점·기타 1.5점이며 하나만 인정합니다. 직무관련 여부는 인사기록카드의 “직무 연관성” 칸에 따르니, 교과와 관련된 학위인데 N으로 돼 있으면 학교 인사 담당자에게 정정을 요청하세요. 자격연수 성적으로 평정한 석사는 제외됩니다.') : ''}
  ${teacher ? sec('연구실적 합계', sumSlot('sum:research'), '') : ''}`;
}

/* ───────── 탭 5: 가산점 ───────── */
function periodRow(i) {
  const p = state.bonus.periods[i];
  return `<div class="rowc${isV(p) ? ' virtual' : ''}" data-row="period:${i}">
    ${vHead(p, '아직 카드에 없는(예정) 기간입니다.')}
    ${fl('항목', sl(`bonus.periods.${i}.cat`, CAT_GROUPS, { render: true }), 'c4')}
    ${fl('소속·비고', tx(`bonus.periods.${i}.label`, { ph: '학교명 등' }), 'c3')}
    ${fl('시작일', dt(`bonus.periods.${i}.start`), 'c2')}
    ${fl('종료일', dt(`bonus.periods.${i}.end`), 'c2')}
    ${drv('period', i)}
    <div class="act">${vCk(`bonus.periods.${i}.virtual`)}<button type="button" class="btn sm" data-act="dup" data-arr="bonus.periods" data-i="${i}" title="같은 내용으로 다음 해 행을 만듭니다">+1년 복제</button><button type="button" class="btn sm danger" data-act="del" data-arr="bonus.periods" data-i="${i}" aria-label="이 행 삭제">삭제</button></div>
  </div>`;
}
/* 올해(평정기준일이 속한 학년도) 카드에 아직 없는 항목을 가상으로 켜고 끄는 버튼 */
const VCHIPS = [['head', '부장교사(보직교사)'], ['homeroom', '담임교사'], ['rural', '농어촌학교'], ['special', '특수여건학교'], ['policy', '정책지원학교'], ['edu_research', '연구학교(교육부 지정)'], ['office_research', '연구학교(교육감 지정)'], ['violence', '학교폭력 실적']];
function vChipState(cat) {   // 'real'(카드·입력에 이미 있음) · 'on'(가상으로 켬) · 'off'
  const y = thisYearSpan();
  if (cat === 'violence') {
    if (state.bonus.violence.map(String).includes(y.key)) return 'real';
    return (state.bonus.vviolence || []).map(String).includes(y.key) ? 'on' : 'off';
  }
  const covers = p => !isV(p) && p.cat === cat && E.norm(p.start) && E.norm(p.start) <= y.start && (!E.norm(p.end) || E.norm(p.end) >= y.end);
  if (state.bonus.periods.some(covers)) return 'real';
  return state.bonus.periods.some(p => isV(p) && p.cat === cat && E.norm(p.start) === y.start && E.norm(p.end) === y.end) ? 'on' : 'off';
}
function vChips() {
  const y = thisYearSpan();
  return `<div class="vbar"><div class="vbar-h"><span class="vtag">가상</span><b>${esc(y.label)}(${dshort(y.start)}~${dshort(y.end)}) 카드에 아직 없는 것</b></div>
    <p class="note">해당하는 것을 눌러 켜 보세요. 확정 점수에는 넣지 않고 “가상 포함” 점수에만 반영하며, 다시 누르면 꺼집니다. 카드나 아래 목록에 이미 있는 항목은 ✓로 표시됩니다. 같은 기간에 겹치는 항목(예: 부장과 담임)은 점수가 높은 쪽만 인정되니, 가상으로 켜도 점수가 안 오르면 행의 배지에서 이유를 확인하세요.</p>
    <div class="chips" role="group" aria-label="올해 가상 가산점">${VCHIPS.map(([cat, lab]) => { const st = vChipState(cat); return `<button type="button" class="chip" data-act="vchip" data-cat="${cat}" aria-pressed="${st === 'on'}"${st === 'real' ? ' disabled' : ''}>${st === 'real' ? '✓ ' : ''}${lab}${st === 'real' ? ' (이미 있음)' : ''}</button>`; }).join('')}</div></div>`;
}
function bonusYearRows() {
  const base = curBase();
  const firstCareer = state.career.filter(r => !r.mil && E.norm(r.start)).map(r => E.norm(r.start)).sort()[0];
  const hy = Object.keys(state.bonus.yearHours).map(Number).filter(Boolean).sort((a, b) => a - b);
  const hv = state.bonus.violence.map(Number).filter(Boolean).sort((a, b) => a - b);
  const earliestYear = Math.min(...[firstCareer ? yearOf(firstCareer) : yearOf(base) - 14, hy[0] || 9999, hv[0] || 9999]);
  const from = `${Math.max(earliestYear, yearOf(base) - 30)}-03-01`;
  return E.periodKeys(from, base);
}
function tabBonus() {
  const keys = bonusYearRows();
  const yrows = keys.map(k => `<tr>
    <td>${E.periodLabel(k)}</td>
    <td><input type="text" inputmode="decimal" data-kind="num" data-path="bonus.yearHours.${k}" value="${esc(state.bonus.yearHours[k] == null ? '' : state.bonus.yearHours[k])}" placeholder="0" style="width:84px" aria-label="${E.periodLabel(k)} 연수 시간"></td>
    <td data-drv="yh:${k}"></td>
    <td style="text-align:center"><label class="chk" style="min-height:0"><input type="checkbox" data-path="bonus.violence.${k}" data-kind="vio" ${state.bonus.violence.includes(k) ? 'checked' : ''} aria-label="${E.periodLabel(k)} 학교폭력 실적"></label>${(state.bonus.vviolence || []).map(String).includes(k) && !state.bonus.violence.includes(k) ? ' <span class="vtag">가상</span>' : ''}</td>
  </tr>`).join('');
  const cerOpts = [['0', '없음'], ['0.5', '1급·기사 이상(0.50)'], ['0.25', '2·3급·기능사(0.25)']];
  return `<h2>가산점</h2>
  <p class="lead">공통가산점(직무연수 이수실적·학교폭력 실적·교육부 연구학교·재외국민교육기관 파견)과 선택가산점(보직교사·농어촌·담임 등)입니다. 항목마다 상한이 있고, 같은 기간에 겹치는 항목은 유리한 하나만 셉니다.</p>
  ${help('bonus')}
  ${sec('연도별 직무연수 시간 · 학교폭력 실적', sumSlot('sum:yearly'), `
    <div class="tbl-wrap"><table class="t" id="tbl-year"><thead><tr><th>평정 기간</th><th>직무연수 시간 합계</th><th>학점(15시간=1)</th><th style="text-align:center">학교폭력 실적</th></tr></thead><tbody>${yrows}</tbody></table></div>`,
    '연수 시간은 인사기록카드 “연수이수” 표에서 해당 연도 맨 위 줄의 “연도별연수시간누계”를 입력하세요(자격연수·기타연수 시간은 빼고). 한 해 최대 4학점(0.08점), 합계 최대 50학점(1.00점)입니다. 연수성적에 쓴 60시간 이상 과정은 시간에서 자동으로 빼서 계산합니다.')}
  ${sec('기간으로 계산하는 가산점', sumSlot('sum:periods'), `
    ${vChips()}
    <div class="rows" id="rows-periods">${state.bonus.periods.map((_, i) => periodRow(i)).join('') || '<div class="empty">보직교사·농어촌·담임·연구학교 기간을 추가하세요.</div>'}</div>
    <div class="addbar">${addBtn('기간 추가', 'add-period')}${vBtn('가상(예정) 기간', 'bonus.periods', 'vperiod')}<button type="button" class="btn sm ghost" data-act="sort-periods">항목·날짜순 정렬</button></div>
    <details class="fold"><summary>여러 줄 붙여넣기 (가산점 표 등)</summary><div class="in">
      <p class="note">한 줄에 <b>2022.03.01 ~ 2023.02.28 농어촌(A중)</b>처럼 기간과 설명이 있으면 행으로 바꿉니다. 설명에 농어촌·특수여건·정책지원·담임·보직·연구시범(공통/선택)·청소년단체 같은 말이 있으면 항목을 맞추고, 없으면 아래에서 고른 항목으로 들어갑니다. “학교폭력” 줄은 연도별 학교폭력 실적에 체크됩니다.</p>
      <div class="grid"><div class="fl c6"><span class="lb">항목을 알 수 없을 때 넣을 항목</span><select id="paste-cat">${CAT_GROUPS.map(g => `<optgroup label="${esc(g.group)}">${g.items.map(([v, l]) => `<option value="${v}"${ui.pasteCat === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</optgroup>`).join('')}</select></div></div>
      <textarea id="paste-bonus" autocomplete="off" spellcheck="false" style="margin-top:8px" placeholder="2022.03.01 ~ 2023.02.28 농어촌(A중)&#10;2023.03.01 ~ 2024.02.29 학교폭력예방 및 해결 기여"></textarea>
      <div style="margin-top:8px"><button type="button" class="btn sm" data-act="paste-bonus">행으로 추가</button></div>
    </div></details>`,
    '교육부 지정 연구학교와 재외국민교육기관 파견은 공통가산점, 나머지는 선택가산점입니다. 같은 기간 중복 불가(×) 규정은 울산 승진가산점 규정 [표38]을 따릅니다. 보직교사 경력이 1.75점(83개월 10일)을 넘으면 넘는 기간부터 “보직교사 초과근무 경력”(월 0.003점, 2022.3.1. 이후, 상한 0.40점)으로 바뀝니다.')}
  ${sec('직접 입력하는 항목', '', `
    <div class="grid">
      ${fl('국가기술자격(선택가산점)', sl('bonus.cert', cerOpts, { kind: 'num' }), 'c4')}
      ${fl('전국체전 유공(2005년, 최대 0.10)', nm('bonus.national'), 'c4')}
      ${fl('기타 규정 항목(담당 장학사 확인 후)', nm('bonus.other'), 'c4')}
    </div>`,
    '국가기술자격 가산점은 직무연수 학점으로 바꾼 자격과 함께 쓸 수 없고, 담당 과목과 관련된 자격에 한합니다. 타 시·도에서 전입했다면 2015.1.1. 이후 전입자는 전입 전 지역가산점(도서벽지·농어촌 등)을 인정받지 못합니다.')}
  ${sec('가산점 요약', '', `<div class="tbl-wrap"><table class="t" id="tbl-bonus"><tbody></tbody></table></div>`)}`;
}

/* ───────── 탭 6: 전망 ───────── */
function planYearRow(i) {
  const y = state.plan.years[i];
  const schoolOpts = [['none', '일반학교'], ['rural', '농어촌'], ['special', '특수여건'], ['policy', '정책지원']];
  const resOpts = [['none', '연구학교 아님'], ['edu', '교육부 지정(공통)'], ['office', '교육감 지정(선택)']];
  const p = `plan.years.${i}`;
  return `<div class="rowc" data-row="plan:${i}">
    <div class="fl c2"><span class="lb">학년도</span><div style="min-height:34px;display:flex;align-items:center;font-weight:600">${y.year}학년도</div></div>
    <div class="fl c2"><span class="lb">보직교사</span>${ck(`${p}.head`, '부장 등', { render: true })}</div>
    <div class="fl c2"><span class="lb">담임</span>${ck(`${p}.homeroom`, '담임', { render: true })}</div>
    ${fl('근무학교 유형', sl(`${p}.school`, schoolOpts, { render: true }), 'c3')}
    ${fl('연구학교', sl(`${p}.research`, resOpts, { render: true }), 'c3')}
    <div class="fl c2"><span class="lb">학교폭력 실적</span>${ck(`${p}.violence`, '있음', { render: true })}</div>
    ${fl('직무연수 시간(합계)', nm(`${p}.hours`), 'c2')}
    ${fl('근무성적(가정)', nm(`${p}.perf`, { ph: '99' }), 'c2')}
    <div class="act"><button type="button" class="btn sm danger" data-act="del" data-arr="plan.years" data-i="${i}" aria-label="이 학년도 삭제">삭제</button></div>
  </div>`;
}
function projectionDates(b0) {
  const Y = yearOf(b0);
  let first = E.schoolYearEnd(Y - 1);              // Y.2.28(29)
  if (first <= b0) first = E.schoolYearEnd(Y);     // 이미 지났으면 다음 해 2월 말
  const y = yearOf(first);
  const out = [b0];
  for (let k = 0; k < 4; k++) out.push(E.schoolYearEnd(y - 1 + k));
  return out.filter((d, i) => out.indexOf(d) === i);
}
function projection() {
  const eff = E.applyPlan(forCompute(state));
  return projectionDates(curBase()).map(d => ({ date: d, r: E.compute(eff, d) }));
}
function tabPlan() {
  const P = state.plan;
  const nextYear = P.years.length ? Math.max(...P.years.map(y => y.year)) + 1 : yearOf(curBase());
  return `<h2>앞으로의 전망</h2>
  <p class="lead">평정기준일 이후 학년도에 어떻게 근무할지 가정하면, 해마다 점수가 얼마나 오르는지 계산합니다. 입력한 실제 기록(평정기준일까지)은 그대로 두고 그 뒤 학년도만 가정으로 채웁니다.</p>
  ${help('plan')}
  ${sec('근무 계획', '', `
    <label class="chk" style="margin-bottom:6px"><input type="checkbox" data-path="plan.on" data-render="1"${P.on ? ' checked' : ''}> 계획을 계산에 반영</label>
    <div class="rows">${P.years.map((_, i) => planYearRow(i)).join('') || '<div class="empty">계획할 학년도를 추가하세요.</div>'}</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px"><button type="button" class="btn sm" data-act="add-plan-year">＋ ${nextYear}학년도 추가</button></div>`,
    '계획 학년도에는 경력(가경력 근무)이 이어지는 것으로 보고, 체크한 항목을 그 해 전체(3.1.~2.말)에 적용합니다. 근무성적은 가정값이며, 비우면 입력해 둔 점수만으로 3개년을 고릅니다.')}
  ${sec('예정 연수 · 올해 가상 항목', '', `
    <p class="note" style="margin:0">아직 이수하지 않은 직무연수와 올해 카드에 아직 없는 부장·담임은 <button type="button" class="step-link" data-act="tab" data-tab="training">연수·연구</button> 탭의 <b>＋ 가상(예정) 연수</b>, <button type="button" class="step-link" data-act="tab" data-tab="bonus">가산점</button> 탭의 <b>올해 카드에 아직 없는 것</b>에서 넣으세요. 넣은 가상 항목은 아래 전망에도 함께 반영됩니다.${hasVirtual() ? ` <b>지금 가상 항목 ${virtualTotal()}건이 포함되어 있습니다.</b>` : ''}</p>`)}
  ${sec('연도별 점수 전망', '', `<div id="plan-out"></div>`)}`;
}

/* ───────── 탭 7: 기준표 ───────── */
function tabRef() {
  const rowsC = [['기본경력(15년·180개월)', '가 0.3555 · 나 0.3333 · 다 0.3111', '64 · 60 · 56'], ['초과경력(5년·60개월)', '가 0.1000 · 나 0.0833 · 다 0.0666', '6 · 5 · 4']];
  return `<h2>기준표</h2>
  <p class="lead">이 계산기가 쓰는 배점입니다. 근거는 <b>울산광역시교육청 「2026학년도 중등 교육공무원 승진 및 자격연수후보자 명부작성요령」(2025.11.)</b>과 2026 승진·자격연수 평정프로그램입니다.</p>
  ${help('ref')}
  ${sec('총점 구성(만점 213.41점)', '', `<div class="tbl-wrap"><table class="t left"><thead><tr><th>항목</th><th>만점</th><th>방식</th></tr></thead><tbody>
    <tr><td>경력평정</td><td>70</td><td>기본경력 15년 64 + 초과경력 5년 6. 월 평정점×개월 + 일 평정점×일</td></tr>
    <tr><td>근무성적</td><td>100</td><td>교사: 최근 5년 중 유리한 3년을 34%·33%·33%. 교감: 최근 3년 34%·33%·33%</td></tr>
    <tr><td>자격연수</td><td>9</td><td>9 − (만점 − 성적) × 0.025(교감자격연수 후보자) 또는 × 0.05(승진·교장)</td></tr>
    <tr><td>직무연수</td><td>18</td><td>성적 1건 6×환산/100 + 이수 2건 6점씩(교감·교장 평정은 성적 1건 6점)</td></tr>
    <tr><td>연구실적</td><td>3</td><td>연구대회 입상 + 학위 취득(교사만)</td></tr>
    <tr><td>가산점 공통</td><td>3.5</td><td>연구학교 1.0 · 재외국민교육기관 파견 0.5 · 직무연수 1.0 · 학교폭력 1.0</td></tr>
    <tr><td>가산점 선택</td><td>9.91</td><td>보직교사 1.75 · 도서벽지 1.5 · 농어촌 등 1.26 · 교육감 연구학교 1.25 · 순회 1.0 · 파견 1.0 · 교육발전 0.5 · 보직 초과 0.4 · 국가기술자격 0.5 · 특수 0.75</td></tr>
  </tbody></table></div>`)}
  ${sec('경력 평정점', '', `<div class="tbl-wrap"><table class="t left"><thead><tr><th>구분</th><th>월 평정점</th><th>만점</th></tr></thead><tbody>${rowsC.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table></div>
    <p class="note">일 평정점: 가 0.0118·0.0033, 나 0.0111·0.0027, 다 0.0103·0.0022. 소수 넷째 자리에서 반올림해 셋째 자리까지 씁니다.</p>`)}
  ${sec('선택가산점 월 평정점과 상한', '', `<div class="tbl-wrap"><table class="t left"><thead><tr><th>항목</th><th>월 평정점</th><th>상한</th></tr></thead><tbody>
    <tr><td>보직교사(1급 정교사)·장학사</td><td>0.021</td><td>합산 1.75 (83개월 10일)</td></tr>
    <tr><td>보직교사 초과근무(2022.3.1.~)</td><td>0.003</td><td>0.40</td></tr>
    <tr><td>농어촌 / 정책지원 / 특수여건</td><td>0.015 / 0.012 / 0.009</td><td>합산 1.26 (특수여건 0.54)</td></tr>
    <tr><td>도서·벽지 가·나·다·라급지</td><td>0.042 / 0.034 / 0.025 / 0.017</td><td>1.50</td></tr>
    <tr><td>교육감 지정 연구·시범학교</td><td>0.010</td><td>교육부 지정과 합산 1.25</td></tr>
    <tr><td>교육부 지정 연구·시범학교(공통)</td><td>0.018</td><td>1.00</td></tr>
    <tr><td>재외국민교육기관 파견(공통)</td><td>0.015</td><td>0.50 (파견교원과 합산 1.00)</td></tr>
    <tr><td>순회교사</td><td>0.005 (2016.3.1.~), 0.01 (이전)</td><td>1.00</td></tr>
    <tr><td>담임교사 · 청소년단체 · 우수지도</td><td>0.003 (담임은 2016.3.1. 이전 0.002)</td><td>합산 0.50</td></tr>
    <tr><td>직무연수 이수(공통)</td><td>15시간당 0.02</td><td>연 0.08, 합계 1.00</td></tr>
    <tr><td>학교폭력 예방·대응(공통)</td><td>연 1회 0.1</td><td>1.00</td></tr>
  </tbody></table></div>`)}
  ${sec('같은 기간에 겹치면 하나만 인정하는 조합', '', `<p class="note" style="margin-top:0">보직교사 ↔ 담임교사·순회교사·한센병학급 / 담임교사·청소년단체·우수지도 ↔ 서로·순회·파견 / 농어촌·정책지원·특수여건·도서벽지 ↔ 서로·장학사·파견·특수학교 / 교육부 지정 연구학교 ↔ 교육감 지정 연구학교·파견·순회. 겹친 기간은 월 평정점이 높은 항목을 먼저 인정합니다.</p>`)}
  ${sec('이 계산기가 가정하는 것', '', `<ul class="note" style="padding-left:18px;margin:0;display:flex;flex-direction:column;gap:4px">
    <li>평정기준일 2027.2.28.용 요령은 아직 나오지 않아 <b>2026학년도 요령</b>을 적용했습니다. 직무연수 “10년 2개월” 경과조치는 2025학년도 평정(2026.2.28.)까지라서 2027.2.28.부터는 정확히 10년을 씁니다.</li>
    <li>공식 평정프로그램(엑셀)에 같은 기록을 넣었을 때 같은 값이 나오는지, 실제 인사기록 한 건으로 22개 항목을 대조했습니다.</li>
    <li>최종 점수는 학교 평정자·교육청 확인을 거쳐 확정됩니다. 이 값은 참고용입니다.</li>
  </ul>`)}`;
}

/* ───────── 탭 그리기 ───────── */
function renderTab() {
  const f = { basic: tabBasic, career: tabCareer, perf: tabPerf, training: tabTraining, bonus: tabBonus, plan: tabPlan, ref: tabRef }[ui.tab] || tabBasic;
  $('#panel').innerHTML = f();
  paintDerived();
}
function renderTabs() {
  $('#tabs').innerHTML = TABS.map(([k, l, n]) => `<button type="button" role="tab" class="tab" data-act="tab" data-tab="${k}" aria-selected="${ui.tab === k}">${n ? `<span class="tn" aria-hidden="true">${n}</span>` : ''}${l}</button>`).join('');
  renderGuide();
}
