import { ArrowRightIcon, CameraIcon, LayersIcon, ShirtIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";

import { Brand } from "@/components/shared/brand";
import { Button } from "@/components/ui/button";

const pillars = [
  { icon: CameraIcon, title: "Add your photo", text: "One full-body photo when you sign up. Every outfit is shown on it." },
  { icon: ShirtIcon, title: "Upload your clothes", text: "Drop in 10–20 photos. Backgrounds are removed and every piece is named, categorised and colour-tagged." },
  { icon: LayersIcon, title: "Get today’s looks", text: "Where you are going + today’s weather → a feed of outfit collages, matched from your own wardrobe." },
  { icon: SparklesIcon, title: "See it on you", text: "Tap a look to see it on your photo. Swap a piece, see it again, save what you love." },
];

/** Signed-out landing page. Signed-in users are redirected to /home by the proxy. */
export default function LandingPage() {
  return (
    <div className="flex min-h-svh flex-col bg-canvas">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <Brand />
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Get started</Link>
          </Button>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 pb-20 sm:px-8">
        <section className="pt-14 sm:pt-24">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
            <span className="size-1.5 rounded-full bg-brand" aria-hidden />
            AI outfit recommendations + virtual try-on
          </p>
          <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Know what to wear. <span className="text-muted-foreground">See it on you first.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Upload your wardrobe, get outfit combinations for the day you actually have, and see each one on your own
            photo before you get dressed.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/signup">
                Start with your wardrobe
                <ArrowRightIcon data-icon="inline-end" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full">
              <Link href="/login">I already have an account</Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 grid gap-4 sm:mt-28 sm:grid-cols-2">
          {pillars.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-3xl border bg-card p-6">
              <div className="mb-4 flex size-10 items-center justify-center rounded-full bg-secondary">
                <Icon className="size-5" />
              </div>
              <h2 className="text-base font-semibold">{title}</h2>
              <p className="mt-1.5 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </section>

        <p className="mt-16 text-center text-sm text-muted-foreground">
          Upload → organise → mix &amp; match → try on → swap → save.
        </p>
      </main>
    </div>
  );
}
