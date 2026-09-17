import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed bg-card/60 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-secondary text-foreground">
        <Icon className="size-5" />
      </div>
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

type PhaseNoticeProps = {
  phase: number;
  feature: string;
};

/**
 * Shown where a screen's real behaviour is scheduled for a later build phase.
 * Deliberately explicit so nothing is mistaken for a working feature.
 */
export function PhaseNotice({ phase, feature }: PhaseNoticeProps) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
      <span className="size-1.5 rounded-full bg-brand" aria-hidden />
      {feature} arrives in Phase {phase}
    </p>
  );
}
