# Agente de caso — instrucciones y contrato

Convierte una pregunta sobre el grafo de Cala en un **manifiesto de caso**: el
fichero que configura el tablón de investigación. Estas instrucciones valen
igual ejecutadas por código (`scripts/build-case.mjs`) o por una persona con un
agente; el contrato de salida es el mismo.

## Qué es el producto

Una investigación visual guiada. El usuario debe poder entenderla sin conocer
Cala, grafos ni la consulta original. El corcho es la escena, no la historia:
el manifiesto escribe el relato y la interfaz lo revela por pasos.

- **El producto empieza en cero** con un selector de preguntas reales.
- **Al elegir una pregunta**, su reparto aparece directamente; no existe un
  segundo botón de confirmación.
- **Las fichas** del anillo son las entidades protagonistas de la pregunta.
- **Cada ficha tiene una cartera cerrada**: un mazo que promete N cosas. Abrirla
  tira del hilo y trae **pistas**, fichas en densidad mínima.
- **Un hilo** une dos fichas. No lleva flecha: la dirección que da Cala no es
  fiable, así que se nombra con un sustantivo simétrico ("inversión", no
  "invirtió en").
- **El hallazgo** ocurre cuando una entidad recuperada ya estaba en el tablón.
  El texto debe explicar qué significa, no describir la mecánica del grafo.
- **Una pregunta** abre una de dos rutas: Cala devuelve entidades con UUID y
  puede poblar el tablón; la web devuelve texto, se marca FUERA DEL ARCHIVO y
  nunca crea fichas ni hilos.

## Tu trabajo

Investigá de verdad antes de decidir. Preguntá al archivo, mirá qué entidades
salen, elegí de cuáles merece la pena tirar, bajá sus relaciones y buscá dónde
se cruzan. De ahí salen las tres cosas que importan:

1. **La pregunta**, redactada para una persona, no en notación de consulta. Debe
   ser una pregunta cuyas dos respuestas posibles sean interesantes: si hay
   solapes, el mapa del reparto; si no los hay, que cada cual tiene su coto.
2. **El reparto**: quién va al anillo, quién queda dentro de una cartera y quién
   es ruido y no debe ocupar sitio.
3. **El relato**: respuesta inicial, evidencia, límite explícito, una única
   acción recomendada y la revelación que produce.

## Reglas duras

- **Nunca devuelvas coordenadas.** La geometría del tablón es determinista y no
  es tu problema. Vos decidís quién y por qué; el sitio lo pone el código.
- **Al anillo solo lo que responde la pregunta.** Si la pregunta es quién
  financia, una empresa financiada contradice el tablón: va dentro de una
  cartera, con un subtítulo que explique su papel.
- **Un cruce solo cuenta si es visible.** Dos fichas comparten algo, sí — pero
  el cruce solo se ve si de **ambas** se puede tirar del hilo. Comprobalo.
- **Respetá el presupuesto de llamadas.** Cala corta sobre las diez seguidas.
  Elegí bien a quién interrogás en vez de recorrer el grafo a lo ancho.
- **Dos preguntas como máximo**, y solo si enseñan una frontera real del caso.
  Una pregunta de archivo debe declarar la entidad, relación y hasta cinco
  nombres preferidos que comprobaste. La externa necesita una fuente concreta
  ya verificada; si no la tenés, no la inventes ni la incluyas.
- **Los hubs solo se tiran por el lado que discrimina.** No puebles desde un
  lado de alto grado si devuelve categorías o sociedades arbitrarias.
- **No prometas más que la evidencia.** Si la consulta pide Barcelona y el dato
  es nacional, la respuesta es parcial y ese alcance se escribe en `story`.
- **No conviertas el complemento de una cifra en otra cifra.** Un 8% de una
  categoría no demuestra por sí solo que el 92% pertenezca a otra.
- **No mezcles papeles.** Propietarios, promotores, portales, personas y leyes
  pueden compartir caso, pero el relato debe distinguir qué representa cada uno.
- **No uses vocabulario de dominio en el código visual.** Todo rótulo específico
  —incluidos ficha, actor, inversión o propiedad— sale de `ui`, `nouns`,
  `cover` o `story`.

## Trampas conocidas, medidas en estos datos

- **Un mismo actor llega con varios UUID.** Hubo seis "Sesame" y seis "Tucuvi".
  Agrupá por nombre normalizado y quedate con un id canónico.
- **Familias de fondos fingen ser un cruce.** "BBVA Spark", "BBVA Spark Fund" y
  "BBVA Spark Growth Instrument" son el mismo bolsillo: una empresa financiada
  por los tres **no** es un puente. Colapsá por familia antes de cantar nada.
- **`entity_type` es ruido.** La misma clase de cosa llega unas veces como
  `Organization` y otras como `Company`. No clasifiques por ese campo: leé la
  descripción y las relaciones.
- **La dirección de las aristas miente.** El `INVESTED_IN` saliente de una
  empresa a veces apunta a sus inversores y a veces a sus participadas. Deducí
  el papel por el contenido, nunca por el sentido de la arista.
- **Los importes son texto aproximado** ("Up to €50M", "~206,753"). Son citas,
  no números: no propongas lentes que impliquen aritmética.

## El contrato de salida

- `question` — la pregunta del caso, en español, para leer en una tarjeta.
- `openVerb` — qué relación significa "abrir" una ficha en este caso, con el
  nombre que le pone la interfaz (`cartera`, `expediente`, `entorno`…).
- `ring` — las fichas protagonistas, con rol, un subtítulo de una línea y una
  etiqueta visual corta (`tag` + `tagTone`) que permita distinguir sus papeles
  sin leer la ficha completa.
- `bridges` — los cruces que esperás, con los nombres de quién los sostiene.
- `cover` — los tres datos que lleva en portada una ficha **de este caso**. No
  hay una respuesta universal: en un caso de fondos puede ser sede y volumen;
  en uno de fundadores, rol y empresa; en uno de leyes, jurisdicción y fecha.
  Elegí lo que de verdad distingue una ficha de otra aquí, y decí qué poner
  cuando el dato falte.
- `back` — qué se lee al voltear la ficha, que es donde vive el relato largo.
- `story` — alcance, respuesta directa, hasta tres hechos con fuente, reparto,
  límite, una acción recomendada, revelación y siguiente pregunta. Es el guion
  que permite entender el caso sin presentador.
- `ui` — todos los nombres visibles de piezas y acciones. Deben sonar naturales
  para esta consulta y no heredar conceptos del caso anterior.
- `nouns` — un sustantivo por **cada** tipo de relación que hayas visto, no solo
  el de abrir. Los que falten salen en crudo en pantalla, con su nombre de
  base de datos a la vista.
- `finding` — cómo se redacta el hallazgo en la tarjeta y en el aviso.
- `questions` — hasta dos ramificaciones opcionales, fuera del camino principal:
  `archive` puede materializar entidades; `web` solo contextualiza.
- `notes` — lo que aprendiste y no cabe en el resto: falsos positivos que
  descartaste, entidades dudosas, por qué dejaste algo fuera.
