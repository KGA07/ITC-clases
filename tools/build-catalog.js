'use strict';
/*
 * Genera data/materiales.json a partir de la estructura de carpetas local de
 * materiales (por defecto I:\ITC). Uso:
 *
 *   npm run catalog
 *   # o bien:
 *   node tools/build-catalog.js --root "I:\ITC" --out "data/materiales.json"
 *
 * Deja cada capacitacion con: modulos -> clases -> archivos. Los archivos
 * llevan tipo, tamano, url (link a Drive, vacio hasta correr sync-drive.ps1)
 * y la marca embebible para los HTML interactivos autocontenidos, que se
 * copian a public/html/interactivos/ para mostrarlos dentro del sitio.
 */

const fs = require('fs');
const path = require('path');

// ── Configuracion ───────────────────────────────────────────────────────────
const DEFAULT_ROOT = process.env.ITC_ROOT || 'I:\\ITC';

const CURSOS = [
  {
    carpeta: '1- Asistente Administrativo Digital con IA',
    id: 'asistente-administrativo',
    nombre: 'Asistente Administrativo Digital con IA',
    emoji: '💼',
    color: '#0057ff',
    tipo: 'capacitacion'
  },
  {
    carpeta: '2- Administracion de Pymes',
    id: 'administracion-pymes',
    nombre: 'Administracion de Pymes',
    emoji: '📈',
    color: '#0ea5a4',
    tipo: 'capacitacion'
  },
  {
    carpeta: '3- Diseño Grafico',
    id: 'diseno-grafico',
    nombre: 'Diseno Grafico Publicitario',
    emoji: '🎨',
    color: '#f04e98',
    tipo: 'capacitacion'
  },
  {
    carpeta: '4- Diseño Tecnico',
    id: 'diseno-tecnico',
    nombre: 'Diseno Tecnico Industrial',
    emoji: '📐',
    color: '#f59e0b',
    tipo: 'capacitacion'
  },
  {
    carpeta: '5- Marketing Digital',
    id: 'marketing-digital',
    nombre: 'Marketing Digital',
    emoji: '📱',
    color: '#8b5cf6',
    tipo: 'capacitacion'
  },
  {
    carpeta: '6- Diagnostico y Mantenimiento',
    id: 'diagnostico-mantenimiento',
    nombre: 'Diagnostico y Mantenimiento de PC',
    emoji: '🖥️',
    color: '#ef4444',
    tipo: 'capacitacion'
  },
  {
    carpeta: '7- Robotica Arduino',
    id: 'robotica-arduino',
    nombre: 'Robotica con Arduino',
    emoji: '🤖',
    color: '#10b981',
    tipo: 'capacitacion'
  },
  {
    carpeta: '8- Automatización con IA',
    id: 'automatizacion-ia',
    nombre: 'Automatizacion con IA (N8N)',
    emoji: '⚡',
    color: '#6366f1',
    tipo: 'capacitacion'
  },
  {
    carpeta: 'Ciberseguridad Avanzado',
    id: 'ciberseguridad',
    nombre: 'Ciberseguridad Avanzado',
    emoji: '🛡️',
    color: '#0f766e',
    tipo: 'extras'
  }
];

// Archivos/carpetas ignorados en cualquier nivel.
const IGNORAR = new Set([
  'desktop.ini',
  'Thumbs.db',
  '.DS_Store',
  '__MACOSX',
  '.git',
  'node_modules',
  'Nueva carpeta',
  'Otros',
  'EvaluacionITC',
  'CLASES ITC ARMADO ANTIGRAVITY'
]);
const IGNORAR_PREFIJO = ['~$', '.~', '_', '.'];

// Carpetas de días de la semana y @Practicas se incluyen solo si tienen contenido.

const EMBED_MAX_BYTES = 1024 * 1024; // 1 MB: solo HTML autocontenidos pequeños
const EMBED_DIR = path.join(__dirname, '..', 'public', 'html', 'interactivos');

