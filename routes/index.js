'use strict';
const express = require('express');
const { Router } = express;
const appCtrl = require('../controllers/appController');
const catalogCtrl = require('../controllers/catalogController');
const { auth, profAuth, adminAuth } = require('../middleware/auth');
const { apiLimiter, authLimiter } = require('../middleware/rateLimit');
const { loginRateLimiter } = require('../middleware/security');
const gestorCtrl = require('../controllers/gestorController');
const alumnosCtrl = require('../controllers/alumnoController');
const docentesCtrl = require('../controllers/docenteController');
const aulaCtrl = require('../controllers/aulaController');

const router = Router();

// ── Autenticacion ──────────────────────────────────────────────────────────
router.post('/login', authLimiter, loginRateLimiter, appCtrl.login);
router.post('/refresh', authLimiter, appCtrl.refresh);
router.post('/logout', appCtrl.logout);

// ── Catalogo de clases (restringido a profesor/admin) ──────────────────────
router.get('/catalogo', apiLimiter, auth, profAuth, catalogCtrl.readCatalog);
router.get('/curso/:id', apiLimiter, auth, profAuth, catalogCtrl.readCurso);
router.get('/clase/:id', apiLimiter, auth, profAuth, catalogCtrl.readClase);
router.get('/buscar', apiLimiter, auth, profAuth, catalogCtrl.search);

// ── Alumnos: gestion docente + aula del alumno ─────────────────────────────
router.get('/alumnos', apiLimiter, auth, profAuth, alumnosCtrl.listar);
router.post('/alumnos', apiLimiter, auth, profAuth, alumnosCtrl.crear);
router.put('/alumnos/:id', apiLimiter, auth, profAuth, alumnosCtrl.actualizar);
router.delete('/alumnos/:id', apiLimiter, auth, profAuth, alumnosCtrl.borrar);
router.post('/alumnos/:id/password', apiLimiter, auth, profAuth, alumnosCtrl.cambiarPassword);

// ── Docentes: ABM solo para administrador ──────────────────────────────────
router.get('/docentes', apiLimiter, auth, adminAuth, docentesCtrl.listar);
router.post('/docentes', apiLimiter, auth, adminAuth, docentesCtrl.crear);
router.put('/docentes/:id', apiLimiter, auth, adminAuth, docentesCtrl.actualizar);
router.delete('/docentes/:id', apiLimiter, auth, adminAuth, docentesCtrl.borrar);
router.post('/docentes/:id/password', apiLimiter, auth, adminAuth, docentesCtrl.cambiarPassword);
// vista previa del panel del docente (solo admin): token temporal por URL
router.post('/docentes/:id/impersonar', apiLimiter, auth, adminAuth, docentesCtrl.impersonar);

// ── Aula del profesor: habilitación de clases + asistencia ─────────────────
router.get('/prof/panel', apiLimiter, auth, profAuth, aulaCtrl.panel);
router.get('/prof/clase/:id', apiLimiter, auth, profAuth, aulaCtrl.claseDocente);
router.put('/prof/habilitacion', apiLimiter, auth, profAuth, aulaCtrl.habilitar);
router.put('/prof/asistencia', apiLimiter, auth, profAuth, aulaCtrl.asistencia);

function alumnoAuth(req, res, next) {
  if (!req.user || req.user.tipo !== 'alumno') return res.status(403).json({ error: 'Solo alumnos' });
  next();
}
router.get('/alumno/catalogo', apiLimiter, auth, alumnoAuth, alumnosCtrl.catalogoAlumno);
router.get('/alumno/clase/:id', apiLimiter, auth, alumnoAuth, alumnosCtrl.claseAlumno);

// Gestor docente (estado + acciones locales de regeneración)
router.get('/gestor', apiLimiter, auth, profAuth, gestorCtrl.estado);
router.get('/gestor/accion', apiLimiter, auth, profAuth, gestorCtrl.estadoAccion);
router.post('/gestor/accion', apiLimiter, auth, profAuth, gestorCtrl.accion);

module.exports = router;