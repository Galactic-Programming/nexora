interface TourHeroProps { eyebrow: string; title: string; }

export function TourHero({ eyebrow, title }: TourHeroProps) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl bg-muted px-6 py-20 text-center sm:py-28">
      <span className="text-muted-foreground text-sm tracking-[0.3em] uppercase">{eyebrow}</span>
      <h1 className="font-heading mt-3 text-4xl font-semibold tracking-tight sm:text-6xl">{title}</h1>
    </section>
  );
}
