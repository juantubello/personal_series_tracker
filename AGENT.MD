# AGENT_2.MD

## Objetivo

Este proyecto sera una app personal para que Juan y Camila trackeen series y peliculas vistas. La prioridad es que sea simple de levantar, facil de mantener en el homelab y preparada desde el inicio para publicarse igual que CamiReads: subdominio propio, Nginx, Cloudflare Tunnel y Cloudflare Zero Trust.

La app no busca ser un clon completo de Letterboxd/Trakt. El foco inicial es:

- Buscar peliculas y series usando The Movie Database.
- Guardar en una base propia que vimos.
- Para peliculas: marcar como vista.
- Para series: registrar hasta que temporada y capitulo vimos.
- Poder consultar rapidamente que estamos viendo, que ya vimos y que queda pendiente.

## Principios

- Mantener arquitectura sencilla antes que sobreingenieria.
- Priorizar mobile-first: la app probablemente se use mucho desde el celular.
- Guardar solo datos propios necesarios; TMDB es catalogo externo, no fuente de progreso personal.
- No commitear secretos: API key de TMDB, Cloudflare Access tokens, passwords o `.env` reales.
- Preparar deploy desde el inicio, aunque al principio se corra local.
- Reutilizar el patron que ya funciono en CamiReads y finanzas: frontend llama a `/api`, Nginx proxyea al backend.
- La autenticacion la resuelve Cloudflare Zero Trust; la app solo usa la identidad recibida para elegir defaults y auditoria liviana.
- Todo lo que sea compartido debe ser visible para Juan y Camila. No hay privacidad fuerte en v1, solo organizacion por perfiles/listas.

## Estado Real Actual Del Deploy

Notas actualizadas de la sesion de deploy del 2026-07-19:

- Repositorio GitHub: `https://github.com/juantubello/personal_series_tracker.git`.
- Servidor Linux/homelab: repo clonado en `~/personal_series_tracker`.
- Dominio publico final: `https://pipiseries.casapipis.net`.
- Tunnel existente del host: `casapipis-tunnel`.
- Cloudflared corre como servicio systemd del host, no dentro de este compose.
- No usar `docker compose --profile tunnel` salvo que Juan pida explicitamente migrar cloudflared al compose.
- Ingress agregado al tunnel del host:

```yaml
- hostname: pipiseries.casapipis.net
  service: http://localhost:3015
```

- Esa regla debe estar antes de `- service: http_status:404`.
- DNS route creado con:

```bash
cloudflared tunnel route dns casapipis-tunnel pipiseries.casapipis.net
```

- En DNS puede resolver a IPs proxied de Cloudflare (`104.x` / `172.x`); eso esta bien.
- Nginx de esta app publica solo en loopback del servidor: `127.0.0.1:3015->80/tcp`.
- Docker Compose levanta servicios `api`, `web` y `nginx`.
- Los tres contenedores quedaron con `restart: unless-stopped`, por lo que vuelven solos tras reiniciar el servidor si no fueron detenidos manualmente.
- Verificacion real que funciono en servidor:

```bash
curl -I http://127.0.0.1:3015
curl http://127.0.0.1:3015/api/health
```

- `/api/health` devolvio `{"ok":true,...,"tmdbConfigured":true}`.
- Para actualizar produccion:

```bash
cd ~/personal_series_tracker
git pull
docker compose up -d --build
```

- Si se cambian variables `NEXT_PUBLIC_*`, hay que rebuildar porque Next las inyecta en build.
- Si se cambia `/etc/cloudflared/config.yml`, hay que correr:

```bash
sudo systemctl restart cloudflared
sudo systemctl status cloudflared
```

### Env Productivo Importante

No commitear el `.env` real. Valores/semantica que quedaron definidos:

