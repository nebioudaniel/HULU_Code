ALTER TABLE users
  ADD COLUMN IF NOT EXISTS plan_chosen BOOLEAN NOT NULL DEFAULT false;

UPDATE users
   SET plan_chosen = true;
