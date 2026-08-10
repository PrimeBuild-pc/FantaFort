type AdminEnvironment = {
  NODE_ENV?: string;
  ADMIN_MUTATIONS_ENABLED?: string;
  ADMIN_BADGE_MUTATIONS_ENABLED?: string;
  ADMIN_MFA_ENFORCEMENT_ENABLED?: string;
  ADMIN_ANONYMIZATION_ENABLED?: string;
  SUPABASE_SECRET_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

const exactlyTrue = (value: string | undefined) => value === 'true';
const configured = (value: string | undefined) => typeof value === 'string' && value.trim().length > 0;

export function parseAdminRuntimeConfig(env: AdminEnvironment) {
  const serverKeyConfigured = configured(env.SUPABASE_SECRET_KEY) || configured(env.SUPABASE_SERVICE_ROLE_KEY);
  const mutationsEnabled = exactlyTrue(env.ADMIN_MUTATIONS_ENABLED) && serverKeyConfigured;

  return {
    mutationsEnabled,
    // Independent least-privilege capability: badge assign/remove runs entirely on the
    // administrator's own AAL2 session and never needs a server Supabase key, so it is
    // neither implied by nor implies ADMIN_MUTATIONS_ENABLED.
    badgeMutationsEnabled: exactlyTrue(env.ADMIN_BADGE_MUTATIONS_ENABLED),
    anonymizationEnabled: mutationsEnabled && exactlyTrue(env.ADMIN_ANONYMIZATION_ENABLED),
    mfaEnforcementEnabled: env.NODE_ENV === 'production' || env.ADMIN_MFA_ENFORCEMENT_ENABLED !== 'false',
    serverKeyConfigured,
  };
}

export const adminRuntimeConfig = () => parseAdminRuntimeConfig(process.env);
