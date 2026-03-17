-- Update default value for dashboard_layout to support device visibility
ALTER TABLE public.user_preferences 
ALTER COLUMN dashboard_layout SET DEFAULT '{"widgets": [
  {"id": "stat-start", "width": 2, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "stat-income", "width": 2, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "stat-expenses", "width": 2, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "stat-bank", "width": 2, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "stat-upcoming", "width": 2, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "stat-forecast", "width": 2, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "net-worth", "width": 6, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "pulse", "width": 6, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "anomalies", "width": 12, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "breakdown", "width": 6, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "top-expenses", "width": 6, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "transactions", "width": 12, "desktopVisible": true, "mobileVisible": true}
]}'::JSONB;

-- Migration for existing users (simplistic approach: reset to new default to ensure consistency)
UPDATE public.user_preferences
SET dashboard_layout = '{"widgets": [
  {"id": "stat-start", "width": 2, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "stat-income", "width": 2, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "stat-expenses", "width": 2, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "stat-bank", "width": 2, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "stat-upcoming", "width": 2, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "stat-forecast", "width": 2, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "net-worth", "width": 6, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "pulse", "width": 6, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "anomalies", "width": 12, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "breakdown", "width": 6, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "top-expenses", "width": 6, "desktopVisible": true, "mobileVisible": true}, 
  {"id": "transactions", "width": 12, "desktopVisible": true, "mobileVisible": true}
]}'::JSONB;
