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
      access_logs: {
        Row: {
          created_at: string | null
          id: string
          ip_address: string | null
          logged_in_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          ip_address?: string | null
          logged_in_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      accumulation_types: {
        Row: {
          created_at: string | null
          id: string
          name: string
          status: boolean | null
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          status?: boolean | null
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          status?: boolean | null
          type?: string
        }
        Relationships: []
      }
      accumulations: {
        Row: {
          average_price: number | null
          cost: number
          created_at: string | null
          date: string
          expiration_date: string | null
          id: string
          notes: string | null
          points: number
          program: string
          type: string
          user_id: string
        }
        Insert: {
          average_price?: number | null
          cost: number
          created_at?: string | null
          date: string
          expiration_date?: string | null
          id?: string
          notes?: string | null
          points: number
          program: string
          type: string
          user_id: string
        }
        Update: {
          average_price?: number | null
          cost?: number
          created_at?: string | null
          date?: string
          expiration_date?: string | null
          id?: string
          notes?: string | null
          points?: number
          program?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      agencies: {
        Row: {
          cnpj: string | null
          created_at: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          settings: Json | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          settings?: Json | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          settings?: Json | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      agency_members: {
        Row: {
          agency_id: string
          avatar_color: string | null
          created_at: string | null
          email: string | null
          id: string
          invite_token: string | null
          is_active: boolean | null
          name: string
          phone: string | null
          pref_agenda_mine: boolean
          pref_leads_mine: boolean
          pref_tasks_mine: boolean
          role: string
          status: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          agency_id: string
          avatar_color?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          invite_token?: string | null
          is_active?: boolean | null
          name: string
          phone?: string | null
          pref_agenda_mine?: boolean
          pref_leads_mine?: boolean
          pref_tasks_mine?: boolean
          role: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          agency_id?: string
          avatar_color?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          invite_token?: string | null
          is_active?: boolean | null
          name?: string
          phone?: string | null
          pref_agenda_mine?: boolean
          pref_leads_mine?: boolean
          pref_tasks_mine?: boolean
          role?: string
          status?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_members_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_payment_settings: {
        Row: {
          agency_id: string
          asaas_api_key: string | null
          asaas_environment: string
          asaas_webhook_token: string
          created_at: string
          first_layer_rate: number | null
          grace_period_days: number
          id: string
          is_active: boolean
          monthly_price: number | null
          second_layer_rate: number | null
          trial_days: number
          updated_at: string
          yearly_price: number | null
        }
        Insert: {
          agency_id: string
          asaas_api_key?: string | null
          asaas_environment?: string
          asaas_webhook_token?: string
          created_at?: string
          first_layer_rate?: number | null
          grace_period_days?: number
          id?: string
          is_active?: boolean
          monthly_price?: number | null
          second_layer_rate?: number | null
          trial_days?: number
          updated_at?: string
          yearly_price?: number | null
        }
        Update: {
          agency_id?: string
          asaas_api_key?: string | null
          asaas_environment?: string
          asaas_webhook_token?: string
          created_at?: string
          first_layer_rate?: number | null
          grace_period_days?: number
          id?: string
          is_active?: boolean
          monthly_price?: number | null
          second_layer_rate?: number | null
          trial_days?: number
          updated_at?: string
          yearly_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_payment_settings_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage_logs: {
        Row: {
          created_at: string | null
          feature: string
          id: string
          model_id: string
          provider: string
          tokens_input: number | null
          tokens_output: number | null
          total_tokens: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          feature: string
          id?: string
          model_id: string
          provider: string
          tokens_input?: number | null
          tokens_output?: number | null
          total_tokens?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          feature?: string
          id?: string
          model_id?: string
          provider?: string
          tokens_input?: number | null
          tokens_output?: number | null
          total_tokens?: number | null
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          category: string
          created_at: string | null
          id: string
          is_active: boolean | null
          month: string
          monthly_limit: number
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          month: string
          monthly_limit?: number
          updated_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          month?: string
          monthly_limit?: number
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      card_brands: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      card_categories: {
        Row: {
          brand_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "card_categories_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "card_brands"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          annual_fee: number | null
          bank: string | null
          benefits: string[] | null
          category: string | null
          created_at: string | null
          flag: string | null
          id: string
          lounge_access: number | null
          name: string
          points_program: string | null
          points_rate: number | null
          rating: number | null
          user_id: string
        }
        Insert: {
          annual_fee?: number | null
          bank?: string | null
          benefits?: string[] | null
          category?: string | null
          created_at?: string | null
          flag?: string | null
          id?: string
          lounge_access?: number | null
          name: string
          points_program?: string | null
          points_rate?: number | null
          rating?: number | null
          user_id: string
        }
        Update: {
          annual_fee?: number | null
          bank?: string | null
          benefits?: string[] | null
          category?: string | null
          created_at?: string | null
          flag?: string | null
          id?: string
          lounge_access?: number | null
          name?: string
          points_program?: string | null
          points_rate?: number | null
          rating?: number | null
          user_id?: string
        }
        Relationships: []
      }
      crm_ai_config: {
        Row: {
          agency_id: string
          api_key_encrypted: string | null
          created_at: string | null
          id: string
          knowledge_sources: Json | null
          max_tokens: number | null
          model: string | null
          provider: string | null
          system_prompt: string | null
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          api_key_encrypted?: string | null
          created_at?: string | null
          id?: string
          knowledge_sources?: Json | null
          max_tokens?: number | null
          model?: string | null
          provider?: string | null
          system_prompt?: string | null
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          api_key_encrypted?: string | null
          created_at?: string | null
          id?: string
          knowledge_sources?: Json | null
          max_tokens?: number | null
          model?: string | null
          provider?: string | null
          system_prompt?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_ai_config_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: true
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_clients: {
        Row: {
          address_city: string | null
          address_complement: string | null
          address_country: string | null
          address_neighborhood: string | null
          address_number: string | null
          address_state: string | null
          address_street: string | null
          address_zip: string | null
          agency_id: string
          birth_date: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          name: string
          notes: string | null
          passport_country: string | null
          passport_expiry: string | null
          passport_number: string | null
          phone: string | null
          preferences: Json
          updated_at: string
          whatsapp: string | null
        }
        Insert: {
          address_city?: string | null
          address_complement?: string | null
          address_country?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          agency_id: string
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          passport_country?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          phone?: string | null
          preferences?: Json
          updated_at?: string
          whatsapp?: string | null
        }
        Update: {
          address_city?: string | null
          address_complement?: string | null
          address_country?: string | null
          address_neighborhood?: string | null
          address_number?: string | null
          address_state?: string | null
          address_street?: string | null
          address_zip?: string | null
          agency_id?: string
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          passport_country?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          phone?: string | null
          preferences?: Json
          updated_at?: string
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_clients_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "agency_members"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_itineraries: {
        Row: {
          agency_id: string
          budget: number | null
          client_name: string | null
          cover_image: string | null
          created_at: string | null
          created_by: string | null
          destination: string | null
          end_date: string | null
          id: string
          lead_id: string | null
          passengers: number | null
          share_token: string | null
          spent: number | null
          start_date: string | null
          status: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          budget?: number | null
          client_name?: string | null
          cover_image?: string | null
          created_at?: string | null
          created_by?: string | null
          destination?: string | null
          end_date?: string | null
          id?: string
          lead_id?: string | null
          passengers?: number | null
          share_token?: string | null
          spent?: number | null
          start_date?: string | null
          status?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          budget?: number | null
          client_name?: string | null
          cover_image?: string | null
          created_at?: string | null
          created_by?: string | null
          destination?: string | null
          end_date?: string | null
          id?: string
          lead_id?: string | null
          passengers?: number | null
          share_token?: string | null
          spent?: number | null
          start_date?: string | null
          status?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_itineraries_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_itineraries_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "agency_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_itineraries_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_itinerary_activities: {
        Row: {
          cost: number | null
          created_at: string | null
          day_id: string
          description: string | null
          duration: string | null
          id: string
          location: string | null
          maps_url: string | null
          sort_order: number | null
          time_start: string | null
          title: string
          type: string
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          day_id: string
          description?: string | null
          duration?: string | null
          id?: string
          location?: string | null
          maps_url?: string | null
          sort_order?: number | null
          time_start?: string | null
          title: string
          type: string
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          day_id?: string
          description?: string | null
          duration?: string | null
          id?: string
          location?: string | null
          maps_url?: string | null
          sort_order?: number | null
          time_start?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_itinerary_activities_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "crm_itinerary_days"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_itinerary_days: {
        Row: {
          created_at: string | null
          date: string | null
          day_number: number
          id: string
          itinerary_id: string
          label: string | null
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          date?: string | null
          day_number: number
          id?: string
          itinerary_id: string
          label?: string | null
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string | null
          day_number?: number
          id?: string
          itinerary_id?: string
          label?: string | null
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_itinerary_days_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "crm_itineraries"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_activities: {
        Row: {
          agency_id: string
          assigned_to_id: string | null
          author_id: string
          created_at: string | null
          details: string | null
          id: string
          lead_id: string
          mentions: string[] | null
          title: string
          type: string
        }
        Insert: {
          agency_id: string
          assigned_to_id?: string | null
          author_id: string
          created_at?: string | null
          details?: string | null
          id?: string
          lead_id: string
          mentions?: string[] | null
          title: string
          type: string
        }
        Update: {
          agency_id?: string
          assigned_to_id?: string | null
          author_id?: string
          created_at?: string | null
          details?: string | null
          id?: string
          lead_id?: string
          mentions?: string[] | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_activities_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_activities_assigned_to_id_fkey"
            columns: ["assigned_to_id"]
            isOneToOne: false
            referencedRelation: "agency_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_activities_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "agency_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_documents: {
        Row: {
          activity_id: string | null
          agency_id: string
          category: string | null
          content: string | null
          created_at: string
          file_path: string
          id: string
          itinerary_id: string | null
          lead_id: string | null
          mime_type: string | null
          name: string
          size: number | null
        }
        Insert: {
          activity_id?: string | null
          agency_id: string
          category?: string | null
          content?: string | null
          created_at?: string
          file_path: string
          id?: string
          itinerary_id?: string | null
          lead_id?: string | null
          mime_type?: string | null
          name: string
          size?: number | null
        }
        Update: {
          activity_id?: string | null
          agency_id?: string
          category?: string | null
          content?: string | null
          created_at?: string
          file_path?: string
          id?: string
          itinerary_id?: string | null
          lead_id?: string | null
          mime_type?: string | null
          name?: string
          size?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_documents_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "crm_itinerary_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_documents_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_documents_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "crm_itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_lead_documents_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          agency_id: string
          assigned_to: string | null
          benefits: Json
          budget_client: number | null
          budget_osv: number | null
          budget_total: number | null
          checklists: Json | null
          client_id: string | null
          created_at: string | null
          destination: string | null
          email: string | null
          id: string
          last_activity_at: string | null
          name: string
          notes: string | null
          origin: string | null
          phone: string | null
          profile: Json | null
          status: string
          updated_at: string | null
          value: number | null
        }
        Insert: {
          agency_id: string
          assigned_to?: string | null
          benefits?: Json
          budget_client?: number | null
          budget_osv?: number | null
          budget_total?: number | null
          checklists?: Json | null
          client_id?: string | null
          created_at?: string | null
          destination?: string | null
          email?: string | null
          id?: string
          last_activity_at?: string | null
          name: string
          notes?: string | null
          origin?: string | null
          phone?: string | null
          profile?: Json | null
          status?: string
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          agency_id?: string
          assigned_to?: string | null
          benefits?: Json
          budget_client?: number | null
          budget_osv?: number | null
          budget_total?: number | null
          checklists?: Json | null
          client_id?: string | null
          created_at?: string | null
          destination?: string | null
          email?: string | null
          id?: string
          last_activity_at?: string | null
          name?: string
          notes?: string | null
          origin?: string | null
          phone?: string | null
          profile?: Json | null
          status?: string
          updated_at?: string | null
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "agency_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "crm_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_library_destinations: {
        Row: {
          agency_id: string
          attractions: string[] | null
          avg_budget: number | null
          best_season: string | null
          category: string | null
          climate: string | null
          country: string | null
          created_at: string | null
          currency: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          operational_notes: string | null
          tags: string[] | null
          timezone: string | null
          updated_at: string | null
          visa_required: boolean | null
        }
        Insert: {
          agency_id: string
          attractions?: string[] | null
          avg_budget?: number | null
          best_season?: string | null
          category?: string | null
          climate?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          operational_notes?: string | null
          tags?: string[] | null
          timezone?: string | null
          updated_at?: string | null
          visa_required?: boolean | null
        }
        Update: {
          agency_id?: string
          attractions?: string[] | null
          avg_budget?: number | null
          best_season?: string | null
          category?: string | null
          climate?: string | null
          country?: string | null
          created_at?: string | null
          currency?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          operational_notes?: string | null
          tags?: string[] | null
          timezone?: string | null
          updated_at?: string | null
          visa_required?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_library_destinations_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_library_items: {
        Row: {
          agency_id: string
          content: string | null
          created_at: string | null
          created_by: string | null
          days: number | null
          description: string | null
          file_name: string | null
          file_url: string | null
          id: string
          image_url: string | null
          location: string | null
          price: number | null
          tags: string[] | null
          title: string
          type: string
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          days?: number | null
          description?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          price?: number | null
          tags?: string[] | null
          title: string
          type?: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          content?: string | null
          created_at?: string | null
          created_by?: string | null
          days?: number | null
          description?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          image_url?: string | null
          location?: string | null
          price?: number | null
          tags?: string[] | null
          title?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      crm_notifications: {
        Row: {
          actor_id: string | null
          agency_id: string
          body: string | null
          created_at: string
          id: string
          lead_id: string | null
          link: string | null
          read: boolean
          recipient_id: string
          title: string
          type: string
        }
        Insert: {
          actor_id?: string | null
          agency_id: string
          body?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          link?: string | null
          read?: boolean
          recipient_id: string
          title: string
          type?: string
        }
        Update: {
          actor_id?: string | null
          agency_id?: string
          body?: string | null
          created_at?: string
          id?: string
          lead_id?: string | null
          link?: string | null
          read?: boolean
          recipient_id?: string
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "agency_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notifications_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "agency_members"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          agency_id: string
          assigned_to: string | null
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          priority: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          assigned_to?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          assigned_to?: string | null
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "agency_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "agency_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_transactions: {
        Row: {
          agency_id: string
          amount: number
          category: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          itinerary_id: string | null
          lead_id: string | null
          status: string | null
          transaction_date: string
          type: string
          updated_at: string | null
        }
        Insert: {
          agency_id: string
          amount: number
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          itinerary_id?: string | null
          lead_id?: string | null
          status?: string | null
          transaction_date: string
          type: string
          updated_at?: string | null
        }
        Update: {
          agency_id?: string
          amount?: number
          category?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          itinerary_id?: string | null
          lead_id?: string | null
          status?: string | null
          transaction_date?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_transactions_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_transactions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "agency_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_transactions_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "crm_itineraries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_transactions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_trip_expenses: {
        Row: {
          activity_id: string | null
          agency_id: string
          amount: number
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          lead_id: string
          occurred_at: string | null
          paid_with: string
          savings: number
        }
        Insert: {
          activity_id?: string | null
          agency_id: string
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id: string
          occurred_at?: string | null
          paid_with?: string
          savings?: number
        }
        Update: {
          activity_id?: string | null
          agency_id?: string
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          lead_id?: string
          occurred_at?: string | null
          paid_with?: string
          savings?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_trip_expenses_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_vouchers: {
        Row: {
          category: string | null
          confirmation_code: string | null
          created_at: string | null
          file_url: string | null
          id: string
          itinerary_id: string
          name: string
          notes: string | null
        }
        Insert: {
          category?: string | null
          confirmation_code?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          itinerary_id: string
          name: string
          notes?: string | null
        }
        Update: {
          category?: string | null
          confirmation_code?: string | null
          created_at?: string | null
          file_url?: string | null
          id?: string
          itinerary_id?: string
          name?: string
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_vouchers_itinerary_id_fkey"
            columns: ["itinerary_id"]
            isOneToOne: false
            referencedRelation: "crm_itineraries"
            referencedColumns: ["id"]
          },
        ]
      }
      data_stores_ai_studio_thay: {
        Row: {
          created_at: string
          display_name: string | null
          id: number
          name: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: number
          name?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: number
          name?: string | null
        }
        Relationships: []
      }
      documents_thay_ia: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      documents_thay_ia_web: {
        Row: {
          agente: string | null
          ativo: boolean | null
          categoria: string | null
          chunk_index: number
          content: string
          created_at: string | null
          embedding: string
          hash: string | null
          id: string
          metadata: Json | null
          source: string | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          agente?: string | null
          ativo?: boolean | null
          categoria?: string | null
          chunk_index?: number
          content: string
          created_at?: string | null
          embedding: string
          hash?: string | null
          id?: string
          metadata?: Json | null
          source?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          agente?: string | null
          ativo?: boolean | null
          categoria?: string | null
          chunk_index?: number
          content?: string
          created_at?: string | null
          embedding?: string
          hash?: string | null
          id?: string
          metadata?: Json | null
          source?: string | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      dream_box_transactions: {
        Row: {
          created_at: string | null
          data_transacao: string
          descricao: string | null
          dream_box_id: string
          dream_box_origem_id: string | null
          id: string
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string | null
          data_transacao?: string
          descricao?: string | null
          dream_box_id: string
          dream_box_origem_id?: string | null
          id?: string
          tipo: string
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string | null
          data_transacao?: string
          descricao?: string | null
          dream_box_id?: string
          dream_box_origem_id?: string | null
          id?: string
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "dream_box_transactions_dream_box_id_fkey"
            columns: ["dream_box_id"]
            isOneToOne: false
            referencedRelation: "dream_boxes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dream_box_transactions_dream_box_origem_id_fkey"
            columns: ["dream_box_origem_id"]
            isOneToOne: false
            referencedRelation: "dream_boxes"
            referencedColumns: ["id"]
          },
        ]
      }
      dream_boxes: {
        Row: {
          categoria: string
          created_at: string | null
          id: string
          instituicao: string | null
          is_default: boolean | null
          meta_data: string
          meta_valor: number
          nome: string
          taxa_anual: number | null
          tipo: string | null
          updated_at: string | null
          user_id: string
          valor_aplicado: number | null
        }
        Insert: {
          categoria: string
          created_at?: string | null
          id?: string
          instituicao?: string | null
          is_default?: boolean | null
          meta_data: string
          meta_valor: number
          nome: string
          taxa_anual?: number | null
          tipo?: string | null
          updated_at?: string | null
          user_id: string
          valor_aplicado?: number | null
        }
        Update: {
          categoria?: string
          created_at?: string | null
          id?: string
          instituicao?: string | null
          is_default?: boolean | null
          meta_data?: string
          meta_valor?: number
          nome?: string
          taxa_anual?: number | null
          tipo?: string | null
          updated_at?: string | null
          user_id?: string
          valor_aplicado?: number | null
        }
        Relationships: []
      }
      dream_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      financial_accounts: {
        Row: {
          account_type: string
          bank: string | null
          created_at: string | null
          current_balance: number | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_type: string
          bank?: string | null
          created_at?: string | null
          current_balance?: number | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_type?: string
          bank?: string | null
          created_at?: string | null
          current_balance?: number | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      financial_categories: {
        Row: {
          created_at: string | null
          id: string
          is_default: boolean | null
          is_favorite: boolean | null
          name: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          is_favorite?: boolean | null
          name: string
          type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          is_favorite?: boolean | null
          name?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      financial_credit_cards: {
        Row: {
          bank: string | null
          brand: string | null
          category: string | null
          closing_day: number | null
          created_at: string | null
          due_day: number | null
          id: string
          limit_amount: number | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          bank?: string | null
          brand?: string | null
          category?: string | null
          closing_day?: number | null
          created_at?: string | null
          due_day?: number | null
          id?: string
          limit_amount?: number | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          bank?: string | null
          brand?: string | null
          category?: string | null
          closing_day?: number | null
          created_at?: string | null
          due_day?: number | null
          id?: string
          limit_amount?: number | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      financial_credit_transactions: {
        Row: {
          amount: number
          card_id: string | null
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          installment_number: number | null
          installment_value: number | null
          invoice_month: string
          is_installment: boolean | null
          parent_transaction_id: string | null
          purchase_date: string
          total_installments: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          card_id?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          installment_number?: number | null
          installment_value?: number | null
          invoice_month: string
          is_installment?: boolean | null
          parent_transaction_id?: string | null
          purchase_date: string
          total_installments?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          card_id?: string | null
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          installment_number?: number | null
          installment_value?: number | null
          invoice_month?: string
          is_installment?: boolean | null
          parent_transaction_id?: string | null
          purchase_date?: string
          total_installments?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_credit_transactions_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "financial_credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_credit_transactions_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_credit_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_transactions: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          is_recurring: boolean | null
          parent_transaction_id: string | null
          recurrence_type: string | null
          remaining_recurrences: number | null
          status: string | null
          transaction_date: string
          transaction_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          parent_transaction_id?: string | null
          recurrence_type?: string | null
          remaining_recurrences?: number | null
          status?: string | null
          transaction_date: string
          transaction_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_recurring?: boolean | null
          parent_transaction_id?: string | null
          recurrence_type?: string | null
          remaining_recurrences?: number | null
          status?: string | null
          transaction_date?: string
          transaction_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financial_transactions_parent_transaction_id_fkey"
            columns: ["parent_transaction_id"]
            isOneToOne: false
            referencedRelation: "financial_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      forms: {
        Row: {
          created_at: string
          design: Json
          fields: Json
          id: string
          settings: Json
          token: string
        }
        Insert: {
          created_at?: string
          design: Json
          fields: Json
          id?: string
          settings: Json
          token: string
        }
        Update: {
          created_at?: string
          design?: Json
          fields?: Json
          id?: string
          settings?: Json
          token?: string
        }
        Relationships: []
      }
      n8n_chat_histories: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      payment_settings: {
        Row: {
          asaas_api_key: string | null
          asaas_environment: string | null
          asaas_webhook_token: string | null
          asaas_webhook_url: string | null
          created_at: string | null
          grace_period_days: number | null
          id: string
          is_active: boolean | null
          monthly_price: number | null
          trial_days: number | null
          updated_at: string | null
          yearly_price: number | null
        }
        Insert: {
          asaas_api_key?: string | null
          asaas_environment?: string | null
          asaas_webhook_token?: string | null
          asaas_webhook_url?: string | null
          created_at?: string | null
          grace_period_days?: number | null
          id?: string
          is_active?: boolean | null
          monthly_price?: number | null
          trial_days?: number | null
          updated_at?: string | null
          yearly_price?: number | null
        }
        Update: {
          asaas_api_key?: string | null
          asaas_environment?: string | null
          asaas_webhook_token?: string | null
          asaas_webhook_url?: string | null
          created_at?: string | null
          grace_period_days?: number | null
          id?: string
          is_active?: boolean | null
          monthly_price?: number | null
          trial_days?: number | null
          updated_at?: string | null
          yearly_price?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_granted_at: string | null
          access_period_months: number | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string | null
          requires_subscription_validation: boolean | null
        }
        Insert: {
          access_granted_at?: string | null
          access_period_months?: number | null
          created_at?: string | null
          email?: string | null
          id: string
          is_active?: boolean | null
          name?: string | null
          requires_subscription_validation?: boolean | null
        }
        Update: {
          access_granted_at?: string | null
          access_period_months?: number | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string | null
          requires_subscription_validation?: boolean | null
        }
        Relationships: []
      }
      promotion_history: {
        Row: {
          discount_percent: number | null
          id: number
          image_url: string | null
          link: string | null
          message_ai: string | null
          miles: number | null
          price: number | null
          published_at: string | null
          score: number | null
          sent_at: string | null
          source_site: string | null
          title: string | null
        }
        Insert: {
          discount_percent?: number | null
          id?: number
          image_url?: string | null
          link?: string | null
          message_ai?: string | null
          miles?: number | null
          price?: number | null
          published_at?: string | null
          score?: number | null
          sent_at?: string | null
          source_site?: string | null
          title?: string | null
        }
        Update: {
          discount_percent?: number | null
          id?: number
          image_url?: string | null
          link?: string | null
          message_ai?: string | null
          miles?: number | null
          price?: number | null
          published_at?: string | null
          score?: number | null
          sent_at?: string | null
          source_site?: string | null
          title?: string | null
        }
        Relationships: []
      }
      redemptions: {
        Row: {
          created_at: string | null
          date: string
          expiration_date: string | null
          id: string
          notes: string | null
          points: number
          program: string
          type: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string | null
          date: string
          expiration_date?: string | null
          id?: string
          notes?: string | null
          points: number
          program: string
          type: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string | null
          date?: string
          expiration_date?: string | null
          id?: string
          notes?: string | null
          points?: number
          program?: string
          type?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          created_at: string | null
          first_layer_rate: number | null
          id: string
          second_layer_rate: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          first_layer_rate?: number | null
          id: string
          second_layer_rate?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          first_layer_rate?: number | null
          id?: string
          second_layer_rate?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      submissions: {
        Row: {
          created_at: string
          data: Json
          form_token: string
          id: string
        }
        Insert: {
          created_at?: string
          data: Json
          form_token: string
          id?: string
        }
        Update: {
          created_at?: string
          data?: Json
          form_token?: string
          id?: string
        }
        Relationships: []
      }
      subscribers: {
        Row: {
          asaas_customer_id: string | null
          asaas_subscription_id: string | null
          created_at: string | null
          extra_tokens_balance: number | null
          has_access: boolean | null
          id: string
          is_trial: boolean | null
          subscription_code: string | null
          subscription_end: string | null
          subscription_plan_id: string | null
          subscription_status: string
          subscription_tier: string
          trial_end: string | null
          updated_at: string | null
          updated_by: string | null
          user_id: string
        }
        Insert: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string | null
          extra_tokens_balance?: number | null
          has_access?: boolean | null
          id?: string
          is_trial?: boolean | null
          subscription_code?: string | null
          subscription_end?: string | null
          subscription_plan_id?: string | null
          subscription_status?: string
          subscription_tier?: string
          trial_end?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id: string
        }
        Update: {
          asaas_customer_id?: string | null
          asaas_subscription_id?: string | null
          created_at?: string | null
          extra_tokens_balance?: number | null
          has_access?: boolean | null
          id?: string
          is_trial?: boolean | null
          subscription_code?: string | null
          subscription_end?: string | null
          subscription_plan_id?: string | null
          subscription_status?: string
          subscription_tier?: string
          trial_end?: string | null
          updated_at?: string | null
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscribers_subscription_plan_id_fkey"
            columns: ["subscription_plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          billing_type: string | null
          created_at: string | null
          description: string | null
          features: Json | null
          id: string
          installments: string | null
          name: string
          payment_link: string | null
          periodicity: string
          price: number
          status: string | null
          trial_days: number | null
          trial_enabled: boolean | null
          updated_at: string | null
        }
        Insert: {
          billing_type?: string | null
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          installments?: string | null
          name: string
          payment_link?: string | null
          periodicity: string
          price?: number
          status?: string | null
          trial_days?: number | null
          trial_enabled?: boolean | null
          updated_at?: string | null
        }
        Update: {
          billing_type?: string | null
          created_at?: string | null
          description?: string | null
          features?: Json | null
          id?: string
          installments?: string | null
          name?: string
          payment_link?: string | null
          periodicity?: string
          price?: number
          status?: string | null
          trial_days?: number | null
          trial_enabled?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      system_alerts: {
        Row: {
          alert_type: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          title: string
        }
        Insert: {
          alert_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          title: string
        }
        Update: {
          alert_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          title?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      transfers: {
        Row: {
          created_at: string | null
          date: string
          from_program: string
          id: string
          notes: string | null
          points_received: number
          points_sent: number
          to_program: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          from_program: string
          id?: string
          notes?: string | null
          points_received: number
          points_sent: number
          to_program: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          from_program?: string
          id?: string
          notes?: string | null
          points_received?: number
          points_sent?: number
          to_program?: string
          user_id?: string
        }
        Relationships: []
      }
      travel_programs: {
        Row: {
          created_at: string | null
          id: string
          name: string
          status: boolean | null
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          status?: boolean | null
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          status?: boolean | null
          type?: string
        }
        Relationships: []
      }
      trip_ai_suggestions: {
        Row: {
          content: string
          created_at: string | null
          id: string
          step: string
          trip_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          step: string
          trip_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          step?: string
          trip_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      trip_items: {
        Row: {
          attachment_url: string | null
          cost_miles: number | null
          cost_money: number | null
          created_at: string | null
          date_end: string | null
          date_start: string | null
          description: string | null
          id: string
          is_miles_payment: boolean | null
          maps_link: string | null
          metadata: Json | null
          title: string | null
          trip_id: string
          type: string
          user_id: string
        }
        Insert: {
          attachment_url?: string | null
          cost_miles?: number | null
          cost_money?: number | null
          created_at?: string | null
          date_end?: string | null
          date_start?: string | null
          description?: string | null
          id?: string
          is_miles_payment?: boolean | null
          maps_link?: string | null
          metadata?: Json | null
          title?: string | null
          trip_id: string
          type: string
          user_id: string
        }
        Update: {
          attachment_url?: string | null
          cost_miles?: number | null
          cost_money?: number | null
          created_at?: string | null
          date_end?: string | null
          date_start?: string | null
          description?: string | null
          id?: string
          is_miles_payment?: boolean | null
          maps_link?: string | null
          metadata?: Json | null
          title?: string | null
          trip_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_research: {
        Row: {
          attachment_url: string | null
          content: string | null
          created_at: string
          id: string
          link_url: string | null
          title: string
          trip_id: string
          type: string
          user_id: string
        }
        Insert: {
          attachment_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          link_url?: string | null
          title: string
          trip_id: string
          type?: string
          user_id: string
        }
        Update: {
          attachment_url?: string | null
          content?: string | null
          created_at?: string
          id?: string
          link_url?: string | null
          title?: string
          trip_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_research_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          budget_target: number | null
          cover_image_url: string | null
          created_at: string | null
          currency: string | null
          destination: string | null
          destinations: Json | null
          end_date: string | null
          id: string
          itinerary_notes: string | null
          notes: string | null
          origin_city: string | null
          origin_country: string | null
          start_date: string | null
          status: string | null
          tags: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          budget_target?: number | null
          cover_image_url?: string | null
          created_at?: string | null
          currency?: string | null
          destination?: string | null
          destinations?: Json | null
          end_date?: string | null
          id?: string
          itinerary_notes?: string | null
          notes?: string | null
          origin_city?: string | null
          origin_country?: string | null
          start_date?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          budget_target?: number | null
          cover_image_url?: string | null
          created_at?: string | null
          currency?: string | null
          destination?: string | null
          destinations?: Json | null
          end_date?: string | null
          id?: string
          itinerary_notes?: string | null
          notes?: string | null
          origin_city?: string | null
          origin_country?: string | null
          start_date?: string | null
          status?: string | null
          tags?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_agency_invite: { Args: { _token: string }; Returns: undefined }
      agency_exists: { Args: { _agency_id: string }; Returns: boolean }
      agency_has_members: { Args: { _agency_id: string }; Returns: boolean }
      deduct_extra_tokens: {
        Args: { p_amount: number; p_user_id: string }
        Returns: undefined
      }
      ensure_admin_user: { Args: never; Returns: undefined }
      form_token_exists: { Args: { _token: string }; Returns: boolean }
      get_invite_info: {
        Args: { _token: string }
        Returns: {
          agency_name: string
          email: string
          name: string
        }[]
      }
      get_shared_itinerary: { Args: { _id: string }; Returns: Json }
      get_user_agency_id: { Args: never; Returns: string }
      get_user_member_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_account_balance: {
        Args: { account_id: string; amount_change: number }
        Returns: undefined
      }
      match_documents: {
        Args: { filter: Json; match_count: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      match_documents_thay_ia_web: {
        Args: {
          agente_filter?: string
          match_count?: number
          match_threshold?: number
          query_embedding: string
        }
        Returns: {
          content: string
          similarity: number
          source: string
          url: string
        }[]
      }
      my_pending_invite: {
        Args: never
        Returns: {
          agency_id: string
          agency_name: string
          email: string
          id: string
          name: string
        }[]
      }
      provision_agency: {
        Args: {
          _avatar_color?: string
          _email: string
          _name: string
          _slug: string
          _user_name: string
        }
        Returns: {
          agency_id: string
          avatar_color: string | null
          created_at: string | null
          email: string | null
          id: string
          invite_token: string | null
          is_active: boolean | null
          name: string
          phone: string | null
          pref_agenda_mine: boolean
          pref_leads_mine: boolean
          pref_tasks_mine: boolean
          role: string
          status: string
          updated_at: string | null
          user_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "agency_members"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      public_stock_search: {
        Args: { _company: string; _term: string }
        Returns: {
          alternative_code: string
          brand_name: string
          description: string
          has_location: boolean
          id: string
          image_url: string
          location_name: string
          min_stock: number
          name: string
          sale_price: number
          sku: string
          stock: number
          unit: string
        }[]
      }
      user_has_role: { Args: { required_role: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
