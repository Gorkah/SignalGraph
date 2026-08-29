# Agente de caso — instrucciones y contrato

Convierte una pregunta sobre el grafo de Cala en un **manifiesto de caso**: el
fichero que configura el tablón de investigación. Estas instrucciones valen
igual ejecutadas por código (`scripts/build-case.mjs`) o por una persona con un
agente; el contrato de salida es el mismo.

## Qué es el tablón

Un corcho de detective. La gramática, de la que no te puedes salir:

- **El caso** manda en el centro: una pregunta, y más tarde su respuesta.
- **Las fichas** del anillo son las entidades protagonistas de la pregunta.
- **Cada ficha tiene una cartera cerrada**: un mazo que promete N cosas. Abrirla
  tira del hilo y trae **pistas**, fichas en densidad mínima.
- **Un hilo** une dos fichas. No lleva flecha: la dirección que da Cala no es
  fiable, así que se nombra con un sustantivo simétrico ("inversión", no
  "invirtió en").
- **El hallazgo** ocurre cuando una pista que cae de una cartera **ya estaba en
  el tablón** por otra. Ese cruce es la razón de existir de la aplicación.
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
3. **El hallazgo esperado**: qué cruce va a aparecer y entre qué fichas, para
   que quien presente sepa qué carteras abrir.

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
- `ring` — las fichas protagonistas, con rol y un subtítulo de una línea.
- `bridges` — los cruces que esperás, con los nombres de quién los sostiene.
- `cover` — los tres datos que lleva en portada una ficha **de este caso**. No
  hay una respuesta universal: en un caso de fondos puede ser sede y volumen;
  en uno de fundadores, rol y empresa; en uno de leyes, jurisdicción y fecha.
  Elegí lo que de verdad distingue una ficha de otra aquí, y decí qué poner
  cuando el dato falte.
- `back` — qué se lee al voltear la ficha, que es donde vive el relato largo.
- `headline` — de todos los cruces, cuál es **el** de la demo y por qué.
- `nouns` — un sustantivo por **cada** tipo de relación que hayas visto, no solo
  el de abrir. Los que falten salen en crudo en pantalla, con su nombre de
  base de datos a la vista.
- `finding` — cómo se redacta el hallazgo en la tarjeta y en el aviso.
- `questions` — hasta dos preguntas posteriores: `archive` puede materializar
  entidades; `web` solo contextualiza. Nunca devuelvas coordenadas.
- `notes` — lo que aprendiste y no cabe en el resto: falsos positivos que
  descartaste, entidades dudosas, por qué dejaste algo fuera.
