'use strict';

const modal = document.getElementById('modal');
const modalFrame = document.getElementById('modalFrame');
const modalTitle = document.getElementById('modalTitle');

function abrirModal(url, nombre) {
  modalTitle.textContent = nombre;
  modalFrame.src = url;
  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}
function cerrarModal() {
  modal.classList.add('hidden');
  modalFrame.src = 'about:blank';
  document.body.style.overflow = '';
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
  }

  if (f.url) {
    const a = document.createElement('a');
    a.className = 'btn btn-ghost btn-sm';
    a.href = f.url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.textContent = f.tipo === 'Carpeta' ? '📂 Abrir carpeta' : '⬇ Descargar';
    wrap.appendChild(a);
  } else {
    const b = document.createElement('span');
    b.className = 'badge-wait';
    b.textContent = '⏳ Proximamente';
    b.title = 'Este archivo todavia no se sincronizo a Drive.';
    wrap.appendChild(b);
  }
  return wrap;
}

function renderArchivo(f) {
  const item = document.createElement('div');
  item.className = 'archivo-item';
  const meta = `<small>` +
    `${f.tipo}` +
    (f.size ? ` · ${fmtSize(f.size)}` : '') +
    (f.archivos ? ` · ${f.archivos} elementos` : '') +
    (f.driveId ? ' · ✅ sincronizado' : f.url ? '' : ' · ⏳ pendiente') +
    `</small>`;
  item.innerHTML =
    `<span class="f-emoji" aria-hidden="true">${f.emoji}</span>` +
    `<span class="info"><b>${esc(f.nombre)}</b>${meta}${f.descripcion ? `<small>${esc(f.descripcion)}</small>` : ''}</span>`;
  item.appendChild(accionesArchivo(f));
  return item;
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth(localStorage.getItem('itc_clases_nombre'))) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    location.href = '/inicio';
    return;
  }

  const list = document.getElementById('list');
  try {
    const res = await apiFetch(`/clase/${encodeURIComponent(id)}`);
    if (res.status === 401) return logout();
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Clase no encontrada.');
    }
    const data = await res.json();
    const clase = data.clase;

    document.getElementById('claseTitulo').textContent = clase.titulo;
    document.getElementById('claseSub').textContent = `Capacitacion: ${data.curso} · Materiales: ${clase.archivos.length}`;
    document.title = `${clase.titulo} - ITC Aula Virtual`;
    const crumbCurso = document.getElementById('crumbCurso');
    crumbCurso.textContent = data.curso;
    crumbCurso.href = `/curso?id=${encodeURIComponent(clase.cursoId)}`;
    document.getElementById('crumbModulo').textContent = clase.modulo || 'Clase';

    list.innerHTML = '';
    if (!clase.archivos || clase.archivos.length === 0) {
      const e = document.createElement('div');
      e.className = 'empty';
      e.textContent = 'Esta clase todavia no tiene materiales cargados.';
      list.appendChild(e);
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'archivo-list';
      clase.archivos.forEach((f) => wrap.appendChild(renderArchivo(f)));
      list.appendChild(wrap);
    }

    document.getElementById('loading').classList.add('hidden');
    list.classList.remove('hidden');
  } catch (err) {
    toast(err.message);
    document.getElementById('loading').classList.add('hidden');
  }

  document.getElementById('modalClose').addEventListener('click', cerrarModal);
  document.getElementById('modalFrame').addEventListener('load', () => {
    const openBtn = document.getElementById('modalOpen');
    openBtn.href = modalFrame.src;
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) cerrarModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cerrarModal();
  });
});