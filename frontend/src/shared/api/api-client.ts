import axios from 'axios';
import { createBrowserClient } from '@supabase/ssr';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor to attach Supabase JWT to requests
apiClient.interceptors.request.use(async (config) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey) {
    const supabase = createBrowserClient(supabaseUrl, supabaseKey);
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`;
      // Debug: console.log(`[API Client] Sending token for: ${config.url}`);
    }
  }
  
  return config;
});
