import "server-only";

import { allBlocks } from "@/content/parser";
import { blockKeys, questionCodes } from "@/content/navigation";
import type { Answer, Block, Book } from "@/content/schema";
import { getAnswerChecks, getFields } from "@/features/study/fields";

import type { Grade } from "./player-context";

const promptCache = new WeakMap<Book, Record<string, { prompt: string; qtype: string | null }>>();

/** Every question's prompt, by code (the review sheets quote them). */
export function questionPrompts(book: Book) {
  let prompts = promptCache.get(book);
  if (!prompts) {
    prompts = {};
    for (const b of allBlocks(book))
      if (b.type === "question") prompts[b.code] = { prompt: b.prompt, qtype: b.qtype };
    promptCache.set(book, prompts);
  }
  return prompts;
}

/** What a player needs for a set of blocks: saved values, opened guides and grades. */
export function playerData(userId: string, book: Book, blocks: Block[], extraKeys: string[] = []) {
  const codes = [
    ...new Set([
      ...questionCodes(blocks),
      ...blocks.flatMap((b) => (b.type === "verify" ? b.items.map((i) => i.code) : [])),
    ]),
  ];
  const keys = [...new Set([...blocks.flatMap(blockKeys), ...codes, ...extraKeys])];
  const values = getFields(userId, book.slug, keys);
  const checks = getAnswerChecks(userId, book.slug, codes);
  const revealed: Record<string, Answer> = {};
  const grades: Record<string, Grade | null> = {};
  for (const [code, check] of Object.entries(checks)) {
    const answer = book.answers[code];
    if (answer) revealed[code] = answer;
    grades[code] = check.grade;
  }
  const all = questionPrompts(book);
  const prompts = Object.fromEntries(codes.filter((c) => all[c]).map((c) => [c, all[c]!]));
  return { values, revealed, grades, prompts };
}
