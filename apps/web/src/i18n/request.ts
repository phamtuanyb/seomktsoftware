import { getRequestConfig } from 'next-intl/server';

const DEFAULT_LOCALE = 'vi-VN';
const SUPPORTED_LOCALES = ['vi-VN', 'en-US'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export default getRequestConfig(async () => {
  // Single-locale build for MVP. The infrastructure is ready for `en-US`
  // (Section 2 principle 7), and switching is just a cookie + middleware away.
  const locale: Locale = DEFAULT_LOCALE;
  const messages = (await import(`./messages/${locale}.json`)).default;
  return { locale, messages };
});
