import type { Metadata } from "next";
import "./globals.css";
import { t } from "@/lib/i18n/uk";

// Назва береться з i18n, а не пишеться тут: те, що бачить користувач у вкладці,
// у пошуку й у шарингу, мусить збігатися з назвою в самому інтерфейсі.
// «Tax Navigator» лишається технічною назвою — репо, package.json, devcontainer.
// Картинку прев'ю Next підхоплює сам з `app/opengraph-image.png`
// (рендер: `scripts/og/render.mjs`), а абсолютну адресу на Vercel бере з
// VERCEL_PROJECT_PRODUCTION_URL, тож домен тут не зашивається.
export const metadata: Metadata = {
  title: t("app.title"),
  description: t("app.description"),
  openGraph: {
    type: "website",
    locale: "uk_UA",
    siteName: t("app.title"),
    title: t("app.title"),
    description: t("app.lead"),
  },
  twitter: {
    card: "summary_large_image",
    title: t("app.title"),
    description: t("app.lead"),
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
