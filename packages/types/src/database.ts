export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      breaks: {
        Row: {
          id: string
          session_id: string
          user_id: string
          type: Database["public"]["Enums"]["break_type"]
          started_at: string
          ended_at: string | null
          usefulness: Database["public"]["Enums"]["break_usefulness"] | null
          created_at: string
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          type: Database["public"]["Enums"]["break_type"]
          started_at: string
          ended_at?: string | null
          usefulness?: Database["public"]["Enums"]["break_usefulness"] | null
          created_at?: string
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          type?: Database["public"]["Enums"]["break_type"]
          started_at?: string
          ended_at?: string | null
          usefulness?: Database["public"]["Enums"]["break_usefulness"] | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "breaks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      device_sync_log: {
        Row: {
          id: string
          device_id: string
          direction: Database["public"]["Enums"]["sync_direction"]
          entity_type: string
          entity_id: string
          synced_at: string
        }
        Insert: {
          id?: string
          device_id: string
          direction: Database["public"]["Enums"]["sync_direction"]
          entity_type: string
          entity_id: string
          synced_at?: string
        }
        Update: {
          id?: string
          device_id?: string
          direction?: Database["public"]["Enums"]["sync_direction"]
          entity_type?: string
          entity_id?: string
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_sync_log_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      devices: {
        Row: {
          id: string
          user_id: string
          device_name: string
          hardware_id: string
          last_synced_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          device_name: string
          hardware_id: string
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          device_name?: string
          hardware_id?: string
          last_synced_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      encouragement_taps: {
        Row: {
          id: string
          sender_id: string
          recipient_id: string
          created_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          recipient_id: string
          created_at?: string
        }
        Update: {
          id?: string
          sender_id?: string
          recipient_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "encouragement_taps_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encouragement_taps_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          id: string
          sender_id: string
          recipient_id: string
          status: Database["public"]["Enums"]["request_status"]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          recipient_id: string
          status?: Database["public"]["Enums"]["request_status"]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          sender_id?: string
          recipient_id?: string
          status?: Database["public"]["Enums"]["request_status"]
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          id: string
          user_id: string
          friend_id: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          friend_id: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          friend_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      long_term_goals: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          status: Database["public"]["Enums"]["goal_status"]
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          description?: string | null
          status?: Database["public"]["Enums"]["goal_status"]
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      process_goals: {
        Row: {
          id: string
          long_term_goal_id: string
          user_id: string
          title: string
          target_sessions_per_day: number
          recurrence: Database["public"]["Enums"]["recurrence_type"]
          status: Database["public"]["Enums"]["goal_status"]
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          long_term_goal_id: string
          user_id: string
          title: string
          target_sessions_per_day?: number
          recurrence?: Database["public"]["Enums"]["recurrence_type"]
          status?: Database["public"]["Enums"]["goal_status"]
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          long_term_goal_id?: string
          user_id?: string
          title?: string
          target_sessions_per_day?: number
          recurrence?: Database["public"]["Enums"]["recurrence_type"]
          status?: Database["public"]["Enums"]["goal_status"]
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "process_goals_long_term_goal_id_fkey"
            columns: ["long_term_goal_id"]
            isOneToOne: false
            referencedRelation: "long_term_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          id: string
          auth_user_id: string
          display_name: string
          username: string
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          auth_user_id: string
          display_name: string
          username: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          auth_user_id?: string
          display_name?: string
          username?: string
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sessions: {
        Row: {
          id: string
          user_id: string
          process_goal_id: string
          intention_text: string | null
          started_at: string
          ended_at: string | null
          completed: boolean
          abandonment_reason: Database["public"]["Enums"]["abandonment_reason"] | null
          focus_quality: Database["public"]["Enums"]["focus_quality"] | null
          distraction_type: Database["public"]["Enums"]["distraction_type"] | null
          device_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          process_goal_id: string
          intention_text?: string | null
          started_at: string
          ended_at?: string | null
          completed?: boolean
          abandonment_reason?: Database["public"]["Enums"]["abandonment_reason"] | null
          focus_quality?: Database["public"]["Enums"]["focus_quality"] | null
          distraction_type?: Database["public"]["Enums"]["distraction_type"] | null
          device_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          process_goal_id?: string
          intention_text?: string | null
          started_at?: string
          ended_at?: string | null
          completed?: boolean
          abandonment_reason?: Database["public"]["Enums"]["abandonment_reason"] | null
          focus_quality?: Database["public"]["Enums"]["focus_quality"] | null
          distraction_type?: Database["public"]["Enums"]["distraction_type"] | null
          device_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_process_goal_id_fkey"
            columns: ["process_goal_id"]
            isOneToOne: false
            referencedRelation: "process_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_device_id_fkey"
            columns: ["device_id"]
            isOneToOne: false
            referencedRelation: "devices"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          id: string
          user_id: string
          work_duration_minutes: number
          short_break_minutes: number
          long_break_minutes: number
          sessions_before_long_break: number
          reflection_enabled: boolean
          timezone: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          work_duration_minutes?: number
          short_break_minutes?: number
          long_break_minutes?: number
          sessions_before_long_break?: number
          reflection_enabled?: boolean
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          work_duration_minutes?: number
          short_break_minutes?: number
          long_break_minutes?: number
          sessions_before_long_break?: number
          reflection_enabled?: boolean
          timezone?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_id: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
    }
    Enums: {
      abandonment_reason: "had_to_stop" | "gave_up"
      break_type: "short" | "long"
      break_usefulness: "yes" | "somewhat" | "no"
      distraction_type: "phone" | "people" | "thoughts_wandering" | "got_stuck" | "other"
      focus_quality: "locked_in" | "decent" | "struggled"
      goal_status: "active" | "completed" | "retired"
      recurrence_type: "daily" | "weekly"
      request_status: "pending" | "accepted" | "declined"
      sync_direction: "up" | "down"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
