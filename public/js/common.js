/* exported
  API, EVALUACIONES_URL, TOKEN_KEY,
  getToken, getRefresh, setTokens, clearTokens, isAuthed,
  apiFetch, postLogin, tryRefresh, logout,
  applyPreferences, toggleTheme, fmtSize, esc, toast, renderHeader, requireAuth
*/
'use strict';
// Utilidades compartidas de ITC Clases (frontend vanilla).

const API = '/api';
const TOKEN_KEY = 'itc_clases_token';
const REFRESH_KEY = 'itc_clases_refresh';
const EVALUACIONES_URL = (window.ITC_CONFIG && window.ITC_CONFIG.evaluacionesUrl) || '/';

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function getRefresh() {
  return localStorage.getItem(REFRESH_KEY);
}
function setTokens(token, refresh) {
  localStorage.setItem(TOKEN_KEY, token);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}
function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}
function isAuthed() {
  return !!getToken();
}

// Llamada a la API con reintento automático por refresh token.
async function apiFetch(path, options = {}) {
  const opts = { ...options };
  opts.headers = { ...(opts.headers || {}), Authorization: `Bearer ${getToken()}` };
  let res = await fetch(`${API}${path}`, opts);

  if (res.status === 401 && getRefresh()) {
    const ok = await tryRefresh();
    if (ok) {
      opts.headers.Authorization = `Bearer ${getToken()}`;
      res = await fetch(`${API}${path}`, opts);
    }
  }
  return res;
}

async function postLogin(path, body) {
  return fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

async function tryRefresh() {
  try {
    const res = await postLogin('/refresh', { refreshToken: getRefresh() });
    if (!res.ok) {
      clearTokens();
      return false;
    }
    const data = await res.json();
    setTokens(data.token, data.refreshToken);
    return true;
  } catch {
    clearTokens();
    return false;
  }
}

async function logout() {
  try {
    await postLogin('/logout', { refreshToken: getRefresh() });
  } catch {
    /* noop */
  }
  clearTokens();
  location.href = '/';
}

// ── Tema y tamaño de letra ──────────────────────────────────────────────────
function applyPreferences() {
  const theme = localStorage.getItem('theme') || 'light';
  const fontSize = parseInt(localStorage.getItem('fontSize') || '100', 10);
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.fontSize = fontSize;
  document.documentElement.style.fontSize = `${fontSize}%`;
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  const next = current === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', next);
  applyPreferences();
  const btn = document.getElementById('themeToggle');
  if (btn) btn.setAttribute('aria-pressed', next === 'dark');
}

// ── Utilidades de formato ───────────────────────────────────────────────────
function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return '';
  const mb = bytes / 1048576;
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  if (kb >= 1) return `${kb.toFixed(0)} KB`;
  return `${bytes} B`;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toast(msg) {
  let t = document.querySelector('.toast');
  if (!t) {
    t = document.createElement('div');
    t.className = 'toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ── Barra superior compartida ───────────────────────────────────────────────
function renderHeader(nombre = '') {
  const el = document.getElementById('topbar');
  if (!el) return;
  el.innerHTML =
    '<div class="topbar-inner">' +
    '  <a class="brand" href="/inicio" aria-label="ITC Clases - inicio">' +
    '    <img src="/img/logo-itc.svg" alt="ITC">' +
    '    <img src="/img/logo-udemm.svg" alt="UdeMM">' +
    '    <div class="brand-divider" aria-hidden="true"></div>' +
    '    <span class="brand-title"><span>ITC Aula Virtual</span><small>Clases y materiales</small></span>' +
    '  </a>' +
    '  <div class="topbar-right">' +
    `    <a class="link-eval" href="${esc(EVALUACIONES_URL)}" target="_blank" rel="noopener">📝 Evaluaciones</a>` +
    (nombre ? `    <span class="user-chip"><span class="dot" aria-hidden="true"></span>${esc(nombre)}</span>` : '') +
    '    <button class="icon-btn" id="themeToggle" type="button" title="Cambiar tema">🌓</button>' +
    '  </div>' +
    '</div>';

  const tt = document.getElementById('themeToggle');
  if (tt) {
    tt.addEventListener('click', toggleTheme);
    tt.setAttribute('aria-pressed', document.documentElement.dataset.theme === 'dark');
  }
}

function requireAuth(nombre = '') {
  if (!isAuthed()) {
    location.href = '/';
    return false;
  }
  renderHeader(nombre || (localStorage.getItem('itc_clases_nombre') || ''));
  return true;
}

if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

document.addEventListener('DOMContentLoaded', () => {
  applyPreferences();
});