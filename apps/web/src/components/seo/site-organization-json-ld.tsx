import { getPublicSiteName } from '@/lib/site-name';
import { buildOrganizationJsonLd, getSiteUrl } from '@/lib/json-ld';
import { JsonLd } from '@/components/seo/json-ld';

export async function SiteOrganizationJsonLd() {
  const siteName = await getPublicSiteName();
  const siteUrl = getSiteUrl();
  return <JsonLd data={buildOrganizationJsonLd(siteName, siteUrl)} />;
}
