import type { MetadataRoute } from 'next';
import { siteConfig } from '@/lib/site-config';

// priority / changeFrequency は Google が参照しないため入れない。
// lastModified はビルド時刻になる。内容が変わっていない再デプロイでも更新されるが、
// 静的な2ページしか無いためこれ以上正確に持つ意味が薄い。
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
    { url: siteConfig.siteUrl, lastModified },
    { url: `${siteConfig.siteUrl}/about`, lastModified },
  ];
}
