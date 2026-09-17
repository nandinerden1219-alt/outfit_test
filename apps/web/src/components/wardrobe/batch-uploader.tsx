"use client";

/* eslint-disable @next/next/no-img-element -- local object URLs for previews */

import { CheckIcon, ImagePlusIcon, Loader2Icon, RotateCcwIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ingestWardrobeImageAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ApiIngest } from "@/types/api-models";

/** How many images are processed at the same time. */
export const CONCURRENCY = 5;
export const MAX_FILES = 20;
export const MAX_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export type UploadStatus = "pending" | "processing" | "done" | "failed";

export type UploadEntry = {
  id: string;
  file: File;
  previewUrl: string;
  status: UploadStatus;
  result?: ApiIngest;
  error?: string;
};

export function validateFile(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) return "Only JPG, PNG or WEBP images.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_BYTES) return "Images must be 10 MB or smaller.";
  return null;
}

/**
 * Runs `worker` over `ids` with at most `limit` in flight. Progressive: each
 * item resolves on its own, and one failure never stops the others.
 */
export async function runWithConcurrency(ids: string[], limit: number, worker: (id: string) => Promise<void>) {
  const queue = [...ids];
  const lanes = Array.from({ length: Math.min(limit, queue.length) }, async () => {
    while (queue.length > 0) {
      const id = queue.shift();
      if (id === undefined) return;
      await worker(id);
    }
  });
  await Promise.all(lanes);
}

let counter = 0;

type BatchUploaderProps = {
  /** Injected for tests; defaults to the server action. */
  ingest?: (formData: FormData) => Promise<{ ok: true; data?: ApiIngest } | { ok: false; error: string }>;
};

