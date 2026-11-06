// FitPro <-> Postura Pro Analyser gateway
// Autenticação: Bearer fpk_... (tokens em public.fitpro_integration_tokens)
// Contrato FitPro postura-pro-scan: POST /analyze { front, back, left, right } signed URLs
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

async function sha256Hex(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function authenticate(req: Request): Promise<{ teacher_id: string } | Response> {
  const h = req.headers.get('Authorization') || '';
  if (!h.startsWith('Bearer ')) return json({ error: 'Missing bearer token' }, 401);
  const token = h.slice(7).trim();
  if (!token.startsWith('fpk_')) return json({ error: 'Invalid token format' }, 401);
  const hash = await sha256Hex(token);
  const { data, error } = await admin
    .from('fitpro_integration_tokens')
    .select('id, teacher_id, revoked_at')
    .eq('token_hash', hash)
    .maybeSingle();
  if (error || !data) return json({ error: 'Invalid token' }, 401);
  if (data.revoked_at) return json({ error: 'Token revoked' }, 401);
  admin.from('fitpro_integration_tokens')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id).then();
  return { teacher_id: data.teacher_id };
}

async function ensureOwnsStudent(teacher_id: string, student_id: string) {
  const { data } = await admin.from('students')
    .select('id').eq('teacher_id', teacher_id).eq('student_id', student_id).maybeSingle();
  return !!data;
}

