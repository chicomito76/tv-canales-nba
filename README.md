# TV Canales NBA

PWA personal con React, TypeScript estricto, Vite, Lucide y CSS. Sin backend, cuentas, analítica ni servicios de pago. Horarios calculados con `Intl.DateTimeFormat` y `America/Santiago`.

## Empieza aquí

**La aplicación funciona; los partidos y canales incluidos son ficticios y están marcados como DEMOSTRACIÓN.** No es una fuente de resultados ni un calendario NBA actualizado automáticamente. Debes cargar el calendario real y confirmar las transmisiones en los JSON. No se han inventado ni presentado transmisiones como verificadas.

La carpeta `docs/` contiene la aplicación ya compilada y lista para publicar. No necesitas instalar Node para subir esta versión a GitHub Pages.

## 1. Ejecutar en tu computador

Instala Node.js 22 LTS o posterior. Descomprime el ZIP. Abre una terminal dentro de `tv-canales-nba`:

```sh
npm ci
npm run dev
```

Abre la dirección que indique la terminal. No abras `index.html` con doble clic.

Para compilar y comprobar:

```sh
npm test
npm run build
npm run preview
```

El service worker se activa en producción (`build` + `preview`), no en desarrollo. Para instalar y usar offline desde un iPhone se necesita la URL HTTPS publicada; una dirección HTTP de tu red local no basta.

## 2. Editar los datos

Hay dos ubicaciones con un propósito distinto:

| Ubicación | Cuándo editar |
| --- | --- |
| `public/data/` | Desarrollo local y futuras compilaciones |
| `docs/data/` | Sitio publicado directamente en GitHub Pages, sin recompilar |

Dentro de ambas están `schedule.json` y `broadcasts.json`. Mantén tus cambios de datos en ambas copias cuando vuelvas a compilar: `npm run prepare:pages` reemplaza `docs/` con lo generado desde `public/`.

### Calendario real

Reemplaza los partidos de `schedule.json` con partidos comprobados. Usa un identificador único y guarda siempre la hora UTC terminada en `Z`:

```json
{
  "demo": false,
  "games": [
    {
      "id": "ID-UNICO-DEL-PARTIDO",
      "utc": "2026-10-23T01:30:00Z",
      "away": "Denver Nuggets",
      "home": "Oklahoma City Thunder",
      "awayCode": "DEN",
      "homeCode": "OKC"
    }
  ]
}
```

El ejemplo describe el formato, NO un encuentro verificado. Ese instante se verá como 22:30 del día anterior en Chile según sus reglas horarias. No escribas horas chilenas en `utc`. El nombre de cada equipo debe coincidir con el selector de los 30 equipos.

### Transmisiones

En `broadcasts.json`, el identificador debe coincidir exactamente con el del calendario:

```json
{
  "demo": false,
  "lastUpdated": "2026-10-22T14:35:00Z",
  "games": {
    "ID-UNICO-DEL-PARTIDO": {
      "status": "pending",
      "channels": []
    }
  }
}
```

- `confirmed`: añade solo canales cuya transmisión en español hayas comprobado, por ejemplo `"channels": ["ESPN 2", "Disney+"]`. Estos nombres son ejemplos, no confirmaciones de un partido.
- `none`: usa únicamente si has confirmado que no hay transmisión en español. Deja `channels` como `[]`.
- `pending`: todavía no lo sabes. Deja `channels` como `[]`.
- Sin registro: la aplicación muestra pendiente, nunca ninguno.
- `confirmed` sin canales válidos también se presenta como pendiente.

Escribe solo el nombre del canal, sin país ni sufijos territoriales: `ESPN 2`, no `ESPN 2 (país)`. La aplicación no tiene campos de país ni los muestra. El proveedor elimina duplicados ignorando mayúsculas y espacios. Acepta nuevos nombres sin modificar código. `NBA TV` se descarta; solo registra `NBA TV alternativa español` después de comprobar el audio o señal en español.

Actualiza `lastUpdated` en UTC cada vez que confirmes cambios. Para obtener el instante actual en la terminal:

```sh
node -e "console.log(new Date().toISOString())"
```

No quites `demo: true` del calendario hasta reemplazar los ejemplos por información real. El aviso de demostración depende de ese indicador.

## 3. Subir a GitHub

1. Crea una cuenta gratuita de GitHub si no tienes una.
2. Crea un repositorio **público**, por ejemplo `tv-canales-nba`, vacío.
3. En la página del repositorio, elige **uploading an existing file** o **Add file → Upload files**.
4. Arrastra el contenido de la carpeta descomprimida, incluyendo `src`, `public`, `docs`, `scripts`, `tests` y los archivos de configuración. No subas `node_modules` ni `dist`.
5. Pulsa **Commit changes**.

El sitio y los archivos serán públicos. «Uso personal» no significa acceso privado. No subas imágenes o información que quieras mantener privada. No se necesita tarjeta, Apple Developer Program ni API key.

También puedes subir con Git, usando la URL exacta que muestre GitHub para tu repositorio:

```sh
git init
git add .
git commit -m "Crear TV Canales NBA"
git branch -M main
git remote add origin URL-DE-TU-REPOSITORIO
git push -u origin main
```

## 4. Activar GitHub Pages

1. Abre **Settings → Pages** en tu repositorio.
2. En **Source**, elige **Deploy from a branch**.
3. Selecciona la rama **main** y la carpeta **/docs**.
4. Pulsa **Save**.
5. Cuando termine la publicación, copia la URL que muestra GitHub Pages.

