import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PlatformPlansPage from '@/pages/platform/plans';
import { api } from '@/lib/api';

jest.mock('@/components/auth', () => ({
  PlatformAuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/layout', () => ({
  PlatformLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));

jest.mock('@/components/blocks', () => ({
  FieldRow: ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label>{label}{children}</label>
  ),
  FormGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SimpleTable: ({ headers, rows, emptyText }: { headers: string[]; rows: React.ReactNode[][]; emptyText: string }) => (
    <div>
      <div>{headers.map((header) => <span key={header}>{header}</span>)}</div>
      {rows.length ? rows.map((row, index) => <div key={index}>{row.map((cell, cellIndex) => <span key={cellIndex}>{cell}</span>)}</div>) : <div>{emptyText}</div>}
    </div>
  ),
}));

jest.mock('@/components/ui', () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Panel: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
  SectionTitle: ({ title, action }: { title: string; action?: React.ReactNode }) => <header><h1>{title}</h1>{action}</header>,
  Select: (props: React.SelectHTMLAttributes<HTMLSelectElement>) => <select {...props} />,
}));

jest.mock('@/lib/countries', () => ({
  COUNTRY_CURRENCIES: [{ countryCode: 'US', country: 'United States', currency: 'USD' }],
  currencyForCountry: () => 'USD',
}));

jest.mock('@/lib/format', () => ({
  money: (value: number, currency: string) => `${currency} ${value}`,
}));

jest.mock('@/lib/api', () => ({
  ApiError: class ApiError extends Error {},
  api: {
    get: jest.fn(),
    post: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

const plan = {
  id: 'plan-1',
  name: 'Starter',
  code: 'STARTER',
  countryCode: 'US',
  currency: 'USD',
  priceCents: 1000,
  annualPriceCents: 10000,
  apiRequestLimit: 1000,
  transactionLimit: 100,
  userLimit: 5,
  storageLimitMb: 100,
  webhookLimit: 10,
  status: 'ACTIVE',
  _count: { subscriptions: 0 },
};

describe('PlatformPlansPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApi.get.mockImplementation(async (path: string) => {
      if (path === '/platform/plans') return { data: [plan], meta: {} };
      return { data: { base: 'USD', rates: { USD: 1 } }, meta: {} };
    });
    mockedApi.post.mockResolvedValue({ data: plan, meta: {} });
    mockedApi.patch.mockResolvedValue({ data: plan, meta: {} });
  });

  it('loads plans and creates a plan through the API', async () => {
    render(<PlatformPlansPage />);

    expect(await screen.findByText('Starter')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Create Plan' }));

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Growth' } });
    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'GROWTH' } });
    fireEvent.change(screen.getByLabelText('Monthly Price (USD)'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Plan' }));

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledWith('/platform/plans', expect.objectContaining({
      name: 'Growth',
      code: 'GROWTH',
      priceCents: 2500,
      currency: 'USD',
    })));
  });

  it('suspends an active plan through the API', async () => {
    render(<PlatformPlansPage />);
    await screen.findByText('Starter');

    fireEvent.click(screen.getByRole('button', { name: 'Suspend' }));

    await waitFor(() => expect(mockedApi.patch).toHaveBeenCalledWith('/platform/plans/plan-1/suspend'));
  });
});
