export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      ai_analysis_feedback: {
        Row: {
          analysis_run_id: string | null
          complaint_analysis_id: string | null
          correction_text: string | null
          created_at: string
          id: string
          movement_analysis_id: string | null
          teacher_id: string
          was_accurate: boolean | null
        }
        Insert: {
          analysis_run_id?: string | null
          complaint_analysis_id?: string | null
          correction_text?: string | null
          created_at?: string
          id?: string
          movement_analysis_id?: string | null
          teacher_id: string
          was_accurate?: boolean | null
        }
        Update: {
          analysis_run_id?: string | null
          complaint_analysis_id?: string | null
          correction_text?: string | null
          created_at?: string
          id?: string
          movement_analysis_id?: string | null
          teacher_id?: string
          was_accurate?: boolean | null
        }
        Relationships: []
      }
      ai_quota_limits: {
        Row: {
          monthly_limit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          monthly_limit?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          monthly_limit?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_events: {
        Row: {
          created_at: string
          function_name: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          function_name: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          function_name?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      assessment_drafts: {
        Row: {
          created_at: string | null
          draft_data: Json
          evaluation_id: string | null
          id: string
          last_saved: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          draft_data?: Json
          evaluation_id?: string | null
          id?: string
          last_saved?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          draft_data?: Json
          evaluation_id?: string | null
          id?: string
          last_saved?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      fitpro_integration_tokens: {
        Row: {
          created_at: string
          id: string
          last_used_at: string | null
          name: string
          revoked_at: string | null
          teacher_id: string
          token_hash: string
          token_prefix: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          teacher_id: string
          token_hash: string
          token_prefix: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string | null
          name?: string
          revoked_at?: string | null
          teacher_id?: string
          token_hash?: string
          token_prefix?: string
          updated_at?: string
        }
        Relationships: []
      }
      ppa_analysis_runs: {
        Row: {
          assessment_id: string
          confidence_final: number | null
          created_at: string
          dominant_vector: Json | null
          gait_analysis: Json | null
          id: string
          model_version: string | null
          status: string
        }
        Insert: {
          assessment_id: string
          confidence_final?: number | null
          created_at?: string
          dominant_vector?: Json | null
          gait_analysis?: Json | null
          id?: string
          model_version?: string | null
          status?: string
        }
        Update: {
          assessment_id?: string
          confidence_final?: number | null
          created_at?: string
          dominant_vector?: Json | null
          gait_analysis?: Json | null
          id?: string
          model_version?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppa_analysis_runs_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "ppa_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      ppa_assessments: {
        Row: {
          context: Json
          created_at: string
          id: string
          pain: Json
          status: string
          student_id: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          context?: Json
          created_at?: string
          id?: string
          pain?: Json
          status?: string
          student_id: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          context?: Json
          created_at?: string
          id?: string
          pain?: Json
          status?: string
          student_id?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppa_assessments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppa_assessments_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ppa_body_composition: {
        Row: {
          assessment_id: string | null
          confidence: number | null
          created_at: string
          estimated_body_fat_pct: number | null
          estimated_lean_mass_kg: number | null
          front_photo_url: string | null
          height_cm: number | null
          id: string
          notes: string | null
          side_photo_url: string | null
          student_id: string
          weight_kg: number | null
        }
        Insert: {
          assessment_id?: string | null
          confidence?: number | null
          created_at?: string
          estimated_body_fat_pct?: number | null
          estimated_lean_mass_kg?: number | null
          front_photo_url?: string | null
          height_cm?: number | null
          id?: string
          notes?: string | null
          side_photo_url?: string | null
          student_id: string
          weight_kg?: number | null
        }
        Update: {
          assessment_id?: string | null
          confidence?: number | null
          created_at?: string
          estimated_body_fat_pct?: number | null
          estimated_lean_mass_kg?: number | null
          front_photo_url?: string | null
          height_cm?: number | null
          id?: string
          notes?: string | null
          side_photo_url?: string | null
          student_id?: string
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ppa_body_comp_assess_fk"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "ppa_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppa_body_comp_student_fk"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ppa_clusters: {
        Row: {
          analysis_run_id: string
          cluster_types: Json | null
          id: string
          rationale: Json | null
          score: number
        }
        Insert: {
          analysis_run_id: string
          cluster_types?: Json | null
          id?: string
          rationale?: Json | null
          score?: number
        }
        Update: {
          analysis_run_id?: string
          cluster_types?: Json | null
          id?: string
          rationale?: Json | null
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "ppa_clusters_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "ppa_analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ppa_complaint_analyses: {
        Row: {
          ai_interpretation: string | null
          assessment_id: string | null
          created_at: string
          extracted_region: string | null
          id: string
          pattern_match: string | null
          pattern_type: string | null
          raw_text: string
          red_flags: Json | null
          student_id: string
        }
        Insert: {
          ai_interpretation?: string | null
          assessment_id?: string | null
          created_at?: string
          extracted_region?: string | null
          id?: string
          pattern_match?: string | null
          pattern_type?: string | null
          raw_text: string
          red_flags?: Json | null
          student_id: string
        }
        Update: {
          ai_interpretation?: string | null
          assessment_id?: string | null
          created_at?: string
          extracted_region?: string | null
          id?: string
          pattern_match?: string | null
          pattern_type?: string | null
          raw_text?: string
          red_flags?: Json | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppa_complaint_assess_fk"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "ppa_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppa_complaint_student_fk"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ppa_consents: {
        Row: {
          accepted_at: string
          assessment_id: string | null
          created_at: string
          id: string
          revoked_at: string | null
          scopes: Json
          signer_name: string
          student_id: string
          teacher_id: string
          term_snapshot: string
          term_version: string
          user_agent: string | null
        }
        Insert: {
          accepted_at?: string
          assessment_id?: string | null
          created_at?: string
          id?: string
          revoked_at?: string | null
          scopes?: Json
          signer_name: string
          student_id: string
          teacher_id: string
          term_snapshot: string
          term_version: string
          user_agent?: string | null
        }
        Update: {
          accepted_at?: string
          assessment_id?: string | null
          created_at?: string
          id?: string
          revoked_at?: string | null
          scopes?: Json
          signer_name?: string
          student_id?: string
          teacher_id?: string
          term_snapshot?: string
          term_version?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ppa_consents_student_fk"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppa_consents_teacher_fk"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ppa_engine_decisions: {
        Row: {
          analysis_run_id: string
          created_at: string
          decided_by: string
          final_decision: Json | null
          id: string
          macro_state: string
          micro_states: Json | null
          risk_level: string
        }
        Insert: {
          analysis_run_id: string
          created_at?: string
          decided_by?: string
          final_decision?: Json | null
          id?: string
          macro_state: string
          micro_states?: Json | null
          risk_level?: string
        }
        Update: {
          analysis_run_id?: string
          created_at?: string
          decided_by?: string
          final_decision?: Json | null
          id?: string
          macro_state?: string
          micro_states?: Json | null
          risk_level?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppa_engine_decisions_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "ppa_analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ppa_findings: {
        Row: {
          analysis_run_id: string
          chain: Json | null
          confidence: number | null
          direction: string | null
          finding_key: string
          id: string
          severity: number
        }
        Insert: {
          analysis_run_id: string
          chain?: Json | null
          confidence?: number | null
          direction?: string | null
          finding_key: string
          id?: string
          severity?: number
        }
        Update: {
          analysis_run_id?: string
          chain?: Json | null
          confidence?: number | null
          direction?: string | null
          finding_key?: string
          id?: string
          severity?: number
        }
        Relationships: [
          {
            foreignKeyName: "ppa_findings_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "ppa_analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ppa_functional_tests: {
        Row: {
          assessment_id: string | null
          classification: string | null
          created_at: string
          data: Json
          id: string
          performed_at: string
          student_id: string
          teacher_id: string
          test_type: string
        }
        Insert: {
          assessment_id?: string | null
          classification?: string | null
          created_at?: string
          data?: Json
          id?: string
          performed_at?: string
          student_id: string
          teacher_id: string
          test_type: string
        }
        Update: {
          assessment_id?: string | null
          classification?: string | null
          created_at?: string
          data?: Json
          id?: string
          performed_at?: string
          student_id?: string
          teacher_id?: string
          test_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppa_ft_student_fk"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppa_ft_teacher_fk"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ppa_live_corrections: {
        Row: {
          corrected: boolean
          created_at: string
          id: string
          joint: string
          macro_key: string
          note: string | null
          source: string
          student_id: string
          teacher_id: string
        }
        Insert: {
          corrected?: boolean
          created_at?: string
          id?: string
          joint: string
          macro_key: string
          note?: string | null
          source?: string
          student_id: string
          teacher_id: string
        }
        Update: {
          corrected?: boolean
          created_at?: string
          id?: string
          joint?: string
          macro_key?: string
          note?: string | null
          source?: string
          student_id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppa_live_corrections_macro_key_fkey"
            columns: ["macro_key"]
            isOneToOne: false
            referencedRelation: "ppa_live_rules"
            referencedColumns: ["macro_key"]
          },
        ]
      }
      ppa_live_rules: {
        Row: {
          corrective: Json
          created_at: string
          cue: string
          flags: string[]
          id: string
          inhibited: string[]
          joint: string
          macro_key: string
          myofascial_lines: string[]
          name: string
          overloaded: string[]
          red_flag_note: string | null
          risk: string
          sort_order: number
        }
        Insert: {
          corrective?: Json
          created_at?: string
          cue: string
          flags?: string[]
          id?: string
          inhibited?: string[]
          joint: string
          macro_key: string
          myofascial_lines?: string[]
          name: string
          overloaded?: string[]
          red_flag_note?: string | null
          risk: string
          sort_order?: number
        }
        Update: {
          corrective?: Json
          created_at?: string
          cue?: string
          flags?: string[]
          id?: string
          inhibited?: string[]
          joint?: string
          macro_key?: string
          myofascial_lines?: string[]
          name?: string
          overloaded?: string[]
          red_flag_note?: string | null
          risk?: string
          sort_order?: number
        }
        Relationships: []
      }
      ppa_media_assets: {
        Row: {
          assessment_id: string
          capture_confidence: number | null
          created_at: string
          id: string
          image_url: string
          qa_reasons: Json | null
          qa_status: string
          side: string
          type: string
          view: string
        }
        Insert: {
          assessment_id: string
          capture_confidence?: number | null
          created_at?: string
          id?: string
          image_url: string
          qa_reasons?: Json | null
          qa_status?: string
          side?: string
          type?: string
          view: string
        }
        Update: {
          assessment_id?: string
          capture_confidence?: number | null
          created_at?: string
          id?: string
          image_url?: string
          qa_reasons?: Json | null
          qa_status?: string
          side?: string
          type?: string
          view?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppa_media_assets_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "ppa_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      ppa_metrics: {
        Row: {
          analysis_run_id: string
          confidence: number | null
          id: string
          key: string
          severity: number
          threshold_ref: number | null
          unit: string | null
          value: number
        }
        Insert: {
          analysis_run_id: string
          confidence?: number | null
          id?: string
          key: string
          severity?: number
          threshold_ref?: number | null
          unit?: string | null
          value?: number
        }
        Update: {
          analysis_run_id?: string
          confidence?: number | null
          id?: string
          key?: string
          severity?: number
          threshold_ref?: number | null
          unit?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "ppa_metrics_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "ppa_analysis_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      ppa_monitoring_logs: {
        Row: {
          created_at: string
          id: string
          integrity_result: string
          notes: string | null
          pain_delta: Json | null
          session_id: string | null
          student_id: string
          tns: number | null
          tremor_events: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          integrity_result?: string
          notes?: string | null
          pain_delta?: Json | null
          session_id?: string | null
          student_id: string
          tns?: number | null
          tremor_events?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          integrity_result?: string
          notes?: string | null
          pain_delta?: Json | null
          session_id?: string | null
          student_id?: string
          tns?: number | null
          tremor_events?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ppa_monitoring_logs_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ppa_movement_analyses: {
        Row: {
          ai_summary: string | null
          angle_trajectory: Json | null
          assessment_id: string
          created_at: string
          detected_faults: Json | null
          exercise_type: string
          id: string
          keypoint_trajectory: Json | null
          pattern_match: string | null
          protocol_key: string | null
          rom_data: Json | null
          video_url: string | null
        }
        Insert: {
          ai_summary?: string | null
          angle_trajectory?: Json | null
          assessment_id: string
          created_at?: string
          detected_faults?: Json | null
          exercise_type: string
          id?: string
          keypoint_trajectory?: Json | null
          pattern_match?: string | null
          protocol_key?: string | null
          rom_data?: Json | null
          video_url?: string | null
        }
        Update: {
          ai_summary?: string | null
          angle_trajectory?: Json | null
          assessment_id?: string
          created_at?: string
          detected_faults?: Json | null
          exercise_type?: string
          id?: string
          keypoint_trajectory?: Json | null
          pattern_match?: string | null
          protocol_key?: string | null
          rom_data?: Json | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ppa_movement_assess_fk"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "ppa_assessments"
            referencedColumns: ["id"]
          },
        ]
      }
      ppa_plan_links: {
        Row: {
          active: boolean
          analysis_run_id: string | null
          created_at: string
          id: string
          periodizer_plan_id: string | null
          published_at: string | null
          recommendations: Json | null
          report_html: string | null
          smart_treino_plan_id: string | null
          stretching_plan: Json | null
          student_id: string
        }
        Insert: {
          active?: boolean
          analysis_run_id?: string | null
          created_at?: string
          id?: string
          periodizer_plan_id?: string | null
          published_at?: string | null
          recommendations?: Json | null
          report_html?: string | null
          smart_treino_plan_id?: string | null
          stretching_plan?: Json | null
          student_id: string
        }
        Update: {
          active?: boolean
          analysis_run_id?: string | null
          created_at?: string
          id?: string
          periodizer_plan_id?: string | null
          published_at?: string | null
          recommendations?: Json | null
          report_html?: string | null
          smart_treino_plan_id?: string | null
          stretching_plan?: Json | null
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ppa_plan_links_analysis_run_id_fkey"
            columns: ["analysis_run_id"]
            isOneToOne: false
            referencedRelation: "ppa_analysis_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppa_plan_links_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ppa_protocols_library: {
        Row: {
          category: string
          contraindications: Json | null
          created_at: string
          id: string
          protocol_key: string
          steps: Json
          version: number
        }
        Insert: {
          category: string
          contraindications?: Json | null
          created_at?: string
          id?: string
          protocol_key: string
          steps?: Json
          version?: number
        }
        Update: {
          category?: string
          contraindications?: Json | null
          created_at?: string
          id?: string
          protocol_key?: string
          steps?: Json
          version?: number
        }
        Relationships: []
      }
      ppa_sprint_assessments: {
        Row: {
          assessment_id: string | null
          cardiovascular_recovery_ok: boolean
          created_at: string
          forward_head_posture_detected: boolean
          id: string
          peak_speed_kmh: number
          result: Json
          stride_frequency_hz: number | null
          student_id: string
          thoracic_mobility_restricted: boolean
        }
        Insert: {
          assessment_id?: string | null
          cardiovascular_recovery_ok?: boolean
          created_at?: string
          forward_head_posture_detected?: boolean
          id?: string
          peak_speed_kmh?: number
          result: Json
          stride_frequency_hz?: number | null
          student_id: string
          thoracic_mobility_restricted?: boolean
        }
        Update: {
          assessment_id?: string | null
          cardiovascular_recovery_ok?: boolean
          created_at?: string
          forward_head_posture_detected?: boolean
          id?: string
          peak_speed_kmh?: number
          result?: Json
          stride_frequency_hz?: number | null
          student_id?: string
          thoracic_mobility_restricted?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "ppa_sprint_assessments_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "ppa_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ppa_sprint_student_fk"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      students: {
        Row: {
          created_at: string | null
          id: string
          student_id: string | null
          teacher_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          student_id?: string | null
          teacher_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          student_id?: string | null
          teacher_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_consents: {
        Row: {
          accepted_at: string
          consent_type: string
          id: string
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          consent_type: string
          id?: string
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          consent_type?: string
          id?: string
          user_id?: string
          version?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_student_to_teacher: {
        Args: { student_email: string; teacher_id: string }
        Returns: {
          message: string
          student_id: string
          success: boolean
        }[]
      }
      add_user_role:
        | {
            Args: { new_role: string; target_user_id: string }
            Returns: boolean
          }
        | {
            Args: {
              additional_permissions?: string[]
              new_role: string
              target_user_id: string
            }
            Returns: boolean
          }
      add_user_role_simple: {
        Args: { p_role: string; p_user_id: string }
        Returns: undefined
      }
      can_perform_action: { Args: { required_role: string }; Returns: boolean }
      consume_ai_quota: {
        Args: { _function_name: string; _user_id: string }
        Returns: Json
      }
      get_teacher_students: {
        Args: { teacher_id?: string }
        Returns: {
          created_at: string
          email: string
          full_name: string
          student_id: string
        }[]
      }
      get_user_profile: {
        Args: { user_id?: string }
        Returns: {
          avatar_url: string
          created_at: string
          email: string
          full_name: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }[]
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      is_student: { Args: { user_id?: string }; Returns: boolean }
      is_teacher: { Args: { user_id?: string }; Returns: boolean }
      is_user_role: { Args: { check_role: string }; Returns: boolean }
      remove_user_role: {
        Args: { role_to_remove: string; target_user_id: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: { check_permission: string }
        Returns: boolean
      }
    }
    Enums: {
      user_role: "teacher" | "student" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      user_role: ["teacher", "student", "admin"],
    },
  },
} as const
