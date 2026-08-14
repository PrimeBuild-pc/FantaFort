import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import MarketingFooter from '@/components/MarketingFooter';
import MarketingHeader from '@/components/MarketingHeader';
import { featuredPlayerIds } from '@/lib/public-players';
import { supabase } from '@/lib/supabase';

export const revalidate=900;
export const metadata:Metadata={title:'FNCS Pro Player Database',description:'Browse competitive Fortnite players imported from recent Osirion FNCS results in the FantaFort market.',alternates:{canonical:'/players'},openGraph:{title:'FNCS Pro Player Database | FantaFort',description:'Competitive Fortnite player cards backed by recent Osirion FNCS results.',url:'/players'}};

type PublicCard={id:string;handle:string;real_name:string|null;organization:string|null;photo_url:string|null;rarity:string;price:number;eligibility_note:string|null};
const PAGE_SIZE=48;

export default async function Page({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
  const params=await searchParams;
  const search=(params.q||'').trim().slice(0,60);
  const requestedPage=Math.max(1,Number.parseInt(params.page||'1',10)||1);
  let query=supabase?.from('players').select('id,handle,real_name,organization,photo_url,rarity,price,eligibility_note',{count:'exact'}).eq('active',true).order('price',{ascending:false}).order('handle').order('id');
  if(search)query=query?.ilike('handle',`%${search}%`);
  const from=(requestedPage-1)*PAGE_SIZE;
  const result=query?await query.range(from,from+PAGE_SIZE-1):{data:[],count:0,error:null};
  if(result.error)throw result.error;
  const players=(result.data||[]) as PublicCard[];
  const total=result.count||0;
  const totalPages=Math.max(1,Math.ceil(total/PAGE_SIZE));
  const href=(target:number)=>{const next=new URLSearchParams();if(search)next.set('q',search);if(target>1)next.set('page',String(target));const value=next.toString();return `/players${value?`?${value}`:''}`};
  if(requestedPage>totalPages)redirect(href(totalPages));
  const page=requestedPage;
  const featured=new Set<string>(featuredPlayerIds);

  return <div className="marketing-shell"><MarketingHeader locale="en"/><main className="marketing-article"><header><div className="eyebrow">FANTAFORT PLAYER DATABASE</div><h1>FNCS pro player database</h1><p>Browse every active market player imported from documented recent Osirion results. A missing image or biography stays unavailable instead of being invented.</p></header><form className="public-player-search" action="/players"><label><span>Search by competitive handle</span><input name="q" defaultValue={search} maxLength={60} placeholder="Piz, Belusi, Predage…"/></label><button className="epic-button">Search</button></form><p className="public-player-count">{total.toLocaleString('en')} players · page {page} of {totalPages}</p><div className="public-player-grid">{players.map((player,index)=>{const body=<>{player.photo_url?<Image src={player.photo_url} alt={`${player.real_name||player.handle} Fortnite player`} width={480} height={480} sizes="(max-width:540px) calc(100vw - 2rem), (max-width:850px) 50vw, 280px" priority={index===0}/>:<div className="public-player-placeholder" aria-label="Player image unavailable"><span>{player.handle.slice(0,2).toUpperCase()}</span></div>}<div><span>{player.organization||player.rarity}</span><h2>{player.real_name||player.handle}</h2>{player.real_name&&<strong>{player.handle}</strong>}<p>{player.eligibility_note||'Eligible competitive player'} · {player.price.toLocaleString('en')} coins</p></div></>;return featured.has(player.id)?<Link href={`/players/${player.id}`} key={player.id}>{body}</Link>:<article key={player.id}>{body}</article>})}</div>{totalPages>1&&<nav className="market-pagination" aria-label="Player database pages"><Link aria-disabled={page===1} href={href(Math.max(1,page-1))}>← Previous</Link><span>{page} / {totalPages}</span><Link aria-disabled={page===totalPages} href={href(Math.min(totalPages,page+1))}>Next →</Link></nav>}<section className="guide-sources"><h2>Data scope</h2><p>Competitive handles and eligibility come from recent Osirion tournament leaderboards. Detailed public profiles remain limited to players with separately verified identity data and an authorized local image.</p><p>Player photographs are reused from Liquipedia under CC BY-SA 3.0 — see the <Link href="/credits">image and data credits</Link>. Players may object to the processing of their data through the <Link href="/privacy">privacy notice</Link>.</p></section></main><MarketingFooter locale="en"/></div>;
}
