import Head from 'next/head';
import { DeveloperSection, Features, Integrations, PaymentFlow, Problem, ProviderStrip, Solutions, SocialProof, FAQ } from '@/components/landing/Sections';
import { Footer } from '@/components/landing/Footer';
import { Hero } from '@/components/landing/Hero';
import { Navbar } from '@/components/landing/Navbar';

export default function IndexPage() {
  return (
    <>
      <Head>
        <title>PayHarness — Payments that work with your business</title>
        <meta
          name="description"
          content="Accept payments through one integration. PayHarness gives growing businesses a unified payment API, checkout, webhooks and transaction infrastructure."
        />
        <link rel="icon" href="https://raw.githubusercontent.com/mojjoiv/harness/main/logo_transparent.png" />
      </Head>
      <div className="min-h-screen bg-white text-slate-900">
        <Navbar />
        <main>
          <Hero />
          <ProviderStrip />
          <SocialProof />
          <Problem />
          <Solutions />
          <PaymentFlow />
          <Features />
          <DeveloperSection />
          <Integrations />
          <FAQ />
          <section id="pricing" className="bg-white">
            <div className="mx-auto max-w-7xl px-6 py-24 lg:px-8">
              <div className="mx-auto max-w-3xl text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#2563eb]">Pricing</p>
                <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-[#0b1f3a] sm:text-4xl">
                  Start simple. Scale when your payments do.
                </h2>
                <p className="mt-5 text-lg leading-8 text-slate-600">
                  Explore PayHarness in sandbox, connect the providers your business needs, and move to production when your integration is ready.
                </p>
                <div className="mt-8 flex flex-wrap justify-center gap-3">
                  <a href="/register" className="inline-flex rounded-lg bg-[#2563eb] px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#1d4ed8]">
                    Get started
                  </a>
                  <a href="/developers" className="inline-flex rounded-lg border border-slate-300 px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-950">
                    Explore the developer portal
                  </a>
                </div>
              </div>
            </div>
          </section>
          <section className="bg-[#f8fafc]">
            <div className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
              <div className="rounded-3xl bg-[#0b1f3a] px-7 py-12 text-white sm:px-12 lg:flex lg:items-center lg:justify-between lg:gap-12">
                <div className="max-w-2xl">
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-300">Ready when you are</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Give your customers a better way to pay.</h2>
                  <p className="mt-4 leading-7 text-slate-300">
                    Build your payment flow once, keep your customer experience in your hands, and let PayHarness handle the infrastructure underneath.
                  </p>
                </div>
                <div className="mt-7 flex shrink-0 flex-wrap gap-3 lg:mt-0">
                  <a href="/register" className="inline-flex rounded-lg bg-white px-5 py-3.5 text-sm font-semibold text-[#0b1f3a] transition hover:bg-slate-100">
                    Create your account
                  </a>
                  <a href="/developers" className="inline-flex rounded-lg border border-white/20 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-white/10">
                    Meet the developer tools
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
