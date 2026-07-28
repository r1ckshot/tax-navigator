/** @type {import('next').NextConfig} */
const nextConfig = {
  // dev і build не можна тримати в одній теці .next — інакше dev-сервер спотикається
  // об артефакти продакшн-збірки ("Cannot find module './NNN.js'"). Тому перевірочні
  // білди пишуться в окрему теку через NEXT_DIST_DIR, а `npm run dev` лишає .next собі.
  // Vercel запускає build без цього env → distDir лишається дефолтним '.next'.
  distDir: process.env.NEXT_DIST_DIR || '.next',
};

export default nextConfig;
