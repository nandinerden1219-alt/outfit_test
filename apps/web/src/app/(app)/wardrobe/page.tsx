import { PlusIcon, ShirtIcon } from "lucide-react";
import Link from "next/link";

import { BackendNotice } from "@/components/shared/backend-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { WardrobeGrid } from "@/components/wardrobe/wardrobe-grid";
import { ApiClientError, errorMessage } from "@/lib/api";
import { listWardrobeItems } from "@/services/wardrobe.service";
import type { ApiWardrobeItem } from "@/types/api-models";

export const metadata = { title: "Wardrobe" };

export default async function WardrobePage() {
  let items: ApiWardrobeItem[] = [];
  let error: { message: string; unreachable: boolean } | null = null;
  try {
    items = await listWardrobeItems();
  } catch (e) {
    error = { message: errorMessage(e), unreachable: e instanceof ApiClientError && e.unreachable };
  }

  const review = items.filter((i) => i.needs_review).length;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Wardrobe"
        description={
          items.length === 0
            ? "Everything you own, organised automatically."
            : `${items.length} item${items.length === 1 ? "" : "s"}${review ? ` · ${review} to check` : ""}`
        }
        actions={
          <Button asChild size="lg" className="rounded-full">
            <Link href="/wardrobe/add">
              <PlusIcon data-icon="inline-start" />
              Add clothes
            </Link>
          </Button>
        }
      />

      {error ? (
        <BackendNotice message={error.message} unreachable={error.unreachable} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ShirtIcon}
          title="No clothes yet"
          description="Upload 10–20 photos of your clothes. The background is removed and each piece is named, categorised and colour-tagged for you."
          action={
            <Button asChild>
              <Link href="/wardrobe/add">Add your clothes</Link>
            </Button>
          }
        />
      ) : (
        <WardrobeGrid items={items} />
      )}
    </div>
  );
}
