/* Panel Docente (gestor): modo clase (3 columnas) + modo contenido (estado y acciones).*/
'use strict';

let catalogo = null;
let estadoGestor = null;
let cursoSel = null;
let claseSel = null;
let encuesta = null;
const RUTA_CLASE = 'itc_gestor_ruta';

/* ── arranque ─────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth(localStorage.getItem('itc_clases_nombre'))) return;
  if (localStorage.getItem('itc_clases_tipo') !== 'admin') return (location.href = localStorage.getItem('itc_clases_tipo') === 'profesor' ? '/profesor' : '/alumno');  agregarLinkInicio();
  wireModos();

  try {
    const res = await apiFetch('/catalogo');
    if (res.status === 401) return logout();
    if (!res.ok) throw new Error('No se pudo cargar el catálogo');
    catalogo = await res.json();

    filtrarCursosGestor();

    // contador real de clases para el placeholder del buscador
    let clasesTotal = 0;
    for (const curso of (catalogo.cursosGestor || [])) {
      for (const mo of curso.modulos || []) clasesTotal += (mo.clases || []).length;
    }
    const buscadorEl = document.getElementById('buscador');
    if (clasesTotal) buscadorEl.placeholder = `Buscar en ${clasesTotal} clases…`;
    renderCursos();
    cargarBuscar();
    recuperarRuta();

    const resE = await apiFetch('/gestor');
    if (resE.ok) {
      estadoGestor = await resE.json();
      pintarAvisoLocal();
      await renderEstado();
    }
  } catch (err) {
    toast(err.message);
    document.getElementById('loadingCursos').classList.add('hidden');
  }

  const bc = document.getElementById('btnContinuar');
  bc.addEventListener('click', () => {
    const r = JSON.parse(localStorage.getItem(RUTA_CLASE) || 'null');
    if (r) mostrarClase(r.claseId);
  });
});

/* ── navegación: modos y teclado ─────────────────────────── */
function wireModos() {
  const tC = document.getElementById('tabClase');
  const tG = document.getElementById('tabContenido');
  document.getElementById('tabAlumnos').addEventListener('click', () => cambiarModo('alumnos'));
  document.getElementById('tabDocentes').addEventListener('click', () => cambiarModo('docentes'));
  tC.addEventListener('click', () => cambiarModo('clase'));
  tG.addEventListener('click', () => cambiarModo('contenido'));
}
function cambiarModo(m) {
  const esClase = m === 'clase';
  const esAlumnos = m === 'alumnos';
  const esDocentes = m === 'docentes';
  document.getElementById('tabClase').classList.toggle('activo', esClase);
  document.getElementById('tabContenido').classList.toggle('activo', !esClase && !esAlumnos && !esDocentes);
  document.getElementById('tabAlumnos').classList.toggle('activo', esAlumnos);
  document.getElementById('tabDocentes').classList.toggle('activo', esDocentes);
  document.getElementById('panelClase').classList.toggle('hidden', !esClase);
  document.getElementById('panelContenido').classList.toggle('hidden', esClase || esAlumnos || esDocentes);
  document.getElementById('panelAlumnos').classList.toggle('hidden', !esAlumnos);
  document.getElementById('panelDocentes').classList.toggle('hidden', !esDocentes);
  if (!esClase && !esAlumnos && !esDocentes) refrescarEstado();
  if (esAlumnos) refrescarAlumnos();
  if (esDocentes) refrescarDocentes();
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !document.getElementById('pantalla').classList.contains('hidden')) cerrarPantalla();
});

function agregarLinkInicio() {
  const bar = document.querySelector('.topbar-inner .topbar-right');
  if (!bar) return;
  const a = document.createElement('a');
  a.className = 'link-eval';
  a.href = '/inicio';
  a.textContent = '← Aula';
  bar.prepend(a);
}

/* ── MISIÓN 1 · MODO CLASE: 3 columnas ───────────────────── */
function filtrarCursosGestor() {
  // Solo capacitaciones con material completo en Drive ( las 8 del drive-map).
  const idsGestor = ['asistente-administrativo', 'administracion-pymes', 'diseno-grafico', 'diseno-tecnico',
    'marketing-digital', 'diagnostico-mantenimiento', 'robotica-arduino', 'automatizacion-ia'];
  catalogo.cursosGestor = idsGestor
    .map((id) => catalogo.capacitaciones.find((c) => c.id === id))
    .filter(Boolean);
}

function renderCursos() {
  const caja = document.getElementById('listaCursos');
  document.getElementById('loadingCursos').classList.add('hidden');
  caja.innerHTML = '';
  catalogo.cursosGestor.forEach((c) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'g-curso' + (cursoSel === c.id ? ' sel' : '');
    b.innerHTML =
      `<span class="g-emoji" aria-hidden="true">${c.emoji}</span>` +
      `<span><span class="g-nombre">${esc(c.nombre)}</span><span class="g-sub">${c.modulos.length} módulos · ${c.stats.clases} clases</span></span>`;
    b.addEventListener('click', () => elegirCurso(c.id));
    caja.appendChild(b);
  });
}

function elegirCurso(id) {
  cursoSel = id;
  claseSel = null;
  guardarRuta();
  catalogo.cursosGestor.forEach((c, i) => {
    document.querySelectorAll('.g-curso')[i].classList.toggle('sel', c.id === id);
  });
  renderClases();
}

