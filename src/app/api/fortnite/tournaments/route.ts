import { NextRequest, NextResponse } from 'next/server';
import { getTournaments, tournamentRegions } from '@/lib/osirion';

export async function GET(request:NextRequest){
  const region=(request.nextUrl.searchParams.get('region')||'EU').toUpperCase();
  if(!tournamentRegions.has(region))return NextResponse.json({error:'Invalid region'},{status:400});
  try{return NextResponse.json({tournaments:await getTournaments(region)})}
  catch{return NextResponse.json({error:'Fortnite provider unavailable'},{status:502})}
}
