import { CheckIcon, CircleAlertIcon, TriangleAlertIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export type Verdict = "match" | "almost" | "mismatch";

const STYLE: Record<Verdict, { label: string; className: string; Icon: typeof CheckIcon }> = {
  match: { label: "Good match", className: "bg-foreground text-background", Icon: CheckIcon },
  almost: { label: "Almost", className: "bg-brand-soft text-brand", Icon: CircleAlertIcon },
  mismatch: { label: "Doesn't work", className: "bg-destructive/10 text-destructive", Icon: TriangleAlertIcon },
};

/** Quiet pill that says whether the current combination works for the occasion and weather. */
export function MatchBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  const { label, className: tone, Icon } = STYLE[verdict];
  return (
    <span role="status" className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium", tone, className)}>
      <Icon className="size-3.5" />
      {label}
    </span>
  );
}
