/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Header from '@/components/Header';
import { useGame } from '@/context/GameContext';
import { useLocale } from '@/context/LocaleContext';
import { supabase } from '@/lib/supabase';

type Friend = { id:string; username:string; name_style:string; online:boolean; pending:boolean; incoming:boolean };
type Blocked = { id:string; username:string };
type Invite = { id:string; league_id:string; league_name:string; inviter:string; created_at:string };

export default function FriendsPage() {
  const { loading, userId, leagues, refresh } = useGame();
  const { t } = useLocale();
  const [username, setUsername] = useState('');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [leagueId, setLeagueId] = useState('');
  const [message, setMessage] = useState('');
  const lobbyLeagues = leagues.filter(league => league.status === 'lobby');
  const selectedLeagueId = leagueId || lobbyLeagues[0]?.id || '';

  const load = useCallback(async () => {
    if (!supabase || !userId) return;
    const [friendRows, blockedRows, inviteRows] = await Promise.all([
      supabase.rpc('get_friends'), supabase.rpc('get_blocked_users'), supabase.rpc('get_league_invites'),
    ]);
    const error = friendRows.error || blockedRows.error || inviteRows.error;
    if (error) return setMessage(error.message);
    setFriends(((friendRows.data || []) as Friend[]).sort((a, b) => Number(b.online) - Number(a.online) || a.username.localeCompare(b.username)));
    setBlocked((blockedRows.data || []) as Blocked[]);
    setInvites((inviteRows.data || []) as Invite[]);
  }, [userId]);

  useEffect(() => { load(); const timer = setInterval(load, 30000); return () => clearInterval(timer); }, [load]);

  const rpc = async (fn:string, args:Record<string,unknown>, updateGame = false) => {
    if (!supabase) return;
    setMessage(''); const { error } = await supabase.rpc(fn, args); setMessage(error?.message || '✓');
    if (!error && updateGame) await refresh();
    await load();
  };
  const submit = async (event:FormEvent) => { event.preventDefault(); await rpc('request_friend', { target_username:username }); setUsername(''); };
  const respondInvite = (id:string, accept:boolean) => rpc('respond_league_invite', { invite_id:id, accept_invite:accept }, accept);

  const online = friends.filter(friend => !friend.pending && friend.online).length;
  return <div className="app-shell"><Header /><main className="container page-content">
    <div className="page-title"><div className="eyebrow">SOCIAL HUB</div><h1>{t('friends')}</h1><p>{t('friendsOnline').replace('{count}', String(online))}</p></div>
    {message && <p className="notice" role="status">{message}</p>}

    {invites.length > 0 && <section className="epic-panel invite-panel"><h2>{t('leagueInvites')}</h2>{invites.map(invite => <article key={invite.id}><div><strong>{invite.league_name}</strong><span>{t('invitedBy').replace('{username}', invite.inviter)}</span></div><button className="epic-button" onClick={() => respondInvite(invite.id, true)}>{t('accept')}</button><button className="link-button danger" onClick={() => respondInvite(invite.id, false)}>{t('reject')}</button></article>)}</section>}

    <section className="epic-panel friends-panel">
      <div className="section-heading"><h2>{t('friends')}</h2><form className="friend-form" onSubmit={submit}><input value={username} onChange={event => setUsername(event.target.value)} placeholder={t('username')} aria-label={t('username')} minLength={3} maxLength={30} required /><button className="epic-button">{t('addFriend')}</button></form></div>
      {lobbyLeagues.length > 0 && <label className="invite-league-select">{t('inviteToLeague')}<select value={selectedLeagueId} onChange={event => setLeagueId(event.target.value)}>{lobbyLeagues.map(league => <option key={league.id} value={league.id}>{league.name}</option>)}</select></label>}
      {loading ? <p>{t('loading')}</p> : friends.length ? <div className="friends-list">{friends.map(friend => <div className="friend-row expanded" key={friend.id}><span className={`presence ${friend.online && !friend.pending ? 'online' : ''}`} aria-hidden="true" /><strong className={`name-${friend.name_style}`}>{friend.username}</strong><span>{friend.pending ? t('pending') : friend.online ? t('online') : t('offline')}</span><div className="friend-actions">{friend.incoming ? <><button onClick={() => rpc('accept_friend', { friend_id:friend.id })}>{t('accept')}</button><button onClick={() => rpc('reject_friend', { friend_id:friend.id })}>{t('reject')}</button></> : friend.pending ? <button onClick={() => rpc('cancel_friend_request', { friend_id:friend.id })}>{t('cancelRequest')}</button> : <>{selectedLeagueId && <button onClick={() => rpc('invite_friend_to_league', { target_league:selectedLeagueId, friend_id:friend.id })}>{t('invite')}</button>}<button onClick={() => window.confirm(t('confirmRemoveFriend')) && rpc('remove_friend', { friend_id:friend.id })}>{t('remove')}</button><button onClick={() => window.confirm(t('confirmBlockUser')) && rpc('block_user', { friend_id:friend.id })}>{t('block')}</button></>}</div></div>)}</div> : <div className="empty-state compact"><p>{t('noFriends')}</p></div>}
    </section>

    {blocked.length > 0 && <section className="section-block blocked-list"><h2>{t('blockedUsers')}</h2>{blocked.map(user => <div className="friend-row" key={user.id}><span className="presence" /><strong>{user.username}</strong><span>{t('blocked')}</span><button onClick={() => rpc('unblock_user', { friend_id:user.id })}>{t('unblock')}</button></div>)}</section>}
  </main></div>;
}
