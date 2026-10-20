# Formato del cuaderno de estudio

Lectio convierte un **paquete de libro** (Markdown + dos archivos JSON) en una experiencia interactiva: sesiones paso a paso, preguntas con guía de respuestas, repasos espaciados y compromisos. Este documento describe el formato para preparar cuadernos de otros libros sin tocar código. El libro de ejemplo completo está en [`content/fixtures/libro-ejemplo/`](../content/fixtures/libro-ejemplo).

Antes de importar, valida siempre:

```bash
npm run import -- ruta/al/paquete --dry-run
```

El reporte indica qué falta o no cuadra (referencias a secciones inexistentes, preguntas sin respuesta, códigos duplicados…). Un libro con errores no se importa.

## 1. Archivos del paquete

| Archivo                       | Contenido                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `lectio.book.json`            | Manifiesto: título, autor, archivos y parámetros del método.                      |
| `sections.json`               | Índice de secciones del libro impreso: lo que pueden citar las referencias.       |
| `00_guia_del_metodo.md`       | Guía del método (texto libre; la app la muestra tal cual).                        |
| `02_cuaderno_de_estudio.md`   | Partes, capítulos, sesiones y evaluaciones finales.                               |
| `03_guia_de_respuestas.md`    | Respuestas orientativas por código de pregunta.                                   |
| `04_seguimiento_y_repasos.md` | Diario semanal, fichas de repaso, repasos de bloque y evaluación final del libro. |

Los nombres de los Markdown son libres: el manifiesto dice cuál es cuál.

### `lectio.book.json`

```json
{
  "slug": "mi-libro",
  "title": "Título",
  "subtitle": "Subtítulo (opcional)",
  "author": "Autor",
  "edition": "Editorial, año (opcional)",
  "bible": "Reina-Valera 1960 (opcional)",
  "files": {
    "sections": "sections.json",
    "method": "00_guia_del_metodo.md",
    "notebook": "02_cuaderno_de_estudio.md",
    "answers": "03_guia_de_respuestas.md",
    "reviews": "04_seguimiento_y_repasos.md"
  },
  "method": {
    "sessionMinutes": 40,
    "reviewOffsets": [1, 3, 7, 14],
    "defaultStudyDays": ["mon", "wed", "fri"],
    "defaultRestDays": ["sun"],
    "dailyLoadWarningMinutes": 65,
    "scale": { "1": "Todavía no lo comprendo.", "2": "…", "3": "…", "4": "…" },
    "questionTypes": {
      "A": "Comprensión",
      "B": "Razonamiento",
      "C": "Autoexamen",
      "D": "Aplicación"
    }
  },
  "privateChapters": []
}
```

`privateChapters` lista los capítulos que piden confirmar la identidad antes de abrirse y que no muestran su contenido en las vistas previas.

### `sections.json`

```json
{
  "entries": [
    {
      "id": "introduccion",
      "kind": "front",
      "ref": "Introducción",
      "title": "Introducción",
      "level": 0
    },
    {
      "id": "parte-1",
      "kind": "part",
      "ref": "Primera Parte",
      "title": "Primera Parte: …",
      "level": 0
    },
    {
      "id": "c1",
      "kind": "chapter",
      "ref": "Cap. 1",
      "title": "Título del capítulo",
      "level": 0,
      "chapter": 1
    },
    {
      "id": "c1.leer-no-es-aprender",
      "kind": "section",
      "ref": "Cap. 1 › Leer no es aprender",
      "title": "Leer no es aprender",
      "level": 0,
      "chapter": 1
    },
    {
      "id": "apendice-1",
      "kind": "appendix",
      "ref": "Apéndice Uno",
      "title": "Apéndice Uno: …",
      "level": 0
    }
  ]
}
```

- `ref` es exactamente el texto que irá entre `[[…]]`.
- `title` debe coincidir con el encabezado del libro impreso: es lo que el lector busca.
- `level` 1 o 2 marca subsecciones (por ejemplo, puntos numerados dentro de una sección).
- `id` debe ser estable: las páginas que el usuario anota en «Mis páginas» se guardan por `id`.
- `kind`: `front`, `part`, `chapter`, `section`, `appendix` o `back`.

## 2. Referencias al libro

Nunca uses números de página: el lector estudia con su ejemplar impreso. Cita capítulo y sección:

```markdown
Comprueba en [[Cap. 1 › Leer no es aprender]], el ejemplo del examen.
Lee desde el inicio del capítulo hasta antes de [[Cap. 1 › El esfuerzo de recordar]].
Complemento: el [[Apéndice Uno]].
```

La app muestra cada referencia como un _chip_ tocable que dice dónde buscar. Toda referencia debe existir en `sections.json`; si no, la importación falla.

## 3. Estructura del cuaderno (`02`)

```markdown
# Cuaderno de estudio — _Título_ ← título (se ignora)

# Antes de empezar ← material previo, opcional

## Introducción del libro

### Sesión 0 (opcional, 20 minutos)

# PRIMERA PARTE — Nombre de la parte ← PRIMERA, SEGUNDA, TERCERA, CUARTA…

Texto de presentación de la parte.

## Capítulo 1 — Título del capítulo

Texto de presentación del capítulo (opcional).

### Sesión 1.1 — Título de la sesión

**Lectura:** Capítulo 1, desde … · **Secciones:** [[…]] · **Tiempo total:** 40 min

#### Paso 1 · Lectura comprensiva (15 min)

#### Paso 2 · Recuperación activa (5 min) — cierra el libro

#### Paso 3 · Verificación y profundización (5 min) — abre el libro

#### Paso 4 · Autoexamen personal (10 min)

#### Paso 5 · Aplicación práctica (5 min)

#### Cierre de la sesión

### Evaluación final del capítulo 1
```

