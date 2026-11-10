REVOKE ALL ON public.ai_usage_events, public.ai_quota_limits, public.user_consents FROM anon;
COMMENT ON TABLE public.ai_usage_events IS E'@graphql({"totalCount": {"enabled": false}})';
REVOKE SELECT ON public.ai_usage_events, public.ai_quota_limits FROM authenticated;
CREATE OR REPLACE FUNCTION public.get_my_ai_quota()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'used', (SELECT count(*) FROM public.ai_usage_events WHERE user_id = auth.uid() AND created_at >= date_trunc('month', now())),
    'limit', COALESCE((SELECT monthly_limit FROM public.ai_quota_limits WHERE user_id = auth.uid()), 50));
$$;
REVOKE ALL ON FUNCTION public.get_my_ai_quota() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_ai_quota() TO authenticated;