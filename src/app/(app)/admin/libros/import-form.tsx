"use client";

import { CheckCircle2, FileUp, Loader2, TriangleAlert, XCircle } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { importBookAction, type ImportResult } from "@/features/admin/actions";

export function ImportBookForm() {
  const form = useRef<HTMLFormElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, start] = useTransition();
  const [count, setCount] = useState(0);

  const run = (dryRun: boolean) =>
    start(async () => {
      if (!form.current) return;
      const res = await importBookAction(new FormData(form.current), dryRun);
      setResult(res);
      if (res.imported)
        toast.success(
          res.imported.changed
            ? `«${res.imported.title}» importado (versión ${res.imported.version})`
            : "El libro ya estaba al día",
        );
    });

  const stats = result?.report?.stats;
  return (
    <div className="space-y-4">
      <form
        ref={form}
        onSubmit={(e) => e.preventDefault()}
        className="space-y-3 rounded-2xl border bg-card p-4"
      >
        <p className="text-sm text-muted-foreground">
          Selecciona los archivos del paquete del libro: <code>lectio.book.json</code>, el índice de
          secciones y los archivos Markdown. Volver a importar un libro conserva todo lo que
          escribieron los usuarios.
        </p>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center hover:bg-muted/50">
          <FileUp className="size-8 text-primary" />
          <span className="font-medium">
            {count ? `${count} archivos seleccionados` : "Elegir archivos"}
          </span>
          <input
            name="files"
            type="file"
            multiple
            accept=".json,.md"
            className="sr-only"
            onChange={(e) => {
              setCount(e.target.files?.length ?? 0);
              setResult(null);
            }}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 px-4"
            disabled={pending || !count}
            onClick={() => run(true)}
          >
            {pending && <Loader2 className="animate-spin" />} Validar
          </Button>
          <Button
            type="button"
            className="h-11 px-4"
            disabled={pending || !result?.ok || Boolean(result.imported)}
            onClick={() => run(false)}
          >
            Importar
          </Button>
        </div>
      </form>

      {result && (
        <div className="space-y-3 rounded-2xl border bg-card p-4">
          <p className="flex items-center gap-2 font-medium">
            {result.ok ? (
              <CheckCircle2 className="size-5 text-success" />
            ) : (
              <XCircle className="size-5 text-destructive" />
            )}
            {result.error ??
              (result.imported
                ? "Importado"
                : result.ok
                  ? "Listo para importar"
                  : "Hay errores que corregir")}
          </p>
          {stats && (
            <p className="text-sm text-muted-foreground">
              {stats.parts} partes · {stats.chapters} capítulos · {stats.sessions} sesiones ·{" "}
              {stats.evaluations} evaluaciones · {stats.questions} preguntas · {stats.answers}{" "}
              respuestas ({stats.pendingAnswers} pendientes) · {stats.reviewCards} fichas ·{" "}
              {stats.references} referencias
            </p>
          )}
          {result.report?.errors.length ? (
            <ul className="space-y-1 text-sm text-destructive">
              {result.report.errors.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <XCircle className="mt-0.5 size-4 shrink-0" /> {e}
                </li>
              ))}
            </ul>
          ) : null}
          {result.report?.warnings.length ? (
            <ul className="space-y-1 text-sm text-warning-foreground">
              {result.report.warnings.map((w, i) => (
                <li key={i} className="flex gap-2">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {w}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}
