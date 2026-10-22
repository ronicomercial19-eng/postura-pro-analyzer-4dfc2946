import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from './client';
import type { Json } from './types';

// Contracts for legacy consumers, NOT a declaration that these tables exist.
// Keep them separate from the generated schema. Server errors still propagate
// through the existing callers when a legacy table is unavailable.
type Evaluation = {
  id: string;
  title: string;
  student_id: string | null;
  teacher_id: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  age: number | null;
  height: number | null;
  weight: number | null;
  complaints: string | null;
  cranio_cervical_angle: number | null;
  thoracic_kyphosis: number | null;
  lumbar_lordosis: number | null;
  pelvic_tilt: number | null;
  shoulder_imbalance: number | null;
  scapular_abduction: string | null;
  adams_test: string | null;
  squat_pattern: string | null;
  observations: string | null;
};

type Photo = {
  id: string;
  evaluation_id: string;
  image_url: string;
  view_type: string;
  measurements: Json;
  is_validated: boolean;
  created_at: string;
};

type Feedback = {
  id: string;
  type: string;
  message: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type PosturalAnalysis = {
  id: string;
  evaluation_id: string;
  created_by: string;
  overall_score: number;
  risk_level: string;
  identified_patterns: Json;
  recommendations: Json;
  exercise_protocols: Json;
  created_at: string;
};

type TableContract<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: [];
};

type LegacyDatabase = {
  public: {
    Tables: {
      evaluations: TableContract<Evaluation, 'title'>;
      photos: TableContract<Photo, 'evaluation_id' | 'image_url' | 'view_type'>;
      user_feedback: TableContract<Feedback, 'type' | 'message'>;
      postural_analyses: TableContract<PosturalAnalysis,
        'evaluation_id' | 'created_by' | 'overall_score' | 'risk_level'>;
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
  };
};

// Reuse the existing authenticated client; no second session or client instance.
const legacyClient = supabase as unknown as SupabaseClient<LegacyDatabase>;

export function legacyTable<Name extends keyof LegacyDatabase['public']['Tables']>(name: Name) {
  return legacyClient.from(name);
}