import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { AuthGate } from '@/components/auth';
import { DashboardLayout } from '@/components/layout';
import '@/styles/globals.css';

const font = Plus_Jakarta_Sans({ subsets: ['latin'] });

const publicRoutes = ['/login', '/register'];

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isPublic = publicRoutes.includes(router.pathname);

  return (
    <main className={font.className}>
      {isPublic ? (
        <Component {...pageProps} />
      ) : (
        <AuthGate>
          <DashboardLayout>
            <Component {...pageProps} />
          </DashboardLayout>
        </AuthGate>
      )}
    </main>
  );
}
