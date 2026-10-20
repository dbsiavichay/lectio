import type { Paragraph, RootContent } from "mdast";

import type { Block, Book, ReviewCard } from "../schema";
import { KeyRegistry, checksBlock, toBlocks } from "./blocks";
import { boldLead, isBlank, isParagraph, parseMarkdown, plain, sliceMd } from "./mdast";

type Reviews = Book["reviews"];

/**
 * Parses the review sheets: a weekly log template, one card per chapter with
 * its day +1, +3, +7 and +14 reviews, the block reviews that close each part
 * and the final evaluation of the book.
 */
export function parseReviews(
  src: string,
  keys: KeyRegistry,
): { reviews: Reviews; problems: string[] } {
  const tree = parseMarkdown(src);
  const problems: string[] = [];
  const reviews: Reviews = { intro: "", weekly: [], cards: {}, blocks: {}, final: null };

  // Level 2 sections; the text before the first one is the general rule.
  const sections: { title: string; nodes: RootContent[] }[] = [];
  const intro: string[] = [];
  for (const node of tree.children) {
    if (node.type === "heading" && node.depth === 1) continue;
    if (node.type === "heading" && node.depth === 2)
      sections.push({ title: plain(node), nodes: [] });
    else if (sections.length) sections.at(-1)!.nodes.push(node);
    else intro.push(sliceMd(src, node));
  }
  reviews.intro = intro.join("\n\n");

  for (const section of sections) {
    const sub = splitH3(section.nodes);
    if (/^Registro semanal/i.test(section.title)) {
      reviews.weekly = toBlocks(section.nodes, { src, prefix: "w", keys });
    } else if (/^Fichas de repaso/i.test(section.title)) {
      for (const card of sub.groups) {
        const m = card.title.match(/^Capítulo (\d+)/);
        if (!m) {
          problems.push(`Ficha sin capítulo: «${card.title}»`);
          continue;
        }
        const n = Number(m[1]);
        reviews.cards[String(n)] = parseCard(card.nodes, n, src, keys, problems);
      }
    } else if (/^Repasos de bloque/i.test(section.title)) {
      for (const block of sub.groups) {
        const m = block.title.match(/^Repaso de bloque (\d+)\s*—\s*(.+)$/);
        if (!m) {
          problems.push(`Repaso de bloque no reconocido: «${block.title}»`);
          continue;
        }
        reviews.blocks[m[1]!] = {
          title: m[2]!.trim(),
          blocks: toBlocks(block.nodes, { src, prefix: `r.b${m[1]}`, keys }),
        };
      }
    } else if (/^Evaluación final del libro/i.test(section.title)) {
      reviews.final = {
        intro: sub.intro.map((n) => sliceMd(src, n)).join("\n\n"),
        sections: sub.groups.map((g) => ({
          title: g.title,
          blocks: toBlocks(g.nodes, {
            src,
            prefix: `r.f.${g.title.match(/^([A-Z])\./)?.[1]?.toLowerCase() ?? "x"}`,
            keys,
          }),
        })),
      };
    } else {
      problems.push(`Sección de repasos no reconocida: «${section.title}»`);
    }
  }
  return { reviews, problems };
}

function splitH3(nodes: RootContent[]) {
  const intro: RootContent[] = [];
  const groups: { title: string; nodes: RootContent[] }[] = [];
  for (const node of nodes) {
    if (node.type === "heading" && node.depth === 3) groups.push({ title: plain(node), nodes: [] });
    else (groups.at(-1)?.nodes ?? intro).push(node);
  }
  return { intro, groups };
}

const dayOf = (node: RootContent): "d1" | "d3" | "d7" | "d14" | undefined => {
  if (!isParagraph(node)) return undefined;
  const m = boldLead(node)?.match(/^Día \+(1|3|7|14)\b/);
  return m ? (`d${m[1]}` as "d1" | "d3" | "d7" | "d14") : undefined;
};

function parseCard(
  nodes: RootContent[],
  chapter: number,
  src: string,
  keys: KeyRegistry,
  problems: string[],
): ReviewCard {
  const segments: Partial<Record<"d1" | "d3" | "d7" | "d14", RootContent[]>> = {};
  let current: "d1" | "d3" | "d7" | "d14" | undefined;
  for (const node of nodes) {
    current = dayOf(node) ?? current;
    if (!current) continue;
    (segments[current] ??= []).push(node);
  }

  const prefix = (day: string) => `r.c${chapter}.${day}`;
  const card: ReviewCard = { chapter, d1: [], d3: [], d7: [], d14: [] };

  card.d1 = toBlocks(segments.d1 ?? [], { src, prefix: prefix("d1"), keys });
  card.d14 = toBlocks(segments.d14 ?? [], { src, prefix: prefix("d14"), keys });

  const d3 = segments.d3?.[0];
  if (d3) {
    const md = sliceMd(src, d3);
    const codes = [...new Set(md.match(/C\d+-(?:S\d+-P\d+|EF-\d+|P\d+)/g) ?? [])];
    if (!codes.length) problems.push(`La ficha del capítulo ${chapter} (día +3) no cita preguntas`);
    card.d3 = [{ type: "requestion", key: prefix("d3"), intro: md, codes }];
    const rest = (segments.d3 ?? []).slice(1).filter((n) => !isBlank(n));
    card.d3.push(...toBlocks(rest, { src, prefix: prefix("d3"), keys }));
  }

  const d7 = segments.d7?.[0] as Paragraph | undefined;
  if (d7) {
    const md = sliceMd(src, d7);
    const [speech = md, marks] = md.split(/\s*Marca lo que olvidaste:\s*/);
    const minutes = Number(md.match(/\((\d+) min/)?.[1] ?? 2);
    const blocks: Block[] = [{ type: "timer", md: speech, seconds: minutes * 60 }];
    if (marks)
      blocks.push(
        checksBlock(`Marca lo que olvidaste: ${marks}`, { src, prefix: prefix("d7"), keys }),
      );
    const rest = (segments.d7 ?? []).slice(1);
    blocks.push(...toBlocks(rest, { src, prefix: prefix("d7"), keys }));
    card.d7 = blocks;
  }

  for (const day of ["d1", "d3", "d7", "d14"] as const) {
    if (!card[day].length)
      problems.push(`La ficha del capítulo ${chapter} no tiene el repaso ${day}`);
  }
  return card;
}
