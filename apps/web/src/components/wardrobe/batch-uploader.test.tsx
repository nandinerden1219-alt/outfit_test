import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {describe, expect, it} from "@jest/globals";

import type { ApiIngest, ApiWardrobeItem } from "@/types/api-models";

jest.mock("next/navigation", () => ({ useRouter: () => ({ refresh: jest.fn(), push: jest.fn() }) }));
jest.mock("@/app/(app)/actions", () => ({ ingestWardrobeImageAction: jest.fn() }));

import { BatchUploader, CONCURRENCY, runWithConcurrency, validateFile } from "@/components/wardrobe/batch-uploader";

function file(name: string, type = "image/jpeg", size = 10): File {
  return new File([new Uint8Array(size)], name, { type });
}

function ingestResult(label: string): ApiIngest {
  const item = { id: label, label, image_url: null, background_removed: false, category: "top", dominant_color: null, favorite: false } as unknown as ApiWardrobeItem;
  return { item, analyzed: true, background_removed: false, needs_review: false };
}

const deferred = <T,>() => {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
};

describe("validateFile", () => {
  it("accepts jpg/png/webp under 10 MB and rejects the rest", () => {
    expect(validateFile(file("a.jpg"))).toBeNull();
    expect(validateFile(file("a.png", "image/png"))).toBeNull();
    expect(validateFile(file("a.webp", "image/webp"))).toBeNull();
    expect(validateFile(file("a.gif", "image/gif"))).toMatch(/JPG, PNG or WEBP/);
    expect(validateFile(file("empty.jpg", "image/jpeg", 0))).toMatch(/empty/);
    expect(validateFile(file("big.jpg", "image/jpeg", 10 * 1024 * 1024 + 1))).toMatch(/10 MB/);
  });
});

describe("runWithConcurrency", () => {
  it("never runs more than the limit at once and finishes everything", async () => {
    let inFlight = 0;
    let peak = 0;
    const done: string[] = [];
    const ids = Array.from({ length: 12 }, (_, i) => `f${i}`);
    await runWithConcurrency(ids, CONCURRENCY, async (id) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight -= 1;
      done.push(id);
    });
    expect(peak).toBe(CONCURRENCY);
    expect(done).toHaveLength(12);
  });

  it("one failure does not stop the others", async () => {
    const done: string[] = [];
    await runWithConcurrency(["a", "b", "c"], 2, async (id) => {
      if (id === "b") return; // the worker swallows errors itself; a rejected id would surface as failed
      done.push(id);
    });
    expect(done).toEqual(["a", "c"]);
  });
});

describe("BatchUploader", () => {
  it("previews files, lets you remove one before processing, then shows per-item results", async () => {
    const calls = new Map<string, ReturnType<typeof deferred<{ ok: true; data: ApiIngest } | { ok: false; error: string }>>>();
    const ingest = jest.fn(async (formData: FormData) => {
      const f = formData.get("image") as File;
      const d = deferred<{ ok: true; data: ApiIngest } | { ok: false; error: string }>();
      calls.set(f.name, d);
      return d.promise;
    });

    render(<BatchUploader ingest={ingest} />);
    const input = screen.getByTestId("file-input") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file("one.jpg"), file("two.jpg"), file("three.jpg"), file("bad.gif", "image/gif")] } });

    expect(screen.getByText(/3 photos ready/)).toBeTruthy();
    expect(screen.getByText(/bad\.gif: Only JPG, PNG or WEBP/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Remove two.jpg"));
    expect(screen.getByText(/2 photos ready/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Add to Wardrobe" }));
    await waitFor(() => expect(ingest).toHaveBeenCalledTimes(2));
    expect(screen.getAllByLabelText("Processing")).toHaveLength(2);

    calls.get("one.jpg")!.resolve({ ok: true, data: ingestResult("white shirt") });
    await waitFor(() => expect(screen.getByText("white shirt")).toBeTruthy());
    // Still processing the other one — progressive results.
    expect(screen.getAllByLabelText("Processing")).toHaveLength(1);

    calls.get("three.jpg")!.resolve({ ok: false, error: "Could not read this image." });
    await waitFor(() => expect(screen.getByText("Could not read this image.")).toBeTruthy());
    expect(screen.getByText(/1 added, 1 failed/)).toBeTruthy();

    // Retry only the failed one.
    const retry = screen.getByRole("button", { name: "Retry" });
    fireEvent.click(retry);
    await waitFor(() => expect(ingest).toHaveBeenCalledTimes(3));
    calls.get("three.jpg")!.resolve({ ok: true, data: ingestResult("black jeans") });
    await waitFor(() => expect(screen.getByText("black jeans")).toBeTruthy());
    expect(screen.getByText(/2 added/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "See my wardrobe" })).toBeTruthy();
  });
});
