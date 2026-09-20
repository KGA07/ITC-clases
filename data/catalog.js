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
          catalog.claseIndex.set(clase.id, clase);
        }
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

module.exports = { getCatalog, getCurso, getClase, buscar, CATALOG_FILE };