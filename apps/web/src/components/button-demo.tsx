"use client";

import { useState } from "react";
import { TrashIcon, ZapIcon } from "lucide-react";
import { Button } from "@tourism/ui/components/custom/button-custom";

export function ButtonDemo() {
  const [loading, setLoading] = useState(false);

  const handleLoad = () => {
    setLoading(true);
    setTimeout(() => setLoading(false), 2000);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="gradient">Get Started</Button>
      <Button variant="gradient-destructive">
        <TrashIcon />
        Delete
      </Button>
      <Button variant="gradient-warning">
        Upgrade
        <ZapIcon />
      </Button>
      <Button loading={loading} onClick={handleLoad}>
        {loading ? "Saving…" : "Click to load"}
      </Button>
    </div>
  );
}
