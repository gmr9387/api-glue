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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_decision_trace: {
        Row: {
          confidence: number | null
          decision: string | null
          escalated: boolean
          id: string
          model: string | null
          prompt: string | null
          reasoning: string | null
          risk: string | null
          run_id: string | null
          ts: string
        }
        Insert: {
          confidence?: number | null
          decision?: string | null
          escalated?: boolean
          id?: string
          model?: string | null
          prompt?: string | null
          reasoning?: string | null
          risk?: string | null
          run_id?: string | null
          ts?: string
        }
        Update: {
          confidence?: number | null
          decision?: string | null
          escalated?: boolean
          id?: string
          model?: string | null
          prompt?: string | null
          reasoning?: string | null
          risk?: string | null
          run_id?: string | null
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_decision_trace_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      api_requests: {
        Row: {
          action: string
          created_at: string
          duration_ms: number | null
          id: string
          mock: boolean
          request_data: Json | null
          response_data: Json | null
          service: string
          success: boolean
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          mock?: boolean
          request_data?: Json | null
          response_data?: Json | null
          service: string
          success?: boolean
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          mock?: boolean
          request_data?: Json | null
          response_data?: Json | null
          service?: string
          success?: boolean
          user_id?: string | null
        }
        Relationships: []
      }
      connector_state: {
        Row: {
          backoff_until: string | null
          connector: string
          failure_rate: number
          id: string
          last_error: string | null
          last_success_at: string | null
          latency_ms: number | null
          quota_limit: number
          quota_used: number
          status: string
          updated_at: string
        }
        Insert: {
          backoff_until?: string | null
          connector: string
          failure_rate?: number
          id?: string
          last_error?: string | null
          last_success_at?: string | null
          latency_ms?: number | null
          quota_limit?: number
          quota_used?: number
          status?: string
          updated_at?: string
        }
        Update: {
          backoff_until?: string | null
          connector?: string
          failure_rate?: number
          id?: string
          last_error?: string | null
          last_success_at?: string | null
          latency_ms?: number | null
          quota_limit?: number
          quota_used?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      saved_workflows: {
        Row: {
          created_at: string
          edges: Json | null
          id: string
          name: string
          nodes: Json | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          edges?: Json | null
          id?: string
          name: string
          nodes?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          edges?: Json | null
          id?: string
          name?: string
          nodes?: Json | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      workflow_approvals: {
        Row: {
          decided_at: string | null
          decided_by: string | null
          decision: string | null
          id: string
          requested_at: string
          run_id: string
          step_id: string | null
        }
        Insert: {
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          id?: string
          requested_at?: string
          run_id: string
          step_id?: string | null
        }
        Update: {
          decided_at?: string | null
          decided_by?: string | null
          decision?: string | null
          id?: string
          requested_at?: string
          run_id?: string
          step_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workflow_approvals_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_approvals_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_step_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_checkpoints: {
        Row: {
          id: string
          run_id: string
          snapshot: Json
          step_index: number
          ts: string
        }
        Insert: {
          id?: string
          run_id: string
          snapshot?: Json
          step_index: number
          ts?: string
        }
        Update: {
          id?: string
          run_id?: string
          snapshot?: Json
          step_index?: number
          ts?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_checkpoints_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_dags: {
        Row: {
          created_at: string
          graph: Json
          id: string
          name: string
          updated_at: string
          version: number
        }
        Insert: {
          created_at?: string
          graph?: Json
          id: string
          name: string
          updated_at?: string
          version?: number
        }
        Update: {
          created_at?: string
          graph?: Json
          id?: string
          name?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      workflow_dead_letter: {
        Row: {
          attempts: number
          dag_node_id: string
          id: string
          job_id: string
          last_error: string | null
          moved_at: string
          payload: Json
          run_id: string
        }
        Insert: {
          attempts: number
          dag_node_id: string
          id?: string
          job_id: string
          last_error?: string | null
          moved_at?: string
          payload?: Json
          run_id: string
        }
        Update: {
          attempts?: number
          dag_node_id?: string
          id?: string
          job_id?: string
          last_error?: string | null
          moved_at?: string
          payload?: Json
          run_id?: string
        }
        Relationships: []
      }
      workflow_events: {
        Row: {
          data: Json
          id: string
          message: string | null
          run_id: string | null
          severity: string
          source: string | null
          step_id: string | null
          ts: string
          type: string
        }
        Insert: {
          data?: Json
          id?: string
          message?: string | null
          run_id?: string | null
          severity?: string
          source?: string | null
          step_id?: string | null
          ts?: string
          type: string
        }
        Update: {
          data?: Json
          id?: string
          message?: string | null
          run_id?: string | null
          severity?: string
          source?: string | null
          step_id?: string | null
          ts?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_events_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_events_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "workflow_step_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_incidents: {
        Row: {
          acknowledged_by: string | null
          category: string | null
          closed_at: string | null
          connector: string | null
          id: string
          opened_at: string
          recovery_state: string
          resolved_at: string | null
          run_id: string | null
          severity: string
          summary: string
        }
        Insert: {
          acknowledged_by?: string | null
          category?: string | null
          closed_at?: string | null
          connector?: string | null
          id?: string
          opened_at?: string
          recovery_state?: string
          resolved_at?: string | null
          run_id?: string | null
          severity?: string
          summary: string
        }
        Update: {
          acknowledged_by?: string | null
          category?: string | null
          closed_at?: string | null
          connector?: string | null
          id?: string
          opened_at?: string
          recovery_state?: string
          resolved_at?: string | null
          run_id?: string | null
          severity?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "workflow_incidents_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_jobs: {
        Row: {
          backoff_until: string | null
          completed_at: string | null
          created_at: string
          dag_node_id: string
          error: string | null
          id: string
          idempotency_key: string
          max_retries: number
          payload: Json
          priority: number
          retry_attempt: number
          run_id: string
          scheduled_at: string
          started_at: string | null
          state: string
          step_id: string | null
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          backoff_until?: string | null
          completed_at?: string | null
          created_at?: string
          dag_node_id: string
          error?: string | null
          id?: string
          idempotency_key: string
          max_retries?: number
          payload?: Json
          priority?: number
          retry_attempt?: number
          run_id: string
          scheduled_at?: string
          started_at?: string | null
          state?: string
          step_id?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          backoff_until?: string | null
          completed_at?: string | null
          created_at?: string
          dag_node_id?: string
          error?: string | null
          id?: string
          idempotency_key?: string
          max_retries?: number
          payload?: Json
          priority?: number
          retry_attempt?: number
          run_id?: string
          scheduled_at?: string
          started_at?: string | null
          state?: string
          step_id?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: []
      }
      workflow_runs: {
        Row: {
          concurrency_key: string | null
          context: Json
          correlation_id: string | null
          created_at: string
          dag_id: string | null
          duration_ms: number | null
          ended_at: string | null
          error: string | null
          finished_at: string | null
          id: string
          payload: Json
          result: Json | null
          retry_count: number
          started_at: string
          state: string
          status: string
          steps: Json
          tenant_id: string | null
          user_id: string
          workflow_id: string | null
          workflow_name: string
        }
        Insert: {
          concurrency_key?: string | null
          context?: Json
          correlation_id?: string | null
          created_at?: string
          dag_id?: string | null
          duration_ms?: number | null
          ended_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          payload?: Json
          result?: Json | null
          retry_count?: number
          started_at?: string
          state?: string
          status?: string
          steps?: Json
          tenant_id?: string | null
          user_id: string
          workflow_id?: string | null
          workflow_name: string
        }
        Update: {
          concurrency_key?: string | null
          context?: Json
          correlation_id?: string | null
          created_at?: string
          dag_id?: string | null
          duration_ms?: number | null
          ended_at?: string | null
          error?: string | null
          finished_at?: string | null
          id?: string
          payload?: Json
          result?: Json | null
          retry_count?: number
          started_at?: string
          state?: string
          status?: string
          steps?: Json
          tenant_id?: string | null
          user_id?: string
          workflow_id?: string | null
          workflow_name?: string
        }
        Relationships: []
      }
      workflow_step_runs: {
        Row: {
          attempt: number
          connector: string | null
          connector_response: Json | null
          created_at: string
          dag_node_id: string | null
          duration_ms: number | null
          ended_at: string | null
          error: string | null
          id: string
          idempotency_key: string | null
          inputs: Json
          name: string
          outputs: Json | null
          payload: Json
          result: Json | null
          retry_count: number
          run_id: string
          started_at: string | null
          state: string
          step_index: number
        }
        Insert: {
          attempt?: number
          connector?: string | null
          connector_response?: Json | null
          created_at?: string
          dag_node_id?: string | null
          duration_ms?: number | null
          ended_at?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string | null
          inputs?: Json
          name: string
          outputs?: Json | null
          payload?: Json
          result?: Json | null
          retry_count?: number
          run_id: string
          started_at?: string | null
          state?: string
          step_index: number
        }
        Update: {
          attempt?: number
          connector?: string | null
          connector_response?: Json | null
          created_at?: string
          dag_node_id?: string | null
          duration_ms?: number | null
          ended_at?: string | null
          error?: string | null
          id?: string
          idempotency_key?: string | null
          inputs?: Json
          name?: string
          outputs?: Json | null
          payload?: Json
          result?: Json | null
          retry_count?: number
          run_id?: string
          started_at?: string | null
          state?: string
          step_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "workflow_step_runs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "workflow_runs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_next_job: {
        Args: { _worker_id: string }
        Returns: {
          backoff_until: string | null
          completed_at: string | null
          created_at: string
          dag_node_id: string
          error: string | null
          id: string
          idempotency_key: string
          max_retries: number
          payload: Json
          priority: number
          retry_attempt: number
          run_id: string
          scheduled_at: string
          started_at: string | null
          state: string
          step_id: string | null
          updated_at: string
          worker_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "workflow_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
