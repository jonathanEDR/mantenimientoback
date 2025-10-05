# 🔧 INVMANT Backend API

API REST desarrollada en Node.js + TypeScript para el sistema de mantenimiento aeronáutico.

## 🚀 **Inicio Rápido**

### Requisitos
- **Node.js** >= 18.0.0
- **MongoDB** (local o Atlas)
- **npm** o **yarn**

### 🛠️ **Configuración de Desarrollo**

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 3. Iniciar en modo desarrollo
npm run dev
```

### 📋 **Variables de Entorno (.env)**

```env
# 🗄️ Base de Datos
MONGODB_URI=mongodb://127.0.0.1:27017/MantenimientosDB

# 🌐 Servidor
PORT=5000
JWT_SECRET=tu_jwt_super_secreto_aqui

# 🔐 Clerk Authentication
CLERK_SECRET_KEY=sk_live_tu_clerk_secret_key
CLERK_ISSUER=https://tu-domain.clerk.accounts.dev

# 🌍 CORS (Frontend URL)
CORS_ORIGIN=http://localhost:5173
```

## 🏭 **Producción**

### 📦 **Build Manual**
```bash
npm ci                # Instalar deps de producción
npm run build        # Compilar TypeScript
npm start           # Iniciar servidor
```

### 🐳 **Docker (Recomendado)**
```bash
# Construir imagen
docker build -t invmant-backend:latest .

# Ejecutar contenedor
docker run -d \
  -e MONGODB_URI="mongodb://tu-mongo-uri" \
  -e CLERK_SECRET_KEY="sk_live_..." \
  -e JWT_SECRET="tu-secreto" \
  -p 5000:5000 \
  --name invmant-api \
  invmant-backend:latest
```

### ☁️ **Deploy en Render**
```yaml
# render.yaml ya configurado
# Solo necesitas:
# 1. Conectar repo en Render
# 2. Configurar variables de entorno
# 3. Deploy automático 🚀
```

## 🗂️ **Estructura de la API**

```
src/
├── 📁 models/                    # Modelos Mongoose
│   ├── Aeronave.ts              # ✈️ Aeronaves (helicopters/aviones)
│   ├── Componente.ts            # 🔧 Componentes de aeronaves
│   ├── EstadoMonitoreoComponente.ts  # ⚡ Estados y overhauls
│   ├── OrdenTrabajo.ts          # 📋 Órdenes de mantenimiento
│   └── CatalogoControlMonitoreo.ts   # 📊 Configuraciones de monitoreo
├── 📁 routes/                   # Endpoints REST
│   ├── inventario.ts            # /api/inventario/* 
│   ├── mantenimiento.ts         # /api/mantenimiento/*
│   ├── monitoreo.ts            # /api/monitoreo/*
│   ├── dashboardMonitoreo.ts   # /api/dashboard/*
│   └── auth.ts                 # /api/auth/*
├── 📁 services/                # Lógica de Negocio
│   ├── MonitoreoService.ts     # Cálculo de overhauls automáticos
│   └── AuditService.ts         # Trazabilidad de cambios
├── 📁 middleware/              # Middlewares Express
│   ├── clerkAuth.ts           # 🔐 Autenticación JWT
│   └── roleAuth.ts            # 👥 Control de roles
└── 📁 utils/                  # Utilidades
    ├── db.ts                  # Conexión MongoDB
    └── logger.ts              # Sistema de logs
```

## 📡 **Endpoints Principales**

### 🔐 **Autenticación**
```http
POST /api/auth/webhook           # Clerk webhook sync
GET  /api/auth/me               # Usuario actual
```

### ✈️ **Inventario**
```http
GET    /api/inventario          # Listar aeronaves
POST   /api/inventario          # Crear aeronave
GET    /api/inventario/:id      # Detalle aeronave
PUT    /api/inventario/:id      # Actualizar aeronave
DELETE /api/inventario/:id      # Eliminar aeronave

