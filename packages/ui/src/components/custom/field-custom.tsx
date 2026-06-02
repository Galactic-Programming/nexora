import type * as React from 'react';

import { FieldLabel as BaseFieldLabel } from '@tourism/ui/components/legacy/field';

/**
 * Field (custom) — re-exports the legacy field primitives and overrides
 * FieldLabel with two common form affordances:
 *
 * - `required` → a red `*` after the label (mandatory field).
 * - `hint`     → muted text aligned to the right of the label row (e.g.
 *                "Optional field").
 *
 *   <FieldLabel htmlFor="email" required>Email</FieldLabel>
 *   <FieldLabel htmlFor="phone" hint="Optional field">Phone</FieldLabel>
 *
 * Helper text below a field is already covered by the legacy FieldDescription.
 */
export {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
} from '@tourism/ui/components/legacy/field';

type FieldLabelProps = React.ComponentProps<typeof BaseFieldLabel> & {
  required?: boolean;
  hint?: React.ReactNode;
};

function FieldLabel({
  required = false,
  hint,
  children,
  ...props
}: FieldLabelProps) {
  const label = (
    <BaseFieldLabel {...props}>
      {children}
      {required ? (
        <span aria-hidden className="text-destructive">
          *
        </span>
      ) : null}
    </BaseFieldLabel>
  );

  if (!hint) {
    return label;
  }

  return (
    <div className="flex items-center justify-between gap-2">
      {label}
      <span className="text-muted-foreground text-xs">{hint}</span>
    </div>
  );
}

export { FieldLabel };
export type { FieldLabelProps };
