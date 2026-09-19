export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      business_hours: {
        Row: {
          break_end: string | null
          break_start: string | null
          created_at: string
          end_time: string | null
          id: string
          is_working_day: boolean
          organization_id: string
          start_time: string | null
          updated_at: string
          weekday: number
        }
        Insert: {
          break_end?: string | null
          break_start?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          is_working_day?: boolean
          organization_id: string
          start_time?: string | null
          updated_at?: string
          weekday: number
        }
        Update: {
          break_end?: string | null
          break_start?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          is_working_day?: boolean
          organization_id?: string
          start_time?: string | null
          updated_at?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "business_hours_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      client_addresses: {
        Row: {
          client_id: string
          created_at: string
          id: string
          is_default: boolean
          label: string | null
          locality: string | null
          notes: string | null
          organization_id: string
          postal_code: string | null
          province: string | null
          street: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          locality?: string | null
          notes?: string | null
          organization_id: string
          postal_code?: string | null
          province?: string | null
          street?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          label?: string | null
          locality?: string | null
          notes?: string | null
          organization_id?: string
          postal_code?: string | null
          province?: string | null
          street?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_addresses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "client_addresses_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_addresses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active: boolean
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          tax_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          tax_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_expense_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          organization_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          organization_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_expense_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_expenses: {
        Row: {
          amount: number
          category_id: string
          client_request_id: string
          created_at: string
          created_by: string | null
          description: string
          expense_date: string
          id: string
          job_id: string
          organization_id: string
          receipt_path: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          category_id: string
          client_request_id: string
          created_at?: string
          created_by?: string | null
          description: string
          expense_date: string
          id?: string
          job_id: string
          organization_id: string
          receipt_path?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          category_id?: string
          client_request_id?: string
          created_at?: string
          created_by?: string | null
          description?: string
          expense_date?: string
          id?: string
          job_id?: string
          organization_id?: string
          receipt_path?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "job_expense_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_expenses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_expenses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_economics_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_expenses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_financial_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_expenses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_labor_costs"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_expenses_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_expenses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_materials: {
        Row: {
          actual_quantity: number | null
          created_at: string
          estimated_quantity: number
          id: string
          job_id: string
          material_id: string
          notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          actual_quantity?: number | null
          created_at?: string
          estimated_quantity: number
          id?: string
          job_id: string
          material_id: string
          notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          actual_quantity?: number | null
          created_at?: string
          estimated_quantity?: number
          id?: string
          job_id?: string
          material_id?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_economics_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_financial_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_labor_costs"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "material_valuation"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "job_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_materials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_payments: {
        Row: {
          amount: number
          client_request_id: string
          created_at: string
          created_by: string | null
          id: string
          job_id: string
          notes: string | null
          organization_id: string
          payment_account_id: string | null
          payment_date: string
          payment_method_id: string
          receipt_path: string | null
          reference: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          client_request_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_id: string
          notes?: string | null
          organization_id: string
          payment_account_id?: string | null
          payment_date: string
          payment_method_id: string
          receipt_path?: string | null
          reference?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          client_request_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string
          notes?: string | null
          organization_id?: string
          payment_account_id?: string | null
          payment_date?: string
          payment_method_id?: string
          receipt_path?: string | null
          reference?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_economics_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_financial_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_labor_costs"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_payments_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_payments_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_payments_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
        ]
      }
      job_session_labor_costs: {
        Row: {
          captured_at: string
          created_at: string
          hourly_cost_snapshot: number
          id: string
          job_session_id: string
          labor_rate_id: string | null
          organization_id: string
          organization_member_id: string
          updated_at: string
        }
        Insert: {
          captured_at?: string
          created_at?: string
          hourly_cost_snapshot: number
          id?: string
          job_session_id: string
          labor_rate_id?: string | null
          organization_id: string
          organization_member_id: string
          updated_at?: string
        }
        Update: {
          captured_at?: string
          created_at?: string
          hourly_cost_snapshot?: number
          id?: string
          job_session_id?: string
          labor_rate_id?: string | null
          organization_id?: string
          organization_member_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_session_labor_costs_job_session_id_fkey"
            columns: ["job_session_id"]
            isOneToOne: true
            referencedRelation: "job_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_session_labor_costs_labor_rate_id_fkey"
            columns: ["labor_rate_id"]
            isOneToOne: false
            referencedRelation: "member_labor_rates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_session_labor_costs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_session_labor_costs_organization_member_id_fkey"
            columns: ["organization_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
        ]
      }
      job_sessions: {
        Row: {
          actual_end_at: string | null
          actual_start_at: string | null
          assigned_member_id: string | null
          client_request_id: string | null
          created_at: string
          id: string
          job_id: string
          notes: string | null
          organization_id: string
          planned_end_at: string
          planned_start_at: string
          status: string
          updated_at: string
        }
        Insert: {
          actual_end_at?: string | null
          actual_start_at?: string | null
          assigned_member_id?: string | null
          client_request_id?: string | null
          created_at?: string
          id?: string
          job_id: string
          notes?: string | null
          organization_id: string
          planned_end_at: string
          planned_start_at: string
          status?: string
          updated_at?: string
        }
        Update: {
          actual_end_at?: string | null
          actual_start_at?: string | null
          assigned_member_id?: string | null
          client_request_id?: string | null
          created_at?: string
          id?: string
          job_id?: string
          notes?: string | null
          organization_id?: string
          planned_end_at?: string
          planned_start_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_sessions_assigned_member_id_fkey"
            columns: ["assigned_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sessions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_sessions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_economics_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_sessions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_financial_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_sessions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_labor_costs"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_sessions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          from_status_id: string | null
          id: string
          job_id: string
          organization_id: string
          to_status_id: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          from_status_id?: string | null
          id?: string
          job_id: string
          organization_id: string
          to_status_id: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          from_status_id?: string | null
          id?: string
          job_id?: string
          organization_id?: string
          to_status_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_status_history_from_status_id_fkey"
            columns: ["from_status_id"]
            isOneToOne: false
            referencedRelation: "job_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_status_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_status_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_economics_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_status_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_financial_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_status_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_labor_costs"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_status_history_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_status_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_status_history_to_status_id_fkey"
            columns: ["to_status_id"]
            isOneToOne: false
            referencedRelation: "job_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      job_statuses: {
        Row: {
          active: boolean
          created_at: string
          id: string
          is_closed: boolean
          name: string
          organization_id: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          is_closed?: boolean
          name: string
          organization_id: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          is_closed?: boolean
          name?: string
          organization_id?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_statuses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_types: {
        Row: {
          active: boolean
          created_at: string
          default_estimated_minutes: number | null
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_estimated_minutes?: number | null
          description?: string | null
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_estimated_minutes?: number | null
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_types_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          assigned_member_id: string | null
          client_address_id: string | null
          client_id: string
          created_at: string
          description: string | null
          estimated_minutes: number | null
          id: string
          job_type_id: string | null
          notes: string | null
          organization_id: string
          priority: string
          status_id: string
          target_date: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_member_id?: string | null
          client_address_id?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          job_type_id?: string | null
          notes?: string | null
          organization_id: string
          priority?: string
          status_id: string
          target_date?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_member_id?: string | null
          client_address_id?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          estimated_minutes?: number | null
          id?: string
          job_type_id?: string | null
          notes?: string | null
          organization_id?: string
          priority?: string
          status_id?: string
          target_date?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_assigned_member_id_fkey"
            columns: ["assigned_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_client_address_id_fkey"
            columns: ["client_address_id"]
            isOneToOne: false
            referencedRelation: "client_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_job_type_id_fkey"
            columns: ["job_type_id"]
            isOneToOne: false
            referencedRelation: "job_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "job_statuses"
            referencedColumns: ["id"]
          },
        ]
      }
      material_categories: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          organization_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      material_inventory_valuation: {
        Row: {
          initialized_at: string
          inventory_value: number
          material_id: string
          organization_id: string
          quantity: number
          updated_at: string
        }
        Insert: {
          initialized_at?: string
          inventory_value: number
          material_id: string
          organization_id: string
          quantity: number
          updated_at?: string
        }
        Update: {
          initialized_at?: string
          inventory_value?: number
          material_id?: string
          organization_id?: string
          quantity?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_inventory_valuation_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "material_valuation"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "material_inventory_valuation_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: true
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_inventory_valuation_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      material_units: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          organization_id: string
          symbol: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          organization_id: string
          symbol: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          symbol?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_units_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      material_valuation_events: {
        Row: {
          created_at: string
          created_by: string | null
          event_type: string
          id: string
          material_id: string
          notes: string | null
          organization_id: string
          quantity: number
          total_value: number
          unit_cost: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          event_type: string
          id?: string
          material_id: string
          notes?: string | null
          organization_id: string
          quantity: number
          total_value: number
          unit_cost: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          event_type?: string
          id?: string
          material_id?: string
          notes?: string | null
          organization_id?: string
          quantity?: number
          total_value?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "material_valuation_events_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "material_valuation"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "material_valuation_events_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_valuation_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      materials: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          minimum_stock: number
          name: string
          organization_id: string
          sku: string | null
          unit_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          minimum_stock?: number
          name: string
          organization_id: string
          sku?: string | null
          unit_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          minimum_stock?: number
          name?: string
          organization_id?: string
          sku?: string | null
          unit_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "materials_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "material_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "materials_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "material_units"
            referencedColumns: ["id"]
          },
        ]
      }
      member_labor_rates: {
        Row: {
          created_at: string
          created_by: string | null
          hourly_cost: number
          id: string
          notes: string | null
          organization_id: string
          organization_member_id: string
          updated_at: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          hourly_cost: number
          id?: string
          notes?: string | null
          organization_id: string
          organization_member_id: string
          updated_at?: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          hourly_cost?: number
          id?: string
          notes?: string | null
          organization_id?: string
          organization_member_id?: string
          updated_at?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_labor_rates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "member_labor_rates_organization_member_id_fkey"
            columns: ["organization_member_id"]
            isOneToOne: false
            referencedRelation: "organization_members"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          active: boolean
          created_at: string
          id: string
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          organization_id: string
          role: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          currency: string
          id: string
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          name: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_accounts: {
        Row: {
          account_type: string
          active: boolean
          alias: string | null
          bank_name: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
          organization_id: string
          updated_at: string
        }
        Insert: {
          account_type: string
          active?: boolean
          alias?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          updated_at?: string
        }
        Update: {
          account_type?: string
          active?: boolean
          alias?: string | null
          bank_name?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_accounts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          organization_id: string
          requires_account: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          organization_id: string
          requires_account?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
          requires_account?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_methods_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_counters: {
        Row: {
          next_number: number
          organization_id: string
        }
        Insert: {
          next_number?: number
          organization_id: string
        }
        Update: {
          next_number?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_items: {
        Row: {
          created_at: string
          id: string
          material_id: string
          notes: string | null
          organization_id: string
          purchase_id: string
          quantity: number
          sort_order: number
          subtotal: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          material_id: string
          notes?: string | null
          organization_id: string
          purchase_id: string
          quantity: number
          sort_order?: number
          subtotal?: number
          unit_cost: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          material_id?: string
          notes?: string | null
          organization_id?: string
          purchase_id?: string
          quantity?: number
          sort_order?: number
          subtotal?: number
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "material_valuation"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          cancelled_at: string | null
          client_request_id: string | null
          created_at: string
          created_by: string | null
          document_path: string | null
          id: string
          notes: string | null
          organization_id: string
          purchase_date: string
          purchase_number: string
          received_at: string | null
          received_by: string | null
          source_job_id: string | null
          status: string
          subtotal: number
          supplier_id: string
          total: number
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          document_path?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          purchase_date: string
          purchase_number: string
          received_at?: string | null
          received_by?: string | null
          source_job_id?: string | null
          status?: string
          subtotal?: number
          supplier_id: string
          total?: number
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          client_request_id?: string | null
          created_at?: string
          created_by?: string | null
          document_path?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          purchase_date?: string
          purchase_number?: string
          received_at?: string | null
          received_by?: string | null
          source_job_id?: string | null
          status?: string
          subtotal?: number
          supplier_id?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchases_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_source_job_id_fkey"
            columns: ["source_job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "purchases_source_job_id_fkey"
            columns: ["source_job_id"]
            isOneToOne: false
            referencedRelation: "job_economics_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "purchases_source_job_id_fkey"
            columns: ["source_job_id"]
            isOneToOne: false
            referencedRelation: "job_financial_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "purchases_source_job_id_fkey"
            columns: ["source_job_id"]
            isOneToOne: false
            referencedRelation: "job_labor_costs"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "purchases_source_job_id_fkey"
            columns: ["source_job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_counters: {
        Row: {
          next_number: number
          organization_id: string
        }
        Insert: {
          next_number?: number
          organization_id: string
        }
        Update: {
          next_number?: number
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_counters_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          cost_unit_price: number | null
          created_at: string
          description: string
          id: string
          item_type: string
          material_id: string | null
          organization_id: string
          quantity: number
          quote_id: string
          sale_unit_price: number
          sort_order: number
          unit: string
          updated_at: string
        }
        Insert: {
          cost_unit_price?: number | null
          created_at?: string
          description: string
          id?: string
          item_type: string
          material_id?: string | null
          organization_id: string
          quantity: number
          quote_id: string
          sale_unit_price: number
          sort_order?: number
          unit: string
          updated_at?: string
        }
        Update: {
          cost_unit_price?: number | null
          created_at?: string
          description?: string
          id?: string
          item_type?: string
          material_id?: string | null
          organization_id?: string
          quantity?: number
          quote_id?: string
          sale_unit_price?: number
          sort_order?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "material_valuation"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "quote_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "job_financial_status"
            referencedColumns: ["accepted_quote_id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          accepted_at: string | null
          client_id: string
          created_at: string
          created_by: string | null
          discount_amount: number
          id: string
          issue_date: string
          job_id: string
          notes: string | null
          organization_id: string
          quote_number: string
          rejected_at: string | null
          sent_at: string | null
          status: string
          subtotal: number
          terms: string | null
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          id?: string
          issue_date?: string
          job_id: string
          notes?: string | null
          organization_id: string
          quote_number: string
          rejected_at?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          terms?: string | null
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          id?: string
          issue_date?: string
          job_id?: string
          notes?: string | null
          organization_id?: string
          quote_number?: string
          rejected_at?: string | null
          sent_at?: string | null
          status?: string
          subtotal?: number
          terms?: string | null
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_financial_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "quotes_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "quotes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_economics_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "quotes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_financial_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "quotes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_labor_costs"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "quotes_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          job_id: string | null
          material_id: string
          movement_type: string
          notes: string | null
          organization_id: string
          purchase_id: string | null
          purchase_item_id: string | null
          quantity: number
          reversal_of_movement_id: string | null
          total_cost: number | null
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string | null
          material_id: string
          movement_type: string
          notes?: string | null
          organization_id: string
          purchase_id?: string | null
          purchase_item_id?: string | null
          quantity: number
          reversal_of_movement_id?: string | null
          total_cost?: number | null
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          job_id?: string | null
          material_id?: string
          movement_type?: string
          notes?: string | null
          organization_id?: string
          purchase_id?: string | null
          purchase_item_id?: string | null
          quantity?: number
          reversal_of_movement_id?: string | null
          total_cost?: number | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "stock_movements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_economics_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "stock_movements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_financial_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "stock_movements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_labor_costs"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "stock_movements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "material_valuation"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_purchase_item_id_fkey"
            columns: ["purchase_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_reversal_of_movement_id_fkey"
            columns: ["reversal_of_movement_id"]
            isOneToOne: false
            referencedRelation: "stock_movements"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_material_prices: {
        Row: {
          created_at: string
          created_by: string | null
          currency: string
          id: string
          material_id: string
          notes: string | null
          organization_id: string
          price: number
          recorded_at: string
          supplier_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          material_id: string
          notes?: string | null
          organization_id: string
          price: number
          recorded_at?: string
          supplier_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          material_id?: string
          notes?: string | null
          organization_id?: string
          price?: number
          recorded_at?: string
          supplier_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_material_prices_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "material_valuation"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "supplier_material_prices_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_material_prices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_material_prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          active: boolean
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      client_financial_summary: {
        Row: {
          client_id: string | null
          collected_amount: number | null
          contracted_amount: number | null
          organization_id: string | null
          outstanding_amount: number | null
          uncontracted_collections: number | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_cost_status: {
        Row: {
          actual_material_cost: number | null
          collected_amount: number | null
          contracted_amount: number | null
          estimated_material_cost: number | null
          job_id: string | null
          material_cost_complete: boolean | null
          material_cost_variance: number | null
          organization_id: string | null
          outstanding_amount: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_economics_status: {
        Row: {
          actual_direct_cost: number | null
          actual_labor_cost: number | null
          actual_material_cost: number | null
          actual_minutes: number | null
          collected_amount: number | null
          contracted_amount: number | null
          contribution_amount: number | null
          contribution_percentage: number | null
          direct_cost_data_complete: boolean | null
          direct_expense_count: number | null
          direct_expense_total: number | null
          estimated_material_cost: number | null
          job_id: string | null
          job_is_closed: boolean | null
          labor_cost_complete: boolean | null
          labor_sessions_count: number | null
          material_cost_complete: boolean | null
          organization_id: string | null
          outstanding_amount: number | null
          recorded_direct_cost: number | null
          sessions_missing_member: number | null
          sessions_missing_rate: number | null
          sessions_missing_time: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_financial_status: {
        Row: {
          accepted_quote_id: string | null
          collected_amount: number | null
          contracted_amount: number | null
          job_id: string | null
          last_payment_date: string | null
          organization_id: string | null
          outstanding_amount: number | null
          overpaid_amount: number | null
          payment_status: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_labor_costs: {
        Row: {
          actual_labor_cost: number | null
          actual_minutes: number | null
          job_id: string | null
          labor_cost_complete: boolean | null
          labor_sessions_count: number | null
          organization_id: string | null
          sessions_missing_member: number | null
          sessions_missing_rate: number | null
          sessions_missing_time: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_material_costs: {
        Row: {
          cost_complete: boolean | null
          job_id: string | null
          material_id: string | null
          net_cost: number | null
          net_quantity: number | null
          organization_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "stock_movements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_economics_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "stock_movements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_financial_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "stock_movements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_labor_costs"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "stock_movements_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "material_valuation"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_material_status: {
        Row: {
          consumed_quantity: number | null
          current_stock: number | null
          estimated_quantity: number | null
          job_id: string | null
          job_material_id: string | null
          material_id: string | null
          missing_quantity: number | null
          organization_id: string | null
          remaining_quantity: number | null
          variance_quantity: number | null
        }
        Relationships: [
          {
            foreignKeyName: "job_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_cost_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_economics_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_financial_status"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "job_labor_costs"
            referencedColumns: ["job_id"]
          },
          {
            foreignKeyName: "job_materials_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "material_valuation"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "job_materials_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_materials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_type_contribution: {
        Row: {
          contracted_total: number | null
          contribution_total: number | null
          direct_cost_total: number | null
          job_type_id: string | null
          jobs_count: number | null
          organization_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_job_type_id_fkey"
            columns: ["job_type_id"]
            isOneToOne: false
            referencedRelation: "job_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_type_material_performance: {
        Row: {
          actual_material_cost_total: number | null
          estimated_material_cost_total: number | null
          job_type_id: string | null
          jobs_count: number | null
          organization_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_job_type_id_fkey"
            columns: ["job_type_id"]
            isOneToOne: false
            referencedRelation: "job_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      job_type_time_performance: {
        Row: {
          actual_minutes_total: number | null
          closed_jobs_count: number | null
          estimated_minutes_total: number | null
          job_type_id: string | null
          jobs_count: number | null
          organization_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_job_type_id_fkey"
            columns: ["job_type_id"]
            isOneToOne: false
            referencedRelation: "job_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      material_latest_prices: {
        Row: {
          currency: string | null
          material_id: string | null
          organization_id: string | null
          price: number | null
          recorded_at: string | null
          supplier_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_material_prices_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "material_valuation"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "supplier_material_prices_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_material_prices_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "supplier_material_prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      material_latest_purchases: {
        Row: {
          material_id: string | null
          organization_id: string | null
          purchase_date: string | null
          purchase_number: string | null
          supplier_id: string | null
          unit_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "material_valuation"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "purchase_items_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      material_stock_balances: {
        Row: {
          current_stock: number | null
          material_id: string | null
          organization_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "material_valuation"
            referencedColumns: ["material_id"]
          },
          {
            foreignKeyName: "stock_movements_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      material_valuation: {
        Row: {
          average_cost: number | null
          current_stock: number | null
          inventory_value: number | null
          material_id: string | null
          needs_initialization: boolean | null
          organization_id: string | null
          valuation_initialized: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "materials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      backfill_session_labor_costs: {
        Args: { p_member_id?: string; p_organization_id: string }
        Returns: number
      }
      bootstrap_organization: { Args: { org_name: string }; Returns: string }
      cancel_purchase: { Args: { p_purchase_id: string }; Returns: undefined }
      capture_session_labor_cost: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      create_job_session: {
        Args: {
          p_assigned_member_id?: string
          p_client_request_id: string
          p_job_id: string
          p_notes?: string
          p_planned_end_at: string
          p_planned_start_at: string
        }
        Returns: string
      }
      create_purchase: {
        Args: {
          p_client_request_id: string
          p_notes?: string
          p_purchase_date: string
          p_source_job_id?: string
          p_supplier_id: string
        }
        Returns: string
      }
      create_quote: {
        Args: { p_client_id: string; p_job_id: string }
        Returns: string
      }
      delete_member_labor_rate: {
        Args: { p_rate_id: string }
        Returns: undefined
      }
      generate_org_slug: { Args: { base_name: string }; Returns: string }
      initialize_material_valuation: {
        Args: { p_material_id: string; p_notes?: string; p_unit_cost: number }
        Returns: undefined
      }
      is_org_admin: { Args: { org_id: string }; Returns: boolean }
      is_org_member: { Args: { org_id: string }; Returns: boolean }
      is_org_operator: { Args: { org_id: string }; Returns: boolean }
      reassign_session_member: {
        Args: { p_member_id: string; p_session_id: string }
        Returns: string
      }
      recalc_purchase_totals: {
        Args: { p_purchase_id: string }
        Returns: undefined
      }
      recalc_quote_totals: { Args: { p_quote_id: string }; Returns: undefined }
      receive_purchase: { Args: { p_purchase_id: string }; Returns: string }
      register_job_expense: {
        Args: {
          p_amount: number
          p_category_id: string
          p_client_request_id: string
          p_description: string
          p_expense_date: string
          p_job_id: string
          p_receipt_path?: string
        }
        Returns: string
      }
      register_job_material_consumption: {
        Args: { p_actual_quantity: number; p_job_material_id: string }
        Returns: undefined
      }
      register_job_payment: {
        Args: {
          p_amount: number
          p_client_request_id: string
          p_job_id: string
          p_notes?: string
          p_payment_account_id?: string
          p_payment_date: string
          p_payment_method_id: string
          p_receipt_path?: string
          p_reference?: string
        }
        Returns: string
      }
      resolve_labor_rate: {
        Args: { p_date: string; p_member_id: string }
        Returns: {
          hourly_cost: number
          rate_id: string
        }[]
      }
      set_member_labor_rate: {
        Args: {
          p_hourly_cost: number
          p_member_id: string
          p_notes?: string
          p_valid_from: string
        }
        Returns: string
      }
      shares_organization_with: {
        Args: { target_user_id: string }
        Returns: boolean
      }
      unaccent: { Args: { "": string }; Returns: string }
      void_job_expense: {
        Args: { p_expense_id: string; p_void_reason: string }
        Returns: undefined
      }
      void_job_payment: {
        Args: { p_payment_id: string; p_void_reason: string }
        Returns: undefined
      }
      weekday_workload: {
        Args: { p_from: string; p_organization_id: string; p_to: string }
        Returns: {
          average_minutes: number
          days_in_period: number
          total_minutes: number
          weekday: number
        }[]
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

