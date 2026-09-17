import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import {beforeEach, describe, expect, it} from "@jest/globals";

import type { ApiBodyProfile, ApiTryOnJob, ApiWardrobeItem } from "@/types/api-models";
import type { OutfitSlot } from "@/types/database";

const startTryOnAction = jest.fn<Promise<unknown>, unknown[]>();
const saveCombinationAction = jest.fn<Promise<unknown>, unknown[]>();
jest.mock("@/app/(app)/actions", () => ({
  startTryOnAction: (...args: unknown[]) => startTryOnAction(...args),
  saveCombinationAction: (...args: unknown[]) => saveCombinationAction(...args),
  tryOnJobAction: jest.fn(),
  evaluateAction: jest.fn(async () => ({ ok: true, data: { verdict: "match", reasons: [], issues: [] } })),
  uploadImageAction: jest.fn(),
  saveBodyPhotosAction: jest.fn(),
}));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));

import { TryOnStudio } from "@/components/tryon/tryon-studio";
import { cycle, selectionFromItems } from "@/lib/tryon-selection";

function item(id: string, slot: OutfitSlot, label = id): ApiWardrobeItem {
  return {
    id,
    label,
    slot,
    category: slot === "layer" ? "top" : slot === "accessory" ? "accessory" : slot,
    image_url: null,
    dominant_color: null,
    favorite: false,
    available: true,
    background_removed: false,
  } as unknown as ApiWardrobeItem;
}

const items = [
  item("t1", "top", "white t-shirt"),
  item("t2", "top", "blue shirt"),
  item("b1", "bottom", "black jeans"),
  item("b2", "bottom", "beige chinos"),
  item("s1", "shoes", "sneakers"),
  item("o1", "outerwear", "wool coat"),
];

const profile = { id: "p", front_image_url: "https://x/me.jpg", front_image_path: "u/me.jpg" } as unknown as ApiBodyProfile;

function job(overrides: Partial<ApiTryOnJob>): ApiTryOnJob {
  return {
    id: "job-1",
    outfit_id: null,
    item_ids: ["t1", "b1", "s1"],
    status: "completed",
    is_active: false,
    step: "Completed",
    progress: 100,
    result_image_url: "https://x/result.png",
    person_image_url: "https://x/me.jpg",
    applied: ["white t-shirt", "black jeans"],
    skipped: ["sneakers"],
    error: null,
    created_at: "2026-09-16T10:00:00Z",
    updated_at: "2026-09-16T10:00:00Z",
    ...overrides,
  };
}

describe("cycle", () => {
  const tops = items.filter((i) => i.slot === "top");
  it("moves to the next / previous piece of the same kind and wraps", () => {
    expect(cycle(tops, "t1", 1)).toBe("t2");
    expect(cycle(tops, "t2", 1)).toBe("t1");
    expect(cycle(tops, "t1", -1)).toBe("t2");
    expect(cycle(tops, null, 1)).toBe("t1");
    expect(cycle([], "t1", 1)).toBeNull();
  });
});

describe("selectionFromItems", () => {
  it("keeps one item per slot", () => {
    expect(selectionFromItems([items[0], items[1], items[2]])).toEqual({ top: "t1", bottom: "b1" });
  });
});

