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
