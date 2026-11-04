'use strict';
const bcrypt = require('bcryptjs');
const config = require('../config');
const { getStore } = require('./storage');

let memoryDB = null;
let initPromise = null;
const store = getStore();
const esPostgres = store.name === 'postgres';

// ── Utilidades (compat) ─────────────────────────────────────────────────────
function getNextId(arr) {
  return arr.length > 0 ? Math.max(...arr.map((x) => x.id)) + 1 : 1;
}

// Los alumnos usan id string ("a1", "a2", …)
function nextAlumnoId(alumnos) {
  let max = 0;
  for (const a of alumnos) {
    const m = /^a(\d+)$/.exec(String(a.id));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `a${max + 1}`;
}

// ── Migraciones sobre un doc completo (idempotentes) ────────────────────────
function migrar(memoryDoc) {
  let cambio = false;
  if (!memoryDoc) return cambio;
  if (!Array.isArray(memoryDoc.alumnos)) { memoryDoc.alumnos = []; cambio = true; }
  if (!memoryDoc.habilitaciones || typeof memoryDoc.habilitaciones !== 'object') { memoryDoc.habilitaciones = {}; cambio = true; }
  if (!memoryDoc.asistencia || typeof memoryDoc.asistencia !== 'object') { memoryDoc.asistencia = {}; cambio = true; }
  if (!memoryDoc.vistas || typeof memoryDoc.vistas !== 'object') { memoryDoc.vistas = {}; cambio = true; }
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

// ── Alta de filas base (por entidad, claves u:/a:/hb:/as:/v:/tokens) ───────
// Sincroniza el doc semilla hacia el modelo por filas. Idempotente: si ya hay
// fila por esa id no se reescribe, así una lambda que llega tarde no pisa.
async function sembrarPorFilas(legado) {
  const filasUsers = new Set((await store.listRows('u:')).map((r) => r.k));
  for (const u of legado.users || []) {
    const k = 'u:' + u.id;
    if (!filasUsers.has(k)) await store.setRow(k, u);
  }
  const filasAl = new Set((await store.listRows('a:')).map((r) => r.k));
  for (const a of legado.alumnos || []) {
    const k = 'a:' + a.id;
    if (!filasAl.has(k)) await store.setRow(k, a);
  }
  const filasHb = new Set((await store.listRows('hb:')).map((r) => r.k));
  for (const [k, v] of Object.entries(legado.habilitaciones || {})) {
    if (!filasHb.has('hb:' + k)) await store.setRow('hb:' + k, v);
  }
  const filasAs = new Set((await store.listRows('as:')).map((r) => r.k));
  for (const [claseId, alumnosMap] of Object.entries(legado.asistencia || {})) {
    for (const [alumnoId, v] of Object.entries(alumnosMap || {})) {
      const k = `as:${claseId}|${alumnoId}`;
      if (!filasAs.has(k)) await store.setRow(k, v);
    }
  }
  const filasV = new Set((await store.listRows('v:')).map((r) => r.k));
  for (const [k, v] of Object.entries(legado.vistas || {})) {
    if (!filasV.has('v:' + k)) await store.setRow('v:' + k, v);
  }
  const tokensActuales = await store.getRow('tokens');
  if (!tokensActuales) await store.setRow('tokens', legado.refreshTokens || []);
  return { cambio: true };
}

// ── Datos iniciales (seed) ──────────────────────────────────────────────────
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
    vistas: {},
    refreshTokens: [],
    nextUserId: 3
  };
}

// ── Carga: arma el doc desde filas por entidad ──────────────────────────────
async function docDesdeFilas() {
  const rowsU = await store.listRows('u:');
  const rowsA = await store.listRows('a:');
  const rowsHb = await store.listRows('hb:');
  const rowsAs = await store.listRows('as:');
  const rowsV = await store.listRows('v:');
  const users = rowsU.reduce((acc, r) => {
    const u = r.value;
    if (u && !acc.some((x) => String(x.id) === String(u.id))) acc.push(migrarUsuario(u));
    return acc;
  }, []).sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
  const alumnos = rowsA.reduce((acc, r) => {
    const a = r.value;
    if (a && !acc.some((x) => String(x.id) === String(a.id))) acc.push(migrarAlumno(a));
    return acc;
  }, []).sort((a, b) => (parseInt(String(a.id).slice(1), 10) || 0) - (parseInt(String(b.id).slice(1), 10) || 0));
  const habilitaciones = {};
  for (const r of rowsHb) habilitaciones[r.k.slice(3)] = r.value;
  const asistencia = {};
  for (const r of rowsAs) {
    const entidadRaw = r.k.slice(3);
    const i = entidadRaw.indexOf('|');
    const claseId = entidadRaw.slice(0, i);
    const alumnoId = entidadRaw.slice(i + 1);
    asistencia[claseId] = asistencia[claseId] || {};
    asistencia[claseId][alumnoId] = r.value;
  }
  const vistas = {};
  for (const r of rowsV) vistas[r.k.slice(2)] = r.value;
  const refreshTokens = (await store.getRow('tokens')) || [];
  return {
    users,
    alumnos,
    habilitaciones,
    asistencia,
    vistas,
    refreshTokens
  };
}

