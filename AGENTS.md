# AGENTS.md — GitHub Wrapped

## Objetivo

Construir **GitHub Wrapped**: una web de una sola página donde cualquier persona escribe un nombre de usuario de GitHub y recibe un resumen animado de su año, estilo "Spotify Wrapped". Debe ser **pequeño, rápido y funcional**, no un proyecto enorme.

El proyecto también sirve como integración registrada en el **GitHub Developer Program**, así que debe usar la API de GitHub de forma real y tener un correo de soporte visible en el pie de página.

## Alcance (MVP)

Solo estas 4 secciones, presentadas como "diapositivas" que se recorren con scroll o flechas:

1. **Resumen**: commits totales, PRs, issues, repos nuevos, lenguaje estrella y un título de personalidad (ver reglas abajo).
2. **Línea de tiempo**: hitos del año (primer commit del año, primer PR, repo más activo, mejor mes, racha más larga).
3. **Palabras de tus commits**: nube de palabras con los términos más frecuentes en los mensajes.
4. **Galaxia de repositorios**: cada repo es un planeta en órbita.

Extra opcional si sobra tiempo: botón "Descargar tarjeta" que exporta el resumen como PNG.

**Fuera de alcance**: cuentas de usuario, base de datos, login obligatorio, comparación entre usuarios, modo privado, tests E2E.

## Stack (mantenerlo mínimo)

- **Frontend**: HTML + CSS + JavaScript vanilla (ES modules). Sin framework ni paso de build.
- **Librerías por CDN, versiones fijas**: `d3` (para la galaxia) y `d3-cloud` (para la nube de palabras). Nada más.
- **Backend**: una única función serverless (Vercel o Cloudflare Workers) en `api/wrapped.js`.
- **Autenticación con GitHub**: una **GitHub App** instalada por el propietario del proyecto. La función genera un *installation token* con la clave privada y lo usa para consultar datos **públicos**. El token nunca llega al navegador.

## Estructura de archivos

```
/
├── AGENTS.md
├── README.md
├── index.html          # UI y diapositivas
├── style.css
├── app.js              # carga datos, orquesta diapositivas
├── viz/
│   ├── galaxy.js       # galaxia de repositorios (D3, canvas o SVG)
│   ├── wordcloud.js    # nube de palabras
│   └── timeline.js     # línea de tiempo
├── api/
│   └── wrapped.js      # función serverless: GraphQL + REST + caché
└── .env.example
```

## Variables de entorno

```
GITHUB_APP_ID=
GITHUB_APP_PRIVATE_KEY=      # contenido PEM, con \n escapados
GITHUB_APP_INSTALLATION_ID=
```

Nunca escribir claves reales en el repositorio. Mantener `.env.example` con valores vacíos y añadir `.env` al `.gitignore`.

## API: `GET /api/wrapped?user=<login>&year=<YYYY>`

Si `year` no se indica, usar el año actual. Responder JSON con esta forma:

```json
{
  "user": { "login": "", "name": "", "avatarUrl": "", "createdAt": "" },
  "year": 2026,
  "totals": { "commits": 0, "pullRequests": 0, "issues": 0, "reviews": 0, "newRepos": 0 },
  "calendar": [{ "date": "YYYY-MM-DD", "count": 0 }],
  "languages": [{ "name": "", "color": "", "bytes": 0 }],
  "repos": [{ "name": "", "stars": 0, "forks": 0, "commits": 0, "language": "", "lastPushed": "" }],
  "commitWords": [{ "word": "", "count": 0 }],
  "hourHistogram": [0, 0, 0],
  "timeline": [{ "date": "", "type": "", "title": "", "detail": "" }],
  "persona": { "title": "", "reason": "" }
}
```

### Cómo obtener cada dato

- **Perfil, totales, calendario y repos con commits**: una sola consulta **GraphQL** usando `contributionsCollection(from, to)`. Un rango máximo de **1 año** por consulta. Usar `contributionCalendar`, `commitContributionsByRepository`, `totalPullRequestContributions`, etc.
- **Lenguajes**: campo `languages` de los repos más activos, sumando bytes.
- **Mensajes de commits**: **REST** `GET /repos/{owner}/{repo}/commits?author={login}&since=...&until=...&per_page=100`, **solo para los 8 repos con más commits del año** y máximo 1 página por repo. Esto mantiene el consumo de API bajo control. De cada commit tomar el mensaje (primera línea) y la hora.
- **Hitos de la línea de tiempo**: derivarlos del calendario y de los repos. Ejemplos: primer día con commits del año, día más productivo, mejor mes, racha más larga, repo más activo, repo creado más reciente, PR más antiguo mergeado del año.

