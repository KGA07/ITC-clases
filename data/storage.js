'use strict';
const fs = require('fs');
const path = require('path');
const config = require('../config');

const DB_FILE = path.join(__dirname, '..', 'db.json');

// ── Almacén en archivo JSON (modo demo / desarrollo) ────────────────────────
// En Vercel el filesystem es de solo lectura: si no se puede persistir,
// se degrada a memoria (el catálogo es estático; solo hay un profesor).
const memoryDoc = { doc: null };

const jsonStore = {
  name: 'json',
  async load() {
    // En cálidas sigue habiendo datos si ya se escribió en este proceso.
    if (memoryDoc.doc) return memoryDoc.doc;
    try {
      const raw = await fs.promises.readFile(DB_FILE, 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  async save(doc) {
    // Mantener una copia en memoria para el proceso actual (serverless).
    memoryDoc.doc = doc;
    try {
      const tmp = `${DB_FILE}.tmp`;
      await fs.promises.writeFile(tmp, JSON.stringify(doc, null, 2), 'utf8');
      await fs.promises.rename(tmp, DB_FILE);
    } catch (err) {
      // EROFS = filesystem de solo lectura (Vercel). Otros errores son reales.
      if (!/EROFS|EACCES|ENOSPC|EISDIR|ENOTSUP|EPERM/.test(String((err && err.code) || ''))) {
        throw err;
      }
    }
  }
};

// ── Almacén en Postgres (producción / Vercel) ────────────────────────────────
const pgStore = (() => {
  let impl = null;
  return {
    name: 'postgres',
    getImpl() {
      if (!impl) impl = require('./pgStore.js');
      return impl;
    },
    async load() {
      return this.getImpl().load();
    },
    async save(doc) {
      return this.getImpl().save(doc);
    }
  };
})();

function getStore() {
  return config.databaseUrl ? pgStore : jsonStore;
}

module.exports = { getStore, jsonStore, pgStore };