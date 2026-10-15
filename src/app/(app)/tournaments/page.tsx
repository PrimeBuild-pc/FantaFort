import TournamentsClient from './TournamentsClient';
import { getTournaments } from '@/lib/osirion';

export const revalidate=300;

export default async function TournamentsPage(){
  const tournaments=await getTournaments('EU').catch(()=>[]);
  return <TournamentsClient initialTournaments={tournaments}/>;
}