function renderClases() {
  const curso = catalogo.cursosGestor.find((c) => c.id === cursoSel);
  const caja = document.getElementById('listaModulos');
  document.getElementById('tituloClases').textContent = curso ? curso.nombre : 'Clases';
  caja.innerHTML = '';
  if (!curso) return;
  let n = 0;
  curso.modulos.forEach((m) => {
    n += (m.clases || []).length;
    const div = document.createElement('div');
    div.className = 'g-modulo';
    div.innerHTML = `<div class="g-modulo-titulo">${esc(m.titulo || 'Módulo')}</div>`;
    (m.clases || []).forEach((cl) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'g-clase' + (claseSel === cl.id ? ' sel' : '');
      b.innerHTML = `<span>📘</span><span>${esc(cl.titulo)}</span>${cl.count ? `<span class="mark">${cl.count}</span>` : ''}`;
      b.addEventListener('click', () => mostrarClase(cl.id));
      b.id = 'cl-' + cl.id;
      div.appendChild(b);
    });
    caja.appendChild(div);
  });
  if (!n) caja.innerHTML = '<div class="g-vacio">Este curso no tiene clases cargadas.</div>';
}

async function mostrarClase(id) {
  claseSel = id;
  guardarRuta();
  try {
    const res = await apiFetch(`/clase/${encodeURIComponent(id)}`);
    if (res.status === 401) return logout();
    if (!res.ok) throw new Error('Clase no encontrada');
    const data = await res.json();
    pintarDetalle(data);

    // marca visual en la lista
    document.querySelectorAll('.g-clase').forEach((b) => b.classList.toggle('sel', b.id === 'cl-' + id));
    const bc = document.getElementById('btnContinuar');
    bc.classList.remove('hidden');
    bc.textContent = `⏵ Continuar: ${trunc(data.clase.titulo, 34)}`;
    // cerrar resultados de búsqueda si venían abiertos
    document.getElementById('busquedas').classList.add('hidden');
  } catch (err) {
    toast(err.message);
  }
}

function pintarDetalle(data) {
  const cl = data.clase;
  document.getElementById('detalleVacio').classList.add('hidden');
  const caja = document.getElementById('detalleClase');
  caja.classList.remove('hidden');

  const esDrive = (f) => /^https:\/\/drive\.google\.com\//.test(f.url || '');
  const esPdfDrive = (f) => f.tipo === 'PDF' && f.url && esDrive(f);
  const abreEnLinea = (f) => (f.embebible && f.embedUrl) || esPdfDrive(f);

  const inter = cl.archivos.filter(abreEnLinea);
  const otras = cl.archivos.filter((f) => !abreEnLinea(f));

  caja.innerHTML =
    `<div class="g-detalle-head">
      <nav class="crumb">
        <a href="/curso?id=${encodeURIComponent(cl.cursoId)}" id="crumbCursoG">Curso ↗</a> <span aria-hidden="true">/</span>
        <span>${esc(cl.modulo || '')}</span>
      </nav>
      <h2>${esc(cl.titulo)}</h2>
      <p class="sub">${cl.archivos.length} materiales · ${inter.length} para ver en pantalla · curso ${esc(data.curso)}</p>
    </div>` +
    (inter.length ? `<div class="g-seccion-titulo">🖥️ Para proyectar en clase</div><div class="g-materiales" id="gMats"></div>` : '') +
    (otras.length ? `<div class="g-seccion-titulo">📎 Todo el material de la clase</div><div class="g-materiales" id="gMatOtras"></div>` : '') +
    (!inter.length && !otras.length ? `<div class="g-vacio">Clase sin materiales cargados.</div>` : '');

  const visorDe = (archivo) => {
    const driveId = (`${archivo.url || ''}`.match(/[?&]id=([A-Za-z0-9_-]+)/) || [])[1] || '';
    return `/visor?t=${encodeURIComponent(archivo.nombre)}${driveId ? `&drive=${driveId}` : `&src=${encodeURIComponent(archivo.embedUrl)}`}`;
  };

  // Interactivos: botón que abre a pantalla completa (modal del gestor).
  // PDF de Drive: carta con dos acciones — ver con visor + descargar.
  const ficha = (archivo) => {
    if (archivo.embebible && archivo.embedUrl) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'g-material inter';
      b.innerHTML =
        `<span class="g-mat-emoji" aria-hidden="true">${archivo.emoji || '🌐'}</span>` +
        `<span class="g-mat-titulo">${esc(archivo.nombre)}</span>` +
        `<span class="g-mat-meta">${archivo.tipo}${archivo.size ? ' · ' + fmtSize(archivo.size) : ''} · en pantalla</span>`;
      b.addEventListener('click', () => abrirPantalla(archivo.embedUrl, archivo.nombre));
      return b;
    }

    const driveId = (`${archivo.url || ''}`.match(/[?&]id=([A-Za-z0-9_-]+)/) || [])[1] || '';
    if (esPdfDrive(archivo) && driveId) {
      const div = document.createElement('div');
      div.className = 'g-material inter g-pdf';
      div.innerHTML =
        `<span class="g-mat-emoji" aria-hidden="true">${archivo.emoji || '📕'}</span>` +
        `<span class="g-mat-titulo">${esc(archivo.nombre)}</span>` +
        `<span class="g-mat-meta">${archivo.tipo}${archivo.size ? ' · ' + fmtSize(archivo.size) : ''} · visualizador + descarga</span>`;
      const btns = document.createElement('span');
      btns.className = 'g-pdf-botones';
      const ver = document.createElement('button');
      ver.type = 'button';
      ver.className = 'btn btn-primary btn-sm';
      ver.textContent = '👁 Ver';
      ver.addEventListener('click', () => window.open(visorDe(archivo), '_blank', 'noopener'));
      const bajar = document.createElement('a');
      bajar.className = 'btn btn-ghost btn-sm';
      bajar.href = archivo.url;
      bajar.target = '_blank';
      bajar.rel = 'noopener noreferrer';
      bajar.textContent = '⬇ Descarga';
      btns.appendChild(ver);
      btns.appendChild(bajar);
      div.appendChild(btns);
      return div;
    }

    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'g-material';
    b.innerHTML =
      `<span class="g-mat-emoji" aria-hidden="true">${archivo.emoji || '📄'}</span>` +
      `<span class="g-mat-titulo">${esc(archivo.nombre)}</span>` +
      `<span class="g-mat-meta">${archivo.tipo}${archivo.size ? ' · ' + fmtSize(archivo.size) : ''}${archivo.url ? '' : ' · sin enlace'}</span>`;
    if (archivo.url) {
      b.addEventListener('click', () => window.open(archivo.url, '_blank', 'noopener'));
    }
    return b;
  };

  const contI = document.getElementById('gMats');
  if (contI) inter.forEach((f) => contI.appendChild(ficha(f)));
  const contO = document.getElementById('gMatOtras');
  if (contO) otras.forEach((f) => contO.appendChild(ficha(f)));
}

