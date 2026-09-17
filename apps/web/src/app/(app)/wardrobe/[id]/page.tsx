import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackendNotice } from "@/components/shared/backend-notice";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { ItemEditor } from "@/components/wardrobe/item-editor";
import { ApiClientError, errorMessage } from "@/lib/api";
import { humanize } from "@/lib/constants/fashion";
import { getWardrobeItem } from "@/services/wardrobe.service";

export const metadata = { title: "Edit item" };

export default async function WardrobeItemPage({ params }: PageProps<"/wardrobe/[id]">) {
  const { id } = await params;
  let item;
  try {
    item = await getWardrobeItem(id);
  } catch (e) {
    if (e instanceof ApiClientError && e.status === 404) notFound();
    return <BackendNotice message={errorMessage(e)} unreachable={e instanceof ApiClientError && e.unreachable} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" className="self-start">
        <Link href="/wardrobe">
          <ArrowLeftIcon data-icon="inline-start" />
          Wardrobe
        </Link>
      </Button>
      <PageHeader title={item.label} eyebrow={humanize(item.category)} />
      <ItemEditor item={item} />
    </div>
  );
}
