import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import HowItWorks, { howCopy } from '@/components/HowItWorks';
import { isLocalizedLocale, localizedLocales } from '@/lib/marketing';

const languages={en:'/how-it-works',it:'/it/how-it-works',es:'/es/how-it-works',de:'/de/how-it-works',fr:'/fr/how-it-works','x-default':'/how-it-works'};
export const dynamicParams=false;
export function generateStaticParams(){return localizedLocales.map(locale=>({locale}))}
export async function generateMetadata({params}:{params:Promise<{locale:string}>}):Promise<Metadata>{const {locale}=await params;if(!isLocalizedLocale(locale))return{};const text=howCopy(locale);return{title:text.title,description:text.intro,alternates:{canonical:`/${locale}/how-it-works`,languages},openGraph:{title:text.title,description:text.intro,url:`/${locale}/how-it-works`,locale}}}
export default async function Page({params}:{params:Promise<{locale:string}>}){const {locale}=await params;if(!isLocalizedLocale(locale))notFound();return <HowItWorks locale={locale}/>}