/* pantalla completa del interactivo */
function abrirPantalla(url, nombre) {
  document.getElementById('pantallaTitulo').textContent = nombre || 'Interactivo';
  document.getElementById('pantallaFrame').src = url;
  // boton "nueva pestaña": es un <button>, el href no navega; abrimos por JS
  document.getElementById('pantallaNueva').onclick = () => window.open(url, '_blank', 'noopener');
  document.getElementById('pantalla').classList.remove('hidden');
}
function cerrarPantalla() {
  document.getElementById('pantallaFrame').src = '';
  document.getElementById('pantalla').classList.add('hidden');
}
(function () {
  document.getElementById('pantallaCerrar').addEventListener('click', cerrarPantalla);
  document.getElementById('pantalla').addEventListener('click', (e) => {
    if (e.target === document.getElementById('pantalla')) cerrarPantalla();
  });
})();

/* ── ruta recordada (dónde quedó el docente) ──────────────── */
function guardarRuta() {
  if (cursoSel) localStorage.setItem(RUTA_CLASE, JSON.stringify({ cursoId: cursoSel, claseId: claseSel }));
}
function recuperarRuta() {
  const r = JSON.parse(localStorage.getItem(RUTA_CLASE) || 'null');
  if (!r) return;
  if (r.cursoId && catalogo.cursosGestor.some((c) => c.id === r.cursoId)) {
    elegirCurso(r.cursoId);
    if (r.claseId) mostrarClase(r.claseId);
  }
}

/* ── MISIÓN 2 · MODO CONTENIDO ───────────────────────────── */
function pintarAvisoLocal() {
  document.getElementById('gestorLocalAviso').classList.toggle('hidden', !!estadoGestor.local);
  [document.getElementById('btnAccionCatalogo'), document.getElementById('btnAccionDrive')].forEach((b) => (b.disabled = !estadoGestor.local));
}

async function refrescarEstado() {
  const res = await apiFetch('/gestor');
  if (res.ok) {
    estadoGestor = await res.json();
    renderEstado();
  }
}

async function renderEstado() {
  document.getElementById('loadingEstado').classList.add('hidden');
  document.getElementById('estadoGenerado').textContent =
    'Catálogo: ' + (estadoGestor.generado ? new Date(estadoGestor.generado).toLocaleString('es-AR') : 'sin generar');
  const caja = document.getElementById('tablaEstado');
  caja.innerHTML = '';
  estadoGestor.cursos.forEach((c) => {
    const pct = c.archivos ? Math.round((100 * c.conDrive) / c.archivos) : 0;
    const div = document.createElement('div');
    div.className = 'g-tabla-curso';
    div.innerHTML =
      `<div class="g-fila-curso">
        <span class="g-emoji" aria-hidden="true">${c.emoji}</span>
        <span class="g-nombre">${esc(c.nombre)}</span>
        <div class="g-barra"><span style="width:${pct}%;background:${pct === 100 ? 'var(--success)' : pct > 70 ? 'var(--primary)' : 'var(--warning)'}"></span></div>
        <span class="g-pct">${pct}%</span>
      </div>
      <div class="g-sub2" style="padding:4px 16px">${c.clases} clases · ${c.modulos} módulos · ${c.archivos} archivos (${c.embebidos} interactivos) · ${c.conDrive}/${c.archivos} con Drive</div>`;
    if (c.faltantesTotal) {
      const ul = document.createElement('ul');
      ul.className = 'g-faltantes';
      ul.innerHTML =
        `<li><b>${c.faltantesTotal} sin enlace</b> — ejemplos:
          <ul class="g-faltantes-sub">` +
        c.faltantes.map((f) => `<li>· ${esc(f.tipo)} — ${escf(f.archivo)} <em>(en ${escf(f.clase)})</em></li>`).join('') +
        `</ul></li>`;
      div.appendChild(ul);
    }
    caja.appendChild(div);
  });
}

