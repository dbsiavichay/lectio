"use client";

import { Check, CloudOff, Loader2, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

import type { SaveStatus } from "./use-autosave";

export function SaveIndicator({ status, className }: { status: SaveStatus; className?: string }) {
  if (status === "idle") return null;
  const map = {
    saving: {
      icon: <Loader2 className="size-3.5 animate-spin" />,
      text: "Guardando…",
      tone: "text-muted-foreground",
    },
    saved: { icon: <Check className="size-3.5" />, text: "Guardado", tone: "text-success" },
    error: {
      icon: <TriangleAlert className="size-3.5" />,
      text: "No se pudo guardar; reintentando",
      tone: "text-destructive",
    },
    offline: {
      icon: <CloudOff className="size-3.5" />,
      text: "Sin conexión; se guardará al volver",
      tone: "text-warning-foreground",
    },
  } as const;
  const s = map[status];
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("inline-flex items-center gap-1 text-xs font-medium", s.tone, className)}
    >
      {s.icon}
      {s.text}
    </span>
  );
}
