import { Space_Grotesk, IBM_Plex_Mono } from "next/font/google";

const grotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-home" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-home-mono",
});

export default function Home() {
  return (
    <div
      className={`${grotesk.variable} ${mono.variable} min-h-screen w-full bg-[radial-gradient(circle_at_top,_#f6f1e8,_#e8ecf0_45%,_#d8dee6_80%)] text-slate-900`}
    >
      <main className="mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-16 pt-12">
        <header className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <span className="text-xs uppercase tracking-[0.4em] text-slate-500">
              Qashierwise Visual Atlas
            </span>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">
              Choose your view
              <span className="block text-slate-500">and dive deep.</span>
            </h1>
            <p className="max-w-xl text-lg text-slate-600">
              Navigate through database structure, CRM use-case overview, and
              process flow in one place.
            </p>
          </div>
          <div className="rounded-[28px] border border-white/60 bg-white/70 p-6 shadow-[0_30px_60px_-50px_rgba(15,23,42,0.6)]">
            <div className="text-xs uppercase tracking-[0.35em] text-slate-500">
              Quick links
            </div>
            <div className="mt-6 space-y-4 text-sm text-slate-600">
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <span className="font-semibold text-slate-800">/erd</span>
                <span className="font-[family:var(--font-home-mono)] text-xs text-slate-400">
                  schema explorer
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <span className="font-semibold text-slate-800">/usecase</span>
                <span className="font-[family:var(--font-home-mono)] text-xs text-slate-400">
                  zoomable image
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <span className="font-semibold text-slate-800">/flowchart</span>
                <span className="font-[family:var(--font-home-mono)] text-xs text-slate-400">
                  process map
                </span>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-3">
          <a
            href="/erd"
            className="group flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-[0_25px_55px_-45px_rgba(15,23,42,0.6)] transition hover:-translate-y-1 hover:border-amber-300"
          >
            <div className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Database
            </div>
            <h2 className="text-2xl font-semibold text-slate-900">ERD Explorer</h2>
            <p className="text-sm text-slate-600">
              Inspect tables, relations, and cardinality in an interactive
              layout.
            </p>
            <span className="text-sm font-semibold text-amber-600">
              Open /erd →
            </span>
          </a>

          <a
            href="/usecase"
            className="group flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-[0_25px_55px_-45px_rgba(15,23,42,0.6)] transition hover:-translate-y-1 hover:border-emerald-300"
          >
            <div className="text-xs uppercase tracking-[0.3em] text-slate-500">
              CRM Map
            </div>
            <h2 className="text-2xl font-semibold text-slate-900">Use Case</h2>
            <p className="text-sm text-slate-600">
              Zoom, pan, and read the CRM use-case diagram full screen.
            </p>
            <span className="text-sm font-semibold text-emerald-600">
              Open /usecase →
            </span>
          </a>

          <a
            href="/flowchart"
            className="group flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white/80 p-6 shadow-[0_25px_55px_-45px_rgba(15,23,42,0.6)] transition hover:-translate-y-1 hover:border-sky-300"
          >
            <div className="text-xs uppercase tracking-[0.3em] text-slate-500">
              Process
            </div>
            <h2 className="text-2xl font-semibold text-slate-900">Flowchart</h2>
            <p className="text-sm text-slate-600">
              Navigate the end-to-end flow visualization in one click.
            </p>
            <span className="text-sm font-semibold text-sky-600">
              Open /flowchart →
            </span>
          </a>
        </section>
      </main>
    </div>
  );
}
