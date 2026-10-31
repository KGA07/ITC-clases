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
  const lista = (estado.cursosDetalle && estado.cursosDetalle.length) ? estado.cursosDetalle : [{ curso: estado.curso }];
  for (const c of lista) for (const m of (c.curso || {}).modulos || []) for (const cl of m.clases || []) out.push(cl);
  return out;
}

// ── carga ──────────────────────────────────────────────────────────────────
async function cargar(cursoId = '') {
  try {
    const res = await apiFetch('/prof/panel' + (cursoId ? `?curso=${encodeURIComponent(cursoId)}` : ''));
    if (res.status === 401) return logout();
    if (!res.ok) throw new Error('No se pudo cargar el panel.');
    estado = await res.json();
    document.getElementById('pLoading').classList.add('hidden');
    if (!estado.curso) {
      document.getElementById('pSinCurso').classList.remove('hidden');
      document.getElementById('pDocenteNombre').textContent = estado.docente.nombre_completo || '';
      const pN0 = document.getElementById('pPreviewNombre');
      if (pN0) pN0.textContent = estado.docente.nombre_completo || '';
      return;
    }
    document.getElementById('pContenido').classList.remove('hidden');
    document.getElementById('pDocenteNombre').textContent = estado.docente.nombre_completo || '';
    const pN = document.getElementById('pPreviewNombre');
    if (pN) pN.textContent = estado.docente.nombre_completo || '';
    document.getElementById('pCursoLateral').textContent = `${estado.curso.emoji || ''} ${estado.nombreCurso}`;
    document.getElementById('pTituloCurso').textContent = `${estado.curso.emoji || ''} ${estado.nombreCurso}`;

    // selector de curso si el docente tiene varios
    const selCurso = document.getElementById('pCursoSel');
    const varios = (estado.cursosAsignados || []).length > 1;
    if (selCurso && varios) {
      selCurso.classList.remove('hidden');
      const valor = estado.docente.curso;
      selCurso.innerHTML = (estado.cursosAsignados || [])
        .map((c) => `<option value="${esc(c.id)}" ${c.id === valor ? 'selected' : ''}>${esc(c.emoji || '')} ${esc(c.nombre)}</option>`)
        .join('');
    } else if (selCurso) {
      selCurso.classList.add('hidden');
    }

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

/* Una tarjeta de clase (compartida por Panel General y Gestión de Clases) */
function cardClase(cl, n) {
  const hab = (estado.habilitaciones || {})[cl.id];
  const card = document.createElement('div');
  card.className = 'p-card p-clase';
  card.innerHTML =
    `<div class="p-num">${String(n).padStart(2, '0')}</div>` +
    `<div class="p-clase-info"><b>${esc(cl.titulo)}${hab ? ' <span class="p-chip-ok">✔</span>' : ''}</b>` +
    `<small>${cl.count} material(es)${hab ? ' · habilitada el ' + fechaCorta(hab) : ' · sin habilitar'}</small></div>` +
    `<div class="p-acciones-fila">` +
    `<button type="button" class="btn btn-sm btn-ghost" data-ver="${esc(cl.id)}" title="Ver los materiales de esta clase">📚 Ver</button>` +
    `<button type="button" class="btn btn-sm btn-ghost" data-pres="${esc(cl.id)}" title="Proyectar la presentación a pantalla completa">▶ Presentar</button>` +
    `<button type="button" class="btn btn-sm ${hab ? 'btn-deshab' : 'btn-primary'}" data-hab="${esc(cl.id)}">` +
    `${hab ? '🔒 Deshabilitar' : '🔓 Habilitar'}</button></div>`;
  return card;
}

/* Panel General: muestra SOLO los cursos del docente (resumen + botón para
   gestionar sus clases en la sección "Gestión de Clases"). No despliega la
   lista completa de clases acá. */
function pintarCursosPanel(caja) {
  caja.innerHTML = '';
  const lista = (estado.cursosDetalle && estado.cursosDetalle.length)
    ? estado.cursosDetalle
    : (estado.curso ? [{ id: estado.curso.id, nombre: estado.nombreCurso, emoji: estado.curso.emoji, color: estado.curso.color, curso: estado.curso }] : []);
  if (!lista.length) { caja.innerHTML = '<p class="sub">Sin cursos asignados todavía.</p>'; return; }
  const grid = document.createElement('div');
  grid.className = 'p-cursos-grid';
  for (const c of lista) {
    const clasesCurso = (c.curso && c.curso.modulos) ? c.curso.modulos.reduce((n, m) => n + (m.clases || []).length, 0) : 0;
    const habCurso = Object.keys(estado.habilitaciones || {}).filter((id) => {
      return (c.curso && c.curso.modulos) && c.curso.modulos.some((m) => (m.clases || []).some((cl) => cl.id === id));
    }).length;
    const card = document.createElement('div');
    card.className = 'p-card p-curso-card';
    card.innerHTML =
      `<div class="p-curso-emoji" aria-hidden="true">${esc(c.emoji || '')}</div>` +
      `<div class="p-curso-info"><b>${esc(c.nombre)}</b><small>${clasesCurso} clase${clasesCurso === 1 ? '' : 's'} · ${habCurso} habilitada${habCurso === 1 ? '' : 's'}</small></div>` +
      `<button type="button" class="btn btn-primary btn-sm" data-curso="${esc(c.id)}">📖 Gestionar clases</button>`;
    grid.appendChild(card);
  }
  caja.appendChild(grid);
  caja.querySelectorAll('[data-curso]').forEach((b) => b.addEventListener('click', () => {
    const sel = document.getElementById('pCursoSel');
    if (sel) { sel.value = b.dataset.curso; sel.dispatchEvent(new Event('change')); }
    const nav = document.querySelector('[data-sec=clases]');
    if (nav) nav.click();
  }));
}

function renderGeneral() {
  const total = clasesEnOrden().length;
  const hab = clasesHabilitadasCount();
  document.getElementById('pStats').innerHTML =
    `<div class="p-stat"><b>${estado.alumnos.length}</b><span>alumnos activos</span></div>` +
    `<div class="p-stat"><b>${hab}</b><span>clases habilitadas</span></div>` +
    `<div class="p-stat"><b>${Math.max(total - hab, 0)}</b><span>clases por habilitar</span></div>`;
  pintarCursosPanel(document.getElementById('pRapidas'));
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
/* Gestión de Clases: un solo curso (el activo), con sus clases. */
function pintarClases(caja) {
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
      grid.appendChild(cardClase(cl, n));
    }
    caja.appendChild(grid);
  }
  if (!n) caja.innerHTML = '<p class="sub">Este curso no tiene clases en el catálogo.</p>';
  caja.querySelectorAll('[data-hab]').forEach((b) => b.addEventListener('click', () => {
    const hab = (estado.habilitaciones || {})[b.dataset.hab];
    toggleHabilitacion(b.dataset.hab, !hab);
  }));
  caja.querySelectorAll('[data-ver]').forEach((b) => b.addEventListener('click', () => abrirClase(b.dataset.ver, false)));
  caja.querySelectorAll('[data-pres]').forEach((b) => b.addEventListener('click', () => abrirClase(b.dataset.pres, true)));
}

function renderClases() {
  pintarClases(document.getElementById('pClasesModulos'));
}

// ── Ver / presentar una clase ──────────────────────────────────────────────
/* Abre el detalle de la clase con los materiales que el administrador
   habilitó para este docente. Con presentar=true lanza directo a pantalla
   completa el HTML de la clase (el primer material embebible). */
async function abrirClase(claseId, presentar = false) {
  try {
    const res = await apiFetch(`/prof/clase/${encodeURIComponent(claseId)}`);
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'No se pudo cargar la clase.');
    const d = await res.json();
    const archivos = d.clase.archivos || [];

    if (presentar) {
      // preferencia: la presentación de la clase; si no, cualquier html que no sea práctica; si no, el primero
      const orden = (f) => (/presentac/i.test(f.nombre) ? 0 : (/practica/i.test(f.nombre) ? 2 : 1));
      const embebibles = archivos.filter((f) => f.embebible && f.embedUrl).sort((a, b) => orden(a) - orden(b));
      const primera = embebibles[0];
      if (primera) return abrirPantalla(primera.embedUrl, `${d.clase.titulo} — ${primera.nombre}`);
      toast('Esta clase no tiene presentación para proyectar. Abrí 📚 Ver para ver el material.');
    }

    document.getElementById('pMaterialesTitulo').textContent = `${d.curso ? d.curso + ' · ' : ''}${d.modulo || ''} — ${d.clase.titulo}`;
    const lista = document.getElementById('pMaterialesLista');
    lista.innerHTML = '';
    if (!archivos.length) {
      lista.innerHTML = '<p class="p-sin-mats">El administrador todavía no habilitó materiales de esta clase para vos. Pedile que los marque en el gestor (📚 Materiales).</p>';
    } else {
      for (const f of archivos) {
        const fila = document.createElement('div');
        fila.className = 'p-mat-fila';
        fila.innerHTML =
          `<span class="p-mat-emoji" aria-hidden="true">${f.emoji || '📄'}</span>` +
          `<span class="p-mat-nombre">${esc(f.nombre)}<small>${esc(f.tipo || '')}${f.size ? ' · ' + fmtSize(f.size) : ''}</small></span>`;
        const acciones = document.createElement('span');
        acciones.className = 'p-mat-acciones';

        if (f.embebible && f.embedUrl) {
          const bt = document.createElement('button');
          bt.type = 'button';
          bt.className = 'btn btn-primary btn-sm';
          bt.textContent = '▶ Presentar';
          bt.title = 'Proyectar a pantalla completa';
          bt.addEventListener('click', () => abrirPantalla(f.embedUrl, f.nombre));
          acciones.appendChild(bt);
        }

        const driveId = (`${f.url || ''}`.match(/[?&]id=([A-Za-z0-9_-]+)/) || [])[1] || '';
        const bv = document.createElement('button');
        bv.type = 'button';
        bv.className = 'btn btn-ghost btn-sm';
        if (driveId) {
          bv.textContent = '👁 Ver';
          bv.title = 'Abrir en el visor (pestaña nueva)';
          bv.addEventListener('click', () => window.open(`/visor?t=${encodeURIComponent(f.nombre)}&drive=${driveId}`, '_blank', 'noopener'));
          acciones.appendChild(bv);
        } else if (f.url) {
          bv.textContent = '🔗 Abrir';
          bv.title = 'Abrir en pestaña nueva';
          bv.addEventListener('click', () => window.open(f.url, '_blank', 'noopener'));
          acciones.appendChild(bv);
        } else if (f.embedUrl) {
          bv.textContent = '👁 Ver';
          bv.addEventListener('click', () => window.open(f.embedUrl, '_blank', 'noopener'));
          acciones.appendChild(bv);
        }

        fila.appendChild(acciones);
        lista.appendChild(fila);
      }
    }
    document.getElementById('pMateriales').classList.remove('hidden');
  } catch (e) {
    toast(e.message);
  }
}

