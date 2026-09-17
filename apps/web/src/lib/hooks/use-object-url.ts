"use client";

import { useEffect, useMemo } from "react";

/** Object URL for a local File, revoked automatically when the file changes. */
export function useObjectUrl(file: File | null | undefined): string | null {
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);
  return url;
}
