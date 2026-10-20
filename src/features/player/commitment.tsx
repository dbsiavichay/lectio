"use client";

import { Lightbulb, Target } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { Markdown } from "@/components/book/markdown";
import { Input } from "@/components/ui/input";
import type { Block } from "@/content/schema";
import { saveCommitmentAction } from "@/features/study/actions";

import { AutoTextarea } from "./fields";

export type CommitmentDraft = {
  teaching: string;
  behavior: string;
  action: string;
  situation: string;
  dueOn: string;
  measure: string;
  learned: string;
};

export const EMPTY_COMMITMENT: CommitmentDraft = {
  teaching: "",
  behavior: "",
  action: "",
  situation: "",
  dueOn: "",
  measure: "",
  learned: "",
};

type Ctx = {
  draft: CommitmentDraft;
  update: (patch: Partial<CommitmentDraft>) => void;
  flush: () => Promise<void>;
};
const CommitmentContext = createContext<Ctx | null>(null);

export function CommitmentProvider({
  slug,
  unitId,
  initial,
  children,
}: {
  slug: string;
  unitId: string;
  initial: CommitmentDraft;
  children: ReactNode;
}) {
  const [draft, setDraft] = useState(initial);
  const pending = useRef<Partial<CommitmentDraft>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length) await saveCommitmentAction(slug, unitId, patch);
  }, [slug, unitId]);

  const update = useCallback(
    (patch: Partial<CommitmentDraft>) => {
      setDraft((d) => ({ ...d, ...patch }));
      pending.current = { ...pending.current, ...patch };
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void save(), 800);
    },
    [save],
  );

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void save();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      void save();
    };
  }, [save]);
  return <CommitmentContext value={{ draft, update, flush: save }}>{children}</CommitmentContext>;
}

/** Saves a pending commitment edit now (before changing step or finishing). */
export function useCommitmentFlush(): () => Promise<void> {
  return useContext(CommitmentContext)?.flush ?? (async () => {});
}

function useCommitment() {
  const ctx = useContext(CommitmentContext);
  if (!ctx) throw new Error("useCommitment fuera de CommitmentProvider");
  return ctx;
}

const plainText = (md: string) =>
  md
    .replace(/\[\[([^\]]+)\]\]/g, (_, r: string) => `«${r.split(" › ").at(-1)}»`)
    .replace(/\*\*|\*/g, "");

export function IdeasList({ block }: { block: Extract<Block, { type: "ideas" }> }) {
  const { draft, update } = useCommitment();
  return (
    <section className="space-y-3">
      <p className="flex items-center gap-2 font-medium">
        <Lightbulb className="size-5 text-warning-foreground" /> Ideas para aplicar (elige una o
        formula la tuya)
      </p>
      <ul className="space-y-2">
        {block.items.map((idea, i) => {
          const chosen = draft.action === plainText(idea);
          return (
            <li key={i} className="rounded-xl border bg-card p-3.5">
              <Markdown md={idea} className="text-[0.95rem]" />
              <button
                type="button"
                onClick={() => update({ action: plainText(idea) })}
                className="mt-2 text-sm font-medium text-primary underline-offset-2 hover:underline disabled:text-success disabled:no-underline"
                disabled={chosen}
              >
                {chosen ? "Elegida como tu acción" : "Usar esta idea"}
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const FIELDS: { key: keyof CommitmentDraft; label: string; placeholder?: string }[] = [
  { key: "teaching", label: "Enseñanza que quiero aplicar" },
  { key: "behavior", label: "Conducta que quiero mejorar" },
  {
    key: "action",
    label: "Acción específica que realizaré",
    placeholder: "Concreta, observable y con plazo",
  },
  { key: "situation", label: "Situación en la que la practicaré" },
];

export function CommitmentForm({ block }: { block: Extract<Block, { type: "commitment" }> }) {
  const { draft, update } = useCommitment();
  return (
    <section className="space-y-4 rounded-2xl border border-primary/25 bg-card p-4 sm:p-5">
      <p className="flex items-center gap-2 font-semibold">
        <Target className="size-5 text-primary" /> Mi compromiso práctico
      </p>
      {FIELDS.map((f) => (
        <label key={f.key} className="block space-y-1.5">
          <span className="text-sm font-medium">{f.label}</span>
          <AutoTextarea
            rows={f.key === "action" ? 2 : 1}
            placeholder={f.placeholder}
            value={draft[f.key]}
            onChange={(v) => update({ [f.key]: v })}
          />
        </label>
      ))}
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Cuándo la realizaré</span>
        <Input
          type="date"
          value={draft.dueOn}
          onChange={(e) => update({ dueOn: e.target.value })}
          className="h-11 w-auto text-base"
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Cómo evaluaré si la cumplí</span>
        <AutoTextarea rows={1} value={draft.measure} onChange={(v) => update({ measure: v })} />
      </label>
      <label className="block space-y-1.5 border-t pt-4">
        <span className="text-sm font-medium">
          <Markdown md={block.learnedLabel} inline />
        </span>
        <AutoTextarea
          rows={2}
          placeholder="Complétalo después de intentarlo"
          value={draft.learned}
          onChange={(v) => update({ learned: v })}
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Lo verás en Compromisos y te avisaremos cuando venza.
      </p>
    </section>
  );
}
