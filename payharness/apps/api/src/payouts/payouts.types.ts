export const PAYOUT_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SUCCEEDED',
  'FAILED',
  'CANCELED',
] as const;

export type PayoutStatus = (typeof PAYOUT_STATUSES)[number];
