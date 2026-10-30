'use strict';
const db = require('../data/db');
const { getCatalog } = require('../data/catalog');

// ── Panel del profesor (y del admin con curso asignado) ─────────────────────
// Un profesor tiene UN curso asignado (user.curso). Desde acá:
//   - Gestión de Clases: habilita/deshabilita clases de su curso (semana a semana)
//   - Asistencia: marca Presente/Ausente por clase y alumno
// Reglas del alumno: la clase se ve si está habilitada y no tiene marca AUSENTE.

function vistaCursoLiviana(curso) {
  return {
    id: curso.id,
    orden: curso.orden,
    nombre: curso.nombre,
    tipo: curso.tipo,
    emoji: curso.emoji,
    color: curso.color,
    stats: curso.stats,
    modulos: (curso.modulos || []).map((m) => ({
      titulo: m.titulo,
      clases: (m.clases || []).map((cl) => ({ id: cl.id, titulo: cl.titulo, count: (cl.archivos || []).length }))
    }))
  };
}

async function panel(req, res) {
  const data = await db.loadData();
  const docente = data.users.find((u) => String(u.id) === String(req.user.id));
  if (!docente) return res.status(404).json({ error: 'Docente no encontrado.' });

  const c = getCatalog();
  const curso = docente.curso ? c.cursoIndex.get(docente.curso) : null;
  const alumnos = docente.curso
    ? data.alumnos
        .filter((a) => a.curso === docente.curso)
        .map((a) => ({
          id: a.id,
          usuario: a.usuario,
          nombre_completo: a.nombre_completo,
          email: a.email || '',
          dni: a.dni || '',
          telefono: a.telefono || '',
          dia: a.dia || '',
          horario: a.horario || ''
        }))
    : [];

  // habilitaciones solo de su curso: { [claseId]: fecha }
  const habilitaciones = {};
  for (const [k, v] of Object.entries(data.habilitaciones || {})) {
    if (k.startsWith(`${docente.curso}::`)) habilitaciones[k.split('::')[1]] = v.fecha || '';
  }

  // asistencia de las clases de su curso: { [claseId]: { [alumnoId]: {estado, fecha} } }
  const asistencia = {};
  for (const [claseId, marcas] of Object.entries(data.asistencia || {})) {
    if (!c.claseIndex.get(claseId) || c.claseIndex.get(claseId).cursoId !== docente.curso) continue;
    const limpio = {};
    for (const [alumnoId, m] of Object.entries(marcas)) {
      if (alumnos.some((a) => String(a.id) === String(alumnoId))) limpio[alumnoId] = { estado: m.estado, fecha: m.fecha };
    }
    asistencia[claseId] = limpio;
  }

  res.json({
    docente: { id: docente.id, nombre_completo: docente.nombre_completo, curso: docente.curso || '', horario: docente.horario || '' },
    nombreCurso: curso ? curso.nombre : '',
    curso: curso ? vistaCursoLiviana(curso) : null,
    alumnos,
    habilitaciones,
    asistencia
  });
}

async function habilitar(req, res) {
  const data = await db.loadData();
  const docente = data.users.find((u) => String(u.id) === String(req.user.id));
  if (!docente || !docente.curso) return res.status(400).json({ error: 'Docente sin curso asignado.' });
  const { claseId, habilitada } = req.body || {};
  const c = getCatalog();
  const clase = c.claseIndex.get(String(claseId || ''));
  if (!clase || clase.cursoId !== docente.curso) {
    return res.status(400).json({ error: 'La clase no pertenece a tu curso.' });
  }
  const key = `${docente.curso}::${clase.id}`;
  if (habilitada) {
    data.habilitaciones[key] = { fecha: new Date().toISOString().slice(0, 10), por: String(docente.id) };
  } else {
    delete data.habilitaciones[key];
  }
  await db.saveData();
  res.json({ ok: true, habilitada: !!habilitada, fecha: habilitada ? data.habilitaciones[key].fecha : null });
}

async function asistencia(req, res) {
  const data = await db.loadData();
  const docente = data.users.find((u) => String(u.id) === String(req.user.id));
  if (!docente || !docente.curso) return res.status(400).json({ error: 'Docente sin curso asignado.' });
  const { claseId, alumnoId, estado } = req.body || {};
  const c = getCatalog();
  const clase = c.claseIndex.get(String(claseId || ''));
  const alumno = data.alumnos.find((a) => String(a.id) === String(alumnoId));
  if (!clase || clase.cursoId !== docente.curso) return res.status(400).json({ error: 'La clase no pertenece a tu curso.' });
  if (!alumno || alumno.curso !== docente.curso) return res.status(400).json({ error: 'El alumno no es de tu curso.' });
  if (!['presente', 'ausente', 'sin-marcar'].includes(estado)) return res.status(400).json({ error: 'Estado inválido.' });

  data.asistencia[clase.id] = data.asistencia[clase.id] || {};
  if (estado === 'sin-marcar') delete data.asistencia[clase.id][alumno.id];
  else data.asistencia[clase.id][alumno.id] = { estado, fecha: new Date().toISOString().slice(0, 10) };

  await db.saveData();
  res.json({ ok: true });
}

module.exports = { panel, habilitar, asistencia };
