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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      brands: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      department_answer_history: {
        Row: {
          answer_id: string
          changed_at: string
          changed_by: string | null
          department_id: string
          id: string
          new_value: string | null
          previous_value: string | null
          question_id: string
        }
        Insert: {
          answer_id: string
          changed_at?: string
          changed_by?: string | null
          department_id: string
          id?: string
          new_value?: string | null
          previous_value?: string | null
          question_id: string
        }
        Update: {
          answer_id?: string
          changed_at?: string
          changed_by?: string | null
          department_id?: string
          id?: string
          new_value?: string | null
          previous_value?: string | null
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_answer_history_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "department_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_answer_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_answer_history_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_answer_history_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "department_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      department_answers: {
        Row: {
          answer_value: string | null
          department_id: string
          id: string
          question_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          answer_value?: string | null
          department_id: string
          id?: string
          question_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          answer_value?: string | null
          department_id?: string
          id?: string
          question_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "department_answers_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "department_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "department_answers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      department_forecasts: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          forecast_year: number
          id: string
          name: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          forecast_year: number
          id?: string
          name?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          forecast_year?: number
          id?: string
          name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "department_forecasts_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      department_questions: {
        Row: {
          answer_description: string | null
          answer_type: string
          created_at: string
          display_order: number
          id: string
          is_active: boolean
          question_category: string
          question_text: string
          reference_image_url: string | null
          updated_at: string
        }
        Insert: {
          answer_description?: string | null
          answer_type?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          question_category: string
          question_text: string
          reference_image_url?: string | null
          updated_at?: string
        }
        Update: {
          answer_description?: string | null
          answer_type?: string
          created_at?: string
          display_order?: number
          id?: string
          is_active?: boolean
          question_category?: string
          question_text?: string
          reference_image_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      department_types: {
        Row: {
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          created_at: string
          department_type_id: string | null
          id: string
          manager_id: string | null
          name: string
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_type_id?: string | null
          id?: string
          manager_id?: string | null
          name: string
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_type_id?: string | null
          id?: string
          manager_id?: string | null
          name?: string
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_department_type_id_fkey"
            columns: ["department_type_id"]
            isOneToOne: false
            referencedRelation: "department_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "departments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      director_notes: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          id: string
          notes: string | null
          period_date: string
          period_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          id?: string
          notes?: string | null
          period_date: string
          period_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          id?: string
          notes?: string | null
          period_date?: string
          period_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "director_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "director_notes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      enterprise_filters: {
        Row: {
          created_at: string
          date_period_type: string | null
          filter_mode: string
          id: string
          metric_type: string
          name: string
          selected_brand_ids: string[] | null
          selected_department_names: string[] | null
          selected_group_ids: string[] | null
          selected_metrics: string[] | null
          selected_store_ids: string[] | null
          selected_year: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date_period_type?: string | null
          filter_mode?: string
          id?: string
          metric_type?: string
          name: string
          selected_brand_ids?: string[] | null
          selected_department_names?: string[] | null
          selected_group_ids?: string[] | null
          selected_metrics?: string[] | null
          selected_store_ids?: string[] | null
          selected_year?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date_period_type?: string | null
          filter_mode?: string
          id?: string
          metric_type?: string
          name?: string
          selected_brand_ids?: string[] | null
          selected_department_names?: string[] | null
          selected_group_ids?: string[] | null
          selected_metrics?: string[] | null
          selected_store_ids?: string[] | null
          selected_year?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      financial_attachments: {
        Row: {
          created_at: string
          department_id: string
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          month_identifier: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          department_id: string
          file_name: string
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          month_identifier: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          month_identifier?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_attachments_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_cell_mappings: {
        Row: {
          brand: string
          cell_reference: string
          created_at: string
          department_name: string
          id: string
          is_sub_metric: boolean | null
          metric_key: string
          name_cell_reference: string | null
          parent_metric_key: string | null
          sheet_name: string
          updated_at: string
        }
        Insert: {
          brand: string
          cell_reference: string
          created_at?: string
          department_name: string
          id?: string
          is_sub_metric?: boolean | null
          metric_key: string
          name_cell_reference?: string | null
          parent_metric_key?: string | null
          sheet_name: string
          updated_at?: string
        }
        Update: {
          brand?: string
          cell_reference?: string
          created_at?: string
          department_name?: string
          id?: string
          is_sub_metric?: boolean | null
          metric_key?: string
          name_cell_reference?: string | null
          parent_metric_key?: string | null
          sheet_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      financial_copy_metadata: {
        Row: {
          copied_at: string
          copied_by: string | null
          department_id: string
          id: string
          source_identifier: string
          source_label: string | null
          target_month: string
        }
        Insert: {
          copied_at?: string
          copied_by?: string | null
          department_id: string
          id?: string
          source_identifier: string
          source_label?: string | null
          target_month: string
        }
        Update: {
          copied_at?: string
          copied_by?: string | null
          department_id?: string
          id?: string
          source_identifier?: string
          source_label?: string | null
          target_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_copy_metadata_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_entries: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          id: string
          metric_name: string
          month: string
          notes: string | null
          updated_at: string
          value: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          id?: string
          metric_name: string
          month: string
          notes?: string | null
          updated_at?: string
          value?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          id?: string
          metric_name?: string
          month?: string
          notes?: string | null
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "financial_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_entries_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_targets: {
        Row: {
          created_at: string
          department_id: string
          id: string
          metric_name: string
          quarter: number
          target_direction: string
          target_value: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          metric_name: string
          quarter?: number
          target_direction?: string
          target_value: number
          updated_at?: string
          year?: number
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          metric_name?: string
          quarter?: number
          target_direction?: string
          target_value?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "financial_targets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_driver_settings: {
        Row: {
          created_at: string
          fixed_expense: number | null
          forecast_id: string
          growth_percent: number | null
          id: string
          sales_expense: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          fixed_expense?: number | null
          forecast_id: string
          growth_percent?: number | null
          id?: string
          sales_expense?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          fixed_expense?: number | null
          forecast_id?: string
          growth_percent?: number | null
          id?: string
          sales_expense?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_driver_settings_forecast_id_fkey"
            columns: ["forecast_id"]
            isOneToOne: true
            referencedRelation: "department_forecasts"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_entries: {
        Row: {
          baseline_value: number | null
          created_at: string
          forecast_id: string
          forecast_value: number | null
          id: string
          is_locked: boolean
          metric_name: string
          month: string
          updated_at: string
        }
        Insert: {
          baseline_value?: number | null
          created_at?: string
          forecast_id: string
          forecast_value?: number | null
          id?: string
          is_locked?: boolean
          metric_name: string
          month: string
          updated_at?: string
        }
        Update: {
          baseline_value?: number | null
          created_at?: string
          forecast_id?: string
          forecast_value?: number | null
          id?: string
          is_locked?: boolean
          metric_name?: string
          month?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_entries_forecast_id_fkey"
            columns: ["forecast_id"]
            isOneToOne: false
            referencedRelation: "department_forecasts"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_submetric_notes: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          forecast_year: number
          id: string
          is_resolved: boolean
          issue_id: string | null
          note: string | null
          parent_metric_key: string
          resolved_at: string | null
          resolved_by: string | null
          sub_metric_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          forecast_year: number
          id?: string
          is_resolved?: boolean
          issue_id?: string | null
          note?: string | null
          parent_metric_key: string
          resolved_at?: string | null
          resolved_by?: string | null
          sub_metric_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          forecast_year?: number
          id?: string
          is_resolved?: boolean
          issue_id?: string | null
          note?: string | null
          parent_metric_key?: string
          resolved_at?: string | null
          resolved_by?: string | null
          sub_metric_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_submetric_notes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "forecast_submetric_notes_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_submetric_overrides: {
        Row: {
          created_at: string
          forecast_id: string
          id: string
          overridden_annual_value: number
          parent_metric_key: string
          sub_metric_key: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          forecast_id: string
          id?: string
          overridden_annual_value: number
          parent_metric_key: string
          sub_metric_key: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          forecast_id?: string
          id?: string
          overridden_annual_value?: number
          parent_metric_key?: string
          sub_metric_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_submetric_overrides_forecast_id_fkey"
            columns: ["forecast_id"]
            isOneToOne: false
            referencedRelation: "department_forecasts"
            referencedColumns: ["id"]
          },
        ]
      }
      forecast_weights: {
        Row: {
          adjusted_weight: number
          created_at: string
          forecast_id: string
          id: string
          is_locked: boolean
          month_number: number
          original_weight: number
          updated_at: string
        }
        Insert: {
          adjusted_weight?: number
          created_at?: string
          forecast_id: string
          id?: string
          is_locked?: boolean
          month_number: number
          original_weight?: number
          updated_at?: string
        }
        Update: {
          adjusted_weight?: number
          created_at?: string
          forecast_id?: string
          id?: string
          is_locked?: boolean
          month_number?: number
          original_weight?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "forecast_weights_forecast_id_fkey"
            columns: ["forecast_id"]
            isOneToOne: false
            referencedRelation: "department_forecasts"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          description: string | null
          display_order: number
          id: string
          severity: string
          source_kpi_id: string | null
          source_metric_name: string | null
          source_period: string | null
          source_type: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          description?: string | null
          display_order?: number
          id?: string
          severity?: string
          source_kpi_id?: string | null
          source_metric_name?: string | null
          source_period?: string | null
          source_type?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          description?: string | null
          display_order?: number
          id?: string
          severity?: string
          source_kpi_id?: string | null
          source_metric_name?: string | null
          source_period?: string | null
          source_type?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "issues_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "issues_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_definitions: {
        Row: {
          aggregation_type: string
          assigned_to: string | null
          created_at: string
          department_id: string
          display_order: number
          id: string
          metric_type: string
          name: string
          target_direction: string
          target_value: number | null
          updated_at: string
        }
        Insert: {
          aggregation_type?: string
          assigned_to?: string | null
          created_at?: string
          department_id: string
          display_order?: number
          id?: string
          metric_type: string
          name: string
          target_direction?: string
          target_value?: number | null
          updated_at?: string
        }
        Update: {
          aggregation_type?: string
          assigned_to?: string | null
          created_at?: string
          department_id?: string
          display_order?: number
          id?: string
          metric_type?: string
          name?: string
          target_direction?: string
          target_value?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_definitions_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kpi_definitions_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      kpi_targets: {
        Row: {
          created_at: string
          entry_type: string | null
          id: string
          kpi_id: string
          quarter: number
          target_value: number | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          entry_type?: string | null
          id?: string
          kpi_id: string
          quarter: number
          target_value?: number | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          entry_type?: string | null
          id?: string
          kpi_id?: string
          quarter?: number
          target_value?: number | null
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "kpi_targets_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      mandatory_kpi_rules: {
        Row: {
          created_at: string
          created_by: string | null
          department_type_id: string
          id: string
          is_active: boolean
          preset_kpi_id: string
          store_group_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_type_id: string
          id?: string
          is_active?: boolean
          preset_kpi_id: string
          store_group_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_type_id?: string
          id?: string
          is_active?: boolean
          preset_kpi_id?: string
          store_group_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mandatory_kpi_rules_department_type_id_fkey"
            columns: ["department_type_id"]
            isOneToOne: false
            referencedRelation: "department_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandatory_kpi_rules_preset_kpi_id_fkey"
            columns: ["preset_kpi_id"]
            isOneToOne: false
            referencedRelation: "preset_kpis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mandatory_kpi_rules_store_group_id_fkey"
            columns: ["store_group_id"]
            isOneToOne: false
            referencedRelation: "store_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      meeting_notes: {
        Row: {
          created_at: string
          created_by: string | null
          department_id: string
          id: string
          meeting_date: string
          notes: string | null
          section: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department_id: string
          id?: string
          meeting_date: string
          notes?: string | null
          section: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department_id?: string
          id?: string
          meeting_date?: string
          notes?: string | null
          section?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meeting_notes_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meeting_notes_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      preset_kpis: {
        Row: {
          aggregation_type: string
          created_at: string
          dependencies: string[] | null
          display_order: number
          id: string
          metric_type: string
          name: string
          target_direction: string
          updated_at: string
        }
        Insert: {
          aggregation_type?: string
          created_at?: string
          dependencies?: string[] | null
          display_order?: number
          id?: string
          metric_type: string
          name: string
          target_direction?: string
          updated_at?: string
        }
        Update: {
          aggregation_type?: string
          created_at?: string
          dependencies?: string[] | null
          display_order?: number
          id?: string
          metric_type?: string
          name?: string
          target_direction?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          birthday_day: number | null
          birthday_month: number | null
          created_at: string
          email: string
          full_name: string
          id: string
          is_system_user: boolean
          last_sign_in_at: string | null
          reports_to: string | null
          role: Database["public"]["Enums"]["app_role"]
          start_month: number | null
          start_year: number | null
          store_group_id: string | null
          store_id: string | null
          updated_at: string
        }
        Insert: {
          birthday_day?: number | null
          birthday_month?: number | null
          created_at?: string
          email: string
          full_name: string
          id: string
          is_system_user?: boolean
          last_sign_in_at?: string | null
          reports_to?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          start_month?: number | null
          start_year?: number | null
          store_group_id?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          birthday_day?: number | null
          birthday_month?: number | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          is_system_user?: boolean
          last_sign_in_at?: string | null
          reports_to?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          start_month?: number | null
          start_year?: number | null
          store_group_id?: string | null
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_reports_to_fkey"
            columns: ["reports_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_store_group_id_fkey"
            columns: ["store_group_id"]
            isOneToOne: false
            referencedRelation: "store_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      question_categories: {
        Row: {
          created_at: string
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      question_department_types: {
        Row: {
          created_at: string
          department_type_id: string
          id: string
          question_id: string
        }
        Insert: {
          created_at?: string
          department_type_id: string
          id?: string
          question_id: string
        }
        Update: {
          created_at?: string
          department_type_id?: string
          id?: string
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_department_types_department_type_id_fkey"
            columns: ["department_type_id"]
            isOneToOne: false
            referencedRelation: "department_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "question_department_types_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "department_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questionnaire_tokens: {
        Row: {
          created_at: string
          department_id: string
          expires_at: string
          id: string
          sent_by: string | null
          sent_to_email: string | null
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          department_id: string
          expires_at: string
          id?: string
          sent_by?: string | null
          sent_to_email?: string | null
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          department_id?: string
          expires_at?: string
          id?: string
          sent_by?: string | null
          sent_to_email?: string | null
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "questionnaire_tokens_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "questionnaire_tokens_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rocks: {
        Row: {
          assigned_to: string | null
          created_at: string
          department_id: string
          description: string | null
          due_date: string | null
          id: string
          progress_percentage: number | null
          quarter: number
          status: string | null
          title: string
          updated_at: string
          year: number
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          department_id: string
          description?: string | null
          due_date?: string | null
          id?: string
          progress_percentage?: number | null
          quarter: number
          status?: string | null
          title: string
          updated_at?: string
          year: number
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          department_id?: string
          description?: string | null
          due_date?: string | null
          id?: string
          progress_percentage?: number | null
          quarter?: number
          status?: string | null
          title?: string
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "rocks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rocks_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      scorecard_entries: {
        Row: {
          actual_value: number | null
          created_at: string
          created_by: string | null
          entry_type: string | null
          id: string
          kpi_id: string
          month: string | null
          notes: string | null
          status: string | null
          updated_at: string
          variance: number | null
          week_start_date: string | null
        }
        Insert: {
          actual_value?: number | null
          created_at?: string
          created_by?: string | null
          entry_type?: string | null
          id?: string
          kpi_id: string
          month?: string | null
          notes?: string | null
          status?: string | null
          updated_at?: string
          variance?: number | null
          week_start_date?: string | null
        }
        Update: {
          actual_value?: number | null
          created_at?: string
          created_by?: string | null
          entry_type?: string | null
          id?: string
          kpi_id?: string
          month?: string | null
          notes?: string | null
          status?: string | null
          updated_at?: string
          variance?: number | null
          week_start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scorecard_entries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scorecard_entries_kpi_id_fkey"
            columns: ["kpi_id"]
            isOneToOne: false
            referencedRelation: "kpi_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_requests: {
        Row: {
          created_at: string
          created_by: string
          expires_at: string
          id: string
          message: string | null
          original_pdf_path: string
          signed_at: string | null
          signed_pdf_path: string | null
          signer_id: string
          status: Database["public"]["Enums"]["signature_status"]
          store_id: string
          title: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          created_by: string
          expires_at?: string
          id?: string
          message?: string | null
          original_pdf_path: string
          signed_at?: string | null
          signed_pdf_path?: string | null
          signer_id: string
          status?: Database["public"]["Enums"]["signature_status"]
          store_id: string
          title: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string
          expires_at?: string
          id?: string
          message?: string | null
          original_pdf_path?: string
          signed_at?: string | null
          signed_pdf_path?: string | null
          signer_id?: string
          status?: Database["public"]["Enums"]["signature_status"]
          store_id?: string
          title?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "signature_requests_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_signer_id_fkey"
            columns: ["signer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "signature_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      signature_spots: {
        Row: {
          created_at: string
          height: number
          id: string
          label: string | null
          page_number: number
          request_id: string
          width: number
          x_position: number
          y_position: number
        }
        Insert: {
          created_at?: string
          height?: number
          id?: string
          label?: string | null
          page_number?: number
          request_id: string
          width?: number
          x_position: number
          y_position: number
        }
        Update: {
          created_at?: string
          height?: number
          id?: string
          label?: string | null
          page_number?: number
          request_id?: string
          width?: number
          x_position?: number
          y_position?: number
        }
        Relationships: [
          {
            foreignKeyName: "signature_spots_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "signature_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      store_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      stores: {
        Row: {
          brand: string | null
          brand_id: string | null
          created_at: string
          group_id: string | null
          id: string
          location: string | null
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          brand?: string | null
          brand_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          brand?: string | null
          brand_id?: string | null
          created_at?: string
          group_id?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stores_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "store_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          department_id: string | null
          description: string | null
          due_date: string | null
          id: string
          is_recurring: boolean
          issue_id: string | null
          parent_todo_id: string | null
          recurrence_interval: number | null
          recurrence_unit: string | null
          severity: string
          status: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_recurring?: boolean
          issue_id?: string | null
          parent_todo_id?: string | null
          recurrence_interval?: number | null
          recurrence_unit?: string | null
          severity?: string
          status?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          department_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_recurring?: boolean
          issue_id?: string | null
          parent_todo_id?: string | null
          recurrence_interval?: number | null
          recurrence_unit?: string | null
          severity?: string
          status?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "todos_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "todos_parent_todo_id_fkey"
            columns: ["parent_todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
        ]
      }
      top_10_items: {
        Row: {
          created_at: string
          data: Json
          id: string
          list_id: string
          rank: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          list_id: string
          rank: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          list_id?: string
          rank?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "top_10_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "top_10_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      top_10_lists: {
        Row: {
          columns: Json
          created_at: string
          department_id: string
          description: string | null
          display_order: number
          id: string
          is_active: boolean
          title: string
          updated_at: string
        }
        Insert: {
          columns?: Json
          created_at?: string
          department_id: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          columns?: Json
          created_at?: string
          department_id?: string
          description?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "top_10_lists_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_department_access: {
        Row: {
          department_id: string
          granted_at: string | null
          granted_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          department_id: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          department_id?: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_department_access_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_store_access: {
        Row: {
          granted_at: string | null
          granted_by: string | null
          id: string
          store_id: string
          user_id: string
        }
        Insert: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          store_id: string
          user_id: string
        }
        Update: {
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          store_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_store_access_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_user_store_group: { Args: never; Returns: string }
      get_profiles_basic: {
        Args: never
        Returns: {
          full_name: string
          id: string
          role: string
          store_group_id: string
          store_id: string
        }[]
      }
      get_user_department: { Args: { _user_id: string }; Returns: string }
      get_user_departments: {
        Args: { _user_id: string }
        Returns: {
          department_id: string
        }[]
      }
      get_user_store: { Args: { _user_id: string }; Returns: string }
      get_user_store_group: { Args: { _user_id: string }; Returns: string }
      get_user_store_group_no_rls: {
        Args: { _user_id: string }
        Returns: string
      }
      get_user_store_no_rls: { Args: { _user_id: string }; Returns: string }
      get_user_stores: {
        Args: { _user_id: string }
        Returns: {
          store_id: string
        }[]
      }
      get_user_stores_access: {
        Args: { _user_id: string }
        Returns: {
          store_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "store_gm"
        | "department_manager"
        | "read_only"
        | "sales_advisor"
        | "service_advisor"
        | "parts_advisor"
        | "technician"
        | "fixed_ops_manager"
      signature_status: "pending" | "viewed" | "signed" | "expired"
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
    Enums: {
      app_role: [
        "super_admin",
        "store_gm",
        "department_manager",
        "read_only",
        "sales_advisor",
        "service_advisor",
        "parts_advisor",
        "technician",
        "fixed_ops_manager",
      ],
      signature_status: ["pending", "viewed", "signed", "expired"],
    },
  },
} as const
