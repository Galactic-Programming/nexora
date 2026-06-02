'use client';

import * as React from 'react';
import { CheckIcon, XIcon } from 'lucide-react';

import { cn } from '@tourism/ui/lib/utils';

/**
 * PasswordStrength — a controlled strength meter + requirement checklist.
 * Pass the current password `value`; optionally override `requirements`.
 * Compose it with PasswordInput or any input.
 *
 *   <PasswordStrength value={password} />
 */
interface PasswordRequirement {
  regex: RegExp;
  text: string;
}

const DEFAULT_REQUIREMENTS: PasswordRequirement[] = [
  { regex: /.{12,}/, text: 'At least 12 characters' },
  { regex: /[a-z]/, text: 'At least 1 lowercase letter' },
  { regex: /[A-Z]/, text: 'At least 1 uppercase letter' },
  { regex: /[0-9]/, text: 'At least 1 number' },
  {
    regex: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/,
    text: 'At least 1 special character',
  },
];

interface PasswordStrengthProps {
  value: string;
  requirements?: PasswordRequirement[];
  showChecklist?: boolean;
  className?: string;
}

function getBarColor(ratio: number): string {
  if (ratio <= 0) return 'bg-border';
  if (ratio <= 0.4) return 'bg-destructive';
  if (ratio <= 0.6) return 'bg-amber-500';
  if (ratio < 1) return 'bg-yellow-400';
  return 'bg-green-500';
}

function getLabel(score: number, ratio: number): string {
  if (score === 0) return 'Enter a password';
  if (ratio <= 0.4) return 'Weak password';
  if (ratio <= 0.7) return 'Medium password';
  if (ratio < 1) return 'Strong password';
  return 'Very strong password';
}

function PasswordStrength({
  value,
  requirements = DEFAULT_REQUIREMENTS,
  showChecklist = true,
  className,
}: PasswordStrengthProps) {
  const results = React.useMemo(
    () =>
      requirements.map((req) => ({
        met: req.regex.test(value),
        text: req.text,
      })),
    [requirements, value],
  );

  const score = results.filter((req) => req.met).length;
  const total = requirements.length;
  const ratio = total === 0 ? 0 : score / total;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex h-1 w-full gap-1">
        {Array.from({ length: total }).map((_, index) => (
          <span
            key={index}
            className={cn(
              'h-full flex-1 rounded-full transition-all duration-500 ease-out',
              index < score ? getBarColor(ratio) : 'bg-border',
            )}
          />
        ))}
      </div>

      <p className="text-foreground text-sm font-medium">
        {getLabel(score, ratio)}
        {showChecklist ? '. Must contain:' : null}
      </p>

      {showChecklist ? (
        <ul className="space-y-1.5">
          {results.map((req, index) => (
            <li key={index} className="flex items-center gap-2">
              {req.met ? (
                <CheckIcon className="size-4 text-green-600 dark:text-green-400" />
              ) : (
                <XIcon className="text-muted-foreground size-4" />
              )}
              <span
                className={cn(
                  'text-xs',
                  req.met
                    ? 'text-green-600 dark:text-green-400'
                    : 'text-muted-foreground',
                )}
              >
                {req.text}
                <span className="sr-only">
                  {req.met ? ' - Requirement met' : ' - Requirement not met'}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export { PasswordStrength, DEFAULT_REQUIREMENTS };
export type { PasswordStrengthProps, PasswordRequirement };
