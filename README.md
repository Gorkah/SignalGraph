# SignalGraph

Un tablón de investigación interactivo para explorar el grafo de relaciones de Cala AI. Construido con Next.js 16, React 19, y TypeScript con enfoque en performance y UX visual pixel-art.

## 🚀 Quick Start

### Prerequisitos
- Node.js 18+
- npm o pnpm
- Variables de entorno configuradas (ver `.env.example`)

### Instalación

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno de ejemplo
cp .env.example .env.local

# Configurar las API keys en .env.local
# CALA_API_KEY, OPENAI_API_KEY, PIONEER_API_KEY, etc.

# Ejecutar en desarrollo
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## 📁 Estructura del Proyecto

```
├── app/
│   ├── api/                 # API routes (Next.js route handlers)
│   │   ├── report/         # POST: query dossier lento
│   │   ├── entity/[id]/    # POST: tirar de hilo, GET: introspección
│   │   └── middleware.ts   # Validación Zod + error handling
│   ├── layout.tsx          # Root layout con fuentes y estilos
│   └── page.tsx            # Home page
├── components/             # React components
│   ├── Tablon.tsx         # Tablón principal (pan, rejilla, SVG)
│   ├── Ficha.tsx          # Entity card (full/lead density)
│   ├── Bandeja.tsx        # Inbox + query interface
│   ├── Carpeta.tsx        # Sidebar detalles
│   ├── Hilos.tsx          # SVG overlay con relaciones
│   └── ...                # Otros componentes
├── lib/
│   ├── constants.ts       # Magic numbers centralizados
│   ├── env.ts             # Validación de variables de entorno (Zod)
│   ├── logger.ts          # Logging estructurado
│   ├── normalize.ts       # Funciones de normalización centralizadas
│   ├── cala.ts            # Cliente Cala API (server-side)
│   ├── disk-cache.ts      # Cache en disco + limpieza automática
│   ├── store.ts           # Zustand store (board state)
│   ├── types.ts           # TypeScript types
│   ├── geometry.ts        # Cálculos de geometría (snap, paths)
│   ├── fields.ts          # Extracción de campos (money, place, description)
│   ├── investigation.ts   # Trail & context building
│   ├── relations.ts       # Mapeo de relaciones
│   ├── manifest.ts        # Carga de manifiesto de caso
│   └── seed.ts            # Inicialización desde datos locales
├── data/
│   ├── cache/             # Cache de disco (generado)
│   ├── cala/              # Volcados de consultas JSON
│   └── cases/             # Manifiestos de casos
├── public/                # Assets estáticos
├── scripts/
│   ├── build-case.mjs     # Generar caso desde relaciones
│   ├── build-roles.mjs    # Generar roles
│   └── cala-query.mjs     # Ejecutar query en Cala
├── app/
│   ├── globals.css        # Tailwind + temas
│   ├── cards.css          # Estilos de fichas
│   └── board.css          # Estilos del tablón
└── tsconfig.json          # Config TypeScript
```

## 🔧 Configuración

### Variables de Entorno

Copiar `.env.example` a `.env.local` y configurar:

```bash
# Cala AI
CALA_API_KEY=                  # Requerido
CALA_BASE_URL=                 # Default: https://api.cala.ai
CALA_TIMEOUT_MS=65000          # Timeout para queries

# OpenAI (para síntesis de narrativas)
OPENAI_API_KEY=                # Opcional
OPENAI_MODEL=gpt-4-turbo       # Opcional

# Pioneer (para preguntas potenciales)
PIONEER_API_KEY=               # Opcional
PIONEER_BASE_URL=https://api.pioneer.ai

# Otros
NODE_ENV=development
LOG_LEVEL=info                 # debug, info, warn, error
CASE_SLUG=                     # Manifest a usar (default: más reciente)
```

### Log Level

Controlar verbosidad de logs:
```bash
LOG_LEVEL=debug   # Máximo detalle
LOG_LEVEL=info    # Info normal (default)
LOG_LEVEL=warn    # Solo warnings y errores
LOG_LEVEL=error   # Solo errores
```

## 🎯 Flujo de Datos

```
1. getSeedPayload() → Carga caso semilla desde data/cala/*.json
2. Bandeja.tsx → Usuario query el archivo
3. /api/report → queryDossier() → Cala API (con cache en disco)
4. Dossier llega → pinCandidate() → EntityCard se agrega al tablón
5. Click en ficha → openCard() → /api/entity/:id/introspection
6. Pull hilo → pullRelation() → /api/entity/:id + /api/entity/:id/projection
7. Hilos.tsx renderiza con Manhattan path
```

## 🚀 Build & Deploy

### Development
```bash
npm run dev      # Hot reload
npm run lint     # ESLint
```

### Production
```bash
npm run build    # Build optimizado
npm start        # Server production
```

**Nota:** La demo corre en local con `next dev` (sin Vercel serverless).

## 🎨 UI/UX

### Diseño
- **Grid**: 16px snap (GRID_SIZE en constants.ts)
- **Fuente**: VT323 (pixel art), Silkscreen (display)
- **Colores**: Paleta Earth tones (ver globals.css)
- **Rendering**: CSS `image-rendering: pixelated`

### Componentes Principales
- **Tablon**: Pan + Zoom + Drag fichas + SVG hilos
- **Ficha**: Card con portada (3 slots) + dorso + carpeta
- **Bandeja**: Query box + inbox de resguardos
- **Hilos**: SVG con paths ortogonales (L-shape Manhattan)

## 🔐 Seguridad

- `CALA_API_KEY`: Server-only (nunca en cliente)
- Rate limiting: Reintentos automáticos en 429
- Validación: Todos los endpoints con Zod
- Logging: Estructurado (sin secrets en logs)

## 📊 Performance

- **Cache en disco**: `cacheFirst()` en lib/disk-cache.ts
- **Limpieza automática**: Archivos >30 días se eliminan
- **Zustand persist**: State guarday en localStorage
- **React.memo**: Componentes costosos memoizados
- **Lazy loading**: Componentes pesados con dynamic()

## 🧪 Testing

```bash
# Unit tests (futuro)
npm run test

# E2E tests con Playwright (futuro)
npm run test:e2e
```

## 🤝 Contribuir

1. Crear rama: `git checkout -b feature/nueva-cosa`
2. Commit: `git commit -am "Describe tu cambio"`
3. Push: `git push origin feature/nueva-cosa`
4. Pull Request

## 📝 Cambios Recientes

### v0.2.0
- ✅ Validación con Zod en endpoints API
- ✅ Logging estructurado (lib/logger.ts)
- ✅ Variables de entorno validadas (lib/env.ts)
- ✅ Constantes centralizadas (lib/constants.ts)
- ✅ Normalización centralizada (lib/normalize.ts)
- ✅ Limpieza automática de cache
- ✅ Middleware centralizado de API
- ✅ .env.example + documentación

## 📚 Documentación

- [Next.js 16 Docs](https://nextjs.org/docs)
- [Zustand Docs](https://github.com/pmndrs/zustand)
- [Zod Docs](https://zod.dev)
- [Tailwind CSS v4](https://tailwindcss.com/docs)

## 💡 Troubleshooting

### "CALA_API_KEY no está configurada"
→ Copiar `.env.example` a `.env.local` y rellenar las claves

### Cache corrupto
→ Eliminar `data/cache/` y reiniciar

### Erro validación Zod
→ Verificar que requests al API cumplen schema en `app/api/middleware.ts`

### Logs vacíos
→ Poner `LOG_LEVEL=debug` en `.env.local`

## 📄 Licencia

Privado (en desarrollo)
