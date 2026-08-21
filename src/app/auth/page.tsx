/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { isDisposableEmailError, isEmailSendRateLimit, isExistingSignup, isStrongPassword, safeRedirectPath } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { useLocale } from '@/context/LocaleContext';
import { Locale, locales } from '@/lib/i18n';
import { LEGAL_VERSION } from '@/lib/legal';
import { homeCopy } from '@/lib/marketing';
import { Turnstile } from '@/components/Turnstile';

type Mode = 'signin' | 'signup' | 'forgot' | 'reset';
const legalCopy:Record<Locale,{age:string;agree:string;required:string}>={
  en:{age:'I confirm that I am at least 16 years old.',agree:'I accept the Terms of Use and acknowledge the Privacy Notice.',required:'Confirm your age and accept the legal terms to create an account.'},
  it:{age:'Confermo di avere almeno 16 anni.',agree:'Accetto i Termini di utilizzo e dichiaro di aver letto l’Informativa privacy.',required:'Conferma l’età e accetta i termini per creare un account.'},
  es:{age:'Confirmo que tengo al menos 16 años.',agree:'Acepto los Términos y he leído el Aviso de privacidad.',required:'Confirma tu edad y acepta los términos.'},
  de:{age:'Ich bestätige, mindestens 16 Jahre alt zu sein.',agree:'Ich akzeptiere die Nutzungsbedingungen und den Datenschutzhinweis.',required:'Bestätige Alter und Bedingungen.'},
  fr:{age:'Je confirme avoir au moins 16 ans.',agree:'J’accepte les Conditions et reconnais la Politique de confidentialité.',required:'Confirmez votre âge et acceptez les conditions.'},
};

