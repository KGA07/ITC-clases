'use strict';
const config = require('../config');

// Almacén en memoria de intentos fallidos de login por identificador
const attempts = new Map();

function attemptKey(req) {
  const nombre = (req.body && req.body.nombre) || '';
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `${nombre}|${ip}`;
}

function loginRateLimiter(req, res, next) {
  const key = attemptKey(req);
  const now = Date.now();
  const record = attempts.get(key);

  if (record && record.blockedUntil && now < record.blockedUntil) {
    const seconds = Math.ceil((record.blockedUntil - now) / 1000);
    return res.status(429).json({
      error: `Demasiados intentos fallidos. Intenta de nuevo en ${seconds} segundos.`
    });
  }

  req.loginAttemptKey = key;
  res.on('finish', () => {
    if (res.statusCode === 401) {
      const current = attempts.get(key) || { count: 0, blockedUntil: 0 };
      current.count += 1;
      if (current.count >= config.loginMaxAttempts) {
        current.blockedUntil = Date.now() + config.loginWindowMs;
        current.count = 0;
      }
      attempts.set(key, current);
    } else if (res.statusCode === 200) {
      attempts.delete(key);
    }
  });
  next();
}

setInterval(
  () => {
    const now = Date.now();
    for (const [k, v] of attempts.entries()) {
      if (!v.blockedUntil || now > v.blockedUntil) attempts.delete(k);
    }
  },
  60 * 60 * 1000
).unref();

function clearLoginAttempts() {
  attempts.clear();
}

module.exports = { loginRateLimiter, clearLoginAttempts };