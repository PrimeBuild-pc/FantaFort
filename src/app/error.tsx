"use client";

import Link from 'next/link';
import { useEffect } from 'react';
import { useLocale } from '@/context/LocaleContext';

export default function ErrorPage({ error, reset }:{ error:Error & { digest?:string }; reset:() => void }) {
  const { t } = useLocale();
  useEffect(() => {
    // Loaded on demand so the root error boundary does not put the Supabase client on every public page.
    import('@/lib/supabase').then(({ supabase }) => supabase?.rpc('log_client_error', { error_message:error.message, error_path:window.location.pathname, error_stack:error.stack || null }));
  }, [error]);

  return <main className="auth-shell"><section className="epic-panel auth-card"><div className="eyebrow">ERROR</div><h1 role="alert">{t('errorTitle')}</h1><button className="epic-button" onClick={reset}>{t('tryAgain')}</button><Link href="/">FantaFort home</Link></section></main>;
}
