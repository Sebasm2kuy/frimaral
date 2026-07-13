# 🥩 CALIRAL INSIGHT

**Sistema SaaS profesional de Inteligencia Comercial para Depósitos Frigoríficos y Certificadores**

> ⚠️ **Importante**: Caliral NO es un frigorífico ni produce carne. Caliral es un **depósito frigorífico y certificador**. Los clientes son productores (frigoríficos y establecimientos). La competencia son otros depósitos frigoríficos y certificadores.

## 🎯 Objetivo del sistema

Descubrir **inteligencia comercial** automáticamente a partir de archivos XLSB exportados desde INAC. El sistema detecta:

- Qué productores trabajan con Caliral
- Qué productores comenzaron a trabajar con otro depósito
- Qué productores abandonaron Caliral
- Qué productores fueron recuperados
- Qué competidores están creciendo
- Qué competidores captan clientes de Caliral
- Qué clientes tienen riesgo de abandonar Caliral
- Qué clientes son exclusivos / compartidos
- Qué competidor ganó más participación

## 🏗️ Arquitectura

**Clean Architecture** modular:

```
src/
├── modules/
│   ├── auth/            # Autenticación JWT con 3 roles
│   ├── importer/        # Importador XLSB (SheetJS)
│   ├── intelligence/    # Motor de inteligencia comercial
│   │   ├── engine.ts        # Cálculo de estados y riesgos
│   │   ├── radar-builder.ts # Conclusiones automáticas
│   │   └── services.ts      # Servicios de detalle
│   ├── ai/              # IA comercial (responde desde DB real)
│   └── reports/         # Generadores Excel/PDF/CSV
├── components/
│   ├── auth/            # Login
│   ├── layout/          # AppShell con sidebar
│   ├── radar/           # Radar Comercial
│   ├── producers/       # Módulo Productores
│   ├── competitors/     # Módulo Competidores
│   ├── relationships/   # Mapa de Relaciones
│   ├── importer/        # Importador UI
│   ├── reports/         # Reportes UI
│   ├── alerts/          # Alertas
│   ├── ai/              # Asistente IA
│   ├── search/          # Buscador global
│   └── shared/          # Utils compartidos
├── stores/              # Zustand (auth, nav)
├── types/               # Tipos del dominio
└── app/
    ├── api/             # API Routes REST
    ├── page.tsx         # Entry point
    ├── layout.tsx       # Root layout
    └── globals.css      # Tema oscuro
```

## 🛠️ Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Framework | Next.js 16 (App Router) |
| Lenguaje | TypeScript 5 estricto |
| UI | TailwindCSS 4 + shadcn/ui (New York) |
| Estado | Zustand (cliente) + TanStack Query (servidor) |
| Tablas | TanStack Table |
| Gráficos | Recharts |
| Animaciones | Framer Motion |
| Iconos | Lucide React |
| ORM | Prisma 6 (SQLite dev / PostgreSQL prod) |
| Auth | JWT + bcryptjs |
| Excel | SheetJS (xlsx) |
| PDF | jsPDF + jspdf-autotable |
| CSV | PapaParse |

## 📊 Modelo de Datos

10 entidades principales:

- **Usuario** — con 3 roles (ADMINISTRADOR, COMERCIAL, LECTOR)
- **Certificador** — Caliral (esCaliral = true)
- **Competidor** — Otros depósitos frigoríficos certificadores
- **Productor** — Frigoríficos y establecimientos (clientes)
- **Operacion** — Registro individual de cada operación
- **Importacion** — Historial ilimitado de archivos XLSB cargados
- **Historico** — Snapshot por productor por periodo
- **Alerta** — Eventos comerciales detectados automáticamente
- **Destino** — País de exportación
- **Contenedor** — Código de contenedor

## 🧠 Motor de Inteligencia

### Estados de cliente (calculados automáticamente)

| Estado | Descripción |
|--------|-------------|
| `NUEVO` | Primer periodo operando con Caliral |
| `EXCLUSIVO` | Solo opera con Caliral |
| `COMPARTIDO` | Opera con Caliral y al menos un competidor |
| `PERDIDO` | Antes operaba con Caliral, ahora no |
| `RECUPERADO` | Volvió a operar con Caliral tras estar perdido |
| `INACTIVO` | No opera con nadie |

### Índice de Riesgo (0-100)

Calculado con 5 factores ponderados:

1. **Disminución de operaciones** con Caliral (vs período anterior)
2. **Uso creciente de competidores** (variación interperiódica)
3. **Tiempo sin operar** con Caliral (días desde última operación)
4. **Cambio de certificador** (migración a competidor)
5. **Cantidad de competidores** utilizados simultáneamente

