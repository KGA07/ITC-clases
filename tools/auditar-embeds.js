'use strict';
// Auditoría de interactivos embebidos: cada embedUrl existe y sus recursos
// relativos (src/href) apuntan a archivos que existen en public/.
const fs = require('fs');
const path = require('path');
const d = require('../data/materiales.json');
const PUB = path.join(__dirname, '..', 'public');
let nEmbeds = 0, nFaltan = 0, nAssets = 0, nAssetsFaltan = 0;
const faltantes = [], assetsFaltantes = [];
const only = process.argv[2] || null;
for (const c of d.capacitaciones) {
  if (only && c.id !== only) continue;
  for (const m of c.modulos || []) {
    for (const cl of m.clases || []) {
      for (const f of cl.archivos || []) {
        if (!f.embedUrl) continue;
        nEmbeds++;
        const rel = f.embedUrl.replace(/^\//, '').split('?')[0].split('#')[0];
        const abs = path.join(PUB, rel);
        if (!fs.existsSync(abs)) { nFaltan++; faltantes.push(`${c.id} · ${cl.titulo} · ${rel}`); continue; }
        const st = fs.statSync(abs);
        const archivo = st.isDirectory() ? path.join(abs, 'index.html') : abs;
        if (st.isDirectory() && !fs.existsSync(archivo)) { nFaltan++; faltantes.push(`${c.id} · ${rel} · sin index`); continue; }
        const html = fs.readFileSync(archivo, 'utf8');
        const dir = path.dirname(archivo);
        for (const x of html.matchAll(/(?:src|href)\s*=\s*["']([^"'#?]+)["']/g)) {
          const r = x[1];
          if (/^(https?:|data:|mailto:|\/\/|#|tel:|javascript:|sms:|\$\{)/i.test(r)) continue;
          nAssets++;
          let target;
          if (/^[a-zA-Z]:[\/\\]/.test(r) || /^file:/i.test(r)) {
            // ref absoluta que quedó en el html embebido: está rota de por sí
            target = null;
          } else {
            try { target = path.join(dir, decodeURIComponent(r)); } catch { target = path.join(dir, r); }
          }
          if (!target || !fs.existsSync(target)) {
            nAssetsFaltan++;
            if (assetsFaltantes.length < 30) assetsFaltantes.push(`${c.id} · ${rel} → ${r}`);
          }
        }
      }
    }
  }
}
console.log(`Curso: ${only || 'TODOS'} · embeds: ${nEmbeds} · faltando: ${nFaltan} · recursos: ${nAssets} · recursos faltando: ${nAssetsFaltan}`);
if (faltantes.length) console.log('FALTANTES:\n  ' + faltantes.slice(0, 20).join('\n  '));
if (assetsFaltantes.length) console.log('ASSETS FALTANTES (muestra):\n  ' + assetsFaltantes.join('\n  '));
