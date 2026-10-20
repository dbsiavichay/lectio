import type { Heading, RootContent } from "mdast";

import type { Block, Chapter, Evaluation, Part, Session, Step, Unit } from "../schema";
import { KeyRegistry, toBlocks } from "./blocks";
import { boldLead, isParagraph, parseMarkdown, plain, sliceMd, stripBoldLead } from "./mdast";

const ORDINALS: Record<string, number> = {
  PRIMERA: 1,
  SEGUNDA: 2,
  TERCERA: 3,
  CUARTA: 4,
  QUINTA: 5,
  SEXTA: 6,
};

export type NotebookResult = {
  front: { title: string; intro: Block[]; units: string[] } | null;
  parts: Part[];
  chapters: Omit<Chapter, "private">[];
  units: Record<string, Unit>;
  problems: string[];
};

type Group = { heading: Heading; nodes: RootContent[] };

/** Splits nodes at headings of the given depth; nodes before the first one are the intro. */
function splitAt(nodes: RootContent[], depth: number): { intro: RootContent[]; groups: Group[] } {
  const intro: RootContent[] = [];
  const groups: Group[] = [];
  for (const node of nodes) {
    if (node.type === "heading" && node.depth === depth) groups.push({ heading: node, nodes: [] });
    else if (node.type === "heading" && node.depth < depth)
      throw new Error("splitAt: encabezado de nivel superior");
    else (groups.at(-1)?.nodes ?? intro).push(node);
  }
  return { intro, groups };
}

/**
 * Parses the study notebook: `# PARTE` → `## Capítulo` → `### Sesión` or
 * `### Evaluación final` → `#### Paso N · Título (X min)` and `#### Cierre`.
 * Titles and minutes come from the headings themselves, so a session with
 * different steps (the Session 0, an integration session) needs no code.
 */
export function parseNotebook(
  src: string,
  keys: KeyRegistry,
  duplicateCodes: string[],
): NotebookResult {
  const tree = parseMarkdown(src);
  const problems: string[] = [];
  const parts: Part[] = [];
  const chapters: Omit<Chapter, "private">[] = [];
  const units: Record<string, Unit> = {};
  let front: NotebookResult["front"] = null;

  // Top level: "# Antes de empezar", "# PRIMERA PARTE — …". The document title is ignored.
  const top = splitAt(tree.children, 1);
  for (const group of top.groups) {
    const title = plain(group.heading);
    const partMatch = title.match(/^(\w+) PARTE\s*—\s*(.+)$/);
    const level2 = splitAt(group.nodes, 2);

    if (!partMatch) {
      // Front matter: its chapters hold optional sessions (the Session 0).
      for (const ch of level2.groups) {
        const chapterTitle = plain(ch.heading);
        const { intro, unitIds } = parseChapterBody(
          ch.nodes,
          0,
          src,
          keys,
          units,
          problems,
          duplicateCodes,
        );
        // "Sesión 0 (opcional, 20 minutos)" has no title of its own: it studies the front matter.
        for (const id of unitIds) {
          const unit = units[id];
          if (unit?.kind === "session" && /^Sesión /.test(unit.title)) unit.title = chapterTitle;
        }
        front = { title: chapterTitle, intro, units: unitIds };
      }
      continue;
    }

    const n = ORDINALS[partMatch[1]!.toUpperCase()];
    if (!n) {
      problems.push(`Parte sin número reconocible: «${title}»`);
      continue;
    }
    const part: Part = {
      n,
      title: partMatch[2]!.trim(),
      intro: toBlocks(level2.intro, { src, prefix: `part${n}`, keys }),
      chapters: [],
    };
    parts.push(part);

    for (const ch of level2.groups) {
      const m = plain(ch.heading).match(/^Capítulo (\d+)\s*—\s*(.+)$/);
      if (!m) {
        problems.push(`Encabezado de capítulo no reconocido: «${plain(ch.heading)}»`);
        continue;
      }
      const chapterN = Number(m[1]);
      const { intro, unitIds } = parseChapterBody(
        ch.nodes,
        chapterN,
        src,
        keys,
        units,
        problems,
        duplicateCodes,
      );
      chapters.push({ n: chapterN, title: m[2]!.trim(), part: n, intro, units: unitIds });
      part.chapters.push(chapterN);
    }
  }

  return { front, parts, chapters, units, problems };
}