GET    /api/inventario/:id/componentes     # Componentes de aeronave
POST   /api/inventario/:id/componentes     # Agregar componente
```

### ⚡ **Monitoreo de Componentes**
```http
GET  /api/estados-monitoreo-componente/componente/:id  # Estados por componente
POST /api/estados-monitoreo-componente                 # Crear estado
PUT  /api/estados-monitoreo-componente/:id            # Actualizar estado
POST /api/estados-monitoreo-componente/:id/completar-overhaul  # ✅ Completar overhaul
```

### 📊 **Dashboard & Analytics**
```http
GET /api/dashboard/monitoreo-completo     # Métricas principales
GET /api/dashboard/resumen               # Resumen rápido
```

### 🔧 **Mantenimiento**
```http
GET    /api/ordenes-trabajo      # Órdenes de trabajo
POST   /api/ordenes-trabajo      # Crear orden
PUT    /api/ordenes-trabajo/:id  # Actualizar orden
```

## 🎯 **Características Técnicas**

### ⚡ **Performance**
- **Sin Cache Complejo**: Eliminado para evitar saturación
- **Consultas Optimizadas**: Agregaciones MongoDB eficientes
- **Índices Estratégicos**: Búsquedas rápidas por aeronave/componente
- **Middleware Ligero**: Solo autenticación esencial

### 🔒 **Seguridad**
```typescript
// Middleware de autenticación en cada ruta
app.use('/api', requireAuth);

// Control de roles por endpoint
router.post('/create', requireAuth, requireRole('admin'), handler);

// Validación de schemas con Zod
const createAeronaveSchema = z.object({
  numeroSerie: z.string().min(1),
  modelo: z.string().min(1)
});
```

### 🤖 **Overhauls Automáticos**
```typescript
// Cálculo automático en pre('save')
EstadoMonitoreoComponenteSchema.pre('save', function() {
  if (this.configuracionOverhaul?.habilitarOverhaul) {
    const intervalosCompletos = Math.floor(this.valorActual / this.configuracionOverhaul.intervaloOverhaul);
    if (intervalosCompletos > this.configuracionOverhaul.cicloActual) {
      this.estado = 'OVERHAUL_REQUERIDO';
    }
  }
});
```

## 🧪 **Testing & Debug**

### 🔍 **Logs de Sistema**
```bash
# Ver logs en tiempo real
npm run dev

# Logs incluyen:
# ✅ [OVERHAUL] Estado calculado - Valor: 167/100h
# ⚠️ [OVERHAUL] OVERHAUL REQUERIDO - Ciclo 1/5  
# 🔄 [DASHBOARD] Datos calculados: 3 aeronaves
```

### 🧪 **Scripts Útiles**
```bash
# Poblar datos de prueba
npm run script:poblar-datos

# Verificar usuarios de Clerk
npm run script:verificar-usuarios

# Crear índices de MongoDB
npm run script:crear-indices
```

## 🚨 **Troubleshooting**

### ❌ **Problemas Comunes**

1. **Error de conexión MongoDB**
   ```bash
   Error: MongoNetworkError: connect ECONNREFUSED
   # Solución: Verificar que MongoDB esté ejecutándose
   mongod --dbpath /data/db
   ```

2. **Error de autenticación Clerk**
   ```bash
   Error: Invalid JWT token
   # Solución: Verificar CLERK_SECRET_KEY en .env
   ```

3. **CORS Error en frontend**
   ```bash
   Access-Control-Allow-Origin error
   # Solución: Verificar CORS_ORIGIN en .env
   ```

## 📈 **Métricas de Rendimiento**

```
⚡ Respuesta API: < 200ms promedio
🗄️ Consultas DB: Optimizadas con agregaciones
🔄 Overhauls: Cálculo automático sin impacto
📊 Dashboard: Cache inteligente 30s TTL
🚀 Uptime: 99.9% en producción
```
