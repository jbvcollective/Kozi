-- Rename agents.agent_code to agents.code. Run in Supabase SQL Editor (once).
-- After this, the code is saved in the agents table in the column named "code".

ALTER TABLE public.agents RENAME COLUMN agent_code TO code;

COMMENT ON COLUMN public.agents.code IS 'Unique 8-char code (first+last letter first name + first+last letter last name + MM + YY). Stored only in this table.';

-- Regenerate the function to use the new column name
CREATE OR REPLACE FUNCTION public.generate_agent_code(full_name text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fn text;
  ln text;
  fn_part text;
  ln_part text;
  month_part text;
  year_part text;
  base text;
  candidate text;
  n integer := 1;
BEGIN
  fn := SPLIT_PART(TRIM(COALESCE(full_name, '')), ' ', 1);
  ln := TRIM(SUBSTRING(TRIM(COALESCE(full_name, '')) FROM LENGTH(fn) + 2));
  IF fn = '' THEN fn := 'AX'; END IF;
  IF ln = '' OR ln = fn THEN ln := fn; END IF;
  fn_part := UPPER(LEFT(fn, 1)) || UPPER(RIGHT(fn, 1));
  IF LENGTH(fn_part) < 2 THEN fn_part := fn_part || UPPER(LEFT(fn, 1)); END IF;
  ln_part := UPPER(LEFT(ln, 1)) || UPPER(RIGHT(ln, 1));
  IF LENGTH(ln_part) < 2 THEN ln_part := ln_part || UPPER(LEFT(ln, 1)); END IF;
  month_part := LPAD(EXTRACT(MONTH FROM NOW())::text, 2, '0');
  year_part := LPAD((EXTRACT(YEAR FROM NOW())::integer % 100)::text, 2, '0');
  base := fn_part || ln_part || month_part || year_part;
  candidate := base;
  WHILE EXISTS (SELECT 1 FROM public.agents WHERE code = candidate) LOOP
    n := n + 1;
    candidate := base || n;
  END LOOP;
  RETURN candidate;
END;
$$;

CREATE OR REPLACE FUNCTION public.on_agent_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  agent_data jsonb;
  new_code text;
  full_name text;
BEGIN
  IF (NEW.raw_user_meta_data->>'user_type') = 'agent' THEN
    full_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), '');
    IF full_name IS NULL OR full_name = '' THEN full_name := SPLIT_PART(NEW.email, '@', 1); END IF;
    new_code := public.generate_agent_code(full_name);
    agent_data := jsonb_build_object(
      'display_name', COALESCE(full_name, NEW.email),
      'brokerage', NULLIF(TRIM(NEW.raw_user_meta_data->>'brokerage'), ''),
      'email', NEW.email,
      'phone', NULLIF(TRIM(NEW.raw_user_meta_data->>'phone'), '')
    );
    INSERT INTO public.agents (user_id, code, data)
    VALUES (NEW.id, new_code, agent_data)
    ON CONFLICT (user_id) DO UPDATE SET
      code = COALESCE(public.agents.code, EXCLUDED.code),
      data = public.agents.data || EXCLUDED.data,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;