- Los pasos toman título y minutos de su encabezado: `#### Paso N · Título (X min)`. Puede haber más o menos pasos.
- Si el encabezado termina en «— cierra el libro» o «— sin libro…», la app muestra la pantalla «Cierra el libro» y oculta la guía de lectura.
- El texto entre `### Sesión` y el primer `#### Paso` es la indicación de lectura.

## 4. Convenciones dentro de las sesiones

| Escribes                                                                                          | La app muestra                                                                                     |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `**C1-S1-P1** [A] Pregunta…`                                                                      | Pregunta con su código y tipo (A, B, C o D). Agrega `[Interpretación…]` cuando corresponda.        |
| `Mi respuesta:` o `Mi reflexión personal:` seguido de renglones                                   | Etiqueta del campo de la pregunta anterior.                                                        |
| Un párrafo corto seguido de renglones `______` (líneas propias)                                   | Campo de texto con ese párrafo como etiqueta; su altura sigue la cantidad de renglones.            |
| `- Etiqueta: ______` (renglones en la misma línea)                                                | Campo de una línea.                                                                                |
| `1. ______` `2. ______`                                                                           | Ítems numerados.                                                                                   |
| `- [ ] Afirmación`                                                                                | Checklist.                                                                                         |
| `**Autoevaluación (1–4):** ☐ 1 · ☐ 2 · ☐ 3 · ☐ 4`                                                 | Escala 1–4 con el texto de `method.scale`.                                                         |
| `Marca lo que olvidaste: ☐ a ☐ b ☐ c`                                                             | Casillas independientes.                                                                           |
| `Ideas basadas en esta sección…` + lista                                                          | Ideas que el usuario puede elegir como acción.                                                     |
| `**Mi compromiso práctico:**` + lista de campos, luego `**Qué aprendí al aplicarlo**` + renglones | Formulario de compromiso con fecha; se sigue en «Compromisos».                                     |
| `Dónde comprobar:` + `- C1-S1-P1 → [[…]], detalle`                                                | En el paso de verificación, cada pregunta con tu respuesta, dónde comprobar y el botón «Ver guía». |
| `**Antes de avanzar:** …` (en el cierre)                                                          | Indicación que se resalta si la autoevaluación es 1 o 2.                                           |
| `> Nota`                                                                                          | Recuadro. Si menciona seguridad o salud se resalta; «Complemento opcional» se muestra discreto.    |
| Tabla con celdas vacías                                                                           | Formulario: una tarjeta por fila en el celular.                                                    |

Los códigos siguen el patrón `C<capítulo>-S<sesión>-P<pregunta>`, `C<capítulo>-EF-<n>` (evaluación final) y `C0-P<n>` (Sesión 0). Deben ser únicos: son la clave con la que se guardan las respuestas, así que **no los cambies** entre versiones de un libro ya en uso.

## 5. Guía de respuestas (`03`)

```markdown
## Capítulo 1 — Título

### Sesión 1.1

#### C1-S1-P1 — Título breve

- **Referencia:** [[Cap. 1 › …]].
- **Lo que dice el texto:** …
- **Interpretación:** … (solo si la pregunta pide inferir)
- **Una respuesta satisfactoria incluye:** …

### Capítulo 1 — Evaluación final

#### C1-EF-1

- **Referencia:** [[Cap. 1 › …]].
- **Respuesta orientativa:** …
- **Una respuesta satisfactoria incluye:** …

### Orientación para el autoexamen y la aplicación (capítulo 1)

Texto para contrastar las preguntas personales (C y D).
```

- Toda pregunta A, B y de evaluación final debería tener respuesta (si no, el reporte avisa).
- `- **Pendiente:** …` marca una respuesta que espera contenido del libro; la app la muestra destacada.
- Cualquier otro ítem con etiqueta en negrita se muestra con su etiqueta.

## 6. Repasos (`04`)

```markdown
## Registro semanal

- Lo más importante que aprendí: ______

## Fichas de repaso por capítulo

### Capítulo 1 — Título

**Día +1 (5 min, sin mirar nada).** Escribe: …

---

**Día +3 (10 min).** Responde de nuevo: C1-S1-P1 y C1-S2-P1. …
**Día +7 (2 min en voz alta).** Explica… Marca lo que olvidaste: ☐ a ☐ b
**Día +14 (10 min).** …

- Calificación actual del capítulo (1–4): ☐ 1 · ☐ 2 · ☐ 3 · ☐ 4

---

## Repasos de bloque

### Repaso de bloque 1 — Primera Parte: Nombre (capítulos 1 a 6)

**1.** Pregunta…

---

## Evaluación final del libro

### A. Recuperación (sin consultar nada)

…
```

- El día +3 vuelve a mostrar las preguntas citadas por código, en blanco, y la guía se desbloquea con la nueva respuesta.
- El día +7 tiene un temporizador con los minutos indicados en el encabezado.
- Los repasos se programan solos desde el día en que el usuario termina la última sesión de cada capítulo (`method.reviewOffsets`), evitando sus días de descanso. El repaso de bloque se programa al terminar la parte, y la evaluación final al terminar el libro.

## 7. Actualizar un libro en uso

Corrige los Markdown y vuelve a importar (CLI o Administración → Libros). Las respuestas de los usuarios se conservan mientras no cambien los códigos de pregunta ni las etiquetas de los campos de texto (la clave de un campo se forma con la unidad, el paso y su etiqueta).
