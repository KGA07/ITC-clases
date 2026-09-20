'use strict';
const catalogo = require('../data/catalog');

function readCatalog(req, res) {
  try {
    const c = catalogo.getCatalog();
    // Entrega una vista liviana del catálogo: sin la lista completa de archivos
    // de cada clase (se pide por clase) para agilizar las páginas.
    const view = {
      generado: c.generado,
      fuentes: c.fuentes,
      capacitaciones: c.capacitaciones.map((curso) => ({
        id: curso.id,
        orden: curso.orden,
        nombre: curso.nombre,
        tipo: curso.tipo,
        emoji: curso.emoji,
        color: curso.color,
        temarioHtml: curso.temarioHtml || null,
        driveFolderId: curso.driveFolderId || null,
        stats: curso.stats,
        modulos: (curso.modulos || []).map((m) => ({
          titulo: m.titulo,
          clases: (m.clases || []).map((cl) => ({
            id: cl.id,
            titulo: cl.titulo,
            count: (cl.archivos || []).length
          }))
        }))
      }))
    };
    res.json(view);
  } catch (e) {
    res.status(503).json({ error: e.message });
  }
}

function readCurso(req, res) {
  const curso = catalogo.getCurso(req.params.id);
  if (!curso) return res.status(404).json({ error: 'Capacitacion no encontrada.' });
  res.json(curso);
}

function readClase(req, res) {
  const clase = catalogo.getClase(req.params.id);
  if (!clase) return res.status(404).json({ error: 'Clase no encontrada.' });
  const curso = catalogo.getCurso(clase.cursoId);
  res.json({ curso: curso ? curso.nombre : '', modulo: clase.modulo, clase });
}

function search(req, res) {
  const { q } = req.query;
  const resultados = catalogo.buscar(q);
  res.json({ resultados });
}

module.exports = { readCatalog, readCurso, readClase, search };