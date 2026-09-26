import Head from 'next/head';
import Link from 'next/link';

export type LegalSection = { title: string; body: string[] };

export function LegalPage({ title, effectiveDate, intro, sections }: {
  title: string;
  effectiveDate: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <>
      <Head>
        <title>{title} — PayHarness</title>
        <meta name="description" content={intro} />
      </Head>
      <main className="min-h-screen bg-slate-50 px-6 py-14 text-slate-900">
        <article className="mx-auto max-w-4xl">
          <Link href="/" className="text-sm font-semibold text-blue-700">← PayHarness</Link>
          <header className="mt-8 border-b border-slate-200 pb-8">
            <h1 className="text-4xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-3 text-sm text-slate-500">Effective {effectiveDate}</p>
            <p className="mt-5 max-w-3xl text-base leading-7 text-slate-600">{intro}</p>
          </header>
          <div className="divide-y divide-slate-200">
            {sections.map((section) => (
              <section key={section.title} className="py-8">
                <h2 className="text-xl font-semibold">{section.title}</h2>
                <div className="mt-3 space-y-3 text-sm leading-7 text-slate-600">
                  {section.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                </div>
              </section>
            ))}
          </div>
          <footer className="border-t border-slate-200 py-8 text-sm text-slate-500">
            <Link href="/status" className="mr-5 hover:text-slate-900">System status</Link>
            <Link href="/security" className="mr-5 hover:text-slate-900">Security</Link>
            <Link href="/privacy" className="mr-5 hover:text-slate-900">Privacy</Link>
            <Link href="/terms" className="hover:text-slate-900">Terms</Link>
          </footer>
        </article>
      </main>
    </>
  );
}
