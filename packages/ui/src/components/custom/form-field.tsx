'use client';

import type * as React from 'react';
import {
  Controller,
  type Control,
  type ControllerFieldState,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from '@tourism/ui/components/legacy/field';

/**
 * FormField — wraps react-hook-form's Controller together with the legacy
 * Field plumbing (label, description, invalid state, error) so a form field
 * is one declaration instead of ~12 lines of repeated boilerplate. Generic
 * form glue, reused by both customer and admin forms.
 *
 *   <FormField control={form.control} name="message" label="Message" description="...">
 *     {(field) => <Textarea {...field} id={field.name} />}
 *   </FormField>
 *
 * Pair with zod + @hookform/resolvers at the app level for schema validation.
 */
interface FormFieldProps<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
> {
  control: Control<TFieldValues>;
  name: TName;
  label?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  children: (
    field: ControllerRenderProps<TFieldValues, TName>,
    fieldState: ControllerFieldState,
  ) => React.ReactElement;
}

function FormField<
  TFieldValues extends FieldValues,
  TName extends FieldPath<TFieldValues>,
>({
  control,
  name,
  label,
  description,
  className,
  children,
}: FormFieldProps<TFieldValues, TName>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <Field className={className} data-invalid={fieldState.invalid || undefined}>
          {label ? <FieldLabel htmlFor={field.name}>{label}</FieldLabel> : null}
          {children(field, fieldState)}
          {description ? (
            <FieldDescription>{description}</FieldDescription>
          ) : null}
          {fieldState.invalid ? (
            <FieldError errors={[fieldState.error]} />
          ) : null}
        </Field>
      )}
    />
  );
}

export { FormField };
export type { FormFieldProps };
