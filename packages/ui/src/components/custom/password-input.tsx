'use client';

import * as React from 'react';
import { EyeIcon, EyeOffIcon } from 'lucide-react';

import { Button } from '@tourism/ui/components/legacy/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@tourism/ui/components/legacy/input-group';

/**
 * PasswordInput — a password field with a built-in show/hide toggle.
 * `className` styles the group wrapper; all other props pass to the input.
 *
 *   <PasswordInput value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password" />
 */
type PasswordInputProps = Omit<
  React.ComponentProps<typeof InputGroupInput>,
  'type'
> & {
  className?: string;
};

function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = React.useState(false);

  return (
    <InputGroup className={className}>
      <InputGroupInput type={visible ? 'text' : 'password'} {...props} />
      <InputGroupAddon align="inline-end">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((prev) => !prev)}
          className="text-muted-foreground rounded-l-none hover:bg-transparent"
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      </InputGroupAddon>
    </InputGroup>
  );
}

export { PasswordInput };
export type { PasswordInputProps };
