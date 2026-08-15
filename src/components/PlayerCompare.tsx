"use client";

import { Player } from '@/lib/types';
import { useLocale } from '@/context/LocaleContext';

export default function PlayerCompare({ players }: { players: Player[] }) {
  const { locale, t } = useLocale();
  const [a, b] = players;

  if (!a || !b) return <section className="epic-panel compare-panel"><h2>{t('compareTitle')}</h2><p className="form-hint">{t('compareEmpty')}</p></section>;

  const number = (value?: number | null) => value == null ? '—' : new Intl.NumberFormat(locale, { notation: value > 9999 ? 'compact' : 'standard', maximumFractionDigits: 1 }).format(value);
  const money = (value?: number | null) => value == null ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 }).format(value);

  const rows: [string, string, string, boolean | null][] = [
    [t('price'), number(a.price), number(b.price), a.price <= b.price],
    [t('earnings'), money(a.earnings), money(b.earnings), (a.earnings ?? 0) >= (b.earnings ?? 0)],
    [t('cupPoints'), number(a.tournamentPoints), number(b.tournamentPoints), (a.tournamentPoints ?? 0) >= (b.tournamentPoints ?? 0)],
    [t('pointsPerGame'), number(a.pointsPerMatch), number(b.pointsPerMatch), (a.pointsPerMatch ?? 0) >= (b.pointsPerMatch ?? 0)],
    [t('winRate'), `${number(a.winRate)}%`, `${number(b.winRate)}%`, (a.winRate ?? 0) >= (b.winRate ?? 0)],
    [t('bestPlacement'), a.bestPlacement ? `#${a.bestPlacement}` : '—', b.bestPlacement ? `#${b.bestPlacement}` : '—', a.bestPlacement != null && b.bestPlacement != null ? a.bestPlacement <= b.bestPlacement : null],
  ];

  return <section className="epic-panel compare-panel">
    <h2>{t('compareTitle')}</h2>
    <p className="form-hint">{t('compareHint')}</p>
    <div className="table-wrap">
      <table>
        <thead><tr><th></th><th>{a.handle}</th><th>{b.handle}</th></tr></thead>
        <tbody>{rows.map(([label, valueA, valueB, aWins]) => <tr key={label}>
          <td>{label}</td>
          <td className={aWins === true ? 'compare-win' : ''}>{valueA}</td>
          <td className={aWins === false ? 'compare-win' : ''}>{valueB}</td>
        </tr>)}</tbody>
      </table>
    </div>
  </section>;
}
