'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../data/db');
const { signAccess } = require('../middleware/auth');

// ── Utilidades ──────────────────────────────────────────────────────────────
function passwordGenerada() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const dig = '23456789';
  const s = (arr, n) => Array.from({ length: n }, () => arr[crypto.randomInt(arr.length)]).join('');
  return `ITC${s(abc, 2)}${s(dig, 3)}`;
}

// lista de cursos desde body: acepta cursos (array) o curso (string único)
function normalizarCursos(body) {
  let arr = [];
  if (Array.isArray(body && body.cursos)) arr = body.cursos.map(String).filter(Boolean);
  else if (body && body.curso !== undefined && body.curso !== '') arr = [String(body.curso)];
  return [...new Set(arr)];
}

function vistaDocente(u) {
  return {
    id: u.id,
    usuario: u.nombre,
    nombre_completo: u.nombre_completo || '',
    email: u.email || '',
    dni: u.dni || '',
    telefono: u.telefono || '',
    dia: u.dia || '',
    horario: u.horario || '',
    curso: u.curso || '',
    cursos: Array.isArray(u.cursos) ? u.cursos.filter(Boolean) : (u.curso ? [u.curso] : []),
    creado: u.creado || ''
  };
}

function docenteDe(data, id) {
  return data.users.find((u) => String(u.id) === String(id) && u.tipo === 'profesor');
}

async function nombreOcupado(data, nombre, exceptoId) {
  const n = String(nombre).toLowerCase();
  return data.users.some((u) => String(u.nombre).toLowerCase() === n && String(u.id) !== String(exceptoId)) ||
    data.alumnos.some((a) => a.usuario.toLowerCase() === n);
}

// ── ABM de docentes (solo administrador) ────────────────────────────────────
async function listar(req, res) {
  const data = await db.loadData();
  res.json({ docentes: data.users.filter((u) => u.tipo === 'profesor').map(vistaDocente) });
}

async function crear(req, res) {
  const { nombre, nombre_completo, email = '', dni = '', telefono = '', dia = '', horario = '', curso = '', cursos, password = '' } = req.body || {};
  if (!nombre || !nombre_completo) {
    return res.status(400).json({ error: 'Faltan usuario o nombre completo.' });
  }
  const data = await db.loadData();
  const limpio = String(nombre).trim();
  if (await nombreOcupado(data, limpio)) {
    return res.status(409).json({ error: `El usuario "${limpio}" ya existe.` });
  }
  const clave = password || passwordGenerada();
  const cursosArr = normalizarCursos({ cursos, curso });
  const docente = {
    id: db.getNextId(data.users),
    nombre: limpio,
    password: bcrypt.hashSync(clave, 10),
    tipo: 'profesor',
    nombre_completo: String(nombre_completo).trim(),
    email: String(email).trim(),
    dni: String(dni).trim(),
    telefono: String(telefono).trim(),
    dia: String(dia).trim(),
    horario: String(horario).trim(),
    curso: cursosArr[0] || '',
    cursos: cursosArr,
    creado: new Date().toISOString()
  };
  data.users.push(docente);
  if (docente.id >= (data.nextUserId || 3)) data.nextUserId = docente.id + 1;
  await db.saveData();
  res.status(201).json({ docente: vistaDocente(docente), password: clave });
}

async function actualizar(req, res) {
  const data = await db.loadData();
  const docente = docenteDe(data, req.params.id);
  if (!docente) return res.status(404).json({ error: 'Docente no encontrado.' });

  const { nombre, nombre_completo, email, dni, telefono, dia, horario, curso, cursos, password } = req.body || {};
  if (nombre && String(nombre).trim().toLowerCase() !== String(docente.nombre).toLowerCase()) {
    const nuevo = String(nombre).trim();
    if (await nombreOcupado(data, nuevo, docente.id)) {
      return res.status(409).json({ error: `El usuario "${nuevo}" ya existe.` });
    }
    docente.nombre = nuevo;
  }
  if (nombre_completo !== undefined) docente.nombre_completo = String(nombre_completo).trim();
  if (email !== undefined) docente.email = String(email).trim();
  if (dni !== undefined) docente.dni = String(dni).trim();
  if (telefono !== undefined) docente.telefono = String(telefono).trim();
  if (dia !== undefined) docente.dia = String(dia).trim();
  if (horario !== undefined) docente.horario = String(horario).trim();
  if (cursos !== undefined || curso !== undefined) {
    const arr = normalizarCursos({ cursos, curso: cursos === undefined ? docente.curso : curso });
    docente.cursos = arr;
    docente.curso = arr[0] || '';
  }
  if (password) docente.password = bcrypt.hashSync(String(password), 10);

  await db.saveData();
  res.json({ docente: vistaDocente(docente) });
}

async function borrar(req, res) {
  const data = await db.loadData();
  const docente = docenteDe(data, req.params.id);
  if (!docente) return res.status(404).json({ error: 'Docente no encontrado.' });
  if (String(docente.id) === String(req.user.id)) {
    return res.status(400).json({ error: 'No podés borrar tu propio usuario.' });
  }
  data.users = data.users.filter((u) => u !== docente);
  await db.saveData();
  res.json({ ok: true });
}

async function cambiarPassword(req, res) {
  const data = await db.loadData();
  const docente = docenteDe(data, req.params.id);
  if (!docente) return res.status(404).json({ error: 'Docente no encontrado.' });
  const clave = req.body && req.body.password ? String(req.body.password) : passwordGenerada();
  docente.password = bcrypt.hashSync(clave, 10);
  await db.saveData();
  res.json({ ok: true, password: clave });
}

// ── Vista previa del panel (solo admin): token temporal como el docente ─────
// No cambia la sesión del admin: devuelve un access token de profesora corto
// para abrir el panel en otra pestaña con los permisos reales de ese docente.
async function impersonar(req, res) {
  const data = await db.loadData();
  const docente = docenteDe(data, req.params.id);
  if (!docente) return res.status(404).json({ error: 'Docente no encontrado.' });
  // signAccess firma la sesión (id, nombre, tipo, nombre_completo) con el mismo
  // JWT secret, así el middleware auth no puede distinguir ni necesita saberlo.
  const token = signAccess({ id: docente.id, nombre: docente.nombre, tipo: docente.tipo, nombre_completo: docente.nombre_completo });
  res.json({
    token,
    url: `/profesor#pi=${encodeURIComponent(token)}`,
    docente: vistaDocente(docente)
  });
}

module.exports = { listar, crear, actualizar, borrar, cambiarPassword, impersonar, vistaDocente, passwordGenerada };
