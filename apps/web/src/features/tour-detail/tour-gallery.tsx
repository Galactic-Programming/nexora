import Image from "next/image";

export function TourGallery({ images, title, emptyLabel }: { images: string[]; title: string; emptyLabel: string }) {
  return (
    <section id="gallery" className="mx-auto max-w-6xl px-4 py-12">
      <h2 className="font-heading mb-6 text-2xl font-semibold">{title}</h2>
      {images.length === 0 ? (
        <p className="text-muted-foreground py-8">{emptyLabel}</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {images.map((src) => (
            <div key={src} className="relative aspect-4/3 overflow-hidden rounded-xl">
              <Image src={src} alt="" fill className="object-cover" sizes="(max-width: 640px) 50vw, 33vw" />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
