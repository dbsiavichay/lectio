"use client";

import { Check, Loader2 } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { markReinforcedAction } from "@/features/study/actions";

export function ReinforceButton({ slug, unitId }: { slug: string; unitId: string }) {
  const [pending, start] = useTransition();
  return (
    <Button
      variant="secondary"
      className="h-10 px-3"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await markReinforcedAction(slug, unitId);
          if (!result.ok) toast.error(result.error);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" /> : <Check />}
      Ya releí
    </Button>
  );
}
