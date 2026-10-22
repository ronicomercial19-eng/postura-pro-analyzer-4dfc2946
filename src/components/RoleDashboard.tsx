import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Users, 
  FileText, 
  TrendingUp, 
  Clock, 
  Plus,
  Eye,
  Edit,
  GraduationCap,
  UserPlus,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { legacyTable } from '@/integrations/supabase/legacyTables';
import { toast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface RoleDashboardProps {
  userRole: 'teacher' | 'student';
}

// Demo data for when database is unavailable
const demoData = {
  students: [
    { id: '1', full_name: 'Maria Silva', email: 'maria@exemplo.com', created_at: new Date().toISOString() },
    { id: '2', full_name: 'João Santos', email: 'joao@exemplo.com', created_at: new Date().toISOString() },
    { id: '3', full_name: 'Ana Costa', email: 'ana@exemplo.com', created_at: new Date().toISOString() },
  ],
  evaluations: [
    { id: '1', title: 'Avaliação Inicial - Maria Silva', status: 'completed', created_at: new Date().toISOString() },
    { id: '2', title: 'Avaliação Postural - João Santos', status: 'draft', created_at: new Date().toISOString() },
    { id: '3', title: 'Reavaliação - Ana Costa', status: 'completed', created_at: new Date().toISOString() },
  ]
};

const RoleDashboard = ({ userRole }: RoleDashboardProps) => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalEvaluations: 0,
    completedEvaluations: 0,
    pendingEvaluations: 0,
    lastEvaluation: null as string | null
  });
  const [students, setStudents] = useState<any[]>([]);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingDemoData, setUsingDemoData] = useState(false);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [studentEmail, setStudentEmail] = useState('');
  const [isCreateEvalOpen, setIsCreateEvalOpen] = useState(false);
  const [evalTitle, setEvalTitle] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');

  useEffect(() => {
    loadDashboardData();
  }, [userRole]);

  const loadDashboardData = async () => {
    setLoading(true);
    setError(null);
    
    // Safety timeout - never load forever
    const timeoutId = setTimeout(() => {
      if (loading) {
        console.warn('Dashboard loading timeout - using demo data');
        useDemoData();
      }
    }, 5000);

    try {
      if (userRole === 'teacher') {
        await loadTeacherData();
      } else {
        await loadStudentData();
      }
    } catch (err: any) {
      console.error('Dashboard error:', err);
      setError(err.message || 'Erro ao carregar dados');
      useDemoData();
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  const useDemoData = () => {
    setUsingDemoData(true);
    setStudents(demoData.students);
    setEvaluations(demoData.evaluations);
    setStats({
      totalStudents: demoData.students.length,
      totalEvaluations: demoData.evaluations.length,
      completedEvaluations: demoData.evaluations.filter(e => e.status === 'completed').length,
      pendingEvaluations: demoData.evaluations.filter(e => e.status !== 'completed').length,
      lastEvaluation: demoData.evaluations[0]?.created_at || null
    });
    setLoading(false);
  };

  const loadTeacherData = async () => {
    let profilesData: any[] = [];
    let evaluationsData: any[] = [];

    // Try to load profiles
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Could not load profiles:', error.message);
      } else {
        profilesData = data || [];
      }
    } catch (err) {
      console.warn('Profiles query failed:', err);
    }

    // Try to load evaluations
    try {
      const { data, error } = await legacyTable('evaluations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        console.warn('Could not load evaluations:', error.message);
      } else {
        evaluationsData = data || [];
      }
    } catch (err) {
      console.warn('Evaluations query failed:', err);
    }

    // If both failed, use demo data
    if (profilesData.length === 0 && evaluationsData.length === 0) {
      useDemoData();
      return;
    }

    setStudents(profilesData);
    setEvaluations(evaluationsData);
    setUsingDemoData(false);

    setStats({
      totalStudents: profilesData.length,
      totalEvaluations: evaluationsData.length,
      completedEvaluations: evaluationsData.filter(e => e.status === 'completed').length,
      pendingEvaluations: evaluationsData.filter(e => e.status !== 'completed').length,
      lastEvaluation: evaluationsData[0]?.created_at || null
    });
  };

  const loadStudentData = async () => {
    let evaluationsData: any[] = [];

    try {
      const { data, error } = await legacyTable('evaluations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Could not load evaluations:', error.message);
        useDemoData();
        return;
      }

      evaluationsData = data || [];
    } catch (err) {
      console.warn('Evaluations query failed:', err);
      useDemoData();
      return;
    }

    setEvaluations(evaluationsData);
    setUsingDemoData(false);

    setStats({
      totalStudents: 0,
      totalEvaluations: evaluationsData.length,
      completedEvaluations: evaluationsData.filter(e => e.status === 'completed').length,
      pendingEvaluations: evaluationsData.filter(e => e.status !== 'completed').length,
      lastEvaluation: evaluationsData[0]?.created_at || null
    });
  };

  const handleAddStudent = async () => {
    if (!studentEmail) return;

    toast({
      title: 'Funcionalidade Simplificada',
      description: 'Gerenciamento de alunos disponível na versão completa',
    });
    setIsAddStudentOpen(false);
  };

  const handleCreateEvaluation = async () => {
    if (!evalTitle) return;

    try {
      const { error } = await legacyTable('evaluations')
        .insert({
          title: evalTitle,
          student_id: selectedStudentId || null,
          status: 'draft'
        });

      if (error) throw error;

      toast({
        title: 'Sucesso',
        description: 'Avaliação criada com sucesso'
      });

      setEvalTitle('');
      setSelectedStudentId('');
      setIsCreateEvalOpen(false);
      loadTeacherData();
    } catch (error: any) {
      console.error('Error creating evaluation:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao criar avaliação',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-muted rounded w-1/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-center text-muted-foreground">Carregando dashboard...</p>
      </div>
    );
  }

  const DemoDataAlert = () => usingDemoData ? (
    <Alert className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="flex items-center justify-between">
        <span>Exibindo dados de demonstração. Conecte ao banco de dados para ver dados reais.</span>
        <Button size="sm" variant="outline" onClick={loadDashboardData}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Tentar novamente
        </Button>
      </AlertDescription>
    </Alert>
  ) : null;

  if (userRole === 'teacher') {
    return (
      <div className="space-y-6">
        <DemoDataAlert />
        
        {/* Teacher Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Alunos</p>
                  <p className="text-2xl font-bold">{stats.totalStudents}</p>
                </div>
                <Users className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Avaliações</p>
                  <p className="text-2xl font-bold">{stats.totalEvaluations}</p>
                </div>
                <FileText className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Concluídas</p>
                  <p className="text-2xl font-bold">{stats.completedEvaluations}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold">{stats.pendingEvaluations}</p>
                </div>
                <Clock className="h-8 w-8 text-orange-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Teacher Content */}
        <Tabs defaultValue="students" className="space-y-4">
          <TabsList>
            <TabsTrigger value="students">Alunos</TabsTrigger>
            <TabsTrigger value="evaluations">Avaliações</TabsTrigger>
          </TabsList>

          <TabsContent value="students" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Meus Alunos</h3>
              <Dialog open={isAddStudentOpen} onOpenChange={setIsAddStudentOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Adicionar Aluno
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Adicionar Novo Aluno</DialogTitle>
                    <DialogDescription>
                      Digite o email do aluno que deseja adicionar.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="studentEmail">Email do Aluno</Label>
                      <Input
                        id="studentEmail"
                        type="email"
                        value={studentEmail}
                        onChange={(e) => setStudentEmail(e.target.value)}
                        placeholder="aluno@exemplo.com"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsAddStudentOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleAddStudent} disabled={!studentEmail}>
                      Adicionar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {students.length === 0 ? (
                <Card className="col-span-full">
                  <CardContent className="p-8 text-center">
                    <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhum aluno cadastrado ainda.</p>
                    <Button className="mt-4" onClick={() => setIsAddStudentOpen(true)}>
                      <UserPlus className="h-4 w-4 mr-2" />
                      Adicionar primeiro aluno
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                students.map((student) => (
                  <Card key={student.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{student.full_name || 'Sem nome'}</h4>
                        <Badge variant="outline">
                          <GraduationCap className="h-3 w-3 mr-1" />
                          Aluno
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{student.email}</p>
                      <div className="flex space-x-2">
                        <Button size="sm" variant="outline">
                          <Eye className="h-3 w-3 mr-1" />
                          Ver
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => {
                            setSelectedStudentId(student.id);
                            setEvalTitle(`Avaliação de ${student.full_name || student.email} - ${new Date().toLocaleDateString('pt-BR')}`);
                            setIsCreateEvalOpen(true);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Avaliar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="evaluations" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Avaliações Recentes</h3>
              <Dialog open={isCreateEvalOpen} onOpenChange={setIsCreateEvalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Avaliação
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Nova Avaliação</DialogTitle>
                    <DialogDescription>
                      Crie uma nova avaliação postural para um aluno.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="evalTitle">Título da Avaliação</Label>
                      <Input
                        id="evalTitle"
                        value={evalTitle}
                        onChange={(e) => setEvalTitle(e.target.value)}
                        placeholder="Ex: Avaliação Inicial - Janeiro 2024"
                      />
                    </div>
                    <div>
                      <Label htmlFor="studentSelect">Aluno (Opcional)</Label>
                      <select
                        id="studentSelect"
                        value={selectedStudentId}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                        className="w-full p-2 border border-input rounded-md bg-background focus:ring-2 focus:ring-ring focus:border-transparent"
                      >
                        <option value="">Selecionar aluno...</option>
                        {students.map((student) => (
                          <option key={student.id} value={student.id}>
                            {student.full_name || student.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreateEvalOpen(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={handleCreateEvaluation} disabled={!evalTitle}>
                      Criar Avaliação
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {evaluations.length === 0 ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Nenhuma avaliação criada ainda.</p>
                    <Button className="mt-4" onClick={() => setIsCreateEvalOpen(true)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar primeira avaliação
                    </Button>
                  </CardContent>
                </Card>
              ) : (
                evaluations.map((evaluation) => (
                  <Card key={evaluation.id}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{evaluation.title}</h4>
                          <p className="text-sm text-muted-foreground">
                            {new Date(evaluation.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant={evaluation.status === 'completed' ? 'default' : 'secondary'}>
                            {evaluation.status === 'completed' ? 'Concluída' : 'Rascunho'}
                          </Badge>
                          <Button size="sm" variant="outline">
                            <Edit className="h-3 w-3 mr-1" />
                            Editar
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  // Student Dashboard
  return (
    <div className="space-y-6">
      <DemoDataAlert />
      
      {/* Student Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Avaliações</p>
                <p className="text-2xl font-bold">{stats.totalEvaluations}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Concluídas</p>
                <p className="text-2xl font-bold">{stats.completedEvaluations}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Última Avaliação</p>
                <p className="text-lg font-medium">
                  {stats.lastEvaluation 
                    ? new Date(stats.lastEvaluation).toLocaleDateString('pt-BR')
                    : 'Nenhuma'}
                </p>
              </div>
              <Clock className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Student Evaluations */}
      <Card>
        <CardHeader>
          <CardTitle>Minhas Avaliações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {evaluations.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Você ainda não possui avaliações.</p>
              </div>
            ) : (
              evaluations.map((evaluation) => (
                <div key={evaluation.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <h4 className="font-medium">{evaluation.title}</h4>
                    <p className="text-sm text-muted-foreground">
                      {new Date(evaluation.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={evaluation.status === 'completed' ? 'default' : 'secondary'}>
                      {evaluation.status === 'completed' ? 'Concluída' : 'Em andamento'}
                    </Badge>
                    <Button size="sm" variant="outline">
                      <Eye className="h-3 w-3 mr-1" />
                      Ver
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RoleDashboard;