Niveles: `BAJO` (0-29) · `MEDIO` (30-59) · `ALTO` (60-79) · `CRÍTICO` (80-100)

### Tipos de Alertas (10)

`CLIENTE_PERDIDO` · `CLIENTE_RECUPERADO` · `CLIENTE_NUEVO` · `CLIENTE_COMPARTIDO` · `RIESGO_ALTO` · `RIESGO_CRITICO` · `COMPETIDOR_CRECIMIENTO` · `COMPETIDOR_CAPTACION` · `MIGRACION` · `DISMINUCION`

## 🚀 Instalación

```bash
# 1. Instalar dependencias
bun install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores

# 3. Inicializar base de datos
bun run db:push

# 4. Cargar datos seed (15 productores, 7 competidores, 1081 operaciones)
bun run scripts/seed.ts

# 5. Iniciar servidor de desarrollo
bun run dev
```

Abrir http://localhost:3000

## 🔐 Credenciales de demostración

| Rol | Email | Contraseña | Permisos |
|-----|-------|------------|----------|
| Administrador | admin@caliral.com | admin123 | Acceso total |
| Comercial | comercial@caliral.com | comercial123 | Análisis, importación, reportes |
| Solo Lectura | lector@caliral.com | lector123 | Visualización sin edición |

## 📥 Importador XLSB

Al subir un archivo XLSB exportado desde INAC, el sistema:

1. ✅ Lee todas las hojas del archivo
2. ✅ Detecta automáticamente las columnas (acepta variantes de nombres)
3. ✅ Valida la estructura (columnas obligatorias)
4. ✅ Elimina duplicados (hash único por fila)
5. ✅ Normaliza nombres (UPPERCASE, sin caracteres especiales)
6. ✅ Actualiza el histórico sin sobrescribir datos previos
7. ✅ Recalcula el motor de inteligencia completo
8. ✅ Genera alertas automáticamente
9. ✅ Muestra barra de progreso en tiempo real

**Columnas detectadas automáticamente**: `productor`, `cuit_productor`, `certificador`, `competidor`, `fecha`, `periodo`, `producto`, `cantidad`, `peso`, `valor`, `destino`, `contenedor`

## 🤖 IA Comercial

Asistente integrado que responde desde la base de datos real (no simulado). Ejemplos:

- ¿Qué clientes comenzaron a usar otro depósito?
- ¿Qué clientes tienen riesgo alto?
- ¿Qué competidor más creció?
- ¿Qué productores dejaron de trabajar con Caliral?
- ¿Qué clientes puedo recuperar?
- ¿Cuáles son mis mejores clientes?
- ¿Qué clientes son exclusivos / compartidos?
- Frioport / Las Moras / Caliral (búsqueda directa)

## 📑 Reportes

7 tipos de reporte en 3 formatos:

| Reporte | Descripción |
|---------|-------------|
| Completo | Radar + productores + competidores + alertas |
| Radar comercial | Conclusiones y métricas globales |
| Productores | Listado con estado, riesgo y recomendaciones |
| Competidores | Análisis con captaciones y crecimiento |
| Clientes en riesgo | Plan de acción para clientes ALTO/CRÍTICO |
| Alertas | Historial de alertas detectadas |
| Evolución temporal | Series históricas Caliral vs Competencia |

Formatos: **Excel (.xlsx)** · **PDF** · **CSV**

## 🎨 Diseño

Inspirado en: **Linear · Notion · Stripe Dashboard · Vercel · GitHub**

- Modo oscuro por defecto
- Mucho espacio en blanco
- Tarjetas limpias con bordes sutiles
- Animaciones suaves con Framer Motion
- Totalmente responsive
- Atajos de teclado (`⌘K` para búsqueda global)

## 🔧 Configuración de producción

### PostgreSQL

Editar `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Editar `.env`:

```
DATABASE_URL="postgresql://user:password@localhost:5432/caliral_insight"
JWT_SECRET="tu-secreto-super-seguro"
```

### Docker (opcional)

```bash
docker-compose up -d
```

## 📝 Licencia

Propietario — CALIRAL © 2024

## 🚨 Seguridad

- ✅ Autenticación JWT con expiración de 7 días
- ✅ Contraseñas hasheadas con bcrypt (salt rounds: 12)
- ✅ RBAC con 3 roles
- ✅ Validación de entrada en todas las APIs
- ✅ Variables de entorno para secretos
- ⚠️ **NUNCA** commits tokens en el código
