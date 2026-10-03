import type { Metadata } from 'next';
import './lab.css';

/**
 * Тимчасові сторінки теми 2.2: три напрями стилю для вибору (сесія 09).
 * У пошук не потрапляють; сесія 12 видаляє теку цілком.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function DesignLabLayout({ children }: { children: React.ReactNode }) {
  return children;
}
