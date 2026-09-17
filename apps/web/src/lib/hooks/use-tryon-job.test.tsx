import { act, renderHook } from "@testing-library/react";
import {afterEach, beforeEach, describe, expect, it} from "@jest/globals";

import type { ApiTryOnJob } from "@/types/api-models";

const tryOnJobAction = jest.fn<Promise<unknown>, unknown[]>();
jest.mock("@/app/(app)/actions", () => ({ tryOnJobAction: (...args: unknown[]) => tryOnJobAction(...args) }));

import { useTryOnJob } from "@/lib/hooks/use-tryon-job";

function job(overrides: Partial<ApiTryOnJob>): ApiTryOnJob {
  return {
    id: "job-1",
    outfit_id: null,
    item_ids: ["a", "b"],
    status: "queued",
    is_active: true,
    step: "Preparing your outfit…",
    progress: 5,
    result_image_url: null,
    person_image_url: null,
    applied: [],
    skipped: [],
    error: null,
    created_at: "2026-09-16T10:00:00Z",
    updated_at: "2026-09-16T10:00:00Z",
    ...overrides,
  };
}

describe("useTryOnJob", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    tryOnJobAction.mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("polls while active and stops once completed", async () => {
    tryOnJobAction
      .mockResolvedValueOnce({ ok: true, data: job({ status: "processing", step: "AI is dressing you…", progress: 45 }) })
      .mockResolvedValueOnce({
        ok: true,
        data: job({ status: "completed", is_active: false, step: "Completed", progress: 100, result_image_url: "https://x/r.png" }),
      });

    const { result } = renderHook(() => useTryOnJob(job({}), 1000));
    expect(result.current.isActive).toBe(true);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(tryOnJobAction).toHaveBeenCalledTimes(1);
    expect(result.current.job?.step).toBe("AI is dressing you…");

    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(tryOnJobAction).toHaveBeenCalledTimes(2);
    expect(result.current.job?.status).toBe("completed");
    expect(result.current.job?.result_image_url).toBe("https://x/r.png");
    expect(result.current.isActive).toBe(false);

    // Terminal: no further polling.
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });
    expect(tryOnJobAction).toHaveBeenCalledTimes(2);
  });

  it("does not poll for a failed or missing job", async () => {
    const { rerender } = renderHook(({ initial }) => useTryOnJob(initial, 1000), {
      initialProps: { initial: job({ status: "failed", is_active: false, error: "nope" }) as ApiTryOnJob | null },
    });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(tryOnJobAction).not.toHaveBeenCalled();

    rerender({ initial: null });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(3000);
    });
    expect(tryOnJobAction).not.toHaveBeenCalled();
  });

  it("stops polling when the component unmounts", async () => {
    tryOnJobAction.mockResolvedValue({ ok: true, data: job({ status: "processing", progress: 15 }) });
    const { unmount } = renderHook(() => useTryOnJob(job({}), 1000));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(tryOnJobAction).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(5000);
    });
    expect(tryOnJobAction).toHaveBeenCalledTimes(1);
  });

  it("surfaces a poll error only after repeated failures", async () => {
    tryOnJobAction.mockResolvedValue({ ok: false, error: "The API server is not running." });
    const { result } = renderHook(() => useTryOnJob(job({}), 1000));
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.pollError).toBeNull();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.pollError).toMatch(/not running/);
    expect(result.current.isActive).toBe(true); // still active: the user can keep waiting
  });

  it("setJob swaps to a new job and restarts polling", async () => {
    tryOnJobAction.mockResolvedValue({ ok: true, data: job({ id: "job-2", status: "completed", is_active: false }) });
    const { result } = renderHook(() => useTryOnJob(job({ status: "completed", is_active: false }), 1000));
    expect(result.current.isActive).toBe(false);

    act(() => result.current.setJob(job({ id: "job-2" })));
    expect(result.current.isActive).toBe(true);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(1000);
    });
    expect(tryOnJobAction).toHaveBeenCalledWith("job-2");
    expect(result.current.isActive).toBe(false);
  });
});