export function BatchUploader({ ingest = ingestWardrobeImageAction }: BatchUploaderProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [entries, setEntries] = useState<UploadEntry[]>([]);
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [rejected, setRejected] = useState<string[]>([]);

  const previews = useRef<string[]>([]);
  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  const addFiles = useCallback((files: FileList | File[]) => {
    const problems: string[] = [];
    setEntries((current) => {
      const room = MAX_FILES - current.length;
      const next = [...current];
      for (const file of Array.from(files)) {
        if (next.length - current.length >= room) {
          problems.push(`Only ${MAX_FILES} images per batch — ${file.name} was skipped.`);
          continue;
        }
        const problem = validateFile(file);
        if (problem) {
          problems.push(`${file.name}: ${problem}`);
          continue;
        }
        const previewUrl = URL.createObjectURL(file);
        previews.current.push(previewUrl);
        next.push({ id: `u${++counter}`, file, previewUrl, status: "pending" });
      }
      return next;
    });
    setRejected(problems);
  }, []);

  const remove = (id: string) => setEntries((current) => current.filter((e) => e.id !== id));

  const update = (id: string, patch: Partial<UploadEntry>) =>
    setEntries((current) => current.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const processOne = useCallback(
    async (id: string, file: File) => {
      update(id, { status: "processing", error: undefined });
      const formData = new FormData();
      formData.append("image", file, file.name);
      try {
        const result = await ingest(formData);
        if (result.ok && result.data) update(id, { status: "done", result: result.data });
        else update(id, { status: "failed", error: result.ok ? "No result returned." : result.error });
      } catch {
        update(id, { status: "failed", error: "Something went wrong. Try again." });
      }
    },
    [ingest],
  );

  const start = async () => {
    const pending = entries.filter((e) => e.status === "pending" || e.status === "failed");
    if (pending.length === 0) return;
    setRunning(true);
    const byId = new Map(pending.map((e) => [e.id, e.file]));
    await runWithConcurrency([...byId.keys()], CONCURRENCY, (id) => processOne(id, byId.get(id) as File));
    setRunning(false);
    router.refresh();
  };

  const retry = async (entry: UploadEntry) => {
    setRunning(true);
    await processOne(entry.id, entry.file);
    setRunning(false);
    router.refresh();
  };

  const done = entries.filter((e) => e.status === "done").length;
  const failed = entries.filter((e) => e.status === "failed").length;
  const pending = entries.filter((e) => e.status === "pending").length;
  const processing = entries.filter((e) => e.status === "processing").length;
  const finished = entries.length > 0 && pending === 0 && processing === 0;
  const progress = entries.length ? Math.round(((done + failed) / entries.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <div
        role="button"
        tabIndex={0}
        aria-label="Add clothing photos"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed bg-card/60 px-6 py-12 text-center transition-colors",
          dragging ? "border-foreground bg-secondary" : "hover:border-foreground/40",
        )}
      >
        <span className="mb-3 flex size-12 items-center justify-center rounded-full bg-secondary">
          <ImagePlusIcon className="size-5" />
        </span>
        <p className="text-base font-medium">Drop photos here or tap to choose</p>
        <p className="mt-1 text-sm text-muted-foreground">
          JPG, PNG or WEBP · up to {MAX_FILES} at a time · one piece of clothing per photo
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(",")}
          multiple
          hidden
          data-testid="file-input"
          onChange={(e) => {
            if (e.target.files?.length) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {rejected.length > 0 && (
        <ul className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {rejected.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}

      {entries.length > 0 && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {running
                ? `Processing ${processing} of ${entries.length}…`
                : finished
                  ? `${done} added${failed ? `, ${failed} failed` : ""}`
                  : `${entries.length} photo${entries.length === 1 ? "" : "s"} ready`}
            </p>
            <div className="flex gap-2">
              {!running && !finished && (
                <Button variant="ghost" onClick={() => setEntries([])}>
                  Clear
                </Button>
              )}
              {finished ? (
                <>
                  {failed > 0 && (
                    <Button variant="outline" onClick={start}>
                      <RotateCcwIcon data-icon="inline-start" />
                      Retry failed
                    </Button>
                  )}
                  <Button asChild>
                    <Link href="/wardrobe">See my wardrobe</Link>
                  </Button>
                </>
              ) : (
                <Button size="lg" onClick={start} disabled={running || pending === 0}>
                  {running && <Loader2Icon className="animate-spin" />}
                  Add to Wardrobe
                </Button>
              )}
            </div>
          </div>

          {(running || finished) && <Progress value={progress} aria-label="Batch progress" />}

          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
            {entries.map((entry) => (
              <li key={entry.id} className="relative rounded-2xl border bg-card p-2" data-status={entry.status}>
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-secondary">
                  <img
                    src={entry.status === "done" && entry.result?.item.image_url ? entry.result.item.image_url : entry.previewUrl}
                    alt={entry.result?.item.label ?? entry.file.name}
                    className={cn("size-full", entry.status === "done" && entry.result?.background_removed ? "object-contain p-1" : "object-cover")}
                  />
                  {entry.status === "processing" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[1px]">
                      <Loader2Icon className="size-6 animate-spin" aria-label="Processing" />
                    </div>
                  )}
                  <span
                    className={cn(
                      "absolute left-2 top-2 flex size-6 items-center justify-center rounded-full text-[11px] font-semibold",
                      entry.status === "done" && "bg-foreground text-background",
                      entry.status === "failed" && "bg-destructive text-white",
                      entry.status === "processing" && "bg-card text-foreground",
                      entry.status === "pending" && "bg-card/90 text-muted-foreground",
                    )}
                    aria-label={entry.status}
                  >
                    {entry.status === "done" ? <CheckIcon className="size-3.5" /> : entry.status === "failed" ? "✕" : entry.status === "processing" ? "⏳" : "•"}
                  </span>
                </div>
                <p className="mt-2 truncate text-xs font-medium capitalize">
                  {entry.status === "done" ? entry.result?.item.label : entry.file.name}
                </p>
                {entry.status === "done" && entry.result?.needs_review && (
                  <p className="truncate text-[11px] text-brand">Check details</p>
                )}
                {entry.status === "failed" && (
                  <>
                    <p className="truncate text-[11px] text-destructive" title={entry.error}>
                      {entry.error}
                    </p>
                    <Button size="sm" variant="outline" className="mt-1.5 w-full" onClick={() => retry(entry)} disabled={running}>
                      Retry
                    </Button>
                  </>
                )}
                {entry.status === "pending" && !running && (
                  <button
                    type="button"
                    aria-label={`Remove ${entry.file.name}`}
                    onClick={() => remove(entry.id)}
                    className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full bg-card/90 shadow-sm"
                  >
                    <XIcon className="size-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
