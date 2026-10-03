/**
 * Старі адреси продукту → нові `/{мова}/poland/…` (ADR-0003). Список — копія
 * `LEGACY_REDIRECTS` з `app/lib/routes.ts`: конфіг не імпортує TypeScript, а
 * `routes.test.ts` звіряє, що копії не розійшлись. Query і fragment Next і
 * браузер переносять самі, тож share-лінк `/questionnaire?…` відкриває той
 * самий результат.
 */
const LEGACY_REDIRECTS = [
  // 307: `/` стане лендінгом бренду в темі 2.2, постійний редирект браузер закешував би.
  { source: '/', destination: '/uk/poland', permanent: false },
  { source: '/questionnaire', destination: '/uk/poland/questionnaire', permanent: true },
  { source: '/sources', destination: '/uk/poland/sources', permanent: true },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // dev і build не можна тримати в одній теці .next — інакше dev-сервер спотикається
  // об артефакти продакшн-збірки ("Cannot find module './NNN.js'"). Тому перевірочні
  // білди пишуться в окрему теку через NEXT_DIST_DIR, а `npm run dev` лишає .next собі.
  // Vercel запускає build без цього env → distDir лишається дефолтним '.next'.
  distDir: process.env.NEXT_DIST_DIR || '.next',

  // Кореневих layout два (`[locale]` і `(technical)`), спільного немає, тож 404
  // рендерить `app/global-not-found.tsx` (Next 15.4+). Без прапора збірка падає:
  // `/_not-found` лишився б без кореневого layout.
  experimental: {
    globalNotFound: true,
  },

  async redirects() {
    return LEGACY_REDIRECTS;
  },
};

export default nextConfig;
