"use client";

import { KeyRound, Loader2, Trash2, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { createUserAction, deleteUserAction, resetPasswordAction } from "@/features/admin/actions";

export function UserRow({
  user,
  self,
}: {
  user: { id: string; username: string; displayName: string; role: string; createdAt: string };
  self: boolean;
}) {
  const [pending, start] = useTransition();
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent font-semibold text-accent-foreground">
        {user.displayName.slice(0, 1).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium">{user.displayName}</span>
        <span className="text-sm text-muted-foreground">
          @{user.username}
          {user.role === "admin" ? " · administrador" : ""}
          {self ? " · tú" : ""}
        </span>
      </span>
      <Button
        variant="ghost"
        size="icon"
        className="size-10"
        aria-label={`Nueva contraseña para ${user.username}`}
        disabled={pending}
        onClick={() => {
          const password = prompt(`Nueva contraseña para ${user.username} (10 caracteres o más):`);
          if (!password) return;
          start(async () => {
            const res = await resetPasswordAction(user.id, password);
            if (res.ok) toast.success("Contraseña actualizada; se cerraron sus sesiones.");
            else toast.error(res.error);
          });
        }}
      >
        <KeyRound className="size-4" />
      </Button>
      {!self && (
        <Button
          variant="ghost"
          size="icon"
          className="size-10 text-destructive"
          aria-label={`Eliminar a ${user.username}`}
          disabled={pending}
          onClick={() => {
            if (
              !confirm(
                `¿Eliminar a ${user.displayName}? Se borrará todo su estudio y no se puede deshacer.`,
              )
            )
              return;
            start(async () => {
              const res = await deleteUserAction(user.id);
              if (res.ok) toast.success("Usuario eliminado");
              else toast.error(res.error);
            });
          }}
        >
          <Trash2 className="size-4" />
        </Button>
      )}
    </li>
  );
}

export function CreateUserForm() {
  const [form, setForm] = useState({ username: "", displayName: "", password: "", admin: false });
  const [pending, start] = useTransition();
  return (
    <form
      className="space-y-3 rounded-2xl border bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await createUserAction(form);
          if (!res.ok) return void toast.error(res.error);
          toast.success(`Usuario «${form.username}» creado`);
          setForm({ username: "", displayName: "", password: "", admin: false });
        });
      }}
    >
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Usuario</span>
        <Input
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
          autoCapitalize="none"
          className="h-11 text-base"
          required
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Nombre para mostrar</span>
        <Input
          value={form.displayName}
          onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          className="h-11 text-base"
          required
        />
      </label>
      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Contraseña inicial (10 caracteres o más)</span>
        <Input
          type="password"
          autoComplete="new-password"
          minLength={10}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="h-11 text-base"
          required
        />
      </label>
      <label className="flex items-center justify-between rounded-lg border p-3">
        <span className="text-sm font-medium">Administrador</span>
        <Switch checked={form.admin} onCheckedChange={(admin) => setForm({ ...form, admin })} />
      </label>
      <Button type="submit" className="h-11 px-4" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : <UserPlus />} Crear usuario
      </Button>
    </form>
  );
}
