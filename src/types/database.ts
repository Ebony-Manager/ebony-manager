// Generated from the Supabase project schema (project ref jdfkfbopecqvvyxherku).
// Regenerate after any migration with:
//   supabase gen types typescript --project-id jdfkfbopecqvvyxherku > src/types/database.ts
// or via the Supabase MCP `generate_typescript_types` tool.
// Do not edit by hand.
//
// EXCEPCIÓN TEMPORAL: las seis tablas `quote_*` del Cotizador se
// escribieron a mano a partir de
// supabase/migrations/20261013130000_fase1_cotizador.sql, porque la
// migración se aplica desde el SQL Editor. Al regenerar este archivo
// después de aplicarla, este aviso desaparece solo.

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
          invited_at: string | null
          invited_by: string | null
          modules: string[]
          note: string | null
          role: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          invited_at?: string | null
          invited_by?: string | null
          modules?: string[]
          note?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          invited_at?: string | null
          invited_by?: string | null
          modules?: string[]
          note?: string | null
          role?: string
          updated_at?: string
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
      contractor_helpers: {
        Row: {
          bank_account_number: string | null
          bank_account_type: string | null
          bank_name: string | null
          contractor_id: string
          created_at: string
          id: string
          id_document: string | null
          name: string
          notes: string | null
          phone: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          contractor_id: string
          created_at?: string
          id?: string
          id_document?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          contractor_id?: string
          created_at?: string
          id?: string
          id_document?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_helpers_contractor_id_fkey"
            columns: ["contractor_id"]
            isOneToOne: false
            referencedRelation: "contractors"
            referencedColumns: ["id"]
          },
        ]
      }
      contractor_ledger_entry_items: {
        Row: {
          cantidad: number
          created_at: string
          descripcion: string
          detalle: string | null
          fase: string | null
          id: string
          labor_rate_id: string | null
          ledger_entry_id: string
          precio_unitario_cents: number
          subtotal_cents: number
          unidad: string
        }
        Insert: {
          cantidad: number
          created_at?: string
          descripcion: string
          detalle?: string | null
          fase?: string | null
          id?: string
          labor_rate_id?: string | null
          ledger_entry_id: string
          precio_unitario_cents: number
          subtotal_cents: number
          unidad: string
        }
        Update: {
          cantidad?: number
          created_at?: string
          descripcion?: string
          detalle?: string | null
          fase?: string | null
          id?: string
          labor_rate_id?: string | null
          ledger_entry_id?: string
          precio_unitario_cents?: number
          subtotal_cents?: number
          unidad?: string
        }
        Relationships: [
          {
            foreignKeyName: "contractor_ledger_entry_items_labor_rate_id_fkey"
            columns: ["labor_rate_id"]
            isOneToOne: false
            referencedRelation: "labor_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contractor_ledger_entry_items_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "contractor_ledger_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      contractors: {
        Row: {
          bank_account_number: string | null
          bank_account_type: string | null
          bank_name: string | null
          bank_routing_code: string | null
          birth_date: string | null
          contact_info: string | null
          contract_info: string | null
          contractor_type: string
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          end_date: string | null
          id: string
          id_document: string | null
          id_document_type: string | null
          name: string
          nationality: string | null
          notes: string | null
          phone: string | null
          photo_path: string | null
          sort_order: number
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          bank_routing_code?: string | null
          birth_date?: string | null
          contact_info?: string | null
          contract_info?: string | null
          contractor_type: string
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          end_date?: string | null
          id?: string
          id_document?: string | null
          id_document_type?: string | null
          name: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          photo_path?: string | null
          sort_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          bank_routing_code?: string | null
          birth_date?: string | null
          contact_info?: string | null
          contract_info?: string | null
          contractor_type?: string
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          end_date?: string | null
          id?: string
          id_document?: string | null
          id_document_type?: string | null
          name?: string
          nationality?: string | null
          notes?: string | null
          phone?: string | null
          photo_path?: string | null
          sort_order?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      labor_rates: {
        Row: {
          activo: boolean
          contractor_type: string
          created_at: string
          descripcion: string
          fase: string | null
          id: string
          orden: number
          precio_cents: number
          unidad: string
          updated_at: string
        }
        Insert: {
          activo?: boolean
          contractor_type: string
          created_at?: string
          descripcion: string
          fase?: string | null
          id?: string
          orden?: number
          precio_cents: number
          unidad: string
          updated_at?: string
        }
        Update: {
          activo?: boolean
          contractor_type?: string
          created_at?: string
          descripcion?: string
          fase?: string | null
          id?: string
          orden?: number
          precio_cents?: number
          unidad?: string
          updated_at?: string
        }
        Relationships: []
      }
      payroll_employees: {
        Row: {
          bank_account_number: string | null
          bank_account_type: string | null
          bank_name: string | null
          bank_routing_code: string | null
          base_salary_cents: number
          benefits_base_salary_cents: number | null
          benefits_enabled: boolean
          benefits_external_company: string | null
          categoria: string
          contract_info: string | null
          created_at: string
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          end_date: string | null
          id: string
          id_document: string | null
          id_document_type: string | null
          liquidation_notes: string | null
          name: string
          nationality: string | null
          notes: string | null
          phone: string | null
          photo_path: string | null
          birth_date: string | null
          position: string | null
          sort_order: number
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          bank_routing_code?: string | null
          base_salary_cents?: number
          benefits_base_salary_cents?: number | null
          benefits_enabled?: boolean
          benefits_external_company?: string | null
          categoria?: string
          contract_info?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          end_date?: string | null
          id?: string
          id_document?: string | null
          id_document_type?: string | null
          nationality?: string | null
          photo_path?: string | null
          birth_date?: string | null
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
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_name?: string | null
          bank_routing_code?: string | null
          base_salary_cents?: number
          benefits_base_salary_cents?: number | null
          benefits_enabled?: boolean
          benefits_external_company?: string | null
          categoria?: string
          contract_info?: string | null
          created_at?: string
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          end_date?: string | null
          id?: string
          id_document?: string | null
          id_document_type?: string | null
          nationality?: string | null
          photo_path?: string | null
          birth_date?: string | null
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
      payroll_indrive_rides: {
        Row: {
          amount_cents: number
          charge: boolean
          created_at: string
          debt_ledger_id: string | null
          employee_id: string
          id: string
          notes: string | null
          payment_ledger_id: string | null
          ride_date: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          charge?: boolean
          created_at?: string
          debt_ledger_id?: string | null
          employee_id: string
          id?: string
          notes?: string | null
          payment_ledger_id?: string | null
          ride_date: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          charge?: boolean
          created_at?: string
          debt_ledger_id?: string | null
          employee_id?: string
          id?: string
          notes?: string | null
          payment_ledger_id?: string | null
          ride_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_indrive_rides_employee_id_fkey"
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
          interest_cents: number
          interest_mode: string | null
          interest_rate_pct: number | null
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
          interest_cents?: number
          interest_mode?: string | null
          interest_rate_pct?: number | null
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
          interest_cents?: number
          interest_mode?: string | null
          interest_rate_pct?: number | null
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
      payroll_positions: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
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
          last_sign_in_at: string | null
          modules: string[]
          role: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          last_sign_in_at?: string | null
          modules?: string[]
          role?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          last_sign_in_at?: string | null
          modules?: string[]
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
      quote_catalog_items: {
        Row: {
          active: boolean
          category: string
          code: string
          created_at: string
          finish: string | null
          id: string
          name: string
          price: number
          shape: string
          sort_order: number
          unit: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          code: string
          created_at?: string
          finish?: string | null
          id?: string
          name: string
          price: number
          shape?: string
          sort_order?: number
          unit: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          code?: string
          created_at?: string
          finish?: string | null
          id?: string
          name?: string
          price?: number
          shape?: string
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      quote_cost_inputs: {
        Row: {
          key: string
          kind: string
          label: string
          sort_order: number
          unit: string
          updated_at: string
          value: number
        }
        Insert: {
          key: string
          kind: string
          label: string
          sort_order?: number
          unit: string
          updated_at?: string
          value: number
        }
        Update: {
          key?: string
          kind?: string
          label?: string
          sort_order?: number
          unit?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      quote_item_recipes: {
        Row: {
          base_m2: number
          edge_key: string
          edge_ml: number
          fixed: number
          fixed_label: string | null
          hardware_base: string
          hardware_pct: number
          item_id: string
          labor: number
          paint: Json
          sheet_key: string
          updated_at: string
          usable_m2: number
        }
        Insert: {
          base_m2?: number
          edge_key: string
          edge_ml?: number
          fixed?: number
          fixed_label?: string | null
          hardware_base?: string
          hardware_pct?: number
          item_id: string
          labor?: number
          paint?: Json
          sheet_key: string
          updated_at?: string
          usable_m2?: number
        }
        Update: {
          base_m2?: number
          edge_key?: string
          edge_ml?: number
          fixed?: number
          fixed_label?: string | null
          hardware_base?: string
          hardware_pct?: number
          item_id?: string
          labor?: number
          paint?: Json
          sheet_key?: string
          updated_at?: string
          usable_m2?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_item_recipes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "quote_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_item_recipes_sheet_key_fkey"
            columns: ["sheet_key"]
            isOneToOne: false
            referencedRelation: "quote_cost_inputs"
            referencedColumns: ["key"]
          },
          {
            foreignKeyName: "quote_item_recipes_edge_key_fkey"
            columns: ["edge_key"]
            isOneToOne: false
            referencedRelation: "quote_cost_inputs"
            referencedColumns: ["key"]
          },
        ]
      }
      quote_lines: {
        Row: {
          category: string
          created_at: string
          finish: string | null
          height: number
          host_line_id: string | null
          id: string
          item_id: string | null
          mode: string
          name: string
          pieces: number
          pos_x: number | null
          pos_y: number | null
          price_overridden: boolean
          qty: number
          section_id: string
          shape: string
          sort_order: number
          unit: string
          unit_price: number
          updated_at: string
          wall: string | null
          width: number
        }
        Insert: {
          category: string
          created_at?: string
          finish?: string | null
          height?: number
          host_line_id?: string | null
          id?: string
          item_id?: string | null
          mode?: string
          name?: string
          pieces?: number
          pos_x?: number | null
          pos_y?: number | null
          price_overridden?: boolean
          qty?: number
          section_id: string
          shape?: string
          sort_order?: number
          unit: string
          unit_price?: number
          updated_at?: string
          wall?: string | null
          width?: number
        }
        Update: {
          category?: string
          created_at?: string
          finish?: string | null
          height?: number
          host_line_id?: string | null
          id?: string
          item_id?: string | null
          mode?: string
          name?: string
          pieces?: number
          pos_x?: number | null
          pos_y?: number | null
          price_overridden?: boolean
          qty?: number
          section_id?: string
          shape?: string
          sort_order?: number
          unit?: string
          unit_price?: number
          updated_at?: string
          wall?: string | null
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_lines_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "quote_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "quote_catalog_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_lines_host_line_id_fkey"
            columns: ["host_line_id"]
            isOneToOne: false
            referencedRelation: "quote_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_sections: {
        Row: {
          ccf_pct: number
          commission_pct: number
          corner_at: number | null
          created_at: string
          description: string
          design_3d: number
          extra_labor: number
          freight: number
          id: string
          kind: string
          location: string
          name: string
          quote_id: string
          sort_order: number
          sub_margin_pct: number
          updated_at: string
          util_pct: number
          wall_shape: string
          waste_pct: number
          waste_sheet_price: number
          waste_sheets: number
        }
        Insert: {
          ccf_pct?: number
          commission_pct?: number
          corner_at?: number | null
          created_at?: string
          description?: string
          design_3d?: number
          extra_labor?: number
          freight?: number
          id?: string
          kind?: string
          location?: string
          name?: string
          quote_id: string
          sort_order?: number
          sub_margin_pct?: number
          updated_at?: string
          util_pct?: number
          wall_shape?: string
          waste_pct?: number
          waste_sheet_price?: number
          waste_sheets?: number
        }
        Update: {
          ccf_pct?: number
          commission_pct?: number
          corner_at?: number | null
          created_at?: string
          description?: string
          design_3d?: number
          extra_labor?: number
          freight?: number
          id?: string
          kind?: string
          location?: string
          name?: string
          quote_id?: string
          sort_order?: number
          sub_margin_pct?: number
          updated_at?: string
          util_pct?: number
          wall_shape?: string
          waste_pct?: number
          waste_sheet_price?: number
          waste_sheets?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_sections_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          client_name: string
          created_at: string
          created_by: string | null
          delivery_days: number
          designer_name: string
          discount_type: string
          discount_value: number
          id: string
          itbms_pct: number
          lang: string
          notes: string
          number: string
          pdf_detail: string
          project_id: string | null
          project_name: string
          quote_date: string
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          client_name?: string
          created_at?: string
          created_by?: string | null
          delivery_days?: number
          designer_name?: string
          discount_type?: string
          discount_value?: number
          id?: string
          itbms_pct?: number
          lang?: string
          notes?: string
          number?: string
          pdf_detail?: string
          project_id?: string | null
          project_name?: string
          quote_date?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          client_name?: string
          created_at?: string
          created_by?: string | null
          delivery_days?: number
          designer_name?: string
          discount_type?: string
          discount_value?: number
          id?: string
          itbms_pct?: number
          lang?: string
          notes?: string
          number?: string
          pdf_detail?: string
          project_id?: string | null
          project_name?: string
          quote_date?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
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
