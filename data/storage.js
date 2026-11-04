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
  },

  // ── Operaciones por entidad (mismo contrato que pgStore) ──────────────────
  // En modo archivo el "doc completo" sigue siendo seguro (un solo proceso),
  // así que las claves se mapean a las colecciones del doc.json existente.
  async getRow(k) {
    const doc = await this.load();
    if (!doc) return null;
    const ent = filaDesdeDoc(doc, k);
    return ent === undefined ? null : ent;
  },
  async setRow(k, value) {
    const doc = (await this.load()) || seedDocVacio();
    filaADoc(doc, k, value);
    await this.save(doc);
  },
  async removeRow(k) {
    const doc = await this.load();
    if (!doc) return;
    filaADoc(doc, k, undefined); // undefined = borrar
    await this.save(doc);
  },
  async listRows(prefix) {
    const doc = await this.load();
    if (!doc) return [];
    return filasDSDeDoc(doc).filter((r) => r.k.startsWith(prefix));
  },
  // en archivo no hace falta atomicidad: devuelvo max+1 de las entidades
  async nextNumber(seqKey, start) {
    const doc = await this.load();
    if (!doc) return Math.floor(start);
    if (seqKey === 'seq:users') {
      const ids = (doc.users || []).map((u) => Number(u.id) || 0);
      const guardado = Number(doc.nextUserId) || 3;
      return Math.max(guardado, Math.max(...ids, 2) + 1, Math.floor(start));
    }
    if (seqKey === 'seq:alumnos') {
      const prefs = (doc.alumnos || []).map((a) => /^a(\d+)$/.exec(String(a.id)));
      const max = prefs.filter(Boolean).reduce((m, x) => Math.max(m, parseInt(x[1], 10)), 0);
      return Math.max(max + 1, Math.floor(start));
    }
    if (seqKey === 'seq:practicas') {
      let max = 0;
      for (const k of Object.keys(doc.practicas || {})) {
        const x = /^pd:(\d+)$/.exec(k);
        if (x) max = Math.max(max, parseInt(x[1], 10));
      }
      return Math.max(max + 1, Math.floor(start));
    }
    return Math.floor(start);
  }
};

// ── mapeo clave-of-fila ↔ colecciones del doc (modo archivo) ────────────────
function filaDesdeDoc(doc, k) {
  if (k === 'tokens') return doc.refreshTokens || [];
  const entidadRaw = k.slice(k.indexOf(':') + 1);
  switch (true) {
    case k.startsWith('u:'): return (doc.users || []).find((u) => String(u.id) === entidadRaw);
    case k.startsWith('a:'): return (doc.alumnos || []).find((a) => String(a.id) === entidadRaw);
    case k.startsWith('hb:'): return (doc.habilitaciones || {})[entidadRaw];
    case k.startsWith('v:'): return (doc.vistas || {})[entidadRaw];
    case k.startsWith('as:'): {
      const [claseId, alumnoId] = entidadRaw.split('|');
      return ((doc.asistencia || {})[claseId] || {})[alumnoId];
    }
    // practicas del docente: claves p:<claseId|id> y pd:<id> en doc.practicas
    case k.startsWith('p:') || k.startsWith('pd:'):
      return (doc.practicas || {})[k];
    default: return undefined;
  }
}

function filaADoc(doc, k, value) {
  const entidadRaw = k.slice(k.indexOf(':') + 1);
  if (k === 'tokens') { doc.refreshTokens = value === undefined ? [] : value; return; }
  if (k.startsWith('u:')) {
    doc.users = doc.users || [];
    const i = doc.users.findIndex((u) => String(u.id) === entidadRaw);
    if (value === undefined) { if (i >= 0) doc.users.splice(i, 1); }
    else if (i >= 0) doc.users[i] = value; else doc.users.push(value);
    return;
  }
  if (k.startsWith('a:')) {
    doc.alumnos = doc.alumnos || [];
    const i = doc.alumnos.findIndex((a) => String(a.id) === entidadRaw);
    if (value === undefined) { if (i >= 0) doc.alumnos.splice(i, 1); }
    else if (i >= 0) doc.alumnos[i] = value; else doc.alumnos.push(value);
    return;
  }
  if (k.startsWith('hb:')) {
    doc.habilitaciones = doc.habilitaciones || {};
    if (value === undefined) delete doc.habilitaciones[entidadRaw]; else doc.habilitaciones[entidadRaw] = value;
    return;
  }
  if (k.startsWith('v:')) {
    doc.vistas = doc.vistas || {};
    if (value === undefined) delete doc.vistas[entidadRaw]; else doc.vistas[entidadRaw] = value;
    return;
  }
  if (k.startsWith('as:')) {
    doc.asistencia = doc.asistencia || {};
    const [claseId, alumnoId] = entidadRaw.split('|');
    doc.asistencia[claseId] = doc.asistencia || {};
    doc.asistencia[claseId] = doc.asistencia[claseId] || {};
    if (value === undefined) delete doc.asistencia[claseId][alumnoId];
    else doc.asistencia[claseId][alumnoId] = value;
    return;
  }
  if (k.startsWith('p:') || k.startsWith('pd:')) {
    doc.practicas = doc.practicas || {};
    if (value === undefined) delete doc.practicas[k];
    else doc.practicas[k] = value;
    return;
  }
}

function filasDSDeDoc(doc) {
  const out = [];
  for (const u of doc.users || []) out.push({ k: 'u:' + u.id, value: u });
  for (const a of doc.alumnos || []) out.push({ k: 'a:' + a.id, value: a });
  for (const [k, v] of Object.entries(doc.habilitaciones || {})) out.push({ k: 'hb:' + k, value: v });
  for (const [k, v] of Object.entries(doc.vistas || {})) out.push({ k: 'v:' + k, value: v });
  for (const [claseId, alumnosMap] of Object.entries(doc.asistencia || {})) {
    for (const [alumnoId, v] of Object.entries(alumnosMap || {})) out.push({ k: 'as:' + claseId + '|' + alumnoId, value: v });
  }
  for (const [k, v] of Object.entries(doc.practicas || {})) out.push({ k, value: v });
  if (doc.refreshTokens) out.push({ k: 'tokens', value: doc.refreshTokens });
  return out;
}

function seedDocVacio() {
  return { users: [], alumnos: [], habilitaciones: {}, asistencia: {}, vistas: {}, practicas: {}, refreshTokens: [] };
}

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
    },
    async getRow(k) {
      return this.getImpl().getRow(k);
    },
    async setRow(k, value) {
      return this.getImpl().setRow(k, value);
    },
    async removeRow(k) {
      return this.getImpl().removeRow(k);
    },
    async listRows(prefix) {
      return this.getImpl().listRows(prefix);
    },
    async nextNumber(seqKey, start) {
      return this.getImpl().nextNumber(seqKey, start);
    }
  };
})();

function getStore() {
  return config.databaseUrl ? pgStore : jsonStore;
}

module.exports = { getStore, jsonStore, pgStore };