/* ───────── 알림·모달 ───────── */
let toastTimer = null;
function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}
function showModal(html) {
  closeModal();
  const v = document.createElement('div');
  v.className = 'veil'; v.id = 'veil';
  v.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  v.addEventListener('mousedown', e => { if (e.target === v) closeModal(); });
  document.body.appendChild(v);
  const f = v.querySelector('textarea, input, button'); if (f) f.focus();
}
function closeModal() { const v = $('#veil'); if (v) v.remove(); }
function showTextModal(title, text, note) {
  showModal(`<h2>${esc(title)}</h2><p class="note">${esc(note || '')}</p><textarea id="modal-text" readonly style="min-height:200px">${esc(text)}</textarea>
    <div class="btns"><button type="button" class="btn" data-act="modal-copy">복사</button><button type="button" class="btn primary" data-act="modal-close">닫기</button></div>`);
  const ta = $('#modal-text'); if (ta) ta.select();
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('복사했습니다'); return true; }
  catch (e) { showTextModal('복사할 내용', text, '자동 복사가 막혀 있어 아래 내용을 직접 복사하세요.'); return false; }
}

/* ───────── 머리말·배너 ───────── */
function renderHeader() {
  $('#top-actions').innerHTML = `<button type="button" class="btn" data-act="open-import">카드(PDF) 불러오기</button><button type="button" class="btn primary" data-act="save-json">입력값 저장</button><button type="button" class="btn ghost" data-act="copy-result">결과 복사</button><button type="button" class="btn ghost danger" data-act="reset-ask">처음부터</button>`;
}
function renderBanner() {
  let h = '';
  if (ui.sample) h = '<div class="banner"><b>예시 데이터입니다.</b><span>가상 인물의 값이라 누구의 점수도 아닙니다. 내 인사기록카드 PDF를 불러오면 내 값으로 채워집니다.</span><button type="button" class="btn sm primary" data-act="open-import">카드(PDF) 불러오기</button><button type="button" class="btn sm" data-act="reset-ask">처음부터 입력</button></div>';
  else if (ui.cardImport) h = '<div class="banner plain"><b>인사기록카드에서 채운 값입니다.</b><span>' + (ui.cardImport.warn ? '확인할 점이 ' + ui.cardImport.warn.length + '건 있습니다.' : '확인할 점은 없습니다.') + ' 카드에 없는 근무성적은 직접 넣으세요.</span><button type="button" class="btn sm" data-act="import-report">읽은 내용 보기</button></div>';
  $('#banner').innerHTML = h;
}

/* ───────── 줄 붙여넣기 해석 ───────── */
const DATE_RE = /(\d{4})\s*[.\-\/]\s*(\d{1,2})\s*[.\-\/]\s*(\d{1,2})/g;
function parseRanges(text) {
  const out = [];
  String(text).split(/\r?\n/).forEach(line => {
    const ds = Array.from(line.matchAll(DATE_RE)).map(m => E.norm(`${m[1]}-${m[2]}-${m[3]}`));
    if (ds.length >= 2 && ds[0] && ds[1]) {
      const rest = line.replace(DATE_RE, ' ').replace(/[~～∼]/g, ' ').replace(/\s+/g, ' ').trim();
      out.push({ start: ds[0] <= ds[1] ? ds[0] : ds[1], end: ds[0] <= ds[1] ? ds[1] : ds[0], text: rest });
    }
  });
  return out;
}
function guessCat(t) {
  const s = t.replace(/\s/g, '');
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
  return null;
}
function sortPeriods() {
  const order = Object.keys(E.CATS);
  state.bonus.periods.sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat) || String(E.norm(a.start) || a.start).localeCompare(String(E.norm(b.start) || b.start)));
}
function shiftYear(iso, n) {
  const d = E.norm(iso); if (!d) return iso;
  const m = +d.slice(5, 7), day = +d.slice(8, 10);
  if (m === 2 && day >= 28) return E.schoolYearEnd(+d.slice(0, 4) + n - 1);   // 2월 말일은 다음 해 2월 말일로
  return E.addYears(d, n);
}

