'use strict';
// Visor a pantalla completa: muestra embebidos locales (/html/interactivos/…)
// o PDF de Drive inline (…/file/d/ID/preview), con nueva pestaña y descarga.
//
// Parámetros de la URL:
//   t     → titulo (opcional)
//   src   → URL relativa del embed local (html autocontenidos)
//   drive → id de un archivo de Drive (se abre con el visor de Drive)
//   dl    → URL de descarga (opcional; por defecto, la de Drive si hay id)

function q(k) {
  return new URLSearchParams(location.search).get(k) || '';
}

function idDeDrive(url) {
  const m = String(url || '').match(/[?&]id=([A-Za-z0-9_-]+)/) || String(url || '').match(/\/file\/d\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : '';
}

document.addEventListener('DOMContentLoaded', () => {
  const titulo = q('t');
  document.getElementById('visorTitulo').textContent = titulo || 'Material';
  if (titulo) document.title = `${titulo} - ITC Aula Virtual`;

  const frame = document.getElementById('visorFrame');
  const nueva = document.getElementById('visorNueva');
  const bajar = document.getElementById('visorDescargar');

  const src = q('src');
  const driveId = q('drive') || idDeDrive(q('url'));

  if (driveId) {
    // PDF/PPTX de Drive: el visor embebido de Google muestra el documento
    // directamente, sin forzar la descarga.
    frame.src = `https://drive.google.com/file/d/${driveId}/preview`;
    const origen = `https://drive.google.com/file/d/${driveId}/view`;
    nueva.href = origen;
    nueva.classList.remove('hidden');
    bajar.href = q('dl') || `https://drive.google.com/uc?export=download&id=${driveId}`;
    bajar.classList.remove('hidden');
  } else if (src) {
    frame.src = src;
    const absoluta = new URL(src, location.href).href;
    nueva.href = absoluta;
    nueva.classList.remove('hidden');
  } else {
    frame.srcdoc = '<p style="font-family:sans-serif;padding:24px">Material no disponible.</p>';
  }

  document.getElementById('visorVolver').addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else window.close();
  });
});
