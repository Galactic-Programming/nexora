"use client";

import { useState } from "react";
import { PhoneInput } from "@tourism/ui/components/custom/phone-input";

export function PhoneDemo() {
  const [phone, setPhone] = useState<string>();

  return (
    <div className="w-full max-w-xs space-y-2">
      <PhoneInput
        value={phone}
        onChange={setPhone}
        defaultCountry="VN"
        placeholder="Enter phone number"
      />
      <p className="text-muted-foreground text-xs">Value: {phone || "—"}</p>
    </div>
  );
}
