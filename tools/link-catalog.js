'use strict';
/*
 * Vincula el catálogo (data/materiales.json) con los archivos subidos a
 * Google Drive. Espera por stdin el JSON de `rclone lsjson --recursive`
 * (salida con "Path" e "ID"). Para cada archivo del catálogo:
 *
 *   - Iguala por ruta relativa (curso.fuente + '/' + archivo.ruta).
 *   - Si lo encuentra en Drive, escribe la url de descarga directa.
 *   - Las carpetas se enlazan a su página de Drive.
 *
 * Uso (lo invoca sync-drive.ps1):
 *   rclone lsjson --recursive "itc:Aula" | node tools/link-catalog.js --root "itc:Aula" --out data/materiales.json
 */

const fs = require('fs');
const path = require('path');

const arg = (flag, def) => {
  const i = process.argv.indexOf(flag);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
};
const rootDest = arg('--root', 'itc:Aula');
const out = arg('--out', path.join(__dirname, '..', 'data', 'materiales.json'));

function leerStdin() {
  return new Promise((resolve, reject) => {
    let s = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (d) => (s += d));
    process.stdin.on('end', () => resolve(s));
    process.stdin.on('error', reject);
  });
}

function driveUrl(entry) {
  if (entry.IsDir) return `https://drive.google.com/drive/folders/${entry.ID}`;
  return `https://drive.google.com/uc?export=download&id=${entry.ID}`;
}

async function main() {
  const raw = await leerStdin();
  const rows = JSON.parse(raw || '[]');

  // Quita el prefijo del destino (ej. "Aula/")
  const prefix = rootDest.split(':').slice(1).join(':').replace(/\/+$/, '') + '/';
  const byPath = new Map();
  for (const r of rows) {
    const p = r.Path.startsWith(prefix) ? r.Path.slice(prefix.length) : r.Path;
    byPath.set(p, r);
  }

  const catalog = JSON.parse(fs.readFileSync(out, 'utf8'));
  let vinculados = 0;
  let faltantes = 0;

  const vincular = (curso, archivo) => {
    const full = `${curso.fuente}/${archivo.ruta}`.replace(/\/+/g, '/').replace(/^\/+/, '');
    const hit = byPath.get(full) || byPath.get(full.replace(/\/+$/, '')) || byPath.get(`${full}/`);
    if (hit) {
      archivo.url = driveUrl(hit);
      archivo.driveId = hit.ID;
      vinculados += 1;
    } else {
      faltantes += 1;
    }
  };

  for (const curso of catalog.capacitaciones) {
    if (!curso.fuente) continue;
    for (const mod of curso.modulos || []) {
      for (const clase of mod.clases || []) {
        for (const f of clase.archivos || []) vincular(curso, f);
      }
    }
  }

  catalog.fuentes = catalog.fuentes || {};
  catalog.fuentes.drive = {
    raiz: rootDest,
    estado: 'sincronizado',
    vinculados,
    faltantes
  };

  fs.writeFileSync(out, JSON.stringify(catalog, null, 2), 'utf8');
  console.log(`\n  Enlaces actualizados: ${vinculados} vinculados, ${faltantes} sin vincular.\n`);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});