function escf(s) {
  return esc(String(s).length > 70 ? String(s).slice(0, 70) + '…' : s);
}

function trunc(s, n) {
  return String(s).length > n ? String(s).slice(0, n) + '…' : s;
}

async function correrAccion(tipo) {
  try {
    const res = await apiFetch('/gestor/accion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accion: tipo }) });
    if (res.status === 409) { const d = await res.json(); return toast(d.error); }
    if (!res.ok) { const d = await res.json().catch(() => ({})); return toast(d.error || 'No se pudo lanzar.' ); }
    const log = document.getElementById('accionLog');
    log.classList.remove('hidden');
    log.textContent = 'Trabajando…';
    encuesta = setInterval(async () => {
      const r2 = await apiFetch('/gestor/accion');
      if (!r2.ok) return clearInterval(encuesta);
      const d = await r2.json();
      log.textContent = (d.log || []).join('\n');
      log.scrollTop = log.scrollHeight;
      if (d.estado === 'ok' || d.estado === 'error') {
        clearInterval(encuesta);
        encuesta = null;
        toast(d.estado === 'ok' ? '✓ Acción terminada: ' + tipo : '✕ La acción falló — mirá el log.');
        document.getElementById('btnRefreshEstado').click();
        // recargar árbol tras regeneración
        const rc = await apiFetch('/catalogo');
        if (rc.ok) {
          catalogo = await rc.json();
          filtrarCursosGestor();
          renderCursos();
          if (cursoSel) renderClases();
        }
      }
    }, 1500);
  } catch (e) {
    toast(e.message);
  }
}

/* ── búsqueda global ─────────────────────────────────────── */
function cargarBuscar() {
  const input = document.getElementById('buscador');
  const caja = document.getElementById('busquedas');
  let timer = null;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => buscarGlobal(input.value.trim()), 250);
  });
  document.addEventListener('click', (e) => { if (!caja.contains(e.target) && e.target !== input) caja.classList.add('hidden'); });
}

async function buscarGlobal(q) {
  const caja = document.getElementById('busquedas');
  if (q.length < 2) return caja.classList.add('hidden');
  try {
    const res = await apiFetch(`/buscar?q=${encodeURIComponent(q)}`);
    if (!res.ok) return;
    const { resultados = [] } = await res.json();
    caja.innerHTML = '';
    resultados.slice(0, 25).forEach((r) => {
      const item = document.createElement('div');
      item.className = 'gb-res-item';
      item.innerHTML =
        `<span>📘</span><span><b>${esc(r.clase.titulo)}</b><small>${esc(r.curso)} · ${esc(r.modulo)}</small></span>`;
      item.addEventListener('click', () => {
        const id = r.clase.cursoId || r.clase.id.split(/-m\d+-c\d+|-(?:clase-|material-|general-|repasofinal-)/)[0];
        if (catalogo.cursosGestor.some((c) => c.id === id)) {
          if (cursoSel !== id) elegirCurso(id);
          mostrarClase(r.clase.id);
        } else {
          // curso fuera del gestor: saltar a la interface de cursado normal
          location.href = `/clase?id=${encodeURIComponent(r.clase.id)}`;
        }
      });
      caja.appendChild(item);
    });
    caja.classList.toggle('hidden', resultados.length === 0);
  } catch { /* silencioso */ }
}

/* botones del modo contenido */
(function wire() {
  document.getElementById('btnRefreshEstado').addEventListener('click', refrescarEstado);
  document.getElementById('btnAccionCatalogo').addEventListener('click', () => correrAccion('catalogo'));
  document.getElementById('btnAccionDrive').addEventListener('click', () => correrAccion('drive'));
})();

/* ── MODO ALUMNOS ────────────────────────────────────────── */
let alumnosLista = [];

async function refrescarAlumnos() {
  try {
    const res = await apiFetch('/alumnos');
    if (res.status === 401) return logout();
    if (!res.ok) throw new Error('No se pudo cargar la lista de alumnos.');
    const d = await res.json();
    alumnosLista = d.alumnos || [];
    document.getElementById('loadingAlumnos').classList.add('hidden');
    renderAlumnos();
  } catch (e) {
    toast(e.message);
    document.getElementById('loadingAlumnos').classList.add('hidden');
  }
}

function nombreCurso(id) {
  const c = (catalogo.capacitaciones || []).find((x) => x.id === id);
  return c ? c.nombre : id || '—';
}

/* etiqueta de cursos de una persona (alumno/docente) */
function etiquetaCursos(p) {
  const lista = Array.isArray(p.cursos) && p.cursos.length ? p.cursos : (p.curso ? [p.curso] : []);
  if (!lista.length) return '— sin curso asignado —';
  if (lista.length === 1) return nombreCurso(lista[0]);
  if (lista.length === 2) return lista.map(nombreCurso).join(' · ');
  return nombreCurso(lista[0]) + ` +${lista.length - 1} más`;
}

