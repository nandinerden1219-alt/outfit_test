"use client";

import { Loader2Icon } from "lucide-react";
import { useActionState } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ActionResult } from "@/types/api";

type Field = {
  name: string;
  label: string;
  type: "text" | "email" | "password";
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
};

type AuthFormProps = {
  action: (prev: ActionResult | null, formData: FormData) => Promise<ActionResult>;
  fields: Field[];
  submitLabel: string;
  hiddenFields?: Record<string, string>;
  footer?: React.ReactNode;
};

/** Shared email/password form used by login, signup and password reset screens. */
export function AuthForm({ action, fields, submitLabel, hiddenFields, footer }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, null);
  const fieldErrors = state && !state.ok ? state.fieldErrors ?? {} : {};

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      {hiddenFields &&
        Object.entries(hiddenFields).map(([name, value]) => <input key={name} type="hidden" name={name} value={value} />)}

      {fields.map((field) => (
        <div key={field.name} className="flex flex-col gap-2">
          <Label htmlFor={field.name}>{field.label}</Label>
          <Input
            id={field.name}
            name={field.name}
            type={field.type}
            autoComplete={field.autoComplete}
            placeholder={field.placeholder}
            aria-invalid={Boolean(fieldErrors[field.name])}
            aria-describedby={fieldErrors[field.name] ? `${field.name}-error` : undefined}
            required
          />
          {fieldErrors[field.name] ? (
            <p id={`${field.name}-error`} className="text-sm text-destructive">
              {fieldErrors[field.name]}
            </p>
          ) : (
            field.hint && <p className="text-xs text-muted-foreground">{field.hint}</p>
          )}
        </div>
      ))}

      {state && !state.ok && !state.fieldErrors && (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {state && state.ok && state.message && (
        <Alert>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending && <Loader2Icon className="animate-spin" />}
        {submitLabel}
      </Button>

      {footer}
    </form>
  );
}
