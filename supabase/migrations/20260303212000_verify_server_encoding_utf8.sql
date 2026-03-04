DO $$
BEGIN
  IF current_setting('server_encoding') <> 'UTF8' THEN
    RAISE EXCEPTION 'Server encoding must be UTF8. Current: %', current_setting('server_encoding');
  END IF;

  RAISE NOTICE 'SERVER_ENCODING=%', current_setting('server_encoding');
END $$;