function renderAlumnos() {
  const caja = document.getElementById('listaAlumnos');
  caja.innerHTML = '';
  document.getElementById('vacioAlumnos').classList.toggle('hidden', alumnosLista.length > 0);
  alumnosLista.forEach((a) => {
    const div = document.createElement('div');
    div.className = 'g-alumno';
    div.innerHTML =
      `<div class="g-alumno-head"><b>${esc(a.nombre_completo)}</b><span class="user-chip">${esc(a.usuario)}</span></div>` +
      `<div class="g-alumno-meta">${esc(etiquetaCursos(a))}${a.horario ? ' · ' + esc(a.horario) : ''}${a.email ? '<br><small>' + esc(a.email) + '</small>' : ''}</div>` +
      `<div class="g-alumno-stats">${(a.permisos || []).length} materiales habilitados</div>`;
    const acciones = document.createElement('div');
    acciones.className = 'g-alumno-acciones';
    const btnMat = document.createElement('button');
    btnMat.type = 'button';
    btnMat.className = 'btn btn-primary btn-sm';
    btnMat.textContent = '📚 Materiales';
    btnMat.addEventListener('click', () => abrirPermisos(a));
    const btnPass = document.createElement('button');
    btnPass.type = 'button';
    btnPass.className = 'btn btn-ghost btn-sm';
    btnPass.textContent = '🔑 Nueva clave';
    btnPass.addEventListener('click', () => cambiarClaveAlumno(a));
    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn btn-ghost btn-sm';
    btnDel.textContent = '🗑️';
    btnDel.title = 'Borrar alumno';
    btnDel.addEventListener('click', () => borrarAlumno(a));
    acciones.appendChild(btnMat);
    acciones.appendChild(btnPass);
    acciones.appendChild(btnDel);
    div.appendChild(acciones);
    caja.appendChild(div);
  });
}

function cursosAlSelect() { // reemplazado por checks multi-curso
  llenarCursosChecks('alumnoCursosChk');
}

/* selector multi-curso: chips con checkbox, uno por capacitación */
function llenarCursosChecks(id) {
  const caja = document.getElementById(id);
  if (!caja) return;
  caja.innerHTML = '';
  (catalogo.capacitaciones || []).forEach((c) => {
    const lab = document.createElement('label');
    lab.className = 'alta-curso-opt';
    lab.innerHTML =
      `<input type="checkbox" value="${esc(c.id)}"><span>${esc(c.emoji || '')} ${esc(c.nombre)}</span>`;
    caja.appendChild(lab);
  });
}

/* leer los cursos marcados en la lista de checks */
function leerCursosChecks(id) {
  const caja = document.getElementById(id);
  return caja ? [...caja.querySelectorAll('input:checked')].map((i) => i.value) : [];
}

function abrirModalAlumno() {
  cursosAlSelect();
  document.getElementById('alumnoId').value = '';
  document.getElementById('formAlumno').reset();
  document.getElementById('modalAlumnoTitulo').textContent = 'Nuevo alumno';
  document.getElementById('credencialesBox').classList.add('hidden');
  document.getElementById('formAlumno').style.display = '';
  document.getElementById('alumnoPass').value = passwordCorta();
  document.getElementById('modalAlumno').classList.remove('hidden');
}

function cerrarModalAlumno() {
  document.getElementById('modalAlumno').classList.add('hidden');
  refrescarAlumnos();
}

async function guardarAlumno(e) {
  e.preventDefault();
  const body = {
    nombre_completo: document.getElementById('alumnoNombre').value.trim(),
    usuario: document.getElementById('alumnoUsuario').value.trim(),
    email: document.getElementById('alumnoEmail').value.trim(),
    dni: document.getElementById('alumnoDni').value.trim(),
    telefono: document.getElementById('alumnoTelefono').value.trim(),
    dia: document.getElementById('alumnoDia').value.trim(),
    horario: document.getElementById('alumnoHorario').value.trim(),
    cursos: leerCursosChecks('alumnoCursosChk'),
    password: document.getElementById('alumnoPass').value.trim()
  };
  if (!body.nombre_completo || !body.usuario) return toast('Falta nombre o usuario.');
  try {
    const res = await apiFetch('/alumnos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'No se pudo guardar.');
    mostrarCredenciales(d.alumno, d.password);
    document.getElementById('formAlumno').style.display = 'none';
  } catch (err) {
    toast(err.message);
  }
}

function mostrarCredenciales(alumno, password) {
  document.getElementById('modalAlumnoTitulo').textContent = '✅ Alumno creado';
  const box = document.getElementById('credencialesBox');
  box.classList.remove('hidden');
  box.innerHTML =
    `<p>Compartí con <b>${esc(alumno.nombre_completo)}</b> sus datos para entrar al aula:</p>` +
    `<div class="g-cred-fila">Usuario <code id="credUser">${esc(alumno.usuario)}</code> <button type="button" class="btn btn-ghost btn-sm" data-copy="${esc(alumno.usuario)}">copiar</button></div>` +
    `<div class="g-cred-fila">Contraseña <code id="credPass">${esc(password)}</code> <button type="button" class="btn btn-ghost btn-sm" data-copy="${esc(password)}">copiar</button></div>` +
    `<p class="sub">Entrada: <code>itc-clases.vercel.app</code></p>` +
    `<p class="sub">Después habilitale qué ver con “📚 Materiales”.</p>`;
  box.querySelectorAll('[data-copy]').forEach((b) => {
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); toast('✓ Copiado'); } catch { toast('No se pudo copiar'); }
    });
  });
}