### Procesamiento de palabras

- Pasar a minúsculas, quitar URLs, números, hashes y prefijos tipo `feat:`, `fix(scope):`.
- Eliminar *stopwords* en inglés y español (lista corta embebida en el código).
- Conservar palabras de 3 o más letras y devolver las 60 más frecuentes.

### Caché y límites

- Cabecera `Cache-Control: s-maxage=3600, stale-while-revalidate=86400`.
- Validar `user` con `^[a-zA-Z0-9-]{1,39}$` y `year` entre la fecha de creación de la cuenta y el año actual.
- Si GitHub devuelve 404, responder `{ "error": "Usuario no encontrado" }` con status 404.
- Si se alcanza el límite de la API, responder 429 con un mensaje claro.
- Usar solo datos **públicos**. No mostrar nada de repositorios privados (los conteos privados que devuelve GraphQL se pueden sumar al total, pero sin detalles).

## Reglas de la personalidad (título)

Elegir el primer título que cumpla la condición:

| Título | Condición |
|---|---|
| Búho nocturno | más del 40% de commits entre 22:00 y 04:00 |
| Madrugador | más del 40% de commits entre 05:00 y 09:00 |
| Maratonista de fines de semana | más del 45% de commits en sábado o domingo |
| Políglota | 5 o más lenguajes con más del 5% cada uno |
| Imparable | racha más larga de 30 días o más |
| Constructor | por defecto |

Cada título incluye una frase corta (`reason`) con el dato que lo justifica.

## Diseño y experiencia

- Tema oscuro con acentos neón (cian, magenta, verde lima) y tipografía monoespaciada para los números.
- Cada diapositiva ocupa la pantalla completa; animar entrada con CSS (`@keyframes`), contadores que suben hasta su valor y gráficos que se dibujan al aparecer.
- **Galaxia**: el tamaño del planeta depende de los commits del año, el color del lenguaje principal (usar el color oficial de GitHub), la distancia al centro de la fecha del último push (más reciente = más cerca) y la órbita animada con velocidad variable. Mostrar tooltip con nombre, estrellas y commits. Usar `canvas` si hay más de 40 repos; limitar a 60.
- **Nube de palabras**: tamaño por frecuencia, colores de la paleta, aparición progresiva.
- **Línea de tiempo**: vertical en móvil, horizontal en escritorio, con iconos simples (emoji está bien).
- Respetar `prefers-reduced-motion`: desactivar animaciones largas.
- Responsive desde 360 px de ancho. Contraste suficiente y navegación por teclado (flechas).
- Estados de carga (esqueleto o spinner) y mensajes de error amigables.
- Pie de página con: aviso de que solo usa datos públicos, enlace al repo y correo de soporte (`SUPPORT_EMAIL`).

## Convenciones de código

- JavaScript moderno, sin TypeScript, sin transpilación.
- Funciones pequeñas y con nombres claros; comentarios solo donde la intención no sea obvia.
- Sin dependencias npm en el frontend. En la función serverless solo se permite `jsonwebtoken` (o la API `crypto` nativa) para firmar el JWT de la GitHub App.
- Manejar errores con `try/catch` y devolver siempre JSON.
- Presupuesto orientativo: menos de **800 líneas** en total entre todos los archivos.

## Pasos para el agente

1. Crear la estructura de archivos y un `README.md` breve con instrucciones de despliegue.
2. Implementar `api/wrapped.js` con autenticación de la GitHub App, consulta GraphQL, mensajes de commits y la forma JSON descrita. Incluir un modo `?mock=1` que devuelva datos de ejemplo, para desarrollar el frontend sin credenciales.
3. Implementar `index.html`, `style.css` y `app.js` con el formulario de usuario y las 4 diapositivas.
4. Implementar `galaxy.js`, `wordcloud.js` y `timeline.js`.
5. Probar con `?mock=1`, luego con un usuario real.
6. Escribir en el README cómo crear la GitHub App.

## Configuración de la GitHub App (documentar en README)

- Permisos de repositorio: **Contents: Read-only**, **Metadata: Read-only**.
- Sin webhooks, sin callback URL, instalación solo en la cuenta del propietario.
- Generar la clave privada y guardarla únicamente en variables de entorno del hosting.

## Criterios de aceptación

- Con un usuario real, la página carga el resumen en menos de 8 segundos.
- Las 4 diapositivas se muestran sin errores en consola, en móvil y en escritorio.
- Un usuario inexistente muestra un mensaje claro, no una pantalla rota.
- Ningún token ni clave aparece en el código del navegador ni en el repositorio.
- El proyecto funciona con `?mock=1` sin credenciales.
