import { useState } from 'react';
import Header from '@/components/Header';
import Navigation from '@/components/Navigation';
import BottomNavigation from '@/components/BottomNavigation';
import ClientManagement from '@/components/ClientManagement';
import AssessmentWizard from '@/components/pages/AssessmentWizard';
import MediaCollector from '@/components/pages/MediaCollector';
import ResultsHUD from '@/components/pages/ResultsHUD';
import PlanBuilder from '@/components/pages/PlanBuilder';
import SessionTracker from '@/components/pages/SessionTracker';
import ProtocolLibrary from '@/components/pages/ProtocolLibrary';
import ProgressDashboard from '@/components/pages/ProgressDashboard';
import TeacherDashboard from '@/components/dashboards/TeacherDashboard';
import StudentDashboard from '@/components/dashboards/StudentDashboard';
import ExpressAnalysis from '@/components/pages/ExpressAnalysis';
import MovementAnalyser from '@/components/pages/MovementAnalyser';
import ComplaintAnalyser from '@/components/analyser/ComplaintAnalyser';
import BodyCompositionEstimator from '@/components/analyser/BodyCompositionEstimator';
import StudentReportView from '@/components/student/StudentReportView';
import StudentRecommendations from '@/components/student/StudentRecommendations';
import StudentStretchingPlan from '@/components/student/StudentStretchingPlan';
import FitProApiSettings from '@/components/pages/FitProApiSettings';
import HighPerformanceEngine from '@/components/pages/HighPerformanceEngine';
import { useAuth } from '@/hooks/useAuth';
import { useActiveAssessment } from '@/contexts/ActiveAssessmentContext';

const Index = () => {
  const { userRole } = useAuth();
  const { active } = useActiveAssessment();
  const activeStudentId = active.studentId || undefined;
  const activeAssessmentId = active.assessmentId || undefined;
  const isTeacher = userRole === 'teacher' || userRole === 'admin';
  const [currentView, setCurrentView] = useState('dashboard');

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return isTeacher
          ? <TeacherDashboard onNavigate={setCurrentView} />
          : <StudentDashboard onNavigate={setCurrentView} />;
      case 'express':
        return <ExpressAnalysis onNavigate={setCurrentView} />;
      case 'clients':
        return <ClientManagement onNavigate={setCurrentView} />;
      case 'assessment-wizard':
        return <AssessmentWizard onNavigate={setCurrentView} />;
      case 'movement-analyser':
        return <MovementAnalyser studentId={activeStudentId} assessmentId={activeAssessmentId} />;
      case 'complaint-analyser':
        return <ComplaintAnalyser studentId={activeStudentId} assessmentId={activeAssessmentId} />;
      case 'body-composition':
        return <BodyCompositionEstimator studentId={activeStudentId} />;
      case 'high-performance':
        return <HighPerformanceEngine onNavigate={setCurrentView} />;
      case 'media-collector':
        return <MediaCollector onNavigate={setCurrentView} />;
      case 'results-hud':
        return <ResultsHUD onNavigate={setCurrentView} />;
      case 'plan-builder':
        return <PlanBuilder onNavigate={setCurrentView} />;
      case 'session-tracker':
        return <SessionTracker onNavigate={setCurrentView} />;
      case 'protocol-library':
        return <ProtocolLibrary />;
      case 'progress-dashboard':
        return <ProgressDashboard />;
      case 'student-report':
        return <StudentReportView />;
      case 'student-stretching':
        return <StudentStretchingPlan />;
      case 'student-recommendations':
        return <StudentRecommendations />;
      case 'fitpro-api':
        return <FitProApiSettings />;
      default:
        return isTeacher
          ? <TeacherDashboard onNavigate={setCurrentView} />
          : <StudentDashboard onNavigate={setCurrentView} />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <div className="hidden md:block">
          <Navigation activeSection={currentView} onSectionChange={setCurrentView} />
        </div>
        <main className="flex-1 p-6">
          {renderCurrentView()}
        </main>
      </div>
      <BottomNavigation currentView={currentView} onViewChange={setCurrentView} />
    </div>
  );
};

export default Index;
