'use strict';
// Aula del alumno: solo muestra el curso asignado y los materiales
// habilitados material por material por el docente.
// 1 solo pedido (el bulk de /alumno/catalogo trae las clases CON sus
// archivos permitidos) + barra de progreso + búsqueda local + marcas "vista".

const modal = document.getElementById('modal');
const modalFrame = document.getElementById('modalFrame');

// clases marcadas como vistas (por alumno, en este navegador)
const VISTOS_KEY = 'itc_alumno_vistas';
const leidos = new Set(JSON.parse(localStorage.getItem(VISTOS_KEY) || '[]'));

function guardarVistos() {
  localStorage.setItem(VISTOS_KEY, JSON.stringify([...leidos]));
}

let _cursos = [];
let _sel = null; // curso abierto (null = grilla de cursos) // catálogo bulk recibido (objeto completo)

function abrirModal(url, nombre) {
  document.getElementById('modalTitle').textContent = nombre;
  modalFrame.src = url;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function cerrarModal() {
  modal.classList.add('hidden');
  modalFrame.src = 'about:blank';
  document.body.style.overflow = '';
}
function idDriveDe(url) {
  const m = (String(url || '').match(/[?&]id=([A-Za-z0-9_-]+)/) || [])[1] || '';
  return m;
}

function accionesArchivo(f) {
  const wrap = document.createElement('div');
  wrap.className = 'acciones';

  if (f.embedUrl) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary btn-sm';
    btn.textContent = '▶ Abrir';
    btn.addEventListener('click', () => abrirModal(f.embedUrl, f.nombre));
    wrap.appendChild(btn);
    return wrap;
  }

  const idDrive = f.tipo === 'PDF' ? idDriveDe(f.url) : '';
  if (idDrive) {
    const ver = document.createElement('a');
    ver.className = 'btn btn-primary btn-sm';
    ver.href = `/visor?t=${encodeURIComponent(f.nombre)}&drive=${idDrive}`;
    ver.textContent = '👁 Ver';
    wrap.appendChild(ver);
  }
  if (f.url) {
    const a = document.createElement('a');
    a.className = 'btn btn-ghost btn-sm';
    a.href = f.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = f.tipo === 'Carpeta' ? '📂 Abrir carpeta' : '⬇ Descargar';
    wrap.appendChild(a);
  }
  return wrap;
}

/* marca de clase vista */
function btnVisto(claseId) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'btn-visto' + (leidos.has(claseId) ? ' ok' : '');
  b.title = 'Marcar/desmarcar como clase vista';
  b.setAttribute('aria-pressed', leidos.has(claseId) ? 'true' : 'false');
  b.textContent = leidos.has(claseId) ? '✓' : '○';
  b.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (leidos.has(claseId)) leidos.delete(claseId);
    else leidos.add(claseId);
    guardarVistos();
    render();
  });
  return b;
}

/* una clase con sus archivos */
function renderClase(cl) {
  if (!(cl.archivos || []).length) return null;
  const det = document.createElement('details');
  det.className = 'alumno-clase' + (leidos.has(cl.id) ? ' vista' : '');
  det.id = 'clase-' + cl.id;
  det.dataset.nombre = `${cl.titulo} ${cl.archivos.map((f) => f.nombre).join(' ')}`.toLowerCase();
  const sum = document.createElement('summary');
  sum.innerHTML = `<span class="sum-txt">📘 ${esc(cl.titulo)}<small style="font-weight:600;color:var(--text-soft)"> · ${cl.archivos.length} materiales</small></span>`;
  sum.appendChild(btnVisto(cl.id));
  det.appendChild(sum);
  (cl.archivos || []).forEach((f) => {
    const fila = document.createElement('div');
    fila.className = 'alumno-archivo';
    fila.innerHTML =
      `<span class="f-emoji" aria-hidden="true">${f.emoji || '📄'}</span>` +
      `<span class="info"><b>${esc(f.nombre)}</b><small>${esc(f.tipo || '')}${f.size ? ' · ' + fmtSize(f.size) : ''}</small>` +
      (f.descripcion ? `<small class="f-desc">${esc(f.descripcion)}</small>` : '') +
      `</span>`;
    fila.appendChild(accionesArchivo(f));
    det.appendChild(fila);
  });
  return det;
}

/* barra de progreso de un curso */
function renderProgreso(cur) {
  const total = cur.totalClases || 0;
  if (total > 0 && leidos.size >= 0) {
    let vistas = 0;
    for (const m of cur.modulos || []) for (const cl of (m.clases || [])) if (leidos.has(cl.id)) vistas++;
    const porc = total ? Math.round((vistas / total) * 100) : 0;
    const box = document.createElement('div');
    box.className = 'alumno-progreso';
    box.innerHTML =
      `<div class="p-info"><b>${vistas} de ${total} clase${total === 1 ? '' : 's'} vista${vistas === 1 ? '' : 's'}</b>` +
      `<small>${total} clase${total === 1 ? '' : 's'} habilitada${total === 1 ? '' : 's'} · ${cur.totalMateriales || 0} materiales</small></div>` +
      `<div class="p-barra"><span style="width:${porc}%"></span></div>`;
    return box;
  }
  return null;
}

