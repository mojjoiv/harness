// Curated country -> currency list. Not the full ISO-3166 set, but covers
// the regions PayHarness is realistically onboarding merchants in
// (East/West/Southern Africa, North America, Europe, and other major
// markets). Add more entries here as new countries/currencies come up --
// no other code needs to change.
export interface CountryCurrency {
  country: string;
  countryCode: string;
  currency: string;
}

export const COUNTRY_CURRENCIES: CountryCurrency[] = [
  { country: 'Kenya', countryCode: 'KE', currency: 'KES' },
  { country: 'Nigeria', countryCode: 'NG', currency: 'NGN' },
  { country: 'Ghana', countryCode: 'GH', currency: 'GHS' },
  { country: 'South Africa', countryCode: 'ZA', currency: 'ZAR' },
  { country: 'Uganda', countryCode: 'UG', currency: 'UGX' },
  { country: 'Tanzania', countryCode: 'TZ', currency: 'TZS' },
  { country: 'Rwanda', countryCode: 'RW', currency: 'RWF' },
  { country: 'Egypt', countryCode: 'EG', currency: 'EGP' },
  { country: 'Ethiopia', countryCode: 'ET', currency: 'ETB' },
  { country: 'Zambia', countryCode: 'ZM', currency: 'ZMW' },
  { country: 'Ivory Coast', countryCode: 'CI', currency: 'XOF' },
  { country: 'Senegal', countryCode: 'SN', currency: 'XOF' },
  { country: 'Cameroon', countryCode: 'CM', currency: 'XAF' },
  { country: 'Morocco', countryCode: 'MA', currency: 'MAD' },
  { country: 'United States', countryCode: 'US', currency: 'USD' },
  { country: 'Canada', countryCode: 'CA', currency: 'CAD' },
  { country: 'United Kingdom', countryCode: 'GB', currency: 'GBP' },
  { country: 'Germany', countryCode: 'DE', currency: 'EUR' },
  { country: 'France', countryCode: 'FR', currency: 'EUR' },
  { country: 'Spain', countryCode: 'ES', currency: 'EUR' },
  { country: 'Italy', countryCode: 'IT', currency: 'EUR' },
  { country: 'Netherlands', countryCode: 'NL', currency: 'EUR' },
  { country: 'Ireland', countryCode: 'IE', currency: 'EUR' },
  { country: 'Switzerland', countryCode: 'CH', currency: 'CHF' },
  { country: 'Sweden', countryCode: 'SE', currency: 'SEK' },
  { country: 'Norway', countryCode: 'NO', currency: 'NOK' },
  { country: 'Denmark', countryCode: 'DK', currency: 'DKK' },
  { country: 'Poland', countryCode: 'PL', currency: 'PLN' },
  { country: 'United Arab Emirates', countryCode: 'AE', currency: 'AED' },
  { country: 'Saudi Arabia', countryCode: 'SA', currency: 'SAR' },
  { country: 'India', countryCode: 'IN', currency: 'INR' },
  { country: 'Pakistan', countryCode: 'PK', currency: 'PKR' },
  { country: 'Bangladesh', countryCode: 'BD', currency: 'BDT' },
  { country: 'China', countryCode: 'CN', currency: 'CNY' },
  { country: 'Japan', countryCode: 'JP', currency: 'JPY' },
  { country: 'South Korea', countryCode: 'KR', currency: 'KRW' },
  { country: 'Singapore', countryCode: 'SG', currency: 'SGD' },
  { country: 'Malaysia', countryCode: 'MY', currency: 'MYR' },
  { country: 'Indonesia', countryCode: 'ID', currency: 'IDR' },
  { country: 'Philippines', countryCode: 'PH', currency: 'PHP' },
  { country: 'Vietnam', countryCode: 'VN', currency: 'VND' },
  { country: 'Australia', countryCode: 'AU', currency: 'AUD' },
  { country: 'New Zealand', countryCode: 'NZ', currency: 'NZD' },
  { country: 'Brazil', countryCode: 'BR', currency: 'BRL' },
  { country: 'Mexico', countryCode: 'MX', currency: 'MXN' },
  { country: 'Argentina', countryCode: 'AR', currency: 'ARS' },
  { country: 'Colombia', countryCode: 'CO', currency: 'COP' },
];

export function currencyForCountry(countryCode: string): string {
  return COUNTRY_CURRENCIES.find((c) => c.countryCode === countryCode)?.currency || 'USD';
}