/* ───────── 변경 반영 ───────── */
function commit(rerender) {
  if (ui.sample) { ui.sample = false; renderBanner(); }
  ui.dirty = true;
  recompute();
  if (rerender) renderTab(); else paintDerived();
  renderResult();
  updateTabFlags();
}
function readValue(el) {
  const kind = el.dataset.kind;
  if (el.type === 'checkbox') return el.checked;
  if (kind === 'num') { const t = el.value.trim().replace(/,/g, ''); return t === '' ? '' : (Number.isNaN(+t) ? t : +t); }
  return el.value;
}
function onInput(e) {
  const el = e.target.closest('[data-path]'); if (!el) return;
  if (el.type === 'checkbox' || el.type === 'radio' || el.tagName === 'SELECT') return;
  const path = el.dataset.path;
  const v = readValue(el);
  setPath(state, path, el.dataset.kind === 'date' ? String(v).trim() : v);
  if (el.dataset.kind === 'date') el.classList.toggle('bad', !!String(v).trim() && !E.norm(v));
  commit(false);
}
function onChange(e) {
  const el = e.target.closest('[data-path]'); if (!el) return;
  const path = el.dataset.path, kind = el.dataset.kind;
  if (el.type === 'text' || el.tagName === 'TEXTAREA') {   // 날짜는 포커스를 벗어날 때 2020-03-01 꼴로 정리
    if (kind === 'date') {
      const n = E.norm(el.value);
      if (n && n !== el.value) { el.value = n; setPath(state, path, n); commit(false); }
    }
    return;
  }
  if (kind === 'vio') {
    const k = path.split('.').pop();
    const set = new Set(state.bonus.violence.map(String));
    if (el.checked) set.add(k); else set.delete(k);
    state.bonus.violence = Array.from(set).sort();
    commit(false);
    return;
  }
  let v;
  if (el.type === 'checkbox') v = el.checked;
  else if (el.type === 'radio') v = el.value;
  else if (kind === 'num') v = +el.value;
  else v = el.value;
  setPath(state, path, v);
  if (path === 'profile.kind') state.training.qual.name = E.KINDS[v].qualName;
  commit(el.dataset.render === '1');
}
function onPaste(e) {   // 시작일 칸에 "2015.03.01 ~ 2018.02.28"을 붙여넣으면 종료일까지 채움
  const el = e.target.closest('input[data-kind="date"]'); if (!el) return;
  const txt = (e.clipboardData || window.clipboardData).getData('text');
  const r = parseRanges(txt);
  if (r.length && /\.start$/.test(el.dataset.path)) {
    e.preventDefault();
    const base = el.dataset.path.replace(/\.start$/, '');
    setPath(state, base + '.start', r[0].start); setPath(state, base + '.end', r[0].end);
    commit(true);
  }
}

/* ───────── 클릭 동작 ───────── */
const ROWS_BOX = { 'training.courses': '#rows-courses', 'training.contests': '#rows-contests', 'training.degrees': '#rows-degrees', 'bonus.periods': '#rows-periods', 'plan.courses': '#rows-pcourses', 'plan.contests': '#rows-pcontests', 'plan.degrees': '#rows-pdegrees', 'plan.periods': '#rows-pperiods' };
const rowsBoxOf = arr => $(ROWS_BOX[arr] || '#panel') || $('#panel');   // 새 행이 생긴 목록(그 칸 안에서 마지막 행)
function focusFirstRow(container) {   // 목록 맨 위 행의 첫 글자 칸(소속·비고)
  const first = $$('.rowc', container || document)[0];
  const i = first && first.querySelector('input[type="text"]'); if (i) i.focus();
}
function focusLastRow(container) {
  const rows = $$('.rowc', container || document); const last = rows[rows.length - 1];
  const i = last && last.querySelector('input[type="text"]'); if (i) i.focus();
}
function blankState() {
  const s = normalizeState(null);
  s.career = [TPL.careerWork()];
  s.profile.baseDate = '2027-02-28';
  return s;
}
function resultText() {
  const K = kindCfg(), r = R;
  const L = (n, v, m, d = 3) => `${n.padEnd(10, '　')}${fx(v, d)} / ${m}`;
  const lines = [`승진점수 계산 — ${K.label} · 평정기준일 ${dshort(r.baseDate)}`,
    r.total === null ? `근평을 뺀 합계 ${fx(r.sumWithoutPerf, 4)}` : `총점 ${fx(r.total, 4)} / ${fx(r.maxTotal, 2)}`,
    '',
    L('경력평정', r.career.total, 70), L('근무성적', r.perf.value, 100), L('자격연수', r.training.qual.points, 9), L('직무연수', r.training.duty, dutyMax())];
  if (isTeacher()) lines.push(L('연구실적', r.training.researchPoints, 3));
  lines.push(L('가산점 공통', r.bonus.common, 3.5), L('가산점 선택', r.bonus.select, 9.91), '', '참고용 계산(2026학년도 명부작성요령 기준)입니다.');
  return lines.join('\n');
}

