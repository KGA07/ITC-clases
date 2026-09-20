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
  const user = data.users.find((u) => u.nombre === nombre && (u.tipo === 'profesor' || u.tipo === 'admin'));
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Credenciales incorrectas.' });
  }

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

  const user = data.users.find((u) => u.id === payload.id);
  if (!user) return res.status(401).json({ error: 'Usuario inexistente.' });

  // Rotación: invalidar el refresh usado y emitir uno nuevo
  data[REFRESH_TOKEN_KEY] = rts.filter((t) => t.tokenId !== payload.tokenId);
  const newTokenId = uuidv4();
  data[REFRESH_TOKEN_KEY].push({ userId: user.id, tokenId: newTokenId });
  await db.saveData();

  res.json({
    token: signAccess(user),
    refreshToken: signRefresh(user, newTokenId)
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