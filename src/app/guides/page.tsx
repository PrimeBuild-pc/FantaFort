import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingFooter from '@/components/MarketingFooter';
import MarketingHeader from '@/components/MarketingHeader';
import { guides } from '@/lib/guides';

export const metadata:Metadata={title:'Fortnite Fantasy Guides',description:'Clear guides to FNCS fantasy scoring, player eligibility, live standings and FantaFort data.',alternates:{canonical:'/guides',languages:{en:'/guides',it:'/it/guides','x-default':'/guides'}}};
export default function Page(){return <div className="marketing-shell"><MarketingHeader locale="en"/><main className="marketing-article"><header><div className="eyebrow">FANTAFORT KNOWLEDGE BASE</div><h1>Fortnite fantasy guides</h1><p>Understand scoring, competitive data and every decision behind your FantaFort roster.</p></header><div className="guide-grid">{guides.en.map(guide=><Link href={`/guides/${guide.slug}`} key={guide.slug}><h2>{guide.title}</h2><p>{guide.description}</p><span>Read guide →</span></Link>)}</div></main><MarketingFooter locale="en"/></div>}
