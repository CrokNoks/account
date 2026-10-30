// Chargé avant chaque suite e2e (setupFiles) : une URL non locale + un secret
// active la validation HS256 de SupabaseStrategy, sans appel réseau.
process.env.SUPABASE_URL = 'https://e2e.supabase.co';
process.env.SUPABASE_ANON_KEY = 'e2e-anon-key';
process.env.SUPABASE_JWT_SECRET = 'e2e-secret';
process.env.GEMINI_API_KEY = '';
