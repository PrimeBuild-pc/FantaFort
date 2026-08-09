import type { Metadata } from 'next';
import Link from 'next/link';
import MarketingFooter from '@/components/MarketingFooter';
import MarketingHeader from '@/components/MarketingHeader';
import { guides } from '@/lib/guides';

export const metadata:Metadata={title:'Guide al fantasy Fortnite',description:'Guide chiare su punteggio FNCS, idoneità dei player, classifiche live e dati FantaFort.',alternates:{canonical:'/it/guides',languages:{en:'/guides',it:'/it/guides','x-default':'/guides'}}};
export default function Page(){return <div className="marketing-shell" lang="it"><MarketingHeader locale="it"/><main className="marketing-article"><header><div className="eyebrow">GUIDE FANTAFORT</div><h1>Guide al fantasy Fortnite</h1><p>Punteggio, dati competitivi e decisioni necessarie per costruire la tua rosa.</p></header><div className="guide-grid">{guides.it.map(guide=><Link href={`/it/guides/${guide.slug}`} key={guide.slug}><h2>{guide.title}</h2><p>{guide.description}</p><span>Leggi la guida →</span></Link>)}</div></main><MarketingFooter locale="it"/></div>}
