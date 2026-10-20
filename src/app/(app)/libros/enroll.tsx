"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { enrollAction, openBookAction } from "@/features/study/actions";
import { WEEKDAY_LABELS, type Weekday } from "@/lib/schedule";
import { cn } from "@/lib/utils";

const WEEK: Weekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

export function DayPicker({
  label,
  value,
  onChange,
  disabled = [],
}: {
  label: string;
  value: string[];
  onChange: (days: string[]) => void;
  disabled?: string[];
}) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex gap-1.5">
        {WEEK.map((d) => {
          const on = value.includes(d);
          const off = disabled.includes(d);
          return (
            <button
              key={d}
              type="button"
              disabled={off}
              aria-pressed={on}
              aria-label={WEEKDAY_LABELS[d].long}
              onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d])}
              className={cn(
                "flex h-11 flex-1 items-center justify-center rounded-lg border text-sm font-semibold transition-colors",
                on
                  ? "border-primary bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted",
                off && "opacity-35",
              )}
            >
              {WEEKDAY_LABELS[d].short}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function EnrollSheet(props: {
  slug: string;
  title: string;
  sessions: number;
  initialStudyDays: string[];
  initialRestDays: string[];
  mode: "start" | "edit";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [studyDays, setStudyDays] = useState(props.initialStudyDays);
  const [restDays, setRestDays] = useState(props.initialRestDays);
  const [pending, start] = useTransition();
  const weeks = studyDays.length ? Math.ceil(props.sessions / studyDays.length) : 0;

  function save() {
    start(async () => {
      const result = await enrollAction(props.slug, { studyDays, restDays });
      if (!result.ok) return void toast.error(result.error);
      setOpen(false);
      if (props.mode === "start") router.push("/");
      else toast.success("Plan actualizado");
    });
  }

  return (
    <>
      <Button
        variant={props.mode === "start" ? "default" : "outline"}
        className="h-10 px-4"
        onClick={() => setOpen(true)}
      >
        {props.mode === "start" ? "Empezar este libro" : "Días de estudio"}
      </Button>
      <Drawer open={open} onOpenChange={setOpen} showSwipeHandle>
        <DrawerContent className="mx-auto max-w-lg">
          <DrawerHeader className="text-left">
            <DrawerTitle className="font-serif text-xl">
              {props.mode === "start" ? "Tu plan de estudio" : "Días de estudio"}
            </DrawerTitle>
            <DrawerDescription>{props.title}</DrawerDescription>
          </DrawerHeader>
          <div className="space-y-5 px-4 pb-2">
            <DayPicker
              label="¿Qué días harás una sesión?"
              value={studyDays}
              onChange={(d) => {
                setStudyDays(d);
                setRestDays((r) => r.filter((x) => !d.includes(x)));
              }}
            />
            <DayPicker
              label="¿Qué días descansas? Ningún repaso caerá en ellos."
              value={restDays}
              onChange={setRestDays}
              disabled={studyDays}
            />
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              {studyDays.length > 0
                ? `Con ${studyDays.length} ${studyDays.length === 1 ? "sesión" : "sesiones"} por semana terminarás las ${props.sessions} sesiones en unas ${weeks} semanas. Los repasos se programan solos a partir del día en que termines cada capítulo.`
                : "Elige al menos un día de estudio."}
            </p>
          </div>
          <DrawerFooter>
            <Button
              className="h-12 text-base"
              onClick={save}
              disabled={pending || studyDays.length === 0}
            >
              {pending && <Loader2 className="animate-spin" />}
              {props.mode === "start" ? "Empezar" : "Guardar"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

export function OpenBookButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      className="h-10 px-4"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await openBookAction(slug);
          router.push("/");
        })
      }
    >
      Estudiar este libro
    </Button>
  );
}
