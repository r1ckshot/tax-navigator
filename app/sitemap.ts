import type { MetadataRoute } from 'next';
import { sitemapEntries } from '@/lib/seo';
import { siteUrl } from '@/lib/site';

/** `/sitemap.xml`. Список сторінок і hreflang — `lib/seo.ts`, під тестом. */
export default function sitemap(): MetadataRoute.Sitemap {
  return sitemapEntries(siteUrl(process.env));
}
