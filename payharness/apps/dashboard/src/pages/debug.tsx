import { useState } from 'react';
import { ApiError, buildApiUrl } from '@/lib/api';
import { Button, Panel, SectionTitle } from '@/components/ui';

type DebugResult = {
  ok?: boolean;
  status?: number;
  statusText?: string;
  url?: string;
  body?: unknown;
  raw?: string;
  error?: {
    message: string;
    status?: number;
    code?: string;
  };
};

async function callRaw(path: string, init: RequestInit = {}): Promise<DebugResult> {
  const url = buildApiUrl(path);
  const headers = new Headers(init.headers || {});
  headers.set('Content-Type', headers.get('Content-Type') || 'application/json');

  const response = await fetch(url, {
    ...init,
    headers,
  });
  const raw = await response.text();
  let body: unknown = raw;

  try {
    body = raw ? JSON.parse(raw) : null;
  } catch {
    body = raw;
  }

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    url,
    body,
    raw,
  };
}

function toDebugError(error: unknown): DebugResult {
  if (error instanceof ApiError) {
    return {
      error: {
        message: error.message,
        status: error.status,
        code: error.code,
      },
    };
  }

  if (error instanceof TypeError && /failed to fetch|networkerror|load failed/i.test(error.message)) {
    return {
      error: {
        message: 'Network request failed. The API may be unreachable or blocked by CORS.',
        status: 0,
        code: 'NETWORK_ERROR',
      },
    };
  }

  return {
    error: {
      message: error instanceof Error ? error.message : 'Unknown debug request error',
    },
  };
}

export default function DebugPage() {
  const [loading, setLoading] = useState('');
  const [result, setResult] = useState<DebugResult | null>(null);

  const run = async (label: string, request: () => Promise<DebugResult>) => {
    setLoading(label);
    setResult(null);
    try {
      setResult(await request());
    } catch (error) {
      setResult(toDebugError(error));
    } finally {
      setLoading('');
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f6f7fb,white)] px-4 py-10">
      <Panel className="mx-auto max-w-3xl p-6">
        <SectionTitle title="API Debug" description="Direct dashboard to backend connectivity checks." />
        <div className="mb-4 rounded-xl bg-slate-50 px-3 py-2 text-sm text-muted">
          NEXT_PUBLIC_API_URL: {process.env.NEXT_PUBLIC_API_URL || 'not configured'}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => run('health', () => callRaw('/health'))} disabled={Boolean(loading)}>
            {loading === 'health' ? 'Testing health...' : 'Test Health'}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              run('login', () =>
                callRaw('/auth/login', {
                  method: 'POST',
                  body: JSON.stringify({ email: 'debug@example.com', password: 'debug-password' }),
                }),
              )
            }
            disabled={Boolean(loading)}
          >
            {loading === 'login' ? 'Testing login...' : 'Test Login Endpoint Shape'}
          </Button>
        </div>
        <pre className="mt-4 max-h-[520px] overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-white">
          {result ? JSON.stringify(result, null, 2) : 'No debug request run yet.'}
        </pre>
      </Panel>
    </div>
  );
}
