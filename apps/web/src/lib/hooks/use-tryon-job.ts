"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { tryOnJobAction } from "@/app/(app)/actions";
import type { ApiTryOnJob } from "@/types/api-models";

export const TRYON_JOB_POLL_MS = 3000;

/**
 * Tracks a virtual try-on job. Polls while the job is active, stops on any
 * terminal status (completed / failed) and when the component unmounts.
 * `pollMs` is overridable for tests.
 */
export function useTryOnJob(initial: ApiTryOnJob | null, pollMs: number = TRYON_JOB_POLL_MS) {
  const [job, setJob] = useState<ApiTryOnJob | null>(initial);
  const [pollError, setPollError] = useState<string | null>(null);
  const failures = useRef(0);

  const active = Boolean(job?.is_active);
  const jobId = job?.id ?? null;

  useEffect(() => {
    if (!active || !jobId) return;
    let cancelled = false;

    const tick = async () => {
      const result = await tryOnJobAction(jobId);
      if (cancelled) return;
      if (result.ok && result.data) {
        failures.current = 0;
        setPollError(null);
        setJob(result.data);
      } else if (!result.ok) {
        // Tolerate a couple of transient failures before surfacing them.
        failures.current += 1;
        if (failures.current >= 3) setPollError(result.error);
      }
    };

    const timer = setInterval(() => void tick(), pollMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [active, jobId, pollMs]);

  const reset = useCallback(() => {
    setJob(null);
    setPollError(null);
    failures.current = 0;
  }, []);

  return { job, setJob, pollError, reset, isActive: active };
}
