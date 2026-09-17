"use client";

import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { updateName, updateProfile } from "@/app/onboarding/actions";
import { BasicsFields, ColorFields, LocationFields, MeasurementsFields, StyleFields } from "@/components/profile/fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AppUser, ProfileFormValues } from "@/types/user";

type ProfileFormProps = {
  user: AppUser;
  initialValues: ProfileFormValues;
};

export function ProfileForm({ user, initialValues }: ProfileFormProps) {
  const router = useRouter();
  const [values, setValues] = useState<ProfileFormValues>(initialValues);
  const [displayName, setDisplayName] = useState(user.display_name ?? "");
  const [saving, startSaving] = useTransition();
  const [savingName, startSavingName] = useTransition();

  const patch = (p: Partial<ProfileFormValues>) => setValues((prev) => ({ ...prev, ...p }));

  const save = () => {
    startSaving(async () => {
      const result = await updateProfile(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved.");
      router.refresh();
    });
  };

  const saveName = () => {
    startSavingName(async () => {
      const result = await updateName(displayName);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Saved.");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>{user.email}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="displayName">Name</Label>
            <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={60} />
          </div>
          <Button variant="outline" onClick={saveName} disabled={savingName || displayName.trim() === (user.display_name ?? "")}>
            {savingName && <Loader2Icon className="animate-spin" />}
            Update name
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Basics</CardTitle>
        </CardHeader>
        <CardContent>
          <BasicsFields values={values} onChange={patch} disabled={saving} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Measurements</CardTitle>
          <CardDescription>Optional, entered by you. AI estimates from photos are kept separately and labelled.</CardDescription>
        </CardHeader>
        <CardContent>
          <MeasurementsFields values={values} onChange={patch} disabled={saving} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Style</CardTitle>
        </CardHeader>
        <CardContent>
          <StyleFields values={values} onChange={patch} disabled={saving} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Colours</CardTitle>
        </CardHeader>
        <CardContent>
          <ColorFields values={values} onChange={patch} disabled={saving} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>Used only for the weather forecast.</CardDescription>
        </CardHeader>
        <CardContent>
          <LocationFields values={values} onChange={patch} disabled={saving} />
        </CardContent>
      </Card>

      {/* Sticky save bar keeps the primary action reachable on long forms. */}
      <div className="sticky bottom-24 z-10 flex justify-end lg:bottom-6">
        <Button size="lg" onClick={save} disabled={saving} className="shadow-lg">
          {saving && <Loader2Icon className="animate-spin" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
