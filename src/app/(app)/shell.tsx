/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GameProvider, useGame } from "@/context/GameContext";
import { useLocale } from "@/context/LocaleContext";
import { Locale, locales } from "@/lib/i18n";
import { getLevelProgress } from "@/lib/types";
import BetaCommunityNotice from "@/components/BetaCommunityNotice";
import CookieNotice from "@/components/CookieNotice";
import LegalFooter from "@/components/LegalFooter";
import OnboardingGuide from "@/components/OnboardingGuide";

// Inside the app group only sign-in and the global leaderboard are open to visitors.
const publicRoutes = new Set(["/auth", "/leaderboard"]);

function LanguageSwitcher() {
    const { locale, setLocale, t } = useLocale();
    return <label className="global-language"><span>{t('language')}</span><select aria-label={t('language')} value={locale} onChange={event => setLocale(event.target.value as Locale)}>{locales.map(item => <option key={item} value={item}>{item.toUpperCase()}</option>)}</select></label>;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
    const { loading, userId, profile } = useGame();
    const pathname = usePathname();
    const router = useRouter();
    const adminRoute = pathname.startsWith('/admin');

    useEffect(() => {
        if (!loading && !userId) router.replace(`/auth?next=${encodeURIComponent(pathname)}`);
        else if (adminRoute && !loading && userId && !profile?.isAdmin) router.replace('/dashboard');
    }, [adminRoute, loading, pathname, profile?.isAdmin, router, userId]);

    if (loading || !userId || (adminRoute && !profile?.isAdmin)) return <main className="route-loading" aria-busy="true" aria-label="Loading"><span className="logo"><span>FANTA</span>FORT</span></main>;
    return children;
}

function LevelUpNotice() {
    const { profile, userId } = useGame();
    const { t } = useLocale();
    const [level, setLevel] = useState(0);

    useEffect(() => {
        if (!profile || !userId) return;
        const key = `fantafort-xp:${userId}`;
        const previous = Number(localStorage.getItem(key) ?? profile.experiencePoints);
        localStorage.setItem(key, String(profile.experiencePoints));
        const nextLevel = getLevelProgress(profile.experiencePoints).level;
        if (getLevelProgress(previous).level < nextLevel) {
            setLevel(nextLevel);
            const timer = setTimeout(() => setLevel(0), 5000);
            return () => clearTimeout(timer);
        }
    }, [profile, userId]);

    return level ? <div className="level-up-toast" role="status">{t('levelUp').replace('{level}', String(level))}</div> : null;
}

function RouteShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    if (publicRoutes.has(pathname)) return children;
    return <><LanguageSwitcher /><AuthGuard>{children}<BetaCommunityNotice /><OnboardingGuide /><LevelUpNotice /><CookieNotice /><LegalFooter /></AuthGuard></>;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
    return <GameProvider><RouteShell>{children}</RouteShell></GameProvider>;
}
