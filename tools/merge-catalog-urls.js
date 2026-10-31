'use strict';
/*
 * Merge de URLs de Drive entre dos catálogos.
 *
 * Uso:
 *   node tools/merge-catalog-urls.js --old data/materiales.json.bak --new data/materiales.json
 *
 * Toma el catálogo "new" (recién regenerado, sin urls) y le copia url/embedUrl
 * del catálogo "old" emparejando por fid de archivo. El fid es estable entre
 * regeneraciones (se deriva del path relativo), por eso es la clave correcta.
 *
 * También preserva permisos de docentes/alumnos (no toca db.json, solo el catálogo).
 * Genera un backup del new antes de modificar: data/materiales.json.pre-merge.
 */
const fs = require('fs');
const path = require('path');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
}
const oldPath = arg('--old');
const newPath = arg('--new') || path.join(__dirname, '..', 'data', 'materiales.json');
if (!oldPath) {
  console.error('Falta --old <ruta al catálogo anterior con URLs>.');
  process.exit(1);
}

const oldCat = JSON.parse(fs.readFileSync(oldPath, 'utf8'));
const newCat = JSON.parse(fs.readFileSync(newPath, 'utf8'));

// índice fid -> {url, embedUrl} del catálogo viejo
const urlByFid = new Map();
for (const curso of oldCat.capacitaciones || []) {
  for (const mod of curso.modulos || []) {
    for (const cl of mod.clases || []) {
      for (const f of cl.archivos || []) {
        if (f.fid && (f.url || f.embedUrl)) {
          urlByFid.set(f.fid, { url: f.url || '', embedUrl: f.embedUrl || '' });
        }
      }
    }
  }
}

let copiadas = 0;
let sinMatch = 0;
for (const curso of newCat.capacitaciones || []) {
  for (const mod of curso.modulos || []) {
    for (const cl of mod.clases || []) {
      for (const f of cl.archivos || []) {
        const prev = urlByFid.get(f.fid);
        if (prev) {
          if (prev.url && !f.url) { f.url = prev.url; copiadas++; }
          if (prev.embedUrl && !f.embedUrl) { f.embedUrl = prev.embedUrl; copiadas++; }
        } else if (f.url || f.embedUrl) {
          // ya tenía url (interactivo embebible), se respeta
        } else {
          sinMatch++;
        }
      }
    }
  }
}

// backup
const backup = newPath + '.pre-merge';
fs.copyFileSync(newPath, backup);
fs.writeFileSync(newPath, JSON.stringify(newCat, null, 2), 'utf8');

console.log(`URLs copiadas (campos): ${copiadas}`);
console.log(`Archivos del nuevo catálogo sin match en el viejo: ${sinMatch}`);
console.log(`Backup guardado en: ${backup}`);
console.log('Listo. Verificá con: node tools/auditar-embeds.js (si existe) o revisá el diff.');
