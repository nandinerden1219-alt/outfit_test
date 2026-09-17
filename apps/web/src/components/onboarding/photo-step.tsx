"use client";

import { useState } from "react";

import { PhotoUploader } from "@/components/tryon/photo-uploader";
import type { FieldGroupProps } from "@/components/profile/fields";
import type { ApiBodyProfile } from "@/types/api-models";

/**
 * Onboarding step: the full-body photo outfits are shown on. Uploads and saves
 * immediately through the backend; the wizard itself only tracks profile fields.
 */
export function PhotoStep({ initialProfile }: { initialProfile: ApiBodyProfile | null }) {
  const [profile, setProfile] = useState(initialProfile);
  return (
    <div className="rounded-2xl border bg-card p-4">
      <PhotoUploader profile={profile} onSaved={setProfile} />
    </div>
  );
}

/** Adapter so the step fits the wizard's FieldGroupProps signature. */
export function makePhotoStep(initialProfile: ApiBodyProfile | null) {
  // The wizard passes field props to every step; this one has no fields.
  const PhotoStepField = (props: FieldGroupProps) => <PhotoStep initialProfile={initialProfile} key={props.disabled ? "busy" : "idle"} />;
  return PhotoStepField;
}
