'use strict';
/*
 * Extrae el texto de los temarios (DOCX/PDF) de "CLASES ITC ARMADO
 * ANTIGRAVITY" y lo guarda como HTML minimalista en data/temarios.json,
 * indexado por id de capacitacion. build-catalog.js lo integra al catálogo.
 *
 * Uso:
 *   node tools/extract-temarios.js
 */

const fs = require('fs');
const path = require('path');

const TEMARIOS_DIR = process.env.TEMARIOS_DIR || 'I:\\ITC\\CLASES ITC ARMADO ANTIGRAVITY';
const OUT = path.join(__dirname, '..', 'data', 'temarios.json');

// Archivo de temario por id de capacitacion (coincide con tools/build-catalog.js)
const MAPEO = {
  'asistente-administrativo': '01 - Capacitación 📘 Asistente Administrativo Digital con IA.docx',
  'administracion-pymes': '02 - Capacitación ADMINISTRACION DE PYMES.docx',
  'diseno-grafico': '03 - Capacitación DISEÑO GRÁFICO PUBLICITARIO.docx',
  'diseno-tecnico': '04 - Capacitación DISEÑO TECNICO INDUSTRIAL.docx',
  'marketing-digital': '05 - Capacitación Marketing Digital.docx',
  'diagnostico-mantenimiento': '06 - Capacitación DIAGNOSTICO Y MANTENIMIENTO.docx',
  'robotica-arduino': '07 - Capacitación ROBOTICA con Arduino.pdf',
  'automatizacion-ia': '08 - Capacitación Automatización con IA.docx',
  'ciberseguridad': null
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function paragraphsToHtml(parrafos) {
  const body = parrafos
    .map((p) => {
      const t = (p.text || '').trim();
      if (!t) return '';
      return `<p>${escapeHtml(t)}</p>`;
    })
    .filter(Boolean)
    .join('\n');
  return `<div class="temario">\n${body}\n</div>`;
}

async function extraer() {
  const resultados = {};
  for (const [id, archivo] of Object.entries(MAPEO)) {
    if (!archivo) continue;
    const full = path.join(TEMARIOS_DIR, archivo);
    if (!fs.existsSync(full)) {
      console.warn(`  [skip] no existe: ${archivo}`);
      continue;
    }
    try {
      if (archivo.toLowerCase().endsWith('.docx')) {
        const mammoth = require('mammoth');
        const { value } = await mammoth.convertToHtml({ path: full });
        resultados[id] = `<div class="temario">\n${value}\n</div>`;
        console.log(`  [ok] ${archivo} (docx)`);
      } else if (archivo.toLowerCase().endsWith('.pdf')) {
        const { PDFParse } = await import('pdf-parse');
        const buf = fs.readFileSync(full);
        const parser = new PDFParse({ data: new Uint8Array(buf) });
        const result = await parser.getText();
        resultados[id] = paragraphsToHtml(result.text.split(/\n{1,}/).map((l) => ({ text: l.trim() })));
        console.log(`  [ok] ${archivo} (pdf)`);
      }
    } catch (e) {
      console.error(`  [error] ${archivo}: ${e.message}`);
    }
  }

  fs.writeFileSync(OUT, JSON.stringify(resultados, null, 2), 'utf8');
  console.log(`\n  Temarios guardados en ${OUT} (${Object.keys(resultados).length} cursos).\n`);
}

extraer();