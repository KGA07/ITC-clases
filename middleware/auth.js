'use strict';
const jwt = require('jsonwebtoken');
const config = require('../config');

function verifyAccess(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch {
    return null;
  }
}

function verifyRefresh(token) {
  try {
    return jwt.verify(token, config.refreshSecret);
  } catch {
    return null;
  }
}

function signAccess(user) {
  return jwt.sign(
    {
      id: user.id,
      nombre: user.nombre,
      tipo: user.tipo,
      nombre_completo: user.nombre_completo
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function signRefresh(user, tokenId) {
  return jwt.sign({ id: user.id, tokenId }, config.refreshSecret, { expiresIn: config.refreshExpiresIn });
}

// Middleware que exige token de acceso válido
function auth(req, res, next) {
  const token = req.headers.authorization && req.headers.authorization.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  const payload = verifyAccess(token);
  if (!payload) return res.status(401).json({ error: 'Token invalido o expirado' });
  req.user = payload;
  next();
}

function profAuth(req, res, next) {
  // El administrador también puede operar el panel de profesor
  if (!req.user || (req.user.tipo !== 'profesor' && req.user.tipo !== 'admin')) {
    return res.status(403).json({ error: 'Acceso denegado' });
  }
  next();
}

function adminAuth(req, res, next) {
  if (!req.user || req.user.tipo !== 'admin') {
    return res.status(403).json({ error: 'Solo administradores' });
  }
  next();
}

module.exports = {
  auth,
  profAuth,
  adminAuth,
  signAccess,
  signRefresh,
  verifyRefresh
};