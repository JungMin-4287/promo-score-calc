/* ───────── 불러오기: 인사기록카드 PDF(주) · 저장해 둔 입력값 JSON(보조) ─────────
 * PDF 는 이 화면 안에서만 읽는다(pdf.js 를 이 파일에 함께 넣어 두었고 네트워크를 쓰지 않는다).
 * 읽은 글자·좌표는 표로 바꾼 뒤 곧바로 버리며, 어디에도 저장하거나 보내지 않는다. */
const IMP = { busy: false, result: null };

function hasFiles(e) { const t = e.dataTransfer && e.dataTransfer.types; return !!t && Array.prototype.indexOf.call(t, 'Files') >= 0; }

function importHome(msg) {
  showModal(`<h2>인사기록카드 불러오기</h2>
    <p class="note">NEIS <b>인사기록카드 출력</b>에서 <b>인사카드(전체)</b>를 PDF로 저장한 파일을 고르세요. 경력·연수·연구·가산점이 자동으로 채워집니다. 구역별로 나뉜 출력과 법정 양식 인사카드, 두 가지 모두 읽습니다.</p>
    ${msg ? `<p class="note imp-err" role="alert">${esc(msg)}</p>` : ''}
    <label class="drop" id="drop" for="import-file"><b>PDF 파일을 여기에 끌어다 놓거나 눌러서 고르세요</b><span>파일은 이 화면 안에서만 읽습니다. 서버로 보내거나 이 브라우저에 저장하지 않습니다.</span></label>
    <input type="file" id="import-file" accept=".pdf,application/pdf,.json,application/json" hidden>
    <details class="fold"><summary>PDF는 어떻게 받나요?</summary><div class="in"><ol class="plain-ol">
      <li>NEIS에서 <b>인사기록카드 출력</b> 화면을 엽니다.</li>
      <li>출력 항목에서 <b>인사카드(전체)</b>를 선택하고 PDF로 저장합니다.</li>
      <li>저장한 PDF를 위 칸에 끌어다 놓습니다.</li></ol>
      <p class="note">카드에 없는 값(근무성적, 한국사능력검정 요건, 연수의 집합·원격 구분, 올해 학년도 가산점 등)은 읽은 뒤 알려 드립니다.</p></div></details>
    <details class="fold"><summary>저장해 둔 입력값(.json) 불러오기</summary><div class="in">
      <p class="note">이 앱에서 <b>입력값 저장</b>으로 받은 .json 파일도 위 칸에 놓으면 됩니다. 내용을 붙여넣어도 됩니다.</p>
      <textarea id="import-text" placeholder='{"app":"promo-calc", ...}'></textarea>
      <div class="btns"><button type="button" class="btn" data-act="import-go">붙여넣은 내용 불러오기</button></div></div></details>
    <div class="btns"><button type="button" class="btn" data-act="modal-close">닫기</button></div>`);
}

function importProgress(text, done, total) {
  showModal(`<h2>카드를 읽는 중…</h2>
    <p class="note" id="imp-msg">${esc(text)}</p>
    <progress id="imp-bar" max="${total || 1}" value="${done || 0}" style="width:100%"></progress>
    <p class="note">이 창을 닫지 마세요. 몇 초 걸립니다.</p>`);
}
function importProgressTick(text, done, total) {
  const m = $('#imp-msg'), b = $('#imp-bar');
  if (!m || !b) return;
  m.textContent = text; b.max = total || 1; b.value = done || 0;
}

