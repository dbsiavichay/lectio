"use client";

import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";
import {
  Download,
  Fingerprint,
  KeyRound,
  Loader2,
  Monitor,
  Moon,
  Sun,
  Trash2,
  Type,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { reauthWithPassword } from "@/features/auth/reauth-actions";
import {
  changePasswordAction,
  deletePasskeyAction,
  passkeyRegistrationOptions,
  registerPasskeyAction,
  updateTimezoneAction,
} from "@/features/settings/actions";
import { useClientValue } from "@/lib/use-client-value";
import { cn } from "@/lib/utils";

const THEMES = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "sepia", label: "Sepia", icon: Type },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

const SIZES = [
  { value: "sm", label: "A", className: "text-sm" },
  { value: "md", label: "A", className: "text-base" },
  { value: "lg", label: "A", className: "text-lg" },
  { value: "xl", label: "A", className: "text-xl" },
] as const;

function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: string; icon?: typeof Sun; className?: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="grid grid-flow-col gap-1 rounded-xl bg-muted p-1"
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition",
            value === o.value ? "bg-card shadow-sm" : "text-muted-foreground hover:text-foreground",
            o.className,
          )}
        >
          {o.icon && <o.icon className="size-4" />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

type TextSize = "sm" | "md" | "lg" | "xl";
const TEXT_SIZE_KEY = "lectio:text-size";
const textSizeListeners = new Set<() => void>();

// The reading size is a per-device preference kept in localStorage; the
// layout's inline script applies it before the first paint.
function subscribeTextSize(onChange: () => void) {
  textSizeListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    textSizeListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readTextSize(): TextSize {
  try {
    return (localStorage.getItem(TEXT_SIZE_KEY) as TextSize | null) ?? "md";
  } catch {
    return "md";
  }
}

function writeTextSize(size: TextSize) {
  try {
    localStorage.setItem(TEXT_SIZE_KEY, size);
  } catch {}
  if (size === "md") delete document.documentElement.dataset.textSize;
  else document.documentElement.dataset.textSize = size;
  textSizeListeners.forEach((listener) => listener());
}

const isClient = () => true;

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  // next-themes only knows the theme in the browser.
  const mounted = useClientValue(isClient, false);
  const size = useSyncExternalStore(subscribeTextSize, readTextSize, () => "md" as TextSize);
  const changeSize = writeTextSize;

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Tema</p>
        <Segmented
          label="Tema"
          value={(mounted ? theme : "system") as (typeof THEMES)[number]["value"]}
          options={THEMES}
          onChange={setTheme}
        />
      </div>
      <div className="space-y-2">
        <p className="text-sm font-medium">Tamaño de la letra de lectura</p>
        <Segmented label="Tamaño de letra" value={size} options={SIZES} onChange={changeSize} />
        <p className="prose-reading rounded-lg bg-muted px-3 py-2 text-muted-foreground">
          Así se verán el texto del cuaderno y tus respuestas.
        </p>
      </div>
    </div>
  );
}

let zoneCache: string[] | undefined;
function supportedZones(): string[] {
  try {
    zoneCache ??= Intl.supportedValuesOf("timeZone");
  } catch {
    zoneCache ??= [];
  }
  return zoneCache;
}

const deviceZone = (): string | null => Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;

