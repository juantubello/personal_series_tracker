# Deploy En Linux Con Cloudflare Zero Trust

Esta guia asume un servidor Linux con Docker y Docker Compose Plugin instalado.

## 1. Clonar

```bash
git clone https://github.com/juantubello/personal_series_tracker.git
cd personal_series_tracker
cp .env.example .env
```

## 2. Completar `.env`

Valores importantes:

```env
TMDB_ACCESS_TOKEN=
TMDB_API_KEY=

ENABLE_DEV_AUTH=false
JUAN_EMAIL=tu-email-de-cloudflare@example.com
CAMI_EMAIL=email-de-cami@example.com

CLOUDFLARE_ACCESS_TEAM_DOMAIN=https://TU-TEAM.cloudflareaccess.com
CLOUDFLARE_ACCESS_AUD=aud-tag-de-la-aplicacion

NEXT_PUBLIC_CF_ACCESS_CLIENT_ID=
NEXT_PUBLIC_CF_ACCESS_CLIENT_SECRET=

HOST_HTTP_PORT=127.0.0.1:3015
CLOUDFLARED_TOKEN=
```

Notas:

- En produccion, `ENABLE_DEV_AUTH` debe estar en `false`.
- `JUAN_EMAIL` y `CAMI_EMAIL` tienen que coincidir con los emails autenticados por Cloudflare Access.
- `NEXT_PUBLIC_CF_ACCESS_CLIENT_ID` y `NEXT_PUBLIC_CF_ACCESS_CLIENT_SECRET` son opcionales, pero si tu Access Application usa Service Auth como en tus otras apps, completalos con un Service Token propio de PipiSeries.
- Esos `NEXT_PUBLIC_*` se incluyen en el build de Next y pueden verse en DevTools por usuarios autorizados.
- Si cambias esos tokens, corre de nuevo `docker compose up -d --build` para regenerar el frontend.
- `HOST_HTTP_PORT=127.0.0.1:3015` deja Nginx accesible solo desde el servidor y evita choque con otras apps.
- `CLOUDFLARED_TOKEN` solo hace falta si queres correr `cloudflared` dentro de este compose. Si ya tenes un tunnel central en el host, dejalo vacio.

## 3. Crear La App En Cloudflare Access

En Cloudflare Zero Trust:

1. Ir a `Access controls > Applications`.
2. Crear una app `Self-hosted and private`.
3. Agregar un public hostname, por ejemplo `series.tudominio.com`.
4. Crear una policy que permita solo los emails de Juan y Cami.
5. En `Additional settings`, copiar el `Application Audience (AUD) Tag`.
6. Pegar ese valor en `CLOUDFLARE_ACCESS_AUD`.
7. Confirmar que el team domain tenga formato `https://TU-TEAM.cloudflareaccess.com` y guardarlo en `CLOUDFLARE_ACCESS_TEAM_DOMAIN`.

La API valida el JWT que Cloudflare manda en `Cf-Access-Jwt-Assertion`, por eso esos dos valores son obligatorios en produccion.

## 4. Tunnel Existente En El Host

Si queres mantener el mismo patron de tus otras apps, usa el tunnel existente del servidor y agrega un public hostname:

```txt
pipiseries.casapipis.net -> http://127.0.0.1:3015
```

En ese modo no necesitas `CLOUDFLARED_TOKEN`.

Opcion alternativa: si queres que este compose tambien levante `cloudflared`, completa `CLOUDFLARED_TOKEN` y apunta el hostname del tunnel a:

```txt
http://nginx:80
```

## 5. Levantar

Modo recomendado si ya tenes tunnel central:

```bash
docker compose up -d --build
```

Modo opcional con tunnel integrado:

```bash
docker compose --profile tunnel up -d --build
```

Ver estado:

```bash
docker compose ps
docker compose logs -f api web nginx cloudflared
```

## 6. Base De Datos

La DB vive en:

```txt
data/app.db
```

Docker monta `./data` en `/data`, por lo que la DB sobrevive a reinicios y recreaciones de contenedores.

No correr al mismo tiempo `npm run dev` y Docker contra la misma DB.

## 7. Backups

Desde servidor:

```bash
npm run backup:docker
```

Desde la app:

```txt
Perfil > Ajustes > Backup DB
```

Ambos generan una copia SQLite segura usando `VACUUM INTO`.

## 8. Actualizar Deploy

```bash
git pull
docker compose --profile tunnel up -d --build
```

Si no usas tunnel integrado:

```bash
git pull
docker compose up -d --build
```