function migrarUsuario(u) {
  migrar({ users: [u], alumnos: [], habilitaciones: {}, asistencia: {}, vistas: {} });
  return u;
}

function migrarAlumno(a) {
  migrar({ users: [], alumnos: [a], habilitaciones: {}, asistencia: {}, vistas: {} });
  return a;
}

async function seedAdmins() {
  const base = seedData();
  await sembrarPorFilas(base);
  await store.nextNumber('seq:users', base.nextUserId || 3);
  const maxAl = base.alumnos.reduce((m, a) => Math.max(m, parseInt(String(a.id).slice(1), 10) || 0), 0);
  await store.nextNumber('seq:alumnos', maxAl + 1);
}

// ── loadData: carga fresca en cada pedido (serverless) ─────────────────────
async function loadData() {
  if (esPostgres) {
    // Producción serverless: SIEMPRE leer del store. Cada instancia de lambda
    // tiene su propia memoria. Con el modelo POR ENTIDAD, cada guardar solo
    // toca su fila: dos lambdas concurrentes ya no se pisan datos ajenos.
    const legado = await store.getRow('doc');
    if (legado && legado.users) {
      // migración one-shot desde el doc completo hacia filas por entidad.
      await sembrarPorFilas(legado); // agrega entidades faltantes del doc viejo
      const contras = await docDesdeFilas();
      // próxima id por encima de todo lo existente (evita ids duplicados)
      const maxU = contras.users.reduce((m, u) => Math.max(m, Number(u.id) || 0), 2);
      await store.nextNumber('seq:users', Math.max(Number(legado.nextUserId) || 3, maxU + 1));
      const maxA = contras.alumnos.reduce((m, a) => {
        const x = /^a(\d+)$/.exec(String(a.id));
        return Math.max(m, x ? parseInt(x[1], 10) : 0);
      }, 0);
      await store.nextNumber('seq:alumnos', maxA + 1);
      // respaldo del formato anterior y baja de la fila "doc" para no remigrar
      await store.setRow('doc:backup-2026-11-02', legado);
      await store.removeRow('doc');
      memoryDB = contras;
      return memoryDB;
    }
    const hayFilas = (await store.listRows('u:')).length > 0;
    if (!hayFilas) await seedAdmins();
    memoryDB = await docDesdeFilas();
    return memoryDB;
  }
  // Archivo local (dev/demo, un solo proceso): memo de por vida del proceso.
  if (memoryDB) return memoryDB;
  if (!initPromise) {
    initPromise = (async () => {
      const loaded = await store.load();
      if (loaded) {
        memoryDB = loaded;
        migrar(memoryDB);
      } else {
        memoryDB = seedData();
        await store.save(memoryDB);
      }
    })();
  }
  await initPromise;
  return memoryDB;
}

// ── ids atómicos (Postgres) / calculados (archivo) ──────────────────────────
async function proximoUserId(start) {
  if (esPostgres) return store.nextNumber('seq:users', start || 3);
  return getNextId(memoryDB.users);
}

async function proximoAlumnoId() {
  if (esPostgres) return 'a' + (await store.nextNumber('seq:alumnos', 1));
  return nextAlumnoId(memoryDB.alumnos);
}

// ── Escrituras por entidad: cada guardar toca SOLO su fila ──────────────────
async function addUser(user) {
  user.id = await proximoUserId(user.id);
  await store.setRow('u:' + user.id, user);
  // espejo en memoria (dev) para consistency inmediata
  if (!esPostgres && memoryDB) {
    const i = memoryDB.users.findIndex((u) => String(u.id) === String(user.id));
    if (i >= 0) memoryDB.users[i] = user; else memoryDB.users.push(user);
    memoryDB.nextUserId = user.id + 1;
  }
  return user;
}

async function saveUser(user) {
  await store.setRow('u:' + user.id, user);
  if (!esPostgres && memoryDB) {
    const i = memoryDB.users.findIndex((u) => String(u.id) === String(user.id));
    if (i >= 0) memoryDB.users[i] = user;
  }
}

async function deleteUser(id) {
  await store.removeRow('u:' + String(id));
  if (!esPostgres && memoryDB) {
    memoryDB.users = memoryDB.users.filter((u) => String(u.id) !== String(id));
  }
}

async function addAlumno(alumno) {
  alumno.id = await proximoAlumnoId();
  await store.setRow('a:' + alumno.id, alumno);
  if (!esPostgres && memoryDB) {
    const i = memoryDB.alumnos.findIndex((a) => String(a.id) === String(alumno.id));
    if (i >= 0) memoryDB.alumnos[i] = alumno; else memoryDB.alumnos.push(alumno);
  }
  return alumno;
}