/* pdf.js 작업자: 이 파일 안에 넣어 둔 코드를 Blob 으로 실행. 막히면 이 화면에서 직접 돌린다(조금 느림). */
function workerText() { const el = document.getElementById('pdf-worker-src'); return el ? el.textContent : ''; }
function startWorker(lib) {
  const txt = workerText();
  if (!txt || typeof Worker === 'undefined' || typeof Blob === 'undefined' || !window.URL || !URL.createObjectURL) return null;
  try {
    const url = URL.createObjectURL(new Blob([txt], { type: 'text/javascript' }));
    const w = new Worker(url);
    w._failed = false; w.addEventListener('error', () => { w._failed = true; });
    w._url = url;
    lib.GlobalWorkerOptions.workerPort = w;
    return w;
  } catch (e) { return null; }
}
function inlineWorker(lib) {
  if (!window.pdfjsWorker) {
    const s = document.createElement('script'); s.textContent = workerText(); document.head.appendChild(s); s.remove();
  }
  lib.GlobalWorkerOptions.workerPort = null;
  if (!lib.GlobalWorkerOptions.workerSrc) lib.GlobalWorkerOptions.workerSrc = 'pdf.worker.js';
}
async function openPdf(lib, buf) {
  const opt = data => ({ data, verbosity: 0, isEvalSupported: false, useSystemFonts: false, disableFontFace: true, disableAutoFetch: true, disableStream: true, disableRange: true, useWorkerFetch: false, enableXfa: false });
  const copy = buf.slice();
  const w = startWorker(lib);
  if (w) {
    const task = lib.getDocument(opt(buf));
    try {
      const doc = await Promise.race([task.promise, new Promise((_, rej) => setTimeout(() => rej(new Error('worker-timeout')), 12000)), new Promise((_, rej) => w.addEventListener('error', () => rej(new Error('worker-error'))))]);
      return { doc, close: () => { try { w.terminate(); URL.revokeObjectURL(w._url); } catch (e) { /* 무시 */ } lib.GlobalWorkerOptions.workerPort = null; } };
    } catch (e) {
      try { task.destroy(); } catch (e2) { /* 무시 */ }
      try { w.terminate(); URL.revokeObjectURL(w._url); } catch (e3) { /* 무시 */ }
      if (e && /Password|InvalidPDF|MissingPDF/.test(e.name || '')) throw e;
    }
  }
  inlineWorker(lib);
  const doc = await lib.getDocument(opt(copy)).promise;
  return { doc, close: () => { /* 이 화면 안에서 돌았으므로 따로 끌 것이 없다 */ } };
}

async function readCardPages(file, onProgress) {
  const lib = window.pdfjsLib;
  if (!lib) throw Object.assign(new Error('lib'), { code: 'lib' });
  const buf = new Uint8Array(await file.arrayBuffer());
  const { doc, close } = await openPdf(lib, buf);
  try {
    const pages = [];
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      pages.push(await Card.extractPage(lib, page, p));
      page.cleanup();
      onProgress(p, doc.numPages);
      if (p % 3 === 0) await new Promise(r => setTimeout(r, 0));
    }
    return pages;
  } finally { try { await doc.destroy(); } catch (e) { /* 무시 */ } close(); }
}

function friendlyError(err) {
  const n = (err && err.name) || '', c = err && err.code;
  if (/Password/.test(n)) return '암호가 걸린 PDF입니다. 암호를 풀어 저장한 파일로 다시 시도하세요.';
  if (/InvalidPDF|MissingPDF/.test(n)) return 'PDF 파일이 손상되었거나 PDF가 아닙니다.';
  if (c === 'lib') return 'PDF를 읽는 도구를 불러오지 못했습니다. 페이지를 새로 고친 뒤 다시 시도하세요.';
  if (c === 'empty') return '이 PDF에서 인사기록카드 표(연수이수·가산점·임용발령사항)를 찾지 못했습니다. NEIS ‘인사기록카드 출력’에서 ‘인사카드(전체)’로 저장한 PDF인지 확인하세요.';
  return 'PDF를 읽는 중 문제가 생겼습니다. NEIS에서 다시 저장한 PDF로 시도해 보세요.';
}

async function importPdf(file) {
  if (IMP.busy) return;
  IMP.busy = true;
  importProgress('PDF를 여는 중…', 0, 1);
  try {
    const pages = await readCardPages(file, (i, n) => importProgressTick(`${i} / ${n}쪽 읽는 중`, i, n));
    const parsed = Card.parse(pages);
    const res = CardMap.toState(parsed, { E, kind: state.profile.kind, baseDate: curBase() });
    if (!res.stats.training && !res.stats.bonusRows && !res.patch.career.length) throw Object.assign(new Error('empty'), { code: 'empty' });
    IMP.result = res;
    importReport(res, false);
  } catch (err) {
    importHome(friendlyError(err));
  } finally { IMP.busy = false; }
}

