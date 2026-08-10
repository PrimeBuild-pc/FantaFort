/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { GameProvider, useGame } from "@/context/GameContext";
import { LocaleProvider, useLocale } from "@/context/LocaleContext";
import { Locale, locales } from "@/lib/i18n";
import { getLevelProgress } from "@/lib/types";
import BetaCommunityNotice from "@/components/BetaCommunityNotice";
import CookieNotice from "@/components/CookieNotice";
import LegalFooter from "@/components/LegalFooter";
import OnboardingGuide from "@/components/OnboardingGuide";

const publicRoutes = new Set(["/", "/auth", "/about", "/cookies", "/how-it-works", "/methodology"]);
const publicPrefix = /^\/(?:it|es|de|fr)(?:\/|$)|^\/(?:guides|players)(?:\/|$)/;

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

    if (loading || !userId || (adminRoute && !profile?.isAdmin)) return null;
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
    const publicRoute = publicRoutes.has(pathname) || publicPrefix.test(pathname);
    if (publicRoute) return children;
    return <><LanguageSwitcher /><AuthGuard>{children}<BetaCommunityNotice /><OnboardingGuide /><LevelUpNotice /><CookieNotice /><LegalFooter /></AuthGuard></>;
}

export function Providers({ children }: { children: React.ReactNode }) {
    return <LocaleProvider><GameProvider><RouteShell>{children}</RouteShell></GameProvider></LocaleProvider>;
}
