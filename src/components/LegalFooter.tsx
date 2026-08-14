"use client";

import Link from 'next/link';
import { useLocale } from '@/context/LocaleContext';
import { communityCopy, DISCORD_URL } from '@/lib/community';
import { EPIC_FAN_DISCLAIMER } from '@/lib/legal';

export default function LegalFooter() {
  const { locale, t } = useLocale();
  return <footer className="legal-footer"><span>© 2026 FantaFort · All rights reserved</span><nav aria-label={t('legal')}><Link href="/about">{t('info')}</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/cookies">{t('cookies')}</Link><Link href="/credits">Credits</Link><Link href="/support">Support</Link><a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">Discord</a></nav><small>{EPIC_FAN_DISCLAIMER} · <a href={DISCORD_URL} target="_blank" rel="noopener noreferrer">{communityCopy[locale].discord}</a></small></footer>;
}
