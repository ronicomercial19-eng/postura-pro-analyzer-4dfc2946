import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldCheck, ShieldAlert, Printer, Upload, User } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAssessment } from '@/contexts/ActiveAssessmentContext';
import { TERM_SECTIONS, TERM_TEXT, TERM_VERSION, CONSENT_SCOPES } from '@/data/consentTerm';
import { classifyWells, WELLS_AGE_GROUPS, WellsSex } from '@/data/wellsNorms';

interface Student { student_id: string; full_name: string | null; email: string | null }
interface Consent {
  id: string; student_id: string; term_version: string; term_snapshot: string; signer_name: string;
  scopes: Record<string, boolean>; accepted_at: string; revoked_at: string | null;
}
interface FTest { id: string; test_type: 'adams' | 'wells'; data: any; classification: string | null; performed_at: string }

const fmt = (d: string) => new Date(d).toLocaleString('pt-BR');
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

// ---------- Teste de Adams: classificacao ----------
function classifyAdams(hump: string, atr: number | null): { label: string; level: 1 | 2 | 3 } {
  const has = hump !== 'nenhuma';
  if (atr !== null) {
    if (atr >= 7) return { label: 'Encaminhar: ATR igual ou maior que 7° — solicitar avaliação ortopédica e radiografia.', level: 3 };
    if (atr >= 5) return { label: 'Atenção: ATR de 5° a 6° — reavaliar em 4 a 6 meses.', level: 2 };
    return has
      ? { label: 'Gibosidade visual com ATR menor que 5° — acompanhar.', level: 2 }
      : { label: 'Sem sinais de rotação do tronco (ATR menor que 5°).', level: 1 };
  }
  return has
    ? { label: 'Gibosidade visual sem medida de ATR — meça com escoliômetro ou encaminhe.', level: 2 }
    : { label: 'Sem gibosidade visual. Para maior precisão, meça o ATR com escoliômetro.', level: 1 };
}
const LEVEL_CSS = { 1: 'bg-green-100 text-green-800 border-green-300', 2: 'bg-yellow-100 text-yellow-800 border-yellow-300', 3: 'bg-red-100 text-red-800 border-red-300' } as const;

