"use client";

import { useId, useState } from "react";
import { Checkbox } from "@tourism/ui/components/legacy/checkbox";
import { Label } from "@tourism/ui/components/legacy/label";
import { Button } from "@tourism/ui/components/custom/button-custom";
import { ConfettiBurst } from "@tourism/ui/components/custom/confetti-burst";

export function ConfettiDemo() {
  const checkboxId = useId();
  const [checkBurst, setCheckBurst] = useState(0);
  const [buttonBurst, setButtonBurst] = useState(0);

  return (
    <div className="flex flex-wrap items-center gap-10">
      <div className="flex items-center gap-2">
        <div className="relative">
          <Checkbox
            id={checkboxId}
            onCheckedChange={(checked) =>
              checked && setCheckBurst((value) => value + 1)
            }
          />
          <ConfettiBurst trigger={checkBurst} />
        </div>
        <Label htmlFor={checkboxId}>Check to celebrate</Label>
      </div>

      <div className="relative">
        <Button
          variant="gradient"
          onClick={() => setButtonBurst((value) => value + 1)}
        >
          Book now 🎉
        </Button>
        <ConfettiBurst trigger={buttonBurst} count={20} spread={70} />
      </div>
    </div>
  );
}
