import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { api } from '@/lib/api';
import { PaginationMeta, TransactionRecord } from '@/lib/types';
import { Button, Input, Panel, SectionTitle } from '@/components/ui';
import { FieldRow, FormGrid, Paginator, SimpleTable } from '@/components/blocks';
import { money, dateTime } from '@/lib/format';

type FilterValues = {
  status: string;
  provider: string;
  from: string;
  to: string;
};

export default function TransactionsPage() {
  const [items, setItems] = useState<TransactionRecord[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: 20, totalPages: 1 });
  const [page, setPage] = useState(1);
  const { register, handleSubmit } = useForm<FilterValues>({ defaultValues: { status: '', provider: '', from: '', to: '' } });
  const [filters, setFilters] = useState<FilterValues>({ status: '', provider: '', from: '', to: '' });

  const load = async (currentPage = page, currentFilters = filters) => {
    const params = new URLSearchParams();
    params.set('page', String(currentPage));
    params.set('limit', '20');
    if (currentFilters.status) params.set('status', currentFilters.status);
    if (currentFilters.provider) params.set('provider', currentFilters.provider);
    if (currentFilters.from) params.set('from', currentFilters.from);
    if (currentFilters.to) params.set('to', currentFilters.to);
    const { data, meta } = await api.get<TransactionRecord[]>(`/transactions?${params.toString()}`);
    setItems(data);
    setMeta(meta);
  };

  useEffect(() => {
    load();
  }, [page]);

  const onSubmit = async (values: FilterValues) => {
    setFilters(values);
    setPage(1);
    await load(1, values);
  };

  const rows = items.map((tx) => [
    tx.id,
    tx.provider,
    tx.status,
    tx.type,
    money(tx.amountCents, tx.currency),
    dateTime(tx.createdAt),
  ]);

  return (
    <div className="space-y-6">
      <SectionTitle title="Transactions" description="Filter and paginate merchant transactions." />
      <Panel className="p-6">
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <FormGrid>
            <FieldRow label="Status"><Input placeholder="SUCCEEDED" {...register('status')} /></FieldRow>
            <FieldRow label="Provider"><Input placeholder="MPESA" {...register('provider')} /></FieldRow>
            <FieldRow label="From"><Input type="date" {...register('from')} /></FieldRow>
            <FieldRow label="To"><Input type="date" {...register('to')} /></FieldRow>
          </FormGrid>
          <Button type="submit">Apply filters</Button>
        </form>
      </Panel>
      <SimpleTable headers={['ID', 'Provider', 'Status', 'Type', 'Amount', 'Created']} rows={rows} emptyText="No transactions yet." />
      <Paginator page={meta.page || page} totalPages={meta.totalPages || 1} onPrev={() => setPage((p) => Math.max(1, p - 1))} onNext={() => setPage((p) => p + 1)} />
    </div>
  );
}
