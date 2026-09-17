import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {beforeEach, describe, expect, it} from "@jest/globals";

import type { ApiOutfit, ApiWardrobeItem } from "@/types/api-models";

const setOutfitSavedAction = jest.fn<Promise<unknown>, unknown[]>();
const startTryOnAction = jest.fn<Promise<unknown>, unknown[]>();
jest.mock("@/app/(app)/actions", () => ({
  setOutfitSavedAction: (...args: unknown[]) => setOutfitSavedAction(...args),
  startTryOnAction: (...args: unknown[]) => startTryOnAction(...args),
  tryOnJobAction: jest.fn(),
  generateOutfitsAction: jest.fn(),
  cachedTryOnsAction: jest.fn(),
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }) }));
jest.mock("sonner", () => ({ toast: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }) }));

import type { cachedTryOnsAction, generateOutfitsAction } from "@/app/(app)/actions";
import { SWIPE_THRESHOLD_PX, SwipeDeck } from "@/components/deck/swipe-deck";

function item(id: string, slot: "top" | "bottom" | "shoes", label = id): ApiWardrobeItem {
  return { id, label, slot, category: slot, image_url: null, dominant_color: null, favorite: false, available: true, background_removed: false } as unknown as ApiWardrobeItem;
}

function outfit(id: string, name: string): ApiOutfit {
  return {
    id,
    name,
    occasion: "casual",
    style: null,
    weather: "sunny",
    temperature_c: 18,
    reasons: ["Suitable for 18°C"],
    score: 80,
    score_breakdown: null,
    saved: false,
    items: [
      { slot: "top", item: item(`${id}-t`, "top", `${name} top`) },
      { slot: "bottom", item: item(`${id}-b`, "bottom", `${name} bottom`) },
      { slot: "shoes", item: item(`${id}-s`, "shoes", `${name} shoes`) },
    ],
    created_at: "2026-09-16T10:00:00Z",
  };
}

const looks = [outfit("o1", "Alpha"), outfit("o2", "Beta"), outfit("o3", "Gamma")];

function renderDeck(overrides: Partial<React.ComponentProps<typeof SwipeDeck>> = {}) {
  const generate = jest.fn<ReturnType<typeof generateOutfitsAction>, Parameters<typeof generateOutfitsAction>>(async () => ({ ok: true as const, data: looks }));
  const cached = jest.fn<ReturnType<typeof cachedTryOnsAction>, Parameters<typeof cachedTryOnsAction>>(async () => ({ ok: true as const, data: {} }));
  const utils = render(<SwipeDeck live={null} hasPhoto wardrobeCount={12} generate={generate} cached={cached} {...overrides} />);
  return { ...utils, generate, cached };
}

