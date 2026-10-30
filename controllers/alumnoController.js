'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../data/db');
const { getCatalog } = require('../data/catalog');

// ── Utilidades ──────────────────────────────────────────────────────────────
function passwordGenerada() {
  // Legible para dictar por teléfono: mayúscula + dígitos + mayúscula
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const dig = '23456789';
  const s = (arr, n) => Array.from({ length: n }, () => arr[crypto.randomInt(arr.length)]).join('');
  return `ITC${s(abc, 2)}${s(dig, 3)}`;
}

function vistaPublica(alumno) {
  return {
    id: alumno.id,
    usuario: alumno.usuario,
    nombre_completo: alumno.nombre_completo,
    email: alumno.email || '',
    curso: alumno.curso || '',
    horario: alumno.horario || '',
    permisos: alumno.permisos || [],
    creado: alumno.creado || ''
  };
}

function alumnoDe(data, id) {
  return data.alumnos.find((a) => String(a.id) === String(id));
}

// Curso desde el catálogo (vista liviana, misma forma que readCatalog)
function vistaCurso(curso, visiblePorClase) {
  return {
    id: curso.id,
    orden: curso.orden,
    nombre: curso.nombre,
    tipo: curso.tipo,
    emoji: curso.emoji,
    color: curso.color,
    stats: curso.stats,
    modulos: (curso.modulos || [])
      .map((m) => ({
        titulo: m.titulo,
        clases: (m.clases || [])
          .filter((cl) => (visiblePorClase ? visiblePorClase(cl) : true))
          .map((cl) => ({ id: cl.id, titulo: cl.titulo, count: (cl.archivos || []).length }))
      }))
      .filter((m) => m.clases.length > 0)
  };
}

const idDrive = (url) => (String(url || '').match(/[?&]id=([A-Za-z0-9_-]+)/) || [])[1] || '';

// ── Docente: ABM de alumnos ─────────────────────────────────────────────────
async function listar(req, res) {
  const data = await db.loadData();
  const detalle = req.query.detalle === '1';
  res.json({ alumnos: data.alumnos.map(detalle ? vistaPublica : (a) => ({ ...vistaPublica(a), nMateriales: (a.permisos || []).length })) });
}

async function crear(req, res) {
  const { nombre_completo, usuario, email = '', curso = '', horario = '', password = '' } = req.body || {};
  if (!nombre_completo || !usuario) {
    return res.status(400).json({ error: 'Faltan nombre completo o usuario.' });
  }
  const data = await db.loadData();
  const limpio = String(usuario).trim();
  if (data.alumnos.some((a) => a.usuario.toLowerCase() === limpio.toLowerCase()) ||
      data.users.some((u) => String(u.nombre).toLowerCase() === limpio.toLowerCase())) {
    return res.status(409).json({ error: `El usuario "${limpio}" ya existe.` });
  }
  const clave = password || passwordGenerada();
  const alumno = {
    id: db.getNextId(data.alumnos.filter((a) => typeof a.id === 'number')),
    usuario: limpio,
    password: bcrypt.hashSync(clave, 10),
    nombre_completo: String(nombre_completo).trim(),
    email: String(email).trim(),
    curso: String(curso),
    horario: String(horario).trim(),
    permisos: [],
    creado: new Date().toISOString()
  };
  // El id de alumno podría chocar con el de users al loguear por JWT id;
  // usamos un espacio de ids separado por prefijo para evitar colisiones.
  alumno.id = `a${alumno.id}`;
  data.alumnos.push(alumno);
  await db.saveData();
  res.status(201).json({ alumno: vistaPublica(alumno), password: clave });
}

async function actualizar(req, res) {
  const data = await db.loadData();
  const alumno = alumnoDe(data, req.params.id);
  if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado.' });

  const { nombre_completo, email, curso, horario, usuario, password, permisos } = req.body || {};
  if (usuario && String(usuario).trim() !== String(alumno.usuario).toLowerCase()) {
    const nuevo = String(usuario).trim();
    if (data.alumnos.some((a) => a.id !== alumno.id && a.usuario.toLowerCase() === nuevo.toLowerCase()) ||
        data.users.some((u) => String(u.nombre).toLowerCase() === nuevo.toLowerCase())) {
      return res.status(409).json({ error: `El usuario "${nuevo}" ya existe.` });
    }
    alumno.usuario = nuevo;
  }
  if (nombre_completo !== undefined) alumno.nombre_completo = String(nombre_completo).trim();
  if (email !== undefined) alumno.email = String(email).trim();
  if (curso !== undefined) alumno.curso = String(curso);
  if (horario !== undefined) alumno.horario = String(horario).trim();
  if (Array.isArray(permisos)) alumno.permisos = permisos.map(String);
  if (password) alumno.password = bcrypt.hashSync(String(password), 10);

  await db.saveData();
  res.json({ alumno: vistaPublica(alumno) });
}

async function borrar(req, res) {
  const data = await db.loadData();
  const antes = data.alumnos.length;
  data.alumnos = data.alumnos.filter((a) => String(a.id) !== String(req.params.id));
  if (data.alumnos.length === antes) return res.status(404).json({ error: 'Alumno no encontrado.' });
  await db.saveData();
  res.json({ ok: true });
}

async function cambiarPassword(req, res) {
  const data = await db.loadData();
  const alumno = alumnoDe(data, req.params.id);
  if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado.' });
  const clave = req.body && req.body.password ? String(req.body.password) : passwordGenerada();
  alumno.password = bcrypt.hashSync(clave, 10);
  await db.saveData();
  res.json({ ok: true, password: clave });
}

// ── Alumno: su material ─────────────────────────────────────────────────────
function permisosDe(req, data) {
  const a = data.alumnos.find((x) => String(x.id) === String(req.user.id));
  return a ? { alumno: a, set: new Set(a.permisos || []) } : null;
}

async function catalogoAlumno(req, res) {
  const data = await db.loadData();
  const ctx = permisosDe(req, data);
  if (!ctx) return res.status(404).json({ error: 'Alumno sin datos.' });
  const c = getCatalog();
  const curso = ctx.alumno.curso ? c.cursoIndex.get(ctx.alumno.curso) : null;
  const visiblePorClase = (cl) => (cl.archivos || []).some((f) => ctx.set.has(f.fid));
  res.json({
    nombre_completo: ctx.alumno.nombre_completo,
    curso: curso && curso.modulos ? vistaCurso(curso, visiblePorClase) : null,
    sinMateriales: ctx.set.size === 0
  });
}

async function claseAlumno(req, res) {
  const data = await db.loadData();
  const ctx = permisosDe(req, data);
  if (!ctx) return res.status(404).json({ error: 'Alumno sin datos.' });
  const c = getCatalog();
  const clase = c.claseIndex.get(req.params.id);
  if (!clase) return res.status(404).json({ error: 'Clase no encontrada.' });
  if (ctx.alumno.curso && clase.cursoId !== ctx.alumno.curso) {
    return res.status(403).json({ error: 'Esta clase no pertenece a tu curso.' });
  }
  const archivos = (clase.archivos || []).filter((f) => ctx.set.has(f.fid));
  const curso = c.cursoIndex.get(clase.cursoId);
  res.json({ curso: curso ? curso.nombre : '', modulo: clase.modulo, clase: { ...clase, archivos } });
}

module.exports = {
  listar,
  crear,
  actualizar,
  borrar,
  cambiarPassword,
  catalogoAlumno,
  claseAlumno,
  vistaPublica,
  passwordGenerada
};
