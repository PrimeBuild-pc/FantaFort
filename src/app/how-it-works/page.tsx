import type { Metadata } from 'next';
import HowItWorks, { howCopy } from '@/components/HowItWorks';

const languages={en:'/how-it-works',it:'/it/how-it-works',es:'/es/how-it-works',de:'/de/how-it-works',fr:'/fr/how-it-works','x-default':'/how-it-works'};
export const metadata:Metadata={title:'How the Fortnite Fantasy League Works',description:howCopy('en').intro,alternates:{canonical:'/how-it-works',languages},openGraph:{title:'How FantaFort Works',description:howCopy('en').intro,url:'/how-it-works'}};
export default function Page(){return <HowItWorks locale="en"/>}
