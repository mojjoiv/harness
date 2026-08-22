import type { AppContext, AppProps } from 'next/app';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { AuthGate } from '@/components/auth';
import { DashboardLayout } from '@/components/layout';
import '@/styles/globals.css';

const font = Plus_Jakarta_Sans({ subsets: ['latin'] });

const publicRoutes = ['/login', '/register', '/debug'];

type AppPageProps = AppProps & {
  pathname: string;
};

export default function App({ Component, pageProps, pathname }: AppPageProps) {
  const isPublic = publicRoutes.includes(pathname);
  const isPlatformRoute = pathname.startsWith('/platform');

  if (isPublic || isPlatformRoute) {
    return (
      <main className={font.className}>
        <Component {...pageProps} />
      </main>
    );
  }

  return (
    <main className={font.className}>
      <AuthGate>
        <DashboardLayout>
          <Component {...pageProps} />
        </DashboardLayout>
      </AuthGate>
    </main>
  );
}

App.getInitialProps = async ({ ctx, Component }: AppContext) => {
  const pageProps = Component.getInitialProps
    ? await Component.getInitialProps(ctx)
    : {};

  return {
    pageProps,
    pathname: ctx.pathname,
  };
};
