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
      tipo: 'profesor',
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

function getStorageInfo() {
  return { name: store.name, databaseUrl: !!config.databaseUrl };
}

module.exports = {
  loadData,
  saveData,
  resetDB,
  getNextId,
  seedData,
  getStorageInfo
};