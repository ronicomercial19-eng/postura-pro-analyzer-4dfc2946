import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import ComprehensiveClientData from './assessment/ComprehensiveClientData';
import PosturalEvaluation from './assessment/PosturalEvaluation';
import TreatmentProtocols from './assessment/TreatmentProtocols';
import AssessmentResults from './assessment/AssessmentResults';
import PosturalMeasurements from './assessment/PosturalMeasurements';
import DiagnosticAI from './assessment/DiagnosticAI';
import PhotoUploadSystem from './PhotoUploadSystem';
import { supabase } from '@/integrations/supabase/client';
import { legacyTable } from '@/integrations/supabase/legacyTables';
import { Button } from '@/components/ui/button';
import { Save, Upload } from 'lucide-react';

export interface ClientData {
  fullName: string;
  age: number;
  gender: 'male' | 'female' | 'other';
  height: number;
  weight: number;
  profession: string;
  dailyHoursSitting: number;
  dailyHoursStanding: number;
  knownInjuries: string;
  previousSurgeries: string;
  chronicDiseases: string;
  currentMedications: string;
  allergies: string;
  activityLevel: 'sedentary' | 'moderate' | 'active' | 'athlete';
  sportsActivity: string;
  sportsFrequency: string;
  sleepHours: number;
  sleepQuality: 'poor' | 'regular' | 'good' | 'excellent';
  diet: 'balanced' | 'vegetarian' | 'processed' | 'other';
  smoking: boolean;
  alcohol: 'none' | 'social' | 'regular' | 'frequent';
  painLocation: string;
  painIntensity: number;
  painFrequency: string;
  jointStiffness: string;
  posturalFatigue: string;
  functionalDifficulties: string;
  primaryGoal: string;
  secondaryGoal: string;
}

export interface PosturalAssessmentData {
  headForward: number;
  shouldersProtracted: number;
  scapularWinging: number;
  thoracicKyphosis: number;
  lumbarLordosis: number;
  pelvicAnteversion: number;
  kneeValgusVarus: number;
  flatFeet: number;
  adamsTest: 'negative' | 'positive';
  anteriorFlexion: 'normal' | 'limited';
  singleLegStance: 'good' | 'poor';
  squatPattern: 'normal' | 'compensated';
  observations: string;
}

