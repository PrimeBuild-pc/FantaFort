"use client";

import { useEffect } from 'react';
import { useLocale } from '@/context/LocaleContext';
import { supabase } from '@/lib/supabase';

export default function ErrorPage({ error, reset }:{ error:Error & { digest?:string }; reset:() => void }) {
  const { t } = useLocale();
  useEffect(() => {
    supabase?.rpc('log_client_error', { error_message:error.message, error_path:window.location.pathname, error_stack:error.stack || null });
  }, [error]);

  return <main className="auth-shell"><section className="epic-panel auth-card"><div className="eyebrow">ERROR</div><h1 role="alert">{t('errorTitle')}</h1><button className="epic-button" onClick={reset}>{t('tryAgain')}</button></section></main>;
}
