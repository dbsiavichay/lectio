import {
  BookText,
  ChevronRight,
  Library,
  LogOut,
  NotebookPen,
  Settings,
  Shield,
} from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/page-skeleton";
import { logout } from "@/features/auth/actions";
import { currentStudy } from "@/features/study/context";

export const metadata: Metadata = { title: "Más" };

export default function MorePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <More />
    </Suspense>
  );
}

async function More() {
  const { user, book } = await currentStudy();
  const base = book ? `/libro/${book.slug}` : null;
  const items: { href: string; label: string; hint: string; icon: typeof BookText }[] = [
    ...(base
      ? [
          {
            href: `${base}/diario`,
            label: "Diario semanal",
            hint: "Lo que aprendiste cada semana",
            icon: NotebookPen,
          },
          {
            href: `${base}/metodo`,
            label: "Guía del método",
            hint: "Cómo funciona el estudio",
            icon: BookText,
          },
        ]
      : []),
    {
      href: "/libros",
      label: "Biblioteca",
      hint: "Cambiar de libro o de días de estudio",
      icon: Library,
    },
    {
      href: "/ajustes",
      label: "Ajustes",
      hint: "Tema, letra, passkeys y contraseña",
      icon: Settings,
    },
    ...(user.role === "admin"
      ? [
          {
            href: "/admin",
            label: "Administración",
            hint: "Usuarios e importación de libros",
            icon: Shield,
          },
        ]
      : []),
  ];
  return (
    <div className="space-y-6">
      <header className="flex items-center gap-4">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
          {user.displayName.slice(0, 1).toUpperCase()}
        </span>
        <div>
          <h1 className="font-serif text-2xl font-semibold">{user.displayName}</h1>
          <p className="text-sm text-muted-foreground">
            @{user.username}
            {user.role === "admin" ? " · administrador" : ""}
          </p>
        </div>
      </header>
      <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
        {items.map((it) => (
          <li key={it.href}>
            <Link
              href={it.href as Route}
              className="flex items-center gap-4 px-4 py-4 transition hover:bg-muted/60"
            >
              <it.icon className="size-5 text-primary" />
              <span className="flex-1">
                <span className="block font-medium">{it.label}</span>
                <span className="text-sm text-muted-foreground">{it.hint}</span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
      <form action={logout}>
        <button
          type="submit"
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl border bg-card font-medium text-destructive transition hover:bg-destructive/5"
        >
          <LogOut className="size-5" /> Cerrar sesión
        </button>
      </form>
    </div>
  );
}
