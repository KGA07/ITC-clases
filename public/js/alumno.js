'use strict';
// Aula del alumno: solo muestra el curso asignado y los materiales
// habilitados material por material por el docente.

const modal = document.getElementById('modal');
const modalFrame = document.getElementById('modalFrame');

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

function renderClase(cl) {
  if (!(cl.archivos || []).length) return null;
  const det = document.createElement('details');
  det.className = 'alumno-clase';
  det.innerHTML = `<summary>📘 ${esc(cl.titulo)}<small style="font-weight:600;color:var(--text-soft)"> · ${cl.archivos.length} materiales</small></summary>`;
  (cl.archivos || []).forEach((f) => {
    const fila = document.createElement('div');
    fila.className = 'alumno-archivo';
    fila.innerHTML =
      `<span class="f-emoji" aria-hidden="true">${f.emoji || '📄'}</span>` +
      `<span class="info"><b>${esc(f.nombre)}</b><small>${esc(f.tipo || '')}${f.size ? ' · ' + fmtSize(f.size) : ''}</small></span>`;
    fila.appendChild(accionesArchivo(f));
    det.appendChild(fila);
  });
  return det;
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

    document.getElementById('alumnoSaludo').textContent = `Hola, ${d.nombre_completo || 'alumno'} 👋`;
    document.getElementById('loading').classList.add('hidden');

    // cursos del alumno (array) con compat de un solo curso
    const listaCursos = Array.isArray(d.cursos) && d.cursos.length
      ? d.cursos
      : (d.curso ? [d.curso] : []);

    if (d.sinMateriales) {
      document.getElementById('alumnoCursoNombre').textContent = 'Tu profesor todavía no habilitó materiales para vos.';
      const e = document.getElementById('empty');
      e.classList.remove('hidden');
      e.textContent = 'Cuando el profesor los habilite, van a aparecer acá.';
      return;
    }
    if (!listaCursos.length) {
      document.getElementById('alumnoCursoNombre').textContent = 'Sin cursos asignados todavía.';
      const e = document.getElementById('empty');
      e.classList.remove('hidden');
      e.textContent = 'Consultá con el administrador para que te asigne un curso.';
      return;
    }

    if (listaCursos.length === 1) {
      document.getElementById('alumnoCursoNombre').textContent = `${listaCursos[0].emoji || ''} ${listaCursos[0].nombre}`;
      document.title = `Mi Aula — ${listaCursos[0].nombre}`;
    } else {
      document.getElementById('alumnoCursoNombre').textContent = `${listaCursos.length} capacitaciones · ${listaCursos.map((c) => c.emoji || '').join(' ')}`;
      document.title = `Mi Aula — ${listaCursos.length} capacitaciones`;
    }

    const caja = document.getElementById('listaMaterial');
    caja.innerHTML = '';
    let hayAlgo = false;
    for (const cur of listaCursos) {
      // con más de un curso, un título por cada uno
      if (listaCursos.length > 1) {
        const t = document.createElement('h2');
        t.className = 'alumno-curso-titulo';
        t.textContent = `${cur.emoji || ''} ${cur.nombre}`;
        caja.appendChild(t);
      }
      for (const mod of cur.modulos || []) {
        const tituloMod = document.createElement('div');
        tituloMod.className = 'alumno-modulo';
        tituloMod.textContent = mod.titulo;
        caja.appendChild(tituloMod);
        for (const cl of mod.clases || []) {
          const resCl = await apiFetch(`/alumno/clase/${encodeURIComponent(cl.id)}`);
          if (!resCl.ok) continue;
          const dc = await resCl.json();
          const nodo = renderClase(dc.clase);
          if (nodo) { caja.appendChild(nodo); hayAlgo = true; }
        }
      }
    }
    if (!hayAlgo) {
      const e = document.getElementById('empty');
      e.classList.remove('hidden');
      e.textContent = 'Todavía no hay materiales habilitados para vos.';
    }
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
