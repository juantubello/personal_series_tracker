# PipiSeries

App web mobile-first para trackear series y peliculas vistas por Juan, Cami y Juntos.

## Arranque Local

1. Completar `.env` con `TMDB_ACCESS_TOKEN` o `TMDB_API_KEY`.
2. Instalar dependencias:

```bash
npm install
```

3. Levantar frontend y backend:

```bash
npm run dev
```

La web queda en `http://localhost:3000` y la API en `http://localhost:8080`.

## Modo Local Con Usuarios

Con `ENABLE_DEV_AUTH=true`, la web muestra un selector para simular Juan o Cami. El usuario elegido se guarda localmente y se envia al backend con `x-dev-user-email`.

Ese header se rechaza fuera del modo desarrollo.

## Notas De Producto

- En Perfil, los estados funcionan como filtros combinables. Por defecto se muestra `Viendo`; se puede sumar `Vista` o `Quiero ver`, o dejar solo uno de ellos.
- Perfil permite ordenar por actividad reciente, fecha de agregado, nombre A-Z/Z-A y visto reciente.
- Las fechas visibles se formatean con locale argentino (`dd/mm/aaaa`).
- Al guardar o avanzar una serie se conserva la fecha de agregado de la entrada.
- Al marcar capítulos vistos se guarda historial por capítulo en `episode_watches`. Si se marcan muchos de golpe, todos esos capítulos reciben la misma fecha de vista.
- Las respuestas de TMDB se cachean en SQLite con TTL para evitar llamadas repetidas: búsquedas 12h, detalles 7d, temporadas 14d, recomendaciones 2d y datos de TV 6h.

## Docker

La app se puede probar localmente antes de deployarla al servidor Linux. El stack levanta:

- `nginx`: entrada unica, expone `http://localhost:3000` por defecto.
- `web`: Next.js.
- `api`: Fastify + SQLite, usando `./data/app.db` montada en `/data/app.db`.

Para probar local sin Cloudflare:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml up --build
```

Para produccion:

1. Completar `.env` en el servidor con `TMDB_ACCESS_TOKEN` o `TMDB_API_KEY`.
2. Configurar `ENABLE_DEV_AUTH=false`.
3. Completar `CLOUDFLARE_ACCESS_TEAM_DOMAIN` y `CLOUDFLARE_ACCESS_AUD`.
4. Levantar con `docker compose up -d --build`.
5. Apuntar Cloudflare Tunnel / Zero Trust al Nginx, por ejemplo `http://localhost:3000` si se publica desde el host.

El backend valida el header `Cf-Access-Jwt-Assertion` en produccion. Nginx lo reenvia a la API, asi que Cloudflare Access queda como puerta de entrada y la API no confia solamente en estar detras del proxy. El selector local de Juan/Cami solo aparece con `ENABLE_DEV_AUTH=true` y fuera de `NODE_ENV=production`.

Docker y el modo local apuntan a la misma carpeta `data/`. No conviene correr ambos al mismo tiempo contra la misma SQLite.

Guia completa: [Deploy En Linux Con Cloudflare Zero Trust](docs/deploy-linux-cloudflare.md).

## Backups Y Export

La base SQLite vive en `data/app.db` y no se pierde al recrear contenedores. Para backup tecnico de la DB:

```bash
npm run backup:docker
```

Si estas usando el override local:

```bash
COMPOSE_FILES="-f docker-compose.yml -f docker-compose.local.yml" npm run backup:docker
```

El script usa `VACUUM INTO` desde SQLite y guarda los archivos en `backups/`, que esta ignorado por Git.

Desde la app, en `Perfil > Ajustes`, se puede descargar:

- `Exportar JSON`: snapshot legible de usuarios, perfiles, items, progreso, capitulos vistos y listas. No incluye `tmdb_cache` porque es informacion recreable.
- `Backup DB`: `.tar.gz` con una copia SQLite generada mediante `VACUUM INTO`.
