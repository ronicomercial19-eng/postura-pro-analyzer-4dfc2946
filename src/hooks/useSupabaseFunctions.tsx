import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { legacyTable } from '@/integrations/supabase/legacyTables';
import { toast } from '@/hooks/use-toast';

export const useSupabaseFunctions = () => {
  const [loading, setLoading] = useState(false);

  // Get user profile with role (sem autenticação - retorna dados genéricos)
  const getUserProfile = async (userId?: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId || 'temp')
        .single();
      
      if (error) throw error;
      return data || null;
    } catch (error) {
      console.error('Error getting user profile:', error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Check if user is teacher
  const isTeacher = async (userId?: string) => {
    return true; // Sistema sem autenticação
  };

  // Check if user is student
  const isStudent = async (userId?: string) => {
    return false; // Sistema sem autenticação
  };

  // Get teacher's students
  const getTeacherStudents = async (teacherId?: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'student');
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting teacher students:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os alunos",
        variant: "destructive"
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Get student's evaluations
  const getStudentEvaluations = async (studentId?: string) => {
    try {
      setLoading(true);
      const { data, error } = await legacyTable('evaluations')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting student evaluations:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as avaliações",
        variant: "destructive"
      });
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Add student to teacher
  const addStudentToTeacher = async (teacherId: string, studentEmail: string) => {
    toast({
      title: "Funcionalidade Simplificada",
      description: "Gerenciamento de alunos disponível na versão completa",
    });
    return { success: true, studentId: 'temp' };
  };

  // Create new evaluation
  const createEvaluation = async (title: string, studentId?: string) => {
    try {
      setLoading(true);
      const { data, error } = await legacyTable('evaluations')
        .insert({
          title,
          student_id: studentId || null,
          status: 'draft'
        })
        .select()
        .single();
      
      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Avaliação criada com sucesso",
      });
      return { success: true, evaluationId: data.id };
    } catch (error) {
      console.error('Error creating evaluation:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a avaliação",
        variant: "destructive"
      });
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  // Update evaluation status
  const updateEvaluationStatus = async (evaluationId: string, status: string) => {
    try {
      setLoading(true);
      const { error } = await legacyTable('evaluations')
        .update({ status })
        .eq('id', evaluationId);
      
      if (error) throw error;
      
      toast({
        title: "Sucesso",
        description: "Status atualizado com sucesso",
      });
      return { success: true };
    } catch (error) {
      console.error('Error updating evaluation status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive"
      });
      return { success: false, error };
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    getUserProfile,
    isTeacher,
    isStudent,
    getTeacherStudents,
    getStudentEvaluations,
    addStudentToTeacher,
    createEvaluation,
    updateEvaluationStatus
  };
};
