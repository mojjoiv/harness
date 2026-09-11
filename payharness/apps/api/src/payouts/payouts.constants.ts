export const PAYOUT_RECIPIENT_TYPES = [
  'mobile_money',
  'bank_account',
  'card',
] as const;

export type PayoutRecipientType = (typeof PAYOUT_RECIPIENT_TYPES)[number];
