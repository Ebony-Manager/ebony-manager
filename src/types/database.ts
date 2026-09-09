// Generated from the Supabase project schema (project ref jdfkfbopecqvvyxherku).
// Regenerate after any migration with:
//   supabase gen types typescript --project-id jdfkfbopecqvvyxherku > src/types/database.ts
// or via the Supabase MCP `generate_typescript_types` tool.
// Do not edit by hand.

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
      allowed_emails: {
        Row: {
          created_at: string
          email: string
          note: string | null
          role: string
        }
        Insert: {
          created_at?: string
          email: string
          note?: string | null
          role?: string
        }
        Update: {
          created_at?: string
          email?: string
          note?: string | null
          role?: string
        }
        Relationships: []
      }
      contractor_ledger_entries: {
        Row: {
          amount_cents: number
          category: string
          client_text: string | null
          contractor_id: string
          cost_per_mt2_cents: number | null
          created_at: string
          description: string | null
          direction: string
          ebony_absorbs_material: boolean
          entry_date: string
          id: string
          mt2: number | null
          notes: string | null
          project_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          category: string
          client_text?: string | null
          contractor_id: string
          cost_per_mt2_cents?: number | null
          created_at?: string
          description?: string | null
          direction: string
          ebony_absorbs_material?: boolean
          entry_date: string
          id?: string
          mt2?: number | null
          notes?: string | null
          project_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          category?: string
          client_text?: string | null
          contractor_id?: string
          cost_per_mt2_cents?: number | null
          created_at?: string
          description?: string | null
          direction?: string
          ebony_absorbs_material?: boolean
          entry_date?: string
          id?: string
          mt2?: number | null
          notes?: string | null
          project_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_ledger_entries_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_ledger_entries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          contact_info: string | null
          contractor_type: string
          created_at: string
          end_date: string | null
          id: string
          id_document: string | null
          name: string
          notes: string | null
          phone: string | null
          sort_order: number
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_info?: string | null
          contractor_type: string
          created_at?: string
          end_date?: string | null
          id?: string
          id_document?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          sort_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_info?: string | null
          contractor_type?: string
          created_at?: string
          end_date?: string | null
          id?: string
          id_document?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          sort_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payroll_employees: {
        Row: {
          base_salary_cents: number
          benefits_base_salary_cents: number | null
          contract_info: string | null
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          end_date: string | null
          id: string
          id_document: string | null
          liquidation_notes: string | null
          name: string
          notes: string | null
          phone: string | null
          position: string | null
          sort_order: number
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          base_salary_cents?: number
          benefits_base_salary_cents?: number | null
          contract_info?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          end_date?: string | null
          id?: string
          id_document?: string | null
          liquidation_notes?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          sort_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          base_salary_cents?: number
          benefits_base_salary_cents?: number | null
          contract_info?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          end_date?: string | null
          id?: string
          id_document?: string | null
          liquidation_notes?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          position?: string | null
          sort_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      payroll_entries: {
        Row: {
          base_pay_cents: number
          bonus_cents: number
          created_at: string
          decimo_paid_cents: number
          dias_descontados: number
          dias_descontados_cents: number
          dias_libres_cents: number
          employee_id: string
          extra_days: number
          extra_days_cents: number
          extra_hours: number
          extra_hours_cents: number
          horas_descontadas: number
          horas_descontadas_cents: number
          id: string
          notes: string | null
          other_deduction_cents: number
          paid: boolean
          paid_at: string | null
          payment_method: string
          period_half: number
          period_month: number
          period_year: number
          prima_antiguedad_paid_cents: number
          updated_at: string
          vacation_paid_cents: number
          viaticos_cents: number
        }
        Insert: {
          base_pay_cents?: number
          bonus_cents?: number
          created_at?: string
          decimo_paid_cents?: number
          dias_descontados?: number
          dias_descontados_cents?: number
          dias_libres_cents?: number
          employee_id: string
          extra_days?: number
          extra_days_cents?: number
          extra_hours?: number
          extra_hours_cents?: number
          horas_descontadas?: number
          horas_descontadas_cents?: number
          id?: string
          notes?: string | null
          other_deduction_cents?: number
          paid?: boolean
          paid_at?: string | null
          payment_method?: string
          period_half?: number
          period_month: number
          period_year: number
          prima_antiguedad_paid_cents?: number
          updated_at?: string
          vacation_paid_cents?: number
          viaticos_cents?: number
        }
        Update: {
          base_pay_cents?: number
          bonus_cents?: number
          created_at?: string
          decimo_paid_cents?: number
          dias_descontados?: number
          dias_descontados_cents?: number
          dias_libres_cents?: number
          employee_id?: string
          extra_days?: number
          extra_days_cents?: number
          extra_hours?: number
          extra_hours_cents?: number
          horas_descontadas?: number
          horas_descontadas_cents?: number
          id?: string
          notes?: string | null
          other_deduction_cents?: number
          paid?: boolean
          paid_at?: string | null
          payment_method?: string
          period_half?: number
          period_month?: number
          period_year?: number
          prima_antiguedad_paid_cents?: number
          updated_at?: string
          vacation_paid_cents?: number
          viaticos_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "payroll_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_ledger_entries: {
        Row: {
          amount_cents: number
          category: string
          created_at: string
          direction: string
          employee_id: string
          entry_date: string
          id: string
          loan_id: string | null
          notes: string | null
          payroll_entry_id: string | null
          updated_at: string
        }
        Insert: {
          amount_cents: number
          category?: string
          created_at?: string
          direction: string
          employee_id: string
          entry_date: string
          id?: string
          loan_id?: string | null
          notes?: string | null
          payroll_entry_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          category?: string
          created_at?: string
          direction?: string
          employee_id?: string
          entry_date?: string
          id?: string
          loan_id?: string | null
          notes?: string | null
          payroll_entry_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_ledger_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "payroll_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_ledger_entries_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "payroll_loans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payroll_ledger_entries_payroll_entry_id_fkey"
            columns: ["payroll_entry_id"]
            isOneToOne: false
            referencedRelation: "payroll_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_loans: {
        Row: {
          category: string
          created_at: string
          employee_id: string
          id: string
          notes: string | null
          num_installments: number
          payment_method: string
          principal_cents: number
          request_date: string
          start_period_half: number
          start_period_month: number
          start_period_year: number
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          employee_id: string
          id?: string
          notes?: string | null
          num_installments?: number
          payment_method?: string
          principal_cents: number
          request_date: string
          start_period_half?: number
          start_period_month: number
          start_period_year: number
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          employee_id?: string
          id?: string
          notes?: string | null
          num_installments?: number
          payment_method?: string
          principal_cents?: number
          request_date?: string
          start_period_half?: number
          start_period_month?: number
          start_period_year?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_loans_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "payroll_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_salary_changes: {
        Row: {
          benefits_base_salary_cents: number | null
          created_at: string
          effective_half: number
          effective_month: number
          effective_year: number
          employee_id: string
          id: string
          monthly_salary_cents: number
          notes: string | null
          updated_at: string
        }
        Insert: {
          benefits_base_salary_cents?: number | null
          created_at?: string
          effective_half?: number
          effective_month: number
          effective_year: number
          employee_id: string
          id?: string
          monthly_salary_cents: number
          notes?: string | null
          updated_at?: string
        }
        Update: {
          benefits_base_salary_cents?: number | null
          created_at?: string
          effective_half?: number
          effective_month?: number
          effective_year?: number
          employee_id?: string
          id?: string
          monthly_salary_cents?: number
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_salary_changes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "payroll_employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_assignments: {
        Row: {
          assigned_mt2: number | null
          contractor_id: string
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          project_id: string
          start_date: string | null
          updated_at: string
        }
        Insert: {
          assigned_mt2?: number | null
          contractor_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          project_id: string
          start_date?: string | null
          updated_at?: string
        }
        Update: {
          assigned_mt2?: number | null
          contractor_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          project_id?: string
          start_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_assignments_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_assignments_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_name: string | null
          created_at: string
          furniture_type: string | null
          id: string
          material_color: string | null
          name: string
          notes: string | null
          payment_terms: string | null
          scope: string | null
          specs: string | null
          status: string
          total_mt2: number | null
          updated_at: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          furniture_type?: string | null
          id?: string
          material_color?: string | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          scope?: string | null
          specs?: string | null
          status?: string
          total_mt2?: number | null
          updated_at?: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          furniture_type?: string | null
          id?: string
          material_color?: string | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          scope?: string | null
          specs?: string | null
          status?: string
          total_mt2?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
