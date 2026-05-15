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
    <main className="min-h-screen bg-cream">
      <section className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 lg:px-8">
        <nav className="flex items-center justify-between rounded border border-line bg-paper px-4 py-3 shadow-soft">
          <Link href="/" className="flex items-center gap-3" aria-label="FitProof home">
            <span className="grid size-9 place-items-center rounded bg-moss text-xs font-bold text-paper">FP</span>
            <span>
              <span className="block text-sm font-bold tracking-tight text-ink">FitProof</span>
              <span className="block text-xs text-slate">Market readiness workspace</span>
            </span>
          </Link>
          <Link
            href="/assessment"
            className="rounded bg-moss px-4 py-2 text-sm font-semibold text-paper transition hover:bg-blue-700"
          >
            Start assessment
          </Link>
        </nav>

        <div className="grid flex-1 gap-6 py-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div className="rounded border border-line bg-paper p-6 shadow-soft sm:p-8">
            <div>
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.16em] text-copper">Founder readiness console</p>
              <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight text-ink sm:text-5xl">
                FitProof Market Readiness Dashboard
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate">
                Turn early founder evidence into a structured Market Readiness report. FitProof evaluates Problem-Market Fit
                signals and Market Fit Likelihood without claiming product-market fit before usage, revenue, and retention data exist.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  ["3", "Core pages"],
                  ["6", "Scoring dimensions"],
                  ["0", "Database setup"]
                ].map(([value, label]) => (
                  <div key={label} className="rounded border border-line bg-cream px-4 py-3">
                    <p className="text-2xl font-bold text-ink">{value}</p>
                    <p className="text-xs font-medium text-slate">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/assessment"
                className="rounded bg-moss px-5 py-3 text-center text-sm font-bold text-paper shadow-soft transition hover:bg-blue-700"
              >
                Run assessment
              </Link>
              <Link
                href="/results"
                className="rounded border border-line bg-paper px-5 py-3 text-center text-sm font-bold text-ink transition hover:border-moss hover:text-moss"
              >
                Open saved report
              </Link>
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded border border-line bg-paper p-5 shadow-soft">
              <div className="flex flex-col justify-between gap-4 border-b border-line pb-4 sm:flex-row sm:items-start">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-copper">Report preview</p>
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-ink">Market Fit Likelihood</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate">
                    A board-ready snapshot of evidence quality, buyer urgency, budget clarity, competition, reach, and timing.
                  </p>
                </div>
                <div className="rounded border border-blue-100 bg-blue-50 px-5 py-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-moss">Score</p>
                  <p className="mt-1 text-4xl font-bold text-ink">72</p>
                  <p className="text-xs font-semibold text-copper">Strong signals</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3">
                {scoring.map(([label, points]) => (
                  <div key={label} className="grid grid-cols-[1fr_auto] items-center gap-3">
                    <span className="text-sm font-semibold text-ink">{label}</span>
                    <span className="text-sm tabular-nums text-slate">{points} pts</span>
                    <span className="col-span-2 h-2 overflow-hidden rounded-full bg-slate-100">
                      <span className="block h-full rounded-full bg-moss" style={{ width: `${Number(points) * 4}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["Assess", "Capture the ICP, problem, buyer, pricing, evidence, and timing."],
                ["Research", "Use web-assisted competitor discovery to add likely alternatives."],
                ["Report", "Generate an investor-ready Market Readiness readout."]
              ].map(([title, body]) => (
                <div key={title} className="rounded border border-line bg-paper p-4 shadow-soft">
                  <p className="text-sm font-bold text-ink">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
