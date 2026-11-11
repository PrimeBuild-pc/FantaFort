import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingFooter from '@/components/MarketingFooter';
import MarketingHeader from '@/components/MarketingHeader';
import { guides } from '@/lib/guides';

export const metadata:Metadata={title:'Fortnite Fantasy Guides',description:'Guides to Fortnite fantasy on FantaFort: FNCS scoring, player eligibility, live standings, projections and how often the data updates.',alternates:{canonical:'/guides',languages:{en:'/guides',it:'/it/guides','x-default':'/guides'}}};
export default function Page(){return <div className="marketing-shell"><MarketingHeader locale="en"/><main className="marketing-article"><header><div className="eyebrow">FANTAFORT KNOWLEDGE BASE</div><h1>Fortnite fantasy guides</h1><p>Understand scoring, competitive data and every decision behind your FantaFort roster.</p></header><div className="guide-grid">{guides.en.map(guide=><Link href={`/guides/${guide.slug}`} key={guide.slug}><h2>{guide.title}</h2><p>{guide.description}</p><span>Read guide →</span></Link>)}</div></main><MarketingFooter locale="en"/></div>}
