"use client";

import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { Fingerprint, Loader2, Lock } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import {
  hasPasskeys,
  reauthPasskeyOptions,
  reauthWithPasskey,
  reauthWithPassword,
} from "./reauth-actions";

/** Shown instead of private content until the user confirms who they are. */
export function ReauthGate({ title, description }: { title: string; description: string }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string>();
  const [canPasskey, setCanPasskey] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!browserSupportsWebAuthn()) return;
    hasPasskeys().then(setCanPasskey, () => setCanPasskey(false));
  }, []);

  const withPasskey = () =>
    start(async () => {
      setError(undefined);
      try {
        const options = await reauthPasskeyOptions();
        const result = await reauthWithPasskey(await startAuthentication({ optionsJSON: options }));
        if ("error" in result) setError(result.error);
      } catch {
        setError("No se pudo usar la passkey.");
      }
    });

  const withPassword = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      setError(undefined);
      const result = await reauthWithPassword(password);
      if ("error" in result) setError(result.error);
    });
  };

  return (
    <div className="mx-auto max-w-sm rounded-2xl border bg-card p-6 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Lock className="size-6" />
      </span>
      <h1 className="mt-4 font-serif text-xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <div className="mt-6 space-y-3 text-left">
        {canPasskey && (
          <Button className="h-12 w-full text-base" onClick={withPasskey} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Fingerprint />}
            Confirmar con Face ID o huella
          </Button>
        )}
        <form onSubmit={withPassword} className="space-y-3">
          <label htmlFor="reauth-password" className="text-sm font-medium">
            {canPasskey ? "O con tu contraseña" : "Tu contraseña"}
          </label>
          <Input
            id="reauth-password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 text-base"
          />
          <Button
            type="submit"
            variant={canPasskey ? "outline" : "default"}
            className="h-12 w-full text-base"
            disabled={pending || !password}
          >
            Confirmar
          </Button>
        </form>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
