"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';
import { communityCopy, DISCORD_URL } from '@/lib/community';
import { cookieAcknowledged } from './CookieNotice';

export default function BetaCommunityNotice() {
  const { profile, userId } = useGame();
  const { locale } = useLocale();
  const [visible, setVisible] = useState(false);
  const key = `fantafort-beta-notice:${userId}`;

  // Waits for the cookie notice: on mobile both sit in the same spot and overlapped.
  useEffect(() => {
    if (!userId) return;
    const update = () => setVisible(cookieAcknowledged() && localStorage.getItem(key) !== 'dismissed');
    update();
    window.addEventListener('fantafort:cookie-acknowledged', update);
    return () => window.removeEventListener('fantafort:cookie-acknowledged', update);
  }, [key, userId]);
  if (!visible || !userId) return null;
  const text = communityCopy[locale];
  const dismiss = () => { localStorage.setItem(key, 'dismissed'); setVisible(false); };

  return <aside className="beta-community-notice" aria-label={text.betaTitle}>
    <div><strong>{text.betaTitle}</strong><p>{text.betaBody}</p></div>
    <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer" className="epic-button">{text.discord}</a>
    {!profile?.communityEmailOptIn && <Link href="/account#communication">{text.emailTitle}</Link>}
    <button type="button" onClick={dismiss} aria-label={text.dismiss}>×</button>
  </aside>;
}
