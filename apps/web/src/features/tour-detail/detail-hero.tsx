import Image from "next/image";

export function DetailHero({ image, eyebrow, title }: { image?: string; eyebrow: string; title: string }) {
  return (
    <section className="relative isolate flex min-h-[42vh] items-center justify-center overflow-hidden">
      {image && <Image src={image} alt="" fill priority className="-z-10 object-cover" sizes="100vw" />}
      <div className="absolute inset-0 -z-10 bg-black/35" />
      <div className="px-4 text-center text-white">
        <span className="text-sm tracking-[0.3em] uppercase opacity-90">{eyebrow}</span>
        <h1 className="font-heading mt-2 text-4xl font-semibold sm:text-6xl">{title}</h1>
      </div>
    </section>
  );
}
