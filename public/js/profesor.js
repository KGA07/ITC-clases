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
      `<img class="p-curso-thumb" src="/img/cursos/${esc(c.id)}.webp" alt="${esc(c.nombre)}" loading="lazy" onerror="this.onerror=null;this.src='/img/cursos/${esc(c.id)}.svg'">` +
      `<div class="p-curso-body">` +
      `  <div class="p-curso-emoji" aria-hidden="true">${esc(c.emoji || '')}</div>` +
      `  <div class="p-curso-info"><b>${esc(c.nombre)}</b><small>${clasesCurso} clase${clasesCurso === 1 ? '' : 's'} · ${habCurso} habilitada${habCurso === 1 ? '' : 's'}</small></div>` +
      `  <button type="button" class="btn btn-primary btn-sm" data-curso="${esc(c.id)}">📖 Gestionar clases</button>` +
      `</div>`;
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
    `<div class="p-stat"><b>${Math.max(total - hab, 0)}</b><span>clases por habilitar</span></div>` +
    `<div class="p-stat"><b>${(estado.docente && Array.isArray(estado.docente.permisos)) ? estado.docente.permisos.length : 0}</b><span>materiales habilitados para vos</span></div>`;
  pintarCursosPanel(document.getElementById('pRapidas'));
}

// ── Mis Alumnos ────────────────────────────────────────────────────────────
function renderAlumnos() {
  const caja = document.getElementById('pListaAlumnos');
  document.getElementById('pSubAlumnos').textContent = `${estado.alumnos.length} alumnos de tus cursos · entrada con usuario y contraseña en itc-clases.vercel.app`;
  caja.innerHTML = '';
  if (!estado.alumnos.length) {
    caja.innerHTML = '<p class="sub">Todavía no hay alumnos cargados. Usá “➕ Nuevo alumno”.</p>';
    return;
  }
  estado.alumnos.forEach((a) => {
    const div = document.createElement('div');
    div.className = 'p-alumno';
    div.innerHTML =
      `<span class="p-avatar">${esc(initials(a.nombre_completo))}</span>` +
      `<div class="p-alumno-info"><b>${esc(a.nombre_completo)}</b><small>${esc(a.usuario)}${a.horario ? ' · ' + esc(a.horario) : ''}${a.email ? '<br>' + esc(a.email) : ''}</small><small>${(a.permisos || []).length} materiales · ${esc(etiquetaCursosProf(a))}</small></div>`;
    const acciones = document.createElement('div');
    acciones.className = 'p-alumno-acciones';
    const btnEdit = document.createElement('button');
    btnEdit.type = 'button'; btnEdit.className = 'btn btn-ghost btn-sm'; btnEdit.textContent = '✏️'; btnEdit.title = 'Editar alumno';
    btnEdit.addEventListener('click', () => abrirModalAlumnoProf(a));
    const btnPass = document.createElement('button');
    btnPass.type = 'button'; btnPass.className = 'btn btn-ghost btn-sm'; btnPass.textContent = '🔑'; btnPass.title = 'Nueva contraseña';
    btnPass.addEventListener('click', () => cambiarClaveAlumnoProf(a));
    const btnDel = document.createElement('button');
    btnDel.type = 'button'; btnDel.className = 'btn btn-ghost btn-sm'; btnDel.textContent = '🗑️'; btnDel.title = 'Borrar alumno';
    btnDel.addEventListener('click', () => borrarAlumnoProf(a));
    acciones.appendChild(btnEdit);
    acciones.appendChild(btnPass);
    acciones.appendChild(btnDel);
    div.appendChild(acciones);
    // progreso del alumno en el curso activo (vistas marcadas en el aula).
    // si el alumno no cursa este curso (ej: creado por el admin sin cursos,
    // se muestra "sin curso") la barra no corresponde y no se muestra
    const enCursoActivo = Array.isArray(a.cursos) ? a.cursos.includes(estado.docente.curso) : a.curso === estado.docente.curso;
    const pro = enCursoActivo ? (estado.progreso || {})[String(a.id)] : null;
    if (pro) {
      const pct = pro.total ? Math.round((pro.vistas / pro.total) * 100) : 0;
      const info = div.querySelector('.p-alumno-info');
      const pb = document.createElement('div');
      pb.className = 'p-progreso-mini';
      pb.innerHTML =
        `<small>📚 <b>${pro.vistas}/${pro.total}</b> clases vistas${pro.ultima ? ' · última ' + esc(pro.ultima) : ''}</small>` +
        `<div class="pm-barra"><span style="width:${pct}%"></span></div>`;
      if (info) info.appendChild(pb);
    }
    caja.appendChild(div);
  });
}

