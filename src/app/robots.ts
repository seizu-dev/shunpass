import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/site-config';

// /api/* は取得代行のエンドポイントで、クロールされても意味が無いうえに
// 旬すぐ側への無駄なリクエストを誘発しうるため明示的に除外する。
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/',
    },
    sitemap: `${siteConfig.siteUrl}/sitemap.xml`,
  };
}
