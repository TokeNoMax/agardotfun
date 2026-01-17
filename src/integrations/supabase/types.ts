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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      game_room_players: {
        Row: {
          id: string
          is_alive: boolean
          is_ready: boolean
          joined_at: string
          last_position_update: string | null
          player_color: string
          player_id: string
          player_name: string
          room_id: string
          size: number
          velocity_x: number | null
          velocity_y: number | null
          x: number
          y: number
        }
        Insert: {
          id?: string
          is_alive?: boolean
          is_ready?: boolean
          joined_at?: string
          last_position_update?: string | null
          player_color: string
          player_id: string
          player_name: string
          room_id: string
          size?: number
          velocity_x?: number | null
          velocity_y?: number | null
          x?: number
          y?: number
        }
        Update: {
          id?: string
          is_alive?: boolean
          is_ready?: boolean
          joined_at?: string
          last_position_update?: string | null
          player_color?: string
          player_id?: string
          player_name?: string
          room_id?: string
          size?: number
          velocity_x?: number | null
          velocity_y?: number | null
          x?: number
          y?: number
        }
        Relationships: [
          {
            foreignKeyName: "game_room_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "game_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      game_rooms: {
        Row: {
          created_at: string
          game_mode: string
          game_seed: string | null
          game_state: Json | null
          id: string
          last_activity: string
          match_number: number
          max_players: number
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_mode?: string
          game_seed?: string | null
          game_state?: Json | null
          id?: string
          last_activity?: string
          match_number?: number
          max_players?: number
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_mode?: string
          game_seed?: string | null
          game_state?: Json | null
          id?: string
          last_activity?: string
          match_number?: number
          max_players?: number
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color: string
          created_at?: string
          id: string
          name: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          id: string
          last_active: string
          updated_at: string
          wallet_address: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          id: string
          last_active?: string
          updated_at?: string
          wallet_address?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          last_active?: string
          updated_at?: string
          wallet_address?: string | null
        }
        Relationships: []
      }
      room_players: {
        Row: {
          created_at: string
          id: string
          is_alive: boolean | null
          is_ready: boolean | null
          player_id: string
          room_id: string
          size: number
          x: number | null
          y: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_alive?: boolean | null
          is_ready?: boolean | null
          player_id: string
          room_id: string
          size?: number
          x?: number | null
          y?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_alive?: boolean | null
          is_ready?: boolean | null
          player_id?: string
          room_id?: string
          size?: number
          x?: number | null
          y?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "room_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          created_at: string
          id: string
          max_players: number
          name: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          max_players?: number
          name: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          max_players?: number
          name?: string
          status?: string
        }
        Relationships: []
      }
      scores: {
        Row: {
          created_at: string | null
          id: string
          room_id: string | null
          score: number
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          room_id?: string | null
          score?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          room_id?: string | null
          score?: number
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scores_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      siws_nonces: {
        Row: {
          created_at: string | null
          expires_at: string
          id: string
          nonce: string
          used: boolean | null
          wallet_address: string
        }
        Insert: {
          created_at?: string | null
          expires_at: string
          id?: string
          nonce: string
          used?: boolean | null
          wallet_address: string
        }
        Update: {
          created_at?: string | null
          expires_at?: string
          id?: string
          nonce?: string
          used?: boolean | null
          wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_nonces: { Args: never; Returns: undefined }
      get_user_id: { Args: never; Returns: string }
      is_authenticated: { Args: never; Returns: boolean }
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
