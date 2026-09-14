import Head from 'next/head';
import { DeveloperSection, Features, Integrations, PaymentFlow, Problem, ProviderStrip } from '@/components/landing/Sections';
import { Footer } from '@/components/landing/Footer';
import { Hero } from '@/components/landing/Hero';
import { Navbar } from '@/components/landing/Navbar';

export default function IndexPage() {
  return (
    <>
      <Head>
        <title>PayHarness — Payment infrastructure without the provider headache</title>
        <meta
          name="description"
          content="Accept payments, manage transactions, handle webhooks and reconcile payment state through one reliable payment infrastructure platform."
        />
        <link rel="icon" href="https://raw.githubusercontent.com/mojjoiv/harness/main/logo_transparent.png" />
      </Head>
      <div className="min-h-screen bg-white text-slate-900">
        <Navbar />
        <main>
          <Hero />
          <ProviderStrip />
          <Problem />
          <PaymentFlow />
          <Features />
          <DeveloperSection />
          <Integrations />
          <section id="pricing" className="bg-white">
            <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2563eb]">Pricing</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#0b1f3a] sm:text-4xl">
                  Start with the infrastructure you need.
                </h2>
                <p className="mt-5 text-lg leading-8 text-slate-600">
                  Connect your account, configure your payment providers and build on the same platform as you grow.
                </p>
                <a href="/register" className="mt-8 inline-flex rounded-lg bg-[#2563eb] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]">
                  Get started
                </a>
              </div>
            </div>
          </section>
          <section className="bg-[#f8fafc]">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <div className="rounded-2xl bg-[#0b1f3a] px-7 py-12 text-white sm:px-12 lg:flex lg:items-center lg:justify-between lg:gap-12">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-300">Ready to build?</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">Put payments behind your product, not in its way.</h2>
                </div>
                <div className="mt-7 shrink-0 lg:mt-0">
                  <a href="/register" className="inline-flex rounded-lg bg-white px-5 py-3.5 text-sm font-semibold text-[#0b1f3a] transition hover:bg-slate-100">
                    Create your account
                  </a>
                </div>
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    </>
  );
}
