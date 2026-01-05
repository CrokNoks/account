DO $$
DECLARE
    r record;
BEGIN
    FOR r IN (SELECT constraint_name FROM information_schema.constraint_column_usage WHERE table_name = 'categories' AND column_name = 'type') LOOP
        EXECUTE 'ALTER TABLE categories DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

ALTER TABLE categories ADD CONSTRAINT categories_type_check CHECK (type IN ('expense', 'income', 'transfer', 'savings'));
