import { useEffect, useState } from 'react';
import DOMPurify from 'dompurify';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export const StudentReportView = () => {
  const { user } = useAuth();
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('ppa_plan_links')
        .select('*')
        .eq('student_id', user.id)
        .eq('active', true)
        .not('published_at', 'is', null)
        .order('published_at', { ascending: false })
        .limit(1).maybeSingle();
      setReport(data);
      setLoading(false);
    })();
  }, [user]);

  if (loading) return <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Carregando relatório...</div>;
  if (!report) return (
    <Card><CardContent className="py-8 text-center text-muted-foreground">
      Nenhum relatório publicado ainda. Aguarde seu professor finalizar a avaliação.
    </CardContent></Card>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2"><FileText className="h-5 w-5" /> Seu Relatório</span>
          <Badge variant="outline">Publicado em {new Date(report.published_at).toLocaleDateString('pt-BR')}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {report.report_html ? (
          <div className="prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(report.report_html) }} />
        ) : (
          <p className="text-muted-foreground">Relatório sem conteúdo HTML.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentReportView;
