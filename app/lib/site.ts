/**
 * Базова адреса сайту для canonical, hreflang і прев'ю. Береться з env, щоб
 * переїзд на власний домен (тема 5.1) був зміною змінної, а не коду.
 *
 * Порядок: `NEXT_PUBLIC_APP_URL` → продакшн-адреса Vercel (і на превʼю теж:
 * canonical превʼю має вказувати на прод, а не на себе) → локальний сервер.
 */
export function siteUrl(env: Record<string, string | undefined>): URL {
  if (env.NEXT_PUBLIC_APP_URL) return new URL(env.NEXT_PUBLIC_APP_URL);
  if (env.VERCEL_PROJECT_PRODUCTION_URL) return new URL(`https://${env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return new URL('http://localhost:3000');
}
