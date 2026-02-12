DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'notifications' AND column_name = 'reference_id') THEN
        ALTER TABLE notifications ADD COLUMN reference_id UUID;
    END IF;
END $$;
