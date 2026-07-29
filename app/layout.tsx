import type { Metadata } from "next";
import "./globals.css";
import { t } from "@/lib/i18n/uk";

// Назва береться з i18n, а не пишеться тут: те, що бачить користувач у вкладці,
// у пошуку й у шарингу, мусить збігатися з назвою в самому інтерфейсі.
// «Tax Navigator» лишається технічною назвою — репо, package.json, devcontainer.
export const metadata: Metadata = {
  title: t("app.title"),
  description: t("app.description"),
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
