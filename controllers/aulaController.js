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
  // cursos del docente (compatible con registros viejos de un solo curso)
  const mis = Array.isArray(docente.cursos) && docente.cursos.length
    ? docente.cursos.filter(Boolean)
    : (docente.curso ? [docente.curso] : []);
  // curso activo: por query (?curso=) o el primero asignado
  const pedido = String(req.query.curso || docente.curso || mis[0] || '');
  const activo = mis.includes(pedido) ? pedido : (mis[0] || '');
  const infoCursos = mis
    .map((id) => {
      const cu = c.cursoIndex.get(id);
      return cu ? { id: cu.id, nombre: cu.nombre, emoji: cu.emoji, color: cu.color } : null;
    })
    .filter(Boolean);

  const curso = activo ? c.cursoIndex.get(activo) : null;
  const alumnos = activo
    ? data.alumnos
        .filter((a) => (Array.isArray(a.cursos) && a.cursos.length ? a.cursos.includes(activo) : a.curso === activo))
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

  // habilitaciones solo del curso activo: { [claseId]: fecha }
  const habilitaciones = {};
  for (const [k, v] of Object.entries(data.habilitaciones || {})) {
    if (k.startsWith(`${activo}::`)) habilitaciones[k.split('::')[1]] = v.fecha || '';
  }

  // asistencia de las clases del curso activo: { [claseId]: { [alumnoId]: {estado, fecha} } }
  const asistencia = {};
  for (const [claseId, marcas] of Object.entries(data.asistencia || {})) {
    if (!c.claseIndex.get(claseId) || c.claseIndex.get(claseId).cursoId !== activo) continue;
    const limpio = {};
    for (const [alumnoId, m] of Object.entries(marcas)) {
      if (alumnos.some((a) => String(a.id) === String(alumnoId))) limpio[alumnoId] = { estado: m.estado, fecha: m.fecha };
    }
    asistencia[claseId] = limpio;
  }

  res.json({
    docente: { id: docente.id, nombre_completo: docente.nombre_completo, curso: activo, cursos: mis, horario: docente.horario || '' },
    nombreCurso: curso ? curso.nombre : '',
    curso: curso ? vistaCursoLiviana(curso) : null,
    cursosAsignados: infoCursos,
    alumnos,
    habilitaciones,
    asistencia
  });
}

async function habilitar(req, res) {
  const data = await db.loadData();
  const docente = data.users.find((u) => String(u.id) === String(req.user.id));
  const mis = docente ? (Array.isArray(docente.cursos) && docente.cursos.length ? docente.cursos.filter(Boolean) : (docente.curso ? [docente.curso] : [])) : [];
  if (!docente || !mis.length) return res.status(400).json({ error: 'Docente sin curso asignado.' });
  const { claseId, habilitada } = req.body || {};
  const c = getCatalog();
  const clase = c.claseIndex.get(String(claseId || ''));
  if (!clase || !mis.includes(clase.cursoId)) {
    return res.status(400).json({ error: 'La clase no pertenece a tus cursos.' });
  }
  const key = `${clase.cursoId}::${clase.id}`;
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
  const mis = docente ? (Array.isArray(docente.cursos) && docente.cursos.length ? docente.cursos.filter(Boolean) : (docente.curso ? [docente.curso] : [])) : [];
  if (!docente || !mis.length) return res.status(400).json({ error: 'Docente sin curso asignado.' });
  const { claseId, alumnoId, estado } = req.body || {};
  const c = getCatalog();
  const clase = c.claseIndex.get(String(claseId || ''));
  const alumno = data.alumnos.find((a) => String(a.id) === String(alumnoId));
  if (!clase || !mis.includes(clase.cursoId)) return res.status(400).json({ error: 'La clase no pertenece a tus cursos.' });
  const cursosAlumno = Array.isArray(alumno && alumno.cursos) && alumno.cursos.length ? alumno.cursos : (alumno ? [alumno.curso] : []);
  if (!alumno || !cursosAlumno.includes(clase.cursoId)) return res.status(400).json({ error: 'El alumno no es de tu curso.' });
  if (!['presente', 'ausente', 'sin-marcar'].includes(estado)) return res.status(400).json({ error: 'Estado inválido.' });

  data.asistencia[clase.id] = data.asistencia[clase.id] || {};
  if (estado === 'sin-marcar') delete data.asistencia[clase.id][alumno.id];
  else data.asistencia[clase.id][alumno.id] = { estado, fecha: new Date().toISOString().slice(0, 10) };

  await db.saveData();
  res.json({ ok: true });
}

module.exports = { panel, habilitar, asistencia };
