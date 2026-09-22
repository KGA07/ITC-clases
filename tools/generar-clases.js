'use strict';
/*
 * Generador de "Clase N - Titulo.pdf" (teoria + practica) y de interactivo
 * HTML de ejercicios a partir de una especificación JSON por clase.
 *
 * Uso:
 *   node tools/generar-clases.js                     # procesa tools/especificaciones/*.json
 *   node tools/generar-clases.js --spec file.json    # procesa una sola
 *   node tools/generar-clases.js --pdf "out.pdf" --html "out.html" --spec file.json
 *
 * El PDF se produce imprimiendo el HTML renderizado con Chrome headless
 * (CHROME_PATH o ruta por defecto de Windows).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Firma del autor que se inserta como pie de pagina en todo material generado.
const FIRMA = '@gustavokempe';

function footerHtml() {
  return `<footer class="firma">Hecho con dedicacion · ${esc(FIRMA)}</footer>`;
}

const SPEC_DIR = path.join(__dirname, 'especificaciones');
const CHROME =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// ---------------------------------------------------------------- helpers
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Renderiza una figura (imagen única centrada) o una grilla de imágenes.
// Soporta t.imagen = {src, alt, caption} y t.imagenes = [ {...}, ... ].
function imgSeccion(c, imgObj) {
  const list = Array.isArray(imgObj) ? imgObj : imgObj ? [imgObj] : null;
  if (!list || !list.length) return '';
  const fig = (it) => {
    if (!it || !it.src) return '';
    const ext = String(it.src).split('.').pop().toLowerCase();
    let full = path.resolve(c.outputDir, it.src);
    if (!fs.existsSync(full)) return '';
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : 'png'}`;
    const inner = ext === 'svg'
      ? `<img class="secc-img" src="data:image/svg+xml;utf8,${encodeURIComponent(fs.readFileSync(full, 'utf8'))}" alt="${esc(it.alt || '')}">`
      : `<img class="secc-img" src="data:${mime};base64,${fs.readFileSync(full).toString('base64')}" alt="${esc(it.alt || '')}">`;
    return `<figure class="fig-secc ${it.caption ? '' : 'fig-solo'}">${inner}${it.caption ? `<figcaption>${esc(it.caption)}</figcaption>` : ''}</figure>`;
  };
  if (list.length === 1) return fig(list[0]);
  return `<div class="fig-grid">${list.map(fig).join('\n')}</div>`;
}

// Renderiza las secciones de teoría (compartido entre el PDF de clase y la lectura).
function teoriaHtml(c) {
  return (c.teoria || [])
    .map(
      (t) => `
    <section class="teoria">
      <h2><span class="burb">${esc(t.emoji || '📘')}</span>${esc(t.titulo)}</h2>
      ${t.parrafos ? t.parrafos.map((p) => `<p>${esc(p)}</p>`).join('\n') : ''}
      ${imgSeccion(c, t.imagen || t.imagenes)}
      ${t.puntos ? `<ul>${t.puntos.map((p) => `<li>${esc(p)}</li>`).join('\n')}</ul>` : ''}
    </section>`
    )
    .join('\n');
}

function html(src) {
  const logoSrc = {
    itc: path.join(__dirname, 'assets', 'logo-itc.svg'),
    udemm: path.join(__dirname, 'assets', 'logo-udemm.svg')
  };
  // Reemplaza /logo-itc y /logo-udemm por el SVG crudo (inline), que imprime
  // de forma confiable en Chrome (mas seguro que img base64).
  for (const key of Object.keys(logoSrc)) {
    const srcKey = `{{logo-${key}}}`;
    while (src.includes(srcKey)) {
      try {
        const svg = fs.readFileSync(logoSrc[key], 'utf8');
        src = src.replace(srcKey, svg.replace(/width="[^"]*"/, 'width="auto"').replace(/height="[^"]*"/, 'height="100%"'));
      } catch {
        src = src.replace(srcKey, '');
      }
    }
  }
  return src;
}

function fmtSize(mb) {
  return typeof mb === 'number' ? `${mb} MB` : String(mb || '');
}

function renderPortada(c) {
  return `<div class="portada"><div class="deco deco-a"></div><div class="deco deco-b"></div>
     <div class="portada-inner">
       <div class="logos"><div class="logo-itc">{{logo-itc}}</div><div class="spacer"></div><div class="logo-udemm">{{logo-udemm}}</div></div>
       <div class="hero">
         <div class="badge">${esc(c.curso.emoji)} ${esc(c.curso.nombre)}</div>
         <div class="modulo">Clase ${esc(c.clase.numero)} · ${esc(c.clase.modulo || '')}</div>
         <h1 class="clase-titulo">${esc(c.clase.titulo)}</h1>
         <p class="clase-bajada">${esc(c.clase.bajada || 'En esta clase vas a sumar herramientas concretas para tu trabajo.')}</p>
       </div>
       <div class="meta">
         <div><span>⏱ Duración</span><b>${esc(c.clase.duracion || '1h 30min')}</b></div>
         <div><span>🎓 Modalidad</span><b>${esc(c.clase.modalidad || 'Teórico-Práctica')}</b></div>
         ${c.clase.materiales ? `<div><span>🧰 Materiales</span><b>${esc(c.clase.materiales)}</b></div>` : ''}
       </div>
       <div class="portada-pies">
         <span><b>¿Qué llevás de esta clase?</b> ${esc(c.curso.emoji)} ${esc(c.curso.nombre)} · ${esc(c.clase.titulo)}</span>
         <span>${esc(c.clase.turno || '')}</span>
       </div>
     </div></div>`;
}

// ---------------------------------------------------------------- template
function claseCss(c) {
  const brand = c.curso.color || '#0057ff';
  return `
    :root { --brand: ${brand}; --brand-soft: ${brand}1a; }
    * { box-sizing: border-box; }
    body { margin:0; font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#23263a;
           -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .pagina { max-width:880px; margin:0 auto; padding:26px 40px 50px; }
    .portada { page-break-after:always; position:relative; min-height:96vh; display:flex; align-items:center;
               overflow:hidden; }
    .portada::before { content:''; position:absolute; inset:0; background:linear-gradient(160deg,#fff 0%,#f2f6ff 55%,#e6edff 100%); }
    .deco { position:absolute; border-radius:50%; filter:blur(2px); }
    .deco-a { width:420px; height:420px; background:var(--brand-soft); top:-140px; right:-120px; }
    .deco-b { width:300px; height:300px; background:var(--brand-soft); bottom:-120px; left:-100px; }
    .portada-inner { position:relative; width:100%; z-index:1; }
    .logos { display:flex; align-items:center; margin:0 8px 46px; }
    .logo-itc svg { height:58px; width:auto; }
    .logo-udemm svg { height:40px; width:auto; opacity:.92; }
    .logos .spacer { flex:1; }
    .hero { padding:0 8px; }
    .badge { display:inline-block; font-size:13px; font-weight:700; color:var(--brand);
             background:var(--brand-soft); border:1px solid ${brand}33;
             border-radius:999px; padding:6px 14px; margin-bottom:16px; }
    .modulo { font-size:14px; font-weight:600; color:#5a6590; margin-bottom:8px; }
    .clase-titulo { font-size:46px; font-weight:800; line-height:1.08; color:#11132b; margin:0 0 16px; }
    .clase-bajada { font-size:17px; line-height:1.5; color:#46506c; max-width:640px; margin:0 0 34px; }
    .meta { display:flex; gap:14px; }
    .meta > div { flex:1; min-width:0; background:rgba(255,255,255,.9); border:1px solid #e2e8f8;
                  border-radius:16px; padding:18px 20px; box-shadow:0 6px 18px rgba(24,52,120,.06); }
    .meta span { display:block; font-size:12px; color:#6b769c; margin-bottom:6px; }
    .meta b { font-size:16px; color:#11132b; }
    .portada-pies { display:flex; justify-content:space-between; align-items:center; margin-top:40px;
                    padding-top:18px; border-top:1px solid #dbe4f5; font-size:12px; color:#7b86ac; }
    .portada-pies b { color:#46506c; }
    h1 { font-size:24px; color:#11132b; margin:20px 0 6px; font-weight:800; }
    .mini { display:block; font-size:13px; font-weight:700; color:var(--brand); margin-bottom:6px; }
    h2 { font-size:18px; color:#11132b; margin:26px 0 10px; display:flex; align-items:center; gap:12px; }
    h2 .burb { width:36px; height:36px; border-radius:11px; background:var(--brand); color:#fff;
               display:inline-flex; align-items:center; justify-content:center; font-size:17px; flex:none; }
    .objetivos { background:#f5f7fe; border:1px solid #e6eaf8; border-radius:16px; padding:20px 24px; }
    .objetivos ul { list-style:none; margin:8px 0 0; padding:0; }
    .objetivos li { padding:5px 0; display:flex; gap:10px; align-items:baseline; }
    .objetivos .chk { color:var(--brand); font-weight:700; }
    .teoria p { line-height:1.66; color:#3a4060; }
    .teoria ul { line-height:1.66; color:#3a4060; padding-left:22px; }
    .teoria ul li { margin-bottom:5px; }
    .teoria ul li::marker { color:var(--brand); }
    .ejercicio { background:#fff7ec; border:1px solid #f7e6c9; border-left:6px solid var(--brand);
                 border-radius:16px; padding:20px 24px; margin:20px 0; page-break-inside:avoid; }
    .ej-head { display:flex; align-items:center; gap:10px; font-size:14px; font-weight:700; color:var(--brand);
               margin-bottom:12px; }
    .ej-head .num { width:28px; height:28px; border-radius:9px; background:var(--brand); color:#fff;
                    display:inline-flex; align-items:center; justify-content:center; font-size:14px; }
    .consigna { font-weight:600; color:#2c3150; }
    .pasos { line-height:1.66; color:#3a4060; padding-left:22px; }
    .pasos li { margin-bottom:5px; }
    .pasos li::marker { color:var(--brand); font-weight:700; }
    .entrega-label { font-size:13px; color:#8a4b00; margin:12px 0 0; }
    .tip { margin-top:14px; font-size:13px; color:#7a4400; background:#fff1de; border-radius:10px; padding:10px 14px; }
    .interativo-head { font-size:14px; color:var(--brand); font-weight:600; }
    .aviso { background:#ffeef0; border:1px solid #ffd2d6; border-left:6px solid #e5484d; border-radius:14px;
             padding:14px 18px; margin:18px 0; font-size:14px; color:#7a1f24; }
    .plan { width:100%; border-collapse:collapse; margin:14px 0; }
    .plan th,.plan td { text-align:left; padding:10px 14px; border:1px solid #e6eaf8; font-size:14px; }
    .plan th { background:#f5f7fe; color:#11132b; font-size:13px; text-transform:uppercase; letter-spacing:.03em; }
    .plan td.min { white-space:nowrap; font-weight:700; color:var(--brand); }
    .guia { background:#f0f7ff; border:1px solid #d9e9fb; border-left:6px solid var(--brand); border-radius:14px;
            padding:16px 20px; margin:14px 0; }
    .guia b { color:#11132b; }
    .guia ul { margin:8px 0 0; padding-left:20px; line-height:1.6; color:#2c3550; }
    .guia ul li { margin-bottom:5px; }
    .check-titulo { font-size:14px; font-weight:700; color:var(--brand); margin:16px 0 6px; }
    .card-lectura { background:#f0f7ff; border:1px solid #d9e9fb; border-radius:16px; padding:18px 22px; margin:22px 0;
                     page-break-inside:avoid; }
    .teoria img { max-width:100%; }
    .fig-secc { margin:16px 0; page-break-inside:avoid; }
    .fig-secc .secc-img { width:100%; max-width:480px; display:block; margin:0 auto; border-radius:14px;
                          border:1px solid #e2e8f8; box-shadow:0 6px 18px rgba(24,52,120,.08); }
    .fig-secc figcaption { text-align:center; font-size:12px; color:#6b769c; margin-top:8px; }
    .fig-grid { display:flex; gap:14px; flex-wrap:wrap; margin:16px 0; }
    .fig-grid .fig-secc { flex:1 1 130px; min-width:120px; margin:0; }
    .fig-grid .secc-img { width:100%; max-width:none; }
    footer.firma { margin-top:34px; padding-top:12px; border-top:1px solid #e2e8f8;
                   text-align:center; font-size:12px; color:#7b86ac; page-break-inside:avoid; }
  `;
}

function renderClaseHtml(c, { paraPdf }) {
  const obj = c.objetivos || [];
  const teoria = c.teoria || [];
  const ejercicios = c.ejercicios || [];
  const entrega = c.entrega || '';

  const objetivosHtml = obj
    .map((o) => `<li><span class="chk">✓</span>${esc(o)}</li>`)
    .join('\n');

  const teoriaTxt = teoriaHtml(c);

  const ejHtml = ejercicios
    .map((e, i) => {
      const pasos = (e.pasos || []).map((p, j) => `<li>${esc(p)}</li>`).join('\n');
      const tip = e.tip
        ? `<div class="tip"><b>Ayuda: </b>${esc(e.tip)}</div>`
        : '';
      const entregaE = e.entrega
        ? `<p class="entrega-label">${esc(e.entrega)}</p>`
        : '';
      return `
      <section class="ejercicio">
        <div class="ej-head"><span>Ejercicio ${i + 1}</span><b>${esc(e.titulo || c.clase.titulo)}</b></div>
        <p class="consigna">${esc(e.consigna)}</p>
        <ol class="pasos">${pasos}</ol>
        ${entregaE}
        ${tip}
      </section>`;
    })
    .join('\n');

  const portadaBg = paraPdf ? renderPortada(c) : `${c.curso.emoji} ${esc(c.curso.nombre)} · Clase ${esc(c.clase.numero)}: ${esc(c.clase.titulo)}`;

  const portada = paraPdf ? portadaBg : `<p class="interativo-head">${c.curso.emoji} ${esc(c.curso.nombre)} — Clase ${esc(c.clase.numero)}: ${esc(c.clase.titulo)}</p>`;

  const css = claseCss(c);
  const tipo = c.clase.tipo || 'clase';
  return html(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Clase ${esc(c.clase.numero)} - ${esc(c.clase.titulo)}</title>
<style>${css}</style></head>
<body>
  <div class="pagina">
    ${portada}
    <section class="objetivos">
      <h2><span class="burb">🎯</span><span><span class="mini">Vamos a aprender</span>Objetivos de la clase</span></h2>
      <ul>${objetivosHtml}</ul>
    </section>
    ${teoriaTxt}
    ${ejercicios.length ? `<h1><span class="mini">Manos a la obra 🙌</span>Actividad práctica</h1>${ejHtml}` : ''}
    ${entrega ? `<section class="ejercicio"><p class="consigna">Entrega</p><p>${esc(entrega)}</p></section>` : ''}
    ${footerHtml()}
  </div>
</body></html>`);
}

// ---------------------------------------------------------------- lectura (auto)
function renderLecturaHtml(c) {
  const objetivosHtml = (c.objetivos || [])
    .map((o) => `<li><span class="chk">✓</span><span>${esc(o)}</span></li>`)
    .join('\n');
  const teoriaLectura = teoriaHtml(c);
  const enVivo = c.enEnVivo || null;
  const lectura = c.lectura || null;

  return html(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Lectura Clase ${esc(c.clase.numero)} - ${esc(c.clase.titulo)}</title>
<style>${claseCss(c)}</style></head>
<body>
  <div class="pagina">
    ${renderPortada(c)}
    <h1><span class="mini">📖 Material de lectura</span>Lo esencial de la clase</h1>
    <section class="objetivos">
      <h2><span class="burb">🎯</span><span><span class="mini">Vamos a aprender</span>Objetivos de la clase</span></h2>
      <ul>${objetivosHtml}</ul>
    </section>
    ${teoriaLectura}
    ${lectura ? `<section class="card-lectura">
      <h2><span class="burb">📌</span>Para cerrar y llevar</h2>
      <p>${esc(lectura)}</p>
    </section>` : ''}
    ${enVivo ? `<section class="card-lectura">
      <h2><span class="burb">🛠️</span>Cierre en vivo</h2>
      <p>${esc(enVivo)}</p>
    </section>` : ''}
    ${footerHtml()}
  </div>
</body></html>`);
}

// ---------------------------------------------------------------- guía docente
function renderGuiaHtml(c) {
  const plan = (c.guiaDocente && c.guiaDocente.plan) || [];
  const aclarar = (c.guiaDocente && c.guiaDocente.aclarar) || [];
  const ejemplos = (c.guiaDocente && c.guiaDocente.ejemplos) || [];
  const conecta = (c.guiaDocente && c.guiaDocente.conecta) || [];
  const objetivosHtml = (c.objetivos || [])
    .map((o) => `<li>${esc(o)}</li>`)
    .join('\n');
  const planRows = plan
    .map(
      (p, i) => `<tr><td class="min">${i + 1}</td><td>${esc(p.titulo)}</td><td>${esc(p.que)}</td><td class="min">${esc(p.min)}</td></tr>`
    )
    .join('\n');

  return html(`<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><title>Guía docente Clase ${esc(c.clase.numero)} - ${esc(c.clase.titulo)}</title>
<style>${claseCss(c)}</style></head>
<body>
  <div class="pagina">
    <div class="logos" style="margin-bottom:26px"><div class="logo-itc">{{logo-itc}}</div><div class="spacer"></div><div class="logo-udemm">{{logo-udemm}}</div></div>
    <h1><span class="mini">🧑‍🏫 Guía del docente</span>${esc(c.clase.titulo)}</h1>
    <p style="color:#5a6590;margin:0 0 18px">${esc(c.curso.nombre)} · Clase ${esc(c.clase.numero)} · ${esc(c.clase.duracion || '')}</p>

    <section class="objetivos">
      <h2><span class="burb">🎯</span>Qué tiene que lograr el alumno</h2>
      <ul>${objetivosHtml}</ul>
    </section>

    <h2><span class="burb">🗓️</span>Plan de la clase</h2>
    <table class="plan">
      <tr><th>#</th><th>Bloque</th><th>Qué hacer</th><th>Tiempo</th></tr>
      ${planRows}
    </table>

    ${conecta.length ? `<section class="guia"><b>⚡ Apertura</b>
      <ul>${conecta.map((p) => `<li>${esc(p)}</li>`).join('\n')}</ul></section>` : ''}

    ${aclarar.length ? `<section class="guia"><b>💡 Puntos a explicar con calma</b>
      <ul>${aclarar.map((p) => `<li>${esc(p)}</li>`).join('\n')}</ul></section>` : ''}

    ${ejemplos.length ? `<section class="guia"><b>🧩 Ejemplos para mostrar</b>
      <ul>${ejemplos.map((p) => `<li>${esc(p)}</li>`).join('\n')}</ul></section>` : ''}
    ${footerHtml()}
  </div>
</body></html>`);
}

// ---------------------------------------------------------------- interactivo
function renderInteractivo(c) {
  const ej = (c.ejercicios || []).find((e) => e.interactivo);
  if (!ej || !ej.interactivo) return null;
  const i = ej.interactivo;
  const color = c.curso.color || '#0057ff';
  const preguntas = (i.preguntas || [])
    .map(
      (p, k) => `
    <div class="q" data-ok="${p.correcta}">
      <p class="qt">${k + 1}. ${esc(p.pregunta)}</p>
      ${(p.opciones || []).map((o, j) => `<label class="opt"><input type="radio" name="q${k}" value="${esc(o)}"><span>${esc(o)}</span></label>`).join('\n')}
    </div>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Práctica Clase ${esc(c.clase.numero)} - ${esc(c.clase.titulo)}</title>
<style>
  *{box-sizing:border-box} body{margin:0;font-family:'Segoe UI',Roboto,Arial,sans-serif;background:#f4f6fb;color:#16203a;padding:22px}
  .card{max-width:760px;margin:0 auto;background:#fff;border:1px solid #e3e9f5;border-radius:14px;padding:22px 26px;box-shadow:0 2px 10px rgba(20,40,90,.06)}
  h1{font-size:20px;color:${color};margin:0 0 4px} .sub{color:#5a6b8c;font-size:13px;margin:0 0 16px}
  .consigna{background:#fff8f0;border:1px solid #f5e3c8;border-radius:10px;padding:12px 14px;font-size:14px;line-height:1.55;margin-bottom:16px}
  .q{border:1px solid #e6ebf6;border-radius:10px;padding:14px 16px;margin-bottom:12px}
  .qt{font-weight:600;margin:0 0 10px}
  .opt{display:block;padding:9px 12px;border:1px solid #e6ebf6;border-radius:8px;margin-bottom:7px;cursor:pointer;font-size:14px;display:flex;gap:8px;align-items:center}
  .opt:hover{background:#f6f9ff}
  .opt input{margin:0}
  .ok{background:#e8f7ee;border-color:#bfe6cd;color:#116b33}
  .bad{background:#fdecec;border-color:#f3c9c9;color:#a82323}
  .btn{margin-top:16px;background:${color};color:#fff;border:0;border-radius:9px;padding:11px 18px;font-size:14px;font-weight:600;cursor:pointer}
  .btn:hover{filter:brightness(1.08)}
  .res{margin-top:14px;font-weight:600}
  .firma{margin-top:26px;padding-top:12px;border-top:1px solid #e3e9f5;text-align:center;font-size:12px;color:#8a94b3}
</style></head>
<body><div class="card">
  <h1>${esc(c.clase.titulo)}</h1>
  <p class="sub">Práctica ${esc(ej.titulo || ``)} · ${esc(c.curso.nombre)}</p>
  <div class="consigna">${esc(ej.consigna)}${ej.tip ? `<br><br><b>Ayuda:</b> ${esc(ej.tip)}` : ''}</div>
  ${preguntas}
  <button class="btn" onclick="corregir()">Corregir</button>
  <p class="res" id="res"></p>
  <footer class="firma">Hecho con dedicación · @gustavokempe</footer>
</div>
<script>
function corregir(){
  let aciertos=0,total=document.querySelectorAll('.q').length;
  document.querySelectorAll('.q').forEach(q=>{
    const el=q.querySelector('input:checked');
    q.querySelectorAll('.opt').forEach(o=>o.classList.remove('ok','bad'));
    if(!el){return;}
    const okSel=q.dataset.ok; let ok=false;
    q.querySelectorAll('.opt').forEach(o=>{ if(o.querySelector('input').value===okSel){o.classList.add('ok');} });
    el.closest('.opt').classList.add(el.value===q.dataset.ok?'ok':'bad');
    if(el.value===q.dataset.ok) aciertos++;
  });
  const r=document.getElementById('res');
  r.textContent='Aciertos: '+aciertos+'/'+total+(aciertos===total?' · ¡Perfecto! 🎉':aciertos>=Math.ceil(total/2)?' · ¡Buen trabajo!':' · Repasá la teoría y volvé a intentarlo');
}
</script>
</body></html>`;
}

// ---------------------------------------------------------------- salida
function sanitize(s) {
  // eslint-disable-next-line no-control-regex
  return String(s).replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
}

function renderPdf(htmlString, outPdf) {
  const tmp = path.join(require('os').tmpdir(), `clase-${Date.now()}.html`);
  fs.writeFileSync(tmp, htmlString, 'utf8');
  const url = 'file:///' + tmp.replace(/\\/g, '/');
  const args = [
    CHROME,
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--print-to-pdf=${outPdf}`,
    '--no-pdf-header-footer',
    `--print-to-pdf-no-header`,
    url
  ];
  const q = args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ');
  try {
    execSync(q, { stdio: 'pipe', timeout: 60000 });
  } catch (e) {
    console.error('  [error pdf]', e.message.trim().split('\n')[0]);
    return false;
  } finally {
    fs.rmSync(tmp, { force: true });
  }
  return fs.existsSync(outPdf);
}

// ---------------------------------------------------------------- main
function main() {
  const argv = process.argv.slice(2);
  const flag = (f) => {
    const i = argv.indexOf(f);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : null;
  };

  let specs;
  if (flag('--spec')) {
    specs = [JSON.parse(fs.readFileSync(flag('--spec'), 'utf8'))];
  } else {
    if (!fs.existsSync(SPEC_DIR)) {
      console.error('No existe tools/especificaciones/.');
      process.exit(1);
    }
    specs = fs
      .readdirSync(SPEC_DIR)
      .filter((f) => f.endsWith('.json'))
      .filter((f) => !flag('--filtro') || f.startsWith(flag('--filtro')))
      .map((f) => JSON.parse(fs.readFileSync(path.join(SPEC_DIR, f), 'utf8')));
  }

  for (const c of specs) {
    const dirOut = c.outputDir;
    if (!dirOut) {
      console.error(`  [skip] falta outputDir en spec`);
      continue;
    }
    fs.mkdirSync(dirOut, { recursive: true });
    const base = `Clase ${c.clase.numero} - ${sanitize(c.clase.titulo)}`;
    const outPdf = path.join(dirOut, `${base}.pdf`);

    console.log(`\n=== ${c.curso.nombre} | Clase ${c.clase.numero} — ${c.clase.titulo}`);

    const htmlPdf = renderClaseHtml(c, { paraPdf: true });
    if (renderPdf(htmlPdf, outPdf)) console.log(`  [pdf] ${outPdf}`);
    else console.log('  [pdf] FALLO');

    const htmlLectura = renderLecturaHtml(c);
    const outLectura = path.join(dirOut, `Lectura ${base}.pdf`);
    if (renderPdf(htmlLectura, outLectura)) console.log(`  [lectura] ${outLectura}`);
    else console.log('  [lectura] FALLO');

    const htmlGuia = renderGuiaHtml(c);
    const outGuia = path.join(dirOut, `Guía docente - Clase ${c.clase.numero} - ${sanitize(c.clase.titulo)}.pdf`);
    if (renderPdf(htmlGuia, outGuia)) console.log(`  [guía] ${outGuia}`);
    else console.log('  [guía] FALLO');

    const inter = renderInteractivo(c);
    if (inter) {
      const outHtml = path.join(dirOut, `Practica ${base}.html`);
      fs.writeFileSync(outHtml, inter, 'utf8');
      console.log(`  [html] ${outHtml} `);
    }
  }
}

if (require.main === module) main();

module.exports = { renderClaseHtml, renderInteractivo, renderLecturaHtml, renderGuiaHtml, html };