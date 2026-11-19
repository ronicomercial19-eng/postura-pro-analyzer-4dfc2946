CREATE OR REPLACE FUNCTION public.is_teacher(user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = COALESCE(user_id, auth.uid())
      AND (p.role = 'admin' OR (p.role = 'teacher'
      AND NOT EXISTS (
        SELECT 1 FROM public.teacher_access a WHERE a.user_id = p.id
          AND NOT (a.plan_status = 'active' OR (a.plan_status = 'trial' AND a.trial_ends_at > now()))
      )))
  );
$$;

CREATE OR REPLACE FUNCTION public.enforce_single_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF lower(NEW.email) = 'roni.comercial19@gmail.com' THEN
    NEW.role := 'admin';
  ELSIF NEW.role = 'admin' THEN
    NEW.role := 'teacher';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_single_admin() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS zz_enforce_single_admin ON public.profiles;
CREATE TRIGGER zz_enforce_single_admin BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_single_admin();

UPDATE public.profiles SET role = 'teacher' WHERE role = 'admin' AND lower(email) <> 'roni.comercial19@gmail.com';
UPDATE public.profiles SET role = 'admin' WHERE lower(email) = 'roni.comercial19@gmail.com';