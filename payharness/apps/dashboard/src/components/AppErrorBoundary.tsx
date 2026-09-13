import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, Panel } from './ui';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('PayHarness dashboard error', error, info);
  }

  reset = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
          <Panel className="w-full max-w-lg p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-lg font-bold text-rose-700">
              !
            </div>
            <h1 className="mt-5 text-xl font-semibold text-ink">Something went wrong</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              The dashboard could not render this page. You can retry without losing your session.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={this.reset}>Try again</Button>
              <Button variant="secondary" onClick={() => window.location.reload()}>
                Reload page
              </Button>
            </div>
          </Panel>
        </div>
      );
    }

    return this.props.children;
  }
}