- `HOST_HTTP_PORT=127.0.0.1:3015`.
- `NEXT_PUBLIC_API_URL=/api`.
- `ENABLE_DEV_AUTH=false`.
- `CLOUDFLARE_ACCESS_TEAM_DOMAIN=https://pipiscats.cloudflareaccess.com`.
- `CLOUDFLARE_ACCESS_AUD` es el `Application Audience (AUD) Tag` de la app de Cloudflare Access para `pipiseries.casapipis.net`.
- `NEXT_PUBLIC_CF_ACCESS_CLIENT_ID` y `NEXT_PUBLIC_CF_ACCESS_CLIENT_SECRET` son los headers de Service Auth que Juan usa en sus otras apps para que las llamadas `/api` pasen Access.
- Esos dos `NEXT_PUBLIC_*` son visibles desde DevTools para usuarios autorizados; se acepto ese tradeoff porque la app esta protegida por Zero Trust y es personal.
- `CLOUDFLARED_TOKEN` debe quedar vacio si se usa el tunnel central del host.
- `JUAN_EMAIL` y `CAMI_EMAIL` deben coincidir exactamente con los emails autenticados por Cloudflare Access.

### Persistencia Y Backups

- La DB productiva es SQLite en `data/app.db`.
- Docker monta `./data:/data`; por eso recrear contenedores o reiniciar el servidor no borra la base.
- Si no se migra una DB local al servidor, la app arranca vacia y crea/seed de perfiles/listas base.
- `data/`, `.env` y `backups/` no se commitean.
- Backup tecnico desde servidor:

```bash
npm run backup:docker
```

- Backup desde UI: `Perfil > Ajustes > Backup DB`.
- Export JSON desde UI: `Perfil > Ajustes > Exportar JSON`.
- El export JSON debe mantenerse compacto y no dominar la pantalla de Perfil.

### PWA, Logo Y Cache

- La app debe sentirse como PWA/iOS nativa: mobile-first, bottom nav fija, safe areas, acciones tactiles.
- Se agregaron manifest, service worker e iconos PWA.
- Logo principal incluido desde `apps/web/public/brand-logo.png`.
- Iconos PWA incluidos: `icon-192.png`, `icon-512.png`, `maskable-icon-512.png`, `apple-touch-icon.png`.
- Si el logo o assets viejos siguen apareciendo tras deploy, puede ser cache del service worker/PWA; pedir hard refresh o limpiar datos del sitio.
- Ultimo ajuste subido del logo: commit `47245c4 Fix header logo sizing`.

## Usuarios, Perfiles Y Visibilidad

La app sera usada por 2 usuarios autenticados por Cloudflare Zero Trust:

- Juan.
- Camila.

Cloudflare Access deberia permitir identificar el email del usuario autenticado mediante el JWT/header enviado al backend. La app no debe implementar login propio ni passwords.

Separar "usuario autenticado" de "perfil de visualizacion":

- `Juan`: progreso/listas personales de Juan.
- `Cami`: progreso/listas personales de Camila.
- `Juntos`: progreso/listas compartidas de ambos.

Reglas de UX:

- Si entra Juan, la vista por defecto debe mostrar `Juntos` + `Juan`.
- Si entra Cami, la vista por defecto debe mostrar `Juntos` + `Cami`.
- Juan debe poder activar manualmente ver lo de Cami.
- Cami debe poder activar manualmente ver lo de Juan.
- La opcion de ver el perfil de la otra persona no debe venir marcada por defecto.
- Debe existir una vista/filtro `Todo` para ver Juan + Cami + Juntos cuando se quiera.

Reglas para marcar visualizacion:

- En cada pelicula o serie debe poder elegirse si aplica a `Juan`, `Cami` o `Juntos`.
- Si se seleccionan Juan y Cami a la vez, la app debe convertirlo/guardarlo como `Juntos`.
- Si una serie se ve juntos, el progreso vive en `Juntos`, no duplicado en Juan y Cami.
- Si Juan y Cami miran una misma serie por separado, deben existir progresos separados en `Juan` y `Cami`.

Listas:

- Debe poder crearse cualquier cantidad de listas.
- Las listas pueden pertenecer a `Juan`, `Cami` o `Juntos`.
- Las listas personales son "privadas entre comillas": ambos pueden verlas si activan el filtro correspondiente, pero sirven para organizar lo propio.
- Ejemplos: `Quiero ver Juan`, `Quiero ver Cami`, `Para ver juntos`, `Peliculas pendientes`, `Series pausadas`.

