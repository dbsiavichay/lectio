import type { ListItem } from "mdast";

import type { Answer } from "../schema";
import { itemMd, parseMarkdown, plain, sliceMd } from "./mdast";

const FIELDS: Record<string, keyof Omit<Answer, "code" | "title" | "extra">> = {
  referencia: "reference",
  "lo que dice el texto": "textSays",
  interpretacion: "interpretation",
  "una respuesta satisfactoria incluye": "satisfactory",
  "respuesta orientativa": "guide",
  pendiente: "pending",
};

const normLabel = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/[:\s]+$/, "")
    .trim();

export type AnswersResult = {
  answers: Record<string, Answer>;
  /** Guidance for the personal questions, by chapter number. */
  orientations: Record<string, string>;
  problems: string[];
};

/**
 * Parses the answer guide: `#### C1-S1-P1 — Título` followed by a list of
 * labelled items (Referencia, Lo que dice el texto, Interpretación…), and
 * `### Orientación … (capítulo N)` sections for the personal questions.
 */
export function parseAnswers(src: string): AnswersResult {
  const tree = parseMarkdown(src);
  const answers: Record<string, Answer> = {};
  const orientations: Record<string, string> = {};
  const problems: string[] = [];

  let current: Answer | null = null;
  let orientation: { chapter: string; parts: string[] } | null = null;

  const closeOrientation = () => {
    if (orientation) orientations[orientation.chapter] = orientation.parts.join("\n\n").trim();
    orientation = null;
  };

  for (const node of tree.children) {
    if (node.type === "heading") {
      const text = plain(node);
      closeOrientation();
      current = null;
      if (node.depth === 4) {
        const m = text.match(/^(C\d+-(?:S\d+-P\d+|EF-\d+|P\d+))\s*(?:—\s*(.+))?$/);
        if (!m) {
          problems.push(`Entrada de la guía no reconocida: «${text}»`);
          continue;
        }
        const code = m[1]!;
        if (answers[code]) problems.push(`Respuesta duplicada: ${code}`);
        current = {
          code,
          title: m[2]?.trim() ?? "",
          reference: null,
          textSays: null,
          interpretation: null,
          guide: null,
          satisfactory: null,
          pending: null,
          extra: [],
        };
        answers[code] = current;
      } else if (node.depth === 3) {
        const m = text.match(/^Orientación.*\(capítulo (\d+)\)/i);
        if (m) orientation = { chapter: m[1]!, parts: [] };
      }
      continue;
    }

    if (orientation) {
      orientation.parts.push(sliceMd(src, node));
      continue;
    }
    if (!current) continue;

    if (node.type === "list") {
      for (const item of node.children) addItem(current, item, src);
    } else {
      current.extra.push({ label: "", md: sliceMd(src, node) });
    }
  }
  closeOrientation();
  return { answers, orientations, problems };
}

function addItem(answer: Answer, item: ListItem, src: string) {
  const md = itemMd(src, item);
  const m = md.match(/^\*\*([^*]+?):?\*\*:?\s*([\s\S]*)$/);
  if (!m) {
    answer.extra.push({ label: "", md });
    return;
  }
  const label = m[1]!.replace(/:$/, "");
  const field = FIELDS[normLabel(label)];
  const body = m[2]!.trim();
  if (field) answer[field] = answer[field] ? `${answer[field]}\n\n${body}` : body;
  else answer.extra.push({ label, md: body });
}
