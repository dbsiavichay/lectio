"use client";

import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/**
 * An optional countdown with the step's suggested minutes. It never blocks
 * anything. Give it a `key` per step: a new key starts a fresh countdown.
 */
export function StepTimer({
  seconds,
  autoStart = false,
  size = "sm",
}: {
  seconds: number;
  autoStart?: boolean;
  size?: "sm" | "lg";
}) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(autoStart);
  const notified = useRef(false);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      setLeft((l) => {
        const next = Math.max(0, l - 1);
        if (next === 0 && !notified.current) {
          notified.current = true;
          setRunning(false);
          navigator.vibrate?.([120, 80, 120]);
          toast("Se cumplió el tiempo sugerido", {
            description: "Puedes seguir o pasar al siguiente paso.",
          });
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running]);

  if (size === "lg") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border bg-card p-6">
        <span
          className={cn(
            "font-mono text-5xl font-semibold tabular-nums",
            left === 0 && "text-success",
          )}
        >
          {fmt(left)}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="flex h-12 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground"
          >
            {running ? <Pause className="size-5" /> : <Play className="size-5" />}
            {running ? "Pausar" : left === seconds ? "Empezar" : "Seguir"}
          </button>
          <button
            type="button"
            onClick={() => {
              setLeft(seconds);
              setRunning(false);
              notified.current = false;
            }}
            className="flex h-12 items-center gap-2 rounded-xl border px-4"
            aria-label="Reiniciar"
          >
            <RotateCcw className="size-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setRunning((r) => !r)}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 font-mono text-sm tabular-nums transition",
        running
          ? "border-primary/40 bg-accent text-accent-foreground"
          : "bg-card text-muted-foreground hover:text-foreground",
        left === 0 && "border-success/40 text-success",
      )}
      aria-label={running ? "Pausar temporizador" : "Iniciar temporizador"}
    >
      {running ? (
        <Pause className="size-3.5" />
      ) : left === seconds ? (
        <Timer className="size-3.5" />
      ) : (
        <Play className="size-3.5" />
      )}
      {fmt(left)}
    </button>
  );
}
