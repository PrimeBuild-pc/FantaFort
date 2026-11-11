"use client";

import { useSyncExternalStore } from 'react';

// Public pages only need to know whether to offer "Open game" or "Sign in". Reading the
// stored Supabase session key answers that without shipping the Supabase client; the
// app routes still verify the session properly before showing anything.
const hasStoredSession = () => {
  try {
    return Object.keys(localStorage).some(key => key.startsWith('sb-') && key.endsWith('-auth-token'));
  } catch {
    return false;
  }
};

const subscribe = (onChange: () => void) => {
  window.addEventListener('storage', onChange);
  return () => window.removeEventListener('storage', onChange);
};

export function useSignedInHint() {
  return useSyncExternalStore(subscribe, hasStoredSession, () => false);
}
