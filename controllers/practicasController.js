'use strict';
/*
 * practicasController.js — Espacio de practicas del docente.
 *
 * El docente sube archivos (p. ej. practicas y ejercicios) asociados a una
 * clase de su curso, desde su panel (Mis Practicas). El alumno los ve dentro
 * de la clase correspondiente, junto a los materiales del catalogo, siempre
 * que la clase este habilitada y que no presente ausencia.
 *
 * Modelo de datos (filas por entidad, igual que u:/a:/hb:/as:/v:):
 *   p:<claseId|id>  metadata liviana { id, claseId, nombre, mime, size, ... }
 *   pd:<id>         contenido del archivo en base64 { d }
 *
 * Los archivos viajan en base64 dentro del JSON (expres.json 12mb, filtro de
 * 8 MB de base64 = ~6 MB de archivo real). El contenido NO vuelve por el
 * listado: el listado trae solo metadata.
 */

const db = require('../data/db');
const { getCatalog } = require('../data/catalog');

const MAX_B64 = 8 * 1024 * 1024; // ~6 MB de archivo (base64 agrega ~33%)
const MAX_NOMBRE = 180;

// extensiones que se pueden abrir en el visor (inline); el resto descarga
const INLINE = new Set([
  '.html', '.htm', '.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.txt'
]);

function extDe(nombre) {
  const m = /\.[a-z0-9]+$/i.exec(String(nombre || '').split('?')[0]);
  return m ? m[0].toLowerCase() : '';
}