Vite usa `base: './'`, el manifiesto usa rutas relativas y la navegación usa `#home`, `#teams`, `#date` y `#favorites`. Esto permite servir desde el subdirectorio del repositorio sin ajustar el nombre en el código.

## 5. Abrir en Safari

En tu iPhone, abre la URL HTTPS que te dio GitHub Pages. Espera a que aparezcan los datos. Prueba Inicio, Equipos, Fecha y Favoritos.

## 6. Añadir a pantalla de inicio

En Safari, pulsa **Compartir → Añadir a pantalla de inicio → Añadir**. Si aparece una opción de abrir como aplicación web, actívala. Abre después el icono **TV Canales NBA**. El manifiesto solicita modo independiente sin barra de navegación; iOS controla la barra de estado y sus áreas seguras.

La interfaz se adapta al ancho disponible, usa `viewport-fit=cover` y márgenes `safe-area` superior e inferior. No fuerza una proporción 9:16 que recorte el contenido. Está diseñada para iPhone grande y otros móviles; la instalación en iPhone 17 Pro Max/iOS 27 requiere verificación en el dispositivo real.

## 7. Actualizar canales después, SIN recompilar

1. En GitHub abre **docs/data/broadcasts.json**.
2. Pulsa el lápiz para editar.
3. Busca el ID, cambia `status` y `channels`, y actualiza `lastUpdated`.
4. Pulsa **Commit changes** y espera a que Pages publique ese cambio.
5. En la aplicación pulsa **Actualizar**. Se descargan de nuevo ambos JSON.

Para cambiar el calendario, haz lo mismo con **docs/data/schedule.json**. No hace falta ejecutar npm para estos cambios. Conserva también una copia de los cambios en `public/data/` antes de tu siguiente compilación.

## Cambiar el diseño o la foto de portada

El placeholder es un SVG local genérico de básquetbol: `public/images/hero.svg`. No hay fotos descargadas de jugadores.

Para una imagen que tengas permiso de publicar, añade `public/images/hero.jpg` y cambia `images/hero.svg` por `images/hero.jpg` en `src/pages/Views.tsx`. La imagen tiene `alt=""` porque es decorativa. Después ejecuta:

```sh
npm run prepare:pages
```

Sube el código y la carpeta `docs/` actualizados. Esta operación recompila y copia `dist/` a `docs/`. Una foto privada no debe incorporarse al repositorio público: usa el placeholder hasta decidir publicarla o elegir otro alojamiento con acceso restringido.

## Offline y mantenimiento

- La primera apertura requiere conexión para descargar la aplicación y una pareja válida de JSON.
- El service worker guarda el HTML, JS, CSS, iconos y portada. Cada build genera una lista de recursos y una versión por hash.
- Los dos JSON se validan y se guardan juntos en `localStorage`, evitando mezclar una descarga nueva con otra fallida. JSON inválido o fallo de conexión conserva la última pareja válida.
- Sin red, se muestra «Datos guardados sin conexión». Si la descarga falla estando conectado, también se usa esa copia. El sello de actualización pertenece a los datos, no a la hora en que pulsaste Actualizar.
- Los favoritos viven en `localStorage` del dispositivo. No se sincronizan con otro teléfono.
- iOS puede eliminar datos locales por falta de espacio o inactividad. Abre la aplicación con conexión para recuperarlos. No se promete almacenamiento offline permanente.
- `npm run demo` regenera ejemplos ficticios para ayer/hoy/mañana. Sobrescribe `public/data/`: no lo ejecutes sobre tus datos reales sin una copia.
- El calendario no se obtiene de una API. Para automatizarlo después, sustituye la fuente del adaptador en `src/services/` manteniendo los modelos y métodos actuales.

## Organización

- `src/components/UI.tsx`: Header, BottomNavigation, GameCard, ChannelBadge, TeamSelector, DateSelector, UpdateStatus, EmptyState, OfflineNotice, FavoriteButton, LoadingState.
- `src/pages/Views.tsx`: las cuatro pantallas.
- `src/services/scheduleProvider.ts`: consultas por fecha/equipo y ayer/hoy/mañana.
- `src/services/broadcastProvider.ts`: estados y deduplicación.
- `src/services/dataLoader.ts`: descarga, validación y caché de datos.
- `src/hooks/useFavorites.ts`: favoritos persistentes.
- `src/utils/date.ts`: fecha y hora de Chile, sin offsets fijos.
- `public/`: JSON, manifiesto, service worker, iconos y portada locales.
- `docs/`: versión lista para GitHub Pages.

## Verificación

`npm test`: diez pruebas de proveedores, deduplicación, NBA TV, estados ausentes, UTC, verano/invierno, límites de fecha, filtros y rechazo de datos duplicados.

`npm run build`: TypeScript estricto, bundle Vite y generación de service worker. Compilación verificada al entregar.

La previsualización de navegador de este entorno no estaba disponible. La instalación real en iOS, el comportamiento offline integrado y la publicación en tu GitHub no se han probado aquí. Para comprobarlos: publica, abre online una vez, guarda un favorito, activa modo avión, cierra y vuelve a abrir la aplicación. Después desactiva modo avión, cambia un JSON y pulsa Actualizar.

## Fuentes de configuración

- Vite, rutas base y despliegue: https://vite.dev/guide/static-deploy.html
- GitHub Pages, creación y disponibilidad gratuita: https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site
- GitHub Pages, publicación desde una rama y /docs: https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