describe("SwipeDeck", () => {
  beforeEach(() => {
    setOutfitSavedAction.mockReset();
    startTryOnAction.mockReset();
    setOutfitSavedAction.mockResolvedValue({ ok: true, data: { ...looks[0], saved: true } });
    sessionStorage.clear();
  });

  it("loads eight looks for the occasion and shows the first on top", async () => {
    const { generate } = renderDeck();
    await waitFor(() => expect(document.querySelector("[data-deck-card='o1']")).toBeTruthy());
    expect(generate).toHaveBeenCalledWith(expect.objectContaining({ occasion: "casual", count: 8 }));
    expect(screen.getByText("1 / 3", { exact: false })).toBeTruthy();
  });

  it("right arrow saves and advances; left skips; backspace undoes", async () => {
    renderDeck();
    await waitFor(() => expect(document.querySelector("[data-deck-card='o1']")).toBeTruthy());

    fireEvent.keyDown(window, { key: "ArrowRight" });
    await waitFor(() => expect(setOutfitSavedAction).toHaveBeenCalledWith("o1", true));
    await waitFor(() => expect(screen.getByText("2 / 3", { exact: false })).toBeTruthy());
    // a right swipe is celebrated, then dismissed
    expect(screen.getByRole("dialog", { name: "Saved" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep swiping" }));
    expect(screen.queryByRole("dialog", { name: "Saved" })).toBeNull();

    fireEvent.keyDown(window, { key: "ArrowLeft" });
    await waitFor(() => expect(screen.getByText("3 / 3", { exact: false })).toBeTruthy());
    expect(setOutfitSavedAction).toHaveBeenCalledTimes(1); // a skip saves nothing

    fireEvent.keyDown(window, { key: "Backspace" });
    await waitFor(() => expect(screen.getByText("2 / 3", { exact: false })).toBeTruthy());
  });

  it("a drag past the threshold counts as a swipe; a short drag snaps back", async () => {
    renderDeck();
    await waitFor(() => expect(document.querySelector("[data-deck-card='o1']")).toBeTruthy());
    const top = document.querySelector("[data-deck-card='o1']")!.parentElement as HTMLElement;
    top.setPointerCapture = jest.fn();

    fireEvent.pointerDown(top, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(top, { clientX: 140, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(top, { clientX: 140, clientY: 100, pointerId: 1 });
    expect(screen.getByText("1 / 3", { exact: false })).toBeTruthy(); // snapped back

    fireEvent.pointerDown(top, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(top, { clientX: 100 - SWIPE_THRESHOLD_PX - 20, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(top, { clientX: 100 - SWIPE_THRESHOLD_PX - 20, clientY: 100, pointerId: 1 });
    await waitFor(() => expect(screen.getByText("2 / 3", { exact: false })).toBeTruthy());
    expect(setOutfitSavedAction).not.toHaveBeenCalled();
  });

  it("swipe up asks to see the look on you; a tap flips the card's photo", async () => {
    startTryOnAction.mockResolvedValue({ ok: true, data: { id: "job-9", outfit_id: "o1", item_ids: [], status: "queued", is_active: true, step: "Preparing your outfit…", progress: 5, result_image_url: null, person_image_url: null, applied: [], skipped: [], error: null, created_at: "", updated_at: "" } });
    renderDeck();
    await waitFor(() => expect(document.querySelector("[data-deck-card='o1']")).toBeTruthy());
    const top = document.querySelector("[data-deck-card='o1']")!.parentElement as HTMLElement;
    top.getBoundingClientRect = () => ({ left: 0, width: 300, top: 0, height: 500, right: 300, bottom: 500, x: 0, y: 0, toJSON: () => ({}) });

    // tap right half → next "photo"
    fireEvent.pointerDown(top, { clientX: 250, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(top, { clientX: 250, clientY: 100, pointerId: 1 });
    expect(document.querySelector("[data-deck-card='o1']")!.getAttribute("data-view")).toBe("on-you");

    // swipe up → try-on starts, card stays
    fireEvent.pointerDown(top, { clientX: 150, clientY: 400, pointerId: 1 });
    fireEvent.pointerMove(top, { clientX: 150, clientY: 400 - SWIPE_THRESHOLD_PX - 30, pointerId: 1 });
    fireEvent.pointerUp(top, { clientX: 150, clientY: 400 - SWIPE_THRESHOLD_PX - 30, pointerId: 1 });
    await waitFor(() => expect(startTryOnAction).toHaveBeenCalledWith(["o1-t", "o1-b", "o1-s"], "o1"));
    expect(screen.getByText("1 / 3", { exact: false })).toBeTruthy();
  });

  it("shows the end card with a 'more looks' action that excludes what was seen", async () => {
    const { generate } = renderDeck();
    await waitFor(() => expect(document.querySelector("[data-deck-card='o1']")).toBeTruthy());
    for (let i = 0; i < 3; i++) {
      fireEvent.keyDown(window, { key: "ArrowLeft" });
      await act(async () => {
        await new Promise((r) => setTimeout(r, 350));
      });
    }
    await waitFor(() => expect(screen.getByText(/all for now/)).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /More looks/ }));
    await waitFor(() => expect(generate).toHaveBeenCalledTimes(2));
    expect(generate.mock.calls[1][0]).toMatchObject({ exclude: [["o1-t", "o1-b", "o1-s"], ["o2-t", "o2-b", "o2-s"], ["o3-t", "o3-b", "o3-s"]] });
  });

  it("'see it on me' starts a try-on for the top card", async () => {
    startTryOnAction.mockResolvedValue({
      ok: true,
      data: { id: "job-1", outfit_id: "o1", item_ids: ["o1-t", "o1-b", "o1-s"], status: "processing", is_active: true, step: "AI is dressing you…", progress: 45, result_image_url: null, person_image_url: null, applied: [], skipped: [], error: null, created_at: "", updated_at: "" },
    });
    renderDeck();
    await waitFor(() => expect(document.querySelector("[data-deck-card='o1']")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "See it on me" }));
    await waitFor(() => expect(startTryOnAction).toHaveBeenCalledWith(["o1-t", "o1-b", "o1-s"], "o1"));
    await waitFor(() => expect(screen.getByText("AI is dressing you…")).toBeTruthy());
  });

  it("asks for a photo instead of starting a try-on when there is none", async () => {
    renderDeck({ hasPhoto: false });
    await waitFor(() => expect(document.querySelector("[data-deck-card='o1']")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "See it on me" }));
    expect(startTryOnAction).not.toHaveBeenCalled();
    expect(screen.getByText(/Add your photo to see looks on you/)).toBeTruthy();
  });

  it("explains what to do with an empty wardrobe", () => {
    renderDeck({ wardrobeCount: 0 });
    expect(screen.getByText("Add your clothes first")).toBeTruthy();
  });
});
