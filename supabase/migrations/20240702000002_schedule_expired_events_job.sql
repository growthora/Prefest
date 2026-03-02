-- Enable pg_cron extension if not enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the job to run every hour
-- We use every hour instead of 24h to ensure events are updated relatively quickly after they expire
-- The function update_expired_events() was created in the previous migration
SELECT cron.schedule(
  'update-expired-events', -- name of the job
  '0 * * * *', -- every hour at minute 0
  $$SELECT update_expired_events()$$
);