function importJsonDone(txt) {
  if (!importText(txt)) return;
  ui.cardImport = null;
  closeModal(); recompute(); renderBanner(); renderTab(); renderResult(); updateTabFlags(); toast('불러왔습니다');
}
async function importPick(file) {
  if (!file || IMP.busy) return;
  let head = '';
  try { head = String.fromCharCode.apply(null, new Uint8Array(await file.slice(0, 5).arrayBuffer())); } catch (e) { /* 아래에서 처리 */ }
  if (head === '%PDF-') { importPdf(file); return; }
  if (/\.json$/i.test(file.name || '') || head.charAt(0) === '{') {
    const rd = new FileReader();
    rd.onload = () => importJsonDone(String(rd.result || ''));
    rd.onerror = () => toast('파일을 읽지 못했습니다');
    rd.readAsText(file);
    return;
  }
  importHome('PDF(인사기록카드)나 이 앱에서 저장한 .json 파일을 골라 주세요.');
}

/* 읽은 내용 확인 창 */
function importReport(res, readOnly) {
  const rows = res.info.map(([k, v]) => `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${esc(v)}</span></div>`).join('');
  const warns = res.warn.length
    ? `<h3 class="imp-h">확인할 점 ${res.warn.length}건</h3><ol class="warns">${res.warn.map(w => `<li>${esc(w)}</li>`).join('')}</ol>`
    : '<p class="note">특별히 확인할 점은 없습니다.</p>';
  const notIn = '<p class="note">카드에 없어 채우지 않은 값: <b>근무성적</b>(근무성적 탭), 한국사능력검정 요건(기본 탭). 평정구분·평정기준일·근무성적·전망은 그대로 둡니다.</p>';
  const overwrite = !readOnly && !ui.sample && ui.dirty ? '<p class="note imp-err">지금 입력해 둔 경력·연수·연구·가산점은 이 내용으로 바뀝니다(가상(예정)으로 표시한 항목은 그대로 둡니다).</p>' : '';
  showModal(`<h2>${readOnly ? '카드에서 읽은 내용' : '인사기록카드에서 읽었습니다'}</h2>
    ${readOnly ? '' : '<p class="note">아래 내용으로 경력·연수·연구·가산점을 채웁니다. 읽은 PDF는 어디에도 저장되지 않았습니다.</p>'}
    <div class="kvs">${rows}</div>${warns}${notIn}${overwrite}
    <div class="btns">${readOnly ? '' : '<button type="button" class="btn" data-act="modal-close">취소</button>'}<button type="button" class="btn primary" data-act="${readOnly ? 'modal-close' : 'import-apply'}">${readOnly ? '닫기' : '이 내용으로 채우기'}</button></div>`);
}

function importApply() {
  const res = IMP.result; if (!res) { closeModal(); return; }
  const P = res.patch;
  if (ui.sample) {   // 예시(가상 인물) 값은 근무성적·전망까지 모두 걷어내고 카드 값만 남긴다
    const keep = { kind: state.profile.kind, baseDate: state.profile.baseDate };
    state = blankState(); state.profile.kind = keep.kind; state.profile.baseDate = keep.baseDate;
    state.training.qual.name = E.KINDS[keep.kind].qualName;
  }
  if (P.profile.firstQualDate) state.profile.firstQualDate = P.profile.firstQualDate;
  if (P.career.length) state.career = P.career;
  if (P.training.qual) state.training.qual = Object.assign({}, state.training.qual, P.training.qual);
  // 내가 넣어 둔 가상(예정) 항목은 카드를 다시 불러와도 그대로 남긴다
  const vC = state.training.courses.filter(isV), vK = (state.training.contests || []).filter(isV), vD = (state.training.degrees || []).filter(isV), vP = state.bonus.periods.filter(isV);
  state.training.courses = P.training.courses.concat(vC);
  state.training.contests = P.training.contests.concat(vK);
  state.training.degrees = P.training.degrees.concat(vD);
  state.bonus.periods = P.bonus.periods.concat(vP);
  state.bonus.yearHours = P.bonus.yearHours;
  state.bonus.violence = P.bonus.violence.slice().sort();
  state = normalizeState(state);
  ui.sample = false; ui.dirty = true;
  ui.cardImport = { info: res.info, warn: res.warn };
  IMP.result = null;
  closeModal(); recompute(); renderBanner(); renderTabs(); renderTab(); renderResult(); updateTabFlags();
  toast('카드 내용으로 채웠습니다. 근무성적을 입력하세요');
}
