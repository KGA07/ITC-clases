'use strict';
const bcrypt = require('bcryptjs');
const config = require('../config');
const { getStore } = require('./storage');

let memoryDB = null;
let initPromise = null;
const store = getStore();

// ── Datos iniciales ──────────────────────────────────────────────────────────
function seedData() {
  const hash = (v) => bcrypt.hashSync(v, 10);
  const users = [
    {
      id: 1,
      nombre: config.profesorUser,
      password: hash(config.profesorPassword),
      tipo: 'admin',
      nombre_completo: config.profesorNombre
    }
  ];

  if (config.adminUser && config.adminPassword) {
    users.push({
      id: 2,
      nombre: config.adminUser,
      password: hash(config.adminPassword),
      tipo: 'admin',
      nombre_completo: config.adminNombre
    });
  }

  return {
    users,
    alumnos: [],
    habilitaciones: {},
    asistencia: {},
    refreshTokens: [],
    nextUserId: 3
  };
}

async function loadData() {
  if (memoryDB) return memoryDB;
  if (!initPromise) {
    initPromise = (async () => {
      const loaded = await store.load();
        if (loaded) {
        memoryDB = loaded;
        // migración: bases creadas antes del módulo de alumnos
        if (!Array.isArray(memoryDB.alumnos)) memoryDB.alumnos = [];
        // migración: módulo aula (habilitaciones + asistencia) y GKempe como admin
        let cambio = false;
        if (!memoryDB.habilitaciones || typeof memoryDB.habilitaciones !== 'object') { memoryDB.habilitaciones = {}; cambio = true; }
        if (!memoryDB.asistencia || typeof memoryDB.asistencia !== 'object') { memoryDB.asistencia = {}; cambio = true; }
        for (const u of memoryDB.users || []) {
          if (u.nombre === config.profesorUser && u.tipo !== 'admin') { u.tipo = 'admin'; cambio = true; }
        }
        if (cambio) await store.save(memoryDB);
      } else {
        memoryDB = seedData();
        await store.save(memoryDB);
      }
    })();
  }
  await initPromise;
  return memoryDB;
}

async function saveData() {
  if (memoryDB) await store.save(memoryDB);
}

async function resetDB() {
  memoryDB = seedData();
  initPromise = null;
  await saveData();
}

function getNextId(arr) {
  return arr.length > 0 ? Math.max(...arr.map((x) => x.id)) + 1 : 1;
}

// Los alumnos usan id string ("a1", "a2", …): calcular el próximo sin colisionar
function nextAlumnoId(alumnos) {
  let max = 0;
  for (const a of alumnos) {
    const m = /^a(\d+)$/.exec(String(a.id));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `a${max + 1}`;
}

function getStorageInfo() {
  return { name: store.name, databaseUrl: !!config.databaseUrl };
}

module.exports = {
  loadData,
  saveData,
  resetDB,
  getNextId,
  nextAlumnoId,
  seedData,
  getStorageInfo
};