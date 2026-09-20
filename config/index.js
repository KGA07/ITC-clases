'use strict';
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env'), quiet: true });

function int(value, fallback) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

const config = {
  port: int(process.env.PORT, 3001),
  nodeEnv,
  isProduction,
  isVercel: process.env.VERCEL === '1',

  // Secretos. En producción NO debe usarse el valor por defecto.
  jwtSecret: process.env.JWT_SECRET || 'dev-clases-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  refreshSecret: process.env.REFRESH_SECRET || 'dev-clases-refresh-secret-change-me',
  refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || '7d',

  // Seguridad del login (anti fuerza bruta)
  loginMaxAttempts: int(process.env.LOGIN_MAX_ATTEMPTS, 5),
  loginWindowMs: int(process.env.LOGIN_WINDOW_MS, 15 * 60 * 1000),

  // Persistencia: si existe una conexión a base de datos se usa Postgres
  // (recomendado en Vercel). Si no, archivo local db.json.
  databaseUrl:
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    '',

  // Credenciales iniciales del profesor y admin
  profesorUser: process.env.PROFESOR_USER || 'GKempe',
  profesorPassword: process.env.PROFESOR_PASSWORD || '1234',
  profesorNombre: process.env.PROFESOR_NOMBRE || 'Gustavo Kempe',
  adminUser: process.env.ADMIN_USER || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  adminNombre: process.env.ADMIN_NOMBRE || 'Administrador',

  // Enlace al sitio de evaluaciones (cruce entre proyectos)
  evaluacionesUrl: process.env.EVALUACIONES_URL || '/',

  // Datos institucionales
  institucion: 'Informatic\u00ae Training Center',
  institucionTitulo: process.env.INSTITUCION_TITULO || 'Instituto T\u00e9cnico de Capacitaci\u00f3n',
  universidad: 'UdeMM Universidad de la Marina Mercante',
  profesorCargo: process.env.PROFESOR_CARGO || 'Instructor'
};

if (isProduction && config.jwtSecret === 'dev-clases-secret-change-me') {
  console.warn('[config] AVISO: JWT_SECRET usa el valor por defecto. Definelos en las variables de entorno.');
}

module.exports = config;