import type { Metadata } from 'next';
import '../globals.css';
import { I18nProvider } from '@/components/I18nProvider';
import { LOCALES, translator, type Locale } from '@/lib/i18n';
import { siteUrl } from '@/lib/site';
import { resolveLocale, type LocaleParams } from './params';

/**
 * Кореневий layout продукту: мова з адреси (`/uk/poland`, ADR-0003). Список
 * мов — реєстр словників, тож нова мова з'являється тут без правки маршрутів.
 * Невідома мова — 404, а не сторінка з ключами замість тексту.
 */
export const dynamicParams = false;

export function generateStaticParams(): { locale: Locale }[] {
  return LOCALES.map((locale) => ({ locale }));
}

// Назва береться з i18n, а не пишеться тут: те, що бачить користувач у вкладці,
// у пошуку й у шарингу, мусить збігатися з назвою в самому інтерфейсі.
// «Tax Navigator» лишається технічною назвою — репо, package.json, devcontainer.
// Картинку прев'ю Next підхоплює сам з `opengraph-image.png` поруч
// (рендер: `scripts/og/render.mjs`); абсолютну адресу дає `metadataBase`.
export async function generateMetadata({ params }: { params: LocaleParams }): Promise<Metadata> {
  const t = translator(await resolveLocale(params));
  return {
    metadataBase: siteUrl(process.env),
    title: t('app.title'),
    description: t('app.description'),
    openGraph: {
      type: 'website',
      locale: t('app.ogLocale'),
      siteName: t('app.title'),
      title: t('app.title'),
      description: t('app.lead'),
    },
    twitter: {
      card: 'summary_large_image',
      title: t('app.title'),
      description: t('app.lead'),
    },
  };
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: LocaleParams }) {
  const locale = await resolveLocale(params);
  return (
    <html lang={locale}>
      <body>
        <I18nProvider locale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