/* un curso completo (conProgreso=false durante una búsqueda filtrada) */
function renderCurso(cur, conProgreso = true) {
  const bloque = document.createElement('section');
  bloque.className = 'alumno-curso-bloque';
  bloque.dataset.nombre = cur.nombre.toLowerCase();

  // título si hay más de un curso
  if (_cursos.length > 1) {
    const t = document.createElement('h2');
    t.className = 'alumno-curso-titulo';
    t.textContent = `${cur.emoji || ''} ${cur.nombre}`;
    bloque.appendChild(t);
  }

  const prog = conProgreso ? renderProgreso(cur) : null;
  if (prog) bloque.appendChild(prog);

  for (const mod of cur.modulos || []) {
    const tituloMod = document.createElement('div');
    tituloMod.className = 'alumno-modulo';
    tituloMod.textContent = mod.titulo;
    bloque.appendChild(tituloMod);
    let n = 0;
    for (const cl of mod.clases || []) {
      const nodo = renderClase(cl);
      if (nodo) { bloque.appendChild(nodo); n++; }
    }
    if (!n) tituloMod.remove();
  }
  return bloque;
}

/* render completo con filtro de búsqueda */
function render(filtro = '') {
  const filtroTxt = String(filtro || '').trim().toLowerCase();
  const caja = document.getElementById('listaMaterial');
  caja.innerHTML = '';
  const aviso = document.getElementById('sinResultados');
  if (!_sel) { aviso.classList.add('hidden'); return; }
  let hayAlgo = false;

  for (const cur of [_sel]) {
    if (!filtroTxt) {
      caja.appendChild(renderCurso(cur, true));
      hayAlgo = true;
      continue;
    }
    // con búsqueda: mostrar solo clases cuyo título o material coincida
    const filtrado = { ...cur };
    filtrado.modulos = (cur.modulos || [])
      .map((m) => ({
        titulo: m.titulo,
        clases: (m.clases || []).filter((cl) =>
          cl.titulo.toLowerCase().includes(filtroTxt) ||
          (cl.archivos || []).some((f) => (f.nombre || '').toLowerCase().includes(filtroTxt)))
      }))
      .filter((m) => m.clases.length > 0);
    if (!filtrado.modulos.length) continue;
    caja.appendChild(renderCurso(filtrado, false));
    hayAlgo = true;
  }

  if (filtroTxt && !hayAlgo) {
    aviso.classList.remove('hidden');
    aviso.textContent = `Sin resultados para "${filtroTxt}". Probá con otra palabra.`;
  } else {
    aviso.classList.add('hidden');
  }
  const bt = document.getElementById('btnExpandirTodo');
  if (bt) bt.textContent = 'Expandir todo ▾';
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth(localStorage.getItem('itc_clases_nombre'))) return;

  // Solo alumnos: el docente no entra acá
  if (localStorage.getItem('itc_clases_tipo') !== 'alumno') {
    location.href = '/gestor';
    return;
  }

  try {
    const res = await apiFetch('/alumno/catalogo');
    if (res.status === 401) return logout();
    if (!res.ok) throw new Error('No se pudo cargar tu material.');
    const d = await res.json();
    _cursos = d.cursos || [];
    // programas de estudios oficiales (estaticos, de itcarg.com)
    let _planes = {};
    try { const rp = await fetch('/data/planes.json'); if (rp.ok) _planes = await rp.json(); } catch (e) {}

    document.getElementById('alumnoSaludo').textContent = `Hola, ${d.nombre_completo || 'alumno'} 👋`;
    document.getElementById('loading').classList.add('hidden');

    if (d.sinMateriales) {
      document.getElementById('alumnoCursoNombre').textContent = 'Tu profesor todavía no habilitó materiales para vos.';
      const e = document.getElementById('empty');
      e.classList.remove('hidden');
      e.textContent = 'Cuando el profesor los habilite, van a aparecer acá.';
      return;
    }
    if (!_cursos.length) {
      document.getElementById('alumnoCursoNombre').textContent = 'Sin cursos asignados todavía.';
      const e = document.getElementById('empty');
      e.classList.remove('hidden');
      e.textContent = 'Consultá con el administrador para que te asigne un curso.';
      return;
    }

    /* ── Grilla de tarjetas por curso (estilo panel de docentes) ── */
    const cajaGrilla = document.getElementById('grillaCursos');
    const cajaVolver = document.getElementById('cajaVolver');
    const heroNombre = document.getElementById('alumnoCursoNombre');

    function vistasDe(cur) {
      let n = 0;
      for (const m of cur.modulos || []) for (const cl of (m.clases || [])) if (leidos.has(cl.id)) n++;
      return n;
    }

    function renderGrilla() {
      cajaGrilla.innerHTML = '';
      document.getElementById('main').classList.add('grid-vista');
      const grid = document.createElement('div');
      grid.className = 'alumno-cursos-grid';
      for (const cur of _cursos) {
        const nClases = cur.totalClases || 0;
        const v = vistasDe(cur);
        const card = document.createElement('div');
        card.className = 'alumno-curso-card';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute('aria-label', 'Entrar a ' + cur.nombre);
        card.innerHTML =
          `<img class="alumno-curso-thumb" alt="${esc(cur.nombre)}" loading="lazy">` +
          `<div class="alumno-curso-body">` +
          `  <b>${esc(cur.emoji || '')} ${esc(cur.nombre)}</b>` +
          `  <small>${nClases} clase${nClases === 1 ? '' : 's'} · ${cur.totalMateriales || 0} materiales · ${v} vista${v === 1 ? '' : 's'}</small>` +
          `  <div class="alumno-curso-foot"><span class="btn btn-primary btn-sm">Entrar →</span></div>` +
          `</div>`;
        const img = card.querySelector('img');
        let intentoImg = 0;
        img.addEventListener('error', () => {
          intentoImg++;
          if (intentoImg === 1) img.src = '/img/cursos/' + cur.id + '.svg';
          else img.style.display = 'none';
        });
        img.src = '/img/cursos/' + cur.id + '.png';
        card.addEventListener('click', () => entrarCurso(cur));
        card.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); entrarCurso(cur); }
        });
        grid.appendChild(card);
      }
      cajaGrilla.appendChild(grid);
    }

    /* ——— Programa de estudios (presentación como en la página oficial) ——— */
    function renderPrograma(cur) {
      const caja = document.getElementById('cajaPrograma');
      const plan = (_planes || {})[cur.id];
      caja.innerHTML = '';
      if (!plan || !Array.isArray(plan.modulos) || !plan.modulos.length) { caja.classList.add('hidden'); return; }
      caja.classList.remove('hidden');
      const totalCls = plan.modulos.reduce((n, m) => n + ((m.clases || []).length), 0);
      const sect = document.createElement('section');
      sect.className = 'plan-curso';
      sect.innerHTML =
        `<div class="plan-head"><div><b>📋 Programa de estudios</b>` +
        `<small>${esc(plan.nombre || cur.nombre)} · ${plan.modulos.length} módulos · ${totalCls} clases</small></div>` +
        `<a class="btn btn-primary btn-sm" href="${esc(plan.pdf || '')}" target="_blank" rel="noopener noreferrer">⬇ Descargar plan de estudios (PDF)</a></div>`;
      if (plan.paraQuien) sect.innerHTML += `<p class="plan-quien"><b>¿Para quién es?</b> ${esc(plan.paraQuien)}</p>`;
      let n = 1;
      let detalles = '<details class="plan-modulos"><summary>Ver las clases por módulo</summary><div class="plan-modulos-body">';
      for (const m of plan.modulos) {
        const items = (m.clases || []).map((c) => `<li><b>Clase ${n++}:</b> ${esc(c)}</li>`).join('');
        detalles +=
          `<div class="plan-modulo">` +
          `<h4>${esc(m.titulo || '')}${m.software ? ` <small>${esc(m.software)}</small>` : ''}</h4>` +
          `<ol>${items}</ol></div>`;
      }
      detalles += '</div></details>';
      sect.innerHTML += detalles;
      caja.appendChild(sect);
    }

    function entrarCurso(cur) {
      _sel = cur;
      cajaGrilla.classList.add('hidden');
      document.getElementById('main').classList.remove('grid-vista');
      document.getElementById('listaMaterial').innerHTML = '';
      if (_cursos.length > 1) cajaVolver.classList.remove('hidden');
      document.getElementById('cajaBuscar').classList.remove('hidden');
      heroNombre.textContent = `${cur.emoji || ''} ${cur.nombre}`;
      document.title = `Mi Aula — ${cur.nombre}`;
      render();
      renderPrograma(cur);
      window.scrollTo({ top: 0 });
    }

    function volverGrilla() {
      _sel = null;
      document.getElementById('alumnoBuscar').value = '';
      render();
      cajaGrilla.classList.remove('hidden');
      cajaVolver.classList.add('hidden');
      document.getElementById('cajaPrograma').classList.add('hidden');
      document.getElementById('cajaBuscar').classList.add('hidden');
      document.getElementById('main').classList.add('grid-vista');
      heroNombre.textContent = `${_cursos.length} capacitaciones`;
      document.title = `Mi Aula — ${_cursos.length} capacitaciones`;
      renderGrilla();
      window.scrollTo({ top: 0 });
    }

    document.getElementById('btnVolverCursos').addEventListener('click', volverGrilla);

    /* vista inicial: 1 curso entra directo; varios muestran la grilla de tarjetas */
    if (_cursos.length === 1) {
      document.title = `Mi Aula — ${_cursos[0].nombre}`;
      entrarCurso(_cursos[0]);
    } else {
      heroNombre.textContent = `${_cursos.length} capacitaciones`;
      document.title = `Mi Aula — ${_cursos.length} capacitaciones`;
      renderGrilla();
    }

    // Deep-link por clase: /alumno#clase=<id> abre ese curso y hace scroll a la clase
    const hashClase = (location.hash.match(/#clase=([^&]+)/) || [])[1];
    if (hashClase) {
      const idObjetivo = decodeURIComponent(hashClase);
      if (!_sel) {
        const cont = _cursos.find((c) => (c.modulos || []).some((m) => (m.clases || []).some((x) => x.id === idObjetivo)));
        if (cont) entrarCurso(cont);
      }
      const det = document.getElementById('clase-' + idObjetivo);
      if (det) {
        det.open = true;
        setTimeout(() => det.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
      }
    }
    const input = document.getElementById('alumnoBuscar');
    let timer = null;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => render(input.value), 200);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { input.value = ''; render(''); }
    });

    // Expandir / contraer todas las clases (estilo Moodle)
    const btnTodo = document.getElementById('btnExpandirTodo');
    btnTodo.addEventListener('click', () => {
      const detalles = document.querySelectorAll('#listaMaterial details.alumno-clase');
      const algunoCerrado = [...detalles].some((d) => !d.open);
      detalles.forEach((d) => { d.open = algunoCerrado; });
      btnTodo.textContent = algunoCerrado ? 'Contraer todo ▴' : 'Expandir todo ▾';
    });

    // Índice lateral (estilo Moodle): cajón con módulos y clases
    const btnIndice = document.createElement('button');
    btnIndice.type = 'button';
    btnIndice.className = 'btn-toggle-todo';
    btnIndice.id = 'btnIndice';
    btnIndice.title = 'Mostrar/ocultar índice del curso';
    btnIndice.textContent = '📑 Índice';
    document.getElementById('cajaBuscar').appendChild(btnIndice);

    const indicePanel = document.createElement('aside');
    indicePanel.id = 'indicePanel';
    indicePanel.className = 'indice-panel hidden';
    document.getElementById('listaMaterial').parentNode.insertBefore(indicePanel, document.getElementById('listaMaterial'));

    function pintarIndice() {
      indicePanel.innerHTML = '<div class="indice-titulo">📑 Índice del curso</div>';
      const listaVista = _sel ? [_sel] : _cursos;
      for (const cur of listaVista) {
        if (listaVista.length > 1) {
          const h = document.createElement('div');
          h.className = 'indice-curso';
          h.textContent = `${cur.emoji || ''} ${cur.nombre}`;
          indicePanel.appendChild(h);
        }
        for (const mod of cur.modulos || []) {
          const mt = document.createElement('div');
          mt.className = 'indice-modulo';
          mt.textContent = mod.titulo;
          indicePanel.appendChild(mt);
          for (const cl of mod.clases || []) {
            if (!(cl.archivos || []).length) continue;
            const a = document.createElement('a');
            a.className = 'indice-clase';
            a.href = '#clase-' + cl.id;
            a.textContent = cl.titulo;
            a.addEventListener('click', (e) => {
              e.preventDefault();
              if (!_sel) {
                const cont = _cursos.find((c) => (c.modulos || []).some((m) => (m.clases || []).some((x) => x.id === cl.id)));
                if (cont) entrarCurso(cont);
              }
              const det = document.getElementById('clase-' + cl.id);
              if (det) { det.open = true; det.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
            });
            indicePanel.appendChild(a);
          }
        }
      }
    }
    btnIndice.addEventListener('click', () => {
      indicePanel.classList.toggle('hidden');
      if (!indicePanel.classList.contains('hidden')) pintarIndice();
    });
    pintarIndice();
  } catch (err) {
    toast(err.message);
    document.getElementById('loading').classList.add('hidden');
  }

  document.getElementById('modalClose').addEventListener('click', cerrarModal);
  document.getElementById('modalOpen').addEventListener('click', () => {
    if (modalFrame.src) window.open(modalFrame.src, '_blank', 'noopener');
  });
  modal.addEventListener('click', (e) => { if (e.target === modal) cerrarModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrarModal(); });
});
