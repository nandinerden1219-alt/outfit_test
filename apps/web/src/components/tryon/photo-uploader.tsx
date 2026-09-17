"use client";

/* eslint-disable @next/next/no-img-element -- local previews and short-lived signed URLs */

import { CameraIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveBodyPhotosAction, uploadImageAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { useObjectUrl } from "@/lib/hooks/use-object-url";
import { cn } from "@/lib/utils";
import type { ApiBodyProfile } from "@/types/api-models";

export const PHOTO_REQUIREMENTS = [
  "Full body, standing straight, facing the camera",
  "Plain background and even light",
  "Fitted clothes — baggy layers hide your shape",
  "JPG, PNG or WEBP, up to 10 MB",
];

type PhotoUploaderProps = {
  profile: ApiBodyProfile | null;
  onSaved: (profile: ApiBodyProfile) => void;
  /** A small "Change photo" pill instead of the full card. */
  compact?: boolean;
};

/** Upload (or replace) the front photo that outfits are shown on. Saves straight away. */
export function PhotoUploader({ profile, onSaved, compact = false }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const preview = useObjectUrl(file);
  const [pending, startTransition] = useTransition();
  const current = profile?.front_image_url ?? null;

  const save = (chosen: File) => {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("image", chosen, chosen.name);
      const upload = await uploadImageAction("body-photos", formData);
      if (!upload.ok || !upload.data) {
        toast.error(upload.ok ? "Upload failed." : upload.error);
        return;
      }
      const saved = await saveBodyPhotosAction({ front_image_path: upload.data.path });
      if (!saved.ok || !saved.data) {
        toast.error(saved.ok ? "Could not save your photo." : saved.error);
        return;
      }
      setFile(null);
      onSaved(saved.data);
      toast.success("Photo saved.");
    });
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      hidden
      data-testid="photo-input"
      onChange={(e) => {
        const f = e.target.files?.[0] ?? null;
        e.target.value = "";
        if (!f) return;
        if (f.size > 10 * 1024 * 1024) {
          toast.error("Photos must be 10 MB or smaller.");
          return;
        }
        setFile(f);
        if (compact) save(f);
      }}
    />
  );

  if (compact) {
    return (
      <>
        {input}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-full bg-card/90 px-3 py-1.5 text-xs font-medium shadow-sm backdrop-blur disabled:opacity-60"
        >
          {pending ? <Loader2Icon className="size-3.5 animate-spin" /> : <CameraIcon className="size-3.5" />}
          {pending ? "Saving…" : "Change photo"}
        </button>
      </>
    );
  }

  const shown = preview ?? current;

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      {input}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        aria-label={shown ? "Replace your photo" : "Add your photo"}
        className={cn("studio relative flex aspect-[3/4] w-full shrink-0 items-center justify-center overflow-hidden rounded-2xl border sm:w-44")}
      >
        {shown ? <img src={shown} alt="Your photo" className="size-full object-cover" /> : <CameraIcon className="size-6 text-muted-foreground" />}
        {shown && <span className="absolute inset-x-0 bottom-0 bg-foreground/70 py-1 text-center text-[11px] text-background">Change</span>}
      </button>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{current ? "Your photo" : "Add a photo of yourself"}</p>
        <ul className="mt-2 flex flex-col gap-1 text-xs text-muted-foreground">
          {PHOTO_REQUIREMENTS.map((r) => (
            <li key={r} className="flex gap-2">
              <CheckIcon className="mt-0.5 size-3 shrink-0" />
              {r}
            </li>
          ))}
        </ul>
        {file ? (
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="rounded-full" onClick={() => save(file)} disabled={pending}>
              {pending && <Loader2Icon className="animate-spin" />}
              Use this photo
            </Button>
            <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setFile(null)} disabled={pending}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="mt-3 rounded-full" onClick={() => inputRef.current?.click()}>
            {current ? "Choose another photo" : "Choose photo"}
          </Button>
        )}
      </div>
    </div>
  );
}
