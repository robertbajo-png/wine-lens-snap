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
      client_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          level: string
          message: string
          user_id: string | null
          view: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          level?: string
          message: string
          user_id?: string | null
          view: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          level?: string
          message?: string
          user_id?: string | null
          view?: string
        }
        Relationships: []
      }
      creator_posts: {
        Row: {
          body_json: Json | null
          created_at: string
          creator_id: string
          id: string
          type: string
        }
        Insert: {
          body_json?: Json | null
          created_at?: string
          creator_id: string
          id?: string
          type?: string
        }
        Update: {
          body_json?: Json | null
          created_at?: string
          creator_id?: string
          id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_posts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          followers_count: number
          id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          followers_count?: number
          id?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          followers_count?: number
          id?: string
        }
        Relationships: []
      }
      event_logs: {
        Row: {
          created_at: string
          event_name: string
          id: string
          properties: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          properties?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          properties?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      explore_cards: {
        Row: {
          color: string | null
          created_at: string
          grapes_raw: string | null
          id: string
          image_url: string | null
          notes: string | null
          payload_json: Json | null
          producer: string | null
          rank: number | null
          region: string | null
          style: string | null
          title: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          grapes_raw?: string | null
          id?: string
          image_url?: string | null
          notes?: string | null
          payload_json?: Json | null
          producer?: string | null
          rank?: number | null
          region?: string | null
          style?: string | null
          title: string
        }
        Update: {
          color?: string | null
          created_at?: string
          grapes_raw?: string | null
          id?: string
          image_url?: string | null
          notes?: string | null
          payload_json?: Json | null
          producer?: string | null
          rank?: number | null
          region?: string | null
          style?: string | null
          title?: string
        }
        Relationships: []
      }
      label_history: {
        Row: {
          argang: string | null
          created_at: string | null
          device_id: string
          evidence: Json | null
          id: string
          land_region: string | null
          meta: Json | null
          meters: Json | null
          producent: string | null
          ts: string
          user_id: string | null
          vin: string | null
        }
        Insert: {
          argang?: string | null
          created_at?: string | null
          device_id: string
          evidence?: Json | null
          id?: string
          land_region?: string | null
          meta?: Json | null
          meters?: Json | null
          producent?: string | null
          ts?: string
          user_id?: string | null
          vin?: string | null
        }
        Update: {
          argang?: string | null
          created_at?: string | null
          device_id?: string
          evidence?: Json | null
          id?: string
          land_region?: string | null
          meta?: Json | null
          meters?: Json | null
          producent?: string | null
          ts?: string
          user_id?: string | null
          vin?: string | null
        }
        Relationships: []
      }
      list_items: {
        Row: {
          created_at: string
          id: string
          list_id: string
          scan_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          list_id: string
          scan_id: string
        }
        Update: {
          created_at?: string
          id?: string
          list_id?: string
          scan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "list_items_scan_id_fkey"
            columns: ["scan_id"]
            isOneToOne: false
            referencedRelation: "scans"
            referencedColumns: ["id"]
          },
        ]
      }
      lists: {
        Row: {
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      scans: {
        Row: {
          analysis_json: Json | null
          created_at: string
          id: string
          image_thumb: string | null
          label_hash: string | null
          raw_ocr: string | null
          user_id: string | null
          vintage: number | null
        }
        Insert: {
          analysis_json?: Json | null
          created_at?: string
          id?: string
          image_thumb?: string | null
          label_hash?: string | null
          raw_ocr?: string | null
          user_id?: string | null
          vintage?: number | null
        }
        Update: {
          analysis_json?: Json | null
          created_at?: string
          id?: string
          image_thumb?: string | null
          label_hash?: string | null
          raw_ocr?: string | null
          user_id?: string | null
          vintage?: number | null
        }
        Relationships: []
      }
      telemetry_events: {
        Row: {
          event_name: string
          id: string
          occurred_at: string
          payload_json: Json | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          event_name: string
          id?: string
          occurred_at?: string
          payload_json?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          event_name?: string
          id?: string
          occurred_at?: string
          payload_json?: Json | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_feed_state: {
        Row: {
          last_seen_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_follows: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          is_premium: boolean
          premium_since: string | null
          settings_json: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          is_premium?: boolean
          premium_since?: string | null
          settings_json?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          is_premium?: boolean
          premium_since?: string | null
          settings_json?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      premium_checkout_sessions: {
        Row: {
          cancel_url: string | null
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          provider_session_id: string | null
          status: string
          success_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_url?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          provider_session_id?: string | null
          status?: string
          success_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_url?: string | null
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          provider_session_id?: string | null
          status?: string
          success_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "premium_checkout_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      wine_index: {
        Row: {
          color: string | null
          country: string | null
          created_at: string
          grapes: string | null
          id: string
          name: string
          payload_json: Json | null
          producer: string | null
          region: string | null
          style: string | null
          vintage: number | null
        }
        Insert: {
          color?: string | null
          country?: string | null
          created_at?: string
          grapes?: string | null
          id?: string
          name: string
          payload_json?: Json | null
          producer?: string | null
          region?: string | null
          style?: string | null
          vintage?: number | null
        }
        Update: {
          color?: string | null
          country?: string | null
          created_at?: string
          grapes?: string | null
          id?: string
          name?: string
          payload_json?: Json | null
          producer?: string | null
          region?: string | null
          style?: string | null
          vintage?: number | null
        }
        Relationships: []
      }
      winesnap_cache: {
        Row: {
          created_at: string | null
          data: Json
          key: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          key: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          key?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      touch_user_feed_state: { Args: never; Returns: undefined }
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
