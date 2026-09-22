'use strict';
const fs = require('fs');
const path = require('path');

const SPEC_DIR = path.join(__dirname, '..', 'tools', 'especificaciones');
const GEN_EDIT = fs.statSync(path.join(__dirname, 'generar-clases.js')).mtime;

function sanitize(s) {
  return String(s).replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
}

const staleSpecs = [];
const specs = fs.readdirSync(SPEC_DIR).filter((f) => f.endsWith('.json')).sort();
for (const f of specs) {
  const c = JSON.parse(fs.readFileSync(path.join(SPEC_DIR, f), 'utf8'));
  const tit = sanitize(c.clase.titulo);
  const outs = [
    path.join(c.outputDir, `Clase ${c.clase.numero} - ${tit}.pdf`),
    path.join(c.outputDir, `Lectura Clase ${c.clase.numero} - ${tit}.pdf`),
    path.join(c.outputDir, `Guía docente - Clase ${c.clase.numero} - ${tit}.pdf`),
    path.join(c.outputDir, `Practica Clase ${c.clase.numero} - ${tit}.html`)
  ];
  const need = outs.some((o) => {
    if (!fs.existsSync(o)) return true;
    return fs.statSync(o).mtime < GEN_EDIT - 1000;
  });
  if (need) staleSpecs.push(path.join(SPEC_DIR, f));
}
console.log(`Specs con salidas viejas o faltantes: ${staleSpecs.length}`);
staleSpecs.forEach((s) => console.log(s));