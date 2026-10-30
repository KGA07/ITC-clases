'use strict';
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const db = require('../data/db');
const { signAccess, signRefresh, verifyRefresh } = require('../middleware/auth');

const REFRESH_TOKEN_KEY = 'refreshTokens';
const uuidv4 = crypto.randomUUID;

// ── Login ──────────────────────────────────────────────────────────────────
async function login(req, res) {
  const { nombre, password } = req.body;
  const data = await db.loadData();
  const docente = data.users.find((u) => u.nombre === nombre && (u.tipo === 'profesor' || u.tipo === 'admin'));
  const alumno = data.alumnos.find((a) => a.usuario === nombre);
  const user = docente
    ? { ...docente, _hash: docente.password }
    : alumno
      ? { id: alumno.id, nombre: alumno.usuario, tipo: 'alumno', nombre_completo: alumno.nombre_completo, _hash: alumno.password }
      : null;
  if (!user || !bcrypt.compareSync(password, user._hash)) {
    return res.status(401).json({ error: 'Credenciales incorrectas.' });
  }
  delete user._hash;

  const accessToken = signAccess(user);
  const tokenId = uuidv4();
  const refreshToken = signRefresh(user, tokenId);

  data[REFRESH_TOKEN_KEY] = data[REFRESH_TOKEN_KEY] || [];
  data[REFRESH_TOKEN_KEY] = data[REFRESH_TOKEN_KEY].filter((t) => t.userId !== user.id).slice(-4);
  data[REFRESH_TOKEN_KEY].push({ userId: user.id, tokenId });

  await db.saveData();

  res.json({
    token: accessToken,
    refreshToken,
    tipo: user.tipo,
    nombre: user.nombre,
    nombre_completo: user.nombre_completo
  });
}

// ── Refresh token ──────────────────────────────────────────────────────────
async function refresh(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token requerido.' });

  const payload = verifyRefresh(refreshToken);
  if (!payload) return res.status(401).json({ error: 'Refresh token invalido.' });

  const data = await db.loadData();
  const rts = data[REFRESH_TOKEN_KEY] || [];
  const stored = rts.find((t) => t.tokenId === payload.tokenId);
  if (!stored || stored.userId !== payload.id) {
    return res.status(401).json({ error: 'Refresh token invalido.' });
  }

  const esAlumno = String(payload.id || '').startsWith('a');
  const alumno = esAlumno ? data.alumnos.find((a) => String(a.id) === String(payload.id)) : null;
  const user = esAlumno
    ? (alumno
      ? { id: alumno.id, nombre: alumno.usuario, tipo: 'alumno', nombre_completo: alumno.nombre_completo }
      : null)
    : data.users.find((u) => u.id === payload.id);
  if (!user) return res.status(401).json({ error: 'Usuario inexistente.' });

  // Rotación: invalidar el refresh usado y emitir uno nuevo
  data[REFRESH_TOKEN_KEY] = rts.filter((t) => t.tokenId !== payload.tokenId);
  const newTokenId = uuidv4();
  data[REFRESH_TOKEN_KEY].push({ userId: user.id, tokenId: newTokenId });
  await db.saveData();

  res.json({
    token: signAccess(user),
    refreshToken: signRefresh(user, newTokenId),
    tipo: user.tipo
  });
}

// ── Logout ─────────────────────────────────────────────────────────────────
async function logout(req, res) {
  const { refreshToken } = req.body;
  if (refreshToken) {
    const payload = verifyRefresh(refreshToken);
    if (payload) {
      const data = await db.loadData();
      data[REFRESH_TOKEN_KEY] = (data[REFRESH_TOKEN_KEY] || []).filter((t) => t.tokenId !== payload.tokenId);
      await db.saveData();
    }
  }
  res.json({ ok: true });
}

module.exports = { login, refresh, logout };