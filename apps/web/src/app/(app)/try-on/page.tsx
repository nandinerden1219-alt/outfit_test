import { ShirtIcon } from "lucide-react";
import Link from "next/link";

import { TryOnStudio } from "@/components/tryon/tryon-studio";
import { BackendNotice } from "@/components/shared/backend-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ApiClientError, errorMessage } from "@/lib/api";
import { getBodyProfileSafe } from "@/services/body.service";
import { selectionFromItems, selectionFromOutfit, type Selection } from "@/lib/tryon-selection";
import { getOutfit } from "@/services/outfit.service";
import { getCachedTryOn } from "@/services/tryon.service";
import { listWardrobeItems } from "@/services/wardrobe.service";
import type { ApiBodyProfile, ApiOutfit, ApiTryOnJob, ApiWardrobeItem } from "@/types/api-models";

export const metadata = { title: "Try-On" };

function param(value: string | string[] | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

type Loaded =
  | { ok: true; items: ApiWardrobeItem[]; profile: ApiBodyProfile | null; outfit: ApiOutfit | null; selection: Selection; cached: ApiTryOnJob | null }
  | { ok: false; message: string; unreachable: boolean };

async function load(outfitId: string | null, itemIds: string[]): Promise<Loaded> {
  try {
    const [items, profile] = await Promise.all([listWardrobeItems(), getBodyProfileSafe()]);

    let outfit: ApiOutfit | null = null;
    if (outfitId) {
      try {
        outfit = await getOutfit(outfitId);
      } catch (e) {
        if (!(e instanceof ApiClientError && e.status === 404)) throw e;
      }
    }

    const byId = new Map(items.map((i) => [i.id, i]));
    const selection: Selection = outfit
      ? selectionFromOutfit(outfit)
      : selectionFromItems(itemIds.map((id) => byId.get(id)).filter((i): i is ApiWardrobeItem => Boolean(i)));
    const selected = Object.values(selection).filter((id): id is string => Boolean(id));

    // Reuse an existing result for this exact set instead of generating again.
    const cached = profile?.front_image_url && selected.length > 0 ? await getCachedTryOn(selected).catch(() => null) : null;
    return { ok: true, items, profile, outfit, selection, cached };
  } catch (e) {
    return { ok: false, message: errorMessage(e), unreachable: e instanceof ApiClientError && e.unreachable };
  }
}

/**
 * /try-on?outfit=<id>   — a generated or saved outfit
 * /try-on?items=a,b,c   — an ad-hoc set of wardrobe items
 * /try-on               — an empty rail; pick pieces slot by slot
 */
export default async function TryOnPage({ searchParams }: PageProps<"/try-on">) {
  const params = await searchParams;
  const outfitId = param(params.outfit);
  const itemIds = (param(params.items) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const loaded = await load(outfitId, itemIds);

  if (!loaded.ok) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Try-On" />
        <BackendNotice message={loaded.message} unreachable={loaded.unreachable} />
      </div>
    );
  }

  if (loaded.items.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Try-On" />
        <EmptyState
          icon={ShirtIcon}
          title="Nothing to try on yet"
          description="Add your clothes first, then generate outfits and see them on your own photo."
          action={
            <Button asChild>
              <Link href="/wardrobe/add">Add clothes</Link>
            </Button>
          }
        />
      </div>
    );
  }

  const { items, profile, outfit, selection, cached } = loaded;
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Try-On"
        description={
          outfit
            ? `“${outfit.name ?? "This outfit"}” on you. Swap any piece and see it again.`
            : "Put pieces together from your wardrobe and see the look on your photo."
        }
      />
      <TryOnStudio
        items={items}
        profile={profile}
        outfit={outfit}
        initialSelection={selection}
        initialJob={cached}
        occasion={outfit?.occasion ?? "casual"}
      />
    </div>
  );
}