/** 전망의 예정 행(연수·입상·학위·기간)을 새로 만들 때 날짜 기본값을 평정기준일에 맞춰 채운다 */
function planDefaults(t, tpl) {
  const base = curBase(), y = thisYearSpan();
  if (tpl === 'pcourse') { t.end = E.addDays(base, -14); t.start = E.addDays(t.end, -13); }
  else if (tpl === 'pcontest' || tpl === 'pdegree') t.date = E.addDays(base, -30);
  else if (tpl === 'pperiod') { t.start = y.start; t.end = y.end; }
}

function onClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  switch (act) {
    case 'tab': ui.tab = b.dataset.tab; renderTabs(); updateTabFlags(); renderTab(); { const p = $('#panel'); const top = p.getBoundingClientRect().top + window.scrollY - 70; if (window.innerWidth <= 940 && window.scrollY > top) window.scrollTo({ top, behavior: 'auto' }); } break;
    case 'set-base': state.profile.baseDate = b.dataset.v; commit(true); break;
    case 'add': { const arr = getPath(state, b.dataset.arr); arr.push(TPL[b.dataset.tpl]()); commit(true); focusLastRow(rowsBoxOf(b.dataset.arr)); break; }
    case 'add-plan': {   // 전망의 예정 연수·입상·학위·가산점 기간
      const arr = getPath(state, b.dataset.arr), t = TPL[b.dataset.tpl]();
      planDefaults(t, b.dataset.tpl);
      if (b.dataset.arr === 'plan.periods') { arr.unshift(t); commit(true); focusFirstRow(rowsBoxOf(b.dataset.arr)); }
      else { arr.push(t); commit(true); focusLastRow(rowsBoxOf(b.dataset.arr)); }
      break;
    }
    case 'add-period': { state.bonus.periods.unshift(TPL.period(ui.pasteCat)); commit(true); focusFirstRow($('#rows-periods')); break; }
    case 'del': { const arr = getPath(state, b.dataset.arr); arr.splice(+b.dataset.i, 1); commit(true); break; }
    case 'dup': {
      const arr = getPath(state, b.dataset.arr); const src = arr[+b.dataset.i]; const c = clone(src);
      c.start = shiftYear(src.start, 1); c.end = src.end ? shiftYear(src.end, 1) : '';
      arr.splice(+b.dataset.i + 1, 0, c); commit(true); break;
    }
    case 'sort-periods': sortPeriods(); commit(true); break;
    case 'paste-career': {
      const rows = parseRanges($('#paste-career').value);
      if (!rows.length) { toast('기간(시작일 ~ 종료일)이 들어 있는 줄이 없습니다'); break; }
      rows.forEach(r => state.career.push({ label: r.text, start: r.start, end: r.end, grade: '가', rate: 1 }));
      state.career = state.career.filter(r => r.start || r.end || r.label);
      commit(true); toast(`${rows.length}행을 추가했습니다`); break;
    }
    case 'paste-bonus': {
      const sel = $('#paste-cat'); if (sel) ui.pasteCat = sel.value;
      const rows = parseRanges($('#paste-bonus').value);
      if (!rows.length) { toast('기간(시작일 ~ 종료일)이 들어 있는 줄이 없습니다'); break; }
      let n = 0, v = 0;
      const set = new Set(state.bonus.violence.map(String)), made = [];
      rows.forEach(r => {
        const g = guessCat(r.text);
        if (g === 'violence') { set.add(E.periodKey(r.start)); v++; return; }
        made.push({ cat: g || ui.pasteCat, label: r.text, start: r.start, end: r.end }); n++;
      });
      state.bonus.periods.unshift(...made);
      state.bonus.violence = Array.from(set).sort();
      commit(true); toast(`기간 ${n}행${v ? `, 학교폭력 ${v}건` : ''}을 추가했습니다`); break;
    }
    case 'add-plan-year': {   // 전망의 학년도 칸: 올해 / 마지막 학년도 다음 해
      const ys = state.plan.years, cy = +thisYearSpan().key;
      if (b.dataset.which === 'this') {
        if (!ys.some(y => +y.year === cy)) ys.push({ year: cy, career: false, head: false, homeroom: false, school: 'none', research: 'none', violence: false, hours: '' });
      } else {
        const last = ys.length ? ys.reduce((a, y) => (+y.year > +a.year ? y : a)) : null;
        const nw = last ? Object.assign({}, last, { year: +last.year + 1 }) : { year: cy + 1, head: false, homeroom: false, school: 'none', research: 'none', violence: false, hours: '' };
        delete nw.career;
        ys.push(nw);
      }
      ys.sort((p, q) => p.year - q.year);
      commit(true); break;
    }
    case 'save-json': saveFile(`승진점수_입력값_${stamp()}.json`, exportJson()); break;
    case 'copy-result': copyText(resultText()); break;
    case 'open-import': importHome(); break;
    case 'import-go': { const ta = $('#import-text'); const t = ta ? ta.value.trim() : ''; if (t) importJsonDone(t); else toast('내용을 붙여넣으세요'); break; }
    case 'import-apply': importApply(); break;
    case 'import-report': if (ui.cardImport) importReport(ui.cardImport, true); break;
    case 'reset-ask':
      showModal(`<h2>처음부터 입력할까요?</h2><p class="note">지금 입력한 값을 모두 지우고 빈 양식으로 시작합니다. 필요하면 먼저 <b>입력값 저장</b>으로 파일을 받아 두세요.</p>
        <div class="btns"><button type="button" class="btn" data-act="modal-close">취소</button><button type="button" class="btn danger" data-act="reset-go">지우고 시작</button></div>`);
      break;
    case 'reset-go': state = blankState(); ui.sample = false; ui.cardImport = null; ui.tab = 'basic'; closeModal(); recompute(); renderBanner(); renderTabs(); renderTab(); renderResult(); updateTabFlags(); toast('빈 양식으로 시작합니다'); break;
    case 'modal-close': closeModal(); break;
    case 'modal-copy': { const ta = $('#modal-text'); if (ta) copyText(ta.value); break; }
    default: break;
  }
}

