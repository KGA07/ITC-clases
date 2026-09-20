'use strict';
const rateLimit = require('express-rate-limit');

// Límites generales de peticiones por IP
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones. Intenta en un rato.' }
});

// Límite para endpoints de autenticación
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas peticiones de autenticacion.' }
});

module.exports = { apiLimiter, authLimiter };