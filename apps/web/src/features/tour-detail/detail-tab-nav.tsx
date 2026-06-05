"use client";

export function DetailTabNav({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav className="border-border bg-background/90 sticky top-16 z-30 border-y backdrop-blur">
      <div className="mx-auto flex max-w-6xl gap-6 overflow-x-auto px-4 py-3">
        {items.map((it) => (
          <a key={it.href} href={it.href} className="text-muted-foreground hover:text-foreground text-sm font-medium whitespace-nowrap">
            {it.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