function etiquetaCursosProf(p) {
  const lista = Array.isArray(p.cursos) && p.cursos.length ? p.cursos : (p.curso ? [p.curso] : []);
  if (!lista.length) return 'sin curso';
  const nombres = lista.map((id) => {
    const c = (estado.cursosAsignados || []).find((x) => x.id === id);
    return c ? c.nombre : id;
  });
  return nombres.length === 1 ? nombres[0] : nombres[0] + ` +${nombres.length - 1}`;
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

// ── Alumnos del profesor: ABM ───────────────────────────────────────────────
function cursosDelProfesor() {
  return (estado && estado.cursosAsignados) ? estado.cursosAsignados : [];
}

function llenarCursosProfChecks() {
  const caja = document.getElementById('pAlumnoCursosChk');
  if (!caja) return;
  caja.innerHTML = '';
  cursosDelProfesor().forEach((c) => {
    const lab = document.createElement('label');
    lab.className = 'alta-curso-opt';
    lab.innerHTML = `<input type="checkbox" value="${esc(c.id)}"><span>${esc(c.emoji || '')} ${esc(c.nombre)}</span>`;
    caja.appendChild(lab);
  });
}

function leerCursosProfChecks() {
  const caja = document.getElementById('pAlumnoCursosChk');
  return caja ? [...caja.querySelectorAll('input:checked')].map((i) => i.value) : [];
}

function sugerirUsuarioProf(t) {
  const partes = String(t || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean);
  if (!partes.length) return '';
  return partes.length > 1 ? `${partes[0]}.${partes[partes.length - 1]}` : partes[0];
}

function abrirModalAlumnoProf(alumno = null) {
  llenarCursosProfChecks();
  const form = document.getElementById('pFormAlumno');
  form.reset();
  document.getElementById('pCredencialesBox').classList.add('hidden');
  form.style.display = '';
  if (alumno) {
    document.getElementById('pAlumnoId').value = alumno.id;
    document.getElementById('pModalAlumnoTitulo').textContent = 'Editar alumno';
    document.getElementById('pAlumnoNombre').value = alumno.nombre_completo || '';
    document.getElementById('pAlumnoUsuario').value = alumno.usuario || '';
    document.getElementById('pAlumnoEmail').value = alumno.email || '';
    document.getElementById('pAlumnoDni').value = alumno.dni || '';
    document.getElementById('pAlumnoTelefono').value = alumno.telefono || '';
    document.getElementById('pAlumnoDia').value = alumno.dia || '';
    document.getElementById('pAlumnoHorario').value = alumno.horario || '';
    const ids = Array.isArray(alumno.cursos) && alumno.cursos.length ? alumno.cursos : (alumno.curso ? [alumno.curso] : []);
    document.querySelectorAll('#pAlumnoCursosChk input').forEach((inp) => { inp.checked = ids.includes(inp.value); });
    document.getElementById('pAlumnoPass').value = '';
  } else {
    document.getElementById('pAlumnoId').value = '';
    document.getElementById('pModalAlumnoTitulo').textContent = 'Nuevo alumno';
    document.getElementById('pAlumnoPass').value = passwordCortaProf();
    // auto-marcar todos los cursos del profesor
    document.querySelectorAll('#pAlumnoCursosChk input').forEach((inp) => { inp.checked = true; });
  }
  document.getElementById('pModalAlumno').classList.remove('hidden');
}

function cerrarModalAlumnoProf() {
  document.getElementById('pModalAlumno').classList.add('hidden');
  cargar(); // refrescar estado (alumnos)
}

async function fidsDeCursos(ids) {
  const out = [];
  for (const id of ids) {
    try {
      const res = await apiFetch(`/curso/${encodeURIComponent(id)}`);
      if (!res.ok) continue;
      const d = await res.json();
      for (const m of d.modulos || []) for (const cl of m.clases || []) for (const f of cl.archivos || []) if (f.fid && !out.includes(f.fid)) out.push(f.fid);
    } catch { /* silencioso */ }
  }
  return out;
}

async function guardarAlumnoProf(e) {
  e.preventDefault();
  const id = document.getElementById('pAlumnoId').value;
  const cursos = leerCursosProfChecks();
  if (!cursos.length) { toast('Elegí al menos un curso.'); return; }
  const body = {
    nombre_completo: document.getElementById('pAlumnoNombre').value.trim(),
    usuario: document.getElementById('pAlumnoUsuario').value.trim(),
    email: document.getElementById('pAlumnoEmail').value.trim(),
    dni: document.getElementById('pAlumnoDni').value.trim(),
    telefono: document.getElementById('pAlumnoTelefono').value.trim(),
    dia: document.getElementById('pAlumnoDia').value.trim(),
    horario: document.getElementById('pAlumnoHorario').value.trim(),
    cursos,
    password: document.getElementById('pAlumnoPass').value.trim()
  };
  if (!body.nombre_completo || !body.usuario) { toast('Falta nombre o usuario.'); return; }
  try {
    // auto-habilitar todos los materiales de los cursos seleccionados
    const fids = await fidsDeCursos(cursos);
    body.permisos = fids;
    let res;
    if (id) {
      res = await apiFetch(`/alumnos/${encodeURIComponent(id)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'No se pudo guardar.');
      toast('✓ Alumno actualizado');
      cerrarModalAlumnoProf();
    } else {
      res = await apiFetch('/alumnos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'No se pudo guardar.');
      const box = document.getElementById('pCredencialesBox');
      box.classList.remove('hidden');
      box.innerHTML =
        `<p>Compartí con <b>${esc(d.alumno.nombre_completo)}</b> sus datos para entrar al aula:</p>` +
        `<div class="g-cred-fila">Usuario <code>${esc(d.alumno.usuario)}</code></div>` +
        `<div class="g-cred-fila">Contraseña <code>${esc(d.password)}</code></div>` +
        `<p class="sub">Entrada: <code>itc-clases.vercel.app</code></p>`;
      form.style.display = 'none';
      toast('✓ Alumno creado');
    }
  } catch (err) {
    toast(err.message);
  }
}

async function borrarAlumnoProf(a) {
  if (!confirm(`¿Borrar el alumno ${a.nombre_completo}? Perderá el acceso.`)) return;
  const res = await apiFetch(`/alumnos/${encodeURIComponent(a.id)}`, { method: 'DELETE' });
  if (!res.ok) return toast((await res.json().catch(() => ({}))).error || 'No se pudo borrar.');
  toast('Alumno borrado');
  cargar();
}

async function cambiarClaveAlumnoProf(a) {
  if (!confirm(`¿Generar una contraseña nueva para ${a.nombre_completo}?`)) return;
  const res = await apiFetch(`/alumnos/${encodeURIComponent(a.id)}/password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const d = await res.json();
  if (!res.ok) return toast(d.error || 'No se pudo cambiar la clave.');
  const box = document.getElementById('pCredencialesBox');
  document.getElementById('pModalAlumno').classList.remove('hidden');
  document.getElementById('pFormAlumno').style.display = 'none';
  box.classList.remove('hidden');
  box.innerHTML =
    `<p>🔑 Nueva clave para <b>${esc(a.nombre_completo)}</b>:</p>` +
    `<div class="g-cred-fila">Usuario <code>${esc(a.usuario)}</code></div>` +
    `<div class="g-cred-fila">Contraseña <code>${esc(d.password)}</code></div>`;
  toast('✓ Clave actualizada');
}

function passwordCortaProf() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const dig = '23456789';
  const s = (arr, n) => Array.from({ length: n }, () => arr[Math.floor(Math.random() * arr.length)]).join('');
  return `ITC${s(abc, 2)}${s(dig, 3)}`;
}

// ── fin alumnos profesor ─────────────────────────────────────────────────────

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

  // alumnos: wiring
  const btnNuevoAl = document.getElementById('pBtnNuevoAlumno');
  if (btnNuevoAl) {
    btnNuevoAl.addEventListener('click', () => abrirModalAlumnoProf());
    document.getElementById('pBtnRefreshAlumnos').addEventListener('click', () => cargar());
    document.getElementById('pModalAlumnoCerrar').addEventListener('click', () => document.getElementById('pModalAlumno').classList.add('hidden'));
    document.getElementById('pModalAlumnoCancelar').addEventListener('click', () => document.getElementById('pModalAlumno').classList.add('hidden'));
    document.getElementById('pFormAlumno').addEventListener('submit', guardarAlumnoProf);
    document.getElementById('pBtnGenPassAlumno').addEventListener('click', () => {
      document.getElementById('pAlumnoPass').value = passwordCortaProf();
    });
    // auto-sugerir usuario
    const inNombre = document.getElementById('pAlumnoNombre');
    const inUsuario = document.getElementById('pAlumnoUsuario');
    let tocado = false;
    inUsuario.addEventListener('input', () => { tocado = true; });
    inNombre.addEventListener('input', () => { if (!tocado) inUsuario.value = sugerirUsuarioProf(inNombre.value); });
  }

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
