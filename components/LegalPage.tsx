import Link from "next/link"
import { Mascot } from "@/components/Mascot"

type LegalSection = { title: string; text: string }

export function LegalPage({ title, intro, sections }: {
  title: string
  intro: string
  sections: LegalSection[]
}) {
  return (
    <article className="relative mx-auto max-w-3xl px-4 py-16 sm:py-20">
      <div className="pointer-events-none absolute -z-10 h-72 w-72 rounded-full bg-sunny-400/10 blur-3xl" aria-hidden="true" />
      <header className="mb-10 text-center">
        <Mascot mood="think" size={96} className="mx-auto mb-6" />
        <p className="mb-3 text-sm font-semibold text-gradient-warm">Dice Alley</p>
        <h1 className="font-display text-4xl font-bold text-white sm:text-5xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-xl leading-relaxed text-muted-foreground">{intro}</p>
      </header>
      <div className="space-y-4">
        {sections.map(({ title: heading, text }, index) => (
          <section key={heading} aria-labelledby={`section-${index}`} className="rounded-2xl border border-white/10 bg-white/5 p-6 sm:p-8">
            <h2 id={`section-${index}`} className="font-display text-xl font-bold text-white">{heading}</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">{text}</p>
          </section>
        ))}
      </div>
      <Link href="/" className="mt-8 inline-block rounded text-sm text-muted-foreground underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
        Back to Dice Alley
      </Link>
    </article>
  )
}
