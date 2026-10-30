const CLASE_DATA = {
  modulos: [
    {
      numero: 1,
      titulo: "Anatomía de Google Antigravity y sus Modelos",
      duracion: "20 min",
      resumen: "Se introduce la diferencia fundamental entre los asistentes de IA tradicionales y el entorno de desarrollo asistido por agentes (Agentic Coding Environment) de Google Antigravity. Se detalla la arquitectura de orquestación de subagentes, la manipulación segura del sistema de archivos local, y los criterios para seleccionar modelos de IA adecuados (Gemini 3.5 Pro/Ultra para razonamiento, Claude 3.5 Sonnet para frontend y Gemini 3.5 Flash para tareas rápidas).",
      metas: [
        "Comprender la diferencia entre un asistente de IA pasivo y un entorno agente interactivo.",
        "Aprender a delegar y supervisar tareas realizadas por subagentes especializados.",
        "Conocer las fortalezas de los distintos modelos de lenguaje (Gemini Pro/Flash, Claude Sonnet) para seleccionar el adecuado según el escenario."
      ]
    },
    {
      numero: 2,
      titulo: "Integración con Python (El motor de datos) - Caso de estudio: Pandas + API Serverless",
      duracion: "40 min",
      resumen: "Construcción de una arquitectura moderna que acopla un backend sin estado (stateless) en Python (usando Flask y Pandas para procesamiento de datos en memoria en formato Excel/CSV) con un frontend web interactivo estilizado en CSS/HTML/JS.",
      metas: [
        "Aprender a estructurar un proyecto web serverless combinando Python backend y JS frontend.",
        "Implementar lectura de archivos binarios (Excel) directamente en memoria RAM usando Pandas y BytesIO sin persistir archivos temporalmente.",
        "Integrar una API REST usando Flask, habilitando CORS para desarrollo local."
      ]
    },
    {
      numero: 3,
      titulo: "Control de Versiones con GitHub y Trabajo Asistido",
      duracion: "30 min",
      resumen: "Establecimiento de un flujo de trabajo en Git asistido por IA, en donde el agente propone comandos en la terminal integrada y el desarrollador actúa como supervisor y aprobador. Configuración de archivos de exclusión como .gitignore y conexión remota a GitHub.",
      metas: [
        "Aprobar y supervisar la ejecución de comandos sugeridos por la IA en la terminal local.",
        "Configurar el archivo .gitignore adecuado para ocultar entornos virtuales y cachés de Python.",
        "Vincular y sincronizar el repositorio local con un repositorio remoto en GitHub."
      ]
    },
    {
      numero: 4,
      titulo: "Despliegue Continuo (CI/CD) en Vercel",
      duracion: "20 min",
      resumen: "Despliegue final de la aplicación en la nube utilizando Vercel, configurando un archivo vercel.json para dirigir el enrutamiento de la API de Python de forma Serverless y el frontend estático desde la carpeta public.",
      metas: [
        "Configurar el archivo vercel.json con directivas de compilación (builds) y enrutamiento (routes).",
        "Configurar la integración automática (CI/CD) de Vercel con GitHub para despliegue ante nuevos commits.",
        "Asegurar la correcta accesibilidad pública del backend y frontend de forma conjunta."
      ]
    }
  ],
  apiPython: `from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import io

app = Flask(__name__)
CORS(app)  # Permite peticiones cruzadas en desarrollo local

@app.route('/api/process', methods=['POST'])
def process_data():
    if 'file' not in request.files:
        return jsonify({"error": "No se proporcionó ningún archivo"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "Nombre de archivo vacío"}), 400

    try:
        # Leer el buffer del archivo Excel directamente en memoria con Pandas
        file_bytes = file.read()
        df = pd.read_excel(io.BytesIO(file_bytes))
        
        # Validar columnas necesarias (ej. Ventas, Producto, Categoría)
        required_cols = {'Producto', 'Categoría', 'Ventas'}
        if not required_cols.issubset(df.columns):
            return jsonify({"error": f"El archivo debe contener las columnas: {required_cols}"}), 400

        # Procesar métricas usando Pandas
        total_ventas = float(df['Ventas'].sum())
        ticket_promedio = float(df['Ventas'].mean())
        
        # Agrupación de producto más vendido
        prod_grouped = df.groupby('Producto')['Ventas'].sum().reset_index()
        top_producto = prod_grouped.sort_values(by='Ventas', ascending=False).iloc[0]['Producto']
        
        # Desglose por categoría para gráficos interactivos
        cat_grouped = df.groupby('Categoría')['Ventas'].sum().reset_index()
        categorias_data = cat_grouped.to_dict(orient='records')

        # Formatear respuesta JSON
        response = {
            "metrics": {
                "totalVentas": total_ventas,
                "ticketPromedio": ticket_promedio,
                "topProducto": top_producto
            },
            "categories": categorias_data
        }
        
        return jsonify(response), 200

    except Exception as e:
        return jsonify({"error": f"Fallo al procesar el archivo: {str(e)}"}), 500

# Vercel requiere que el punto de entrada sea la app
if __name__ == '__main__':
    app.run(debug=True)`,
  vercelConfig: {
    "version": 2,
    "builds": [
      {
        "src": "api/index.py",
        "use": "@vercel/python"
      },
      {
        "src": "public/**",
        "use": "@vercel/static"
      }
    ],
    "routes": [
      {
        "src": "/api/(.*)",
        "dest": "api/index.py"
      },
      {
        "src": "/(.*)",
        "dest": "public/$1"
      }
    ]
  },
  promptsAlumno: [
    {
      paso: "Módulo 2 - Paso 1: Inicialización y Estructura Backend",
      prompt: "Actúa como un Ingeniero de Software Senior. Inicializa un nuevo proyecto web en la carpeta actual con una API Serverless en Python estructurada para Vercel. Crea un archivo `requirements.txt` que incluya `Flask`, `pandas`, `openpyxl` y `Flask-Cors`. Crea la API en `api/index.py` utilizando Flask. Esta API debe exponer un endpoint POST `/api/process` que acepte un archivo Excel, lo lea utilizando Pandas, calcule estadísticas clave (Total de ventas, Ticket Promedio, Producto más vendido y un desglose de ventas por categoría) y devuelva un JSON estructurado con los resultados."
    },
    {
      paso: "Módulo 2 - Paso 2: Generación del Frontend Premium e Interactivo",
      prompt: "Crea una interfaz web de usuario premium, moderna y responsiva dentro de la carpeta `public/`. Diseña un dashboard con colores oscuros (estilo Neon-Dark, HSL personalizado), tipografía Inter de Google Fonts, efectos de glassmorphism y micro-transiciones. El frontend debe permitir subir el archivo Excel mediante Drag & Drop, enviar el archivo a la API `/api/process`, mostrar loaders animados durante la carga, renderizar tarjetas de KPIs y mostrar un desglose visual interactivo de los datos en una tabla estilizada."
    },
    {
      paso: "Módulo 3 - Paso 1: Solicitar inicialización del repositorio local",
      prompt: "Inicializa un repositorio Git local en este directorio. Configura el archivo `.gitignore` para ignorar carpetas virtuales de Python (`venv`, `.venv`), archivos de cache (`__pycache__`), y variables de entorno. Crea el primer commit con el mensaje 'feat: inicializar API de procesamiento y frontend con Antigravity'."
    },
    {
      paso: "Módulo 3 - Paso 2: Conectar a GitHub",
      prompt: "Vincula este repositorio Git local al remoto `https://github.com/TU_USUARIO/antigravity-data-app.git`, renombra la rama principal a `main` y realiza el push inicial."
    },
    {
      paso: "Módulo 4: Configuración de enrutamiento Vercel",
      prompt: "Crea el archivo `vercel.json` en la raíz del proyecto para indicarle a Vercel que compile la carpeta `/api` usando el builder de Python y que redirija todas las peticiones que empiecen con `/api` a su respectivo script, mientras que el frontend se sirve desde la carpeta `public`."
    }
  ],
  comandosGit: [
    {
      descripcion: "Inicializar repositorio local y primer commit",
      comandos: [
        "git init",
        "git add .",
        "git commit -m \"feat: inicializar API de procesamiento y frontend con Antigravity\""
      ]
    },
    {
      descripcion: "Vincular con repositorio de GitHub y push inicial",
      comandos: [
        "git remote add origin https://github.com/TU_USUARIO/antigravity-data-app.git",
        "git branch -M main",
        "git push -u origin main"
      ]
    }
  ],
  rubricaRetoFinal: {
    titulo: "El Reto Final: Crea tu Propia Herramienta Basada en Datos",
    requisitos: [
      "Backend (Python): Debe usar Pandas para procesar al menos un conjunto de datos (subido por el usuario mediante un CSV o Excel).",
      "Frontend (UI/UX Premium): Diseñado con un estilo visual imponente. Debe incluir gráficos interactivos y controles dinámicos.",
      "Código Seguro y Limpio: Debe estar versionado en un repositorio público de GitHub con commits descriptivos y semánticos.",
      "Despliegue Exitoso: URL pública en Vercel funcionando al 100%."
    ],
    ideasProyectos: [
      {
        nombre: "Analizador de Finanzas Personales",
        descripcion: "Sube un Excel de extractos bancarios y genera un dashboard con categorías de gastos y alarmas de presupuesto."
      },
      {
        nombre: "Optimizador de Inventario para Pymes",
        descripcion: "Sube un inventario de productos y calcula automáticamente la rotación de stock y el punto de reorden recomendado."
      },
      {
        nombre: "Generador de Informes Académicos",
        descripcion: "Sube una lista de alumnos con notas y calcula promedios, tasas de aprobación y gráficos de distribución de calificaciones."
      }
    ],
    criteriosEvaluacion: [
      {
        criterio: "Funcionalidad Backend",
        excelente: "La API procesa el archivo de datos sin errores, realiza cálculos matemáticos avanzados y devuelve JSON estructurado correctamente.",
        aceptable: "La API procesa archivos básicos, pero falla ante entradas inesperadas o faltan cálculos clave.",
        insuficiente: "La API de Python no compila o no procesa los archivos.",
        puntosMax: 25
      },
      {
        criterio: "Diseño y UX/UI (Frontend)",
        excelente: "Interfaz web premium con diseño moderno, responsive, manejo de loaders, feedback de errores visuales y uso de gráficos dinámicos.",
        aceptable: "Interfaz funcional pero diseño básico, colores predeterminados o sin gráficos interactivos.",
        insuficiente: "La UI está rota, es difícil de usar o no responde a la carga del archivo.",
        puntosMax: 25
      },
      {
        criterio: "Control de Versiones",
        excelente: "Reporitorio estructurado, uso correcto de .gitignore, historial con al menos 4 commits semánticos (feat:, fix:, docs:).",
        aceptable: "El repositorio tiene todo el código en un único commit masivo ('initial commit') y carece de estructura limpia.",
        insuficiente: "No se creó el repositorio o no está sincronizado con el código final.",
        puntosMax: 25
      },
      {
        criterio: "Despliegue en la Nube",
        excelente: "Despliegue en Vercel funcional, sin errores de enrutamiento y con pipeline automático activo ante nuevos commits.",
        aceptable: "Despliegue manual funcional, pero con problemas de enrutamiento menores en la API Serverless.",
        insuficiente: "La aplicación no se despliega o da error HTTP 500 persistente.",
        puntosMax: 25
      }
    ]
  }
};
