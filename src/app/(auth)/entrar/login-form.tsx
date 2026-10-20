"use client";

import { browserSupportsWebAuthn, startAuthentication } from "@simplewebauthn/browser";
import { Eye, EyeOff, Fingerprint, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  loginWithPassword,
  passkeyLogin,
  passkeyLoginOptions,
  type LoginState,
} from "@/features/auth/actions";
import { useClientValue } from "@/lib/use-client-value";

export function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/";
  const [state, formAction, pending] = useActionState<LoginState, FormData>(loginWithPassword, {});
  const [showPassword, setShowPassword] = useState(false);
  const passkeySupported = useClientValue(browserSupportsWebAuthn, false);
  const [passkeyError, setPasskeyError] = useState<string>();
  const [passkeyBusy, setPasskeyBusy] = useState(false);

  async function signInWithPasskey() {
    setPasskeyError(undefined);
    setPasskeyBusy(true);
    try {
      const options = await passkeyLoginOptions();
      if ("error" in options) return setPasskeyError(options.error);
      const response = await startAuthentication({ optionsJSON: options });
      const result = await passkeyLogin(response, next);
      if ("error" in result) return setPasskeyError(result.error);
      router.replace(result.next as never);
      router.refresh();
    } catch (error) {
      // The user closed the prompt, or the device has no passkey for this site.
      if (error instanceof Error && error.name !== "NotAllowedError")
        setPasskeyError("No se pudo usar la passkey en este dispositivo.");
    } finally {
      setPasskeyBusy(false);
    }
  }

  const error = passkeyError ?? state.error;

  return (
    <div className="space-y-6">
      {passkeySupported && (
        <>
          <Button
            type="button"
            size="lg"
            className="h-12 w-full text-base"
            onClick={signInWithPasskey}
            disabled={passkeyBusy}
          >
            {passkeyBusy ? <Loader2 className="animate-spin" /> : <Fingerprint />}
            Entrar con Face ID o huella
          </Button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />o con tu contraseña
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div className="space-y-2">
          <Label htmlFor="username">Usuario</Label>
          <Input
            id="username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            required
            className="h-12 text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Contraseña</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              className="h-12 pr-12 text-base"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-muted-foreground hover:text-foreground"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
            >
              {showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </div>
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        <Button
          type="submit"
          size="lg"
          variant={passkeySupported ? "outline" : "default"}
          className="h-12 w-full text-base"
          disabled={pending}
        >
          {pending && <Loader2 className="animate-spin" />}
          Entrar
        </Button>
      </form>
    </div>
  );
}
