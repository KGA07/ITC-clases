'use strict';
const fs = require('fs');
const path = require('path');

(async () => {
  const { PDFParse } = await import('pdf-parse');
  const base = 'I:/ITC/1- Asistente Administrativo Digital con IA/@Clases';
  const outRoot = 'C:/Users/Gkempe/AppData/Local/Temp/opencode/asist-pdfs';
  fs.mkdirSync(outRoot, { recursive: true });

  const seen = new Set();
  async function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name);
      if (e.isDirectory()) { await walk(f); continue; }
      if (!/\.pdf$/i.test(e.name)) continue;
      if (!/Clase\s?\d+[_\s]*-?\s*(?:[A-ZÁÉÍÓÚÑ]).+\.pdf$/i.test(e.name)) continue;
      if (seen.has(f)) continue;
      seen.add(f);
      const rel = f.split(path.sep).slice(-3).join('__').replace(/[^\wÁÉÍÓÚÑáéíóúñ _.-]+/g, '_');
      const out = path.join(outRoot, rel + '.txt');
      if (fs.existsSync(out)) continue;
      try {
        const inst = new PDFParse({ data: new Uint8Array(fs.readFileSync(f)) });
        await inst.load();
        const r = await inst.getText();
        const txt = r.text.replace(/\n{3,}/g, '\n\n').trim();
        fs.writeFileSync(out, txt, 'utf8');
        console.log('OK ' + e.name + ' -> ' + (txt.length / 1024).toFixed(0) + 'KB');
      } catch (err) {
        console.error('ERR ' + e.name + ': ' + err.message.split('\n')[0]);
      }
    }
  }
  await walk(base);
})();