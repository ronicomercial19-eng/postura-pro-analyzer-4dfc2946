import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageSquare, 
  Send, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  Star,
  ThumbsUp,
  Bug
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { legacyTable } from '@/integrations/supabase/legacyTables';
import { toast } from '@/hooks/use-toast';

interface Feedback {
  id: string;
  type: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface FeedbackSystemProps {
  isTeacher?: boolean;
}

const FeedbackSystem = ({ isTeacher = false }: FeedbackSystemProps) => {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Form state
  const [feedbackType, setFeedbackType] = useState('suggestion');
  const [message, setMessage] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    loadFeedbacks();
  }, [isTeacher]);

  const loadFeedbacks = async () => {
    setLoading(true);
    try {
      let query = legacyTable('user_feedback')
        .select('*')
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      setFeedbacks(data || []);
    } catch (error) {
      console.error('Error loading feedback:', error);
      toast({
        title: "Erro ao carregar feedback",
        description: "Não foi possível carregar os feedbacks.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const submitFeedback = async () => {
    if (!message.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await legacyTable('user_feedback')
        .insert({
          type: feedbackType,
          message: `${title ? title + '\n\n' : ''}${message}`,
          status: 'open'
        });

      if (error) throw error;

      toast({
        title: "Feedback enviado",
        description: "Seu feedback foi enviado com sucesso!"
      });

      // Reset form
      setTitle('');
      setMessage('');
      setFeedbackType('suggestion');
      
      // Reload feedbacks
      loadFeedbacks();
    } catch (error) {
      console.error('Error submitting feedback:', error);
      toast({
        title: "Erro ao enviar feedback",
        description: "Não foi possível enviar o feedback.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'bug':
        return <Bug className="h-4 w-4" />;
      case 'feature':
        return <Star className="h-4 w-4" />;
      case 'improvement':
        return <ThumbsUp className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'bug':
        return 'Bug';
      case 'feature':
        return 'Nova Funcionalidade';
      case 'improvement':
        return 'Melhoria';
      case 'suggestion':
        return 'Sugestão';
      default:
        return 'Outro';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'in_progress':
        return <Clock className="h-4 w-4 text-blue-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-orange-600" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'resolved':
        return 'Resolvido';
      case 'in_progress':
        return 'Em andamento';
      default:
        return 'Aberto';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MessageSquare className="h-5 w-5 mr-2" />
            Sistema de Feedback
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="send" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="send">Enviar Feedback</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            {/* Send Feedback Tab */}
            <TabsContent value="send" className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Tipo de Feedback</label>
                  <Select value={feedbackType} onValueChange={setFeedbackType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="suggestion">
                        <div className="flex items-center">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Sugestão
                        </div>
                      </SelectItem>
                      <SelectItem value="bug">
                        <div className="flex items-center">
                          <Bug className="h-4 w-4 mr-2" />
                          Relatar Bug
                        </div>
                      </SelectItem>
                      <SelectItem value="feature">
                        <div className="flex items-center">
                          <Star className="h-4 w-4 mr-2" />
                          Nova Funcionalidade
                        </div>
                      </SelectItem>
                      <SelectItem value="improvement">
                        <div className="flex items-center">
                          <ThumbsUp className="h-4 w-4 mr-2" />
                          Melhoria
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Título (opcional)</label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Título do seu feedback"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Mensagem</label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Descreva seu feedback detalhadamente..."
                    rows={6}
                  />
                </div>

                <Button 
                  onClick={submitFeedback}
                  disabled={!message.trim() || submitting}
                  className="w-full"
                >
                  {submitting ? (
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  {submitting ? 'Enviando...' : 'Enviar Feedback'}
                </Button>
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="space-y-4">
              {loading ? (
                <div className="space-y-3">
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-4">
                        <div className="h-4 bg-muted rounded w-1/3 mb-2"></div>
                        <div className="h-3 bg-muted rounded w-2/3"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : feedbacks.length === 0 ? (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhum feedback encontrado</p>
                  <p className="text-sm text-muted-foreground">
                    Envie seu primeiro feedback na aba "Enviar Feedback"
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {feedbacks.map((feedback) => (
                    <Card key={feedback.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="flex items-center">
                              {getTypeIcon(feedback.type)}
                              <span className="ml-1">{getTypeLabel(feedback.type)}</span>
                            </Badge>
                            <div className="flex items-center">
                              {getStatusIcon(feedback.status)}
                              <span className="ml-1 text-sm font-medium">
                                {getStatusLabel(feedback.status)}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {new Date(feedback.created_at).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {feedback.message}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default FeedbackSystem;