Recomendados:

- Debe existir opcion de recomendados para `Juan`, `Cami` y `Juntos`.
- Los recomendados iniciales deben basarse en la API de TMDB por item:
  - `/movie/{movie_id}/recommendations`
  - `/tv/{series_id}/recommendations`
- No depender de login/cuenta de TMDB para recomendaciones en v1.
- Para generar recomendados de un perfil, tomar items vistos o bien calificados por ese perfil, pedir recomendaciones a TMDB, mezclar resultados, eliminar duplicados y ocultar lo ya visto/agregado.
- Para `Juntos`, usar solamente historial/rating/progreso del perfil `Juntos`.
- Para `Juan` o `Cami`, usar el perfil personal correspondiente.
- UI sugerida: una pantalla/seccion `Recomendados` con selector de perfil `Juntos`, `Juan`, `Cami`.
- Cada recomendado debe permitir agregar a una lista, marcar como `Quiero ver` o abrir detalle.

Identidad y desarrollo local:

- En produccion, la identidad sale de Cloudflare Zero Trust mediante `Cf-Access-Jwt-Assertion` validado por el backend.
- Mapear emails permitidos a usuarios locales, por ejemplo:
  - `JUAN_EMAIL=...`
  - `CAMI_EMAIL=...`
- En desarrollo local debe existir una forma simple de simular identidad sin Cloudflare.
- Opcion recomendada: variable `DEV_AUTH_EMAIL` para seleccionar el email activo cuando `NODE_ENV=development`.
- Alternativamente, permitir header local `x-dev-user-email` solo cuando `ENABLE_DEV_AUTH=true`.
- Nunca aceptar `x-dev-user-email` ni `DEV_AUTH_EMAIL` en produccion.
- Seed inicial sugerido: crear usuarios/perfiles `Juan`, `Cami` y `Juntos` a partir de `.env`/defaults de desarrollo.
- El frontend local debe incluir un selector visible de usuario simulado para cambiar entre Juan y Cami sin reiniciar la app.
- El usuario simulado elegido debe guardarse en `localStorage` o estado equivalente de desarrollo para mantener la seleccion al recargar.
- En desarrollo, el frontend debe enviar el usuario simulado al backend mediante `x-dev-user-email` cuando `ENABLE_DEV_AUTH=true`.
- El backend debe rechazar ese header si no esta en modo desarrollo/dev-auth.
- Este selector no debe aparecer en produccion.
- El selector local sirve para probar defaults:
  - Juan ve por defecto `Juntos` + `Juan`.
  - Cami ve por defecto `Juntos` + `Cami`.
  - Ambos pueden activar manualmente el perfil de la otra persona.

## Arquitectura Sugerida

### Opcion recomendada para primera version

- Frontend: Next.js + React + TypeScript.
- Backend: API simple con Fastify + TypeScript.
- Base de datos: SQLite. En la primera implementacion local se usa `node:sqlite` de Node 25 para evitar dependencias nativas adicionales.
- Catalogo externo: TMDB API.
- Deploy: Docker Compose.
- Publicacion: Cloudflare Tunnel + Nginx propio.
- Seguridad: Cloudflare Zero Trust Access.

Decision local inicial:

- Monorepo npm workspaces:
  - `apps/web`: Next.js.
  - `apps/api`: Fastify.
- Arranque sin Docker con `npm run dev`.
- Web local: `http://127.0.0.1:3000`.
- API local: `http://127.0.0.1:8080`.
- El frontend llama a `/api` y Next proxyea a la API local.
- En local usar `127.0.0.1` en vez de `localhost` para evitar conflictos de IPv4/IPv6 con otros servicios del homelab.

### Sobre la base de datos

Usar SQLite para primera version porque:

- Es liviana.
- No requiere administrar otro servicio.
- Es facil de backupear copiando un archivo.
- Alcanza perfecto para uso personal de dos personas.

Guardar el archivo de DB en un volumen persistente del servidor, por ejemplo:

