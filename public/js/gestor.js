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
  agregarLinkInicio();
  wireModos();

  try {
    const res = await apiFetch('/catalogo');
    if (res.status === 401) return logout();
    if (!res.ok) throw new Error('No se pudo cargar el catálogo');
    catalogo = await res.json();

    filtrarCursosGestor();
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
  tC.addEventListener('click', () => cambiarModo('clase'));
  tG.addEventListener('click', () => cambiarModo('contenido'));
}
function cambiarModo(m) {
  const esClase = m === 'clase';
  document.getElementById('tabClase').classList.toggle('activo', esClase);
  document.getElementById('tabContenido').classList.toggle('activo', !esClase);
  document.getElementById('panelClase').classList.toggle('hidden', !esClase);
  document.getElementById('panelContenido').classList.toggle('hidden', esClase);
  if (!esClase) refrescarEstado();
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

  const inter = cl.archivos.filter((f) => f.embebible && f.embedUrl);
  const otras = cl.archivos.filter((f) => !(f.embebible && f.embedUrl));

  caja.innerHTML =
    `<div class="g-detalle-head">
      <nav class="crumb">
        <a href="/curso?id=${encodeURIComponent(cl.cursoId)}" id="crumbCursoG">Curso ↗</a> <span aria-hidden="true">/</span>
        <span>${esc(cl.modulo || '')}</span>
      </nav>
      <h2>${esc(cl.titulo)}</h2>
      <p class="sub">${cl.archivos.length} materiales · ${inter.length} interactivos a pantalla · curso ${esc(data.curso)}</p>
    </div>` +
    (inter.length ? `<div class="g-seccion-titulo">🖥️ Para proyectar en clase</div><div class="g-materiales" id="gMats"></div>` : '') +
    (otras.length ? `<div class="g-seccion-titulo">📎 Todo el material de la clase</div><div class="g-materiales" id="gMatOtras"></div>` : '') +
    (!inter.length && !otras.length ? `<div class="g-vacio">Clase sin materiales cargados.</div>` : '');

  const mapaC = (cont, x, archivo) => {
    const b = document.createElement(x);
    b.type = x === 'button' ? 'button' : undefined;
    b.className = 'g-material' + (archivo.embebible && archivo.embedUrl ? ' inter' : '');
    let destino = null;
    if (archivo.embebible && archivo.embedUrl) destino = archivo.embedUrl;
    else if (archivo.url) destino = archivo.url;
    const inter2 = archivo.embebible && archivo.embedUrl;
    b.innerHTML =
      `<span class="g-mat-emoji" aria-hidden="true">${archivo.emoji || '📄'}</span>` +
      `<span class="g-mat-titulo">${esc(archivo.nombre)}</span>` +
      `<span class="g-mat-meta">${archivo.tipo}${archivo.size ? ' · ' + fmtSize(archivo.size) : ''}${inter2 ? '' : destino ? ' · ⬇️ Descarga' : ' · sin enlace'}</span>`;
    if (destino) {
      if (inter2) b.addEventListener('click', () => abrirPantalla(destino, archivo.nombre));
      else b.addEventListener('click', () => window.open(destino, '_blank', 'noopener'));
    }
    return b;
  };

  const contI = document.getElementById('gMats');
  if (contI) inter.forEach((f) => contI.appendChild(mapaC('button', 'button', f)));
  const contO = document.getElementById('gMatOtras');
  if (contO) otras.forEach((f) => contO.appendChild(mapaC('button', 'button', f)));
}

/* pantalla completa del interactivo */
function abrirPantalla(url, nombre) {
  document.getElementById('pantallaTitulo').textContent = nombre || 'Interactivo';
  document.getElementById('pantallaFrame').src = url;
  document.getElementById('pantallaNueva').href = url;
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