/* ───────── 시작 ───────── */
function boot() {
  initState();
  recompute();
  renderHeader(); renderBanner(); renderTabs(); renderTab(); renderResult(); updateTabFlags();
  document.addEventListener('input', onInput);
  document.addEventListener('change', onChange);
  document.addEventListener('click', onClick);
  document.addEventListener('paste', onPaste);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  document.addEventListener('change', e => { if (e.target && e.target.id === 'import-file') { const f = e.target.files && e.target.files[0]; e.target.value = ''; importPick(f); } });
  // PDF 를 화면 어디에 놓아도 브라우저가 파일을 열어 버리지 않고 불러오기로 이어진다
  document.addEventListener('dragover', e => { if (hasFiles(e)) { e.preventDefault(); const d = $('#drop'); if (d) d.classList.add('over'); } });
  document.addEventListener('dragleave', e => { const d = $('#drop'); if (d && e.target === d) d.classList.remove('over'); });
  document.addEventListener('drop', e => { if (!hasFiles(e)) return; e.preventDefault(); const d = $('#drop'); if (d) d.classList.remove('over'); const f = e.dataTransfer.files && e.dataTransfer.files[0]; if (f) importPick(f); });
  // 저장하지 않는 앱이라, 입력한 채 닫거나 새로 고치면 사라진다는 것을 알린다
  window.addEventListener('beforeunload', e => { if (ui.dirty) { e.preventDefault(); e.returnValue = ''; } });
  document.addEventListener('toggle', e => {   // 사용 설명 접기/펼치기를 기억
    const d = e.target; if (!d || !d.classList || !(d.classList.contains('help') || d.classList.contains('guide'))) return;
    ui.helpClosed[d.dataset.help] = !d.open;
  }, true);
}
boot();