- `/home/jpft/series-tracker/data/app.db`

No guardar la DB dentro del contenedor.

## Modelo De Dominio Inicial

Entidades sugeridas:

### MediaItem

Representa una pelicula o serie de TMDB que decidimos trackear.

Campos sugeridos:

- `id`
- `tmdbId`
- `mediaType`: `movie` o `tv`
- `title`
- `originalTitle`
- `overview`
- `posterPath`
- `backdropPath`
- `releaseDate` o `firstAirDate`
- `createdAt`
- `updatedAt`

Regla:

- `tmdbId + mediaType` debe ser unico.

### WatchStatus

Representa el estado propio de Juan/Camila para ese item.

Campos sugeridos:

- `id`
- `mediaItemId`
- `status`: `watching`, `watched`, `paused`, `dropped`, `wishlist`
- `watchedAt`
- `rating` opcional
- `notes` opcional
- `createdAt`
- `updatedAt`

Para pelicula:

- `status=watched` alcanza para marcarla vista.

Para serie:

- Se complementa con progreso de temporadas/capitulos.

### SeriesProgress

Representa hasta donde vamos en una serie.

Campos sugeridos:

- `id`
- `mediaItemId`
- `seasonNumber`
- `episodeNumber`
- `episodeTitle` opcional
- `updatedAt`

Regla inicial simple:

- Guardar solo "ultimo episodio visto".
- No hace falta trackear cada episodio individual en v1.

Ejemplo:

- Temporada 2, episodio 5 significa que vimos hasta `S02E05`.

## Funcionalidades Iniciales

### Busqueda

- Buscar peliculas y series por texto usando TMDB.
- Mostrar poster, titulo, anio y tipo (`Pelicula` / `Serie`).
- Permitir agregar item a la lista propia.

### Detalle

- Mostrar datos principales de TMDB.
- Mostrar estado propio.
- Acciones:
  - Marcar pelicula como vista.
  - Marcar serie como "viendo".
  - Actualizar temporada/capitulo.
  - Marcar como pendiente o pausada.

### Listas

Pantallas iniciales sugeridas:

- `Viendo ahora`
- `Peliculas vistas`
- `Series`
- `Pendientes`
- `Buscar`

### Progreso De Series

Primera version:

- Inputs simples para temporada y episodio.
- Boton `+1 episodio` para avanzar rapido.
- Mostrar texto tipo: `Vamos por T2 E5`.

Mas adelante:

- Sincronizar temporadas/episodios reales desde TMDB.
- Mostrar nombre del proximo episodio.
- Historial de episodios vistos.

## TMDB

La API key de TMDB debe estar solo en el backend.

Variables sugeridas:

```env
TMDB_API_KEY=
TMDB_BASE_URL=https://api.themoviedb.org/3
TMDB_IMAGE_BASE_URL=https://image.tmdb.org/t/p
```

No exponer `TMDB_API_KEY` en el frontend.

El frontend deberia llamar al backend:

- `GET /api/search?query=...`
- `GET /api/media/{mediaType}/{tmdbId}`

El backend llama a TMDB y devuelve solo lo que la UI necesita.

## Endpoints Iniciales Sugeridos

Todos deberian colgar de `/api` cuando se publique detras de Nginx.

- `GET /health`: healthcheck del backend.
- `GET /search?query=...`: busca peliculas y series en TMDB.
- `POST /media`: agrega un item TMDB a la base local.
- `GET /media`: lista items guardados con filtros opcionales.
- `GET /media/{id}`: detalle local.
- `PUT /media/{id}/status`: actualiza estado.
- `PUT /media/{id}/progress`: actualiza progreso de serie.
- `DELETE /media/{id}`: elimina item local.

Nota:

- Si el backend expone rutas como `/media`, Nginx publicara esas rutas hacia afuera como `/api/media`.
- Evitar que el frontend llame al backend por IP o por nombre de contenedor.

## Frontend

Convenciones sugeridas:

- UI en espanol.
- Mobile-first.
- Navegacion inferior fija si la app se usa principalmente en celular.
- Componentes simples y claros antes que pantallas muy cargadas.
- Usar estados de loading/error vacios bien cuidados.