export default function AuthPage() {
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();
  const [mode, setMode] = useState<Mode>('signin');
  const [next, setNext] = useState('/dashboard');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaVersion, setCaptchaVersion] = useState(0);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [recoverAfterSignup, setRecoverAfterSignup] = useState(false);
  const captchaEnabled = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  useEffect(() => {
    if (!supabase) return;
    const params = new URLSearchParams(window.location.search);
    const destination = safeRedirectPath(params.get('next'), window.location.origin);
    setNext(destination);
    if (params.get('reset') === '1') setMode('reset');
    else {
      if (params.get('mode') === 'signup') setMode('signup');
      supabase.auth.getSession().then(({ data }) => data.session && router.replace(destination));
    }
    const { data } = supabase.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') setMode('reset'); });
    return () => data.subscription.unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!recoverAfterSignup || (captchaEnabled && !captchaToken) || !supabase) return;
    setRecoverAfterSignup(false); setPending(true);
    const token = captchaToken || undefined;
    setCaptchaToken(null); setCaptchaVersion(value => value + 1);
    void supabase.auth.resetPasswordForEmail(email, {
      redirectTo:`${window.location.origin}/auth?reset=1`, captchaToken:token,
    }).then(({ error }) => {
      setPending(false);
      setMessage(isEmailSendRateLimit(error) ? t('emailRecentlySent') : error?.message || t('confirmEmail'));
    });
  }, [captchaEnabled, captchaToken, email, recoverAfterSignup, t]);

  const resetCaptcha = () => { setCaptchaToken(null); setCaptchaVersion(value => value + 1); };
  const changeMode = (nextMode:Mode) => { setMode(nextMode); setMessage(''); resetCaptcha(); };
  const consumeCaptcha = () => { const token = captchaToken || undefined; resetCaptcha(); return token; };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!supabase) return;
    setPending(true); setMessage('');

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo:`${window.location.origin}/auth?reset=1`, captchaToken:consumeCaptcha(),
      });
      setPending(false); setMessage(isEmailSendRateLimit(error) ? t('emailRecentlySent') : error?.message || t('resetEmailSent')); return;
    }
    if (mode === 'signup' && (!ageConfirmed || !legalAccepted)) {
      setPending(false); setMessage(legalCopy[locale].required); return;
    }
    if ((mode === 'signup' || mode === 'reset') && !isStrongPassword(password)) {
      setPending(false); setMessage(t('invalidPassword')); return;
    }
    if (mode === 'reset') {
      const { error } = await supabase.auth.updateUser({ password });
      setPending(false); setMessage(error?.message || t('passwordUpdated'));
      if (!error) router.replace('/account');
      return;
    }
    if (mode === 'signup' && !/^[A-Za-z0-9_.-]{3,30}$/.test(username)) {
      setPending(false); setMessage(t('invalidUsername')); return;
    }
    const token = consumeCaptcha();
    const result = mode === 'signup'
      ? await supabase.auth.signUp({ email, password, options: { captchaToken:token, emailRedirectTo:`${window.location.origin}/auth`, data: { username, locale, age_confirmed:true, legal_accepted_at:new Date().toISOString(), terms_version:LEGAL_VERSION, privacy_version:LEGAL_VERSION } } })
      : await supabase.auth.signInWithPassword({ email, password, options:{ captchaToken:token } });
    setPending(false);
    if (result.error) return setMessage(mode === 'signup' && isDisposableEmailError(result.error) ? t('disposableEmail') : mode === 'signup' && isEmailSendRateLimit(result.error) ? t('emailRecentlySent') : result.error.message);
    if (mode === 'signup' && !result.data.session) {
      if (isExistingSignup(result.data.user)) setRecoverAfterSignup(true);
      return setMessage(t('confirmEmail'));
    }
    router.replace(next);
  };

  if (!supabase) return <main className="auth-shell"><section className="epic-panel auth-card"><h1>Service unavailable</h1><p>Authentication is not configured.</p><Link href="/about">FantaFort information</Link></section></main>;

  const title = mode === 'signup' ? t('signUp') : mode === 'forgot' ? t('forgotPassword') : mode === 'reset' ? t('newPassword') : t('signIn');
  const marketing = homeCopy[locale];
  return <main className="auth-shell">
    <section className="auth-showcase">
      <header><span className="logo"><span>FANTA</span>FORT</span><label className="auth-language"><span>{t('language')}</span><select value={locale} onChange={event => setLocale(event.target.value as Locale)}>{locales.map(item => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label></header>
      <div className="auth-pitch"><p className="eyebrow">{marketing.eyebrow}</p><h1>{marketing.title}<br/><em>{marketing.accent}</em></h1><p>{marketing.intro}</p><ul>{marketing.benefits.map(item=><li key={item}><i>✓</i>{item}</li>)}</ul></div>
      <div className="auth-arena" aria-hidden="true"><span className="auth-live"><i/> FNCS LIVE</span><div className="auth-player one"><b>01</b><span>+42</span></div><div className="auth-player two"><b>02</b><span>+68</span></div><div className="auth-player three"><b>03</b><span>+31</span></div><strong>141 <small>PTS</small></strong></div>
    </section>
    <section className="auth-form-column">
      <form className="epic-panel auth-card" onSubmit={submit}>
        <div className="eyebrow">FANTAFORT ACCOUNT</div><h2>{title}</h2>
        {(mode === 'signin' || mode === 'signup') && <div className="auth-mode-tabs"><button type="button" aria-pressed={mode === 'signin'} onClick={() => changeMode('signin')}>{t('signIn')}</button><button type="button" aria-pressed={mode === 'signup'} onClick={() => changeMode('signup')}>{t('signUp')}</button></div>}
        {mode === 'signup' && <label>{t('username')}<input value={username} onChange={event => setUsername(event.target.value)} required minLength={3} maxLength={30} autoComplete="username" /></label>}
        {mode !== 'reset' && <label>{t('email')}<input type="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={254} autoComplete="email" /></label>}
        {mode !== 'forgot' && <label>{mode === 'reset' ? t('newPassword') : t('password')}<input type="password" value={password} onChange={event => setPassword(event.target.value)} required minLength={mode === 'signin' ? 8 : 10} maxLength={128} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} />{mode !== 'signin' && <small>{t('passwordRules')}</small>}</label>}
        {mode === 'signup' && <div className="legal-consent"><label className="checkbox-label"><input type="checkbox" checked={ageConfirmed} onChange={event=>setAgeConfirmed(event.target.checked)} required />{legalCopy[locale].age}</label><label className="checkbox-label"><input type="checkbox" checked={legalAccepted} onChange={event=>setLegalAccepted(event.target.checked)} required /><span>{legalCopy[locale].agree} <Link href="/terms" target="_blank">Terms</Link> · <Link href="/privacy" target="_blank">Privacy</Link></span></label></div>}
        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && mode !== 'reset' && <Turnstile key={captchaVersion} siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY} onToken={setCaptchaToken} />}
        {message && <p className="notice" role="alert">{message}</p>}
        <button className="epic-button" disabled={pending || Boolean(captchaEnabled && mode !== 'reset' && !captchaToken)}>{pending ? t('wait') : title}</button>
        {mode === 'signin' ? <button className="link-button" type="button" onClick={() => changeMode('forgot')}>{t('forgotPassword')}</button> : mode !== 'signup' && <button className="link-button" type="button" onClick={() => changeMode('signin')}>{t('backToLogin')}</button>}
      </form>
      <small className="auth-disclaimer">{marketing.fairBody}</small>
    </section>
  </main>;
}