const TIPOS = [
  { ext: 'pdf', tipo: 'PDF', emoji: '📕' },
  { ext: 'ppsx', tipo: 'Presentacion', emoji: '📽️' },
  { ext: 'pptx', tipo: 'Presentacion', emoji: '📽️' },
  { ext: 'ppt', tipo: 'Presentacion', emoji: '📽️' },
  { ext: 'pptm', tipo: 'Presentacion', emoji: '📽️' },
  { ext: 'docx', tipo: 'Documento', emoji: '📄' },
  { ext: 'doc', tipo: 'Documento', emoji: '📄' },
  { ext: 'xlsx', tipo: 'Planilla', emoji: '📊' },
  { ext: 'xlsm', tipo: 'Planilla', emoji: '📊' },
  { ext: 'xls', tipo: 'Planilla', emoji: '📊' },
  { ext: 'csv', tipo: 'Planilla', emoji: '📊' },
  { ext: 'accdb', tipo: 'Base de datos', emoji: '🗄️' },
  { ext: 'html', tipo: 'Interactivo', emoji: '🌐' },
  { ext: 'htm', tipo: 'Interactivo', emoji: '🌐' },
  { ext: 'zip', tipo: 'Comprimido', emoji: '📦' },
  { ext: 'rar', tipo: 'Comprimido', emoji: '📦' },
  { ext: '7z', tipo: 'Comprimido', emoji: '📦' },
  { ext: 'dwg', tipo: 'Plano CAD', emoji: '📐' },
  { ext: 'jpg', tipo: 'Imagen', emoji: '🖼️' },
  { ext: 'jpeg', tipo: 'Imagen', emoji: '🖼️' },
  { ext: 'png', tipo: 'Imagen', emoji: '🖼️' },
  { ext: 'gif', tipo: 'Imagen', emoji: '🖼️' },
  { ext: 'svg', tipo: 'Imagen', emoji: '🖼️' },
  { ext: 'webp', tipo: 'Imagen', emoji: '🖼️' },
  { ext: 'psd', tipo: 'Imagen', emoji: '🖼️' },
  { ext: 'jfif', tipo: 'Imagen', emoji: '🖼️' },
  { ext: 'mp4', tipo: 'Video', emoji: '🎬' },
  { ext: 'webm', tipo: 'Video', emoji: '🎬' },
  { ext: 'mp3', tipo: 'Audio', emoji: '🎵' },
  { ext: 'ino', tipo: 'Sketch', emoji: '🔌' },
  { ext: 'exe', tipo: 'Programa', emoji: '⚙️' },
  { ext: 'txt', tipo: 'Texto', emoji: '📝' },
  { ext: 'md', tipo: 'Texto', emoji: '📝' },
  { ext: 'json', tipo: 'Datos', emoji: '🗃️' }
];

function tipoPara(nombre) {
  const ext = path.extname(nombre).toLowerCase().replace('.', '');
  if (!ext) return { tipo: 'Archivo', emoji: '📁' };
  const t = TIPOS.find((x) => x.ext === ext);
  return t ? { tipo: t.tipo, emoji: t.emoji } : { tipo: ext.toUpperCase(), emoji: '📁' };
}

function ignorar(nombre) {
  if (IGNORAR.has(nombre)) return true;
  if (IGNORAR_PREFIJO.some((p) => nombre.startsWith(p))) return true;
  return false;
}

// ── Ayudas de ruta y slug ───────────────────────────────────────────────────
function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[áàäâã]/g, 'a')
    .replace(/[éèëê]/g, 'e')
    .replace(/[íìïî]/g, 'i')
    .replace(/[óòöôõ]/g, 'o')
    .replace(/[úùüû]/g, 'u')
    .replace(/[ñ]/g, 'n')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function sizeDir(dir) {
  let total = 0;
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, e.name);
      if (e.isDirectory()) walk(full);
      else total += fs.statSync(full).size;
    }
  };
  walk(dir);
  return total;
}

// ── Embeber HTML interactivos autocontenidos ─────────────────────────────────
// Se copian a public/html/interactivos/<slug>/ y se guarda su embedUrl.
// Un HTML suelto se embeble solo si no tiene carpeta compañera (<nombre>_files)
// de la que dependan sus recursos y si es liviano.
const EMBED_MAX_HTML_BYTES = 1024 * 1024;

