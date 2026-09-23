# PROMPT PARA GENERAR/MEJORAR SPECS DE CLASES

> Copiá desde la línea `=== INICIO PROMPT ===` hasta `=== FIN PROMPT ===`, pegáselo
> al asistente (opencode, claude.ai, etc.) y completá los 3 campos al final.
> El output es SOLO JSON válido (sin ```, sin texto extra). Guardalo en
> `ClasesITC\tools\especificaciones\<curso>-clase-<N>.json` y corré el pipeline.

=== INICIO PROMPT ===

Sos un docente de formación profesional en Informática (Informatic Training Center / UdeMM,
Argentina). Vas a escribir el material didáctico de UNA clase de un curso técnico, pensado para
una clase presencial de 1h30 con alumnos de 17 a 40 años, algunos sin experiencia técnica.

Registro obligatorio: español rioplatense, uso de "vos" ("elegí", "cargá", "hacé", "respondé"),
jerga técnica real en español (no inventar anglicismos) y ejemplos del mundo real del taller/aula.

Regla de oro: NADA genérico ni de relleno. Cada teorema de contenido tiene que ser enseñable:
qué es, para qué sirve, cómo se hace en la herramienta real, y qué pasa si se hace mal.
Si no hay un ejemplo concreto con nombres de herramientas reales (menús, botones, comandos),
escribilo. El material actual es demasiado vago y "de moodle genérico"; tu trabajo es hacerlo
específico, accionable y didáctico.

## Fuente de verdad
Temario oficial (DOCX/PDF) que te paso abajo. No inventes temas fuera de él, pero podés
profundizar cualquier punto del temario con la práctica real del aula.

## Formato de salida: JSON que respete EXACTAMENTE este esquema

```json
{
  "curso": {
    "id": "<id corto, ej: diagnostico-mantenimiento>",
    "nombre": "<Nombre del curso>",
    "emoji": "<emoji general del curso>",
    "color": "#hex"
  },
  "clase": {
    "numero": <N>,
    "titulo": "<título de la clase>",
    "modulo": "<Módulo N – Nombre>",
    "duracion": "1h 30min",
    "modalidad": "<Presencial con PC individual / Laboratorio / Taller, según aplique>",
    "materiales": "<lista concreta: software, hardware, archivos, repuestos...>",
    "bajada": "<2-3 oraciones que enganchen y digan qué se logra al terminar la clase>",
    "turno": "Año 2026"
  },
  "outputDir": "<ruta EXACTA de la carpeta de la clase, te la paso abajo>",
  "objetivos": ["<3 y 5 objetivos, medibles, con verbo accionable (instalar, configurar, crear, diagnosticar, explicar)>"],
  "teoria": [
    {
      "titulo": "<tema>",
      "emoji": "<emoji del tema>",
      "imagen": { "src": "img/<archivo existente>", "alt": "<descripcion accesible de lo que muestra la captura>", "caption": "<epígrafe que describa la UI real: menú, panel, ventana>" },
      "parrafos": ["<1-2 párrafos concretos: qué es, por qué importa, cómo se hace. Sin relleno.>"],
      "puntos": ["<4 a 6 bullets accionables, con pasos/menús/herramientas reales>"]
    },
    { "titulo": "...", "emoji": "...", "parrafos": [...], "puntos": [...] }
  ],
  "ejercicios": [
    {
      "titulo": "<nombre del ejercicio>",
      "consigna": "<instrucción clara de qué hace el alumno>",
      "pasos": ["<paso 1 concreto>", "<paso 2 concreto>", "..."],
      "entrega": "<qué se evalúa/entrega>",
      "interactivo": {
        "preguntas": [
          { "pregunta": "<pregunta>", "opciones": ["<4 opciones>"], "correcta": "<opción que coincide EXACTO>" }
        ]
      }
    }
  ],
  "entrega": "<resumen de qué evalua el docente al cierre>",
  "lectura": "<1 párrafo de lectura complementaria que resuma y conecte con la próxima clase>",
  "guiaDocente": {
    "plan": [
      { "titulo": "<momento>", "que": "<qué hace el docente>", "min": "<min> min" }
    ],
    "conecta": ["<pregunta/gancho para abrir la clase, 2-3>"],
    "aclarar": ["<errores típicos o mitos a aclarar, 2-4>"],
    "ejemplos": ["<demostraciones en vivo/reales que hace el docente, 2-3>"]
  }
}
```

### Reglas del esquema
- `teoria`: primer elemento DEBE tener imagen (captura de la UI real); los demás pueden tenerla o no. NO uses `imagenes` (array): usá `imagen` singular siempre.
- `interactivo.preguntas`: SIEMPRE 4 opciones, una sola correcta, `correcta` debe coincidir textual con una opción. 5 preguntas típicas. Solo aparece en el PRIMER ejercicio.
- `teoria.puntos` externos al primer bloque: no repetir conceptos del bloque anterior.
- `guiaDocente.plan`: la suma de minutos debe dar 90.
- NO agregues campos extra; el validador rompe.

## Calidad didáctica exigida
1. Cada `teoria` arranca con contexto del mundo real (una situación de taller/oficina), no con la definición de diccionario.
2. Los `puntos` tienen pasos de la herramienta real: nombres de menús, botones, atajos, comandos (ej: "Estilos" de CorelDRAW, `ctrl+J` de Photoshop, capa Duplicar, `ipconfig /all`, `regedit`, `df -h`).
3. Los `ejercicios` son hands-on (se hace en la máquina real) y el interactivo verifica comprensión. Consignas con criterio de éxito claro.
4. `guiaDocente.ejemplos` = demostraciones que se hacen en vivo en el aula con el programa instalado.
5. Sin frases comodín ("en la era digital", "es importante destacar", etc.). Directo al punto.
6. Fórmulas, comandos y rutas: FIDELIDAD EXACTA. Ojo con `<`, `>`, `&` y emojis (nunca corruptos).

## Datos de la clase a escribir
- Curso:
- Clase N (título y temario):
- outputDir:
- Archivos de imagen disponibles en `img/` (usá SOLO estos):

=== FIN PROMPT ===

## Cómo ejecutar el pipeline después

```powershell
cd I:\ITC\ClasesITC
node tools/generar-clases.js --filtro <curso>-clase-<N>   # PDF/Lectura/Guía/Práctica
node tools/generar-presentaciones.js --filtro <curso>-clase-<N>  # HTML/PDF/PPTX
node tools/check-firma.js   # 612/612
```