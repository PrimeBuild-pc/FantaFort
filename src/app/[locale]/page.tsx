import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MarketingHome from '@/components/MarketingHome';
import { homeCopy, isLocalizedLocale, localizedLocales } from '@/lib/marketing';

const names = { it:'Fantasy Fortnite FNCS', es:'Fantasy de Fortnite y FNCS', de:'Fortnite Fantasy-Spiel mit FNCS', fr:'Fantasy Fortnite avec résultats FNCS' };
// Search snippets get room for the full pitch; the on-page intro stays short.
const descriptions: Partial<Record<keyof typeof names, string>> = {
  it:'Fantasy league gratuita di Fortnite: crea una rosa di tre pro FNCS, sfida gli amici in una lega privata e fai punti con i risultati reali dei tornei.',
};
const alternates = { en:'/', it:'/it', es:'/es', de:'/de', fr:'/fr', 'x-default':'/' };

export const dynamicParams = false;
export function generateStaticParams() { return localizedLocales.map(locale=>({locale})); }

export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata> {
  const {locale}=await params;
  if(!isLocalizedLocale(locale)) return {};
  const copy=homeCopy[locale];
  return {
    title:names[locale], description:descriptions[locale]||copy.intro,
    alternates:{canonical:`/${locale}`,languages:alternates},
    openGraph:{title:`${names[locale]} | FantaFort`,description:copy.intro,url:`/${locale}`,locale},
  };
}

export default async function LocalizedHome({params}:{params:Promise<{locale:string}>}) {
  const {locale}=await params;
  if(!isLocalizedLocale(locale)) notFound();
  return <MarketingHome locale={locale}/>;
}
