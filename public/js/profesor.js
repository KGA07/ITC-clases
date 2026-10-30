'use strict';
// Panel del profesor: habilitación de clases semana a semana + asistencia.
// Un alumno Ausente no ve la clase; una clase no habilitada tampoco.

let estado = null; // respuesta de /api/prof/panel
let claseAsisActual = '';

function initials(n) {
  return String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0].toUpperCase()).join('');
}
function fechaCorta(f) {
  if (!f) return '';
  const [y, m, d] = String(f).split('-');
  return `${d}/${m}/${y}`;
}
function clasePorId(id) {
  for (const m of (estado.curso || {}).modulos || []) {
    for (const cl of m.clases || []) if (cl.id === id) return cl;
  }
  return null;
}
function clasesEnOrden() {
  const out = [];
  for (const m of (estado.curso || {}).modulos || []) for (const cl of m.clases || []) out.push(cl);
  return out;
}

// ── carga ──────────────────────────────────────────────────────────────────
async function cargar() {
  try {
    const res = await apiFetch('/prof/panel');
    if (res.status === 401) return logout();
    if (!res.ok) throw new Error('No se pudo cargar el panel.');
    estado = await res.json();
    document.getElementById('pLoading').classList.add('hidden');
    if (!estado.curso) {
      document.getElementById('pSinCurso').classList.remove('hidden');
      document.getElementById('pDocenteNombre').textContent = estado.docente.nombre_completo || '';
      return;
    }
    document.getElementById('pContenido').classList.remove('hidden');
    document.getElementById('pDocenteNombre').textContent = estado.docente.nombre_completo || '';
    document.getElementById('pCursoLateral').textContent = `${estado.curso.emoji || ''} ${estado.nombreCurso}`;
    document.getElementById('pTituloCurso').textContent = `${estado.curso.emoji || ''} ${estado.nombreCurso}`;
    document.getElementById('pSubGeneral').textContent = `${clasesEnOrden().length} clases · ${estado.alumnos.length} alumnos`;
    renderGeneral();
    renderAlumnos();
    renderClases();
    renderAsistenciaSelect();
  } catch (e) {
    toast(e.message);
    document.getElementById('pLoading').classList.add('hidden');
  }
}

// ── Panel General ──────────────────────────────────────────────────────────
function clasesHabilitadasCount() {
  return Object.keys(estado.habilitaciones || {}).length;
}
function renderGeneral() {
  const total = clasesEnOrden().length;
  const hab = clasesHabilitadasCount();
  const proximas = clasesEnOrden().filter((cl) => !(estado.habilitaciones || {})[cl.id]).slice(0, 3);
  document.getElementById('pStats').innerHTML =
    `<div class="p-stat"><b>${estado.alumnos.length}</b><span>alumnos activos</span></div>` +
    `<div class="p-stat"><b>${hab}</b><span>clases habilitadas</span></div>` +
    `<div class="p-stat"><b>${Math.max(total - hab, 0)}</b><span>clases por habilitar</span></div>`;
  const rap = document.getElementById('pRapidas');
  rap.innerHTML = proximas.length
    ? proximas.map((cl, i) =>
      `<div class="p-card p-clase"><div class="p-num">${i + 1}</div>` +
      `<div class="p-clase-info"><b>${esc(cl.titulo)}</b><small>sin habilitar todavía</small></div>` +
      `<button type="button" class="btn btn-primary btn-sm" data-hab="${esc(cl.id)}">Habilitar</button></div>`).join('')
    : '<p class="sub">Todo habilitado. 👍</p>';
  rap.querySelectorAll('[data-hab]').forEach((b) => b.addEventListener('click', () => toggleHabilitacion(b.dataset.hab, true)));
}

