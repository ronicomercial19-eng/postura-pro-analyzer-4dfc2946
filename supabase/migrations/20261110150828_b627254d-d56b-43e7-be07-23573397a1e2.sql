CREATE TABLE public.ai_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  function_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_usage_events_user_month ON public.ai_usage_events (user_id, created_at DESC);
GRANT SELECT ON public.ai_usage_events TO authenticated;
GRANT ALL ON public.ai_usage_events TO service_role;
ALTER TABLE public.ai_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_usage_read" ON public.ai_usage_events FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE public.ai_quota_limits (
  user_id uuid PRIMARY KEY,
  monthly_limit integer NOT NULL DEFAULT 50 CHECK (monthly_limit >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_quota_limits TO authenticated;
GRANT ALL ON public.ai_quota_limits TO service_role;
ALTER TABLE public.ai_quota_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_limit_read" ON public.ai_quota_limits FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.consume_ai_quota(_user_id uuid, _function_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _limit int; _used int;
BEGIN
  SELECT monthly_limit INTO _limit FROM public.ai_quota_limits WHERE user_id = _user_id;
  _limit := COALESCE(_limit, 50);
  SELECT count(*) INTO _used FROM public.ai_usage_events
    WHERE user_id = _user_id AND created_at >= date_trunc('month', now());
  IF _used >= _limit THEN
    RETURN jsonb_build_object('allowed', false, 'used', _used, 'limit', _limit);
  END IF;
  INSERT INTO public.ai_usage_events (user_id, function_name) VALUES (_user_id, _function_name);
  RETURN jsonb_build_object('allowed', true, 'used', _used + 1, 'limit', _limit);
END $$;
REVOKE ALL ON FUNCTION public.consume_ai_quota(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_quota(uuid, text) TO service_role;

CREATE TABLE public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  consent_type text NOT NULL CHECK (consent_type IN ('terms_privacy','biometric_ai')),
  version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, consent_type, version)
);
GRANT SELECT, INSERT ON public.user_consents TO authenticated;
GRANT ALL ON public.user_consents TO service_role;
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_consents_read" ON public.user_consents FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own_consents_insert" ON public.user_consents FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());