describe("TryOnStudio", () => {
  beforeEach(() => {
    startTryOnAction.mockReset();
    saveCombinationAction.mockReset();
  });

  it("starts a job for the selected pieces and shows the friendly step", async () => {
    startTryOnAction.mockResolvedValue({ ok: true, data: job({ status: "processing", is_active: true, step: "AI is dressing you…", progress: 45, result_image_url: null }) });
    render(<TryOnStudio items={items} profile={profile} outfit={null} initialSelection={{ top: "t1", bottom: "b1", shoes: "s1" }} initialJob={null} occasion="casual" />);

    expect(screen.getByText("3 pieces")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /^See it on me$/i }));
    await waitFor(() => expect(startTryOnAction).toHaveBeenCalledWith(["t1", "b1", "s1"], null));
    await waitFor(() => expect(screen.getByText("AI is dressing you…")).toBeTruthy());
    expect(screen.getByLabelText("Try-on progress")).toBeTruthy();
  });

  it("reuses a cached result and only asks to regenerate after a swap", async () => {
    render(<TryOnStudio items={items} profile={profile} outfit={null} initialSelection={{ top: "t1", bottom: "b1", shoes: "s1" }} initialJob={job({})} occasion="casual" />);

    expect(screen.getByAltText("You wearing this outfit")).toBeTruthy();
    expect(screen.getByRole("button", { name: /^This is on you$/i }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByText(/Shown but not dressed: sneakers/)).toBeTruthy();

    // ▶ on the top row swaps t1 → t2 without calling anything.
    fireEvent.click(screen.getByLabelText("Next top"));
    expect(screen.getAllByText("blue shirt").length).toBeGreaterThan(0);
    expect(startTryOnAction).not.toHaveBeenCalled();
    expect(screen.getByText(/You changed the outfit/)).toBeTruthy();

    startTryOnAction.mockResolvedValue({ ok: true, data: job({ id: "job-2", item_ids: ["t2", "b1", "s1"] }) });
    fireEvent.click(screen.getByRole("button", { name: /See new look on me/ }));
    await waitFor(() => expect(startTryOnAction).toHaveBeenCalledWith(["t2", "b1", "s1"], null));
    await waitFor(() => expect(screen.queryByText(/You changed the outfit/)).toBeNull());
  });

  it("picks a piece from the swap dialog", () => {
    render(<TryOnStudio items={items} profile={profile} outfit={null} initialSelection={{ top: "t1", bottom: "b1" }} initialJob={null} occasion="casual" />);
    const bottomRow = document.querySelector("[data-slot-row='bottom']") as HTMLElement;
    expect(bottomRow.textContent).toContain("black jeans");
    fireEvent.click(bottomRow.querySelector("button[aria-label='Next bottom']") as HTMLElement);
    expect(bottomRow.textContent).toContain("beige chinos");
  });

  it("saves the current combination", async () => {
    saveCombinationAction.mockResolvedValue({ ok: true, data: { id: "o9", saved: true } });
    render(<TryOnStudio items={items} profile={profile} outfit={null} initialSelection={{ top: "t1", bottom: "b1" }} initialJob={null} occasion="work" />);
    fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
    await waitFor(() => expect(saveCombinationAction).toHaveBeenCalledWith(["t1", "b1"], "work", null));
    await waitFor(() => expect(screen.getByRole("button", { name: /Saved/ })).toBeTruthy());
  });

  it("shows a mismatch badge after a swap the rules reject", async () => {
    const evaluate = jest.fn(async () => ({ ok: true as const, data: { verdict: "mismatch" as const, reasons: [], issues: ["Sandals are not for snow"] } }));
    render(
      <TryOnStudio items={items} profile={profile} outfit={null} initialSelection={{ top: "t1", bottom: "b1" }} initialJob={null} occasion="casual" evaluate={evaluate} />,
    );
    fireEvent.click(screen.getByLabelText("Next top"));
    await waitFor(() => expect(evaluate).toHaveBeenCalledWith(["t2", "b1"], "casual", null));
    await waitFor(() => expect(screen.getByText("Doesn't work")).toBeTruthy());
    expect(screen.getByText(/Sandals are not for snow/)).toBeTruthy();
  });

  it("asks for a photo before generating", () => {
    render(<TryOnStudio items={items} profile={null} outfit={null} initialSelection={{ top: "t1" }} initialJob={null} occasion="casual" />);
    expect(screen.queryByRole("button", { name: /^See it on me$/i })).toBeNull();
    expect(screen.getAllByText("Add a photo of yourself").length).toBeGreaterThan(0);
  });
});
