# SignalGraph — Plan de demo

**Qué es:** un tablón de investigación sobre el grafo de Cala AI. El tablón lleva topología (quién con quién); la carpeta lleva sustancia (qué es, con fuentes). Estética pixel sobre rejilla: snapping y ruteo ortogonal, circuitería intencionada, nunca bola de pelo.

**Regla de recorte:** solo entra lo que alimenta uno de los cuatro beats. Todo lo demás está en "Cortado" al final y no se discute a mitad de hackathon.

---

## Los cuatro beats (la demo entera, ~3 min)

| # | Beat | Qué se ve | Llamadas en vivo |
|---|------|-----------|------------------|
| 1 | **El confidente** | Query fría disparada al empezar el pitch; el dossier llega a la bandeja durante la demo | 1 lenta (con red de seguridad, ver abajo) |
| 2 | **El tirón de hilo** | Agarrar un cabo (`INVESTED_IN` de un inversor rico) → 8 chinchetas aterrizan en la rejilla una a una, hilos ortogonales, tablón limpio | 1 proyección |
| 3 | **El ascenso** | Chincheta → ficha: se abre la carpeta con fuentes y fechas por campo; se reclutan 1-2 relaciones al tablón | 1 introspección + 1 proyección |
| 4 | **El selector global** | "Mismo tablón: enséñame el dinero… ahora lo último" — toda la superficie se relee de golpe | 0 |

**Guion escénico:** 0:00 disparar query en vivo ("le he pedido esto al archivo") → resguardo con timer en la esquina. 0:15 tablón semilla ya montado, explicar fichas y cabos con número. 0:45 beat 2. 1:15 beat 3. 2:00 beat 4. 2:30 atender el dossier del beat 1 (haya llegado cuando haya llegado), abrir, pinear una candidata que ya está en el tablón → badge de dedup. Cierre.

---

## Presupuesto de llamadas (rate limit: 429 tras ~10 seguidas)

**Principio: el ensayo paga, la demo cobra.** Todo proxy es cache-first contra disco (`data/cache/`). El ensayo puebla el caché; el día de la demo el camino feliz cuesta **0-1 llamadas reales** (solo la query lenta del beat 1, si el caché del servidor ha expirado). El presupuesto de ~10 se reserva entero para improvisar ante preguntas del jurado.

| Beat | 1ª vez (ensayo) | Día de demo (caché de disco poblado) |
|------|-----------------|--------------------------------------|
| 1 | 1 lenta (54-74 s) | 0-1 (ver red de seguridad) |
| 2 | 1 proyección | 0 |
| 3 | 1 introspección + 1 proyección | 0 |
| 4 | 0 | 0 |
| Improvisación | — | ~8 disponibles |

Reglas duras:
- **Chincheta = render puro, cero llamadas.** La introspección ocurre solo al ascender a ficha. Un tirón = una llamada.
- **429 → esperar 2 s → 1 reintento → si falla, toast "archivo saturado"**. La UI nunca rompe ni se queda colgada.
- Jamás repetir una llamada ya cacheada: la clave de caché es `hash(id + proyección)` / `hash(query)`.
- Con el caché poblado, la demo entera sobrevive en **modo avión** (salvo el teatro del beat 1, que tiene fallback).

---

## Red de seguridad del beat 1

La query del beat 1 (elegir en el ensayo una cuyas entidades solapen con el tablón semilla; candidata: una nueva vía `npm run cala`) se ejecuta **días antes** con el runner y su dossier queda guardado en `data/cala/`. En vivo se dispara de verdad. Tres desenlaces, los tres indistinguibles en pantalla:

1. **Caché del servidor vivo** (medido: 0.8 s en repetición) → llega casi al instante. Se adapta la narración ("el archivo ya conocía esta pregunta").
2. **Caché expirado** → 54-74 s → llega a mitad de demo. El teatro ideal.
3. **Red mal o >90 s** → un temporizador en cliente entrega el dossier local guardado con **la misma animación de llegada**. No se nota.

