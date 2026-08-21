const config = window.FUNDING_SUPABASE || {};

if (!window.supabase || !config.url || !config.anonKey) {
  throw new Error('Supabase authentication is not configured.');
}

export const authClient = window.FUNDING_AUTH_CLIENT || window.supabase.createClient(
  config.url,
  config.anonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

window.FUNDING_AUTH_CLIENT = authClient;

export function accountFromSession(session) {
  if (!session?.user) return null;
  return {
    id: session.user.id,
    email: session.user.email || session.user.user_metadata?.email || '',
    provider: session.user.app_metadata?.provider || 'email',
    synced: true,
  };
}

export function authRedirectUrl(pathname = window.location.pathname) {
  const url = new URL(pathname, window.location.origin);
  url.search = '';
  url.hash = '';
  return url.href;
}

export async function signInWithGoogle(pathname) {
  return authClient.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: authRedirectUrl(pathname) },
  });
}
