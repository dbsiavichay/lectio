import { readFileSync } from "node:fs";
import path from "node:path";
import { z } from "zod";

import type { BookSources } from "./parser";
import { manifestSchema, sectionEntrySchema } from "./schema";

/** Reads a book package: lectio.book.json, the section index and the notebook files. */
export function loadBookDir(dir: string): BookSources {
  const read = (file: string) => readFileSync(path.join(dir, file), "utf8");
  const manifest = manifestSchema.parse(JSON.parse(read("lectio.book.json")));
  const index = z
    .object({ entries: z.array(sectionEntrySchema.loose()) })
    .parse(JSON.parse(read(manifest.files.sections)));
  return {
    manifest,
    sections: index.entries,
    method: read(manifest.files.method),
    notebook: read(manifest.files.notebook),
    answers: read(manifest.files.answers),
    reviews: read(manifest.files.reviews),
  };
}
