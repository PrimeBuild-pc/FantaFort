import Link from 'next/link';
import MarketingFooter from '@/components/MarketingFooter';
import MarketingHeader from '@/components/MarketingHeader';
import { EPIC_FAN_DISCLAIMER } from '@/lib/legal';
import { PHOTO_CREDITS, PHOTO_MODIFICATIONS, PHOTO_REMOVALS, PHOTO_SOURCE, photoCredit } from '@/lib/photo-credits';
import { getFeaturedPlayers } from '@/lib/public-players';

export default async function CreditsPage() {
  const players = await getFeaturedPlayers();
  const named = new Map(players.map(player => [player.id, player.real_name || player.handle]));
  // Only photographs actually served are listed: a credit for an image we removed
  // would read as though it were still published.
  const withPhoto = new Set(players.filter(player => player.photo_url).map(player => player.id));
  const credited = Object.keys(PHOTO_CREDITS).filter(id => withPhoto.has(id));
  return <div className="marketing-shell"><MarketingHeader locale="en"/><main className="marketing-article">
    <header><div className="eyebrow">CREDITS AND ATTRIBUTION</div><h1>Image and data credits</h1>
      <p>FantaFort reuses third-party material under the licences below. Nothing here is relicensed, and no photograph is published without a documented source.</p></header>

    <section><h2>Player photographs</h2>
      <p>The {credited.length} published player portraits come from <a href={PHOTO_SOURCE.url} target="_blank" rel="noreferrer noopener">{PHOTO_SOURCE.name}</a>, snapshot {PHOTO_SOURCE.snapshot}, under <a href={PHOTO_SOURCE.licenceUrl} target="_blank" rel="noreferrer noopener">{PHOTO_SOURCE.licence}</a>. Where a specific uploader is credited, it is named below; otherwise the author and the exact licence terms are stated on the source file page. {PHOTO_MODIFICATIONS}</p>
      <div className="table-wrap"><table>
        <thead><tr><th>Player</th><th>Attribution</th><th>Source</th></tr></thead>
        <tbody>{credited.map(id => { const credit = photoCredit(id); return <tr key={id}>
          <td>{named.get(id) || id}</td>
          <td>{credit.author || `${PHOTO_SOURCE.name} contributors`}</td>
          <td><a href={credit.sourceUrl!} target="_blank" rel="noreferrer noopener">{PHOTO_SOURCE.name}</a></td>
        </tr>; })}</tbody>
      </table></div>
      <p>Every remaining player in the database is shown without a photograph rather than with an unlicensed one. If you are a rightsholder or a player and want an image removed, write to <a href="mailto:privacy@fantafort.com">privacy@fantafort.com</a>.</p>
    </section>

    <section><h2>Photographs we removed</h2>
      <p>Hosting on a wiki does not make an image reusable. These files carried terms that do not permit redistribution by us, so they were taken down rather than credited. Their profile pages remain, without a portrait.</p>
      <ul>{PHOTO_REMOVALS.map(item => <li key={item.player}><strong>{item.player}</strong> — {item.reason}</li>)}</ul>
    </section>

    <section><h2>Competitive data</h2>
      <p>Tournament definitions, windows, leaderboards and session history come from the Osirion public competitive API. Birth dates and career earnings snapshots for the curated players are taken from the same {PHOTO_SOURCE.name} pages and are shown as unavailable when they are not documented.</p>
      <p>How the data is used is described in the <Link href="/methodology">data methodology</Link>, and how professional players are handled under data protection law is set out in the <Link href="/privacy">privacy notice</Link>.</p>
    </section>

    <section className="guide-sources"><h2>Trademarks</h2><p>{EPIC_FAN_DISCLAIMER}</p></section>
  </main><MarketingFooter locale="en"/></div>;
}

export const metadata = {
  title: 'Image and Data Credits',
  description: 'Sources, authors and licences for the player photographs and competitive data used by FantaFort.',
  alternates: { canonical: '/credits' },
};
