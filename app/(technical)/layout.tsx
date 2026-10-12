import '../globals.css';
import { fontFaces } from '../fonts';

/**
 * Кореневий layout технічних сторінок без мови в адресі (`/tokens`). Окремий,
 * бо кореневий layout продукту бере `lang` з сегмента `[locale]`, якого тут
 * немає (ADR-0003). Сторінки тут українські й не перекладаються.
 */
export default function TechnicalLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uk" style={fontFaces}>
      <body>{children}</body>
    </html>
  );
}
