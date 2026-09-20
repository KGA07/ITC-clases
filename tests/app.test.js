'use strict';
const request = require('supertest');
const app = require('../app');
const db = require('../data/db');
const { clearLoginAttempts } = require('../middleware/security');

beforeEach(async () => {
  clearLoginAttempts();
  await db.resetDB();
});

describe('Autenticacion', () => {
  test('login correcto devuelve tokens y tipo profesor', async () => {
    const res = await request(app).post('/api/login').send({ nombre: 'GKempe', password: '1234' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body).toHaveProperty('refreshToken');
    expect(res.body.tipo).toBe('profesor');
  });

  test('login con password incorrecta responde 401', async () => {
    const res = await request(app).post('/api/login').send({ nombre: 'GKempe', password: 'mal' });
    expect(res.status).toBe(401);
  });

  test('password del admin por defecto funciona', async () => {
    const res = await request(app).post('/api/login').send({ nombre: 'admin', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.tipo).toBe('admin');
  });

  test('refresh rotacion: nuevo access y refresh', async () => {
    const login = await request(app).post('/api/login').send({ nombre: 'GKempe', password: '1234' });
    const res = await request(app).post('/api/refresh').send({ refreshToken: login.body.refreshToken });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.refreshToken).toBeTruthy();
    expect(res.body.refreshToken).not.toBe(login.body.refreshToken);
  });
});

describe('Proteccion de rutas', () => {
  test('catalogo sin token -> 401', async () => {
    const res = await request(app).get('/api/catalogo');
    expect(res.status).toBe(401);
  });

  test('curso sin token -> 401', async () => {
    const res = await request(app).get('/api/curso/asistente-administrativo');
    expect(res.status).toBe(401);
  });

  test('buscar sin token -> 401', async () => {
    const res = await request(app).get('/api/buscar?q=excel');
    expect(res.status).toBe(401);
  });
});

describe('Catalogo de materiales', () => {
  let token;
  beforeAll(async () => {
    const login = await request(app).post('/api/login').send({ nombre: 'GKempe', password: '1234' });
    token = login.body.token;
  });

  test('GET /api/catalogo lista capacitaciones con temario', async () => {
    const res = await request(app).get('/api/catalogo').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.capacitaciones.length).toBeGreaterThan(5);
    const conTemario = res.body.capacitaciones.some((c) => c.temarioHtml);
    expect(conTemario).toBe(true);
  });

  test('GET /api/curso/:id devuelve modulos y clases', async () => {
    const res = await request(app).get('/api/curso/asistente-administrativo').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe('asistente-administrativo');
    expect(res.body.modulos.length).toBeGreaterThan(0);
    expect(res.body.modulos[0].clases.length).toBeGreaterThan(0);
  });

  test('GET /api/curso/:id inexistente -> 404', async () => {
    const res = await request(app).get('/api/curso/no-existe').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('GET /api/clase/:id devuelve archivos con url o embebible', async () => {
    const curso = await request(app).get('/api/curso/asistente-administrativo').set('Authorization', `Bearer ${token}`);
    const claseId = curso.body.modulos[0].clases[0].id;
    const res = await request(app).get(`/api/clase/${claseId}`).set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.clase.archivos.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('curso');
  });

  test('GET /api/buscar?q=devuelve resultados agrupados', async () => {
    const res = await request(app).get('/api/buscar?q=excel').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.resultados)).toBe(true);
    expect(res.body.resultados.length).toBeGreaterThan(0);
  });
});

describe('Paginado estatico', () => {
  test('GET / sirve el login', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('loginForm');
  });

  test('GET /inicio sirve la home (sin contenido dinamico en SSR)', async () => {
    const res = await request(app).get('/inicio');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Clases y materiales');
  });
});