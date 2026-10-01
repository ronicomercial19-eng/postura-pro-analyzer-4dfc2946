import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Play, Pause, RotateCcw, CheckCircle2, Flame, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { StretchingPlanItem } from '@/utils/studentReportGenerator';

const CATEGORY_LABEL: Record<string, { label: string; color: string }> = {
  liberacao: { label: 'Liberação', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  alongamento: { label: 'Alongamento', color: 'bg-amber-100 text-amber-700 border-amber-300' },
  fortalecimento: { label: 'Fortalecimento', color: 'bg-purple-100 text-purple-700 border-purple-300' },
  ativacao: { label: 'Ativação', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  integracao: { label: 'Integração', color: 'bg-green-100 text-green-700 border-green-300' },
};

function ExerciseCard({ item, done, onToggleDone }: { item: StretchingPlanItem; done: boolean; onToggleDone: () => void }) {
  const isTimed = /s$/.test(item.reps_or_time.trim());
  const totalSeconds = isTimed ? parseInt(item.reps_or_time, 10) || 30 : 0;
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (running && secondsLeft > 0) {
      intervalRef.current = setInterval(() => setSecondsLeft(s => s - 1), 1000);
    } else if (secondsLeft === 0 && running) {
      setRunning(false);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, secondsLeft]);

  const reset = () => { setRunning(false); setSecondsLeft(totalSeconds); };
  const cat = CATEGORY_LABEL[item.category] || CATEGORY_LABEL.liberacao;

  return (
    <Card className={`border-2 transition-all ${done ? 'border-green-400 bg-green-50' : 'border-slate-200 bg-white'}`}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <button
              onClick={onToggleDone}
              className={`mt-0.5 w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                done ? 'bg-green-500 border-green-500' : 'border-slate-300'
              }`}
              aria-label="Marcar como feito"
            >
              {done && <CheckCircle2 className="h-5 w-5 text-white" />}
            </button>
            <div>
              <p className="text-lg font-bold text-slate-900 leading-tight">{item.order}. {item.name}</p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <Badge className={`${cat.color} text-xs`}>{cat.label}</Badge>
                <span className="text-sm font-semibold text-slate-600">{item.sets}x {item.reps_or_time}</span>
              </div>
            </div>
          </div>
        </div>

        {isTimed && (
          <div className="mt-4 flex items-center gap-3 bg-slate-50 rounded-xl p-3">
            <div className="text-3xl font-black tabular-nums text-slate-900 w-16 text-center">{secondsLeft}s</div>
            <Button size="sm" variant={running ? 'secondary' : 'default'} className="flex-1 min-h-[44px] text-base" onClick={() => setRunning(r => !r)} disabled={secondsLeft === 0}>
              {running ? <Pause className="h-4 w-4 mr-1" /> : <Play className="h-4 w-4 mr-1" />}
              {running ? 'Pausar' : secondsLeft === 0 ? 'Feito!' : 'Iniciar'}
            </Button>
            <Button size="sm" variant="outline" onClick={reset} className="min-h-[44px]">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        )}

        {item.notes && <p className="text-sm text-slate-500 mt-3">{item.notes}</p>}
      </CardContent>
    </Card>
  );
}

export const StudentStretchingPlan = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState<StretchingPlanItem[]>([]);
  const [doneMap, setDoneMap] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('ppa_plan_links' as any)
          .select('stretching_plan')
          .eq('student_id', user.id)
          .eq('active', true)
          .order('published_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        const items = ((data as any)?.stretching_plan || []) as StretchingPlanItem[];
        setPlan(items);
      } catch (e) {
        console.error('load stretching plan', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const toggleDone = (order: number) => setDoneMap(m => ({ ...m, [order]: !m[order] }));
  const doneCount = Object.values(doneMap).filter(Boolean).length;
  const progress = plan.length > 0 ? Math.round((doneCount / plan.length) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (plan.length === 0) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="p-8 text-center">
          <Sparkles className="h-10 w-10 mx-auto mb-3 text-slate-300" />
          <p className="text-lg font-semibold text-slate-700">Seu plano ainda não foi publicado</p>
          <p className="text-sm text-slate-500 mt-1">Assim que seu professor concluir a avaliação, seus exercícios aparecem aqui.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5 pb-24">
      <Card className="bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-300 font-medium">Seu plano de hoje</p>
              <p className="text-2xl font-black">{doneCount}/{plan.length} exercícios</p>
            </div>
            <Flame className={`h-8 w-8 ${progress === 100 ? 'text-orange-400' : 'text-slate-500'}`} />
          </div>
          <div className="mt-3 h-2 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-green-400 transition-all" style={{ width: `${progress}%` }} />
          </div>
        </CardContent>
      </Card>

      {plan.map(item => (
        <ExerciseCard key={item.order} item={item} done={!!doneMap[item.order]} onToggleDone={() => toggleDone(item.order)} />
      ))}

      {progress === 100 && (
        <Card className="border-2 border-green-400 bg-green-50">
          <CardContent className="p-5 text-center">
            <CheckCircle2 className="h-8 w-8 mx-auto text-green-600 mb-2" />
            <p className="font-bold text-green-800">Plano concluído! 🎉</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StudentStretchingPlan;