// ── Mis Alumnos ────────────────────────────────────────────────────────────
function renderAlumnos() {
  const caja = document.getElementById('pListaAlumnos');
  document.getElementById('pSubAlumnos').textContent = `${estado.alumnos.length} alumnos del curso · entrada con usuario y contraseña en itc-clases.vercel.app`;
  caja.innerHTML = estado.alumnos.length
    ? estado.alumnos.map((a) =>
      `<div class="p-alumno"><span class="p-avatar">${esc(initials(a.nombre_completo))}</span>` +
      `<div><b>${esc(a.nombre_completo)}</b><small>${esc(a.usuario)}${a.horario ? ' · ' + esc(a.horario) : ''}<br>${esc(a.email || '')}${a.telefono ? ' · ' + esc(a.telefono) : ''}</small></div></div>`).join('')
    : '<p class="sub">Todavía no hay alumnos cargados en tu curso. El administrador los carga desde el gestor.</p>';
}

// ── Gestión de Clases ──────────────────────────────────────────────────────
function renderClases() {
  const caja = document.getElementById('pClasesModulos');
  caja.innerHTML = '';
  let n = 0;
  for (const mod of (estado.curso || {}).modulos || []) {
    const t = document.createElement('div');
    t.className = 'p-modulo-titulo';
    t.textContent = mod.titulo;
    caja.appendChild(t);
    const grid = document.createElement('div');
    grid.className = 'p-clase-grid';
    for (const cl of mod.clases || []) {
      n++;
      const hab = (estado.habilitaciones || {})[cl.id];
      const card = document.createElement('div');
      card.className = 'p-card p-clase';
      card.innerHTML =
        `<div class="p-num">${String(n).padStart(2, '0')}</div>` +
        `<div class="p-clase-info"><b>${esc(cl.titulo)}${hab ? ' <span class="p-chip-ok">✔</span>' : ''}</b>` +
        `<small>${cl.count} material(es)${hab ? ' · habilitada el ' + fechaCorta(hab) : ' · sin habilitar'}</small></div>` +
        `<div class="p-acciones-fila"><button type="button" class="btn btn-sm ${hab ? 'btn-deshab' : 'btn-primary'}" data-hab="${esc(cl.id)}">` +
        `${hab ? '🔒 Deshabilitar' : '🔓 Habilitar'}</button></div>`;
      grid.appendChild(card);
    }
    caja.appendChild(grid);
  }
  if (!n) caja.innerHTML = '<p class="sub">Este curso no tiene clases en el catálogo.</p>';
  caja.querySelectorAll('[data-hab]').forEach((b) => b.addEventListener('click', () => {
    const hab = (estado.habilitaciones || {})[b.dataset.hab];
    toggleHabilitacion(b.dataset.hab, !hab);
  }));
}

async function toggleHabilitacion(claseId, habilitada) {
  const res = await apiFetch('/prof/habilitacion', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ claseId, habilitada })
  });
  if (!res.ok) return toast((await res.json().catch(() => ({}))).error || 'No se pudo guardar.');
  estado.habilitaciones[claseId] = habilitada ? new Date().toISOString().slice(0, 10) : undefined;
  if (!habilitada) delete estado.habilitaciones[claseId];
  toast(habilitada ? '🔓 Clase habilitada: los alumnos la ven' : '🔒 Clase deshabilitada: oculta para los alumnos');
  renderGeneral();
  renderClases();
  llenarSelectAsistencia();
}

// ── Asistencia ─────────────────────────────────────────────────────────────
function llenarSelectAsistencia() {
  const sel = document.getElementById('pClaseAsis');
  const clases = clasesEnOrden();
  sel.innerHTML = clases.map((cl) => {
    const hab = (estado.habilitaciones || {})[cl.id];
    return `<option value="${esc(cl.id)}">${hab ? '✔' : '·'} ${esc(cl.titulo)}</option>`;
  }).join('');
  // default: la última habilitada; si no hay ninguna, la primera
  const habs = clases.filter((cl) => (estado.habilitaciones || {})[cl.id]);
  const def = habs.length ? habs[habs.length - 1].id : (clases[0] ? clases[0].id : '');
  if (def) sel.value = def;
  renderAsistencia();
}