async function borrarAlumno(a) {
  if (!confirm(`¿Borrar el alumno ${a.nombre_completo}? Perderá el acceso.`)) return;
  const res = await apiFetch(`/alumnos/${encodeURIComponent(a.id)}`, { method: 'DELETE' });
  if (!res.ok) return toast((await res.json().catch(() => ({}))).error || 'No se pudo borrar.');
  toast('Alumno borrado');
  refrescarAlumnos();
}

async function cambiarClaveAlumno(a) {
  if (!confirm(`¿Generar una contraseña nueva para ${a.nombre_completo}?`)) return;
  const res = await apiFetch(`/alumnos/${encodeURIComponent(a.id)}/password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const d = await res.json();
  if (!res.ok) return toast(d.error || 'No se pudo cambiar la clave.');
  mostrarCredenciales(a, d.password);
  document.getElementById('formAlumno').style.display = 'none';
  document.getElementById('modalAlumno').classList.remove('hidden');
}

/* ── permisos material por material ── */
let permisosAlumno = null;
let permisosSet = new Set();
let permisosCursoData = null;
let permisosCursosLista = []; // [{id,nombre,emoji}]
let permisosCursoSelId = '';

async function abrirPermisos(a) {
  permisosAlumno = a;
  permisosSet = new Set(a.permisos || []);
  document.getElementById('modalPermisosTitulo').textContent = `Materiales de ${a.nombre_completo}`;
  document.getElementById('permisosClases').innerHTML = '<div class="loading"><span class="spinner"></span> Cargando material del curso…</div>';
  document.getElementById('modalPermisos').classList.remove('hidden');

  // cursos del alumno (compatible con un solo curso)
  const ids = Array.isArray(a.cursos) && a.cursos.length ? a.cursos : (a.curso ? [a.curso] : []);
  permisosCursosLista = ids
    .map((id) => {
      const c = (catalogo.capacitaciones || []).find((x) => x.id === id);
      return c ? { id, nombre: c.nombre, emoji: c.emoji || '' } : null;
    })
    .filter(Boolean);
  const sel = document.getElementById('permisosCursoSel');
  if (permisosCursosLista.length > 1) {
    sel.classList.remove('hidden');
    sel.onchange = () => { permisosCursoSelId = sel.value; cargarPermisosCurso().catch((e) => toast(e.message)); };
    sel.innerHTML = permisosCursosLista
      .map((c) => `<option value="${esc(c.id)}" ${c.id === (permisosCursoSelId || permsSelDefault()) ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.nombre)}</option>`)
      .join('');
    permisosCursoSelId = sel.value;
  } else {
    sel.classList.add('hidden');
    sel.innerHTML = '';
    permisosCursoSelId = permisosCursosLista.length ? permisosCursosLista[0].id : '';
  }
  await cargarPermisosCurso().catch((e) => {
    toast(e.message);
    document.getElementById('permisosClases').innerHTML = `<p class="g-vacio">${esc(e.message)}</p>`;
  });
}

function permsSelDefault() {
  return permisosCursosLista.length ? permisosCursosLista[0].id : '';
}

async function cargarPermisosCurso() {
  if (!permisosCursoSelId) throw new Error('El alumno no tiene cursos asignados.');
  const res = await apiFetch(`/curso/${encodeURIComponent(permisosCursoSelId)}`);
  if (!res.ok) throw new Error('No se pudo cargar el curso.');
  permisosCursoData = await res.json();
  renderPermisos();
}

function renderPermisos() {
  const caja = document.getElementById('permisosClases');
  caja.innerHTML = '';
  if (!permisosCursoData || !permisosCursoData.modulos) return;
  permisosCursoData.modulos.forEach((m) => {
    const modulo = document.createElement('div');
    modulo.className = 'g-perm-modulo';
    let total = 0;
    const cuerpo = document.createElement('div');
    (m.clases || []).forEach((cl) => {
      if (!(cl.archivos || []).length) return;
      const claseDiv = document.createElement('details');
      claseDiv.className = 'g-perm-clase';
      const habilitadas = cl.archivos.filter((f) => permisosSet.has(f.fid)).length;
      claseDiv.innerHTML =
        `<summary><b>${esc(cl.titulo)}</b><small>${habilitadas}/${cl.archivos.length} habilitados</small></summary>`;
      const lista = document.createElement('div');
      cl.archivos.forEach((f) => {
        total++;
        const fila = document.createElement('label');
        fila.className = 'g-perm-archivo';
        fila.innerHTML =
          `<input type="checkbox" data-fid="${esc(f.fid)}" ${permisosSet.has(f.fid) ? 'checked' : ''}>` +
          `<span>${f.emoji || '📄'} ${esc(f.nombre)}</span><small>${esc(f.tipo || '')}</small>`;
        fila.querySelector('input').addEventListener('change', (ev) => {
          if (ev.target.checked) permisosSet.add(f.fid);
          else permisosSet.delete(f.fid);
          guardarPermisos();
          renderPermisos();
        });
        lista.appendChild(fila);
      });
      claseDiv.appendChild(lista);
      cuerpo.appendChild(claseDiv);
    });
    modulo.innerHTML = `<div class="g-modulo-titulo">${esc(m.titulo)}</div>`;
    modulo.appendChild(cuerpo);
    caja.appendChild(modulo);
  });
  if (!total) caja.innerHTML = '<p class="g-vacio">Este curso no tiene materiales.</p>';
}

async function guardarPermisos() {
  try {
    const res = await apiFetch(`/alumnos/${encodeURIComponent(permisosAlumno.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permisos: [...permisosSet] })
    });
    if (!res.ok) throw new Error('No se pudo guardar.');
  } catch (e) {
    toast(e.message);
  }
}

