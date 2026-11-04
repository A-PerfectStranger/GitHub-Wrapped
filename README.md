# GitHub Wrapped

Tu año en GitHub, en otra órbita. Una sola página, cuatro diapositivas: resumen y personalidad, hitos, palabras de commits y galaxia de repositorios. Interfaz en español, responsive desde 360 px y compatible con movimiento reducido y teclado.

HTML, CSS y ES modules sin build ni dependencias npm. Solo D3 **7.9.0** y d3-cloud **1.2.7** por CDN; si el CDN falla, las visualizaciones conservan alternativas accesibles. Una función Node serverless en Vercel firma los JWT con `node:crypto`. No hay cuentas propias, base de datos ni login obligatorio.

## Desarrollo

Requiere Node.js 22 o superior. No hace falta ejecutar `npm install`.

```sh
cp .env.example .env
npm run dev
```

Abre `http://localhost:3000/?mock=1`. La demo funciona sin credenciales y se identifica como datos ficticios. El botón **Mi Wrapped** siempre consulta datos reales; **Explorar la demo** usa ejemplos. Se puede compartir la URL con `user`, `year` y, opcionalmente, `mock=1`.

```sh
npm test
```

Las pruebas nativas cubren JWT con claves efímeras, contrato de la API, exclusión de datos privados, límites, caché, procesamiento, rachas y personalidad. No incluyen E2E. El servidor local sirve únicamente los archivos públicos y la API; no expone `.env`.

## Crear la GitHub App

1. GitHub → **Settings → Developer settings → GitHub Apps → New GitHub App**.
2. Elige nombre y homepage del despliegue. No necesitas callback URL, OAuth ni autorización del usuario.
3. Desactiva **Active** en Webhooks. Permisos de repositorio: **Contents: Read-only** y **Metadata: Read-only**. Sin permisos de escritura ni permisos de organización.
4. Limita la instalación a tu cuenta, crea la App e instálala desde **Install App**. Instala en los repos públicos necesarios. El acceso efectivo depende de los permisos y la instalación; las contribuciones disponibles pueden variar según GitHub.
5. Anota el **App ID** y el **installation ID** (el número al final de la URL de la instalación).
6. En **Private keys → Generate a private key**, descarga el PEM y guárdalo únicamente en el gestor de secretos del hosting o en `.env` local ignorado.

Variables del servidor (todos los valores de `.env.example` están vacíos):

| Variable | Valor |
| --- | --- |
| `GITHUB_APP_ID` | ID numérico de la App |
| `GITHUB_APP_INSTALLATION_ID` | ID de su instalación |
| `GITHUB_APP_PRIVATE_KEY` | PEM completo; admite saltos de línea o `\n` escapados |

Nunca uses prefijos públicos para estas variables ni incluyas tokens en HTML o JavaScript del navegador. El servidor renueva el installation token y lo conserva en memoria hasta cerca de su vencimiento. Las claves efímeras de las pruebas se generan en memoria; no hay credenciales reales en el repositorio.

## Desplegar en Vercel

1. Importa este repositorio en Vercel. Selecciona **Other**, sin build ni instalación de paquetes. El directorio raíz del proyecto es la raíz del repo y el de salida debe permanecer en su valor predeterminado.
2. Añade las tres variables en **Settings → Environment Variables**, tanto para Preview como para Production cuando corresponda. Runtime Node.js 22 o superior.
3. Despliega. Vercel sirve los archivos estáticos y detecta `api/wrapped.js` como función. No hace falta configuración adicional ni un servicio persistente.
4. Comprueba `/?mock=1`, después `/?user=octocat&year=2025`, y un nombre inexistente. Sin configurar la App, los datos reales responden 503 con una explicación; la demo sigue funcionando.
5. Confirma las cuatro diapositivas en móvil/escritorio y el tiempo de carga con tu instalación. El objetivo es menos de 8 segundos; depende de la latencia y los límites de GitHub.

El registro en GitHub Developer Program y la creación de la App se completan desde la cuenta del propietario; este repositorio entrega la integración, sin efectuar esos registros.

## API y significado de los datos

`GET /api/wrapped?user=<login>&year=<YYYY>`; el año predeterminado es el actual (UTC). `mock=1` devuelve el mismo contrato con ejemplos.

- Una consulta GraphQL obtiene perfil, totales, calendario, hasta 100 repos con commits y lenguajes de los ocho más activos. El rango es del 1 de enero al 31 de diciembre del año elegido, siempre inferior a un año completo de duración.
- Un presupuesto compartido de 7,5 segundos limita la espera a GitHub. Hasta ocho peticiones REST paralelas, con una página de 100 commits por repo, obtienen mensajes y horas. Se eliminan SHAs duplicados entre repos. No es un historial exhaustivo: los mensajes y la personalidad horaria describen esa muestra. `sample.partial` indica repos no disponibles.
- Los detalles de repos privados se excluyen antes de procesar lenguajes, palabras, hitos y galaxia. Los totales y el calendario pueden incluir conteos de contribuciones privadas que GitHub permita ver; no se devuelven sus nombres ni contenidos.
- El calendario cuenta **contribuciones**, no solo commits. El primer hito es el primer día activo; la racha mide días consecutivos con contribuciones. El hito del repo más activo se ancla al último día activo y resume el año, no la fecha de creación del repo. El hito del primer PR usa su apertura, no su merge.
- Los lenguajes se ponderan por bytes actuales de los repos más activos; no miden líneas escritas en el año. Los colores vienen de GitHub. La galaxia limita la vista a 60 repos: tamaño por commits, color por lenguaje y distancia por último push actual.
- Horarios, fines de semana y fechas se interpretan en **UTC**. Las reglas de personalidad se aplican en el orden especificado en `AGENTS.md`.
- Respuestas exitosas: `Cache-Control: s-maxage=3600, stale-while-revalidate=86400`. Errores: JSON sin caché; 400 para entradas inválidas, 404 para usuario inexistente, 429 para límites, 503 para App sin configurar. Una muestra REST incompleta conserva el resto del resumen.
- Solo `GET`. Los usuarios deben cumplir `^[a-zA-Z0-9-]{1,39}$`; años desde 2008 hasta el actual y nunca anteriores a la creación de la cuenta real. No se registran secretos ni se envían al navegador.

Usa las flechas para cambiar de diapositiva, enlaces de navegación o scroll. Los controles del formulario conservan sus teclas habituales. La galaxia ofrece una lista accesible para consultar cada planeta y detiene su animación fuera de pantalla o con `prefers-reduced-motion`.

## Soporte

`SUPPORT_EMAIL`: **eduardoarcost6to@gmail.com**, visible en el pie de `index.html` (configuración pública, sin build). Repositorio: [A-PerfectStranger/GitHub-Wrapped](https://github.com/A-PerfectStranger/GitHub-Wrapped). Proyecto independiente, sin afiliación con GitHub ni Spotify.
