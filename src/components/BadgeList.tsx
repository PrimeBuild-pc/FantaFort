import BadgeMedal from './BadgeMedal';
import type { PublicBadge } from '@/lib/types';

export default function BadgeList({ badges, compact=false }: { badges:PublicBadge[]; compact?:boolean }) {
  if (!badges.length) return null;
  return <span className={`badge-list${compact?' compact':''}`}>{badges.map(badge =>
    // Compact places medals where there is no room for names, so the name has to
    // survive as an accessible label rather than only as a tooltip.
    <span className={`achievement-badge badge-${badge.icon}`} title={`${badge.name}: ${badge.description}`}
      aria-label={compact ? `${badge.name}: ${badge.description}` : undefined} key={badge.slug}>
      <BadgeMedal icon={badge.icon} />
      {!compact && <span>{badge.name}</span>}
    </span>)}</span>;
}
