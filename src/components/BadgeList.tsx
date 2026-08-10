import type { PublicBadge } from '@/lib/types';

export default function BadgeList({ badges, compact=false }: { badges:PublicBadge[]; compact?:boolean }) {
  if (!badges.length) return null;
  return <span className={`badge-list${compact?' compact':''}`} aria-label={badges.map(badge=>badge.name).join(', ')}>{badges.map(badge=><span className={`achievement-badge badge-${badge.icon}`} title={`${badge.name}: ${badge.description}`} key={badge.slug}><i aria-hidden="true">{badge.name.slice(0,1)}</i><span>{badge.name}</span></span>)}</span>;
}
