import React from 'react';
import { Panel } from './ui';

export function FieldRow({
  label,
  children,
  hint,
}: React.PropsWithChildren<{ label: string; hint?: string }>) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-ink">{label}</div>
      {children}
      {hint ? <div className="text-xs text-muted">{hint}</div> : null}
    </div>
  );
}

export function FormGrid({ children }: React.PropsWithChildren) {
  return <div className="grid gap-4 md:grid-cols-2">{children}</div>;
}

export function SimpleTable({
  headers,
  rows,
  emptyText = 'No records yet.',
}: {
  headers: string[];
  rows: React.ReactNode[][];
  emptyText?: string;
}) {
  if (!rows.length) {
    return <Panel className="p-6 text-sm text-muted">{emptyText}</Panel>;
  }

  return (
    <Panel className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-panelAlt text-muted">
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-3 font-medium">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-line">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 align-top text-ink">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function Paginator({
  page,
  totalPages,
  onPrev,
  onNext,
}: {
  page: number;
  totalPages: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-4 flex items-center justify-between">
      <div className="text-sm text-muted">
        Page {page} of {totalPages || 1}
      </div>
      <div className="flex gap-2">
        <button
          className="rounded-xl border border-line bg-white px-3 py-2 text-sm disabled:opacity-50"
          onClick={onPrev}
          disabled={page <= 1}
        >
          Previous
        </button>
        <button
          className="rounded-xl border border-line bg-white px-3 py-2 text-sm disabled:opacity-50"
          onClick={onNext}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}
