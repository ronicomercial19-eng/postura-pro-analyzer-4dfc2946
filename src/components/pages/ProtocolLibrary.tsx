import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { BookOpen, Search, Plus, AlertTriangle, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProtocolStep {
  sequence: number;
  name: string;
  cue: string;
  sets: number;
  reps: number | string;
  tempo: string;
}

interface Protocol {
  id: string;
  protocol_key: string;
  category: string;
  steps: ProtocolStep[];
  contraindications: string[];
  version: number;
}

interface StudentOption { student_id: string; full_name: string | null; email: string | null; }

const CATEGORY_LABELS: Record<string, string> = {
  decompression: 'Descompressão',
  stability: 'Estabilidade',
  wakeup: 'Wakeup Neural',
  strength_transition: 'Força / Transição',
};

const CATEGORY_COLORS: Record<string, string> = {
  decompression: 'bg-blue-100 text-blue-800 border-blue-300',
  stability: 'bg-green-100 text-green-800 border-green-300',
  wakeup: 'bg-purple-100 text-purple-800 border-purple-300',
  strength_transition: 'bg-orange-100 text-orange-800 border-orange-300',
};

const ProtocolLibrary = () => {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Aplicar protocolo a um aluno como plano ativo
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignProtocol, setAssignProtocol] = useState<Protocol | null>(null);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    loadProtocols();
    loadStudents();
  }, []);

  const loadProtocols = async () => {
    try {
      const { data, error } = await supabase.from('ppa_protocols_library' as any).select('*').order('category');
      if (error) throw error;
      setProtocols((data as any[]) || []);
    } catch {
      // Fallback demo data
      setProtocols([]);
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase.rpc('get_teacher_students', { teacher_id: user.id });
      if (error) throw error;
      setStudents((data as any[]) || []);
    } catch (e) {
      console.error('Falha ao carregar alunos:', e);
    }
  };

  const openAssign = (p: Protocol) => {
    setAssignProtocol(p);
    setSelectedStudentId('');
    setAssignOpen(true);
  };

  const applyProtocolToStudent = async () => {
    if (!assignProtocol || !selectedStudentId) {
      toast.error('Selecione um aluno');
      return;
    }
    setAssigning(true);
    try {
      const stepsHtml = (assignProtocol.steps || [])
        .map(s => `<li><strong>${s.name}</strong> — ${s.sets}x${s.reps} (${s.tempo}). ${s.cue}</li>`)
        .join('');
      const reportHtml = `<h2>Protocolo: ${assignProtocol.protocol_key.replace(/_/g, ' ')}</h2>` +
        `<p>Categoria: ${CATEGORY_LABELS[assignProtocol.category] || assignProtocol.category}</p>` +
        `<ul>${stepsHtml}</ul>`;
      const stretchingPlan = (assignProtocol.steps || []).map((s, i) => ({
        order: i + 1,
        name: s.name,
        sets: s.sets,
        reps_or_time: String(s.reps),
        cue: s.cue,
      }));

      // Desativa publicações antigas do aluno e cria esta como o plano ativo
      await supabase.from('ppa_plan_links' as any).update({ active: false }).eq('student_id', selectedStudentId).eq('active', true);
      const { error } = await supabase.from('ppa_plan_links' as any).insert({
        student_id: selectedStudentId,
        active: true,
        published_at: new Date().toISOString(),
        report_html: reportHtml,
        recommendations: assignProtocol.contraindications?.length
          ? assignProtocol.contraindications.map(c => ({ category: 'contraindicacao', text: c, is_alert: true }))
          : [],
        stretching_plan: stretchingPlan,
      });
      if (error) throw error;

      toast.success('Protocolo aplicado como plano ativo do aluno');
      setAssignOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Falha ao aplicar protocolo');
    } finally {
      setAssigning(false);
    }
  };

  const filtered = protocols.filter(p => {
    const matchesSearch = !filter || p.protocol_key.includes(filter.toLowerCase()) || 
      (p.steps as any[])?.some((s: any) => s.name?.toLowerCase().includes(filter.toLowerCase()));
    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="h-6 w-6" /> Biblioteca de Protocolos
        </h1>
        <p className="text-muted-foreground text-sm">{protocols.length} protocolos disponíveis</p>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-col sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Buscar protocolo..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            <SelectItem value="decompression">Descompressão</SelectItem>
            <SelectItem value="stability">Estabilidade</SelectItem>
            <SelectItem value="wakeup">Wakeup</SelectItem>
            <SelectItem value="strength_transition">Força</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Protocol cards */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">Nenhum protocolo encontrado.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map(p => (
            <Card key={p.id} className="cursor-pointer" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge className={CATEGORY_COLORS[p.category] || ''}>
                      {CATEGORY_LABELS[p.category] || p.category}
                    </Badge>
                    <span className="font-medium text-sm">{p.protocol_key.replace(/_/g, ' ')}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">v{p.version}</Badge>
                    <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); openAssign(p); }}>
                      <Plus className="h-3 w-3 mr-1" /> Plano
                    </Button>
                  </div>
                </div>

                {expandedId === p.id && (
                  <div className="mt-3 space-y-3 border-t pt-3">
                    <div className="space-y-2">
                      {(p.steps as ProtocolStep[]).map((step) => (
                        <div key={step.sequence} className="flex items-start gap-3 text-sm">
                          <span className="bg-muted rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">
                            {step.sequence}
                          </span>
                          <div>
                            <p className="font-medium">{step.name}</p>
                            <p className="text-xs text-muted-foreground">💬 {step.cue}</p>
                            <p className="text-xs text-muted-foreground">
                              {step.sets}x{step.reps} | Tempo: {step.tempo}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {p.contraindications?.length > 0 && (
                      <div className="p-2 rounded border border-red-200 bg-red-50">
                        <p className="text-xs font-medium text-red-800 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3" /> Contraindicações:
                        </p>
                        {(p.contraindications as string[]).map((c, i) => (
                          <p key={i} className="text-xs text-red-700 pl-4">• {c}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal: aplicar protocolo a um aluno como plano ativo */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aplicar protocolo como plano do aluno</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Protocolo: <strong>{assignProtocol?.protocol_key.replace(/_/g, ' ')}</strong>
            </p>
            <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
              <SelectTrigger><SelectValue placeholder="Selecione o aluno" /></SelectTrigger>
              <SelectContent>
                {students.length === 0 && <SelectItem value="__empty__" disabled>Nenhum aluno vinculado</SelectItem>}
                {students.map(s => (
                  <SelectItem key={s.student_id} value={s.student_id}>{s.full_name || s.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Isso substitui o plano ativo atual do aluno por este protocolo (mesma lógica de "Publicar para o Aluno" em Resultados).
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancelar</Button>
            <Button onClick={applyProtocolToStudent} disabled={assigning || !selectedStudentId}>
              {assigning ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Aplicar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProtocolLibrary;
