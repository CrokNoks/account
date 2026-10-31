-- Deux périodes d'un même compte ne peuvent pas se chevaucher (bornes incluses,
-- end_date NULL = période ouverte). Garanti par la base, donc aussi sous concurrence.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.periods
  ADD CONSTRAINT periods_no_overlap
  EXCLUDE USING gist (
    account_id WITH =,
    daterange(start_date, end_date, '[]') WITH &&
  );
