'use strict';

let catalogo = null;
let filtro = 'todas';

function tipoLabel(tipo) {
  if (tipo === 'capacitacion') return 'Capacitacion';
  if (tipo === 'extras') return 'Extra';
  if (tipo === 'herramientas') return 'Herramienta';
  return 'Curso';
}

function renderChips() {
  const tipos = { todas: 'Todas' };
  catalogo.capacitaciones.forEach((c) => {
    tipos[c.tipo] = tipoLabel(c.tipo);
  });
  const chips = document.getElementById('chips');
  chips.innerHTML = '';
  Object.entries(tipos).forEach(([t, label]) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (t === filtro ? ' active' : '');
    b.textContent = label;
    b.addEventListener('click', () => {
      filtro = t;
      renderGrid();
      chips.querySelectorAll('.chip').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
    });
    chips.appendChild(b);
  });
}

function renderGrid() {
  const grid = document.getElementById('grid');
  const empty = document.getElementById('empty');
  grid.innerHTML = '';
  const cursos = catalogo.capacitaciones.filter((c) => filtro === 'todas' || c.tipo === filtro);
  empty.classList.toggle('hidden', cursos.length > 0);

  cursos.forEach((c) => {
    const card = document.createElement('div');
    card.className = 'card-curso';
    card.tabIndex = 0;
    card.setAttribute('role', 'link');
    card.innerHTML =
      `<span class="band" style="background:${esc(c.color)}"></span>` +
      `<span class="badge-tipo">${esc(tipoLabel(c.tipo))}</span>` +
      `<span class="emoji" aria-hidden="true">${c.emoji}</span>` +
      `<span class="nombre">${esc(c.nombre)}</span>` +
      `<span class="stats">` +
      `  <span>📚 ${c.stats.clases} clases</span>` +
      `  <span>📎 ${c.stats.archivos} archivos</span>` +
      `  <span>💾 ${(c.stats.tamanoMB || 0).toFixed(0)} MB</span>` +
      `</span>`;
    const ir = () => (location.href = `/curso?id=${encodeURIComponent(c.id)}`);
    card.addEventListener('click', ir);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        ir();
      }
    });
    grid.appendChild(card);
  });
}

// ── Búsqueda global a través de la API ──────────────────────────────────────
let searchTimer = null;
async function search(q) {
  const term = (q || '').trim();
  const results = document.getElementById('results');
  const list = document.getElementById('resultList');
  const grid = document.getElementById('grid');

  if (term.length < 2) {
    results.classList.add('hidden');
    grid.classList.remove('hidden');
    return;
  }

  try {
    const res = await apiFetch(`/buscar?q=${encodeURIComponent(term)}`);
    if (!res.ok) {
      if (res.status === 401) return logout();
      throw new Error('Error en la busqueda');
    }
    const data = await res.json();
    grid.classList.add('hidden');
    list.innerHTML = '';
    if (!data.resultados || data.resultados.length === 0) {
      list.innerHTML = '<div class="empty">Sin resultados. Probá con otro termino.</div>';
    } else {
      data.resultados.forEach((r) => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.tabIndex = 0;
        const fichas = r.archivosHits || [];
        const preview = fichas.length > 0 ? `Coincide en: ${esc(fichas[0].nombre)}` : r.clase.titulo;
        item.innerHTML =
          `<span class="f-emoji" aria-hidden="true">📘</span>` +
          `<span class="meta"><b>${esc(r.clase.titulo)}</b><small>${esc(r.curso)} · ${esc(r.modulo)} · ${esc(preview)}</small></span>` +
          `<span class="go" aria-hidden="true">→</span>`;
        item.addEventListener('click', () => (location.href = `/clase?id=${encodeURIComponent(r.clase.id)}`));
        item.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') location.href = `/clase?id=${encodeURIComponent(r.clase.id)}`;
        });
        list.appendChild(item);
      });
    }
    results.classList.remove('hidden');
  } catch (err) {
    toast(err.message);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth(localStorage.getItem('itc_clases_nombre'))) return;
  try {
    const res = await apiFetch('/catalogo');
    if (res.status === 401) return logout();
    if (!res.ok) throw new Error('No se pudo cargar el catalogo');
    catalogo = await res.json();
    document.getElementById('loading').classList.add('hidden');
    renderChips();
    renderGrid();
  } catch (err) {
    toast(err.message);
    document.getElementById('loading').classList.add('hidden');
    document.getElementById('empty').classList.remove('hidden');
    document.getElementById('empty').textContent = err.message;
  }

  const input = document.getElementById('searchInput');
  input.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => search(input.value.trim()), 250);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.value = '';
      search('');
    }
  });
});