Variable importante:

```env
NEXT_PUBLIC_API_URL=/api
```

Para local dev puede ser:

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
```

Pero para Docker/produccion debe ser:

```env
NEXT_PUBLIC_API_URL=/api
```

## Backend

Mantenerlo chico y explicito.

Responsabilidades:

- Guardar progreso personal.
- Consultar TMDB usando la API key server-side.
- Normalizar respuestas para el frontend.
- No depender de Cloudflare ni del dominio.

Si se usa SQLite:

- Asegurar volumen persistente.
- Agregar endpoint `/health`.
- Agregar script o comando de backup.

## Docker Compose Sugerido

Servicios reales/esperados:

- `web`
- `api`
- `nginx`

Si se usa SQLite, no hace falta contenedor de DB.

Puertos reales:

- Front interno: `3000`.
- API interna: `8080`.
- Nginx local para Cloudflare: `127.0.0.1:3015:80`.

Usar un puerto distinto a CamiReads:

- CamiReads usa `127.0.0.1:18080`.
- Esta app usa `127.0.0.1:3015`.

Todos los contenedores productivos deben tener:

```yaml
restart: unless-stopped
```

## Nginx Sugerido

Patron:

```nginx
worker_processes 1;

events {
  worker_connections 1024;
}

http {
  gzip on;
  gzip_types text/plain text/css application/javascript application/json image/svg+xml;
  gzip_proxied any;
  gzip_min_length 512;

  upstream frontend {
    server series-frontend:3000;
  }

  upstream api {
    server series-api:8080;
  }

  server {
    listen 80;
    server_name pipiseries.casapipis.net;

    location ~ ^/_next/static/ {
      proxy_pass http://frontend;
      proxy_set_header Host $host;
      add_header Cache-Control "public, max-age=31536000, immutable";
    }

    location /api/ {
      proxy_pass http://api/;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
      proxy_pass http://frontend;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }
}
```

## Cloudflare Tunnel

No tocar la app de finanzas ni su Nginx.

No reutilizar puertos `80`/`443` del servidor.

Agregar un hostname nuevo al tunnel existente:

```yaml
- hostname: pipiseries.casapipis.net
  service: http://localhost:3015
```

Debe ir antes de:

```yaml
- service: http_status:404
```

Reiniciar:

```bash
sudo systemctl restart cloudflared
sudo systemctl status cloudflared
```

Crear ruta DNS si hace falta:

```bash
cloudflared tunnel route dns casapipis-tunnel pipiseries.casapipis.net
```

## Cloudflare Zero Trust

Crear una Access Application nueva para el subdominio:

```text
pipiseries.casapipis.net
```

Policies:

- `Solo Juan y Cami`: `Allow`.
- Service Auth propio de esta app si se decide enviar credenciales en requests.

Recomendacion:

- Crear un Service Token propio para esta app.
- No reutilizar tokens de CamiReads ni finanzas.
- Si se inyectan headers `CF-Access-Client-Id` y `CF-Access-Client-Secret` en frontend, hacerlo via `.env` local y sabiendo que cualquier usuario autorizado podria verlos en DevTools.

## Secretos Y Env

Nunca commitear:

- `.env`
- API key de TMDB.
- `CF-Access-Client-Id` real.
- `CF-Access-Client-Secret` real.
- DB real.
- backups reales si contienen datos personales.

Si hace falta versionar una guia, usar:

- `.env.example`

Ejemplo:

```env
# Frontend publico
NEXT_PUBLIC_API_URL=/api
NEXT_PUBLIC_CF_ACCESS_CLIENT_ID=
NEXT_PUBLIC_CF_ACCESS_CLIENT_SECRET=

# Backend privado
TMDB_API_KEY=
TMDB_BASE_URL=https://api.themoviedb.org/3
TMDB_IMAGE_BASE_URL=https://image.tmdb.org/t/p
```

Nota:

- `NEXT_PUBLIC_CF_ACCESS_CLIENT_ID` y `NEXT_PUBLIC_CF_ACCESS_CLIENT_SECRET` solo deben usarse si se acepta explicitamente el mismo tradeoff que en CamiReads: la app esta detras de Zero Trust y solo la usan Juan y Camila, pero esos valores podrian verse desde DevTools por usuarios autorizados.

## Backups

Si se usa SQLite:

- Guardar DB en `data/app.db`.
- Crear script `backup_db.sh`.
- Backups sugeridos en `backups/`.
- Nombre sugerido:
  - `series_tracker_YYYY-MM-DD_HH-MM.db.gz`

Ejemplo conceptual:

```bash
gzip -c data/app.db > backups/series_tracker_$(date +%F_%H-%M).db.gz
```

No commitear `data/` ni `backups/` reales.

## Validacion Recomendada

### Local

- Backend health: `GET /health`.
- Front carga home.
- Busqueda TMDB devuelve resultados.
- Agregar pelicula.
- Marcar pelicula vista.
- Agregar serie.
- Actualizar temporada/capitulo.
- Recargar app y verificar persistencia.

### Docker

- `docker compose up -d --build`.
- `docker compose ps`.
- `curl http://127.0.0.1:3015`.
- `curl http://127.0.0.1:3015/api/health`.

### Cloudflare

- `sudo systemctl status cloudflared`.
- `https://pipiseries.casapipis.net` abre login de Zero Trust.
- Entra Juan.
- Entra Camila.
- La UI carga y las llamadas `/api` funcionan.

## Gotchas Aprendidos De CamiReads

- En Next.js, las variables `NEXT_PUBLIC_*` se inyectan en build para codigo cliente. Si cambia `NEXT_PUBLIC_API_URL`, hay que rebuildar el frontend.
- Usar `/api` en produccion evita exponer la API como subdominio separado.
- Nginx propio por app reduce riesgo de romper finanzas.
- Publicar Nginx solo en `127.0.0.1:PUERTO` permite que lo use `cloudflared` sin abrirlo a toda la LAN.
- `restart: unless-stopped` hace que los contenedores vuelvan solos tras reinicio.
- Verificar autoarranque con:

```bash
sudo systemctl is-enabled cloudflared
docker inspect NOMBRE_CONTENEDOR --format '{{.Name}} restart={{.HostConfig.RestartPolicy.Name}}'
```

- Agregar `.dockerignore` desde el inicio para no mandar `node_modules` ni `.next` al build Docker.
- Si hay `package-lock.json` y `pnpm-lock.yaml`, decidir un package manager y ser consistente. En CamiReads se prefirio `npm ci` en Docker para evitar problemas de pnpm/corepack.

## Criterio Para Cambios

- Cambios chicos y verificables.
- Primero MVP funcional, despues mejoras.
- Evitar refactors grandes al principio.
- Documentar endpoints nuevos y variables nuevas.
- Si se toca deploy, explicar si requiere rebuild, restart de contenedores o restart de `cloudflared`.
- Nunca tocar configuraciones de otras apps del homelab salvo pedido explicito.

## Estado Actual De La Implementacion

La app ya esta construida como monorepo npm workspaces:

- `apps/api`: Fastify + TypeScript + `node:sqlite`.
- `apps/web`: Next.js App Router + React + TypeScript.
- Arranque local: `npm run dev`.
- API local: `127.0.0.1:8080`.
- Web local: `127.0.0.1:3000`.
- DB local persistente en `data/app.db`.

Validaciones usadas durante desarrollo:

- `npm run typecheck`.
- `npm run typecheck -w @pipiseries/web` para cambios solo frontend.
- `npm run build` solo cuando conviene validar Next completo; puede tardar mas.

Si se modifica backend, recordar al usuario reiniciar `npm run dev` para tomar endpoints nuevos.

## Semantica De Producto Actual

Separar bien estos conceptos:

- `watching`: item que un perfil esta viendo.
- `watched`: item visto por un perfil.
- `wishlist`: estado "quiero ver" de seguimiento, no es una lista manual.
- `lists`: colecciones manuales configurables como `Quiero ver Juan`, `Para ver juntos`, etc.

Regla importante:

- Que una serie aparezca como `Quiero ver` en Inicio/Perfil no implica que este dentro de una lista.
- Para que algo aparezca en una lista, debe agregarse explicitamente desde busqueda o desde el detalle de serie con el selector `Agregar a lista`.

Progreso de series:

- `seasonNumber=0` y `episodeNumber=0` significa "sin progreso".
- Una serie sin progreso no debe mostrar temporadas/capitulos como vistos.
- Si no hay progreso, la UI debe usar la primera temporada regular como referencia visual por defecto.
- Temporada `0` representa especiales y solo debe tratarse como progreso real si hay episodios especiales marcados.
- El Inicio muestra solo el ultimo item de `watching` como `Siguiente capitulo`; el listado completo vive en Perfil.

Capitulos nuevos:

- No duplicar el mismo item entre `Siguiente capitulo` y `Capitulos nuevos`.
- `Nuevo disponible` solo aplica si el ultimo episodio emitido por TMDB es posterior al progreso y salio recientemente.
- Ventana actual de "reciente": 14 dias.

## Pantallas Y UX Actual

Navegacion inferior fija y comun a toda la app:

- `Inicio`
- `Buscar`
- `Listas`
- `Recomendaciones`
- `Perfil`

La bottom nav no debe desaparecer dentro de detalle de serie, temporada o lista.

### Inicio

Tiene sub-tabs superiores:

- `Watch list`
- `Quiero ver`
- icono grid/busqueda

`Watch list`:

- Filtros de perfiles debajo del tab.
- Contadores compactos: `Viendo ahora` y `Episodios nuevos`.
- `Siguiente capitulo`: solo el ultimo item marcado/en curso.
- `Capitulos nuevos`: solo items con episodios nuevos recientes.
- No mostrar proveedores/Netflix en cards del Inicio.

`Quiero ver`:

- Es un tab propio, no una seccion al final de la pantalla principal.
- Permite elegir que lista manual ver mediante selector.
- Muestra items de la lista elegida.
- Permite quitar items de esa lista.

### Buscar

- Busca series/peliculas usando TMDB.
- Al guardar, permite elegir estado (`Quiero ver`, `Viendo`, `Vista`), perfiles y lista destino.
- Los resultados deben indicar si el item ya esta guardado para los perfiles seleccionados:
  - `Viendo`
  - `Vista`
  - `Quiero ver`
- Esa indicacion debe incluir el perfil (`Juan`, `Cami`, `Juntos`).

### Listas

Las listas son una feature central, no secundaria.

Debe poder:

- Crear listas.
- Abrir una lista.
- Ver items dentro.
- Renombrar lista.
- Quitar items de lista.
- Ver si los items tienen entrada/progreso local para el perfil asociado.

Backend actual incluye:

- `GET /lists`
- `POST /lists`
- `GET /lists/:id`
- `PATCH /lists/:id`
- `POST /lists/:id/items`
- `DELETE /lists/:id/items/:mediaId`

### Perfil

Debe mostrar todo lo personal/seleccionado, no solo lo ultimo.

Secciones actuales:

- `Viendo ahora`: todo lo que esta en `watching` para perfiles seleccionados.
- `Vistas`: todo lo que esta en `watched` para perfiles seleccionados.

Debe permitir:

- Abrir serie.
- Quitar entrada de seguimiento del perfil.
- Editar rating en items vistos.

Backend actual para quitar seguimiento:

- `DELETE /media/:id/entry?profileSlug=juan`

### Detalle De Serie

La UI se inspira en TMDB, pero mobile-first.

Cabecera:

- Poster grande.
- Backdrop de fondo.
- Titulo/anio.
- Rating y generos.
- Estado del perfil y progreso.
- Logos de proveedores solamente; no texto "Donde ver".
- Boton `Leer descripcion`; descripcion colapsada por defecto.
- Selector `Agregar a lista` con boton `Agregar`.

Reglas:

- La descripcion no debe empujar/desalinear el poster hacia abajo al abrirse.
- Proveedores solo van en detalle, no en cards del Inicio.
- Usar fallback de descripcion en ingles para temporadas/episodios si TMDB no trae texto en espanol.

Temporadas:

- El detalle de serie muestra listado de temporadas clickeables.
- Cada temporada muestra poster, rating, anio, cantidad de episodios, progreso y descripcion si existe.
- Al abrir temporada, la cabecera cambia a informacion de la temporada: imagen, descripcion colapsable, meta y progreso.
- La lista de episodios permite marcar hasta ese episodio como visto.

Backend actual relevante:

- `GET /media/:id/series`
- `GET /media/:id/season?profileSlug=juan&seasonNumber=4`
- `POST /media/:id/entry`

## Filosofia UI Actual

Mobile-first de verdad:

- Pensar primero en ancho de celular.
- Bottom nav fija siempre visible.
- Evitar pantallas con demasiadas secciones una debajo de otra.
- Si una seccion ensucia la pantalla principal, convertirla en tab o pantalla propia.

Estetica:

- Inspiracion: app tipo watchlist liviana, blanca, sutil, no "dashboard pesado".
- Cards compactas, con poster claro y texto legible.
- No abusar de negritas; evitar que "todo grite".
- Usar pesos 600/700 en metadatos y titulos secundarios; reservar pesos fuertes para titulos principales.
- Pildoras y botones con bordes suaves, no grandes bloques invasivos.
- El amarillo se usa como acento de navegacion/accion, no como color dominante.
- Evitar UI generica oscura/purpura.

Jerarquia:

- Inicio debe ser accionable y corto: que toca ahora, que hay nuevo, acceso a quiero ver como tab.
- Perfil debe ser exhaustivo: todo lo que estoy viendo y todo lo visto.
- Listas deben ser colecciones manuales, editables y navegables.
- Detalle debe concentrar metadata rica y acciones sobre ese item.

Cards:

- En Inicio usar imagen de temporada actual si existe; si no hay progreso, poster de primera temporada regular o poster general.
- Evitar backdrops cortados para cards de series cuando hay poster disponible.
- En busqueda mostrar badges de estado si ya esta guardado.
- Las acciones laterales deben ser tactiles y simples: avanzar, marcar vista, quitar.

Lenguaje:

- UI en espanol.
- Preferir labels cortos:
  - `Watch list`
  - `Quiero ver`
  - `Siguiente capitulo`
  - `Capitulos nuevos`
  - `Viendo ahora`
  - `Vistas`
  - `Recomendaciones`

## Endpoints Actuales A Recordar

API:

- `GET /health`
- `GET /dev-auth/users`
- `GET /me`
- `GET /profiles`
- `GET /search?query=...&profiles=juan,juntos`
- `GET /dashboard?profiles=juan,juntos`
- `GET /media?profiles=juan,juntos&status=watching`
- `POST /media`
- `POST /media/:id/entry`
- `DELETE /media/:id/entry?profileSlug=juan`
- `GET /media/:id/series?profileSlug=juan`
- `GET /media/:id/season?profileSlug=juan&seasonNumber=1`
- `GET /lists`
- `POST /lists`
- `GET /lists/:id`
- `PATCH /lists/:id`
- `POST /lists/:id/items`
- `DELETE /lists/:id/items/:mediaId`
- `GET /recommendations?profileSlug=juntos`

Notas:

- `GET /search` anota resultados con `saved` si el item ya existe para los perfiles consultados.
- `GET /dashboard` esta pensado para Inicio, no para Perfil exhaustivo.
- Para Perfil usar `GET /media` filtrado por estado.

## Recordatorios Para Nuevas Sesiones

- Antes de tocar UI, revisar screenshots recientes del usuario si los adjunta.
- Si el usuario dice que algo "ensucia" Inicio, pensar en tabs/subpantallas antes que seguir apilando secciones.
- No mezclar `wishlist` con listas manuales.
- Cada cambio de backend requiere recordar reiniciar `npm run dev`.
- Preferir typecheck rapido sobre build completo cuando el cambio es chico y el usuario esta iterando rapido.
- Si se cambian endpoints o contrato API/frontend, correr `npm run typecheck`.
