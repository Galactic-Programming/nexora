"use client";

import { useState } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Button } from "@tourism/ui/components/legacy/button";
import { Field, FieldLabel } from "@tourism/ui/components/legacy/field";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
} from "@tourism/ui/components/legacy/input-group";

interface PasswordFieldProps {
  id: string;
  label: string;
  autoComplete?: string;
  placeholder?: string;
  registration: UseFormRegisterReturn;
  /** Localized error message (already translated), or undefined when valid. */
  error?: string;
}

/** Password input with a show/hide toggle and a11y wiring. Shared by the
 *  sign-in / sign-up / reset forms. */
export function PasswordField({
  id,
  label,
  autoComplete,
  placeholder,
  registration,
  error,
}: PasswordFieldProps) {
  const t = useTranslations("Auth");
  const [showPw, setShowPw] = useState(false);
  const errorId = `${id}-error`;

  return (
    <Field className="w-full gap-2">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          type={showPw ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          {...registration}
        />
        <InputGroupAddon align="inline-end" className="pr-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-pressed={showPw}
            onClick={() => setShowPw((s) => !s)}
            className="text-muted-foreground hover:bg-transparent"
          >
            {showPw ? (
              <EyeOffIcon className="size-4" />
            ) : (
              <EyeIcon className="size-4" />
            )}
            <span className="sr-only">
              {showPw ? t("hidePassword") : t("showPassword")}
            </span>
          </Button>
        </InputGroupAddon>
      </InputGroup>
      {error ? (
        <p id={errorId} role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}
    </Field>
  );
}
