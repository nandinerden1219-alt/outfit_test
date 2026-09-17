import { HeartIcon } from "lucide-react";
import Link from "next/link";

import { SavedOutfitList } from "@/components/outfit/saved-outfit-list";
import { BackendNotice } from "@/components/shared/backend-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ApiClientError, errorMessage } from "@/lib/api";
import { getSavedOutfits } from "@/services/outfit.service";
import { getCachedTryOns } from "@/services/tryon.service";
import type { ApiOutfit, ApiTryOnJob } from "@/types/api-models";

export const metadata = { title: "Saved outfits" };

export default async function SavedOutfitsPage() {
  let outfits: ApiOutfit[] = [];
  let tryOns: Record<string, ApiTryOnJob | null> = {};
  let error: { message: string; unreachable: boolean } | null = null;
  try {
    outfits = await getSavedOutfits();
    tryOns = await getCachedTryOns(outfits.map((o) => ({ id: o.id, item_ids: o.items.map((i) => i.item.id) }))).catch(() => ({}));
  } catch (e) {
    error = { message: errorMessage(e), unreachable: e instanceof ApiClientError && e.unreachable };
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Saved outfits" description="Looks you swiped right on. Open one to see it on you again or swap a piece." />
      {error ? (
        <BackendNotice message={error.message} unreachable={error.unreachable} />
      ) : outfits.length === 0 ? (
        <EmptyState
          icon={HeartIcon}
          title="No saved outfits yet"
          description="Generate outfits, or build one in Try-On, and tap the heart to keep it here."
          action={
            <div className="flex gap-2">
              <Button asChild>
                <Link href="/outfits">Generate outfits</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/try-on">Open Try-On</Link>
              </Button>
            </div>
          }
        />
      ) : (
        <SavedOutfitList outfits={outfits} tryOns={tryOns} />
      )}
    </div>
  );
}
