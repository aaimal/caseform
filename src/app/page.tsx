import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#14201c12_1px,transparent_1px),linear-gradient(to_bottom,#14201c12_1px,transparent_1px)] bg-size-[48px_48px]" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <span className="font-display text-xl tracking-tight">Caseform</span>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">
            Sign in
          </Link>
          <Link href="/signup" className="btn-primary">
            Get started
          </Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 pb-24 pt-10">
        <p className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-[var(--accent)]">
          For testers & test managers
        </p>
        <h1 className="font-display max-w-3xl text-5xl leading-[1.05] tracking-tight text-[var(--ink)] sm:text-6xl">
          Caseform
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-[var(--muted)]">
          Turn specifications into structured test cases — guided by your best
          manual examples, then refine with comments until they&apos;re ready to export.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/signup" className="btn-primary">
            Start free
          </Link>
          <Link href="/login" className="btn-ghost">
            I already have an account
          </Link>
        </div>

        <ul className="mt-16 grid max-w-3xl gap-4 sm:grid-cols-3">
          {[
            ["Exemplars", "Teach the AI with your gold-standard cases"],
            ["Brief", "Dial detail, coverage, and focus before generate"],
            ["Review", "Edit, comment, accept — then export CSV"],
          ].map(([title, copy]) => (
            <li key={title} className="panel p-4">
              <div className="font-display text-base">{title}</div>
              <p className="mt-1 text-sm text-[var(--muted)]">{copy}</p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
