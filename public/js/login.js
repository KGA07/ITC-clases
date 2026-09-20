'use strict';

document.addEventListener('DOMContentLoaded', () => {
  if (isAuthed()) {
    location.href = '/inicio';
    return;
  }

  const form = document.getElementById('loginForm');
  const errBox = document.getElementById('errorBox');
  const errText = document.getElementById('errorText');
  const btn = document.getElementById('loginBtn');
  const btnText = document.getElementById('loginBtnText');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nombre = document.getElementById('nombre').value.trim();
    const password = document.getElementById('password').value;

    errBox.classList.remove('show');
    btn.disabled = true;
    btnText.textContent = 'Verificando...';

    try {
      const res = await postLogin('/login', { nombre, password });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo iniciar sesion.');
      setTokens(data.token, data.refreshToken);
      localStorage.setItem('itc_clases_nombre', data.nombre_completo || data.nombre);
      location.href = '/inicio';
    } catch (err) {
      errText.textContent = err.message;
      errBox.classList.add('show');
      btn.disabled = false;
      btnText.textContent = 'Ingresar';
    }
  });

  const tt = document.getElementById('themeToggle');
  if (tt) {
    tt.addEventListener('click', toggleTheme);
    tt.setAttribute('aria-pressed', document.documentElement.dataset.theme === 'dark');
  }
});