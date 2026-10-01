// src/* → index.html 한 파일로 묶는다(외부 글꼴·스크립트·통신 없음, pdf.js 포함, 보안 정책 CSP 포함).
// usage: node build.js
const fs = require('fs');
const path = require('path');
const R = f => fs.readFileSync(path.join(__dirname, 'src', f), 'utf8').replace(/^﻿/, '');
const V = f => fs.readFileSync(path.join(__dirname, 'vendor', f), 'utf8').replace(/^﻿/, '').replace(/\n?\/\/# sourceMappingURL=.*$/m, '');

const engine = R('engine.js');
const cardLib = R('card.js') + '\n' + R('card-map.js');
const app = ['app-core.js', 'app-tabs.js', 'app-result.js', 'app-import.js', 'app-main.js'].map(R).join('\n');
const css = R('style.css');
const body = R('body.html');
const pdfLib = V('pdf.min.js');
const pdfWorker = V('pdf.worker.min.js');
for (const [n, t] of [['pdf.min.js', pdfLib], ['pdf.worker.min.js', pdfWorker], ['card', cardLib], ['engine', engine], ['app', app]]) {
  if (/<\/script/i.test(t) || /<!--/.test(t)) throw new Error(n + ' 에 HTML 을 깨는 문자열이 있습니다');
}

// 브라우저가 이 페이지에서 바깥으로 아무것도 보내지 못하게 막는다
const CSP = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src 'none'; connect-src 'none'; worker-src blob:; frame-src 'none'; object-src 'none'; media-src 'none'; form-action 'none'; base-uri 'none'";
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<meta name="referrer" content="no-referrer">
<title>승진점수 계산기</title>
<style>
${css}
</style>
</head>
<body>
${body}
<script>
${pdfLib}
</script>
<script type="text/plain" id="pdf-worker-src">
${pdfWorker}
</script>
<script>
${engine}
</script>
<script>
${cardLib}
</script>
<script>
(function () {
'use strict';
${app}
})();
</script>
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, 'index.html'), html, 'utf8');
console.log('built index.html', (html.length / 1024).toFixed(0) + 'KB');
