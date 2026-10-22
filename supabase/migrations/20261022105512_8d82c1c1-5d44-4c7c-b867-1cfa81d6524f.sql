REVOKE ALL PRIVILEGES ON TABLE public.ppa_live_rules FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.ppa_live_corrections FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ppa_live_rules FROM authenticated;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.ppa_live_corrections FROM authenticated;
GRANT SELECT ON TABLE public.ppa_live_rules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ppa_live_corrections TO authenticated;
GRANT ALL ON TABLE public.ppa_live_rules, public.ppa_live_corrections TO service_role;