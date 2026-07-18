import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tax Navigator",
  description: "Податковий навігатор для українців у Польщі з крос-бордерним доходом",
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
