"use client";

import { Button } from "@tourism/ui/components/legacy/button";

/** Inert "continue with Google" button — visual seam for C3. Disabled with a
 *  title hint; no OAuth logic until C3 wires signInWithOAuth. */
export function GoogleButton({ label, soon }: { label: string; soon: string }) {
  return (
    <Button variant="outline" className="w-full" disabled title={soon} aria-disabled="true">
      {label}
    </Button>
  );
}
