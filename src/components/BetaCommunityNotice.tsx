/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';
import { communityCopy, DISCORD_URL } from '@/lib/community';

export default function BetaCommunityNotice() {
  const { profile, userId } = useGame();
  const { locale } = useLocale();
  const [visible, setVisible] = useState(false);
  const key = `fantafort-beta-notice:${userId}`;

  useEffect(() => { if (userId) setVisible(localStorage.getItem(key) !== 'dismissed'); }, [key, userId]);
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
