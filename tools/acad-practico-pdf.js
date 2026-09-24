#!/usr/bin/env node
/* Genera el PDF del práctico de AutoCAD embebiendo capturas reales (base64 → HTML → Chrome). */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const CHROME = fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
  ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  : 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe';

function main() {
  const cfgPath = process.argv[2];
  if (!cfgPath) { console.error('uso: node acad-practico-pdf.js <config.json>'); process.exit(1); }
  const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  const { outPdf, title, subtitle, consigna, figures } = cfg;

  const figHtml = (figures || [])
    .map((f, i) => {
      const b64 = fs.readFileSync(f.img, 'base64');
      return `
      <div class="fig-card">
        <img src="data:image/jpeg;base64,${b64}" alt="Figura ${i + 1}"/>
        <div class="fig-cap">${f.caption || `Figura ${i + 1}`}</div>
      </div>`;
    })
    .join('\n');

  const consignaHtml = (Array.isArray(consigna) ? consigna : String(consigna).split('\n'))
    .filter(Boolean)
    .map((l) => `<li>${l}</li>`)
    .join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/>
<style>
  @page { size: A4; margin: 14mm; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; margin: 0; }
  h1 { font-size: 18pt; margin: 0 0 2pt 0; }
  .sub { color: #444; font-size: 10pt; margin-bottom: 10pt; }
  .consigna-title { font-weight: 700; margin: 8pt 0 4pt 0; font-size: 11pt; text-transform: uppercase; letter-spacing: .4px; }
  ul.consigna { margin: 0 0 10pt 0; padding-left: 16pt; font-size: 10pt; }
  ul.consigna li { margin-bottom: 3pt; }
  .fig-card { page-break-inside: avoid; margin-bottom: 10pt; background: #fff; border: 1px solid #ddd; padding: 6pt; border-radius: 4pt; }
  .fig-card img { width: 100%; display: block; }
  .fig-cap { font-size: 9pt; color: #555; margin-top: 4pt; text-align: center; }
</style></head><body>
  <h1>${title}</h1>
  <div class="sub">${subtitle || ''}</div>
  <div class="consigna-title">Consigna del práctico</div>
  <ul class="consigna">${consignaHtml}</ul>
  ${figHtml}
</body></html>`;

  const tmp = path.join(os.tmpdir(), `practico-${Date.now()}.html`);
  fs.writeFileSync(tmp, html, 'utf8');
  const url = 'file:///' + tmp.replace(/\\/g, '/');
  const args = [
    CHROME, '--headless=new', '--disable-gpu', '--no-sandbox',
    `--print-to-pdf=${outPdf}`, '--no-pdf-header-footer', '--print-to-pdf-no-header', url
  ];
  const q = args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ');
  try {
    execSync(q, { stdio: 'pipe', timeout: 60000 });
  } catch (e) {
    console.error('  [error pdf]', e.message.trim().split('\n')[0]);
    process.exit(1);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  if (!fs.existsSync(outPdf)) { console.error('  [error pdf] no se generó'); process.exit(1); }
  console.log(`pdf ok: ${Math.round(fs.statSync(outPdf).size / 1024)} KB`);
}
main();