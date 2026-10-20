"use client";

import type { Block } from "@/content/schema";

import { Markdown } from "./markdown";
import { Note } from "./note";

/** Read-only blocks (chapter and part intros): prose and callouts. */
export function StaticBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="space-y-4">
      {blocks.map((b, i) =>
        b.type === "markdown" ? (
          <Markdown key={i} md={b.md} />
        ) : b.type === "note" ? (
          <Note key={i} md={b.md} />
        ) : null,
      )}
    </div>
  );
}