function nombreSeguro(nombre) {
  return String(nombre || '').replace(/[\\/:*?"<>|\r\n]/g, '_').trim().slice(0, MAX_NOMBRE);
}

// alcance del docente: admin ve todos (null); profesor ve solo sus cursos
function alcance(data, user) {
  if (user.tipo === 'admin') return null;
  const u = data.users.find((x) => String(x.id) === String(user.id));
  if (!u) return [];
  if (Array.isArray(u.cursos) && u.cursos.length) return u.cursos.slice();
  return u.curso ? [u.curso] : [];
}

function claseDe(id) {
  return getCatalog().claseIndex.get(String(id || '')) || null;
}

// filtra las practicas al alcance docente y agrega el titulo de clase
function practicasEnAlcance(rows, cursos) {
  const catalogo = getCatalog();
  const out = [];
  for (const p of rows) {
    const clase = catalogo.claseIndex.get(String(p.claseId));
    if (!clase) continue; // la clase salio del catalogo: practica oculta
    if (Array.isArray(cursos) && !cursos.includes(clase.cursoId)) continue;
    out.push(Object.assign({}, p, { claseTitulo: clase.titulo, cursoId: clase.cursoId }));
  }
  return out;
}

// ── POST /api/prof/practicas ───────────────────────────────────────────────
async function subir(req, res) {
  const { claseId, nombre, mime = '', data } = req.body || {};
  const clase = claseDe(claseId);
  if (!clase) return res.status(404).json({ error: 'Clase no encontrada.' });
  const data0 = await db.loadData();
  const cursosDocente = alcance(data0, req.user);
  if (Array.isArray(cursosDocente) && !cursosDocente.includes(clase.cursoId)) {
    return res.status(403).json({ error: 'La clase no pertenece a tus cursos.' });
  }
  const limpio = nombreSeguro(nombre);
  if (!limpio) return res.status(400).json({ error: 'Falta el nombre del archivo.' });
  if (typeof data !== 'string' || data.length < 8) {
    return res.status(400).json({ error: 'Falta el contenido del archivo.' });
  }
  if (data.length > MAX_B64) {
    return res.status(413).json({ error: 'El archivo supera el limite de 6 MB.' });
  }
  const meta = {
    nombre: limpio,
    mime: String(mime || '').slice(0, 120) || null,
    size: Math.floor((data.length * 3) / 4),
    subidoPor: String(req.user.id),
    subidoPorNombre: String(req.user.nombre_completo || ''),
    creado: new Date().toISOString()
  };
  const id = await db.addPractica(clase.id, meta, data);
  return res.json({ ok: true, practica: Object.assign({}, meta, { id, claseId: clase.id }) });
}

// ── GET /api/prof/practicas (?curso= | ?clase=) ────────────────────────────
async function listar(req, res) {
  const data0 = await db.loadData();
  const cursosDocente = alcance(data0, req.user);
  let rows = practicasEnAlcance(await db.listPracticas(), cursosDocente);
  const curso = String(req.query.curso || '');
  if (curso) rows = rows.filter((p) => p.cursoId === curso);
  const clase = String(req.query.clase || '');
  if (clase) rows = rows.filter((p) => String(p.claseId) === clase);
  return res.json({ practicas: rows });
}

// ── GET /api/practicas/:id/file (?dl=1 fuerza descarga) ────────────────────
// Dual-auth: el docente desde su panel o el alumno desde el aula. El alumno
// la ve si cursa el curso, la clase esta habilitada y no presenta ausencia.
async function archivo(req, res) {
  const id = String(req.params.id || '');
  const practica = await db.getPractica(id);
  if (!practica) return res.status(404).json({ error: 'Practica no encontrada.' });
  const clase = claseDe(practica.claseId);
  if (!clase) return res.status(404).json({ error: 'La clase de esta practica ya no existe.' });
  const data0 = await db.loadData();

  if (req.user.tipo === 'alumno') {
    const alumno = data0.alumnos.find((a) => String(a.id) === String(req.user.id));
    if (!alumno) return res.status(403).json({ error: 'Alumno sin datos.' });
    const cursosAl = (Array.isArray(alumno.cursos) && alumno.cursos.length)
      ? alumno.cursos
      : (alumno.curso ? [alumno.curso] : []);
    if (!cursosAl.includes(clase.cursoId)) {
      return res.status(403).json({ error: 'Esta practica no es de tu curso.' });
    }
    const hab = data0.habilitaciones || {};
    if (!hab[`${clase.cursoId}::${clase.id}`]) {
      return res.status(403).json({ error: 'La clase todavia no esta habilitada.' });
    }
    const marca = (data0.asistencia[clase.id] || {})[alumno.id];
    if (marca && marca.estado === 'ausente') {
      return res.status(403).json({ error: 'Presentaste ausencia el dia de esta clase.' });
    }
  } else {
    const cursosDocente = alcance(data0, req.user);
    if (Array.isArray(cursosDocente) && !cursosDocente.includes(clase.cursoId)) {
      return res.status(403).json({ error: 'La clase no pertenece a tus cursos.' });
    }
  }

  const b64 = await db.getPracticaData(id);
  if (!b64) return res.status(410).json({ error: 'El contenido de la practica no esta disponible.' });
  const buf = Buffer.from(b64, 'base64');
  const ext = extDe(practica.nombre);
  const dl = req.query.dl === '1';
  let mime = practica.mime || 'application/octet-stream';
  if (ext === '.html' || ext === '.htm') {
    // los HTML de clase son autocontenidos (todo base64): charset UTF-8
    mime = (mime.split(';')[0] || 'text/html') + '; charset=utf-8';
  }
  res.set('Content-Type', mime);
  res.set('Cache-Control', 'private, no-store');
  res.set('X-Content-Type-Options', 'nosniff');
  const disp = `filename*=UTF-8''${encodeURIComponent(practica.nombre)}`;
  res.set('Content-Disposition', dl || !INLINE.has(ext) ? `attachment; ${disp}` : `inline; ${disp}`);
  return res.status(200).send(buf);
}

// ── DELETE /api/prof/practicas/:id ─────────────────────────────────────────
async function borrar(req, res) {
  const id = String(req.params.id || '');
  const practica = await db.getPractica(id);
  if (!practica) return res.status(404).json({ error: 'Practica no encontrada.' });
  if (req.user.tipo === 'profesor' && String(practica.subidoPor) !== String(req.user.id)) {
    return res.status(403).json({ error: 'Solo quien subio la practica puede borrarla.' });
  }
  await db.removePractica(id);
  return res.json({ ok: true });
}

module.exports = { subir, listar, archivo, borrar };
