# RevisaDoc — starter de desarrollo

Primera estructura de RevisaDoc con interfaz React + TypeScript y API Python + FastAPI.
Esta es una base de desarrollo: no es todavía un producto comercial listo para publicar.

## Requisitos en Windows
1. Instala **Python 3.11 o 3.12** desde https://www.python.org/downloads/ y marca "Add Python to PATH".
2. Instala **Node.js LTS** desde https://nodejs.org/.
3. Instala **Visual Studio Code** desde https://code.visualstudio.com/.
4. Descomprime esta carpeta en una ubicación sencilla, por ejemplo `C:\RevisaDoc`.

## Iniciar el backend (API)
Abre una terminal de VS Code: Terminal > New Terminal.

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Si PowerShell bloquea la activación, ejecuta esta alternativa en la terminal:
```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload
```

La API estará en http://127.0.0.1:8000 y la documentación interactiva en
http://127.0.0.1:8000/docs.

## Iniciar el frontend
Abre una **segunda terminal** en VS Code:

```powershell
cd frontend
npm install
npm run dev
```

Abre la URL que Vite muestre en la terminal (normalmente http://localhost:5173).

## Prueba rápida
- Selecciona uno o varios PDF con texto seleccionable.
- Pulsa "Analizar documentos".
- Los archivos se envían a la API local de tu computador, no a un servidor público.
- Exporta el resultado CSV desde la interfaz.

## Qué incluye
- Interfaz bilingüe español/inglés.
- Carga múltiple de PDF.
- Detección de archivos idénticos mediante SHA-256.
- Extracción de texto y número de páginas.
- Detección de algunas operaciones aritméticas escritas como `100 + 20 = 130`.
- Avisos básicos de posibles formatos de fecha anómalos.
- Similitud de palabras entre documentos cargados.
- Exportación CSV.

## Límites importantes
- La detección ortográfica es una lista demostrativa, no un corrector completo.
- La similitud entre los PDF cargados **no prueba plagio**. Buscar plagio en internet requiere una fuente o servicio externo autorizado.
- Los PDF escaneados necesitan OCR, que aún no está incluido.
- Los resultados son orientativos; hay que comprobarlos en el documento original.
- No subas documentos confidenciales a una versión de prueba sin una revisión de seguridad.
- El backend no guarda archivos de forma permanente, pero recibe temporalmente su contenido durante la petición.
- Antes de publicarlo se necesitan autenticación, autorización, límites de uso, análisis de seguridad, pruebas, registros apropiados y una política de privacidad.

## Estructura
```text
RevisaDoc_Starter/
  backend/
    app/main.py
    requirements.txt
  frontend/
    index.html
    package.json
    tsconfig.json
    vite.config.ts
    src/main.tsx
    src/App.tsx
    src/styles.css
```
