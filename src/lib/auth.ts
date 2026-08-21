export const isStrongPassword = (password: string) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,128}$/.test(password);

export const isEmailSendRateLimit = (error: { status?: number; code?: string } | null) =>
  error?.status === 429 || error?.code === 'over_email_send_rate_limit';

export const isDisposableEmailError = (error: { code?: string; message?: string } | null) =>
  error?.code === 'disposable_email' || error?.message === 'Disposable email addresses are not allowed.';

export const isExistingSignup = (user: { identities?: unknown[] } | null) =>
  Array.isArray(user?.identities) && user.identities.length === 0;

export const safeRedirectPath = (requested: string | null, origin: string) => {
  if (!requested?.startsWith('/')) return '/dashboard';
  const url = new URL(requested, origin);
  return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : '/dashboard';
};