export function TimezoneSettings({ current }: { current: string }) {
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();
  // The zone list and the device's zone are only known in the browser.
  const serverZones = useMemo(() => [current], [current]);
  const allZones = useClientValue(supportedZones, serverZones);
  const zones = allZones.includes(current) ? allZones : [current, ...allZones];
  const detected = useClientValue(deviceZone, null);
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        Decide qué día es «hoy» para tus sesiones y repasos.
      </p>
      <select
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-11 w-full rounded-lg border border-input bg-background px-3 text-base"
        aria-label="Zona horaria"
      >
        {zones.map((z) => (
          <option key={z} value={z}>
            {z.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <div className="flex flex-wrap gap-2">
        <Button
          className="h-10 px-4"
          disabled={pending || value === current}
          onClick={() =>
            start(async () => {
              const res = await updateTimezoneAction(value);
              if (res.ok) toast.success("Zona horaria guardada");
              else toast.error(res.error);
            })
          }
        >
          Guardar
        </Button>
        {detected && detected !== value && (
          <Button variant="ghost" className="h-10 px-3" onClick={() => setValue(detected)}>
            Usar la de este dispositivo ({detected.replaceAll("_", " ")})
          </Button>
        )}
      </div>
    </div>
  );
}

function deviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Android/.test(ua)) return "Android";
  if (/Mac/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows";
  return "Mi dispositivo";
}

export function PasskeySettings({
  passkeys,
}: {
  passkeys: { id: string; name: string; createdAt: string; lastUsedAt: string | null }[];
}) {
  const supported = useClientValue(browserSupportsWebAuthn, false);
  const suggestedName = useClientValue(deviceName, "Mi dispositivo");
  const [editedName, setName] = useState<string | null>(null);
  const name = editedName ?? suggestedName;
  const [pending, start] = useTransition();

  const add = () =>
    start(async () => {
      try {
        const options = await passkeyRegistrationOptions();
        const response = await startRegistration({ optionsJSON: options });
        const res = await registerPasskeyAction(response, name);
        if (res.ok) toast.success("Passkey agregada. La próxima vez entra con Face ID o huella.");
        else toast.error(res.error);
      } catch (error) {
        if (error instanceof Error && error.name !== "NotAllowedError")
          toast.error("No se pudo crear la passkey en este dispositivo.");
      }
    });

  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("es", { day: "numeric", month: "short", year: "numeric" }).format(
      new Date(iso),
    );

  return (
    <div className="space-y-4 rounded-2xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        Entra con Face ID, huella o el PIN del dispositivo, sin escribir la contraseña.
      </p>
      {passkeys.length > 0 && (
        <ul className="divide-y rounded-xl border">
          {passkeys.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-3">
              <Fingerprint className="size-5 text-primary" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="text-xs text-muted-foreground">
                  Creada el {fmt(p.createdAt)}
                  {p.lastUsedAt ? ` · usada el ${fmt(p.lastUsedAt)}` : ""}
                </span>
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-10 text-destructive"
                aria-label={`Eliminar ${p.name}`}
                onClick={() => {
                  if (!confirm(`¿Eliminar la passkey «${p.name}»?`)) return;
                  start(async () => {
                    await deletePasskeyAction(p.id);
                    toast.success("Passkey eliminada");
                  });
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {supported ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Nombre del dispositivo"
            className="h-11 text-base"
          />
          <Button className="h-11 shrink-0 px-4" onClick={add} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Fingerprint />}
            Agregar passkey
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Este navegador no admite passkeys.</p>
      )}
    </div>
  );
}

export function PasswordSettings() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmNext, setConfirmNext] = useState("");
  const [pending, start] = useTransition();
  const mismatch = confirmNext.length > 0 && next !== confirmNext;
  return (
    <form
      className="space-y-3 rounded-2xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (mismatch) return;
        start(async () => {
          const res = await changePasswordAction(current, next);
          if (!res.ok) return void toast.error(res.error);
          toast.success("Contraseña cambiada. Se cerró la sesión en tus otros dispositivos.");
          setCurrent("");
          setNext("");
          setConfirmNext("");
        });
      }}
    >
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Contraseña actual</span>
        <Input
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          className="h-11 text-base"
          required
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Nueva contraseña (10 caracteres o más)</span>
        <Input
          type="password"
          autoComplete="new-password"
          minLength={10}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          className="h-11 text-base"
          required
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Repite la nueva contraseña</span>
        <Input
          type="password"
          autoComplete="new-password"
          value={confirmNext}
          onChange={(e) => setConfirmNext(e.target.value)}
          className="h-11 text-base"
          aria-invalid={mismatch}
          required
        />
      </label>
      {mismatch && <p className="text-sm text-destructive">Las contraseñas no coinciden.</p>}
      <Button type="submit" className="h-11 px-4" disabled={pending || mismatch}>
        <KeyRound /> Cambiar contraseña
      </Button>
    </form>
  );
}

export function ExportData({ verified }: { verified: boolean }) {
  const [password, setPassword] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">
        Descarga todo lo que escribiste (respuestas, compromisos, repasos) en un archivo JSON.
      </p>
      {verified ? (
        <a
          href="/ajustes/exportar"
          className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          <Download className="size-4" /> Descargar mis datos
        </a>
      ) : (
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await reauthWithPassword(password);
              if ("error" in res) toast.error(res.error);
              setPassword("");
            });
          }}
        >
          <Input
            type="password"
            placeholder="Confirma con tu contraseña"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 text-base"
          />
          <Button
            type="submit"
            variant="outline"
            className="h-11 shrink-0 px-4"
            disabled={pending || !password}
          >
            Confirmar
          </Button>
        </form>
      )}
    </div>
  );
}
