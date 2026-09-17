"use client";

import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { completeOnboarding } from "@/app/onboarding/actions";
import { makePhotoStep } from "@/components/onboarding/photo-step";
import { BasicsFields, ColorFields, LocationFields, MeasurementsFields, StyleFields, type FieldGroupProps } from "@/components/profile/fields";
import type { ApiBodyProfile } from "@/types/api-models";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import type { ProfileFormValues } from "@/types/user";

type Step = {
  id: string;
  title: string;
  description: string;
  Component: (props: FieldGroupProps) => React.JSX.Element;
  /** Returns an error message when the step can't be left yet. */
  validate?: (values: ProfileFormValues) => string | null;
  optional?: boolean;
};

const PROFILE_STEPS: Step[] = [
  {
    id: "basics",
    title: "Let's start with the basics",
    description: "Height, weight and gender give us a starting point. Nothing here is used to guess exact measurements.",
    Component: BasicsFields,
    validate: (v) => {
      if (v.heightCm === null || v.heightCm < 100 || v.heightCm > 250) return "Enter your height in centimetres (100–250).";
      if (v.weightKg === null || v.weightKg < 30 || v.weightKg > 300) return "Enter your weight in kilograms (30–300).";
      if (!v.gender) return "Choose an option for gender.";
      return null;
    },
  },
  {
    id: "measurements",
    title: "Know your measurements?",
    description: "Optional. Skip this if you don't — you can add them later or estimate them from photos.",
    Component: MeasurementsFields,
    optional: true,
  },
  {
    id: "style",
    title: "How do you like to dress?",
    description: "Pick the styles that feel like you and how you like clothes to sit.",
    Component: StyleFields,
    validate: (v) => (v.stylePreferences.length === 0 ? "Pick at least one style." : null),
  },
  {
    id: "colors",
    title: "Colours",
    description: "Tell us what you reach for and what you'd rather never wear.",
    Component: ColorFields,
    optional: true,
  },
  {
    id: "location",
    title: "Where are you?",
    description: "Needed for the daily forecast. You can add it later from your profile.",
    Component: LocationFields,
    optional: true,
  },
];

type OnboardingWizardProps = {
  initialValues: ProfileFormValues;
  firstName: string | null;
  /** Existing photo, if the user already added one. */
  bodyProfile?: ApiBodyProfile | null;
};

export function OnboardingWizard({ initialValues, firstName, bodyProfile = null }: OnboardingWizardProps) {
  const router = useRouter();
  const [values, setValues] = useState<ProfileFormValues>(initialValues);
  const [index, setIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  // Photo first: it is what every outfit is shown on. Optional, so nobody is blocked.
  const [STEPS] = useState<Step[]>(() => [
    {
      id: "photo",
      title: "Add a photo of yourself",
      description: "One full-body photo, facing the camera. Every outfit we suggest is shown on it. You can change it any time.",
      Component: makePhotoStep(bodyProfile),
      optional: true,
    },
    ...PROFILE_STEPS,
  ]);

  const step = STEPS[index] as Step;
  const isLast = index === STEPS.length - 1;
  const progress = Math.round(((index + 1) / STEPS.length) * 100);

  const patch = (p: Partial<ProfileFormValues>) => setValues((prev) => ({ ...prev, ...p }));

  const next = () => {
    const error = step.validate?.(values);
    if (error) {
      toast.error(error);
      return;
    }
    if (isLast) {
      finish();
      return;
    }
    setIndex((i) => i + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const finish = () => {
    startTransition(async () => {
      const result = await completeOnboarding(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("You're all set.");
      router.replace("/home");
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>
            Step {index + 1} of {STEPS.length}
          </span>
          <span>{progress}%</span>
        </div>
        <Progress value={progress} aria-label="Onboarding progress" />
      </div>

      <div>
        {index === 0 && firstName && <p className="mb-1 text-sm font-medium text-brand">Hi {firstName} 👋</p>}
        <h1 className="text-2xl font-semibold sm:text-3xl">{step.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base">{step.description}</p>
      </div>

      <step.Component values={values} onChange={patch} disabled={pending} />

      <div className="mt-2 flex items-center justify-between gap-3 border-t pt-6">
        <Button type="button" variant="ghost" onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0 || pending}>
          <ArrowLeftIcon data-icon="inline-start" />
          Back
        </Button>
        <div className="flex items-center gap-2">
          {step.optional && !isLast && (
            <Button type="button" variant="outline" onClick={() => setIndex((i) => i + 1)} disabled={pending}>
              Skip
            </Button>
          )}
          <Button type="button" size="lg" onClick={next} disabled={pending}>
            {pending ? <Loader2Icon className="animate-spin" /> : isLast ? <CheckIcon /> : null}
            {isLast ? "Finish" : "Continue"}
            {!isLast && !pending && <ArrowRightIcon data-icon="inline-end" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
