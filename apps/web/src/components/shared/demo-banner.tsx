import { FlaskConicalIcon } from "lucide-react";

import { isDemoMode } from "@/lib/demo";

/** Always visible while NEXT_PUBLIC_DEMO_MODE=true so sample data is never mistaken for real data. */
export function DemoBanner() {
  if (!isDemoMode) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-brand px-4 py-2 text-center text-xs font-medium text-brand-foreground"
    >
      <FlaskConicalIcon className="size-3.5" />
      Demo mode — sample data, nothing is saved. Set up Supabase to use real accounts.
    </div>
  );
}
