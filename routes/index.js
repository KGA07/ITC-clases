'use strict';
const express = require('express');
const { Router } = express;
const appCtrl = require('../controllers/appController');
const catalogCtrl = require('../controllers/catalogController');
const { auth, profAuth } = require('../middleware/auth');
const { apiLimiter, authLimiter } = require('../middleware/rateLimit');
const { loginRateLimiter } = require('../middleware/security');

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

module.exports = router;