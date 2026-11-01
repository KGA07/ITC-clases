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

// cursos permitidos para el usuario actual: null = admin (todo); array = profesor
function alumnoDe(data, id) {
  return data.alumnos.find((a) => String(a.id) === String(id));
}

function cursosPermitidos(data, req) {
  if (!req.user || req.user.tipo === 'admin') return null;
  const u = data.users.find((x) => String(x.id) === String(req.user.id) && x.tipo === 'profesor');
  if (!u) return [];
  const arr = Array.isArray(u.cursos) && u.cursos.length ? u.cursos : (u.curso ? [u.curso] : []);
  return arr;
}

function alumnoEnAlcance(data, req, alumno) {
  const perm = cursosPermitidos(data, req);
  if (perm === null) return true;
  const cursosAl = cursosDe(alumno);
  return cursosAl.some((c) => perm.includes(c));
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
    },
    // fecha en que el docente habilito la clase ("" si no esta habilitada)
    fhClase(cl) {
      const h = hab[`${cl.cursoId}::${cl.id}`];
      return (h && h.fecha) || '';
    },
    // razon por la que una clase esta bloqueada para el alumno ("" = visible)
    motivoClase(cl) {
      if (!cursos.includes(cl.cursoId)) return '';
      if (!hab[`${cl.cursoId}::${cl.id}`]) return 'El profesor todavía no habilitó esta clase.';
      const marca = asis[cl.id] && asis[cl.id][alumno.id];
      if (marca && marca.estado === 'ausente') return 'Quedaste ausente el día de esta clase. Consultá con tu docente para recuperarla.';
      if (!(cl.archivos || []).some((f) => this.set.has(f.fid))) return 'Tu profesor todavía no te habilitó el material de esta clase.';
      return '';
    }
  };
}

// Curso desde el catálogo (vista liviana, misma forma que readCatalog).
// Con conArchivos=true (aula del alumno): además devuelve los archivos
// permitidos de cada clase filtrados por permisos, para 1 solo fetch.
function vistaCurso(curso, visiblePorClase, conArchivos, setArchivos, opts) {
  const detalleClase = opts && opts.detalleClase;
  const conBloqueadas = !!(opts && opts.conBloqueadas);
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
        clases: (m.clases || []).flatMap((cl) => {
          const visible = visiblePorClase ? visiblePorClase(cl) : true;
          if (!visible) {
            // clase que el alumno todavia no puede abrir: va listada cerrada
            // con el motivo (solo el aula la pide, con conBloqueadas=true)
            if (!conBloqueadas) return [];
            const det = detalleClase ? detalleClase(cl) : {};
            return [{ id: cl.id, titulo: cl.titulo, count: 0, bloqueada: true, motivo: det.motivo || '' }];
          }
          const det = detalleClase ? detalleClase(cl) : {};
          const base = { id: cl.id, titulo: cl.titulo, count: (cl.archivos || []).length };
          if (det.fh) base.fh = det.fh;
          if (conArchivos) base.archivos = (cl.archivos || []).filter((f) => !setArchivos || setArchivos.has(f.fid));
          return base;
        })
      }))
      .filter((m) => m.clases.length > 0)
  };
}

const idDrive = (url) => (String(url || '').match(/[?&]id=([A-Za-z0-9_-]+)/) || [])[1] || '';

// ── Docente: ABM de alumnos ─────────────────────────────────────────────────
async function listar(req, res) {
  const data = await db.loadData();
  let alumnos = data.alumnos;
  const perm = cursosPermitidos(data, req);
  if (perm !== null) {
    alumnos = alumnos.filter((a) => cursosDe(a).some((c) => perm.includes(c)));
  }
  res.json({ alumnos: alumnos.map((a) => ({ ...vistaPublica(a), nMateriales: (a.permisos || []).length })) });
}