function embeberInteractivo(claseId, nombreCarpeta, dirAbs) {
  const size = sizeDir(dirAbs);
  if (size > EMBED_MAX_BYTES) return { embebible: true, embedUrl: null, notas: `(${fmtMB(size)})` };
  const index = fs.existsSync(path.join(dirAbs, 'index.html'));
  if (!index) return { embebible: true, embedUrl: null, notas: '' };

  const slug = `${slugify(claseId)}-${slugify(nombreCarpeta)}`;
  const dest = path.join(EMBED_DIR, slug);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(dirAbs, dest, { recursive: true });
  // Refs absolutas a la PC dejadas en el index: copio el recurso si existe fuera
  // de la carpeta y reescribo la referencia (los internos ya van con el copiado).
  const idxPath = path.join(dirAbs, 'index.html');
  try {
    const idxHtml = fs.readFileSync(idxPath, 'utf8');
    const hallados = recursosLocalesDelHtml(idxHtml, dirAbs, path.dirname(dirAbs));
    for (const [r, srcAbs] of hallados) {
      let rel;
      try { rel = path.relative(dirAbs, srcAbs); } catch { continue; }
      if (!rel.startsWith('..')) hallados.delete(r); // internos: ya van con el copiado
    }
    const { html: idxOut, copias } = reescribirRefs(idxHtml, hallados);
    if (copias.length) {
      fs.writeFileSync(path.join(dest, 'index.html'), idxOut, 'utf8');
      for (const pl of copias) fs.copyFileSync(pl.srcAbs, path.join(dest, pl.destRel));
    }
  } catch { /* sin index legible: queda como está */ }
  return { embebible: true, embedUrl: `/html/interactivos/${slug}/index.html`, notas: `(${fmtMB(size)})` };
}

// Búsqueda de rescate: si el path referenciado no existe, busca el MISMO nombre
// de archivo dentro de la raíz indicada (profundidad acotada).
const _files_RE = /_files$|\.files$/i;
const quitarDiacriticos = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
function buscarDescendente(dir, nombre, depth) {
  if (depth <= 0) return null;
  let items;
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  const objetivo = quitarDiacriticos(nombre);
  for (const it of items) {
    if (it.isFile() && quitarDiacriticos(it.name).toLowerCase() === objetivo) return path.join(dir, it.name);
  }
  for (const it of items) {
    if (it.isDirectory() && !/^(\.|_|~|__)/i.test(it.name) && !_files_RE.test(it.name) && it.name.toLowerCase() !== 'node_modules') {
      const r = buscarDescendente(path.join(dir, it.name), nombre, depth - 1);
      if (r) return r;
    }
  }
  return null;
}

