import type { MetadataRoute } from 'next';
import { robotsRules } from '@/lib/seo';
import { siteUrl } from '@/lib/site';

/** `/robots.txt`: усе відкрито, плюс адреса карти сайту. */
export default function robots(): MetadataRoute.Robots {
  return robotsRules(siteUrl(process.env));
}
