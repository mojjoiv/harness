const COUNTRY_CURRENCY: Record<string, string> = {
  AE: 'AED', ARE: 'AED', AR: 'ARS', ARG: 'ARS', AU: 'AUD', AUS: 'AUD', AT: 'EUR', AUT: 'EUR',
  BD: 'BDT', BGD: 'BDT', BE: 'EUR', BEL: 'EUR', BR: 'BRL', BRA: 'BRL', CA: 'CAD', CAN: 'CAD',
  CH: 'CHF', CHE: 'CHF', CN: 'CNY', CHN: 'CNY', CO: 'COP', COL: 'COP', CI: 'XOF', CIV: 'XOF',
  CM: 'XAF', CMR: 'XAF', DE: 'EUR', DEU: 'EUR', DK: 'DKK', DNK: 'DKK', EG: 'EGP', EGY: 'EGP',
  ET: 'ETB', ETH: 'ETB', ES: 'EUR', ESP: 'EUR', FI: 'EUR', FIN: 'EUR', FR: 'EUR', FRA: 'EUR',
  GB: 'GBP', GBR: 'GBP', GH: 'GHS', GHA: 'GHS', GR: 'EUR', GRC: 'EUR', HK: 'HKD', HKG: 'HKD',
  ID: 'IDR', IDN: 'IDR', IE: 'EUR', IRL: 'EUR', IN: 'INR', IND: 'INR', IT: 'EUR', ITA: 'EUR',
  JP: 'JPY', JPN: 'JPY', KE: 'KES', KEN: 'KES', KR: 'KRW', KOR: 'KRW', MA: 'MAD', MAR: 'MAD',
  MX: 'MXN', MEX: 'MXN', MY: 'MYR', MYS: 'MYR', NG: 'NGN', NGA: 'NGN', NL: 'EUR', NLD: 'EUR',
  NO: 'NOK', NOR: 'NOK', NZ: 'NZD', NZL: 'NZD', PH: 'PHP', PHL: 'PHP', PK: 'PKR', PAK: 'PKR',
  PL: 'PLN', POL: 'PLN', PT: 'EUR', PRT: 'EUR', RW: 'RWF', RWA: 'RWF', SA: 'SAR', SAU: 'SAR',
  SE: 'SEK', SWE: 'SEK', SG: 'SGD', SGP: 'SGD', SN: 'XOF', SEN: 'XOF', TZ: 'TZS', TZA: 'TZS',
  UG: 'UGX', UGA: 'UGX', US: 'USD', USA: 'USD', VN: 'VND', VNM: 'VND', ZA: 'ZAR', ZAF: 'ZAR',
  ZM: 'ZMW', ZMB: 'ZMW',
};

const COUNTRY_NAME_CURRENCY: Record<string, string> = {
  ARGENTINA: 'ARS', AUSTRALIA: 'AUD', AUSTRIA: 'EUR', BANGLADESH: 'BDT', BELGIUM: 'EUR', BRAZIL: 'BRL',
  CANADA: 'CAD', CHINA: 'CNY', COLOMBIA: 'COP', 'IVORY COAST': 'XOF', CAMEROON: 'XAF', DENMARK: 'DKK',
  EGYPT: 'EGP', ETHIOPIA: 'ETB', FINLAND: 'EUR', FRANCE: 'EUR', GERMANY: 'EUR', GHANA: 'GHS', GREECE: 'EUR',
  INDIA: 'INR', INDONESIA: 'IDR', IRELAND: 'EUR', ITALY: 'EUR', JAPAN: 'JPY', KENYA: 'KES', MALAYSIA: 'MYR',
  MEXICO: 'MXN', MOROCCO: 'MAD', NETHERLANDS: 'EUR', NIGERIA: 'NGN', NORWAY: 'NOK', NEWZEALAND: 'NZD',
  PAKISTAN: 'PKR', PHILIPPINES: 'PHP', POLAND: 'PLN', PORTUGAL: 'EUR', RWANDA: 'RWF', 'SAUDI ARABIA': 'SAR',
  SENEGAL: 'XOF', SINGAPORE: 'SGD', SOUTHAFRICA: 'ZAR', 'SOUTH AFRICA': 'ZAR', SWEDEN: 'SEK', SWITZERLAND: 'CHF',
  TANZANIA: 'TZS', UGANDA: 'UGX', 'UNITED KINGDOM': 'GBP', 'UNITED STATES': 'USD', VIETNAM: 'VND', ZAMBIA: 'ZMW',
};

export function currencyForCountry(country: string | null | undefined): string {
  const normalized = (country || '').trim().toUpperCase();
  if (COUNTRY_CURRENCY[normalized]) return COUNTRY_CURRENCY[normalized];
  const compactName = normalized.replace(/[^A-Z]/g, '');
  if (COUNTRY_NAME_CURRENCY[normalized]) return COUNTRY_NAME_CURRENCY[normalized];
  if (COUNTRY_NAME_CURRENCY[compactName]) return COUNTRY_NAME_CURRENCY[compactName];
  return 'USD';
}
