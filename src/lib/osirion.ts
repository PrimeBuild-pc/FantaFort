import { unstable_cache } from 'next/cache';
import type { Tournament } from '@/app/tournaments/TournamentsClient';
import { fetchOsirionJson, isTournamentResponse } from './osirion-fetch';
import { isDisplayEvent } from './pro-eligibility';
export const tournamentRegions=new Set(['OCE','ASIA','ME','EU','BR','NAC','NAE','NAW','ONSITE']);
type ScoreLocation={leaderboardEventId:string;leaderboardEventWindowId:string;isMain:boolean;scoringRules?:{trackedStat:string;matchRule:string;rewardTiers:{keyValue:number;pointsEarned:number;multiplicative:boolean}[]}[]};
type EventWindow={eventWindowId:string;beginTime:string;endTime:string;round:number;matchCap?:number;playlistId?:string;scoreLocations:ScoreLocation[]};
type Event={eventId:string;displayData?:{longFormatTitle?:string;titleLine1?:string;titleLine2?:string;detailsDescription?:string;flavorDescription?:string;playlistTileImage?:string;loadingScreenImage?:string};eventWindows:EventWindow[]};

function format(playlist='',eventId=''){const value=`${playlist} ${eventId}`.toLowerCase();if(value.includes('solo'))return'solo';if(value.includes('duo'))return'duo';if(value.includes('trio'))return'trio';if(value.includes('squad'))return'squad';return'unknown'}

async function loadTournaments(region='EU'):Promise<Tournament[]>{
  if(!tournamentRegions.has(region))throw new Error('Invalid region');
  const data=await fetchOsirionJson(`/tournaments?region=${region}&includeHistoricData=true`,isTournamentResponse,{cache:'no-store'}) as {tournaments:Event[]};const now=Date.now();
  return (data.tournaments||[]).filter(event=>isDisplayEvent(event.eventId)).flatMap(event=>event.eventWindows.map(window=>{
    const leaderboard=window.scoreLocations.find(location=>location.isMain)||window.scoreLocations[0];if(!leaderboard)return null;
    const start=Date.parse(window.beginTime),end=Date.parse(window.endTime);
    const eliminationRule=leaderboard.scoringRules?.find(rule=>rule.trackedStat==='TEAM_ELIMS_STAT_INDEX');
    const placementRule=leaderboard.scoringRules?.find(rule=>rule.trackedStat==='PLACEMENT_STAT_INDEX');
    return {eventId:leaderboard.leaderboardEventId,windowId:leaderboard.leaderboardEventWindowId,name:event.displayData?.longFormatTitle||event.displayData?.titleLine1||event.eventId,subtitle:event.displayData?.titleLine2||'',description:event.displayData?.detailsDescription||event.displayData?.flavorDescription||'',imageUrl:event.displayData?.playlistTileImage||event.displayData?.loadingScreenImage||'',region,startsAt:window.beginTime,endsAt:window.endTime,round:window.round||0,matchCap:window.matchCap||null,format:format(window.playlistId,event.eventId),eliminationPoints:eliminationRule?.rewardTiers[0]?.pointsEarned||null,placementTiers:(placementRule?.rewardTiers||[]).slice(0,10),status:now<start?'upcoming':now<=end?'live':'completed'} satisfies Tournament;
  })).filter((item):item is Tournament=>item!==null).sort((a,b)=>Date.parse(b.startsAt)-Date.parse(a.startsAt)).slice(0,50);
}

export const getTournaments=unstable_cache(loadTournaments,['osirion-tournaments'],{revalidate:300});
