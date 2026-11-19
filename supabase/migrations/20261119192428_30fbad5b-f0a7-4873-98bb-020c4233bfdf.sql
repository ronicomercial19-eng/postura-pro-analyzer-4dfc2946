CREATE TABLE public.teacher_access (
  user_id uuid PRIMARY KEY,
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  plan_status text NOT NULL DEFAULT 'trial',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teacher_access TO authenticated;
GRANT ALL ON public.teacher_access TO service_role;
ALTER TABLE public.teacher_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY teacher_access_read_own ON public.teacher_access FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.get_teacher_access()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.teacher_access;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'teacher') THEN
    RETURN jsonb_build_object('applies', false);
  END IF;
  INSERT INTO public.teacher_access(user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  SELECT * INTO r FROM public.teacher_access WHERE user_id = auth.uid();
  RETURN jsonb_build_object('applies', true, 'plan_status', r.plan_status, 'trial_ends_at', r.trial_ends_at,
    'active', r.plan_status = 'active' OR (r.plan_status = 'trial' AND r.trial_ends_at > now()));
END $$;
REVOKE ALL ON FUNCTION public.get_teacher_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_access() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_teacher(user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = COALESCE(user_id, auth.uid()) AND p.role = 'teacher'
      AND NOT EXISTS (
        SELECT 1 FROM public.teacher_access a WHERE a.user_id = p.id
          AND NOT (a.plan_status = 'active' OR (a.plan_status = 'trial' AND a.trial_ends_at > now()))
      )
  );
$$;