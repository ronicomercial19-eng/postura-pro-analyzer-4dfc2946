import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Consome 1 unidade da cota mensal de IA do usuário autenticado.
 * Retorna Response (401/429) quando bloqueado, ou null quando liberado.
 */
export async function enforceAiQuota(
  req: Request,
  functionName: string,
  corsHeaders: Record<string, string>,
  userIdOverride?: string,
): Promise<Response | null> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  // Chamada interna (fitpro-api) já consumiu a cota do professor.
  if (!userIdOverride && serviceKey && req.headers.get("x-ppa-internal") === serviceKey) return null;
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  let userId = userIdOverride;
  if (!userId) {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const { data } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    userId = data?.user?.id;
  }
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  if (!userId) return json(401, { status: "error", error: "Autenticação obrigatória para análises de IA." });

  const { data, error } = await admin.rpc("consume_ai_quota", { _user_id: userId, _function_name: functionName });
  if (error) return json(500, { status: "error", error: `Falha ao verificar cota de IA: ${error.message}` });
  const q = data as { allowed: boolean; used: number; limit: number };
  if (!q.allowed) {
    return json(429, {
      status: "error",
      error: `Limite mensal de análises de IA atingido (${q.used}/${q.limit}). Faça upgrade do plano ou aguarde o próximo ciclo.`,
      quota: q,
    });
  }
  return null;
}
