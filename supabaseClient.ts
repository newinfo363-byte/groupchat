import { createClient } from '@supabase/supabase-js';

// Read Supabase credentials from Vite env vars. Do NOT commit secrets.
// Create a local `.env` (or `.env.local`) with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // In development you might want to surface a warning in console but avoid exposing keys in repo.
  console.warn('Supabase URL or ANON KEY is not set. Please provide VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
