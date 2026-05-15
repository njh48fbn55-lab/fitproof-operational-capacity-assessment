import Link from "next/link";

const scoring = [
  ["Problem Evidence", "25"],
  ["Buyer Urgency", "20"],
  ["Budget Availability", "20"],
  ["Competitive Validation", "15"],
  ["ICP Reachability", "10"],
  ["Market Timing", "10"]
];

export default function LandingPage() {
  return (
    <main className="min-h-screen">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-5 py-6 sm:px-8 lg:px-10">
        <nav className="flex items-center justify-between border-b border-line/80 pb-5">
          <Link href="/" className="flex items-center gap-3" aria-label="FitProof home">
            <span className="grid size-10 place-items-center rounded bg-ink text-sm font-semibold text-paper">FP</span>
            <span className="text-lg font-semibold tracking-tight text-ink">FitProof</span>
          </Link>
          <Link
            href="/assessment"
            className="rounded bg-ink px-4 py-2 text-sm font-semibold text-paper transition hover:bg-moss"
          >
            Start assessment
          </Link>
        </nav>

        <div className="grid flex-1 items-center gap-12 py-14 lg:grid-cols-[1.02fr_0.98fr] lg:py-10">
          <div className="max-w-3xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.18em] text-copper">Market Readiness for early founders</p>
            <h1 className="font-serif text-5xl font-semibold leading-[0.98] text-ink sm:text-6xl lg:text-7xl">
              FitProof
            </h1>
            <p className="mt-6 max-w-2xl text-xl leading-8 text-slate">
              Assess Problem-Market Fit signals before you have customers. FitProof turns founder inputs into a structured,
              investor-ready Market Readiness report without overstating product-market fit.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/assessment"
                className="rounded bg-moss px-5 py-3 text-center text-sm font-bold text-paper shadow-soft transition hover:bg-ink"
              >
                Build my report
              </Link>
              <Link
                href="/results"
                className="rounded border border-line bg-paper px-5 py-3 text-center text-sm font-bold text-ink transition hover:border-moss"
              >
                View saved report
              </Link>
            </div>
          </div>

          <div className="border border-line bg-paper p-5 shadow-soft">
            <div className="border-b border-line pb-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-copper">Report preview</p>
                  <h2 className="mt-2 font-serif text-3xl font-semibold text-ink">Market Fit Likelihood</h2>
                </div>
                <div className="grid size-24 place-items-center rounded-full border-8 border-moss/20 text-3xl font-bold text-moss">
                  72
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate">
                Strong external signals, with validation gaps around budget ownership and repeatable ICP reach.
              </p>
            </div>
            <div className="mt-5 grid gap-3">
              {scoring.map(([label, points]) => (
                <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-4">
                  <span className="text-sm font-medium text-ink">{label}</span>
                  <span className="text-sm tabular-nums text-slate">{points} pts</span>
                  <span className="col-span-2 h-2 overflow-hidden rounded-full bg-cream">
                    <span className="block h-full rounded-full bg-moss" style={{ width: `${Number(points) * 4}%` }} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