async function saveAlumno(alumno) {
  await store.setRow('a:' + alumno.id, alumno);
  if (!esPostgres && memoryDB) {
    const i = memoryDB.alumnos.findIndex((a) => String(a.id) === String(alumno.id));
    if (i >= 0) memoryDB.alumnos[i] = alumno;
  }
}

async function deleteAlumno(id) {
  await store.removeRow('a:' + String(id));
  if (!esPostgres && memoryDB) {
    memoryDB.alumnos = memoryDB.alumnos.filter((a) => String(a.id) !== String(id));
  }
}

// habilitaciones: key = `${cursoId}::${claseId}`; null borra
async function setHabilitacion(key, value) {
  const k = 'hb:' + key;
  if (value === null || value === undefined) {
    await store.removeRow(k);
    if (!esPostgres && memoryDB && memoryDB.habilitaciones) delete memoryDB.habilitaciones[key];
  } else {
    await store.setRow(k, value);
    if (!esPostgres && memoryDB) {
      memoryDB.habilitaciones = memoryDB.habilitaciones || {};
      memoryDB.habilitaciones[key] = value;
    }
  }
}

// asistencia: una fila por (claseId|alumnoId); null borra la marca
async function setAsistencia(claseId, alumnoId, value) {
  const k = 'as:' + claseId + '|' + alumnoId;
  if (value === null || value === undefined) {
    await store.removeRow(k);
    if (!esPostgres && memoryDB && memoryDB.asistencia && memoryDB.asistencia[claseId]) {
      delete memoryDB.asistencia[claseId][alumnoId];
    }
  } else {
    await store.setRow(k, value);
    if (!esPostgres && memoryDB) {
      memoryDB.asistencia = memoryDB.asistencia || {};
      memoryDB.asistencia[claseId] = memoryDB.asistencia[claseId] || {};
      memoryDB.asistencia[claseId][alumnoId] = value;
    }
  }
}

// comision generales/data.vistas: mapa completa: { claseId: fechaISO }
async function setVistasMap(alumnoId, mapa) {
  await store.setRow('v:' + alumnoId, mapa || {});
  if (!esPostgres && memoryDB) {
    memoryDB.vistas = memoryDB.vistas || {};
    memoryDB.vistas[alumnoId] = mapa || {};
  }
}

async function loadTokens() {
  return (await store.getRow('tokens')) || [];
}

// ── Practicas del docente ──────────────────────────────────────────────────
// p:<claseId|id> = metadata liviana; pd:<id> = { d: base64 } del archivo.
// Igual que el resto de las entidades: un guardar toca SOLO sus propias filas.
async function proximaPracticaId() {
  if (esPostgres) return String(await store.nextNumber('seq:practicas', 1));
  let max = 0;
  for (const r of await store.listRows('pd:')) {
    const x = /^pd:(\d+)$/.exec(r.k);
    if (x) max = Math.max(max, parseInt(x[1], 10));
  }
  return String(max + 1);
}

async function addPractica(claseId, meta, dataB64) {
  const id = await proximaPracticaId();
  await store.setRow('p:' + claseId + '|' + id, Object.assign({}, meta, { id: String(id), claseId }));
  await store.setRow('pd:' + id, { d: String(dataB64 || '') });
  return String(id);
}

async function listPracticas() {
  const filas = [];
  for (const r of await store.listRows('p:')) {
    const k = r.k.slice(2);
    const i = k.indexOf('|');
    filas.push(Object.assign({ claseId: i >= 0 ? k.slice(0, i) : k }, r.value || {}));
  }
  return filas;
}

async function getPractica(id) {
  for (const p of await listPracticas()) {
    if (String(p.id) === String(id)) return p;
  }
  return null;
}

async function getPracticaData(id) {
  const fila = await store.getRow('pd:' + String(id));
  return (fila && fila.d) || '';
}

async function removePractica(id) {
  await store.removeRow('pd:' + String(id));
  for (const r of await store.listRows('p:')) {
    if (String((r.value && r.value.id) || '') === String(id)) await store.removeRow(r.k);
  }
}

async function saveTokens(list) {
  await store.setRow('tokens', list || []);
  if (!esPostgres && memoryDB) memoryDB.refreshTokens = list || [];
}

async function saveData() {
  if (memoryDB) await store.save(memoryDB);
}

async function resetDB() {
  if (esPostgres) {
    await seedAdmins();
    memoryDB = await docDesdeFilas();
    return;
  }
  memoryDB = seedData();
  await store.save(memoryDB);
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
  proximoUserId,
  proximoAlumnoId,
  addUser,
  saveUser,
  deleteUser,
  addAlumno,
  saveAlumno,
  deleteAlumno,
  setHabilitacion,
  setAsistencia,
  setVistasMap,
  loadTokens,
  saveTokens,
  addPractica,
  listPracticas,
  getPractica,
  getPracticaData,
  removePractica,
  seedData,
  getStorageInfo
};
