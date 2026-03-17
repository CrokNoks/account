-- Update default value for dashboard_layout to support grid system
ALTER TABLE public.user_preferences 
ALTER COLUMN dashboard_layout SET DEFAULT '{"widgets": [
  {"id": "stat-start", "width": 2}, 
  {"id": "stat-income", "width": 2}, 
  {"id": "stat-expenses", "width": 2}, 
  {"id": "stat-bank", "width": 2}, 
  {"id": "stat-upcoming", "width": 2}, 
  {"id": "stat-forecast", "width": 2}, 
  {"id": "net-worth", "width": 6}, 
  {"id": "pulse", "width": 6}, 
  {"id": "anomalies", "width": 12}, 
  {"id": "breakdown", "width": 6}, 
  {"id": "top-expenses", "width": 6}, 
  {"id": "transactions", "width": 12}
]}'::JSONB;

-- Migration for existing users (reset to new default)
UPDATE public.user_preferences
SET dashboard_layout = '{"widgets": [
  {"id": "stat-start", "width": 2}, 
  {"id": "stat-income", "width": 2}, 
  {"id": "stat-expenses", "width": 2}, 
  {"id": "stat-bank", "width": 2}, 
  {"id": "stat-upcoming", "width": 2}, 
  {"id": "stat-forecast", "width": 2}, 
  {"id": "net-worth", "width": 6}, 
  {"id": "pulse", "width": 6}, 
  {"id": "anomalies", "width": 12}, 
  {"id": "breakdown", "width": 6}, 
  {"id": "top-expenses", "width": 6}, 
  {"id": "transactions", "width": 12}
]}'::JSONB;
