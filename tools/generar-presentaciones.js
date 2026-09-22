'use strict';
/*
 * Generador de presentaciones por clase:
 *   - "Presentacion Clase N - Titulo.html"  (slides HTML autocontenido, navegables)
 *   - "Presentacion Clase N - Titulo.pptx"  (editable, con pptxgenjs)
 *   - "Presentacion Clase N - Titulo.pdf"   (impresion Chrome headless 16:9)
 *
 * Uso:
 *   node tools/generar-presentaciones.js
 *   node tools/generar-presentaciones.js --filtro asistente-clase-
 *   node tools/generar-presentaciones.js --spec file.json
 *
 * Contenido 100% de la spec (sin texto generado por IA): sin alucinacion.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const pptxgen = require('pptxgenjs');

const FIRMA = '@gustavokempe';
const SPEC_DIR = path.join(__dirname, 'especificaciones');
const CHROME =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const LOGO_ITC = path.join(__dirname, 'assets', 'logo-itc.svg');
const LOGO_UDEM = path.join(__dirname, 'assets', 'logo-udemm.svg');

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitize(s) {
  // eslint-disable-next-line no-control-regex
  return String(s).replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function parr(lines) {
  // pptxgenjs espera objetos de parrafo (no arrays de strings)
  return lines.map((l) => ({ text: l, options: { breakLine: true } }));
}

function textoSlide(t) {
  // Parrafos -> lineas + puntos -> viñetas; es el texto legal de la spec.
  const parts = [];
  if (t.parrafos) parts.push(...t.parrafos.map((p) => ({ t: p, bullet: false })));
  if (t.puntos) parts.push(...t.puntos.map((p) => ({ t: p, bullet: true })));
  return parts.slice(0, 12); // max 12 lineas por slide para que entre en 16:9
}

function imgsDeTeoria(c, t) {
  const out = [];
  const list = Array.isArray(t.imagenes) ? t.imagenes : t.imagen ? [t.imagen] : [];
  for (const it of list) {
    if (!it || !it.src) continue;
    const full = path.resolve(c.outputDir, it.src);
    if (fs.existsSync(full)) out.push(full);
  }
  return out;
}

// ---------------------------------------------------------------- slides HTML
function slidesHtml(c) {
  const brand = c.curso.color || '#0057ff';
  const slides = [];

  slides.push({ cls: 'portada', body: `
    <div class="slide-inner portada-inner">
      <div class="badge">${esc(c.curso.emoji)} ${esc(c.curso.nombre)}</div>
      <div class="mod">Clase ${esc(c.clase.numero)} · ${esc(c.clase.modulo || '')}</div>
      <h1>${esc(c.clase.titulo)}</h1>
      <p class="bajada">${esc(c.clase.bajada || '')}</p>
      <div class="meta">
        <span>⏱ ${esc(c.clase.duracion || '')}</span>
        <span>🎓 ${esc(c.clase.modalidad || '')}</span>
        ${c.clase.turno ? `<span>${esc(c.clase.turno)}</span>` : ''}
      </div>
    </div>` });

  slides.push({ cls: 'objetivos', title: '🎯 Objetivos de la clase', body: `
    <ul class="objs">${(c.objetivos || []).map((o) => `<li><span class="chk">✓</span>${esc(o)}</li>`).join('\n')}</ul>` });

  for (const t of c.teoria || []) {
    const lines = textoSlide(t);
    if (!lines.length) continue;
    const imgs = imgsDeTeoria(c, t);
    slides.push({
      cls: 'teoria',
      title: `${esc(t.emoji || '📘')} ${esc(t.titulo)}`,
      media: imgs.length ? `<div class="media"><img src="${imgs[0].split('\\').join('/')}" alt=""></div>` : '',
      body: `<ul class="pts">${lines.map((l) => `<li>${l.bullet ? '<b>·</b>' : ''} ${esc(l.t)}</li>`).join('\n')}</ul>`
    });
  }

  for (const e of c.ejercicios || []) {
    slides.push({
      cls: 'ejercicio',
      title: '🙌 Actividad práctica',
      body: `
        <div class="ej-titulo">${esc(e.titulo || c.clase.titulo)}</div>
        <p class="consigna">${esc(e.consigna)}</p>
        ${(e.pasos || []).length ? `<ol class="pasos">${e.pasos.map((p) => `<li>${esc(p)}</li>`).join('\n')}</ol>` : ''}
        ${e.entrega ? `<p class="entrega"><b>Entrega:</b> ${esc(e.entrega)}</p>` : ''}`
    });
  }

  if (c.entrega) {
    slides.push({ cls: 'entrega', title: '📤 Entrega', body: `<p class="consigna">${esc(c.entrega)}</p>` });
  }

  const show = slides
    .map(
      (s, i) => `<section class="slide ${s.cls}" data-i="${i}">
    ${s.title ? `<header><h2>${s.title}</h2></header>` : ''}
    <div class="cuerpo">${s.media || ''}${s.body}</div>
    <footer class="firma">Hecho con dedicación · ${esc(FIRMA)}</footer>
  </section>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Presentación Clase ${esc(c.clase.numero)} - ${esc(c.clase.titulo)}</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;height:100%}
  body{font-family:'Segoe UI',Roboto,Arial,sans-serif;background:#11142a;color:#eef1fb;}
  .deck{width:100%;height:100%;}
  .slide{display:none;position:relative;width:100vw;height:100vh;padding:5vh 7vw;
         background:radial-gradient(1200px 600px at 20% -10%, ${brand}33, transparent 55%),linear-gradient(160deg,#171b3a 0%,#10142c 70%);}
  .slide.activa{display:flex;flex-direction:column;animation:fade .25s ease}
  @keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
  header h2{font-size:clamp(20px,3.2vw,34px);color:#fff;margin:0 0 2vh}
  .cuerpo{flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0}
  h1{font-size:clamp(30px,5.2vw,60px);line-height:1.06;color:#fff;margin:1.5vh 0;font-weight:800}
  .badge{display:inline-block;font-size:13px;font-weight:700;color:${brand};background:${brand}22;border:1px solid ${brand}55;border-radius:999px;padding:6px 14px;margin-bottom:12px}
  .mod{font-size:15px;color:#9aa4c8;font-weight:600}
  .bajada{font-size:clamp(15px,2vw,20px);color:#c6cdef;max-width:60ch;line-height:1.55;margin:2.5vh 0}
  .meta{display:flex;gap:10px;flex-wrap:wrap;margin-top:3vh}
  .meta span{background:${brand}18;border:1px solid ${brand}44;color:#dfe6ff;border-radius:999px;padding:7px 14px;font-size:13px}
  .objs{list-style:none;margin:0;padding:0;font-size:clamp(15px,1.9vw,20px);line-height:1.6}
  .objs li{display:flex;gap:12px;align-items:baseline;padding:7px 0;color:#dde3fb}
  .objs .chk{color:${brand};font-weight:800}
  .pts{list-style:none;margin:0;padding:0;font-size:clamp(14px,1.7vw,19px);line-height:1.55;color:#dde3fb}
  .pts li{display:flex;gap:10px;padding:6px 0;align-items:baseline}
  .pts b{color:${brand};flex:none}
  .teoria .cuerpo{flex-direction:row;gap:3vw;align-items:center}
  .teoria .pts{flex:1}
  .media{flex:0 0 34%;text-align:center}
  .media img{max-width:100%;max-height:62vh;border-radius:14px;border:1px solid ${brand}44;box-shadow:0 12px 40px rgba(0,0,0,.45)}
  .ej-titulo{font-size:clamp(17px,2.2vw,24px);font-weight:700;color:${brand};margin-bottom:1.2vh}
  .consigna{font-size:clamp(14px,1.8vw,19px);color:#e6ebff;line-height:1.55;margin:0}
  .pasos{font-size:clamp(13px,1.6vw,17px);color:#dde3fb;line-height:1.5;padding-left:20px;margin-top:1.5vh}
  .pasos li{margin-bottom:5px}
  .entrega{font-size:clamp(14px,1.8vw,18px);color:#c6cdef}
  .firma{position:absolute;bottom:2.2vh;right:3vw;font-size:12px;color:#6d78a3}
  .nav{position:fixed;bottom:2.2vh;left:0;right:0;display:flex;justify-content:center;gap:14px;z-index:5}
  .nav button{background:${brand};border:0;color:#fff;font-size:16px;font-weight:700;border-radius:999px;padding:9px 18px;cursor:pointer;opacity:.92}
  .nav button:hover{opacity:1}
  .nav .ctr{color:#fff;font-size:13px;align-self:center;min-width:60px;text-align:center}
  @media print{
    @page{size:13.333in 7.5in;margin:0}
    body{background:none}
    .slide{display:flex !important;page-break-after:always;width:13.333in;height:7.5in;padding:4vh 5vw;}
    .slide:not(.activa){display:flex !important}
    .slide:last-of-type{page-break-after:auto}
    .nav{display:none}
    .firma{position:absolute;bottom:2vh;right:2vw}
  }
</style></head>
<body>
  <div class="deck">
    ${show}
  </div>
  <div class="nav">
    <button onclick="pd(-1)">←</button>
    <span class="ctr" id="ctr">1 / ${slides.length}</span>
    <button onclick="pd(1)">→</button>
  </div>
<script>
let i=0,total=${slides.length};
function show(){document.querySelectorAll('.slide').forEach((s,n)=>s.classList.toggle('activa',n===i));
  document.getElementById('ctr').textContent=(i+1)+' / '+total;}
function pd(d){i=(i+d+total)%total;show();}
document.addEventListener('keydown',e=>{if(e.key==='ArrowRight'||e.key===' ')pd(1);if(e.key==='ArrowLeft')pd(-1);
  if(e.key==='Home'){i=0;show();} if(e.key==='End'){i=total-1;show();}});
const m=(location.hash||'').match(/^#(\d+)$/); const q=new URLSearchParams(location.search).get('s');
if(m){i=Math.min(+m[1]-1,total-1);} if(q){i=Math.min(+q-1,total-1);}
show();
</script>
</body></html>`;
}

// ---------------------------------------------------------------- PPTX
async function generarPptx(c, outPptx) {
  const prs = new pptxgen();
  prs.layout = 'LAYOUT_16x9';
  prs.author = FIRMA;
  prs.title = `Presentación ${c.clase.titulo}`;
  const brand = c.curso.color || '#0057ff';
  const F = 'Calibri';

  // slide 0: portada
  const s0 = prs.addSlide();
  s0.background = { color: brand };
  s0.addText(c.curso.emoji + ' ' + c.curso.nombre, { x: 0.5, y: 0.45, w: 9, h: 0.5, fontSize: 14, color: 'FFFFFF', bold: true });
  s0.addText('Clase ' + c.clase.numero + ' · ' + (c.clase.modulo || ''), { x: 0.5, y: 1.0, w: 9, h: 0.4, fontSize: 12, color: 'E8EBF5' });
  s0.addText(c.clase.titulo, { x: 0.5, y: 1.8, w: 9.5, h: 1.6, fontSize: 34, bold: true, color: 'FFFFFF', fontFace: F });
  if (c.clase.bajada) s0.addText(c.clase.bajada, { x: 0.5, y: 3.6, w: 9, h: 1.2, fontSize: 15, color: 'E8EBF5' });
  s0.addText('Hecho con dedicación · ' + FIRMA, { x: 0.5, y: 4.9, w: 9, h: 0.3, fontSize: 10, color: 'C9D2F5' });
  s0.addText('⏱ ' + (c.clase.duracion || '') + '   🎓 ' + (c.clase.modalidad || ''), { x: 0.5, y: 4.5, w: 9, h: 0.3, fontSize: 11, color: 'E8EBF5' });

  // objetivos
  const s1 = prs.addSlide();
  s1.background = { color: 'FFFFFF' };
  s1.addText('🎯 Objetivos de la clase', { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 20, bold: true, color: brand });
  s1.addText(parr((c.objetivos || []).map((o) => '• ' + o)), { x: 0.5, y: 1.2, w: 9.5, h: 3.4, fontSize: 15, color: '33395C', valign: 'top' });
  s1.addText('Hecho con dedicación · ' + FIRMA, { x: 0.5, y: 5.1, w: 9, h: 0.25, fontSize: 9, color: '9AA0C0' });

  // teoria: una slide por seccion
  for (const t of c.teoria || []) {
    const lines = textoSlide(t);
    if (!lines.length) continue;
    const s = prs.addSlide();
    s.background = { color: 'FFFFFF' };
    s.addShape('rect', { x: 0, y: 0, w: 10, h: 0.2, fill: { color: brand } });
    s.addText(`${t.emoji || '📘'} ${t.titulo}`, { x: 0.5, y: 0.4, w: 9, h: 0.6, fontSize: 20, bold: true, color: brand });
    const imgs = imgsDeTeoria(c, t);
    if (imgs.length) {
      s.addText(parr(lines.map((l) => (l.bullet ? '• ' : '') + l.t)), { x: 0.5, y: 1.15, w: 5.4, h: 3.7, fontSize: 14, color: '33395C', valign: 'top' });
      s.addImage({ path: imgs[0], x: 6.2, y: 1.15, w: 3.3, h: 3.7, sizing: { type: 'contain', w: 3.3, h: 3.7 } });
    } else {
      s.addText(parr(lines.map((l) => (l.bullet ? '• ' : '') + l.t)), { x: 0.5, y: 1.15, w: 9, h: 3.7, fontSize: 15, color: '33395C', valign: 'top' });
    }
    s.addText('Hecho con dedicación · ' + FIRMA, { x: 0.5, y: 5.1, w: 9, h: 0.25, fontSize: 9, color: '9AA0C0' });
  }

  // ejercicios
  for (const e of c.ejercicios || []) {
    const s = prs.addSlide();
    s.background = { color: 'FFF7EC' };
    s.addText('🙌 Actividad práctica', { x: 0.5, y: 0.4, w: 9, h: 0.5, fontSize: 20, bold: true, color: brand });
    s.addText(e.titulo || c.clase.titulo, { x: 0.5, y: 1.0, w: 9, h: 0.4, fontSize: 15, bold: true, color: '33395C' });
    const block = [];
    block.push('Consigna: ' + e.consigna);
    (e.pasos || []).forEach((p, j) => block.push(`${j + 1}. ${p}`));
    if (e.entrega) block.push('Entrega: ' + e.entrega);
    s.addText(parr(block), { x: 0.5, y: 1.6, w: 9, h: 3.3, fontSize: 13, color: '33395C', valign: 'top' });
    s.addText('Hecho con dedicación · ' + FIRMA, { x: 0.5, y: 5.1, w: 9, h: 0.25, fontSize: 9, color: 'B0895C' });
  }

  if (c.entrega) {
    const s = prs.addSlide();
    s.background = { color: 'FFFFFF' };
    s.addText('📤 Entrega', { x: 0.5, y: 0.4, w: 9, h: 0.5, fontSize: 20, bold: true, color: brand });
    s.addText(c.entrega, { x: 0.5, y: 1.3, w: 9, h: 1.5, fontSize: 16, color: '33395C' });
    s.addText('Hecho con dedicación · ' + FIRMA, { x: 0.5, y: 5.1, w: 9, h: 0.25, fontSize: 9, color: '9AA0C0' });
  }

  await prs.writeFile({ fileName: outPptx });
}

// ---------------------------------------------------------------- PDF 16:9
function renderPdf16(htmlString, outPdf) {
  const tmp = path.join(require('os').tmpdir(), `pres-${Date.now()}.html`);
  fs.writeFileSync(tmp, htmlString, 'utf8');
  const url = 'file:///' + tmp.replace(/\\/g, '/');
  const args = [
    CHROME, '--headless=new', '--disable-gpu', '--no-sandbox',
    `--print-to-pdf=${outPdf}`, '--no-pdf-header-footer', '--print-to-pdf-no-header',
    '--print-to-pdf-css-media-type=print', url
  ].map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ');
  try {
    execSync(args, { stdio: 'pipe', timeout: 60000 });
  } catch (e) {
    console.error('  [error pdf]', e.message.trim().split('\n')[0]);
    return false;
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  return fs.existsSync(outPdf);
}

// ---------------------------------------------------------------- main
async function main() {
  const argv = process.argv.slice(2);
  const flag = (f) => {
    const i = argv.indexOf(f);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
  };

  let specs;
  if (flag('--spec')) {
    specs = [JSON.parse(fs.readFileSync(flag('--spec'), 'utf8'))];
  } else {
    if (!fs.existsSync(SPEC_DIR)) { console.error('No existe especificaciones/'); process.exit(1); }
    specs = fs
      .readdirSync(SPEC_DIR)
      .filter((f) => f.endsWith('.json'))
      .filter((f) => !flag('--filtro') || f.startsWith(flag('--filtro')))
      .map((f) => JSON.parse(fs.readFileSync(path.join(SPEC_DIR, f), 'utf8')));
  }

  for (const c of specs) {
    if (!c.outputDir) { console.error('  [skip] falta outputDir'); continue; }
    fs.mkdirSync(c.outputDir, { recursive: true });
    const base = `Presentacion Clase ${c.clase.numero} - ${sanitize(c.clase.titulo)}`;
    const outHtml = path.join(c.outputDir, `${base}.html`);
    const outPptx = path.join(c.outputDir, `${base}.pptx`);
    const outPdf = path.join(c.outputDir, `${base}.pdf`);

    console.log(`\n=== ${c.curso.nombre} | Clase ${c.clase.numero} — ${c.clase.titulo}`);

    const html = slidesHtml(c);
    fs.writeFileSync(outHtml, html, 'utf8');
    console.log(`  [html] ${outHtml}`);

    if (renderPdf16(html, outPdf)) console.log(`  [pdf] ${outPdf}`);
    else console.log('  [pdf] FALLO');

    try {
      await generarPptx(c, outPptx);
      console.log(`  [pptx] ${outPptx}`);
    } catch (e) {
      console.log('  [pptx] FALLO:', e.message.split('\n')[0]);
    }
  }
}

if (require.main === module) main().catch((e) => { console.error(e); process.exit(1); });

module.exports = { slidesHtml, generarPptx, renderPdf16 };