function parseChapterBody(
  nodes: RootContent[],
  chapter: number,
  src: string,
  keys: KeyRegistry,
  units: Record<string, Unit>,
  problems: string[],
  duplicateCodes: string[],
) {
  const level3 = splitAt(nodes, 3);
  const intro = toBlocks(level3.intro, { src, prefix: `c${chapter}`, keys });
  const unitIds: string[] = [];

  for (const g of level3.groups) {
    const title = plain(g.heading);
    const session = title.match(/^Sesión (\d+(?:\.\d+)?)\s*(?:—\s*(.+)|\((.+)\))?$/);
    const evaluation = title.match(/^Evaluación final del capítulo (\d+)/);

    if (session) {
      const number = session[1]!;
      const id = `s${number}`;
      const parsed = parseSession(
        g.nodes,
        id,
        chapter,
        number,
        session[2]?.trim() ?? title,
        session[3],
        src,
        keys,
        duplicateCodes,
      );
      if (units[id]) problems.push(`Sesión duplicada: ${id}`);
      units[id] = parsed;
      unitIds.push(id);
    } else if (evaluation) {
      const id = `ef${evaluation[1]}`;
      const unit: Evaluation = {
        kind: "evaluation",
        id,
        chapter,
        title: `Evaluación final del capítulo ${evaluation[1]}`,
        blocks: toBlocks(g.nodes, { src, prefix: id, keys, unitId: id, duplicateCodes }),
      };
      units[id] = unit;
      unitIds.push(id);
    } else {
      problems.push(`Encabezado de nivel 3 no reconocido en el capítulo ${chapter}: «${title}»`);
    }
  }
  return { intro, unitIds };
}

function parseSession(
  nodes: RootContent[],
  id: string,
  chapter: number,
  number: string,
  title: string,
  parenthetical: string | undefined,
  src: string,
  keys: KeyRegistry,
  duplicateCodes: string[],
): Session {
  const level4 = splitAt(nodes, 4);
  const steps: Step[] = [];
  let closing: Session["closing"] = null;

  for (const g of level4.groups) {
    const heading = plain(g.heading);
    const step = heading.match(/^Paso (\d+)\s*·\s*(.+?)\s*\((\d+)\s*min\)\s*(?:—\s*(.+))?$/);
    if (step) {
      const n = Number(step[1]);
      const note = step[4] ?? "";
      steps.push({
        n,
        title: step[2]!.trim(),
        minutes: Number(step[3]),
        closedBook: /cierra el libro|sin libro/i.test(note),
        blocks: toBlocks(g.nodes, { src, prefix: `${id}.p${n}`, keys, unitId: id, duplicateCodes }),
      });
      continue;
    }
    if (/^Cierre/i.test(heading)) {
      closing = parseClosing(g.nodes, id, src, keys);
      continue;
    }
    steps.push({
      n: steps.length + 1,
      title: heading,
      minutes: null,
      closedBook: false,
      blocks: toBlocks(g.nodes, {
        src,
        prefix: `${id}.p${steps.length + 1}`,
        keys,
        unitId: id,
        duplicateCodes,
      }),
    });
  }

  // "**Lectura:** … · **Tiempo total:** 40 min" or "(opcional, 20 minutos)".
  const introText = level4.intro.map((n) => sliceMd(src, n)).join("\n");
  const minutes =
    Number(
      introText.match(/Tiempo total:\*\*\s*(\d+)/)?.[1] ??
        parenthetical?.match(/(\d+)\s*minutos/)?.[1],
    ) || steps.reduce((sum, s) => sum + (s.minutes ?? 0), 0);

  return {
    kind: "session",
    id,
    chapter,
    number,
    title,
    minutes,
    intro: toBlocks(level4.intro, { src, prefix: id, keys, unitId: id }).map((b) =>
      b.type === "markdown" ? { ...b, md: splitMetaLine(b.md) } : b,
    ),
    steps,
    closing,
    optional: /opcional/i.test(parenthetical ?? ""),
  };
}

function parseClosing(
  nodes: RootContent[],
  id: string,
  src: string,
  keys: KeyRegistry,
): Session["closing"] {
  let beforeAdvancing: string | null = null;
  const rest: RootContent[] = [];
  for (const node of nodes) {
    if (isParagraph(node) && boldLead(node) === "Antes de avanzar") {
      beforeAdvancing = stripBoldLead(sliceMd(src, node));
    } else rest.push(node);
  }
  const blocks = toBlocks(rest, { src, prefix: id, keys, unitId: id });
  return {
    checklist: blocks.find((b) => b.type === "checklist") ?? null,
    rating: blocks.find((b) => b.type === "rating") ?? null,
    beforeAdvancing,
  };
}

/**
 * The reading line packs several fields: "**Lectura:** … · **Secciones:** …
 * · **Tiempo total:** 40 min". Each gets its own paragraph; the time is shown
 * by the app already.
 */
function splitMetaLine(md: string): string {
  return md
    .replace(/\s+·\s+(?=\*\*[^*\n]+:\*\*)/g, "\n\n")
    .replace(/\n\n\*\*Tiempo total:\*\*[^\n]*/g, "")
    .trim();
}
