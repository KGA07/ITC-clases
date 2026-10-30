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
    dni: alumno.dni || '',
    telefono: alumno.telefono || '',
    dia: alumno.dia || '',
    curso: alumno.curso || '',
    cursos: cursosDe(alumno),
    horario: alumno.horario || '',
    permisos: alumno.permisos || [],
    creado: alumno.creado || ''
  };
}

// cursos del alumno, compatible con registros viejos (cursor string)
function cursosDe(alumno) {
  const arr = Array.isArray(alumno.cursos) ? alumno.cursos.filter(Boolean) : [];
  if (!arr.length && alumno.curso) return [alumno.curso];
  return arr;
}

function normalizarCursos(body) {
  let arr = [];
  if (Array.isArray(body && body.cursos)) arr = body.cursos.map(String).filter(Boolean);
  else if (body && body.curso !== undefined && body.curso !== '') arr = [String(body.curso)];
  // sin repetidos, conservando orden
  return [...new Set(arr)];
}

function alumnoDe(data, id) {
  return data.alumnos.find((a) => String(a.id) === String(id));
}

// Reglas de visibilidad de una clase para el alumno:
//   1) la clase es de alguno de sus cursos
//   2) habilitada por el docente en Gestión de Clases (habilitaciones)
//   3) sin marca de AUSENTE en la asistencia de esa clase
//   4) con al menos un material permitido material por material
function contextoSesion(data, req) {
  const alumno = data.alumnos.find((a) => String(a.id) === String(req.user.id));
  if (!alumno) return null;
  const hab = data.habilitaciones || {};
  const asis = data.asistencia || {};
  const cursos = cursosDe(alumno);
  return {
    alumno,
    cursos,
    set: new Set(alumno.permisos || []),
    claseVisible(cl) {
      if (!cursos.includes(cl.cursoId)) return false;
      if (!hab[`${cl.cursoId}::${cl.id}`]) return false;
      const marca = asis[cl.id] && asis[cl.id][alumno.id];
      if (marca && marca.estado === 'ausente') return false;
      return (cl.archivos || []).some((f) => this.set.has(f.fid));
    }
  };
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
  res.json({ alumnos: data.alumnos.map((a) => ({ ...vistaPublica(a), nMateriales: (a.permisos || []).length })) });
}

async function crear(req, res) {
  const { nombre_completo, usuario, email = '', dni = '', telefono = '', dia = '', curso = '', cursos, horario = '', password = '', permisos } = req.body || {};
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
  const cursosArr = normalizarCursos({ cursos, curso });
  const alumno = {
    id: db.nextAlumnoId(data.alumnos),
    usuario: limpio,
    password: bcrypt.hashSync(clave, 10),
    nombre_completo: String(nombre_completo).trim(),
    email: String(email).trim(),
    dni: String(dni).trim(),
    telefono: String(telefono).trim(),
    dia: String(dia).trim(),
    curso: cursosArr[0] || String(curso || ''),
    cursos: cursosArr,
    horario: String(horario).trim(),
    permisos: Array.isArray(permisos) ? permisos.map(String) : [],
    creado: new Date().toISOString()
  };
  data.alumnos.push(alumno);
  await db.saveData();
  res.status(201).json({ alumno: vistaPublica(alumno), password: clave });
}

async function actualizar(req, res) {
  const data = await db.loadData();
  const alumno = alumnoDe(data, req.params.id);
  if (!alumno) return res.status(404).json({ error: 'Alumno no encontrado.' });

  const { nombre_completo, email, dni, telefono, dia, curso, cursos, horario, usuario, password, permisos } = req.body || {};
  if (usuario && String(usuario).trim().toLowerCase() !== String(alumno.usuario).toLowerCase()) {
    const nuevo = String(usuario).trim();
    if (data.alumnos.some((a) => a.id !== alumno.id && a.usuario.toLowerCase() === nuevo.toLowerCase()) ||
        data.users.some((u) => String(u.nombre).toLowerCase() === nuevo.toLowerCase())) {
      return res.status(409).json({ error: `El usuario "${nuevo}" ya existe.` });
    }
    alumno.usuario = nuevo;
  }
  if (nombre_completo !== undefined) alumno.nombre_completo = String(nombre_completo).trim();
  if (email !== undefined) alumno.email = String(email).trim();
  if (dni !== undefined) alumno.dni = String(dni).trim();
  if (telefono !== undefined) alumno.telefono = String(telefono).trim();
  if (dia !== undefined) alumno.dia = String(dia).trim();
  if (cursos !== undefined || curso !== undefined) {
    const arr = normalizarCursos({ cursos, curso: cursos === undefined ? alumno.curso : curso });
    alumno.cursos = arr;
    alumno.curso = arr[0] || '';
  }
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
async function catalogoAlumno(req, res) {
  const data = await db.loadData();
  const ctx = contextoSesion(data, req);
  if (!ctx) return res.status(404).json({ error: 'Alumno sin datos.' });
  const c = getCatalog();
  // un bloque por cada curso asignado, con las clases visibles de ese curso
  const cursos = [];
  for (const id of ctx.cursos) {
    const cur = c.cursoIndex.get(id);
    if (cur && cur.modulos) cursos.push(vistaCurso(cur, (cl) => ctx.claseVisible(cl)));
  }
  res.json({
    nombre_completo: ctx.alumno.nombre_completo,
    cursos,
    // compat: si tiene un solo curso, exponerlo como curso único también
    curso: cursos.length === 1 ? cursos[0] : null,
    sinMateriales: ctx.set.size === 0
  });
}

async function claseAlumno(req, res) {
  const data = await db.loadData();
  const ctx = contextoSesion(data, req);
  if (!ctx) return res.status(404).json({ error: 'Alumno sin datos.' });
  const c = getCatalog();
  const clase = c.claseIndex.get(req.params.id);
  if (!clase) return res.status(404).json({ error: 'Clase no encontrada.' });
  if (!ctx.cursos.includes(clase.cursoId)) {
    return res.status(403).json({ error: 'Esta clase no pertenece a tu curso.' });
  }
  if (!ctx.claseVisible(clase)) {
    return res.status(403).json({ error: 'Esta clase todavía no está habilitada para vos.' });
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