const TestsAndConsent = () => {
  const { user, userRole } = useAuth();
  const { active, setAssessment } = useActiveAssessment();
  const isTeacher = userRole === 'teacher' || userRole === 'admin';

  const [students, setStudents] = useState<Student[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  const [tests, setTests] = useState<FTest[]>([]);
  const [loading, setLoading] = useState(false);
  const studentId = active.studentId || '';

  // ----- Termo -----
  const [scopes, setScopes] = useState<Record<string, boolean>>({});
  const [signer, setSigner] = useState('');
  const [minor, setMinor] = useState(false);
  const [saving, setSaving] = useState(false);

  // ----- Adams -----
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [pts, setPts] = useState<{ x: number; y: number }[]>([]);
  const imgRef = useRef<HTMLImageElement>(null);
  const [hump, setHump] = useState('nenhuma');
  const [region, setRegion] = useState('nao_aplica');
  const [atr, setAtr] = useState('');
  const [signs, setSigns] = useState<string[]>([]);
  const [adamsNotes, setAdamsNotes] = useState('');

  // ----- Wells -----
  const [sex, setSex] = useState<WellsSex>('F');
  const [age, setAge] = useState(String(Number(active.context?.idade) || ''));
  const [tries, setTries] = useState(['', '', '']);

  useEffect(() => {
    if (!user || !isTeacher) return;
    supabase.rpc('get_teacher_students', { teacher_id: user.id }).then(({ data }) => setStudents((data as any[]) || []));
  }, [user, isTeacher]);

  const reload = async () => {
    if (!studentId) { setConsents([]); setTests([]); return; }
    setLoading(true);
    try {
      const [c, t] = await Promise.all([
        supabase.from('ppa_consents' as any).select('*').eq('student_id', studentId).order('accepted_at', { ascending: false }),
        supabase.from('ppa_functional_tests' as any).select('*').eq('student_id', studentId).order('performed_at', { ascending: false }),
      ]);
      setConsents((c.data as any[]) || []);
      setTests((t.data as any[]) || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { reload(); }, [studentId]);
  useEffect(() => { if (active.context?.idade) setAge(String(Number(active.context.idade) || '')); }, [active.context?.idade]);

  const validConsent = useMemo(() => consents.find(c => !c.revoked_at), [consents]);
  const pickStudent = (id: string) => {
    const s = students.find(x => x.student_id === id);
    if (s) setAssessment('', id, s.full_name || s.email || 'Aluno');
  };

  // ---------- Termo ----------
  const canSign = CONSENT_SCOPES.filter(s => s.required).every(s => scopes[s.key]) && signer.trim().length >= 3;
  const registerConsent = async () => {
    if (!user || !studentId || !canSign) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('ppa_consents' as any).insert({
        student_id: studentId, teacher_id: user.id, term_version: TERM_VERSION, term_snapshot: TERM_TEXT,
        signer_name: signer.trim() + (minor ? ' (responsável legal)' : ''), scopes, user_agent: navigator.userAgent,
      } as any);
      if (error) throw error;
      toast.success('Consentimento registrado. A coleta de fotos está liberada para este aluno.');
      setScopes({}); setSigner(''); setMinor(false);
      await reload();
    } catch (e: any) { toast.error('Erro ao registrar: ' + e.message); } finally { setSaving(false); }
  };
  const revokeConsent = async (id: string) => {
    if (!confirm('Revogar o consentimento? Novas coletas de imagem serão bloqueadas para este aluno.')) return;
    const { error } = await supabase.from('ppa_consents' as any).update({ revoked_at: new Date().toISOString() } as any).eq('id', id);
    if (error) toast.error(error.message); else { toast.success('Consentimento revogado.'); reload(); }
  };
  const printConsent = (c: Consent) => {
    const w = window.open('', '_blank');
    if (!w) { toast.error('Permita pop-ups para imprimir.'); return; }
    const body = TERM_SECTIONS.map(s => `<h3>${esc(s.title)}</h3><p>${esc(s.text)}</p>`).join('');
    w.document.write(`<html><head><title>Termo de Consentimento</title><style>body{font-family:Arial;max-width:720px;margin:32px auto;line-height:1.5}h3{margin-bottom:2px}.sig{margin-top:40px;border-top:1px solid #000;padding-top:6px}</style></head><body>
      <h2>Termo de Consentimento — Avaliação Postural</h2><p><small>Versão ${esc(c.term_version)}</small></p>${body}
      <p><b>Aluno:</b> ${esc(active.studentName || '')}<br/><b>Assinado por:</b> ${esc(c.signer_name)}<br/><b>Aceito em:</b> ${esc(fmt(c.accepted_at))}${c.revoked_at ? `<br/><b>Revogado em:</b> ${esc(fmt(c.revoked_at))}` : ''}</p>
      <div class="sig">Assinatura</div></body></html>`);
    w.document.close(); w.print();
  };

  // ---------- Adams ----------
  const onPhoto = (f: File | null) => {
    setPhoto(f); setPts([]);
    setPreview(f ? URL.createObjectURL(f) : '');
  };
  const onImgClick = (e: React.MouseEvent<HTMLImageElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const p = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
    setPts(prev => (prev.length >= 2 ? [p] : [...prev, p]));
  };
  const lineAngle = useMemo(() => {
    if (pts.length < 2 || !imgRef.current) return null;
    const r = imgRef.current.getBoundingClientRect();
    let a = (Math.atan2((pts[1].y - pts[0].y) * r.height, (pts[1].x - pts[0].x) * r.width) * 180) / Math.PI;
    if (a > 90) a -= 180; if (a < -90) a += 180;
    return Math.round(a * 10) / 10;
  }, [pts]);
  const atrNum = atr.trim() === '' ? null : Number(atr.replace(',', '.'));
  const adamsResult = classifyAdams(hump, atrNum !== null && !isNaN(atrNum) ? atrNum : null);
  const toggleSign = (s: string) => setSigns(p => (p.includes(s) ? p.filter(x => x !== s) : [...p, s]));

  const saveAdams = async () => {
    if (!user || !studentId) return;
    setSaving(true);
    try {
      let photoPath: string | null = null;
      if (photo) {
        photoPath = `${user.id}/${studentId}/adams/${Date.now()}.jpg`;
        const up = await supabase.storage.from('photos').upload(photoPath, photo, { contentType: photo.type || 'image/jpeg' });
        if (up.error) throw up.error;
      }
      const { error } = await supabase.from('ppa_functional_tests' as any).insert({
        student_id: studentId, teacher_id: user.id, test_type: 'adams', classification: adamsResult.label,
        data: { hump, region, atr: atrNum, signs, notes: adamsNotes, line_angle_deg: lineAngle, photo_path: photoPath, level: adamsResult.level },
      } as any);
      if (error) throw error;
      toast.success('Teste de Adams salvo.');
      setHump('nenhuma'); setRegion('nao_aplica'); setAtr(''); setSigns([]); setAdamsNotes(''); onPhoto(null);
      await reload();
    } catch (e: any) { toast.error('Erro ao salvar: ' + e.message); } finally { setSaving(false); }
  };
  const openPhoto = async (path: string) => {
    const { data } = await supabase.storage.from('photos').createSignedUrl(path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank'); else toast.error('Não foi possível abrir a foto.');
  };

  // ---------- Wells ----------
  const triesNum = tries.map(t => Number(t.replace(',', '.'))).filter(n => !isNaN(n) && n > 0);
  const best = triesNum.length ? Math.max(...triesNum) : null;
  const ageNum = Number(age);
  const wells = best !== null && ageNum > 0 ? classifyWells(sex, ageNum, best) : null;
  const saveWells = async () => {
    if (!user || !studentId || best === null || !wells) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('ppa_functional_tests' as any).insert({
        student_id: studentId, teacher_id: user.id, test_type: 'wells', classification: wells.label,
        data: { sex, age: ageNum, attempts: triesNum, best_cm: best },
      } as any);
      if (error) throw error;
      toast.success('Banco de Wells salvo.');
      setTries(['', '', '']);
      await reload();
    } catch (e: any) { toast.error('Erro ao salvar: ' + e.message); } finally { setSaving(false); }
  };

  const adamsHistory = tests.filter(t => t.test_type === 'adams');
  const wellsHistory = tests.filter(t => t.test_type === 'wells');

  if (!isTeacher) {
    return <Alert><AlertDescription>Esta área é exclusiva do professor.</AlertDescription></Alert>;
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6">
      <div>
        <h1 className="text-2xl font-bold">Testes e Termo</h1>
        <p className="text-muted-foreground text-sm">Termo de consentimento (LGPD), Teste de Adams e Banco de Wells</p>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><User className="h-4 w-4" /> Aluno</CardTitle></CardHeader>
        <CardContent>
          <Select value={studentId} onValueChange={pickStudent}>
            <SelectTrigger><SelectValue placeholder="Escolha um aluno" /></SelectTrigger>
            <SelectContent>
              {students.length === 0 && <SelectItem value="__none__" disabled>Nenhum aluno vinculado</SelectItem>}
              {students.map(s => <SelectItem key={s.student_id} value={s.student_id}>{s.full_name || s.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {!studentId ? (
        <Alert><AlertDescription>Selecione um aluno para registrar o termo e os testes.</AlertDescription></Alert>
      ) : (
        <>
          {validConsent ? (
            <Alert className="border-green-300 bg-green-50"><ShieldCheck className="h-4 w-4 text-green-700" />
              <AlertDescription className="text-green-900">Termo vigente (v{validConsent.term_version}) assinado por <b>{validConsent.signer_name}</b> em {fmt(validConsent.accepted_at)}.</AlertDescription></Alert>
          ) : (
            <Alert variant="destructive"><ShieldAlert className="h-4 w-4" />
              <AlertDescription>Sem termo vigente. A coleta de fotos deste aluno fica bloqueada até o consentimento ser registrado.</AlertDescription></Alert>
          )}

          <Tabs defaultValue={validConsent ? 'adams' : 'termo'}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="termo">Termo</TabsTrigger>
              <TabsTrigger value="adams">Adams</TabsTrigger>
              <TabsTrigger value="wells">Wells</TabsTrigger>
            </TabsList>

            {/* ---------- TERMO ---------- */}
            <TabsContent value="termo" className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Termo de Consentimento — v{TERM_VERSION}</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <div className="max-h-64 overflow-y-auto border rounded-lg p-3 text-sm space-y-2 bg-muted/30">
                    {TERM_SECTIONS.map(s => (<div key={s.title}><p className="font-semibold">{s.title}</p><p className="text-muted-foreground">{s.text}</p></div>))}
                  </div>
                  <p className="text-xs text-muted-foreground">Texto-modelo. Recomenda-se revisão por advogado antes do uso comercial.</p>
                  {!validConsent && (
                    <div className="space-y-3">
                      {CONSENT_SCOPES.map(s => (
                        <label key={s.key} className="flex items-start gap-2 text-sm cursor-pointer">
                          <input type="checkbox" className="mt-1" checked={!!scopes[s.key]} onChange={e => setScopes(p => ({ ...p, [s.key]: e.target.checked }))} />
                          <span>{s.label}{s.required && <span className="text-red-600"> *</span>}</span>
                        </label>
                      ))}
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={minor} onChange={e => setMinor(e.target.checked)} /> O aluno é menor de 18 anos (assina o responsável legal)
                      </label>
                      <div>
                        <Label>{minor ? 'Nome do responsável legal' : 'Nome completo do aluno'} (assinatura digital)</Label>
                        <Input value={signer} onChange={e => setSigner(e.target.value)} placeholder="Nome completo" />
                      </div>
                      <Button onClick={registerConsent} disabled={!canSign || saving}>
                        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-2" />}
                        Registrar consentimento
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
              {consents.length > 0 && (
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Histórico de consentimentos</CardTitle></CardHeader>
                  <CardContent className="divide-y">
                    {consents.map(c => (
                      <div key={c.id} className="py-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div>
                          <b>{c.signer_name}</b> · {fmt(c.accepted_at)} · v{c.term_version}
                          {c.revoked_at ? <Badge className="ml-2 bg-red-100 text-red-800">Revogado {fmt(c.revoked_at)}</Badge> : <Badge className="ml-2 bg-green-100 text-green-800">Vigente</Badge>}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => printConsent(c)}><Printer className="h-3 w-3 mr-1" />Imprimir</Button>
                          {!c.revoked_at && <Button size="sm" variant="outline" onClick={() => revokeConsent(c.id)}>Revogar</Button>}
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ---------- ADAMS ---------- */}
            <TabsContent value="adams" className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Teste de Adams (inclinação anterior do tronco)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">Aluno de costas, pés juntos, joelhos estendidos, inclinando o tronco para a frente com os braços soltos. Observe a assimetria das costelas e da lombar.</p>
                  <div>
                    <Label className="flex items-center gap-2"><Upload className="h-4 w-4" /> Foto do teste (opcional)</Label>
                    <Input type="file" accept="image/*" onChange={e => onPhoto(e.target.files?.[0] || null)} />
                  </div>
                  {preview && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Toque em dois pontos da foto (ex.: o ponto mais alto de cada lado das costas) para medir a inclinação da linha. É uma referência visual, não substitui o escoliômetro.</p>
                      <div className="relative inline-block max-w-full">
                        <img ref={imgRef} src={preview} alt="Teste de Adams" onClick={onImgClick} className="max-h-96 rounded-lg cursor-crosshair select-none" />
                        <svg className="absolute inset-0 w-full h-full pointer-events-none">
                          {pts.map((p, i) => <circle key={i} cx={`${p.x * 100}%`} cy={`${p.y * 100}%`} r="5" fill="#22c55e" stroke="#fff" strokeWidth="2" />)}
                          {pts.length === 2 && <line x1={`${pts[0].x * 100}%`} y1={`${pts[0].y * 100}%`} x2={`${pts[1].x * 100}%`} y2={`${pts[1].y * 100}%`} stroke="#22c55e" strokeWidth="2" />}
                        </svg>
                      </div>
                      {lineAngle !== null && <Badge variant="outline">Inclinação da linha marcada: {lineAngle}°</Badge>}
                    </div>
                  )}
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <Label>Gibosidade (costelas)</Label>
                      <Select value={hump} onValueChange={setHump}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nenhuma">Nenhuma</SelectItem>
                          <SelectItem value="direita">Direita</SelectItem>
                          <SelectItem value="esquerda">Esquerda</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Região</Label>
                      <Select value={region} onValueChange={setRegion}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="nao_aplica">Não se aplica</SelectItem>
                          <SelectItem value="toracica">Torácica</SelectItem>
                          <SelectItem value="toracolombar">Toracolombar</SelectItem>
                          <SelectItem value="lombar">Lombar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>ATR — escoliômetro (graus)</Label>
                      <Input inputMode="decimal" value={atr} onChange={e => setAtr(e.target.value)} placeholder="ex.: 4" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-sm">
                    {['Escápula proeminente', 'Assimetria da cintura', 'Elevação costal', 'Ombro mais alto'].map(s => (
                      <label key={s} className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={signs.includes(s)} onChange={() => toggleSign(s)} />{s}</label>
                    ))}
                  </div>
                  <div><Label>Observações</Label><Textarea rows={2} value={adamsNotes} onChange={e => setAdamsNotes(e.target.value)} /></div>
                  <Alert className={LEVEL_CSS[adamsResult.level]}><AlertDescription className="font-medium">{adamsResult.label}</AlertDescription></Alert>
                  <Button onClick={saveAdams} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar teste de Adams</Button>
                </CardContent>
              </Card>
              {adamsHistory.length > 0 && (
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Histórico — Adams</CardTitle></CardHeader>
                  <CardContent className="divide-y">
                    {adamsHistory.map(t => (
                      <div key={t.id} className="py-2 text-sm flex flex-wrap items-center justify-between gap-2">
                        <div><b>{fmt(t.performed_at)}</b> · gibosidade: {t.data?.hump}{t.data?.atr != null ? ` · ATR ${t.data.atr}°` : ''}<p className="text-xs text-muted-foreground">{t.classification}</p></div>
                        {t.data?.photo_path && <Button size="sm" variant="outline" onClick={() => openPhoto(t.data.photo_path)}>Ver foto</Button>}
                      </div>
                    ))}
                  </CardContent></Card>
              )}
            </TabsContent>

            {/* ---------- WELLS ---------- */}
            <TabsContent value="wells" className="space-y-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Banco de Wells (flexibilidade)</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-muted-foreground">Sentado, pernas estendidas e pés apoiados no banco. Inclinar o tronco e deslizar as mãos sobre a régua, sem flexionar os joelhos. Registre a leitura da régua em até 3 tentativas.</p>
                  <div className="grid gap-3 md:grid-cols-5">
                    <div>
                      <Label>Sexo</Label>
                      <Select value={sex} onValueChange={v => setSex(v as WellsSex)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="F">Feminino</SelectItem><SelectItem value="M">Masculino</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div><Label>Idade</Label><Input inputMode="numeric" value={age} onChange={e => setAge(e.target.value)} /></div>
                    {tries.map((t, i) => (
                      <div key={i}><Label>Tentativa {i + 1} (cm)</Label>
                        <Input inputMode="decimal" value={t} onChange={e => setTries(p => p.map((x, j) => (j === i ? e.target.value : x)))} /></div>
                    ))}
                  </div>
                  {wells && best !== null ? (
                    <Alert className="border-blue-300 bg-blue-50"><AlertDescription className="text-blue-900">
                      Melhor alcance: <b>{best} cm</b> · Classificação: <b>{wells.label}</b>
                      <p className="text-xs mt-1">Faixa etária {WELLS_AGE_GROUPS[wells.group]}: Fraco até {wells.bounds[0]} · Regular até {wells.bounds[1]} · Médio até {wells.bounds[2]} · Bom até {wells.bounds[3]} · Excelente acima.</p>
                      <p className="text-xs mt-1 italic">Tabela de referência do sistema — confira com o protocolo que você adota.</p>
                    </AlertDescription></Alert>
                  ) : <p className="text-xs text-muted-foreground">Informe a idade e ao menos uma tentativa para classificar.</p>}
                  <Button onClick={saveWells} disabled={saving || !wells}>{saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Salvar resultado</Button>
                </CardContent>
              </Card>
              {wellsHistory.length > 0 && (
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Evolução — Wells</CardTitle></CardHeader>
                  <CardContent className="divide-y">
                    {wellsHistory.map((t, i) => {
                      const prev = wellsHistory[i + 1];
                      const delta = prev ? Math.round((t.data.best_cm - prev.data.best_cm) * 10) / 10 : null;
                      return (
                        <div key={t.id} className="py-2 text-sm flex items-center justify-between">
                          <span><b>{fmt(t.performed_at)}</b> · {t.data.best_cm} cm · {t.classification}</span>
                          {delta !== null && <Badge className={delta >= 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}>{delta >= 0 ? '+' : ''}{delta} cm</Badge>}
                        </div>
                      );
                    })}
                  </CardContent></Card>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
      {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
    </div>
  );
};

export default TestsAndConsent;