Además: **hotkey oculta (`d`)** que fuerza la entrega del dossier local al instante, por si hay que comprimir tiempo en escena. El TTL del caché del servidor es desconocido: no depender de él, solo aprovecharlo si aparece.

---

## Arquitectura mínima

```
lib/
  types.ts          Ficha, Chincheta, Hilo, Dossier, Caso
  cala.ts           cliente server-side: query/introspect/project + caché disco + backoff 429
  seed.ts           parsea data/cala/*.json → caso semilla
  fields.ts         mapeador de "dato visible" (heurísticas, ver selector)
  store.ts          zustand: { caso, selector, bandeja } + autosave a localStorage
app/
  page.tsx          el tablón (client component)
  api/report/route.ts               POST → query lenta (cliente con timeout 120 s)
  api/entity/[id]/route.ts          POST → proyección
  api/entity/[id]/introspection/route.ts  GET
components/
  Tablon.tsx        pan (drag de fondo), rejilla 16 px, drop con snap
  Ficha.tsx         nombre, tipo, dato visible, cabos con contador
  Chincheta.tsx     cuadrado 12 px + etiqueta corta
  Hilos.tsx         overlay SVG, polilíneas Manhattan, color por tipo de relación
  Carpeta.tsx       panel lateral: campos con fuentes/fechas + checklist "subir al tablón"
  Bandeja.tsx       resguardos con timer, dossieres, abanico de candidatas
  Selector.tsx      barra: descripción | dinero | ciudad | lo último
```

Notas técnicas que ya están verificadas contra este repo (no descubrirlas de nuevo):
- **Next 16**: route handlers en `app/api/*/route.ts`; en rutas dinámicas `params` es `Promise` → `const { id } = await params`. Docs en `node_modules/next/dist/docs/`.
- La demo corre en **local con `next dev`** — sin timeouts serverless para la query lenta. No se despliega.
- `CALA_API_KEY` solo server-side (nunca `NEXT_PUBLIC`). El runner ya funciona: `npm run cala -- --file queries.txt`.
- Datos ya cacheados: 6 dossieres, 112 entidades únicas, con solape real (Bnext, TaxDown, K-Fund, BBVA Spark Fund aparecen en ≥2 dossieres → la dedup por UUID lucirá).
- Endpoints rápidos medidos a 0.7-1.2 s. La dirección de las aristas no es fiable: hilos **sin flechas**; dirección y fuente, al hover.

Decisiones de UI cerradas (no reabrir):
- Rejilla 16 px, snap con `Math.round(x/16)*16`. Colocación de chinchetas: anillo alrededor del padre, escalonadas ~60 ms al aterrizar.
- Hilos ortogonales en L (punto medio). Etiqueta solo al hover. Color por tipo de relación; categorías (`FINTECH`…) **nunca son fichas**: color de borde.
- Límite de tirón **fijo en 8** + "tirar más" en el cabo. Nada de mapear arrastre a limit.
- Selector: el dato visible se elige globalmente. Por defecto **descripción/focus** (homogéneo). Opciones: dinero (regex €/$/M sobre el texto crudo — los números son citas, no se parsean ni grafican), ciudad, "lo último" (claim con fecha más reciente + su fecha).
- Pixel skin: `image-rendering: pixelated`, fuente pixel vía `next/font/google` (Silkscreen o VT323), bordes 2 px, paleta de ~8 colores, sombras duras. Tokens en `globals.css` con `@theme` (Tailwind v4).

---

## Orden de trabajo

Cada bloque tiene una puerta: si se cumple, el beat correspondiente ya es demoable. Construir en este orden exacto — los beats 2 y 4 quedan cubiertos antes de la mitad.

