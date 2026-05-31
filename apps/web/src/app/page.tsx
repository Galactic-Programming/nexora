import { Button } from "@tourism/ui/components/button";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="text-muted-foreground text-sm tracking-widest uppercase">
          Tourism Platform
        </span>
        <h1 className="text-foreground text-4xl font-semibold tracking-tight">
          Customer Web
        </h1>
        <p className="text-muted-foreground max-w-md">
          Shared design system from{" "}
          <code className="text-foreground">@tourism/ui</code>. Running on Next.js
          16.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button>Explore tours</Button>
        <Button variant="outline">Sign in</Button>
        <Button variant="secondary">Learn more</Button>
      </div>
    </main>
  );
}
