"use client";

import { Check, Lock, Minus, Repeat, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { checkInAction } from "@/features/study/actions";
import { formatDate, relativeDay } from "@/lib/schedule";
import { cn } from "@/lib/utils";

export type CommitmentView = {
  unitId: string;
  label: string;
  privateChapter: boolean;
  teaching: string;
  behavior: string;
  action: string;
  situation: string;
  dueOn: string | null;
  measure: string;
  learned: string;
  status: "pending" | "done" | "partial" | "not_done";
  observed: string;
  keepAsHabit: boolean;
};

const STATUS = {
  done: {
    label: "Sí",
    long: "Cumplido",
    icon: Check,
    tone: "border-success bg-success text-white",
  },
  partial: {
    label: "En parte",
    long: "Cumplido en parte",
    icon: Minus,
    tone: "border-warning bg-warning text-warning-foreground",
  },
  not_done: {
    label: "No",
    long: "No cumplido",
    icon: X,
    tone: "border-destructive bg-destructive text-white",
  },
} as const;

export function CommitmentCard({
  slug,
  commitment: c,
  today,
}: {
  slug: string;
  commitment: CommitmentView;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(c.status);
  const [observed, setObserved] = useState(c.observed);
  const [habit, setHabit] = useState(c.keepAsHabit);
  const [pending, start] = useTransition();
  const overdue = c.status === "pending" && c.dueOn && c.dueOn < today;
  const hidden = c.privateChapter;

  const save = () =>
    start(async () => {
      const res = await checkInAction(slug, c.unitId, { status, observed, keepAsHabit: habit });
      if (!res.ok) return void toast.error(res.error);
      toast.success("Compromiso actualizado");
      setOpen(false);
    });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-xl border bg-card p-4 text-left transition hover:border-primary/40"
      >
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {c.label}
          {c.keepAsHabit && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-accent-foreground">
              <Repeat className="size-3" /> Hábito
            </span>
          )}
          {c.status !== "pending" && <span>· {STATUS[c.status].long}</span>}
        </span>
        <span className="mt-1 line-clamp-3 block font-medium">
          {hidden ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Lock className="size-4" /> Compromiso de un capítulo privado
            </span>
          ) : (
            c.action || c.teaching
          )}
        </span>
        {c.dueOn && c.status === "pending" && (
          <span
            className={cn(
              "mt-1 block text-sm",
              overdue ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            {overdue ? "Venció " : "Vence "}
            {relativeDay(c.dueOn, today)}
          </span>
        )}
      </button>
      <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
        <DrawerContent className="mx-auto max-w-lg">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-serif text-xl">¿Lo cumpliste?</DrawerTitle>
            <DrawerDescription>
              {c.label}
              {c.dueOn ? ` · plazo: ${formatDate(c.dueOn, { day: "numeric", month: "long" })}` : ""}
            </DrawerDescription>
          </DrawerHeader>
          <div className="space-y-4 overflow-y-auto px-4 pb-2">
            {!hidden && (
              <dl className="space-y-2 rounded-lg bg-muted p-3 text-sm">
                {[
                  ["Acción", c.action],
                  ["Enseñanza", c.teaching],
                  ["Conducta", c.behavior],
                  ["Situación", c.situation],
                  ["Cómo evaluarla", c.measure],
                  ["Qué aprendí", c.learned],
                ]
                  .filter(([, v]) => v?.trim())
                  .map(([k, v]) => (
                    <div key={k}>
                      <dt className="text-xs text-muted-foreground">{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
              </dl>
            )}
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(STATUS) as (keyof typeof STATUS)[]).map((s) => {
                const S = STATUS[s];
                return (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={status === s}
                    onClick={() => setStatus(status === s ? "pending" : s)}
                    className={cn(
                      "flex h-12 items-center justify-center gap-1.5 rounded-lg border font-medium transition",
                      status === s ? S.tone : "bg-card hover:bg-muted",
                    )}
                  >
                    <S.icon className="size-4" /> {S.label}
                  </button>
                );
              })}
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Qué observé</span>
              <Textarea
                value={observed}
                onChange={(e) => setObserved(e.target.value)}
                rows={3}
                className="text-base"
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-lg border p-3">
              <span>
                <span className="block text-sm font-medium">Continuarla como hábito</span>
                <span className="text-xs text-muted-foreground">
                  Si dio fruto, conviértela en parte de tu semana.
                </span>
              </span>
              <Switch checked={habit} onCheckedChange={setHabit} />
            </label>
            {!hidden && (
              <Link
                href={`/libro/${slug}/sesion/${c.unitId}?paso=5` as Route}
                className="block text-sm font-medium text-primary"
              >
                Editar el compromiso en la sesión
              </Link>
            )}
          </div>
          <DrawerFooter>
            <Button className="h-12 text-base" onClick={save} disabled={pending}>
              Guardar
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}
