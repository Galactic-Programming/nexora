"use client";

import { useForm } from "react-hook-form";
import { Button } from "@tourism/ui/components/legacy/button";
import { Input } from "@tourism/ui/components/legacy/input";
import { FormField } from "@tourism/ui/components/custom/form-field";
import { PasswordInput } from "@tourism/ui/components/custom/password-input";
import { PasswordStrength } from "@tourism/ui/components/custom/password-strength";

type Values = { name: string; email: string; password: string };

export function FormDemo() {
  const form = useForm<Values>({
    defaultValues: { name: "", email: "", password: "" },
  });
  const password = form.watch("password");

  return (
    <form
      onSubmit={form.handleSubmit(() => {})}
      className="w-full max-w-sm space-y-5"
    >
      <FormField
        control={form.control}
        name="name"
        label="Full name"
        description="As it appears on your ID."
      >
        {(field) => <Input {...field} id={field.name} placeholder="Jane Doe" />}
      </FormField>

      <FormField control={form.control} name="email" label="Email">
        {(field) => (
          <Input
            {...field}
            id={field.name}
            type="email"
            placeholder="jane@example.com"
          />
        )}
      </FormField>

      <FormField control={form.control} name="password" label="Password">
        {(field) => (
          <PasswordInput {...field} id={field.name} placeholder="Password" />
        )}
      </FormField>

      <PasswordStrength value={password} />

      <Button type="submit">Create account</Button>
    </form>
  );
}