function habilitarTodo() {
  if (!permisosCursoData) return;
  if (!confirm('¿Habilitar TODOS los materiales del curso para este alumno?')) return;
  for (const m of permisosCursoData.modulos || []) {
    for (const cl of m.clases || []) {
      for (const f of cl.archivos || []) permisosSet.add(f.fid);
    }
  }
  guardarPermisos().then(() => {
    renderPermisos();
    toast('✓ Todos los materiales habilitados');
  });
}

(function wireAlumnos() {
  const btnNuevo = document.getElementById('btnNuevoAlumno');
  if (btnNuevo) {
    btnNuevo.addEventListener('click', abrirModalAlumno);
    document.getElementById('btnRefreshAlumnos').addEventListener('click', refrescarAlumnos);
    document.getElementById('modalAlumnoCerrar').addEventListener('click', cerrarModalAlumno);
    document.getElementById('formAlumno').addEventListener('submit', guardarAlumno);
    document.getElementById('btnGenPassAlumno').addEventListener('click', () => {
      document.getElementById('alumnoPass').value = passwordCorta();
    });
    document.getElementById('modalPermisosCerrar').addEventListener('click', () => {
      document.getElementById('modalPermisos').classList.add('hidden');
      refrescarAlumnos();
    });
    document.getElementById('btnPermisosTodos').addEventListener('click', habilitarTodo);
  }
})();

/* ── generador de contraseñas legibles (igual que el server) ── */
function passwordCorta() {
  const abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const dig = '23456789';
  const s = (arr, n) => Array.from({ length: n }, () => arr[Math.floor(Math.random() * arr.length)]).join('');
  return `ITC${s(abc, 2)}${s(dig, 3)}`;
}

function compartirCredenciales(boxId, titulo, nombre, usuario, password, destino) {
  const box = document.getElementById(boxId);
  box.classList.remove('hidden');
  box.innerHTML =
    `<p><b>${esc(titulo)}</b> — datos de acceso para <b>${esc(nombre)}</b>:</p>` +
    `<div class="g-cred-fila">Usuario <code>${esc(usuario)}</code> <button type="button" class="btn btn-ghost btn-sm" data-copy="${esc(usuario)}">copiar</button></div>` +
    `<div class="g-cred-fila">Contraseña <code>${esc(password)}</code> <button type="button" class="btn btn-ghost btn-sm" data-copy="${esc(password)}">copiar</button></div>` +
    `<p class="sub">Entrada: <code>itc-clases.vercel.app</code> · ${esc(destino)}</p>`;
  box.querySelectorAll('[data-copy]').forEach((b) => {
    b.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); toast('✓ Copiado'); } catch { toast('No se pudo copiar'); }
    });
  });
}

/* ── MODO DOCENTES ───────────────────────────────────────── */
let docentesLista = [];

async function refrescarDocentes() {
  try {
    const res = await apiFetch('/docentes');
    if (res.status === 401) return logout();
    if (!res.ok) throw new Error('No se pudo cargar la lista de docentes.');
    const d = await res.json();
    docentesLista = d.docentes || [];
    document.getElementById('loadingDocentes').classList.add('hidden');
    renderDocentes();
  } catch (e) {
    toast(e.message);
    document.getElementById('loadingDocentes').classList.add('hidden');
  }
}

/* vista previa del panel del docente: pide un token temporal al backend y abre
   /profesor con los permisos reales de ese docente, sin cerrar la sesión acá */
async function abrirPanelDocente(d) {
  try {
    const res = await apiFetch(`/docentes/${encodeURIComponent(d.id)}/impersonar`, { method: 'POST' });
    const info = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(info.error || 'No se pudo abrir la vista previa.');
    // sin noopener: la preview necesita window.opener para poder cerrarse
    window.open(info.url, '_blank');
  } catch (e) {
    toast(e.message);
  }
}

function renderDocentes() {
  const caja = document.getElementById('listaDocentes');
  caja.innerHTML = '';
  document.getElementById('vacioDocentes').classList.toggle('hidden', docentesLista.length > 0);
  docentesLista.forEach((d) => {
    const div = document.createElement('div');
    div.className = 'g-alumno';
    div.innerHTML =
      `<div class="g-alumno-head"><b>${esc(d.nombre_completo)}</b><span class="user-chip">${esc(d.usuario)}</span></div>` +
      `<div class="g-alumno-meta">📚 ${esc(etiquetaCursos(d))}${d.horario ? ' · ' + esc(d.dia || '') + ' ' + esc(d.horario) : ''}${d.email ? '<br><small>' + esc(d.email) + '</small>' : ''}</div>`;
    const acciones = document.createElement('div');
    acciones.className = 'g-alumno-acciones';
    const btnPanel = document.createElement('button');
    btnPanel.type = 'button';
    btnPanel.className = 'btn btn-ghost btn-sm';
    btnPanel.textContent = '🛠️ Su panel';
    btnPanel.title = 'Vista previa del panel del docente';
    btnPanel.addEventListener('click', () => abrirPanelDocente(d));
    const btnPass = document.createElement('button');
    btnPass.type = 'button';
    btnPass.className = 'btn btn-ghost btn-sm';
    btnPass.textContent = '🔑 Nueva clave';
    btnPass.addEventListener('click', () => cambiarClaveDocente(d));
    const btnDel = document.createElement('button');
    btnDel.type = 'button';
    btnDel.className = 'btn btn-ghost btn-sm';
    btnDel.textContent = '🗑️';
    btnDel.title = 'Borrar docente';
    btnDel.addEventListener('click', () => borrarDocente(d));
    acciones.appendChild(btnPanel);
    acciones.appendChild(btnPass);
    acciones.appendChild(btnDel);
    div.appendChild(acciones);
    caja.appendChild(div);
  });
}

