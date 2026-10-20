import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Logo } from "@/components/logo";
import { getCurrentUser } from "@/lib/auth/dal";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Entrar" };

async function RedirectIfSignedIn() {
  if (await getCurrentUser()) redirect("/");
  return null;
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex flex-col items-center text-center">
          <Logo className="size-14" />
          <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight">Lectio</h1>
          <p className="mt-1 text-muted-foreground">Tu estudio guiado, con el libro en la mano.</p>
        </div>
        <Suspense>
          <RedirectIfSignedIn />
        </Suspense>
        <Suspense>
          <LoginForm />
        </Suspense>
        <p className="mt-10 text-center text-xs text-muted-foreground">
          ¿No tienes cuenta? Pídesela a quien administra Lectio.
        </p>
      </div>
    </main>
  );
}
