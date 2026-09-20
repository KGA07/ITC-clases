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
const IGNORAR_PREFIJO = ['~$', '.~'];

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
const EMBED_MAX_HTML_BYTES = 400 * 1024;

function embeberInteractivo(claseId, nombreCarpeta, dirAbs) {
  const size = sizeDir(dirAbs);
  if (size > EMBED_MAX_BYTES) return { embebible: true, embedUrl: null, notas: `(${fmtMB(size)})` };
  const index = fs.existsSync(path.join(dirAbs, 'index.html'));
  if (!index) return { embebible: true, embedUrl: null, notas: '' };

  const slug = `${slugify(claseId)}-${slugify(nombreCarpeta)}`;
  const dest = path.join(EMBED_DIR, slug);
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(dirAbs, dest, { recursive: true });
  return { embebible: true, embedUrl: `/html/interactivos/${slug}/index.html`, notas: `(${fmtMB(size)})` };
}

function embeberHtmlSuelto(claseId, nombreArchivo, fileAbs) {
  const size = fs.statSync(fileAbs).size;
  if (size > EMBED_MAX_HTML_BYTES) return null;
  const base = path.basename(nombreArchivo, path.extname(nombreArchivo));
  const dirPadre = path.dirname(fileAbs);
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

// ── Recorrido de una clase ───────────────────────────────────────────────────
function archivosDeClase(claseId, dirAbs, relBaseAbs) {
  const archivos = [];
  let sum = 0;
  for (const e of fs.readdirSync(dirAbs, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
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

// ── Estructura modulos -> clases ─────────────────────────────────────────────
function construirModulos(claseRoot, cursoId, relBaseAbs) {
  const modulos = [];
  let idxModulo = 0;

  for (const e of fs.readdirSync(claseRoot, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (ignorar(e.name)) continue;
    const full = path.join(claseRoot, e.name);

    let idxClase = 0;
    if (e.isDirectory()) {
      const sub = fs.readdirSync(full, { withFileTypes: true }).filter((x) => !ignorar(x.name));
      const tieneSubDirs = sub.some((x) => x.isDirectory());

      if (tieneSubDirs) {
        // Nivel modulo: cada subcarpeta es una clase
        idxModulo += 1;
        const mod = { titulo: e.name, clases: [] };
        for (const ce of sub.sort((a, b) => a.name.localeCompare(b.name))) {
          if (ce.isDirectory()) {
            idxClase += 1;
            const claseId = `${cursoId}-m${idxModulo}-c${idxClase}-${slugify(ce.name)}`;
            const { archivos, sum } = archivosDeClase(claseId, path.join(full, ce.name), relBaseAbs);
            if (archivos.length === 0) continue;
            mod.clases.push({ id: claseId, titulo: ce.name, archivos, tamanoBytes: sum });
          }
        }
        if (mod.clases.length > 0) modulos.push(mod);
      } else {
        // Carpeta con solo archivos: clase suelta (p.ej. Ciberseguridad)
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