# 🚀 GitHub Wrapped

> Tu año en GitHub, contado como si fuera un show de fin de año.

**GitHub Wrapped** convierte la actividad pública de cualquier usuario en una experiencia visual de una sola página, estilo “Wrapped”: métricas clave, hitos del año, palabras frecuentes de commits y una galaxia de repositorios animada.

---

## ✨ ¿Qué hace?

Muestra 4 diapositivas navegables con teclado, scroll o enlaces:

1. **Resumen** → commits, PRs, issues, repos nuevos, lenguaje principal y personalidad.
2. **Línea de tiempo** → primeros hitos, mejor mes, racha y repo más activo.
3. **Palabras de commits** → nube de términos frecuentes.
4. **Galaxia de repos** → planetas por repositorio con tamaño, color y órbitas según actividad.

Todo en tema oscuro con acentos neón, responsive (desde 360px) y con soporte para `prefers-reduced-motion`.

---

## 🧩 Stack (mínimo y directo)

- **Frontend:** HTML + CSS + JavaScript (ES modules), sin build.
- **Visualización por CDN (versiones fijas):**
  - `d3@7.9.0`
  - `d3-cloud@1.2.7`
- **Backend:** función serverless en `api/wrapped.js`.
- **Auth GitHub:** GitHub App (JWT firmado con `node:crypto`), token de instalación solo en servidor.

No hay cuentas propias, base de datos ni login obligatorio.

---

## ⚡ Desarrollo local

Requiere **Node.js 22+**.

```sh
cp .env.example .env
npm run dev
```

Abre:

- `http://localhost:3000/?mock=1` → demo sin credenciales
- `http://localhost:3000/?user=octocat&year=2025` → datos reales

La demo `mock=1` usa datos ficticios para diseñar frontend sin tocar la API de GitHub.

---

## ✅ Pruebas

```sh
npm test
```

Las pruebas cubren contrato API, JWT, caché, validaciones, procesamiento, rachas, personalidad y exclusión de detalles privados.

---

## 🔐 Configurar la GitHub App

1. Ve a **Settings → Developer settings → GitHub Apps → New GitHub App**.
2. Define nombre y homepage de tu despliegue.
3. **No** necesitas OAuth callback ni webhooks (desactiva Webhooks).
4. Permisos de repositorio:
   - **Contents: Read-only**
   - **Metadata: Read-only**
5. Instala la App solo en la cuenta del propietario y en repos públicos necesarios.
6. Guarda:
   - `App ID`
   - `Installation ID`
7. Genera una private key (PEM) y guárdala **solo** en variables de entorno del hosting.

Variables requeridas:

| Variable | Descripción |
| --- | --- |
| `GITHUB_APP_ID` | ID numérico de la App |
| `GITHUB_APP_INSTALLATION_ID` | ID de instalación |
| `GITHUB_APP_PRIVATE_KEY` | PEM completo (con saltos de línea o `\n` escapados) |

> Nunca expongas estas variables en frontend ni subas claves al repositorio.

---

## ☁️ Despliegue en Vercel

1. Importa este repositorio en Vercel.
2. Selecciona proyecto sin build custom (sin instalación adicional).
3. Agrega variables de entorno para Preview/Production.
4. Despliega y valida:
   - `/?mock=1`
   - `/?user=octocat&year=2025`
   - `/?user=usuario-inexistente`

Objetivo de rendimiento: cargar el resumen real en menos de 8 segundos (según latencia/API).

---

## 🔎 API

`GET /api/wrapped?user=<login>&year=<YYYY>`

- `year` opcional (por defecto año actual UTC)
- `mock=1` devuelve datos de ejemplo
- validación de usuario: `^[a-zA-Z0-9-]{1,39}$`
- datos públicos únicamente
- caché en éxito: `Cache-Control: s-maxage=3600, stale-while-revalidate=86400`

Errores principales:

- `400` entrada inválida
- `404` usuario no encontrado
- `429` límite de API
- `503` App no configurada

`SUPPORT_EMAIL`: **eduardoarcost6to@gmail.com**, visible en el pie de `index.html` (configuración pública, sin build).

## Diagnóstico local

Si la demo funciona pero los datos reales fallan, actualiza el código y reinicia `npm run dev` después de editar `.env`. Abre `/api/wrapped?user=tu-usuario` para ver el JSON de error:

- `INVALID_PRIVATE_KEY` (503): usa el contenido completo del PEM RSA descargado de GitHub, incluidos BEGIN/END; no su ruta ni el webhook secret. Se aceptan saltos reales o `\n` escapados. En `.env`, encierra el contenido en comillas dobles.
- `INVALID_APP_IDS` (503): App ID e Installation ID son números; Client ID no sirve.
- `GITHUB_CONNECTION_ERROR` (502): comprueba el acceso de Node a `https://api.github.com` y la configuración de DNS, proxy o firewall.
- `GITHUB_TLS_ERROR` (502): revisa la cadena de certificados de tu equipo/proxy y configura la CA de confianza de Node si corresponde. Mantén activa la verificación TLS.
- `GITHUB_TIMEOUT` (504): GitHub superó el tiempo de espera; vuelve a intentar.

Los mensajes no incluyen claves, tokens ni errores internos de la conexión. Un error 500 restante necesita reproducirse con la respuesta y el paso que falla; nunca compartas `.env` ni el PEM.

---

## 🛰️ Notas de producto

- La app usa GraphQL para contribuciones anuales y REST para muestreo de commits por repo.
- Los detalles de repos privados se filtran antes de construir visualizaciones.
- Fechas y horarios se procesan en UTC para mantener reglas consistentes de personalidad.

---

## 🛟 Soporte

- **Support email (`SUPPORT_EMAIL`)**: `eduardoarcost6to@gmail.com`
- **Repositorio**: [A-PerfectStranger/GitHub-Wrapped](https://github.com/A-PerfectStranger/GitHub-Wrapped)

Proyecto independiente, sin afiliación oficial con GitHub ni Spotify.
