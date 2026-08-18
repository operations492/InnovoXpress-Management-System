import { createClient } from '@supabase/supabase-js';

/**
 * The browser's Supabase client — used for authentication ONLY.
 *
 * All data still comes from our own API. Supabase is asked one question here:
 * "is this person who they say they are?" The answer is a token our backend
 * verifies, and which Postgres will understand once row-level security policies
 * arrive.
 *
 * `persistSession` keeps the session across reloads and `autoRefreshToken`
 * renews it silently before it expires — two things the previous hand-rolled
 * JWT never did. It had no refresh at all: a 12-hour token simply died
 * mid-session and the app logged itself back in with credentials baked into the
 * bundle.
 */

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  // Fail loudly at startup rather than with a confusing 401 on the first
  // request — a missing env var here means nobody can sign in at all.
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.',
  );
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
