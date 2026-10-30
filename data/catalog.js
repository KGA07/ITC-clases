'use strict';
const fs = require('fs');
const path = require('path');

const CATALOG_FILE = path.join(__dirname, 'materiales.json');

let catalog = null;
let catalogError = null;

// Carga el catálogo una sola vez. Si falta el archivo devuelve un error claro:
// el catálogo se genera con `npm run catalog` (tools/build-catalog.js).
function loadCatalog() {
  if (catalog) return catalog;
  try {
    const raw = fs.readFileSync(CATALOG_FILE, 'utf8');
    catalog = JSON.parse(raw);
    if (!Array.isArray(catalog.capacitaciones)) {
      throw new Error('El catálogo no tiene la clave "capacitaciones".');
    }
    // Índice por id de capacitación y por id de clase.
    catalog.cursoIndex = new Map();
    catalog.claseIndex = new Map();
    for (const curso of catalog.capacitaciones) {
      catalog.cursoIndex.set(curso.id, curso);
      curso.modulos = curso.modulos || [];
      for (const mod of curso.modulos) {
        mod.clases = mod.clases || [];
        for (const clase of mod.clases) {
          clase.cursoId = curso.id;
          clase.modulo = mod.titulo;
          // Material "ciego": archivos sin url ni embedUrl todavía no se
          // sincronizaron a Drive → no se sirven (decisión del docente 30/10/26).
          // Se filtra en la carga, así sobrevive a regeneraciones del catálogo.
          if ((clase.archivos || []).length) {
            clase.archivos = clase.archivos.filter((f) => f.url || f.embedUrl);
            clase.count = clase.archivos.length; // mantener el count consistente
          }
          catalog.claseIndex.set(clase.id, clase);
        }
      }
      // Recalcular stats del curso con el material filtrado (para que las
      // tarjetas de la home y los contadores no cuenten archivos invisibles).
      let archivos = 0, tamano = 0;
      for (const mod of curso.modulos) for (const cl of mod.clases) {
        for (const f of cl.archivos || []) { archivos++; tamano += f.size || 0; }
      }
      if (curso.stats) {
        curso.stats.clases = curso.modulos.reduce((n, m) => n + m.clases.length, 0);
        curso.stats.archivos = archivos;
        curso.stats.tamanoMB = tamano / 1048576;
      }
    }
    return catalog;
  } catch (e) {
    catalogError = e;
    return null;
  }
}

function getCatalog() {
  const c = loadCatalog();
  if (!c) {
    throw new Error(
      `No se pudo cargar el catálogo de materiales. ${catalogError ? catalogError.message : ''} ` +
        'Ejecuta `npm run catalog` para generarlo desde la estructura local.'
    );
  }
  return c;
}

function getCurso(id) {
  const c = loadCatalog();
  if (!c) return null;
  return c.cursoIndex.get(id) || null;
}

function getClase(id) {
  const c = loadCatalog();
  if (!c) return null;
  return c.claseIndex.get(id) || null;
}

// Invalida el cache en memoria (usado por el gestor tras regenerar el catalogo).
function reload() {
  catalog = null;
  catalogError = null;
  return true;
}

function buscar(q) {
  const c = loadCatalog();
  if (!c) return [];
  const term = (q || '').trim().toLowerCase();
  if (!term) return [];
  const resultados = [];
  for (const curso of c.capacitaciones) {
    for (const mod of curso.modulos || []) {
      for (const clase of mod.clases || []) {
        const hits = [];
        for (const f of clase.archivos || []) {
          if (f.nombre.toLowerCase().includes(term)) hits.push(f);
        }
        if (hits.length > 0 || clase.titulo.toLowerCase().includes(term) || mod.titulo.toLowerCase().includes(term)) {
          resultados.push({ curso: curso.nombre, modulo: mod.titulo, clase, archivosHits: hits });
        }
      }
    }
  }
  return resultados.slice(0, 50);
}

module.exports = { getCatalog, getCurso, getClase, buscar, reload, CATALOG_FILE };