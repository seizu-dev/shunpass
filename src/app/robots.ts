import type { MetadataRoute } from 'next';
import { withBasePath } from '@/lib/base-path';
import { siteConfig } from '@/lib/site-config';

// allow / disallow は robots.txt の仕様上ホストルートからのパスなので、basePath を前置する。
// /api/* は取得代行のエンドポイントで、クロールされても意味が無いうえに
// 旬すぐ側への無駄なリクエストを誘発しうるため明示的に除外する。
//
// この出力自体は /shunpass/robots.txt で配信される。クローラが読むホストルートの
// robots.txt は既存サイト（seizu.dev）側のものになり、これとは別物。
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: withBasePath('/'),
      disallow: withBasePath('/api/'),
    },
    sitemap: `${siteConfig.siteUrl}/sitemap.xml`,
  };
}
