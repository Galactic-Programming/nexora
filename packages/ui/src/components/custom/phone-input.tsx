'use client';

import * as React from 'react';
import PhoneInputBase, {
  type Country,
  type Value,
} from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

import { cn } from '@tourism/ui/lib/utils';

/**
 * PhoneInput — country-aware phone field (react-phone-number-input +
 * libphonenumber). Renders a country selector with flags and stores the value
 * in E.164 format, ideal for international tour customers.
 *
 *   const [phone, setPhone] = useState<string>();
 *   <PhoneInput value={phone} onChange={setPhone} defaultCountry="VN" />
 *
 * The text field reuses the design-system input styling; the country select
 * picks up theme colors via CSS variables.
 */
const StyledPhoneField = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<'input'>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    data-slot="phone-input-field"
    className={cn(
      'h-9 w-full min-w-0 rounded-3xl border border-transparent bg-input/50 px-3 py-1 text-base transition-[color,box-shadow,background-color] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
      className,
    )}
    {...props}
  />
));
StyledPhoneField.displayName = 'StyledPhoneField';

interface PhoneInputProps {
  value?: string;
  onChange?: (value?: string) => void;
  defaultCountry?: Country;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

function PhoneInput({
  value,
  onChange,
  defaultCountry = 'VN',
  className,
  ...props
}: PhoneInputProps) {
  return (
    <PhoneInputBase
      international
      defaultCountry={defaultCountry}
      value={value as Value | undefined}
      onChange={(next?: Value) => onChange?.(next)}
      inputComponent={StyledPhoneField}
      className={cn(
        'flex items-center gap-2 [&_.PhoneInputCountrySelect]:outline-none [&_.PhoneInputCountryIcon]:rounded-sm',
        className,
      )}
      style={
        {
          '--PhoneInputCountrySelectArrow-color': 'var(--muted-foreground)',
          '--PhoneInput-color--focus': 'var(--ring)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { PhoneInput };
export type { PhoneInputProps };
export type { Country } from 'react-phone-number-input';