function renderAsistenciaSelect() { llenarSelectAsistencia(); }

function renderAsistencia() {
  const id = document.getElementById('pClaseAsis').value;
  claseAsisActual = id;
  const caja = document.getElementById('pListaAsistencia');
  const marcas = (estado.asistencia || {})[id] || {};
  let p = 0, a = 0;
  caja.innerHTML = estado.alumnos.length ? '' : '<p class="sub">Sin alumnos cargados todavía.</p>';
  estado.alumnos.forEach((al) => {
    const m = marcas[al.id];
    const estadoM = m ? m.estado : '';
    if (estadoM === 'presente') p++;
    if (estadoM === 'ausente') a++;
    const fila = document.createElement('div');
    fila.className = 'p-asist-fila' + (estadoM === 'ausente' ? ' ausente' : estadoM === 'presente' ? '' : ' sin-marca');
    fila.innerHTML =
      `<span class="p-avatar">${esc(initials(al.nombre_completo))}</span>` +
      `<span class="p-asist-nombre"><b>${esc(al.nombre_completo)}</b><small>${esc(al.dia || '')}${al.horario ? ' ' + esc(al.horario) : ''}${m ? ` · marcado el ${fechaCorta(m.fecha)}` : ' · sin marcar'}</small></span>` +
      `<button type="button" class="btn btn-sm btn-pres ${estadoM === 'presente' ? 'sel' : ''}" data-al="${esc(al.id)}" data-est="presente">✓ Presente</button>` +
      `<button type="button" class="btn btn-sm btn-aus ${estadoM === 'ausente' ? 'sel' : ''}" data-al="${esc(al.id)}" data-est="ausente">✖ Ausente</button>`;
    caja.appendChild(fila);
  });
  document.getElementById('pCountP').textContent = `✔ ${p} presentes`;
  document.getElementById('pCountA').textContent = `✖ ${a} ausentes`;
  caja.querySelectorAll('[data-al]').forEach((b) => b.addEventListener('click', async () => {
    const marca = marcas[b.dataset.al];
    // clic en el mismo estado → sin-marcar (desmarcar)
    const nuevo = marca && marca.estado === b.dataset.est ? 'sin-marcar' : b.dataset.est;
    const res = await apiFetch('/prof/asistencia', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claseId: claseAsisActual, alumnoId: b.dataset.al, estado: nuevo })
    });
    if (!res.ok) return toast((await res.json().catch(() => ({}))).error || 'No se pudo guardar.');
    estado.asistencia[claseAsisActual] = estado.asistencia[claseAsisActual] || {};
    if (nuevo === 'sin-marcar') delete estado.asistencia[claseAsisActual][b.dataset.al];
    else estado.asistencia[claseAsisActual][b.dataset.al] = { estado: nuevo, fecha: new Date().toISOString().slice(0, 10) };
    if (nuevo === 'ausente') toast('✖ Ausente: ese alumno no ve esta clase');
    if (nuevo === 'presente') toast('✓ Presente registrado');
    renderAsistencia();
  }));
}

// ── nav + boot ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  if (!requireAuth('')) return;
  const tipo = localStorage.getItem('itc_clases_tipo');
  if (tipo === 'alumno') return (location.href = '/alumno');
  if (tipo !== 'profesor') return (location.href = '/gestor');

  document.querySelectorAll('.p-nav-item').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.p-nav-item').forEach((x) => x.classList.remove('activo'));
    b.classList.add('activo');
    document.querySelectorAll('section[data-panel]').forEach((s) => s.classList.toggle('hidden', s.dataset.panel !== b.dataset.sec));
  }));

  const salir = () => logout();
  document.getElementById('pLogout').addEventListener('click', salir);
  const l2 = document.getElementById('pLogout2');
  if (l2) l2.addEventListener('click', salir);

  document.getElementById('pClaseAsis').addEventListener('change', renderAsistencia);
  cargar();
});
