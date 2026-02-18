-- Feedback tickets: users submit feedback; you view and mark resolved in Supabase.
-- Run in Supabase SQL Editor.

-- Table: ticket numbers, subject, message, user link, status (open/resolved)
CREATE TABLE IF NOT EXISTS public.feedback_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  subject text NOT NULL,
  message text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

-- Index for "my tickets" and for listing by date
CREATE INDEX IF NOT EXISTS idx_feedback_tickets_user_id ON public.feedback_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_tickets_created_at ON public.feedback_tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_tickets_status ON public.feedback_tickets(status);

-- RLS
ALTER TABLE public.feedback_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_tickets FORCE ROW LEVEL SECURITY;

-- Authenticated: can INSERT (submit feedback); can SELECT only their own rows (see ticket numbers).
DROP POLICY IF EXISTS "feedback_insert_authenticated" ON public.feedback_tickets;
CREATE POLICY "feedback_insert_authenticated"
  ON public.feedback_tickets FOR INSERT TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "feedback_select_own" ON public.feedback_tickets;
CREATE POLICY "feedback_select_own"
  ON public.feedback_tickets FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- No UPDATE/DELETE for authenticated: only you (via Supabase Dashboard / service role) can mark resolved.
REVOKE ALL ON public.feedback_tickets FROM PUBLIC;
GRANT INSERT ON public.feedback_tickets TO authenticated;
GRANT SELECT ON public.feedback_tickets TO authenticated;

-- Service role (Dashboard, backend) can do everything: view all tickets and set status/resolved_at.
-- (Supabase Dashboard uses service_role by default, so you can open Table Editor and edit status to 'resolved' and set resolved_at.)

-- Optional: trigger to set updated_at and resolved_at when status changes
CREATE OR REPLACE FUNCTION public.feedback_tickets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  IF NEW.status = 'resolved' AND (OLD.status IS DISTINCT FROM 'resolved') THEN
    NEW.resolved_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feedback_tickets_updated_at ON public.feedback_tickets;
CREATE TRIGGER feedback_tickets_updated_at
  BEFORE UPDATE ON public.feedback_tickets
  FOR EACH ROW EXECUTE FUNCTION public.feedback_tickets_updated_at();

COMMENT ON TABLE public.feedback_tickets IS 'User feedback tickets. Users insert and see their own; mark resolved in Supabase Dashboard (Table Editor).';