async function invokeAI(fn: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${SERVICE_ROLE}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

function isSignedImageUrl(value: unknown): value is string {
  return typeof value === 'string' && /^https?:\/\//.test(value) && !value.includes('..');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { teacher_id } = auth;

  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/fitpro-api/, '') || '/';

  try {
    // ===== FitPro 4-photo contract =====
    // postura-pro-scan posts { front, back, left, right } signed URLs to /analyze
    if (req.method === 'POST' && path === '/analyze') {
      const body = await req.json();
      const sides = [body?.front, body?.back, body?.left, body?.right];
      if (!sides.every(isSignedImageUrl))
        return json({ error: 'front, back, left, right signed image URLs required' }, 400);

      const result = await invokeAI('analyze-posture', {
        images: {
          front: body.front,
          back: body.back,
          leftProfile: body.left,
          rightProfile: body.right,
        },
        clientData: body.clientData || {},
      });

      // Return the analyze-posture shape as-is so FitPro confirmedPostureResult accepts it.
      return json(result);
    }

    if (req.method === 'GET' && path === '/teacher/dashboard') {
      const [{ data: students }, { data: assessments }] = await Promise.all([
        admin.rpc('get_teacher_students', { teacher_id }),
        admin.from('ppa_assessments').select('id, status, created_at, student_id')
          .eq('teacher_id', teacher_id).order('created_at', { ascending: false }).limit(20),
      ]);
      const list = (assessments || []) as any[];
      return json({
        students: students || [],
        assessments: list,
        stats: {
          students: (students || []).length,
          assessments: list.length,
          active: list.filter(a => a.status === 'em_coleta' || a.status === 'analisando').length,
          pending: list.filter(a => a.status === 'novo').length,
        },
      });
    }

    if (req.method === 'GET' && path === '/teacher/students') {
      const { data } = await admin.rpc('get_teacher_students', { teacher_id });
      return json({ students: data || [] });
    }

    if (req.method === 'GET' && path === '/teacher/assessments') {
      const limit = Number(url.searchParams.get('limit') || 20);
      const { data } = await admin.from('ppa_assessments')
        .select('*').eq('teacher_id', teacher_id)
        .order('created_at', { ascending: false }).limit(limit);
      return json({ assessments: data || [] });
    }

    const student_id = url.searchParams.get('student_id') || '';
    if (path.startsWith('/student/') && req.method === 'GET') {
      if (!student_id) return json({ error: 'student_id required' }, 400);
      if (!(await ensureOwnsStudent(teacher_id, student_id))) return json({ error: 'Forbidden' }, 403);
    }

    if (req.method === 'GET' && path === '/student/dashboard') {
      const [{ data: lastA }, { data: plan }, { data: logs }] = await Promise.all([
        admin.from('ppa_assessments').select('*').eq('student_id', student_id)
          .order('created_at', { ascending: false }).limit(1),
        admin.from('ppa_plan_links').select('*').eq('student_id', student_id).eq('active', true).limit(1),
        admin.from('ppa_monitoring_logs').select('*').eq('student_id', student_id)
          .order('created_at', { ascending: false }).limit(10),
      ]);
      return json({ last_assessment: lastA?.[0] || null, active_plan: plan?.[0] || null, recent_logs: logs || [] });
    }

    if (req.method === 'GET' && path === '/student/report') {
      const { data: assessments } = await admin.from('ppa_assessments')
        .select('id, status, created_at, context, pain')
        .eq('student_id', student_id).order('created_at', { ascending: false }).limit(5);
      const ids = (assessments || []).map((a: any) => a.id);
      const { data: runs } = ids.length
        ? await admin.from('ppa_analysis_runs').select('*').in('assessment_id', ids)
        : { data: [] as any[] };
      return json({ assessments: assessments || [], analysis_runs: runs || [] });
    }

    if (req.method === 'GET' && path === '/student/prescriptions') {
      const { data: plans } = await admin.from('ppa_plan_links')
        .select('*').eq('student_id', student_id).eq('active', true);
      return json({ prescriptions: plans || [] });
    }

    if (req.method === 'POST' && path === '/analysis/photo') {
      const body = await req.json();
      if (!body.student_id || !body.image_base64 || !body.view)
        return json({ error: 'student_id, image_base64, view required' }, 400);
      if (!(await ensureOwnsStudent(teacher_id, body.student_id))) return json({ error: 'Forbidden' }, 403);
      const result = await invokeAI('analyze-posture', {
        view: body.view,
        image_base64: body.image_base64,
        context: body.context || {},
      });
      return json({ ok: true, source: 'analyze-posture', ...result });
    }

    if (req.method === 'POST' && path === '/analysis/video') {
      const body = await req.json();
      if (!body.student_id || !body.exercise_type || !body.evaluation_intent || !Array.isArray(body.frames_base64))
        return json({ error: 'student_id, exercise_type, evaluation_intent, frames_base64 required' }, 400);
      if (body.duration_sec && body.duration_sec > 5) return json({ error: 'Vídeo limitado a 5 segundos' }, 400);
      if (!(await ensureOwnsStudent(teacher_id, body.student_id))) return json({ error: 'Forbidden' }, 403);
      const result = await invokeAI('analyze-movement', {
        exerciseType: body.exercise_type,
        evaluationIntent: body.evaluation_intent,
        frames: body.frames_base64.map((f: string, i: number) => ({ index: i, image_base64: f })),
        romData: body.rom_data || {},
        studentContext: body.context || {},
      });
      return json({ ok: true, source: 'analyze-movement', ...result });
    }

    if (req.method === 'POST' && path === '/train/prescriptions/sync') {
      const body = await req.json();
      if (!body.student_id) return json({ error: 'student_id required' }, 400);
      if (!(await ensureOwnsStudent(teacher_id, body.student_id))) return json({ error: 'Forbidden' }, 403);
      const { data: plans } = await admin.from('ppa_plan_links')
        .select('*').eq('student_id', body.student_id).eq('active', true);
      const protocolKeys = new Set<string>();
      (plans || []).forEach((p: any) => (p.recommendations || []).forEach((r: any) => r?.protocol_key && protocolKeys.add(r.protocol_key)));
      const { data: protocols } = protocolKeys.size
        ? await admin.from('ppa_protocols_library').select('*').in('protocol_key', Array.from(protocolKeys))
        : { data: [] as any[] };
      return json({
        student_id: body.student_id,
        protocols: protocols || [],
        target_module: 'fitpro.train',
      });
    }

    return json({ error: 'Not found', path, method: req.method }, 404);
  } catch (e: any) {
    console.error('fitpro-api error', e);
    return json({ error: e.message || 'Internal error' }, 500);
  }
});
