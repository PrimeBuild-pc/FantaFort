"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LocaleProvider } from "@/context/LocaleContext";
import { useSignedInHint } from "@/lib/session-hint";

// Visitors read the landing page; signed-in managers go straight to their dashboard,
// where the app routes verify the session (an expired one lands on /auth).
function HomeGate() {
    const signedIn = useSignedInHint();
    const router = useRouter();

    useEffect(() => {
        if (signedIn) router.replace('/dashboard');
    }, [router, signedIn]);

    return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    return <LocaleProvider>{children}{pathname === '/' && <HomeGate />}</LocaleProvider>;
}
