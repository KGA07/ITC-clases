'use strict';

// Almacén basado en Postgres. Guarda el documento completo de la aplicación
// en una tabla clave/valor (`kv`). Se activa automáticamente cuando existe la
// variable de entorno DATABASE_URL (por ejemplo Vercel Postgres / Neon).

const { Pool } = require('pg');
const config = require('../config');

const BUCKET = 'itc_clases';
const KEY = 'doc';

const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : config.databaseUrl.includes('sslmode=require')
        ? { rejectUnauthorized: false }
        : undefined,
  max: 5,
  idleTimeoutMillis: 30000
});

let schemaReady = false;
let schemaPromise = null;

async function ensureSchema() {
  if (schemaReady) return;
  if (!schemaPromise) {
    schemaPromise = pool
      .query(
        `
      CREATE TABLE IF NOT EXISTS kv (
        bucket TEXT NOT NULL,
        k TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (bucket, k)
      )
    `
      )
      .then(() => {
        schemaReady = true;
      });
  }
  await schemaPromise;
}

async function load() {
  await ensureSchema();
  const { rows } = await pool.query('SELECT value FROM kv WHERE bucket = $1 AND k = $2', [BUCKET, KEY]);
  if (rows.length === 0) return null;
  return JSON.parse(rows[0].value);
}

async function save(doc) {
  await ensureSchema();
  await pool.query(
    `INSERT INTO kv (bucket, k, value) VALUES ($1, $2, $3)
     ON CONFLICT (bucket, k) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [BUCKET, KEY, JSON.stringify(doc)]
  );
}

async function close() {
  await pool.end();
}

async function ping() {
  await ensureSchema();
  const { rows } = await pool.query('SELECT 1 AS ok');
  return rows[0].ok === 1;
}

module.exports = { load, save, close, ping, pool };