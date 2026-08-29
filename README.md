# SignalGraph

SignalGraph convierte una investigación sobre entidades en un grafo navegable. Consulta datos de Cala, genera respuestas narrativas con OpenAI y permite continuar la historia mediante preguntas sugeridas y la tecla `Tab`.

## Requisitos

- Node.js 18 o superior
- npm
- Una API key de Cala
- Una API key de OpenAI o, como alternativa, de Pioneer

## Instalación

```bash
git clone <url-del-repositorio>
cd SignalGraph
npm install
cp .env.example .env.local
```

Edita `.env.local` con tus credenciales y arranca el servidor:

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

> No subas nunca `.env`, `.env.local` ni claves API al repositorio. Si una clave se ha compartido accidentalmente, revócala y genera otra.

## Variables de entorno

### Cala

```dotenv
CALA_API_KEY=
CALA_API_URL=https://api.cala.ai/v1/knowledge/query
CALA_ENTITY_URL=https://api.cala.ai/v1/entities
CALA_LIVE=true
CALA_TIMEOUT_MS=180000
```

`CALA_LIVE=true` activa las consultas remotas. Si se desactiva o no hay credenciales, la aplicación puede utilizar los datos locales disponibles en `data/`.

### OpenAI

```dotenv
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-5-mini
OPENAI_TIMEOUT_MS=60000
```

La aplicación utiliza la Responses API de OpenAI para producir JSON estructurado: respuesta, confianza, si la pregunta merece continuar y la siguiente pregunta sugerida.

### Pioneer como alternativa

```dotenv
PIONEER_API_KEY=
PIONEER_BASE_URL=
PIONEER_MODEL=
PROVIDER_TIMEOUT_MS=60000
```

Cuando no está disponible OpenAI, `lib/model-json.ts` intenta usar Pioneer con una interfaz compatible de chat completions. Si se configuran ambos proveedores, OpenAI tiene prioridad.

### Casos y scripts

```dotenv
CASE_SLUG=
CASE_MODEL=
CASE_BUDGET=
CASE_STEPS=
CASE_EFFORT=
```

`CASE_SLUG` permite seleccionar un caso concreto de `data/cases`. Si está vacío, se carga el caso más reciente.

## Flujo de uso

1. Escribe una consulta concreta en la bandeja, por ejemplo: `investors.location=Spain.sector=fintech`.
2. Pulsa **Abrir caso nuevo** o **Solo pedir dossier**.
3. Cala devuelve el dossier y las entidades relacionadas.
4. OpenAI genera una respuesta narrativa para el nodo actual.
5. Si hay una continuación valiosa, aparece una pregunta en gris claro como borrador.
6. Pulsa `Tab` para aceptar automáticamente la pregunta, consultar el siguiente nodo y continuar la investigación.
7. Usa **Compartir nodo** para descargar un PNG con el nodo actual y el recorrido de la investigación hasta llegar a él.

## Ejemplo de storytelling

Una secuencia que funciona bien para contar la historia de un fondo es:

```text
¿Qué mandato, tamaño, etapa y geografía tenía Leadwind, y qué entidades participaron en el fondo?
```

Después:

```text
¿Qué porcentaje de la inversión total aportó Telefónica a Leadwind y cómo se relaciona con el resto de inversores?
```

Y luego:

```text
¿Qué monto aportó BBVA dentro de ese 30% restante de Leadwind?
```

Las preguntas funcionan mejor cuando contienen una entidad y una relación medible: porcentaje, monto, fecha, etapa, sector o geografía. Una pregunta genérica como “¿por qué existe este problema?” puede no encontrar entidades suficientes en Cala; conviene anclarla primero a una empresa, fondo o inversión.

## Arquitectura

```text
Consulta del usuario
        ↓
      Cala ──→ dossier y entidades
        ↓
   OpenAI / Pioneer ──→ respuesta JSON + siguiente pregunta
        ↓
   nodo del grafo ──→ Tab ──→ siguiente nodo
        ↓
     PNG compartible con el historial
```

Las rutas principales son:

- `POST /api/report`: obtiene o construye el dossier inicial.
- `POST /api/story`: genera una respuesta narrativa y la siguiente pregunta.
- `POST /api/pioneer/question`: genera preguntas potenciales en formato JSON.
- `GET /api/entity/[id]`: carga una entidad y sus relaciones.
- `GET /api/entity/[id]/introspection`: amplía la información de una entidad.

## Estructura del proyecto

```text
app/                 Aplicación Next.js y rutas API
components/          Bandeja, grafo, nodos, preguntas y respuestas
lib/                 Cala, modelos, storytelling, caché y estado de casos
data/cala/           Respuestas y dossiers locales de Cala
data/cases/          Casos narrativos generados
data/relations/      Relaciones locales entre entidades
scripts/              Utilidades para consultar Cala y crear casos
```

## Scripts disponibles

```bash
npm run dev          # servidor de desarrollo
npm run build        # build de producción
npm run start        # servidor de producción
npm run lint         # ESLint
npm run type-check   # TypeScript sin emitir archivos
```

Para consultar Cala desde la terminal:

```bash
node --env-file=.env scripts/cala-query.mjs "startups.location=Spain.funding>10M"
```

También acepta un fichero de consultas:

```bash
node --env-file=.env scripts/cala-query.mjs --file queries.txt --concurrency 3
```

Para generar un caso narrativo experimental:

```bash
node --env-file=.env scripts/build-case.mjs "investors.location=Spain.sector=fintech"
```

## Datos locales y caché

Las respuestas de Cala y los casos generados se guardan en `data/`. El navegador conserva el caso activo y las preguntas sugeridas en `localStorage`, por lo que un refresco no debería sustituir una investigación iniciada por el usuario con el caso de ejemplo.

Si cambias la consulta o las credenciales y ves datos antiguos, elimina los archivos generados de `data/cache` y vuelve a cargar la aplicación.

## Verificación local

Antes de integrar cambios, ejecuta:

```bash
npm run lint
npm run type-check
npm run build
```

El repositorio no incluye actualmente una suite automatizada de tests; la validación principal combina estos comandos con una prueba manual del flujo de investigación, `Tab` y descarga del PNG.

## Referencias

- [OpenAI Responses API](https://developers.openai.com/api/reference/cli/resources/responses/methods/create)
- [Next.js](https://nextjs.org/docs)

## Estado

Proyecto de prototipo para investigación narrativa y exploración de grafos. La integración con proveedores externos depende de sus credenciales y de la disponibilidad de sus APIs.
