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

// ── Operaciones por entidad (parche del "doc completo" race) ────────────────
// Cada entidad (docente, alumno, habilitacion, etc.) vive en su PROPIA fila,
// asi dos lambdas concurrentes ya no pisan datos ajenos al guardar.
async function getRow(k) {
  await ensureSchema();
  const { rows } = await pool.query('SELECT value FROM kv WHERE bucket = $1 AND k = $2 FOR UPDATE', [BUCKET, k]);
  if (rows.length === 0) return null;
  return JSON.parse(rows[0].value);
}

async function setRow(k, value) {
  await ensureSchema();
  await pool.query(
    `INSERT INTO kv (bucket, k, value) VALUES ($1, $2, $3)
     ON CONFLICT (bucket, k) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [BUCKET, k, JSON.stringify(value)]
  );
}

async function removeRow(k) {
  await ensureSchema();
  await pool.query('DELETE FROM kv WHERE bucket = $1 AND k = $2', [BUCKET, k]);
}

// lista filas cuyo k empieza con prefijo → [{ k, value }]
async function listRows(prefix) {
  await ensureSchema();
  const { rows } = await pool.query(
    'SELECT k, value FROM kv WHERE bucket = $1 AND k LIKE $2 ORDER BY k',
    [BUCKET, escapeLike(prefix) + '%']
  );
  return rows.map((r) => ({ k: r.k, value: JSON.parse(r.value) }));
}

function escapeLike(s) {
  return s.replace(/[%_\\]/g, (c) => '\\' + c);
}

function close() {
  return pool.end();
}

// contador atomico en una fila: devuelvo el proximo numero y lo registro como usado
async function nextNumber(seqKey, start) {
  await ensureSchema();
  const { rows } = await pool.query(
    `INSERT INTO kv (bucket, k, value) VALUES ($1, $2, $3)
     ON CONFLICT (bucket, k) DO UPDATE SET value = ((kv.value)::bigint + 1)::text, updated_at = now()
     RETURNING ((kv.value)::bigint) AS n`,
    [BUCKET, seqKey, String(Math.floor(start))]
  );
  return parseInt(rows[0].n, 10);
}

async function ping() {
  await ensureSchema();
  const { rows } = await pool.query('SELECT 1 AS ok');
  return rows[0].ok === 1;
}

module.exports = { load, save, getRow, setRow, removeRow, listRows, nextNumber, close, ping, pool };