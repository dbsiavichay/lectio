# Operación diaria

En el VPS, como usuario `deploy`, desde `/opt/lectio`.

```bash
docker compose ps                     # estado (healthy)
docker compose logs -f web            # registros
curl -fsS https://lectio.dbsiavichay.dev/healthz
```

## Usuarios

```bash
docker compose exec web node scripts/user.mjs list
docker compose exec web node scripts/user.mjs create maria "María" [--admin]
docker compose exec web node scripts/user.mjs password maria     # cierra sus sesiones al cambiarla desde Administración
docker compose exec web node scripts/user.mjs delete maria       # borra también todo su estudio
```

También desde **Más → Administración**.

## Libros

Importar o actualizar: **Administración → Libros** (Validar, luego Importar) o:

```bash
docker compose exec web node scripts/import-book.mjs /app/data/books/<slug> [--dry-run]
```

Reimportar un libro corregido conserva lo que escribieron los usuarios (las claves son los códigos de pregunta y las etiquetas de los campos).

## Despliegues y rollback

Cada push a `master` despliega solo. Para volver a una versión anterior:

```bash
./scripts/deploy.sh sha-abc1234      # tag de GHCR; espera healthy y revierte si falla
```

`deploy.sh` conserva la imagen actual y la anterior, así que un rollback inmediato no necesita red.

## Respaldos y restauración

```bash
./scripts/backup.sh                         # ahora mismo
ls -lh data/backups/                        # copias de los últimos 14 días
```

Restaurar (detiene la app un momento):

```bash
docker compose stop web
cp data/lectio.db data/lectio.db.antes-de-restaurar
cp data/backups/lectio-AAAAMMDD-HHMM.db data/lectio.db
rm -f data/lectio.db-wal data/lectio.db-shm
docker compose start web
```

Probar un respaldo en tu computadora: copia el archivo a `data/lectio.db` del repo y corre `npm run dev`.

## Qué no hacer

- **No** hagas `docker login ghcr.io` en el VPS (rompe los _pulls_ de Grazia).
- **No** borres volúmenes ni `data/` (`docker volume prune`, `docker compose down -v`): ahí está todo el estudio.
- **No** edites `lectio.caddy` directamente en `/opt/edge`: cambia el del repo y deja que `apply-edge.sh` lo instale.

## Problemas frecuentes

| Síntoma                                                                  | Causa probable                                                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `deploy.sh` dice que no puede descargar la imagen                        | El paquete de GHCR no es público.                                                                       |
| El contenedor no llega a `healthy` y el log dice `EACCES` en `/app/data` | `data/` no pertenece al uid 1000: `sudo chown -R 1000:1000 /opt/lectio/data`.                           |
| Las passkeys fallan con «origin» o «RP ID»                               | `APP_URL`/`RP_ID` en `.env` no coinciden con el dominio.                                                |
| «Demasiados intentos» al entrar                                          | Bloqueo de 15 minutos tras 5 fallos (por usuario y por IP). Se libera solo o reiniciando el contenedor. |
