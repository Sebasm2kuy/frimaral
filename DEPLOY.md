# 🚀 Guía de Deploy desde GitHub

CALIRAL INSIGHT puede desplegarse **100% desde GitHub** sin Vercel. Estas son las opciones:

---

## 📋 Opción 1: GitHub Container Registry (GHCR) + Cualquier VPS

Esta es la **opción recomendada**. GitHub Actions construye automáticamente la imagen Docker en cada push y la publica en GitHub Container Registry (gratuito). Luego puedes ejecutarla en cualquier servidor.

### Paso 1: Ya está configurado ✅

El workflow `.github/workflows/docker-publish.yml` se ejecuta automáticamente en cada push a `main`. La imagen se publica en:

```
ghcr.io/sebasm2kuy/frimaral:latest
```

### Paso 2: En tu servidor (VPS, dedicated, o cualquier Docker host)

```bash
# 1. Crear red y volumen
docker volume create caliral_data

# 2. Ejecutar la imagen
docker run -d \
  --name caliral-insight \
  --restart unless-stopped \
  -p 80:3000 \
  -e JWT_SECRET=$(openssl rand -base64 64) \
  -e DATABASE_URL="file:/app/data/caliral.db" \
  -v caliral_data:/app/data \
  ghcr.io/sebasm2kuy/frimaral:latest

# 3. Verificar
curl http://localhost
```

### Paso 3: Con PostgreSQL (recomendado para producción)

```bash
# Crear docker-compose.yml en el servidor
cat > docker-compose.yml << 'EOF'
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: caliral
      POSTGRES_USER: caliral
      POSTGRES_PASSWORD: CAMBIA_ESTO
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    image: ghcr.io/sebasm2kuy/frimaral:latest
    restart: unless-stopped
    ports:
      - "80:3000"
    environment:
      DATABASE_URL: "postgresql://caliral:CAMBIA_ESTO@db:5432/caliral?schema=public"
      JWT_SECRET: GENERA_UNO_NUEVO
    depends_on:
      - db

volumes:
  postgres_data:
EOF

docker compose up -d
```

---

## 📋 Opción 2: Deploy Automático a VPS via SSH

Si tienes un VPS propio, puedes configurar deploy automático: cada vez que publiques un release (`git tag v1.0.0 && git push origin v1.0.0`), GitHub Actions se conecta por SSH y actualiza la app.

### Paso 1: Configurar secrets en GitHub

Ve a **Settings → Secrets and variables → Actions → New repository secret** y añade:

| Secret | Valor de ejemplo |
|--------|------------------|
| `SSH_HOST` | `123.45.67.89` o `midominio.com` |
| `SSH_USER` | `deploy` (no uses root) |
| `SSH_PRIVATE_KEY` | Contenido completo de `~/.ssh/id_ed25519` |
| `SSH_PORT` | `22` |
| `DEPLOY_PATH` | `/opt/caliral` |
| `JWT_SECRET` | Genera con `openssl rand -base64 64` |
| `POSTGRES_PASSWORD` | Password fuerte para PostgreSQL |

### Paso 2: Preparar el VPS

```bash
# En el VPS (como root)
apt update && apt install -y docker.io docker-compose-plugin

# Crear usuario deploy
useradd -m -s /bin/bash deploy
usermod -aG docker deploy

# Configurar clave SSH pública en el VPS
mkdir -p /home/deploy/.ssh
echo "TU_CLAVE_PUBLICA_SSH" >> /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

# Crear directorio de deploy
mkdir -p /opt/caliral
chown deploy:deploy /opt/caliral
```

### Paso 3: Desplegar

```bash
# En tu PC local, dentro del repo
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions se ejecuta automáticamente
# La app estará disponible en http://TU_VPS:3000
```

---

## 📋 Opción 3: Self-hosted Runner en tu VPS

Si quieres que GitHub Actions ejecute el build directamente en tu VPS (sin usar GHCR):

### Paso 1: Configurar self-hosted runner

En GitHub: **Settings → Actions → Runners → New self-hosted runner**. Sigue las instrucciones para instalarlo en tu VPS.

### Paso 2: Workflow personalizado

Crea `.github/workflows/deploy-self-hosted.yml`:

```yaml
name: Deploy Self-Hosted
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
      - name: Build and deploy
        run: |
          cd /opt/caliral
          docker compose down
          docker compose build
          docker compose up -d
```

---

## 🌐 Opción 4: Coolify / Dokku (PaaS self-hosted)

Si quieres una experiencia tipo Vercel pero self-hosted en tu VPS:

### Coolify (recomendado, gratis y open source)

1. Instala Coolify en tu VPS: https://coolify.io/docs/installation
2. Conecta tu repo `Sebasm2kuy/frimaral`
3. Coolify detecta automáticamente el `Dockerfile`
4. Configura las variables de entorno:
   - `DATABASE_URL`
   - `JWT_SECRET`
5. Click en "Deploy"

Coolify hace deploy automático en cada push a `main`.

---

## 🔧 Variables de entorno necesarias

| Variable | Descripción | Ejemplo |
|----------|-------------|---------|
| `DATABASE_URL` | URL de la base de datos | `file:/app/data/caliral.db` o `postgresql://...` |
| `JWT_SECRET` | Secreto para JWT (64+ caracteres) | Genera con `openssl rand -base64 64` |

---

## ✅ Verificación post-deploy

```bash
# 1. Health check
curl http://TU_SERVIDOR/

# 2. Login test
curl -X POST http://TU_SERVIDOR/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@caliral.com","password":"admin123"}'

# 3. Inicializar datos seed (solo primera vez)
docker exec -it caliral-insight bun run scripts/seed.ts
```

---

## 🔄 Actualizaciones automáticas

Si usas GHCR (Opción 1) con Watchtower en tu VPS, las actualizaciones son automáticas:

```bash
docker run -d \
  --name watchtower \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --interval 300 \
  caliral-insight
```

Cada 5 minutos Watchtower verifica si hay una nueva imagen en GHCR y actualiza el contenedor automáticamente.
