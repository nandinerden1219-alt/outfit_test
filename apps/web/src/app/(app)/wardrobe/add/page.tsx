import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { BatchUploader } from "@/components/wardrobe/batch-uploader";

export const metadata = { title: "Add clothes" };

export default function AddClothesPage() {
  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" className="self-start">
        <Link href="/wardrobe">
          <ArrowLeftIcon data-icon="inline-start" />
          Wardrobe
        </Link>
      </Button>
      <PageHeader
        title="Add clothes"
        description="Upload a batch of photos. Each one is cut out from its background and tagged with a name, category and colour."
      />
      <BatchUploader />
      <ul className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
        <li className="rounded-xl border bg-card px-4 py-3">One piece per photo, laid flat or on a hanger.</li>
        <li className="rounded-xl border bg-card px-4 py-3">Plain background and daylight give the cleanest cut-out.</li>
        <li className="rounded-xl border bg-card px-4 py-3">Anything we could not detect is marked “Check details”.</li>
      </ul>
    </div>
  );
}
