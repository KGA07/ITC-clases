'use strict';
const fs = require('fs');
const path = require('path');
const config = require('../config');

const DB_FILE = path.join(__dirname, '..', 'db.json');

// ── Almacén en archivo JSON (modo demo / desarrollo) ────────────────────────
const jsonStore = {
  name: 'json',
  async load() {
    try {
      const raw = await fs.promises.readFile(DB_FILE, 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  async save(doc) {
    const tmp = `${DB_FILE}.tmp`;
    await fs.promises.writeFile(tmp, JSON.stringify(doc, null, 2), 'utf8');
    await fs.promises.rename(tmp, DB_FILE);
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