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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      agent_api_keys: {
        Row: {
          created_at: string
          id: string
          key_hash: string
          last_used_at: string | null
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          key_hash: string
          last_used_at?: string | null
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          key_hash?: string
          last_used_at?: string | null
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          error: string | null
          finished_at: string | null
          id: string
          newsletter_id: string | null
          notified_at: string | null
          posts_created: number
          started_at: string
          status: string
          user_id: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: string
          newsletter_id?: string | null
          notified_at?: string | null
          posts_created?: number
          started_at?: string
          status?: string
          user_id: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: string
          newsletter_id?: string | null
          notified_at?: string | null
          posts_created?: number
          started_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_schedules: {
        Row: {
          content_focus: string | null
          created_at: string
          cta: string | null
          enabled: boolean
          extract_content: boolean
          goal: string | null
          id: string
          language: string | null
          last_run_at: string | null
          length: string | null
          notification_email: string | null
          preference_profile_id: string | null
          run_hour: number
          target_audience: string | null
          timezone: string
          tone: string | null
          updated_at: string
          user_id: string
          voice_id: string | null
        }
        Insert: {
          content_focus?: string | null
          created_at?: string
          cta?: string | null
          enabled?: boolean
          extract_content?: boolean
          goal?: string | null
          id?: string
          language?: string | null
          last_run_at?: string | null
          length?: string | null
          notification_email?: string | null
          preference_profile_id?: string | null
          run_hour?: number
          target_audience?: string | null
          timezone?: string
          tone?: string | null
          updated_at?: string
          user_id: string
          voice_id?: string | null
        }
        Update: {
          content_focus?: string | null
          created_at?: string
          cta?: string | null
          enabled?: boolean
          extract_content?: boolean
          goal?: string | null
          id?: string
          language?: string | null
          last_run_at?: string | null
          length?: string | null
          notification_email?: string | null
          preference_profile_id?: string | null
          run_hour?: number
          target_audience?: string | null
          timezone?: string
          tone?: string | null
          updated_at?: string
          user_id?: string
          voice_id?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      generated_posts: {
        Row: {
          content: string
          content_focus: string | null
          created_at: string
          cta: string | null
          goal: string | null
          id: string
          input_id: string | null
          input_ids: string[] | null
          is_favorite: boolean | null
          language: string | null
          length: string | null
          published_at: string | null
          source_newsletter_id: string | null
          source_newsletter_item_id: string | null
          status: Database["public"]["Enums"]["post_status"] | null
          target_audience: string | null
          title: string | null
          tone: string | null
          updated_at: string
          user_id: string
          voice_id: string | null
        }
        Insert: {
          content: string
          content_focus?: string | null
          created_at?: string
          cta?: string | null
          goal?: string | null
          id?: string
          input_id?: string | null
          input_ids?: string[] | null
          is_favorite?: boolean | null
          language?: string | null
          length?: string | null
          published_at?: string | null
          source_newsletter_id?: string | null
          source_newsletter_item_id?: string | null
          status?: Database["public"]["Enums"]["post_status"] | null
          target_audience?: string | null
          title?: string | null
          tone?: string | null
          updated_at?: string
          user_id: string
          voice_id?: string | null
        }
        Update: {
          content?: string
          content_focus?: string | null
          created_at?: string
          cta?: string | null
          goal?: string | null
          id?: string
          input_id?: string | null
          input_ids?: string[] | null
          is_favorite?: boolean | null
          language?: string | null
          length?: string | null
          published_at?: string | null
          source_newsletter_id?: string | null
          source_newsletter_item_id?: string | null
          status?: Database["public"]["Enums"]["post_status"] | null
          target_audience?: string | null
          title?: string | null
          tone?: string | null
          updated_at?: string
          user_id?: string
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generated_posts_input_id_fkey"
            columns: ["input_id"]
            isOneToOne: false
            referencedRelation: "inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generated_posts_voice_id_fkey"
            columns: ["voice_id"]
            isOneToOne: false
            referencedRelation: "voices"
            referencedColumns: ["id"]
          },
        ]
      }
      input_notes: {
        Row: {
          content: string
          created_at: string
          id: string
          input_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          input_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          input_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "input_notes_input_id_fkey"
            columns: ["input_id"]
            isOneToOne: false
            referencedRelation: "inputs"
            referencedColumns: ["id"]
          },
        ]
      }
      input_tags: {
        Row: {
          input_id: string
          tag_id: string
        }
        Insert: {
          input_id: string
          tag_id: string
        }
        Update: {
          input_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "input_tags_input_id_fkey"
            columns: ["input_id"]
            isOneToOne: false
            referencedRelation: "inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "input_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      inputs: {
        Row: {
          category_id: string | null
          created_at: string
          extracted_content: string | null
          file_path: string | null
          id: string
          is_favorite: boolean | null
          original_url: string | null
          raw_content: string | null
          summary: string | null
          title: string
          type: Database["public"]["Enums"]["input_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          extracted_content?: string | null
          file_path?: string | null
          id?: string
          is_favorite?: boolean | null
          original_url?: string | null
          raw_content?: string | null
          summary?: string | null
          title: string
          type: Database["public"]["Enums"]["input_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          extracted_content?: string | null
          file_path?: string | null
          id?: string
          is_favorite?: boolean | null
          original_url?: string | null
          raw_content?: string | null
          summary?: string | null
          title?: string
          type?: Database["public"]["Enums"]["input_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inputs_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          imported_to_library: boolean | null
          input_id: string | null
          newsletter_id: string
          pub_date: string | null
          source_type: string | null
          title: string
          url: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          imported_to_library?: boolean | null
          input_id?: string | null
          newsletter_id: string
          pub_date?: string | null
          source_type?: string | null
          title: string
          url: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          imported_to_library?: boolean | null
          input_id?: string | null
          newsletter_id?: string
          pub_date?: string | null
          source_type?: string | null
          title?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "newsletter_items_input_id_fkey"
            columns: ["input_id"]
            isOneToOne: false
            referencedRelation: "inputs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "newsletter_items_newsletter_id_fkey"
            columns: ["newsletter_id"]
            isOneToOne: false
            referencedRelation: "newsletters"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_preference_profiles: {
        Row: {
          created_at: string
          freshness_months: number | null
          id: string
          is_default: boolean
          name: string
          preferences: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          freshness_months?: number | null
          id?: string
          is_default?: boolean
          name: string
          preferences?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          freshness_months?: number | null
          id?: string
          is_default?: boolean
          name?: string
          preferences?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      newsletters: {
        Row: {
          content: string
          created_at: string
          id: string
          language: string | null
          podcast_script: string | null
          topic: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          language?: string | null
          podcast_script?: string | null
          topic: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          language?: string | null
          podcast_script?: string | null
          topic?: string
          user_id?: string
        }
        Relationships: []
      }
      post_label_assignments: {
        Row: {
          label_id: string
          post_id: string
        }
        Insert: {
          label_id: string
          post_id: string
        }
        Update: {
          label_id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_label_assignments_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "post_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_label_assignments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "generated_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_label_publications: {
        Row: {
          label_id: string
          post_id: string
          published_at: string
        }
        Insert: {
          label_id: string
          post_id: string
          published_at?: string
        }
        Update: {
          label_id?: string
          post_id?: string
          published_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_label_publications_label_id_fkey"
            columns: ["label_id"]
            isOneToOne: false
            referencedRelation: "post_labels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_label_publications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "generated_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_labels: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          app_language: string | null
          avatar_url: string | null
          created_at: string
          default_cta: string | null
          default_length: string | null
          default_voice_id: string | null
          default_writing_style: string | null
          full_name: string | null
          id: string
          newsletter_preferences: string | null
          newsletter_preferences_enabled: boolean | null
          preferred_language: string | null
          updated_at: string
        }
        Insert: {
          app_language?: string | null
          avatar_url?: string | null
          created_at?: string
          default_cta?: string | null
          default_length?: string | null
          default_voice_id?: string | null
          default_writing_style?: string | null
          full_name?: string | null
          id: string
          newsletter_preferences?: string | null
          newsletter_preferences_enabled?: boolean | null
          preferred_language?: string | null
          updated_at?: string
        }
        Update: {
          app_language?: string | null
          avatar_url?: string | null
          created_at?: string
          default_cta?: string | null
          default_length?: string | null
          default_voice_id?: string | null
          default_writing_style?: string | null
          full_name?: string | null
          id?: string
          newsletter_preferences?: string | null
          newsletter_preferences_enabled?: boolean | null
          preferred_language?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
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
      voice_samples: {
        Row: {
          content: string
          created_at: string
          id: string
          title: string | null
          user_id: string
          voice_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          title?: string | null
          user_id: string
          voice_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          title?: string | null
          user_id?: string
          voice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_samples_voice_id_fkey"
            columns: ["voice_id"]
            isOneToOne: false
            referencedRelation: "voices"
            referencedColumns: ["id"]
          },
        ]
      }
      voices: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
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
      input_type: "pdf" | "url" | "youtube" | "text" | "audio"
      post_status: "draft" | "final" | "published"
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
      input_type: ["pdf", "url", "youtube", "text", "audio"],
      post_status: ["draft", "final", "published"],
    },
  },
} as const