function abrirModalDocente() {
  llenarCursosChecks('docenteCursosChk');
  document.getElementById('formDocente').reset();
  document.getElementById('modalDocenteTitulo').textContent = 'Nuevo docente';
  document.getElementById('credencialesDocenteBox').classList.add('hidden');
  document.getElementById('formDocente').style.display = '';
  document.getElementById('docentePass').value = passwordCorta();
  document.getElementById('modalDocente').classList.remove('hidden');
}

async function guardarDocente(e) {
  e.preventDefault();
  const body = {
    nombre: document.getElementById('docenteUsuario').value.trim(),
    nombre_completo: document.getElementById('docenteNombre').value.trim(),
    email: document.getElementById('docenteEmail').value.trim(),
    dni: document.getElementById('docenteDni').value.trim(),
    telefono: document.getElementById('docenteTelefono').value.trim(),
    dia: document.getElementById('docenteDia').value.trim(),
    horario: document.getElementById('docenteHorario').value.trim(),
    cursos: leerCursosChecks('docenteCursosChk'),
    password: document.getElementById('docentePass').value.trim()
  };
  if (!body.nombre_completo || !body.nombre) return toast('Falta nombre o usuario.');
  try {
    const res = await apiFetch('/docentes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await res.json();
    if (!res.ok) throw new Error(d.error || 'No se pudo guardar.');
    compartirCredenciales('credencialesDocenteBox', '✅ Docente creado', d.docente.nombre_completo, d.docente.usuario, d.password, 'su panel: /profesor');
    document.getElementById('formDocente').style.display = 'none';
  } catch (err) {
    toast(err.message);
  }
}

async function borrarDocente(d) {
  if (!confirm(`¿Borrar el docente ${d.nombre_completo}? Perderá el acceso.`)) return;
  const res = await apiFetch(`/docentes/${encodeURIComponent(d.id)}`, { method: 'DELETE' });
  if (!res.ok) return toast((await res.json().catch(() => ({}))).error || 'No se pudo borrar.');
  toast('Docente borrado');
  refrescarDocentes();
}

async function cambiarClaveDocente(d) {
  if (!confirm(`¿Generar una contraseña nueva para ${d.nombre_completo}?`)) return;
  const res = await apiFetch(`/docentes/${encodeURIComponent(d.id)}/password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  const r = await res.json();
  if (!res.ok) return toast(r.error || 'No se pudo cambiar la clave.');
  compartirCredenciales('credencialesDocenteBox', '🔑 Clave nueva', d.nombre_completo, d.usuario, r.password, 'su panel: /profesor');
  document.getElementById('formDocente').style.display = 'none';
  document.getElementById('modalDocente').classList.remove('hidden');
  document.getElementById('modalDocenteTitulo').textContent = '🔑 Contraseña nueva';
}

(function wireDocentes() {
  const btn = document.getElementById('btnNuevoDocente');
  if (btn) {
    btn.addEventListener('click', abrirModalDocente);
    document.getElementById('btnRefreshDocentes').addEventListener('click', refrescarDocentes);
    document.getElementById('modalDocenteCerrar').addEventListener('click', () => {
      document.getElementById('modalDocente').classList.add('hidden');
      refrescarDocentes();
    });
    document.getElementById('formDocente').addEventListener('submit', guardarDocente);
    document.getElementById('btnGenPassDocente').addEventListener('click', () => {
      document.getElementById('docentePass').value = passwordCorta();
    });
  }
})();

/* ── modales de alta: extras (cancelar + usuario sugerido) ── */
function sugerirUsuario(t) {
  const partes = String(t || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/\s+/).filter(Boolean);
  if (!partes.length) return '';
  return partes.length > 1 ? `${partes[0]}.${partes[partes.length - 1]}` : partes[0];
}

(function wireAltaExtras() {
  [
    { nombre: 'alumnoNombre', usuario: 'alumnoUsuario' },
    { nombre: 'docenteNombre', usuario: 'docenteUsuario' }
  ].forEach((p) => {
    const inNombre = document.getElementById(p.nombre);
    const inUsuario = document.getElementById(p.usuario);
    if (!inNombre || !inUsuario || !inNombre.form) return;
    let tocado = false;
    inUsuario.addEventListener('input', () => { tocado = true; });
    inNombre.addEventListener('input', () => {
      if (!tocado) inUsuario.value = sugerirUsuario(inNombre.value);
    });
    inNombre.form.addEventListener('reset', () => {
      tocado = false;
      inUsuario.value = '';
    });
  });
  const ca = document.getElementById('modalAlumnoCancelar');
  if (ca) ca.addEventListener('click', cerrarModalAlumno);
  const cd = document.getElementById('modalDocenteCancelar');
  if (cd) cd.addEventListener('click', () => {
    document.getElementById('modalDocente').classList.add('hidden');
    refrescarDocentes();
  });
})();
