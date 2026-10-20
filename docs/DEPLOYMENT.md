# Despliegue

Lectio corre como un contenedor en el VPS que ya sirve Grazia y `dbsiavichay.dev`, detrás del Caddy compartido (_edge_, `/opt/edge`, de `grazia-infra`). Mismo patrón que el portafolio.

```text
                     :80 :443
  internet ──▶ edge/caddy (TLS) ──┬── lectio.dbsiavichay.dev ──▶ lectio-web:3000 ──▶ /opt/lectio/data/lectio.db
                /opt/edge         ├── dbsiavichay.dev         ──▶ portfolio-web:3000
                                  └── Grazia                  ──▶ …
                       red docker "edge"
```

- El VPS nunca construye: GitHub Actions construye la imagen, la ensaya (`deploy/smoke`), la publica en `ghcr.io/dbsiavichay/lectio` y le dice al VPS qué tag descargar.
- **La imagen no contiene ningún libro.** Los libros se importan en la base de datos, que vive en `/opt/lectio/data` (un _bind mount_). Por eso el paquete de GHCR puede ser público y el VPS lo descarga sin credenciales. **Nunca hagas `docker login ghcr.io` en el VPS**: reemplazaría la credencial que usa Grazia.
- El contenedor corre sin root (uid 1000), con el sistema de archivos de solo lectura salvo `/app/data` y una tmpfs para la caché de Next, sin capacidades y con 384 MB de memoria.

## Archivos

| En el repo                     | En el VPS                            | Qué hace                                                                                        |
| ------------------------------ | ------------------------------------ | ----------------------------------------------------------------------------------------------- |
| `Dockerfile`                   | —                                    | Imagen multi-stage, Node 24 Alpine, `HEALTHCHECK /healthz` (también verifica la base de datos). |
| `deploy/compose.yml`           | `/opt/lectio/compose.yml`            | El servicio `web`.                                                                              |
| `deploy/env.example`           | `/opt/lectio/.env`                   | `WEB_TAG` (lo maneja `deploy.sh`), `APP_URL`, `RP_ID`, `TZ`.                                    |
| `deploy/caddy/lectio.caddy`    | `/opt/edge/caddy/sites/lectio.caddy` | Enrutamiento y compresión.                                                                      |
| `deploy/scripts/deploy.sh`     | `/opt/lectio/scripts/deploy.sh`      | Despliegue de un tag con verificación de salud y rollback automático.                           |
| `deploy/scripts/apply-edge.sh` | `/opt/lectio/scripts/apply-edge.sh`  | Instala `lectio.caddy` en el edge sin romper los otros sitios.                                  |
| `deploy/scripts/backup.sh`     | `/opt/lectio/scripts/backup.sh`      | Respaldo nocturno (cron).                                                                       |

## Primer despliegue

El VPS, el usuario `deploy` y el edge ya existen. Lectio necesita esto una sola vez.

### 1. DNS

En Spaceship, antes del primer despliegue (Caddy pide el certificado en cuanto carga `lectio.caddy`):

```text
lectio.dbsiavichay.dev   A   <IPv4 del VPS>
```

Comprueba: `dig +short lectio.dbsiavichay.dev`.

### 2. Directorios

```bash
ssh ubuntu@<vps> 'sudo install -d -o deploy -g deploy /opt/lectio && sudo install -d -o 1000 -g 1000 /opt/lectio/data'
```

`data/` pertenece al uid 1000, el usuario `node` de la imagen: ahí escribe la base de datos y sus respaldos.

### 3. Repositorio, clave de CI y secretos

```bash
gh repo create dbsiavichay/lectio --private --source . --push   # o --public: el código no incluye libros

ssh-keygen -t ed25519 -f ~/.ssh/lectio_ci -N '' -C 'github-actions@lectio'
ssh deploy@<vps> 'cat >> ~/.ssh/authorized_keys' < ~/.ssh/lectio_ci.pub

R=dbsiavichay/lectio
gh secret set VPS_HOST     -R $R --env production
gh secret set VPS_SSH_PORT -R $R --env production --body 22
gh secret set VPS_USER     -R $R --env production --body deploy
gh secret set VPS_SSH_KEY  -R $R --env production < ~/.ssh/lectio_ci
```

### 4. Primer push y paquete público

Un push a `master` corre las pruebas, publica la imagen y despliega. Después del primer `publish`, en GitHub → Packages → `lectio` → _Package settings_, cambia la visibilidad a **Public** (el VPS la descarga sin credenciales). Si el primer `deploy` falla por no poder descargar la imagen, es eso: hazlo público y re-ejecuta el job.

### 5. Tu cuenta de administrador

```bash
ssh deploy@<vps>
cd /opt/lectio
docker compose exec web node scripts/user.mjs create denis "Denis" --admin   # pide la contraseña
```

### 6. Importar el libro

Desde la app: **Más → Administración → Libros**, selecciona los archivos de `content/books/el-esposo-ejemplar/` (`lectio.book.json`, `sections.json` y `source/*.md`), **Validar** e **Importar**.

O por terminal:

```bash
scp -r content/books/el-esposo-ejemplar/{lectio.book.json,sections.json,source} deploy@<vps>:/opt/lectio/data/books/el-esposo-ejemplar/
ssh deploy@<vps> 'cd /opt/lectio && docker compose exec web node scripts/import-book.mjs /app/data/books/el-esposo-ejemplar'
```

### 7. Respaldo nocturno

```bash
ssh deploy@<vps> '(crontab -l 2>/dev/null; echo "15 3 * * * /opt/lectio/scripts/backup.sh >> /opt/lectio/backup.log 2>&1") | crontab -'
```

Deja una copia consistente en `/opt/lectio/data/backups/` y conserva 14 días. Para tener una copia fuera del VPS, descárgalas periódicamente:

```bash
rsync -av deploy@<vps>:/opt/lectio/data/backups/ ~/Respaldos/lectio/
```

## Flujo de CI/CD

`.github/workflows/ci.yml`: en cada PR corren `quality` (formato, lint, typecheck, Vitest), `e2e` (Playwright en Chromium y WebKit), `docker` (build + smoke de la topología de producción) y `deploy config` (shellcheck, compose, validación y formato de Caddy). En `master`, además, `publish` (GHCR `sha-<7>` y `latest`) y `deploy` (envía `deploy/` al VPS, `deploy.sh <tag>`, `apply-edge.sh` y comprueba que `https://lectio.dbsiavichay.dev/healthz` reporte el commit).

Un _required reviewer_ en el entorno `production` hace que cada despliegue espere aprobación (opcional).

## Configuración

| Variable         | Por defecto                      | Para qué                                                   |
| ---------------- | -------------------------------- | ---------------------------------------------------------- |
| `APP_URL`        | `https://lectio.dbsiavichay.dev` | Origen público; las passkeys se ligan a él.                |
| `RP_ID`          | el host de `APP_URL`             | ID de la _relying party_ de WebAuthn.                      |
| `TZ`             | `America/Guayaquil`              | Zona del servidor (cada usuario elige la suya en Ajustes). |
| `DATABASE_PATH`  | `/app/data/lectio.db`            | Fijado en la imagen.                                       |
| `MIGRATIONS_DIR` | `/app/migrations`                | Fijado en la imagen; se aplican al arrancar.               |
