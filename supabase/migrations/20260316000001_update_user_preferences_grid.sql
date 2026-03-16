-- Update default value for dashboard_layout to support grid system
ALTER TABLE public.user_preferences 
ALTER COLUMN dashboard_layout SET DEFAULT '{"widgets": [
  {"id": "anomalies", "width": 12}, 
  {"id": "stats", "width": 12}, 
  {"id": "insights", "width": 12}, 
  {"id": "breakdown", "width": 6}, 
  {"id": "tags", "width": 6}, 
  {"id": "transactions", "width": 12}
]}'::JSONB;

-- Migration for existing users (simplistic approach: reset to new default if they have the old format)
UPDATE public.user_preferences
SET dashboard_layout = '{"widgets": [
  {"id": "anomalies", "width": 12}, 
  {"id": "stats", "width": 12}, 
  {"id": "insights", "width": 12}, 
  {"id": "breakdown", "width": 6}, 
  {"id": "tags", "width": 6}, 
  {"id": "transactions", "width": 12}
]}'::JSONB
WHERE dashboard_layout->'widgets'->0 ? 'string'; -- This is a loose check but works if we know it was an array of strings
