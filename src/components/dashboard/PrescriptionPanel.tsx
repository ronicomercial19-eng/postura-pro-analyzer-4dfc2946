import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import type { Prescription, FlagSource } from '@/services/prescriptionService';
import { MANUAL_FLAG_OPTIONS } from '@/data/muscleMap';

interface Props {
  prescription: Prescription;
  manualFlags: string[];
  onToggleManual: (code: string) => void;
  photoWarnings: string[];
}

const SOURCE_LABEL: Record<FlagSource, string> = {
  foto: 'medido na foto',
  avaliador: 'confirmado pelo avaliador',
  ia: 'sugerido pela IA',
  questionario: 'questionário',
};
const KIND_LABEL: Record<string, string> = {
  liberacao: 'Liberação', alongamento: 'Alongar', ativacao: 'Ativar', fortalecimento: 'Fortalecer',
};
const sevColor = (s: number) =>
  s >= 3 ? 'bg-red-100 text-red-800 border-red-300' : s === 2 ? 'bg-yellow-100 text-yellow-800 border-yellow-300' : 'bg-green-100 text-green-800 border-green-300';

const PrescriptionPanel = ({ prescription, manualFlags, onToggleManual, photoWarnings }: Props) => (
  <div className="space-y-4">
    {photoWarnings.map((w, i) => (
      <Alert key={i} className="border-amber-400 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-700" />
        <AlertDescription className="text-amber-900 text-sm">{w}</AlertDescription>
      </Alert>
    ))}

    {prescription.suspendAll && (
      <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertDescription>
        Sinal de alerta neurológico: nenhum exercício será publicado. Encaminhe para avaliação médica.
      </AlertDescription></Alert>
    )}
    {prescription.shield && !prescription.suspendAll && (
      <Alert variant="destructive"><ShieldAlert className="h-4 w-4" /><AlertDescription>
        Modo de proteção (SHIELD): só liberação e alongamento suave. Ativação e fortalecimento foram retirados do plano.
      </AlertDescription></Alert>
    )}

    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Confirmar achados que a foto não mede</CardTitle>
        <p className="text-xs text-muted-foreground">
          Foto 2D mede desnível de ombros/quadril, joelho valgo/varo, cabeça anteriorizada e hiperextensão de joelho.
          Cifose, lordose, pelve, pé e escoliose precisam da sua observação clínica — marque o que você confirmou.
        </p>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {MANUAL_FLAG_OPTIONS.map(o => {
          const on = manualFlags.includes(o.code);
          return (
            <button
              key={o.code} type="button" onClick={() => onToggleManual(o.code)}
              className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-muted'}`}
            >
              {on ? '✓ ' : ''}{o.label}
            </button>
          );
        })}
      </CardContent>
    </Card>

    {prescription.entries.length === 0 ? (
      <Card><CardContent className="p-6 text-sm text-muted-foreground">
        Nenhum achado com prescrição ainda. Rode a coleta de fotos ou confirme achados acima.
      </CardContent></Card>
    ) : prescription.entries.map(e => (
      <Card key={e.code} className="border-indigo-200">
        <CardHeader className="pb-2">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-sm">{e.label}{e.sideText ? ` — ${e.sideText}` : ''}</CardTitle>
            <Badge className={sevColor(e.severity)}>S{e.severity}</Badge>
            <Badge variant="outline" className="text-xs">{SOURCE_LABEL[e.source]}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {e.referOut ? (
            <p className="text-destructive">Encaminhar para avaliação médica/ortopédica. Sem prescrição genérica para este achado.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-3">
                <p className="font-medium text-orange-900 mb-1">Soltar / alongar</p>
                <ul className="text-xs text-orange-800 space-y-0.5">
                  {Array.from(new Set([...e.liberar, ...e.alongar])).map(m => <li key={m}>• {m}</li>)}
                  {e.liberar.length + e.alongar.length === 0 && <li>—</li>}
                </ul>
              </div>
              <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 md:col-span-2">
                <p className="font-medium text-purple-900 mb-1">Fortalecer</p>
                <ul className="text-xs text-purple-800 space-y-0.5">
                  {e.fortalecer.map(m => <li key={m}>• {m}</li>)}
                  {e.fortalecer.length === 0 && <li>— {prescription.shield ? 'suspenso (modo de proteção)' : 'nenhum'}</li>}
                </ul>
              </div>
            </div>
          )}
          {e.exercises.length > 0 && (
            <div className="border rounded-lg divide-y">
              {e.exercises.map(x => (
                <div key={x.name} className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                  <span><Badge variant="outline" className="mr-2">{KIND_LABEL[x.kind]}</Badge>{x.name}</span>
                  <span className="text-muted-foreground whitespace-nowrap">{x.sets}x {x.dose}{x.perSideHint ? ' / lado' : ''}</span>
                </div>
              ))}
            </div>
          )}
          {e.note && <p className="text-xs text-muted-foreground italic">Nota ao avaliador: {e.note}</p>}
        </CardContent>
      </Card>
    ))}

    {prescription.removedExercises.length > 0 && (
      <p className="text-xs text-muted-foreground">
        Retirados por segurança (fail-safe): {prescription.removedExercises.join('; ')}.
      </p>
    )}
  </div>
);

export default PrescriptionPanel;
