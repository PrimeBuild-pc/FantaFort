/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';
import { supabase } from '@/lib/supabase';

type Notice = { id:number; type:string; metadata:Record<string,string|number>; read:boolean; created_at:string };

export default function NotificationsPage() {
  const { userId } = useGame();
  const { locale, t } = useLocale();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    if (!supabase || !userId) return;
    const { data, error } = await supabase.rpc('get_notifications');
    if (error) return setMessage(error.message);
    setNotices((data || []) as Notice[]);
    await supabase.rpc('mark_notifications_read');
    window.dispatchEvent(new Event('fantafort:notifications-read'));
  }, [userId]);
  useEffect(() => { load(); }, [load]);

  const text = (notice: Notice) => {
    const key = `notice_${notice.type}` as Parameters<typeof t>[0];
    return Object.entries(notice.metadata).reduce((copy, [name, value]) => copy.replaceAll(`{${name}}`, String(value)), t(key));
  };
  const href = (notice: Notice) => notice.type.startsWith('friend_') || notice.type === 'league_invite' ? '/friends' : notice.metadata.league_id ? `/leagues/${notice.metadata.league_id}` : '/notifications';

  return <div className="app-shell"><Header /><main className="container page-content">
    <div className="page-title"><div className="eyebrow">ACTIVITY</div><h1>{t('notifications')}</h1></div>
    {message && <p className="notice error" role="alert">{message}</p>}
    <section className="epic-panel notification-list">{notices.length ? notices.map(notice => <Link href={href(notice)} className={!notice.read ? 'unread' : ''} key={notice.id}><i aria-hidden="true">◆</i><span><strong>{text(notice)}</strong><small>{new Date(notice.created_at).toLocaleString(locale)}</small></span></Link>) : <div className="empty-state compact"><p>{t('noNotifications')}</p></div>}</section>
  </main></div>;
}
