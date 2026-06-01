"use client";

export default function AboutPage() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto py-2">
      <header>
        <h1 className="text-2xl sm:text-3xl font-black">About this dashboard</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Methodology, sourcing, and error-correction protocol for live
          coverage of the 2026 Tamil Nadu Legislative Assembly elections.
        </p>
      </header>

      <section className="card p-5 space-y-3">
        <h2 className="text-lg font-bold">Data source</h2>
        <p className="text-sm leading-relaxed">
          Primary source is the Election Commission of India results portal at{" "}
          <span className="font-mono">results.eci.gov.in</span>. Constituency-
          level vote counts are scraped every 30 seconds during counting hours
          on May 4, 2026, from a server inside India (DigitalOcean Bangalore).
          A fallback layer of human operators monitors the same ECI feed plus
          news-channel calls and types corrections directly via the secure
          admin tools.
        </p>
        <p className="text-sm leading-relaxed">
          Candidate slates were ingested on May 1, 2026 from MyNeta
          (myneta.info/TamilNadu2026) — 232 of 234 ACs have verified
          2026-cycle candidate names; the remaining two are filled manually.
          Constituency boundaries follow the canonical 234-AC list (188 GEN
          + 44 SC + 2 ST).
        </p>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="text-lg font-bold">Update cadence</h2>
        <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
          <li>
            ECI scraper polls every constituency every ~30s. Updates flow
            into the dashboard in under 2 seconds via Server-Sent Events.
          </li>
          <li>
            Human-entered corrections (typed by a 5-person team on counting
            day) take immediate priority — the scraper is locked out from
            overwriting any AC for 5 minutes after a manual edit.
          </li>
          <li>
            Once an AC is declared {"“"}won{"”"}, only an explicit
            reset by a coordinator can un-call it. This prevents the scraper
            from flipping a settled seat back to {"“"}leading{"”"}.
          </li>
        </ul>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="text-lg font-bold">Error-correction protocol</h2>
        <p className="text-sm leading-relaxed">
          Every write is logged in an audit table with actor, source
          (manual / bulk / scraper / agent), prior value, new value, and
          IP. If a number on screen looks wrong, the on-air protocol is:
        </p>
        <ol className="text-sm leading-relaxed list-decimal pl-5 space-y-1">
          <li>Anchor announces {"“"}we{"’"}re verifying{"”"}.</li>
          <li>
            A coordinator opens the audit log for that AC, identifies the
            bad write, and either rolls back via the reset endpoint or
            overlays a manual correction.
          </li>
          <li>The dashboard updates within 2 seconds of the correction.</li>
        </ol>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="text-lg font-bold">Projection methodology</h2>
        <p className="text-sm leading-relaxed">
          The Swingometer applies a uniform-swing model: it takes the live
          DMK vs AIADMK vote-share gap, computes the swing vs 2021, and
          applies that swing to every other AC{"’"}s 2021 result. The
          projection is intentionally <em>suppressed</em> until ≥10% of ACs
          are reporting, because under that threshold a handful of Chennai
          early counts can extrapolate to nonsense (e.g. {"“"}DMK 229
          seats{"”"} from 7 ACs).
        </p>
        <p className="text-sm leading-relaxed">
          Vote-share percentages are similarly tagged as
          {" “"}early sample{"”"} until ≥30% of ACs report, and
          the seat-delta vs 2021 strip stays neutral until ≥40% report.
          These thresholds are set in <span className="font-mono">lib/data-progress.ts</span>.
        </p>
      </section>

      <section className="card p-5 space-y-3">
        <h2 className="text-lg font-bold">Alliances</h2>
        <p className="text-sm leading-relaxed">
          The four hero cards aggregate by alliance bloc, not raw party:
        </p>
        <ul className="text-sm leading-relaxed list-disc pl-5 space-y-1">
          <li><strong>INDIA</strong> — DMK, INC, VCK, MDMK, CPI, CPM (anchor: DMK)</li>
          <li><strong>NDA</strong> — AIADMK, BJP, PMK, DMDK (anchor: AIADMK)</li>
          <li><strong>TVK</strong> — solo (Vijay)</li>
          <li><strong>NTK</strong> — solo (Seeman)</li>
        </ul>
        <p className="text-sm leading-relaxed">
          Independents and other minor wins are surfaced separately in the
          map as a grey {"“"}Others{"”"} category.
        </p>
      </section>

      <section className="card p-5 space-y-2">
        <h2 className="text-lg font-bold">Production credits</h2>
        <p className="text-sm leading-relaxed">
          Coverage by <strong>Naadhas Media</strong> ({"“"}Voice of People{"”"}).
          Dashboard engineering by <strong>ProxyN.ai</strong>. Source
          available on request for journalist verification.
        </p>
      </section>
    </div>
  );
}