async function crear(req, res) {
  const { nombre_completo, usuario, email = '', dni = '', telefono = '', dia = '', curso = '', cursos, horario = '', password = '', permisos } = req.body || {};
  if (!nombre_completo || !usuario) {
    return res.status(400).json({ error: 'Faltan nombre completo o usuario.' });
  }
  const data = await db.loadData();
  const perm = cursosPermitidos(data, req);
  const limpio = String(usuario).trim();
  if (data.alumnos.some((a) => a.usuario.toLowerCase() === limpio.toLowerCase()) ||
      data.users.some((u) => String(u.nombre).toLowerCase() === limpio.toLowerCase())) {
    return res.status(409).json({ error: `El usuario "${limpio}" ya existe.` });
  }
  let cursosArr = normalizarCursos({ cursos, curso });
  if (perm !== null) {
    cursosArr = cursosArr.filter((c) => perm.includes(c));
    if (!cursosArr.length) {
      return res.status(403).json({ error: 'No podés asignar cursos que no te corresponden.' });
    }
  }
  const clave = password || passwordGenerada();
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
  const perm = cursosPermitidos(data, req);
  if (perm !== null && !alumnoEnAlcance(data, req, alumno)) {
    return res.status(403).json({ error: 'Ese alumno no está en tus cursos.' });
  }

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
    let arr = normalizarCursos({ cursos, curso: cursos === undefined ? alumno.curso : curso });
    if (perm !== null) {
      arr = arr.filter((c) => perm.includes(c));
      if (!arr.length) return res.status(403).json({ error: 'No podés asignar cursos que no te corresponden.' });
    }
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
  const alumno = alumnoDe(data, req.params.id);
  if (alumno) {
    const perm = cursosPermitidos(data, req);
    if (perm !== null && !alumnoEnAlcance(data, req, alumno)) {
      return res.status(403).json({ error: 'Ese alumno no está en tus cursos.' });
    }
  }
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
  // alcance: un docente solo puede restablecer claves de SUS cursos (el
  // admin pasa porque cursosPermitidos devuelve null para él)
  const perm = cursosPermitidos(data, req);
  if (perm !== null && !alumnoEnAlcance(data, req, alumno)) {
    return res.status(403).json({ error: 'Ese alumno no está en tus cursos.' });
  }
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
  // un bloque por cada curso asignado, con las clases visibles de ese curso.
  // En la misma respuesta van los archivos permitidos de cada clase: así el
  // aula carga con 1 solo pedido (antes era 1 pedido por clase).
  const cursos = [];
  for (const id of ctx.cursos) {
    const cur = c.cursoIndex.get(id);
    if (cur && cur.modulos) {
      const vista = vistaCurso(cur, (cl) => ctx.claseVisible(cl), true, ctx.set, {
        conBloqueadas: true,
        detalleClase: (cl) => ({ fh: ctx.fhClase(cl), motivo: ctx.motivoClase(cl) })
      });
      // resumen para la barra de progreso (solo clases habilitadas)
      let clases = 0, materiales = 0, bloqueadas = 0;
      for (const m of vista.modulos) for (const cl of m.clases) {
        if (cl.bloqueada) { bloqueadas++; continue; }
        clases++; materiales += (cl.archivos || []).length;
      }
      vista.totalClases = clases;
      vista.totalMateriales = materiales;
      vista.totalBloqueadas = bloqueadas;
      cursos.push(vista);
    }
  }
  // ficha de cursada del alumno: dia/horario guardados + docente del curso
  const docentes = data.users.filter((u) => u.tipo === 'profesor' && (Array.isArray(u.cursos) ? u.cursos.some((id) => ctx.cursos.includes(id)) : ctx.cursos.includes(u.curso)));
  res.json({
    nombre_completo: ctx.alumno.nombre_completo,
    dia: ctx.alumno.dia || '',
    horario: ctx.alumno.horario || '',
    docente: docentes.length ? { nombre: docentes[0].nombre_completo, telefono: docentes[0].telefono || '' } : null,
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
    const motivo = ctx.motivoClase(clase) || 'Esta clase todavía no está habilitada para vos.';
    return res.status(403).json({ error: motivo });
  }
  const archivos = (clase.archivos || []).filter((f) => ctx.set.has(f.fid));
  const curso = c.cursoIndex.get(clase.cursoId);
  res.json({ curso: curso ? curso.nombre : '', modulo: clase.modulo, clase: { ...clase, archivos } });
}


// ——— Progreso del alumno: clases marcadas como vistas ———
// Persistido en data.vistas (mapa alumnoId -> claseId -> fecha de la marca)
// para que el docente pueda ver el avance y que el alumno no lo pierda
// al cambiar de dispositivo (antes vivia solo en localStorage).
async function progresoVer(req, res) {
  const data = await db.loadData();
  const ctx = contextoSesion(data, req);
  if (!ctx) return res.status(404).json({ error: 'Alumno sin datos.' });
  const mias = (data.vistas || {})[String(ctx.alumno.id)] || {};
  res.json({ vistas: mias });
}

async function progresoMarcar(req, res) {
  const data = await db.loadData();
  const ctx = contextoSesion(data, req);
  if (!ctx) return res.status(404).json({ error: 'Alumno sin datos.' });
  const { claseId, visto } = req.body || {};
  const c = getCatalog();
  const clase = c.claseIndex.get(String(claseId || ''));
  if (!clase || !ctx.cursos.includes(clase.cursoId)) {
    return res.status(400).json({ error: 'La clase no pertenece a tus cursos.' });
  }
  const keyAl = String(ctx.alumno.id);
  data.vistas[keyAl] = data.vistas[keyAl] || {};
  if (visto === false) {
    delete data.vistas[keyAl][clase.id];
  } else {
    data.vistas[keyAl][clase.id] = new Date().toISOString();
  }
  await db.saveData();
  res.json({ ok: true, claseId: clase.id, vista: data.vistas[keyAl][clase.id] || null });
}

module.exports = {
  listar,
  crear,
  actualizar,
  borrar,
  cambiarPassword,
  catalogoAlumno,
  progresoVer,
  progresoMarcar,
  claseAlumno,
  vistaPublica,
  passwordGenerada
};
