'use strict';
const fs = require('fs');
const path = require('path');

const SPEC_DIR = path.join(__dirname, '..', 'tools', 'especificaciones');
const GEN_EDIT = fs.statSync(path.join(__dirname, 'generar-clases.js')).mtime;

function sanitize(s) {
  return String(s).replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
}

const PROBLEMA = [];
const OK = [];
let total = 0;

const specs = fs.readdirSync(SPEC_DIR).filter((f) => f.endsWith('.json'));
for (const f of specs) {
  const c = JSON.parse(fs.readFileSync(path.join(SPEC_DIR, f), 'utf8'));
  const tit = sanitize(c.clase.titulo);
  const pdf = path.join(c.outputDir, `Clase ${c.clase.numero} - ${tit}.pdf`);
  const lectura = path.join(c.outputDir, `Lectura Clase ${c.clase.numero} - ${tit}.pdf`);
  const guia = path.join(c.outputDir, `Guía docente - Clase ${c.clase.numero} - ${tit}.pdf`);
  const practica = path.join(c.outputDir, `Practica Clase ${c.clase.numero} - ${tit}.html`);
  const outs = [pdf, lectura, guia, practica];
  for (const o of outs) {
    if (!fs.existsSync(o)) continue;
    total++;
    const mtime = fs.statSync(o).mtime;
    if (mtime < GEN_EDIT - 1000) PROBLEMA.push(mtime.toISOString().slice(11, 19) + ' ' + o);
    else OK.push(o);
  }
}
console.log(`Auditados (existian) : ${total}`);
console.log(`Con firma (OK)       : ${OK.length}`);
console.log(`Pre-edicion (VIEJOS) : ${PROBLEMA.length}`);
PROBLEMA.forEach((m) => console.log('  ' + m));