/* pantalla completa para proyectar */
function abrirPantalla(url, nombre) {
  document.getElementById('pPantallaTitulo').textContent = nombre || 'Clase';
  document.getElementById('pPantallaFrame').src = url;
  document.getElementById('pPantallaNueva').onclick = () => window.open(url, '_blank', 'noopener');
  document.getElementById('pPantalla').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function cerrarPantalla() {
  document.getElementById('pPantallaFrame').src = 'about:blank';
  document.getElementById('pPantalla').classList.add('hidden');
  document.body.style.overflow = '';
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
  // vista previa: el admin abrió /profesor#pi=<token>. El token va a memoria,
  // se limpia el hash de la URL y la sesión del admin no se toca.
  const pi = (location.hash.match(/[#&]pi=([^&]+)/) || [])[1];
  if (pi) {
    setPreviewToken(decodeURIComponent(pi));
    history.replaceState(null, '', location.pathname + location.search);
  }

  document.querySelectorAll('.p-nav-item').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.p-nav-item').forEach((x) => x.classList.remove('activo'));
    b.classList.add('activo');
    document.querySelectorAll('section[data-panel]').forEach((s) => s.classList.toggle('hidden', s.dataset.panel !== b.dataset.sec));
  }));

  const salir = () => logout();
  document.getElementById('pLogout').addEventListener('click', salir);
  const l2 = document.getElementById('pLogout2');
  if (l2) l2.addEventListener('click', salir);
  const cerrarPreview = document.getElementById('pPreviewCerrar');
  if (cerrarPreview) cerrarPreview.addEventListener('click', salir);

  // modales de ver/presentar clase
  document.getElementById('pMaterialesCerrar').addEventListener('click', () => document.getElementById('pMateriales').classList.add('hidden'));
  document.getElementById('pPantallaCerrar').addEventListener('click', cerrarPantalla);
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!document.getElementById('pPantalla').classList.contains('hidden')) { cerrarPantalla(); return; }
    if (!document.getElementById('pMateriales').classList.contains('hidden')) document.getElementById('pMateriales').classList.add('hidden');
  });

  document.getElementById('pClaseAsis').addEventListener('change', renderAsistencia);
  const selCurso = document.getElementById('pCursoSel');
  if (selCurso) selCurso.addEventListener('change', () => cargar(selCurso.value));

  if (esVistaPrevia()) {
    // banner arriba + header sin nombre (el docente aparece en el banner)
    const banner = document.getElementById('pBannerPreview');
    if (banner) {
      banner.classList.remove('hidden');
      document.body.classList.add('en-preview');
    }
    renderHeader('');
    cargar();
    return;
  }

  if (!requireAuth('')) return;
  const tipo = localStorage.getItem('itc_clases_tipo');
  if (tipo === 'alumno') return (location.href = '/alumno');
  if (tipo !== 'profesor') return (location.href = '/gestor');
  cargar();
});
