import { unstable_cache } from 'next/cache';
import { supabase } from './supabase';

export const featuredPlayerIds=['peterbot','pollo','cold','thomas','veno','mongraal','clix','bugha'] as const;
export type PublicPlayer={id:string;handle:string;real_name:string|null;organization:string|null;photo_url:string|null;birth_date:string|null;earnings:number|null;eligibility_note:string|null;tournament_points:number;cups_played:number;tournament_wins:number;best_placement:number|null;average_placement:number|null;points_per_match:number;win_rate:number;teammates:{handle?:string|null;events?:number|null}[]|null};

export const getFeaturedPlayers=unstable_cache(async()=>{
  if(!supabase)return [];
  const {data,error}=await supabase.rpc('get_featured_players',{player_ids:[...featuredPlayerIds]});
  if(error)throw error;
  return (data as PublicPlayer[]).filter(player=>player.photo_url);
},['featured-public-players'],{revalidate:900});

export async function getFeaturedPlayer(id:string){return (await getFeaturedPlayers()).find(player=>player.id===id)}