- [x] **B0 (~30 min) — Semilla.** `types.ts` + `seed.ts`: parsear `data/cala/` a un caso con 6-8 fichas elegidas a mano (que incluyan un inversor rico tipo DN Capital/EIB) y sus hilos. *Puerta: el tablón tiene qué pintar sin tocar la API.*
- [x] **B1 (~2-3 h) — Tablón tonto.** Pan, rejilla, fichas arrastrables con snap, overlay SVG con hilos ortogonales. Sin API. *Puerta: se puede enseñar un tablón limpio con datos reales.*
- [x] **B2 (~1 h) — Selector global.** `fields.ts` + barra. **Beat 4 hecho.**
- [ ] **B3 (~2-3 h) — El tirón.** Proxy de proyección con caché de disco, cabos en las fichas (contadores desde introspección del seed), tirón → chinchetas aterrizan escalonadas, dedup por UUID (si el id ya está en el tablón: hilo hacia la ficha existente + badge, nunca duplicar). **Beat 2 hecho — es el momento que tiene que ser impecable: sin un frame de duda.**
  - Implementación terminada (caché, límite 8, stagger, dedup y fallback local). Pendiente poblar una proyección real de 8: los datos guardados solo demuestran 2 destinos para `K-Fund / INVESTED_IN`; no se inventan los otros 6.
- [x] **B4 (~1-2 h) — Ascenso y carpeta.** Chincheta → ficha (introspección al ascender), carpeta con campos+fuentes+fechas y checklist de relaciones "subir al tablón". **Beat 3 hecho.**
- [x] **B5 (~1-2 h) — El confidente.** `api/report` + bandeja + resguardo con timer + fallback 90 s + hotkey `d`. Dossier → abanico de candidatas → pinear. **Beat 1 hecho.**
- [x] **B6 (~1-2 h) — Pixel skin.** La pasada estética: fuente, paleta, animación de aterrizaje. No empezar antes de que los 4 beats funcionen en feo.
- [ ] **B7 (~1 h) — Ensayo.** Precalentar la query del beat 1 con el runner; recorrer el guion completo **dos veces: con red y en modo avión**; elegir el cabo del beat 2 (el aterrizaje más rico y limpio) y la candidata del cierre (una que ya esté en el tablón). Anotar en este fichero query y cabo elegidos.

### Selecciones para el ensayo

- **Beat 1:** `startups.location=Spain.sector=fintech` (67 s en la captura fría; solapa por UUID con Bnext).
- **Beat 2 provisional:** `K-Fund / INVESTED_IN` (Voicemod y Tucuvi están demostrados en el caché local; reemplazar por la proyección real más rica cuando se conozca el contrato del endpoint).
- **Cierre:** Bnext, UUID `eb86df55-d9fb-41bc-8104-ad6a892dc7ec`, ya presente en el tablón para enseñar dedup.

### Si va justo de tiempo (cortar en este orden)

1. **Sin dolor:** hover-leyenda para aislar tipo de hilo; zoom (basta pan); animaciones extra; badge de dedup (el hilo cruzado ya cuenta la historia).
2. **Duele poco:** la carpeta se reduce a lista de fuentes + un botón "subir INVESTED_IN" (sin checklist); chinchetas sin etiqueta visible (solo hover).
3. **Último recurso:** el beat 1 se sirve entero desde el dossier local (sin llamada en vivo). Se pierde teatro, no funcionalidad; el guion no cambia.
4. **Nunca se corta:** B1 + B3 (el tirón sobre rejilla) y B2 (el selector). Son los beats 2 y 4 — sin ellos no hay demo.

### Listo sí o sí antes de subir al escenario

- [ ] Los 4 beats recorren el guion sin tocar la red (modo avión, caché de disco poblado).
- [ ] Query del beat 1 precalentada y su dossier guardado en local; fallback 90 s y hotkey `d` probados.
- [ ] El tirón ensayado sobre un cabo concreto, elegido y anotado.
- [ ] 429 provocado a propósito una vez para ver el toast (no la excepción).
- [ ] Autosave a localStorage funcionando: un refresh accidental en escena no borra el tablón.

---

## Cortado (decidido; no reabrir durante la hackathon)

Diff de dos carpetas · zonas del tablero por categoría · plegado de ramas ("recoger el hilo": seleccionar y despinchar cumple) · arrastre mapeado a limit · archivo entre casos y "visto antes en" · anotaciones manuales · sonido · deploy · móvil. El reencuentro emergente no es narrativa: queda como infraestructura (dedup por UUID) y, si el ensayo encuentra uno real en el camino cacheado, se ensaya como remate — nunca se improvisa.
