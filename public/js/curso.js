'use strict';

function renderModulo(mod) {
  const div = document.createElement('div');
  div.className = 'modulo';
  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'modulo-head';
  head.innerHTML =
    `<span style="opacity:.7">📁</span><span>${esc(mod.titulo)}</span>` +
    `<span class="count" style="margin-left:4px;color:var(--text-soft);font-size:12.5px;font-weight:600">(${mod.clases.length})</span>` +
    `<span class="chev" aria-hidden="true">▾</span>`;
  const body = document.createElement('div');
  body.className = 'modulo-body hidden';

  mod.clases.forEach((cl) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'clase-row';
    row.innerHTML =
      `<span class="num">${cl.count || cl.archivos.length}</span><b>${esc(cl.titulo)}</b>` +
      `<span class="count">${cl.count || cl.archivos.length} material(es) →</span>`;
    row.addEventListener('click', () => (location.href = `/clase?id=${encodeURIComponent(cl.id)}`));
    body.appendChild(row);
  });

  div.appendChild(head);
  div.appendChild(body);
  head.addEventListener('click', () => {
    div.classList.toggle('open');
    body.classList.toggle('hidden');
  });
  return div;
}

document.addEventListener('DOMContentLoaded', async () => {
  if (!requireAuth(localStorage.getItem('itc_clases_nombre'))) return;
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    location.href = '/inicio';
    return;
  }

  const content = document.getElementById('content');
  try {
    const res = await apiFetch(`/curso/${encodeURIComponent(id)}`);
    if (res.status === 401) return logout();
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Curso no encontrado.');
    }
    const curso = await res.json();

    document.getElementById('crumbCurso').textContent = curso.nombre;
    document.title = `${curso.nombre} - ITC Aula Virtual`;

    const hero = document.createElement('section');
    hero.className = 'curso-hero';
    hero.innerHTML =
      `<div class="emoji-big" style="background:${esc(curso.color)}22;border:2px solid ${esc(curso.color)}" aria-hidden="true">${curso.emoji}</div>` +
      `<div style="flex:1;min-width:0"><h1>${esc(curso.nombre)}</h1>` +
      `<div class="stats">` +
      (curso.stats ? `<span class="stats-pill">📚 ${curso.stats.clases} clases</span><span class="stats-pill">📎 ${curso.stats.archivos} archivos</span><span class="stats-pill">💾 ${(curso.stats.tamanoMB || 0).toFixed(0)} MB</span>` : '') +
      `</div></div>`;
    content.appendChild(hero);

    if (curso.temarioHtml) {
      const temario = document.createElement('details');
      temario.className = 'temario-box';
      temario.innerHTML =
        `<summary><span aria-hidden="true">📋</span> Plan de estudios / temario <span class="chev" aria-hidden="true">▾</span></summary>` +
        `<div class="temario-body">${curso.temarioHtml}</div>`;
      content.appendChild(temario);
    } else {
      const p = document.createElement('p');
      p.className = 'sub';
      p.textContent = 'Este curso todavia no tiene temario cargado.';
      content.appendChild(p);
    }

    const modulosWrap = document.createElement('section');
    modulosWrap.setAttribute('aria-label', 'Modulos y clases');
    (curso.modulos || []).forEach((m, i) => {
      if (!i) m._open = true;
      const modEl = renderModulo(m);
      if (m._open) {
        modEl.classList.add('open');
        modEl.querySelector('.modulo-body').classList.remove('hidden');
      }
      modulosWrap.appendChild(modEl);
    });
    content.appendChild(modulosWrap);

    if (!curso.modulos || curso.modulos.length === 0) {
      const e = document.createElement('div');
      e.className = 'empty';
      e.textContent = 'Este curso aún no tiene clases cargadas.';
      content.appendChild(e);
    }

    document.getElementById('loading').classList.add('hidden');
    content.classList.remove('hidden');
  } catch (err) {
    toast(err.message);
    document.getElementById('loading').classList.add('hidden');
  }
});