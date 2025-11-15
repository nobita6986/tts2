import { createClient } from '@supabase/supabase-js';

// Read from the global config object set in index.html
const supabaseUrl = window.APP_CONFIG?.VITE_SUPABASE_URL;
const supabaseAnonKey = window.APP_CONFIG?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase URL and Anon Key must be provided in window.APP_CONFIG in index.html.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);