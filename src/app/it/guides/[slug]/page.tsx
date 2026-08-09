import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import GuideArticle from '@/components/GuideArticle';
import { getGuide, guideSlugs } from '@/lib/guides';

export function generateStaticParams(){return guideSlugs.map(slug=>({slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const{slug}=await params;const guide=getGuide('it',slug);if(!guide)return{};return{title:guide.title,description:guide.description,alternates:{canonical:`/it/guides/${slug}`,languages:{en:`/guides/${slug}`,it:`/it/guides/${slug}`,'x-default':`/guides/${slug}`}},openGraph:{title:`${guide.title} | FantaFort`,description:guide.description,url:`/it/guides/${slug}`,type:'article',locale:'it'}}}
export default async function Page({params}:{params:Promise<{slug:string}>}){const{slug}=await params;const guide=getGuide('it',slug);if(!guide)notFound();return <GuideArticle guide={guide} locale="it"/>}
