import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Badge, Button, Input, Panel, SectionTitle, StatCard } from '@/components/ui';

type Summary = {
  paymentCount: number;
  grossVolumeCents: number;
  successfulCount: number;
  successfulVolumeCents: number;
  failedCount: number;
  failedVolumeCents: number;
  refundCount: number;
  refundedVolumeCents: number;
  payoutCount: number;
  payoutVolumeCents: number;
  netVolumeCents: number;
  successRate: number;
};

type ProviderRow = {
  provider: string;
  paymentCount: number;
  grossVolumeCents: number;
  successfulCount: number;
  failedCount: number;
  successRate: number;
};

type CurrencyRow = {
  currency: string;
  grossVolumeCents: number;
  refundedVolumeCents: number;
  payoutVolumeCents: number;
  netVolumeCents: number;
};

type DailyRow = {
  date: string;
  grossVolumeCents: number;
  refundedVolumeCents: number;
  payoutVolumeCents: number;
  netVolumeCents: number;
};

type Report = {
  period: { startDate: string; endDate: string };
  summary: Summary;
  byProvider: ProviderRow[];
  byCurrency: CurrencyRow[];
  daily: DailyRow[];
  comparison?: {
    previousPeriod: { startDate: string; endDate: string };
    summary: Summary;
    changes: {
      grossVolumePct: number | null;
      successRatePoints: number | null;
      refundedVolumePct: number | null;
      payoutVolumePct: number | null;
      netVolumePct: number | null;
    };
  };
};

function dateValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

function initialRange() {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 29);
  return { startDate: dateValue(start), endDate: dateValue(end) };
}

function numberValue(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}

function centsValue(value: number) {
  return numberValue(value / 100);
}

function percentValue(value: number | null) {
  return value === null || !Number.isFinite(value) ? '—' : `${value.toFixed(2)}%`;
}

