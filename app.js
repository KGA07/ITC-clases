'use strict';
const express = require('express');
const path = require('path');
const helmet = require('helmet');
const apiRoutes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { apiLimiter } = require('./middleware/rateLimit');
const config = require('./config');

const app = express();

// Cabeceras de seguridad. CSP desactivado por compatibilidad con el código
// inline del frontend vanilla.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: config.isProduction ? { maxAge: 60 * 60 * 24 * 365 } : false
  })
);

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));
app.disable('x-powered-by');

// Rate limit global a la API
app.use('/api', apiLimiter);

// Archivos estáticos con caché. `index: false` deja que la ruta "/" sirva el
// login (vía la tabla de páginas) en vez del home sin autenticar.
const publicDir = path.join(__dirname, 'public');
app.use(
  express.static(publicDir, {
    index: false,
    maxAge: config.isProduction ? '5m' : 0,
    etag: true
  })
);

// Rutas de la API
app.use('/api', apiRoutes);

// Páginas
const pages = {
  '/': 'login.html',
  '/inicio': 'index.html',
  '/curso': 'curso.html',
  '/clase': 'clase.html'
};
Object.entries(pages).forEach(([route, file]) => {
  app.get(route, (req, res) => res.sendFile(path.join(publicDir, file)));
});

// 404 y manejo de errores
app.use(notFound);
app.use(errorHandler);

module.exports = app;