const PosturalAssessment = () => {
  const [activeTab, setActiveTab] = useState('client-data');
  const [currentEvaluationId, setCurrentEvaluationId] = useState<string | null>(null);
  const [clientData, setClientData] = useState<ClientData>({
    fullName: '',
    age: 0,
    gender: 'other',
    height: 0,
    weight: 0,
    profession: '',
    dailyHoursSitting: 0,
    dailyHoursStanding: 0,
    knownInjuries: '',
    previousSurgeries: '',
    chronicDiseases: '',
    currentMedications: '',
    allergies: '',
    activityLevel: 'sedentary',
    sportsActivity: '',
    sportsFrequency: '',
    sleepHours: 8,
    sleepQuality: 'good',
    diet: 'balanced',
    smoking: false,
    alcohol: 'none',
    painLocation: '',
    painIntensity: 0,
    painFrequency: '',
    jointStiffness: '',
    posturalFatigue: '',
    functionalDifficulties: '',
    primaryGoal: '',
    secondaryGoal: ''
  });

  const [posturalData, setPosturalData] = useState<PosturalAssessmentData>({
    headForward: 0,
    shouldersProtracted: 0,
    scapularWinging: 0,
    thoracicKyphosis: 0,
    lumbarLordosis: 0,
    pelvicAnteversion: 0,
    kneeValgusVarus: 0,
    flatFeet: 0,
    adamsTest: 'negative',
    anteriorFlexion: 'normal',
    singleLegStance: 'good',
    squatPattern: 'normal',
    observations: ''
  });

  const [measurements, setMeasurements] = useState({});
  const [diagnosis, setDiagnosis] = useState(null);
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Carregar dados salvos
  useEffect(() => {
    const loadSavedData = () => {
      try {
        const savedClientData = localStorage.getItem('clientData');
        const savedPosturalData = localStorage.getItem('posturalData');
        
        if (savedClientData) {
          setClientData(JSON.parse(savedClientData));
        }
        
        if (savedPosturalData) {
          setPosturalData(JSON.parse(savedPosturalData));
        }
      } catch (error) {
        console.error('Erro ao carregar dados salvos:', error);
      }
    };

    loadSavedData();
  }, []);

  // Auto-salvar dados
  useEffect(() => {
    try {
      localStorage.setItem('clientData', JSON.stringify(clientData));
    } catch (error) {
      console.error('Erro ao salvar dados do cliente:', error);
    }
  }, [clientData]);

  useEffect(() => {
    try {
      localStorage.setItem('posturalData', JSON.stringify(posturalData));
    } catch (error) {
      console.error('Erro ao salvar dados posturais:', error);
    }
  }, [posturalData]);

  const handleSaveAssessment = async () => {
    setIsSaving(true);
    
    try {
      // Save to Supabase
      const evaluationData = {
        title: `Avaliação de ${clientData.fullName || 'Paciente'} - ${new Date().toLocaleDateString('pt-BR')}`,
        age: clientData.age,
        height: clientData.height,
        weight: clientData.weight,
        complaints: `${clientData.painLocation} - Intensidade: ${clientData.painIntensity}`,
        cranio_cervical_angle: posturalData.headForward,
        thoracic_kyphosis: posturalData.thoracicKyphosis,
        lumbar_lordosis: posturalData.lumbarLordosis,
        pelvic_tilt: posturalData.pelvicAnteversion,
        shoulder_imbalance: posturalData.shouldersProtracted,
        scapular_abduction: posturalData.scapularWinging > 2 ? 'excessive' : 'normal',
        adams_test: posturalData.adamsTest,
        squat_pattern: posturalData.squatPattern,
        observations: posturalData.observations,
        status: 'draft'
      };

      const { data: evaluation, error } = await legacyTable('evaluations')
        .insert([evaluationData])
        .select()
        .single();

      if (error) throw error;

      setCurrentEvaluationId(evaluation.id);
      
      toast({
        title: "Sucesso!",
        description: "Avaliação salva no banco de dados.",
      });
      
    } catch (error) {
      console.error('Erro ao salvar avaliação:', error);
      toast({
        title: "Erro",
        description: "Erro ao salvar avaliação. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClientDataChange = (field: keyof ClientData, value: any) => {
    setClientData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePosturalDataChange = (field: keyof PosturalAssessmentData, value: any) => {
    setPosturalData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Avaliação Postural Completa</h1>
            <p className="text-gray-600">Sistema SAARS - Avaliação Abrangente com IA</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveAssessment}
              disabled={isSaving}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isSaving ? 'Salvando...' : 'Salvar Avaliação'}
            </button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="client-data">Dados</TabsTrigger>
            <TabsTrigger value="postural-eval">Avaliação</TabsTrigger>
            <TabsTrigger value="measurements">Medições</TabsTrigger>
            <TabsTrigger value="photos">Fotos</TabsTrigger>
            <TabsTrigger value="diagnosis">Diagnóstico</TabsTrigger>
            <TabsTrigger value="protocols">Protocolos</TabsTrigger>
            <TabsTrigger value="results">Resultados</TabsTrigger>
          </TabsList>

          <TabsContent value="client-data" className="space-y-4">
            <ComprehensiveClientData 
              data={clientData}
              onChange={handleClientDataChange}
              onNext={() => setActiveTab('postural-eval')}
            />
          </TabsContent>

          <TabsContent value="postural-eval" className="space-y-4">
            <PosturalEvaluation 
              data={posturalData}
              onChange={handlePosturalDataChange}
              onNext={() => setActiveTab('measurements')}
            />
          </TabsContent>

          <TabsContent value="measurements" className="space-y-4">
            <PosturalMeasurements 
              clientData={clientData}
              measurements={measurements}
              onMeasurementsChange={setMeasurements}
            />
          </TabsContent>

          <TabsContent value="photos" className="space-y-4">
            <PhotoUploadSystem 
              evaluationId={currentEvaluationId || undefined}
              onPhotoUploaded={(photoData) => {
                console.log('Photo uploaded:', photoData);
                toast({
                  title: "Foto enviada",
                  description: "Foto adicionada à avaliação com sucesso",
                });
              }}
              maxPhotos={6}
              allowedViews={['anterior', 'posterior', 'lateral_direita', 'lateral_esquerda', 'sagital_direita', 'sagital_esquerda']}
            />
          </TabsContent>

          <TabsContent value="diagnosis" className="space-y-4">
            <DiagnosticAI 
              clientData={clientData}
              measurements={measurements}
              onDiagnosisComplete={setDiagnosis}
            />
          </TabsContent>

          <TabsContent value="protocols" className="space-y-4">
            <TreatmentProtocols 
              clientData={clientData}
              posturalData={posturalData}
              selectedProtocol={selectedProtocol}
              onProtocolSelect={setSelectedProtocol}
              onNext={() => setActiveTab('results')}
            />
          </TabsContent>

          <TabsContent value="results" className="space-y-4">
            <AssessmentResults 
              clientData={clientData}
              posturalData={posturalData}
              selectedProtocol={selectedProtocol}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default PosturalAssessment;