function changeLabel(value: number | null, suffix = '%') {
  if (value === null || !Number.isFinite(value)) return 'No comparison';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}${suffix}`;
}

export default function AnalyticsPage() {
  const range = useMemo(initialRange, []);
  const [startDate, setStartDate] = useState(range.startDate);
  const [endDate, setEndDate] = useState(range.endDate);
  const [compare, setCompare] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadReport(nextStart = startDate, nextEnd = endDate, nextCompare = compare) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        startDate: nextStart,
        endDate: nextEnd,
        compare: String(nextCompare),
      });
      const { data } = await api.get<Report>(`/analytics/advanced?${params.toString()}`);
      setReport(data);
    } catch (requestError) {
      setReport(null);
      setError(requestError instanceof ApiError ? requestError.message : 'Unable to load analytics.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    void loadReport();
  }

  const summary = report?.summary;
  const comparison = report?.comparison;
  const maxDaily = Math.max(...(report?.daily.map((row) => row.grossVolumeCents) || [0]), 1);

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Advanced analytics"
        description="Unified payment, refund, and payout performance for your merchant workspace."
      />

      <Panel className="p-4">
        <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto_auto] md:items-end" onSubmit={submit}>
          <label>
            <span className="mb-1 block text-sm font-medium text-ink">Start date</span>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label>
            <span className="mb-1 block text-sm font-medium text-ink">End date</span>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label className="flex items-center gap-2 pb-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={compare}
              onChange={(event) => setCompare(event.target.checked)}
              className="h-4 w-4 rounded border-line text-brand focus:ring-brand"
            />
            Compare previous period
          </label>
          <Button type="submit" disabled={loading}>
            {loading ? 'Loading…' : 'Apply filters'}
          </Button>
        </form>
      </Panel>

      {error ? (
        <Panel className="border-rose-200 bg-rose-50 p-4">
          <div className="text-sm font-medium text-rose-700">Analytics unavailable</div>
          <div className="mt-1 text-sm text-rose-600">{error}</div>
          <Button className="mt-3" variant="secondary" onClick={() => void loadReport()}>
            Retry
          </Button>
        </Panel>
      ) : null}

      {loading && !report ? (
        <Panel className="p-8 text-center text-sm text-muted">Loading advanced analytics…</Panel>
      ) : report && summary ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Gross volume"
              value={centsValue(summary.grossVolumeCents)}
              subtext={comparison ? changeLabel(comparison.changes.grossVolumePct) : 'Across all currencies'}
            />
            <StatCard
              label="Net volume"
              value={centsValue(summary.netVolumeCents)}
              subtext={comparison ? changeLabel(comparison.changes.netVolumePct) : 'Gross less refunds and payouts'}
            />
            <StatCard
              label="Payments"
              value={numberValue(summary.paymentCount)}
              subtext={`${numberValue(summary.successfulCount)} successful · ${numberValue(summary.failedCount)} failed`}
            />
            <StatCard
              label="Success rate"
              value={percentValue(summary.successRate)}
              subtext={comparison ? changeLabel(comparison.changes.successRatePoints, ' pts') : 'Current period'}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              label="Refunds"
              value={centsValue(summary.refundedVolumeCents)}
              subtext={`${numberValue(summary.refundCount)} refund${summary.refundCount === 1 ? '' : 's'}`}
            />
            <StatCard
              label="Payouts"
              value={centsValue(summary.payoutVolumeCents)}
              subtext={`${numberValue(summary.payoutCount)} payout${summary.payoutCount === 1 ? '' : 's'}`}
            />
            <StatCard
              label="Failed volume"
              value={centsValue(summary.failedVolumeCents)}
              subtext={`${numberValue(summary.failedCount)} failed payments`}
            />
          </div>

          {comparison ? (
            <Panel className="p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-ink">Period comparison</div>
                  <div className="mt-1 text-xs text-muted">
                    {comparison.previousPeriod.startDate} to {comparison.previousPeriod.endDate}
                  </div>
                </div>
                <Badge tone="blue">Previous period</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl bg-panelAlt p-3">
                  <div className="text-xs text-muted">Gross volume</div>
                  <div className="mt-1 font-semibold">{changeLabel(comparison.changes.grossVolumePct)}</div>
                </div>
                <div className="rounded-xl bg-panelAlt p-3">
                  <div className="text-xs text-muted">Success rate</div>
                  <div className="mt-1 font-semibold">{changeLabel(comparison.changes.successRatePoints, ' pts')}</div>
                </div>
                <div className="rounded-xl bg-panelAlt p-3">
                  <div className="text-xs text-muted">Refund volume</div>
                  <div className="mt-1 font-semibold">{changeLabel(comparison.changes.refundedVolumePct)}</div>
                </div>
                <div className="rounded-xl bg-panelAlt p-3">
                  <div className="text-xs text-muted">Payout volume</div>
                  <div className="mt-1 font-semibold">{changeLabel(comparison.changes.payoutVolumePct)}</div>
                </div>
              </div>
            </Panel>
          ) : null}

          <div className="grid gap-6 xl:grid-cols-2">
            <Panel className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-ink">Provider performance</div>
                  <div className="mt-1 text-xs text-muted">Payment volume and success by provider.</div>
                </div>
              </div>
              {report.byProvider.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-line text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-2 py-3 font-medium">Provider</th>
                        <th className="px-2 py-3 font-medium">Payments</th>
                        <th className="px-2 py-3 font-medium">Volume</th>
                        <th className="px-2 py-3 font-medium">Success</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byProvider.map((row) => (
                        <tr key={row.provider} className="border-b border-line last:border-0">
                          <td className="px-2 py-3 font-medium text-ink">{row.provider}</td>
                          <td className="px-2 py-3 text-muted">{numberValue(row.paymentCount)}</td>
                          <td className="px-2 py-3 text-muted">{centsValue(row.grossVolumeCents)}</td>
                          <td className="px-2 py-3">
                            <Badge tone={row.successRate >= 90 ? 'green' : row.successRate < 70 ? 'red' : 'blue'}>
                              {percentValue(row.successRate)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted">No provider data for this period.</div>
              )}
            </Panel>

            <Panel className="p-4">
              <div className="mb-4">
                <div className="text-sm font-semibold text-ink">Currency breakdown</div>
                <div className="mt-1 text-xs text-muted">Gross, refunds, payouts, and net volume by currency.</div>
              </div>
              {report.byCurrency.length ? (
                <div className="space-y-3">
                  {report.byCurrency.map((row) => (
                    <div key={row.currency} className="rounded-xl border border-line p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-semibold text-ink">{row.currency}</span>
                        <span className="text-sm font-medium">{centsValue(row.netVolumeCents)} net</span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted">
                        <div>
                          Gross
                          <br />
                          <span className="font-medium text-ink">{centsValue(row.grossVolumeCents)}</span>
                        </div>
                        <div>
                          Refunds
                          <br />
                          <span className="font-medium text-ink">{centsValue(row.refundedVolumeCents)}</span>
                        </div>
                        <div>
                          Payouts
                          <br />
                          <span className="font-medium text-ink">{centsValue(row.payoutVolumeCents)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-muted">No currency data for this period.</div>
              )}
            </Panel>
          </div>

          <Panel className="p-4">
            <div className="mb-4">
              <div className="text-sm font-semibold text-ink">Daily volume</div>
              <div className="mt-1 text-xs text-muted">Gross daily payment volume for the selected period.</div>
            </div>
            {report.daily.length ? (
              <div className="space-y-3">
                {report.daily.map((row) => (
                  <div key={row.date} className="grid grid-cols-[90px_1fr_100px] items-center gap-3 text-sm">
                    <span className="text-muted">{row.date}</span>
                    <div className="h-2 overflow-hidden rounded-full bg-panelAlt">
                      <div
                        className="h-full rounded-full bg-brand"
                        style={{ width: `${Math.max((row.grossVolumeCents / maxDaily) * 100, row.grossVolumeCents ? 2 : 0)}%` }}
                      />
                    </div>
                    <span className="text-right font-medium text-ink">{centsValue(row.grossVolumeCents)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted">No daily data for this period.</div>
            )}
          </Panel>

          <div className="text-xs text-muted">
            Reporting period: {report.period.startDate} to {report.period.endDate}. Monetary values are displayed from API cent amounts and are not converted between currencies.
          </div>
        </>
      ) : (
        <Panel className="p-8 text-center text-sm text-muted">No analytics data available for this period.</Panel>
      )}
    </div>
  );
}
