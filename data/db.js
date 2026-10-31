'use strict';
const bcrypt = require('bcryptjs');
const config = require('../config');
const { getStore } = require('./storage');

let memoryDB = null;
let initPromise = null;
const store = getStore();
const esPostgres = store.name === 'postgres';

// Migraciones idempotentes que se aplican a documentos antiguos.
function migrar(memoryDoc) {
  let cambio = false;
  if (!memoryDoc) return cambio;
  if (!Array.isArray(memoryDoc.alumnos)) { memoryDoc.alumnos = []; cambio = true; }
  if (!memoryDoc.habilitaciones || typeof memoryDoc.habilitaciones !== 'object') { memoryDoc.habilitaciones = {}; cambio = true; }
  if (!memoryDoc.asistencia || typeof memoryDoc.asistencia !== 'object') { memoryDoc.asistencia = {}; cambio = true; }
  for (const u of memoryDoc.users || []) {
    if (u.nombre === config.profesorUser && u.tipo !== 'admin') { u.tipo = 'admin'; cambio = true; }
    // migracion multi-curso: docentes pasan de curso (string) a cursos (array)
    if (u.tipo !== 'admin' && !Array.isArray(u.cursos)) { u.cursos = u.curso ? [u.curso] : []; cambio = true; }
    if (u.tipo !== 'admin' && Array.isArray(u.cursos)) {
      if (!u.curso && u.cursos.length) { u.curso = u.cursos[0]; cambio = true; }
      if (u.curso && !u.cursos.includes(u.curso)) { u.cursos.unshift(u.curso); cambio = true; }
    }
  }
  // migracion multi-curso: alumnos pasan de curso (string) a cursos (array)
  for (const a of memoryDoc.alumnos || []) {
    if (!Array.isArray(a.cursos)) { a.cursos = a.curso ? [a.curso] : []; cambio = true; }
    if (!a.curso && a.cursos.length) { a.curso = a.cursos[0]; cambio = true; }
    if (a.curso && !a.cursos.includes(a.curso)) { a.cursos.unshift(a.curso); cambio = true; }
  }
  return cambio;
}

// Sembrar cuando el store esta vacio.
async function asegurarSeed() {
  if (memoryDB) return;
  memoryDB = seedData();
  await store.save(memoryDB);
}

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
  if (esPostgres) {
    // Produccion serverless: SIEMPRE leer del store. Cada instancia de lambda
    // tiene su propia memoria; congelar el documento al arrancar hace que dos
    // instancias vean datos distintos (alumnos "que desaparecen", ids
    // duplicados y 404 "Alumno no encontrado."). Leyendo fresco en cada pedido
    // (y actualizando memoryDB para que saveData persista el mismo objeto) las
    // instancias quedan consistentes.
    const loaded = await store.load();
    if (loaded) {
      memoryDB = loaded;
      const cambio = migrar(memoryDB);
      if (cambio) await store.save(memoryDB);
    } else {
      await asegurarSeed();
    }
    return memoryDB;
  }
  // Archivo local (dev/demo, un solo proceso): memo de por vida del proceso.
  if (memoryDB) return memoryDB;
  if (!initPromise) {
    initPromise = (async () => {
      const loaded = await store.load();
      if (loaded) {
        memoryDB = loaded;
        const cambio = migrar(memoryDB);
        if (cambio) await store.save(memoryDB);
      } else {
        await asegurarSeed();
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