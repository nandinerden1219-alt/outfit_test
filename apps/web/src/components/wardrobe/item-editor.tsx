"use client";

import { CheckIcon, Loader2Icon, Trash2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteWardrobeItemAction, updateWardrobeItemAction } from "@/app/(app)/actions";
import { cleanItemValues, ItemForm, type ItemFormValues } from "@/components/wardrobe/item-form";
import { ItemTile } from "@/components/wardrobe/item-tile";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { ApiWardrobeItem } from "@/types/api-models";

function toFormValues(item: ApiWardrobeItem): ItemFormValues {
  return {
    name: item.name ?? "",
    category: item.category,
    subcategory: item.subcategory ?? "",
    pattern: item.pattern,
    dominant_color: item.dominant_color,
    secondary_colors: item.secondary_colors,
    material: item.material ?? "",
    season: item.season,
    warmth: item.warmth,
    style: item.style,
    fit: item.fit,
    formality: item.formality,
    occasions: item.occasions,
    layering: item.layering,
    rain_protection: item.rain_protection,
    wind_protection: item.wind_protection,
    brand: item.brand ?? "",
    size: item.size ?? "",
    favorite: item.favorite,
    available: item.available,
  };
}

export function ItemEditor({ item }: { item: ApiWardrobeItem }) {
  const router = useRouter();
  const [values, setValues] = useState<ItemFormValues>(toFormValues(item));
  const [saving, startSaving] = useTransition();
  const [deleting, startDeleting] = useTransition();

  const save = () => {
    startSaving(async () => {
      const result = await updateWardrobeItemAction(item.id, { ...cleanItemValues(values), needs_review: false });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Saved.");
      router.refresh();
    });
  };

  const remove = () => {
    startDeleting(async () => {
      const result = await deleteWardrobeItemAction(item.id);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Removed from your wardrobe.");
      router.push("/wardrobe");
      router.refresh();
    });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
      <div className="flex flex-col gap-4">
        <ItemTile item={{ ...item, favorite: values.favorite }} showLabel={false} className="rounded-3xl" />
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border bg-card px-3 text-sm">
          <Checkbox checked={values.available} onCheckedChange={(v) => setValues((s) => ({ ...s, available: v === true }))} />
          Available to wear
          <span className="ml-auto text-xs text-muted-foreground">Untick when it&apos;s in the wash or away</span>
        </label>
        {item.background_removed && <p className="text-xs text-muted-foreground">Background removed automatically.</p>}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" className="self-start">
              <Trash2Icon data-icon="inline-start" />
              Delete item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete this item?</DialogTitle>
              <DialogDescription>It will be removed from your wardrobe and from future outfits.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="destructive" onClick={remove} disabled={deleting}>
                {deleting && <Loader2Icon className="animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-col gap-6">
        <ItemForm values={values} onChange={(p) => setValues((v) => ({ ...v, ...p }))} disabled={saving} review={item.needs_review} />
        <div className="sticky bottom-24 flex justify-end lg:bottom-6">
          <Button size="lg" onClick={save} disabled={saving} className="shadow-lg">
            {saving ? <Loader2Icon className="animate-spin" /> : <CheckIcon />}
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}