// Detecta referencias a archivos locales en un HTML y devuelve el mapa de
// planes SIN reescribir nada: cada llamada decide qué planes aplicar antes de
// reescribir (para no reescribir refs cuyo recurso no se copia).
function recursosLocalesDelHtml(html, dirFuente, searchRoot) {
  const planes = new Map(); // refOriginal -> srcAbs | 'sin destino'
  let idx = 0;
  const dests = new Map(); // srcAbs -> destRel
  for (const x of html.matchAll(/(?:src|href)\s*=\s*(["'])([^"'#?]+)\1/g)) {
    const r = x[2];
    if (/^(https?:|data:|mailto:|\/\/|#|file:|\/|tel:|javascript:|sms:|\$\{)/i.test(r)) continue;
    if (planes.has(r)) continue;
    let p;
    try {
      p = /^[a-zA-Z]:[\/\\]/.test(r) ? decodeURIComponent(r) : path.join(dirFuente, decodeURIComponent(r));
    } catch {
      p = /^[a-zA-Z]:[\/\\]/.test(r) ? r : path.join(dirFuente, r);
    }
    let st = null;
    try { st = fs.statSync(p); } catch { st = null; }
    if ((!st || !st.isFile()) && searchRoot) {
      // rescate: mismo nombre de archivo en otra subcarpeta de la raíz
      const base = path.basename(p).toLowerCase();
      const hallado = buscarDescendente(searchRoot, base, 3);
      if (hallado) { p = hallado; try { st = fs.statSync(p); } catch { st = null; } }
    }
    if (!st || !st.isFile()) continue;
    planes.set(r, p);
    if (!dests.has(p)) dests.set(p, `res/${++idx}_${path.basename(p)}`);
  }
  return planes; // Map refOriginal -> srcAbs (solo resolvibles)
}

// Reemplaza las refs por su ruta res/ con UNA sola pasada (el ref corto no
// puede tocar al ref largo que lo contiene) y devuelve el html final.
function reescribirRefs(html, planes, indexBase) {
  if (!planes.size) return { html, copias: [] };
  const copias = [];
  let idx = indexBase || 0;
  const dests = new Map();
  for (const p of planes.values()) {
    if (!dests.has(p)) dests.set(p, `res/${++idx}_${path.basename(p)}`);
  }
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp([...planes.keys()].map((r) => esc(r)).sort((a, b) => b.length - a.length).join('|'), 'g');
  const salida = html.replace(re, (m) => dests.get(planes.get(m)) || m);
  for (const p of planes.values()) copias.push({ srcAbs: p, destRel: dests.get(p) });
  return { html: salida, copias };
}

function embeberHtmlSuelto(claseId, nombreArchivo, fileAbs) {
  const size = fs.statSync(fileAbs).size;
  if (size > EMBED_MAX_HTML_BYTES) return null;
  const base = path.basename(nombreArchivo, path.extname(nombreArchivo));
  const dirPadre = path.dirname(fileAbs);

  const slugBase = `${slugify(claseId)}-${slugify(nombreArchivo)}`;
  // html + recursos: hermanas de carpetas estándar y todo archivo local referenciado.
  const hermanas = ['css', 'js'].filter((d) => {
    const p = path.join(dirPadre, d);
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  });
  const originalHtml = fs.readFileSync(fileAbs, 'utf8');
  const hallados = recursosLocalesDelHtml(originalHtml, dirPadre, path.dirname(dirPadre));
  // Las refs que ya quedan cubiertas por las hermanas no se vuelven a copiar.
  if (hermanas.length) {
    for (const [r, srcAbs] of hallados) {
      let rel;
      try { rel = path.relative(dirPadre, srcAbs); } catch { continue; }
      if (!rel.startsWith('..') && hermanas.includes(rel.split(path.sep)[0].toLowerCase())) hallados.delete(r);
    }
  }
  const { html: htmlProcesado, copias } = reescribirRefs(originalHtml, hallados);

  if (hermanas.length > 0 || copias.length > 0) {
    const dest = path.join(EMBED_DIR, slugBase);
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });
    fs.writeFileSync(path.join(dest, nombreArchivo), htmlProcesado, 'utf8');
    for (const d of hermanas) fs.cpSync(path.join(dirPadre, d), path.join(dest, d), { recursive: true });
    for (const pl of copias) {
      const destinoRes = path.join(dest, pl.destRel);
      fs.mkdirSync(path.dirname(destinoRes), { recursive: true });
      fs.copyFileSync(pl.srcAbs, destinoRes);
    }
    return {
      embebible: true,
      embedUrl: `/html/interactivos/${slugBase}/${nombreArchivo}`,
      notas: `(${fmtKB(size)}${copias.length ? ` + ${copias.length} recursos` : ''})`
    };
  }

  const filesDir = path.join(dirPadre, `${base}_files`);
  const filesDirAlt = path.join(dirPadre, `${base}.files`);
  if (fs.existsSync(filesDir) || fs.existsSync(filesDirAlt)) return null; // depende de recursos

  const slug = `${slugify(claseId)}-${slugify(nombreArchivo)}`;
  const dest = path.join(EMBED_DIR, `${slug}.html`);
  fs.copyFileSync(fileAbs, dest);
  return { embebible: true, embedUrl: `/html/interactivos/${slug}.html`, notas: `(${fmtKB(size)})` };
}

function fmtKB(bytes) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

// ── Orden natural de carpetas ────────────────────────────────────────────────
// Compara "Clase 2" < "Clase 10" y "Modulo 2" < "Modulo 10" tratando cada
// corrida de dígitos como número en vez de letra por letra.
function compararNatural(a, b) {
  const sA = String(a), sB = String(b);
  const rA = /(\d+)|(\D+)/g, rB = /(\d+)|(\D+)/g;
  let mA, mB, iA = 0, iB = 0;
  while (true) {
    mA = rA.exec(sA); mB = rB.exec(sB);
    if (!mA && !mB) return 0;
    if (!mA) return -1;
    if (!mB) return 1;
    if (mA[1] && mB[1]) {
      const nA = Number(mA[1]), nB = Number(mB[1]);
      if (nA !== nB) return nA - nB;
      // empate numérico: "Clase 2" vs "Clase 2B" -> la con sufijo va después
      const r = sA.localeCompare(sB, 'es', { sensitivity: 'base' });
      if (r !== 0) return r;
    } else if (mA[2] && mB[2]) {
      const r = mA[2].localeCompare(mB[2], 'es', { sensitivity: 'base' });
      if (r !== 0) return r;
    } else if (mA[1]) {
      return -1; // número antes que texto en la misma posición (Clase 1 vs ClaseA)
    } else {
      return 1;
    }
    iA = mA.index + mA[0].length; iB = mB.index + mB[0].length;
    if (iA >= sA.length && iB >= sB.length) return 0;
    if (iA >= sA.length) return -1;
    if (iB >= sB.length) return 1;
  }
}

// ── Recorrido de una clase ───────────────────────────────────────────────────
function archivosDeClase(claseId, dirAbs, relBaseAbs) {
  const archivos = [];
  let sum = 0;
  for (const e of fs.readdirSync(dirAbs, { withFileTypes: true }).sort((a, b) => compararNatural(a.name, b.name))) {
    if (ignorar(e.name)) continue;
    const full = path.join(dirAbs, e.name);
    const ruta = path.relative(relBaseAbs, full).split(path.sep).join('/');
    if (e.isDirectory()) {
      // Carpeta archivo o interactivo
      const innerCount = fs.readdirSync(full).length;
      const interactivo = embeberInteractivo(claseId, e.name, full);
      const size = sizeDir(full);
      sum += size;
      archivos.push({
        nombre: e.name + '/',
        tipo: 'Carpeta',
        emoji: interactivo.embedUrl ? '🌐' : '🗂️',
        size,
        ruta,
        archivos: innerCount,
        url: '',
        ...interactivo,
        descripcion: interactivo.embedUrl ? 'Ejercicio interactivo para abrir en la pagina' : 'Carpeta con archivos'
      });
    } else {
      const st = fs.statSync(full);
      sum += st.size;
      const t = tipoPara(e.name);
      const isHtml = e.name.toLowerCase().endsWith('.html');
      const interactive = isHtml ? embeberHtmlSuelto(claseId, e.name, full) : null;
      archivos.push({
        nombre: e.name,
        tipo: t.tipo,
        emoji: t.emoji,
        size: st.size,
        ruta,
        url: '',
        embebible: isHtml,
        ...(interactive || {}),
        descripcion: interactive && interactive.embedUrl ? 'Ejercicio interactivo para abrir en la pagina' : ''
      });
    }
  }
  return { archivos, sum };
}

// Carpetas de recursos (solo imagenes/medios) que pertenecen a una clase
// y no deben ser interpretadas como una clase/modulo hijas.
const DIRS_RECURSOS = new Set(['img', 'images', 'image', 'imagen', 'imagenes', 'fotos', 'thumb', 'thumbs', 'css', 'js', 'assets', 'fonts']);
function esCarpetaRecursos(de) {
  const n = de.name.toLowerCase();
  if (DIRS_RECURSOS.has(n)) return true;
  // Carpetas de recursos de páginas web guardadas (p.ej. "Manual de ... _files").
  return de.isDirectory() && (n.endsWith('_files') || n.endsWith('.files'));
}

// ── Estructura modulos -> clases ─────────────────────────────────────────────
function construirModulos(claseRoot, cursoId, relBaseAbs) {
  const modulos = [];
  let idxModulo = 0;

  for (const e of fs.readdirSync(claseRoot, { withFileTypes: true }).sort((a, b) => compararNatural(a.name, b.name))) {
    if (ignorar(e.name)) continue;
    const full = path.join(claseRoot, e.name);

    let idxClase = 0;
    if (e.isDirectory()) {
      const sub = fs.readdirSync(full, { withFileTypes: true }).filter((x) => !ignorar(x.name));
      const tieneClasesHijas = sub.some((x) => x.isDirectory() && !esCarpetaRecursos(x));

      if (tieneClasesHijas) {
        // Nivel modulo: cada subcarpeta es una clase
        idxModulo += 1;
        const mod = { titulo: e.name, clases: [] };
        for (const ce of sub.sort((a, b) => compararNatural(a.name, b.name))) {
          if (ce.isDirectory() && !esCarpetaRecursos(ce)) {
            idxClase += 1;
            const claseId = `${cursoId}-m${idxModulo}-c${idxClase}-${slugify(ce.name)}`;
            const { archivos, sum } = archivosDeClase(claseId, path.join(full, ce.name), relBaseAbs);
            if (archivos.length === 0) continue;
            mod.clases.push({ id: claseId, titulo: ce.name, archivos, tamanoBytes: sum });
          }
        }
        if (mod.clases.length > 0) modulos.push(mod);
      } else {
        // Carpeta con solo archivos (y a lo sumo carpetas de recursos):
        // clase suelta (p.ej. Ciberseguridad o clases planas "Clase N - ...")
        const cls = modulos.find((m) => m.titulo === 'Clases');
        const target = cls || { titulo: 'Clases', clases: [] };
        const idxSuelta = target.clases.length + 1;
        const claseId = `${cursoId}-clase-${idxSuelta}-${slugify(e.name)}`;
        const { archivos, sum } = archivosDeClase(claseId, full, relBaseAbs);
        if (archivos.length > 0) {
          target.clases.push({ id: claseId, titulo: e.name, archivos, tamanoBytes: sum });
        }
        if (!cls) modulos.unshift(target);
      }
    }
  }

  // Archivos sueltos directamente en la raíz de clases -> "Material general"
  const rootFiles = fs
    .readdirSync(claseRoot, { withFileTypes: true })
    .filter((e) => e.isFile() && !ignorar(e.name));
  if (rootFiles.length > 0) {
    const { archivos } = archivosDeClase(`${cursoId}-general`, claseRoot, relBaseAbs);
    const sueltos = archivos.filter((a) => a.tipo !== 'Carpeta');
    if (sueltos.length > 0) {
      const sizeSueltos = sueltos.reduce((a, f) => a + (f.size || 0), 0);
      modulos.push({
        titulo: 'Material general',
        clases: [
          {
            id: `${cursoId}-material-general`,
            titulo: 'Material general',
            archivos: sueltos,
            tamanoBytes: sizeSueltos
          }
        ]
      });
    }
  }
  return modulos;
}

function fmtMB(bytes) {
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ── Construccion por curso ───────────────────────────────────────────────────
function construirCurso(cfg, root) {
  const dir = path.join(root, cfg.carpeta);
  if (!fs.existsSync(dir)) return null;

  const claseRoot = fs.existsSync(path.join(dir, '@Clases')) ? path.join(dir, '@Clases') : dir;
  const extras = []; // archivos sueltos de la raíz del curso (manuales, RAR, MP4...)

  // Archivos sueltos en la raíz del curso (fuera de @Clases)
  const rootEntries = fs.existsSync(path.join(dir, '@Clases'))
    ? fs.readdirSync(dir, { withFileTypes: true }).filter(
        (x) => x.isFile() && !ignorar(x.name) && !x.name.endsWith('.docx')
      )
    : [];
  if (rootEntries.length > 0) {
    const { archivos } = archivosDeClase(cfg.id + '-general', dir, dir);
    const filtrados = archivos.filter((a) => a.tipo !== 'Carpeta');
    if (filtrados.length > 0) {
      const sizeSueltos = filtrados.reduce((a, f) => a + (f.size || 0), 0);
      extras.push({ titulo: 'Material general', archivos: filtrados, tamanoBytes: sizeSueltos });
    }
  }

  const modulos = construirModulos(claseRoot, cfg.id, dir);

  // Carpeta @Practicas con contenido (si hay y no se está mirando ya)
  const prDir = path.join(dir, '@Practicas');
  if (fs.existsSync(prDir) && fs.readdirSync(prDir).some((x) => !ignorar(x))) {
    const { archivos, sum } = archivosDeClase(cfg.id + '-practicas', prDir, dir);
    if (archivos.length > 0) modulos.unshift({ titulo: 'Practicas', clases: [{ id: `${cfg.id}-practicas`, titulo: 'Practicas y trabajos', archivos, tamanoBytes: sum }] });
  }

  const todos = [...modulos.flatMap((m) => m.clases), ...extras.map((e) => ({ titulo: e.titulo, archivos: e.archivos }))];
  const totalBytes = todos.reduce((acc, c) => acc + (c.tamanoBytes || 0), 0);
  const totalArchivos = todos.reduce((acc, c) => acc + (c.archivos || []).length, 0);

  return {
    id: cfg.id,
    orden: cfg.orden,
    nombre: cfg.nombre,
    tipo: cfg.tipo,
    emoji: cfg.emoji,
    color: cfg.color,
    fuente: cfg.carpeta,
    temarioHtml: null,
    driveFolderId: null,
    stats: {
      clases: modulos.reduce((a, m) => a + m.clases.length, 0) + extras.length,
      archivos: totalArchivos,
      tamanoMB: Math.round((totalBytes / 1048576) * 10) / 10
    },
    modulos: [...modulos, ...extras]
  };
}

// ── Curso especial: Herramientas docentes (archivos de la raíz) ──────────────
function construirHerramientas(root) {
  const toolFiles = [
    'Generador de Gemini.html',
    'Generador de Prompts para gemini.html',
    'Generador de clasesNotebooklm.html',
    'ServidoresConfigAvanzado.html',
    'Todos Los Atajos.pdf'
  ];
  const archivos = [];
  for (const f of toolFiles) {
    const full = path.join(root, f);
    if (!fs.existsSync(full)) continue;
    const st = fs.statSync(full);
    const t = tipoPara(f);
    archivos.push({
      nombre: f,
      tipo: t.tipo,
      emoji: t.emoji,
      size: st.size,
      ruta: f,
      url: '',
      embebible: f.toLowerCase().endsWith('.html'),
      descripcion: 'Herramienta del docente'
    });
  }
  if (archivos.length === 0) return null;
  return {
    id: 'herramientas-docentes',
    orden: 99,
    nombre: 'Herramientas docentes',
    tipo: 'herramientas',
    emoji: '🧰',
    color: '#64748b',
    temarioHtml: null,
    driveFolderId: null,
    stats: {
      clases: 1,
      archivos: archivos.length,
      tamanoMB: Math.round((archivos.reduce((a, f) => a + f.size, 0) / 1048576) * 10) / 10
    },
    modulos: [
      {
        titulo: 'Generadores y utilidades',
        clases: [{ id: 'herramientas-generadores', titulo: 'Generadores y utilidades', archivos, tamanoBytes: archivos.reduce((a, f) => a + f.size, 0) }]
      }
    ]
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
function main() {
  const argv = process.argv.slice(2);
  const arg = (flag, def) => {
    const i = argv.indexOf(flag);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
  };
  const root = process.env.ITC_ROOT || arg('--root', DEFAULT_ROOT);
  const out = arg('--out', path.join(__dirname, '..', 'data', 'materiales.json'));

  fs.rmSync(EMBED_DIR, { recursive: true, force: true });
  fs.mkdirSync(EMBED_DIR, { recursive: true });

  const capacitaciones = [];
  for (const cfg of CURSOS) {
    const curso = construirCurso(cfg, root);
    if (curso && curso.modulos.length > 0) capacitaciones.push(curso);
  }

  // Herramientas docentes de la raíz
  const herr = construirHerramientas(root);
  if (herr) capacitaciones.push(herr);

  capacitaciones.sort((a, b) => a.orden - b.orden);

  // Integra los temarios extraidos (data/temarios.json) a cada curso.
  const temariosPath = path.join(__dirname, '..', 'data', 'temarios.json');
  if (fs.existsSync(temariosPath)) {
    const temarios = JSON.parse(fs.readFileSync(temariosPath, 'utf8'));
    for (const curso of capacitaciones) {
      if (temarios[curso.id]) curso.temarioHtml = temarios[curso.id];
    }
  }

  const catalog = {
    generado: new Date().toISOString(),
    fuentes: {
      local: root,
      drive: { raiz: 'itc', estado: 'pendiente de sincronizar (npm run sync o sync-drive.ps1)' }
    },
    capacitaciones
  };

  fs.writeFileSync(out, JSON.stringify(catalog, null, 2), 'utf8');
  const totalMB = capacitaciones.reduce((a, c) => a + (c.stats.tamanoMB || 0), 0);
  const totalArchivos = capacitaciones.reduce((a, c) => a + c.stats.archivos, 0);
  console.log(`\n  Catalogo generado: ${out}`);
  console.log(`  ${capacitaciones.length} capacitaciones, ${totalArchivos} archivos, ~${totalMB} MB.\n`);
}

main();