import Link from 'next/link';
import { Panel } from '@/components/ui';

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <Panel className="w-full max-w-lg p-8 text-center">
        <div className="text-5xl font-bold tracking-tight text-brand">404</div>
        <h1 className="mt-4 text-xl font-semibold text-ink">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          The page you requested does not exist or may have moved.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90"
        >
          Back to dashboard
        </Link>
      </Panel>
    </main>
  );
}
